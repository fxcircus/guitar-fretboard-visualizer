/**
 * The physical board — finishes, string metal, inlay styles, and the bar
 * itself — ported from the "Fretboard Redesign" Claude Design project
 * (direction 1A "Workbench": real wood, real fret wire, the board is the
 * instrument). All values here are visual data; the music logic never
 * touches this file.
 */

export type FinishName = 'rosewood' | 'maple' | 'ebony' | 'flat' | 'paper';
export type InlayName = 'dots' | 'trapezoid' | 'blocks' | 'split' | 'suits';
export type BarStyleName = 'tonebar' | 'steel' | 'slim';

export interface Finish {
  label: string;
  swatch: string;
  /**
   * 'wood' renders the physical instrument; 'paper' renders the board as a
   * luthier's shop drawing — ink lines on paper, the bar as an outline.
   */
  mode: 'wood' | 'paper';
  surface: string;
  grain: string;
  grainOp: number;
  wire: string;
  nut: string;
  stringPlain: string;
  stringWound: string;
  stringCore: string;
  inlay: string;
  inlayBg: string;
  inlayShadow: string;
  /** Root-ring color that reads against this wood. */
  ring: string;
  dimRing: string;
  dimInk: string;
  /** The neck edge below the board (side-dot strip). */
  edge: string;
  /** Drawing ink (paper mode). */
  ink: string;
}

