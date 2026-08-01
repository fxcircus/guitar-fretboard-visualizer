/**
 * App state: its shape, its defaults, and how it round-trips through the URL
 * hash so any board you land on is a link you can send someone.
 *
 * localStorage remembers the last board for a return visit; an explicit hash
 * always wins over it, so a shared link opens what the sender saw.
 */
import { CUSTOM_TUNING_ID, DEFAULT_TUNING_ID, getTuning } from './tunings';
import { PULL_MAX, PULL_MIN } from './tuningState';
import { CHORD_TYPES } from './chordEngine';
import { TONE_NAMES, type ToneName } from './audio';

export type NeckView = 'bar' | 'map';
export type KeyGuide = 'chords' | 'scale' | 'off';
export type Accidentals = 'auto' | 'sharp' | 'flat';

// There is deliberately no key/scale here: the key is derived from the
// selected tuning (see keyFromTuning.ts) — the tuning IS the key.
export interface AppState {
  tuningId: string;
  /** Only meaningful when tuningId === 'custom'. */
  customTuning: number[];
  barFret: number;
  maxFret: number;
  view: NeckView;
  guide: KeyGuide;
  /** Per-string semitone bends, low string first. */
  pulls: number[];
  accidentals: Accidentals;
  tone: ToneName;
  /** Chord finder: root pitch class, or null when nothing is being looked up. */
  findRootPc: number | null;
  /** Chord finder: a suffix from CHORD_TYPES. */
  findSuffix: string;
}

export const FRET_COUNTS = [12, 15, 18, 22, 24];

export const DEFAULT_STATE: AppState = {
  tuningId: DEFAULT_TUNING_ID,
  customTuning: [48, 52, 55, 57, 60, 64],
  barFret: 0,
  maxFret: 12,
  view: 'bar',
  guide: 'chords',
  pulls: [],
  accidentals: 'auto',
  tone: 'clean',
  findRootPc: null,
  findSuffix: '',
};

const STORAGE_KEY = 'gfv.state.v1';

const clampInt = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.round(v)));

// ── URL hash ───────────────────────────────────────────────────────────────

export function encodeState(s: AppState): string {
  const p = new URLSearchParams();
  p.set('t', s.tuningId);
  if (s.tuningId === CUSTOM_TUNING_ID) p.set('u', s.customTuning.join('.'));
  p.set('f', String(s.barFret));
  if (s.maxFret !== DEFAULT_STATE.maxFret) p.set('m', String(s.maxFret));
  if (s.view !== DEFAULT_STATE.view) p.set('v', s.view);
  if (s.guide !== DEFAULT_STATE.guide) p.set('g', s.guide);
  if (s.pulls.some(Boolean)) p.set('p', s.pulls.join('.'));
  if (s.accidentals !== DEFAULT_STATE.accidentals) p.set('a', s.accidentals);
  if (s.tone !== DEFAULT_STATE.tone) p.set('o', s.tone);
  if (s.findRootPc !== null) p.set('c', `${s.findRootPc}.${s.findSuffix}`);
  return p.toString();
}

export function decodeState(hash: string, base: AppState = DEFAULT_STATE): AppState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const next: AppState = { ...base };

  const t = p.get('t');
  if (t && (t === CUSTOM_TUNING_ID || getTuning(t))) next.tuningId = t;

  const u = p.get('u');
  if (u) {
    const midi = u.split('.').map(Number).filter((n) => Number.isFinite(n));
    if (midi.length >= 3 && midi.length <= 10) next.customTuning = midi;
  }

  const f = Number(p.get('f'));
  if (Number.isFinite(f)) next.barFret = clampInt(f, 0, 24);

  const m = Number(p.get('m'));
  if (FRET_COUNTS.includes(m)) next.maxFret = m;

  const v = p.get('v');
  if (v === 'bar' || v === 'map') next.view = v;

  // Older links carried k= (key root) and s= (scale); the key now derives from
  // the tuning, so those params are simply ignored.

  const g = p.get('g');
  if (g === 'chords' || g === 'scale' || g === 'off') next.guide = g;

  const pulls = p.get('p');
  if (pulls) {
    next.pulls = pulls
      .split('.')
      .map(Number)
      .map((n) => (Number.isFinite(n) ? clampInt(n, PULL_MIN, PULL_MAX) : 0));
  }

  const a = p.get('a');
  if (a === 'auto' || a === 'sharp' || a === 'flat') next.accidentals = a;

  const o = p.get('o');
  if (o && (TONE_NAMES as string[]).includes(o)) next.tone = o as ToneName;

  const c = p.get('c');
  if (c) {
    const [rootStr, ...rest] = c.split('.');
    const rootPc = Number(rootStr);
    const suffix = rest.join('.');
    if (Number.isFinite(rootPc) && CHORD_TYPES.some((ct) => ct.suffix === suffix)) {
      next.findRootPc = ((rootPc % 12) + 12) % 12;
      next.findSuffix = suffix;
    }
  }

  // The bar can never sit past the end of the neck.
  next.barFret = clampInt(next.barFret, 0, next.maxFret);
  return next;
}

// ── Persistence ────────────────────────────────────────────────────────────

export function loadState(): AppState {
  let stored = DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = decodeState(raw, DEFAULT_STATE);
  } catch {
    /* private mode, disabled storage — defaults are fine */
  }
  // A hash in the URL is an explicit request; it beats whatever we remembered.
  if (window.location.hash.length > 1) return decodeState(window.location.hash, stored);
  return stored;
}

export function saveState(s: AppState): void {
  const encoded = encodeState(s);
  try {
    localStorage.setItem(STORAGE_KEY, encoded);
  } catch {
    /* ignore */
  }
  const next = `#${encoded}`;
  if (window.location.hash !== next) {
    // replaceState, so the app's own writes don't pile up history entries and
    // don't fire `hashchange` — only a real navigation (Back, or a pasted
    // link) does, which is exactly what watchHash wants to hear.
    window.history.replaceState(null, '', next);
  }
}

/**
 * Re-read the hash when the user navigates to a different one — pressing Back,
 * or pasting a shared link into the tab that already has the app open. Without
 * this the URL would change and the board would not.
 */
export function watchHash(onChange: (s: AppState) => void): () => void {
  const handler = () => onChange(decodeState(window.location.hash));
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}

export function shareUrl(s: AppState): string {
  return `${window.location.origin}${window.location.pathname}#${encodeState(s)}`;
}
