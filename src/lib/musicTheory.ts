/**
 * Music Theory Utilities
 *
 * Comprehensive music theory functions for proper enharmonic spelling,
 * key signatures, and scale generation with correct notation.
 */

// ============================================================================
// CORE DEFINITIONS
// ============================================================================

/**
 * All 12 chromatic notes with both sharp and flat representations
 * Using Unicode symbols for proper display: ♯ (U+266F) and ♭ (U+266D)
 */
export const CHROMATIC_NOTES_SHARPS = [
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'
] as const;

export const CHROMATIC_NOTES_FLATS = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'
] as const;

/**
 * Natural notes (white keys on piano)
 */
export const NATURAL_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

// ============================================================================
// KEY SIGNATURES
// ============================================================================

/**
 * Key signature definitions
 * Positive numbers = sharps, Negative numbers = flats
 */
export const KEY_SIGNATURES = {
  // Major keys
  'C Major': { accidentals: 0, type: 'none' as const },
  'G Major': { accidentals: 1, type: 'sharps' as const },
  'D Major': { accidentals: 2, type: 'sharps' as const },
  'A Major': { accidentals: 3, type: 'sharps' as const },
  'E Major': { accidentals: 4, type: 'sharps' as const },
  'B Major': { accidentals: 5, type: 'sharps' as const },
  'F♯ Major': { accidentals: 6, type: 'sharps' as const },
  'C♯ Major': { accidentals: 7, type: 'sharps' as const },
  'F Major': { accidentals: 1, type: 'flats' as const },
  'B♭ Major': { accidentals: 2, type: 'flats' as const },
  'E♭ Major': { accidentals: 3, type: 'flats' as const },
  'A♭ Major': { accidentals: 4, type: 'flats' as const },
  'D♭ Major': { accidentals: 5, type: 'flats' as const },
  'G♭ Major': { accidentals: 6, type: 'flats' as const },
  'C♭ Major': { accidentals: 7, type: 'flats' as const },

  // Minor keys (relative to major)
  'A Minor': { accidentals: 0, type: 'none' as const },
  'E Minor': { accidentals: 1, type: 'sharps' as const },
  'B Minor': { accidentals: 2, type: 'sharps' as const },
  'F♯ Minor': { accidentals: 3, type: 'sharps' as const },
  'C♯ Minor': { accidentals: 4, type: 'sharps' as const },
  'G♯ Minor': { accidentals: 5, type: 'sharps' as const },
  'D♯ Minor': { accidentals: 6, type: 'sharps' as const },
  'A♯ Minor': { accidentals: 7, type: 'sharps' as const },
  'D Minor': { accidentals: 1, type: 'flats' as const },
  'G Minor': { accidentals: 2, type: 'flats' as const },
  'C Minor': { accidentals: 3, type: 'flats' as const },
  'F Minor': { accidentals: 4, type: 'flats' as const },
  'B♭ Minor': { accidentals: 5, type: 'flats' as const },
  'E♭ Minor': { accidentals: 6, type: 'flats' as const },
  'A♭ Minor': { accidentals: 7, type: 'flats' as const },
} as const;

/**
 * Order of sharps in key signatures (Circle of Fifths)
 */
export const SHARP_ORDER = ['F♯', 'C♯', 'G♯', 'D♯', 'A♯', 'E♯', 'B♯'] as const;

/**
 * Order of flats in key signatures (Circle of Fourths)
 */
export const FLAT_ORDER = ['B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭', 'F♭'] as const;

// ============================================================================
// SCALE LETTER OFFSETS
// ============================================================================

/**
 * Letter offsets for each scale type.
 *
 * For each scale degree, this defines how many letter names to advance
 * from the root letter. For 7-note scales, all 7 letters are used (0-6).
 * For pentatonic and blues scales, certain letters are skipped.
 *
 * Example: C Pentatonic Minor uses letters C, E, F, G, B (offsets 0, 2, 3, 4, 6)
 * This skips D (offset 1) and A (offset 5).
 */
