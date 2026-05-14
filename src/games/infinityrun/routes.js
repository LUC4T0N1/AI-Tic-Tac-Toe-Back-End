const createLeaderboardRouter = require('../../leaderboard/createRouter');

module.exports = createLeaderboardRouter({ table: '"retro-wave-games".leaderboards_infinity_run', maxScore: 9_999_999 });
