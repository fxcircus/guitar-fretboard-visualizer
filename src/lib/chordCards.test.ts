/**
 * Card-surface gate — "make sure this works for every single tuning".
 *
 * Every card must be a chord the tuning genuinely voices at its stated fret,
 * every fret must be canonical (0..11, never the fret-12 echo of fret 0),
 * and no chord may appear twice across degrees + others.
 */
import { describe, expect, test } from 'vitest';
import { POSITION_MAX_FRET, collectChordCards, type ChordCards } from './chordCards';
import { chordLabel, chordsAtFret, midiPc } from './chordEngine';
import { deriveKey } from './keyFromTuning';
import { TUNINGS, getTuning } from './tunings';

const cardsFor = (id: string): ChordCards => {
  const t = getTuning(id);
  if (!t) throw new Error(`no tuning ${id}`);
  const k = deriveKey(t);
  return collectChordCards(t.midi, k.notes, k.rootPc);
};

describe('every tuning', () => {
  test('no chord appears twice across degrees and others', () => {
    TUNINGS.forEach((t) => {
      const k = deriveKey(t);
      const { degrees, others } = collectChordCards(t.midi, k.notes, k.rootPc);
      const keys = [...degrees, ...others].map((c) => `${c.match.rootPc}:${c.match.suffix}`);
      expect({ id: t.id, dup: keys.length - new Set(keys).size }).toEqual({ id: t.id, dup: 0 });
    });
  });

  test('every fret is canonical: 0..11, never the fret-12 echo', () => {
    TUNINGS.forEach((t) => {
      const k = deriveKey(t);
      const { degrees, others } = collectChordCards(t.midi, k.notes, k.rootPc);
      [...degrees, ...others].forEach((c) => {
        expect(c.fret).toBeGreaterThanOrEqual(0);
        expect(c.fret).toBeLessThanOrEqual(POSITION_MAX_FRET);
        expect(c.strings.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  test('every card is real: its grip sounds only tones of the named chord, rooted right', () => {
    TUNINGS.forEach((t) => {
      const k = deriveKey(t);
      const { degrees, others } = collectChordCards(t.midi, k.notes, k.rootPc);
      [...degrees, ...others].forEach((c) => {
        const pcs = new Set(c.strings.map((s) => midiPc(t.midi[s] + c.fret)));
        const chordPcs = new Set(c.match.intervals.map((i) => (c.match.rootPc + i) % 12));
        pcs.forEach((pc) => expect(chordPcs.has(pc)).toBe(true));
        expect(pcs.has(c.match.rootPc)).toBe(true);
      });
    });
  });

  test('chordless tunings get no cards instead of nonsense', () => {
    for (const id of ['white-keys', 'schizophrenia', 'soundg-wave']) {
      const { degrees, others } = cardsFor(id);
      expect(degrees).toHaveLength(0);
      expect(others).toHaveLength(0);
    }
  });
});

describe('C6 — the reference case', () => {
  const { degrees, others } = cardsFor('c6');

  test('six voicable degrees, vii° hidden (C6 has no diminished grip)', () => {
    expect(degrees.map((d) => d.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi']);
    const byRoman = Object.fromEntries(degrees.map((d) => [d.roman, d]));
    expect(byRoman.I.fret).toBe(0); // C major on the low strings, open
    expect(chordLabel(byRoman.I.match)).toBe('C');
    expect(byRoman.ii.fret).toBe(5); // Dm on the top-string minor grip
    expect(byRoman.vi.fret).toBe(0); // Am open — the relative minor under the same bar
  });

  test('others hold exactly the rest: 12 sixths + 9 majors + 9 minors', () => {
    // C6's shapes are {6th, major, minor} at every fret. Three majors and
    // three minors are claimed by the degrees, so:
    expect(others).toHaveLength(12 + 9 + 9);
    const labels = others.map((c) => chordLabel(c.match));
    expect(labels).toContain('C6');
    expect(labels).toContain('F♯'); // an out-of-key major — available, so shown
    expect(labels).not.toContain('C'); // taken by degree I
    expect(labels).not.toContain('Dm'); // taken by degree ii
  });

  test('others sort outward from the key root', () => {
    const firstRoot = others[0].match.rootPc;
    expect(firstRoot).toBe(0); // C — the key root's own colours come first
  });
});

describe('spot checks across the catalog', () => {
  test('open E (pure major tuning): majors only, no minor degree cards', () => {
    const { degrees, others } = cardsFor('open-e');
    // ii/iii/vi are minor — open E cannot bar a minor chord, so they are absent
    expect(degrees.map((d) => d.roman)).toEqual(['I', 'IV', 'V']);
    expect(others.every((c) => c.match.quality === 'maj')).toBe(true);
    expect(others).toHaveLength(9); // 12 majors minus the three degree majors
  });

  test('B11 exposes its famous chord goldmine as cards', () => {
    const { degrees, others } = cardsFor('b11');
    const all = [...degrees, ...others].map((c) => chordLabel(c.match));
    expect(all).toContain('B11');
    expect(all).toContain('B7');
    expect(all).toContain('B9');
    expect(all).toContain('F♯m');
  });

  test('a 10-string pedal steel produces a consistent card set', () => {
    const { degrees, others } = cardsFor('ps-e9-nashville');
    expect(degrees.length).toBeGreaterThan(0);
    expect([...degrees, ...others].length).toBeGreaterThan(12);
  });

  test('degree cards agree with what the board will show at their fret', () => {
    // Clicking a card selects a chip at that fret — the chip must exist,
    // either under the card's own name or as the same pitch-class set.
    for (const id of ['c6', 'cyrus-hybrid', 'open-d', 'ukulele', 'ps-c6-swing-jazz']) {
      const t = getTuning(id)!;
      const k = deriveKey(t);
      const { degrees } = collectChordCards(t.midi, k.notes, k.rootPc);
      degrees.forEach((card) => {
        const there = chordsAtFret(t.midi, card.fret);
        const cardPcs = new Set(card.strings.map((s) => midiPc(t.midi[s] + card.fret)));
        const found = there.some((c) => {
          if (c.match.rootPc === card.match.rootPc && c.match.suffix === card.match.suffix)
            return true;
          const cPcs = new Set(c.strings.map((s) => midiPc(t.midi[s] + card.fret)));
          return cPcs.size === cardPcs.size && [...cardPcs].every((pc) => cPcs.has(pc));
        });
        expect({ id, card: chordLabel(card.match), found }).toEqual({
          id,
          card: chordLabel(card.match),
          found: true,
        });
      });
    }
  });
});
