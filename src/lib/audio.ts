/**
 * A small Web Audio voice engine for the fretboard.
 *
 * Deliberately synthesised rather than sampled: the app stays a single static
 * bundle with no assets to fetch, which is what makes it deployable anywhere.
 * The signature move is the *bar scoop* — every note slides in from just under
 * pitch, which is what makes an oscillator read as a steel rather than a beep.
 */

export type ToneName = 'warm' | 'sine';

export interface Tone {
  label: string;
  osc: OscillatorType;
  filterHz: number;
  filterQ: number;
  /** How far under pitch the note starts (1 = no scoop). */
  scoop: number;
  detune?: number;
}

export const TONES: Record<ToneName, Tone> = {
  warm: { label: 'Warm', osc: 'sawtooth', filterHz: 1500, filterQ: 1.2, scoop: 0.965 },
  sine: { label: 'Pure', osc: 'sine', filterHz: 6000, filterQ: 0.5, scoop: 1 },
};

export const TONE_NAMES = Object.keys(TONES) as ToneName[];

const CHORD_RING_MS = 1400;
const STRUM_STAGGER_MS = 55;

interface Voice {
  oscillator: OscillatorNode;
  gain: GainNode;
  startAt: number;
}

export class FretboardAudio {
  private ctx: AudioContext | null = null;
  private voices = new Map<string, Voice>();
  private timeouts: number[] = [];

  tone: ToneName = 'warm';
  volume = 0.7;

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
    if (this.playing.size) {
      this.playing.clear();
      this.emit();
    }
  }

  private playVoice(midi: number, key: string, gainScale: number, startAt: number): void {
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
    gain.gain.linearRampToValueAtTime(0.22, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.35);

    const master = ctx.createGain();
    master.gain.value = this.volume * gainScale;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    master.connect(ctx.destination);
    osc.start(startAt);

    this.voices.set(key, { oscillator: osc, gain, startAt });
  }

  /**
   * Strum the given strings (rendered low→high) at `fret`, with equal-power
   * normalisation so a 10-string pedal-steel stack stays clip-safe.
   */
  async strum(tuningMidi: number[], stringIdxs: number[], fret: number): Promise<void> {
    this.stopAll();
    if (stringIdxs.length === 0) return;

    const ctx = this.context();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* keep going; the voices will still be scheduled */
      }
    }

    const ordered = [...stringIdxs].sort((a, b) => a - b);
    const gainScale = Math.min(1, 1 / Math.sqrt(ordered.length));
    const t0 = ctx.currentTime;

    ordered.forEach((s, i) => {
      this.playVoice(tuningMidi[s] + fret, `s${s}`, gainScale, t0 + (i * STRUM_STAGGER_MS) / 1000);

      this.timeouts.push(
        window.setTimeout(() => {
          this.playing.add(s);
          this.emit();
        }, i * STRUM_STAGGER_MS),
        window.setTimeout(() => {
          this.stopVoice(`s${s}`);
          this.playing.delete(s);
          this.emit();
        }, i * STRUM_STAGGER_MS + CHORD_RING_MS)
      );
    });
  }

  /** One note, at an arbitrary fret (used by the whole-neck map view). */
  async pluck(midi: number, key = 'single'): Promise<void> {
    this.stopAll();
    const ctx = this.context();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* ignore */
      }
    }
    this.playVoice(midi, key, 1, ctx.currentTime);
    this.timeouts.push(window.setTimeout(() => this.stopVoice(key), CHORD_RING_MS));
  }

  dispose(): void {
    this.stopAll();
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
