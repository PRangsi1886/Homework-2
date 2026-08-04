/**
 * Stick-figure rig for canvas cutscenes.
 * Pose angles in radians; legs from "straight down", arms from "straight out".
 */

export const POSES = {
  idle: {
    headTilt: 0,
    shoulderL: 0.2,
    shoulderR: -0.2,
    elbowL: 0.3,
    elbowR: -0.3,
    hipL: 0.1,
    hipR: -0.1,
    kneeL: 0.1,
    kneeR: -0.1,
    bodyLean: 0,
  },
  run: {
    headTilt: 0.05,
    shoulderL: -0.9,
    shoulderR: 0.9,
    elbowL: -0.6,
    elbowR: 0.6,
    hipL: 0.8,
    hipR: -0.8,
    kneeL: -0.9,
    kneeR: 0.9,
    bodyLean: 0.15,
  },
  /** Opposite stride for a simple run cycle. */
  runB: {
    headTilt: 0.05,
    shoulderL: 0.9,
    shoulderR: -0.9,
    elbowL: 0.6,
    elbowR: -0.6,
    hipL: -0.8,
    hipR: 0.8,
    kneeL: 0.9,
    kneeR: -0.9,
    bodyLean: 0.15,
  },
  breathHeavy: {
    headTilt: 0.1,
    shoulderL: 0.4,
    shoulderR: -0.4,
    elbowL: 0.5,
    elbowR: -0.5,
    hipL: 0.1,
    hipR: -0.1,
    kneeL: 0.15,
    kneeR: -0.15,
    bodyLean: 0.05,
  },
  reachIntoJacket: {
    headTilt: 0.15,
    shoulderL: 0.9,
    shoulderR: -0.1,
    elbowL: 1.3,
    elbowR: -0.3,
    hipL: 0.1,
    hipR: -0.1,
    kneeL: 0.1,
    kneeR: -0.1,
    bodyLean: 0.05,
  },
  holdPhoto: {
    headTilt: 0.2,
    shoulderL: 0.7,
    shoulderR: 0.7,
    elbowL: 1.1,
    elbowR: 1.1,
    hipL: 0.1,
    hipR: -0.1,
    kneeL: 0.1,
    kneeR: -0.1,
    bodyLean: 0,
  },
  clenchFist: {
    headTilt: -0.05,
    shoulderL: 0.3,
    shoulderR: -0.3,
    elbowL: 1.2,
    elbowR: -1.2,
    hipL: 0,
    hipR: 0,
    kneeL: 0,
    kneeR: 0,
    bodyLean: -0.1,
  },
  collapse: {
    headTilt: 0.6,
    shoulderL: 1.4,
    shoulderR: -1.4,
    elbowL: 1.0,
    elbowR: -1.0,
    hipL: 0.9,
    hipR: -0.9,
    kneeL: 1.2,
    kneeR: -1.2,
    bodyLean: 0.8,
  },
  lowerWeapon: {
    headTilt: 0.1,
    shoulderL: 0.5,
    shoulderR: -0.1,
    elbowL: 0.7,
    elbowR: -0.2,
    hipL: 0.1,
    hipR: -0.1,
    kneeL: 0.1,
    kneeR: -0.1,
    bodyLean: 0.05,
  },
  smile: {
    // Subtle shift from idle — reads as relief without face detail
    headTilt: -0.15,
    shoulderL: 0.25,
    shoulderR: -0.25,
    elbowL: 0.35,
    elbowR: -0.35,
    hipL: 0.1,
    hipR: -0.1,
    kneeL: 0.1,
    kneeR: -0.1,
    bodyLean: -0.05,
  },
};

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpPose(poseA, poseB, t) {
  const out = {};
  for (const key of Object.keys(poseA)) {
    out[key] = lerp(poseA[key], poseB[key] ?? poseA[key], t);
  }
  for (const key of Object.keys(poseB)) {
    if (!(key in out)) out[key] = poseB[key];
  }
  return out;
}

export function resolvePose(pose) {
  if (!pose) return { ...POSES.idle };
  if (typeof pose === "string") return { ...(POSES[pose] || POSES.idle) };
  return { ...POSES.idle, ...pose };
}

