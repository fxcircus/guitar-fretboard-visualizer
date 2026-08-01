import React, { useLayoutEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { displayNote, intervalLabel, midiPc } from '../lib/chordEngine';
import { DEGREE_INK, degreeColor, intervalColor } from '../lib/noteColors';
import {
  FINISHES,
  barGeom,
  isWound,
  stringGauge,
  type BoardPrefs,
  type Finish,
} from '../lib/boardStyles';

const INLAY_FRETS = [3, 5, 7, 9];
const DOUBLE_INLAY_FRETS = [12];
const SUITS = ['♠', '♦', '♥', '♣'];

// Fixed columns; the fret width is RESPONSIVE (measured from the container) so
// the board fills whatever room it is given and scrolls when there isn't enough.
const LABEL_W = 44;
const OPEN_W = 42;
const MIN_FRET_W = 30;
const MAX_FRET_W = 62;
const BOARD_TOP_GAP = 26; // room for the bar's bullet nose above the board
const BOARD_BOTTOM_GAP = 30; // room for its tail hanging over the neck edge

const SCALE_DEGREE = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

/** How long the bar takes to slide between frets; markers wait for it. */
const SLIDE_MS = 160;

// x of a fret column's centre within the board surface
const fretCenterX = (fret: number, fretW: number): number =>
  fret === 0 ? OPEN_W / 2 : OPEN_W + (fret - 1) * fretW + fretW / 2;

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
  /** The physical board: finish, inlays, bar style, detail toggles. */
  board: BoardPrefs;
}

const BoardScroll = styled.div`
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 6px;
`;

const BoardArea = styled.div`
  margin: 0 auto;
`;

// ── Scan row ───────────────────────────────────────────────────────────────

const ScanRow = styled.div`
  position: relative;
  z-index: 5;
  display: flex;
  align-items: stretch;
`;

const ScanSpacer = styled.div`
  width: ${LABEL_W}px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

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

const ScanCell = styled.button<{ $active: boolean }>`
  margin: 0;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 3px 0 5px;
  border: none;
  border-radius: 5px 5px 0 0;
  cursor: pointer;
  background: ${({ $active, theme }) => ($active ? `${theme.colors.primary}24` : 'transparent')};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? `${theme.colors.primary}24` : `${theme.colors.primary}14`};
  }
`;

const ScanFretNum = styled.span<{ $active: boolean; $dot: boolean }>`
  font-family: ${({ theme }) => theme.monoFamily};
  font-size: 12px;
  font-weight: ${({ $dot, $active }) => ($dot || $active ? 600 : 400)};
  color: ${({ $active, $dot, theme }) =>
    $active ? theme.colors.primary : $dot ? theme.colors.text : theme.colors.textSecondary};
  line-height: 1;
`;

const ScanChord = styled.span<{ $active: boolean }>`
  font-family: ${({ theme }) => theme.monoFamily};
  font-size: 8px;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1;
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  opacity: ${({ $active }) => ($active ? 1 : 0.7)};
  white-space: nowrap;
`;

// ── Board ──────────────────────────────────────────────────────────────────

const BoardRow = styled.div`
  display: flex;
  margin-top: ${BOARD_TOP_GAP}px;
`;

const LabelsCol = styled.div`
  width: ${LABEL_W}px;
  flex-shrink: 0;
  position: relative;
`;

const StringName = styled.div<{ $pulled?: boolean }>`
  position: absolute;
  right: 10px;
  transform: translateY(-50%);
  font-family: ${({ theme }) => theme.monoFamily};
  font-size: ${({ $pulled }) => ($pulled ? '9px' : '12px')};
  font-weight: 600;
  line-height: 1;
  color: ${({ $pulled, theme }) => ($pulled ? theme.colors.primary : theme.colors.textSecondary)};
  user-select: none;
  white-space: nowrap;
`;

const Surface = styled.div`
  position: relative;
  border-radius: 4px;
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.4),
    inset 0 14px 26px rgba(0, 0, 0, 0.28),
    0 12px 26px rgba(0, 0, 0, 0.5);
