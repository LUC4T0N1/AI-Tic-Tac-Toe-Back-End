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

// ── Tetris state ──────────────────────────────────────────────────────────
let tetrisQueue = [];
let tetrisQueueRoom = 300000;
const tetrisPendingRooms = new Map();
const tetrisGameRooms    = new Map();

// ── Snake state ───────────────────────────────────────────────────────────
let snakeQueue = [];
let snakeQueueRoom = 400000;
const snakePendingRooms = new Map();
const snakeGameRooms    = new Map();

// ── Breakout state ────────────────────────────────────────────────────────
let breakoutQueue = [];
let breakoutQueueRoom = 500000;
const breakoutPendingRooms = new Map();
const breakoutGameRooms    = new Map();

// ── InfRun state ──────────────────────────────────────────────────────────
let infrunQueue = [];
let infrunQueueRoom = 600000;
const infrunPendingRooms = new Map();
const infrunGameRooms    = new Map();

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

    socket.on('pong-paddle', ({ room, ...rest }) => {
      socket.to(room).emit('pong-paddle', rest);
    });

    socket.on('pong-ball', ({ room, ...rest }) => {
      socket.to(room).emit('pong-ball', rest);
    });

    socket.on('pong-point', ({ room, ...rest }) => {
      socket.to(room).emit('pong-point', rest);
    });

    socket.on('pong-restart-ready', ({ room }) => {
      socket.to(room).emit('pong-restart-ready');
    });

    socket.on('pong-hit', ({ room, ...rest }) => {
      socket.to(room).emit('pong-hit', rest);
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

    socket.on('pacman-restart-ready', ({ room }) => {
      socket.to(room).emit('pacman-restart-ready');
    });

    socket.on('pacman-leave', ({ room }) => {
      socket.to(room).emit('pacman-opp-left');
      socket.leave(room);
      pacmanGameRooms.delete(socket.id);
      for (const [roomId, data] of pacmanPendingRooms) {
        if (data.socketId === socket.id) { pacmanPendingRooms.delete(roomId); break; }
      }
    });

    // ── Tetris ─────────────────────────────────────────────────────────────
    socket.on('tetris-join-room', ({ room, username }) => {
      if (tetrisPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = tetrisPendingRooms.get(room);
        tetrisPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('tetris-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'tetris-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        tetrisGameRooms.set(p1Id,      room);
        tetrisGameRooms.set(socket.id, room);
      } else {
        tetrisPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('tetris-waiting');
      }
    });

    socket.on('tetris-join-queue', ({ username }) => {
      tetrisQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (tetrisQueue.length >= 2) {
        const [p1, p2] = tetrisQueue.splice(0, 2);
        const roomId = 'tet-q-' + tetrisQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('tetris-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('tetris-game-start', { room: roomId, opponent: p1.username });
        tetrisGameRooms.set(p1.id,     roomId);
        tetrisGameRooms.set(socket.id, roomId);
        tetrisQueueRoom = tetrisQueueRoom >= 399999 ? 300000 : tetrisQueueRoom + 1;
      }
    });

    socket.on('tetris-leave-queue', () => {
      tetrisQueue = tetrisQueue.filter(p => p.id !== socket.id);
    });

    socket.on('tetris-board', ({ room, board, score, lines, level }) => {
      socket.to(room).emit('tetris-board', { board, score, lines, level });
    });

    socket.on('tetris-piece', ({ room, x, y, shape, color }) => {
      socket.to(room).emit('tetris-piece', { x, y, shape, color });
    });

    socket.on('tetris-over', ({ room }) => {
      socket.to(room).emit('tetris-opp-over');
      tetrisGameRooms.delete(socket.id);
    });

    socket.on('tetris-restart-ready', ({ room }) => {
      socket.to(room).emit('tetris-restart-ready');
    });

    socket.on('tetris-leave', ({ room }) => {
      socket.to(room).emit('tetris-opp-left');
      socket.leave(room);
      tetrisGameRooms.delete(socket.id);
      for (const [roomId, data] of tetrisPendingRooms) {
        if (data.socketId === socket.id) { tetrisPendingRooms.delete(roomId); break; }
      }
    });

    // ── Snake ──────────────────────────────────────────────────────────────
    socket.on('snake-join-room', ({ room, username }) => {
      if (snakePendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = snakePendingRooms.get(room);
        snakePendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('snake-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'snake-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        snakeGameRooms.set(p1Id,      room);
        snakeGameRooms.set(socket.id, room);
      } else {
        snakePendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('snake-waiting');
      }
    });

    socket.on('snake-join-queue', ({ username }) => {
      snakeQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (snakeQueue.length >= 2) {
        const [p1, p2] = snakeQueue.splice(0, 2);
        const roomId = 'snk-q-' + snakeQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('snake-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('snake-game-start', { room: roomId, opponent: p1.username });
        snakeGameRooms.set(p1.id,     roomId);
        snakeGameRooms.set(socket.id, roomId);
        snakeQueueRoom = snakeQueueRoom >= 499999 ? 400000 : snakeQueueRoom + 1;
      }
    });

    socket.on('snake-leave-queue', () => {
      snakeQueue = snakeQueue.filter(p => p.id !== socket.id);
    });

    socket.on('snake-state', ({ room, snake, food, score, level, dir }) => {
      socket.to(room).emit('snake-state', { snake, food, score, level, dir });
    });

    socket.on('snake-over', ({ room }) => {
      socket.to(room).emit('snake-opp-over');
      snakeGameRooms.delete(socket.id);
    });

    socket.on('snake-restart-ready', ({ room }) => {
      socket.to(room).emit('snake-restart-ready');
    });

    socket.on('snake-leave', ({ room }) => {
      socket.to(room).emit('snake-opp-left');
      socket.leave(room);
      snakeGameRooms.delete(socket.id);
      for (const [roomId, data] of snakePendingRooms) {
        if (data.socketId === socket.id) { snakePendingRooms.delete(roomId); break; }
      }
    });

    // ── Breakout ───────────────────────────────────────────────────────────
    socket.on('breakout-join-room', ({ room, username }) => {
      if (breakoutPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = breakoutPendingRooms.get(room);
        breakoutPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('breakout-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'breakout-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        breakoutGameRooms.set(p1Id,      room);
        breakoutGameRooms.set(socket.id, room);
      } else {
        breakoutPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('breakout-waiting');
      }
    });

    socket.on('breakout-join-queue', ({ username }) => {
      breakoutQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (breakoutQueue.length >= 2) {
        const [p1, p2] = breakoutQueue.splice(0, 2);
        const roomId = 'brk-q-' + breakoutQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('breakout-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('breakout-game-start', { room: roomId, opponent: p1.username });
        breakoutGameRooms.set(p1.id,     roomId);
        breakoutGameRooms.set(socket.id, roomId);
        breakoutQueueRoom = breakoutQueueRoom >= 599999 ? 500000 : breakoutQueueRoom + 1;
      }
    });

    socket.on('breakout-leave-queue', () => {
      breakoutQueue = breakoutQueue.filter(p => p.id !== socket.id);
    });

    socket.on('breakout-state', ({ room, paddle, ball, bricks, score, level, lives }) => {
      socket.to(room).emit('breakout-state', { paddle, ball, bricks, score, level, lives });
    });

    socket.on('breakout-over', ({ room }) => {
      socket.to(room).emit('breakout-opp-over');
      breakoutGameRooms.delete(socket.id);
    });

    socket.on('breakout-restart-ready', ({ room }) => {
      socket.to(room).emit('breakout-restart-ready');
    });

    socket.on('breakout-launch-ready', ({ room }) => {
      socket.to(room).emit('breakout-opp-launch-ready');
    });

    socket.on('breakout-level-done', ({ room }) => {
      socket.to(room).emit('breakout-opp-level-done');
    });

    socket.on('breakout-leave', ({ room }) => {
      socket.to(room).emit('breakout-opp-left');
      socket.leave(room);
      breakoutGameRooms.delete(socket.id);
      for (const [roomId, data] of breakoutPendingRooms) {
        if (data.socketId === socket.id) { breakoutPendingRooms.delete(roomId); break; }
      }
    });

    // ── InfRun ─────────────────────────────────────────────────────────────
    socket.on('infrun-join-room', ({ room, username }) => {
      if (infrunPendingRooms.has(room)) {
        const { socketId: p1Id, username: p1Name } = infrunPendingRooms.get(room);
        infrunPendingRooms.delete(room);
        socket.join(room);
        io.to(p1Id).emit('infrun-room-ready', { room, opponent: username || 'PLAYER 2' });
        socket.emit(     'infrun-room-ready', { room, opponent: p1Name  || 'PLAYER 1' });
        infrunGameRooms.set(p1Id,      room);
        infrunGameRooms.set(socket.id, room);
      } else {
        infrunPendingRooms.set(room, { socketId: socket.id, username: username || 'PLAYER 1' });
        socket.join(room);
        socket.emit('infrun-waiting');
      }
    });

    socket.on('infrun-join-queue', ({ username }) => {
      infrunQueue.push({ id: socket.id, username: username || 'PLAYER' });
      if (infrunQueue.length >= 2) {
        const [p1, p2] = infrunQueue.splice(0, 2);
        const roomId = 'inf-q-' + infrunQueueRoom;
        const p1Socket = io.sockets.sockets.get(p1.id);
        if (p1Socket) p1Socket.join(roomId);
        socket.join(roomId);
        io.to(p1.id).emit('infrun-game-start', { room: roomId, opponent: p2.username });
        io.to(p2.id).emit('infrun-game-start', { room: roomId, opponent: p1.username });
        infrunGameRooms.set(p1.id,     roomId);
        infrunGameRooms.set(socket.id, roomId);
        infrunQueueRoom = infrunQueueRoom >= 699999 ? 600000 : infrunQueueRoom + 1;
      }
    });

    socket.on('infrun-leave-queue', () => {
      infrunQueue = infrunQueue.filter(p => p.id !== socket.id);
    });

    socket.on('infrun-state', ({ room, monkeyY, ducking, score, speed, dist, obstacles }) => {
      socket.to(room).emit('infrun-state', { monkeyY, ducking, score, speed, dist, obstacles });
    });

    socket.on('infrun-over', ({ room }) => {
      socket.to(room).emit('infrun-opp-over');
      infrunGameRooms.delete(socket.id);
    });

    socket.on('infrun-restart-ready', ({ room }) => {
      socket.to(room).emit('infrun-restart-ready');
    });

    socket.on('infrun-leave', ({ room }) => {
      socket.to(room).emit('infrun-opp-left');
      socket.leave(room);
      infrunGameRooms.delete(socket.id);
      for (const [roomId, data] of infrunPendingRooms) {
        if (data.socketId === socket.id) { infrunPendingRooms.delete(roomId); break; }
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

      // Tetris cleanup
      tetrisQueue = tetrisQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of tetrisPendingRooms) {
        if (data.socketId === socket.id) { tetrisPendingRooms.delete(roomId); break; }
      }
      const tetrisRoom = tetrisGameRooms.get(socket.id);
      if (tetrisRoom) {
        io.to(tetrisRoom).emit('tetris-opp-left');
        tetrisGameRooms.delete(socket.id);
      }

      // Snake cleanup
      snakeQueue = snakeQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of snakePendingRooms) {
        if (data.socketId === socket.id) { snakePendingRooms.delete(roomId); break; }
      }
      const snakeRoom = snakeGameRooms.get(socket.id);
      if (snakeRoom) {
        io.to(snakeRoom).emit('snake-opp-left');
        snakeGameRooms.delete(socket.id);
      }

      // Breakout cleanup
      breakoutQueue = breakoutQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of breakoutPendingRooms) {
        if (data.socketId === socket.id) { breakoutPendingRooms.delete(roomId); break; }
      }
      const breakoutRoom = breakoutGameRooms.get(socket.id);
      if (breakoutRoom) {
        io.to(breakoutRoom).emit('breakout-opp-left');
        breakoutGameRooms.delete(socket.id);
      }

      // InfRun cleanup
      infrunQueue = infrunQueue.filter(p => p.id !== socket.id);
      for (const [roomId, data] of infrunPendingRooms) {
        if (data.socketId === socket.id) { infrunPendingRooms.delete(roomId); break; }
      }
      const infrunRoom = infrunGameRooms.get(socket.id);
      if (infrunRoom) {
        io.to(infrunRoom).emit('infrun-opp-left');
        infrunGameRooms.delete(socket.id);
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
