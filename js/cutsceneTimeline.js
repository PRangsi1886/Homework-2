/**
 * Timeline-driven cutscene player for canvas stick-figure scenes.
 *
 * Step format (all fields optional except timing):
 *   {
 *     time: 0,              // absolute start (seconds) — preferred
 *     duration: 2,          // how long this step is "active"
 *     pose: "run" | {...},  // target pose for the primary figure
 *     poseBlend: 0.35,      // seconds to lerp into this pose
 *     figure: "pilot",      // which registered StickFigure to drive
 *     runCycle: false,      // if true, tick run animation instead of static pose
 *     cameraX, cameraY,     // world camera center (lerps between steps)
 *     cameraZoom,           // 1 = default
 *     particles: { ...spawnBurst opts, x, y } | [ ... ],
 *     screenShake: 0.25,    // addTrauma amount on enter
 *     freezeFrame: 0.08,    // hitStop seconds on enter
 *     text: "Line",         // overlay title / caption
 *     textSub: "...",       // secondary line
 *     fadeIn: 0,            // seconds of black fade-in covering this step start
 *     fadeOut: 0,           // seconds of black fade-out covering this step end
 *     bg: "void" | fn,      // background id or custom draw(ctx, api, localT)
 *     draw: fn,             // extra draw hook after figures
 *     onEnter: fn,          // called once when step becomes active
 *   }
 *
 * Compatible with game.js cutscene hooks: update(dt) / draw(ctx) / skip().
 * Reuses juice.js particles + trauma shake + hitstop — does not duplicate them.
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
import {
  StickFigure,
  resolvePose,
  lerpPose,
  clamp01,
  easeInOutCubic,
  PILOT_STYLE,
  PARTNER_STYLE,
  BOSS_STYLE,
} from "./stickFigure.js";

function easeOutCubic(t) {
  t = clamp01(t);
  return 1 - (1 - t) ** 3;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Normalize steps: ensure absolute `time` + `duration`, sorted. */
export function normalizeSteps(steps = []) {
  let cursor = 0;
  const out = steps.map((raw, i) => {
    const duration = raw.duration ?? 1;
    const time = raw.time != null ? raw.time : cursor;
    cursor = Math.max(cursor, time + duration);
    return { ...raw, time, duration, _index: i };
  });
  out.sort((a, b) => a.time - b.time || a._index - b._index);
  return out;
}

