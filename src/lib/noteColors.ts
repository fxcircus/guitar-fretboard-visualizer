/**
 * Harmonic-function colors, ported from the VG-800 controller's Chords mode
 * (github.com/fxcircus/vg800_midi_control — STR_COLORS / degColor /
 * CHORD_FUNC) so both apps speak the same color language:
 *
 *   root — red · 3rd — orange · 5th — lime · 7th — green ·
 *   2/9 — blue · 4/6/11/13 — purple
 *
 * and for whole chords, the classic function triad:
 *   tonic (home) — green · subdominant (departure) — blue ·
 *   dominant (tension) — orange
 *
 * The hues are fixed (not themed): they are an identity shared with the
 * VG-800, and they read on both dark and light boards with dark ink.
 */

export const DEGREE_COLORS = {
  root: '#ef5350',
  third: '#f2a33d',
  fifth: '#c6d43f',
  seventh: '#4cc178',
  ninth: '#4f9dea',
  color: '#a563d4', // 4ths, 6ths and their extensions — the "color" tones
} as const;

/** Dark ink that stays readable on every DEGREE_COLORS fill, in both themes. */
export const DEGREE_INK = '#12141a';

/**
 * Fill for a chord-tone marker, from its interval caption relative to the
 * chord root ('R', '♭3', '5', '♭7', '9', '13', …) — the same bucketing as the
 * VG-800's degColor.
 */
export function intervalColor(label: string): string {
  if (label === 'R') return DEGREE_COLORS.root;
  if (label === '♭3' || label === '3') return DEGREE_COLORS.third;
  if (label === '♭5' || label === '5' || label === '♯5') return DEGREE_COLORS.fifth;
  if (label === '♭7' || label === '7') return DEGREE_COLORS.seventh;
  if (label === '♭9' || label === '9' || label === '2') return DEGREE_COLORS.ninth;
  return DEGREE_COLORS.color; // 4 · 6 · 11 · 13
}

/**
 * Fill for a scale-degree marker in Map view, from its degree caption
 * ('1', '♭3', '♯4', '♭7', …). Accidentals don't change the bucket — a ♭3 is
 * still the third.
 */
export function degreeColor(label: string): string {
  const digit = label.replace(/[♯♭]/g, '');
  switch (digit) {
    case '1':
      return DEGREE_COLORS.root;
    case '2':
      return DEGREE_COLORS.ninth;
    case '3':
      return DEGREE_COLORS.third;
    case '5':
      return DEGREE_COLORS.fifth;
    case '7':
      return DEGREE_COLORS.seventh;
    default:
      return DEGREE_COLORS.color; // 4 · 6
  }
}

// ── Whole-chord harmonic function (the VG-800 Chords matrix scheme) ────────

export type ChordFunction = 'tonic' | 'subdom' | 'dominant';

export const FUNCTION_COLORS: Record<ChordFunction, string> = {
  tonic: '#45c07a',
  subdom: '#5aa2ea',
  dominant: '#ea6a3c',
};

/** Harmonic function by scale degree (0-based): I ii iii IV V vi vii°. */
export const CHORD_FUNC: ChordFunction[] = [
  'tonic',
  'subdom',
  'tonic',
  'subdom',
  'dominant',
  'tonic',
  'dominant',
];

export function functionColor(degreeIndex: number): string {
  return FUNCTION_COLORS[CHORD_FUNC[degreeIndex] ?? 'tonic'];
}
