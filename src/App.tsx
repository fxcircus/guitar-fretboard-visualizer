import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';

import Fretboard from './components/Fretboard';
import TuningPicker from './components/TuningPicker';
import { Chip, Hint, IconBtn, Label, Mono, Panel, Row, Select, Toggle, ToggleBtn } from './components/ui';
import { darkTheme, lightTheme } from './theme';

import {
  chordLabel,
  chordsAtFret,
  displayNote,
  displayPitch,
  identifyChords,
  midiPc,
  scanLabelsFor,
  type ChordMatch,
  type ChordQuality,
} from './lib/chordEngine';
import {
  CUSTOM_MIDI_MAX,
  CUSTOM_MIDI_MIN,
  CUSTOM_TUNING_ID,
  MAX_STRINGS,
  MIN_STRINGS,
  TUNINGS,
} from './lib/tunings';
import { applyPulls, normalizePulls, resolveTuning } from './lib/tuningState';
import { deriveKey } from './lib/keyFromTuning';
import { collectChordCards, type ChordCard } from './lib/chordCards';
import { noteToPitchClass } from './lib/musicTheory';
import { FretboardAudio, TONES, TONE_NAMES, type ToneName } from './lib/audio';
import {
  MAX_FRET,
  loadState,
  saveState,
  shareUrl,
  watchHash,
  type AppState,
} from './lib/appState';

const REPO_URL = 'https://github.com/fxcircus/guitar-fretboard-visualizer';
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fontFamily};
    -webkit-font-smoothing: antialiased;
  }
  button { font-family: inherit; }
`;

const Shell = styled.div`
  max-width: 1320px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;

const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 800;
  letter-spacing: -0.01em;
`;

const Tagline = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const HeaderActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const PlainBtn = styled.button`
  padding: 5px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ChordNameBig = styled.span<{ $quality: ChordQuality | null }>`
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
  color: ${({ $quality, theme }) => {
    switch ($quality) {
      case 'maj':
        return theme.colors.primary;
      case 'min':
        return theme.colors.accent;
      case 'dom':
        return theme.colors.warning;
      default:
        return theme.colors.text;
    }
  }};
`;

const StrumBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  margin-left: auto;
  flex-shrink: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 13px;

  &:hover {
    background: ${({ theme }) => `${theme.colors.primary}22`};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const StringBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  background: ${({ theme }) => theme.colors.inputBackground};
  min-width: 48px;
`;

const StringVal = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  text-align: center;
  line-height: 1.15;
`;

const Card = styled(Chip)`
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 48px;
`;

const Sub = styled.span`
  font-weight: 500;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// Chord symbols are case-carrying (Am7 ≠ AM7), so they never go through the
// uppercased `Label`.
const KeyName = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 800;
  color: ${({ theme }) => theme.colors.accent};
`;

const SoundingRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const SoundingInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const Footer = styled.footer`
  padding: ${({ theme }) => theme.spacing.md} 0;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.6;

  a {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => loadState());
  const [themeName, setThemeName] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('gfv.theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      /* ignore */
    }
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });
  const [copied, setCopied] = useState(false);

  const patch = useCallback((updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => saveState(state), [state]);
  useEffect(() => watchHash(setState), []);
  useEffect(() => {
    try {
      localStorage.setItem('gfv.theme', themeName);
    } catch {
      /* ignore */
    }
  }, [themeName]);

  // ── Tuning ───────────────────────────────────────────────────────────────
  const baseTuning = useMemo(
    () => resolveTuning(state.tuningId, state.customTuning),
    [state.tuningId, state.customTuning]
  );
  const stringCount = baseTuning.midi.length;
  const pulls = useMemo(
    () => normalizePulls(state.pulls, stringCount),
    [state.pulls, stringCount]
  );
  const { tuning, pulled } = useMemo(() => applyPulls(baseTuning, pulls), [baseTuning, pulls]);

  // The tuning IS the key: derived from the catalog entry or the identified
  // open-stack chord. Custom tunings re-derive live as strings are retuned.
  const tuningKey = useMemo(() => deriveKey(baseTuning), [baseTuning]);

  // Accidentals are always automatic: the tuning's own lean wins, else the
  // key's spelled scale decides (C minor reads in flats, B minor in sharps).
  const flats =
    baseTuning.preferFlats ??
    tuningKey.notes.filter((n) => n.includes('♭')).length >
      tuningKey.notes.filter((n) => n.includes('♯')).length;

  const chords = useMemo(
    () => chordsAtFret(tuning.midi, state.barFret),
    [tuning, state.barFret]
  );

  // The selected grip (chip) lives in the URL state so a shared board lights
  // the same chord. It resets when the BASE tuning's pitch content changes —
  // guarded so a shared link's chip survives the first render.
  const baseSignature = baseTuning.midi.join(',');
  const sigRef = useRef(baseSignature);
  useEffect(() => {
    if (sigRef.current === baseSignature) return;
    sigRef.current = baseSignature;
    patch({ chip: 0 });
  }, [baseSignature, patch]);

  const selected = chords.length ? chords[Math.min(state.chip, chords.length - 1)] : null;
  const rootPc = selected ? selected.match.rootPc : null;

  const scanLabels = useMemo(
    () => scanLabelsFor(selected ? selected.match : null, state.barFret, MAX_FRET, flats),
    [selected, state.barFret, flats]
  );
  const activeStringIdxs = useMemo(
    () => (selected ? selected.strings : tuning.midi.map((_, i) => i)),
    [selected, tuning]
  );
  const activeStrings = useMemo(() => (selected ? new Set(selected.strings) : null), [selected]);

  // ── Key / scale (derived from the tuning) ────────────────────────────────
  const scaleInfo = useMemo(() => {
    const core = tuningKey.notes;
    const pcs = new Set(core.map((n) => (((noteToPitchClass(n) ?? 0) % 12) + 12) % 12));
    const keyRootPc = tuningKey.rootPc;

    // Scale-degree label per pitch class, spelled from the scale's own note
    // names (so Lydian's raised 4th reads ♯4, not ♭5).
    const degreeLabels = new Map<number, string>();
    const rootLetter = tuningKey.root[0]?.toUpperCase();
    const majorSemis = [0, 2, 4, 5, 7, 9, 11];
    core.forEach((name) => {
      const letter = name[0]?.toUpperCase();
      const pc = (((noteToPitchClass(name) ?? 0) % 12) + 12) % 12;
      if (!letter || !rootLetter) return;
      const degNum = ((LETTERS.indexOf(letter) - LETTERS.indexOf(rootLetter) + 7) % 7) + 1;
      const actual = (pc - keyRootPc + 12) % 12;
      const diff = ((actual - majorSemis[degNum - 1] + 18) % 12) - 6;
      const acc = diff > 0 ? '♯'.repeat(diff) : diff < 0 ? '♭'.repeat(-diff) : '';
      degreeLabels.set(pc, acc + degNum);
    });
    return { core, pcs, keyRootPc, degreeLabels };
  }, [tuningKey]);

  // ── The chord cards: every chord this tuning can play, one card each ────
  const cards = useMemo(
    () => collectChordCards(tuning.midi, tuningKey.notes, tuningKey.rootPc),
    [tuning, tuningKey]
  );

  // Snap the bar to a card's fret AND light that grip: pick the chip whose
  // string group is the card's grip, else a same-name chip, else the chip
  // sounding the same pitch-class set (chordsAtFret may have named the
  // identical notes from a different root — the alias line then explains).
  const snapToCard = useCallback(
    (card: Pick<ChordCard, 'fret' | 'strings' | 'match'>) => {
      const there = chordsAtFret(tuning.midi, card.fret);
      let idx = there.findIndex(
        (c) => c.strings.length === card.strings.length && c.strings[0] === card.strings[0]
      );
      if (idx < 0) {
        idx = there.findIndex(
          (c) => c.match.rootPc === card.match.rootPc && c.match.suffix === card.match.suffix
        );
      }
      if (idx < 0) {
        const cardPcs = new Set(card.strings.map((s) => midiPc(tuning.midi[s] + card.fret)));
        idx = there.findIndex((c) => {
          const cPcs = new Set(c.strings.map((s) => midiPc(tuning.midi[s] + card.fret)));
          return cPcs.size === cardPcs.size && [...cardPcs].every((pc) => cPcs.has(pc));
        });
      }
      patch(idx >= 0 ? { barFret: card.fret, chip: idx } : { barFret: card.fret });
    },
    [tuning, patch]
  );

  // A card is "the one sounding" when it names the currently selected grip.
  const activeCardKey = selected ? `${selected.match.rootPc}:${selected.match.suffix}` : null;
  const cardKey = (m: ChordMatch) => `${m.rootPc}:${m.suffix}`;

  // The 6th/m7-style alias of the selected group ("C6 = Am7")
  const alias = useMemo(() => {
    if (!selected) return null;
    const groupMidi = selected.strings.map((s) => tuning.midi[s] + state.barFret);
    const other = identifyChords(
      groupMidi.map(midiPc),
      midiPc(Math.min(...groupMidi))
    ).find((m) => m.rootPc !== selected.match.rootPc);
    return other ? chordLabel(other, flats) : null;
  }, [selected, tuning, state.barFret, flats]);

  const soundingNotes = useMemo(
    () =>
      activeStringIdxs
        .map((s) => displayNote(midiPc(tuning.midi[s] + state.barFret), flats))
        .join(' · '),
    [activeStringIdxs, tuning, state.barFret, flats]
  );

  // ── Audio ────────────────────────────────────────────────────────────────
  const audioRef = useRef<FretboardAudio | null>(null);
  const [playingStrings, setPlayingStrings] = useState<Set<number>>(new Set());
  if (!audioRef.current) {
    audioRef.current = new FretboardAudio();
    audioRef.current.onPlayingChange = setPlayingStrings;
  }
  const audio = audioRef.current;
  audio.tone = state.tone;
  useEffect(() => () => audioRef.current?.dispose(), []);
  // Silence anything ringing when the board changes underneath it.
  useEffect(() => {
    audioRef.current?.stopAll();
  }, [baseSignature, state.barFret]);

  const strum = useCallback(
    (strings: number[]) => void audio.strum(tuning.midi, strings, state.barFret),
    [audio, tuning, state.barFret]
  );

  const handleNoteClick = useCallback(
    (stringIdx: number, fret: number) => {
      if (state.view === 'map') {
        void audio.pluck(tuning.midi[stringIdx] + fret);
        return;
      }
      strum(activeStringIdxs.includes(stringIdx) ? activeStringIdxs : [stringIdx]);
    },
    [state.view, audio, tuning, strum, activeStringIdxs]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  // (Pedals/copedents are out of the UI for now — the engine for them lives on
  // in lib/copedents.ts for the planned VG-800 integration. `pulls` in the
  // state still applies, so pedal-era share links keep sounding right.)
  const handleTuningChange = (id: string) => {
    if (id === CUSTOM_TUNING_ID) {
      patch({ tuningId: id, customTuning: [...baseTuning.midi], pulls: [], chip: 0 });
    } else {
      patch({ tuningId: id, pulls: [], chip: 0 });
    }
  };

  const editString = (i: number, delta: number) => {
    const next = [...baseTuning.midi];
    next[i] = Math.min(CUSTOM_MIDI_MAX, Math.max(CUSTOM_MIDI_MIN, next[i] + delta));
    patch({ customTuning: next });
  };

  const addString = () => {
    if (stringCount >= MAX_STRINGS) return;
    const next = [...baseTuning.midi, Math.min(CUSTOM_MIDI_MAX, baseTuning.midi[stringCount - 1] + 5)];
    patch({ customTuning: next, pulls: [] });
  };

  const removeString = () => {
    if (stringCount <= MIN_STRINGS) return;
    patch({ customTuning: baseTuning.midi.slice(0, -1), pulls: [] });
  };

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(state));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the URL bar already holds the same link */
    }
  };

  const setBarFret = useCallback((f: number) => patch({ barFret: f }), [patch]);

  const theme = themeName === 'dark' ? darkTheme : lightTheme;

  const renderCard = (card: ChordCard) => (
    <Card
      key={`${card.roman ?? ''}${cardKey(card.match)}`}
      $active={activeCardKey === cardKey(card.match)}
      aria-pressed={activeCardKey === cardKey(card.match)}
      onClick={() => snapToCard(card)}
      title={`${chordLabel(card.match, flats)} — bar at fret ${card.fret}, strings ${
        stringCount - card.strings[0]
      }–${stringCount - card.strings[card.strings.length - 1]}`}
    >
      {card.roman && <Sub>{card.roman}</Sub>}
      {chordLabel(card.match, flats)}
      <Sub>fret {card.fret}</Sub>
    </Card>
  );

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Shell>
        <Header>
          <Title>Fretboard Visualizer</Title>
          <Tagline>
            {TUNINGS.length} tunings · slide the bar, read the chord
          </Tagline>
          <HeaderActions>
            <PlainBtn onClick={copyShare} title="Copy a link to exactly this board">
              {copied ? 'Copied ✓' : 'Share'}
            </PlainBtn>
            <PlainBtn
              onClick={() => setThemeName((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="Switch theme"
            >
              {themeName === 'dark' ? 'Light' : 'Dark'}
            </PlainBtn>
          </HeaderActions>
        </Header>

        <Panel>
          <Row>
            <TuningPicker
              tuningId={state.tuningId}
              current={baseTuning}
              onSelect={handleTuningChange}
            />

            <Toggle role="group" aria-label="Neck view">
              <ToggleBtn
                $active={state.view === 'bar'}
                aria-pressed={state.view === 'bar'}
                onClick={() => patch({ view: 'bar' })}
                title="One straight bar across every string — how a lap steel is played"
              >
                Bar
              </ToggleBtn>
              <ToggleBtn
                $active={state.view === 'map'}
                aria-pressed={state.view === 'map'}
                onClick={() => patch({ view: 'map' })}
                title="Every note of the key, everywhere on the neck"
              >
                Map
              </ToggleBtn>
            </Toggle>

            <Select
              value={state.tone}
              onChange={(e) => patch({ tone: e.target.value as ToneName })}
              aria-label="Tone"
              title="Synth voice"
            >
              {TONE_NAMES.map((t) => (
                <option key={t} value={t}>
                  {TONES[t].label}
                </option>
              ))}
            </Select>
          </Row>

          {(baseTuning.description || baseTuning.song) && (
            <Hint>
              {baseTuning.description}
              {baseTuning.song && (
                <>
                  {' '}
                  <strong>{baseTuning.song}</strong>
                </>
              )}
              {baseTuning.reentrant && (
                <>
                  {' '}
                  <em>Re-entrant: the strings do not run low-to-high.</em>
                </>
              )}
            </Hint>
          )}

          {state.tuningId === CUSTOM_TUNING_ID && (
            <Row>
              <Label>Strings</Label>
              {baseTuning.midi.map((m, i) => (
                <StringBox key={i}>
                  <IconBtn onClick={() => editString(i, 1)} title="Tune up a semitone">
                    ▲
                  </IconBtn>
                  <StringVal title={`String ${stringCount - i}`}>
                    {displayPitch(m, flats)}
                  </StringVal>
                  <IconBtn onClick={() => editString(i, -1)} title="Tune down a semitone">
                    ▼
                  </IconBtn>
                </StringBox>
              ))}
              <Chip onClick={removeString} $disabled={stringCount <= MIN_STRINGS}>
                − string
              </Chip>
              <Chip onClick={addString} $disabled={stringCount >= MAX_STRINGS}>
                + string
              </Chip>
            </Row>
          )}

          <Row>
            <Label>Key</Label>
            <KeyName>
              {tuningKey.root} {tuningKey.scale}
            </KeyName>
            <Mono>{scaleInfo.core.join(' ')}</Mono>
            <Hint>from the tuning — pick a different tuning to change it</Hint>
          </Row>

          {(cards.degrees.length > 0 || cards.others.length > 0) && (
            <Row
              role="group"
              aria-label={`Chords this tuning can play, in ${tuningKey.root} ${tuningKey.scale}`}
            >
              {cards.degrees.map(renderCard)}
              {cards.others.map(renderCard)}
            </Row>
          )}
          {cards.degrees.length === 0 && cards.others.length === 0 && (
            <Hint>
              This tuning stacks no nameable chord — it is a scale ladder or a drone.{' '}
              <strong>Map</strong> view shows what it is for.
            </Hint>
          )}

          <SoundingRow>
            <SoundingInfo>
              <Label>
                {state.view === 'map'
                  ? `${tuningKey.root} ${tuningKey.scale} across the neck`
                  : `Sounding — ${state.barFret === 0 ? 'open strings' : `bar at fret ${state.barFret}`}`}
              </Label>
              <ChordNameBig $quality={selected ? selected.match.quality : null}>
                {selected ? chordLabel(selected.match, flats) : soundingNotes || '—'}
              </ChordNameBig>
              <Hint>
                {alias ? `= ${alias} · ` : ''}
                {selected
                  ? `${selected.match.formulaName} · ${soundingNotes}`
                  : 'no chord name for these strings'}
              </Hint>
            </SoundingInfo>
            <StrumBtn
              onClick={() => strum(activeStringIdxs)}
              title="Strum the highlighted strings"
              aria-label="Strum the highlighted strings"
            >
              ▶
            </StrumBtn>
          </SoundingRow>
        </Panel>

        <Fretboard
          midi={tuning.midi}
          spellings={tuning.spellings}
          maxFret={MAX_FRET}
          barFret={state.barFret}
          onBarFretChange={setBarFret}
          view={state.view}
          activeStrings={activeStrings}
          rootPc={rootPc}
          rootHasFlat7={selected ? selected.match.intervals.includes(10) : false}
          playingStrings={playingStrings}
          onNoteClick={handleNoteClick}
          scanLabels={scanLabels}
          scalePcs={scaleInfo.pcs}
          keyRootPc={scaleInfo.keyRootPc}
          scaleDegreeLabels={scaleInfo.degreeLabels}
          pulled={pulled}
          baseSpellings={baseTuning.spellings}
          flats={flats}
        />

        <Footer>
          <p>
            Open tunings are bar-centric: the open strings <em>are</em> a chord, laying a bar at
            fret <em>n</em> transposes it by <em>n</em> semitones, and the chord you get depends on
            which strings you pick. Every reading on this page comes from that model —{' '}
            <strong>Bar</strong> shows what one straight bar sounds; <strong>Map</strong> shows the
            whole key across the neck.
          </p>
          <p>
            MIT licensed ·{' '}
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              source and how to add a tuning
            </a>{' '}
            · tuning data from{' '}
            <a
              href="https://github.com/fxcircus/vg800_midi_control"
              target="_blank"
              rel="noreferrer"
            >
              vg800_midi_control
            </a>{' '}
            and{' '}
            <a href="https://github.com/fxcircus/music_blocks" target="_blank" rel="noreferrer">
              music_blocks
            </a>
            .
          </p>
        </Footer>
      </Shell>
    </ThemeProvider>
  );
};

export default App;
