const WEEKDAY_PATTERN = /(?:^|\s)(?:next|this|on|by|until)\s+([a-z]*)$/i;

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/** Plain color words aligned with card palette (groq ALLOWED_COLORS). */
const PALETTE = new Set([
  'yellow',
  'red',
  'green',
  'blue',
  'purple',
  'pink',
  'orange',
  'teal',
  'gray',
  'grey',
  'white',
]);

const DATE_CUE_RE =
  /\b(tomorrow|today|tonight|next\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|jan\.?|feb\.?|mar\.?|apr\.?|jun\.?|jul\.?|aug\.?|sep\.?|oct\.?|nov\.?|dec\.?|\d{1,2}:\d{2}|\d{1,2}\s*(?:am|pm)\b|in\s+\d+\s+days?|in\s+a\s+week|\d{4}-\d{2}-\d{2})\b/i;

/** Longer phrases first per row for safer matching. */
const KEYWORD_TRAILING_COLOR = [
  { keys: ['bachelorette', 'grand opening', 'performance review', 'open enrollment'], color: 'pink' },
  { keys: ['birthday', 'anniversary', 'wedding', 'bridal', 'honeymoon', 'baby shower', 'rehearsal'], color: 'pink' },
  { keys: ['dentist', 'doctor', 'checkup', 'clinic', 'hospital', 'therapy', 'chemo', 'physical therapy'], color: 'blue' },
  { keys: ['product launch', 'board meeting', 'investor', 'runway', 'deadline', 'ship date', 'release', 'demo day', 'pitch', 'sprint end'], color: 'orange' },
  { keys: ['interview', 'job offer', 'promotion', 'qbr', 'appraisal'], color: 'purple' },
  { keys: ['tax', 'taxes', 'payroll', 'invoice', 'irs', 'lease end', 'mortgage', 'closing'], color: 'green' },
  { keys: ['passport', 'visa', 'flight', 'vacation', 'travel', 'layover', 'boarding'], color: 'teal' },
  { keys: ['graduation', 'commencement', 'thesis', 'defense', 'midterm', 'final exam', 'gmat', 'mcat', 'lsat', 'gre exam'], color: 'yellow' },
  { keys: ['funeral', 'memorial', 'wake'], color: 'gray' },
];

function normalizeWordForTrie(raw) {
  const letters = raw.toLowerCase().replace(/[^a-z]/g, '');
  return letters.length > 0 ? letters : null;
}

function extractEndToken(text) {
  const trimmed = text.replace(/\s+$/, '');
  if (!trimmed) return null;
  const m = trimmed.match(/([a-zA-Z0-9]+)$/);
  return m ? m[1] : null;
}

function formatSuffix(suffixLower, tokenOriginal) {
  if (!suffixLower) return '';
  if (/^[a-z]+$/.test(tokenOriginal)) return suffixLower;
  if (/^[A-Z]+$/.test(tokenOriginal)) return suffixLower.toUpperCase();
  if (/^[A-Z][a-z]*$/.test(tokenOriginal)) {
    return suffixLower.charAt(0).toUpperCase() + suffixLower.slice(1);
  }
  return suffixLower;
}

function uniqueWeekdayCompletion(partial) {
  const p = partial.toLowerCase();
  const hits = WEEKDAYS.filter((d) => d.startsWith(p));
  if (hits.length !== 1) return null;
  const full = hits[0];
  return { full, suffixLetters: full.slice(p.length) };
}

function tryWeekdaySuggestion(text) {
  const m = text.match(WEEKDAY_PATTERN);
  if (!m) return null;
  const partial = m[1] ?? '';
  if (partial.length === 0) return null;
  const resolved = uniqueWeekdayCompletion(partial);
  if (!resolved?.suffixLetters) return null;
  return { suffix: formatSuffix(resolved.suffixLetters, partial) };
}

function hasDateCue(text) {
  return DATE_CUE_RE.test(text);
}

function lineHasPaletteColor(text) {
  const tokens = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return tokens.some((t) => PALETTE.has(t));
}

function tryKeywordTrailingColor(text) {
  if (!/\s$/.test(text) || text.trim().length === 0) return null;
  if (lineHasPaletteColor(text)) return null;
  if (!hasDateCue(text)) return null;
  const lower = text.toLowerCase();
  for (const { keys, color } of KEYWORD_TRAILING_COLOR) {
    const sorted = [...keys].sort((a, b) => b.length - a.length);
    for (const kw of sorted) {
      if (lower.includes(kw)) return { suffix: color };
    }
  }
  return null;
}

function tryPartialPaletteSuffix(tokenOriginal, key) {
  if (!key || key.length < 2) return null;
  if (/^[0-9]+$/.test(tokenOriginal)) return null;
  const matches = [...PALETTE].filter((w) => w.startsWith(key) && w.length > key.length);
  if (matches.length !== 1) return null;
  const full = matches[0];
  return { suffix: formatSuffix(full.slice(key.length), tokenOriginal) };
}

function buildTrie(rows) {
  const root = { children: new Map(), completionWord: null };
  for (const [raw, _score] of rows) {
    const w = normalizeWordForTrie(String(raw));
    if (!w) continue;
    let node = root;
    for (const c of w) {
      if (!node.children.has(c)) {
        node.children.set(c, { children: new Map(), completionWord: null });
      }
      node = node.children.get(c);
      if (node.completionWord === null) node.completionWord = w;
    }
  }
  return root;
}

