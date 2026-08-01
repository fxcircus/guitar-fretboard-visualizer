import React, { useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { displayNote, intervalLabel, midiPc, type SlantPosition } from '../lib/chordEngine';
import { DEGREE_INK, degreeColor, intervalColor } from '../lib/noteColors';

const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAY_FRETS = [12, 24];

// Fixed columns; the fret width is RESPONSIVE (measured from the container) so
// the board fills whatever room it is given and scrolls when there isn't enough.
const LABEL_W = 46;
const OPEN_W = 34;
const MIN_FRET_W = 30;
const MAX_FRET_W = 72;
const MIN_ROW_H = 26;
const MAX_ROW_H = 48;
const BOARD_PAD_X = 6;

const SCALE_DEGREE = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

// x of a fret column's centre within a string row, for a given fret width
const fretCenterX = (fret: number, fretW: number): number =>
  LABEL_W + (fret === 0 ? OPEN_W / 2 : OPEN_W + (fret - 1) * fretW + fretW / 2);

export interface FretboardProps {
  /** Open-string MIDI numbers, low string first. */
  midi: number[];
  /** Display spellings matching `midi`. */
  spellings: string[];
  maxFret: number;
  barFret: number;
  onBarFretChange: (fret: number) => void;
  /** 'bar' = a straight bar at one fret; 'map' = every scale tone on the neck. */
  view: 'bar' | 'map';
  /** Strings lit at the bar (low-string index); null = all strings. */
  activeStrings: Set<number> | null;
  /** Root of the identified chord, for interval labels; null = none. */
  rootPc: number | null;
  /** Whether that chord carries a ♭7 — tensions then read 11/13, not 4/6. */
  rootHasFlat7?: boolean;
  /** Strings currently sounding (visual pulse). */
  playingStrings: Set<number>;
  /** A note was clicked: (string index, fret). */
  onNoteClick: (stringIdx: number, fret: number) => void;
  /** Chord name per fret 0..maxFret (the scan row). */
  scanLabels: (string | null)[];
  /** Frets where the looked-up chord can be played (accent-ringed). */
  targetFrets?: Set<number>;
  /** A 2-string slant to draw as a tilted bar instead of the straight bar. */
  slant?: SlantPosition | null;
  /** Scale (melody-map) mode: label every string at the bar with its degree. */
  scaleActive?: boolean;
  /** Pitch classes of the current key's scale. */
  scalePcs?: Set<number>;
  /** Key root pitch class (for scale-degree labels). */
  keyRootPc?: number;
  /** Scale-degree label per pitch class, spelled from the scale (♯4 in Lydian). */
  scaleDegreeLabels?: Map<number, string>;
  /** Per-string pulled flag (behind-the-bar bend engaged). */
  pulled?: boolean[];
  /** Un-pulled string spellings, for the "B→C♯" pulled label. */
  baseSpellings?: string[];
  /** Spell everything in flats. */
  flats?: boolean;
  /** Strum the highlighted chord — renders a play button in the top-left corner. */
  onPlay?: () => void;
}

const BoardScroll = styled.div`
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 4px;
`;

const Board = styled.div`
  margin: 0 auto;
  background: ${({ theme }) => theme.colors.inputBackground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.medium};
  padding: 4px ${BOARD_PAD_X}px 6px;
`;

const ScanRow = styled.div`
  display: flex;
  align-items: stretch;
  margin-bottom: 2px;
`;

const ScanSpacer = styled.div`
  width: ${LABEL_W}px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// The board's one empty corner — above the string labels, left of the fret
// numbers — holds the strum button.
const PlayBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 50%;
  cursor: pointer;
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: 11px;
  line-height: 1;

  &:hover {
    background: ${({ theme }) => `${theme.colors.primary}22`};
    color: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ScanCell = styled.button<{ $active: boolean; $target: boolean }>`
  margin: 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 3px 0 4px;
  border: 1px solid ${({ $target, theme }) => ($target ? theme.colors.accent : 'transparent')};
  border-radius: ${({ theme }) => theme.borderRadius.small};
  cursor: pointer;
  background: ${({ $active, $target, theme }) =>
    $active ? `${theme.colors.primary}33` : $target ? `${theme.colors.accent}1f` : 'transparent'};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? `${theme.colors.primary}33` : `${theme.colors.primary}18`};
  }
`;

const ScanFretNum = styled.span<{ $active: boolean; $dot: boolean }>`
  font-size: 11px;
  font-weight: ${({ $dot, $active }) => ($dot || $active ? 700 : 500)};
  color: ${({ $active, $dot, theme }) =>
    $active ? theme.colors.primary : $dot ? theme.colors.text : theme.colors.textSecondary};
  line-height: 1;
