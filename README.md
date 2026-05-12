# 🎮 Retro Wave Games — Backend

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.5-black.svg)](https://socket.io/)

Real-time multiplayer backend for the **Retro Wave Games** platform. Handles WebSocket connections, matchmaking, game state synchronization and leaderboard persistence for 7 arcade games.

🌐 **Frontend:** [retro-wave-games.netlify.app](https://retro-wave-games.netlify.app/)  
📦 **Frontend repo:** [Retro-Wave-Games-Front-End](https://github.com/LUC4T0N1/Multiplayer-AI-Tic-Tac-Toe)

---

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Features](#-features)
- [API & Socket Events](#-api--socket-events)
- [Leaderboard API](#-leaderboard-api)
- [Socket Events by Game](#-socket-events-by-game)
- [Technologies](#-technologies)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Author](#-author)

---

## 🏗️ Architecture Overview

```
Client (React + Socket.IO)
        │
        ▼
  Express HTTP Server (port 8080)
        │
        ├── REST API (/leaderboard/*)   ← score submission & retrieval
        │         │
        │         └── PostgreSQL (Supabase)
        │
        └── Socket.IO Server
                  │
                  ├── Tic-Tac-Toe handler
                  ├── Pong handler
                  ├── Pac-Man handler
                  ├── Tetris handler
                  ├── Snake handler
                  ├── Breakout handler
                  └── Infinity Run handler
```

Each game handler manages its own **pending rooms** (waiting for a 2nd player) and **active game rooms** independently. Room state lives in memory via `src/socket/state.js`.

---

## ✨ Features

### Matchmaking
- **Friend rooms** — player creates a named room and shares the code; second player joins by entering the same code
- **Random queue** — players join a global queue and are automatically paired when two are waiting
- Each game has its own isolated room namespace with prefixed IDs to avoid collisions

### Real-Time Sync
- Game state (positions, scores, board, etc.) is relayed between players at ~10 fps
- Disconnect detection: when a player drops, the opponent is immediately notified via a `*-opp-left` event
- Play-again flow: both players must emit a restart-ready signal before the new round begins

### Leaderboard
- Per-game leaderboard stored in PostgreSQL (Supabase)
- One-time session tokens prevent score spoofing
- Score plausibility validated against session duration
- Paginated results (10 per page, up to 10,000 pages)
- Profanity filter applied to player names (English + Brazilian Portuguese)

### Security
- **Helmet** — HTTP security headers
- **express-rate-limit** — layered rate limiting:
  - Global API: 100 req / 15 min
  - Session endpoint: 20 req / 5 min
  - Score submission: 10 req / 5 min
  - Socket events: 1 200 events / 10 s per socket
- **CORS** — restricted to the configured `CLIENT_URL`
- **Body size limit** — 10 KB JSON payloads (DoS prevention)
- **Session tokens** — UUID, single-use, 2-hour TTL

---

## 📡 API & Socket Events

### Room ID Ranges

Each game uses a separate numeric range for auto-generated queue room IDs:

| Game | Queue room prefix | ID range |
|---|---|---|
| Tic-Tac-Toe | `ttt_queue_` | — |
| Pong | `pong-q-` | 100 000 – 199 999 |
| Pac-Man | `pac-q-` | 200 000 – 299 999 |
| Tetris | `tet-q-` | 300 000 – 399 999 |
| Snake | `snk-q-` | 400 000 – 499 999 |
| Breakout | `brk-q-` | 500 000 – 599 999 |
| Infinity Run | `inf-q-` | 600 000 – 699 999 |

---

## 🏆 Leaderboard API

All leaderboard routes follow the same pattern, mounted at `/leaderboard/<game>`:

| Game | Base path |
|---|---|
| Snake | `/leaderboard/snake` |
| Tetris | `/leaderboard/tetris` |
| Pac-Man | `/leaderboard/pacman` |
| Breakout | `/leaderboard/breakout` |
| Infinity Run | `/leaderboard/infinityrun` |

### `POST /leaderboard/<game>/session`
Request a one-time session token before submitting a score.

**Rate limit:** 20 req / 5 min  
**Response:**
```json
{ "sessionToken": "uuid-v4" }
```

---

### `POST /leaderboard/<game>/`
Submit a score.

**Rate limit:** 10 req / 5 min  
**Body:**
```json
{
  "name": "Player",
  "score": 4200,
  "sessionToken": "uuid-v4"
}
```

**Validation:**
- `name`: 1–20 characters, no profanity
- `score`: non-negative integer
- `sessionToken`: must be valid, unused, and not expired (2 h TTL)
- Score plausibility check against session start time

**Response `201`:**
```json
{ "id": 1, "name": "Player", "score": 4200 }
```

---

### `GET /leaderboard/<game>/?page=1`
Retrieve paginated leaderboard (10 entries per page, ordered by score descending).

**Response:**
```json
{
  "page": 1,
  "data": [
    { "id": 1, "name": "Player", "score": 9999, "created_at": "..." }
  ]
}
```

---

## 🔌 Socket Events by Game

All multiplayer games share the same two-step room flow:

```
Player A emits  *-join-room / *-join-queue
                      │
              (waits for Player B)
                      │
Player B joins the same room / queue
                      │
Server emits  *-room-ready / *-game-start  →  both players
                      │
              Game loop begins
```

---

### Tic-Tac-Toe

| Direction | Event | Payload |
|---|---|---|
| emit | `join_room` | `roomId: string` |
| emit | `join_queue` | `playerName: string` |
| emit | `send_message` | `{ room, message }` |
| emit | `select_letter` | `{ room, ... }` |
| emit | `game-move` | `{ room, ... }` |
| emit | `player-ready` | `{ room }` |
| emit | `leave-room` | — |
| on | `room-ready` | room matched |
| on | `game_start` | queue match found |
| on | `receive_message` | `{ message }` |
| on | `letter_selected` | opponent selected square |
| on | `game-move` | opponent move |
| on | `player-ready` | opponent ready |

---

### Pong

| Direction | Event | Payload |
|---|---|---|
| emit | `pong-join-room` | `{ room, username }` |
| emit | `pong-join-queue` | `{ username }` |
| emit | `pong-leave-queue` | — |
| emit | `pong-paddle` | `{ room, y }` |
| emit | `pong-restart-ready` | `{ room }` |
| emit | `pong-leave` | `{ room }` |
| on | `pong-waiting` | waiting for opponent |
| on | `pong-room-ready` | room matched |
| on | `pong-game-start` | queue match found |
| on | `pong-state` | `{ ball, paddles, score }` |
| on | `pong-restart` | game restarted |
| on | `pong-opponent-left` | opponent disconnected |

---

### Pac-Man

| Direction | Event | Payload |
|---|---|---|
| emit | `pacman-join-room` | `{ room, username }` |
| emit | `pacman-join-queue` | `{ username }` |
| emit | `pacman-leave-queue` | — |
| emit | `pacman-state` | `{ room, pac, ghosts, score, lives, level }` |
| emit | `pacman-dot` | `{ room, row, col }` |
| emit | `pacman-power` | `{ room, row, col }` |
| emit | `pacman-died` | `{ room, score }` |
| emit | `pacman-restart-ready` | `{ room }` |
| emit | `pacman-leave` | `{ room }` |
| on | `pacman-waiting` | waiting for opponent |
| on | `pacman-room-ready` | room matched |
| on | `pacman-game-start` | queue match found |
| on | `pacman-state` | opponent state |
| on | `pacman-dot` | opponent ate dot |
| on | `pacman-power` | opponent ate power-up |
| on | `pacman-opp-died` | opponent died |
| on | `pacman-restart-ready` | opponent ready |
| on | `pacman-opp-left` | opponent disconnected |

---

### Tetris

| Direction | Event | Payload |
|---|---|---|
| emit | `tetris-join-room` | `{ room, username }` |
| emit | `tetris-join-queue` | `{ username }` |
| emit | `tetris-leave-queue` | — |
| emit | `tetris-board` | `{ room, board, score, lines, level }` |
| emit | `tetris-piece` | `{ room, x, y, shape, color }` |
| emit | `tetris-died` | `{ room, score }` |
| emit | `tetris-restart-ready` | `{ room }` |
| emit | `tetris-leave` | `{ room }` |
| on | `tetris-waiting` | waiting for opponent |
| on | `tetris-room-ready` | room matched |
| on | `tetris-game-start` | queue match found |
| on | `tetris-board` | opponent board state |
| on | `tetris-piece` | opponent current piece |
| on | `tetris-opp-died` | opponent died |
| on | `tetris-restart-ready` | opponent ready |
| on | `tetris-opp-left` | opponent disconnected |

---

### Snake

| Direction | Event | Payload |
|---|---|---|
| emit | `snake-join-room` | `{ room, username }` |
| emit | `snake-join-queue` | `{ username }` |
| emit | `snake-leave-queue` | — |
| emit | `snake-state` | `{ room, snake, food, score, level, dir }` |
| emit | `snake-died` | `{ room, score }` |
| emit | `snake-restart-ready` | `{ room }` |
| emit | `snake-leave` | `{ room }` |
| on | `snake-waiting` | waiting for opponent |
| on | `snake-room-ready` | room matched |
| on | `snake-game-start` | queue match found |
| on | `snake-state` | opponent state |
| on | `snake-opp-died` | opponent died |
| on | `snake-restart-ready` | opponent ready |
| on | `snake-opp-left` | opponent disconnected |

---

### Breakout

| Direction | Event | Payload |
|---|---|---|
| emit | `breakout-join-room` | `{ room, username }` |
| emit | `breakout-join-queue` | `{ username }` |
| emit | `breakout-leave-queue` | — |
| emit | `breakout-state` | `{ room, paddle, ball, bricks, score, level }` |
| emit | `breakout-died` | `{ room, score }` |
| emit | `breakout-launch-ready` | `{ room }` |
| emit | `breakout-level-done` | `{ room }` |
| emit | `breakout-restart-ready` | `{ room }` |
| emit | `breakout-leave` | `{ room }` |
| on | `breakout-waiting` | waiting for opponent |
| on | `breakout-room-ready` | room matched |
| on | `breakout-game-start` | queue match found |
| on | `breakout-state` | opponent state |
| on | `breakout-opp-died` | opponent died |
| on | `breakout-opp-launch-ready` | opponent launched ball |
| on | `breakout-opp-level-done` | opponent cleared level |
| on | `breakout-restart-ready` | opponent ready |
| on | `breakout-opp-left` | opponent disconnected |

---

### Infinity Run

| Direction | Event | Payload |
|---|---|---|
| emit | `infrun-join-room` | `{ room, username }` |
| emit | `infrun-join-queue` | `{ username }` |
| emit | `infrun-leave-queue` | — |
| emit | `infrun-state` | `{ room, monkeyY, ducking, score, speed, dist, obstacles }` |
| emit | `infrun-died` | `{ room, score }` |
| emit | `infrun-restart-ready` | `{ room }` |
| emit | `infrun-leave` | `{ room }` |
| on | `infrun-waiting` | waiting for opponent |
| on | `infrun-room-ready` | room matched |
| on | `infrun-game-start` | queue match found |
| on | `infrun-state` | opponent state |
| on | `infrun-opp-died` | opponent died |
| on | `infrun-restart-ready` | opponent ready |
| on | `infrun-opp-left` | opponent disconnected |

---

## 🛠️ Technologies

| Technology | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18+ | Runtime |
| [Express](https://expressjs.com/) | 4.18 | HTTP server & REST API |
| [Socket.IO](https://socket.io/) | 4.5 | Real-time WebSocket communication |
| [PostgreSQL (pg)](https://node-postgres.com/) | 8.20 | Leaderboard persistence |
| [Supabase](https://supabase.com/) | — | Managed PostgreSQL host |
| [Helmet](https://helmetjs.github.io/) | 8.1 | HTTP security headers |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | 8.5 | API & socket rate limiting |
| [cors](https://github.com/expressjs/cors) | 2.8 | Cross-origin resource sharing |
| [dotenv](https://github.com/motdotla/dotenv) | 16.0 | Environment variable loading |
| [nodemon](https://nodemon.io/) | 3.1 | Dev auto-restart |

---

## 📁 Project Structure

```
src/
├── index.js                        # Entry point: Express + Socket.IO setup, middleware, routes
├── db.js                           # PostgreSQL connection pool (Supabase)
│
├── socket/
│   ├── index.js                    # Registers all game handlers on the Socket.IO instance
│   ├── state.js                    # In-memory room state (queues, pending rooms, active rooms)
│   └── handlers/
│       ├── ticTacToeHandler.js     # Tic-Tac-Toe events + chat relay
│       ├── pongHandler.js          # Pong events
│       ├── pacmanHandler.js        # Pac-Man events
│       ├── tetrisHandler.js        # Tetris events
│       ├── snakeHandler.js         # Snake events
│       ├── breakoutHandler.js      # Breakout events
│       └── infinityRunHandler.js   # Infinity Run events
│
├── leaderboard/
│   ├── createRouter.js             # Express router factory — generates REST endpoints for any game
│   ├── createRepository.js         # Database queries (insert score, fetch page)
│   └── profanity.js                # Profanity filter (EN + PT-BR) for names and chat
│
└── games/
    ├── snake/routes.js             # Mounts leaderboard router for Snake
    ├── tetris/routes.js            # Mounts leaderboard router for Tetris
    ├── pacman/routes.js            # Mounts leaderboard router for Pac-Man
    ├── breakout/routes.js          # Mounts leaderboard router for Breakout
    └── infinityrun/routes.js       # Mounts leaderboard router for Infinity Run
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/)
- A PostgreSQL database (or a [Supabase](https://supabase.com/) project)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/LUC4T0N1/Retro-Wave-Games-Back-End
cd Retro-Wave-Games-Back-End

# 2. Install dependencies
npm install

# 3. Configure environment variables
# Create a .env file (see section below)

# 4. Start the server
npm start          # production
npx nodemon src/index.js   # development (auto-restart)
```

The server will be available at `http://localhost:8080`.

### Database Setup

Create the following tables in your PostgreSQL database (one per game):

```sql
CREATE TABLE "retro-wave-games".leaderboards_snake (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(20) NOT NULL,
  score      INTEGER     NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Repeat for: leaderboards_tetris, leaderboards_pacman,
--             leaderboards_breakout, leaderboards_infinity_run
```

---

## 🔧 Environment Variables

Create a `.env` file at the project root:

```env
# Server port
PORT=8080

# Allowed frontend origin (no trailing slash)
CLIENT_URL=http://localhost:3000

# PostgreSQL connection (Supabase or any Postgres host)
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=postgres
DB_PORT=5432
```

| Variable | Description | Example |
|---|---|---|
| `PORT` | Port the server listens on | `8080` |
| `CLIENT_URL` | Frontend origin allowed by CORS | `https://retro-wave-games.netlify.app` |
| `DB_HOST` | PostgreSQL host | `aws-1-us-east-2.pooler.supabase.com` |
| `DB_USER` | PostgreSQL user | `postgres.xxxxxxxx` |
| `DB_PASSWORD` | PostgreSQL password | — |
| `DB_NAME` | Database name | `postgres` |
| `DB_PORT` | PostgreSQL port | `5432` |

---

## 👤 Author

**Lucas Moniz de Arruda**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/lucas-moniz-de-arruda/)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white)](https://github.com/LUC4T0N1)
