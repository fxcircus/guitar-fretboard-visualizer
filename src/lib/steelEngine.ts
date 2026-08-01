/**
 * The steel amp: hosts the steel-ks AudioWorklet string bank and the shared
 * effects bus that turns raw plucked strings into an electric lap/pedal steel
 * tone. Every number here comes from the tone research (see README):
 *
 *   strings → pickup resonance (biquad LP 3 kHz Q 2.2 — the overwound
 *   single-coil peak) → compressor (the pedal-steel squeeze) → blackface
 *   tone stack (mid scoop, bass hump, bright switch) → dry + three sends:
 *   subtle stereo chorus (the shimmer), one quiet Nashville echo repeat,
 *   and a generated spring-reverb impulse (no audio assets).
 *
 * The graph builds on any BaseAudioContext, so the same code renders offline
 * for the objective verification suite.
 */

export interface SteelGraph {
  ctx: BaseAudioContext;
  node: AudioWorkletNode;
  /** Raw string-bank output, pre-bus — used by the verification renders. */
  raw: GainNode;
  master: GainNode;
  pluck: (voice: number, freq: number, vel: number, when: number, pan: number) => void;
  damp: (voice: number, when?: number) => void;
  dampAll: (when?: number) => void;
  setVolume: (v: number) => void;
  /**
   * The volume pedal. dur > 0 closes it at `when` and opens it over `dur`
   * seconds (the swell); dur = 0 snaps it open for normal picking.
   */
  setSwell: (when: number, dur: number) => void;
}

export const STEEL_WORKLET_URL = new URL('./steel-processor.js', import.meta.url);

// ── Generated spring-reverb impulse (reverbGen approach) ───────────────────
// Independent noise per channel (that alone decorrelates the stereo image),
// exponential decay to T60, 10 ms fade-in, highpassed at ~200 Hz with a
// lowpass sweeping 4000 → 1200 Hz across the tail — the spring band-limit.
function makeSpringIR(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const T60 = 2.8;
  const len = Math.floor(1.3 * T60 * sr);
  const buf = ctx.createBuffer(2, len, sr);
  const decayBase = Math.pow(0.001, 1 / (T60 * sr));
  const fadeIn = Math.floor(0.01 * sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    let hpX = 0;
    let hpY = 0;
    let env = 1;
    for (let i = 0; i < len; i++) {
      const lpHz = 4000 - (2800 * i) / len; // 4000 → 1200 Hz
      const rLp = Math.exp((-2 * Math.PI * lpHz) / sr);
      const rHp = Math.exp((-2 * Math.PI * 200) / sr);
      let x = (Math.random() * 2 - 1) * env;
      env *= decayBase;
      lp = (1 - rLp) * x + rLp * lp; // sweeping lowpass
      x = lp;
      const hp = rHp * (hpY + x - hpX); // ~200 Hz highpass
      hpX = x;
      hpY = hp;
      data[i] = hp * (i < fadeIn ? i / fadeIn : 1);
    }
  }
  return buf;
}

