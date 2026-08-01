/**
 * Bar-chord engine.
 *
 * Open-tuning harmony is bar-centric: the open tuning IS a chord, a straight
 * bar at fret n transposes it by n semitones, and chord quality comes from
 * WHICH strings you pick (string groups), not from finger shapes. This module
 * answers the questions a player asks at any bar position:
 *
 *   1. "What chord is this?"     → identifyChord / identifyChords
 *   2. "What chords live here?"  → chordsAtFret (every contiguous string group
 *                                   that spells a chord)
 *   3. "Where do I play THIS?"   → findBarPositions / findSlantPositions
 *
 * Everything works on a plain array of open-string MIDI numbers, low string
 * first, of any length from 3 (saz, balalaika) to 10 (pedal steel).
 */

export type ChordQuality = 'maj' | 'min' | 'dom' | 'other';

export interface ChordMatch {
  rootPc: number;
  /** Chord-symbol suffix, e.g. '' (major), 'm7', '6', '11'. */
  suffix: string;
  quality: ChordQuality;
  /** Human name for the formula, e.g. 'minor 7'. */
  formulaName: string;
  /** Formula intervals from the root, sorted ascending. */
  intervals: number[];
}

export interface FretChord {
  match: ChordMatch;
  /** String indices in the group, low string = 0, ascending. */
  strings: number[];
  isFullStack: boolean;
}

interface ChordFormula {
  intervals: number[];
  suffix: string;
  quality: ChordQuality;
  name: string;
}

// Exact-match formulas: a pitch-class set is the chord iff its intervals
// from some root equal the formula exactly. Ordered smallest-first only for
// readability — matching is by set equality, so order doesn't matter.
const FORMULAS: ChordFormula[] = [
  // triads
  { intervals: [0, 4, 7], suffix: '', quality: 'maj', name: 'major' },
  { intervals: [0, 3, 7], suffix: 'm', quality: 'min', name: 'minor' },
  { intervals: [0, 3, 6], suffix: '°', quality: 'other', name: 'diminished' },
  { intervals: [0, 4, 8], suffix: '+', quality: 'other', name: 'augmented' },
  { intervals: [0, 2, 7], suffix: 'sus2', quality: 'other', name: 'sus2' },
  { intervals: [0, 5, 7], suffix: 'sus4', quality: 'other', name: 'sus4' },
  // 4-note
  { intervals: [0, 4, 7, 10], suffix: '7', quality: 'dom', name: 'dominant 7' },
  { intervals: [0, 4, 7, 11], suffix: 'maj7', quality: 'maj', name: 'major 7' },
  { intervals: [0, 3, 7, 10], suffix: 'm7', quality: 'min', name: 'minor 7' },
  { intervals: [0, 4, 7, 9], suffix: '6', quality: 'maj', name: '6th' },
  { intervals: [0, 3, 7, 9], suffix: 'm6', quality: 'min', name: 'minor 6' },
  { intervals: [0, 3, 6, 9], suffix: '°7', quality: 'other', name: 'diminished 7' },
  { intervals: [0, 3, 6, 10], suffix: 'm7♭5', quality: 'other', name: 'half-diminished' },
  { intervals: [0, 2, 4, 7], suffix: 'add9', quality: 'maj', name: 'add 9' },
  { intervals: [0, 3, 7, 11], suffix: 'm(maj7)', quality: 'min', name: 'minor-major 7' },
  { intervals: [0, 5, 7, 10], suffix: '7sus4', quality: 'dom', name: '7 sus4' },
  // 5-note
  { intervals: [0, 2, 4, 7, 10], suffix: '9', quality: 'dom', name: 'dominant 9' },
  { intervals: [0, 2, 4, 7, 11], suffix: 'maj9', quality: 'maj', name: 'major 9' },
  { intervals: [0, 2, 3, 7, 10], suffix: 'm9', quality: 'min', name: 'minor 9' },
  { intervals: [0, 2, 4, 7, 9], suffix: '6/9', quality: 'maj', name: '6/9' },
  { intervals: [0, 2, 3, 7, 9], suffix: 'm6/9', quality: 'min', name: 'minor 6/9' },
  { intervals: [0, 3, 4, 7, 10], suffix: '7♯9', quality: 'dom', name: '7 sharp 9' },
  { intervals: [0, 1, 4, 7, 10], suffix: '7♭9', quality: 'dom', name: '7 flat 9' },
  { intervals: [0, 4, 7, 9, 10], suffix: '13', quality: 'dom', name: 'dominant 13 (no 9)' },
  // 6-note
  { intervals: [0, 2, 4, 5, 7, 10], suffix: '11', quality: 'dom', name: 'dominant 11' },
  { intervals: [0, 2, 4, 7, 9, 10], suffix: '13', quality: 'dom', name: 'dominant 13' },
];

