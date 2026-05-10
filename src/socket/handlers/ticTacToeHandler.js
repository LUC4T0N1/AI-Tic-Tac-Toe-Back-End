const { censorMessage } = require('../../leaderboard/profanity');
const state = require('../state');

function registerTicTacToeHandlers(io, socket) {
  socket.on('join_room', (data) => {
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
    state.queuePlayers.push({ player, id: socket.id, position: state.queuePlayers.length + 1 });
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