export const FINISHES: Record<FinishName, Finish> = {
  rosewood: {
    label: 'Rosewood',
    mode: 'wood',
    swatch: '#4a2c1c',
    surface: 'linear-gradient(180deg,#4a2d1d 0%,#3a2216 55%,#2d1a11 100%)',
    grain:
      'repeating-linear-gradient(92deg,rgba(0,0,0,0.42) 0 1px,rgba(255,255,255,0.05) 1px 3px,rgba(0,0,0,0.24) 3px 7px,rgba(140,90,55,0.16) 7px 13px)',
    grainOp: 0.28,
    wire: 'linear-gradient(90deg,#5f666e,#98a1a9 42%,#767d85)',
    nut: 'linear-gradient(90deg,#cbbf9f,#f2e9cf,#bdb08e)',
    stringPlain: 'linear-gradient(180deg,#ffffff,#f0f4f8 30%,#98a1ab)',
    stringWound: 'linear-gradient(180deg,#f0dcae,#c9a86e 34%,#7d6538)',
    stringCore: 'rgba(255,255,255,0.95)',
    inlay: '#f6efe0',
    inlayBg: 'linear-gradient(140deg,#fdf8ee,#ded2bd 60%,#f4ebd9)',
    inlayShadow: 'inset 0 1px 0 rgba(255,255,255,0.8),0 1px 2px rgba(0,0,0,0.5)',
    ring: 'rgba(255,255,255,0.92)',
    dimRing: 'rgba(255,255,255,0.4)',
    dimInk: 'rgba(255,255,255,0.72)',
    edge: 'linear-gradient(180deg,#100d09,#1c1710)',
    ink: '#17150f',
  },
  // Direction 1B "Shop drawing" — the board as a luthier's plate: ink on
  // paper, strings as gauge-varied ink lines, the bar as an outlined
  // silhouette with a dashed centerline.
  paper: {
    label: 'Shop drawing',
    swatch: '#efe9dc',
    mode: 'paper',
    surface: '#f6f1e6',
    grain: 'none',
    grainOp: 0,
    wire: '#17150f',
    nut: '#17150f',
    stringPlain: '#17150f',
    stringWound: '#17150f',
    stringCore: 'transparent',
    inlay: '#17150f',
    inlayBg: '#17150f',
    inlayShadow: 'none',
    ring: 'rgba(0,0,0,0.85)',
    dimRing: 'rgba(23,21,15,0.4)',
    dimInk: 'rgba(23,21,15,0.55)',
    edge: 'transparent',
    ink: '#17150f',
  },
  maple: {
    label: 'Maple',
    mode: 'wood',
    swatch: '#d9b478',
    surface: 'linear-gradient(180deg,#e3c085 0%,#d3ad70 55%,#c29a5d 100%)',
    grain:
      'repeating-linear-gradient(89deg,rgba(120,78,36,0.3) 0 1px,rgba(255,255,255,0.22) 1px 4px,rgba(120,78,36,0.14) 4px 9px)',
    grainOp: 0.25,
    wire: 'linear-gradient(90deg,#565c64,#8d959d 42%,#6d747c)',
    nut: 'linear-gradient(90deg,#b8ab88,#efe6cd,#ab9e7d)',
    stringPlain: 'linear-gradient(180deg,#7d8590,#4a5158 34%,#2f3439)',
    stringWound: 'linear-gradient(180deg,#8a7346,#6a5228 34%,#3d2f14)',
    stringCore: 'rgba(255,255,255,0.6)',
    inlay: '#241d15',
    inlayBg: 'linear-gradient(140deg,#3a3026,#1c1710 60%,#332a20)',
    inlayShadow: 'inset 0 1px 0 rgba(255,255,255,0.14),0 1px 1px rgba(0,0,0,0.28)',
    ring: 'rgba(30,24,17,0.85)',
    dimRing: 'rgba(40,32,22,0.45)',
    dimInk: 'rgba(35,28,20,0.72)',
    edge: 'linear-gradient(180deg,#8a6c3e,#6d5430)',
    ink: '#17150f',
  },
  ebony: {
    label: 'Ebony',
    mode: 'wood',
    swatch: '#1c1917',
    surface: 'linear-gradient(180deg,#221e1b 0%,#171412 55%,#100e0d 100%)',
    grain: 'repeating-linear-gradient(91deg,rgba(0,0,0,0.5) 0 2px,rgba(255,255,255,0.045) 2px 5px)',
    grainOp: 0.22,
    wire: 'linear-gradient(90deg,#636a72,#9ba4ac 42%,#7a8189)',
    nut: 'linear-gradient(90deg,#cdc2a4,#f4ecd4,#bfb392)',
    stringPlain: 'linear-gradient(180deg,#ffffff,#eff3f8 30%,#9aa3ad)',
    stringWound: 'linear-gradient(180deg,#f2dfb4,#cbaa71 34%,#7f673a)',
    stringCore: 'rgba(255,255,255,0.95)',
    inlay: '#f4f1ea',
    inlayBg: 'linear-gradient(140deg,#fffdf8,#e2ded4 60%,#f7f3ec)',
    inlayShadow: 'inset 0 1px 0 rgba(255,255,255,0.85),0 1px 2px rgba(0,0,0,0.6)',
    ring: 'rgba(255,255,255,0.92)',
    dimRing: 'rgba(255,255,255,0.34)',
    dimInk: 'rgba(255,255,255,0.7)',
    edge: 'linear-gradient(180deg,#0b0a09,#161311)',
    ink: '#17150f',
  },
  flat: {
    label: 'Flat UI',
    mode: 'wood',
    swatch: '#20242f',
    surface: 'linear-gradient(180deg,#232833 0%,#1e222c 100%)',
    grain: 'none',
    grainOp: 0,
    wire: '#2f3644',
    nut: '#5b6478',
    stringPlain: '#4a5468',
    stringWound: '#3d465a',
    stringCore: 'rgba(255,255,255,0.22)',
    inlay: '#8f97ab',
    inlayBg: '#8f97ab',
    inlayShadow: 'none',
    ring: '#f0a63c',
    dimRing: 'rgba(143,151,171,0.45)',
    dimInk: 'rgba(190,198,214,0.75)',
    edge: '#080a0d',
    ink: '#17150f',
  },
};

export const INLAY_STYLES: Array<{ id: InlayName; label: string; full: string }> = [
  { id: 'dots', label: 'Dots', full: 'Dot inlays' },
  { id: 'trapezoid', label: 'Trapezoid', full: 'Trapezoid inlays' },
  { id: 'blocks', label: 'Blocks', full: 'Block inlays' },
  { id: 'split', label: 'Split', full: 'Split parallelogram inlays' },
  { id: 'suits', label: 'Suits', full: 'Card suit inlays' },
];

export const BAR_STYLES: Array<{ id: BarStyleName; label: string; hint: string }> = [
  { id: 'tonebar', label: 'Tonebar', hint: 'Dunlop-style flat-top tonebar — thumb scoop and brass screw at the tail' },
  { id: 'steel', label: 'Steel bar', hint: 'Solid chrome pedal-steel bar with a bullet nose' },
  { id: 'slim', label: 'Slim', hint: 'Flat slim indicator' },
];

