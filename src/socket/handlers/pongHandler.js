const state = require('../state');

function startPongGame(io, roomId) {
  const LW = 800, LH = 480, BALL_R = 8;
  const PAD_W = 14, PAD_H = 92, PAD_MARGIN = 28;
  const WIN_SCORE = 7, INIT_SPEED = 6.5, MAX_SPEED = 16;
  const SPD_PER_HIT = 0.42, COUNTDOWN = 3;
  const MAX_BOUNCE = Math.PI / 3;
  const LP_X = PAD_MARGIN;               
  const RP_X = LW - PAD_MARGIN - PAD_W; 
  const PAD_H_HIT = PAD_H + 6; 

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
      const b    = st.ball;
      let   rem  = dt * 60;   
      let   iter = 0;

      while (rem > 1e-4 && iter++ < 8) {
        const dx = b.vx * rem;
        const dy = b.vy * rem;
        let   minT = 1.0;
        let   hit  = null;

        if (dy < 0) {
          const t = (BALL_R - b.y) / dy;
          if (t >= 0 && t < minT) { minT = t; hit = 'top'; }
        }
        if (dy > 0) {
          const t = (LH - BALL_R - b.y) / dy;
          if (t >= 0 && t < minT) { minT = t; hit = 'bot'; }
        }
        if (dx < 0 && b.x - BALL_R > LP_X + PAD_W) {
          const t = (b.x - BALL_R - (LP_X + PAD_W)) / (-dx);
          if (t >= 0 && t < minT) {
            const cy = b.y + t * dy;
            const pt = st.pY - (PAD_H_HIT - PAD_H) / 2;
            if (cy + BALL_R >= pt && cy - BALL_R <= pt + PAD_H_HIT) {
              minT = t; hit = 'pad-left';
            }
          }
        }
        if (dx > 0 && b.x + BALL_R < RP_X) {
          const t = (RP_X - (b.x + BALL_R)) / dx;
          if (t >= 0 && t < minT) {
            const cy = b.y + t * dy;
            const pt = st.aY - (PAD_H_HIT - PAD_H) / 2;
            if (cy + BALL_R >= pt && cy - BALL_R <= pt + PAD_H_HIT) {
              minT = t; hit = 'pad-right';
            }
          }
        }

        b.x += dx * minT;
        b.y += dy * minT;
        rem *= (1 - minT);

        if      (hit === 'top')       { b.y = BALL_R;      b.vy =  Math.abs(b.vy); }
        else if (hit === 'bot')       { b.y = LH - BALL_R; b.vy = -Math.abs(b.vy); }
        else if (hit === 'pad-left')  { bounce(b, st.pY,  1,  b.y); b.x = LP_X + PAD_W + BALL_R + 1; }
        else if (hit === 'pad-right') { bounce(b, st.aY, -1,  b.y); b.x = RP_X - BALL_R - 1; }
        else break; 
      }

      if (b.x + BALL_R < 0)  { st.aScore++; handlePoint(); return; }
      if (b.x - BALL_R > LW) { st.pScore++; handlePoint(); return; }
    }

    broadcast();
  }

  const iid = setInterval(tick, 16); 

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

function registerPongHandlers(io, socket) {
  socket.on('pong-join-room', ({ room, username }) => {
    if (state.pongPendingRooms.has(room)) {
      const { socketId: p1Id, username: p1Name } = state.pongPendingRooms.get(room);
      state.pongPendingRooms.delete(room);
      socket.join(room);
      io.to(p1Id).emit('pong-room-ready', { side: 'left',  room, opponent: username || 'PLAYER 2' });
      socket.emit(   'pong-room-ready',    { side: 'right', room, opponent: p1Name   || 'PLAYER 1' });
      state.pongGameRooms.set(p1Id,      { room, side: 'left'  });
      state.pongGameRooms.set(socket.id, { room, side: 'right' });
      const game = startPongGame(io, room);
      state.pongGames.set(room, game);
    } else {
      state.pongPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
      socket.join(room);
      socket.emit('pong-waiting');
    }
  });

  socket.on('pong-join-queue', ({ username }) => {
    const q = state.pongQueue();
    q.push({ id: socket.id, username: username || 'PLAYER' });
    state.setPongQueue(q);

    if (q.length >= 2) {
      const [p1, p2] = q.splice(0, 2);
      state.setPongQueue(q);

      const roomId = 'pong-q-' + state.pongQueueRoom();
      const p1Socket = io.sockets.sockets.get(p1.id);
      if (p1Socket) p1Socket.join(roomId);
      socket.join(roomId);
      io.to(p1.id).emit('pong-game-start', { side: 'left',  room: roomId, opponent: p2.username });
      io.to(p2.id).emit('pong-game-start', { side: 'right', room: roomId, opponent: p1.username });
      state.pongGameRooms.set(p1.id,     { room: roomId, side: 'left'  });
      state.pongGameRooms.set(socket.id, { room: roomId, side: 'right' });
      const game = startPongGame(io, roomId);
      state.pongGames.set(roomId, game);
      state.incrementPongQueueRoom();
    }
  });

  socket.on('pong-leave-queue', () => {
    state.setPongQueue(state.pongQueue().filter(p => p.id !== socket.id));
  });

  socket.on('pong-paddle', ({ room, y }) => {
    const info = state.pongGameRooms.get(socket.id);
    if (!info || info.room !== room) return;
    const game = state.pongGames.get(room);
    if (game) game.setPaddle(info.side, y);
  });

  socket.on('pong-restart-ready', ({ room }) => {
    const info = state.pongGameRooms.get(socket.id);
    if (!info || info.room !== room) return;
    const game = state.pongGames.get(room);
    if (game) game.readyRestart(info.side);
  });

  socket.on('pong-leave', ({ room }) => {
    const game = state.pongGames.get(room);
    if (game) { game.stop(); state.pongGames.delete(room); }
    socket.to(room).emit('pong-opponent-left');
    socket.leave(room);
    state.pongGameRooms.delete(socket.id);
    for (const [roomId, data] of state.pongPendingRooms) {
      if (data.socketId === socket.id) { state.pongPendingRooms.delete(roomId); break; }
    }
  });
}

function cleanupPong(io, socketId) {
  state.setPongQueue(state.pongQueue().filter(p => p.id !== socketId));
  for (const [roomId, data] of state.pongPendingRooms) {
    if (data.socketId === socketId) { state.pongPendingRooms.delete(roomId); break; }
  }
  const pongInfo = state.pongGameRooms.get(socketId);
  if (pongInfo) {
    const game = state.pongGames.get(pongInfo.room);
    if (game) { game.stop(); state.pongGames.delete(pongInfo.room); }
    io.to(pongInfo.room).emit('pong-opponent-left');
    state.pongGameRooms.delete(socketId);
  }
}

module.exports = { registerPongHandlers, cleanupPong };
