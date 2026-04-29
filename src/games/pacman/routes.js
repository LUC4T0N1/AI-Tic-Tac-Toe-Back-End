const { Router } = require('express');
const { insertScore, getTopScores } = require('./repository');

const router = Router();

router.post('/', async (req, res) => {
  const { name, score } = req.body;
  if (!name || score === undefined) {
    return res.status(400).json({ error: 'name e score são obrigatórios' });
  }
  try {
    const row = await insertScore({ name, score });
    res.status(201).json({ id: row.id, name, score });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar no leaderboard' });
  }
});

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  try {
    const rows = await getTopScores({ limit, offset });
    res.json({ page, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar leaderboard' });
  }
});

module.exports = router;