export interface BoardPrefs {
  finish: FinishName;
  inlay: InlayName;
  barStyle: BarStyleName;
  grain: boolean;
  wire: boolean;
  gauges: boolean;
  side: boolean;
}

export const DEFAULT_BOARD: BoardPrefs = {
  finish: 'rosewood',
  inlay: 'dots',
  barStyle: 'steel',
  grain: true,
  wire: true,
  gauges: true,
  side: true,
};

const BOARD_KEY = 'gfv.board.v1';

export function loadBoardPrefs(): BoardPrefs {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (!raw) return DEFAULT_BOARD;
    const p = JSON.parse(raw);
    return {
      finish: FINISHES[p.finish as FinishName] ? p.finish : DEFAULT_BOARD.finish,
      inlay: INLAY_STYLES.some((s) => s.id === p.inlay) ? p.inlay : DEFAULT_BOARD.inlay,
      barStyle: BAR_STYLES.some((s) => s.id === p.barStyle) ? p.barStyle : DEFAULT_BOARD.barStyle,
      grain: typeof p.grain === 'boolean' ? p.grain : DEFAULT_BOARD.grain,
      wire: typeof p.wire === 'boolean' ? p.wire : DEFAULT_BOARD.wire,
      gauges: typeof p.gauges === 'boolean' ? p.gauges : DEFAULT_BOARD.gauges,
      side: typeof p.side === 'boolean' ? p.side : DEFAULT_BOARD.side,
    };
  } catch {
    return DEFAULT_BOARD;
  }
}