export const SHARP_NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const FLAT_NOTES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export const midiPc = (midi: number): number => ((midi % 12) + 12) % 12;

export const midiOctave = (midi: number): number => Math.floor(midi / 12) - 1;

/**
 * Spell a pitch class. One accidental system is used for the whole screen at a
 * time (see `preferFlats` on a tuning) so a board never shows a G♯ string label
 * over an A♭ marker.
 */
export const displayNote = (pc: number, flats = false): string =>
  (flats ? FLAT_NOTES : SHARP_NOTES)[((pc % 12) + 12) % 12];

/** e.g. "C♯3" — pitch class plus octave, for the tuning editor. */
export const displayPitch = (midi: number, flats = false): string =>
  displayNote(midiPc(midi), flats) + midiOctave(midi);

export const chordLabel = (match: ChordMatch, flats = false): string =>
  displayNote(match.rootPc, flats) + match.suffix;

const INTERVAL_LABELS = ['R', '♭9', '9', '♭3', '3', '4', '♭5', '5', '♯5', '6', '♭7', '7'];

/**
 * Interval name relative to the chord root. In a chord that carries a ♭7
 * the tensions are spelled as extensions (E in B11 is the 11, C♯ in E13 is
 * the 13); without one, the plain names apply (A in C6 is the 6).
 */
export const intervalLabel = (semitones: number, hasFlat7 = false): string => {
  const semi = ((semitones % 12) + 12) % 12;
  if (hasFlat7) {
    if (semi === 5) return '11';
    if (semi === 9) return '13';
  }
  return INTERVAL_LABELS[semi];
};

const arraysEqual = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// When the bass isn't any interpretation's root, players reach for the
// major-family name first (the A6 tuning with C♯ in the bass is "A6", not
// "F♯m7/C♯"), then dominant colors, then minor.
const QUALITY_RANK: Record<ChordQuality, number> = { maj: 0, dom: 1, min: 2, other: 3 };

/**
 * All exact chord interpretations of a pitch-class set, ranked.
 * When bassPc is given, interpretations rooted on the bass win outright —
 * so C-E-G-A reads as C6 with C in the bass but as Am7 with A in the bass
 * (the classic 6th/m7 duality). Inversions fall back to quality preference,
 * then root distance above the bass.
 */
export function identifyChords(pcs: number[], bassPc: number | null = null): ChordMatch[] {
  const set = Array.from(new Set(pcs.map((p) => ((p % 12) + 12) % 12))).sort((a, b) => a - b);
  if (set.length < 3) return [];

  const matches: ChordMatch[] = [];
  for (const root of set) {
    const intervals = set.map((p) => (p - root + 12) % 12).sort((a, b) => a - b);
    for (const f of FORMULAS) {
      if (arraysEqual(intervals, f.intervals)) {
        matches.push({
          rootPc: root,
          suffix: f.suffix,
          quality: f.quality,
          formulaName: f.name,
          intervals: f.intervals,
        });
      }
    }
  }

  if (bassPc !== null) {
    const bass = ((bassPc % 12) + 12) % 12;
    matches.sort((a, b) => {
      const aRooted = a.rootPc === bass ? 0 : 1;
      const bRooted = b.rootPc === bass ? 0 : 1;
      if (aRooted !== bRooted) return aRooted - bRooted;
      if (QUALITY_RANK[a.quality] !== QUALITY_RANK[b.quality]) {
        return QUALITY_RANK[a.quality] - QUALITY_RANK[b.quality];
      }
      return ((a.rootPc - bass + 12) % 12) - ((b.rootPc - bass + 12) % 12);
    });
  }
  return matches;
}

