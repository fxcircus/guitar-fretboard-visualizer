/**
 * Copedents — the pedal and knee-lever sets that reshape a steel tuning while
 * you hold them.
 *
 * A control is described the way a steel mechanic describes it: by which
 * CHORD DEGREE it moves and by how much. "Pedal A raises the 5th a whole
 * step" then resolves to actual strings by finding every string carrying that
 * degree — which is why the same pedal set works on E9 (raising both B
 * strings) and, transposed, on any other tuning.
 *
 * The result is a per-string semitone array, i.e. exactly the app's `pulls` —
 * so a copedent button and a hand-dialled behind-the-bar bend are the same
 * mechanism, and can be edited into each other.
 *
 * Adapted from the VG-800 tuner's copedent tables
 * (github.com/fxcircus/vg800_midi_control).
 */
import { midiPc } from './chordEngine';

export type CopedentId = 'generic' | 'e9' | 'c6';

export interface CopedentMove {
  /** Chord degree the control moves: 1 = root, 3 = third, 5 = fifth. */
  degree: 1 | 3 | 5;
  semis: number;
}

export interface CopedentControl {
  id: string;
  name: string;
  kind: 'pedal' | 'knee' | 'combo';
  /** What it does, in a player's words. */
  action: string;
  moves: CopedentMove[];
}

export interface Copedent {
  label: string;
  blurb: string;
  controls: CopedentControl[];
}

export const COPEDENTS: Record<CopedentId, Copedent> = {
  // Named for what they DO — a "virtual copedent" any open tuning can borrow.
  generic: {
    label: 'Virtual pedals',
    blurb:
      'Not a real copedent — the classic pedal moves applied to whatever chord the bar is currently sounding, so any lap steel tuning can be tried "with pedals".',
    controls: [
      { id: 'A', name: 'Sixth', kind: 'pedal', action: '5th up a whole step', moves: [{ degree: 5, semis: 2 }] },
      { id: 'B', name: 'Sus 4', kind: 'pedal', action: '3rd up a half step', moves: [{ degree: 3, semis: 1 }] },
      { id: 'LKL', name: 'Minor', kind: 'knee', action: '3rd down a half step', moves: [{ degree: 3, semis: -1 }] },
      { id: 'LKR', name: 'Maj 7', kind: 'knee', action: 'root down a half step', moves: [{ degree: 1, semis: -1 }] },
      {
        id: 'AB', name: 'IV chord', kind: 'combo', action: 'the I → IV cry (A + B)',
        moves: [{ degree: 5, semis: 2 }, { degree: 3, semis: 1 }],
      },
      {
        id: 'AL', name: 'Minor 6', kind: 'combo', action: 'the m6 grip (A + minor lever)',
        moves: [{ degree: 5, semis: 2 }, { degree: 3, semis: -1 }],
      },
    ],
  },

  // The standard Emmons E9 setup.
  e9: {
    label: 'E9 copedent',
    blurb:
      'The standard Emmons E9 setup — pedals A/B/C under the right foot, LKL/LKR/vertical at the left knee. This is the crying country sound.',
    controls: [
      { id: 'A', name: 'Pedal A', kind: 'pedal', action: '5th up a whole step (B → C♯)', moves: [{ degree: 5, semis: 2 }] },
      { id: 'B', name: 'Pedal B', kind: 'pedal', action: '3rd up a half step (G♯ → A)', moves: [{ degree: 3, semis: 1 }] },
      {
        id: 'C', name: 'Pedal C', kind: 'pedal', action: '5th and root up a whole step',
        moves: [{ degree: 5, semis: 2 }, { degree: 1, semis: 2 }],
      },
      { id: 'LKL', name: 'LKL', kind: 'knee', action: 'root up a half step (E → F)', moves: [{ degree: 1, semis: 1 }] },
      { id: 'LKR', name: 'LKR', kind: 'knee', action: 'root down a half step — maj7 (E → D♯)', moves: [{ degree: 1, semis: -1 }] },
      { id: 'VERT', name: 'Vertical', kind: 'knee', action: '5th down a half step (B → B♭)', moves: [{ degree: 5, semis: -1 }] },
      {
        id: 'AB', name: 'A + B', kind: 'combo', action: 'the I → IV cry',
        moves: [{ degree: 5, semis: 2 }, { degree: 3, semis: 1 }],
      },
      {
        id: 'BC', name: 'B + C', kind: 'combo', action: 'the ii chord',
        moves: [{ degree: 3, semis: 1 }, { degree: 5, semis: 2 }, { degree: 1, semis: 2 }],
      },
    ],
  },

  // The C6 (back neck) mechanism — a different set entirely.
  c6: {
    label: 'C6 copedent',
    blurb:
      'The back-neck C6 mechanism — western swing and jazz. Different pedals from E9: the 9th, the "boo-wah", and the minor lever.',
    controls: [
      { id: 'P5', name: 'P5', kind: 'pedal', action: '5th down a half step — the 9th', moves: [{ degree: 5, semis: -1 }] },
      { id: 'P6', name: 'P6', kind: 'pedal', action: 'root up a half step', moves: [{ degree: 1, semis: 1 }] },
      { id: 'P8', name: 'Boo-wah', kind: 'pedal', action: 'root down a minor 3rd — into the 6th', moves: [{ degree: 1, semis: -3 }] },
      { id: 'LWR', name: 'Min 3rd', kind: 'knee', action: '3rd down a half step — minor', moves: [{ degree: 3, semis: -1 }] },
      {
        id: 'DIM', name: 'P5 + LWR', kind: 'combo', action: 'diminished',
        moves: [{ degree: 5, semis: -1 }, { degree: 3, semis: -1 }],
      },
    ],
  },
};

