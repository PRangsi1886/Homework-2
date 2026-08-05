/**
 * Cutscene factories — Agent Zlisto intro (image slides) + Victory ending.
 */

import { W, H } from "./entities.js";
import { CutsceneTimeline } from "./cutsceneTimeline.js";
import { StickFigure, PILOT_COLOR, LOVE_COLOR, BOSS_COLOR } from "./stickFigure.js";

/**
 * Multi-slide image cutscene. Same contract as timeline cutscenes:
 * update(dt) / draw(ctx) / skip() / onDone.
 *
 * scenes: [{ src, title, subtitle, duration }]
 */
export class ImageCutscene {
  constructor({ scenes = [], onDone, width = W, height = H } = {}) {
    this.scenes = scenes.length
      ? scenes
      : [{ src: "", title: "", subtitle: "", duration: 5 }];
    this.onDone = onDone;
    this.onComplete = onDone;
    this.w = width;
    this.h = height;
    this.sceneIndex = 0;
    this.time = 0;
    this.done = false;
    this.fade = 1;
    this.images = {};
    this._failed = {};

    if (typeof Image !== "undefined") {
      for (const scene of this.scenes) {
        if (!scene.src || this.images[scene.src]) continue;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          this.images[scene.src] = img;
        };
        img.onerror = () => {
          this._failed[scene.src] = true;
        };
        img.src = scene.src;
      }
    }
  }

  get current() {
    return this.scenes[this.sceneIndex] || this.scenes[0];
  }

  get title() {
    return this.current?.title || "";
  }

  get duration() {
    return this.scenes.reduce((s, sc) => s + (sc.duration || 5), 0);
  }

  skip() {
    if (this.done) return;
    this.done = true;
    this.onDone?.();
  }

  advanceScene() {
    if (this.sceneIndex < this.scenes.length - 1) {
      this.sceneIndex++;
      this.time = 0;
      this.fade = 1;
      return;
    }
    this.skip();
  }

  update(dt) {
    if (this.done) return;
    this.time += dt;
    const scene = this.current;
    const dur = Math.max(0.5, scene.duration || 5);

    if (this.time < 0.55) {
      this.fade = 1 - this.time / 0.55;
    } else if (this.time > dur - 0.7) {
      this.fade = Math.min(1, (this.time - (dur - 0.7)) / 0.7);
    } else {
      this.fade = 0;
    }

    if (this.time >= dur) {
      this.advanceScene();
    }
  }

  draw(ctx) {
    if (this.done) return;
    const { w, h } = this;
    const scene = this.current;
    const img = this.images[scene.src];

    ctx.fillStyle = "#02050b";
    ctx.fillRect(0, 0, w, h);

    if (img && img.complete && img.naturalWidth) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const padX = 16;
      const padY = 80;
      const scale = Math.min((w - padX * 2) / iw, (h - padY * 2) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2 - 12;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else if (this._failed[scene.src]) {
      ctx.fillStyle = "#eef4ff";
      ctx.font = "600 20px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Scene unavailable", w / 2, h / 2);
    }

    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, w, 72);
    ctx.fillRect(0, h - 72, w, 72);

    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#f0a23a";
    ctx.font = "700 13px Orbitron, sans-serif";
    ctx.fillText("CAPITAL SYNDICATE · ACT 1", w / 2, h * 0.78);
    if (scene.title) {
      ctx.fillStyle = "#eef4ff";
      ctx.font = "700 28px Rajdhani, sans-serif";
      ctx.fillText(scene.title, w / 2, h * 0.78 + 34);
    }
    if (scene.subtitle) {
      ctx.fillStyle = "rgba(158, 179, 209, 0.95)";
      ctx.font = "600 16px Rajdhani, sans-serif";
      ctx.fillText(scene.subtitle, w / 2, h * 0.78 + 58);
    }
    ctx.restore();

    // Overall progress across all scenes
    let elapsed = 0;
    for (let i = 0; i < this.sceneIndex; i++) elapsed += this.scenes[i].duration || 5;
    elapsed += this.time;
    const progress = Math.min(1, elapsed / Math.max(0.01, this.duration));
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

/** Intro: Agent dossier → Legacy base → Stage 1. */
export function createIntroCutscene(onDone) {
  return new ImageCutscene({
    onDone,
    scenes: [
      {
        src: "assets/cutscenes/agent-zlisto.png",
        title: "Welcome Agent Zlisto",
        subtitle: "Operation Ferrum Wings",
        duration: 5.5,
      },
      {
        src: "assets/cutscenes/legacy-base.png",
        title: "Legacy Safehouse",
        subtitle: "Primary ladder access — deployment failure",
        duration: 6.0,
      },
    ],
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
