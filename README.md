# Fretboard Visualizer

**[Open the app →](https://fxcircus.github.io/guitar-fretboard-visualizer/)**

A fretboard for the other 66 tunings. Pick one of **67 stacks** — lap steel,
pedal steel, open, drop, artist and world instruments — and the board answers
the questions a player actually asks:

- **What chord am I sounding?** Lay the bar at a fret and read the name, the
  formula, and the notes. Every chord hiding in an adjacent string group is
  listed as a chip.
- **Where do I play *this* chord?** Look up any chord and the board rings the
  frets where a straight bar voices it. When no straight bar can, it offers the
  two-string **slants** that will.
- **What does the key look like here?** Switch to **Map** and the whole scale
  lights up across the neck, degree-labelled.

No install, no account, no assets to download. It is one static page; the sound
is synthesised in the browser.

---

## Why a bar and not fingers

Most fretboard tools model a hand: shapes, stretches, barre chords. Open tunings
do not work that way. The open strings *are* a chord, laying a rigid bar at fret
*n* transposes that chord by *n* semitones, and the chord you get depends
entirely on **which strings you pick**. C6 gives you C major on the bottom three
strings and its relative A minor on the top three, under the same bar, at every
fret.

Everything in this app comes out of that one model — which is why it works
identically for a 3-string bağlama and a 10-string pedal steel.

## What's in the catalog

| Group | Count | |
|---|---|---|
| Lap steel | 9 | C6, A6, C6/A7, E7, E13, E9, B11 (Byrd and T.K. Smith), Cyrus Hybrid |
| Open majors | 5 | Open E, D, G (Dobro and low), A |
| Pedal steel | 4 | E9 Nashville, E9 Lanois, C6 Swing/Jazz, B6 Universal — 10 strings each |
| Guitar — common | 6 | Standard, DADGAD, Nashville high-strung, Baritone, Bass VI, E♭ |
| Guitar — drop | 6 | Drop D through Drop A |
| Artist tunings | 16 | Fripp NST, Nick Drake, Joni Mitchell, Radiohead, Sonic Youth, Keith Richards, … |
| Modal | 8 | The seven modes on C, plus the white-key ladder they come from |
| World instruments | 13 | Mandolin, oud, sitar, charango, banjo, ukulele, bağlama, … |

Plus a **custom** tuning editor: 3 to 10 strings, any pitch.

### Where the data comes from

The lap-steel and open-major stacks were cross-checked against John Ely's master
list / hawaiiansteel.com, Peterson tuner presets, papadafoe.com, steelc6th.com
and the Steel Guitar Forum. Everything else was imported from the
[VG-800 tuner](https://github.com/fxcircus/vg800_midi_control), which stores
tunings as per-string offsets from standard E A D G B E; those offsets are
applied to the standard stack to recover MIDI. Where both sources have a tuning,
the curated stack wins — the VG-800 picks the *nearest* pitch per string (its
shifter is bounded), which is right for retuning a real guitar but puts C6 in
the wrong register for a diagram.

`src/lib/tunings.ts` is generated. Regenerate with `npm run tunings`; the tests
in `src/lib/tunings.test.ts` are the encoding contract.

## Pedals

Pedal-steel necks carry their real copedent — the standard Emmons **E9** set
(pedals A/B/C, LKL, LKR, vertical) and the **C6** back-neck mechanism. Every
other tuning gets a set of *virtual* pedals: the same classic moves (raise the
5th, lower the 3rd, the I → IV cry) applied to whatever chord the bar is
currently sounding, so you can hear what a lap steel tuning would do with a
mechanism it does not have.

Controls are described the way a steel mechanic describes them — by which chord
degree they move and by how much — and resolve to strings by finding every
string carrying that degree. Underneath, a pedal and a hand-dialled
behind-the-bar **pull** are the same thing, so you can engage a pedal and then
nudge one string off it.

## Sharing

The whole board lives in the URL: tuning, bar position, key, scale, pulls,
looked-up chord, neck length. Hit **Share** and send the link; it opens exactly
what you were looking at. Your last board is also remembered locally.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # the engine and catalog gates
npm run build    # static output in dist/
```

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml`. The
workflow enables Pages on its first run, so a fork deploys without touching
Settings.

## Adding a tuning

Open `scripts/build-tunings.mjs` and add an entry to the `CURATED` array:

```js
{
  id: 'e6',
  name: 'E6',
  group: 'lap-steel',
  midi: [40, 47, 52, 56, 59, 64],   // low string FIRST, MIDI numbers (C4 = 60)
  spellings: ['E', 'B', 'E', 'G♯', 'B', 'E'],
  description: 'One line: why would a player pick this?',
},
```

Then `npm run tunings && npm test`. The generator validates that every spelling
matches its MIDI pitch class and that the stack is in range; the tests check
that the chord engine names the open stack the way the tuning is named. Please
verify a new stack against at least two independent sources before adding it — a
plausible-looking wrong tuning is worse than a missing one.

## Layout

```
src/lib/
  chordEngine.ts   identify chords, find bar positions, find slants
  tunings.ts       the catalog (generated)
  tuningState.ts   custom tunings and per-string pulls
  copedents.ts     pedal / knee-lever sets
  musicTheory.ts   note spelling, scales, diatonic chords
  audio.ts         Web Audio voices, with the bar scoop
  appState.ts      URL and localStorage round-tripping
src/components/
  Fretboard.tsx    the board (bar view and map view)
  TuningPicker.tsx searchable catalog menu
```

The chord engine and the catalog are plain TypeScript with no React or DOM
dependency — reusable on their own.

## Credits

Extracted from the Lap Steel block in
[music_blocks](https://github.com/fxcircus/music_blocks); tuning catalog from
[vg800_midi_control](https://github.com/fxcircus/vg800_midi_control).

MIT licensed.
