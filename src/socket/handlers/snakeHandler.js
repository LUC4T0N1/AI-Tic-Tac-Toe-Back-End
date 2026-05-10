const state = require('../state');

function registerSnakeHandlers(io, socket) {
  socket.on('snake-join-room', ({ room, username }) => {
    if (state.snakePendingRooms.has(room)) {
      const { socketId: p1Id, username: p1Name } = state.snakePendingRooms.get(room);
      state.snakePendingRooms.delete(room);
      socket.join(room);
      io.to(p1Id).emit('snake-room-ready', { room, opponent: username || 'PLAYER 2' });
      socket.emit(     'snake-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
      state.snakeGameRooms.set(p1Id,      room);
      state.snakeGameRooms.set(socket.id, room);
    } else {
      state.snakePendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
      socket.join(room);
      socket.emit('snake-waiting');
    }
  });

  socket.on('snake-join-queue', ({ username }) => {
    const q = state.snakeQueue();
    q.push({ id: socket.id, username: username || 'PLAYER' });
    state.setSnakeQueue(q);

    if (q.length >= 2) {
      const [p1, p2] = q.splice(0, 2);
      state.setSnakeQueue(q);

      const roomId = 'snk-q-' + state.snakeQueueRoom();
      const p1Socket = io.sockets.sockets.get(p1.id);
      if (p1Socket) p1Socket.join(roomId);
      socket.join(roomId);
      io.to(p1.id).emit('snake-game-start', { room: roomId, opponent: p2.username });
      io.to(p2.id).emit('snake-game-start', { room: roomId, opponent: p1.username });
      state.snakeGameRooms.set(p1.id,     roomId);
      state.snakeGameRooms.set(socket.id, roomId);
      state.incrementSnakeQueueRoom();
    }
  });

  socket.on('snake-leave-queue', () => {
    state.setSnakeQueue(state.snakeQueue().filter(p => p.id !== socket.id));
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
    state.snakeGameRooms.delete(socket.id);
    for (const [roomId, data] of state.snakePendingRooms) {
      if (data.socketId === socket.id) { state.snakePendingRooms.delete(roomId); break; }
    }
  });
}

function cleanupSnake(io, socketId) {
  state.setSnakeQueue(state.snakeQueue().filter(p => p.id !== socketId));
  for (const [roomId, data] of state.snakePendingRooms) {
    if (data.socketId === socketId) { state.snakePendingRooms.delete(roomId); break; }
  }
  const snakeRoom = state.snakeGameRooms.get(socketId);
  if (snakeRoom) {
    io.to(snakeRoom).emit('snake-opp-left');
    state.snakeGameRooms.delete(socketId);
  }
}

module.exports = { registerSnakeHandlers, cleanupSnake };
