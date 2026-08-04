/**
 * Timeline-driven cutscene player (Canvas 2D).
 * Step format matches the stick-figure cutscene system:
 *   { time, actor, pose, cameraX, cameraY, cameraZoom,
 *     particlesAt, screenShake, hitstopMs, text, fade,
 *     runCycle, moveX, showPhoto, hideActors, showActors, bg }
 *
 * Compatible with game.js: update(dt seconds) / draw(ctx) / skip().
 * Particles, trauma shake, and hitstop reuse juice.js.
 */

import { W, H } from "./entities.js";
import {
  createJuiceState,
  addTrauma,
  hitStop,
  decayJuice,
  shakeOffset,
  spawnBurst,
  updateParticles,
  drawParticles,
  drawPostFx,
} from "./juice.js";
import { StickFigure, POSES, lerp, lerpPose, resolvePose } from "./stickFigure.js";

function easeOutCubic(t) {
  t = Math.max(0, Math.min(1, t));
  return 1 - (1 - t) ** 3;
}

export class CutsceneTimeline {
  /**
   * @param {object} opts
   * @param {object} opts.actors map id → StickFigure
   * @param {Function} [opts.onComplete]
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   */
  constructor({ actors = {}, onComplete, width = W, height = H } = {}) {
    this.actors = actors;
    this.onComplete = onComplete;
    this.w = width;
    this.h = height;

    this.steps = [];
    this.stepIndex = 0;
    this.stepElapsed = 0;
    this.camera = { x: this.w / 2, y: this.h / 2, zoom: 1 };
    this._camFrom = { ...this.camera };
    this._camTo = { ...this.camera };
    this.fadeAlpha = 0;
    this.currentText = "";
    this.playing = false;
    this.done = false;
    this.bg = "corridor";

    this.juice = createJuiceState();
    this.particles = [];

    this._poseFrom = null;
    this._poseTo = null;
    this._activeActor = null;

    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        z: 0.4 + Math.random() * 1.4,
        s: 0.6 + Math.random() * 1.5,
      });
    }
  }

  load(steps) {
    this.steps = steps.map((s, i) => ({ ...s, _index: i, _triggered: false }));
    this.stepIndex = 0;
    this.stepElapsed = 0;
    this.playing = true;
    this.done = false;
    this.fadeAlpha = 0;
    this.currentText = "";
    this.particles.length = 0;
  }

  skip() {
    if (this.done) return;
    this.playing = false;
    this.done = true;
    this.onComplete?.();
  }

  /** Alias for game.js cutscene contract. */
  get onDone() {
    return this.onComplete;
  }
  set onDone(fn) {
    this.onComplete = fn;
  }

  update(dt) {
    if (!this.playing || this.done) return;

    // Hitstop freezes timeline advance (still draw / decay juice lightly)
    if (this.juice.hitstop > 0) {
      decayJuice(this.juice, dt);
      updateParticles(this.particles, dt * 0.15);
      return;
    }

    if (this.stepIndex >= this.steps.length) {
      this.playing = false;
      this.done = true;
      this.onComplete?.();
      return;
    }

    const step = this.steps[this.stepIndex];
    const stepDuration = Math.max(0.05, step.time); // seconds

    if (!step._triggered) {
      step._triggered = true;
      this._enterStep(step);
    }

    const t = Math.min(1, this.stepElapsed / stepDuration);
    const k = easeOutCubic(t);

    // Pose: lerp from captured start pose → target (true blend, not chase)
    if (this._activeActor && this._poseFrom && this._poseTo) {
      const actor = this.actors[this._activeActor];
      if (actor) {
        if (step.runCycle) {
          actor.tickRun(dt, step.runSpeed ?? 2.6);
        } else {
          actor.setPose(lerpPose(this._poseFrom, this._poseTo, k));
        }
        if (step.showPhoto != null) actor.showPhoto = !!step.showPhoto;
      }
    }

    // Optional world-space walk during a step
    if (step.moveX != null && this._activeActor && this.actors[this._activeActor]) {
      const actor = this.actors[this._activeActor];
      const fromX = step._moveFromX ?? actor.x;
      actor.x = lerp(fromX, step.moveX, k);
    }

    // Camera lerp from values captured at step enter
    this.camera.x = lerp(this._camFrom.x, this._camTo.x, k);
    this.camera.y = lerp(this._camFrom.y, this._camTo.y, k);
    this.camera.zoom = lerp(this._camFrom.zoom, this._camTo.zoom, k);

    if (step.fade === "in") this.fadeAlpha = lerp(1, 0, t);
    else if (step.fade === "out") this.fadeAlpha = lerp(0, 1, t);
    else this.fadeAlpha = Math.max(0, this.fadeAlpha - dt * 2);

    decayJuice(this.juice, dt);
    updateParticles(this.particles, dt);

    for (const s of this.stars) {
      s.y += 30 * s.z * dt;
      if (s.y > this.h) {
        s.y = -2;
        s.x = Math.random() * this.w;
      }
    }

    // Continuous debris while running the corridor
    if (step.emitChance && Math.random() < step.emitChance) {
      const a = this._activeActor && this.actors[this._activeActor];
      spawnBurst(this.particles, (a?.x ?? this.camera.x) - 40, (a?.y ?? this.camera.y) + 20, {
        count: 6,
        speed: 200,
        colors: ["#ff8a40", "#ff5a6e", "#ffe08a"],
        life: 0.35,
        size: 2.5,
        glow: true,
        gravity: 80,
      });
    }

    this.stepElapsed += dt;
    if (this.stepElapsed >= stepDuration) {
      // Snap to end pose
      if (this._activeActor && this._poseTo && this.actors[this._activeActor] && !step.runCycle) {
        this.actors[this._activeActor].setPose(this._poseTo);
      }
      this.stepIndex++;
      this.stepElapsed = 0;
      this._poseFrom = null;
      this._poseTo = null;
      this._activeActor = null;
      if (this.stepIndex >= this.steps.length) {
        this.playing = false;
        this.done = true;
        this.onComplete?.();
      }
    }
  }

  _enterStep(step) {
    if (step.bg) this.bg = step.bg;

    if (step.hideActors) {
      for (const id of step.hideActors) {
        if (this.actors[id]) this.actors[id].visible = false;
      }
    }
    if (step.showActors) {
      for (const id of step.showActors) {
        if (this.actors[id]) this.actors[id].visible = true;
      }
    }

    this._camFrom = { ...this.camera };
    this._camTo = {
      x: step.cameraX !== undefined ? step.cameraX : this.camera.x,
      y: step.cameraY !== undefined ? step.cameraY : this.camera.y,
      zoom: step.cameraZoom !== undefined ? step.cameraZoom : this.camera.zoom,
    };

    if (step.actor && this.actors[step.actor]) {
      this._activeActor = step.actor;
      const actor = this.actors[step.actor];
      actor.visible = true;
      this._poseFrom = { ...actor.pose };
      if (step.pose) this._poseTo = resolvePose(step.pose);
      else this._poseTo = { ...actor.pose };
      if (step.showPhoto != null) actor.showPhoto = !!step.showPhoto;
      if (step.moveX != null) step._moveFromX = actor.x;
      if (step.actorX != null) actor.x = step.actorX;
      if (step.actorY != null) actor.y = step.actorY;
    } else {
      this._activeActor = null;
      this._poseFrom = null;
      this._poseTo = null;
    }

    if (step.particlesAt) {
      const p = step.particlesAt;
      const opts = p.opts || {};
      // Reference uses pixel-ish speed/life; map into juice spawnBurst units
      spawnBurst(this.particles, p.x, p.y, {
        count: p.count ?? 20,
        speed: (opts.speed ?? 3) * 60,
        color: opts.color ?? "#ffffff",
        colors: opts.colors,
        life: (opts.life ?? 40) / 60,
        size: opts.size ?? 3,
        gravity: (opts.gravity ?? 0.1) * 60,
        glow: true,
      });
    }

    if (step.screenShake) {
      // Map intensity (px-ish) → trauma 0..1
      const trauma = Math.min(1, (step.screenShake.intensity ?? 6) / 20);
      addTrauma(this.juice, trauma);
    }

    if (step.hitstopMs) {
      hitStop(this.juice, step.hitstopMs / 1000);
    }

    if (step.text !== undefined) {
      this.currentText = step.text || "";
    }
  }

  drawBackground(ctx) {
    const bg = this.bg || "void";
    ctx.fillStyle = "#02050b";
    ctx.fillRect(0, 0, this.w, this.h);

    if (bg === "corridor") {
      ctx.fillStyle = "#0a0e14";
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = "#141a24";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.w * 0.35, this.h * 0.35);
      ctx.lineTo(this.w * 0.65, this.h * 0.35);
      ctx.lineTo(this.w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#10151c";
      ctx.fillRect(0, this.h * 0.62, this.w, this.h * 0.38);
      ctx.strokeStyle = "rgba(220,230,255,0.08)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const u = i / 7;
        const x0 = lerp(0, this.w * 0.35, u);
        const x1 = lerp(this.w, this.w * 0.65, u);
        const y = lerp(0, this.h * 0.35, u);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }
    } else if (bg === "hangar" || bg === "cockpit") {
      ctx.fillStyle = "#080b12";
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = "#151c28";
      ctx.fillRect(0, this.h * 0.55, this.w, this.h * 0.45);
      ctx.fillStyle = "rgba(255,176,80,0.12)";
      ctx.beginPath();
      ctx.arc(this.w * 0.5, this.h * 0.4, 120, 0, Math.PI * 2);
      ctx.fill();
    } else if (bg === "wreckage") {
      ctx.fillStyle = "#06080e";
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = "#121820";
      ctx.fillRect(0, this.h * 0.65, this.w, this.h * 0.35);
      ctx.fillStyle = "rgba(255,100,60,0.08)";
      ctx.fillRect(0, 0, this.w, this.h);
    } else if (bg === "sunrise") {
      const g = ctx.createLinearGradient(0, 0, 0, this.h);
      g.addColorStop(0, "#1a2840");
      g.addColorStop(0.45, "#3a2a38");
      g.addColorStop(0.7, "#c07840");
      g.addColorStop(1, "#f0c078");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = "rgba(255, 210, 120, 0.85)";
      ctx.beginPath();
      ctx.arc(this.w * 0.7, this.h * 0.55, 48, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const neb = ctx.createLinearGradient(0, 0, 0, this.h);
      neb.addColorStop(0, "rgba(18, 48, 70, 0.4)");
      neb.addColorStop(0.55, "rgba(8, 20, 40, 0.18)");
      neb.addColorStop(1, "rgba(50, 24, 12, 0.28)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, this.w, this.h);
      for (const s of this.stars) {
        ctx.globalAlpha = 0.3 + s.z * 0.4;
        ctx.fillStyle = "#d7e4ff";
        ctx.fillRect(s.x, s.y, s.s, s.s * (1 + s.z * 0.5));
      }
      ctx.globalAlpha = 1;
    }
  }

  draw(ctx) {
    if (this.done) return;
    const shake = shakeOffset(this.juice);

    this.drawBackground(ctx);

    ctx.save();
    ctx.translate(this.w / 2 + shake.x, this.h / 2 + shake.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    for (const actor of Object.values(this.actors)) {
      actor.draw(ctx);
    }
    drawParticles(ctx, this.particles);
    ctx.restore();

    // Letterbox
    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, this.w, 64);
    ctx.fillRect(0, this.h - 64, this.w, 64);

    if (this.currentText) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.fillStyle = "#eef4ff";
      ctx.font = "600 22px Rajdhani, sans-serif";
      const lines = String(this.currentText).split("\n");
      lines.forEach((line, i) => {
        ctx.fillText(line, this.w / 2, this.h * 0.78 + i * 28);
      });
      ctx.restore();
    }

    const total = this.steps.reduce((s, st) => s + Math.max(0.05, st.time), 0);
    let elapsed = 0;
    for (let i = 0; i < this.stepIndex; i++) elapsed += Math.max(0.05, this.steps[i].time);
    elapsed += this.stepElapsed;
    const progress = Math.min(1, elapsed / Math.max(0.01, total));
    ctx.fillStyle = "rgba(62, 240, 208, 0.35)";
    ctx.fillRect(0, this.h - 66, this.w * progress, 2);

    ctx.fillStyle = "rgba(158, 179, 209, 0.85)";
    ctx.font = "600 14px Rajdhani, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("CLICK / SPACE TO SKIP", this.w - 24, this.h - 24);

    if (this.fadeAlpha > 0.01) {
      ctx.globalAlpha = Math.min(1, this.fadeAlpha);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }

    drawPostFx(ctx, this.w, this.h, this.juice);
  }
}

export { POSES, StickFigure, lerpPose };