/** Best single interpretation (see identifyChords), or null. */
export function identifyChord(pcs: number[], bassPc: number | null = null): ChordMatch | null {
  return identifyChords(pcs, bassPc)[0] ?? null;
}

// ── Grips ──────────────────────────────────────────────────────────────────
// Real steel grips are NOT limited to adjacent strings: the picking hand
// blocks the strings it skips (pick/palm blocking is named, taught technique).
// The canonical E9 major grips are 3-4-5, 4-5-6, 5-6-8, 6-8-10 and 4-6-10
// ("Get A Grip" chart — "notice we are skipping 7, 9, 1, 2 since they are not
// part of major chord"), and C6's workhorse triads are 9-6-4 and 8-5-3
// (Steel Guitar Forum, "Basic C6th Chord Grips"). Calibrated against that
// practice: PICKED grips are 3–4 strings (thumbpick + 2–3 fingerpicks) inside
// a span of up to 7 consecutive strings; anything larger is a STRUM, which
// can only sweep contiguous strings.
export const MAX_PICKED_GRIP_SIZE = 4;
export const MAX_GRIP_SPAN = 7;

/** Interior strings a grip skips (0 = contiguous). */
export const gripSkips = (strings: number[]): number =>
  strings[strings.length - 1] - strings[0] + 1 - strings.length;

const GRIP_CACHE = new Map<number, number[][]>();

/**
 * Every playable string group on an n-string neck, sorted most-compact-first
 * (smallest, then fewest skips, tightest span, lowest start) so consumers that
 * dedup by chord name land on the simplest grip.
 */
export function gripsFor(n: number): number[][] {
  const hit = GRIP_CACHE.get(n);
  if (hit) return hit;

  const grips: number[][] = [];
  // Contiguous runs of any size — close grips and strums.
  for (let size = 3; size <= n; size++) {
    for (let start = 0; start + size <= n; start++) {
      grips.push(Array.from({ length: size }, (_, i) => start + i));
    }
  }
  // Picked skip-grips: 3–4 strings whose span exceeds their size (≥1 skip).
  for (let start = 0; start < n; start++) {
    for (let end = start + 3; end < n && end - start + 1 <= MAX_GRIP_SPAN; end++) {
      const span = end - start + 1;
      if (span > 3) {
        for (let m = start + 1; m < end; m++) grips.push([start, m, end]);
      }
      if (span > 4 && MAX_PICKED_GRIP_SIZE >= 4) {
        for (let m1 = start + 1; m1 < end; m1++) {
          for (let m2 = m1 + 1; m2 < end; m2++) grips.push([start, m1, m2, end]);
        }
      }
    }
  }
  grips.sort(
    (a, b) =>
      a.length - b.length ||
      gripSkips(a) - gripSkips(b) ||
      a[a.length - 1] - a[0] - (b[b.length - 1] - b[0]) ||
      a[0] - b[0]
  );
  GRIP_CACHE.set(n, grips);
  return grips;
}

/**
 * Every distinct chord available under a straight bar at `fret`, as playable
 * string grips (see gripsFor — contiguous runs plus documented skip-grips).
 *
 * The full stack is emitted first (so it keeps its own name and isn't
 * relabelled by a sub-group), then grips are scanned most-compact-first, so
 * each chord is shown as its simplest grip — a plain contiguous triad wins
 * over an incidental larger or skippier group.
 */
