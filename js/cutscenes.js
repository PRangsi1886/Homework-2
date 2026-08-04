import { W, H } from "./entities.js";

/**
 * Legacy beat-based cutscenes (freighter / fighter set pieces).
 *
 * Stick-figure timeline system (Step 1) lives in:
 *   - js/stickFigure.js      → StickFigure, POSES, lerpPose
 *   - js/cutsceneTimeline.js → CutsceneTimeline, createTimelineCutscene
 *
 * Existing game.js hooks (ready for Step 2 / 3 swap-in):
 *   beginIntroCutscene()   → plays before Stage 1, then beginGameplay()
 *   beginVictoryCutscene() → plays after final boss, then showVictory()
 *
 * To swap: replace createIntroCutscene / createVictoryCutscene bodies
 * with createTimelineCutscene([...steps], onDone) — same update/draw/skip API.
 */

/** Canvas-driven story beats with letterbox bars and skip support. */
export class Cutscene {
  constructor(beats, { onDone } = {}) {
    this.beats = beats;
    this.onDone = onDone;
    this.beat = 0;
    this.t = 0;
    this.done = false;
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.4 + Math.random() * 1.5,
        s: 0.7 + Math.random() * 1.6,
      });
    }
    this.ships = [];
    this.fx = [];
  }

  skip() {
    if (this.done) return;
    this.done = true;
    this.onDone?.();
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    for (const s of this.stars) {
      s.y += 55 * s.z * dt;
      if (s.y > H) {
        s.y = -2;
        s.x = Math.random() * W;
      }
    }
    for (const f of this.fx) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;
    }
    this.fx = this.fx.filter((f) => f.life > 0);

    const beat = this.beats[this.beat];
    if (!beat) {
      this.skip();
      return;
    }
    beat.update?.(this, dt, this.t);
    if (this.t >= beat.duration) {
      this.beat += 1;
      this.t = 0;
      this.beats[this.beat]?.enter?.(this);
      if (!this.beats[this.beat]) this.skip();
    }
  }

  draw(ctx) {
    if (this.done) return;
    ctx.fillStyle = "#02050b";
    ctx.fillRect(0, 0, W, H);

    const neb = ctx.createLinearGradient(0, 0, 0, H);
    neb.addColorStop(0, "rgba(18, 48, 70, 0.4)");
    neb.addColorStop(0.5, "rgba(8, 20, 40, 0.18)");
    neb.addColorStop(1, "rgba(50, 24, 12, 0.32)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, W, H);

    for (const s of this.stars) {
      ctx.globalAlpha = 0.3 + s.z * 0.45;
      ctx.fillStyle = s.z > 1.1 ? "#c8fff4" : "#d7e4ff";
      ctx.fillRect(s.x, s.y, s.s, s.s * (1 + s.z));
    }
    ctx.globalAlpha = 1;

    const beat = this.beats[this.beat];
    beat?.draw?.(ctx, this, this.t);

    for (const f of this.fx) {
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // letterbox
    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, W, 70);
    ctx.fillRect(0, H - 70, W, 70);

    const progress = (this.beat + this.t / (beat?.duration || 1)) / this.beats.length;
    ctx.fillStyle = "rgba(62, 240, 208, 0.35)";
    ctx.fillRect(0, H - 72, W * clamp01(progress), 2);

    ctx.fillStyle = "rgba(158, 179, 209, 0.85)";
    ctx.font = "600 14px Rajdhani";
    ctx.textAlign = "right";
    ctx.fillText("CLICK / SPACE TO SKIP", W - 24, H - 28);
  }

  burst(x, y, color, n = 18, speed = 180) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.8);
      this.fx.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5,
        max: 0.9,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function easeOut(t) {
  return 1 - (1 - clamp01(t)) ** 3;
}

