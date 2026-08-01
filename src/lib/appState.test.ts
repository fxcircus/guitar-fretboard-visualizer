/**
 * URL state gate — a shared link has to reopen the exact board it was made
 * from, and a hostile or stale hash must never produce a broken app.
 */
import { describe, expect, test } from 'vitest';
import { DEFAULT_STATE, decodeState, encodeState, type AppState } from './appState';

const roundTrip = (s: AppState) => decodeState(encodeState(s));

describe('URL state', () => {
  test('round-trips a full board', () => {
    const s: AppState = {
      ...DEFAULT_STATE,
      tuningId: 'b11',
      barFret: 7,
      maxFret: 22,
      view: 'map',
      keyRoot: 'E♭',
      scale: 'Dorian',
      guide: 'scale',
      pulls: [0, 2, 0, -1, 0, 0],
      accidentals: 'flat',
      tone: 'warm',
      findRootPc: 9,
      findSuffix: 'm7',
    };
    expect(roundTrip(s)).toEqual(s);
  });

  test('round-trips a custom tuning', () => {
    const s: AppState = {
      ...DEFAULT_STATE,
      tuningId: 'custom',
      customTuning: [40, 45, 50, 55],
    };
    expect(roundTrip(s).customTuning).toEqual([40, 45, 50, 55]);
    expect(roundTrip(s).tuningId).toBe('custom');
  });

  test('defaults survive an empty hash', () => {
    expect(decodeState('')).toEqual(DEFAULT_STATE);
    expect(decodeState('#')).toEqual(DEFAULT_STATE);
  });

  test('an unknown tuning id falls back instead of breaking', () => {
    expect(decodeState('#t=not-a-tuning').tuningId).toBe(DEFAULT_STATE.tuningId);
  });

  test('nonsense values are rejected, not trusted', () => {
    const s = decodeState('#f=999&m=7&v=sideways&s=Klingon&g=maybe&a=neither&o=kazoo&c=x.y');
    expect(s.barFret).toBeLessThanOrEqual(s.maxFret);
    expect(s.maxFret).toBe(DEFAULT_STATE.maxFret);
    expect(s.view).toBe(DEFAULT_STATE.view);
    expect(s.scale).toBe(DEFAULT_STATE.scale);
    expect(s.guide).toBe(DEFAULT_STATE.guide);
    expect(s.accidentals).toBe(DEFAULT_STATE.accidentals);
    expect(s.tone).toBe(DEFAULT_STATE.tone);
    expect(s.findRootPc).toBeNull();
  });

  test('pulls are clamped to the legal bend range', () => {
    expect(decodeState('#p=99.-99.1').pulls).toEqual([4, -4, 1]);
  });

  test('the bar can never land past the end of the neck', () => {
    expect(decodeState('#f=20&m=12').barFret).toBe(12);
    expect(decodeState('#f=20&m=22').barFret).toBe(20);
  });

  test('the encoding stays short for a default-ish board', () => {
    // Shared links get pasted into chat windows; keep them readable.
    expect(encodeState(DEFAULT_STATE).length).toBeLessThan(40);
  });
});
