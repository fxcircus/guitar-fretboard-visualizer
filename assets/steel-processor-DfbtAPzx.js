/* eslint-disable */
/**
 * steel-ks — a 10-voice Extended Karplus-Strong string bank.
 *
 * Plain dependency-free JS on purpose: Vite ships AudioWorklet modules as raw
 * assets (new URL('./steel-processor.js', import.meta.url)), untranspiled.
 *
 * The design follows Julius O. Smith's EKS reference (ccrma.stanford.edu,
 * "Making Virtual Electric Guitars and Associated Effects Using Faust"):
 *   - delay-line loop, read distance D = sampleRate/f − 2 (the FIR3 damping
 *     filter contributes exactly 1 sample of phase delay, the Lagrange read
 *     centering another ~1)
 *   - 4th-order Lagrange fractional-delay read — robust under the gliding
 *     delay of the bar scoop and vibrato (allpass interpolation artifacts
 *     under fast delay changes; linear interp buzzes with light damping)
 *   - linear-phase FIR3 damping  y = ρ·(h0·x1 + h1·(x0 + x2)),
 *     h0 = (1+B)/2, h1 = (1−B)/4 — brightness B never detunes the string
 *   - loop gain ρ = 0.001^(1/(f·t60)) — every register decays −60 dB in the
 *     same t60, so trebles ring like a real steel
 *   - excitation: one period of mean-subtracted white noise, lowpassed by
 *     velocity (louder = brighter pick), minus a pick-position comb copy
 *   - DC blocker outside the loop
 *
 * Messages: {type:'pluck', voice, freq, vel, when, gl, gr}
 *           {type:'off', voice, when}   — damp like blocking (t60 0.2 s)
 *           {type:'alloff', when}
 */

const NV = 10;
const BUFLEN = 4096; // power of two; covers fundamentals down to ~12 Hz
const MASK = BUFLEN - 1;

const BRIGHTNESS = 0.72; // steel range 0.6–0.8 (0.5 = ordinary guitar)
const T60_HELD = 6.0; // seconds — pedal-steel sustain band 4–8 s
const T60_RELEASE = 0.2; // blocking damp on note-off
const SCOOP_CENTS = -45; // bar slides in from below
const SCOOP_TAU = 0.02; // exponential approach, ~95% settled at 60 ms
const VIB_RATE = 5.7; // Hz — classic bar vibrato band 5–6.5
const VIB_DEPTH = 0.00695; // ±12 cents as a frequency ratio
const VIB_START = 0.35; // silent until the note settles…
const VIB_FULL = 0.7; // …full depth by here
const PICK_POS = 0.12; // β: pick-position comb, near-bridge steel picking
const IDLE_LEVEL = 3.2e-5; // −90 dB — below this a voice stops burning CPU

const H0 = (1 + BRIGHTNESS) / 2;
const H1 = (1 - BRIGHTNESS) / 4;
const SCOOP_DEPTH = 1 - Math.pow(2, SCOOP_CENTS / 1200); // ≈ 0.0257

