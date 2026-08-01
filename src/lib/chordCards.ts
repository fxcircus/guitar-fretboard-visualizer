/**
 * The chord cards — the app's single chord-selection surface.
 *
 * One card per chord this tuning can actually voice under a straight bar,
 * split into:
 *
 *   degrees — the key's diatonic chords, carrying their roman numeral.
 *             Degrees the tuning cannot voice are OMITTED, not greyed.
 *   others  — every remaining nameable chord in the tuning, enumerated fret
 *             by fret. A chord that already appears as a degree is not
 *             repeated here.
 *
 * Every fret is canonical: positions live in frets 0..11 only. Fret 12
 * repeats fret 0 an octave up, so offering it would make the same chord
 * appear to "jump" between 0 and 12 — the first twelve frets already hold
 * every available chord.
 */
import {
  chordsAtFret,
  findBarPositions,
  type ChordMatch,
  type ChordQuality,
} from './chordEngine';
import { deriveScaleChords } from './musicTheory';

/** Highest fret a chord position may use; the board still draws fret 12. */
export const POSITION_MAX_FRET = 11;

export interface ChordCard {
  match: ChordMatch;
  /** Canonical fret, 0..POSITION_MAX_FRET. */
  fret: number;
  /** String indices of the grip at that fret, low string = 0. */
  strings: number[];
  /** Set on diatonic degree cards ("ii", "V", …). */
  roman?: string;
}

export interface ChordCards {
  degrees: ChordCard[];
  others: ChordCard[];
}

const QUALITY_ORDER: Record<ChordQuality, number> = { maj: 0, min: 1, dom: 2, other: 3 };

const keyOf = (m: ChordMatch) => `${m.rootPc}:${m.suffix}`;

/**
 * Collect the full card set for a tuning.
 *
 * @param tuningMidi open-string MIDI numbers, low string first
 * @param keyNotes   the derived key's spelled scale (no octave repeat)
 * @param keyRootPc  the key root — "others" sort outward from it
 */
export function collectChordCards(
  tuningMidi: number[],
  keyNotes: string[],
  keyRootPc: number
): ChordCards {
  const taken = new Set<string>();
  const degrees: ChordCard[] = [];

  // Diatonic triads are only well-defined for 7-note scales, where each
  // degree's index-stack is a real tertian triad rooted on tonePcs[0].
  if (keyNotes.length >= 7) {
    for (const deg of deriveScaleChords(keyNotes)) {
      const voicable =
        deg.triadName !== null &&
        deg.quality !== null &&
        deg.quality !== 'slash' &&
        new Set(deg.tonePcs).size === 3;
      if (!voicable) continue;
      // Lowest playable fret — stable across bar moves, never the fret-12 echo.
      const pos = findBarPositions(tuningMidi, deg.tonePcs, deg.tonePcs[0], POSITION_MAX_FRET)[0];
      if (!pos) continue; // this tuning can't bar it → no card at all
      const key = keyOf(pos.match);
      if (taken.has(key)) continue;
      taken.add(key);
      degrees.push({ match: pos.match, fret: pos.fret, strings: pos.strings, roman: deg.roman });
    }
  }

  // Everything else the tuning can sound, lowest fret first. The shapes
  // repeat at every fret (a bar transposes), so scanning 0..11 once finds
  // each chord name exactly once.
  const map = new Map<string, ChordCard>();
  for (let fret = 0; fret <= POSITION_MAX_FRET; fret++) {
    for (const c of chordsAtFret(tuningMidi, fret)) {
      const key = keyOf(c.match);
      if (taken.has(key) || map.has(key)) continue;
      map.set(key, { match: c.match, fret, strings: c.strings });
    }
  }

  const others = [...map.values()].sort((a, b) => {
    const ra = (a.match.rootPc - keyRootPc + 12) % 12;
    const rb = (b.match.rootPc - keyRootPc + 12) % 12;
    if (ra !== rb) return ra - rb;
    const qa = QUALITY_ORDER[a.match.quality];
    const qb = QUALITY_ORDER[b.match.quality];
    if (qa !== qb) return qa - qb;
    if (a.match.intervals.length !== b.match.intervals.length) {
      return a.match.intervals.length - b.match.intervals.length;
    }
    return a.match.suffix.localeCompare(b.match.suffix);
  });

  return { degrees, others };
}
