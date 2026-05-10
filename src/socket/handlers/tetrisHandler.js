const state = require('../state');

function registerTetrisHandlers(io, socket) {
  socket.on('tetris-join-room', ({ room, username }) => {
    if (state.tetrisPendingRooms.has(room)) {
      const { socketId: p1Id, username: p1Name } = state.tetrisPendingRooms.get(room);
      state.tetrisPendingRooms.delete(room);
      socket.join(room);
      io.to(p1Id).emit('tetris-room-ready', { room, opponent: username || 'PLAYER 2' });
      socket.emit(     'tetris-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
      state.tetrisGameRooms.set(p1Id,      room);
      state.tetrisGameRooms.set(socket.id, room);
    } else {
      state.tetrisPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
      socket.join(room);
      socket.emit('tetris-waiting');
    }
  });

  socket.on('tetris-join-queue', ({ username }) => {
    const q = state.tetrisQueue();
    q.push({ id: socket.id, username: username || 'PLAYER' });
    state.setTetrisQueue(q);

    if (q.length >= 2) {
      const [p1, p2] = q.splice(0, 2);
      state.setTetrisQueue(q);

      const roomId = 'tet-q-' + state.tetrisQueueRoom();
      const p1Socket = io.sockets.sockets.get(p1.id);
      if (p1Socket) p1Socket.join(roomId);
      socket.join(roomId);
      io.to(p1.id).emit('tetris-game-start', { room: roomId, opponent: p2.username });
      io.to(p2.id).emit('tetris-game-start', { room: roomId, opponent: p1.username });
      state.tetrisGameRooms.set(p1.id,     roomId);
      state.tetrisGameRooms.set(socket.id, roomId);
      state.incrementTetrisQueueRoom();
    }
  });

  socket.on('tetris-leave-queue', () => {
    state.setTetrisQueue(state.tetrisQueue().filter(p => p.id !== socket.id));
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
    state.tetrisGameRooms.delete(socket.id);
    for (const [roomId, data] of state.tetrisPendingRooms) {
      if (data.socketId === socket.id) { state.tetrisPendingRooms.delete(roomId); break; }
    }
  });
}

function cleanupTetris(io, socketId) {
  state.setTetrisQueue(state.tetrisQueue().filter(p => p.id !== socketId));
  for (const [roomId, data] of state.tetrisPendingRooms) {
    if (data.socketId === socketId) { state.tetrisPendingRooms.delete(roomId); break; }
  }
  const tetrisRoom = state.tetrisGameRooms.get(socketId);
  if (tetrisRoom) {
    io.to(tetrisRoom).emit('tetris-opp-left');
    state.tetrisGameRooms.delete(socketId);
  }
}

module.exports = { registerTetrisHandlers, cleanupTetris };
