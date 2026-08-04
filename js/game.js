import { AudioBus } from "./audio.js";
import { createIntroCutscene, createVictoryCutscene } from "./cutscenes.js";
import {
  W,
  H,
  clamp,
  aabb,
  createPlayer,
  WEAPONS,
  MAX_LEVEL,
  spawnEnemy,
  spawnBoss,
  spawnPowerup,
  spawnPickupAmmo,
} from "./entities.js";
import { getSprites, drawSprite } from "./sprites.js";
import { loadPickupAtlas } from "./pickups.js";
import { loadEnemyAtlas } from "./enemies.js";
import { loadPlayerAtlas } from "./playerSprites.js";
import {
  createJuiceState,
  addTrauma,
  hitStop,
  impactFlash,
  decayJuice,
  shakeOffset,
  lerpSquash,
  setSquash,
  spawnBurst,
  spawnSparks,
  spawnSmoke,
  spawnMuzzle,
  updateParticles,
  drawParticles,
  drawGlow,
  drawPostFx,
} from "./juice.js";

const STATES = {
  TITLE: "title",
  CUTSCENE: "cutscene",
  PLAYING: "playing",
  PAUSED: "paused",
  LEVEL_CLEAR: "levelclear",
  GAME_OVER: "gameover",
  VICTORY: "victory",
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
    this.juice = createJuiceState();
    this.selfDestructArmed = 0;
    this.message = null;
    this.cutscene = null;
    this.sprites = getSprites();
    this.pickupAtlas = null;
    this.enemyAtlas = null;
    this.playerAtlas = null;
    this.animTime = 0;
    this.muzzleFlashes = [];
    loadPickupAtlas().then((atlas) => {
      this.pickupAtlas = atlas;
    });
    loadEnemyAtlas().then((atlas) => {
      this.enemyAtlas = atlas;
    });
    loadPlayerAtlas().then((atlas) => {
      this.playerAtlas = atlas;
    });
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
      cutscene: document.getElementById("cutscene-screen"),
      pause: document.getElementById("pause-screen"),
      gameover: document.getElementById("gameover-screen"),
      victory: document.getElementById("victory-screen"),
      levelclear: document.getElementById("levelclear-screen"),
      score: document.getElementById("hud-score"),
      level: document.getElementById("hud-level"),
      lives: document.getElementById("hud-lives"),
      shield: document.getElementById("bar-shield"),
      hull: document.getElementById("bar-hull"),
      ammoGun: document.getElementById("ammo-gun"),
      ammoIon: document.getElementById("ammo-ion"),
      ammoPlasma: document.getElementById("ammo-plasma"),
      ammoRocket: document.getElementById("ammo-rocket"),
      finalScore: document.getElementById("final-score"),
      finalLevel: document.getElementById("final-level"),
      victoryScore: document.getElementById("victory-score"),
      levelClearTitle: document.getElementById("level-clear-title"),
      levelClearSub: document.getElementById("level-clear-sub"),
    };

    document.getElementById("btn-start").addEventListener("click", () => this.startGame());
    document.getElementById("btn-restart").addEventListener("click", () => this.startGame());
    document.getElementById("btn-victory-restart").addEventListener("click", () => this.startGame());
    document.getElementById("btn-resume").addEventListener("click", () => this.resume());
    document.getElementById("btn-skip-cutscene").addEventListener("click", () => this.skipCutscene());
    document.getElementById("btn-how").addEventListener("click", () => {
      this.ui.title.classList.add("hidden");
      this.ui.briefing.classList.remove("hidden");
    });
    document.getElementById("btn-brief-back").addEventListener("click", () => {
      this.ui.briefing.classList.add("hidden");
      this.ui.title.classList.remove("hidden");
    });

    this.ui.muteBtn = document.getElementById("btn-mute");
    this.ui.volumeSlider = document.getElementById("volume-slider");
    this.ui.volumeValue = document.getElementById("volume-value");
    this.ui.volumeControl = document.getElementById("volume-control");

    this.ui.volumeSlider.value = String(Math.round(this.audio.getVolume() * 100));
    this.syncVolumeUi();

    this.ui.muteBtn.addEventListener("click", () => {
      this.audio.unlock();
      this.audio.toggleMute();
      this.audio.setMusic(this.currentMusicMode());
      this.syncVolumeUi();
    });
    const onVolumeInput = () => {
      this.audio.unlock();
      this.audio.setVolume(Number(this.ui.volumeSlider.value) / 100);
      this.audio.setMusic(this.currentMusicMode());
      this.syncVolumeUi();
    };
    // First interaction can start title music
    const bootMusic = () => {
      this.audio.unlock();
      this.audio.setMusic(this.currentMusicMode());
    };
    window.addEventListener("pointerdown", bootMusic, { once: true });
    window.addEventListener("keydown", bootMusic, { once: true });
    this.ui.volumeSlider.addEventListener("input", onVolumeInput);
    this.ui.volumeSlider.addEventListener("change", onVolumeInput);
    // Keep slider drags from steering the fighter
    for (const ev of ["pointerdown", "pointerup", "click", "mousedown", "mouseup", "touchstart"]) {
      this.ui.volumeControl.addEventListener(ev, (e) => e.stopPropagation());
    }
  }

  syncVolumeUi() {
    const pct = Math.round(this.audio.getVolume() * 100);
    const muted = this.audio.muted;
    this.ui.volumeSlider.value = String(pct);
    this.ui.volumeValue.textContent = muted ? "OFF" : String(pct);
    this.ui.muteBtn.classList.toggle("is-muted", muted || pct === 0);
    this.ui.muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    this.ui.muteBtn.textContent = muted || pct === 0 ? "MUTE" : "VOL";
    this.ui.muteBtn.title = muted ? "Unmute" : "Mute";
  }

  bindInput() {
    window.addEventListener("keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      if (this.state === STATES.CUTSCENE && (e.code === "Space" || e.code === "Enter" || e.code === "Escape")) {
        e.preventDefault();
        this.skipCutscene();
        return;
      }
      if (e.code === "Digit1") this.setWeapon("gun");
      if (e.code === "Digit2") this.setWeapon("ion");
      if (e.code === "Digit3") this.setWeapon("plasma");
      if (e.code === "Digit4") this.setWeapon("rocket");
      if (e.code === "KeyM") {
        this.audio.unlock();
        this.audio.toggleMute();
        this.syncVolumeUi();
      }
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
      if (this.state === STATES.CUTSCENE) {
        this.skipCutscene();
        return;
      }
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

  currentMusicMode() {
    if (this.state === STATES.VICTORY) return "victory";
    if (this.state === STATES.CUTSCENE) return "cutscene";
    if (this.state === STATES.PLAYING || this.state === STATES.LEVEL_CLEAR || this.state === STATES.PAUSED) {
      if (this.levelPhase === "boss" || this.levelPhase === "victory") return "boss";
      return "combat";
    }
    return "title";
  }

  syncMusic() {
    this.audio.setMusic(this.currentMusicMode());
  }

  startGame() {
    this.audio.unlock();
    this.audio.launch();
    this.resetRun();
    this.beginIntroCutscene();
  }

  beginIntroCutscene() {
    // Hook: before Stage 1 — Escape stick-figure beat sheet (storyBeats.js).
    this.cutscene = createIntroCutscene(() => this.beginGameplay());
    this.cutsceneStartedAt = performance.now();
    this.state = STATES.CUTSCENE;
    this.showScreen("cutscene");
    this.syncMusic();
  }

  beginVictoryCutscene() {
    // Hook: after final boss — Victory stick-figure beat sheet (storyBeats.js).
    this.cutscene = createVictoryCutscene(this.score, () => this.showVictory());
    this.cutsceneStartedAt = performance.now();
    this.state = STATES.CUTSCENE;
    this.showScreen("cutscene");
    this.audio.setMusic("victory");
  }

  beginGameplay() {
    this.cutscene = null;
    this.buildLevel();
    this.state = STATES.PLAYING;
    this.showScreen("playing");
    this.flashMessage("FIGHTER DEPLOYED", 1.4);
    this.audio.launch();
    this.syncMusic();
  }

  showVictory() {
    this.cutscene = null;
    this.state = STATES.VICTORY;
    this.ui.victoryScore.textContent = String(this.score);
    this.showScreen("victory");
    this.audio.setMusic("victory");
  }

  skipCutscene() {
    if (this.state !== STATES.CUTSCENE || !this.cutscene) return;
    // Ignore the same click that pressed Launch Sortie
    if (performance.now() - (this.cutsceneStartedAt || 0) < 450) return;
    this.cutscene.skip();
  }

  showScreen(mode) {
    const { hud, title, briefing, cutscene, pause, gameover, victory, levelclear } = this.ui;
    title.classList.add("hidden");
    briefing.classList.add("hidden");
    cutscene.classList.add("hidden");
    pause.classList.add("hidden");
    gameover.classList.add("hidden");
    victory.classList.add("hidden");
    levelclear.classList.add("hidden");
    hud.classList.add("hidden");

    if (mode === "playing") hud.classList.remove("hidden");
    if (mode === "title") title.classList.remove("hidden");
    if (mode === "cutscene") cutscene.classList.remove("hidden");
    if (mode === "pause") {
      hud.classList.remove("hidden");
      pause.classList.remove("hidden");
    }
    if (mode === "gameover") {
      this.ui.finalScore.textContent = String(this.score);
      this.ui.finalLevel.textContent = String(this.level);
      gameover.classList.remove("hidden");
    }
    if (mode === "victory") victory.classList.remove("hidden");
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
      rocket: p.ammo.rocket,
      gun: 0,
    });
    this.powerups.push(ejected);
    this.burst(p.x, p.y, "#3ef0d0", 40, 280);
    this.audio.explosion(true);
    this.shake = 14;
    addTrauma(this.juice, 0.4);
    hitStop(this.juice, 0.07);
    impactFlash(this.juice, "rgba(120,255,230,0.16)", 0.16, 0.7);
    spawnSparks(this.particles, p.x, p.y, 24);
    spawnSmoke(this.particles, p.x, p.y, 14);

    let bossRef = null;
    let bossDestroyed = false;
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
        bossDestroyed = true;
      }
    }

    this.loseLife(true);
    if (bossDestroyed && this.state !== STATES.GAME_OVER) this.defeatBoss();
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
    const isFinal = this.level >= MAX_LEVEL;
    const waveCount = isFinal ? 9 : 5 + Math.min(3, this.level);
    const base = 4 + this.level + (isFinal ? 3 : 0);
    for (let w = 0; w < waveCount; w++) {
      const pack = [];
      const count = base + w;
      for (let i = 0; i < count; i++) {
        let type = "scout";
        const roll = Math.random();
        if (this.level >= 2 && roll > 0.5) type = "lancer";
        if (this.level >= 3 && roll > 0.7) type = "heavy";
        if (isFinal && roll > 0.55) type = "heavy";
        if (roll > 0.84 || (isFinal && roll > 0.78)) type = "dart";
        pack.push({
          type,
          delay: i * (0.12 + Math.max(0, 0.06 - this.level * 0.01)),
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
    this.animTime += dt;
    if (this.muzzleFlashes.length) {
      for (const m of this.muzzleFlashes) m.t -= dt;
      this.muzzleFlashes = this.muzzleFlashes.filter((m) => m.t > 0);
    }

    // Freeze-frame: keep rendering juice/flash, pause simulation
    if (this.juice.hitstop > 0 && (this.state === STATES.PLAYING || this.state === STATES.LEVEL_CLEAR)) {
      decayJuice(this.juice, dt);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
      this.draw();
      requestAnimationFrame((nt) => this.frame(nt));
      return;
    }

    if (this.state === STATES.PLAYING || this.state === STATES.LEVEL_CLEAR) {
      this.accum += dt;
      while (this.accum >= this.step) {
        this.update(this.step);
        this.accum -= this.step;
      }
    } else if (this.state === STATES.CUTSCENE && this.cutscene) {
      this.accum = 0;
      this.cutscene.update(dt);
      decayJuice(this.juice, dt);
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
    updateParticles(this.particles, dt);
    decayJuice(this.juice, dt);
    if (this.message) {
      this.message.t -= dt;
      if (this.message.t <= 0) this.message = null;
    }
  }

  update(dt) {
    this.updateDecor(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    if (this.player) {
      lerpSquash(this.player, dt, 12);
      if (this.player.hitFlash > 0) this.player.hitFlash -= dt;
    }
    for (const e of this.enemies) {
      if (e.type === "boss") {
        e.sx = 1;
        e.sy = 1;
      } else {
        lerpSquash(e, dt, 10);
      }
    }

    if (this.levelPhase === "waves") this.updateWaves(dt);
    else if (this.levelPhase === "boss") this.updateBossPhase(dt);
    else if (this.levelPhase === "clear" || this.levelPhase === "victory") {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        if (this.levelPhase === "victory") this.beginVictoryCutscene();
        else this.nextLevel();
      }
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
      this.waveTimer = 1.55;
    } else if (
      this.waveIndex >= this.waves.length &&
      !this.spawnQueue.length &&
      this.enemies.length === 0
    ) {
      this.levelPhase = "boss";
      this.boss = spawnBoss(this.level);
      this.enemies.push(this.boss);
      const label =
        this.level >= MAX_LEVEL ? "FINAL BOSS — BLOCKADE COMMANDER" : `BOSS — SECTOR ${this.level}`;
      this.flashMessage(label, 1.8);
      this.audio.alert();
      this.audio.setMusic("boss");
    }
  }

  updateBossPhase() {
    // handled via enemy updates / defeatBoss
  }

  nextLevel() {
    if (this.level >= MAX_LEVEL) {
      this.beginVictoryCutscene();
      return;
    }
    this.level += 1;
    this.ui.levelclear.classList.add("hidden");
    this.player.invuln = 1.5;
    this.player.shield = Math.min(100, this.player.shield + 25);
    this.player.ammo.ion += 12;
    this.player.ammo.plasma += 8;
    this.player.ammo.rocket += 4;
    this.buildLevel();
    this.state = STATES.PLAYING;
    this.showScreen("playing");
    this.flashMessage(this.level >= MAX_LEVEL ? "FINAL SECTOR" : `SECTOR ${this.level}`, 1.3);
    this.audio.setMusic("combat");
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

    // engine dust / thruster particles
    if (Math.random() < 0.55) {
      spawnBurst(this.particles, p.x + (Math.random() - 0.5) * 10, p.y + 22, {
        count: 1,
        speed: 50,
        colors: ["#ffb040", "#ff6a30", "#ffe08a", "#ffffff"],
        life: 0.18,
        size: 1.8,
        gravity: 60,
        drag: 1,
        glow: true,
        spread: 0.5,
        angle: Math.PI / 2,
        sprite: "thrust",
      });
    }

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

    setSquash(p, 0.82, 1.22);
    spawnMuzzle(this.particles, p.x, p.y - 26);
    this.muzzleFlashes.push({ x: p.x, y: p.y - 26, t: 0.12, weapon });

    if (weapon === "rocket") {
      this.bullets.push({
        x: p.x,
        y: p.y - 28,
        w: 14,
        h: 28,
        vy: -def.speed,
        vx: 0,
        damage: def.damage,
        pierce: false,
        splash: def.splash,
        splashDamage: def.splashDamage,
        homing: def.homing,
        color: def.color,
        life: 2.2,
        weapon,
      });
      this.audio.shoot("rocket");
      addTrauma(this.juice, 0.08);
      return;
    }

    const spread = weapon === "plasma" ? 2 : weapon === "gun" ? 1 : 0;
    for (let i = -spread; i <= spread; i++) {
      if (spread && i === 0 && weapon === "plasma") continue;
      this.bullets.push({
        x: p.x + i * 10,
        y: p.y - 24,
        w: weapon === "plasma" ? 12 : weapon === "ion" ? 8 : 6,
        h: weapon === "plasma" ? 22 : weapon === "ion" ? 28 : 16,
        vy: -def.speed,
        vx: i * 40,
        damage: def.damage,
        pierce: def.pierce,
        splash: 0,
        color: def.color,
        life: 1.4,
        weapon,
      });
    }
    this.audio.shoot(weapon);
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      if (b.homing && b.weapon === "rocket") {
        let best = null;
        let bestD = Infinity;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < bestD && e.y < b.y + 40) {
            bestD = d;
            best = e;
          }
        }
        if (best) {
          const ang = Math.atan2(best.y - b.y, best.x - b.x);
          const speed = Math.hypot(b.vx || 0, b.vy);
          const tx = Math.cos(ang) * speed;
          const ty = Math.sin(ang) * speed;
          b.vx = (b.vx || 0) + (tx - (b.vx || 0)) * Math.min(1, b.homing * dt * 0.01);
          b.vy = b.vy + (ty - b.vy) * Math.min(1, b.homing * dt * 0.01);
        }
      }
      b.x += (b.vx || 0) * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.weapon === "rocket" && Math.random() < 0.7) {
        spawnBurst(this.particles, b.x, b.y + 12, {
          count: 1,
          speed: 30,
          colors: ["#ffb040", "#ff6a30", "#fff2a0"],
          life: 0.2,
          size: 2.2,
          gravity: -10,
          drag: 1,
          glow: true,
          spread: 0.6,
          angle: Math.PI / 2,
        });
      } else if (b.weapon !== "rocket" && Math.random() < 0.35) {
        spawnBurst(this.particles, b.x, b.y + 8, {
          count: 1,
          speed: 20,
          color: b.color,
          life: 0.12,
          size: 1.4,
          gravity: 0,
          drag: 2,
          glow: true,
          spread: 0.4,
          angle: Math.PI / 2,
        });
      }
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
    this.pendingSpawns = [];
    for (const e of this.enemies) {
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      this.moveEnemy(e, dt);

      if (e.type === "boss" && e.final && e.entered) {
        this.updateFinalBoss(e, dt);
      }

      if (e.fireRate > 0 && e.y > 20 && e.y < H - 80 && e.charging <= 0) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          this.enemyShoot(e);
          const haste = e.final ? Math.max(0.55, 1.1 - e.bossPhase * 0.18) : 1;
          e.fireCd = e.fireRate * (0.7 + Math.random() * 0.45) * haste;
        }
      }

      if (e.y - e.h / 2 > H) {
        this.enemyEscaped(e);
        continue;
      }
      if (e.hp > 0) survivors.push(e);
    }
    this.enemies = survivors.concat(this.pendingSpawns);
    this.pendingSpawns = [];
  }

  updateFinalBoss(e, dt) {
    const ratio = e.hp / e.maxHp;
    e.bossPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    e.specialCd -= dt;
    e.spawnCd -= dt;
    e.chargeCd -= dt;

    if (e.specialCd <= 0) {
      this.finalBossRing(e, e.bossPhase >= 3 ? 18 : 12);
      e.specialCd = e.bossPhase === 1 ? 3.2 : e.bossPhase === 2 ? 2.4 : 1.7;
    }

    if (e.spawnCd <= 0 && e.bossPhase >= 2) {
      const n = e.bossPhase === 3 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const type = Math.random() > 0.5 ? "dart" : "scout";
        this.pendingSpawns.push(
          spawnEnemy(type, e.x + (i - (n - 1) / 2) * 40, e.y + 30, this.level)
        );
      }
      this.flashMessage("COMMANDER DEPLOYS ESCORTS", 1);
      e.spawnCd = e.bossPhase === 3 ? 4.5 : 6;
      this.audio.alert();
    }

    if (e.chargeCd <= 0 && e.bossPhase >= 2 && e.charging <= 0) {
      const ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      e.charging = 0.85;
      e.chargeVx = Math.cos(ang) * 420;
      e.chargeVy = Math.sin(ang) * 420;
      e.chargeCd = e.bossPhase === 3 ? 3.2 : 4.8;
      this.flashMessage("INCOMING CHARGE", 0.8);
    }
  }

  finalBossRing(e, count) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + e.phase;
      this.enemyBullets.push({
        x: e.x,
        y: e.y,
        w: 8,
        h: 8,
        vx: Math.cos(a) * (220 + e.bossPhase * 30),
        vy: Math.sin(a) * (220 + e.bossPhase * 30),
        damage: 16,
        color: "#ffb020",
        life: 3.5,
        heavy: true,
      });
    }
  }

  moveEnemy(e, dt) {
    if (e.type === "boss") {
      const holdY = e.final ? 150 : 130;
      if (!e.entered) {
        e.y += 80 * dt;
        if (e.y >= holdY) {
          e.y = holdY;
          e.entered = true;
        }
        return;
      }
      e.phase += dt;

      if (e.final && e.charging > 0) {
        e.charging -= dt;
        e.x += e.chargeVx * dt;
        e.y += e.chargeVy * dt;
        e.x = clamp(e.x, 50, W - 50);
        e.y = clamp(e.y, 80, H * 0.55);
        if (e.charging <= 0) {
          e.chargeVx = 0;
          e.chargeVy = 0;
        }
        return;
      }

      // Lerp toward patrol path so charge recovery doesn't teleport/warp
      let targetX;
      let targetY;
      if (e.final) {
        const amp = e.bossPhase === 3 ? 0.4 : 0.34;
        const speed = e.bossPhase === 3 ? 1.45 : 1.15;
        targetX = W / 2 + Math.sin(e.phase * speed) * (W * amp);
        targetY = holdY + Math.sin(e.phase * 2.1) * (e.bossPhase === 3 ? 40 : 28);
      } else {
        targetX = W / 2 + Math.sin(e.phase * 0.9) * (W * 0.28);
        targetY = holdY + Math.sin(e.phase * 1.7) * 18;
      }
      const follow = Math.min(1, 3.2 * dt);
      e.x += (targetX - e.x) * follow;
      e.y += (targetY - e.y) * follow;
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
    const black = e.polarity === "black" || e.final;
    const bulletColor = black ? "#1a1e26" : "#f2f5ff";
    if (e.final) {
      const phase = e.bossPhase || 1;
      const shots = 5 + phase * 2;
      const spread = 0.14 + phase * 0.03;
      for (let i = 0; i < shots; i++) {
        const a = aim + (i - (shots - 1) / 2) * spread;
        const dark = i % 2 === 0;
        this.enemyBullets.push({
          x: e.x,
          y: e.y + e.h / 2,
          w: 8,
          h: 8,
          vx: Math.cos(a) * e.bulletSpeed,
          vy: Math.sin(a) * e.bulletSpeed,
          damage: 18,
          color: dark ? "#1a1e26" : "#f2f5ff",
          life: 3.2,
          heavy: dark,
        });
      }
      if (phase >= 2) {
        for (let i = 0; i < 8; i++) {
          const a = e.phase * 2.5 + (Math.PI * 2 * i) / 8;
          this.enemyBullets.push({
            x: e.x,
            y: e.y,
            w: 7,
            h: 7,
            vx: Math.cos(a) * 240,
            vy: Math.sin(a) * 240,
            damage: 14,
            color: i % 2 ? "#f2f5ff" : "#1a1e26",
            life: 3,
            heavy: i % 2 === 0,
          });
        }
      }
      if (phase >= 3 && Math.random() < 0.6) {
        for (let i = -3; i <= 3; i++) {
          this.enemyBullets.push({
            x: e.x + i * 22,
            y: e.y + e.h / 2,
            w: 7,
            h: 12,
            vx: i * 18,
            vy: e.bulletSpeed * 0.95,
            damage: 16,
            color: bulletColor,
            life: 3,
            heavy: black,
          });
        }
      }
      return;
    }

    const shots = e.type === "boss" ? 5 : e.type === "heavy" ? 3 : 1;
    const spread = 0.18;
    for (let i = 0; i < shots; i++) {
      const a = aim + (i - (shots - 1) / 2) * spread;
      this.enemyBullets.push({
        x: e.x,
        y: e.y + e.h / 2,
        w: 7,
        h: 7,
        vx: Math.cos(a) * e.bulletSpeed,
        vy: Math.sin(a) * e.bulletSpeed,
        damage: e.type === "boss" ? 16 : 12,
        color: bulletColor,
        life: 3,
        heavy: black || e.type === "heavy" || e.type === "boss",
      });
    }
  }

  enemyEscaped(e) {
    if (e.type === "boss") return;
    this.burst(e.x, H - 10, "#ff5a6e", 10, 120);
    // Enemies that slip past simply leave — no fighter penalty
  }

  updatePowerups(dt) {
    const kept = [];
    for (const p of this.powerups) {
      p.y += p.vy * dt;
      p.bob = (p.bob || 0) + dt * 4;
      if (p.y - p.h / 2 > H) {
          if (p.type === "super") {
            this.lives += 1;
            this.flashMessage("EXTRA FIGHTER SECURED", 1.3);
            this.audio.pickup("super");
          } else if (p.passScore) {
            this.score += p.passScore;
            this.flashMessage(`+${p.passScore} LET PASS`, 0.9);
            this.audio.pickup("generic");
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
        e.flash = b.weapon === "rocket" ? 0.1 : 0.05;
        setSquash(e, 1.25, 0.75);
        spawnSparks(this.particles, b.x, b.y, b.weapon === "rocket" ? 16 : 7);
        if (b.weapon === "rocket") {
          spawnSmoke(this.particles, b.x, b.y, 10);
          addTrauma(this.juice, 0.3);
          hitStop(this.juice, 0.06);
          impactFlash(this.juice, "rgba(255,180,80,0.16)", 0.16, 0.55);
        } else {
          addTrauma(this.juice, 0.04);
          if (!b.pierce || Math.random() < 0.3) this.audio.hit();
        }
        this.burst(b.x, b.y, b.color, b.weapon === "rocket" ? 18 : 5, b.weapon === "rocket" ? 220 : 100);
        if (b.splash) this.applySplash(b, e);
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
        e.flash = 0.12;
        setSquash(e, 1.3, 0.7);
        setSquash(p, 1.2, 0.8);
        spawnSparks(this.particles, (p.x + e.x) / 2, (p.y + e.y) / 2, 14);
        addTrauma(this.juice, 0.18);
        hitStop(this.juice, 0.04);
        this.burst((p.x + e.x) / 2, (p.y + e.y) / 2, "#fff2cc", 12, 160);
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

  applySplash(b, primary) {
    const r = b.splash;
    for (const e of this.enemies) {
      if (e === primary || e.hp <= 0) continue;
      const d = Math.hypot(e.x - b.x, e.y - b.y);
      if (d <= r) {
        const falloff = 1 - d / r;
        e.hp -= (b.splashDamage || b.damage * 0.5) * falloff;
        e.flash = 0.1;
        setSquash(e, 1.2, 0.8);
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
    this.shake = Math.max(this.shake, 6);
    spawnSparks(this.particles, b.x, b.y, 10);
    this.audio.explosion(false);
  }

  killEnemy(e, fromSuicide = false) {
    if (e._dead) return;
    e._dead = true;
    e.hp = 0;
    const big = e.type === "boss";
    this.burst(e.x, e.y, e.color, big ? 50 : 16, big ? 320 : 180);
    spawnSparks(this.particles, e.x, e.y, big ? 28 : 12);
    spawnSmoke(this.particles, e.x, e.y, big ? 18 : 8);
    addTrauma(this.juice, big ? 0.45 : 0.12);
    if (big) {
      hitStop(this.juice, 0.09);
      impactFlash(this.juice, "rgba(255,220,160,0.18)", 0.18, 0.8);
    } else {
      hitStop(this.juice, 0.03);
    }
    this.audio.explosion(big);
    if (!fromSuicide) {
      this.score += e.score;
      this.levelKills += 1;
      this.combo += 1;
      if (Math.random() < 0.14 + Math.min(0.1, this.combo * 0.01)) {
        const types = ["shield", "repair", "super", "rocket"];
        const max = this.level >= 2 ? 4 : 3;
        const type = types[(Math.random() * max) | 0];
        this.powerups.push(spawnPowerup(type, e.x, e.y));
      }
      if (Math.random() < 0.08) {
        this.powerups.push(
          spawnPickupAmmo(e.x, e.y, {
            ion: 8 + ((Math.random() * 8) | 0),
            plasma: 4 + ((Math.random() * 6) | 0),
            rocket: 2 + ((Math.random() * 3) | 0),
            gun: 0,
          })
        );
      } else if (Math.random() < 0.06) {
        this.powerups.push(spawnPowerup("rocket", e.x, e.y));
      }
    }
    if (e.type === "boss" && !fromSuicide) this.defeatBoss();
  }

  defeatBoss() {
    if (this.levelPhase === "clear" || this.levelPhase === "victory") return;
    this.score += 1000 * this.level;
    this.burst(W / 2, 160, this.level >= MAX_LEVEL ? "#ffb020" : "#3ef0d0", 60, 360);
    this.audio.explosion(true);
    this.boss = null;
    this.enemies = this.enemies.filter((e) => e.type !== "boss");

    if (this.level >= MAX_LEVEL) {
      this.levelPhase = "victory";
      this.clearTimer = 1.2;
      this.state = STATES.LEVEL_CLEAR;
      this.ui.levelClearTitle.textContent = "Final Boss Destroyed";
      this.ui.levelClearSub.textContent = "Freighter path is clear…";
      this.showScreen("levelclear");
      return;
    }

    this.levelPhase = "clear";
    this.clearTimer = 2.4;
    this.state = STATES.LEVEL_CLEAR;
    this.ui.levelClearTitle.textContent = `Sector ${this.level} Cleared`;
    this.ui.levelClearSub.textContent =
      this.level === MAX_LEVEL - 1
        ? "Final sector inbound"
        : "Ammo restocked · Next sector inbound";
    this.showScreen("levelclear");
  }

  collectPowerup(up) {
    this.audio.unlock();
    this.audio.pickup(up.type || "generic");
    spawnSparks(this.particles, up.x, up.y, 8);
    setSquash(this.player, 0.9, 1.12);
    if (up.type === "ammo") {
      this.player.ammo.ion += up.ammo.ion || 0;
      this.player.ammo.plasma += up.ammo.plasma || 0;
      this.player.ammo.rocket += up.ammo.rocket || 0;
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
    } else if (up.type === "rocket") {
      this.player.ammo.rocket += up.rockets || 4;
      this.flashMessage("+ROCKETS", 1);
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
    p.hitFlash = 0.08;
    setSquash(p, 1.28, 0.72);
    this.shake = 8;
    addTrauma(this.juice, 0.22);
    hitStop(this.juice, 0.045);
    impactFlash(this.juice, "rgba(255,70,90,0.14)", 0.14, 0.5);
    this.audio.hurt();
    spawnSparks(this.particles, p.x, p.y, 12);
    this.burst(p.x, p.y, "#ff5a6e", 10, 120);
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
      this.audio.setMusic("title");
      return;
    }

    // respawn fighter — strategic launch burst clears nearby enemies
    const oldAmmo = fromSuicide
      ? null
      : {
          ion: Math.floor(this.player.ammo.ion * 0.5),
          plasma: Math.floor(this.player.ammo.plasma * 0.5),
          rocket: Math.floor(this.player.ammo.rocket * 0.5),
        };

    this.player = createPlayer();
    if (oldAmmo) {
      this.player.ammo.ion = oldAmmo.ion;
      this.player.ammo.plasma = oldAmmo.plasma;
      this.player.ammo.rocket = oldAmmo.rocket;
    } else {
      // next fighter will pick up ejected ammo pod; start with reserve
      this.player.ammo.ion = 10;
      this.player.ammo.plasma = 6;
      this.player.ammo.rocket = 3;
    }
    this.player.invuln = 2.2;
    setSquash(this.player, 0.75, 1.35);
    spawnSmoke(this.particles, this.player.x, this.player.y + 20, 12);
    spawnSparks(this.particles, this.player.x, this.player.y, 10);
    addTrauma(this.juice, 0.2);
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
    spawnBurst(this.particles, x, y, {
      count,
      speed,
      color,
      life: 0.45,
      size: 2.4,
      gravity: 30,
      drag: 0.5,
      glow: true,
    });
  }

  syncHud() {
    const p = this.player;
    this.ui.score.textContent = String(this.score);
    this.ui.level.textContent = `${this.level} / ${MAX_LEVEL}`;
    this.ui.lives.textContent = String(Math.max(0, this.lives));
    this.ui.shield.style.transform = `scaleX(${clamp(p.shield / 100, 0, 1)})`;
    this.ui.hull.style.transform = `scaleX(${clamp(p.hull / 100, 0, 1)})`;
    this.ui.ammoGun.textContent = "∞";
    this.ui.ammoIon.textContent = String(p.ammo.ion);
    this.ui.ammoPlasma.textContent = String(p.ammo.plasma);
    if (this.ui.ammoRocket) this.ui.ammoRocket.textContent = String(p.ammo.rocket);
    for (const el of document.querySelectorAll(".ammo")) {
      el.classList.toggle("active", el.dataset.weapon === p.weapon);
    }
  }

  draw() {
    const ctx = this.ctx;
    if (this.state === STATES.CUTSCENE && this.cutscene) {
      this.cutscene.draw(ctx);
      drawPostFx(ctx, W, H, this.juice);
      return;
    }

    const traumaShake = shakeOffset(this.juice);
    const sx = traumaShake.x + (this.shake ? (Math.random() - 0.5) * this.shake : 0);
    const sy = traumaShake.y + (this.shake ? (Math.random() - 0.5) * this.shake : 0);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    ctx.fillStyle = "#030406";
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // Ikaruga-like stone/void atmosphere
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(28, 32, 40, 0.55)");
    g.addColorStop(0.4, "rgba(10, 12, 16, 0.2)");
    g.addColorStop(1, "rgba(8, 8, 10, 0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // scrolling geometric architecture silhouettes
    this.drawArchitecture(ctx);

    for (const s of this.stars) {
      ctx.globalAlpha = 0.3 + s.z * 0.45;
      ctx.fillStyle = s.z > 1.2 ? "#ffffff" : "#c8d0dc";
      ctx.fillRect(s.x, s.y, s.s, s.s * (1 + s.z * 0.8));
    }
    ctx.globalAlpha = 1;

    // danger line
    ctx.strokeStyle = "rgba(232, 162, 74, 0.35)";
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(20, H - 18);
    ctx.lineTo(W - 20, H - 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(232, 162, 74, 0.65)";
    ctx.font = "600 12px Rajdhani";
    ctx.fillText("COMBAT ZONE", 24, H - 28);

    if (this.state !== STATES.TITLE) {
      this.drawPowerups(ctx);
      this.drawEnemies(ctx);
      this.drawBullets(ctx);
      if (this.player.alive || this.state === STATES.GAME_OVER) this.drawPlayer(ctx);
    } else {
      this.drawTitleShip(ctx);
    }

    drawParticles(ctx, this.particles);

    // soft bloom accents on bright projectiles
    if (this.state === STATES.PLAYING || this.state === STATES.LEVEL_CLEAR || this.state === STATES.PAUSED) {
      for (const b of this.bullets) {
        drawGlow(ctx, b.x, b.y, b.weapon === "rocket" ? 28 : 14, b.color, 0.22);
      }
    }

    if (this.boss && this.levelPhase === "boss") {
      const ratio = clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(80, 24, W - 160, 14);
      ctx.fillStyle = this.boss.final ? "#e8a24a" : "#dce6ff";
      ctx.fillRect(80, 24, (W - 160) * ratio, 14);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
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

    // post passes in screen space (no shake)
    drawPostFx(ctx, W, H, this.juice);
  }

  drawArchitecture(ctx) {
    const t = (this.juice?.time || performance.now() * 0.001) * 40;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#8a93a2";
    ctx.fillStyle = "#12151c";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const y = ((i * 180 + t) % (H + 180)) - 90;
      const x = i % 2 === 0 ? 24 : W - 90;
      ctx.fillRect(x, y, 66, 120);
      ctx.strokeRect(x, y, 66, 120);
      ctx.beginPath();
      ctx.moveTo(x, y + 40);
      ctx.lineTo(x + 66, y + 40);
      ctx.moveTo(x + 22, y);
      ctx.lineTo(x + 22, y + 120);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTitleShip(ctx) {
    const t = performance.now() * 0.001;
    const x = W / 2 + Math.sin(t * 0.8) * 30;
    const y = H * 0.58 + Math.cos(t * 1.1) * 10;
    const s = 1 + Math.sin(t * 4) * 0.03;
    drawGlow(ctx, x, y, 80, "rgba(255,200,80,0.35)", 0.45);
    const drawn =
      this.playerAtlas && this.playerAtlas.draw(ctx, "hero", x, y, 72 * s, 72 * s, t);
    if (!drawn) drawSprite(ctx, this.sprites.hero, x, y, 68 * s, 68 * s);
  }

  drawPlayer(ctx) {
    const p = this.player;
    const glowColor = p.invuln > 1.5 ? "rgba(255,200,120,0.5)" : "rgba(255,210,100,0.42)";
    drawGlow(ctx, p.x, p.y, 95, glowColor, 0.42);
    drawGlow(ctx, p.x, p.y + 12, 36, "rgba(255,140,60,0.3)", 0.35);

    // thruster sprites behind ship
    if (this.playerAtlas) {
      this.playerAtlas.draw(ctx, "thrust", p.x - 8, p.y + 26, 10, 18, this.animTime, { alpha: 0.85 });
      this.playerAtlas.draw(ctx, "thrust", p.x + 8, p.y + 26, 10, 18, this.animTime + 0.07, { alpha: 0.85 });
    }

    for (const t of p.trail) {
      if (t.life <= 0) continue;
      ctx.globalAlpha = t.life * 0.75;
      ctx.fillStyle = "#ffb060";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (p.shield > 0 && this.playerAtlas) {
      const a = 0.25 + (p.shield / 100) * 0.45;
      this.playerAtlas.draw(ctx, "shield_fx", p.x, p.y, 78, 78, this.animTime, { alpha: a });
    }

    const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
    if (!blink) {
      const drawn =
        this.playerAtlas &&
        this.playerAtlas.draw(ctx, "hero", p.x, p.y, 60, 60, this.animTime, {
          flash: p.hitFlash > 0.05,
          flashRed: p.hitFlash > 0 && p.hitFlash <= 0.05,
          sx: p.sx ?? 1,
          sy: p.sy ?? 1,
        });
      if (!drawn) {
        drawSprite(ctx, this.sprites.hero, p.x, p.y, 58, 58, {
          flash: p.hitFlash > 0.05,
          flashRed: p.hitFlash > 0 && p.hitFlash <= 0.05,
          sx: p.sx ?? 1,
          sy: p.sy ?? 1,
        });
      }
    }

    for (const m of this.muzzleFlashes) {
      if (this.playerAtlas) {
        this.playerAtlas.draw(ctx, "muzzle", m.x, m.y, 22, 22, 1 - m.t / 0.12, {
          alpha: Math.max(0, m.t / 0.12),
          frame: Math.floor((1 - m.t / 0.12) * 4),
        });
      }
    }
  }

  drawEnemies(ctx) {
    for (const e of this.enemies) {
      let w = e.w * 1.45;
      let h = e.h * 1.45;
      if (e.type === "boss") {
        w = e.w * 1.2;
        h = e.h * 1.2;
        drawGlow(
          ctx,
          e.x,
          e.y,
          e.final ? 120 : 90,
          e.final ? "rgba(255,170,80,0.3)" : "rgba(220,230,255,0.28)",
          0.35
        );
      } else if (e.polarity === "white") {
        drawGlow(ctx, e.x, e.y, 28, "rgba(220,230,255,0.25)", 0.3);
      } else {
        drawGlow(ctx, e.x, e.y, 28, "rgba(255,170,80,0.2)", 0.28);
      }
      const flashing = e.flash > 0;
      const t = this.animTime + (e.animOffset || 0);
      const drawn =
        this.enemyAtlas &&
        this.enemyAtlas.draw(ctx, e.type, e.x, e.y, w, h, t, {
          variant: e.variant || 0,
          final: !!e.final,
          flash: flashing && e.flash > 0.03,
          flashRed: flashing && e.flash <= 0.03,
          sx: e.type === "boss" ? 1 : e.sx ?? 1,
          sy: e.type === "boss" ? 1 : e.sy ?? 1,
        });
      if (!drawn) {
        let img = this.sprites[e.type] || this.sprites.scout;
        if (e.type === "boss") img = e.final ? this.sprites.finalBoss : this.sprites.boss;
        drawSprite(ctx, img, e.x, e.y, w, h, {
          flash: flashing && e.flash > 0.03,
          flashRed: flashing && e.flash <= 0.03,
          sx: e.type === "boss" ? 1 : e.sx ?? 1,
          sy: e.type === "boss" ? 1 : e.sy ?? 1,
        });
      }
      if (e.hp < e.maxHp && e.type !== "boss") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(e.x - 16, e.y - e.h / 2 - 10, 32, 3);
        ctx.fillStyle = "#dce6ff";
        ctx.fillRect(e.x - 16, e.y - e.h / 2 - 10, 32 * (e.hp / e.maxHp), 3);
      }
    }
  }

  drawBullets(ctx) {
    for (const b of this.bullets) {
      const size =
        b.weapon === "rocket"
          ? { w: b.w + 6, h: b.h + 8 }
          : b.weapon === "plasma"
            ? { w: b.w + 16, h: b.h + 10 }
            : b.weapon === "ion"
              ? { w: b.w + 14, h: b.h + 14 }
              : { w: b.w + 4, h: b.h + 10 };
      const drawn =
        this.playerAtlas &&
        this.playerAtlas.drawWeapon(ctx, b.weapon, b.x, b.y, size.w, size.h, this.animTime + b.x * 0.01);
      if (!drawn) {
        const img =
          b.weapon === "rocket"
            ? this.sprites.rocket
            : b.weapon === "ion"
              ? this.sprites.ion
              : b.weapon === "plasma"
                ? this.sprites.plasma
                : this.sprites.gun;
        if (b.weapon === "rocket") {
          const ang = Math.atan2(b.vy, b.vx || 0) + Math.PI / 2;
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(ang);
          ctx.drawImage(img, -b.w / 2, -b.h / 2, b.w, b.h);
          ctx.restore();
        } else {
          drawSprite(ctx, img, b.x, b.y, b.w + 4, b.h + 4);
        }
      }
    }
    for (const b of this.enemyBullets) {
      const img = b.heavy ? this.sprites.enemyBulletHeavy : this.sprites.enemyBullet;
      drawSprite(ctx, img, b.x, b.y, b.w + 4, b.h + 4);
    }
  }

  drawPowerups(ctx) {
    for (const p of this.powerups) {
      const bobY = Math.sin(p.bob || 0) * 3;
      const size = p.type === "ammo" ? 36 : 38;
      const drawn =
        this.pickupAtlas &&
        this.pickupAtlas.draw(ctx, p.type, p.x, p.y + bobY, size, size, this.animTime + (p.bob || 0) * 0.15, {
          variant: p.variant || 0,
          fps: 12,
        });
      if (!drawn) {
        const map = {
          shield: this.sprites.powerShield,
          repair: this.sprites.powerRepair,
          super: this.sprites.powerSuper,
          ammo: this.sprites.powerAmmo,
          rocket: this.sprites.powerRocket,
        };
        const img = map[p.type] || this.sprites.powerAmmo;
        drawSprite(ctx, img, p.x, p.y + bobY, 32, 32);
      }
    }
  }
}
