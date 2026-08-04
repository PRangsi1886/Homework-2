/**
 * Story cutscene beat sheets — Escape (intro) and Victory (ending).
 * Built on CutsceneTimeline + StickFigure.
 * Edit timings/poses here; each step is commented to match the beat sheet.
 */

import { W, H } from "./entities.js";
import { createTimelineCutscene } from "./cutsceneTimeline.js";
import { StickFigure, PILOT_STYLE, PARTNER_STYLE, BOSS_STYLE } from "./stickFigure.js";
import { spawnBurst, addTrauma } from "./juice.js";

/** Simple fighter silhouette for hangar launch / sunrise callback. */
function drawStoryShip(ctx, x, y, scale = 1, angle = -0.4) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#dce6ff";
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(16, 14);
  ctx.lineTo(5, 8);
  ctx.lineTo(0, 16);
  ctx.lineTo(-5, 8);
  ctx.lineTo(-16, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffb060";
  ctx.fillRect(-2.5, 14, 5, 8);
  ctx.restore();
}

function drawHatch(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(220,230,255,0.35)";
  ctx.fillStyle = "rgba(20, 28, 40, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 36, Math.PI * 0.15, Math.PI * 0.85);
  ctx.lineTo(-28, 40);
  ctx.lineTo(28, 40);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,176,80,0.5)";
  ctx.fillRect(-4, 8, 8, 10);
  ctx.restore();
}

function drawWreckageBits(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = "rgba(160, 120, 90, 0.55)";
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 40 + (i % 3) * 18;
    ctx.fillRect(cx + Math.cos(a) * r - 6, cy + Math.sin(a) * r * 0.4 + 30, 12 + (i % 4) * 4, 4);
  }
  ctx.restore();
}

/**
 * Cutscene A — "Escape"
 * Plays before Stage 1 via beginIntroCutscene().
 */
