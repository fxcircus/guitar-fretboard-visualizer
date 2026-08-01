/**
 * Generates `src/lib/tunings.ts` — the tuning catalog.
 *
 * Two sources are merged:
 *
 *  1. CURATED (below): the lap-steel and open-major stacks, with the octave
 *     registers a real instrument is strung in. Each was verified against at
 *     least two independent sources (John Ely's master list / hawaiiansteel.com,
 *     Peterson tuner presets, papadafoe.com, steelc6th.com, Steel Guitar Forum).
 *
 *  2. VG-800 (vg800-raw.json): the rest of the catalog, lifted from the
 *     fxcircus/vg800_midi_control tuner. Those tunings are stored as per-string
 *     semitone offsets from standard E A D G B E because the VG-800 retunes a
 *     real guitar in software; MIDI is derived by applying them to the standard
 *     stack. The offset arrays run string 1 (high E) → string 6 (low E) and are
 *     reversed here so every stack in this app reads low string first.
 *
 * Where the two overlap (C6, A6, Open E, …) the curated stack wins: the VG-800
 * picks the *nearest* pitch for each string (its shifter is bounded), which is
 * right for retuning a guitar but puts e.g. C6 in the wrong register for a
 * fretboard diagram (C2 E2 G3 A3 … instead of C3 E3 G3 A3 …).
 *
 * Run: node scripts/build-tunings.mjs <path-to-vg800-raw.json>
 * The output is committed, so the app has no build-time dependency on it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = process.argv[2] ?? resolve(HERE, 'vg800-raw.json');
const D = JSON.parse(readFileSync(RAW, 'utf8'));

const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const pcOf = (m) => ((m % 12) + 12) % 12;

function nameToPc(n) {
  let pc = LETTER_PC[n[0].toUpperCase()];
  for (const ch of n.slice(1)) {
    if (ch === '#' || ch === '♯') pc += 1;
    else if (ch === 'b' || ch === '♭') pc -= 1;
  }
  return ((pc % 12) + 12) % 12;
}
const prettify = (n) => n.replace(/#/g, '♯').replace(/b/g, '♭');

// standard guitar, string 1 (high E) → string 6 (low E)
const STD_HIGH_TO_LOW = [64, 59, 55, 50, 45, 40];
const midiFromOffsets = (offsets) =>
  offsets.map((o, i) => STD_HIGH_TO_LOW[i] + o).reverse();

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[♯#]/g, 's')
    .replace(/[♭]/g, 'b')
    // Fold diacritics so "Saz / Bağlama" becomes saz-baglama, not saz-ba-lama.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// ── 1. Curated lap-steel / open-major stacks ───────────────────────────────
// (from music_blocks src/utils/steelTunings.ts — real instrument registers)
const CURATED = [
  {
    id: 'c6', name: 'C6', group: 'lap-steel',
    midi: [48, 52, 55, 57, 60, 64], spellings: ['C', 'E', 'G', 'A', 'C', 'E'],
    description:
      'The lap steel standard (Jerry Byrd). One bar = C major on the low strings, its relative A minor on top — a major chord and its relative minor under every fret.',
  },
  {
    id: 'a6', name: 'A6', group: 'lap-steel',
    midi: [49, 52, 54, 57, 61, 64], spellings: ['C♯', 'E', 'F♯', 'A', 'C♯', 'E'],
    description:
      'The classic western swing tuning — the same 6th-chord sound as C6, voiced with the 3rd in the bass: A major on the top three strings, F♯m just below.',
  },
  {
    id: 'c6-a7', name: 'C6/A7', group: 'lap-steel',
    midi: [49, 52, 55, 57, 60, 64], spellings: ['C♯', 'E', 'G', 'A', 'C', 'E'],
    description:
      'C6 with the low C raised to C♯ — the top four strings keep C6, the bottom four spell A7. Sixth and dominant worlds under one bar (Jerry Byrd).',
  },
  {
    id: 'e7', name: 'E7', group: 'lap-steel',
    midi: [47, 50, 52, 56, 59, 64], spellings: ['B', 'D', 'E', 'G♯', 'B', 'E'],
    description:
      'The blues standard — a dominant 7th built in, while the top four strings stay a pure E major triad.',
  },
  {
    id: 'e13', name: 'E13', group: 'lap-steel',
    midi: [50, 52, 56, 59, 61, 64], spellings: ['D', 'E', 'G♯', 'B', 'C♯', 'E'],
    description:
      'Pre-pedal country. E7 plus the 13th (C♯) — crying parallel 6ths on top, the G♯–D tritone pull built in.',
  },
  {
    id: 'e9-lap', name: 'E9 (lap)', group: 'lap-steel',
    midi: [50, 52, 54, 56, 59, 64], spellings: ['D', 'E', 'F♯', 'G♯', 'B', 'E'],
    description:
      'A dominant-9th color tuning — ♭7, root and 9 stacked on the low strings for sultry blues colors. Not the pedal-steel E9.',
  },
  {
    id: 'b11', name: 'B11', group: 'lap-steel',
    midi: [47, 51, 54, 57, 61, 64], spellings: ['B', 'D♯', 'F♯', 'A', 'C♯', 'E'],
    description:
      "Jerry Byrd's Hawaiian specialty — B, F♯m, and A triads plus B7/B9 colors all under one straight bar, resolving a 4th up.",
  },
  {
    id: 'b11-tk-smith', name: 'B11 (T.K. Smith)', group: 'lap-steel',
    midi: [47, 51, 54, 57, 61, 64], spellings: ['B', 'D♯', 'F♯', 'A', 'C♯', 'E'],
    description:
      'T.K. Smith’s 6-string B11 (1·3·5·♭7·9·11 = B D♯ F♯ A C♯ E), his current setup on a 1934 Rickenbacher — B, F♯m and A triads plus B7/B9 colors under one straight bar.',
  },
  {
    id: 'cyrus-hybrid', name: 'Cyrus Hybrid', group: 'lap-steel',
    midi: [43, 47, 50, 54, 57, 62], spellings: ['G', 'B', 'D', 'F♯', 'A', 'D'],
    description:
      'Luke Cyrus Goetze’s G/D hybrid — G major on the low three strings, D major on the top three, so one bar covers both the I and the V. The open stack rings as a shimmering Gmaj9.',
  },
  {
    id: 'open-e', name: 'Open E', group: 'open',
    midi: [40, 47, 52, 56, 59, 64], spellings: ['E', 'B', 'E', 'G♯', 'B', 'E'],
    description:
      'A straight major triad, same as bottleneck open E — blues-rock and sacred steel. The easiest entry point for guitar players.',
  },
  {
    id: 'open-d', name: 'Open D', group: 'open',
    midi: [38, 45, 50, 54, 57, 62], spellings: ['D', 'A', 'D', 'F♯', 'A', 'D'],
    description:
      'Open E a whole step down — old-time, gospel, and Weissenborn territory. Lower tension, darker voice.',
  },
  {
    id: 'open-g-dobro', name: 'Open G (Dobro)', group: 'open',
    midi: [43, 47, 50, 55, 59, 62], spellings: ['G', 'B', 'D', 'G', 'B', 'D'],
    description:
      'Two stacked G triads (G-B-D twice) — the bluegrass and resonator standard, built for harmonized melody in 3rds.',
  },
  {
    id: 'open-g-low', name: 'Open G (low bass)', group: 'open',
    midi: [38, 43, 50, 55, 59, 62], spellings: ['D', 'G', 'D', 'G', 'B', 'D'],
    description:
      "Guitar-style 'Spanish' open G — the same top four strings over a deep D-G bass pair.",
  },
  {
    id: 'open-a-high', name: 'Open A (high bass)', group: 'open',
    midi: [45, 49, 52, 57, 61, 64], spellings: ['A', 'C♯', 'E', 'A', 'C♯', 'E'],
    description:
      'The classic 1920s Hawaiian tuning (Sol Hoopii) — the Dobro-G shape a whole step up, bright and singing.',
  },
];

// VG-800 name → curated id, so the overlapping entries are skipped and the
// curated (correct-register) stack is what ships.
const CURATED_BY_VG_NAME = {
  C6: 'c6', A6: 'a6', 'C6/A7': 'c6-a7',
  E7: 'e7', E13: 'e13', 'E9 lap': 'e9-lap',
  B11: 'b11', 'Cyrus Hybrid': 'cyrus-hybrid',
  'Open E': 'open-e', 'Open D': 'open-d', 'Open G Dobro': 'open-g-dobro',
  'Open G low': 'open-g-low', 'Open A high': 'open-a-high',
};

// ── 2. VG-800 entries ──────────────────────────────────────────────────────
const GROUP_FOR_FAMILY = {
  Common: 'common',
  Drop: 'drop',
  Artists: 'artist',
  'Open Majors': 'open',
  '6th Family': 'lap-steel',
  'Dominant / 7th': 'lap-steel',
  Other: 'lap-steel',
};

/**
 * A tuning is flagged `reentrant` when its stack does not ascend — a real
 * property of the instrument (a high-strung guitar, a re-entrant ukulele),
 * not a data error. Surfaced in the UI so the odd-looking diagram reads as
 * intentional.
 */