`;

const ScanChord = styled.span<{ $active: boolean }>`
  font-size: 8px;
  font-weight: 600;
  line-height: 1;
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  opacity: ${({ $active }) => ($active ? 1 : 0.75)};
  white-space: nowrap;
`;

const StringRow = styled.div`
  display: flex;
  align-items: center;
`;

const StringLabel = styled.div<{ $pulled?: boolean }>`
  width: ${LABEL_W}px;
  flex-shrink: 0;
  text-align: center;
  font-size: ${({ $pulled, theme }) => ($pulled ? '9px' : theme.fontSizes.sm)};
  font-weight: 700;
  line-height: 1;
  color: ${({ $pulled, theme }) => ($pulled ? theme.colors.accent : theme.colors.textSecondary)};
  user-select: none;
`;

const Cell = styled.div<{ $isOpen: boolean; $isBar: boolean; $lineWidth: number }>`
  position: relative;
  height: 100%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  /* string line */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: ${({ $lineWidth }) => $lineWidth}px;
    transform: translateY(-50%);
    background: ${({ theme }) => theme.colors.border};
    opacity: 0.9;
  }

  /* nut after the open column */
  ${({ $isOpen, theme }) =>
    $isOpen ? `border-right: 3px solid ${theme.colors.textSecondary}55;` : ''}

  /* the bar — a metal slug that adapts to the theme */
  ${({ $isBar, theme }) =>
    $isBar
      ? `&::after {
          content: '';
          position: absolute;
          left: 50%;
          top: -2px;
          bottom: -2px;
          width: 8px;
          transform: translateX(-50%);
          border-radius: 3px;
          z-index: 1;
          background: linear-gradient(180deg, ${theme.colors.text}, ${theme.colors.textSecondary});
          box-shadow: 0 0 9px ${theme.colors.text}55;
          opacity: 0.9;
        }`
      : ''}
`;

// Inlays are an overlay so they sit in the gaps between strings, not on a line.
const InlayOverlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
`;

const InlayDot = styled.div<{ $left: number; $top: number }>`
  position: absolute;
  left: ${({ $left }) => $left}px;
  top: ${({ $top }) => $top}px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.22;
`;

type MarkKind = 'root' | 'chord' | 'scale' | 'slant' | 'dim';

// Chord-tone and scale-degree markers are filled with their harmonic-function
// color ($fill, see lib/noteColors.ts). The root additionally keeps its accent
// ring, so it reads even for color-blind players; out-of-chord markers stay
// hollow and dashed.
const Mark = styled.button<{ $kind: MarkKind; $isPlaying: boolean; $fill?: string }>`
  position: relative;
  z-index: 2;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1;
  border: none;
  padding: 0;
  cursor: pointer;
  user-select: none;
  background: ${({ $kind, $fill, theme }) => {
    if ($fill) return $fill;
    switch ($kind) {
      case 'root':
        return theme.colors.secondary;
      case 'slant':
      case 'chord':
        return theme.colors.primary;
      default:
        return 'transparent';
    }
  }};
  outline: ${({ $kind, theme }) => {
    switch ($kind) {
      case 'root':
      case 'slant':
        return `2px solid ${theme.colors.accent}`;
      case 'dim':
        return `1px dashed ${theme.colors.textSecondary}66`;
      default:
        return 'none';
    }
  }};
  outline-offset: ${({ $kind }) => ($kind === 'root' || $kind === 'slant' ? '1px' : '0')};
  color: ${({ $kind, $fill, theme }) => {
    if ($fill) return DEGREE_INK;
    if ($kind === 'dim') return `${theme.colors.textSecondary}aa`;
    if ($kind === 'scale') return theme.colors.text;
    return theme.colors.buttonText;
  }};
  box-shadow: ${({ $kind, $isPlaying, $fill, theme }) =>
    $isPlaying
      ? `0 0 12px ${$fill ?? theme.colors.error}`
      : $kind === 'dim' || ($kind === 'scale' && !$fill)
        ? 'none'
        : '0 2px 4px rgba(0, 0, 0, 0.3)'};
  transform: ${({ $isPlaying }) => ($isPlaying ? 'scale(1.18)' : 'scale(1)')};
  transition:
    transform ${({ theme }) => theme.transitions.fast},
    box-shadow ${({ theme }) => theme.transitions.fast},
    background ${({ theme }) => theme.transitions.fast};

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const SlantSvg = styled.svg`
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  z-index: 1;
`;

const SlantBar = styled.line`
  stroke: ${({ theme }) => theme.colors.text};
  stroke-width: 8;
  stroke-linecap: round;
  opacity: 0.9;
`;

const StringArea = styled.div`
  position: relative;
