/**
 * The embed entry — how a foreign page (the VG-800 MIDI controller) hosts the
 * fretboard. Built standalone by vite.config.embed.ts into one self-contained
 * ES module (React and styled-components bundled in) that the host commits as
 * an artifact and lazy-imports on first open.
 *
 * Differences from the standalone app, all switched by the `embedded` prop:
 * no GlobalStyle (nothing may restyle the host page), no URL-hash coupling,
 * no persisted board state (the host drives the tuning), theme supplied by
 * the host. Board prefs / volume / sound settings still share the gfv.*
 * localStorage keys on purpose — same origin, same user, same preferences.
 *
 * The steel AudioWorklet ships INLINE (?raw import → Blob URL): the built
 * asset URL would 404 from the host's path, and Chromium worklet fetches
 * bypass service workers, so a file could never be made offline-safe anyway.
 */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import App, { type EmbedHandlers, type ExternalTuning } from './App';
import { darkTheme, lightTheme, type Theme } from './theme';
import { setWorkletUrl } from './lib/steelEngine';
import { TUNINGS, getTuning } from './lib/tunings';
import workletSrc from './lib/steel-processor.js?raw';

export const EMBED_VERSION = '1.0.0';

let workletBlobUrl: string | null = null;
setWorkletUrl(
  () =>
    (workletBlobUrl ??= URL.createObjectURL(
      new Blob([workletSrc], { type: 'text/javascript' })
    ))
);

// ── Theme ──────────────────────────────────────────────────────────────────

export interface EmbedThemeTokens {
  /** Which built-in theme supplies everything not overridden. */
  base: 'dark' | 'light';
  colors?: Partial<Theme['colors']>;
  fonts?: Partial<Pick<Theme, 'fontFamily' | 'monoFamily' | 'titleFamily'>>;
}

/** Drop undefined-valued keys so they fall through to the base, not clobber it. */
const defined = <T extends object>(o: T | undefined): Partial<T> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o ?? {})) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
};

/** Build a full theme from host-supplied tokens on top of a built-in base. */
export function makeEmbedTheme(tokens: EmbedThemeTokens): Theme {
  const base = tokens.base === 'light' ? lightTheme : darkTheme;
  return {
    ...base,
    ...defined(tokens.fonts),
    colors: { ...base.colors, ...defined(tokens.colors) },
  };
}

// ── Tuning name mapping ────────────────────────────────────────────────────
// The catalog was generated from the VG-800's own tuning list, so display
// names round-trip: map by (case/space-insensitive) name rather than by a
// hand-maintained table that would rot.

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const NAME_TO_ID = new Map(TUNINGS.map((t) => [normName(t.name), t.id]));

// Four names diverged when the catalog spelled out what the VG-800 abbreviates
// ("Open G low" → "Open G (low bass)"). Verified as the ONLY mismatches by
// diffing both catalogs; keep both directions here.
const HOST_ALIASES: Array<[hostName: string, id: string]> = [
  ['E9 lap', 'e9-lap'],
  ['Open G Dobro', 'open-g-dobro'],
  ['Open G low', 'open-g-low'],
  ['Open A high', 'open-a-high'],
];
const ALIAS_TO_ID = new Map(HOST_ALIASES.map(([n, id]) => [normName(n), id]));
const ID_TO_HOST_NAME = new Map(HOST_ALIASES.map(([n, id]) => [id, n]));

export function tuningIdForName(name: string): string | null {
  const key = normName(name);
  return NAME_TO_ID.get(key) ?? ALIAS_TO_ID.get(key) ?? null;
}

/** Display name for host-side sync — the HOST's spelling where they diverge. */
export function tuningNameForId(id: string): string | null {
  return ID_TO_HOST_NAME.get(id) ?? getTuning(id)?.name ?? null;
}

// ── Mount ──────────────────────────────────────────────────────────────────

export interface MountOptions {
  theme?: Theme | 'dark' | 'light';
  tuningId?: string;
  onTuningChange?: (id: string) => void;
}

export interface FretboardController {
  readonly version: string;
  /** Show a catalog tuning. Unknown ids are ignored. */
  setTuning(id: string): void;
  /** Show an ad-hoc stack (absolute MIDI, low string first, 3–10 strings). */
  setCustomTuning(midiLowFirst: number[]): void;
  setTheme(theme: Theme | 'dark' | 'light'): void;
  /** Close one open layer (menu/popover). True if something was closed. */
  closeTopLayer(): boolean;
  stopAudio(): void;
  unmount(): void;
}

const resolveTheme = (t?: Theme | 'dark' | 'light'): Theme =>
  t === 'light' ? lightTheme : t === 'dark' || t == null ? darkTheme : t;

export function mountFretboard(
  el: HTMLElement,
  opts: MountOptions = {}
): FretboardController {
  let handlers: EmbedHandlers | null = null;
  let seq = 0;
  // Controller calls can land before React's first effect registers the state
  // setters (render is async) — buffer the latest push of each kind and flush
  // on registration, so an open-then-immediately-sync host never loses one.
  const api: {
    setTheme?: (t: Theme) => void;
    setExt?: (e: ExternalTuning) => void;
    pendingTheme?: Theme;
    pendingExt?: ExternalTuning;
  } = {};

  const Host: React.FC = () => {
    const [theme, setTheme] = useState<Theme>(() => resolveTheme(opts.theme));
    const [ext, setExt] = useState<ExternalTuning | null>(() =>
      opts.tuningId && getTuning(opts.tuningId)
        ? { kind: 'id', id: opts.tuningId, n: ++seq }
        : null
    );
    useEffect(() => {
      api.setTheme = setTheme;
      api.setExt = setExt;
      if (api.pendingTheme) setTheme(api.pendingTheme);
      if (api.pendingExt) setExt(api.pendingExt);
      api.pendingTheme = undefined;
      api.pendingExt = undefined;
      return () => {
        api.setTheme = undefined;
        api.setExt = undefined;
      };
    }, []);
    return (
      <App
        embedded
        embedTheme={theme}
        externalTuning={ext}
        onTuningChange={opts.onTuningChange}
        registerEmbedHandlers={(h) => {
          handlers = h;
        }}
      />
    );
  };

  const root = createRoot(el);
  root.render(<Host />);

  const pushExt = (e: ExternalTuning) => {
    if (api.setExt) api.setExt(e);
    else api.pendingExt = e;
  };

  return {
    version: EMBED_VERSION,
    setTuning(id) {
      if (getTuning(id)) pushExt({ kind: 'id', id, n: ++seq });
    },
    setCustomTuning(midi) {
      if (Array.isArray(midi) && midi.length >= 3 && midi.length <= 10) {
        pushExt({ kind: 'custom', midi: [...midi], n: ++seq });
      }
    },
    setTheme(t) {
      const resolved = resolveTheme(t);
      if (api.setTheme) api.setTheme(resolved);
      else api.pendingTheme = resolved;
    },
    closeTopLayer() {
      return handlers?.closeTopLayer() ?? false;
    },
    stopAudio() {
      handlers?.stopAudio();
    },
    unmount() {
      handlers?.stopAudio();
      root.unmount();
    },
  };
}
