// Profanity filter for leaderboard names (PT-BR and EN).
// Strategy: longer words use substring matching; short words (≤ 4 chars) use whole-token
// matching only, to avoid false positives (e.g. "ass" inside "classic").

const BANNED_SUBSTR = [
  // PT-BR
  'puta', 'putaria', 'merda', 'bosta', 'cuzao',
  'caralho', 'buceta', 'xota', 'xoxota', 'foder', 'fodase',
  'porra', 'arrombado', 'babaca', 'imbecil', 'retardado',
  'vagabundo', 'vagabunda', 'piranha', 'safado', 'safada',
  'vsf', 'fdp', 'corno', 'viado', 'viadao', 'otario',
  'desgraça', 'desgracado', 'filhodaputa', 'filhadaputa',
  // EN
  'fuck', 'bitch', 'cunt', 'bastard', 'nigger', 'nigga',
  'faggot', 'whore', 'slut', 'asshole', 'dickhead',
  'motherfuck', 'bullshit', 'cocksucker',
];

// Short words: only flag when the entire token matches (not as part of a larger word)
const BANNED_EXACT = ['cu', 'ass', 'fag', 'dick', 'cock', 'cum', 'shit'];

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // strip combining diacritical marks
}

function containsProfanity(name) {
  const norm = normalize(name);

  // Exact-token check: split on anything that isn't a letter
  const tokens = norm.split(/[^a-z]+/).filter(Boolean);
  if (BANNED_EXACT.some(w => tokens.includes(normalize(w)))) return true;

  // Substring check: collapse spaces so "filho da puta" → "filhodaputa" also matches
  const flat = norm.replace(/\s+/g, '');
  if (BANNED_SUBSTR.some(w => flat.includes(normalize(w)))) return true;

  return false;
}

module.exports = { containsProfanity };
