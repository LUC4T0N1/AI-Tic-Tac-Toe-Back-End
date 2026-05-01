// ── TicTacToe state ───────────────────────────────────────────────────────
let queuePlayers = [];
let actualQueue = 1;
let customRooms = [];

// ── Pong state ────────────────────────────────────────────────────────────
let pongQueue = [];
let pongQueueRoom = 100000;
const pongPendingRooms = new Map(); // roomId -> { socketId, username }
const pongGameRooms    = new Map(); // socketId -> roomId  (for disconnect notify)

// ── Pacman state ──────────────────────────────────────────────────────────
let pacmanQueue = [];
let pacmanQueueRoom = 200000;
const pacmanPendingRooms = new Map();
const pacmanGameRooms    = new Map();

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // ── TicTacToe ──────────────────────────────────────────────────────────
    socket.on('join_room', (data) => {
      socket.join(data);
      let room = customRooms.filter(r => r.room = data);
      if (room.length === 0) {
        customRooms.push({ id: socket.id, room: data });
      } else {
        io.to(data).emit('room-ready', data);
        const index = customRooms.findIndex(object => object.room === data);
        if (index > -1) customRooms.splice(index, 1);
      }
    });

    socket.on('send_message', (data) => {
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
      queuePlayers.push({ player, id: socket.id, position: queuePlayers.length + 1 });
      socket.join(actualQueue);
      if (queuePlayers.length % 2 === 0) {
        io.to(actualQueue).emit('game_start', actualQueue);
        queuePlayers = [];
        actualQueue = actualQueue >= 99999 ? 1 : actualQueue + 1;
      }
    });

    socket.on('leave-room', () => {
      removeFromQueue(socket.id);
      removeFromRooms(socket.id);
    });

    // ── Pong ───────────────────────────────────────────────────────────────
    socket.on('pong-join-room', ({ room, username }) => {
      if (pongPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = pongPendingRooms.get(room);
        pongPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('pong-room-ready', { side: 'left',  room, opponent: username || 'PLAYER 2' });
        socket.emit(   'pong-room-ready',    { side: 'right', room, opponent: p1Name   || 'PLAYER 1' });
        pongGameRooms.set(p1Id,       room);
        pongGameRooms.set(socket.id,  room);
      } else {
        pongPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('pong-waiting');
      }
    });

    socket.on('pong-join-queue', ({ username }) => {
      pongQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (pongQueue.length >= 2) {
        const [p1, p2] = pongQueue.splice(0, 2);
        const roomId = 'pong-q-' + pongQueueRoom;
        // Both players must join the room so socket.to(room) relays work in both directions
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId); // socket is p2
        io.to(p1.id).emit('pong-game-start', { side: 'left',  room: roomId, opponent: p2.username });
        io.to(p2.id).emit('pong-game-start', { side: 'right', room: roomId, opponent: p1.username });
        pongGameRooms.set(p1.id, roomId);
        pongGameRooms.set(p2.id, roomId);
        pongQueueRoom = pongQueueRoom >= 199999 ? 100000 : pongQueueRoom + 1;
      }
    });

    socket.on('pong-leave-queue', () => {
      pongQueue = pongQueue.filter(p => p.id !== socket.id);
    });

    socket.on('pong-paddle', ({ room, y }) => {
      socket.to(room).emit('pong-paddle', { y });
    });

    socket.on('pong-ball', ({ room, x, y, vx, vy }) => {
      socket.to(room).emit('pong-ball', { x, y, vx, vy });
    });

    socket.on('pong-point', ({ room, leftScore, rightScore }) => {
      socket.to(room).emit('pong-point', { leftScore, rightScore });
    });

    socket.on('pong-restart-ready', ({ room }) => {
      socket.to(room).emit('pong-restart-ready');
    });

    socket.on('pong-leave', ({ room }) => {
      socket.to(room).emit('pong-opponent-left');
      socket.leave(room);
      pongGameRooms.delete(socket.id);
      for (const [roomId, data] of pongPendingRooms) {
        if (data.socketId === socket.id) { pongPendingRooms.delete(roomId); break; }
      }
    });

    // ── Pacman ─────────────────────────────────────────────────────────────
    socket.on('pacman-join-room', ({ room, username }) => {
      if (pacmanPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = pacmanPendingRooms.get(room);
        pacmanPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('pacman-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'pacman-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        pacmanGameRooms.set(p1Id,       room);
        pacmanGameRooms.set(socket.id,  room);
      } else {
        pacmanPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('pacman-waiting');
      }
    });

    socket.on('pacman-join-queue', ({ username }) => {
      pacmanQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (pacmanQueue.length >= 2) {
        const [p1, p2] = pacmanQueue.splice(0, 2);
        const roomId = 'pac-q-' + pacmanQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('pacman-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('pacman-game-start', { room: roomId, opponent: p1.username });
        pacmanGameRooms.set(p1.id,       roomId);
        pacmanGameRooms.set(socket.id,   roomId);
        pacmanQueueRoom = pacmanQueueRoom >= 299999 ? 200000 : pacmanQueueRoom + 1;
      }
    });

    socket.on('pacman-leave-queue', () => {
      pacmanQueue = pacmanQueue.filter(p => p.id !== socket.id);
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

    socket.on('pacman-over', ({ room }) => {
      socket.to(room).emit('pacman-opp-over');
      pacmanGameRooms.delete(socket.id);
    });

    socket.on('pacman-leave', ({ room }) => {
      socket.to(room).emit('pacman-opp-left');
      socket.leave(room);
      pacmanGameRooms.delete(socket.id);
      for (const [roomId, data] of pacmanPendingRooms) {
        if (data.socketId === socket.id) { pacmanPendingRooms.delete(roomId); break; }
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log('User Disconnected', socket.id);
      removeFromQueue(socket.id);
      removeFromRooms(socket.id);

      // Pong queue cleanup
      pongQueue = pongQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of pongPendingRooms) {
        if (data.socketId === socket.id) { pongPendingRooms.delete(roomId); break; }
      }
      // Notify pong opponent
      const pongRoom = pongGameRooms.get(socket.id);
      if (pongRoom) {
        io.to(pongRoom).emit('pong-opponent-left');
        pongGameRooms.delete(socket.id);
      }

      // Pacman cleanup
      pacmanQueue = pacmanQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of pacmanPendingRooms) {
        if (data.socketId === socket.id) { pacmanPendingRooms.delete(roomId); break; }
      }
      const pacmanRoom = pacmanGameRooms.get(socket.id);
      if (pacmanRoom) {
        io.to(pacmanRoom).emit('pacman-opp-left');
        pacmanGameRooms.delete(socket.id);
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
