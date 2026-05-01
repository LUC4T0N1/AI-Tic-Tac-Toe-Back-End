require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const pacmanRoutes = require('./games/pacman/routes');
const snakeRoutes = require('./games/snake/routes');
const breakoutRoutes = require('./games/breakout/routes');
const tetrisRoutes = require('./games/tetris/routes');
const infinityRunRoutes = require('./games/infinityrun/routes');
const { registerSocketHandlers } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

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