`;

const Layer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

const GrainLayer = styled(Layer)`
  border-radius: inherit;
  overflow: hidden;
  mix-blend-mode: overlay;
`;

const ClickCol = styled.div`
  position: absolute;
  top: 0;
  height: 100%;
  z-index: 2;
  cursor: pointer;
`;

const SideStrip = styled.div`
  position: relative;
  height: 14px;
  border-radius: 0 0 4px 4px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
`;

// ── The bar ────────────────────────────────────────────────────────────────

const BarWrap = styled.div`
  position: absolute;
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;
  transition: left ${SLIDE_MS / 1000}s cubic-bezier(0.3, 0.9, 0.4, 1);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// ── Markers ────────────────────────────────────────────────────────────────

type MarkKind = 'root' | 'chord' | 'scale' | 'dim';

const markIn = keyframes`
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.7);
  }
`;

const Mark = styled.button<{
  $isPlaying: boolean;
  $fill?: string;
  $fading?: boolean;
  $dim: boolean;
}>`
  position: absolute;
  z-index: 4;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
  border: none;
  padding: 0;
  cursor: pointer;
  user-select: none;
  background: ${({ $fill }) => $fill ?? 'transparent'};
  transform: translate(-50%, -50%) ${({ $isPlaying }) => ($isPlaying ? 'scale(1.18)' : 'scale(1)')};
  opacity: ${({ $fading }) => ($fading ? 0 : 1)};
  pointer-events: ${({ $fading }) => ($fading ? 'none' : 'auto')};
  transition:
    transform ${({ theme }) => theme.transitions.fast},
    box-shadow ${({ theme }) => theme.transitions.fast},
    background ${({ theme }) => theme.transitions.fast},
    opacity 0.12s ease;
  animation: ${markIn} 0.14s ease;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

const MarkGloss = styled.span`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(circle at 34% 26%, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.12) 42%, rgba(255, 255, 255, 0) 62%),
    radial-gradient(circle at 62% 108%, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0) 46%);
`;

const MarkHotspot = styled.span`
  position: absolute;
  left: 20%;
  top: 11%;
  width: 38%;
  height: 26%;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(closest-side, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0));
