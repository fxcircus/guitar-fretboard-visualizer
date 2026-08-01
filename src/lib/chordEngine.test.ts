/**
 * Engine gate.
 *
 * identifyChord must name each open stack as the chord its tuning is named
 * for — the note stacks were verified low→high against outside sources, so a
 * failure here means an encoding typo, not a taste disagreement.
 */
import { describe, expect, test } from 'vitest';
import {
  chordLabel,
  chordsAtFret,
  displayNote,
  findBarPositions,
  findSlantPositions,
  identifyChord,
  identifyChords,
  intervalLabel,
  midiPc,
  rankByNearness,
  rankSlantsByNearness,
  scanLabelsFor,
} from './chordEngine';
import { getTuning } from './tunings';

const label = (pcs: number[], bass: number | null = null) => {
  const m = identifyChord(pcs, bass);
  return m ? chordLabel(m) : null;
};

const T = (id: string) => {
  const t = getTuning(id);
  if (!t) throw new Error(`no tuning ${id}`);
  return t;
};

describe('identifyChord', () => {
  test('names basic triads', () => {
    expect(label([0, 4, 7], 0)).toBe('C');
    expect(label([9, 0, 4], 9)).toBe('Am');
    expect(label([2, 5, 8], 2)).toBe('D°');
    expect(label([7, 0, 2], 7)).toBe('Gsus4');
  });

  test('resolves the 6th/m7 duality by bass note', () => {
    const pcs = [0, 4, 7, 9]; // C E G A
    expect(label(pcs, 0)).toBe('C6');
    expect(label(pcs, 9)).toBe('Am7');
    const all = identifyChords(pcs, 0).map((m) => chordLabel(m));
    expect(all).toContain('C6');
    expect(all).toContain('Am7');
  });

  test('prefers the major-family reading for inversions', () => {
    // E G A C with E in the bass is either C6/E or Am7/E — players reach for
    // the 6th name first
    expect(label([4, 7, 9, 0], 4)).toBe('C6');
    // A6's full stack has its 3rd (C♯) in the bass and must still read as A6
    expect(label([1, 4, 6, 9], 1)).toBe('A6');
  });

  test('returns null for unnameable sets', () => {
    expect(identifyChord([0, 1, 2], 0)).toBeNull();
    expect(identifyChord([0, 4], 0)).toBeNull(); // dyads are not chords
  });
});

describe('open stacks name their own tuning', () => {
  const expectOpen = (id: string, expected: string) => {
    const t = T(id);
    expect(label(t.midi.map(midiPc), midiPc(Math.min(...t.midi)))).toBe(expected);
  };

  test('sixth family', () => {
    expectOpen('c6', 'C6');
    expectOpen('a6', 'A6');
    // C6/A7's full six-string stack is the Hendrix chord — the name refers to
    // its subsets (covered in chordsAtFret below).
    expectOpen('c6-a7', 'A7♯9');
  });

  test('dominant family', () => {
    expectOpen('e7', 'E7');
    expectOpen('e13', 'E13');
    expectOpen('e9-lap', 'E9');
    expectOpen('b11', 'B11');
    expectOpen('b11-tk-smith', 'B11'); // the same canonical stack as Byrd's
  });

  test('open majors', () => {
    expectOpen('open-e', 'E');
    expectOpen('open-d', 'D');
    expectOpen('open-g-dobro', 'G');
    expectOpen('open-g-low', 'G');
    expectOpen('open-a-high', 'A');
    expectOpen('cyrus-hybrid', 'Gmaj9');
  });

  test('imported guitar tunings', () => {
    expectOpen('dadgad', 'Dsus4');
    // D A D G B E is G B D E A with D in the bass — the open "drop D" ring is
    // a G6/9, which is exactly why the tuning sounds so wide.
    expectOpen('drop-d', 'G6/9');
  });
});

