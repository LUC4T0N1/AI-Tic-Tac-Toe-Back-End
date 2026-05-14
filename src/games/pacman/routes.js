const createLeaderboardRouter = require('../../leaderboard/createRouter');

module.exports = createLeaderboardRouter({ table: '"retro-wave-games".leaderboards_pacman', maxScore: 9_999_999 });
