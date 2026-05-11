const { Router } = require('express');
const { randomUUID } = require('crypto');
const createRepository = require('./createRepository');
const { containsProfanity } = require('./profanity');
const rateLimit = require('express-rate-limit');

const MAX_SESSIONS = 1000; // Prevent memory exhaustion

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_PTS_PER_SECOND = 1000;            // generous ceiling for score plausibility

// Shared across all leaderboard instances — one session store for the whole server.
const sessions = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(token);
  }
}, 30 * 60 * 1000).unref();

// Creates a fully-featured leaderboard router for a given DB table.
//
// Usage:
//   const createLeaderboardRouter = require('./leaderboard/createRouter');
//   app.use('/leaderboard/pacman', createLeaderboardRouter({ table: '"retro-wave-games".leaderboards_pacman' }));
//   app.use('/leaderboard/snake',  createLeaderboardRouter({ table: '"retro-wave-games".leaderboards_snake' }));
function createLeaderboardRouter({ table }) {
  const repo = createRepository(table);
  const router = Router();

  // Route-specific Rate Limiting
  const sessionLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20,                // max 20 session tokens per 5 mins
    message: { error: 'Muitas solicitações de sessão. Tente novamente mais tarde.' }
  });

  const scoreLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,                 // max 10 scores submitted per 5 mins
    message: { error: 'Muitas pontuações enviadas. Tente novamente mais tarde.' }
  });

  // POST /session — issue a one-time session token when a game starts
  router.post('/session', sessionLimiter, (req, res) => {
    // Prevent map from growing indefinitely
    if (sessions.size >= MAX_SESSIONS) {
      // Emergency cleanup: remove oldest 10%
      const keys = Array.from(sessions.keys());
      for (let i = 0; i < 100; i++) sessions.delete(keys[i]);
    }

    const token = randomUUID();
    sessions.set(token, { createdAt: Date.now(), used: false });
    res.json({ sessionToken: token });
  });

  // POST / — save a score; requires a valid, unused session token
  router.post('/', scoreLimiter, async (req, res) => {
    const { name, score, sessionToken } = req.body;

    if (!name || score === undefined || !sessionToken) {
      return res.status(400).json({ error: 'name, score e sessionToken são obrigatórios' });
    }
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 20) {
      return res.status(400).json({ error: 'Nome inválido' });
    }
    if (typeof score !== 'number' || !Number.isFinite(score) || !Number.isInteger(score) || score < 0) {
      return res.status(400).json({ error: 'Score inválido' });
    }
    if (containsProfanity(name)) {
      return res.status(422).json({ error: 'Nome inválido' });
    }

    const session = sessions.get(sessionToken);
    if (!session) {
      return res.status(403).json({ error: 'Sessão inválida' });
    }
    if (session.used) {
      return res.status(403).json({ error: 'Sessão já utilizada' });
    }
    const elapsedSec = (Date.now() - session.createdAt) / 1000;
    if (elapsedSec > SESSION_TTL_MS / 1000) {
      sessions.delete(sessionToken);
      return res.status(403).json({ error: 'Sessão expirada' });
    }
    if (score < 0 || score > Math.ceil(elapsedSec * MAX_PTS_PER_SECOND)) {
      return res.status(403).json({ error: 'Score inválido para esta sessão' });
    }

    session.used = true;

    try {
      const row = await repo.insertScore({ name: name.trim(), score });
      res.status(201).json({ id: row.id, name: name.trim(), score });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao salvar no leaderboard' });
    }
  });

  // GET /?page=N — paginated top scores
  router.get('/', async (req, res) => {
    const page = Math.min(10000, Math.max(1, parseInt(req.query.page) || 1));
    const limit = 10;
    const offset = (page - 1) * limit;
    try {
      const rows = await repo.getTopScores({ limit, offset });
      res.json({ page, data: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao buscar leaderboard' });
    }
  });

  return router;
}

module.exports = createLeaderboardRouter;