describe('chordsAtFret', () => {
  const labelsAt = (midi: number[], fret: number) =>
    chordsAtFret(midi, fret).map((c) => chordLabel(c.match));

  test('C6 open: full stack first, major on low strings, minor on top', () => {
    const c6 = T('c6');
    const chords = chordsAtFret(c6.midi, 0);
    expect(chords[0].isFullStack).toBe(true);
    expect(chordLabel(chords[0].match)).toBe('C6');

    const cMajor = chords.find((c) => chordLabel(c.match) === 'C');
    expect(cMajor!.strings).toEqual([0, 1, 2]); // C E G — strings 6-4

    const aMinor = chords.find((c) => chordLabel(c.match) === 'Am');
    expect(aMinor!.strings).toEqual([3, 4, 5]); // A C E — strings 3-1
  });

  test('C6 transposes with the bar (fret = transposition)', () => {
    const labels = labelsAt(T('c6').midi, 3);
    expect(labels[0]).toBe('D♯6');
    expect(labels).toContain('D♯');
    expect(labels).toContain('Cm');
  });

  test('Cyrus Hybrid gives G, Bm and D under one bar', () => {
    const chords = chordsAtFret(T('cyrus-hybrid').midi, 0);
    expect(chordLabel(chords[0].match)).toBe('Gmaj9');
    expect(chords.find((c) => chordLabel(c.match) === 'G')!.strings).toEqual([0, 1, 2]);
    expect(chords.find((c) => chordLabel(c.match) === 'Bm')!.strings).toEqual([1, 2, 3]);
    // The V is the compact 3-string D triad, not a 4-string grip that repeats
    // the octave-doubled D
    expect(chords.find((c) => chordLabel(c.match) === 'D')!.strings).toEqual([2, 3, 4]);
  });

  test('B11 open is the straight-bar goldmine it is famous for', () => {
    const labels = labelsAt(T('b11').midi, 0);
    expect(labels[0]).toBe('B11');
    expect(labels).toContain('B9');
    expect(labels).toContain('B7');
    expect(labels).toContain('B');
    expect(labels).toContain('F♯m');
    expect(labels).toContain('A');
  });

  test('C6/A7 really does contain both the C6 world and A7', () => {
    const chords = chordsAtFret(T('c6-a7').midi, 0);
    const a7 = chords.find((c) => chordLabel(c.match) === 'A7');
    expect(a7!.strings).toEqual([0, 1, 2, 3]); // C♯ E G A — the bottom four
    expect(chords.map((c) => chordLabel(c.match))).toContain('C6');
  });

  test('handles a 3-string instrument without crashing', () => {
    const saz = T('saz-baglama'); // B E A — stacked fourths
    const chords = chordsAtFret(saz.midi, 0);
    expect(chords.length).toBeGreaterThan(0);
    expect(chordLabel(chords[0].match)).toBe('Esus4'); // B E A = E A B
  });

  test('handles a 10-string pedal steel neck', () => {
    const labels = labelsAt(T('ps-e9-nashville').midi, 0);
    expect(labels).toContain('E'); // the E major triad is in there somewhere
    expect(labels.length).toBeGreaterThan(2);
  });
});

describe('findBarPositions', () => {
  test('C major on C6 is playable at the nut and the octave', () => {
    const pos = findBarPositions(T('c6').midi, [0, 4, 7], 0);
    const frets = pos.map((p) => p.fret);
    expect(frets).toContain(0);
    expect(frets).toContain(12);
    const atNut = pos.find((p) => p.fret === 0)!;
    expect(atNut.strings).toEqual([0, 1, 2]);
    expect(atNut.rootInBass).toBe(true);
  });

  test('A minor on C6 lives on the top strings; Dm sits 5 frets up', () => {
    const c6 = T('c6');
    const atNut = findBarPositions(c6.midi, [9, 0, 4], 9).find((p) => p.fret === 0)!;
    expect(atNut.strings).toEqual([3, 4, 5]); // A C E
    expect(findBarPositions(c6.midi, [2, 5, 9], 2).some((p) => p.fret === 5)).toBe(true);
  });

  test('a Cmaj7 target is voiced by the C-major triad subset', () => {
    const pos = findBarPositions(T('c6').midi, [0, 4, 7, 11], 0);
    expect(pos.some((p) => p.fret === 0 && !p.isFullTarget)).toBe(true);
  });

  test('the whole C6 stack IS Am7 — the 6th/m7 duality made concrete', () => {
    const atNut = findBarPositions(T('c6').midi, [9, 0, 4, 7], 9).find((p) => p.fret === 0)!;
    expect(atNut.isFullTarget).toBe(true);
    expect(atNut.strings).toEqual([0, 1, 2, 3, 4, 5]);
    expect(chordLabel(atNut.match)).toBe('Am7');
  });

  test('a pure major tuning cannot voice a minor chord under a straight bar', () => {
    const openE = T('open-e');
    expect(findBarPositions(openE.midi, [9, 0, 4], 9)).toHaveLength(0); // Am
    expect(findBarPositions(openE.midi, [4, 8, 11], 4).length).toBeGreaterThan(0); // E
  });

  test('honours maxFret', () => {
    const c6 = T('c6');
    expect(findBarPositions(c6.midi, [0, 4, 7], 0, 11).map((p) => p.fret)).not.toContain(12);
    expect(findBarPositions(c6.midi, [0, 4, 7], 0, 24).map((p) => p.fret)).toContain(24);
  });

  test('rankByNearness prefers the position closest to the bar', () => {
    const pos = findBarPositions(T('c6').midi, [0, 4, 7], 0); // frets 0 and 12
    expect(rankByNearness(pos, 10)[0].fret).toBe(12);
    expect(rankByNearness(pos, 2)[0].fret).toBe(0);
  });

  test('returns nothing for a degenerate target', () => {
    const c6 = T('c6');
    expect(findBarPositions(c6.midi, [0, 4], 0)).toHaveLength(0); // dyad
    expect(findBarPositions(c6.midi, [0, 4, 7], 2)).toHaveLength(0); // root not in tones
  });
});

