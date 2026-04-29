let queuePlayers = [];
let actualQueue = 1;
let customRooms = [];

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('join_room', (data) => {
      console.log('data ' + data);
      socket.join(data);
      console.log(`User with ID: ${socket.id} joined room: ${data}`);
      let room = customRooms.filter(r => r.room = data);
      console.log('tamanho sala: ' + room.length);
      console.log('sala: ' + room);
      if (room.length === 0) {
        console.log('sala criada: ' + data);
        customRooms.push({ id: socket.id, room: data });
      } else {
        io.to(data).emit('room-ready', data);
        console.log('enviando room ready');
        const index = customRooms.findIndex(object => object.room === data);
        if (index > -1) customRooms.splice(index, 1);
      }
    });

    socket.on('send_message', (data) => {
      console.log('mensagem recebida: ' + JSON.stringify(data));
      socket.to(data.room).emit('receive_message', data);
    });

    socket.on('select_letter', (data) => {
      console.log('mensagem recebida: ' + JSON.stringify(data));
      socket.to(data.room).emit('letter_selected', data);
    });

    socket.on('game-move', (data) => {
      console.log('mensagem recebida: ' + JSON.stringify(data));
      socket.to(data.room).emit('game-move', data);
    });

    socket.on('leave-room', () => {
      console.log('User leaving room', socket.id);
      removeFromQueue(socket.id);
      removeFromRooms(socket.id);
    });

    socket.on('disconnect', () => {
      console.log('User Disconnected', socket.id);
      removeFromQueue(socket.id);
      removeFromRooms(socket.id);
    });

    socket.on('player-ready', (data) => {
      socket.to(data.room).emit('player-ready', data);
      console.log(`User with ID: ${socket.id} is ready`);
    });

    socket.on('room-ready', (data) => {
      socket.to(data.room).emit('room-ready', data);
      console.log(`Room with id: ${data.room} is ready`);
    });

    socket.on('join_queue', (player) => {
      console.log('Novo player na fila geral: ' + JSON.stringify({ player, id: socket.id, position: queuePlayers.length + 1 }));
      queuePlayers.push({ player, id: socket.id, position: queuePlayers.length + 1 });
      console.log('tamanho da fila geral atual: ' + queuePlayers.length);
      socket.join(actualQueue);
      if (queuePlayers.length % 2 === 0) {
        console.log('começando jogo na fila ' + actualQueue);
        io.to(actualQueue).emit('game_start', actualQueue);
        queuePlayers = [];
        actualQueue = actualQueue >= 99999 ? 1 : actualQueue + 1;
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
