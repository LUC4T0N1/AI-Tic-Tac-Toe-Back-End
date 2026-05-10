const state = require('../state');

function registerPacmanHandlers(io, socket) {
  socket.on('pacman-join-room', ({ room, username }) => {
    if (state.pacmanPendingRooms.has(room)) {
      const { socketId: p1Id, username: p1Name } = state.pacmanPendingRooms.get(room);
      state.pacmanPendingRooms.delete(room);
      socket.join(room);
      io.to(p1Id).emit('pacman-room-ready', { room, opponent: username || 'PLAYER 2' });
      socket.emit(     'pacman-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
      state.pacmanGameRooms.set(p1Id,       room);
      state.pacmanGameRooms.set(socket.id,  room);
    } else {
      state.pacmanPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
      socket.join(room);
      socket.emit('pacman-waiting');
    }
  });

  socket.on('pacman-join-queue', ({ username }) => {
    const q = state.pacmanQueue();
    q.push({ id: socket.id, username: username || 'PLAYER' });
    state.setPacmanQueue(q);

    if (q.length >= 2) {
      const [p1, p2] = q.splice(0, 2);
      state.setPacmanQueue(q);

      const roomId = 'pac-q-' + state.pacmanQueueRoom();
      const p1Socket = io.sockets.sockets.get(p1.id);
      if (p1Socket) p1Socket.join(roomId);
      socket.join(roomId);
      io.to(p1.id).emit('pacman-game-start', { room: roomId, opponent: p2.username });
      io.to(p2.id).emit('pacman-game-start', { room: roomId, opponent: p1.username });
      state.pacmanGameRooms.set(p1.id,       roomId);
      state.pacmanGameRooms.set(socket.id,   roomId);
      state.incrementPacmanQueueRoom();
    }
  });

  socket.on('pacman-leave-queue', () => {
    state.setPacmanQueue(state.pacmanQueue().filter(p => p.id !== socket.id));
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
    state.pacmanGameRooms.delete(socket.id);
    for (const [roomId, data] of state.pacmanPendingRooms) {
      if (data.socketId === socket.id) { state.pacmanPendingRooms.delete(roomId); break; }
    }
  });
}

function cleanupPacman(io, socketId) {
  state.setPacmanQueue(state.pacmanQueue().filter(p => p.id !== socketId));
  for (const [roomId, data] of state.pacmanPendingRooms) {
    if (data.socketId === socketId) { state.pacmanPendingRooms.delete(roomId); break; }
  }
  const pacmanRoom = state.pacmanGameRooms.get(socketId);
  if (pacmanRoom) {
    io.to(pacmanRoom).emit('pacman-opp-left');
    state.pacmanGameRooms.delete(socketId);
  }
}

module.exports = { registerPacmanHandlers, cleanupPacman };