export function saveBoardPrefs(p: BoardPrefs): void {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** String gauge in px for an open-string MIDI pitch (thicker = lower). */
export function stringGauge(midi: number, gauges: boolean): number {
  if (!gauges) return 1.6;
  return Math.max(1, Math.min(3.4, 3.2 - (midi - 47) * (2.2 / 19)));
}

/** Wound (bronze-wrapped) strings live below roughly C♯4. */
export const isWound = (midi: number, gauges: boolean): boolean => gauges && midi < 61;

// ── Bar geometry ───────────────────────────────────────────────────────────
// Everything the bar renderer needs, as a function of the fret column width.
// Ported verbatim from the design's barGeom().

export interface BarGeom {
  w: number;
  top: number;
  h: string;
  radius: string;
  bg: string;
  shadow: string;
  detail: number;
  shade: number;
  plate: number;
  noseH: number;
  tailH: number;
  shadowTop: number;
  crownX: number;
  crownTop: number;
  crownH: number;
  sheenX: number;
  sheenW: number;
  sheenTop: number;
  sheenBot: number;
  specX: number;
  specTop: number;
  specW: number;
  specH: number;
  plateX: number;
  plateTop: number;
  plateBot: number;
  plateR: string;
  bandX: number;
  bandW: number;
  bandTop: number;
  bandBot: number;
  g1: number;
  g2: number;
  scoopX: number;
  scoopBot: number;
  scoopD: number;
  screwX: number;
  screwBot: number;
  screwD: number;
}

const BLANK: Omit<BarGeom, 'w' | 'top' | 'h' | 'radius' | 'bg' | 'shadow'> = {
  detail: 0, shade: 0, plate: 0,
  noseH: 0, tailH: 0, shadowTop: 0,
  crownX: 0, crownTop: -999, crownH: 0,
  sheenX: 0, sheenW: 0, sheenTop: 0, sheenBot: 0,
  specX: 0, specTop: 0, specW: 0, specH: 0,
  plateX: 0, plateTop: 0, plateBot: 0, plateR: '0',
  bandX: 0, bandW: 0, bandTop: 0, bandBot: 0,
  g1: -10, g2: -10,
  scoopX: 0, scoopBot: -999, scoopD: 0,
  screwX: 0, screwBot: -999, screwD: 0,
};

export function barGeom(style: BarStyleName, fretW: number): BarGeom {
  if (style === 'tonebar') {
    // Dunlop 927-style flat-top tonebar seen from above: bullet nose at the
    // treble end, narrow chamfers flanking a broad flat polished face, thumb
    // scoop undercutting the tail with its brass set screw.
    const w = Math.round(Math.min(88, Math.max(56, fretW * 1.34)));
    const nose = Math.round(w * 0.62);
    const chamfer = Math.max(3, Math.round(w * 0.13));
    const scoopD = Math.round(w * 1.05);
    const faceR = Math.round(w * 0.36);
    return {
      ...BLANK,
      w,
      top: -18,
      h: `calc(100% + ${18 + 34}px)`,
      radius: `50% 50% 3px 3px / ${nose}px ${nose}px 3px 3px`,
      bg: 'linear-gradient(90deg,#12171c 0%,#232a30 3%,#5a636b 6%,#a9b3bb 9%,#f2f6f9 12%,#ffffff 15%,#e9eff4 19%,#dee6ec 28%,#d6dee5 38%,#7d868f 43%,#4a525a 47%,#3f474e 52%,#6b747d 56%,#cfd8df 61%,#e2e9ef 72%,#f6f9fb 80%,#fdfeff 84%,#b6c0c8 89%,#69727a 93%,#2c3339 97%,#111619 100%)',
      shadow: 'inset 0 0 0 1px rgba(255,255,255,0.24),0 0 20px rgba(255,255,255,0.08)',
      detail: 1,
      shade: 1,
      plate: 1,
      noseH: Math.round(nose * 0.8),
      crownX: Math.max(2, Math.round(w * 0.06)),
      crownTop: 2,
      crownH: Math.round(nose * 0.5),
      shadowTop: Math.round(nose * 0.4),
      sheenX: Math.round(w * 0.135),
      sheenW: Math.max(2, Math.round(w * 0.035)),
      sheenTop: Math.round(nose * 0.62),
      sheenBot: 8,
      specX: Math.round(w * 0.2),
      specTop: Math.round(nose * 0.2),
      specW: Math.round(w * 0.3),
      specH: Math.round(w * 0.2),
      plateX: chamfer,
      plateTop: Math.round(nose * 0.34),
      plateBot: 3,
      plateR: `${faceR}px ${faceR}px 2px 2px / ${Math.round(nose * 0.72)}px ${Math.round(nose * 0.72)}px 2px 2px`,
      scoopX: Math.round((w - scoopD) / 2),
      scoopBot: -Math.round(scoopD * 0.66),
      scoopD,
      screwX: Math.round(w * 0.17),
      screwBot: Math.round(w * 0.05),
      screwD: Math.max(4, Math.round(w * 0.1)),
    };
  }

  if (style === 'steel') {
    const w = Math.round(Math.min(74, Math.max(46, fretW * 1.08)));
    const nose = Math.round(w * 0.9);
    return {
      ...BLANK,
      w,
      top: -22,
      h: `calc(100% + ${22 + 26}px)`,
      radius: `50% 50% 3px 3px / ${nose}px ${nose}px 3px 3px`,
      // chrome cross-section: sky band, hard horizon, ground bounce, rim light
      bg: 'linear-gradient(90deg,#191d22 0%,#3f474f 3%,#79848f 9%,#b4bfc9 16%,#e9f0f6 22%,#ffffff 27%,#f6fafd 31%,#cfd8e1 37%,#97a1ab 42%,#5b646d 45%,#333a41 47%,#414951 53%,#626b74 62%,#8f99a3 71%,#c8d1da 80%,#e8eef4 85%,#9aa4ae 91%,#4d555d 96%,#1d2126 100%)',
      shadow: 'inset 0 0 0 1px rgba(255,255,255,0.18),0 0 20px rgba(255,255,255,0.1)',
      detail: 1,
      shade: 1,
      noseH: nose,
      crownX: Math.max(2, Math.round(w * 0.08)),
      crownTop: 2,
      crownH: Math.round(nose * 0.44),
      shadowTop: Math.round(nose * 0.5),
      sheenX: Math.round(w * 0.245),
      sheenW: Math.max(2, Math.round(w * 0.075)),
      sheenTop: Math.round(nose * 0.4),
      sheenBot: 7,
      specX: Math.round(w * 0.17),
      specTop: Math.round(nose * 0.3),
      specW: Math.round(w * 0.34),
      specH: Math.round(w * 0.26),
    };
  }

  return {
    ...BLANK,
    w: 11,
    top: -3,
    h: 'calc(100% + 6px)',
    radius: '5px',
    bg: 'linear-gradient(90deg,#5c6268 0%,#aeb5bd 18%,#f7fbff 44%,#c7ced6 62%,#787f87 84%,#4d5359 100%)',
    shadow: '0 0 14px rgba(255,255,255,0.22),3px 0 8px rgba(0,0,0,0.5)',
  };
}
