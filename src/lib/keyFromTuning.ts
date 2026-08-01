/**
 * The tuning IS the key.
 *
 * Instead of asking the user for a key and scale, the app derives them from
 * the selected tuning — an open tuning declares its own tonal home (C6 lives
 * in C major, E13 in E Mixolydian, a Lydian mode neck in C Lydian). Every
 * scale map, diatonic chip, and degree label hangs off this derivation.
 *
 * Resolution order:
 *   1. An explicit `key` on the catalog entry (mode necks, guitar tunings,
 *      pedal-steel necks — anywhere naming beats derivation).
 *   2. The identified open-stack chord: its root is the key root and its
 *      quality picks the scale (major family → Major, minor → Minor/Dorian,
 *      dominant → Mixolydian…). This is the natural reading for lap-steel
 *      and open tunings, whose stacks identify as the chord they're named for.
 *   3. Fallback for unnameable stacks (drones, clusters, custom): root on the
 *      lowest-sounding string, first common scale that contains every open
 *      pitch class, else plain Major.
 */
import { identifyChord, midiPc, displayNote, type ChordMatch } from './chordEngine';
import { SCALE_INTERVALS, generateSpelledScale, noteToPitchClass } from './musicTheory';
import type { Tuning } from './tunings';

export interface TuningKey {
  /** Display spelling of the root, taken from the spelled scale. */
  root: string;
  /** A SCALE_INTERVALS name. */
  scale: string;
  rootPc: number;
  /** The spelled scale, without the octave repeat. */
  notes: string[];
  /** Where the key came from — shown in the UI so the inference is honest. */
  source: 'catalog' | 'chord' | 'fallback';
}

// Tried in order for stacks with no nameable chord; first scale rooted on the
// bass that contains every open pitch class wins.
const FALLBACK_SCALES = ['Major', 'Mixolydian', 'Minor', 'Dorian', 'Lydian', 'Phrygian', 'Locrian'];

export function scalePcSet(rootPc: number, scale: string): Set<number> {
  const intervals = SCALE_INTERVALS[scale] ?? SCALE_INTERVALS.Major;
  const out = new Set<number>([((rootPc % 12) + 12) % 12]);
  let pc = rootPc;
  for (const step of intervals) {
    pc = (pc + step) % 12;
    out.add(pc);
  }
  return out;
}

/**
 * Chord quality → the scale a player would reach for over it.
 * The color intervals matter: a m6 chord implies Dorian (the natural 6 over a
 * minor triad IS the Dorian color), m(maj7) implies harmonic minor, 7♭9
 * implies Phrygian dominant.
 */
export function scaleForChord(match: ChordMatch): string {
  const iv = new Set(match.intervals);
  switch (match.quality) {
    case 'maj':
      return iv.has(6) ? 'Lydian' : 'Major';
    case 'min':
      if (iv.has(11)) return 'Harmonic Minor';
      return iv.has(9) ? 'Dorian' : 'Minor';
    case 'dom':
      return iv.has(1) ? 'Phrygian Dominant' : 'Mixolydian';
    default:
      if (match.suffix === 'sus4' || match.suffix === '7sus4') return 'Mixolydian';
      if (match.suffix === 'sus2') return 'Major';
      if (match.suffix.startsWith('°') || match.suffix === 'm7♭5') return 'Locrian';
      return 'Major';
  }
}

/** Spell the key; the root label comes from the spelled scale itself, so a
 * theoretical key (D♯ major…) surfaces under its sane enharmonic name. */
function resolve(
  rootPc: number,
  rootName: string,
  scale: string,
  source: TuningKey['source']
): TuningKey {
  const spelled = generateSpelledScale(rootName, scale);
  const core =
    spelled.length > 1 &&
    noteToPitchClass(spelled[0]) === noteToPitchClass(spelled[spelled.length - 1])
      ? spelled.slice(0, -1)
      : spelled;
  const root = core[0] ?? rootName;
  return {
    root,
    scale,
    rootPc: ((noteToPitchClass(root) ?? rootPc) % 12 + 12) % 12,
    notes: core,
    source,
  };
}

export function deriveKey(tuning: Tuning): TuningKey {
  const flats = !!tuning.preferFlats;

  // 1. Catalog override
  if (tuning.key) {
    const pc = noteToPitchClass(tuning.key.root) ?? 0;
    return resolve(pc, tuning.key.root, tuning.key.scale, 'catalog');
  }

  const pcs = tuning.midi.map(midiPc);
  const bassPc = midiPc(Math.min(...tuning.midi));

  // 2. The open stack names a chord → root + quality-matched scale
  const match = identifyChord(pcs, bassPc);
  if (match) {
    return resolve(match.rootPc, displayNote(match.rootPc, flats), scaleForChord(match), 'chord');
  }

  // 3. Root on the lowest-sounding string; prefer a scale that keeps every
  //    open string diatonic
  const openSet = new Set(pcs);
  for (const scale of FALLBACK_SCALES) {
    const set = scalePcSet(bassPc, scale);
    if (Array.from(openSet).every((pc) => set.has(pc))) {
      return resolve(bassPc, displayNote(bassPc, flats), scale, 'fallback');
    }
  }
  return resolve(bassPc, displayNote(bassPc, flats), 'Major', 'fallback');
}
