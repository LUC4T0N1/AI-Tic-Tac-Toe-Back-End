const state = require('../state');

function registerBreakoutHandlers(io, socket) {
  socket.on('breakout-join-room', ({ room, username }) => {
    if (typeof room !== 'string' || room.length === 0 || room.length > 100) return;
    const safeName = typeof username === 'string' ? username.slice(0, 50) : '';
    if (state.breakoutPendingRooms.has(room)) {
      const { socketId: p1Id, username: p1Name } = state.breakoutPendingRooms.get(room);
      state.breakoutPendingRooms.delete(room);
      socket.join(room);
      io.to(p1Id).emit('breakout-room-ready', { room, opponent: safeName || 'PLAYER 2' });
      socket.emit(     'breakout-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
      state.breakoutGameRooms.set(p1Id,      room);
      state.breakoutGameRooms.set(socket.id, room);
    } else {
      state.breakoutPendingRooms.set(room, { socketId: socket.id, username: safeName || 'PLAYER 1' });
      socket.join(room);
      socket.emit('breakout-waiting');
    }
  });

  socket.on('breakout-join-queue', ({ username }) => {
    const q = state.breakoutQueue();
    const safeName = typeof username === 'string' ? username.slice(0, 50) : 'PLAYER';
    q.push({ id: socket.id, username: safeName || 'PLAYER' });
    state.setBreakoutQueue(q);

    if (q.length >= 2) {
      const [p1, p2] = q.splice(0, 2);
      state.setBreakoutQueue(q);

      const roomId = 'brk-q-' + state.breakoutQueueRoom();
      const p1Socket = io.sockets.sockets.get(p1.id);
      if (p1Socket) p1Socket.join(roomId);
      socket.join(roomId);
      io.to(p1.id).emit('breakout-game-start', { room: roomId, opponent: p2.username });
      io.to(p2.id).emit('breakout-game-start', { room: roomId, opponent: p1.username });
      state.breakoutGameRooms.set(p1.id,     roomId);
      state.breakoutGameRooms.set(socket.id, roomId);
      state.incrementBreakoutQueueRoom();
    }
  });

  socket.on('breakout-leave-queue', () => {
    state.setBreakoutQueue(state.breakoutQueue().filter(p => p.id !== socket.id));
  });

  socket.on('breakout-state', ({ room, paddle, ball, bricks, score, level, lives }) => {
    if (state.breakoutGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('breakout-state', { paddle, ball, bricks, score, level, lives });
  });

  socket.on('breakout-died', ({ room, score }) => {
    if (state.breakoutGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('breakout-opp-died', { score });
  });

  socket.on('breakout-restart-ready', ({ room }) => {
    if (state.breakoutGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('breakout-restart-ready');
  });

  socket.on('breakout-launch-ready', ({ room }) => {
    if (state.breakoutGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('breakout-opp-launch-ready');
  });

  socket.on('breakout-level-done', ({ room }) => {
    if (state.breakoutGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('breakout-opp-level-done');
  });

  socket.on('breakout-leave', ({ room }) => {
    if (state.breakoutGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('breakout-opp-left');
    socket.leave(room);
    state.breakoutGameRooms.delete(socket.id);
    for (const [roomId, data] of state.breakoutPendingRooms) {
      if (data.socketId === socket.id) { state.breakoutPendingRooms.delete(roomId); break; }
    }
  });
}

function cleanupBreakout(io, socketId) {
  state.setBreakoutQueue(state.breakoutQueue().filter(p => p.id !== socketId));
  for (const [roomId, data] of state.breakoutPendingRooms) {
    if (data.socketId === socketId) { state.breakoutPendingRooms.delete(roomId); break; }
  }
  const breakoutRoom = state.breakoutGameRooms.get(socketId);
  if (breakoutRoom) {
    io.to(breakoutRoom).emit('breakout-opp-left');
    state.breakoutGameRooms.delete(socketId);
  }
}

module.exports = { registerBreakoutHandlers, cleanupBreakout };