/** Build the string bank + amp bus. Await after a user gesture. */
export async function createSteelGraph(
  ctx: BaseAudioContext,
  destination?: AudioNode
): Promise<SteelGraph> {
  await ctx.audioWorklet.addModule(STEEL_WORKLET_URL);

  const node = new AudioWorkletNode(ctx, 'steel-ks', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  const raw = ctx.createGain();
  raw.gain.value = 1;
  node.connect(raw);

  // Pickup: the overwound steel single-coil L-C resonance (~3 kHz peak).
  const pickup = ctx.createBiquadFilter();
  pickup.type = 'lowpass';
  pickup.frequency.value = 3000;
  pickup.Q.value = 2.2;

  // Drive INTO the squeeze: the raw string bank sits too low for the
  // compressor to work across the whole ring (measured: a held chord fell
  // 25 dB in 2 s with the signal under threshold). +11 dB in, wide soft
  // knee, then trim back out.
  const preComp = ctx.createGain();
  preComp.gain.value = 5;

  // The squeeze. All five params set — the node defaults crush the pick.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -38;
  comp.knee.value = 20;
  comp.ratio.value = 8;
  comp.attack.value = 0.008; // let the pick ping through
  comp.release.value = 0.3;

  // Level-match: offset the drive and the compressor's fixed auto-makeup.
  const trim = ctx.createGain();
  trim.gain.value = 0.5;

  // Blackface Twin, mids off, bright on.
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 500;
  mid.gain.value = -9;
  mid.Q.value = 0.8;
  const low = ctx.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 110;
  low.gain.value = 3;
  const high = ctx.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 2200;
  high.gain.value = 4;

  const master = ctx.createGain();
  master.gain.value = 0.9;

  raw.connect(pickup);
  pickup.connect(preComp);
  preComp.connect(comp);
  comp.connect(trim);
  trim.connect(mid);
  mid.connect(low);
  low.connect(high);

  // Dry
  const dry = ctx.createGain();
  dry.gain.value = 1;
  high.connect(dry);
  dry.connect(master);

  // Chorus send — the shimmer. Base 9 ms, ±2 ms at 0.5 Hz, L/R antiphase.
  const chSend = ctx.createGain();
  chSend.gain.value = 0.22;
  high.connect(chSend);
  const split = ctx.createChannelSplitter(2);
  const merge = ctx.createChannelMerger(2);
  chSend.connect(split);
  const mkChorusTap = (channel: number, invert: boolean) => {
    const dl = ctx.createDelay(0.05);
    dl.delayTime.value = 0.009;
    split.connect(dl, channel);
    dl.connect(merge, 0, channel);
    const depth = ctx.createGain();
    depth.gain.value = invert ? -0.002 : 0.002;
    depth.connect(dl.delayTime);
    return depth;
  };
  const depthL = mkChorusTap(0, false);
  const depthR = mkChorusTap(1, true);
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.5;
  lfo.connect(depthL);
  lfo.connect(depthR);
  lfo.start();
  merge.connect(master);

  // Echo send — one quiet Nashville repeat.
  const eSend = ctx.createGain();
  eSend.gain.value = 0.15;
  high.connect(eSend);
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.3;
  const eFb = ctx.createGain();
  eFb.gain.value = 0.25;
  eSend.connect(echo);
  echo.connect(eFb);
  eFb.connect(echo);
  echo.connect(master);

  // Spring reverb send — generated impulse, no assets.
  const rSend = ctx.createGain();
  rSend.gain.value = 0.2;
  high.connect(rSend);
  const verb = ctx.createConvolver();
  verb.normalize = true; // deterministic wet level regardless of IR envelope
  verb.buffer = makeSpringIR(ctx);
  rSend.connect(verb);
  verb.connect(master);

  // The volume pedal sits after everything — closing it silences the pick
  // itself, which is what makes a swell read as a swell.
  const pedal = ctx.createGain();
  pedal.gain.value = 1;
  master.connect(pedal);
  pedal.connect(destination ?? ctx.destination);

  let volume = 0.7;
  const applyVolume = () => {
    master.gain.value = 0.9 * (volume / 0.7); // 0.7 = the app's default level
  };
  applyVolume();

  return {
    ctx,
    node,
    raw,
    master,
    pluck(voice, freq, vel, when, pan) {
      // constant-ish stereo spread ±0.2 across the neck
      const gl = (1 - 0.2 * pan) / 2;
      const gr = (1 + 0.2 * pan) / 2;
      node.port.postMessage({ type: 'pluck', voice, freq, vel, when, gl, gr });
    },
    damp(voice, when = 0) {
      node.port.postMessage({ type: 'off', voice, when });
    },
    dampAll(when = 0) {
      node.port.postMessage({ type: 'alloff', when });
    },
    setVolume(v) {
      volume = v;
      applyVolume();
    },
    setSwell(when, dur) {
      const g = pedal.gain;
      g.cancelScheduledValues(0);
      if (dur > 0) {
        g.setValueAtTime(0, when);
        g.linearRampToValueAtTime(1, when + dur);
      } else {
        g.setValueAtTime(1, when);
      }
    },
  };
}

// Dev-only hook for the objective verification harness (OfflineAudioContext
// renders driven from the browser console).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__gfvSteel = {
    createSteelGraph,
    workletUrl: STEEL_WORKLET_URL.href,
  };
}
