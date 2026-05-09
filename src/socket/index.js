const { censorMessage } = require('../leaderboard/profanity');

// ── TicTacToe state ───────────────────────────────────────────────────────
let queuePlayers = [];
let actualQueue = 1;
let customRooms = [];

// ── Pong state ────────────────────────────────────────────────────────────
let pongQueue = [];
let pongQueueRoom = 100000;
const pongPendingRooms = new Map(); // roomId -> { socketId, username }
const pongGameRooms    = new Map(); // socketId -> { room, side }
const pongGames        = new Map(); // roomId   -> game object (server-side loop)

// ── Pacman state ──────────────────────────────────────────────────────────
let pacmanQueue = [];
let pacmanQueueRoom = 200000;
const pacmanPendingRooms = new Map();
const pacmanGameRooms    = new Map();

// ── Tetris state ──────────────────────────────────────────────────────────
let tetrisQueue = [];
let tetrisQueueRoom = 300000;
const tetrisPendingRooms = new Map();
const tetrisGameRooms    = new Map();

// ── Snake state ───────────────────────────────────────────────────────────
let snakeQueue = [];
let snakeQueueRoom = 400000;
const snakePendingRooms = new Map();
const snakeGameRooms    = new Map();

// ── Breakout state ────────────────────────────────────────────────────────
let breakoutQueue = [];
let breakoutQueueRoom = 500000;
const breakoutPendingRooms = new Map();
const breakoutGameRooms    = new Map();

// ── InfRun state ──────────────────────────────────────────────────────────
let infrunQueue = [];
let infrunQueueRoom = 600000;
const infrunPendingRooms = new Map();
const infrunGameRooms    = new Map();

