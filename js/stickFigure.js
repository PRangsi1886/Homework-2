/**
 * Stick-figure rig for canvas cutscenes (no external libs).
 *
 * Pose format (angles in radians, relative to parent bone):
 *   {
 *     rootX, rootY,   // hip / pelvis world position
 *     facing,         // 1 = facing right, -1 = facing left
 *     torso, head,    // torso: 0 = upright; head: relative to torso
 *     lShoulder, lElbow, rShoulder, rElbow,
 *     lHip, lKnee, rHip, rKnee,
 *     // optional extras used by cutscenes:
 *     holdPhoto,      // 0..1 — hand holds a photo prop
 *     smile,          // 0..1 — subtle head tilt / relief cue
 *   }
 *
 * Named poses live in POSES — edit angles there to retune animation.
 */

export const BONE = {
  torso: 28,
  head: 10, // radius
  upperArm: 16,
  lowerArm: 14,
  upperLeg: 18,
  lowerLeg: 16,
};

/** Default standing pose facing right. */
export const REST_POSE = {
  rootX: 0,
  rootY: 0,
  facing: 1,
  torso: 0,
  head: 0,
  lShoulder: 0.35,
  lElbow: 0.25,
  rShoulder: -0.35,
  rElbow: -0.25,
  lHip: 0.12,
  lKnee: 0.08,
  rHip: -0.12,
  rKnee: -0.08,
  holdPhoto: 0,
  smile: 0,
};

/**
 * Named poses — keys used by CutsceneTimeline steps via `pose: "idle"`.
 * Keep comments so timing/poses are easy to tweak later.
 */
export const POSES = {
  // Soft idle with a hint of breathing (timeline can bob rootY separately)
  idle: {
    ...REST_POSE,
    lShoulder: 0.4,
    rShoulder: -0.4,
    lHip: 0.1,
    rHip: -0.1,
  },

  // Mid-stride run (use with runB and time-based ping-pong)
  run: {
    ...REST_POSE,
    torso: 0.18,
    head: -0.05,
    lShoulder: -0.9,
    lElbow: 0.7,
    rShoulder: 0.85,
    rElbow: 0.55,
    lHip: -0.75,
    lKnee: 0.95,
    rHip: 0.7,
    rKnee: 0.35,
  },

  // Opposite stride for run cycle
  runB: {
    ...REST_POSE,
    torso: 0.18,
    head: -0.05,
    lShoulder: 0.85,
    lElbow: 0.55,
    rShoulder: -0.9,
    rElbow: 0.7,
    lHip: 0.7,
    lKnee: 0.35,
    rHip: -0.75,
    rKnee: 0.95,
  },

  // Stops at hatch — slight lean forward
  hatchIdle: {
    ...REST_POSE,
    torso: 0.08,
    lShoulder: 0.55,
    rShoulder: -0.2,
    rElbow: -0.5,
    lHip: 0.15,
    rHip: -0.05,
  },

  // Pulls photo from jacket (right hand raised to chest)
  holdPhoto: {
    ...REST_POSE,
    torso: 0.05,
    head: -0.15,
    rShoulder: -1.35,
    rElbow: -1.6,
    lShoulder: 0.45,
    holdPhoto: 1,
  },

  // Happier flashback pose — arm around partner cue (used with a second figure)
  together: {
    ...REST_POSE,
    torso: -0.05,
    head: 0.1,
    smile: 1,
    lShoulder: -0.2,
    rShoulder: 1.1,
    rElbow: 0.4,
    lHip: 0.08,
    rHip: -0.08,
  },

  // Clenches photo / determined — fists up, squared shoulders
  clenchFist: {
    ...REST_POSE,
    torso: -0.05,
    head: 0.05,
    lShoulder: -1.1,
    lElbow: -1.4,
    rShoulder: 1.1,
    rElbow: 1.4,
    holdPhoto: 0.4,
  },

  // Determined stance after tucking photo
  determined: {
    ...REST_POSE,
    torso: -0.08,
    head: 0.08,
    lShoulder: -0.85,
    lElbow: -1.2,
    rShoulder: 0.85,
    rElbow: 1.2,
    lHip: 0.18,
    rHip: -0.18,
  },

  // Lowers weapon / breathing after battle
  lowerWeapon: {
    ...REST_POSE,
    torso: 0.12,
    head: 0.05,
    rShoulder: 0.9,
    rElbow: 0.35,
    lShoulder: 0.25,
    smile: 0.2,
  },

  // Subtle smile / relief while holding photo
  smileRelief: {
    ...REST_POSE,
    torso: 0.04,
    head: 0.18,
    smile: 1,
    rShoulder: -1.25,
    rElbow: -1.45,
    lShoulder: 0.5,
    holdPhoto: 1,
  },

  // Boss / figure collapse crumpled on the ground
  collapse: {
    ...REST_POSE,
    rootY: 22,
    torso: 1.35,
    head: 0.6,
    lShoulder: 0.9,
    lElbow: 1.2,
    rShoulder: -0.5,
    rElbow: -0.8,
    lHip: 1.1,
    lKnee: 1.4,
    rHip: 0.4,
    rKnee: 0.9,
  },
};

