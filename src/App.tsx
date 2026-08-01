import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { ThemeProvider, createGlobalStyle, keyframes } from 'styled-components';

import Fretboard from './components/Fretboard';
import TuningPicker from './components/TuningPicker';
import { Chip, Hint, IconBtn, Label, Mono, Panel, Row, Toggle, ToggleBtn } from './components/ui';
import { darkTheme, lightTheme } from './theme';

import {
  chordLabel,
  chordsAtFret,
  displayPitch,
  midiPc,
  scanLabelsFor,
  type ChordMatch,
} from './lib/chordEngine';
import {
  CUSTOM_MIDI_MAX,
  CUSTOM_MIDI_MIN,
  CUSTOM_TUNING_ID,
  MAX_STRINGS,
  MIN_STRINGS,
} from './lib/tunings';
import { applyPulls, normalizePulls, resolveTuning } from './lib/tuningState';
import { deriveKey } from './lib/keyFromTuning';
import { collectChordCards, type ChordCard } from './lib/chordCards';
import { functionColor } from './lib/noteColors';
import { noteToPitchClass } from './lib/musicTheory';
import { FretboardAudio, TONES, TONE_NAMES, type ToneName } from './lib/audio';
import {
  MAX_FRET,
  loadState,
  saveState,
  watchHash,
  type AppState,
} from './lib/appState';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// ── Header icons (inline so the bundle stays dependency-free) ──────────────
const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const SpeakerIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.4 5.6a9 9 0 0 1 0 12.8" />
  </svg>
);

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

const HeaderActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const HeadBtn = styled.button<{ $open?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid ${({ $open, theme }) => ($open ? theme.colors.primary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  background: transparent;
  color: ${({ $open, theme }) => ($open ? theme.colors.primary : theme.colors.textSecondary)};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const SoundWrap = styled.div`
  position: relative;
`;

const SoundPop = styled.div`
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 200px;
  padding: 12px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.medium};
  box-shadow: ${({ theme }) => theme.shadows.large};
`;

const VolumeSlider = styled.input`
  width: 100%;
  accent-color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
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

const cardIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(3px) scale(0.96);
  }
`;

const Card = styled(Chip)`
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 48px;
  /* pop in on mount — expanding "+ N more" cascades via animation-delay */
  animation: ${cardIn} 0.18s ease backwards;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Sub = styled.span`
  font-weight: 500;
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

// Chord symbols are case-carrying (Am7 ≠ AM7), so they never go through the
// uppercased `Label`.
const KeyName = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 800;
  color: ${({ theme }) => theme.colors.accent};
`;

// A titled block inside the panel: small uppercase title, content beneath.
const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid ${({ theme }) => `${theme.colors.border}66`};
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

  // Volume is a device preference, not part of the shareable board — it lives
  // in localStorage, not the URL.
  const [volume, setVolume] = useState(() => {
    try {
      const v = Number(localStorage.getItem('gfv.volume'));
      if (Number.isFinite(v) && v >= 0 && v <= 1 && localStorage.getItem('gfv.volume') !== null)
        return v;
    } catch {
      /* ignore */
    }
    return 0.7;
  });
  const [soundOpen, setSoundOpen] = useState(false);
  const soundWrapRef = useRef<HTMLDivElement>(null);

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
  useEffect(() => {
    try {
      localStorage.setItem('gfv.volume', String(volume));
    } catch {
      /* ignore */
    }
  }, [volume]);

  // Close the sound popover on outside click or Escape.
  useEffect(() => {
    if (!soundOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!soundWrapRef.current?.contains(e.target as Node)) setSoundOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSoundOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [soundOpen]);

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
  // "+ N more" chords stay collapsed by default — the degree cards carry the
  // musically useful set; the full list is one tap away.
  const [othersOpen, setOthersOpen] = useState(false);

  const sigRef = useRef(baseSignature);
  useEffect(() => {
    if (sigRef.current === baseSignature) return;
    sigRef.current = baseSignature;
    patch({ chip: 0 });
    setOthersOpen(false);
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

  // ── Audio ────────────────────────────────────────────────────────────────
  const audioRef = useRef<FretboardAudio | null>(null);
  const [playingStrings, setPlayingStrings] = useState<Set<number>>(new Set());
  if (!audioRef.current) {
    audioRef.current = new FretboardAudio();
    audioRef.current.onPlayingChange = setPlayingStrings;
  }
  const audio = audioRef.current;
  audio.tone = state.tone;
  audio.volume = volume;
  useEffect(() => () => audioRef.current?.dispose(), []);

  // Dragging the volume slider plays a C so the level is heard, not guessed —
  // throttled so a fast drag doesn't machine-gun.
  const lastBeepRef = useRef(0);
  const handleVolume = useCallback(
    (v: number) => {
      setVolume(v);
      audio.volume = v;
      const now = performance.now();
      if (now - lastBeepRef.current > 180) {
        lastBeepRef.current = now;
        void audio.pluck(60); // middle C
      }
    },
    [audio]
  );
  // Silence anything ringing when the board changes underneath it.
  useEffect(() => {
    audioRef.current?.stopAll();
  }, [baseSignature, state.barFret]);

  const strum = useCallback(
    (strings: number[]) => void audio.strum(tuning.midi, strings, state.barFret),
    [audio, tuning, state.barFret]
  );

  // Clicking a note plays JUST that note; the board's play button strums.
  const handleNoteClick = useCallback(
    (stringIdx: number, fret: number) => {
      void audio.pluckString(stringIdx, tuning.midi[stringIdx] + fret);
    },
    [audio, tuning]
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

  const setBarFret = useCallback((f: number) => patch({ barFret: f }), [patch]);

  const theme = themeName === 'dark' ? darkTheme : lightTheme;

  // `stagger` cascades the pop-in when a batch of cards mounts at once.
  const renderCard = (card: ChordCard, stagger = 0) => (
    <Card
      key={`${card.home ? 'home' : (card.roman ?? '')}${cardKey(card.match)}`}
      $active={activeCardKey === cardKey(card.match)}
      aria-pressed={activeCardKey === cardKey(card.match)}
      onClick={() => snapToCard(card)}
      style={stagger ? { animationDelay: `${Math.min(stagger * 12, 260)}ms` } : undefined}
      title={
        card.home
          ? `${chordLabel(card.match, flats)} — every open string, strummed as-is`
          : `${chordLabel(card.match, flats)} — bar at fret ${card.fret}, strings ${
              stringCount - card.strings[0]
            }–${stringCount - card.strings[card.strings.length - 1]}`
      }
    >
      {card.home && <Sub>open</Sub>}
      {card.roman && (
        // Roman numeral tinted by harmonic function — tonic green,
        // subdominant blue, dominant orange (the VG-800 Chords scheme).
        <Sub
          style={
            card.degree != null
              ? { color: functionColor(card.degree), fontWeight: 700 }
              : undefined
          }
        >
          {card.roman}
        </Sub>
      )}
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
          <HeaderActions>
            <SoundWrap ref={soundWrapRef}>
              <HeadBtn
                $open={soundOpen}
                onClick={() => setSoundOpen((o) => !o)}
                aria-label="Sound"
                aria-haspopup="dialog"
                aria-expanded={soundOpen}
                title="Sound"
              >
                <SpeakerIcon />
              </HeadBtn>
              {soundOpen && (
                <SoundPop role="dialog" aria-label="Sound settings">
                  <Label>Tone</Label>
                  <Row role="group" aria-label="Synth voice">
                    {TONE_NAMES.map((t) => (
                      <Chip
                        key={t}
                        $active={state.tone === t}
                        aria-pressed={state.tone === t}
                        onClick={() => patch({ tone: t as ToneName })}
                      >
                        {TONES[t].label}
                      </Chip>
                    ))}
                  </Row>
                  <Label>Volume</Label>
                  <VolumeSlider
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    aria-label="Volume"
                    onChange={(e) => handleVolume(Number(e.target.value))}
                  />
                </SoundPop>
              )}
            </SoundWrap>
            <HeadBtn
              onClick={() => setThemeName((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={themeName === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={themeName === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {themeName === 'dark' ? <SunIcon /> : <MoonIcon />}
            </HeadBtn>
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

          <Section>
            <Label>Scale</Label>
            <Row style={{ alignItems: 'baseline' }}>
              <KeyName>
                {tuningKey.root} {tuningKey.scale}
              </KeyName>
              <Mono>{scaleInfo.core.join(' · ')}</Mono>
            </Row>
          </Section>

          <Section>
            <Label>Chords</Label>
            {!cards.home && cards.degrees.length === 0 && cards.others.length === 0 ? (
              <Hint>
                This tuning stacks no nameable chord — it is a scale ladder or a drone.{' '}
                <strong>Map</strong> view shows what it is for.
              </Hint>
            ) : (
              <Row
                role="group"
                aria-label={`Chords this tuning can play, in ${tuningKey.root} ${tuningKey.scale}`}
              >
                {cards.home && renderCard(cards.home)}
                {cards.degrees.map((c) => renderCard(c))}
                {othersOpen
                  ? cards.others.map((c, i) => renderCard(c, i + 1))
                  : // collapsed: the one non-degree chord currently sounding
                    // stays visible so the selection never vanishes
                    cards.others
                      .filter((c) => cardKey(c.match) === activeCardKey)
                      .map((c) => renderCard(c))}
                {cards.others.length > 0 && (
                  <Card
                    onClick={() => setOthersOpen((o) => !o)}
                    aria-expanded={othersOpen}
                    title={
                      othersOpen
                        ? 'Show only the scale-degree chords'
                        : `Show every chord this tuning can play (${cards.others.length} more)`
                    }
                  >
                    {othersOpen ? '− less' : `+ ${cards.others.length} more`}
                    <Sub>{othersOpen ? 'degrees only' : 'all chords'}</Sub>
                  </Card>
                )}
              </Row>
            )}
          </Section>
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
          onPlay={() => strum(activeStringIdxs)}
        />
      </Shell>
    </ThemeProvider>
  );
};

export default App;
