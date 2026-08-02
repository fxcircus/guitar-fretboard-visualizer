/**
 * Turning the app's persisted state (a tuning id + optional custom stack +
 * per-string pulls) into the effective tuning everything else reads.
 */
import {
  CUSTOM_MIDI_MAX,
  CUSTOM_MIDI_MIN,
  CUSTOM_TUNING_ID,
  DEFAULT_TUNING_ID,
  getTuning,
  type Tuning,
} from './tunings';
import { displayNote, midiPc } from './chordEngine';

/**
 * Behind-the-bar pulls (a string bend, or a pedal-steel pedal/lever).
 * ±12: the VG-800's per-string benders go a full octave (B-Bender presets,
 * Nashville's octave drops), and the embedded board mirrors them.
 */
export const PULL_MIN = -12;
export const PULL_MAX = 12;

export function getDefaultTuning(): Tuning {
  return getTuning(DEFAULT_TUNING_ID)!;
}

/** Build a Tuning from a user-edited MIDI stack. */
export function makeCustomTuning(midi: number[], preferFlats = false): Tuning {
  const clamped = midi.map((m) =>
    Math.min(CUSTOM_MIDI_MAX, Math.max(CUSTOM_MIDI_MIN, Math.round(m)))
  );
  return {
    id: CUSTOM_TUNING_ID,
    name: 'Custom',
    group: 'lap-steel',
    midi: clamped,
    spellings: clamped.map((m) => displayNote(midiPc(m), preferFlats)),
    description: 'Your own stack — tune each string and see what the bar gives you.',
    preferFlats: preferFlats || undefined,
  };
}

/** Resolve the tuning for the app's persisted state. */
export function resolveTuning(tuningId: string, customTuning?: number[]): Tuning {
  if (tuningId === CUSTOM_TUNING_ID) {
    return makeCustomTuning(customTuning ?? [...getDefaultTuning().midi]);
  }
  return getTuning(tuningId) ?? getDefaultTuning();
}

/**
 * Apply per-string pulls to a base tuning, returning the reshaped tuning plus
 * a per-string "is pulled" flag. Pulled strings are respelled from their new
 * pitch; unpulled strings keep the catalog's curated spelling. Everything
 * downstream (chord ID, positions, audio) then works off the pulled tuning.
 */
export function applyPulls(
  base: Tuning,
  pulls?: number[]
): { tuning: Tuning; pulled: boolean[] } {
  const none = base.midi.map(() => false);
  if (!pulls || pulls.every((p) => !p)) return { tuning: base, pulled: none };
  const midi = base.midi.map((m, i) => m + (pulls[i] || 0));
  const spellings = midi.map((m, i) =>
    pulls[i] ? displayNote(midiPc(m), !!base.preferFlats) : base.spellings[i]
  );
  return {
    tuning: { ...base, midi, spellings },
    pulled: base.midi.map((_, i) => !!(pulls[i] || 0)),
  };
}

/** A pulls array sized to a tuning, clamped to the legal range. */
export function normalizePulls(pulls: number[] | undefined, stringCount: number): number[] {
  const out = Array<number>(stringCount).fill(0);
  if (!pulls) return out;
  for (let i = 0; i < stringCount; i++) {
    out[i] = Math.min(PULL_MAX, Math.max(PULL_MIN, Math.round(pulls[i] || 0)));
  }
  return out;
}
