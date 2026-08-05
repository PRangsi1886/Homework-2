/**
 * Intro video cutscene + thin factories for game.js hooks.
 */
import { W, H } from "./entities.js";

const INTRO_VIDEO_LOCAL = "assets/cutscenes/intro.mp4";
/** jsDelivr serves correct video/mp4 + CORS; githack redirects MP4 as text/html and breaks playback. */
const INTRO_VIDEO_CDN =
  "https://cdn.jsdelivr.net/gh/PRangsi1886/Homework-2@cursor/capital-syndicate-0ccd/assets/cutscenes/intro.mp4";

function introVideoSources() {
  const host = typeof location !== "undefined" ? location.hostname : "";
  // Prefer CDN on githack / similar proxies that mishandle large binary assets.
  if (/githack\.com$/i.test(host) || /statically\.io$/i.test(host)) {
    return [INTRO_VIDEO_CDN, INTRO_VIDEO_LOCAL];
  }
  return [INTRO_VIDEO_LOCAL, INTRO_VIDEO_CDN];
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
    this.video.playbackRate = 1.1; // 10% faster
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
      // Autoplay with sound blocked — retry muted so the cutscene still plays.
      try {
        this.video.muted = true;
        await this.video.play();
      } catch {
        // Don't hard-fail yet — metadata may still be loading; timeout handles it.
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

    // Fade in
    if (this.time < 0.45) this.fade = 1 - this.time / 0.45;
    else this.fade = Math.max(0, this.fade - dt * 2);

    // Give CDNs time to buffer; only skip if nothing decoded yet.
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
      // Contain fit — full frame visible
      const scale = Math.min(w / vw, h / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      try {
        ctx.drawImage(this.video, dx, dy, dw, dh);
      } catch {
        /* tainted / not ready — keep black frame */
      }
    }

    // Letterbox bars
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
  return new VideoCutscene({ src: introVideoSources(), onDone });
}

export function createVictoryCutscene(_score, onDone) {
  // No victory cutscene — finish immediately.
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
  // Kick on next tick so game can enter CUTSCENE state first
  queueMicrotask(() => stub.skip());
  return stub;
}
