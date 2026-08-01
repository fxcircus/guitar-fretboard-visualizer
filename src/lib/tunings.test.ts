/**
 * Catalog gate.
 *
 * The tuning catalog is generated data, so these tests are the encoding
 * contract: every stack has to be internally consistent, uniquely named, and
 * playable by the engine. A failure here means the generator (or a hand edit)
 * introduced a typo.
 */
import { describe, expect, test } from 'vitest';
import {
  CUSTOM_TUNING_ID,
  DEFAULT_TUNING_ID,
  GROUP_LABELS,
  GROUP_ORDER,
  MAX_STRINGS,
  MIN_STRINGS,
  TUNINGS,
  getTuning,
} from './tunings';
import { chordsAtFret, midiPc } from './chordEngine';
import { applyPulls, makeCustomTuning, normalizePulls, resolveTuning } from './tuningState';
import { COPEDENTS, PEDAL_STEEL_ROOTS, combinePulls, pullsForControl } from './copedents';
import { noteToPitchClass } from './musicTheory';

describe('catalog integrity', () => {
  test('ids are unique', () => {
    const ids = TUNINGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('names are unique', () => {
    const names = TUNINGS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('every tuning has 3–10 strings with matching spellings', () => {
    TUNINGS.forEach((t) => {
      expect(t.midi.length).toBeGreaterThanOrEqual(MIN_STRINGS);
      expect(t.midi.length).toBeLessThanOrEqual(MAX_STRINGS);
      expect(t.spellings).toHaveLength(t.midi.length);
    });
  });

  test('every spelling matches its MIDI pitch class', () => {
    TUNINGS.forEach((t) => {
      t.spellings.forEach((name, i) => {
        expect({ id: t.id, i, pc: noteToPitchClass(name) }).toEqual({
          id: t.id,
          i,
          pc: midiPc(t.midi[i]),
        });
      });
    });
  });

  test('every pitch is inside a real instrument range', () => {
    TUNINGS.forEach((t) => {
      t.midi.forEach((m) => {
        expect(m).toBeGreaterThanOrEqual(28); // E1
        expect(m).toBeLessThanOrEqual(96); // C7
      });
    });
  });

  test('`reentrant` is set exactly when the stack does not ascend', () => {
    TUNINGS.forEach((t) => {
      const ascends = t.midi.every((m, i) => i === 0 || m >= t.midi[i - 1]);
      expect({ id: t.id, reentrant: !!t.reentrant }).toEqual({ id: t.id, reentrant: !ascends });
    });
  });

  test('every group in the catalog is in GROUP_ORDER and labelled', () => {
    const groups = new Set(TUNINGS.map((t) => t.group));
    groups.forEach((g) => {
      expect(GROUP_ORDER).toContain(g);
      expect(GROUP_LABELS[g]).toBeTruthy();
    });
    // and every declared group is actually populated
    GROUP_ORDER.forEach((g) => expect(groups.has(g)).toBe(true));
  });

  test('exactly the expected tunings are chordless', () => {
    // A handful of tunings name no chord on any adjacent string group, and for
    // each that IS the tuning:
    //   · six of the eight modal necks are scale ladders — six consecutive
    //     scale steps, so no adjacent group ever stacks into a chord. (Lydian
    //     and Dorian are the exceptions: their full stacks happen to spell D11
    //     and F13.) These necks exist for Map view.
    //   · Sonic Youth's Schizophrenia is an F♯ G A cluster matching no formula
    //   · Soundgarden's My Wave and the balalaika have only two pitch classes,
    //     and a chord needs three
    //   · Radiohead's "Everything In Its Right Place" is C G G♯ — a pedal rub
    // Anything joining or leaving this list means the data or engine changed.
    const chordless = TUNINGS.filter(
      (t) => Array.from({ length: 12 }, (_, f) => chordsAtFret(t.midi, f)).flat().length === 0
    ).map((t) => t.id);
    expect(chordless.sort()).toEqual(
      [
        'white-keys',
        'c-ionian',
        'c-mixolydian',
        'c-aeolian',
        'c-phrygian',
        'c-locrian',
        'schizophrenia',
        'soundg-wave',
        'radio-everything',
        'balalaika',
      ].sort()
    );
  });

  test('no chord name is listed twice at one fret', () => {
    TUNINGS.forEach((t) => {
      const labels = chordsAtFret(t.midi, 0).map((c) => `${c.match.rootPc}${c.match.suffix}`);
      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  test('the default tuning resolves', () => {
    expect(getTuning(DEFAULT_TUNING_ID)).toBeDefined();
    expect(getTuning(CUSTOM_TUNING_ID)).toBeUndefined();
  });

  test('every pedal-steel neck declares a copedent and a root', () => {
    TUNINGS.filter((t) => t.group === 'pedal-steel').forEach((t) => {
      expect(t.copedent).toBeTruthy();
      expect(PEDAL_STEEL_ROOTS[t.id]).toBeTypeOf('number');
      expect(t.midi).toHaveLength(10);
    });
  });

  test('the imported catalog is complete', () => {
    // 9 lap steel + 5 open + 6 common + 6 drop + 16 artist + 8 modal
    // + 13 world + 4 pedal steel
    expect(TUNINGS).toHaveLength(67);
    const counts: Record<string, number> = {};
    TUNINGS.forEach((t) => (counts[t.group] = (counts[t.group] ?? 0) + 1));
    expect(counts).toEqual({
      'lap-steel': 9,
      open: 5,
      common: 6,
      drop: 6,
      artist: 16,
      mode: 8,
      world: 13,
      'pedal-steel': 4,
    });
  });

  test('a few landmark stacks are exactly right', () => {
    // Spot checks against the outside sources, so a bad regeneration is loud.
    expect(getTuning('c6')!.midi).toEqual([48, 52, 55, 57, 60, 64]); // C3 E3 G3 A3 C4 E4
    expect(getTuning('standard')!.midi).toEqual([40, 45, 50, 55, 59, 64]); // E2 A2 D3 G3 B3 E4
    expect(getTuning('dadgad')!.midi).toEqual([38, 45, 50, 55, 57, 62]);
    expect(getTuning('drop-d')!.midi).toEqual([38, 45, 50, 55, 59, 64]);
    expect(getTuning('fripp-nst')!.midi).toEqual([36, 43, 50, 57, 64, 67]); // all fifths + m3
    expect(getTuning('ukulele')!.midi).toEqual([67, 60, 64, 69]); // re-entrant high G
    // E9 is re-entrant: chromatic strings 2 and 1 (D♯4, F♯4) sit below
    // string 3's G♯4 — the famous "strings out of pitch order" of pedal steel.
    expect(getTuning('ps-e9-nashville')!.midi).toEqual([47, 50, 52, 54, 56, 59, 64, 68, 63, 66]);
    expect(getTuning('ps-e9-nashville')!.reentrant).toBe(true);
  });

  test('standard tuning is the guitar it claims to be', () => {
    const std = getTuning('standard')!;
    expect(std.spellings).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    // consecutive fourths except the G→B major third
    const gaps = std.midi.slice(1).map((m, i) => m - std.midi[i]);
    expect(gaps).toEqual([5, 5, 5, 4, 5]);
  });
});

describe('tuning state', () => {
  test('resolveTuning falls back to the default for unknown ids', () => {
    expect(resolveTuning('nope').id).toBe(DEFAULT_TUNING_ID);
    expect(resolveTuning(CUSTOM_TUNING_ID, [48, 52, 55]).name).toBe('Custom');
  });

  test('makeCustomTuning clamps into range and keeps the string count', () => {
    const t = makeCustomTuning([10, 200, 60, 61]);
    expect(t.midi).toHaveLength(4);
    expect(Math.min(...t.midi)).toBeGreaterThanOrEqual(28);
    expect(Math.max(...t.midi)).toBeLessThanOrEqual(96);
    expect(t.id).toBe(CUSTOM_TUNING_ID);
  });

  test('applyPulls is a no-op when no string is pulled', () => {
    const c6 = getTuning('c6')!;
    const { tuning, pulled } = applyPulls(c6, [0, 0, 0, 0, 0, 0]);
    expect(tuning).toBe(c6);
    expect(pulled.every((p) => p === false)).toBe(true);
    expect(applyPulls(c6, undefined).tuning).toBe(c6);
  });

  test('applyPulls raises the chosen string and respells only that one', () => {
    const c6 = getTuning('c6')!; // C E G A C E
    const { tuning, pulled } = applyPulls(c6, [0, 0, 0, 2, 0, 0]); // A → B
    expect(tuning.midi[3]).toBe(c6.midi[3] + 2);
    expect(tuning.spellings[3]).toBe('B');
    expect(tuning.spellings[0]).toBe('C'); // untouched strings keep their spelling
    expect(pulled).toEqual([false, false, false, true, false, false]);
  });

  test('normalizePulls sizes and clamps', () => {
    expect(normalizePulls([9, -9, 1], 4)).toEqual([4, -4, 1, 0]);
    expect(normalizePulls(undefined, 3)).toEqual([0, 0, 0]);
  });
});

describe('copedents', () => {
  test('E9 pedal A raises both B strings a whole step', () => {
    const e9 = getTuning('ps-e9-nashville')!;
    const A = COPEDENTS.e9.controls.find((c) => c.id === 'A')!;
    const pulls = pullsForControl(e9.midi, PEDAL_STEEL_ROOTS[e9.id], A);
    // strings 5 and 10 — the two B's, at indices 0 and 5
    expect(pulls).toEqual([2, 0, 0, 0, 0, 2, 0, 0, 0, 0]);
    const { tuning } = applyPulls(e9, pulls);
    expect(tuning.spellings[0]).toBe('C♯');
    expect(tuning.spellings[5]).toBe('C♯');
  });

  test('E9 pedal B raises both G♯ strings a half step', () => {
    const e9 = getTuning('ps-e9-nashville')!;
    const B = COPEDENTS.e9.controls.find((c) => c.id === 'B')!;
    const pulls = pullsForControl(e9.midi, 4, B);
    // strings 3 and 6 — the two G♯'s, at indices 4 and 7
    expect(pulls).toEqual([0, 0, 0, 0, 1, 0, 0, 1, 0, 0]);
  });

  test('A + B is the I → IV cry', () => {
    const e9 = getTuning('ps-e9-nashville')!;
    const AB = COPEDENTS.e9.controls.find((c) => c.id === 'AB')!;
    const { tuning } = applyPulls(e9, pullsForControl(e9.midi, 4, AB));
    // E B G♯ (an E triad) becomes E C♯ A — an A/E, the IV chord
    const pcs = new Set(tuning.midi.map(midiPc));
    expect(pcs.has(9)).toBe(true); // A
    expect(pcs.has(1)).toBe(true); // C♯
    expect(pcs.has(4)).toBe(true); // E
    expect(pcs.has(8)).toBe(false); // no G♯ left
  });

  test('LKL and LKR move the root in opposite directions', () => {
    const e9 = getTuning('ps-e9-nashville')!;
    const lkl = COPEDENTS.e9.controls.find((c) => c.id === 'LKL')!;
    const lkr = COPEDENTS.e9.controls.find((c) => c.id === 'LKR')!;
    const up = pullsForControl(e9.midi, 4, lkl);
    const down = pullsForControl(e9.midi, 4, lkr);
    expect(up).toEqual(down.map((v) => (v === 0 ? 0 : -v)));
    expect(up.filter(Boolean)).toHaveLength(2); // the two E strings
  });

  test('the generic copedent turns a major tuning minor', () => {
    const openE = getTuning('open-e')!; // E B E G♯ B E
    const minor = COPEDENTS.generic.controls.find((c) => c.id === 'LKL')!;
    const { tuning } = applyPulls(openE, pullsForControl(openE.midi, 4, minor));
    expect(new Set(tuning.midi.map(midiPc))).toEqual(new Set([4, 11, 7])); // E B G = Em
  });

  test('combinePulls merges engaged controls', () => {
    const e9 = getTuning('ps-e9-nashville')!;
    const a = pullsForControl(e9.midi, 4, COPEDENTS.e9.controls.find((c) => c.id === 'A')!);
    const b = pullsForControl(e9.midi, 4, COPEDENTS.e9.controls.find((c) => c.id === 'B')!);
    const both = combinePulls(e9.midi, [a, b]);
    expect(both).toEqual([2, 0, 0, 0, 1, 2, 0, 1, 0, 0]);
  });

  test('every control in every copedent produces a legal pull array', () => {
    const c6 = getTuning('c6')!;
    Object.values(COPEDENTS).forEach((set) => {
      set.controls.forEach((c) => {
        const pulls = pullsForControl(c6.midi, 0, c);
        expect(pulls).toHaveLength(c6.midi.length);
        pulls.forEach((p) => {
          expect(p).toBeGreaterThanOrEqual(-4);
          expect(p).toBeLessThanOrEqual(4);
        });
      });
    });
  });
});
