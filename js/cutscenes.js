/**
 * Intro video cutscene + thin factories for game.js hooks.
 */
import { W, H } from "./entities.js";

const INTRO_VIDEO_SRC = "assets/cutscenes/intro.mp4";

/**
 * Full-bleed HTMLVideoElement cutscene drawn to the game canvas.
 * Contract: update(dt) / draw(ctx) / skip() / onDone.
 */
export class VideoCutscene {
  constructor({
    src = INTRO_VIDEO_SRC,
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

    this.video = document.createElement("video");
    this.video.src = src;
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.video.crossOrigin = "anonymous";
    // Keep game master volume separate — cutscene audio from the file itself.
    // Mute only if the page blocks autoplay with sound (we retry muted).
    this.video.muted = muted;
    this.video.loop = false;
    this.video.playbackRate = 1.1; // 10% faster

    this.video.addEventListener("ended", () => {
      this.ended = true;
      this.fadeOutAndFinish();
    });
    this.video.addEventListener("error", () => {
      this.failed = true;
      this.skip();
    });
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
        this.failed = true;
        this.skip();
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

    // Safety timeout if metadata never loads
    if (this.time > 2.5 && this.video.readyState < 2) {
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
      ctx.drawImage(this.video, dx, dy, dw, dh);
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
  return new VideoCutscene({ src: INTRO_VIDEO_SRC, onDone });
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
