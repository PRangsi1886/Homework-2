/**
 * Procedural sprites inspired by Chromium B.S.U.'s pre-rendered metallic look:
 * brushed grey hulls, blue hero accent, rust + red glow on hostiles.
 */

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function noise(ctx, x, y, w, h, alpha = 0.08) {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const n = (Math.random() - 0.5) * 40;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    d[i + 3] = Math.min(255, d[i + 3] + alpha * 255 * Math.random() * 0.2);
  }
  ctx.putImageData(img, x, y);
}

function metalFill(ctx, pathFn, x0, y0, x1, y1, base = "#9aa3ad", hi = "#d7dde4", lo = "#4c555e") {
  ctx.save();
  pathFn();
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, hi);
  g.addColorStop(0.45, base);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function rustSpeckles(ctx, x, y, w, h, count = 18) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(${140 + Math.random() * 40 | 0},${70 + Math.random() * 30 | 0},${30},0.35)`;
    ctx.beginPath();
    ctx.arc(x + Math.random() * w, y + Math.random() * h, 0.8 + Math.random() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function glowArc(ctx, cx, cy, r, color, alpha = 0.85) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(0.55, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawHeroShip() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext("2d");
  // wings
  metalFill(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(32, 6);
      ctx.lineTo(54, 40);
      ctx.lineTo(46, 50);
      ctx.lineTo(32, 44);
      ctx.lineTo(18, 50);
      ctx.lineTo(10, 40);
      ctx.closePath();
    },
    10,
    6,
    54,
    52,
    "#8f98a3",
    "#cfd6de",
    "#3f4750"
  );
  // blue spine
  const spine = ctx.createLinearGradient(32, 8, 32, 48);
  spine.addColorStop(0, "#7ec8ff");
  spine.addColorStop(0.5, "#2f7fbf");
  spine.addColorStop(1, "#163a5c");
  ctx.fillStyle = spine;
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.lineTo(38, 42);
  ctx.lineTo(32, 48);
  ctx.lineTo(26, 42);
  ctx.closePath();
  ctx.fill();
  // wing cannons
  ctx.fillStyle = "#6b7380";
  ctx.fillRect(20, 22, 4, 14);
  ctx.fillRect(40, 22, 4, 14);
  // thrusters
  for (const tx of [22, 42]) {
    const tg = ctx.createLinearGradient(tx, 44, tx + 8, 58);
    tg.addColorStop(0, "#dfe5ec");
    tg.addColorStop(1, "#5a6570");
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.ellipse(tx + 4, 50, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffb040";
    ctx.beginPath();
    ctx.ellipse(tx + 4, 56, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  noise(ctx, 0, 0, 64, 64, 0.05);
  return c;
}

function drawEnemy(kind) {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext("2d");
  if (kind === "scout") {
    metalFill(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(32, 52);
        ctx.lineTo(50, 22);
        ctx.quadraticCurveTo(32, 8, 14, 22);
        ctx.closePath();
      },
      14,
      8,
      50,
      52,
      "#9a9ea6",
      "#d2d6dc",
      "#4a5058"
    );
    rustSpeckles(ctx, 18, 16, 28, 28, 14);
    glowArc(ctx, 22, 28, 7, "rgba(255,60,70,0.95)", 0.9);
    glowArc(ctx, 42, 28, 7, "rgba(255,60,70,0.95)", 0.9);
    ctx.fillStyle = "#333840";
    ctx.fillRect(29, 40, 6, 12);
  } else if (kind === "lancer") {
    metalFill(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(32, 54);
        ctx.lineTo(56, 28);
        ctx.lineTo(44, 10);
        ctx.lineTo(32, 18);
        ctx.lineTo(20, 10);
        ctx.lineTo(8, 28);
        ctx.closePath();
      },
      8,
      10,
      56,
      54,
      "#8e949c",
      "#c8ced6",
      "#3d4450"
    );
    rustSpeckles(ctx, 16, 14, 32, 30, 16);
    glowArc(ctx, 20, 24, 6, "rgba(255,120,40,0.95)");
    glowArc(ctx, 44, 24, 6, "rgba(255,120,40,0.95)");
    ctx.fillStyle = "#2b3038";
    ctx.fillRect(30, 34, 4, 16);
  } else if (kind === "heavy") {
    metalFill(
      ctx,
      () => {
        ctx.beginPath();
        ctx.ellipse(32, 32, 26, 20, 0, 0, Math.PI * 2);
      },
      6,
      12,
      58,
      52,
      "#8a9098",
      "#bcc4cc",
      "#3a414a"
    );
    rustSpeckles(ctx, 12, 16, 40, 30, 22);
    for (const x of [16, 32, 48]) {
      ctx.fillStyle = "#505860";
      ctx.beginPath();
      ctx.ellipse(x, 22, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    glowArc(ctx, 18, 34, 8, "rgba(200,80,255,0.85)");
    glowArc(ctx, 46, 34, 8, "rgba(200,80,255,0.85)");
    ctx.fillStyle = "#22272e";
    ctx.fillRect(28, 38, 8, 14);
  } else if (kind === "dart") {
    metalFill(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(32, 54);
        ctx.lineTo(44, 28);
        ctx.lineTo(32, 8);
        ctx.lineTo(20, 28);
        ctx.closePath();
      },
      20,
      8,
      44,
      54,
      "#7f909c",
      "#c5d8e4",
      "#334048"
    );
    glowArc(ctx, 32, 30, 8, "rgba(80,200,255,0.9)");
  }
  noise(ctx, 0, 0, 64, 64, 0.06);
  return c;
}

function drawBoss(final = false) {
  const w = final ? 192 : 160;
  const h = final ? 112 : 96;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const cx = w / 2;
  const cy = h / 2;

  metalFill(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx, h - 12);
      ctx.lineTo(w - 18, cy + 10);
      ctx.quadraticCurveTo(w - 8, cy - 10, w - 28, 18);
      ctx.lineTo(cx + 20, 22);
      ctx.lineTo(cx, 14);
      ctx.lineTo(cx - 20, 22);
      ctx.lineTo(28, 18);
      ctx.quadraticCurveTo(8, cy - 10, 18, cy + 10);
      ctx.closePath();
    },
    10,
    10,
    w - 10,
    h - 10,
    "#8d949d",
    "#c9d0d8",
    "#3b424c"
  );
  rustSpeckles(ctx, 20, 18, w - 40, h - 36, final ? 40 : 26);

  // weapon pods
  const pods = final
    ? [
        [cx - 58, 28],
        [cx - 38, 22],
        [cx + 38, 22],
        [cx + 58, 28],
        [cx - 70, 48],
        [cx + 70, 48],
      ]
    : [
        [cx - 48, 26],
        [cx - 30, 22],
        [cx + 30, 22],
        [cx + 48, 26],
      ];
  for (const [px, py] of pods) {
    const g = ctx.createLinearGradient(px, py - 10, px, py + 14);
    g.addColorStop(0, "#6a7280");
    g.addColorStop(1, "#2a3038");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px, py, final ? 7 : 6, final ? 11 : 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // core glow
  const coreColor = final ? "rgba(255,170,40,0.95)" : "rgba(255,70,80,0.95)";
  glowArc(ctx, cx - 16, cy, final ? 16 : 12, coreColor);
  glowArc(ctx, cx + 16, cy, final ? 16 : 12, coreColor);
  glowArc(ctx, cx, cy - 4, final ? 14 : 10, coreColor, 0.7);

  ctx.fillStyle = "#1a1f26";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, final ? 18 : 14, final ? 10 : 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = final ? "#ffe2a0" : "#ffd0d8";
  ctx.fillRect(cx - 10, cy + 4, 20, 5);

  if (final) {
    ctx.strokeStyle = "rgba(255,180,60,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 70, 36, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  noise(ctx, 0, 0, w, h, 0.05);
  return c;
}

function drawAmmo(kind) {
  const sizes = {
    gun: [12, 28],
    ion: [14, 40],
    plasma: [20, 36],
    rocket: [18, 40],
    enemy: [12, 12],
    enemyHeavy: [14, 14],
  };
  const [w, h] = sizes[kind] || [12, 24];
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  const cx = w / 2;

  if (kind === "gun") {
    const g = ctx.createLinearGradient(cx, 0, cx, h);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.2, "#ffe08a");
    g.addColorStop(0.55, "#ff8a30");
    g.addColorStop(1, "rgba(80,20,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, 6, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 1.5, 6, 3, h - 8);
  } else if (kind === "ion") {
    const g = ctx.createLinearGradient(cx, 0, cx, h);
    g.addColorStop(0, "#e8ffe8");
    g.addColorStop(0.25, "#6dff9a");
    g.addColorStop(1, "rgba(0,80,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - 2, 2, 4, h - 4);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(cx - 4, 4, 8, h - 8);
    ctx.globalAlpha = 1;
  } else if (kind === "plasma") {
    const g = ctx.createRadialGradient(cx, 10, 1, cx, 14, 12);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#7ec8ff");
    g.addColorStop(0.7, "#5a4dff");
    g.addColorStop(1, "rgba(40,0,80,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, 12, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    const t = ctx.createLinearGradient(cx, 16, cx, h);
    t.addColorStop(0, "rgba(120,100,255,0.8)");
    t.addColorStop(1, "rgba(40,0,80,0)");
    ctx.fillStyle = t;
    ctx.beginPath();
    ctx.moveTo(cx - 5, 16);
    ctx.lineTo(cx + 5, 16);
    ctx.lineTo(cx, h);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "rocket") {
    // metallic body + bright tip + exhaust
    metalFill(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(cx, 2);
        ctx.lineTo(cx + 5, 12);
        ctx.lineTo(cx + 4, 30);
        ctx.lineTo(cx - 4, 30);
        ctx.lineTo(cx - 5, 12);
        ctx.closePath();
      },
      cx - 5,
      2,
      cx + 5,
      30,
      "#9aa3ad",
      "#e0e6ec",
      "#3f4750"
    );
    ctx.fillStyle = "#ff5a40";
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.lineTo(cx + 4, 10);
    ctx.lineTo(cx - 4, 10);
    ctx.closePath();
    ctx.fill();
    const eg = ctx.createLinearGradient(cx, 28, cx, h);
    eg.addColorStop(0, "#fff2a0");
    eg.addColorStop(0.4, "#ff8a30");
    eg.addColorStop(1, "rgba(80,20,0,0)");
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.moveTo(cx - 3, 30);
    ctx.lineTo(cx + 3, 30);
    ctx.lineTo(cx, h);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "enemy" || kind === "enemyHeavy") {
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, w / 2);
    g.addColorStop(0, "#fff0f0");
    g.addColorStop(0.35, kind === "enemyHeavy" ? "#ffb040" : "#ff6a78");
    g.addColorStop(1, "rgba(60,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cx, w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function drawPowerup(kind) {
  const c = makeCanvas(32, 32);
  const ctx = c.getContext("2d");
  const colors = {
    shield: ["#3ef0d0", "#0b5a50"],
    repair: ["#f0a23a", "#6a3a08"],
    super: ["#ff5a6e", "#5a1020"],
    ammo: ["#9eb3d1", "#2a3648"],
    rocket: ["#ff8a40", "#4a1808"],
  };
  const [hi, lo] = colors[kind] || colors.ammo;
  metalFill(
    ctx,
    () => {
      ctx.beginPath();
      ctx.rect(6, 6, 20, 20);
    },
    6,
    6,
    26,
    26,
    "#7a8490",
    "#c5ced8",
    "#303840"
  );
  const g = ctx.createLinearGradient(8, 8, 24, 24);
  g.addColorStop(0, hi);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(16, 16, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hi;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(5.5, 5.5, 21, 21);
  rustSpeckles(ctx, 6, 6, 20, 20, 6);
  return c;
}

let atlas = null;

export function getSprites() {
  if (atlas) return atlas;
  atlas = {
    hero: drawHeroShip(),
    scout: drawEnemy("scout"),
    lancer: drawEnemy("lancer"),
    heavy: drawEnemy("heavy"),
    dart: drawEnemy("dart"),
    boss: drawBoss(false),
    finalBoss: drawBoss(true),
    gun: drawAmmo("gun"),
    ion: drawAmmo("ion"),
    plasma: drawAmmo("plasma"),
    rocket: drawAmmo("rocket"),
    enemyBullet: drawAmmo("enemy"),
    enemyBulletHeavy: drawAmmo("enemyHeavy"),
    powerShield: drawPowerup("shield"),
    powerRepair: drawPowerup("repair"),
    powerSuper: drawPowerup("super"),
    powerAmmo: drawPowerup("ammo"),
    powerRocket: drawPowerup("rocket"),
  };
  return atlas;
}

export function drawSprite(ctx, img, x, y, w, h, opts = {}) {
  if (!img) return;
  const sx = opts.sx ?? 1;
  const sy = opts.sy ?? 1;
  const dw = w * sx;
  const dh = h * sy;
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.flash) ctx.filter = "brightness(3.2) contrast(1.15)";
  else if (opts.flashRed) ctx.filter = "brightness(1.7) sepia(1) hue-rotate(-50deg) saturate(6)";
  ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
  if (opts.flash || opts.flashRed) {
    ctx.filter = "none";
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = opts.flashRed ? 0.4 : 0.55;
    ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
  }
  ctx.restore();
}
