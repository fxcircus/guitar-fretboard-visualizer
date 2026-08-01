/**
 * The fretboard's voice engine.
 *
 * Deliberately synthesised rather than sampled: the app stays a single static
 * bundle with no assets to fetch, which is what makes it deployable anywhere.
 *
 * The default 'steel' tone is a physically-modelled string bank — Extended
 * Karplus-Strong in an AudioWorklet (see steel-processor.js) through a steel
 * amp bus (see steelEngine.ts): only a plucked-string model gives the
 * per-harmonic decay (bright pick settling into a singing sustain) that makes
 * a note read as a real instrument. 'sine' and 'saw' remain as plain
 * oscillator voices, and double as the fallback when AudioWorklet is
 * unavailable.
 */
import { createSteelGraph, type SteelGraph } from './steelEngine';

export type ToneName = 'steel' | 'sine' | 'saw';

/** How a chord is delivered: picked in sequence, together, or swelled in. */
export type PlayMode = 'strum' | 'together' | 'swell';

export const PLAY_MODES: Record<PlayMode, { label: string; hint: string }> = {
  strum: { label: 'Strum', hint: 'Picked low to high, one string after the next' },
  together: { label: 'Together', hint: 'Every string at once — a block chord' },
  swell: {
    label: 'Swell',
    hint: 'Volume-pedal fade-in — the pick disappears and the chord blooms',
  },
};

export const PLAY_MODE_NAMES = Object.keys(PLAY_MODES) as PlayMode[];

export interface Tone {
  label: string;
  osc: OscillatorType;
  filterHz: number;
  filterQ: number;
  /** How far under pitch the note starts (1 = no scoop). */
  scoop: number;
  detune?: number;
}

// 'steel' is the modelled string; its oscillator fields are only the fallback
// voice for browsers without AudioWorklet.
export const TONES: Record<ToneName, Tone> = {
  steel: { label: 'Steel', osc: 'sawtooth', filterHz: 3000, filterQ: 2, scoop: 0.972 },
  sine: { label: 'Sine', osc: 'sine', filterHz: 6000, filterQ: 0.5, scoop: 1 },
  saw: { label: 'Saw', osc: 'sawtooth', filterHz: 1500, filterQ: 1.2, scoop: 0.965 },
};

export const TONE_NAMES = Object.keys(TONES) as ToneName[];

const CHORD_RING_MS = 1400;
const STRUM_STAGGER_MS = 55;
// The swell: strings sound with the pedal closed (gain 0) and fade in over
// this long — the pick transient never reaches the ear, only the bloom.
const SWELL_S = 0.8;
// The oscillator fallback approximates the same feel with a slow attack.
const SWELL_ATTACK_S = 0.7;

interface Voice {
  oscillator: OscillatorNode;
  gain: GainNode;
  startAt: number;
}

export class FretboardAudio {
  private ctx: AudioContext | null = null;
  private voices = new Map<string, Voice>();
  private timeouts: number[] = [];
  private steel: SteelGraph | null = null;
  private steelInit: Promise<SteelGraph | null> | null = null;
  private steelFailed = false;
  private _volume = 0.7;

  tone: ToneName = 'steel';
  mode: PlayMode = 'strum';

  get volume(): number {
    return this._volume;
  }
  set volume(v: number) {
    this._volume = v;
    this.steel?.setVolume(v);
  }

  /** Called with the set of currently sounding string indices. */
  onPlayingChange: ((strings: Set<number>) => void) | null = null;

  private playing = new Set<number>();

  private context(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  /**
   * Lazily boot the steel string bank the first time a steel note is asked
   * for. Returns null (and remembers the failure) on browsers without
   * AudioWorklet, which sends those notes down the oscillator fallback.
   */
  private async ensureSteel(): Promise<SteelGraph | null> {
    if (this.steel) return this.steel;
    if (this.steelFailed) return null;
    if (!this.steelInit) {
      const ctx = this.context();
      this.steelInit = (async () => {
        try {
          if (!ctx.audioWorklet) throw new Error('no AudioWorklet');
          const g = await createSteelGraph(ctx);
          g.setVolume(this.volume);
          this.steel = g;
          return g;
        } catch {
          this.steelFailed = true;
          return null;
        }
      })();
    }
    return this.steelInit;
  }

  private emit(): void {
    this.onPlayingChange?.(new Set(this.playing));
  }

  private stopVoice(key: string): void {
    const entry = this.voices.get(key);
    if (!entry || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      if (entry.startAt > now) {
        // Scheduled but not sounding yet — cancel outright and hold the gain
        // at 0, so an interrupted strum leaks no click.
        entry.gain.gain.cancelScheduledValues(now);
        entry.gain.gain.setValueAtTime(0, now);
        entry.oscillator.stop(entry.startAt);
      } else {
        entry.gain.gain.cancelScheduledValues(now);
        entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
        entry.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        entry.oscillator.stop(now + 0.35);
      }
    } catch {
      /* an already-stopped node — nothing to do */
    }
    this.voices.delete(key);
  }

  stopAll(): void {
    this.timeouts.forEach((id) => window.clearTimeout(id));
    this.timeouts = [];
    Array.from(this.voices.keys()).forEach((k) => this.stopVoice(k));
    // Steel strings damp like blocking (0.2 s), not a hard gate.
    this.steel?.dampAll();
    if (this.playing.size) {
      this.playing.clear();
      this.emit();
    }
  }

  private playVoice(
    midi: number,
    key: string,
    gainScale: number,
    startAt: number,
    attackS = 0.012
  ): void {
    const ctx = this.context();
    this.stopVoice(key);
    const tone = TONES[this.tone];
    const freq = 440 * Math.pow(2, (midi - 69) / 12) * (tone.detune ?? 1);

    const osc = ctx.createOscillator();
    osc.type = tone.osc;
    // Bar scoop: land just under pitch and slide up.
    osc.frequency.setValueAtTime(freq * tone.scoop, startAt);
    osc.frequency.exponentialRampToValueAtTime(freq, startAt + 0.055);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = tone.filterHz;
    filter.Q.value = tone.filterQ;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(0.22, startAt + attackS);
    gain.gain.exponentialRampToValueAtTime(0.12, startAt + attackS + 0.35);

    const master = ctx.createGain();
    master.gain.value = this.volume * gainScale;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    master.connect(ctx.destination);
    osc.start(startAt);

    this.voices.set(key, { oscillator: osc, gain, startAt });
  }

  private static freqOf(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private async resume(): Promise<AudioContext> {
    const ctx = this.context();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* keep going; voices will still be scheduled */
      }
    }
    return ctx;
  }

