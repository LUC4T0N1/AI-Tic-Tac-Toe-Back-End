const pool = require('../../db');

const TABLE = '"retro-wave-games".leaderboards_pacman';

async function insertScore({ name, score }) {
  const result = await pool.query(
    `INSERT INTO ${TABLE} (name, score, created_at) VALUES ($1, $2, NOW()) RETURNING id`,
    [name, score]
  );
  return result.rows[0];
}

async function getTopScores({ limit, offset }) {
  const result = await pool.query(
    `SELECT id, name, score, created_at FROM ${TABLE} ORDER BY score DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

module.exports = { insertScore, getTopScores };
