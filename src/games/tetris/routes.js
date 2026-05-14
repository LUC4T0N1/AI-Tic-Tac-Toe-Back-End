const createLeaderboardRouter = require('../../leaderboard/createRouter');

// Tetris scores scale steeply with level — millions are achievable in long sessions
module.exports = createLeaderboardRouter({ table: '"retro-wave-games".leaderboards_tetris', maxScore: 99_999_999 });