export function chordsAtFret(tuningMidi: number[], fret: number): FretChord[] {
  const n = tuningMidi.length;
  if (n < 3) return [];
  const results: FretChord[] = [];
  const seen = new Set<string>();

  const consider = (strings: number[], isFullStack: boolean) => {
    const groupMidi = strings.map((s) => tuningMidi[s] + fret);
    const bassPc = midiPc(Math.min(...groupMidi));
    const match = identifyChord(groupMidi.map(midiPc), bassPc);
    if (!match) return;
    const key = `${match.rootPc}:${match.suffix}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ match, strings, isFullStack });
  };

  consider(Array.from({ length: n }, (_, i) => i), true);
  for (const strings of gripsFor(n)) {
    if (strings.length === n) continue; // the full stack was considered first
    consider(strings, false);
  }
  return results;
}

export interface BarPosition {
  fret: number;
  /** String indices in the group, low string = 0, ascending. */
  strings: number[];
  match: ChordMatch;
  /** Group covers every target pitch class (not just a consonant subset). */
  isFullTarget: boolean;
  /** Target root is the group's lowest-sounding note. */
  rootInBass: boolean;
}

/**
 * Where to lay a straight bar to play a target chord in this tuning.
 *
 * A position is any fret + contiguous string group whose notes are all
 * chord tones of the target (a subset — e.g. a C major triad voices a
 * Cmaj7 target) and that is rooted on the target root. This is exactly how
 * a bar player finds a progression chord: slide to a fret and pick the
 * strings that spell it. At most one (best) group per fret is returned,
 * fret-ascending; a chord the tuning can't voice under a straight bar
 * yields an empty list.
 */
export function findBarPositions(
  tuningMidi: number[],
  targetPcs: number[],
  targetRootPc: number,
  maxFret = 12
): BarPosition[] {
  const target = new Set(targetPcs.map((pc) => ((pc % 12) + 12) % 12));
  const root = ((targetRootPc % 12) + 12) % 12;
  if (target.size < 3 || !target.has(root)) return [];
  const n = tuningMidi.length;

  const positions: BarPosition[] = [];
  const gripList = gripsFor(n);
  for (let fret = 0; fret <= maxFret; fret++) {
    let best: BarPosition | null = null;
    let bestSkips = 0;
    // Scan every grip directly (not the deduped chordsAtFret list) so a group
    // the "sounding chord" logic would name for a different root — e.g. C6's
    // G-A-C-E, named C6 but a full Am7 — is still found when it voices the
    // target.
    for (const strings of gripList) {
      const groupPcs = strings.map((s) => midiPc(tuningMidi[s] + fret));
      const distinct = new Set(groupPcs);
      if (distinct.size < 3) continue;
      if (!Array.from(distinct).every((pc) => target.has(pc))) continue;
      if (!distinct.has(root)) continue;

      // Must be a nameable chord rooted on the target root (not an arbitrary
      // fragment of chord tones). Bass = the lowest-SOUNDING note (a pull or
      // custom tuning can make a higher-index string sound lower), matching
      // chordsAtFret so rootInBass stays correct.
      const bassPc = midiPc(Math.min(...strings.map((s) => tuningMidi[s] + fret)));
      const match = identifyChords(groupPcs, bassPc).find((m) => m.rootPc === root);
      if (!match) continue;

      const isFullTarget = Array.from(target).every((pc) => distinct.has(pc));
      const rootInBass = bassPc === root;
      const skips = gripSkips(strings);
      const cand: BarPosition = { fret, strings, match, isFullTarget, rootInBass };

      // Best grip at this fret: fuller coverage, then the simplest hand
      // (fewest skipped strings — contiguous is the easy grip), then more
      // strings, then root in the bass.
      if (
        !best ||
        (cand.isFullTarget !== best.isFullTarget && cand.isFullTarget) ||
        (cand.isFullTarget === best.isFullTarget &&
          (skips < bestSkips ||
            (skips === bestSkips &&
              (cand.strings.length > best.strings.length ||
                (cand.strings.length === best.strings.length &&
                  cand.rootInBass &&
                  !best.rootInBass)))))
      ) {
        best = cand;
        bestSkips = skips;
      }
    }
    if (best) positions.push(best);
  }
  return positions;
}

/** Rank bar positions by nearness to the current bar (fuller coverage breaks ties). */
export function rankByNearness(positions: BarPosition[], currentFret: number): BarPosition[] {
  return [...positions].sort((a, b) => {
    const da = Math.abs(a.fret - currentFret);
    const db = Math.abs(b.fret - currentFret);
    if (da !== db) return da - db;
    if (a.isFullTarget !== b.isFullTarget) return a.isFullTarget ? -1 : 1;
    return a.fret - b.fret;
  });
}

export interface SlantPosition {
  /** Lower-pitched string of the pair (smaller index). */
  lowString: number;
  /** Higher-pitched string of the pair. */
  highString: number;
  lowFret: number;
  highFret: number;
  /** forward = the higher string is fretted higher; reverse = lower. */
  direction: 'forward' | 'reverse';
  /** [low-string pc, high-string pc]. */
  notes: [number, number];
  /** e.g. "E → G". */
  label: string;
}

/**
 * Two-string bar slants that voice a target chord's quality.
 *
 * A slant tilts the bar so two ADJACENT strings sound at frets differing by
 * ±1/±2 — the move that gets a minor chord out of a major tuning (reverse-
 * slant the 3rd down) or a IV fragment (forward-slant a 3rd up to a 4th). We
 * look for the quality-defining double-stop: the 3rd of the chord paired
 * with the root or 5th. Only adjacent strings are used (the bar can't skip a
 * string without sounding it), and every note is validated against the
 * actual target — a chord whose 5th is diminished/augmented won't be offered
 * a perfect-5th note it doesn't contain. Returned fret-ascending.
 */
export function findSlantPositions(
  tuningMidi: number[],
  targetPcs: number[],
  targetRootPc: number,
  maxFret = 12,
  flats = false
): SlantPosition[] {
  const target = new Set(targetPcs.map((pc) => ((pc % 12) + 12) % 12));
  const root = ((targetRootPc % 12) + 12) % 12;
  if (!target.has(root)) return [];
  const majThird = (root + 4) % 12;
  const minThird = (root + 3) % 12;
  const third = target.has(majThird) ? majThird : target.has(minThird) ? minThird : null;
  if (third === null) return []; // no 3rd → nothing to voice a quality with
  // Only offer the 5th if the chord actually has a perfect 5th (dim/aug chords don't)
  const fifth = target.has((root + 7) % 12) ? (root + 7) % 12 : null;

  const wanted = (pc: number) => pc === root || pc === third || (fifth !== null && pc === fifth);
  const out: SlantPosition[] = [];
  const seen = new Set<string>();
  const n = tuningMidi.length;

  for (let a = 0; a + 1 < n; a++) {
    const b = a + 1; // adjacent strings only
    // Both endpoints start at fret 1: fret 0 is the open string, which the nut
    // frets, not the bar — "slant to the nut" is not a move a bar can make.
    for (let fa = 1; fa <= maxFret; fa++) {
      for (const d of [1, -1, 2, -2]) {
        const fb = fa + d;
        if (fb < 1 || fb > maxFret) continue;
        const pa = midiPc(tuningMidi[a] + fa);
        const pb = midiPc(tuningMidi[b] + fb);
        if (!wanted(pa) || !wanted(pb) || pa === pb) continue;
        // Must carry the 3rd (the quality) plus the root or 5th
        const pair = new Set([pa, pb]);
        if (!pair.has(third)) continue;
        if (!(pair.has(root) || (fifth !== null && pair.has(fifth)))) continue;

        const key = `${a}:${b}:${fa}:${fb}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          lowString: a,
          highString: b,
          lowFret: fa,
          highFret: fb,
          direction: fb > fa ? 'forward' : 'reverse',
          notes: [pa, pb],
          label: `${displayNote(pa, flats)} → ${displayNote(pb, flats)}`,
        });
      }
    }
  }
  return out.sort((x, y) => Math.min(x.lowFret, x.highFret) - Math.min(y.lowFret, y.highFret));
}

