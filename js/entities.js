export const W = 720;
export const H = 960;
export const MAX_LEVEL = 4;

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function aabb(a, b) {
  return (
    a.x - a.w / 2 < b.x + b.w / 2 &&
    a.x + a.w / 2 > b.x - b.w / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2 &&
    a.y + a.h / 2 > b.y - b.h / 2
  );
}

export function createPlayer() {
  return {
    x: W / 2,
    y: H - 140,
    w: 44,
    h: 50,
    vx: 0,
    vy: 0,
    shield: 100,
    hull: 100,
    invuln: 0,
    weapon: "gun",
    ammo: { gun: Infinity, ion: 40, plasma: 24, rocket: 10 },
    fireCd: 0,
    trail: [],
    alive: true,
  };
}

export const WEAPONS = {
  gun: { rate: 0.1, speed: 780, damage: 12, pierce: false, splash: 0, color: "#9ef7ff", cost: 0 },
  ion: { rate: 0.16, speed: 980, damage: 28, pierce: true, splash: 0, color: "#6cff9a", cost: 1 },
  plasma: { rate: 0.08, speed: 640, damage: 40, pierce: false, splash: 0, color: "#ff8f5a", cost: 1 },
  rocket: {
    rate: 0.42,
    speed: 420,
    damage: 95,
    pierce: false,
    splash: 70,
    splashDamage: 55,
    homing: 220,
    color: "#ffb040",
    cost: 1,
  },
};

export const ENEMY_TYPES = {
  scout: {
    w: 36,
    h: 36,
    hp: 28,
    speed: 140,
    score: 100,
    color: "#ff6b7a",
    fireRate: 1.4,
    bulletSpeed: 260,
    pattern: "drift",
  },
  lancer: {
    w: 42,
    h: 46,
    hp: 55,
    speed: 100,
    score: 220,
    color: "#ff9f43",
    fireRate: 1.1,
    bulletSpeed: 300,
    pattern: "sine",
  },
  heavy: {
    w: 60,
    h: 54,
    hp: 140,
    speed: 70,
    score: 450,
    color: "#c56cff",
    fireRate: 0.85,
    bulletSpeed: 220,
    pattern: "tank",
  },
  dart: {
    w: 30,
    h: 32,
    hp: 18,
    speed: 220,
    score: 150,
    color: "#5ad0ff",
    fireRate: 0,
    bulletSpeed: 0,
    pattern: "dive",
  },
};

export function spawnEnemy(type, x, y, level) {
  const t = ENEMY_TYPES[type];
  const scale = 1 + (level - 1) * 0.08;
  return {
    type,
    x,
    y,
    w: t.w,
    h: t.h,
    hp: Math.round(t.hp * scale),
    maxHp: Math.round(t.hp * scale),
    speed: t.speed * (1 + (level - 1) * 0.04),
    score: t.score,
    color: t.color,
    fireRate: Math.max(0.35, t.fireRate / (1 + (level - 1) * 0.05)),
    bulletSpeed: t.bulletSpeed,
    pattern: t.pattern,
    fireCd: 0.4 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
    age: 0,
    flash: 0,
  };
}

export function spawnBoss(level) {
  const final = level >= MAX_LEVEL;
  const hp = final ? 5200 : 900 + level * 280;
  return {
    type: "boss",
    final,
    x: W / 2,
    y: -80,
    w: final ? 170 : 130,
    h: final ? 120 : 96,
    hp,
    maxHp: hp,
    speed: final ? 85 : 55,
    score: final ? 20000 : 4000 + level * 1000,
    color: final ? "#ffb020" : "#ff4d6a",
    fireRate: final ? 0.22 : 0.45,
    bulletSpeed: final ? 360 : 280,
    pattern: final ? "finalBoss" : "boss",
    fireCd: 1.2,
    phase: 0,
    age: 0,
    flash: 0,
    entered: false,
    bossPhase: 1,
    specialCd: 2.5,
    spawnCd: 3.5,
    chargeCd: 4.5,
    charging: 0,
    chargeVx: 0,
    chargeVy: 0,
  };
}

export const POWERUP_TYPES = {
  shield: { label: "SHIELD", color: "#3ef0d0", passScore: 500 },
  repair: { label: "REPAIR", color: "#f0a23a", passScore: 500 },
  super: { label: "SUPER", color: "#ff5a6e", passScore: 0, extraLife: true },
  rocket: { label: "ROCKET", color: "#ff8a40", passScore: 300, rockets: 4 },
};

export function spawnPowerup(type, x, y) {
  return {
    type,
    x,
    y,
    w: 30,
    h: 30,
    vy: 90,
    ...POWERUP_TYPES[type],
  };
}

export function spawnPickupAmmo(x, y, ammo) {
  return {
    type: "ammo",
    x,
    y,
    w: 34,
    h: 24,
    vy: 70,
    ammo: { ...ammo },
    label: "AMMO",
    color: "#9eb3d1",
  };
}