`;

const DOME_SHADOW =
  'inset 0 -3px 7px rgba(0,0,0,0.36), inset 0 3px 5px rgba(255,255,255,0.45), inset 0 0 0 1px rgba(255,255,255,0.18), 0 5px 9px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.5)';

interface Marker {
  kind: MarkKind;
  note: string;
  label: string;
  aria: string;
  fill?: string;
}

// ── Sub-renderers ──────────────────────────────────────────────────────────

const Bar: React.FC<{ prefs: BoardPrefs; fretW: number; left: number }> = ({
  prefs,
  fretW,
  left,
}) => {
  const g = barGeom(prefs.barStyle, fretW);
  return (
    <BarWrap aria-hidden="true" style={{ left, top: g.top, height: g.h, width: g.w }}>
      {/* cast shadow */}
      <div
        style={{
          position: 'absolute', left: 3, right: -7, top: g.shadowTop, bottom: 3,
          borderRadius: g.radius, background: 'rgba(0,0,0,0.6)', filter: 'blur(8px)',
          opacity: g.shade,
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 0, overflow: 'hidden',
          borderRadius: g.radius, background: g.bg, boxShadow: g.shadow,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,0.14),rgba(255,255,255,0) 28%,rgba(255,255,255,0.16) 78%,rgba(255,255,255,0.02) 100%)', opacity: g.shade }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: g.noseH, background: 'linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.05) 26%,rgba(16,21,26,0.28) 62%,rgba(16,21,26,0) 100%)', opacity: g.detail }} />
        <div style={{ position: 'absolute', left: g.crownX, right: g.crownX, top: g.crownTop, height: g.crownH, borderRadius: '50%', borderTop: '1.5px solid rgba(255,255,255,0.9)', opacity: g.detail }} />
        <div style={{ position: 'absolute', left: g.plateX, right: g.plateX, top: g.plateTop, bottom: g.plateBot, borderRadius: g.plateR, background: 'linear-gradient(90deg,rgba(255,255,255,0.05),rgba(255,255,255,0.16) 44%,rgba(255,255,255,0.03))', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4), 0 0 0 1px rgba(24,30,36,0.28)', opacity: g.plate }} />
        <div style={{ position: 'absolute', left: g.specX, top: g.specTop, width: g.specW, height: g.specH, borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(255,255,255,0.92),rgba(255,255,255,0))', opacity: g.detail }} />
        <div style={{ position: 'absolute', left: g.sheenX, top: g.sheenTop, bottom: g.sheenBot, width: g.sheenW, background: 'linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.98) 12%,rgba(255,255,255,0.9) 80%,rgba(255,255,255,0.2))', filter: 'blur(0.7px)', opacity: g.shade }} />
        <div style={{ position: 'absolute', left: g.bandX, top: g.bandTop, bottom: g.bandBot, width: g.bandW, background: 'linear-gradient(180deg,rgba(28,34,40,0),rgba(28,34,40,0.5) 18%,rgba(28,34,40,0.42) 82%,rgba(28,34,40,0))', filter: 'blur(1.4px)', opacity: g.plate }} />
        <div style={{ position: 'absolute', left: g.scoopX, bottom: g.scoopBot, width: g.scoopD, height: g.scoopD, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 4%,rgba(28,34,40,0.82),rgba(96,106,116,0.6) 40%,rgba(206,215,222,0.72) 72%,rgba(250,252,254,0.85))', boxShadow: 'inset 0 -2px 0 rgba(255,255,255,0.9), inset 0 5px 9px rgba(0,0,0,0.45)', opacity: g.plate }} />
        <div style={{ position: 'absolute', left: g.screwX, bottom: g.screwBot, width: g.screwD, height: g.screwD, borderRadius: '50%', background: 'radial-gradient(circle at 34% 28%,#f7e2ab,#c49a44 58%,#7c6020)', boxShadow: '0 0 0 1px rgba(18,14,6,0.6)', opacity: g.plate }} />
      </div>
    </BarWrap>
  );
};

interface Inlay {
  left: number;
  top: number;
  w: number;
  h: number;
  skew?: string;
  radius?: string;
  clip?: string;
  glyph?: string;
  size?: number;
  transparent?: boolean;
}

function buildInlays(prefs: BoardPrefs, fretW: number, rowH: number, boardH: number): Inlay[] {
  const out: Inlay[] = [];
  const marked = [...INLAY_FRETS, ...DOUBLE_INLAY_FRETS];
  marked.forEach((f, idx) => {
    const x = fretCenterX(f, fretW);
    const dbl = DOUBLE_INLAY_FRETS.includes(f);
    if (prefs.inlay === 'dots') {
      const d = Math.round(Math.max(13, Math.min(26, Math.min(rowH * 0.62, fretW * 0.42))));
      if (dbl) {
        out.push({ left: x, top: boardH / 2 - rowH, w: d, h: d, radius: '50%' });
        out.push({ left: x, top: boardH / 2 + rowH, w: d, h: d, radius: '50%' });
      } else {
        out.push({ left: x, top: boardH / 2, w: d, h: d, radius: '50%' });
      }
    } else if (prefs.inlay === 'trapezoid') {
      const w = fretW * 0.44;
      const taper = 'polygon(0 13%,100% 0,100% 100%,0 87%)';
      if (dbl) {
        const h = boardH * 0.31;
        out.push({ left: x, top: boardH * 0.285, w, h, clip: taper, radius: '1px' });
        out.push({ left: x, top: boardH * 0.715, w, h, clip: taper, radius: '1px' });
      } else {
        out.push({ left: x, top: boardH / 2, w, h: boardH * 0.68, clip: taper, radius: '1px' });
      }
    } else if (prefs.inlay === 'blocks') {
      const w = fretW * 0.68;
      out.push({ left: x, top: boardH / 2, w, h: boardH * (dbl ? 0.78 : 0.62), radius: '2px' });
    } else if (prefs.inlay === 'split') {
      const w = fretW * 0.52;
      const h = Math.max(8, boardH * 0.17);
      out.push({ left: x, top: boardH * (dbl ? 0.22 : 0.29), w, h, skew: 'skewX(-20deg)', radius: '1px' });
      out.push({ left: x, top: boardH * (dbl ? 0.78 : 0.71), w, h, skew: 'skewX(-20deg)', radius: '1px' });
      if (dbl) out.push({ left: x, top: boardH * 0.5, w, h, skew: 'skewX(-20deg)', radius: '1px' });
    } else {
      const size = Math.max(15, Math.min(30, boardH * 0.26));
      const glyph = SUITS[idx % 4];
      if (dbl) {
        out.push({ left: x, top: boardH * 0.3, w: size * 1.1, h: size * 1.1, glyph, size, transparent: true });
        out.push({ left: x, top: boardH * 0.7, w: size * 1.1, h: size * 1.1, glyph, size, transparent: true });
      } else {
        out.push({ left: x, top: boardH / 2, w: size * 1.2, h: size * 1.2, glyph, size, transparent: true });
      }
    }
  });
  return out;
}

// ── Component ──────────────────────────────────────────────────────────────

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
  scalePcs,
  keyRootPc,
  scaleDegreeLabels,
  pulled,
  baseSpellings,
  flats = false,
  onPlay,
  board,
}) => {
  const stringCount = midi.length;
  const frets = Array.from({ length: maxFret + 1 }, (_, f) => f);
  const fin: Finish = FINISHES[board.finish];

  // Markers follow the bar, not the click: while the slug slides, the old
  // fret's markers fade out in place; when it lands, they respawn (with the
  // pop-in) at the new fret. `settledFret` is where markers currently live.
  const [settledFret, setSettledFret] = useState(barFret);
  const sliding = settledFret !== barFret;
  useLayoutEffect(() => {
    if (barFret === settledFret) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setSettledFret(barFret);
      return;
    }
    const t = window.setTimeout(() => setSettledFret(barFret), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [barFret, settledFret]);

  // Measure the available width and size the fret columns to fill it.
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
    Math.min(MAX_FRET_W, Math.floor((room - LABEL_W - OPEN_W) / maxFret))
  );
  const rowH =
    stringCount > 6
      ? Math.round(Math.max(22, Math.min(30, fretW * 0.48)))
      : Math.round(Math.max(30, Math.min(44, fretW * 0.71)));
  const markSize = Math.round(Math.min(34, rowH - 5, fretW - 8, OPEN_W - 8));
  const noteFont = Math.round(Math.max(10, Math.min(15, markSize * 0.44)));
  const ivFont = Math.round(Math.max(7, Math.min(10, markSize * 0.3)));
  const surfaceW = OPEN_W + maxFret * fretW;
  const boardH = stringCount * rowH;
  const rowY = (s: number) => (stringCount - 1 - s) * rowH + rowH / 2;
  const colW = (f: number) => (f === 0 ? OPEN_W : fretW);
  const colX = (f: number) => (f === 0 ? 0 : OPEN_W + (f - 1) * fretW);

  const degreeFor = (pc: number): string =>
    scaleDegreeLabels?.get(pc) ??
    (keyRootPc != null ? SCALE_DEGREE[(pc - keyRootPc + 12) % 12] : '');

  const stringName = (s: number) => `string ${stringCount - s}`;

  const markerAt = (s: number, f: number): Marker | null => {
    const pc = midiPc(midi[s] + f);

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

    // Markers live at the SETTLED fret — the bar catches up to barFret first.
    if (f !== settledFret) return null;

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

  const inlays = buildInlays(board, fretW, rowH, boardH);
  const markFrets = view === 'map' ? frets : [settledFret];

  return (
    <BoardScroll ref={scrollRef}>
      <BoardArea style={{ width: LABEL_W + surfaceW }}>
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
            const isDot = INLAY_FRETS.includes(f) || DOUBLE_INLAY_FRETS.includes(f);
            return (
              <ScanCell
                key={f}
                type="button"
                style={{ width: colW(f) }}
                $active={f === barFret}
                onClick={() => onBarFretChange(f)}
                title={scanLabels[f] ? `${scanLabels[f]} — bar at fret ${f}` : `Bar at fret ${f}`}
              >
                <ScanFretNum $active={f === barFret} $dot={isDot}>
                  {f}
                </ScanFretNum>
                <ScanChord $active={f === barFret}>{scanLabels[f] ?? '·'}</ScanChord>
              </ScanCell>
            );
          })}
        </ScanRow>

        <BoardRow>
          <LabelsCol style={{ height: boardH }}>
            {midi.map((_, s) => {
              const isPulled = !!pulled?.[s];
              return (
                <StringName
                  key={s}
                  $pulled={isPulled}
                  style={{ top: rowY(s) }}
                  title={
                    isPulled
                      ? `String ${stringCount - s} — pulled ${baseSpellings?.[s] ?? ''} → ${spellings[s]}`
                      : `String ${stringCount - s} — open ${spellings[s]}`
                  }
                >
                  {isPulled ? `${baseSpellings?.[s] ?? ''}→${spellings[s]}` : spellings[s]}
                </StringName>
              );
            })}
          </LabelsCol>

          <Surface style={{ width: surfaceW, height: boardH, background: fin.surface }}>
            {board.grain && fin.grain !== 'none' && (
              <GrainLayer style={{ background: fin.grain, opacity: fin.grainOp }} />
            )}

            {board.wire && (
              <Layer>
                {frets.slice(1).map((k) => {
                  const x = OPEN_W + k * fretW;
                  return (
                    <React.Fragment key={k}>
                      <div style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: 4, transform: 'translateX(-50%)', background: fin.wire, boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.28), inset -1px 0 0 rgba(0,0,0,0.35), 3px 0 4px rgba(0,0,0,0.4)' }} />
                      <div style={{ position: 'absolute', left: x + 2, top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,0.55)' }} />
                    </React.Fragment>
                  );
                })}
                <div style={{ position: 'absolute', left: OPEN_W, top: 0, bottom: 0, width: 7, transform: 'translateX(-50%)', background: fin.nut, boxShadow: '3px 0 6px rgba(0,0,0,0.5)' }} />
              </Layer>
            )}

            <Layer>
              {inlays.map((i, ix) => (
                <div
                  key={ix}
                  style={{
                    position: 'absolute', left: i.left, top: i.top, width: i.w, height: i.h,
                    transform: `translate(-50%,-50%) ${i.skew ?? ''}`,
                    borderRadius: i.radius ?? 0,
                    clipPath: i.clip ?? 'none',
                    background: i.transparent ? 'transparent' : fin.inlayBg,
                    boxShadow: i.transparent ? 'none' : fin.inlayShadow,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    font: `400 ${i.size ?? 0}px/1 inherit`,
                    color: fin.inlay,
                  }}
                >
                  {i.glyph ?? ''}
                </div>
              ))}
            </Layer>

            <Layer>
              {midi.map((m, s) => {
                const y = rowY(s);
                const g = Math.round(stringGauge(m, board.gauges) * 10) / 10;
                const wound = isWound(m, board.gauges);
                return (
                  <React.Fragment key={s}>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: y + g / 2 + 0.6, height: Math.max(1.5, g * 0.8), background: 'rgba(0,0,0,0.55)', filter: 'blur(1.6px)' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, top: y, height: g, transform: 'translateY(-50%)', background: wound ? fin.stringWound : fin.stringPlain, boxShadow: '0 0 1px rgba(0,0,0,0.5)' }} />
                    {wound && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: y, height: g, transform: 'translateY(-50%)', background: 'repeating-linear-gradient(76deg,rgba(0,0,0,0.4) 0 1px,rgba(255,255,255,0.3) 1px 2.4px)', opacity: 0.55 }} />
                    )}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: y - g / 2 + 0.4, height: 1, background: fin.stringCore, opacity: g >= 2 ? 0.9 : 0.7 }} />
                    {board.gauges && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: y - g / 2, height: 1, background: 'rgba(255,255,255,0.5)', opacity: 0.55 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </Layer>

            {frets.map((f) => (
              <ClickCol
                key={f}
                style={{ left: colX(f), width: colW(f) }}
                title={`Bar at fret ${f}`}
                onClick={() => onBarFretChange(f)}
              />
            ))}

            {view === 'bar' && (
              <Bar prefs={board} fretW={fretW} left={fretCenterX(barFret, fretW)} />
            )}

            {midi.map((_, s) =>
              markFrets.map((f) => {
                const m = markerAt(s, f);
                if (!m) return null;
                const dim = m.kind === 'dim';
                return (
                  <Mark
                    key={`${s}:${f}`}
                    type="button"
                    style={{
                      left: fretCenterX(f, fretW),
                      top: rowY(s),
                      width: markSize,
                      height: markSize,
                      color: dim ? fin.dimInk : DEGREE_INK,
                      outline:
                        m.kind === 'root'
                          ? `2px solid ${fin.ring}`
                          : dim
                            ? `1px dashed ${fin.dimRing}`
                            : 'none',
                      outlineOffset: m.kind === 'root' ? 1 : 0,
                      boxShadow: playingStrings.has(s) && (view === 'map' ? f === barFret : true)
                        ? `0 0 12px ${m.fill ?? fin.ring}, ${DOME_SHADOW}`
                        : dim
                          ? 'none'
                          : DOME_SHADOW,
                    }}
                    $dim={dim}
                    $fill={dim ? undefined : (m.fill ?? fin.inlay)}
                    $fading={view === 'bar' && sliding}
                    $isPlaying={playingStrings.has(s) && (view === 'map' ? f === barFret : true)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoteClick(s, f);
                    }}
                    title={m.aria}
                    aria-label={m.aria}
                  >
                    {!dim && (
                      <>
                        <MarkGloss aria-hidden="true" />
                        <MarkHotspot aria-hidden="true" />
                      </>
                    )}
                    <span style={{ position: 'relative', fontWeight: 700, fontSize: noteFont }}>
                      {m.note}
                    </span>
                    {m.label && markSize >= 22 && (
                      <span
                        style={{
                          position: 'relative',
                          fontWeight: 600,
                          fontSize: ivFont,
                          opacity: 0.85,
                          marginTop: 1,
                        }}
                      >
                        {m.label}
                      </span>
                    )}
                  </Mark>
                );
              })
            )}
          </Surface>
        </BoardRow>

        {board.side && (
          <div style={{ display: 'flex', marginBottom: BOARD_BOTTOM_GAP }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            <SideStrip style={{ width: surfaceW, background: fin.edge }}>
              {INLAY_FRETS.map((f) => (
                <div key={f} style={{ position: 'absolute', left: fretCenterX(f, fretW), top: 7, width: 5, height: 5, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: fin.inlay, opacity: 0.85 }} />
              ))}
              {DOUBLE_INLAY_FRETS.map((f) => (
                <React.Fragment key={f}>
                  <div style={{ position: 'absolute', left: fretCenterX(f, fretW) - 5, top: 7, width: 5, height: 5, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: fin.inlay, opacity: 0.85 }} />
                  <div style={{ position: 'absolute', left: fretCenterX(f, fretW) + 5, top: 7, width: 5, height: 5, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: fin.inlay, opacity: 0.85 }} />
                </React.Fragment>
              ))}
            </SideStrip>
          </div>
        )}
        {!board.side && <div style={{ height: BOARD_BOTTOM_GAP }} />}
      </BoardArea>
    </BoardScroll>
  );
};

export default Fretboard;
