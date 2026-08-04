const STORAGE_KEY = "ferrum-wing-volume";
const MUTE_KEY = "ferrum-wing-muted";
const BASE_GAIN = 0.55;

/** Lightweight Web Audio synth for arcade feedback. */
export class AudioBus {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.volume = this.loadVolume();
    this.muted = this.loadMuted();
  }

  loadVolume() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const v = raw == null ? 0.7 : Number(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.7;
  }

  loadMuted() {
    return localStorage.getItem(MUTE_KEY) === "1";
  }

  persist() {
    localStorage.setItem(STORAGE_KEY, String(this.volume));
    localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
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
    this.applyGain();
    this.master.connect(this.ctx.destination);
  }

  applyGain() {
    if (!this.master) return;
    const value = this.muted ? 0 : BASE_GAIN * this.volume;
    const t = this.ctx?.currentTime ?? 0;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(value, t, 0.02);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.volume > 0 && this.muted) this.muted = false;
    this.applyGain();
    this.persist();
  }

  getVolume() {
    return this.volume;
  }

  setMuted(muted) {
    this.muted = !!muted;
    this.applyGain();
    this.persist();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted() {
    return this.muted || this.volume <= 0;
  }

  resume() {
    if (this.ctx?.state === "suspended") this.ctx.resume();
  }

  ready() {
    return this.enabled && this.ctx && this.master && !this.isMuted();
  }

  tone(freq, duration, type = "square", gain = 0.2, slide = 0, delay = 0) {
    if (!this.ready()) return;
    this.resume();
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + duration);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  noise(duration, gain = 0.15, freq = 900, delay = 0) {
    if (!this.ready()) return;
    this.resume();
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    src.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  shoot(weapon) {
    if (weapon === "rocket") {
      this.noise(0.08, 0.1, 400);
      this.tone(160, 0.18, "sawtooth", 0.14, -70);
      this.tone(90, 0.22, "triangle", 0.08, -20);
    } else if (weapon === "plasma") {
      this.tone(240, 0.1, "sawtooth", 0.11, -90);
      this.tone(480, 0.08, "square", 0.05, 120);
      this.noise(0.05, 0.05, 1200);
    } else if (weapon === "ion") {
      this.tone(920, 0.07, "triangle", 0.09, 260);
      this.tone(1380, 0.05, "sine", 0.05, 180);
    } else {
      this.tone(700, 0.04, "square", 0.05, -160);
      this.noise(0.03, 0.03, 1800);
    }
  }

  hit() {
    this.noise(0.05, 0.07, 1400);
    this.tone(220, 0.06, "square", 0.05, -80);
  }

  explosion(big = false) {
    if (big) {
      this.noise(0.4, 0.24, 280);
      this.noise(0.25, 0.12, 700, 0.05);
      this.tone(70, 0.35, "sawtooth", 0.16, -30);
      this.tone(140, 0.2, "triangle", 0.08, -60, 0.04);
    } else {
      this.noise(0.16, 0.14, 500);
      this.tone(120, 0.14, "sawtooth", 0.1, -50);
    }
  }

  /** Distinct pickup sting by type. */
  pickup(type = "generic") {
    this.unlock();
    if (type === "shield") {
      this.tone(520, 0.08, "sine", 0.12, 180);
      this.tone(780, 0.1, "sine", 0.1, 220, 0.07);
      this.tone(1040, 0.12, "triangle", 0.08, 0, 0.14);
    } else if (type === "repair") {
      this.tone(360, 0.09, "triangle", 0.11, 120);
      this.tone(540, 0.1, "sine", 0.1, 160, 0.08);
      this.tone(720, 0.12, "sine", 0.08, 0, 0.16);
    } else if (type === "super") {
      this.tone(440, 0.08, "square", 0.1, 200);
      this.tone(660, 0.1, "sine", 0.11, 240, 0.07);
      this.tone(880, 0.12, "triangle", 0.1, 280, 0.14);
      this.tone(1320, 0.14, "sine", 0.07, 0, 0.22);
    } else if (type === "rocket") {
      this.tone(200, 0.08, "sawtooth", 0.1, 100);
      this.tone(300, 0.1, "square", 0.08, 140, 0.07);
      this.noise(0.08, 0.06, 600, 0.05);
    } else if (type === "ammo") {
      this.tone(600, 0.06, "square", 0.08, 100);
      this.tone(800, 0.07, "square", 0.07, 120, 0.06);
      this.tone(1000, 0.09, "triangle", 0.06, 0, 0.12);
    } else {
      this.tone(500, 0.07, "sine", 0.1, 160);
      this.tone(750, 0.1, "sine", 0.09, 200, 0.07);
    }
  }

  powerup() {
    this.pickup("generic");
  }

  alert() {
    this.tone(196, 0.12, "square", 0.1, 30);
    this.tone(155, 0.16, "square", 0.1, -25, 0.11);
  }

  launch() {
    this.noise(0.2, 0.1, 350);
    this.tone(110, 0.22, "sawtooth", 0.12, 280);
    this.tone(220, 0.12, "triangle", 0.06, 160, 0.08);
  }

  hurt() {
    this.noise(0.1, 0.12, 700);
    this.tone(180, 0.12, "sawtooth", 0.1, -70);
    this.tone(90, 0.15, "square", 0.07, -20, 0.04);
  }
}