/** Love-interest silhouette defaults (longer hair line). */
export const PARTNER_STYLE = {
  stroke: "#e8c4d8",
  headFill: "rgba(232, 196, 216, 0.15)",
  lineWidth: 2.4,
  hair: true,
};

export const PILOT_STYLE = {
  stroke: "#dce6ff",
  headFill: "rgba(220, 230, 255, 0.12)",
  lineWidth: 2.6,
  hair: false,
};

export const BOSS_STYLE = {
  stroke: "#ff8a6a",
  headFill: "rgba(255, 100, 80, 0.18)",
  lineWidth: 3.2,
  hair: false,
};

const POSE_KEYS = [
  "rootX",
  "rootY",
  "facing",
  "torso",
  "head",
  "lShoulder",
  "lElbow",
  "rShoulder",
  "rElbow",
  "lHip",
  "lKnee",
  "rHip",
  "rKnee",
  "holdPhoto",
  "smile",
];

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeInOutCubic(t) {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function easeOutCubic(t) {
  t = clamp01(t);
  return 1 - (1 - t) ** 3;
}

/** Resolve a pose name or pose object into a full pose. */
export function resolvePose(pose) {
  if (!pose) return { ...REST_POSE };
  if (typeof pose === "string") {
    const named = POSES[pose];
    if (!named) {
      console.warn(`[StickFigure] unknown pose "${pose}", using idle`);
      return { ...POSES.idle };
    }
    return { ...REST_POSE, ...named };
  }
  return { ...REST_POSE, ...pose };
}

/** Interpolate every numeric joint field between two poses. */
export function lerpPose(fromPose, toPose, t, ease = easeInOutCubic) {
  const a = resolvePose(fromPose);
  const b = resolvePose(toPose);
  const k = ease(clamp01(t));
  const out = {};
  for (const key of POSE_KEYS) {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    // facing snaps at midpoint so limbs don't invert mid-tween oddly
    if (key === "facing") {
      out[key] = k < 0.5 ? av : bv;
    } else {
      out[key] = lerp(av, bv, k);
    }
  }
  return out;
}

/**
 * Forward-kinematics: pose angles → world joint positions.
 * Hip is root; torso goes "up"; arms from shoulders; legs from hips.
 */
export function solveSkeleton(pose) {
  const p = resolvePose(pose);
  const f = p.facing >= 0 ? 1 : -1;
  const hip = { x: p.rootX, y: p.rootY };

  // Torso tip ≈ shoulder center
  const shoulder = {
    x: hip.x + Math.sin(p.torso) * BONE.torso * f * 0.15,
    y: hip.y - Math.cos(p.torso) * BONE.torso,
  };

  const head = {
    x: shoulder.x + Math.sin(p.torso + p.head) * (BONE.head + 4) * f * 0.2,
    y: shoulder.y - Math.cos(p.torso + p.head) * (BONE.head + 6),
  };

  // Arms: 0 angle = hanging down; positive swings forward relative to facing
  const lShoulder = {
    x: shoulder.x - 7 * f,
    y: shoulder.y + 2,
  };
  const rShoulder = {
    x: shoulder.x + 7 * f,
    y: shoulder.y + 2,
  };

  const lElbow = {
    x: lShoulder.x + Math.sin(p.lShoulder) * BONE.upperArm * f,
    y: lShoulder.y + Math.cos(p.lShoulder) * BONE.upperArm,
  };
  const lHand = {
    x: lElbow.x + Math.sin(p.lShoulder + p.lElbow) * BONE.lowerArm * f,
    y: lElbow.y + Math.cos(p.lShoulder + p.lElbow) * BONE.lowerArm,
  };

  const rElbow = {
    x: rShoulder.x + Math.sin(p.rShoulder) * BONE.upperArm * f,
    y: rShoulder.y + Math.cos(p.rShoulder) * BONE.upperArm,
  };
  const rHand = {
    x: rElbow.x + Math.sin(p.rShoulder + p.rElbow) * BONE.lowerArm * f,
    y: rElbow.y + Math.cos(p.rShoulder + p.rElbow) * BONE.lowerArm,
  };

  // Legs: 0 = straight down
  const lHip = { x: hip.x - 5 * f, y: hip.y };
  const rHip = { x: hip.x + 5 * f, y: hip.y };

  const lKnee = {
    x: lHip.x + Math.sin(p.lHip) * BONE.upperLeg * f,
    y: lHip.y + Math.cos(p.lHip) * BONE.upperLeg,
  };
  const lFoot = {
    x: lKnee.x + Math.sin(p.lHip + p.lKnee) * BONE.lowerLeg * f,
    y: lKnee.y + Math.cos(p.lHip + p.lKnee) * BONE.lowerLeg,
  };

  const rKnee = {
    x: rHip.x + Math.sin(p.rHip) * BONE.upperLeg * f,
    y: rHip.y + Math.cos(p.rHip) * BONE.upperLeg,
  };
  const rFoot = {
    x: rKnee.x + Math.sin(p.rHip + p.rKnee) * BONE.lowerLeg * f,
    y: rKnee.y + Math.cos(p.rHip + p.rKnee) * BONE.lowerLeg,
  };

  return {
    hip,
    shoulder,
    head,
    lShoulder,
    lElbow,
    lHand,
    rShoulder,
    rElbow,
    rHand,
    lHip,
    lKnee,
    lFoot,
    rHip,
    rKnee,
    rFoot,
    holdPhoto: p.holdPhoto,
    smile: p.smile,
    facing: f,
  };
}

/** Draw a small photo prop (two stick silhouettes) near a hand. */
export function drawPhotoProp(ctx, x, y, scale = 1) {
  const w = 22 * scale;
  const h = 16 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#f4efe4";
  ctx.strokeStyle = "#c8b89a";
  ctx.lineWidth = 1;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  // Tiny stick couple inside the photo
  ctx.strokeStyle = "#3a4050";
  ctx.lineWidth = 1.2;
  // pilot
  ctx.beginPath();
  ctx.arc(-4 * scale, -2 * scale, 2 * scale, 0, Math.PI * 2);
  ctx.moveTo(-4 * scale, 0);
  ctx.lineTo(-4 * scale, 5 * scale);
  ctx.moveTo(-6 * scale, 2 * scale);
  ctx.lineTo(-2 * scale, 2 * scale);
  ctx.stroke();
  // partner with hair flick
  ctx.beginPath();
  ctx.arc(4 * scale, -2 * scale, 2 * scale, 0, Math.PI * 2);
  ctx.moveTo(4 * scale, 0);
  ctx.lineTo(4 * scale, 5 * scale);
  ctx.moveTo(2 * scale, 2 * scale);
  ctx.lineTo(6 * scale, 2 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5.5 * scale, -3 * scale);
  ctx.quadraticCurveTo(8 * scale, -1 * scale, 6 * scale, 1 * scale);
  ctx.stroke();
  ctx.restore();
}

export class StickFigure {
  /**
   * @param {object} [opts]
   * @param {object} [opts.style] stroke/fill options (PILOT_STYLE, etc.)
   * @param {object|string} [opts.pose] initial pose
   * @param {number} [opts.scale] draw scale
   */
  constructor(opts = {}) {
    this.style = { ...PILOT_STYLE, ...(opts.style || {}) };
    this.pose = resolvePose(opts.pose || "idle");
    this.scale = opts.scale ?? 1;
    this.visible = opts.visible !== false;
    // For run cycles: blend between run / runB
    this.runPhase = 0;
  }

  setPose(pose) {
    this.pose = resolvePose(pose);
  }

  /** Smoothly blend toward a named/object pose (mutates this.pose). */
  blendToward(pose, t, ease) {
    this.pose = lerpPose(this.pose, pose, t, ease);
  }

  /**
   * Advance a run cycle. Call each frame while running.
   * @param {number} dt
   * @param {number} [speed] cycles per second
   */
  tickRun(dt, speed = 2.4) {
    this.runPhase = (this.runPhase + dt * speed) % 1;
    const a = this.runPhase < 0.5 ? this.runPhase * 2 : (1 - this.runPhase) * 2;
    this.pose = lerpPose("run", "runB", a, (t) => t);
  }

  /** World-space skeleton for the current pose. */
  skeleton() {
    const scaled = { ...this.pose, rootX: this.pose.rootX, rootY: this.pose.rootY };
    return solveSkeleton(scaled);
  }

  draw(ctx) {
    if (!this.visible) return;
    const sk = this.skeleton();
    const { stroke, headFill, lineWidth, hair } = this.style;
    const s = this.scale;
    const ox = this.pose.rootX;
    const oy = this.pose.rootY;

    // Scale limb lengths around the hip root
    const map = (pt) => ({
      x: ox + (pt.x - ox) * s,
      y: oy + (pt.y - oy) * s,
    });

    const hip = map(sk.hip);
    const shoulder = map(sk.shoulder);
    const head = map(sk.head);
    const lShoulder = map(sk.lShoulder);
    const lElbow = map(sk.lElbow);
    const lHand = map(sk.lHand);
    const rShoulder = map(sk.rShoulder);
    const rElbow = map(sk.rElbow);
    const rHand = map(sk.rHand);
    const lHip = map(sk.lHip);
    const lKnee = map(sk.lKnee);
    const lFoot = map(sk.lFoot);
    const rHip = map(sk.rHip);
    const rKnee = map(sk.rKnee);
    const rFoot = map(sk.rFoot);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth * Math.max(0.75, s);
    ctx.fillStyle = headFill;

    const line = (a, b) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    // Legs
    line(lHip, lKnee);
    line(lKnee, lFoot);
    line(rHip, rKnee);
    line(rKnee, rFoot);

    // Torso
    line(hip, shoulder);

    // Arms
    line(lShoulder, lElbow);
    line(lElbow, lHand);
    line(rShoulder, rElbow);
    line(rElbow, rHand);

    // Head
    const headR = BONE.head * s * (0.85 + (sk.smile || 0) * 0.08);
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Partner hair silhouette
    if (hair) {
      ctx.beginPath();
      ctx.moveTo(head.x + 4 * sk.facing * s, head.y - 2 * s);
      ctx.quadraticCurveTo(
        head.x + 14 * sk.facing * s,
        head.y + 4 * s,
        head.x + 8 * sk.facing * s,
        head.y + 14 * s
      );
      ctx.stroke();
    }

    // Optional smile cue — tiny arc
    if ((sk.smile || 0) > 0.4) {
      ctx.beginPath();
      ctx.arc(head.x, head.y + 2 * s, 3.5 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    // Photo prop in the raised hand (prefer right hand)
    if ((sk.holdPhoto || 0) > 0.2) {
      drawPhotoProp(ctx, rHand.x, rHand.y - 6 * s, (0.85 + sk.holdPhoto * 0.25) * s);
    }

    ctx.restore();
  }
}