function isReentrant(midi) {
  for (let i = 1; i < midi.length; i++) if (midi[i] < midi[i - 1]) return true;
  return false;
}

const out = [...CURATED];
const seen = new Set(out.map((t) => t.id));
const push = (t) => {
  if (seen.has(t.id)) throw new Error('duplicate tuning id: ' + t.id);
  seen.add(t.id);
  out.push(t);
};

const tipFor = (name) => D.TUNING_TIPS[name] ?? null;

// Corrections applied to the VG-800 data. The VG-800 only needs a tuning's
// pitch-class cluster, so a couple of entries are stored in a shape that is
// wrong for a fretboard diagram.
const MIDI_OVERRIDE = {
  // The VG-800 stores the cuatro's pitches sorted ascending (B3 D4 F♯4 A4),
  // which contradicts its own "A D F♯ B" spelling. The Venezuelan cuatro is
  // re-entrant: strings 4→1 are A4 D4 F♯4 B3, with the B an octave down.
  Cuatro: [69, 62, 66, 59],
};

for (const fam of D.FAMILIES) {
  for (const t of fam.tunings) {
    if (CURATED_BY_VG_NAME[t.name]) continue;
    const midi = midiFromOffsets(t.offsets);
    const spellings = t.notes.split(/\s+/).map(prettify);
    const tip = tipFor(t.name);
    push({
      id: slug(t.name),
      name: t.name,
      group: GROUP_FOR_FAMILY[fam.family] ?? 'common',
      midi,
      spellings,
      description: tip?.desc ?? t.comment ?? t.ref ?? undefined,
      song: tip?.song,
      reentrant: isReentrant(midi) || undefined,
    });
  }
}

