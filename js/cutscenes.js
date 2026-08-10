/**
 * Intro cinematic cutscene + thin factories for game.js hooks.
 * Primary intro: image-sequence opening (Agent Zlisto / Princess Lisa story).
 * Fallback: legacy video cutscene if sequence assets fail to load.
 */
import { W, H } from "./entities.js";

const OPENING_BEATS = [
  {
    file: "01-briefing.png",
    caption: "Welcome to Capital Syndicate: Operation Ferrum Wings — Agent Zlisto.",
    hold: 3.4,
  },
  {
    file: "02-legacy-base.png",
    caption: "We got some urgent work to do… and only you can finish it.",
    hold: 3.2,
  },
  {
    file: "03-lisa-captured.png",
    caption: "Princess Lisa has been captured — only you can save her and the world.",
    hold: 3.6,
  },
  {
    file: "04-board-fighter.png",
    caption: "Zlisto: Leave it to me. I got this.",
    hold: 3.0,
  },
  {
    file: "05-launch.png",
    caption: "All systems ready. Prepare for takeoff.",
    hold: 3.2,
  },
];

const OPENING_LOCAL_DIR = "assets/cutscenes/opening/";
const OPENING_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/PRangsi1886/Homework-2@main/assets/cutscenes/opening/";

function openingBeats() {
  const host = typeof location !== "undefined" ? location.hostname : "";
  // githack often mishandles large binaries — prefer jsDelivr there.
  const useCdn = /githack\.com$/i.test(host) || /statically\.io$/i.test(host);
  return OPENING_BEATS.map((b) => ({
    ...b,
    src: useCdn ? `${OPENING_CDN_BASE}${b.file}` : `${OPENING_LOCAL_DIR}${b.file}`,
  }));
}

const INTRO_VIDEO_LOCAL = "assets/cutscenes/intro.mp4";
const INTRO_VIDEO_CDN =
  "https://cdn.jsdelivr.net/gh/PRangsi1886/Homework-2@main/assets/cutscenes/intro.mp4";

