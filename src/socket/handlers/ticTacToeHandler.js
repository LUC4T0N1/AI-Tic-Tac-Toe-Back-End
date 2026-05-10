const { censorMessage } = require('../../leaderboard/profanity');
const state = require('../state');

function isValidRoom(data) {
  return data && typeof data.room === 'string' && data.room.length > 0 && data.room.length <= 100;
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
    if (!socket.rooms.has(data.room)) return;
    if (data.message) data.message = censorMessage(String(data.message).slice(0, 500));
    socket.to(data.room).emit('receive_message', data);
  });

  socket.on('select_letter', (data) => {
    if (!isValidRoom(data) || !socket.rooms.has(data.room)) return;
    socket.to(data.room).emit('letter_selected', data);
  });

  socket.on('game-move', (data) => {
    if (!isValidRoom(data) || !socket.rooms.has(data.room)) return;
    socket.to(data.room).emit('game-move', data);
  });

  socket.on('player-ready', (data) => {
    if (!isValidRoom(data) || !socket.rooms.has(data.room)) return;
    socket.to(data.room).emit('player-ready', data);
  });

  socket.on('room-ready', (data) => {
    if (!isValidRoom(data) || !socket.rooms.has(data.room)) return;
    socket.to(data.room).emit('room-ready', data);
  });

  socket.on('join_queue', (player) => {
    if (typeof player !== 'string') return;
    const safeName = player.slice(0, 50);
    state.queuePlayers.push({ player: safeName, id: socket.id, position: state.queuePlayers.length + 1 });
    socket.join(state.actualQueue());
    if (state.queuePlayers.length % 2 === 0) {
      io.to(state.actualQueue()).emit('game_start', state.actualQueue());
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