for (const t of D.MODES) {
  const midi = midiFromOffsets(t.offsets);
  const tip = tipFor(t.name);
  push({
    id: slug(t.name),
    name: t.name,
    group: 'mode',
    midi,
    spellings: t.notes.split(/\s+/).map(prettify),
    description: tip?.desc,
    song: tip?.song,
    reentrant: isReentrant(midi) || undefined,
  });
}

for (const t of D.ETHNIC) {
  const midi = MIDI_OVERRIDE[t.name] ?? t.pitches;
  const tip = tipFor(t.name);
  push({
    id: slug(t.name),
    name: t.name,
    group: 'world',
    midi,
    spellings: t.notes.split(/\s+/).map(prettify),
    description: tip?.desc ?? t.ref,
    song: tip?.song,
    reentrant: isReentrant(midi) || undefined,
  });
}

for (const t of D.STEEL) {
  const tip = tipFor(t.name);
  push({
    id: 'ps-' + slug(t.name),
    name: t.name,
    group: 'pedal-steel',
    midi: t.midi,
    spellings: t.spell.split(/\s+/).map(prettify),
    description: tip?.desc ?? t.sub,
    song: tip?.song,
    copedent: t.copedent, // 'e9' | 'c6' — which pedal set this neck carries
    reentrant: isReentrant(t.midi) || undefined,
  });
}