/** Rank slants by nearness to the current bar. */
export function rankSlantsByNearness(
  positions: SlantPosition[],
  currentFret: number
): SlantPosition[] {
  const near = (p: SlantPosition) => Math.abs((p.lowFret + p.highFret) / 2 - currentFret);
  return [...positions].sort((a, b) => near(a) - near(b));
}

/**
 * The scan row: the given chord's name at every fret 0..maxFret (fret =
 * transposition, so the whole neck maps at a glance). `match` is the chord
 * at `barFret` — usually the selected string group, so selecting the minor
 * grip maps the minor chord across the neck. All-null when the stack has
 * no nameable chord (e.g. a wild custom tuning).
 */
export function scanLabelsFor(
  match: ChordMatch | null,
  barFret: number,
  maxFret = 12,
  flats = false
): (string | null)[] {
  return Array.from({ length: maxFret + 1 }, (_, fret) =>
    match
      ? displayNote((((match.rootPc - barFret + fret) % 12) + 12) % 12, flats) + match.suffix
      : null
  );
}

// ── Chord finder ───────────────────────────────────────────────────────────

export interface ChordType {
  suffix: string;
  name: string;
  intervals: number[];
}

/**
 * The chord vocabulary the finder offers, ordered the way a player thinks:
 * triads, then sevenths, then colours.
 */
