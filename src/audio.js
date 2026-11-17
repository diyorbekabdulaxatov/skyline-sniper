// @ts-check
// Synthesized sound: no audio files. Browsers only allow sound after a tap, so unlock() is
// called from the start button.

export function createAudio() {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {GainNode | null} */
  let master = null;
  /** @type {AudioBuffer | null} */
  let noise = null;
  let enabled = true;
  /** @type {AudioBufferSourceNode | null} */
  let ambient = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (err) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = enabled ? 0.8 : 0;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 3);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /**
   * Filtered noise burst with a fast attack and exponential decay.
   * @param {number} at start time on the audio clock
   * @param {number} dur decay time in seconds
   * @param {BiquadFilterType} type
   * @param {number} freq
   * @param {number} gain peak gain
   */
  function burst(at, dur, type, freq, gain) {
    if (!ctx || !master || !noise) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(at, Math.random() * 0.4);
    src.stop(at + dur + 0.05);
  }

  function thump(at, from, to, dur, gain) {
    if (!ctx || !master) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, at);
    o.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(master);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  return {
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    },
    /** @param {boolean} on */
    setEnabled(on) {
      enabled = on;
      if (master) master.gain.value = on ? 0.8 : 0;
    },
    shot() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      burst(t, 0.08, 'highpass', 2500, 0.9);
      burst(t, 0.7, 'lowpass', 700, 0.9);
      thump(t, 95, 36, 0.32, 0.9);
      // The report rolling back off the berms and the tree line.
      burst(t + 0.18, 2.2, 'lowpass', 260, 0.28);
    },
    /**
     * Impact sound, delayed by the time sound takes to travel back.
     * @param {number} delay seconds
     * @param {'paper' | 'earth' | 'person'} kind
     * @param {number} dist metres, for volume
     */
    impact(delay, kind, dist) {
      if (!ensure()) return;
      const t = ctx.currentTime + delay;
      const v = Math.min(1, 90 / Math.max(90, dist));
      if (kind === 'paper') {
        burst(t, 0.05, 'bandpass', 2000, 0.55 * v);
      } else if (kind === 'person') {
        burst(t, 0.12, 'lowpass', 380, 0.7 * v);
      } else {
        burst(t, 0.16, 'lowpass', 600, 0.3 * v);
      }
    },
    /** Bolt cycling: lift, pull, push, lock. */
    bolt(delay) {
      if (!ensure()) return;
      const t = ctx.currentTime + delay;
      burst(t, 0.03, 'highpass', 3000, 0.25);
      burst(t + 0.12, 0.05, 'bandpass', 1800, 0.22);
      burst(t + 0.3, 0.05, 'bandpass', 1500, 0.22);
      burst(t + 0.42, 0.03, 'highpass', 3200, 0.3);
    },
    reload() {
      if (!ensure()) return;
      const t = ctx.currentTime;
      burst(t, 0.04, 'highpass', 2600, 0.25);
      burst(t + 0.7, 0.06, 'bandpass', 1200, 0.3);
      burst(t + 1.4, 0.05, 'bandpass', 1600, 0.3);
      burst(t + 1.9, 0.04, 'highpass', 3000, 0.3);
    },
    /** @param {boolean} inhale */
    breath(inhale) {
      if (!ensure()) return;
      burst(ctx.currentTime, inhale ? 0.45 : 0.7, 'bandpass', inhale ? 900 : 600, 0.06);
    },
    startAmbient() {
      if (!ensure() || ambient || !master) return;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start();
      ambient = src;
    }
  };
}
