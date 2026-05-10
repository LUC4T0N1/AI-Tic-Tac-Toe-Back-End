const pool = require('../db');

const ALLOWED_TABLES = new Set([
  '"retro-wave-games".leaderboards_pacman',
  '"retro-wave-games".leaderboards_snake',
  '"retro-wave-games".leaderboards_breakout',
  '"retro-wave-games".leaderboards_tetris',
  '"retro-wave-games".leaderboards_infinity_run',
]);

function createRepository(table) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`createRepository: unknown table "${table}"`);
  return {
    async insertScore({ name, score }) {
      const result = await pool.query(
        `INSERT INTO ${table} (name, score, created_at) VALUES ($1, $2, NOW()) RETURNING id`,
        [name, score]
      );
      return result.rows[0];
    },

    async getTopScores({ limit, offset }) {
      const result = await pool.query(
        `SELECT id, name, score, created_at FROM ${table} ORDER BY score DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return result.rows;
    },
  };
}

module.exports = createRepository;
