const state = require('../state');

function registerInfinityRunHandlers(io, socket) {
  socket.on('infrun-join-room', ({ room, username }) => {
    if (typeof room !== 'string' || room.length === 0 || room.length > 100) return;
    const safeName = typeof username === 'string' ? username.slice(0, 50) : '';
    if (state.infrunPendingRooms.has(room)) {
      const { socketId: p1Id, username: p1Name } = state.infrunPendingRooms.get(room);
      state.infrunPendingRooms.delete(room);
      socket.join(room);
      io.to(p1Id).emit('infrun-room-ready', { room, opponent: safeName || 'PLAYER 2' });
      socket.emit(     'infrun-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
      state.infrunGameRooms.set(p1Id,      room);
      state.infrunGameRooms.set(socket.id, room);
    } else {
      state.infrunPendingRooms.set(room, { socketId: socket.id, username: safeName || 'PLAYER 1' });
      socket.join(room);
      socket.emit('infrun-waiting');
    }
  });

  socket.on('infrun-join-queue', ({ username }) => {
    const q = state.infrunQueue();
    const safeName = typeof username === 'string' ? username.slice(0, 50) : 'PLAYER';
    q.push({ id: socket.id, username: safeName || 'PLAYER' });
    state.setInfrunQueue(q);

    if (q.length >= 2) {
      const [p1, p2] = q.splice(0, 2);
      state.setInfrunQueue(q);

      const roomId = 'inf-q-' + state.infrunQueueRoom();
      const p1Socket = io.sockets.sockets.get(p1.id);
      if (p1Socket) p1Socket.join(roomId);
      socket.join(roomId);
      io.to(p1.id).emit('infrun-game-start', { room: roomId, opponent: p2.username });
      io.to(p2.id).emit('infrun-game-start', { room: roomId, opponent: p1.username });
      state.infrunGameRooms.set(p1.id,     roomId);
      state.infrunGameRooms.set(socket.id, roomId);
      state.incrementInfrunQueueRoom();
    }
  });

  socket.on('infrun-leave-queue', () => {
    state.setInfrunQueue(state.infrunQueue().filter(p => p.id !== socket.id));
  });

  socket.on('infrun-state', ({ room, monkeyY, ducking, score, speed, dist, obstacles }) => {
    if (state.infrunGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('infrun-state', { monkeyY, ducking, score, speed, dist, obstacles });
  });

  socket.on('infrun-died', ({ room, score }) => {
    if (state.infrunGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('infrun-opp-died', { score });
  });

  socket.on('infrun-restart-ready', ({ room }) => {
    if (state.infrunGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('infrun-restart-ready');
  });

  socket.on('infrun-leave', ({ room }) => {
    if (state.infrunGameRooms.get(socket.id) !== room) return;
    socket.to(room).emit('infrun-opp-left');
    socket.leave(room);
    state.infrunGameRooms.delete(socket.id);
    for (const [roomId, data] of state.infrunPendingRooms) {
      if (data.socketId === socket.id) { state.infrunPendingRooms.delete(roomId); break; }
    }
  });
}

function cleanupInfinityRun(io, socketId) {
  state.setInfrunQueue(state.infrunQueue().filter(p => p.id !== socketId));
  for (const [roomId, data] of state.infrunPendingRooms) {
    if (data.socketId === socketId) { state.infrunPendingRooms.delete(roomId); break; }
  }
  const infrunRoom = state.infrunGameRooms.get(socketId);
  if (infrunRoom) {
    io.to(infrunRoom).emit('infrun-opp-left');
    state.infrunGameRooms.delete(socketId);
  }
}

module.exports = { registerInfinityRunHandlers, cleanupInfinityRun };
