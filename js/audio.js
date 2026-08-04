/** Lightweight Web Audio synth for arcade feedback. */
export class AudioBus {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
  }

  unlock() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.enabled = false;
      return;
    }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx?.state === "suspended") this.ctx.resume();
  }

  tone(freq, duration, type = "square", gain = 0.2, slide = 0) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + duration);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  noise(duration, gain = 0.15) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 900;
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  shoot(weapon) {
    if (weapon === "rocket") {
      this.tone(140, 0.16, "sawtooth", 0.14, -50);
      this.noise(0.12, 0.08);
    } else if (weapon === "plasma") this.tone(220, 0.12, "sawtooth", 0.12, -80);
    else if (weapon === "ion") this.tone(880, 0.08, "triangle", 0.1, 200);
    else this.tone(640, 0.05, "square", 0.06, -120);
  }

  explosion(big = false) {
    this.noise(big ? 0.35 : 0.18, big ? 0.22 : 0.12);
    this.tone(big ? 90 : 140, big ? 0.3 : 0.15, "sawtooth", 0.12, -60);
  }

  powerup() {
    this.tone(440, 0.08, "sine", 0.1, 220);
    setTimeout(() => this.tone(660, 0.1, "sine", 0.1, 180), 70);
  }

  alert() {
    this.tone(180, 0.15, "square", 0.1, 40);
    setTimeout(() => this.tone(140, 0.18, "square", 0.1, -20), 120);
  }

  launch() {
    this.tone(120, 0.2, "sawtooth", 0.1, 300);
    this.noise(0.25, 0.08);
  }
}
