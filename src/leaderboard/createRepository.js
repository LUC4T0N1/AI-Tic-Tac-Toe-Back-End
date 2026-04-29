const pool = require('../db');

// Returns a repository bound to the given Postgres table.
// Usage: const repo = createRepository('"retro-wave-games".leaderboards_pacman');
function createRepository(table) {
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
