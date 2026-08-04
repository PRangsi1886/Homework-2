import { AudioBus } from "./audio.js";
import {
  W,
  H,
  clamp,
  aabb,
  createPlayer,
  WEAPONS,
  spawnEnemy,
  spawnBoss,
  spawnPowerup,
  spawnPickupAmmo,
} from "./entities.js";

const STATES = {
  TITLE: "title",
  PLAYING: "playing",
  PAUSED: "paused",
  LEVEL_CLEAR: "levelclear",
  GAME_OVER: "gameover",
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = new AudioBus();
    this.state = STATES.TITLE;
    this.keys = new Set();
    this.mouse = { x: W / 2, y: H - 140, down: false, inCanvas: false };
    this.last = 0;
    this.accum = 0;
    this.step = 1 / 60;
    this.stars = this.makeStars(120);
    this.particles = [];
    this.shake = 0;
    this.selfDestructArmed = 0;
    this.message = null;
    this.bindUi();
    this.bindInput();
    this.resetRun();
    requestAnimationFrame((t) => this.frame(t));
  }

  bindUi() {
    this.ui = {
      hud: document.getElementById("hud"),
      title: document.getElementById("title-screen"),
      briefing: document.getElementById("briefing-screen"),
      pause: document.getElementById("pause-screen"),
      gameover: document.getElementById("gameover-screen"),
      levelclear: document.getElementById("levelclear-screen"),
      score: document.getElementById("hud-score"),
      level: document.getElementById("hud-level"),
      lives: document.getElementById("hud-lives"),
      shield: document.getElementById("bar-shield"),
      hull: document.getElementById("bar-hull"),
      ammoGun: document.getElementById("ammo-gun"),
      ammoIon: document.getElementById("ammo-ion"),
      ammoPlasma: document.getElementById("ammo-plasma"),
      finalScore: document.getElementById("final-score"),
      finalLevel: document.getElementById("final-level"),
      levelClearTitle: document.getElementById("level-clear-title"),
      levelClearSub: document.getElementById("level-clear-sub"),
    };

    document.getElementById("btn-start").addEventListener("click", () => this.startGame());
    document.getElementById("btn-restart").addEventListener("click", () => this.startGame());
    document.getElementById("btn-resume").addEventListener("click", () => this.resume());
    document.getElementById("btn-how").addEventListener("click", () => {
      this.ui.title.classList.add("hidden");
      this.ui.briefing.classList.remove("hidden");
    });
    document.getElementById("btn-brief-back").addEventListener("click", () => {
      this.ui.briefing.classList.add("hidden");
      this.ui.title.classList.remove("hidden");
    });
  }

  bindInput() {
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      if (e.code === "Digit1") this.setWeapon("gun");
      if (e.code === "Digit2") this.setWeapon("ion");
      if (e.code === "Digit3") this.setWeapon("plasma");
      if (e.code === "KeyP" || e.code === "Escape") this.togglePause();
      if (e.code === "Digit0" || e.code === "Enter" || e.code === "Numpad0") {
        this.armSelfDestruct();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    const toLocal = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * W,
        y: ((e.clientY - rect.top) / rect.height) * H,
      };
    };

    this.canvas.addEventListener("pointermove", (e) => {
      const p = toLocal(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.inCanvas = true;
    });
    this.canvas.addEventListener("pointerdown", (e) => {
      this.audio.unlock();
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) {
        e.preventDefault();
        this.armSelfDestruct();
      }
    });
    window.addEventListener("pointerup", (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener("pointerleave", () => {
      this.mouse.inCanvas = false;
    });
  }

  makeStars(n) {
    const stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.35 + Math.random() * 1.4,
        s: 0.6 + Math.random() * 1.8,
      });
    }
    return stars;
  }

  resetRun() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.player = createPlayer();
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.spawnQueue = [];
    this.boss = null;
    this.levelKills = 0;
    this.levelGoal = 0;
    this.levelPhase = "waves";
    this.clearTimer = 0;
    this.combo = 0;
  }

  startGame() {
    this.audio.unlock();
    this.audio.launch();
    this.resetRun();
    this.buildLevel();
    this.state = STATES.PLAYING;
    this.showScreen("playing");
    this.flashMessage("FIGHTER DEPLOYED", 1.4);
  }

  showScreen(mode) {
    const { hud, title, briefing, pause, gameover, levelclear } = this.ui;
    title.classList.add("hidden");
    briefing.classList.add("hidden");
    pause.classList.add("hidden");
    gameover.classList.add("hidden");
    levelclear.classList.add("hidden");
    hud.classList.add("hidden");

    if (mode === "playing") hud.classList.remove("hidden");
    if (mode === "title") title.classList.remove("hidden");
    if (mode === "pause") {
      hud.classList.remove("hidden");
      pause.classList.remove("hidden");
    }
    if (mode === "gameover") {
      this.ui.finalScore.textContent = String(this.score);
      this.ui.finalLevel.textContent = String(this.level);
      gameover.classList.remove("hidden");
    }
    if (mode === "levelclear") {
      hud.classList.remove("hidden");
      levelclear.classList.remove("hidden");
    }
  }

  togglePause() {
    if (this.state === STATES.PLAYING) {
      this.state = STATES.PAUSED;
      this.showScreen("pause");
    } else if (this.state === STATES.PAUSED) {
      this.resume();
    }
  }

  resume() {
    if (this.state !== STATES.PAUSED) return;
    this.state = STATES.PLAYING;
    this.showScreen("playing");
  }

  setWeapon(name) {
    if (!this.player?.alive) return;
    if (name !== "gun" && this.player.ammo[name] <= 0) {
      this.flashMessage("NO AMMO", 0.8);
      return;
    }
    this.player.weapon = name;
  }

  armSelfDestruct() {
    if (this.state !== STATES.PLAYING || !this.player.alive) return;
    const now = performance.now();
    if (now - this.selfDestructArmed < 700) {
      this.selfDestruct();
      this.selfDestructArmed = 0;
    } else {
      this.selfDestructArmed = now;
      this.flashMessage("SELF-DESTRUCT ARMED — PRESS AGAIN", 0.9);
    }
  }

  selfDestruct() {
    const p = this.player;
    const ejected = spawnPickupAmmo(p.x, p.y - 20, {
      ion: p.ammo.ion,
      plasma: p.ammo.plasma,
      gun: 0,
    });
    this.powerups.push(ejected);
    this.burst(p.x, p.y, "#3ef0d0", 40, 280);
    this.audio.explosion(true);
    this.shake = 14;

    let bossRef = null;
    for (const e of this.enemies) {
      if (e.type === "boss") {
        bossRef = e;
        continue;
      }
      this.killEnemy(e, true);
    }
    this.enemies = this.enemies.filter((e) => e.type === "boss" && e.hp > 0);
    this.enemyBullets = [];
    if (bossRef) {
      bossRef.hp -= 260;
      bossRef.flash = 0.25;
      if (bossRef.hp <= 0) {
        this.killEnemy(bossRef, true);
        this.defeatBoss();
      }
    }

    this.loseLife(true);
  }

  buildLevel() {
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.boss = null;
    this.waveIndex = 0;
    this.waveTimer = 1.2;
    this.spawnQueue = [];
    this.levelPhase = "waves";
    this.levelKills = 0;

    const waves = [];
    const base = 3 + this.level;
    for (let w = 0; w < 4 + Math.min(3, this.level); w++) {
      const pack = [];
      const count = base + w;
      for (let i = 0; i < count; i++) {
        let type = "scout";
        const roll = Math.random();
        if (this.level >= 2 && roll > 0.55) type = "lancer";
        if (this.level >= 3 && roll > 0.78) type = "heavy";
        if (roll > 0.88) type = "dart";
        pack.push({
          type,
          delay: i * (0.18 + Math.max(0, 0.08 - this.level * 0.01)),
          x: 60 + Math.random() * (W - 120),
        });
      }
      waves.push(pack);
    }
    this.waves = waves;
    this.levelGoal = waves.reduce((n, pack) => n + pack.length, 0);
  }

  flashMessage(text, time = 1.2) {
    this.message = { text, t: time };
  }

  frame(t) {
    const now = t * 0.001;
    let dt = Math.min(0.05, now - (this.last || now));
    this.last = now;

    if (this.state === STATES.PLAYING) {
      this.accum += dt;
      while (this.accum >= this.step) {
        this.update(this.step);
        this.accum -= this.step;
      }
    } else {
      this.accum = 0;
      this.updateDecor(dt);
    }

    this.draw();
    requestAnimationFrame((nt) => this.frame(nt));
  }

  updateDecor(dt) {
    for (const s of this.stars) {
      s.y += 40 * s.z * dt;
      if (s.y > H) {
        s.y = -4;
        s.x = Math.random() * W;
      }
    }
    this.updateParticles(dt);
    if (this.message) {
      this.message.t -= dt;
      if (this.message.t <= 0) this.message = null;
    }
  }

  update(dt) {
    this.updateDecor(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    if (this.levelPhase === "waves") this.updateWaves(dt);
    else if (this.levelPhase === "boss") this.updateBossPhase(dt);
    else if (this.levelPhase === "clear") {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.nextLevel();
    }

    this.updatePlayer(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePowerups(dt);
    this.resolveCollisions();
    this.syncHud();
  }

  updateWaves(dt) {
    this.waveTimer -= dt;
    if (this.spawnQueue.length) {
      for (const item of this.spawnQueue) item.delay -= dt;
      while (this.spawnQueue.length && this.spawnQueue[0].delay <= 0) {
        const item = this.spawnQueue.shift();
        this.enemies.push(spawnEnemy(item.type, item.x, -40, this.level));
      }
    } else if (this.waveTimer <= 0 && this.waveIndex < this.waves.length) {
      this.spawnQueue = this.waves[this.waveIndex].map((x) => ({ ...x }));
      this.waveIndex += 1;
      this.waveTimer = 2.4;
    } else if (
      this.waveIndex >= this.waves.length &&
      !this.spawnQueue.length &&
      this.enemies.length === 0
    ) {
      this.levelPhase = "boss";
      this.boss = spawnBoss(this.level);
      this.enemies.push(this.boss);
      this.flashMessage(`BOSS — SECTOR ${this.level}`, 1.6);
      this.audio.alert();
    }
  }

  updateBossPhase() {
    // handled via enemy updates / defeatBoss
  }

  nextLevel() {
    this.level += 1;
    this.ui.levelclear.classList.add("hidden");
    this.player.invuln = 1.5;
    this.player.shield = Math.min(100, this.player.shield + 25);
    this.player.ammo.ion += 12;
    this.player.ammo.plasma += 8;
    this.buildLevel();
    this.state = STATES.PLAYING;
    this.showScreen("playing");
    this.flashMessage(`SECTOR ${this.level}`, 1.3);
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) return;

    let ax = 0;
    let ay = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ax -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ax += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) ay -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) ay += 1;

    const usingKeys = ax !== 0 || ay !== 0;
    if (usingKeys) {
      const len = Math.hypot(ax, ay) || 1;
      p.vx = (ax / len) * 420;
      p.vy = (ay / len) * 420;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else if (this.mouse.inCanvas) {
      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      p.x += dx * Math.min(1, 12 * dt);
      p.y += dy * Math.min(1, 12 * dt);
      p.vx = dx;
      p.vy = dy;
    } else {
      p.vx *= 0.85;
      p.vy *= 0.85;
    }

    p.x = clamp(p.x, 28, W - 28);
    p.y = clamp(p.y, 60, H - 40);

    if (p.invuln > 0) p.invuln -= dt;
    if (p.fireCd > 0) p.fireCd -= dt;

    p.trail.push({ x: p.x, y: p.y + 18, life: 0.25 });
    if (p.trail.length > 12) p.trail.shift();
    for (const t of p.trail) t.life -= dt;

    const firing = this.mouse.down || this.keys.has("Space");
    if (firing) this.tryFire(dt);
  }

  tryFire() {
    const p = this.player;
    if (p.fireCd > 0) return;
    let weapon = p.weapon;
    if (weapon !== "gun" && p.ammo[weapon] <= 0) {
      weapon = "gun";
      p.weapon = "gun";
    }
    const def = WEAPONS[weapon];
    if (weapon !== "gun") {
      p.ammo[weapon] -= def.cost;
      if (p.ammo[weapon] < 0) p.ammo[weapon] = 0;
    }
    p.fireCd = def.rate;

    const spread = weapon === "plasma" ? 2 : weapon === "gun" ? 1 : 0;
    for (let i = -spread; i <= spread; i++) {
      if (spread && i === 0 && weapon === "plasma") continue;
      this.bullets.push({
        x: p.x + i * 10,
        y: p.y - 24,
        w: weapon === "plasma" ? 10 : 5,
        h: weapon === "plasma" ? 16 : 14,
        vy: -def.speed,
        vx: i * 40,
        damage: def.damage,
        pierce: def.pierce,
        color: def.color,
        life: 1.4,
        weapon,
      });
    }
    this.audio.shoot(weapon);
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.y > -40 && b.y < H + 40);

    for (const b of this.enemyBullets) {
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.life > 0 && b.y < H + 40 && b.y > -40);
  }

  updateEnemies(dt) {
    const survivors = [];
    for (const e of this.enemies) {
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      this.moveEnemy(e, dt);

      if (e.fireRate > 0 && e.y > 20 && e.y < H - 80) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          this.enemyShoot(e);
          e.fireCd = e.fireRate * (0.75 + Math.random() * 0.5);
        }
      }

      if (e.y - e.h / 2 > H) {
        this.enemyEscaped(e);
        continue;
      }
      if (e.hp > 0) survivors.push(e);
    }
    this.enemies = survivors;
  }

  moveEnemy(e, dt) {
    if (e.type === "boss") {
      if (!e.entered) {
        e.y += 80 * dt;
        if (e.y >= 130) {
          e.y = 130;
          e.entered = true;
        }
        return;
      }
      e.phase += dt;
      e.x = W / 2 + Math.sin(e.phase * 0.9) * (W * 0.28);
      e.y = 130 + Math.sin(e.phase * 1.7) * 18;
      return;
    }

    if (e.pattern === "drift") {
      e.y += e.speed * dt;
      e.x += Math.sin(e.age * 2 + e.phase) * 40 * dt;
    } else if (e.pattern === "sine") {
      e.y += e.speed * dt;
      e.x += Math.sin(e.age * 3 + e.phase) * 120 * dt;
    } else if (e.pattern === "tank") {
      e.y += e.speed * dt;
      e.x += Math.sin(e.age * 1.2 + e.phase) * 20 * dt;
    } else if (e.pattern === "dive") {
      e.y += e.speed * dt * (1 + e.age * 0.35);
      e.x += Math.sin(e.phase) * 30 * dt;
    }
    e.x = clamp(e.x, 30, W - 30);
  }

  enemyShoot(e) {
    const aim = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    const shots = e.type === "boss" ? 5 : e.type === "heavy" ? 3 : 1;
    for (let i = 0; i < shots; i++) {
      const a = aim + (i - (shots - 1) / 2) * 0.18;
      this.enemyBullets.push({
        x: e.x,
        y: e.y + e.h / 2,
        w: 6,
        h: 10,
        vx: Math.cos(a) * e.bulletSpeed,
        vy: Math.sin(a) * e.bulletSpeed,
        damage: e.type === "boss" ? 16 : 12,
        color: "#ff7b8a",
        life: 3,
      });
    }
  }

  enemyEscaped(e) {
    if (e.type === "boss") return;
    this.audio.alert();
    this.shake = 10;
    this.flashMessage("HOSTILE ESCAPED — FIGHTER LOST", 1.4);
    this.burst(e.x, H - 10, "#ff5a6e", 18, 160);
    this.loseLife(false);
  }

  updatePowerups(dt) {
    const kept = [];
    for (const p of this.powerups) {
      p.y += p.vy * dt;
      if (p.y - p.h / 2 > H) {
        if (p.type === "super") {
          this.lives += 1;
          this.flashMessage("EXTRA FIGHTER SECURED", 1.3);
          this.audio.powerup();
        } else if (p.passScore) {
          this.score += p.passScore;
          this.flashMessage(`+${p.passScore} LET PASS`, 0.9);
        }
        continue;
      }
      kept.push(p);
    }
    this.powerups = kept;
  }

  resolveCollisions() {
    const p = this.player;
    if (!p.alive) return;

    // player bullets vs enemies
    for (const b of this.bullets) {
      if (b.spent) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (!aabb(b, e)) continue;
        e.hp -= b.damage;
        e.flash = 0.08;
        this.burst(b.x, b.y, b.color, 4, 80);
        if (!b.pierce) b.spent = true;
        if (e.hp <= 0) this.killEnemy(e);
        if (!b.pierce) break;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.spent);
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // enemy bullets vs player
    for (const b of this.enemyBullets) {
      if (b.spent) continue;
      if (aabb(b, p)) {
        b.spent = true;
        this.damagePlayer(b.damage);
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => !b.spent);

    // ram
    for (const e of this.enemies) {
      if (aabb(p, e)) {
        const dmg = e.type === "boss" ? 28 : 18;
        this.damagePlayer(dmg);
        e.hp -= 35;
        e.flash = 0.1;
        this.burst((p.x + e.x) / 2, (p.y + e.y) / 2, "#fff2cc", 10, 140);
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // powerups
    const left = [];
    for (const up of this.powerups) {
      if (aabb(p, up)) {
        this.collectPowerup(up);
      } else left.push(up);
    }
    this.powerups = left;
  }

  killEnemy(e, fromSuicide = false) {
    if (e._dead) return;
    e._dead = true;
    e.hp = 0;
    this.burst(e.x, e.y, e.color, e.type === "boss" ? 50 : 16, e.type === "boss" ? 320 : 180);
    this.audio.explosion(e.type === "boss");
    if (!fromSuicide) {
      this.score += e.score;
      this.levelKills += 1;
      this.combo += 1;
      if (Math.random() < 0.14 + Math.min(0.1, this.combo * 0.01)) {
        const types = ["shield", "repair", "super"];
        const type = types[(Math.random() * (this.level >= 2 ? 3 : 2)) | 0];
        this.powerups.push(spawnPowerup(type, e.x, e.y));
      }
      if (Math.random() < 0.08) {
        this.powerups.push(
          spawnPickupAmmo(e.x, e.y, {
            ion: 8 + ((Math.random() * 8) | 0),
            plasma: 4 + ((Math.random() * 6) | 0),
            gun: 0,
          })
        );
      }
    }
    if (e.type === "boss" && !fromSuicide) this.defeatBoss();
  }

  defeatBoss() {
    if (this.levelPhase === "clear") return;
    this.levelPhase = "clear";
    this.clearTimer = 2.4;
    this.state = STATES.LEVEL_CLEAR;
    this.ui.levelClearTitle.textContent = `Sector ${this.level} Cleared`;
    this.ui.levelClearSub.textContent = "Ammo restocked · Next sector inbound";
    this.showScreen("levelclear");
    this.score += 1000 * this.level;
    this.burst(W / 2, 160, "#3ef0d0", 60, 360);
    this.audio.explosion(true);
    this.boss = null;
    this.enemies = this.enemies.filter((e) => e.type !== "boss");
  }

  collectPowerup(up) {
    this.audio.powerup();
    if (up.type === "ammo") {
      this.player.ammo.ion += up.ammo.ion || 0;
      this.player.ammo.plasma += up.ammo.plasma || 0;
      this.flashMessage("AMMO RECOVERED", 1);
      return;
    }
    if (up.type === "shield") {
      this.player.shield = 100;
      this.flashMessage("SHIELDS RESTORED", 1);
    } else if (up.type === "repair") {
      this.player.hull = 100;
      this.flashMessage("HULL REPAIRED", 1);
    } else if (up.type === "super") {
      this.player.shield = 100;
      this.player.invuln = 4;
      this.flashMessage("SUPER SHIELDS", 1.2);
    }
  }

  damagePlayer(amount) {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    let dmg = amount;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) p.hull -= dmg;
    p.invuln = 0.55;
    this.shake = 8;
    this.burst(p.x, p.y, "#ff5a6e", 8, 100);
    if (p.hull <= 0) this.loseLife(false);
  }

  loseLife(fromSuicide) {
    this.lives -= 1;
    this.combo = 0;
    if (this.lives <= 0) {
      this.player.alive = false;
      this.burst(this.player.x, this.player.y, "#3ef0d0", 36, 260);
      this.state = STATES.GAME_OVER;
      this.showScreen("gameover");
      this.audio.explosion(true);
      return;
    }

    // respawn fighter — strategic launch burst clears nearby enemies
    const oldAmmo = fromSuicide
      ? null
      : { ion: Math.floor(this.player.ammo.ion * 0.5), plasma: Math.floor(this.player.ammo.plasma * 0.5) };

    this.player = createPlayer();
    if (oldAmmo) {
      this.player.ammo.ion = oldAmmo.ion;
      this.player.ammo.plasma = oldAmmo.plasma;
    } else {
      // next fighter will pick up ejected ammo pod; start with reserve
      this.player.ammo.ion = 10;
      this.player.ammo.plasma = 6;
    }
    this.player.invuln = 2.2;
    this.audio.launch();
    this.flashMessage("NEW FIGHTER LAUNCHED", 1.2);

    // launch burst
    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < 260 || e.y > H * 0.45) {
        e.hp -= 80;
        e.flash = 0.2;
        if (e.hp <= 0) this.killEnemy(e, true);
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.enemyBullets = [];
    this.burst(this.player.x, this.player.y, "#f0a23a", 28, 240);
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.3 + Math.random() * 0.5,
        max: 0.8,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 20 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  syncHud() {
    const p = this.player;
    this.ui.score.textContent = String(this.score);
    this.ui.level.textContent = String(this.level);
    this.ui.lives.textContent = String(Math.max(0, this.lives));
    this.ui.shield.style.transform = `scaleX(${clamp(p.shield / 100, 0, 1)})`;
    this.ui.hull.style.transform = `scaleX(${clamp(p.hull / 100, 0, 1)})`;
    this.ui.ammoGun.textContent = "∞";
    this.ui.ammoIon.textContent = String(p.ammo.ion);
    this.ui.ammoPlasma.textContent = String(p.ammo.plasma);
    for (const el of document.querySelectorAll(".ammo")) {
      el.classList.toggle("active", el.dataset.weapon === p.weapon);
    }
  }

  draw() {
    const ctx = this.ctx;
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    ctx.fillStyle = "#02050b";
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // nebula bands
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(18, 48, 70, 0.35)");
    g.addColorStop(0.45, "rgba(8, 20, 40, 0.15)");
    g.addColorStop(1, "rgba(40, 22, 12, 0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const s of this.stars) {
      ctx.globalAlpha = 0.35 + s.z * 0.4;
      ctx.fillStyle = s.z > 1.2 ? "#c8fff4" : "#d7e4ff";
      ctx.fillRect(s.x, s.y, s.s, s.s * (1 + s.z * 0.8));
    }
    ctx.globalAlpha = 1;

    // danger line
    ctx.strokeStyle = "rgba(255, 90, 110, 0.35)";
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(20, H - 18);
    ctx.lineTo(W - 20, H - 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 90, 110, 0.55)";
    ctx.font = "600 12px Rajdhani";
    ctx.fillText("FREIGHTER LINE — DO NOT LET THEM PASS", 24, H - 28);

    if (this.state !== STATES.TITLE) {
      this.drawPowerups(ctx);
      this.drawEnemies(ctx);
      this.drawBullets(ctx);
      if (this.player.alive || this.state === STATES.GAME_OVER) this.drawPlayer(ctx);
    } else {
      this.drawTitleShip(ctx);
    }

    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.boss && this.levelPhase === "boss") {
      const ratio = clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(80, 24, W - 160, 14);
      ctx.fillStyle = "#ff5a6e";
      ctx.fillRect(80, 24, (W - 160) * ratio, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.strokeRect(80, 24, W - 160, 14);
    }

    if (this.message) {
      ctx.save();
      ctx.globalAlpha = clamp(this.message.t * 2, 0, 1);
      ctx.fillStyle = "rgba(5, 8, 15, 0.55)";
      ctx.fillRect(W * 0.15, H * 0.38, W * 0.7, 44);
      ctx.fillStyle = "#eef4ff";
      ctx.font = "700 18px Orbitron";
      ctx.textAlign = "center";
      ctx.fillText(this.message.text, W / 2, H * 0.38 + 28);
      ctx.restore();
    }

    ctx.restore();
  }

  drawTitleShip(ctx) {
    const t = performance.now() * 0.001;
    const x = W / 2 + Math.sin(t * 0.8) * 30;
    const y = H * 0.58 + Math.cos(t * 1.1) * 10;
    this.drawShip(ctx, x, y, "#3ef0d0", 1 + Math.sin(t * 4) * 0.03);
  }

  drawPlayer(ctx) {
    const p = this.player;
    for (const t of p.trail) {
      if (t.life <= 0) continue;
      ctx.globalAlpha = t.life * 0.8;
      ctx.fillStyle = "#3ef0d0";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
    if (!blink) this.drawShip(ctx, p.x, p.y, p.invuln > 1.5 ? "#fff2aa" : "#3ef0d0", 1);
  }

  drawShip(ctx, x, y, color, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(18, 18);
    ctx.lineTo(6, 12);
    ctx.lineTo(0, 20);
    ctx.lineTo(-6, 12);
    ctx.lineTo(-18, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(5,8,15,0.55)";
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, 6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f0a23a";
    ctx.fillRect(-3, 18, 6, 8);
    ctx.restore();
  }

  drawEnemies(ctx) {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.flash > 0) ctx.globalAlpha = 0.55;
      if (e.type === "boss") {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.lineTo(55, 10);
        ctx.lineTo(40, -35);
        ctx.lineTo(0, -20);
        ctx.lineTo(-40, -35);
        ctx.lineTo(-55, 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#1a0b12";
        ctx.fillRect(-18, -8, 36, 18);
        ctx.fillStyle = "#ffd0d8";
        ctx.fillRect(-10, -2, 20, 6);
      } else {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(0, 16);
        ctx.lineTo(e.w / 2, -10);
        ctx.lineTo(0, -16);
        ctx.lineTo(-e.w / 2, -10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(-6, -4, 12, 8);
      }
      // tiny hp tick
      if (e.hp < e.maxHp && e.type !== "boss") {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(-16, -e.h / 2 - 8, 32, 3);
        ctx.fillStyle = "#9ef7ff";
        ctx.fillRect(-16, -e.h / 2 - 8, 32 * (e.hp / e.maxHp), 3);
      }
      ctx.restore();
    }
  }

  drawBullets(ctx) {
    for (const b of this.bullets) {
      ctx.fillStyle = b.color;
      if (b.weapon === "ion") {
        ctx.fillRect(b.x - 2, b.y - 18, 4, 36);
      } else {
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const b of this.enemyBullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPowerups(ctx) {
    for (const p of this.powerups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = p.color;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-14, -14, 28, 28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.font = "700 9px Orbitron";
      ctx.textAlign = "center";
      ctx.fillText(p.label.slice(0, 3), 0, 3);
      ctx.restore();
    }
  }
}
