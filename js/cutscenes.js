/**
 * Cutscene factories — Escape (intro) and Victory story beats.
 * Built on CutsceneTimeline + StickFigure (see storyBeats.js).
 */
import { createEscapeCutscene, createVictoryStoryCutscene } from './storyBeats.js';

/** Intro: Escape the freighter → Stage 1. */
export function createIntroCutscene(onDone) {
  return createEscapeCutscene(onDone);
}

/** Victory: after final boss → score / THE END. */
export function createVictoryCutscene(score, onDone) {
  return createVictoryStoryCutscene(score, onDone);
}