export function createEscapeCutscene(onDone) {
  const groundY = H * 0.62;

  const steps = [
    // 1) Pilot runs down corridor — explosions behind, camera follows (~2.6s)
    {
      time: 0,
      duration: 2.6,
      bg: "corridor",
      figure: "pilot",
      runCycle: true,
      runSpeed: 2.6,
      scrollX: 160,
      rootY: groundY,
      facing: 1,
      followFigure: "pilot",
      followOffsetX: 80,
      followOffsetY: -30,
      cameraZoom: 1.05,
      screenShake: 0.22,
      text: "ESCAPE",
      textSub: "The ship is going down.",
      hide: ["partner", "boss"],
      particles: {
        x: 40,
        y: groundY - 40,
        count: 20,
        speed: 240,
        colors: ["#ff8a40", "#ff5a6e", "#ffe08a"],
        life: 0.5,
        size: 3,
        glow: true,
      },
      onEnter(tl) {
        const p = tl.figures.pilot;
        p.visible = true;
        p.pose.rootX = 80;
        p.pose.rootY = groundY;
        p.pose.facing = 1;
      },
    },

    // 2) Stops at hatch — idle bob, tight camera (~1.1s)
    {
      time: 2.6,
      duration: 1.1,
      bg: "corridor",
      figure: "pilot",
      pose: "hatchIdle",
      poseBlend: 0.3,
      rootX: 520,
      rootY: groundY,
      facing: 1,
      cameraX: 520,
      cameraY: groundY - 40,
      cameraZoom: 1.35,
      cameraBlend: 0.45,
      text: "ESCAPE",
      textSub: "",
      draw(ctx) {
        drawHatch(ctx, 580, groundY - 10);
      },
      onEnter(tl) {
        tl.figures.pilot.pose.rootX = 520;
        tl.figures.pilot.pose.rootY = groundY;
      },
    },

    // 3) Close-up: pulls photo — camera push in (~2.5s)
    {
      time: 3.7,
      duration: 2.5,
      bg: "corridor",
      figure: "pilot",
      pose: "holdPhoto",
      poseBlend: 0.45,
      rootX: 520,
      rootY: groundY,
      cameraX: 520,
      cameraY: groundY - 50,
      cameraZoom: 2.1,
      cameraBlend: 0.7,
      text: "",
      textSub: "I'll come back for you.",
      draw(ctx) {
        drawHatch(ctx, 580, groundY - 10);
      },
    },

    // 4) Flashback — them together, fade in/out (~1.6s)
    {
      time: 6.2,
      duration: 1.6,
      bg: "sunrise",
      fadeIn: 0.25,
      fadeOut: 0.35,
      cameraX: W / 2,
      cameraY: H * 0.55,
      cameraZoom: 1.4,
      cast: {
        pilot: { pose: "together", rootX: W / 2 - 30, rootY: H * 0.58, facing: 1, visible: true },
        partner: { pose: "together", rootX: W / 2 + 28, rootY: H * 0.58, facing: -1, visible: true },
      },
      hide: ["boss"],
      text: "MEMORY",
      textSub: "",
    },

    // 5a) Clenches photo (~0.55s)
    {
      time: 7.8,
      duration: 0.55,
      bg: "corridor",
      figure: "pilot",
      pose: "clenchFist",
      poseBlend: 0.25,
      rootX: 520,
      rootY: groundY,
      cameraX: 520,
      cameraY: groundY - 40,
      cameraZoom: 1.6,
      hide: ["partner", "boss"],
      show: ["pilot"],
      draw(ctx) {
        drawHatch(ctx, 580, groundY - 10);
      },
    },
    // 5b) Determined — camera pulls back (~0.7s)
    {
      time: 8.35,
      duration: 0.7,
      bg: "corridor",
      figure: "pilot",
      pose: "determined",
      poseBlend: 0.3,
      rootX: 520,
      rootY: groundY,
      cameraX: 500,
      cameraY: groundY - 30,
      cameraZoom: 1.15,
      cameraBlend: 0.5,
      hide: ["partner", "boss"],
      draw(ctx) {
        drawHatch(ctx, 580, groundY - 10);
      },
    },

    // 6) Runs into cockpit — door seals (~1.5s)
    {
      time: 9.05,
      duration: 1.5,
      bg: "hangar",
      figure: "pilot",
      runCycle: true,
      runSpeed: 2.8,
      scrollX: 180,
      rootY: groundY + 20,
      facing: 1,
      followFigure: "pilot",
      followOffsetX: 60,
      cameraZoom: 1.1,
      hide: ["partner", "boss"],
      text: "LAUNCH",
      textSub: "",
      onEnter(tl) {
        tl.figures.pilot.pose.rootX = 200;
        tl.figures.pilot.pose.rootY = groundY + 20;
      },
      draw(ctx, tl) {
        const t = tl.time - 9.05;
        const seal = Math.min(1, Math.max(0, (t - 0.8) / 0.6));
        ctx.fillStyle = "rgba(30, 40, 55, 0.85)";
        ctx.fillRect(420, 80, 24, H * 0.55 * seal);
        ctx.fillRect(460, 80, 24, H * 0.55 * seal);
      },
    },

    // 7) Ship launches — wide pull-back (~2.4s)
    {
      time: 10.55,
      duration: 2.4,
      bg: "hangar",
      hide: ["pilot", "partner", "boss"],
      cameraX: W / 2,
      cameraY: H * 0.45,
      cameraZoom: 0.85,
      cameraBlend: 0.8,
      screenShake: 0.18,
      particles: {
        x: W * 0.35,
        y: H * 0.55,
        count: 28,
        speed: 260,
        colors: ["#ffb060", "#ffe08a", "#ffffff"],
        life: 0.7,
        size: 3.5,
        glow: true,
        gravity: 40,
      },
      text: "SORTIE",
      textSub: "",
      onEnter(tl) {
        tl._ship = { x: W * 0.35, y: H * 0.55 };
      },
      draw(ctx, tl, localT) {
        const ship = tl._ship || { x: W * 0.35, y: H * 0.55 };
        const u = Math.min(1, localT / 2.2);
        const x = ship.x + u * 420;
        const y = ship.y - u * u * 280;
        drawStoryShip(ctx, x, y, 1.4 - u * 0.5, -0.5 - u * 0.4);
        ctx.globalAlpha = 0.5 * (1 - u * 0.5);
        ctx.fillStyle = "#ffb060";
        ctx.beginPath();
        ctx.arc(x - 18, y + 16, 6 + u * 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      },
    },

    // 8) Fade wipe into Stage 1 (~0.55s)
    {
      time: 12.95,
      duration: 0.55,
      bg: "void",
      hide: ["pilot", "partner", "boss"],
      fadeOut: 0.55,
      clearText: true,
      cameraX: W / 2,
      cameraY: H / 2,
      cameraZoom: 1,
    },
  ];

  const tl = createTimelineCutscene(steps, onDone, {
    figures: {
      pilot: new StickFigure({ style: PILOT_STYLE, pose: "run", scale: 1.15 }),
      partner: new StickFigure({ style: PARTNER_STYLE, pose: "idle", scale: 1.1, visible: false }),
      boss: new StickFigure({ style: BOSS_STYLE, pose: "idle", scale: 1.5, visible: false }),
    },
  });

  // Continuous debris behind runner + hatch breathing bob
  const baseUpdate = tl.update.bind(tl);
  tl.update = (dt) => {
    baseUpdate(dt);
    if (tl.done) return;
    const step = tl.currentStep();
    if (step && step.time === 0 && tl.figures.pilot.visible) {
      const p = tl.figures.pilot.pose;
      if (Math.random() < 0.5) {
        spawnBurst(tl.particles, p.rootX - 50, p.rootY - 30, {
          count: 8,
          speed: 200,
          colors: ["#ff8a40", "#ff5a6e", "#ffe08a"],
          life: 0.4,
          size: 2.8,
          glow: true,
          gravity: 90,
        });
      }
      if (Math.random() < 0.08) addTrauma(tl.juice, 0.06);
    }
    if (step && step.time === 2.6 && tl.figures.pilot.visible) {
      tl.figures.pilot.pose.rootY = groundY + Math.sin(tl.time * 5) * 2.5;
    }
  };

  return tl;
}

/**
 * Cutscene B — "Victory"
 * Plays after final boss via beginVictoryCutscene().
 */
export function createVictoryStoryCutscene(score, onDone) {
  const groundY = H * 0.58;

  const steps = [
    // 1) Boss collapses / explodes — shake + hitstop (~1.6s)
    {
      time: 0,
      duration: 1.6,
      bg: "wreckage",
      hide: ["partner"],
      show: ["boss", "pilot"],
      cast: {
        boss: { pose: "collapse", rootX: W / 2 + 40, rootY: groundY - 10, visible: true },
        pilot: { pose: "determined", rootX: W / 2 - 90, rootY: groundY, facing: 1, visible: true },
      },
      cameraX: W / 2 + 20,
      cameraY: groundY - 40,
      cameraZoom: 1.25,
      screenShake: 0.55,
      freezeFrame: 0.12,
      particles: [
        {
          x: W / 2 + 40,
          y: groundY - 20,
          count: 48,
          speed: 340,
          colors: ["#ff5a6e", "#ffb060", "#ffffff", "#ffe08a"],
          life: 0.85,
          size: 4,
          glow: true,
          gravity: 60,
        },
      ],
      text: "VICTORY",
      textSub: "Blockade commander down.",
      onEnter(tl) {
        tl.figures.boss.visible = true;
        tl.figures.pilot.visible = true;
      },
      emit: {
        chance: 0.35,
        x: W / 2 + 40,
        y: groundY - 10,
        count: 6,
        speed: 160,
        colors: ["#ff8a40", "#ff5a6e"],
        life: 0.35,
        glow: true,
      },
    },

    // 2) Pilot amid wreckage — lowers weapon, slow push in (~1.8s)
    {
      time: 1.6,
      duration: 1.8,
      bg: "wreckage",
      hide: ["boss", "partner"],
      figure: "pilot",
      pose: "lowerWeapon",
      poseBlend: 0.5,
      rootX: W / 2 - 20,
      rootY: groundY,
      cameraX: W / 2 - 10,
      cameraY: groundY - 50,
      cameraZoom: 1.55,
      cameraBlend: 1.2,
      text: "VICTORY",
      textSub: "",
      draw(ctx) {
        drawWreckageBits(ctx, W / 2, groundY);
      },
    },

    // 3) Pulls photo again — smile/relief — mirror Escape framing (~2.6s)
    {
      time: 3.4,
      duration: 2.6,
      bg: "wreckage",
      hide: ["boss", "partner"],
      figure: "pilot",
      pose: "smileRelief",
      poseBlend: 0.45,
      rootX: W / 2 - 20,
      rootY: groundY,
      cameraX: W / 2 - 20,
      cameraY: groundY - 55,
      cameraZoom: 2.1,
      cameraBlend: 0.7,
      text: "",
      textSub: "I'll come back for you.",
      draw(ctx) {
        drawWreckageBits(ctx, W / 2, groundY);
      },
    },

    // 4) Wide sunrise / ship flying off — callback to Escape launch (~2.5s)
    {
      time: 6.0,
      duration: 2.5,
      bg: "sunrise",
      hide: ["pilot", "partner", "boss"],
      cameraX: W / 2,
      cameraY: H * 0.45,
      cameraZoom: 0.9,
      cameraBlend: 0.8,
      clearText: true,
      onEnter(tl) {
        tl._ship = { x: W * 0.25, y: H * 0.6 };
      },
      draw(ctx, tl, localT) {
        const u = Math.min(1, localT / 2.3);
        const x = W * 0.25 + u * 380;
        const y = H * 0.62 - u * 200;
        drawStoryShip(ctx, x, y, 1.2 - u * 0.35, -0.55 - u * 0.25);
      },
    },

    // 5) Fade to closing text (~2.0s)
    {
      time: 8.5,
      duration: 2.0,
      bg: "void",
      hide: ["pilot", "partner", "boss"],
      fadeIn: 0.4,
      cameraX: W / 2,
      cameraY: H / 2,
      cameraZoom: 1,
      text: "THE END",
      textSub: `I'll come back for you.\nScore ${score}`,
    },
  ];

  return createTimelineCutscene(steps, onDone, {
    figures: {
      pilot: new StickFigure({ style: PILOT_STYLE, pose: "determined", scale: 1.2 }),
      partner: new StickFigure({ style: PARTNER_STYLE, pose: "idle", scale: 1.1, visible: false }),
      boss: new StickFigure({ style: BOSS_STYLE, pose: "collapse", scale: 1.55, visible: false }),
    },
  });
}