export class CutsceneTimeline {
  /**
   * @param {object[]} steps timeline steps
   * @param {object} [opts]
   * @param {Function} [opts.onDone] called when finished or skipped
   * @param {object} [opts.figures] map of id → StickFigure (created if missing)
   * @param {number} [opts.width]
   * @param {number} [opts.height]
   */
  constructor(steps, opts = {}) {
    this.steps = normalizeSteps(steps);
    this.onDone = opts.onDone;
    this.w = opts.width ?? W;
    this.h = opts.height ?? H;
    this.done = false;
    this.time = 0;
    this.activeIndex = -1;
    this.entered = new Set();

    // Camera state (lerped)
    this.camera = { x: this.w / 2, y: this.h / 2, zoom: 1 };
    this.cameraFrom = { ...this.camera };
    this.cameraTo = { ...this.camera };
    this.cameraBlend = 1;
    this.cameraBlendDur = 0.01;

    // Fade overlay 0..1 (1 = full black)
    this.fade = 0;
    this.text = null;
    this.textSub = null;

    // Reuse project juice utilities
    this.juice = createJuiceState();
    this.particles = [];

    // Pose blending state per figure
    this._poseFrom = {};
    this._poseTo = {};
    this._poseBlend = {};
    this._poseBlendDur = {};

    this.figures = { ...(opts.figures || {}) };
    // Sensible defaults for upcoming Escape / Victory cutscenes
    if (!this.figures.pilot) {
      this.figures.pilot = new StickFigure({ style: PILOT_STYLE, pose: "idle", scale: 1 });
    }
    if (!this.figures.partner) {
      this.figures.partner = new StickFigure({
        style: PARTNER_STYLE,
        pose: "idle",
        scale: 1,
        visible: false,
      });
    }
    if (!this.figures.boss) {
      this.figures.boss = new StickFigure({
        style: BOSS_STYLE,
        pose: "idle",
        scale: 1.35,
        visible: false,
      });
    }

    this.totalDuration = this.steps.reduce((max, s) => Math.max(max, s.time + s.duration), 0);

    // Background stars for void/space defaults
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

  get duration() {
    return this.totalDuration;
  }

  skip() {
    if (this.done) return;
    this.done = true;
    this.onDone?.();
  }

  /** Current step(s) — the latest whose time window contains `this.time`. */
  currentStep() {
    let cur = null;
    for (const s of this.steps) {
      if (this.time + 1e-6 >= s.time && this.time < s.time + s.duration) cur = s;
      if (s.time > this.time) break;
    }
    // If between gaps, keep last started step for camera hold
    if (!cur) {
      for (let i = this.steps.length - 1; i >= 0; i--) {
        if (this.time >= this.steps[i].time) return this.steps[i];
      }
    }
    return cur;
  }

  _enterStep(step) {
    if (!step || this.entered.has(step._index)) return;
    this.entered.add(step._index);

    // Camera tween target
    if (step.cameraX != null || step.cameraY != null || step.cameraZoom != null) {
      this.cameraFrom = { ...this.camera };
      this.cameraTo = {
        x: step.cameraX ?? this.camera.x,
        y: step.cameraY ?? this.camera.y,
        zoom: step.cameraZoom ?? this.camera.zoom,
      };
      this.cameraBlend = 0;
      this.cameraBlendDur = Math.max(0.05, step.cameraBlend ?? Math.min(0.6, step.duration * 0.45));
    }

    // Pose blend for primary (or named) figure
    const figId = step.figure || "pilot";
    const fig = this.figures[figId];
    if (fig && step.pose != null && !step.runCycle) {
      this._poseFrom[figId] = { ...fig.pose };
      this._poseTo[figId] = resolvePose(step.pose);
      this._poseBlend[figId] = 0;
      this._poseBlendDur[figId] = Math.max(0.01, step.poseBlend ?? 0.35);
    }

    // Multi-figure cast: { partner: { pose, visible, rootX, rootY, facing }, ... }
    if (step.cast) {
      for (const [id, cfg] of Object.entries(step.cast)) {
        const f = this.figures[id];
        if (!f) continue;
        if (cfg.visible != null) f.visible = !!cfg.visible;
        if (cfg.pose != null) {
          this._poseFrom[id] = { ...f.pose };
          this._poseTo[id] = resolvePose(cfg.pose);
          if (cfg.rootX != null) this._poseTo[id].rootX = cfg.rootX;
          if (cfg.rootY != null) this._poseTo[id].rootY = cfg.rootY;
          if (cfg.facing != null) this._poseTo[id].facing = cfg.facing;
          this._poseBlend[id] = 0;
          this._poseBlendDur[id] = Math.max(0.01, cfg.poseBlend ?? step.poseBlend ?? 0.35);
        } else {
          if (cfg.rootX != null) f.pose.rootX = cfg.rootX;
          if (cfg.rootY != null) f.pose.rootY = cfg.rootY;
          if (cfg.facing != null) f.pose.facing = cfg.facing;
        }
      }
    }

    // Hide figures listed in step.hide
    if (step.hide) {
      for (const id of step.hide) {
        if (this.figures[id]) this.figures[id].visible = false;
      }
    }
    if (step.show) {
      for (const id of step.show) {
        if (this.figures[id]) this.figures[id].visible = true;
      }
    }

    if (step.screenShake) addTrauma(this.juice, step.screenShake);
    if (step.freezeFrame) hitStop(this.juice, step.freezeFrame);

    // Particle bursts on enter (reuse juice.spawnBurst)
    const bursts = step.particles
      ? Array.isArray(step.particles)
        ? step.particles
        : [step.particles]
      : [];
    for (const b of bursts) {
      spawnBurst(this.particles, b.x ?? this.camera.x, b.y ?? this.camera.y, b);
    }

    if (step.text != null) this.text = step.text;
    if (step.textSub != null) this.textSub = step.textSub;
    if (step.clearText) {
      this.text = null;
      this.textSub = null;
    }

    step.onEnter?.(this, step);
  }

  update(dt) {
    if (this.done) return;

    // Hitstop freezes timeline + pose advance but still decays juice for feel
    if (this.juice.hitstop > 0) {
      decayJuice(this.juice, dt);
      updateParticles(this.particles, dt * 0.15);
      return;
    }

    this.time += dt;
    decayJuice(this.juice, dt);
    updateParticles(this.particles, dt);

    // Enter any steps whose window we've reached
    for (const step of this.steps) {
      if (this.time >= step.time && this.time < step.time + step.duration) {
        this._enterStep(step);
      }
    }

    const step = this.currentStep();

    // Camera lerp
    if (this.cameraBlend < 1) {
      this.cameraBlend = Math.min(1, this.cameraBlend + dt / this.cameraBlendDur);
      const k = easeOutCubic(this.cameraBlend);
      this.camera.x = lerp(this.cameraFrom.x, this.cameraTo.x, k);
      this.camera.y = lerp(this.cameraFrom.y, this.cameraTo.y, k);
      this.camera.zoom = lerp(this.cameraFrom.zoom, this.cameraTo.zoom, k);
    }

    // Pose blends + run cycles
    for (const [id, fig] of Object.entries(this.figures)) {
      if (!fig.visible && !(step?.cast && step.cast[id])) continue;
      const isPrimary =
        step?.figure === id || (!step?.figure && id === "pilot") || step?.drive?.includes?.(id);
      const castCfg = step?.cast?.[id];
      const driven = isPrimary || !!castCfg;

      if (!driven) continue;

      if ((isPrimary && step?.runCycle) || castCfg?.runCycle) {
        fig.visible = true;
        fig.tickRun(dt, castCfg?.runSpeed ?? step.runSpeed ?? 2.4);
        const rootX = castCfg?.rootX ?? (isPrimary ? step.rootX : null);
        const rootY = castCfg?.rootY ?? (isPrimary ? step.rootY : null);
        const facing = castCfg?.facing ?? (isPrimary ? step.facing : null);
        if (rootX != null) fig.pose.rootX = rootX;
        if (rootY != null) fig.pose.rootY = rootY;
        if (facing != null) fig.pose.facing = facing;
        const scrollX = castCfg?.scrollX ?? (isPrimary ? step.scrollX : 0);
        if (scrollX) fig.pose.rootX += scrollX * dt;
      } else if (this._poseTo[id]) {
        fig.visible = true;
        const dur = this._poseBlendDur[id] || 0.35;
        this._poseBlend[id] = Math.min(1, (this._poseBlend[id] || 0) + dt / dur);
        const blended = lerpPose(this._poseFrom[id], this._poseTo[id], this._poseBlend[id]);
        if (isPrimary) {
          if (step?.rootX != null) blended.rootX = step.rootX;
          if (step?.rootY != null) blended.rootY = step.rootY;
        }
        if (castCfg?.rootX != null) blended.rootX = castCfg.rootX;
        if (castCfg?.rootY != null) blended.rootY = castCfg.rootY;
        fig.pose = blended;
      }
    }

    // Camera follow figure (side-scroll chase)
    if (step?.followFigure && this.figures[step.followFigure]) {
      const f = this.figures[step.followFigure];
      this.camera.x = f.pose.rootX + (step.followOffsetX ?? 40);
      this.camera.y = f.pose.rootY + (step.followOffsetY ?? -20);
    }

    // Continuous particle emitters (optional per-step)
    if (step?.emit && Math.random() < (step.emit.chance ?? 0.4)) {
      spawnBurst(this.particles, step.emit.x ?? this.camera.x, step.emit.y ?? this.camera.y, step.emit);
    }

    // Fade: fadeIn at step start, fadeOut at step end
    this.fade = 0;
    if (step) {
      const local = this.time - step.time;
      if (step.fadeIn && local < step.fadeIn) {
        this.fade = Math.max(this.fade, 1 - local / step.fadeIn);
      }
      if (step.fadeOut && local > step.duration - step.fadeOut) {
        const u = (local - (step.duration - step.fadeOut)) / step.fadeOut;
        this.fade = Math.max(this.fade, clamp01(u));
      }
    }

    // Starfield drift
    for (const s of this.stars) {
      s.y += 40 * s.z * dt;
      if (s.y > this.h) {
        s.y = -2;
        s.x = Math.random() * this.w;
      }
    }

    if (this.time >= this.totalDuration + 0.05) {
      this.skip();
    }
  }

  /** Draw a named / custom background in screen space (pre-camera). */
  drawBackground(ctx, step) {
    const bg = step?.bg ?? "void";
    if (typeof bg === "function") {
      bg(ctx, this, step ? this.time - step.time : 0);
      return;
    }

    ctx.fillStyle = "#02050b";
    ctx.fillRect(0, 0, this.w, this.h);

    if (bg === "void" || bg === "space") {
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
    } else if (bg === "corridor") {
      // Simple perspective corridor — Escape cutscene can refine later
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
      // Wall ribs
      ctx.strokeStyle = "rgba(220,230,255,0.08)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const x0 = lerp(0, this.w * 0.35, t);
        const x1 = lerp(this.w, this.w * 0.65, t);
        const y = lerp(0, this.h * 0.35, t);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }
    } else if (bg === "cockpit" || bg === "hangar") {
      ctx.fillStyle = "#080b12";
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = "#151c28";
      ctx.fillRect(0, this.h * 0.55, this.w, this.h * 0.45);
      ctx.fillStyle = "rgba(255,176,80,0.12)";
      ctx.beginPath();
      ctx.arc(this.w * 0.5, this.h * 0.4, 120, 0, Math.PI * 2);
      ctx.fill();
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
    } else if (bg === "wreckage") {
      ctx.fillStyle = "#06080e";
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = "#121820";
      ctx.fillRect(0, this.h * 0.65, this.w, this.h * 0.35);
      ctx.fillStyle = "rgba(255,100,60,0.08)";
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  draw(ctx) {
    if (this.done) return;
    const step = this.currentStep();
    const shake = shakeOffset(this.juice);

    this.drawBackground(ctx, step);

    ctx.save();
    // Camera: translate so camera.x/y is centered, then zoom
    ctx.translate(this.w / 2 + shake.x, this.h / 2 + shake.y);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // Figures (world space)
    for (const fig of Object.values(this.figures)) {
      fig.draw(ctx);
    }

    // Step-specific world draw
    step?.draw?.(ctx, this, step ? this.time - step.time : 0);

    // Particles in world space
    drawParticles(ctx, this.particles);
    ctx.restore();

    // Letterbox
    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, this.w, 64);
    ctx.fillRect(0, this.h - 64, this.w, 64);

    // Text overlay
    if (this.text || this.textSub) {
      ctx.save();
      ctx.textAlign = "center";
      if (this.text) {
        ctx.fillStyle = "#f0a23a";
        ctx.font = "700 13px Orbitron, sans-serif";
        ctx.fillText(this.text, this.w / 2, this.h * 0.74);
      }
      if (this.textSub) {
        ctx.fillStyle = "#eef4ff";
        ctx.font = "600 22px Rajdhani, sans-serif";
        const lines = String(this.textSub).split("\n");
        lines.forEach((line, i) => ctx.fillText(line, this.w / 2, this.h * 0.74 + 30 + i * 28));
      }
      ctx.restore();
    }

    // Progress bar
    const progress = clamp01(this.time / Math.max(0.01, this.totalDuration));
    ctx.fillStyle = "rgba(62, 240, 208, 0.35)";
    ctx.fillRect(0, this.h - 66, this.w * progress, 2);

    ctx.fillStyle = "rgba(158, 179, 209, 0.85)";
    ctx.font = "600 14px Rajdhani, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("CLICK / SPACE TO SKIP", this.w - 24, this.h - 24);

    // Fade to black
    if (this.fade > 0.01) {
      ctx.globalAlpha = clamp01(this.fade);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }

    drawPostFx(ctx, this.w, this.h, this.juice);
  }
}

/**
 * Helper: build a CutsceneTimeline with the same onDone contract as the
 * older Cutscene class, ready for beginIntroCutscene / beginVictoryCutscene.
 *
 * Hook points in game.js (unchanged for Step 1):
 *   beginIntroCutscene()    → before Stage 1  (STATES.CUTSCENE)
 *   beginVictoryCutscene()  → after final boss → showVictory()
 */
export function createTimelineCutscene(steps, onDone, opts = {}) {
  return new CutsceneTimeline(steps, { ...opts, onDone });
}