function drawPhotoProp(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.15);
  ctx.fillStyle = "#e8dcc8";
  ctx.strokeStyle = "#8a7050";
  ctx.lineWidth = 1.2 * scale;
  ctx.fillRect(-7 * scale, -9 * scale, 14 * scale, 16 * scale);
  ctx.strokeRect(-7 * scale, -9 * scale, 14 * scale, 16 * scale);
  ctx.fillStyle = "#6a8ab0";
  ctx.beginPath();
  ctx.arc(-1 * scale, -2 * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.arc(3 * scale, -1 * scale, 2.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a6a40";
  ctx.beginPath();
  ctx.moveTo(-5 * scale, 4 * scale);
  ctx.quadraticCurveTo(0, 1 * scale, 5 * scale, 5 * scale);
  ctx.lineTo(5 * scale, 6 * scale);
  ctx.lineTo(-5 * scale, 6 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export class StickFigure {
  /**
   * @param {object} opts
   * @param {number} [opts.x] root x (hip)
   * @param {number} [opts.y] root y (hip)
   * @param {number} [opts.scale]
   * @param {string} [opts.color]
   * @param {number} [opts.limbLength]
   * @param {boolean} [opts.visible]
   * @param {boolean} [opts.showPhoto] draw photo prop at right hand
   */
  constructor({
    x = 0,
    y = 0,
    scale = 1,
    color = "#eef4ff",
    limbLength = 30,
    visible = true,
    showPhoto = false,
  } = {}) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.color = color;
    this.limbLength = limbLength;
    this.visible = visible;
    this.showPhoto = showPhoto;
    this.pose = { ...POSES.idle };
    this._runPhase = 0;
  }

  setPose(pose) {
    this.pose = typeof pose === "string" ? resolvePose(pose) : { ...pose };
  }

  /** Advance a ping-pong run cycle into this.pose. */
  tickRun(dt, speed = 2.4) {
    this._runPhase += dt * speed;
    const u = (Math.sin(this._runPhase * Math.PI) + 1) * 0.5;
    this.pose = lerpPose(POSES.run, POSES.runB, u);
  }

  draw(ctx) {
    if (!this.visible) return;
    const s = this.scale;
    const L = this.limbLength * s;
    const p = this.pose;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(p.bodyLean * 0.3);
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = 3 * s;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const torsoLen = L * 1.4;
    const shoulderX = 0;
    const shoulderY = -torsoLen;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();

    const headR = L * 0.35;
    const headX = shoulderX + Math.sin(p.headTilt) * headR;
    const headY = shoulderY - headR - Math.cos(p.headTilt) * headR * 0.35;
    ctx.beginPath();
    ctx.arc(headX, headY - headR * 0.65, headR, 0, Math.PI * 2);
    ctx.stroke();

    const rightHand = this._drawLimb(
      ctx,
      shoulderX,
      shoulderY,
      p.shoulderR,
      p.elbowR,
      L * 0.6,
      L * 0.6
    );
    this._drawLimb(ctx, shoulderX, shoulderY, p.shoulderL, p.elbowL, L * 0.6, L * 0.6);
    this._drawLimb(ctx, 0, 0, p.hipL, p.kneeL, L * 0.7, L * 0.7);
    this._drawLimb(ctx, 0, 0, p.hipR, p.kneeR, L * 0.7, L * 0.7);

    if (this.showPhoto && rightHand) {
      drawPhotoProp(ctx, rightHand.x, rightHand.y - 4 * s, s * 0.9);
    }

    ctx.restore();
  }

  _drawLimb(ctx, ox, oy, angle1, angle2, len1, len2) {
    const midX = ox + Math.sin(angle1) * len1;
    const midY = oy + Math.cos(angle1) * len1;
    const endX = midX + Math.sin(angle1 + angle2) * len2;
    const endY = midY + Math.cos(angle1 + angle2) * len2;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(midX, midY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    return { x: endX, y: endY };
  }
}

export const PILOT_COLOR = "#eef4ff";
export const LOVE_COLOR = "#ffc8a0";
export const BOSS_COLOR = "#ff6a7a";