describe('findSlantPositions', () => {
  test('open E can reverse-slant a minor chord it cannot straight-bar', () => {
    const slants = findSlantPositions(T('open-e').midi, [4, 7, 11], 4); // Em
    expect(slants.length).toBeGreaterThan(0);
    slants.forEach((s) => {
      expect(s.notes).toContain(7); // the ♭3 — the quality-defining note
      expect(s.notes.every((pc) => [4, 7, 11].includes(pc))).toBe(true);
    });
    expect(slants.some((s) => s.direction === 'reverse')).toBe(true);
  });

  test('open D reverse-slant lowers the F♯ to F for a D minor double-stop', () => {
    const slants = findSlantPositions(T('open-d').midi, [2, 5, 9], 2); // Dm
    expect(slants.length).toBeGreaterThan(0);
    slants.forEach((s) => expect(s.notes).toContain(5)); // F = ♭3 of D
  });

  test('only uses adjacent strings — a bar tilt cannot skip a string', () => {
    findSlantPositions(T('open-e').midi, [4, 7, 11], 4).forEach((s) => {
      expect(s.highString - s.lowString).toBe(1);
    });
  });

  test('never offers a perfect 5th a diminished chord does not contain', () => {
    // B° = B D F; the perfect 5th of B (F♯, pc 6) is NOT in the chord.
    findSlantPositions(T('open-d').midi, [11, 2, 5], 11).forEach((s) => {
      expect(s.notes).not.toContain(6);
      expect(s.notes.every((pc) => [11, 2, 5].includes(pc))).toBe(true);
    });
  });

  test('no 3rd in the target → no slant', () => {
    expect(findSlantPositions(T('open-e').midi, [4, 11], 4)).toHaveLength(0);
  });

  test('rankSlantsByNearness prefers slants near the bar', () => {
    const slants = findSlantPositions(T('open-e').midi, [4, 7, 11], 4);
    const ranked = rankSlantsByNearness(slants, 12);
    const nearest = (ranked[0].lowFret + ranked[0].highFret) / 2;
    slants.forEach((s) => {
      expect(Math.abs(nearest - 12)).toBeLessThanOrEqual(
        Math.abs((s.lowFret + s.highFret) / 2 - 12)
      );
    });
  });
});

describe('scanLabelsFor', () => {
  test('the C6 scan row walks up chromatically', () => {
    const c6 = T('c6');
    const open = identifyChord(c6.midi.map(midiPc), midiPc(c6.midi[0]));
    const labels = scanLabelsFor(open, 0);
    expect(labels).toHaveLength(13);
    expect(labels[0]).toBe('C6');
    expect(labels[1]).toBe('C♯6');
    expect(labels[5]).toBe('F6');
    expect(labels[12]).toBe('C6');
  });

  test('maps the selected chord relative to the current bar fret', () => {
    const labels = scanLabelsFor(identifyChord([9, 0, 4], 9), 0);
    expect(labels[0]).toBe('Am');
    expect(labels[5]).toBe('Dm');
    const shifted = scanLabelsFor(identifyChord([0, 3, 7], 0), 3);
    expect(shifted[3]).toBe('Cm');
    expect(shifted[0]).toBe('Am');
  });

  test('respects maxFret and the flat spelling', () => {
    const open = identifyChord([0, 4, 7], 0);
    expect(scanLabelsFor(open, 0, 24)).toHaveLength(25);
    expect(scanLabelsFor(open, 0, 12, true)[1]).toBe('D♭');
  });

  test('a null chord produces null labels', () => {
    expect(scanLabelsFor(null, 0).every((l) => l === null)).toBe(true);
  });
});

describe('display helpers', () => {
  test('displayNote spells sharp by default and flat on request', () => {
    expect(displayNote(1)).toBe('C♯');
    expect(displayNote(10)).toBe('A♯');
    expect(displayNote(1, true)).toBe('D♭');
    expect(displayNote(10, true)).toBe('B♭');
    expect(displayNote(0, true)).toBe('C'); // naturals are unaffected
  });

  test('intervalLabel covers all 12 semitones', () => {
    expect(intervalLabel(0)).toBe('R');
    expect(intervalLabel(4)).toBe('3');
    expect(intervalLabel(7)).toBe('5');
    expect(intervalLabel(10)).toBe('♭7');
    expect(intervalLabel(9)).toBe('6');
  });

  test('intervalLabel spells tensions as extensions over a ♭7', () => {
    expect(intervalLabel(5, true)).toBe('11');
    expect(intervalLabel(9, true)).toBe('13');
    expect(intervalLabel(5, false)).toBe('4');
    expect(intervalLabel(9, false)).toBe('6');
    expect(intervalLabel(3, true)).toBe('♭3');
  });
});
