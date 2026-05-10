const { registerTicTacToeHandlers, removeFromQueue, removeFromRooms } = require('./handlers/ticTacToeHandler');
const { registerPongHandlers, cleanupPong } = require('./handlers/pongHandler');
const { registerPacmanHandlers, cleanupPacman } = require('./handlers/pacmanHandler');
const { registerTetrisHandlers, cleanupTetris } = require('./handlers/tetrisHandler');
const { registerSnakeHandlers, cleanupSnake } = require('./handlers/snakeHandler');
const { registerBreakoutHandlers, cleanupBreakout } = require('./handlers/breakoutHandler');
const { registerInfinityRunHandlers, cleanupInfinityRun } = require('./handlers/infinityRunHandler');

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // Basic Socket Rate Limiting
    const eventCounts = new Map();
    const MAX_EVENTS_PER_WINDOW = 1200; // ~30Hz real-time paddle * 10s + headroom
    const WINDOW_MS = 10000;           // 10 seconds

    socket.use(([_event, ..._args], next) => {
      const now = Date.now();
      const userData = eventCounts.get(socket.id) || { count: 0, startTime: now };

      if (now - userData.startTime > WINDOW_MS) {
        userData.count = 1;
        userData.startTime = now;
      } else {
        userData.count++;
      }

      eventCounts.set(socket.id, userData);

      if (userData.count > MAX_EVENTS_PER_WINDOW) {
        console.warn(`Socket ${socket.id} rate limited and disconnected`);
        socket.disconnect(true);
        return;
      }
      next();
    });

    // Register All Game Handlers
    registerTicTacToeHandlers(io, socket);
    registerPongHandlers(io, socket);
    registerPacmanHandlers(io, socket);
    registerTetrisHandlers(io, socket);
    registerSnakeHandlers(io, socket);
    registerBreakoutHandlers(io, socket);
    registerInfinityRunHandlers(io, socket);

    // Global Disconnect Handler
    socket.on('disconnect', () => {
      console.log('User Disconnected', socket.id);
      
      // Cleanup all games
      removeFromQueue(socket.id);
      removeFromRooms(socket.id);
      cleanupPong(io, socket.id);
      cleanupPacman(io, socket.id);
      cleanupTetris(io, socket.id);
      cleanupSnake(io, socket.id);
      cleanupBreakout(io, socket.id);
      cleanupInfinityRun(io, socket.id);
    });
  });
}

module.exports = { registerSocketHandlers };
