/** Lightweight “game feel” helpers: trauma shake, hitstop, particles, squash. */

export function createJuiceState() {
  return {
    trauma: 0,
    hitstop: 0,
    flashAlpha: 0,
    flashColor: "#ffffff",
    time: 0,
  };
}

export function addTrauma(juice, amount) {
  juice.trauma = Math.min(1, juice.trauma + amount);
}

export function hitStop(juice, seconds = 0.06) {
  juice.hitstop = Math.max(juice.hitstop, seconds);
}

export function impactFlash(juice, color = "rgba(255,255,255,0.35)", alpha = 0.35) {
  juice.flashColor = color;
  juice.flashAlpha = alpha;
}

export function decayJuice(juice, dt) {
  juice.time += dt;
  juice.trauma = Math.max(0, juice.trauma - dt * 1.6);
  if (juice.hitstop > 0) juice.hitstop = Math.max(0, juice.hitstop - dt);
  if (juice.flashAlpha > 0) juice.flashAlpha = Math.max(0, juice.flashAlpha - dt * 4.5);
}

export function shakeOffset(juice) {
  const mag = juice.trauma * juice.trauma * 18;
  if (mag <= 0.05) return { x: 0, y: 0 };
  return {
    x: (Math.random() - 0.5) * mag * 2,
    y: (Math.random() - 0.5) * mag * 2,
  };
}

export function lerpSquash(entity, dt, rate = 10) {
  entity.sx += (1 - (entity.sx ?? 1)) * Math.min(1, rate * dt);
  entity.sy += (1 - (entity.sy ?? 1)) * Math.min(1, rate * dt);
}

export function setSquash(entity, sx, sy) {
  entity.sx = sx;
  entity.sy = sy;
}

export function spawnBurst(particles, x, y, opts = {}) {
  const {
    count = 12,
    speed = 180,
    color = "#ffffff",
    colors = null,
    life = 0.45,
    size = 2.2,
    gravity = 40,
    drag = 0.4,
    spread = Math.PI * 2,
    angle = -Math.PI / 2,
    glow = false,
    shape = "circle",
  } = opts;

  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const s = speed * (0.35 + Math.random() * 0.75);
    const c = colors ? colors[(Math.random() * colors.length) | 0] : color;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.55 + Math.random() * 0.6),
      max: life,
      color: c,
      size: size * (0.6 + Math.random() * 0.9),
      gravity,
      drag,
      glow,
      shape,
    });
  }
}

export function spawnSparks(particles, x, y, count = 10) {
  spawnBurst(particles, x, y, {
    count,
    speed: 280,
    colors: ["#ffffff", "#ffe08a", "#ff8a40", "#7ec8ff"],
    life: 0.28,
    size: 1.8,
    gravity: 90,
    drag: 1.2,
    glow: true,
  });
}

export function spawnSmoke(particles, x, y, count = 8) {
  spawnBurst(particles, x, y, {
    count,
    speed: 60,
    colors: ["rgba(160,170,180,0.55)", "rgba(90,100,110,0.4)", "rgba(200,210,220,0.35)"],
    life: 0.7,
    size: 5,
    gravity: -20,
    drag: 0.8,
    spread: Math.PI,
    angle: -Math.PI / 2,
  });
}

export function spawnMuzzle(particles, x, y) {
  spawnBurst(particles, x, y, {
    count: 6,
    speed: 140,
    colors: ["#ffffff", "#9ef7ff", "#7ec8ff"],
    life: 0.12,
    size: 2.5,
    gravity: 0,
    drag: 2,
    spread: 0.8,
    angle: -Math.PI / 2,
    glow: true,
  });
}

export function updateParticles(particles, dt) {
  for (const p of particles) {
    p.vx *= Math.max(0, 1 - (p.drag || 0) * dt);
    p.vy *= Math.max(0, 1 - (p.drag || 0) * dt);
    p.vy += (p.gravity ?? 20) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.grow) p.size += p.grow * dt;
  }
  let write = 0;
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].life > 0) particles[write++] = particles[i];
  }
  particles.length = write;
}

export function drawParticles(ctx, particles) {
  for (const p of particles) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    ctx.globalAlpha = a;
    if (p.glow) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.fillStyle = p.color;
    if (p.shape === "square") {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/** Soft radial glow (player light / bloom accents). */
export function drawGlow(ctx, x, y, radius, color, alpha = 0.35) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Vignette + mild color grade + optional white impact flash. */
export function drawPostFx(ctx, w, h, juice) {
  // vignette / dark corners
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.78);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.65, "rgba(0,0,0,0.08)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // cool color grade wash
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(40, 90, 120, 0.18)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  // subtle bloom veil from trauma
  if (juice.trauma > 0.05) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 180, 120, ${0.04 + juice.trauma * 0.08})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  // impact screen flash
  if (juice.flashAlpha > 0) {
    ctx.globalAlpha = juice.flashAlpha;
    ctx.fillStyle = juice.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
