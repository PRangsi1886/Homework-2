/**
 * Cutscene factories — Agent Zlisto intro (image) + Victory (stick-figure ending).
 */

import { W, H } from "./entities.js";
import { CutsceneTimeline } from "./cutsceneTimeline.js";
import { StickFigure, PILOT_COLOR, LOVE_COLOR, BOSS_COLOR } from "./stickFigure.js";

const INTRO_IMAGE_SRC = "assets/cutscenes/agent-zlisto.png";

/**
 * Full-bleed image cutscene (intro). Same contract as timeline cutscenes:
 * update(dt) / draw(ctx) / skip() / onDone.
 */
export class ImageCutscene {
  /**
   * @param {object} opts
   * @param {string} opts.src
   * @param {string} [opts.title]
   * @param {string} [opts.subtitle]
   * @param {number} [opts.duration] seconds before auto-finish
   * @param {Function} [opts.onDone]
   */
  constructor({
    src,
    title = "",
    subtitle = "",
    duration = 6.5,
    onDone,
    width = W,
    height = H,
  } = {}) {
    this.src = src;
    this.title = title;
    this.subtitle = subtitle;
    this.duration = duration;
    this.onDone = onDone;
    this.onComplete = onDone;
    this.w = width;
    this.h = height;
    this.time = 0;
    this.done = false;
    this.fade = 1; // start black, fade in
    this.img = null;
    this._failed = false;

    if (typeof Image !== "undefined") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.img = img;
      };
      img.onerror = () => {
        this._failed = true;
      };
      img.src = src;
    } else {
      this._failed = true;
    }
  }

  skip() {
    if (this.done) return;
    this.done = true;
    this.onDone?.();
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;

    // Fade in first 0.7s, hold, fade out last 0.9s
    if (this.time < 0.7) {
      this.fade = 1 - this.time / 0.7;
    } else if (this.time > this.duration - 0.9) {
      this.fade = Math.min(1, (this.time - (this.duration - 0.9)) / 0.9);
    } else {
      this.fade = 0;
    }

    if (this.time >= this.duration) {
      this.skip();
    }
  }

  draw(ctx) {
    if (this.done) return;
    const { w, h } = this;

    ctx.fillStyle = "#02050b";
    ctx.fillRect(0, 0, w, h);

    if (this.img && this.img.complete && this.img.naturalWidth) {
      // Cover fit with slow Ken Burns zoom
      const zoom = 1 + Math.min(0.08, this.time * 0.012);
      const iw = this.img.naturalWidth;
      const ih = this.img.naturalHeight;
      const scale = Math.max(w / iw, h / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2 - Math.min(20, this.time * 2);
      ctx.drawImage(this.img, dx, dy, dw, dh);
    } else if (this._failed) {
      ctx.fillStyle = "#eef4ff";
      ctx.font = "600 20px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Agent dossier unavailable", w / 2, h / 2);
    }

    // Soft vignette
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Letterbox
    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, w, 72);
    ctx.fillRect(0, h - 72, w, 72);

    // Caption
    ctx.save();
    ctx.textAlign = "center";
    if (this.title) {
      ctx.fillStyle = "#f0a23a";
      ctx.font = "700 13px Orbitron, sans-serif";
      ctx.fillText("CAPITAL SYNDICATE · ACT 1", w / 2, h * 0.78);
      ctx.fillStyle = "#eef4ff";
      ctx.font = "700 28px Rajdhani, sans-serif";
      ctx.fillText(this.title, w / 2, h * 0.78 + 34);
    }
    if (this.subtitle) {
      ctx.fillStyle = "rgba(158, 179, 209, 0.95)";
      ctx.font = "600 16px Rajdhani, sans-serif";
      ctx.fillText(this.subtitle, w / 2, h * 0.78 + 58);
    }
    ctx.restore();

    // Progress
    const progress = Math.min(1, this.time / Math.max(0.01, this.duration));
    ctx.fillStyle = "rgba(62, 240, 208, 0.35)";
    ctx.fillRect(0, h - 74, w * progress, 2);

    ctx.fillStyle = "rgba(158, 179, 209, 0.85)";
    ctx.font = "600 14px Rajdhani, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("CLICK / SPACE TO SKIP", w - 24, h - 24);

    if (this.fade > 0.01) {
      ctx.globalAlpha = Math.min(1, this.fade);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}

