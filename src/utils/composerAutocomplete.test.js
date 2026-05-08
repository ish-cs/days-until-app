import { describe, it, expect, beforeAll } from 'vitest';
import {
  createAutocompleteEngine,
  getLocalSuggestion,
  buildHistoryBoost,
  getHistorySuggestion,
  __perfRunSuggestions,
} from './composerAutocomplete.js';

describe('composerAutocomplete', () => {
  let engine;

  beforeAll(async () => {
    engine = await createAutocompleteEngine();
  });

  it('prefix from embedded corpus yields suffix (tomorrow)', () => {
    expect(getLocalSuggestion('tom', engine)).toEqual({ suffix: 'orrow' });
  });

  it('ambiguous weekday prefix returns null', () => {
    expect(getLocalSuggestion('next t', engine)).toBeNull();
    expect(getLocalSuggestion('until t', engine)).toBeNull();
  });

  it('unique Friday partial returns day suffix', () => {
    expect(getLocalSuggestion('next fr', engine)).toEqual({ suffix: 'iday' });
  });

  it('token length 1 returns null', () => {
    expect(getLocalSuggestion('a', engine)).toBeNull();
    expect(getLocalSuggestion('x', engine)).toBeNull();
  });

  it('history overrides trie when longer word shares prefix', () => {
    const hist = buildHistoryBoost(['Tomorrowland concert night']);
    expect(getHistorySuggestion('tom', engine, hist)).toEqual({
      suffix: 'orrowland',
    });
  });

  it('persona boost beats corpus for overlapping prefix (bir → birthday)', () => {
    expect(getHistorySuggestion('bir', engine, new Map())).toEqual({
      suffix: 'thday',
    });
  });

  it('trailing keyword + date cue + space suggests palette color', () => {
    expect(
      getHistorySuggestion('Mom birthday next friday ', engine, new Map())
    ).toEqual({ suffix: 'pink' });
  });

  it('partial palette token completes disambiguated color (yello → w)', () => {
    expect(getHistorySuggestion('yello', engine, new Map())).toEqual({
      suffix: 'w',
    });
  });

  it('many suggestions stay within perf budget', () => {
    const hist = buildHistoryBoost(['Product launch May 15', 'Dentist tomorrow']);
    const texts = [
      'bir',
      'tom',
      'next fr',
      'Mom birthday next friday ',
      'product launch next ',
      'yello',
      'Release ',
      'visa ',
    ];
    const iters = 400;
    const t0 = performance.now();
    __perfRunSuggestions(engine, hist, texts, iters);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(150);
  });
});
