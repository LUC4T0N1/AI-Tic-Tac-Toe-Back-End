const { censorMessage } = require('../../leaderboard/profanity');
const state = require('../state');

function isValidRoom(data) {
  if (!data || data.room === undefined) return false;
  const r = String(data.room);
  return r.length > 0 && r.length <= 100;
}

function registerTicTacToeHandlers(io, socket) {
  socket.on('join_room', (data) => {
    if (typeof data !== 'string' || data.length === 0 || data.length > 100) return;
    socket.join(data);
    let room = state.customRooms.filter(r => r.room === data);
    if (room.length === 0) {
      state.customRooms.push({ id: socket.id, room: data });
    } else {
      io.to(data).emit('room-ready', data);
      const index = state.customRooms.findIndex(object => object.room === data);
      if (index > -1) state.customRooms.splice(index, 1);
    }
  });

  socket.on('send_message', (data) => {
    if (!isValidRoom(data)) return;
    const r = String(data.room);
    if (!socket.rooms.has(r)) return;
    if (data.message) data.message = censorMessage(String(data.message).slice(0, 500));
    socket.to(r).emit('receive_message', data);
  });

  socket.on('select_letter', (data) => {
    if (!isValidRoom(data)) return;
    const r = String(data.room);
    if (!socket.rooms.has(r)) return;
    socket.to(r).emit('letter_selected', data);
  });

  socket.on('game-move', (data) => {
    if (!isValidRoom(data)) return;
    const r = String(data.room);
    if (!socket.rooms.has(r)) return;
    socket.to(r).emit('game-move', data);
  });

  socket.on('player-ready', (data) => {
    if (!isValidRoom(data)) return;
    const r = String(data.room);
    if (!socket.rooms.has(r)) return;
    socket.to(r).emit('player-ready', data);
  });

  socket.on('room-ready', (data) => {
    if (!isValidRoom(data)) return;
    const r = String(data.room);
    if (!socket.rooms.has(r)) return;
    socket.to(r).emit('room-ready', data);
  });

  socket.on('join_queue', (player) => {
    if (typeof player !== 'string') return;
    const safeName = player.slice(0, 50);
    const roomId = `ttt_queue_${state.actualQueue()}`;
    state.queuePlayers.push({ player: safeName, id: socket.id, position: state.queuePlayers.length + 1 });
    socket.join(roomId);
    if (state.queuePlayers.length % 2 === 0) {
      io.to(roomId).emit('game_start', roomId);
      state.resetQueuePlayers();
      state.incrementActualQueue();
    }
  });

  socket.on('leave-room', () => {
    removeFromQueue(socket.id);
    removeFromRooms(socket.id);
  });
}

function removeFromQueue(socketId) {
  const index = state.queuePlayers.findIndex(o => o.id === socketId);
  if (index > -1) state.queuePlayers.splice(index, 1);
}

function removeFromRooms(socketId) {
  const index = state.customRooms.findIndex(o => o.id === socketId);
  if (index > -1) state.customRooms.splice(index, 1);
}

module.exports = { 
  registerTicTacToeHandlers,
  removeFromQueue,
  removeFromRooms
};