export const CHORD_TYPES: ChordType[] = [
  { suffix: '', name: 'major', intervals: [0, 4, 7] },
  { suffix: 'm', name: 'minor', intervals: [0, 3, 7] },
  { suffix: '7', name: 'dominant 7', intervals: [0, 4, 7, 10] },
  { suffix: 'maj7', name: 'major 7', intervals: [0, 4, 7, 11] },
  { suffix: 'm7', name: 'minor 7', intervals: [0, 3, 7, 10] },
  { suffix: '6', name: '6th', intervals: [0, 4, 7, 9] },
  { suffix: 'm6', name: 'minor 6', intervals: [0, 3, 7, 9] },
  { suffix: 'sus4', name: 'sus4', intervals: [0, 5, 7] },
  { suffix: 'sus2', name: 'sus2', intervals: [0, 2, 7] },
  { suffix: '9', name: 'dominant 9', intervals: [0, 2, 4, 7, 10] },
  { suffix: 'maj9', name: 'major 9', intervals: [0, 2, 4, 7, 11] },
  { suffix: 'm9', name: 'minor 9', intervals: [0, 2, 3, 7, 10] },
  { suffix: '6/9', name: '6/9', intervals: [0, 2, 4, 7, 9] },
  { suffix: '13', name: 'dominant 13', intervals: [0, 2, 4, 7, 9, 10] },
  { suffix: '°', name: 'diminished', intervals: [0, 3, 6] },
  { suffix: '°7', name: 'diminished 7', intervals: [0, 3, 6, 9] },
  { suffix: 'm7♭5', name: 'half-diminished', intervals: [0, 3, 6, 10] },
  { suffix: '+', name: 'augmented', intervals: [0, 4, 8] },
];

/** Pitch classes of `rootPc` + a chord type. */
export const chordPcs = (rootPc: number, type: ChordType): number[] =>
  type.intervals.map((i) => (rootPc + i) % 12);