class SteelKS extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    for (let v = 0; v < NV; v++) {
      this.voices.push({
        active: false,
        buf: new Float32Array(BUFLEN),
        wi: 0,
        freq: 220,
        rho: 0.999,
        x1: 0,
        x2: 0,
        dcX: 0,
        dcY: 0,
        exc: null,
        excPos: 0,
        scoopEnv: 0, // 1 → 0 exponential; f = freq·(1 − depth·env)
        vibPhase: 0,
        age: 0, // frames since pluck
        peak: 0,
        gl: 0.5,
        gr: 0.5,
      });
    }
    this.pending = [];
    this.scoopDecay = Math.exp(-1 / (SCOOP_TAU * sampleRate));
    this.vibInc = (2 * Math.PI * VIB_RATE) / sampleRate;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m && (m.type === 'pluck' || m.type === 'off' || m.type === 'alloff')) {
        this.pending.push(m);
      }
    };
  }

  makeBurst(freq, vel) {
    const P = Math.max(2, Math.round(sampleRate / freq));
    const burst = new Float32Array(P);
    let mean = 0;
    for (let i = 0; i < P; i++) {
      burst[i] = Math.random() * 2 - 1;
      mean += burst[i];
    }
    mean /= P;
    // Mean-subtract: DC never decays inside the loop.
    for (let i = 0; i < P; i++) burst[i] -= mean;
    // Velocity → pick brightness: one-pole lowpass, bw = 300 + vel·9000 Hz.
    const bw = 300 + vel * 9000;
    const R = Math.exp((-Math.PI * bw) / sampleRate);
    let y = 0;
    for (let i = 0; i < P; i++) {
      y = (1 - R) * burst[i] + R * y;
      burst[i] = y;
    }
    // Pick-position comb: subtract a copy delayed by β·P (spectral zeros at
    // the harmonics with a node under the pick).
    const combD = Math.max(1, Math.floor(PICK_POS * P));
    for (let i = P - 1; i >= combD; i--) burst[i] -= burst[i - combD];
    // Headroom for ten voices before the bus compressor.
    const g = 0.6 * vel;
    for (let i = 0; i < P; i++) burst[i] *= g;
    return burst;
  }

  rhoFor(freq, t60) {
    return Math.pow(0.001, 1 / (Math.max(20, freq) * t60));
  }

  handleMsg(m) {
    if (m.type === 'alloff') {
      for (const v of this.voices) {
        if (v.active) v.rho = this.rhoFor(v.freq, T60_RELEASE);
      }
      return;
    }
    const v = this.voices[m.voice];
    if (!v) return;
    if (m.type === 'off') {
      if (v.active) v.rho = this.rhoFor(v.freq, T60_RELEASE);
      return;
    }
    // pluck
    if (!v.active) {
      v.buf.fill(0);
      v.x1 = 0;
      v.x2 = 0;
      v.dcX = 0;
      v.dcY = 0;
      v.wi = 0;
    }
    v.active = true;
    v.freq = m.freq;
    v.rho = this.rhoFor(m.freq, T60_HELD);
    v.exc = this.makeBurst(m.freq, m.vel);
    v.excPos = 0;
    v.scoopEnv = 1;
    v.vibPhase = 0;
    v.age = 0;
    v.peak = 1; // give the new note a grace period before idle detection
    v.gl = typeof m.gl === 'number' ? m.gl : 0.5;
    v.gr = typeof m.gr === 'number' ? m.gr : 0.5;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out[1] || out[0];
    const frames = L.length;
    L.fill(0);
    if (R !== L) R.fill(0);

    // Fire any messages due within this block (sample-accurate via `when`).
    const tBlock = currentFrame / sampleRate;
    const tEnd = tBlock + frames / sampleRate;
    if (this.pending.length) {
      const later = [];
      for (const m of this.pending) {
        const when = m.when || 0;
        if (when < tEnd) {
          m._offset = Math.max(0, Math.round((when - tBlock) * sampleRate));
          if (m._offset >= frames) m._offset = frames - 1;
          later.push(m); // handled inside the sample loop below
        } else {
          later.push(m);
        }
      }
      this.pending = later;
    }

    for (let i = 0; i < frames; i++) {
      // activate messages scheduled for this exact frame
      if (this.pending.length) {
        for (let k = 0; k < this.pending.length; k++) {
          const m = this.pending[k];
          if (m._offset === i && (m.when || 0) < tEnd) {
            this.handleMsg(m);
            this.pending.splice(k, 1);
            k--;
          }
        }
      }

      for (let vi = 0; vi < NV; vi++) {
        const v = this.voices[vi];
        if (!v.active) continue;

        // Current pitch: scoop from below + delayed-onset bar vibrato.
        const tAge = v.age / sampleRate;
        let f = v.freq * (1 - SCOOP_DEPTH * v.scoopEnv);
        if (tAge > VIB_START) {
          const env = Math.min(1, (tAge - VIB_START) / (VIB_FULL - VIB_START));
          f *= 1 + VIB_DEPTH * env * Math.sin(v.vibPhase);
        }
        v.scoopEnv *= this.scoopDecay;
        v.vibPhase += this.vibInc;

        // Loop delay: the loop period is D + 1 (the FIR3's one sample of
        // phase delay; the write→read round trip supplies D exactly, and the
        // Lagrange read is centred on D). Verified by offline measurement:
        // D = sr/f − 2 rendered +19 cents sharp at 660 Hz; − 1 is exact.
        let D = sampleRate / f - 1;
        if (D < 4) D = 4;
        if (D > BUFLEN - 8) D = BUFLEN - 8;

        // 4th-order Lagrange read (JOS fdelay4): taps id..id+4, fd ∈ [1.5,2.5)
        const id = Math.floor(D - 1.499995);
        const fd = D - id;
        const a = fd - 1, b = fd - 2, c = fd - 3, d = fd - 4;
        const w0 = (a * b * c * d) / 24;
        const w1 = (-fd * b * c * d) / 6;
        const w2 = (fd * a * c * d) / 4;
        const w3 = (-fd * a * b * d) / 6;
        const w4 = (fd * a * b * c) / 24;
        const base = v.wi - id;
        const x0 =
          w0 * v.buf[base & MASK] +
          w1 * v.buf[(base - 1) & MASK] +
          w2 * v.buf[(base - 2) & MASK] +
          w3 * v.buf[(base - 3) & MASK] +
          w4 * v.buf[(base - 4) & MASK];

        // FIR3 damping × loop gain (linear phase: brightness never detunes).
        let y = v.rho * (H0 * v.x1 + H1 * (x0 + v.x2));
        v.x2 = v.x1;
        v.x1 = x0;

        // Inject the pick burst as loop input over its first period.
        if (v.exc && v.excPos < v.exc.length) {
          y += v.exc[v.excPos++];
          if (v.excPos >= v.exc.length) v.exc = null;
        }
        v.buf[v.wi & MASK] = y;
        v.wi = (v.wi + 1) & MASK;

        // DC blocker OUTSIDE the loop (adds no loop phase → no detune).
        const dc = y - v.dcX + 0.995 * v.dcY;
        v.dcX = y;
        v.dcY = dc;

        L[i] += dc * v.gl;
        R[i] += dc * v.gr;

        // Idle detection: silent strings must not burn CPU.
        const mag = dc < 0 ? -dc : dc;
        v.peak = mag > v.peak ? mag : v.peak * 0.99995;
        v.age++;
        if (v.age > sampleRate && v.peak < IDLE_LEVEL) {
          v.active = false;
          v.exc = null;
        }
      }
    }
    return true;
  }
}

registerProcessor('steel-ks', SteelKS);
