/**
 * Key-derivation gate.
 *
 * "The tuning is the key" only works if the derivation is trustworthy, so:
 * landmark tunings must land on the key a player would name, every tuning must
 * resolve to a usable key, and the derived scale must actually fit the open
 * strings (most of them — a couple of tunings are deliberately chromatic).
 */
import { describe, expect, test } from 'vitest';
import { deriveKey, scalePcSet } from './keyFromTuning';
import { TUNINGS, getTuning } from './tunings';
import { makeCustomTuning } from './tuningState';
import { midiPc } from './chordEngine';
import { SCALE_INTERVALS, noteToPitchClass } from './musicTheory';

const keyOf = (id: string) => {
  const t = getTuning(id);
  if (!t) throw new Error(`no tuning ${id}`);
  const k = deriveKey(t);
  return `${k.root} ${k.scale}`;
};

describe('landmark keys', () => {
  test('lap steel tunings derive from their open chord', () => {
    expect(keyOf('c6')).toBe('C Major');
    expect(keyOf('a6')).toBe('A Major');
    expect(keyOf('e7')).toBe('E Mixolydian');
    expect(keyOf('e13')).toBe('E Mixolydian');
    expect(keyOf('e9-lap')).toBe('E Mixolydian');
    expect(keyOf('b11')).toBe('B Mixolydian');
    expect(keyOf('cyrus-hybrid')).toBe('G Major');
    // The full C6/A7 stack is an altered-dominant soup; the catalog pins its
    // C6 home instead.
    expect(keyOf('c6-a7')).toBe('C Major');
  });

  test('open majors derive their major key', () => {
    expect(keyOf('open-e')).toBe('E Major');
    expect(keyOf('open-d')).toBe('D Major');
    expect(keyOf('open-g-dobro')).toBe('G Major');
    expect(keyOf('open-a-high')).toBe('A Major');
  });

  test('guitar tunings use their pinned repertoire keys', () => {
    // Standard's open strings incidentally spell G6/9 — the pinned key roots
    // it on the low E instead, where all six opens are diatonic.
    expect(keyOf('standard')).toBe('E Minor');
    expect(keyOf('dadgad')).toBe('D Mixolydian');
    expect(keyOf('drop-d')).toBe('D Major');
    expect(keyOf('drop-c')).toBe('C Minor');
    expect(keyOf('hendrix')).toBe('E♭ Minor');
  });

  test('mode necks read straight off their names', () => {
    expect(keyOf('white-keys')).toBe('C Major');
    expect(keyOf('c-lydian')).toBe('C Lydian');
    expect(keyOf('c-dorian')).toBe('C Dorian');
    expect(keyOf('c-aeolian')).toBe('C Minor');
    expect(keyOf('c-locrian')).toBe('C Locrian');
  });

  test('pedal-steel necks pin their neck key', () => {
    expect(keyOf('ps-e9-nashville')).toBe('E Major');
    expect(keyOf('ps-c6-swing-jazz')).toBe('C Major');
    expect(keyOf('ps-b6-universal')).toBe('B Major');
  });

  test('world instruments land on their conventional centers', () => {
    expect(keyOf('ukulele')).toBe('C Major');
    expect(keyOf('mandolin')).toBe('G Major');
    expect(keyOf('banjo')).toBe('G Major');
    expect(keyOf('cuatro')).toBe('D Major');
    expect(keyOf('greek-bouzouki')).toBe('D Minor');
  });

  test('a custom tuning derives live from its stack', () => {
    // A custom C6 behaves like the preset...
    const c6ish = deriveKey(makeCustomTuning([48, 52, 55, 57, 60, 64]));
    expect(`${c6ish.root} ${c6ish.scale}`).toBe('C Major');
    expect(c6ish.source).toBe('chord');
    // ...and an unnameable drone falls back to the lowest string.
    const drone = deriveKey(makeCustomTuning([40, 52, 59])); // E E B
    expect(drone.root).toBe('E');
    expect(drone.source).toBe('fallback');
  });
});

describe('every tuning resolves to a usable key', () => {
  test('root parses, scale exists, spelled notes are real', () => {
    TUNINGS.forEach((t) => {
      const k = deriveKey(t);
      expect({ id: t.id, ok: noteToPitchClass(k.root) !== null }).toEqual({ id: t.id, ok: true });
      expect({ id: t.id, ok: !!SCALE_INTERVALS[k.scale] }).toEqual({ id: t.id, ok: true });
      expect(k.notes.length).toBeGreaterThanOrEqual(5);
      expect(noteToPitchClass(k.notes[0])).toBe(k.rootPc);
      // No double accidentals ever reach the UI
      k.notes.forEach((n) => {
        expect(n.includes('𝄪')).toBe(false);
        expect(n.includes('♭♭')).toBe(false);
      });
    });
  });

  test('the derived scale fits the open strings', () => {
    // At least 60% of each tuning's distinct open pitch classes must be
    // diatonic to its key. The floor is not 100% because some tunings are
    // deliberately chromatic against their home key: the pedal-steel E9 packs
    // both D♮ and D♯ around E major, and drop-tuned metal guitars keep their
    // standard-tuned 2nd string against the minor key of the drop root.
    TUNINGS.forEach((t) => {
      const k = deriveKey(t);
      const scale = scalePcSet(k.rootPc, k.scale);
      const open = Array.from(new Set(t.midi.map(midiPc)));
      const inKey = open.filter((pc) => scale.has(pc)).length;
      expect({ id: t.id, ok: inKey / open.length >= 0.6 }).toEqual({ id: t.id, ok: true });
    });
  });

  test('the key root is always among the scale tones', () => {
    TUNINGS.forEach((t) => {
      const k = deriveKey(t);
      expect(scalePcSet(k.rootPc, k.scale).has(k.rootPc)).toBe(true);
    });
  });
});