/** Root pitch class of each pedal-steel neck (its copedent's home chord). */
export const PEDAL_STEEL_ROOTS: Record<string, number> = {
  'ps-e9-nashville': 4, // E
  'ps-e9-lanois': 4, // E
  'ps-c6-swing-jazz': 0, // C
  'ps-b6-universal': 11, // B
};

const DEGREE_SEMIS: Record<1 | 3 | 5, number[]> = {
  // Both thirds and both fifths count, so a minor or altered tuning still
  // finds "the third" / "the fifth" of its home chord.
  1: [0],
  3: [3, 4],
  5: [6, 7, 8],
};

/**
 * Resolve a control into a per-string semitone array for this tuning.
 *
 * Every string whose open pitch class sits at one of the degree's intervals
 * above `rootPc` moves — that is literally how the rods are hooked up.
 */
export function pullsForControl(
  tuningMidi: number[],
  rootPc: number,
  control: CopedentControl
): number[] {
  const pulls = tuningMidi.map(() => 0);
  const root = ((rootPc % 12) + 12) % 12;
  for (const move of control.moves) {
    const wanted = new Set(DEGREE_SEMIS[move.degree].map((iv) => (root + iv) % 12));
    tuningMidi.forEach((m, i) => {
      if (wanted.has(midiPc(m))) pulls[i] = move.semis;
    });
  }
  return pulls;
}

/** Merge several engaged controls into one pulls array (later wins per string). */
export function combinePulls(tuningMidi: number[], arrays: number[][]): number[] {
  const out = tuningMidi.map(() => 0);
  for (const arr of arrays) {
    arr.forEach((v, i) => {
      if (v) out[i] = v;
    });
  }
  return out;
}

/** Which copedent a tuning should offer, and the root its degrees hang off. */
export function copedentFor(
  tuningId: string,
  declared: 'e9' | 'c6' | undefined,
  fallbackRootPc: number
): { id: CopedentId; rootPc: number } {
  if (declared) {
    return { id: declared, rootPc: PEDAL_STEEL_ROOTS[tuningId] ?? fallbackRootPc };
  }
  return { id: 'generic', rootPc: fallbackRootPc };
}
