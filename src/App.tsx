import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';

import Fretboard from './components/Fretboard';
import TuningPicker from './components/TuningPicker';
import { Chip, Hint, IconBtn, Label, Mono, Panel, Row, Select, Toggle, ToggleBtn } from './components/ui';
import { darkTheme, lightTheme } from './theme';

import {
  CHORD_TYPES,
  chordLabel,
  chordPcs,
  chordsAtFret,
  displayNote,
  displayPitch,
  findBarPositions,
  findSlantPositions,
  identifyChords,
  midiPc,
  rankByNearness,
  rankSlantsByNearness,
  scanLabelsFor,
  type ChordQuality,
  type SlantPosition,
} from './lib/chordEngine';
import {
  CUSTOM_MIDI_MAX,
  CUSTOM_MIDI_MIN,
  CUSTOM_TUNING_ID,
  MAX_STRINGS,
  MIN_STRINGS,
  TUNINGS,
} from './lib/tunings';
import { PULL_MAX, PULL_MIN, applyPulls, normalizePulls, resolveTuning } from './lib/tuningState';
import { COPEDENTS, combinePulls, copedentFor, pullsForControl } from './lib/copedents';
import {
  CHROMATIC_NOTES_FLATS,
  CHROMATIC_NOTES_SHARPS,
  SCALE_NAMES,
  deriveScaleChords,
  generateSpelledScale,
  noteToPitchClass,
} from './lib/musicTheory';
import { FretboardAudio, TONES, TONE_NAMES, type ToneName } from './lib/audio';
import {
  FRET_COUNTS,
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

const LinkBtn = styled.a`
  padding: 5px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  text-decoration: none;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
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

const Readout = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.medium};
  background: ${({ theme }) => theme.colors.background};
`;

const ReadoutInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const ChordName = styled.span<{ $quality: ChordQuality | null }>`
  font-size: 26px;
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
  width: 40px;
  height: 40px;
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

const StringBox = styled.div<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.accent : theme.colors.border)};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  background: ${({ $active, theme }) =>
    $active ? `${theme.colors.accent}18` : theme.colors.inputBackground};
  min-width: 48px;
`;

const StringVal = styled.div<{ $active?: boolean }>`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 700;
  color: ${({ $active, theme }) => ($active ? theme.colors.accent : theme.colors.text)};
  text-align: center;
  line-height: 1.15;
`;

const StringSub = styled.span`
  font-family: ${({ theme }) => theme.monoFamily};
  font-size: 9px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const KeyChip = styled(Chip)`
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
const TargetName = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 800;
  color: ${({ theme }) => theme.colors.accent};
`;

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => `${theme.colors.accent}66`};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  background: ${({ theme }) => `${theme.colors.accent}14`};
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
  const anyPull = pulled.some(Boolean);

  const flats =
    state.accidentals === 'flat'
      ? true
      : state.accidentals === 'sharp'
        ? false
        : (baseTuning.preferFlats ?? state.keyRoot.includes('♭'));

  const noteNames = flats ? CHROMATIC_NOTES_FLATS : CHROMATIC_NOTES_SHARPS;

  // Keep the bar on the neck when the neck gets shorter.
  useEffect(() => {
    if (state.barFret > state.maxFret) patch({ barFret: state.maxFret });
  }, [state.barFret, state.maxFret, patch]);

  const chords = useMemo(
    () => chordsAtFret(tuning.midi, state.barFret),
    [tuning, state.barFret]
  );

  // Which chord-group chip is selected. The group structure is identical at
  // every fret (a straight bar transposes everything uniformly), so the
  // selection survives bar moves. It resets only when the BASE tuning's pitch
  // content changes — NOT on a pull nudge, so you can dial in a bend while
  // watching its effect on the selected chord.
  const [selectedChipIdx, setSelectedChipIdx] = useState(0);
  const baseSignature = baseTuning.midi.join(',');
  useEffect(() => setSelectedChipIdx(0), [baseSignature]);

  const selected = chords.length ? chords[Math.min(selectedChipIdx, chords.length - 1)] : null;
  const rootPc = selected ? selected.match.rootPc : null;

  const scanLabels = useMemo(
    () => scanLabelsFor(selected ? selected.match : null, state.barFret, state.maxFret, flats),
    [selected, state.barFret, state.maxFret, flats]
  );
  const activeStringIdxs = useMemo(
    () => (selected ? selected.strings : tuning.midi.map((_, i) => i)),
    [selected, tuning]
  );
  const activeStrings = useMemo(() => (selected ? new Set(selected.strings) : null), [selected]);

  // ── Key / scale ──────────────────────────────────────────────────────────
  const scaleInfo = useMemo(() => {
    const spelled = generateSpelledScale(state.keyRoot, state.scale);
    const core =
      spelled.length > 1 &&
      noteToPitchClass(spelled[0]) === noteToPitchClass(spelled[spelled.length - 1])
        ? spelled.slice(0, -1)
        : spelled;
    const pcs = new Set(core.map((n) => (((noteToPitchClass(n) ?? 0) % 12) + 12) % 12));
    const keyRootPc = (((noteToPitchClass(state.keyRoot) ?? 0) % 12) + 12) % 12;

    // Scale-degree label per pitch class, spelled from the scale's own note
    // names (so Lydian's raised 4th reads ♯4, not ♭5).
    const degreeLabels = new Map<number, string>();
    const rootLetter = state.keyRoot[0]?.toUpperCase();
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
  }, [state.keyRoot, state.scale]);

  const keyChords = useMemo(() => {
    // Diatonic triads are only well-defined for 7-note scales, where each
    // degree's index-stack is a real tertian triad rooted on tonePcs[0].
    if (state.guide !== 'chords' || scaleInfo.core.length < 7) return [];
    return deriveScaleChords(scaleInfo.core).map((deg) => {
      const voicable =
        deg.triadName !== null &&
        deg.quality !== null &&
        deg.quality !== 'slash' &&
        new Set(deg.tonePcs).size === 3;
      const nearest = voicable
        ? (rankByNearness(
            findBarPositions(tuning.midi, deg.tonePcs, deg.tonePcs[0], state.maxFret),
            state.barFret
          )[0] ?? null)
        : null;
      return { deg, nearest };
    });
  }, [state.guide, scaleInfo.core, tuning, state.barFret, state.maxFret]);

  // ── Chord finder ─────────────────────────────────────────────────────────
  const findType = CHORD_TYPES.find((t) => t.suffix === state.findSuffix) ?? CHORD_TYPES[0];
  const target = useMemo(() => {
    if (state.findRootPc === null) return null;
    return { pcs: chordPcs(state.findRootPc, findType), rootPc: state.findRootPc };
  }, [state.findRootPc, findType]);

  const targetName = target ? displayNote(target.rootPc, flats) + findType.suffix : null;

  const targetPositions = useMemo(() => {
    if (!target) return [];
    return rankByNearness(
      findBarPositions(tuning.midi, target.pcs, target.rootPc, state.maxFret),
      state.barFret
    );
  }, [target, tuning, state.barFret, state.maxFret]);
  const targetFrets = useMemo(
    () => new Set(targetPositions.map((p) => p.fret)),
    [targetPositions]
  );

  // When a straight bar can't play it, offer slants (2-string tilts).
  const targetSlants = useMemo(() => {
    if (!target || targetPositions.length > 0) return [];
    const ranked = rankSlantsByNearness(
      findSlantPositions(tuning.midi, target.pcs, target.rootPc, state.maxFret, flats),
      state.barFret
    );
    const seen = new Set<string>();
    return ranked.filter((s) => {
      const key = `${s.notes[0]}:${s.notes[1]}:${s.lowFret}:${s.highFret}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [target, targetPositions, tuning, state.barFret, state.maxFret, flats]);

  // The previewed slant is tracked by a stable key (not object identity — the
  // slant list is recomputed on every bar move) and derived back to the live
  // object. Cleared on target change and on any non-slant bar move.
  const slantKey = (s: SlantPosition) =>
    `${s.lowString}-${s.highString}-${s.lowFret}-${s.highFret}`;
  const [slantPreviewKey, setSlantPreviewKey] = useState<string | null>(null);
  useEffect(() => setSlantPreviewKey(null), [target]);
  const slantPreview = useMemo(
    () => targetSlants.find((s) => slantKey(s) === slantPreviewKey) ?? null,
    [targetSlants, slantPreviewKey]
  );

  const setBarFret = useCallback(
    (f: number) => {
      setSlantPreviewKey(null);
      patch({ barFret: f });
    },
    [patch]
  );

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

  // ── Copedent ─────────────────────────────────────────────────────────────
  const copedent = useMemo(
    () => copedentFor(state.tuningId, baseTuning.copedent, rootPc ?? midiPc(baseTuning.midi[0])),
    [state.tuningId, baseTuning, rootPc]
  );
  const [engaged, setEngaged] = useState<string[]>([]);
  useEffect(() => setEngaged([]), [baseSignature]);

  const toggleControl = (id: string) => {
    const next = engaged.includes(id) ? engaged.filter((c) => c !== id) : [...engaged, id];
    setEngaged(next);
    const set = COPEDENTS[copedent.id];
    const arrays = next
      .map((cid) => set.controls.find((c) => c.id === cid))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => pullsForControl(baseTuning.midi, copedent.rootPc, c));
    patch({ pulls: combinePulls(baseTuning.midi, arrays) });
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleTuningChange = (id: string) => {
    if (id === CUSTOM_TUNING_ID) {
      patch({ tuningId: id, customTuning: [...baseTuning.midi], pulls: [] });
    } else {
      patch({ tuningId: id, pulls: [] });
    }
    setEngaged([]);
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

  const editPull = (i: number, delta: number) => {
    const next = [...pulls];
    next[i] = Math.min(PULL_MAX, Math.max(PULL_MIN, (next[i] || 0) + delta));
    setEngaged([]);
    patch({ pulls: next });
  };

  const clearPulls = () => {
    setEngaged([]);
    patch({ pulls: [] });
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

  const rootOptions = useMemo(
    () => noteNames.map((n, pc) => ({ name: n, pc })),
    [noteNames]
  );

  const theme = themeName === 'dark' ? darkTheme : lightTheme;

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
            <LinkBtn href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </LinkBtn>
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
              value={state.maxFret}
              onChange={(e) => patch({ maxFret: Number(e.target.value) })}
              aria-label="Fret count"
              title="How many frets to draw"
            >
              {FRET_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n} frets
                </option>
              ))}
            </Select>

            <Select
              value={state.accidentals}
              onChange={(e) => patch({ accidentals: e.target.value as AppState['accidentals'] })}
              aria-label="Accidentals"
              title="How to spell the black keys"
            >
              <option value="auto">Auto ♯/♭</option>
              <option value="sharp">Sharps</option>
              <option value="flat">Flats</option>
            </Select>

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
        </Panel>

        <Panel>
          <Row>
            <Label>Key</Label>
            <Select
              value={state.keyRoot}
              onChange={(e) => patch({ keyRoot: e.target.value })}
              aria-label="Key root"
            >
              {rootOptions.map((r) => (
                <option key={r.pc} value={r.name}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Select
              value={state.scale}
              onChange={(e) => patch({ scale: e.target.value })}
              aria-label="Scale"
            >
              {SCALE_NAMES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Toggle role="group" aria-label="Key guide">
              {(['chords', 'scale', 'off'] as const).map((mode) => (
                <ToggleBtn
                  key={mode}
                  $active={state.guide === mode}
                  aria-pressed={state.guide === mode}
                  onClick={() => patch({ guide: mode })}
                  title={
                    mode === 'chords'
                      ? "The key's diatonic chords and where the bar plays each"
                      : mode === 'scale'
                        ? 'Show every scale tone (melody map)'
                        : 'Hide the key guide'
                  }
                >
                  {mode === 'chords' ? 'Chords' : mode === 'scale' ? 'Scale' : 'Off'}
                </ToggleBtn>
              ))}
            </Toggle>
            <Mono>{scaleInfo.core.join(' ')}</Mono>
          </Row>

          {state.guide === 'chords' && keyChords.length > 0 && (
            <Row role="group" aria-label={`Diatonic chords in ${state.keyRoot} ${state.scale}`}>
              {keyChords.map(({ deg, nearest }, i) => (
                <KeyChip
                  key={i}
                  $disabled={!nearest}
                  disabled={!nearest}
                  onClick={() => nearest && setBarFret(nearest.fret)}
                  title={
                    nearest
                      ? `${deg.triadName ?? deg.roman} — bar at fret ${nearest.fret}${
                          nearest.isFullTarget ? '' : ' (triad grip)'
                        }`
                      : `${deg.triadName ?? deg.roman} — not under a straight bar in this tuning`
                  }
                >
                  <Sub>{deg.roman}</Sub>
                  {deg.triadName ?? '—'}
                  <Sub>{nearest ? `fret ${nearest.fret}` : '—'}</Sub>
                </KeyChip>
              ))}
            </Row>
          )}

          <Row>
            <Label>Find a chord</Label>
            <Select
              value={state.findRootPc ?? ''}
              onChange={(e) =>
                patch({
                  findRootPc: e.target.value === '' ? null : Number(e.target.value),
                  findSuffix: state.findSuffix,
                })
              }
              aria-label="Chord root"
            >
              <option value="">— none —</option>
              {rootOptions.map((r) => (
                <option key={r.pc} value={r.pc}>
                  {r.name}
                </option>
              ))}
            </Select>
            <Select
              value={state.findSuffix}
              onChange={(e) => patch({ findSuffix: e.target.value })}
              aria-label="Chord type"
            >
              {CHORD_TYPES.map((t) => (
                <option key={t.suffix} value={t.suffix}>
                  {t.suffix === '' ? 'major' : t.suffix} — {t.name}
                </option>
              ))}
            </Select>
            <Hint>where this tuning can play it under the bar</Hint>
          </Row>

          {target && (
            <Banner role="status">
              <TargetName>{targetName}</TargetName>
              {targetPositions.length > 0 ? (
                <>
                  <Hint>bar at</Hint>
                  {targetPositions.slice(0, 8).map((p) => (
                    <Chip
                      key={p.fret}
                      $active={p.fret === state.barFret}
                      onClick={() => setBarFret(p.fret)}
                      title={`Snap the bar to fret ${p.fret} (${chordLabel(p.match, flats)}${
                        p.isFullTarget ? '' : ', partial'
                      }) — strings ${stringCount - p.strings[0]}–${
                        stringCount - p.strings[p.strings.length - 1]
                      }`}
                    >
                      fret {p.fret}
                      {!p.isFullTarget ? '*' : ''}
                    </Chip>
                  ))}
                  {targetPositions.some((p) => !p.isFullTarget) && (
                    <Hint>* a triad grip of the full chord</Hint>
                  )}
                </>
              ) : targetSlants.length > 0 ? (
                <>
                  <Hint>no straight bar — slant</Hint>
                  {targetSlants.slice(0, 6).map((s) => (
                    <Chip
                      key={slantKey(s)}
                      $active={slantPreviewKey === slantKey(s)}
                      onClick={() => {
                        setSlantPreviewKey(slantKey(s));
                        patch({ barFret: Math.min(s.lowFret, s.highFret) });
                      }}
                      title={`${s.direction} slant, strings ${stringCount - s.lowString}+${
                        stringCount - s.highString
                      } at frets ${s.lowFret}/${s.highFret}`}
                    >
                      {s.label} ({s.lowFret}/{s.highFret})
                    </Chip>
                  ))}
                </>
              ) : (
                <Hint>not playable under a straight bar or a simple slant in this tuning</Hint>
              )}
            </Banner>
          )}
        </Panel>

        <Panel>
          <Row>
            <Label>{COPEDENTS[copedent.id].label}</Label>
            <Hint>
              {COPEDENTS[copedent.id].blurb} Root {displayNote(copedent.rootPc, flats)}.
            </Hint>
          </Row>
          <Row role="group" aria-label="Pedals and levers">
            {COPEDENTS[copedent.id].controls.map((c) => (
              <Chip
                key={c.id}
                $active={engaged.includes(c.id)}
                aria-pressed={engaged.includes(c.id)}
                onClick={() => toggleControl(c.id)}
                title={c.action}
              >
                {c.name}
                <Sub>{c.kind}</Sub>
              </Chip>
            ))}
            {anyPull && (
              <Chip onClick={clearPulls} title="Release every pull">
                clear
              </Chip>
            )}
          </Row>
          <Row>
            <Label>Pulls</Label>
            <Hint>behind-the-bar bends — nudge any string by hand</Hint>
          </Row>
          <Row role="group" aria-label="Behind-the-bar pulls">
            {baseTuning.midi.map((m, i) => {
              const off = pulls[i] ?? 0;
              const sNum = stringCount - i;
              return (
                <StringBox key={i} $active={off !== 0}>
                  <IconBtn onClick={() => editPull(i, 1)} aria-label={`Raise string ${sNum}`}>
                    ▲
                  </IconBtn>
                  <StringVal $active={off !== 0} title={`String ${sNum}`}>
                    {displayNote(midiPc(m + off), flats)}
                    <br />
                    <StringSub>{off > 0 ? `+${off}` : off < 0 ? `${off}` : '·'}</StringSub>
                  </StringVal>
                  <IconBtn onClick={() => editPull(i, -1)} aria-label={`Lower string ${sNum}`}>
                    ▼
                  </IconBtn>
                </StringBox>
              );
            })}
          </Row>
        </Panel>

        <Readout>
          <ReadoutInfo>
            <Label>
              {state.view === 'map'
                ? `${state.keyRoot} ${state.scale} across the neck`
                : `Sounding chord — ${state.barFret === 0 ? 'open strings' : `bar at fret ${state.barFret}`}`}
            </Label>
            <ChordName $quality={selected ? selected.match.quality : null}>
              {selected ? chordLabel(selected.match, flats) : soundingNotes || '—'}
            </ChordName>
            <Hint>
              {alias ? `= ${alias} · ` : ''}
              {selected ? (
                `${selected.match.formulaName} · ${soundingNotes}`
              ) : (
                <>
                  No chord name — these strings do not stack into one. Some tunings (the modal
                  necks, the drone tunings) are scale ladders rather than chords;{' '}
                  <strong>Map</strong> view is what they are for.
                </>
              )}
            </Hint>
          </ReadoutInfo>
          <StrumBtn
            onClick={() => strum(activeStringIdxs)}
            title="Strum the highlighted strings"
            aria-label="Strum the highlighted strings"
          >
            ▶
          </StrumBtn>
        </Readout>

        <Fretboard
          midi={tuning.midi}
          spellings={tuning.spellings}
          maxFret={state.maxFret}
          barFret={state.barFret}
          onBarFretChange={setBarFret}
          view={state.view}
          activeStrings={activeStrings}
          rootPc={rootPc}
          rootHasFlat7={selected ? selected.match.intervals.includes(10) : false}
          playingStrings={playingStrings}
          onNoteClick={handleNoteClick}
          scanLabels={scanLabels}
          targetFrets={targetFrets}
          slant={slantPreview}
          scaleActive={state.guide === 'scale'}
          scalePcs={scaleInfo.pcs}
          keyRootPc={scaleInfo.keyRootPc}
          scaleDegreeLabels={scaleInfo.degreeLabels}
          pulled={pulled}
          baseSpellings={baseTuning.spellings}
          flats={flats}
        />

        {state.view === 'bar' && chords.length > 0 && (
          <Row role="group" aria-label="Chords at this bar position">
            {chords.map((c, i) => (
              <Chip
                key={`${c.match.rootPc}:${c.match.suffix}`}
                $active={i === Math.min(selectedChipIdx, chords.length - 1)}
                aria-pressed={i === Math.min(selectedChipIdx, chords.length - 1)}
                onClick={() => setSelectedChipIdx(i)}
                title={`${chordLabel(c.match, flats)} — ${
                  c.isFullStack
                    ? 'all strings'
                    : `strings ${stringCount - c.strings[0]}–${
                        stringCount - c.strings[c.strings.length - 1]
                      }`
                }`}
              >
                {chordLabel(c.match, flats)}
                <Sub>
                  {c.isFullStack
                    ? 'all'
                    : `str ${stringCount - c.strings[0]}–${
                        stringCount - c.strings[c.strings.length - 1]
                      }`}
                </Sub>
              </Chip>
            ))}
          </Row>
        )}

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