/** Cutscene B — Victory (after final boss). */
export function buildEndingCutscene({ canvasWidth = W, canvasHeight = H, score = 0 } = {}) {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const ground = cy + 60;

  return [
    {
      time: 0.5,
      actor: null,
      pose: null,
      bg: "wreckage",
      fade: "in",
      showActors: ["boss", "pilot"],
      hideActors: ["love"],
      cameraX: cx,
      cameraY: ground - 40,
      cameraZoom: 1.1,
      text: "",
    },
    {
      time: 1.5,
      actor: "boss",
      pose: "collapse",
      bg: "wreckage",
      actorX: cx + 50,
      actorY: ground,
      cameraX: cx + 20,
      cameraY: ground - 40,
      cameraZoom: 1.2,
      particlesAt: {
        x: cx + 50,
        y: ground - 20,
        count: 40,
        opts: { color: "#ffcc00", speed: 7, life: 45 },
      },
      screenShake: { intensity: 14, duration: 30 },
      hitstopMs: 90,
      text: "",
    },
    {
      time: 1.5,
      actor: "pilot",
      pose: "lowerWeapon",
      bg: "wreckage",
      hideActors: ["boss"],
      actorX: cx - 40,
      actorY: ground,
      cameraX: cx - 40,
      cameraY: ground - 50,
      cameraZoom: 1.3,
    },
    {
      time: 2.5,
      actor: "pilot",
      pose: "holdPhoto",
      bg: "wreckage",
      showPhoto: true,
      cameraX: cx - 40,
      cameraY: ground - 70,
      cameraZoom: 2.2,
    },
    {
      time: 1.5,
      actor: "pilot",
      pose: "smile",
      bg: "wreckage",
      showPhoto: true,
      cameraX: cx - 40,
      cameraY: ground - 70,
      cameraZoom: 2.2,
      text: "I'll come back for you.",
    },
    {
      time: 2.5,
      actor: "pilot",
      pose: "idle",
      bg: "sunrise",
      showPhoto: false,
      hideActors: ["pilot", "boss"],
      cameraX: cx,
      cameraY: cy - 40,
      cameraZoom: 0.55,
      text: "",
    },
    {
      time: 1.8,
      actor: null,
      pose: null,
      bg: "void",
      fade: "out",
      text: `THE END\nI'll come back for you.\nScore ${score}`,
    },
  ];
}

function makeActors() {
  const ground = H / 2 + 40;
  return {
    pilot: new StickFigure({
      x: W / 2 - 80,
      y: ground,
      scale: 1.15,
      color: PILOT_COLOR,
      limbLength: 28,
    }),
    love: new StickFigure({
      x: W / 2 + 40,
      y: ground,
      scale: 1.05,
      color: LOVE_COLOR,
      limbLength: 26,
      visible: false,
    }),
    boss: new StickFigure({
      x: W / 2 + 60,
      y: ground,
      scale: 1.85,
      color: BOSS_COLOR,
      limbLength: 32,
      visible: false,
    }),
  };
}

/** Intro: Agent Zlisto dossier image → Stage 1. */
export function createIntroCutscene(onDone) {
  return new ImageCutscene({
    src: INTRO_IMAGE_SRC,
    title: "Welcome Agent Zlisto",
    subtitle: "Operation Ferrum Wings",
    duration: 6.5,
    onDone,
  });
}

/** Victory: after final boss → score screen. */
export function createVictoryCutscene(score, onDone) {
  const tl = new CutsceneTimeline({
    actors: makeActors(),
    onComplete: onDone,
    width: W,
    height: H,
  });
  tl.load(buildEndingCutscene({ canvasWidth: W, canvasHeight: H, score }));
  if (tl.actors.boss) {
    tl.actors.boss.x = W / 2 + 50;
    tl.actors.boss.y = H / 2 + 60;
    tl.actors.boss.setPose("idle");
  }
  if (tl.actors.pilot) {
    tl.actors.pilot.x = W / 2 - 90;
    tl.actors.pilot.y = H / 2 + 60;
    tl.actors.pilot.setPose("lowerWeapon");
  }
  return tl;
}

export { CutsceneTimeline, StickFigure, POSES } from "./cutsceneTimeline.js";