function introVideoSources() {
  const host = typeof location !== "undefined" ? location.hostname : "";
  if (/githack\.com$/i.test(host) || /statically\.io$/i.test(host)) {
    return [INTRO_VIDEO_CDN, INTRO_VIDEO_LOCAL];
  }
  return [INTRO_VIDEO_LOCAL, INTRO_VIDEO_CDN];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

/**
 * Full-bleed multi-beat still cinematic drawn to the game canvas.
 * Contract: update(dt) / draw(ctx) / skip() / onDone.
 */
export class ImageSequenceCutscene {
  constructor({ beats, onDone, width = W, height = H } = {}) {
    this.onDone = onDone;
    this.onComplete = onDone;
    this.w = width;
    this.h = height;
    this.done = false;
    this.fade = 1;
    this.time = 0;
    this.beatIndex = 0;
    this.beatTime = 0;
    this.cross = 0;
    this.ready = false;
    this.failed = false;
    this._finishing = false;
    this.beats = (beats || openingBeats()).map((b) => ({ ...b, img: null }));
    this.transition = 0.45;

    void this.preload();
  }

  async preload() {
    try {
      const images = await Promise.all(this.beats.map((b) => loadImage(b.src)));
      images.forEach((img, i) => {
        this.beats[i].img = img;
      });
      this.ready = true;
      this.failed = false;
    } catch {
      this.failed = true;
      this.ready = false;
    }
  }

  fadeOutAndFinish() {
    if (this.done) return;
    this._finishing = true;
  }

  skip() {
    if (this.done) return;
    this.done = true;
    this.onDone?.();
  }

  currentBeat() {
    return this.beats[this.beatIndex] || null;
  }

  nextBeat() {
    return this.beats[this.beatIndex + 1] || null;
  }

  update(dt) {
    if (this.done) return;
    if (this.failed) return;
    if (!this.ready) {
      this.time += dt;
      return;
    }

    this.time += dt;
    this.beatTime += dt;

    if (this._finishing) {
      this.fade = Math.min(1, this.fade + dt / 0.55);
      if (this.fade >= 1) this.skip();
      return;
    }

    // Opening fade-in
    if (this.time < 0.5) this.fade = 1 - this.time / 0.5;
    else this.fade = Math.max(0, this.fade - dt * 2.2);

    const beat = this.currentBeat();
    if (!beat) {
      this.fadeOutAndFinish();
      return;
    }

    const hold = beat.hold ?? 3.2;
    const edge = hold - this.transition;

    if (this.beatTime >= edge && this.nextBeat()) {
      this.cross = Math.min(1, (this.beatTime - edge) / this.transition);
    } else {
      this.cross = 0;
    }

    if (this.beatTime >= hold) {
      if (this.beatIndex >= this.beats.length - 1) {
        this.fadeOutAndFinish();
        return;
      }
      this.beatIndex += 1;
      this.beatTime = 0;
      this.cross = 0;
    }
  }

  drawCover(ctx, img, kenBurns = 0) {
    if (!img) return;
    const { w, h } = this;
    const scale = Math.max(w / img.width, h / img.height) * (1.04 + kenBurns * 0.06);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2 - kenBurns * 12;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  drawCaption(ctx, text) {
    if (!text) return;
    const { w, h } = this;
    const padX = 28;
    const maxW = w - padX * 2;
    ctx.font = "600 18px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Word wrap
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);

    const lineH = 26;
    const boxH = lines.length * lineH + 22;
    const boxY = h - 56 - boxH - 12;
    ctx.fillStyle = "rgba(1, 3, 8, 0.72)";
    ctx.fillRect(18, boxY, w - 36, boxH);
    ctx.strokeStyle = "rgba(232, 162, 74, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(18.5, boxY + 0.5, w - 37, boxH - 1);

    ctx.fillStyle = "rgba(244, 246, 250, 0.95)";
    lines.forEach((ln, i) => {
      ctx.fillText(ln, w / 2, boxY + 14 + lineH / 2 + i * lineH);
    });
  }

  draw(ctx) {
    if (this.done) return;
    const { w, h } = this;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (!this.ready) {
      ctx.fillStyle = "rgba(158, 179, 209, 0.85)";
      ctx.font = "600 16px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LOADING BRIEFING…", w / 2, h / 2);
      return;
    }

    const beat = this.currentBeat();
    const next = this.nextBeat();
    const ken = Math.min(1, this.beatTime / Math.max(0.01, beat?.hold || 3));

    if (beat?.img) this.drawCover(ctx, beat.img, ken);

    if (this.cross > 0 && next?.img) {
      ctx.globalAlpha = this.cross;
      this.drawCover(ctx, next.img, 0);
      ctx.globalAlpha = 1;
    }

    // Letterbox
    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, w, 56);
    ctx.fillRect(0, h - 56, w, 56);

    const caption = this.cross > 0.55 && next ? next.caption : beat?.caption;
    this.drawCaption(ctx, caption);

    ctx.fillStyle = "rgba(158, 179, 209, 0.9)";
    ctx.font = "600 14px Rajdhani, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("CLICK / SPACE TO SKIP", w - 24, h - 20);

    // Beat pips
    const pipY = 28;
    const total = this.beats.length;
    const pipW = 28;
    const gap = 8;
    const rowW = total * pipW + (total - 1) * gap;
    let pipX = (w - rowW) / 2;
    for (let i = 0; i < total; i++) {
      ctx.fillStyle = i <= this.beatIndex ? "rgba(232,162,74,0.95)" : "rgba(158,179,209,0.28)";
      ctx.fillRect(pipX, pipY, pipW, 3);
      pipX += pipW + gap;
    }

    if (this.fade > 0.01) {
      ctx.globalAlpha = Math.min(1, this.fade);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}

/**
 * Full-bleed HTMLVideoElement cutscene drawn to the game canvas.
 * Contract: update(dt) / draw(ctx) / skip() / onDone.
 */
export class VideoCutscene {
  constructor({
    src,
    onDone,
    width = W,
    height = H,
    muted = false,
  } = {}) {
    this.onDone = onDone;
    this.onComplete = onDone;
    this.w = width;
    this.h = height;
    this.done = false;
    this.fade = 1;
    this.time = 0;
    this.started = false;
    this.failed = false;
    this.ended = false;
    this._hasData = false;

    this.sources = Array.isArray(src) ? src.filter(Boolean) : [src || INTRO_VIDEO_LOCAL];
    this.sourceIndex = 0;

    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.video.loop = false;
    this.video.playbackRate = 1.1;
    this.video.muted = muted;

    this.video.addEventListener("loadeddata", () => {
      this._hasData = true;
    });
    this.video.addEventListener("canplay", () => {
      this._hasData = true;
    });
    this.video.addEventListener("ended", () => {
      this.ended = true;
      this.fadeOutAndFinish();
    });
    this.video.addEventListener("error", () => this.onVideoError());

    this.applySource(this.sources[0]);
  }

  applySource(url) {
    this._hasData = false;
    try {
      const abs = new URL(url, typeof location !== "undefined" ? location.href : undefined);
      if (abs.origin !== location.origin) this.video.crossOrigin = "anonymous";
      else this.video.removeAttribute("crossorigin");
    } catch {
      this.video.removeAttribute("crossorigin");
    }
    this.video.src = url;
    try {
      this.video.load();
    } catch {
      /* ignore */
    }
  }

  onVideoError() {
    if (this.done || this.failed) return;
    if (this.sourceIndex + 1 < this.sources.length) {
      this.sourceIndex += 1;
      this.started = false;
      this.applySource(this.sources[this.sourceIndex]);
      return;
    }
    this.failed = true;
    this.skip();
  }

  fadeOutAndFinish() {
    if (this.done) return;
    this._finishing = true;
  }

  skip() {
    if (this.done) return;
    try {
      this.video.pause();
    } catch {
      /* ignore */
    }
    this.done = true;
    this.onDone?.();
  }

  async ensurePlaying() {
    if (this.started || this.failed || this.done) return;
    this.started = true;
    try {
      await this.video.play();
    } catch {
      try {
        this.video.muted = true;
        await this.video.play();
      } catch {
        this.started = false;
      }
    }
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;
    void this.ensurePlaying();

    if (this._finishing) {
      this.fade = Math.min(1, this.fade + dt / 0.55);
      if (this.fade >= 1) this.skip();
      return;
    }

    if (this.time < 0.45) this.fade = 1 - this.time / 0.45;
    else this.fade = Math.max(0, this.fade - dt * 2);

    if (this.time > 8 && !this._hasData && this.video.readyState < 2) {
      if (this.sourceIndex + 1 < this.sources.length) {
        this.sourceIndex += 1;
        this.started = false;
        this.time = 0;
        this.applySource(this.sources[this.sourceIndex]);
        return;
      }
      this.failed = true;
      this.skip();
    }
  }

  draw(ctx) {
    if (this.done) return;
    const { w, h } = this;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    if (this.video.readyState >= 2) {
      const vw = this.video.videoWidth || w;
      const vh = this.video.videoHeight || h;
      const scale = Math.min(w / vw, h / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      try {
        ctx.drawImage(this.video, dx, dy, dw, dh);
      } catch {
        /* ignore */
      }
    }

    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, w, 56);
    ctx.fillRect(0, h - 56, w, 56);

    ctx.fillStyle = "rgba(158, 179, 209, 0.9)";
    ctx.font = "600 14px Rajdhani, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("CLICK / SPACE TO SKIP", w - 24, h - 20);

    if (this.fade > 0.01) {
      ctx.globalAlpha = Math.min(1, this.fade);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}

export function createIntroCutscene(onDone) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onDone?.();
  };

  const sequence = new ImageSequenceCutscene({
    beats: openingBeats(),
    onDone: finish,
  });

  let active = sequence;
  let video = null;
  let waited = 0;

  return {
    get done() {
      return finished;
    },
    update(dt) {
      if (finished) return;
      // If stills failed, swap to legacy video once.
      if (active === sequence && sequence.failed && !video) {
        video = new VideoCutscene({ src: introVideoSources(), onDone: finish });
        active = video;
      }
      // Timeout: if stills never become ready, fall back.
      if (active === sequence && !sequence.ready && !sequence.failed) {
        waited += dt;
        if (waited > 5) {
          sequence.failed = true;
          video = new VideoCutscene({ src: introVideoSources(), onDone: finish });
          active = video;
        }
      }
      active.update(dt);
    },
    draw(ctx) {
      if (finished) return;
      active.draw(ctx);
    },
    skip() {
      if (finished) return;
      active.skip();
    },
  };
}

export function createVictoryCutscene(_score, onDone) {
  const stub = {
    done: false,
    update() {
      if (!this.done) {
        this.done = true;
        onDone?.();
      }
    },
    draw() {},
    skip() {
      if (this.done) return;
      this.done = true;
      onDone?.();
    },
  };
  queueMicrotask(() => stub.skip());
  return stub;
}
