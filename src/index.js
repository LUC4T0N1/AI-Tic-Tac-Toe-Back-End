require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const pacmanRoutes = require('./games/pacman/routes');
const snakeRoutes = require('./games/snake/routes');
const breakoutRoutes = require('./games/breakout/routes');
const tetrisRoutes = require('./games/tetris/routes');
const infinityRunRoutes = require('./games/infinityrun/routes');
const { registerSocketHandlers } = require('./socket');

const app = express();
const server = http.createServer(app);

// Security Headers
app.use(helmet());

// Rate Limiting: max 100 requests per 15 minutes for global API
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const io = new Server(server, {
  cors: { 
    origin: process.env.CLIENT_URL || '*', 
    methods: ['GET', 'POST'] 
  },
});

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
}));

// Body limit: 10kb to prevent large payload DoS
app.use(express.json({ limit: '10kb' }));

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

app.use('/leaderboard/pacman', pacmanRoutes);
app.use('/leaderboard/snake', snakeRoutes);
app.use('/leaderboard/breakout', breakoutRoutes);
app.use('/leaderboard/tetris', tetrisRoutes);
app.use('/leaderboard/infinity-run', infinityRunRoutes);

registerSocketHandlers(io);

server.listen(process.env.PORT || 8080, () => {
  console.log('listening on port: ' + (process.env.PORT || 8080) + '!!!');
});
