// ── TicTacToe state ───────────────────────────────────────────────────────
let queuePlayers = [];
let actualQueue = 1;
let customRooms = [];

// ── Pong state ────────────────────────────────────────────────────────────
let pongQueue = [];
let pongQueueRoom = 100000;
const pongPendingRooms = new Map(); // roomId -> { socketId, username }
const pongGameRooms    = new Map(); // socketId -> { room, side }
const pongGames        = new Map(); // roomId   -> game object (server-side loop)

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

module.exports = {
  queuePlayers,
  actualQueue: () => actualQueue,
  incrementActualQueue: () => { actualQueue = actualQueue >= 99999 ? 1 : actualQueue + 1; },
  resetQueuePlayers: () => { queuePlayers = []; },
  customRooms,
  
  pongQueue: () => pongQueue,
  setPongQueue: (q) => { pongQueue = q; },
  pongQueueRoom: () => pongQueueRoom,
  incrementPongQueueRoom: () => { pongQueueRoom = pongQueueRoom >= 199999 ? 100000 : pongQueueRoom + 1; },
  pongPendingRooms,
  pongGameRooms,
  pongGames,

  pacmanQueue: () => pacmanQueue,
  setPacmanQueue: (q) => { pacmanQueue = q; },
  pacmanQueueRoom: () => pacmanQueueRoom,
  incrementPacmanQueueRoom: () => { pacmanQueueRoom = pacmanQueueRoom >= 299999 ? 200000 : pacmanQueueRoom + 1; },
  pacmanPendingRooms,
  pacmanGameRooms,

  tetrisQueue: () => tetrisQueue,
  setTetrisQueue: (q) => { tetrisQueue = q; },
  tetrisQueueRoom: () => tetrisQueueRoom,
  incrementTetrisQueueRoom: () => { tetrisQueueRoom = tetrisQueueRoom >= 399999 ? 300000 : tetrisQueueRoom + 1; },
  tetrisPendingRooms,
  tetrisGameRooms,

  snakeQueue: () => snakeQueue,
  setSnakeQueue: (q) => { snakeQueue = q; },
  snakeQueueRoom: () => snakeQueueRoom,
  incrementSnakeQueueRoom: () => { snakeQueueRoom = snakeQueueRoom >= 499999 ? 400000 : snakeQueueRoom + 1; },
  snakePendingRooms,
  snakeGameRooms,

  breakoutQueue: () => breakoutQueue,
  setBreakoutQueue: (q) => { breakoutQueue = q; },
  breakoutQueueRoom: () => breakoutQueueRoom,
  incrementBreakoutQueueRoom: () => { breakoutQueueRoom = breakoutQueueRoom >= 599999 ? 500000 : breakoutQueueRoom + 1; },
  breakoutPendingRooms,
  breakoutGameRooms,

  infrunQueue: () => infrunQueue,
  setInfrunQueue: (q) => { infrunQueue = q; },
  infrunQueueRoom: () => infrunQueueRoom,
  incrementInfrunQueueRoom: () => { infrunQueueRoom = infrunQueueRoom >= 699999 ? 600000 : infrunQueueRoom + 1; },
  infrunPendingRooms,
  infrunGameRooms,
};