function easeInOut(t) {
  t = clamp01(t);
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function drawFreighter(ctx, x, y, scale = 1, glow = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (glow > 0) {
    ctx.shadowColor = "rgba(62, 240, 208, 0.55)";
    ctx.shadowBlur = 24 * glow;
  }
  ctx.fillStyle = "#8ba3c7";
  ctx.beginPath();
  ctx.moveTo(-90, 10);
  ctx.lineTo(-70, -28);
  ctx.lineTo(80, -22);
  ctx.lineTo(110, 0);
  ctx.lineTo(80, 24);
  ctx.lineTo(-70, 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3ef0d0";
  ctx.fillRect(-40, -12, 70, 8);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(40, -8, 28, 14);
  ctx.fillStyle = "#f0a23a";
  ctx.fillRect(-85, 0, 14, 10);
  ctx.restore();
}

function drawFighter(ctx, x, y, scale = 1, color = "#3ef0d0") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(15, 16);
  ctx.lineTo(5, 10);
  ctx.lineTo(0, 18);
  ctx.lineTo(-5, 10);
  ctx.lineTo(-15, 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f0a23a";
  ctx.fillRect(-2.5, 16, 5, 7);
  ctx.restore();
}

function drawHostile(ctx, x, y, scale = 1, color = "#ff5a6e") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(16, -10);
  ctx.lineTo(0, -14);
  ctx.lineTo(-16, -10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCaption(ctx, title, body, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.fillStyle = "#f0a23a";
  ctx.font = "700 13px Orbitron";
  ctx.fillText(title, W / 2, H * 0.72);
  ctx.fillStyle = "#eef4ff";
  ctx.font = "600 22px Rajdhani";
  const lines = body.split("\n");
  lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.72 + 32 + i * 28));
  ctx.restore();
}

export function createIntroCutscene(onDone) {
  const cut = new Cutscene(
    [
      {
        duration: 3.2,
        enter(c) {
          c.freighterX = -160;
          c.freighterY = H * 0.42;
        },
        update(c, dt) {
          c.freighterX += 90 * dt;
        },
        draw(ctx, c, t) {
          drawFreighter(ctx, c.freighterX, c.freighterY + Math.sin(t * 1.4) * 6, 1.15, easeOut(t / 1.2));
          drawCaption(ctx, "TRANSMISSION", "Cargo freighter FERRUM WING\nen route to the front line.", easeOut(t * 1.5));
        },
      },
      {
        duration: 3.4,
        enter(c) {
          c.hostiles = [];
          for (let i = 0; i < 10; i++) {
            c.hostiles.push({
              x: 40 + Math.random() * (W - 80),
              y: -40 - Math.random() * 220,
              speed: 90 + Math.random() * 70,
            });
          }
        },
        update(c, dt) {
          for (const h of c.hostiles) h.y += h.speed * dt;
        },
        draw(ctx, c, t) {
          drawFreighter(ctx, W * 0.55, H * 0.55, 1.05, 0.4);
          for (const h of c.hostiles) drawHostile(ctx, h.x, h.y, 0.9 + (h.x % 20) * 0.01);
          drawCaption(
            ctx,
            "ALERT",
            "Hostile interceptors inbound.\nThey must not reach the freighter.",
            easeOut(Math.min(1, t * 2))
          );
        },
      },
      {
        duration: 3.6,
        enter(c) {
          c.fighters = [
            { x: W * 0.5, y: H * 0.62, vx: 0, vy: 0 },
            { x: W * 0.5 - 8, y: H * 0.66, vx: 0, vy: 0 },
            { x: W * 0.5 + 8, y: H * 0.66, vx: 0, vy: 0 },
          ];
          c.launched = false;
        },
        update(c, dt, t) {
          if (t > 0.8 && !c.launched) {
            c.launched = true;
            c.burst(W * 0.5, H * 0.58, "#f0a23a", 24, 220);
            c.fighters[0].vy = -220;
            c.fighters[1].vx = -80;
            c.fighters[1].vy = -200;
            c.fighters[2].vx = 80;
            c.fighters[2].vy = -200;
          }
          for (const f of c.fighters) {
            f.x += f.vx * dt;
            f.y += f.vy * dt;
          }
          if (t > 1.5) {
            for (let i = 0; i < 2; i++) {
              c.burst(80 + Math.random() * (W - 160), 80 + Math.random() * 180, "#ff5a6e", 4, 90);
            }
          }
        },
        draw(ctx, c, t) {
          drawFreighter(ctx, W * 0.5, H * 0.62, 1.2, 0.7 + Math.sin(t * 6) * 0.15);
          for (const f of c.fighters) drawFighter(ctx, f.x, f.y, 1.05);
          for (let i = 0; i < 6; i++) {
            drawHostile(ctx, 70 + i * 100, 90 + Math.sin(t * 3 + i) * 20, 0.85);
          }
          drawCaption(
            ctx,
            "PROTOCOL",
            "Launch robotic fighters.\nHold the line across four sectors.",
            easeOut(Math.min(1, t * 2))
          );
        },
      },
      {
        duration: 2.6,
        draw(ctx, c, t) {
          const pulse = 0.85 + Math.sin(t * 8) * 0.15;
          drawFighter(ctx, W / 2, H * 0.42 + Math.sin(t * 3) * 10, 1.6 * pulse);
          const a = easeInOut(t / 2.2);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.textAlign = "center";
          ctx.fillStyle = "#3ef0d0";
          ctx.font = "800 34px Orbitron";
          ctx.fillText("SECTOR 1", W / 2, H * 0.58);
          ctx.fillStyle = "#eef4ff";
          ctx.font = "600 20px Rajdhani";
          ctx.fillText("Engage all hostiles", W / 2, H * 0.58 + 36);
          ctx.restore();
        },
      },
    ],
    { onDone }
  );
  cut.beats[0].enter?.(cut);
  return cut;
}

export function createVictoryCutscene(score, onDone) {
  const cut = new Cutscene(
    [
      {
        duration: 3.2,
        enter(c) {
          c.bossY = 150;
          c.bossDead = false;
        },
        update(c, dt, t) {
          if (t > 0.6 && !c.bossDead) {
            c.bossDead = true;
            for (let i = 0; i < 5; i++) {
              c.burst(W / 2 + (Math.random() - 0.5) * 80, 150 + (Math.random() - 0.5) * 40, "#ffb020", 30, 280);
            }
          }
          if (c.bossDead) c.bossY += 40 * dt;
        },
        draw(ctx, c, t) {
          if (!c.bossDead || t < 1.1) {
            ctx.save();
            ctx.translate(W / 2, c.bossY);
            ctx.globalAlpha = c.bossDead ? Math.max(0, 1.1 - t) : 1;
            ctx.fillStyle = "#ffb020";
            ctx.beginPath();
            ctx.moveTo(0, 55);
            ctx.lineTo(70, 15);
            ctx.lineTo(50, -45);
            ctx.lineTo(0, -28);
            ctx.lineTo(-50, -45);
            ctx.lineTo(-70, 15);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          drawFighter(ctx, W / 2 - 40, H * 0.62, 1.1);
          drawFighter(ctx, W / 2 + 40, H * 0.64, 1.1);
          drawCaption(ctx, "FINAL HOSTILE DOWN", "The blockade is broken.", easeOut(Math.min(1, t * 2)));
        },
      },
      {
        duration: 3.4,
        enter(c) {
          c.freighterX = W * 0.35;
          c.dock = [
            { x: W * 0.2, y: H * 0.7, tx: W * 0.42, ty: H * 0.5 },
            { x: W * 0.5, y: H * 0.75, tx: W * 0.5, ty: H * 0.52 },
            { x: W * 0.8, y: H * 0.7, tx: W * 0.58, ty: H * 0.5 },
          ];
        },
        update(c, dt, t) {
          const k = easeInOut(Math.min(1, t / 2.4));
          for (const d of c.dock) {
            d.x += (d.tx - d.x) * k * dt * 2.2;
            d.y += (d.ty - d.y) * k * dt * 2.2;
          }
          c.freighterX += 18 * dt;
        },
        draw(ctx, c, t) {
          drawFreighter(ctx, c.freighterX, H * 0.48, 1.25, 0.8);
          for (const d of c.dock) drawFighter(ctx, d.x, d.y, 1);
          drawCaption(
            ctx,
            "RECOVERY",
            "Fighters returning to bay.\nFreighter resumes course.",
            easeOut(Math.min(1, t * 2))
          );
        },
      },
      {
        duration: 3.2,
        draw(ctx, c, t) {
          drawFreighter(ctx, W / 2 + Math.sin(t) * 8, H * 0.4, 1.35, 1);
          const a = easeOut(Math.min(1, t * 1.6));
          ctx.save();
          ctx.globalAlpha = a;
          ctx.textAlign = "center";
          ctx.fillStyle = "#3ef0d0";
          ctx.font = "800 40px Orbitron";
          ctx.fillText("CARGO DELIVERED", W / 2, H * 0.58);
          ctx.fillStyle = "#eef4ff";
          ctx.font = "600 22px Rajdhani";
          ctx.fillText(`Mission complete · Score ${score}`, W / 2, H * 0.58 + 40);
          ctx.restore();
        },
      },
    ],
    { onDone }
  );
  cut.beats[0].enter?.(cut);
  return cut;
}