export const SCALE_LETTER_OFFSETS: Record<string, number[]> = {
  // 7-note scales: use all 7 letters
  'Major':             [0, 1, 2, 3, 4, 5, 6],
  'Minor':             [0, 1, 2, 3, 4, 5, 6],
  'Dorian':            [0, 1, 2, 3, 4, 5, 6],
  'Phrygian':          [0, 1, 2, 3, 4, 5, 6],
  'Lydian':            [0, 1, 2, 3, 4, 5, 6],
  'Mixolydian':        [0, 1, 2, 3, 4, 5, 6],
  'Locrian':           [0, 1, 2, 3, 4, 5, 6],
  'Harmonic Minor':    [0, 1, 2, 3, 4, 5, 6],
  'Melodic Minor':     [0, 1, 2, 3, 4, 5, 6],
  'Hungarian Minor':   [0, 1, 2, 3, 4, 5, 6],
  'Double Harmonic':   [0, 1, 2, 3, 4, 5, 6],
  'Phrygian Dominant': [0, 1, 2, 3, 4, 5, 6],

  // Pentatonic Major: degrees 1, 2, 3, 5, 6 of the major scale
  // C Pent Maj = C, D, E, G, A → skips F (3) and B (6)
  'Pentatonic Major':  [0, 1, 2, 4, 5],

  // Pentatonic Minor: degrees 1, b3, 4, 5, b7
  // C Pent Min = C, Eb, F, G, Bb → skips D (1) and A (5)
  'Pentatonic Minor':  [0, 2, 3, 4, 6],

  // Blues: degrees 1, b3, 4, b5, 5, b7
  // C Blues = C, Eb, F, Gb, G, Bb → uses letters C, E, F, G, G, B
  // The b5 and 5 share the same letter offset (4 = G)
  'Blues':             [0, 2, 3, 4, 4, 6],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Pitch class of each natural letter (semitones above C)
 */
const LETTER_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/**
 * Parse a note name into its letter and total accidental offset.
 * Accepts Unicode (♯ ♭ 𝄪) and ASCII (# b) accidentals, single or double.
 * Returns null for anything that isn't a note name.
 */
export function parseNoteName(note: string): { letter: string; offset: number } | null {
  if (!note || typeof note !== 'string') return null;
  const letter = note[0].toUpperCase();
  if (!(letter in LETTER_PC)) return null;

  let offset = 0;
  // Iterate accidental characters; 𝄪 is a surrogate pair, so use the spread operator
  const rest = [...note.slice(1)];
  for (const ch of rest) {
    if (ch === '♯' || ch === '#') offset += 1;
    else if (ch === '♭' || ch === 'b') offset -= 1;
    else if (ch === '𝄪') offset += 2;
    else return null; // unknown character — not a note name
  }
  // Cap at double accidentals — anything beyond is not real notation
  if (offset < -2 || offset > 2) return null;
  return { letter, offset };
}

/**
 * Note name → pitch class (0-11) by pure pitch arithmetic.
 * Returns null for invalid names. This is the single source of truth
 * for note-name parsing across the app.
 */
export function noteToPitchClass(note: string): number | null {
  const parsed = parseNoteName(note);
  if (!parsed) return null;
  return ((LETTER_PC[parsed.letter] + parsed.offset) % 12 + 12) % 12;
}

/**
 * Note name → pitch class with a LOUD failure mode: unknown names log a
 * dev-mode error (instead of silently becoming C) and return 0.
 */
export function getNoteChromatic(note: string): number {
  const pc = noteToPitchClass(note);
  if (pc === null) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error(`[musicTheory] Unknown note name "${note}" — defaulting to C. This is a bug.`);
    }
    return 0;
  }
  return pc;
}

/**
 * Spell a pitch class with a sharp or flat preference.
 */
