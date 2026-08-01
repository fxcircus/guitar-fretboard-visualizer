/**
 * URL state gate — a shared link has to reopen the exact board it was made
 * from, and a hostile or stale hash must never produce a broken app.
 */
import { describe, expect, test } from 'vitest';
import { DEFAULT_STATE, MAX_FRET, decodeState, encodeState, type AppState } from './appState';

const roundTrip = (s: AppState) => decodeState(encodeState(s));

describe('URL state', () => {
  test('round-trips a full board', () => {
    const s: AppState = {
      ...DEFAULT_STATE,
      tuningId: 'b11',
      barFret: 7,
      chip: 3,
      view: 'map',
      pulls: [0, 2, 0, -1, 0, 0],
      tone: 'saw', // the non-default voice, so the o= param is exercised
      mode: 'together', // the non-default delivery, so the m= param is exercised
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
    const s = decodeState('#f=999&i=-4&v=sideways&o=kazoo');
    expect(s.barFret).toBe(MAX_FRET); // clamped onto the 12-fret board
    expect(s.chip).toBe(0);
    expect(s.view).toBe(DEFAULT_STATE.view);
    expect(s.tone).toBe(DEFAULT_STATE.tone);
  });

  test('the bar can never sit past fret 12', () => {
    expect(decodeState('#f=20').barFret).toBe(12);
    expect(decodeState('#f=7').barFret).toBe(7);
  });

  test('legacy params from older links are ignored, not fatal', () => {
    // k/s (key), m (fret count), a (accidentals), g (guide), c (find target)
    // all derive from the tuning or are fixed now.
    const s = decodeState('#t=b11&f=3&k=E♭&s=Dorian&m=22&a=flat&g=scale&c=9.m7&o=clean');
    expect(s.tuningId).toBe('b11');
    expect(s.barFret).toBe(3);
    expect(s.tone).toBe(DEFAULT_STATE.tone); // 'clean' no longer exists
    expect(s.view).toBe('bar');
    // m= was the fret count back then; it must not read as a play mode.
    expect(s.mode).toBe(DEFAULT_STATE.mode);
  });

  test('pulls are clamped to the legal bend range', () => {
    expect(decodeState('#p=99.-99.1').pulls).toEqual([4, -4, 1]);
  });

  test('the encoding stays short for a default-ish board', () => {
    // Shared links get pasted into chat windows; keep them readable.
    expect(encodeState(DEFAULT_STATE).length).toBeLessThan(30);
  });
});