`;

const MarkNote = styled.span`
  font-size: 10px;
  font-weight: 700;
`;

const MarkInterval = styled.span`
  font-size: 7px;
  font-weight: 600;
  opacity: 0.85;
  margin-top: 1px;
`;

interface Marker {
  kind: MarkKind;
  note: string;
  label: string;
  aria: string;
  /** Harmonic-function fill (see lib/noteColors.ts); undefined = theme default. */
  fill?: string;
}

const Fretboard: React.FC<FretboardProps> = ({
  midi,
  spellings,
  maxFret,
  barFret,
  onBarFretChange,
  view,
  activeStrings,
  rootPc,
  rootHasFlat7 = false,
  playingStrings,
  onNoteClick,
  scanLabels,
  targetFrets,
  slant = null,
  scaleActive = false,
  scalePcs,
  keyRootPc,
  scaleDegreeLabels,
  pulled,
  baseSpellings,
  flats = false,
  onPlay,
}) => {
  const stringCount = midi.length;
  const frets = Array.from({ length: maxFret + 1 }, (_, f) => f);

  // Measure the available width and size the fret columns to fill it, so the
  // board uses the space it has instead of leaving it empty. Re-measured on
  // resize and whenever the neck length changes.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setAvailW(el.clientWidth);
    measure();
    const raf = requestAnimationFrame(measure);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [maxFret]);

  const room = availW || 900;
  const fretW = Math.max(
    MIN_FRET_W,
    Math.min(MAX_FRET_W, Math.floor((room - 2 * BOARD_PAD_X - LABEL_W - OPEN_W) / maxFret))
  );
  const rowH = Math.round(Math.max(MIN_ROW_H, Math.min(MAX_ROW_H, fretW * 0.8)));
  const markSize = Math.round(Math.min(38, fretW - 6, rowH - 2));
  const noteFont = Math.round(Math.max(9, Math.min(16, markSize * 0.42)));
  const ivFont = Math.round(Math.max(7, Math.min(11, markSize * 0.3)));
  const boardW = LABEL_W + OPEN_W + maxFret * fretW;
  const boardH = stringCount * rowH;
  const rowY = (s: number) => (stringCount - 1 - s) * rowH + rowH / 2;
  const colW = (f: number) => (f === 0 ? OPEN_W : fretW);

  const degreeFor = (pc: number): string =>
    scaleDegreeLabels?.get(pc) ??
    (keyRootPc != null ? SCALE_DEGREE[(pc - keyRootPc + 12) % 12] : '');

  const stringName = (s: number) => `string ${stringCount - s}`;

  /** Which cells carry a marker, and how each renders. */
  const markerAt = (s: number, f: number): Marker | null => {
    const pc = midiPc(midi[s] + f);

    // Map view: every scale tone across the whole neck, colored by degree.
    if (view === 'map') {
      if (!scalePcs?.has(pc)) return null;
      const isKeyRoot = keyRootPc != null && pc === keyRootPc;
      const degree = degreeFor(pc);
      return {
        kind: isKeyRoot ? 'root' : 'scale',
        note: displayNote(pc, flats),
        label: degree,
        fill: degree ? degreeColor(degree) : undefined,
        aria: `${displayNote(pc, flats)}, scale degree ${degree} — ${stringName(s)}, fret ${f}`,
      };
    }

    if (slant) {
      const isLow = s === slant.lowString && f === slant.lowFret;
      const isHigh = s === slant.highString && f === slant.highFret;
      if (!isLow && !isHigh) return null;
      return {
        kind: 'slant',
        note: displayNote(pc, flats),
        label: '',
        aria: `${displayNote(pc, flats)} — ${stringName(s)}, fret ${f} (slant)`,
      };
    }

    if (f !== barFret) return null;

    if (scaleActive) {
      const inScale = !!scalePcs?.has(pc);
      const isKeyRoot = keyRootPc != null && pc === keyRootPc;
      const degree = degreeFor(pc);
      return {
        kind: !inScale ? 'dim' : isKeyRoot ? 'root' : 'scale',
        note: displayNote(pc, flats),
        label: inScale ? degree : '',
        fill: inScale && degree ? degreeColor(degree) : undefined,
        aria: `${displayNote(pc, flats)}${
          inScale ? `, scale degree ${degree}` : ', not in key'
        } — ${stringName(s)}, fret ${f}`,
      };
    }

    // Bar view: chord tones colored by their function in the chord
    // (root red, 3rd orange, 5th lime, 7th green, 9 blue, 4/6 purple).
    const isActive = activeStrings === null || activeStrings.has(s);
    const interval = rootPc !== null ? intervalLabel((pc - rootPc + 12) % 12, rootHasFlat7) : '';
    return {
      kind: !isActive ? 'dim' : rootPc !== null && pc === rootPc ? 'root' : 'chord',
      note: displayNote(pc, flats),
      label: interval,
      fill: isActive && interval ? intervalColor(interval) : undefined,
      aria: `${displayNote(pc, flats)}${interval ? `, ${interval}` : ''} — ${stringName(s)}, fret ${f}`,
    };
  };

  const inlayFrets = INLAY_FRETS.filter((f) => f <= maxFret);
  const doubleInlays = DOUBLE_INLAY_FRETS.filter((f) => f <= maxFret);

  return (
    <BoardScroll ref={scrollRef}>
      <Board style={{ width: boardW }}>
        <ScanRow>
          <ScanSpacer>
            {onPlay && (
              <PlayBtn
                type="button"
                onClick={onPlay}
                title="Strum the highlighted strings"
                aria-label="Strum the highlighted strings"
              >
                ▶
              </PlayBtn>
            )}
          </ScanSpacer>
          {frets.map((f) => {
            const isTarget = !!targetFrets?.has(f);
            const isDot = inlayFrets.includes(f) || doubleInlays.includes(f);
            return (
              <ScanCell
                key={f}
                type="button"
                style={{ width: colW(f) }}
                $active={f === barFret}
                $target={isTarget}
                onClick={() => onBarFretChange(f)}
                title={
                  isTarget
                    ? `${scanLabels[f] ?? ''} — the chord you looked up plays here (fret ${f})`
                    : scanLabels[f]
                      ? `${scanLabels[f]} — bar at fret ${f}`
                      : `Bar at fret ${f}`
                }
              >
                <ScanFretNum $active={f === barFret} $dot={isDot}>
                  {f}
                </ScanFretNum>
                <ScanChord $active={f === barFret}>{scanLabels[f] ?? '·'}</ScanChord>
              </ScanCell>
            );
          })}
        </ScanRow>

        <StringArea>
          {view === 'bar' && slant && (
            <SlantSvg width={boardW} height={boardH} aria-hidden="true">
              <SlantBar
                x1={fretCenterX(slant.lowFret, fretW)}
                y1={rowY(slant.lowString)}
                x2={fretCenterX(slant.highFret, fretW)}
                y2={rowY(slant.highString)}
              />
            </SlantSvg>
          )}

          {Array.from({ length: stringCount }, (_, row) => {
            const s = stringCount - 1 - row; // render the high string on top
            const isPulled = !!pulled?.[s];
            return (
              <StringRow key={s} style={{ height: rowH }}>
                <StringLabel
                  $pulled={isPulled}
                  title={
                    isPulled
                      ? `String ${stringCount - s} — pulled ${baseSpellings?.[s] ?? ''} → ${spellings[s]}`
                      : `String ${stringCount - s} — open ${spellings[s]}`
                  }
                >
                  {isPulled ? `${baseSpellings?.[s] ?? ''}→${spellings[s]}` : spellings[s]}
                </StringLabel>
                {frets.map((f) => {
                  const m = markerAt(s, f);
                  return (
                    <Cell
                      key={f}
                      style={{ width: colW(f) }}
                      $isOpen={f === 0}
                      $isBar={view === 'bar' && !slant && f === barFret}
                      $lineWidth={1 + (stringCount - 1 - s) * (stringCount > 6 ? 0.25 : 0.4)}
                      onClick={() => onBarFretChange(f)}
                    >
                      {m && (
                        <Mark
                          type="button"
                          style={{ width: markSize, height: markSize }}
                          $kind={m.kind}
                          $fill={m.fill}
                          $isPlaying={playingStrings.has(s) && (view === 'map' ? f === barFret : true)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onNoteClick(s, f);
                          }}
                          title={m.aria}
                          aria-label={m.aria}
                        >
                          <MarkNote style={{ fontSize: noteFont }}>{m.note}</MarkNote>
                          {m.label && (
                            <MarkInterval style={{ fontSize: ivFont }}>{m.label}</MarkInterval>
                          )}
                        </Mark>
                      )}
                    </Cell>
                  );
                })}
              </StringRow>
            );
          })}

          <InlayOverlay aria-hidden="true">
            {inlayFrets.map((f) => (
              <InlayDot key={f} $left={fretCenterX(f, fretW)} $top={boardH / 2} />
            ))}
            {doubleInlays.map((f) => (
              <React.Fragment key={f}>
                <InlayDot $left={fretCenterX(f, fretW)} $top={boardH * 0.3} />
                <InlayDot $left={fretCenterX(f, fretW)} $top={boardH * 0.7} />
              </React.Fragment>
            ))}
          </InlayOverlay>
        </StringArea>
      </Board>
    </BoardScroll>
  );
};

export default Fretboard;