function buildBoostWeightMap(boostPairs) {
  const m = new Map();
  for (const [word, wt] of boostPairs) {
    const w = normalizeWordForTrie(String(word));
    if (!w) continue;
    const prev = m.get(w) ?? 0;
    if (wt > prev) m.set(w, wt);
  }
  return m;
}

export async function createAutocompleteEngine() {
  const [wfMod, boostMod] = await Promise.all([
    import('../data/wordfreq-en.json', { with: { type: 'json' } }),
    import('../data/persona-boost.json', { with: { type: 'json' } }),
  ]);
  const rows = wfMod.default ?? wfMod;
  const boostPairs = boostMod.default ?? boostMod;
  return {
    root: buildTrie(rows),
    boostPairs,
    boostMap: buildBoostWeightMap(boostPairs),
  };
}

function trieCompletion(root, key) {
  let node = root;
  for (const c of key) {
    if (!node.children.has(c)) return null;
    node = node.children.get(c);
  }
  return node.completionWord;
}

function bestBoostWord(key, boostMap) {
  let best = null;
  let bestScore = -1;
  for (const [word, wt] of boostMap) {
    if (!word.startsWith(key) || word.length <= key.length) continue;
    const score = wt * 1000 + word.length;
    if (score > bestScore) {
      bestScore = score;
      best = word;
    } else if (score === bestScore && best && word.length > best.length) {
      best = word;
    }
  }
  return best;
}

export function buildHistoryBoost(wordsFromEvents) {
  const map = new Map();
  for (const title of wordsFromEvents) {
    const tokens = String(title).split(/[^a-zA-Z]+/);
    for (const t of tokens) {
      if (t.length >= 3) {
        const k = t.toLowerCase();
        map.set(k, (map.get(k) ?? 0) + 1);
      }
    }
  }
  return map;
}

function bestHistoryMatch(key, tokenFreqMap) {
  let bestWord = null;
  let bestFreq = -1;
  for (const [word, freq] of tokenFreqMap) {
    if (!word.startsWith(key) || word.length < key.length) continue;
    if (bestWord === null || freq > bestFreq) {
      bestWord = word;
      bestFreq = freq;
    } else if (freq === bestFreq) {
      if (
        word.length > bestWord.length ||
        (word.length === bestWord.length && word < bestWord)
      ) {
        bestWord = word;
      }
    }
  }
  return bestWord;
}

function pickTokenCompletion(key, tokenOriginal, engine, tokenFreqMap) {
  const trieWord = trieCompletion(engine.root, key);
  const histWord = bestHistoryMatch(key, tokenFreqMap);
  const boostWord = bestBoostWord(key, engine.boostMap);

  const candidates = [];
  if (histWord) {
    const freq = tokenFreqMap.get(histWord) ?? 0;
    candidates.push({
      word: histWord,
      score: 1_000_000 * Math.max(1, freq) + histWord.length,
    });
  }
  if (boostWord) {
    const wt = engine.boostMap.get(boostWord) ?? 1;
    candidates.push({ word: boostWord, score: 100_000 * wt + boostWord.length });
  }
  if (trieWord) {
    candidates.push({ word: trieWord, score: 10_000 + trieWord.length });
  }
  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) => b.score - a.score || b.word.length - a.word.length || a.word.localeCompare(b.word)
  );
  const best = candidates[0].word;
  if (!best || best.length <= key.length || !best.startsWith(key)) return null;
  return { suffix: formatSuffix(best.slice(key.length), tokenOriginal) };
}

/**
 * Weekdays, trailing keyword→color, history, persona boost, wordfreq trie,
 * then ambiguous-safe partial palette.
 */
export function getComposerSuggestion(text, engine, tokenFreqMap = new Map()) {
  const weekday = tryWeekdaySuggestion(text);
  if (weekday) return weekday;

  const trailingColor = tryKeywordTrailingColor(text);
  if (trailingColor) return trailingColor;

  const tokenOriginal = extractEndToken(text);
  if (tokenOriginal && tokenOriginal.length >= 2 && !/^[0-9]+$/.test(tokenOriginal)) {
    const key = normalizeWordForTrie(tokenOriginal);
    if (key && key.length >= 2) {
      const fromLexicon = pickTokenCompletion(key, tokenOriginal, engine, tokenFreqMap);
      if (fromLexicon) return fromLexicon;
      const paletteOnly = tryPartialPaletteSuffix(tokenOriginal, key);
      if (paletteOnly) return paletteOnly;
    }
  }

  return null;
}

export function getHistorySuggestion(text, engine, tokenFreqMap) {
  return getComposerSuggestion(text, engine, tokenFreqMap);
}

export function getLocalSuggestion(text, engine) {
  const weekday = tryWeekdaySuggestion(text);
  if (weekday) return weekday;

  const tokenOriginal = extractEndToken(text);
  if (!tokenOriginal || tokenOriginal.length < 2) return null;
  if (/^[0-9]+$/.test(tokenOriginal)) return null;

  const key = normalizeWordForTrie(tokenOriginal);
  if (!key || key.length < 2) return null;

  const full = trieCompletion(engine.root, key);
  if (!full || full.length <= key.length || !full.startsWith(key)) return null;

  const suffixLetters = full.slice(key.length);
  return { suffix: formatSuffix(suffixLetters, tokenOriginal) };
}

/** Perf contract helper: run many suggestions (used by tests). */
export function __perfRunSuggestions(engine, tokenFreqMap, texts, iterations = 1) {
  for (let i = 0; i < iterations; i++) {
    for (const t of texts) {
      getComposerSuggestion(t, engine, tokenFreqMap);
    }
  }
}
