/**
 * App state: its shape, its defaults, and how it round-trips through the URL
 * hash so any board you land on is a link you can send someone.
 *
 * localStorage remembers the last board for a return visit; an explicit hash
 * always wins over it, so a shared link opens what the sender saw.
 *
 * Deliberately NOT here — these all derive from the tuning or are fixed:
 *   · key/scale (the tuning IS the key — keyFromTuning.ts)
 *   · accidentals (always auto: the key's own signature decides ♯ vs ♭)
 *   · fret count (always 12 — the first twelve frets hold every chord)
 */
import { CUSTOM_TUNING_ID, DEFAULT_TUNING_ID, getTuning } from './tunings';
import { PULL_MAX, PULL_MIN } from './tuningState';
import { TONE_NAMES, type ToneName } from './audio';

export type NeckView = 'bar' | 'map';

/** The board always draws frets 0..12; positions only ever use 0..11. */
export const MAX_FRET = 12;

export interface AppState {
  tuningId: string;
  /** Only meaningful when tuningId === 'custom'. */
  customTuning: number[];
  barFret: number;
  /** Selected grip: index into chordsAtFret at the bar (clamped in App). */
  chip: number;
  view: NeckView;
  /** Per-string semitone bends, low string first. */
  pulls: number[];
  tone: ToneName;
}

export const DEFAULT_STATE: AppState = {
  tuningId: DEFAULT_TUNING_ID,
  customTuning: [48, 52, 55, 57, 60, 64],
  barFret: 0,
  chip: 0,
  view: 'bar',
  pulls: [],
  tone: 'steel',
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
  if (s.chip !== DEFAULT_STATE.chip) p.set('i', String(s.chip));
  if (s.view !== DEFAULT_STATE.view) p.set('v', s.view);
  if (s.pulls.some(Boolean)) p.set('p', s.pulls.join('.'));
  if (s.tone !== DEFAULT_STATE.tone) p.set('o', s.tone);
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
  if (Number.isFinite(f)) next.barFret = clampInt(f, 0, MAX_FRET);

  const i = Number(p.get('i'));
  if (Number.isFinite(i)) next.chip = clampInt(i, 0, 40);

  const v = p.get('v');
  if (v === 'bar' || v === 'map') next.view = v;

  // Older links carried k=/s= (key), m= (fret count), a= (accidentals),
  // g= (guide) and c= (find target); all of those are now derived or fixed,
  // so the params are simply ignored.

  const pulls = p.get('p');
  if (pulls) {
    next.pulls = pulls
      .split('.')
      .map(Number)
      .map((n) => (Number.isFinite(n) ? clampInt(n, PULL_MIN, PULL_MAX) : 0));
  }

  const o = p.get('o');
  if (o && (TONE_NAMES as string[]).includes(o)) next.tone = o as ToneName;

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

export function shareUrl(s: AppState): string {
  return `${window.location.origin}${window.location.pathname}#${encodeState(s)}`;
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
