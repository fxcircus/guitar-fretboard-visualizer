# Fretboard Visualizer

**[Open the app →](https://fxcircus.github.io/guitar-fretboard-visualizer/)**

A fretboard for the other 66 tunings. Pick one of **67 stacks** — lap steel,
pedal steel, open, drop, artist and world instruments — and the board answers
the questions a player actually asks:

- **What chord am I sounding?** Lay the bar at a fret and read the name, the
  formula, and the notes.
- **What chords can I play?** One card per chord this tuning can actually
  voice: the key's diatonic degrees first (unplayable degrees are omitted, not
  greyed), then every other available chord. Click a card and the bar snaps to
  its fret with the grip lit. Chords the tuning cannot bar simply do not
  appear.
- **What key am I in?** The tuning *is* the key — C6 lives in C major, E13 in
  E Mixolydian, a Lydian mode neck in C Lydian. The key, the degree cards,
  the note spelling (♯ vs ♭ follows the key signature), and the **Map** view's
  scale all derive from the tuning you picked. There are deliberately no key,
  accidental, or fret-count selectors — the board is always 12 frets, because
  the first twelve hold every available chord (fret 12 just repeats fret 0 an
  octave up).

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

## Grips: which strings a chord may use

A grip is not just a run of adjacent strings — steel players *block* the
strings they skip (pick/palm blocking is named, taught technique), and the
canonical vocabulary depends on it: the standard no-pedal E9 major grips are
strings 3-4-5, 4-5-6, **5-6-8**, **6-8-10** and **4-6-10** (the "Get A Grip"
chart: *"notice we are skipping 7, 9, 1, 2 since they are not part of major
chord"*), and C6's workhorse triads are **9-6-4** and **8-5-3** (Steel Guitar
Forum, "Basic C6th Chord Grips"; Herb Steiner's C6 essay). The V-major triad
on E9's chromatic strings 1-2-5 is likewise documented practice.

So the engine models grips as: **3–4 picked strings** (thumbpick plus 2–3
fingerpicks) inside a **span of up to 7 consecutive strings**, skips blocked
by hand — plus **contiguous runs of any size** for strums. That takes one E9
bar position from 5 chords (contiguous-only) to the 15 a player actually has,
including E7 via string 9's ♭7 and B major on 1-2-5, and it lets the modal
scale-ladder necks voice their own diatonic triads (C major is strings 1-3-5
of the white-key neck). Contiguous grips win naming ties, so the easy grip is
always the one shown.

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

## How the key is derived

`src/lib/keyFromTuning.ts` resolves each tuning's key in three steps: an
explicit key pinned in the catalog (mode necks, guitar and pedal-steel tunings,
songs) wins; otherwise the identified open-stack chord decides — its root is the
key root, its quality picks the scale (major family → Major, dominant →
Mixolydian, m6 → Dorian, 7♭9 → Phrygian dominant…); and an unnameable stack
falls back to the lowest string with the first common scale that keeps every
open string diatonic. Custom tunings re-derive live as you retune strings.

## Pedals (parked)

The pedal/copedent engine — the Emmons E9 and C6 mechanisms plus the virtual
pedal set, all expressed as per-string semitone pulls — lives on in
`src/lib/copedents.ts` with its tests, but is out of the UI for now. It is the
integration seam for the planned merge into the
[VG-800 controller](https://github.com/fxcircus/vg800_midi_control), where real
pedals exist.

## The steel tone

The default **Steel** voice is a physically-modelled string bank, not an
oscillator. Ten Extended Karplus-Strong strings (after Julius O. Smith's EKS)
run in an AudioWorklet (`src/lib/steel-processor.js`): a delay-line loop with
linear-phase FIR damping, frequency-independent 6 s sustain, a 4th-order
Lagrange fractional-delay read (stable under the gliding pitch of the bar
scoop and the delayed-onset 5.7 Hz bar vibrato), and a velocity-shaped noise
burst with a pick-position comb for the pluck.

The bank feeds a steel amp bus (`src/lib/steelEngine.ts`): pickup resonance,
a pedal-steel compressor squeeze, a blackface tone stack, subtle stereo
chorus (the shimmer), one quiet echo repeat, and a generated spring-reverb
impulse — no audio assets, the whole tone is code.

The model is verified objectively with OfflineAudioContext renders: pitch
within ±0.5 cents from 110–880 Hz, per-harmonic decay (trebles die before the
fundamental, as on a real string), a 6-note chord losing only ~8 dB over two
seconds of ring, and the pick transient surviving the compressor. Browsers
without AudioWorklet fall back to the plain oscillator voices ('Sine'/'Saw').

Chords play in one of three modes (the Play row in the sound menu): **Strum**
picks the strings low to high, **Together** sounds them as one block, and
**Swell** plays them behind a closed volume pedal that opens over ~0.8 s —
the pick transient never sounds, the chord just blooms, the classic steel
fade-in. The mode travels in shared links like the tone does.

## Sharing

The whole board lives in the URL: tuning, bar position, selected grip, view,
tone. Hit **Share** and send the link; it opens exactly what you were
looking at. Your last board is also remembered locally.

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
  keyFromTuning.ts derives the key from the tuning
  copedents.ts     pedal / knee-lever sets (parked, for the VG-800 merge)
  musicTheory.ts   note spelling, scales, diatonic chords
  audio.ts         the voice engine: routes to the steel bank or oscillators
  steel-processor.js  10-voice Extended Karplus-Strong string bank (AudioWorklet)
  steelEngine.ts   the steel amp bus: pickup, squeeze, tone stack, shimmer
  chordCards.ts    the card surface: every playable chord, degrees first
  appState.ts      URL and localStorage round-tripping
src/components/
  Fretboard.tsx    the board (bar and map views, wood finishes, realistic bars)
  ../lib/boardStyles.ts  finishes, inlay styles, bar geometry (from Claude Design)
  TuningPicker.tsx searchable catalog menu
```

The chord engine and the catalog are plain TypeScript with no React or DOM
dependency — reusable on their own.

## Credits

Extracted from the Lap Steel block in
[music_blocks](https://github.com/fxcircus/music_blocks); tuning catalog from
[vg800_midi_control](https://github.com/fxcircus/vg800_midi_control).

MIT licensed.