export function spellPitchClass(pitchClass: number, preferSharps: boolean): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  return preferSharps ? CHROMATIC_NOTES_SHARPS[pc] : CHROMATIC_NOTES_FLATS[pc];
}

/**
 * Note name + octave → frequency in Hz (equal temperament, A4 = 440).
 * Octave semantics follow the app-wide convention: name@octave shares the
 * octave of its pitch class (B♯4 = C4, C♭4 = B4) — matching how the
 * ascending-octave walks in the Generator and Progressions already work.
 */
export function noteToFrequency(note: string, octave: number): number {
  const pc = getNoteChromatic(note); // loud on failure
  const midi = pc + (octave + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Get the chromatic index of a note (0-11)
 * Handles sharps, flats, double accidentals, and ASCII variants.
 * Returns -1 for invalid notes (legacy contract).
 */
export function getChromaticIndex(note: string): number {
  const pc = noteToPitchClass(note);
  return pc === null ? -1 : pc;
}

/**
 * Normalize a note to its simplest enharmonic equivalent
 * (ASCII → Unicode; double accidentals simplified by PITCH arithmetic,
 * two semitones — not two letter names).
 */
export function normalizeNote(note: string): string {
  // Handle Unicode and ASCII variants
  const normalized = note
    .replace(/#/g, '♯')  // Convert ASCII sharp to Unicode
    .replace(/b/g, '♭'); // Convert ASCII flat to Unicode

  // Simplify double accidentals to a single-accidental (or natural) spelling
  if (normalized.includes('𝄪') || normalized.includes('♯♯') || normalized.includes('♭♭')) {
    const pc = noteToPitchClass(normalized.replace(/♯♯/g, '𝄪'));
    if (pc !== null) {
      const isSharpFamily = normalized.includes('𝄪') || normalized.includes('♯♯');
      return spellPitchClass(pc, isSharpFamily);
    }
  }

  return normalized;
}

/**
 * Get the base letter name of a note (without accidentals)
 */
export function getBaseLetter(note: string): string {
  return note[0];
}

/**
 * Check if a note has a sharp
 */
export function hasSharp(note: string): boolean {
  return note.includes('♯') || note.includes('#') || note.includes('𝄪');
}

/**
 * Check if a note has a flat
 */
export function hasFlat(note: string): boolean {
  return note.includes('♭') || note.includes('b');
}

// ============================================================================
// KEY-AWARE NOTE SPELLING
// ============================================================================

/**
 * Get the correct enharmonic spelling for a note in a given key
 * This is the main function for ensuring proper music theory notation
 */
export function getCorrectNoteSpelling(
  chromaticIndex: number,
  keyRoot: string,
  keyType: 'Major' | 'Minor' | string
): string {
  const keyName = `${keyRoot} ${keyType}`;
  const keySignature = KEY_SIGNATURES[keyName as keyof typeof KEY_SIGNATURES];

  if (!keySignature) {
    // Fallback to sharp spelling if key not found
    return CHROMATIC_NOTES_SHARPS[chromaticIndex];
  }

  // Determine if this key uses sharps or flats
  const useSharps = keySignature.type === 'sharps' || keySignature.type === 'none';

  // Get the notes in the key signature
  const accidentalsInKey = getAccidentalsInKey(keyName);

  // Choose the appropriate chromatic scale
  const chromaticScale = useSharps ? CHROMATIC_NOTES_SHARPS : CHROMATIC_NOTES_FLATS;
  const baseNote = chromaticScale[chromaticIndex];

  // Special handling for notes that appear in the key signature
  if (accidentalsInKey.length > 0) {
    // Check if we need to use a specific spelling
    for (const accidental of accidentalsInKey) {
      if (getChromaticIndex(accidental) === chromaticIndex) {
        return accidental;
      }
    }
  }

  // Special cases for specific keys
  if (keyName === 'F Major' || keyName === 'D Minor') {
    if (chromaticIndex === 10) return 'B♭'; // Not A♯
  }

  if (keyName === 'C♯ Major' || keyName === 'A♯ Minor') {
    if (chromaticIndex === 5) return 'E♯'; // Not F
    if (chromaticIndex === 0) return 'B♯'; // Not C
  }

  if (keyName === 'F♯ Major' || keyName === 'D♯ Minor') {
    if (chromaticIndex === 5) return 'E♯'; // Not F
  }

  if (keyName === 'G♭ Major' || keyName === 'E♭ Minor') {
    if (chromaticIndex === 11) return 'C♭'; // Not B
  }

  if (keyName === 'C♭ Major' || keyName === 'A♭ Minor') {
    if (chromaticIndex === 11) return 'C♭'; // Not B
    if (chromaticIndex === 4) return 'F♭'; // Not E
  }

  return baseNote;
}

/**
 * Get the accidentals that appear in a key signature
 */
export function getAccidentalsInKey(keyName: string): string[] {
  const keySignature = KEY_SIGNATURES[keyName as keyof typeof KEY_SIGNATURES];
  if (!keySignature) return [];

  const accidentals: string[] = [];

  if (keySignature.type === 'sharps') {
    for (let i = 0; i < keySignature.accidentals; i++) {
      accidentals.push(SHARP_ORDER[i]);
    }
  } else if (keySignature.type === 'flats') {
    for (let i = 0; i < keySignature.accidentals; i++) {
      accidentals.push(FLAT_ORDER[i]);
    }
  }

  return accidentals;
}

/**
 * Generate a diatonic scale with proper note spelling
 * Ensures each letter name appears exactly once (except the octave)
 */
export function generateDiatonicScale(
  root: string,
  intervals: number[], // Semitone intervals
  keyType: 'Major' | 'Minor' | string
): string[] {
  const rootIndex = getChromaticIndex(root);
  if (rootIndex === -1) return []; // Invalid root

  const scale: string[] = [root];
  const baseLetterIndex = NATURAL_NOTES.indexOf(getBaseLetter(root) as any);
  let chromaticPosition = rootIndex;

  // Generate each scale degree
  for (let i = 0; i < intervals.length; i++) {
    chromaticPosition = (chromaticPosition + intervals[i]) % 12;

    // Calculate the expected letter name for this scale degree
    // Use SCALE_LETTER_OFFSETS to handle non-7-note scales correctly
    const letterOffsets = SCALE_LETTER_OFFSETS[keyType];

    let expectedLetterIndex: number;
    if (letterOffsets) {
      // Use the correct letter offset for this scale degree
      // i+1 because index 0 in letterOffsets is the root (already added above the loop)
      const degreeOffset = letterOffsets[i + 1];
      if (degreeOffset !== undefined) {
        expectedLetterIndex = (baseLetterIndex + degreeOffset) % 7;
      } else {
        // Fallback for unexpected index (e.g. octave note that gets trimmed)
        expectedLetterIndex = (baseLetterIndex + i + 1) % 7;
      }
    } else {
      // Fallback: assume 7-note scale with sequential letters
      expectedLetterIndex = (baseLetterIndex + i + 1) % 7;
    }
    const expectedLetter = NATURAL_NOTES[expectedLetterIndex];

    // Find the correct enharmonic spelling that uses the expected letter
    const possibleNotes = [
      expectedLetter,
      expectedLetter + '♯',
      expectedLetter + '♭',
      expectedLetter + '𝄪',
      expectedLetter + '♭♭',
      expectedLetter + '♯♯'
    ];

    // Find which spelling gives us the correct chromatic pitch
    let correctSpelling = '';
    for (const spelling of possibleNotes) {
      if (getChromaticIndex(spelling) === chromaticPosition) {
        correctSpelling = spelling;
        break;
      }
    }

    // For non-7-note scales, simplify unusual enharmonics like F♭→E, C♭→B
    // These spellings are never correct in pentatonic or blues scales
    if (correctSpelling && letterOffsets && letterOffsets.length < 7) {
      const SIMPLIFY: Record<string, string> = {
        'F♭': 'E', 'C♭': 'B', 'B♯': 'C', 'E♯': 'F'
      };
      if (SIMPLIFY[correctSpelling]) {
        correctSpelling = SIMPLIFY[correctSpelling];
      }
    }

    // If we found a correct spelling, use it; otherwise fall back to key-aware spelling
    if (correctSpelling) {
      scale.push(correctSpelling);
    } else {
      scale.push(getCorrectNoteSpelling(chromaticPosition, root, keyType));
    }
  }

  return scale;
}

// ============================================================================
// SCALE TYPES AND MODES
// ============================================================================

/**
 * Determine if a key should use sharps or flats based on common usage
 */
export function shouldUseSharps(root: string): boolean {
  const sharpKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'];
  const flatKeys = ['F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'];

  if (sharpKeys.includes(root)) return true;
  if (flatKeys.includes(root)) return false;

  // Default to sharps for ambiguous cases
  return true;
}

/**
 * Get the preferred enharmonic spelling for a root note
 * (e.g., prefer D♭ over C♯ for certain contexts)
 */
export function getPreferredRootSpelling(note: string): string {
  const preferredSpellings: Record<string, string> = {
    'A♯': 'B♭',  // B♭ is more common than A♯
    'D♯': 'E♭',  // E♭ is more common than D♯
    'G♯': 'A♭',  // A♭ is more common than G♯
    'C♯': 'D♭',  // Both are common, but D♭ slightly preferred
    'F♯': 'G♭',  // Both are common, context-dependent
  };

  return preferredSpellings[note] || note;
}

/**
 * Validate if a scale is correctly spelled (each letter appears once)
 */
export function isCorrectlySpelledScale(scale: string[]): boolean {
  const letters = scale.slice(0, -1).map(note => getBaseLetter(note)); // Exclude octave
  const uniqueLetters = new Set(letters);
  return uniqueLetters.size === letters.length;
}

// ============================================================================
// SCALE INTERVALS (single source of truth — consumed by the Generator)
// ============================================================================

export const SCALE_INTERVALS: Record<string, number[]> = {
  Major:      [2, 2, 1, 2, 2, 2, 1],
  Minor:      [2, 1, 2, 2, 1, 2, 2],
  Dorian:     [2, 1, 2, 2, 2, 1, 2],
  Phrygian:   [1, 2, 2, 2, 1, 2, 2],
  Lydian:     [2, 2, 2, 1, 2, 2, 1],
  Mixolydian: [2, 2, 1, 2, 2, 1, 2],
  Locrian:    [1, 2, 2, 1, 2, 2, 2],
  'Harmonic Minor': [2, 1, 2, 2, 1, 3, 1],
  'Melodic Minor':  [2, 1, 2, 2, 2, 2, 1],
  'Hungarian Minor': [2, 1, 3, 1, 1, 3, 1],
  'Double Harmonic': [1, 3, 1, 2, 1, 3, 1],
  'Phrygian Dominant': [1, 3, 1, 2, 1, 2, 2],
  'Pentatonic Major': [2, 2, 3, 2, 3],
  'Pentatonic Minor': [3, 2, 2, 3, 2],
  'Blues': [3, 2, 1, 1, 3, 2],
};

/**
 * Enharmonic alternative for a root, used to avoid double-accidental keys.
 */
const ENHARMONIC_ROOT_ALT: Record<string, string> = {
  'C♯': 'D♭', 'D♭': 'C♯',
  'D♯': 'E♭', 'E♭': 'D♯',
  'F♯': 'G♭', 'G♭': 'F♯',
  'G♯': 'A♭', 'A♭': 'G♯',
  'A♯': 'B♭', 'B♭': 'A♯',
  'B♯': 'C', 'E♯': 'F', 'F♭': 'E', 'C♭': 'B',
};

function hasDoubleAccidental(note: string): boolean {
  return note.includes('𝄪') || note.includes('♭♭') || note.includes('♯♯');
}

function scaleHasBadSpelling(scale: string[]): boolean {
  if (scale.length === 0) return true;
  if (scale.some(hasDoubleAccidental)) return true;
  // Duplicate letters (compare full scale without assuming a trailing octave)
  const letters = scale.map(getBaseLetter);
  const body = letters[letters.length - 1] === letters[0] ? letters.slice(0, -1) : letters;
  return new Set(body).size !== body.length;
}

/**
 * Generate a correctly spelled scale for a root + scale name.
 * Theoretical keys that would need double accidentals (G♯ Major, D♭ Minor, …)
 * are presented with the simpler enharmonic root (A♭ Major, C♯ Minor, …) —
 * double accidentals are never shown to the user.
 */
export function generateSpelledScale(root: string, scaleName: string): string[] {
  const intervals = SCALE_INTERVALS[scaleName];
  if (!intervals) return [];

  const primary = generateDiatonicScale(root, intervals, scaleName);
  if (!scaleHasBadSpelling(primary)) return primary;

  const normalizedRoot = normalizeNote(root);
  const preferred = getPreferredRootSpelling(normalizedRoot);
  const altRoot = preferred !== normalizedRoot ? preferred : ENHARMONIC_ROOT_ALT[normalizedRoot];
  if (altRoot) {
    const alt = generateDiatonicScale(altRoot, intervals, scaleName);
    if (!scaleHasBadSpelling(alt)) return alt;
  }
  // Both spellings are theoretical-key bad: keep the user's root but make sure
  // no double accidental ever reaches the UI (pitch stays correct)
  return primary.map(n => (hasDoubleAccidental(n) ? normalizeNote(n) : n));
}

// ============================================================================
// DEGREE CHORD DERIVATION ENGINE
// Single source of truth for chord quality, names, and roman numerals.
// Everything is derived from interval arithmetic — never from lookup tables.
// ============================================================================

export type TriadQuality =
  | 'maj' | 'min' | 'dim' | 'aug'
  | 'majb5'          // M3 + dim3 stack (e.g. Hungarian Minor II)
  | 'sus4' | 'sus2'  // index-stacked sus voicings in pentatonic scales
  | '7sus4'          // stacked fourths (root, P4, m7) — a 7sus4 shell
  | 'slash'          // inversion of a real triad (e.g. Am/C)
  | null;            // no nameable chord

export interface DegreeChordInfo {
  /** pitch classes of the index-stacked triad [root, third, fifth] */
  tonePcs: number[];
  quality: TriadQuality;
  /** full display name for the triad (e.g. 'E♭m', 'Csus4', 'Am/C') or null = '—' */
  triadName: string | null;
  /** roman numeral cased by quality, with ° / + and ♭-prefix for non-heptatonic degrees */
  roman: string;
  /** for heptatonic scales: interval root→7th in semitones */
  seventhInterval: number | null;
  /** full display name in 7th mode, or null = '—' */
  seventhName: string | null;
}

const ROMAN_BASE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
// Numeral for a semitone offset from the scale root (non-heptatonic scales)
const SEMITONE_ROMAN = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'];

function triadQualityFromIntervals(i1: number, i2: number): TriadQuality {
  if (i1 === 4 && i2 === 3) return 'maj';
  if (i1 === 3 && i2 === 4) return 'min';
  if (i1 === 3 && i2 === 3) return 'dim';
  if (i1 === 4 && i2 === 4) return 'aug';
  if (i1 === 4 && i2 === 2) return 'majb5';
  if (i1 === 5 && i2 === 2) return 'sus4';
  if (i1 === 2 && i2 === 5) return 'sus2';
  if (i1 === 5 && i2 === 5) return '7sus4';
  return null;
}

const TRIAD_SUFFIX: Record<string, string> = {
  maj: '', min: 'm', dim: 'dim', aug: 'aug',
  majb5: '(♭5)', sus4: 'sus4', sus2: 'sus2', '7sus4': '7sus4',
};

/**
 * Correct 7th-chord suffix from triad quality + the actual 7th interval.
 * This is where m7♭5 vs dim7 and 7 vs maj7 are decided.
 */
export function seventhSuffix(quality: TriadQuality, seventhInterval: number): string | null {
  switch (quality) {
    // A stacked "7th" of 9 semitones over a maj/min triad is enharmonically
    // a major 6th — name those chords honestly as 6 / m6
    case 'maj':   return seventhInterval === 11 ? 'maj7' : seventhInterval === 10 ? '7' : seventhInterval === 9 ? '6' : null;
    case 'min':   return seventhInterval === 10 ? 'm7' : seventhInterval === 11 ? 'mMaj7' : seventhInterval === 9 ? 'm6' : null;
    case 'dim':   return seventhInterval === 9 ? 'dim7' : seventhInterval === 10 ? 'm7♭5' : null;
    case 'aug':   return seventhInterval === 11 ? 'maj7♯5' : seventhInterval === 10 ? '7♯5' : null;
    case 'majb5': return seventhInterval === 10 ? '7♭5' : seventhInterval === 11 ? 'maj7♭5' : null;
    case 'sus4':  return seventhInterval === 10 ? '7sus4' : seventhInterval === 11 ? 'maj7sus4' : null;
    case 'sus2':  return seventhInterval === 10 ? '7sus2' : seventhInterval === 11 ? 'maj7sus2' : null;
    default:      return null;
  }
}

function romanFor(
  degreeIndex: number,
  semitoneOffset: number,
  quality: TriadQuality,
  isHeptatonic: boolean
): string {
  const base = isHeptatonic
    ? (ROMAN_BASE[degreeIndex] || '?')
    : (SEMITONE_ROMAN[((semitoneOffset % 12) + 12) % 12] || '?');
  switch (quality) {
    case 'min':  return base.toLowerCase();
    case 'dim':  return base.toLowerCase() + '°';
    case 'aug':  return base + '+';
    default:     return base;
  }
}

/**
 * Derive the chord on a scale degree by index-stacking (d, d+2, d+4 mod n) —
 * exactly the tones the app plays and highlights — and name what actually
 * sounds, including sus/quartal stacks and inversions in pentatonic scales.
 *
 * scaleNotes: spelled scale WITHOUT the octave duplicate (length === noteCount)
 */
export function deriveDegreeChord(scaleNotes: string[], degreeIndex: number): DegreeChordInfo {
  const n = scaleNotes.length;
  const pcs = scaleNotes.map(getNoteChromatic);
  const rootPc = pcs[degreeIndex];
  const thirdPc = pcs[(degreeIndex + 2) % n];
  const fifthPc = pcs[(degreeIndex + 4) % n];
  const tonePcs = [rootPc, thirdPc, fifthPc];
  const isHeptatonic = n >= 7;
  const semitoneOffset = ((rootPc - pcs[0]) % 12 + 12) % 12;

  const empty = (quality: TriadQuality = null): DegreeChordInfo => ({
    tonePcs,
    quality,
    triadName: null,
    roman: romanFor(degreeIndex, semitoneOffset, quality, isHeptatonic),
    seventhInterval: null,
    seventhName: null,
  });

  // Degenerate stack (duplicate tones) — no chord
  if (new Set(tonePcs).size !== 3) return empty();

  const rootName = scaleNotes[degreeIndex];
  const i1 = ((thirdPc - rootPc) % 12 + 12) % 12;
  const i2 = ((fifthPc - thirdPc) % 12 + 12) % 12;
  let quality = triadQualityFromIntervals(i1, i2);
  let triadName: string | null = null;

  if (quality !== null) {
    triadName = rootName + TRIAD_SUFFIX[quality];
  } else {
    // Not tertian from the bass — check whether it's an inversion of a real triad
    const nameForPc = (pc: number): string =>
      scaleNotes.find(note => getNoteChromatic(note) === pc) ?? spellPitchClass(pc, true);
    const rotations: Array<[number, number, number]> = [
      [thirdPc, fifthPc, rootPc],
      [fifthPc, rootPc, thirdPc],
    ];
    for (const [r, t, f] of rotations) {
      const q = triadQualityFromIntervals(((t - r) % 12 + 12) % 12, ((f - t) % 12 + 12) % 12);
      if (q === 'maj' || q === 'min') {
        quality = 'slash';
        triadName = `${nameForPc(r)}${TRIAD_SUFFIX[q]}/${rootName}`;
        break;
      }
    }
    if (quality !== 'slash') return empty();
  }

  // 7th info (heptatonic scales only)
  let seventhInterval: number | null = null;
  let seventhName: string | null = null;
  if (isHeptatonic) {
    const seventhPc = pcs[(degreeIndex + 6) % 7];
    seventhInterval = ((seventhPc - rootPc) % 12 + 12) % 12;
    const suffix = quality === 'slash' ? null : seventhSuffix(quality, seventhInterval);
    seventhName = suffix === null ? null : rootName + suffix;
  }

  return {
    tonePcs,
    quality,
    triadName,
    roman: romanFor(degreeIndex, semitoneOffset, quality, isHeptatonic),
    seventhInterval,
    seventhName,
  };
}

/**
 * Convenience: derive all degree chords for a scale.
 */
export function deriveScaleChords(scaleNotes: string[]): DegreeChordInfo[] {
  return scaleNotes.map((_, i) => deriveDegreeChord(scaleNotes, i));
}

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================

/**
 * Number of notes per scale type (used by Generator and Visualize blocks)
 */
export const scaleNoteCounts: Record<string, number> = {
  "Pentatonic Major": 5,
  "Pentatonic Minor": 5,
  "Blues": 6,
  "Major": 7,
  "Minor": 7,
  "Dorian": 7,
  "Phrygian": 7,
  "Lydian": 7,
  "Mixolydian": 7,
  "Locrian": 7,
  "Harmonic Minor": 7,
  "Melodic Minor": 7,
  "Hungarian Minor": 7,
  "Double Harmonic": 7,
  "Phrygian Dominant": 7,
};

/**
 * Canonical ordered list of scale/mode names, matching the Generator's selector.
 * (Object key order in SCALE_INTERVALS is the insertion order.)
 */
export const SCALE_NAMES: string[] = Object.keys(SCALE_INTERVALS);

/**
 * Build the full set of Generator state updates for a given root + scale.
 *
 * The Generator does not auto-recompute its note array when rootEl/scaleEl
 * change — its own handlers compute everything explicitly. This helper
 * reproduces that cascade so an external controller (e.g. the Practice block)
 * can drive the Generator with a single, correct update:
 *   - tonesEl    : the "T - S - TS" step pattern (derived from SCALE_INTERVALS)
 *   - tonesArrEl : the spelled scale notes (incl. octave repeat for 7-note scales)
 */
export function buildScaleUpdate(
  root: string,
  scale: string
): { rootEl: string; scaleEl: string; tonesEl: string; tonesArrEl: string[] } {
  const noteCount = scaleNoteCounts[scale] || 7;
  const spelled = generateSpelledScale(root, scale);
  const tonesArrEl =
    spelled && spelled.length > 0
      ? noteCount < 7
        ? spelled.slice(0, noteCount)
        : spelled.slice(0, 8)
      : ["C", "D", "E", "F", "G", "A", "B", "C"];

  const intervals = SCALE_INTERVALS[scale] || [];
  const tonesEl = intervals
    .map((s) => (s === 1 ? "S" : s === 3 ? "TS" : "T"))
    .join(" - ");

  return { rootEl: root, scaleEl: scale, tonesEl, tonesArrEl };
}
