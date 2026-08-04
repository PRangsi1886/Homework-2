/**
 * Cutscene factories — Escape (intro) and Victory (ending).
 * Beat sheets from the stick-figure cutscene system reference.
 */

import { W, H } from "./entities.js";
import { CutsceneTimeline } from "./cutsceneTimeline.js";
import { StickFigure, PILOT_COLOR, LOVE_COLOR, BOSS_COLOR } from "./stickFigure.js";

/** Cutscene A — Escape (before Stage 1). */
export function buildIntroCutscene({ canvasWidth = W, canvasHeight = H } = {}) {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const ground = cy + 40;

  return [
    // 1. Running down corridor
    {
      time: 2.5,
      actor: "pilot",
      pose: "run",
      runCycle: true,
      bg: "corridor",
      actorX: cx - 220,
      actorY: ground,
      moveX: cx - 40,
      cameraX: cx - 120,
      cameraY: ground - 30,
      cameraZoom: 1,
      particlesAt: {
        x: cx - 280,
        y: ground + 20,
        count: 15,
        opts: { color: "#ff8844", speed: 4, life: 30 },
      },
      screenShake: { intensity: 6, duration: 20 },
      emitChance: 0.45,
      text: "The ship is going down.",
      showPhoto: false,
      hideActors: ["love", "boss"],
    },
    // 2. Stops at hatch, breathing
    {
      time: 1.0,
      actor: "pilot",
      pose: "breathHeavy",
      bg: "corridor",
      cameraX: cx,
      cameraY: ground - 40,
      cameraZoom: 1.2,
      text: "",
    },
    // 3. Reaches into jacket
    {
      time: 1.5,
      actor: "pilot",
      pose: "reachIntoJacket",
      bg: "corridor",
      cameraX: cx,
      cameraY: ground - 50,
      cameraZoom: 1.5,
    },
    // 4. Holds photo, camera pushes in
    {
      time: 2.5,
      actor: "pilot",
      pose: "holdPhoto",
      bg: "corridor",
      showPhoto: true,
      cameraX: cx,
      cameraY: ground - 70,
      cameraZoom: 2.2,
    },
    // 5. Clenches fist, determined
    {
      time: 1.0,
      actor: "pilot",
      pose: "clenchFist",
      bg: "corridor",
      showPhoto: false,
      cameraX: cx,
      cameraY: ground - 40,
      cameraZoom: 1.4,
      text: "I'll come back for you.",
    },
    // 6. Runs into cockpit
    {
      time: 1.5,
      actor: "pilot",
      pose: "run",
      runCycle: true,
      bg: "hangar",
      moveX: cx + 180,
      cameraX: cx + 80,
      cameraY: ground - 20,
      cameraZoom: 1,
      text: "",
      showPhoto: false,
    },
    // 7. Ship launches — wide pull-back (pilot exits frame; FX sell the launch)
    {
      time: 2.5,
      actor: "pilot",
      pose: "idle",
      bg: "hangar",
      hideActors: ["pilot"],
      cameraX: cx + 200,
      cameraY: ground - 120,
      cameraZoom: 0.55,
      particlesAt: {
        x: cx + 80,
        y: ground - 20,
        count: 30,
        opts: { color: "#88ccff", speed: 6, life: 50 },
      },
      screenShake: { intensity: 10, duration: 25 },
    },
    // 8. Fade to Stage 1
    {
      time: 0.5,
      actor: null,
      pose: null,
      bg: "void",
      fade: "out",
      text: "",
    },
  ];
}

/** Cutscene B — Victory (after final boss). */
export function buildEndingCutscene({ canvasWidth = W, canvasHeight = H, score = 0 } = {}) {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const ground = cy + 60;

  return [
    // Fade in from gameplay
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
    // 1. Boss collapses
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
    // 2. Pilot lowers weapon, breathes
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
    // 3. Pulls photo again — mirrors intro
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
    // 3b. Small smile
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
    // 4. Wide shot / sunrise callback
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
    // 5. Fade to closing text
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

/** Intro: Escape → Stage 1. Same contract as game.js expects. */
export function createIntroCutscene(onDone) {
  const tl = new CutsceneTimeline({
    actors: makeActors(),
    onComplete: onDone,
    width: W,
    height: H,
  });
  tl.load(buildIntroCutscene({ canvasWidth: W, canvasHeight: H }));
  return tl;
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
  // Position boss for collapse beat
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

// Re-exports for tweaking / debugging
export { CutsceneTimeline, StickFigure, POSES } from "./cutsceneTimeline.js";