// ── Validate ───────────────────────────────────────────────────────────────
const problems = [];
for (const t of out) {
  if (t.midi.length !== t.spellings.length)
    problems.push(`${t.id}: ${t.midi.length} strings vs ${t.spellings.length} spellings`);
  if (t.midi.length < 3) problems.push(`${t.id}: only ${t.midi.length} strings`);
  t.spellings.forEach((s, i) => {
    if (nameToPc(s) !== pcOf(t.midi[i]))
      problems.push(`${t.id}: string ${i} spelled ${s} but midi ${t.midi[i]} is ${SHARP[pcOf(t.midi[i])]}`);
  });
  if (t.midi.some((m) => m < 21 || m > 108)) problems.push(`${t.id}: midi out of piano range`);
}
if (problems.length) {
  console.error('VALIDATION FAILED:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}

// A tuning displays in flats when its own spelling does — so the whole board
// (markers, chord names, string labels) stays in one accidental system.
for (const t of out) {
  const flats = t.spellings.filter((s) => s.includes('♭')).length;
  const sharps = t.spellings.filter((s) => s.includes('♯')).length;
  if (flats > sharps) t.preferFlats = true;
}

// ── Emit ───────────────────────────────────────────────────────────────────
const esc = (s) => JSON.stringify(s);
const lines = out.map((t) => {
  const parts = [
    `    id: ${esc(t.id)}`,
    `name: ${esc(t.name)}`,
    `group: ${esc(t.group)}`,
    `midi: [${t.midi.join(', ')}]`,
    `spellings: [${t.spellings.map(esc).join(', ')}]`,
  ];
  if (t.description) parts.push(`description:\n      ${esc(t.description)}`);
  if (t.song) parts.push(`song: ${esc(t.song)}`);
  if (t.copedent) parts.push(`copedent: ${esc(t.copedent)}`);
  if (t.reentrant) parts.push(`reentrant: true`);
  if (t.preferFlats) parts.push(`preferFlats: true`);
  return `  {\n${parts.join(',\n    ').replace(/^ {4}id/, '    id')},\n  },`;
});

const header = `/**
 * The tuning catalog — ${out.length} tunings.
 *
 * GENERATED by scripts/build-tunings.mjs. Edit that script (or the curated
 * block inside it) rather than this file.
 *
 * \`midi\` runs LOW STRING FIRST: index 0 is the string drawn at the bottom of
 * the fretboard (string 6 on a guitar, string 10 on a pedal steel). Values are
 * MIDI note numbers, so C4 = middle C = 60, pitch class = midi % 12.
 *
 * Sources: lap-steel and open-major stacks curated and cross-checked against
 * John Ely's master list, Peterson tuner presets, papadafoe.com, steelc6th.com
 * and the Steel Guitar Forum; everything else from the VG-800 tuner catalog
 * (github.com/fxcircus/vg800_midi_control).
 */

export type TuningGroup =
  | 'lap-steel'
  | 'open'
  | 'common'
  | 'drop'
  | 'artist'
  | 'mode'
  | 'world'
  | 'pedal-steel';

export interface Tuning {
  id: string;
  name: string;
  group: TuningGroup;
  /** MIDI note numbers, low string first. 3–10 entries. */
  midi: number[];
  /** Display spellings matching \`midi\`, low string first. */
  spellings: string[];
  /** One-line musician answer to "why would I pick this?" */
  description?: string;
  /** A signature recording in this tuning. */
  song?: string;
  /** Which pedal-steel copedent this neck carries (see copedents.ts). */
  copedent?: 'e9' | 'c6';
  /** Stack does not ascend — high-strung, re-entrant, or octave-doubled. */
  reentrant?: boolean;
  /** Read this tuning in flats (its own spelling is flat-leaning). */
  preferFlats?: boolean;
}

export const TUNINGS: Tuning[] = [
`;

const footer = `];

export const GROUP_ORDER: TuningGroup[] = [
  'lap-steel',
  'open',
  'pedal-steel',
  'common',
  'drop',
  'artist',
  'mode',
  'world',
];

export const GROUP_LABELS: Record<TuningGroup, string> = {
  'lap-steel': 'Lap steel',
  open: 'Open majors',
  'pedal-steel': 'Pedal steel',
  common: 'Guitar — common',
  drop: 'Guitar — drop',
  artist: 'Artist tunings',
  mode: 'Modal (white keys)',
  world: 'World instruments',
};

export const DEFAULT_TUNING_ID = 'c6';
export const CUSTOM_TUNING_ID = 'custom';

/** Sanity bounds for the custom tuning editor (E1 … C7). */
export const CUSTOM_MIDI_MIN = 28;
export const CUSTOM_MIDI_MAX = 96;
export const MIN_STRINGS = 3;
export const MAX_STRINGS = 10;

const BY_ID = new Map(TUNINGS.map((t) => [t.id, t]));

export function getTuning(id: string): Tuning | undefined {
  return BY_ID.get(id);
}
`;

writeFileSync(resolve(HERE, '../src/lib/tunings.ts'), header + lines.join('\n') + '\n' + footer);
console.log(`wrote ${out.length} tunings`);
const byGroup = {};
for (const t of out) byGroup[t.group] = (byGroup[t.group] ?? 0) + 1;
console.log(byGroup);