// ── Server-authoritative Pong game loop ───────────────────────────────────
// All physics run here. Clients send only their paddle Y; server decides
// every collision, bounce, and score. Both clients receive pong-state every
// tick and render it — the ball NEVER passes through a paddle server-side.
function startPongGame(io, roomId) {
  const LW = 800, LH = 480, BALL_R = 8;
  const PAD_W = 14, PAD_H = 92, PAD_MARGIN = 28;
  const WIN_SCORE = 7, INIT_SPEED = 6.5, MAX_SPEED = 16;
  const SPD_PER_HIT = 0.42, COUNTDOWN = 3;
  const MAX_BOUNCE = Math.PI / 3;
  const LP_X = PAD_MARGIN;               // 28  left edge of left paddle
  const RP_X = LW - PAD_MARGIN - PAD_W; // 758 left edge of right paddle
  // Slightly expanded hitbox so that visual "near-miss" leniency favours the player
  const PAD_H_HIT = PAD_H + 6; // +3px on each side

  const st = {
    ball: { x: LW / 2, y: LH / 2, vx: 0, vy: 0, spd: INIT_SPEED, hits: 0 },
    pY: (LH - PAD_H) / 2,
    aY: (LH - PAD_H) / 2,
    pScore: 0, aScore: 0,
    phase: 'countdown', cdown: COUNTDOWN,
    winner: null,
    hostReady: false, guestReady: false,
  };

  function newBall(dir) {
    const ang = Math.PI / 9 + Math.random() * (Math.PI / 6);
    const ys  = Math.random() < 0.5 ? 1 : -1;
    return { x: LW / 2, y: LH / 2, vx: INIT_SPEED * dir * Math.cos(ang), vy: INIT_SPEED * ys * Math.sin(ang), spd: INIT_SPEED, hits: 0 };
  }

  function bounce(b, padY, dir, hitY) {
    b.hits++;
    b.spd = Math.min(MAX_SPEED, INIT_SPEED + b.hits * SPD_PER_HIT);
    const rel = Math.max(-1, Math.min(1, (hitY - (padY + PAD_H / 2)) / (PAD_H / 2)));
    const ang = rel * MAX_BOUNCE;
    b.vx = dir * Math.cos(ang) * b.spd;
    b.vy =       Math.sin(ang) * b.spd;
  }

  function broadcast() {
    io.to(roomId).emit('pong-state', {
      bx: st.ball.x, by: st.ball.y, bvx: st.ball.vx, bvy: st.ball.vy,
      bspd: st.ball.spd, bhits: st.ball.hits,
      pY: st.pY, aY: st.aY,
      pScore: st.pScore, aScore: st.aScore,
      phase: st.phase, cdown: st.cdown, winner: st.winner,
    });
  }

  function handlePoint() {
    if      (st.pScore >= WIN_SCORE) { st.phase = 'gameover'; st.winner = 'left'; }
    else if (st.aScore >= WIN_SCORE) { st.phase = 'gameover'; st.winner = 'right'; }
    else {
      st.phase = 'countdown'; st.cdown = COUNTDOWN;
      st.ball = { x: LW / 2, y: LH / 2, vx: 0, vy: 0, spd: INIT_SPEED, hits: 0 };
    }
    broadcast();
  }

  let lastTick = Date.now();

  function tick() {
    const now = Date.now();
    const dt  = Math.min((now - lastTick) / 1000, 0.05);
    lastTick  = now;

    if (st.phase === 'countdown') {
      st.cdown -= dt;
      if (st.cdown <= 0) { st.phase = 'playing'; st.ball = newBall(Math.random() < 0.5 ? 1 : -1); }
    } else if (st.phase === 'playing') {
      const f = dt * 60;

      const oldX = st.ball.x;
      const oldY = st.ball.y;

      // Move ball
      st.ball.x += st.ball.vx * f;
      st.ball.y += st.ball.vy * f;

      // Wall bounces
      if (st.ball.y - BALL_R < 0)  { st.ball.y = BALL_R;      st.ball.vy =  Math.abs(st.ball.vy); }
      if (st.ball.y + BALL_R > LH) { st.ball.y = LH - BALL_R; st.ball.vy = -Math.abs(st.ball.vy); }

      // Left paddle collision
      if (st.ball.vx < 0) {
        const pr = LP_X + PAD_W; // right edge of left paddle = 42
        if (oldX - BALL_R >= pr && st.ball.x - BALL_R <= pr) {
          const t = oldX === st.ball.x ? 0 : (oldX - BALL_R - pr) / (oldX - st.ball.x);
          const crossY = oldY + t * (st.ball.y - oldY);
          const padTop = st.pY - (PAD_H_HIT - PAD_H) / 2;
          if (crossY + BALL_R >= padTop && crossY - BALL_R <= padTop + PAD_H_HIT) {
            bounce(st.ball, st.pY, 1, crossY);
            st.ball.x = pr + BALL_R + 1 + st.ball.vx * f * (1 - t);
            st.ball.y = crossY + st.ball.vy * f * (1 - t);
          }
        }
      }

      // Right paddle collision
      if (st.ball.vx > 0) {
        if (oldX + BALL_R <= RP_X && st.ball.x + BALL_R >= RP_X) {
          const t = oldX === st.ball.x ? 0 : (RP_X - (oldX + BALL_R)) / (st.ball.x - oldX);
          const crossY = oldY + t * (st.ball.y - oldY);
          const padTop = st.aY - (PAD_H_HIT - PAD_H) / 2;
          if (crossY + BALL_R >= padTop && crossY - BALL_R <= padTop + PAD_H_HIT) {
            bounce(st.ball, st.aY, -1, crossY);
            st.ball.x = RP_X - BALL_R - 1 + st.ball.vx * f * (1 - t);
            st.ball.y = crossY + st.ball.vy * f * (1 - t);
          }
        }
      }

      // Ball exits left wall → right player (guest) scores
      if (st.ball.x + BALL_R < 0)  { st.aScore++; handlePoint(); return; }
      // Ball exits right wall → left player (host) scores
      if (st.ball.x - BALL_R > LW) { st.pScore++; handlePoint(); return; }
    }
    // gameover: keep broadcasting so clients stay on the gameover screen

    broadcast();
  }

  const iid = setInterval(tick, 16); // ~60 Hz

  return {
    stop: () => clearInterval(iid),
    setPaddle: (side, y) => {
      const clamp = v => Math.max(0, Math.min(LH - PAD_H, v));
      if (side === 'left') st.pY = clamp(y);
      else                 st.aY = clamp(y);
    },
    readyRestart: (side) => {
      if (st.phase !== 'gameover') return;
      if (side === 'left') st.hostReady  = true;
      else                 st.guestReady = true;
      if (st.hostReady && st.guestReady) {
        Object.assign(st, {
          ball: { x: LW / 2, y: LH / 2, vx: 0, vy: 0, spd: INIT_SPEED, hits: 0 },
          pY: (LH - PAD_H) / 2, aY: (LH - PAD_H) / 2,
          pScore: 0, aScore: 0,
          phase: 'countdown', cdown: COUNTDOWN, winner: null,
          hostReady: false, guestReady: false,
        });
        io.to(roomId).emit('pong-restart');
      }
    },
  };
}

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // ── TicTacToe ──────────────────────────────────────────────────────────
    socket.on('join_room', (data) => {
      socket.join(data);
      let room = customRooms.filter(r => r.room = data);
      if (room.length === 0) {
        customRooms.push({ id: socket.id, room: data });
      } else {
        io.to(data).emit('room-ready', data);
        const index = customRooms.findIndex(object => object.room === data);
        if (index > -1) customRooms.splice(index, 1);
      }
    });

    socket.on('send_message', (data) => {
      if (data && data.message) {
        data.message = censorMessage(data.message);
      }
      socket.to(data.room).emit('receive_message', data);
    });

    socket.on('select_letter', (data) => {
      socket.to(data.room).emit('letter_selected', data);
    });

    socket.on('game-move', (data) => {
      socket.to(data.room).emit('game-move', data);
    });

    socket.on('player-ready', (data) => {
      socket.to(data.room).emit('player-ready', data);
    });

    socket.on('room-ready', (data) => {
      socket.to(data.room).emit('room-ready', data);
    });

    socket.on('join_queue', (player) => {
      queuePlayers.push({ player, id: socket.id, position: queuePlayers.length + 1 });
      socket.join(actualQueue);
      if (queuePlayers.length % 2 === 0) {
        io.to(actualQueue).emit('game_start', actualQueue);
        queuePlayers = [];
        actualQueue = actualQueue >= 99999 ? 1 : actualQueue + 1;
      }
    });

    socket.on('leave-room', () => {
      removeFromQueue(socket.id);
      removeFromRooms(socket.id);
    });

    // ── Pong ───────────────────────────────────────────────────────────────
    socket.on('pong-join-room', ({ room, username }) => {
      if (pongPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = pongPendingRooms.get(room);
        pongPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('pong-room-ready', { side: 'left',  room, opponent: username || 'PLAYER 2' });
        socket.emit(   'pong-room-ready',    { side: 'right', room, opponent: p1Name   || 'PLAYER 1' });
        pongGameRooms.set(p1Id,      { room, side: 'left'  });
        pongGameRooms.set(socket.id, { room, side: 'right' });
        const game = startPongGame(io, room);
        pongGames.set(room, game);
      } else {
        pongPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('pong-waiting');
      }
    });

    socket.on('pong-join-queue', ({ username }) => {
      pongQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (pongQueue.length >= 2) {
        const [p1, p2] = pongQueue.splice(0, 2);
        const roomId = 'pong-q-' + pongQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('pong-game-start', { side: 'left',  room: roomId, opponent: p2.username });
        io.to(p2.id).emit('pong-game-start', { side: 'right', room: roomId, opponent: p1.username });
        pongGameRooms.set(p1.id,     { room: roomId, side: 'left'  });
        pongGameRooms.set(socket.id, { room: roomId, side: 'right' });
        const game = startPongGame(io, roomId);
        pongGames.set(roomId, game);
        pongQueueRoom = pongQueueRoom >= 199999 ? 100000 : pongQueueRoom + 1;
      }
    });

    socket.on('pong-leave-queue', () => {
      pongQueue = pongQueue.filter(p => p.id !== socket.id);
    });

    // Client sends its own paddle position; server applies it to game state
    socket.on('pong-paddle', ({ room, y }) => {
      const info = pongGameRooms.get(socket.id);
      if (!info || info.room !== room) return;
      const game = pongGames.get(room);
      if (game) game.setPaddle(info.side, y);
    });

    // Both players signal readiness to restart; server resets when both ready
    socket.on('pong-restart-ready', ({ room }) => {
      const info = pongGameRooms.get(socket.id);
      if (!info || info.room !== room) return;
      const game = pongGames.get(room);
      if (game) game.readyRestart(info.side);
    });

    socket.on('pong-leave', ({ room }) => {
      const game = pongGames.get(room);
      if (game) { game.stop(); pongGames.delete(room); }
      socket.to(room).emit('pong-opponent-left');
      socket.leave(room);
      pongGameRooms.delete(socket.id);
      for (const [roomId, data] of pongPendingRooms) {
        if (data.socketId === socket.id) { pongPendingRooms.delete(roomId); break; }
      }
    });

    // ── Pacman ─────────────────────────────────────────────────────────────
    socket.on('pacman-join-room', ({ room, username }) => {
      if (pacmanPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = pacmanPendingRooms.get(room);
        pacmanPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('pacman-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'pacman-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        pacmanGameRooms.set(p1Id,       room);
        pacmanGameRooms.set(socket.id,  room);
      } else {
        pacmanPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('pacman-waiting');
      }
    });

    socket.on('pacman-join-queue', ({ username }) => {
      pacmanQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (pacmanQueue.length >= 2) {
        const [p1, p2] = pacmanQueue.splice(0, 2);
        const roomId = 'pac-q-' + pacmanQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('pacman-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('pacman-game-start', { room: roomId, opponent: p1.username });
        pacmanGameRooms.set(p1.id,       roomId);
        pacmanGameRooms.set(socket.id,   roomId);
        pacmanQueueRoom = pacmanQueueRoom >= 299999 ? 200000 : pacmanQueueRoom + 1;
      }
    });

    socket.on('pacman-leave-queue', () => {
      pacmanQueue = pacmanQueue.filter(p => p.id !== socket.id);
    });

    socket.on('pacman-state', ({ room, pac, ghosts, score, lives, level }) => {
      socket.to(room).emit('pacman-state', { pac, ghosts, score, lives, level });
    });

    socket.on('pacman-dot', ({ room, row, col }) => {
      socket.to(room).emit('pacman-dot', { row, col });
    });

    socket.on('pacman-power', ({ room, row, col }) => {
      socket.to(room).emit('pacman-power', { row, col });
    });

    socket.on('pacman-died', ({ room, score }) => {
      socket.to(room).emit('pacman-opp-died', { score });
    });

    socket.on('pacman-restart-ready', ({ room }) => {
      socket.to(room).emit('pacman-restart-ready');
    });

    socket.on('pacman-leave', ({ room }) => {
      socket.to(room).emit('pacman-opp-left');
      socket.leave(room);
      pacmanGameRooms.delete(socket.id);
      for (const [roomId, data] of pacmanPendingRooms) {
        if (data.socketId === socket.id) { pacmanPendingRooms.delete(roomId); break; }
      }
    });

    // ── Tetris ─────────────────────────────────────────────────────────────
    socket.on('tetris-join-room', ({ room, username }) => {
      if (tetrisPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = tetrisPendingRooms.get(room);
        tetrisPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('tetris-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'tetris-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        tetrisGameRooms.set(p1Id,      room);
        tetrisGameRooms.set(socket.id, room);
      } else {
        tetrisPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('tetris-waiting');
      }
    });

    socket.on('tetris-join-queue', ({ username }) => {
      tetrisQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (tetrisQueue.length >= 2) {
        const [p1, p2] = tetrisQueue.splice(0, 2);
        const roomId = 'tet-q-' + tetrisQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('tetris-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('tetris-game-start', { room: roomId, opponent: p1.username });
        tetrisGameRooms.set(p1.id,     roomId);
        tetrisGameRooms.set(socket.id, roomId);
        tetrisQueueRoom = tetrisQueueRoom >= 399999 ? 300000 : tetrisQueueRoom + 1;
      }
    });

    socket.on('tetris-leave-queue', () => {
      tetrisQueue = tetrisQueue.filter(p => p.id !== socket.id);
    });

    socket.on('tetris-board', ({ room, board, score, lines, level }) => {
      socket.to(room).emit('tetris-board', { board, score, lines, level });
    });

    socket.on('tetris-piece', ({ room, x, y, shape, color }) => {
      socket.to(room).emit('tetris-piece', { x, y, shape, color });
    });

    socket.on('tetris-died', ({ room, score }) => {
      socket.to(room).emit('tetris-opp-died', { score });
    });

    socket.on('tetris-restart-ready', ({ room }) => {
      socket.to(room).emit('tetris-restart-ready');
    });

    socket.on('tetris-leave', ({ room }) => {
      socket.to(room).emit('tetris-opp-left');
      socket.leave(room);
      tetrisGameRooms.delete(socket.id);
      for (const [roomId, data] of tetrisPendingRooms) {
        if (data.socketId === socket.id) { tetrisPendingRooms.delete(roomId); break; }
      }
    });

    // ── Snake ──────────────────────────────────────────────────────────────
    socket.on('snake-join-room', ({ room, username }) => {
      if (snakePendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = snakePendingRooms.get(room);
        snakePendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('snake-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'snake-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        snakeGameRooms.set(p1Id,      room);
        snakeGameRooms.set(socket.id, room);
      } else {
        snakePendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('snake-waiting');
      }
    });

    socket.on('snake-join-queue', ({ username }) => {
      snakeQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (snakeQueue.length >= 2) {
        const [p1, p2] = snakeQueue.splice(0, 2);
        const roomId = 'snk-q-' + snakeQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('snake-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('snake-game-start', { room: roomId, opponent: p1.username });
        snakeGameRooms.set(p1.id,     roomId);
        snakeGameRooms.set(socket.id, roomId);
        snakeQueueRoom = snakeQueueRoom >= 499999 ? 400000 : snakeQueueRoom + 1;
      }
    });

    socket.on('snake-leave-queue', () => {
      snakeQueue = snakeQueue.filter(p => p.id !== socket.id);
    });

    socket.on('snake-state', ({ room, snake, food, score, level, dir }) => {
      socket.to(room).emit('snake-state', { snake, food, score, level, dir });
    });

    socket.on('snake-died', ({ room, score }) => {
      socket.to(room).emit('snake-opp-died', { score });
    });

    socket.on('snake-restart-ready', ({ room }) => {
      socket.to(room).emit('snake-restart-ready');
    });

    socket.on('snake-leave', ({ room }) => {
      socket.to(room).emit('snake-opp-left');
      socket.leave(room);
      snakeGameRooms.delete(socket.id);
      for (const [roomId, data] of snakePendingRooms) {
        if (data.socketId === socket.id) { snakePendingRooms.delete(roomId); break; }
      }
    });

    // ── Breakout ───────────────────────────────────────────────────────────
    socket.on('breakout-join-room', ({ room, username }) => {
      if (breakoutPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = breakoutPendingRooms.get(room);
        breakoutPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('breakout-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'breakout-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        breakoutGameRooms.set(p1Id,      room);
        breakoutGameRooms.set(socket.id, room);
      } else {
        breakoutPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('breakout-waiting');
      }
    });

    socket.on('breakout-join-queue', ({ username }) => {
      breakoutQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (breakoutQueue.length >= 2) {
        const [p1, p2] = breakoutQueue.splice(0, 2);
        const roomId = 'brk-q-' + breakoutQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('breakout-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('breakout-game-start', { room: roomId, opponent: p1.username });
        breakoutGameRooms.set(p1.id,     roomId);
        breakoutGameRooms.set(socket.id, roomId);
        breakoutQueueRoom = breakoutQueueRoom >= 599999 ? 500000 : breakoutQueueRoom + 1;
      }
    });

    socket.on('breakout-leave-queue', () => {
      breakoutQueue = breakoutQueue.filter(p => p.id !== socket.id);
    });

    socket.on('breakout-state', ({ room, paddle, ball, bricks, score, level, lives }) => {
      socket.to(room).emit('breakout-state', { paddle, ball, bricks, score, level, lives });
    });

    socket.on('breakout-died', ({ room, score }) => {
      socket.to(room).emit('breakout-opp-died', { score });
    });

    socket.on('breakout-restart-ready', ({ room }) => {
      socket.to(room).emit('breakout-restart-ready');
    });

    socket.on('breakout-launch-ready', ({ room }) => {
      socket.to(room).emit('breakout-opp-launch-ready');
    });

    socket.on('breakout-level-done', ({ room }) => {
      socket.to(room).emit('breakout-opp-level-done');
    });

    socket.on('breakout-leave', ({ room }) => {
      socket.to(room).emit('breakout-opp-left');
      socket.leave(room);
      breakoutGameRooms.delete(socket.id);
      for (const [roomId, data] of breakoutPendingRooms) {
        if (data.socketId === socket.id) { breakoutPendingRooms.delete(roomId); break; }
      }
    });

    // ── InfRun ─────────────────────────────────────────────────────────────
    socket.on('infrun-join-room', ({ room, username }) => {
      if (infrunPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = infrunPendingRooms.get(room);
        infrunPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('infrun-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'infrun-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        infrunGameRooms.set(p1Id,      room);
        infrunGameRooms.set(socket.id, room);
      } else {
        infrunPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('infrun-waiting');
      }
    });

    socket.on('infrun-join-queue', ({ username }) => {
      infrunQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (infrunQueue.length >= 2) {
        const [p1, p2] = infrunQueue.splice(0, 2);
        const roomId = 'inf-q-' + infrunQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('infrun-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('infrun-game-start', { room: roomId, opponent: p1.username });
        infrunGameRooms.set(p1.id,     roomId);
        infrunGameRooms.set(socket.id, roomId);
        infrunQueueRoom = infrunQueueRoom >= 699999 ? 600000 : infrunQueueRoom + 1;
      }
    });

    socket.on('infrun-leave-queue', () => {
      infrunQueue = infrunQueue.filter(p => p.id !== socket.id);
    });

    socket.on('infrun-state', ({ room, monkeyY, ducking, score, speed, dist, obstacles }) => {
      socket.to(room).emit('infrun-state', { monkeyY, ducking, score, speed, dist, obstacles });
    });

    socket.on('infrun-died', ({ room, score }) => {
      socket.to(room).emit('infrun-opp-died', { score });
    });

    socket.on('infrun-restart-ready', ({ room }) => {
      socket.to(room).emit('infrun-restart-ready');
    });

    socket.on('infrun-leave', ({ room }) => {
      socket.to(room).emit('infrun-opp-left');
      socket.leave(room);
      infrunGameRooms.delete(socket.id);
      for (const [roomId, data] of infrunPendingRooms) {
        if (data.socketId === socket.id) { infrunPendingRooms.delete(roomId); break; }
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log('User Disconnected', socket.id);
      removeFromQueue(socket.id);
      removeFromRooms(socket.id);

      // Pong queue + pending room cleanup
      pongQueue = pongQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of pongPendingRooms) {
        if (data.socketId === socket.id) { pongPendingRooms.delete(roomId); break; }
      }
      // Stop server game loop and notify opponent
      const pongInfo = pongGameRooms.get(socket.id);
      if (pongInfo) {
        const game = pongGames.get(pongInfo.room);
        if (game) { game.stop(); pongGames.delete(pongInfo.room); }
        io.to(pongInfo.room).emit('pong-opponent-left');
        pongGameRooms.delete(socket.id);
      }

      // Pacman cleanup
      pacmanQueue = pacmanQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of pacmanPendingRooms) {
        if (data.socketId === socket.id) { pacmanPendingRooms.delete(roomId); break; }
      }
      const pacmanRoom = pacmanGameRooms.get(socket.id);
      if (pacmanRoom) {
        io.to(pacmanRoom).emit('pacman-opp-left');
        pacmanGameRooms.delete(socket.id);
      }

      // Tetris cleanup
      tetrisQueue = tetrisQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of tetrisPendingRooms) {
        if (data.socketId === socket.id) { tetrisPendingRooms.delete(roomId); break; }
      }
      const tetrisRoom = tetrisGameRooms.get(socket.id);
      if (tetrisRoom) {
        io.to(tetrisRoom).emit('tetris-opp-left');
        tetrisGameRooms.delete(socket.id);
      }

      // Snake cleanup
      snakeQueue = snakeQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of snakePendingRooms) {
        if (data.socketId === socket.id) { snakePendingRooms.delete(roomId); break; }
      }
      const snakeRoom = snakeGameRooms.get(socket.id);
      if (snakeRoom) {
        io.to(snakeRoom).emit('snake-opp-left');
        snakeGameRooms.delete(socket.id);
      }

      // Breakout cleanup
      breakoutQueue = breakoutQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of breakoutPendingRooms) {
        if (data.socketId === socket.id) { breakoutPendingRooms.delete(roomId); break; }
      }
      const breakoutRoom = breakoutGameRooms.get(socket.id);
      if (breakoutRoom) {
        io.to(breakoutRoom).emit('breakout-opp-left');
        breakoutGameRooms.delete(socket.id);
      }

      // InfRun cleanup
      infrunQueue = infrunQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of infrunPendingRooms) {
        if (data.socketId === socket.id) { infrunPendingRooms.delete(roomId); break; }
      }
      const infrunRoom = infrunGameRooms.get(socket.id);
      if (infrunRoom) {
        io.to(infrunRoom).emit('infrun-opp-left');
        infrunGameRooms.delete(socket.id);
      }
    });
  });

  function removeFromQueue(socketId) {
    const index = queuePlayers.findIndex(o => o.id === socketId);
    if (index > -1) queuePlayers.splice(index, 1);
  }

  function removeFromRooms(socketId) {
    const index = customRooms.findIndex(o => o.id === socketId);
    if (index > -1) customRooms.splice(index, 1);
  }
}

module.exports = { registerSocketHandlers };
