/**
 * Color-bucket gate — the harmonic-function colors are a shared identity with
 * the VG-800 controller, so the bucketing must match its degColor exactly.
 */
import { describe, expect, test } from 'vitest';
import {
  CHORD_FUNC,
  DEGREE_COLORS,
  FUNCTION_COLORS,
  degreeColor,
  functionColor,
  intervalColor,
} from './noteColors';
import { intervalLabel } from './chordEngine';

describe('interval colors match the VG-800 degColor buckets', () => {
  test('every bucket', () => {
    expect(intervalColor('R')).toBe(DEGREE_COLORS.root);
    expect(intervalColor('♭3')).toBe(DEGREE_COLORS.third);
    expect(intervalColor('3')).toBe(DEGREE_COLORS.third);
    expect(intervalColor('♭5')).toBe(DEGREE_COLORS.fifth);
    expect(intervalColor('5')).toBe(DEGREE_COLORS.fifth);
    expect(intervalColor('♯5')).toBe(DEGREE_COLORS.fifth);
    expect(intervalColor('♭7')).toBe(DEGREE_COLORS.seventh);
    expect(intervalColor('7')).toBe(DEGREE_COLORS.seventh);
    expect(intervalColor('♭9')).toBe(DEGREE_COLORS.ninth);
    expect(intervalColor('9')).toBe(DEGREE_COLORS.ninth);
    expect(intervalColor('4')).toBe(DEGREE_COLORS.color);
    expect(intervalColor('6')).toBe(DEGREE_COLORS.color);
    expect(intervalColor('11')).toBe(DEGREE_COLORS.color);
    expect(intervalColor('13')).toBe(DEGREE_COLORS.color);
  });

  test('every caption intervalLabel can emit lands in a bucket', () => {
    for (let semi = 0; semi < 12; semi++) {
      for (const flat7 of [false, true]) {
        const c = intervalColor(intervalLabel(semi, flat7));
        expect(Object.values(DEGREE_COLORS)).toContain(c);
      }
    }
  });
});

describe('scale-degree colors', () => {
  test('accidentals do not change the bucket', () => {
    expect(degreeColor('1')).toBe(DEGREE_COLORS.root);
    expect(degreeColor('♭3')).toBe(DEGREE_COLORS.third);
    expect(degreeColor('♯4')).toBe(DEGREE_COLORS.color);
    expect(degreeColor('5')).toBe(DEGREE_COLORS.fifth);
    expect(degreeColor('♭6')).toBe(DEGREE_COLORS.color);
    expect(degreeColor('♭7')).toBe(DEGREE_COLORS.seventh);
    expect(degreeColor('2')).toBe(DEGREE_COLORS.ninth);
  });
});

describe('chord functions', () => {
  test('I ii iii IV V vi vii° → tonic subdom tonic subdom dominant tonic dominant', () => {
    expect(CHORD_FUNC).toEqual([
      'tonic', 'subdom', 'tonic', 'subdom', 'dominant', 'tonic', 'dominant',
    ]);
    expect(functionColor(0)).toBe(FUNCTION_COLORS.tonic);
    expect(functionColor(4)).toBe(FUNCTION_COLORS.dominant);
    expect(functionColor(3)).toBe(FUNCTION_COLORS.subdom);
  });
});