  /**
   * Play the given strings (rendered low→high) at `fret`, delivered per the
   * current mode: strummed with a stagger, together as a block, or swelled in
   * behind a closed volume pedal. The steel bank's bus compressor levels
   * chords; the oscillator fallback keeps equal-power normalisation.
   */
  async strum(tuningMidi: number[], stringIdxs: number[], fret: number): Promise<void> {
    this.stopAll();
    if (stringIdxs.length === 0) return;

    const ctx = await this.resume();
    const steel = this.tone === 'steel' ? await this.ensureSteel() : null;

    const swell = this.mode === 'swell';
    const stagger = this.mode === 'strum' ? STRUM_STAGGER_MS : 0;
    // A swell picks softly — the fade hides the attack; the bloom matters.
    const vel = swell ? 0.55 : 0.85;
    const ringMs = CHORD_RING_MS + (swell ? SWELL_S * 1000 : 0);

    const ordered = [...stringIdxs].sort((a, b) => a - b);
    const gainScale = Math.min(1, 1 / Math.sqrt(ordered.length));
    const t0 = ctx.currentTime;
    const count = tuningMidi.length;

    steel?.setSwell(t0, swell ? SWELL_S : 0);

    ordered.forEach((s, i) => {
      const when = t0 + (i * stagger) / 1000;
      if (steel) {
        const pan = count > 1 ? (s / (count - 1)) * 2 - 1 : 0;
        steel.pluck(s, FretboardAudio.freqOf(tuningMidi[s] + fret), vel, when, pan);
      } else {
        this.playVoice(
          tuningMidi[s] + fret,
          `s${s}`,
          gainScale,
          when,
          swell ? SWELL_ATTACK_S : undefined
        );
      }

      this.timeouts.push(
        window.setTimeout(() => {
          this.playing.add(s);
          this.emit();
        }, i * stagger),
        window.setTimeout(() => {
          if (!steel) this.stopVoice(`s${s}`);
          this.playing.delete(s);
          this.emit();
        }, i * stagger + ringMs)
      );
    });
  }

  /**
   * One note with no string attached (the volume-slider beep). Always
   * immediate — a swelled beep would say nothing about the level.
   */
  async pluck(midi: number, key = 'single'): Promise<void> {
    this.stopAll();
    const ctx = await this.resume();
    const steel = this.tone === 'steel' ? await this.ensureSteel() : null;
    if (steel) {
      steel.setSwell(ctx.currentTime, 0);
      steel.pluck(0, FretboardAudio.freqOf(midi), 0.9, ctx.currentTime, 0);
      return;
    }
    this.playVoice(midi, key, 1, ctx.currentTime);
    this.timeouts.push(window.setTimeout(() => this.stopVoice(key), CHORD_RING_MS));
  }

  /** One note on a specific string, with the string's visual pulse. */
  async pluckString(stringIdx: number, midi: number): Promise<void> {
    this.stopAll();
    const ctx = await this.resume();
    const steel = this.tone === 'steel' ? await this.ensureSteel() : null;
    const swell = this.mode === 'swell';
    if (steel) {
      steel.setSwell(ctx.currentTime, swell ? SWELL_S : 0);
      steel.pluck(stringIdx, FretboardAudio.freqOf(midi), swell ? 0.55 : 0.9, ctx.currentTime, 0);
    } else {
      this.playVoice(midi, `s${stringIdx}`, 1, ctx.currentTime, swell ? SWELL_ATTACK_S : undefined);
    }
    this.playing.add(stringIdx);
    this.emit();
    this.timeouts.push(
      window.setTimeout(() => {
        if (!steel) this.stopVoice(`s${stringIdx}`);
        this.playing.delete(stringIdx);
        this.emit();
      }, CHORD_RING_MS + (swell ? SWELL_S * 1000 : 0))
    );
  }

  dispose(): void {
    this.stopAll();
    this.steel = null;
    this.steelInit = null;
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
