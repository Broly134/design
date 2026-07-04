/* ==========================================================================
   METRO DASH — endless runner urbain, moteur 3D WebGL (Three.js)
   Logique : Game / Player / Obstacle / Coin / PowerUp / Spawner /
   CollisionManager / ScoreManager / UIManager / InputManager / AudioManager
   Rendu : World3D (décor), PlayerRig (personnage articulé), pools de meshes,
   particules sprites, overlay 2D pour les lignes de vitesse et flashs.
   ========================================================================== */

"use strict";

import * as THREE from "./vendor/three.module.min.js";

/* --------------------------------------------------------------------------
   Configuration globale
   -------------------------------------------------------------------------- */
const CONFIG = {
  LANE_X: [-2.4, 0, 2.4],      // position X (mètres) des trois voies
  PLAYER_Z: 6,                 // distance du joueur devant la caméra (m)
  SPAWN_Z: 95,                 // distance d'apparition des entités (m)
  KILL_Z: 2.2,                 // distance de recyclage derrière le joueur
  BASE_SPEED: 15,              // vitesse de départ (m/s)
  MAX_SPEED: 33,               // vitesse max hors boost
  JUMP_V: 9.4,                 // vitesse verticale du saut (m/s)
  GRAVITY: 24,                 // gravité (m/s²)
  SLIDE_TIME: 0.62,            // durée d'une glissade (s)
  PLAYER_H: 1.75,              // hauteur du joueur debout (m)
  SLIDE_H: 0.82,               // hauteur du joueur en glissade (m)
  LANE_SNAP: 11,               // vitesse de changement de voie
  COIN_SCORE: 25,
  POWERUP_DUR: { magnet: 8, shield: 10, x2: 10, boost: 4 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* --------------------------------------------------------------------------
   AudioManager — sons synthétisés via Web Audio API (aucun fichier requis)
   -------------------------------------------------------------------------- */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem("metrodash_muted") === "1";
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem("metrodash_muted", m ? "1" : "0");
    if (m) this.stopMusic();
  }

  tone({ type = "sine", from = 440, to = from, dur = 0.12, vol = 0.3, delay = 0 }) {
    if (this.muted || !this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.25, vol = 0.4, freq = 900 }) {
    if (this.muted || !this.ensure()) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  coin()    { this.tone({ type: "square", from: 950, to: 1500, dur: 0.09, vol: 0.16 }); }
  jump()    { this.tone({ type: "sine", from: 300, to: 640, dur: 0.16, vol: 0.22 }); }
  slide()   { this.noise({ dur: 0.18, vol: 0.14, freq: 500 }); }
  crash()   { this.noise({ dur: 0.4, vol: 0.5, freq: 350 }); this.tone({ type: "sawtooth", from: 220, to: 50, dur: 0.4, vol: 0.3 }); }
  powerup() { [523, 659, 784, 1046].forEach((f, i) => this.tone({ type: "triangle", from: f, dur: 0.12, vol: 0.2, delay: i * 0.07 })); }
  shieldHit(){ this.tone({ type: "triangle", from: 880, to: 220, dur: 0.3, vol: 0.3 }); }
  smash()   { this.noise({ dur: 0.15, vol: 0.25, freq: 700 }); }
  swoosh()  { this.noise({ dur: 0.1, vol: 0.08, freq: 1800 }); }

  startMusic() {
    if (this.muted || !this.ensure() || this.musicTimer) return;
    const bass = [110, 110, 131, 98];
    const arp = [440, 523, 659, 523, 440, 659, 784, 659];
    const loop = () => {
      if (this.muted) return this.stopMusic();
      const s = this.musicStep++;
      this.tone({ type: "triangle", from: bass[Math.floor(s / 4) % 4], dur: 0.22, vol: 0.1 });
      if (s % 2 === 0) this.tone({ type: "square", from: arp[s % 8], dur: 0.1, vol: 0.035 });
    };
    this.musicTimer = setInterval(loop, 240);
  }
  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

/* --------------------------------------------------------------------------
   InputManager — clavier + tactile (swipes tolérants, tap = saut)
   -------------------------------------------------------------------------- */
class InputManager {
  constructor(target, handlers) {
    this.h = handlers;
    this.touch = null;
    this.consumed = false;

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case "ArrowLeft": case "KeyA": this.h.left(); break;
        case "ArrowRight": case "KeyD": this.h.right(); break;
        case "ArrowUp": case "KeyW": case "Space": e.preventDefault(); this.h.jump(); break;
        case "ArrowDown": case "KeyS": this.h.slide(); break;
        case "KeyP": case "Escape": this.h.pause(); break;
      }
    });

    const opts = { passive: false };
    target.addEventListener("touchstart", (e) => {
      const t = e.changedTouches[0];
      this.touch = { x: t.clientX, y: t.clientY, t: performance.now(), id: t.identifier };
      this.consumed = false;
    }, opts);

    target.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (!this.touch || this.consumed) return;
      const t = [...e.changedTouches].find((c) => c.identifier === this.touch.id);
      if (!t) return;
      const dx = t.clientX - this.touch.x;
      const dy = t.clientY - this.touch.y;
      const TH = 24;
      if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
      this.consumed = true;
      if (Math.abs(dx) > Math.abs(dy)) (dx > 0 ? this.h.right : this.h.left)();
      else (dy > 0 ? this.h.slide : this.h.jump)();
    }, opts);

    target.addEventListener("touchend", (e) => {
      if (!this.touch || this.consumed) { this.touch = null; return; }
      const t = [...e.changedTouches].find((c) => c.identifier === this.touch.id);
      if (t && performance.now() - this.touch.t < 220) this.h.jump();
      this.touch = null;
    }, opts);
  }
}

/* --------------------------------------------------------------------------
   Player — logique de course : voie, saut, glissade (le visuel est PlayerRig)
   -------------------------------------------------------------------------- */
class Player {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.lane = 1;
    this.x = CONFIG.LANE_X[1];
    this.y = 0;
    this.vy = 0;
    this.jumping = false;
    this.sliding = false;
    this.slideT = 0;
    this.runPhase = 0;
    this.invincibleT = 0;
  }

  get height() { return this.sliding ? CONFIG.SLIDE_H : CONFIG.PLAYER_H; }

  moveLane(dir) {
    const target = clamp(this.lane + dir, 0, 2);
    if (target !== this.lane) {
      this.lane = target;
      this.game.audio.swoosh();
    }
  }

  jump() {
    if (this.jumping) return;
    if (this.sliding) { this.sliding = false; this.slideT = 0; }
    this.jumping = true;
    this.vy = CONFIG.JUMP_V;
    this.game.audio.jump();
  }

  slide() {
    if (this.sliding) { this.slideT = CONFIG.SLIDE_TIME; return; }
    this.sliding = true;
    this.slideT = CONFIG.SLIDE_TIME;
    this.game.audio.slide();
    if (this.jumping) this.vy = Math.min(this.vy, -10); // retombée accélérée
  }

  update(dt) {
    this.x = damp(this.x, CONFIG.LANE_X[this.lane], CONFIG.LANE_SNAP, dt);

    if (this.jumping) {
      this.y += this.vy * dt;
      this.vy -= CONFIG.GRAVITY * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.jumping = false; }
    }
    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0) this.sliding = false;
    }
    if (this.invincibleT > 0) this.invincibleT -= dt;

    this.runPhase += dt * (8 + this.game.speed * 0.35);
  }
}

/* --------------------------------------------------------------------------
   Entités logiques : Obstacle, Coin, PowerUp
   -------------------------------------------------------------------------- */
const OBSTACLE_DEFS = {
  barrier: { w: 2.0, h: 1.0, d: 0.5, jumpable: true },
  sign:    { w: 2.1, h: 1.2, d: 0.4, gapBottom: 1.22 },
  crate:   { w: 1.8, h: 1.9, d: 1.6 },
  wagon:   { w: 2.3, h: 3.0, d: 13 },
};

class Obstacle {
  constructor(type, lane, z) {
    this.type = type;
    this.lane = lane;
    this.z = z;
    this.def = OBSTACLE_DEFS[type];
    this.dead = false;
    this.tint = Math.random();
    this.mesh = null;
  }
  get x() { return CONFIG.LANE_X[this.lane]; }
}

class Coin {
  constructor(lane, z, y = 1.05) {
    this.lane = lane;
    this.z = z;
    this.y = y;
    this.x = CONFIG.LANE_X[lane];
    this.dead = false;
    this.spin = Math.random() * Math.PI * 2;
  }
}

const POWERUP_DEFS = {
  magnet: { color: 0x00d0ff, css: "#00d0ff", label: "U" },
  shield: { color: 0x7fd4ff, css: "#7fd4ff", label: "◈" },
  x2:     { color: 0x8b5cf6, css: "#8b5cf6", label: "x2" },
  boost:  { color: 0xff8a2a, css: "#ff8a2a", label: "≫" },
};

class PowerUp {
  constructor(kind, lane, z) {
    this.kind = kind;
    this.lane = lane;
    this.z = z;
    this.dead = false;
    this.bob = Math.random() * Math.PI * 2;
    this.mesh = null;
  }
  get x() { return CONFIG.LANE_X[this.lane]; }
}

/* --------------------------------------------------------------------------
   Spawner — patterns équitables : toujours au moins une issue possible
   -------------------------------------------------------------------------- */
class Spawner {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.zAhead = 40;
    this.powerupClock = rand(12, 18);
  }

  update(dt, speed, elapsed) {
    this.zAhead -= speed * dt;
    this.powerupClock -= dt;

    while (this.zAhead < CONFIG.SPAWN_Z) {
      const gap = clamp(speed * 0.62, 10, 21);
      const tier = elapsed > 90 ? 3 : elapsed > 60 ? 2 : elapsed > 30 ? 1 : 0;
      const used = this.spawnPattern(this.zAhead + gap, tier);
      this.zAhead += gap + used;
    }
  }

  spawnPattern(z, tier) {
    const G = this.game;
    const lanes = [0, 1, 2];
    const free = pick(lanes);
    const others = lanes.filter((l) => l !== free);

    if (this.powerupClock <= 0) {
      G.powerups.push(new PowerUp(pick(Object.keys(POWERUP_DEFS)), free, z - 5));
      this.powerupClock = rand(16, 26);
    }

    const fn = pick(this.patternsForTier(tier));
    return fn(z, free, others);
  }

  patternsForTier(tier) {
    const P = this.patterns();
    if (tier === 0) return [P.singleJump, P.singleSlide, P.singleCrate, P.coinLine, P.coinArc];
    if (tier === 1) return [P.singleJump, P.singleSlide, P.doubleBlock, P.wagonSide, P.jumpThenSlide, P.coinArc, P.zigzag];
    if (tier === 2) return [P.doubleBlock, P.wagonSide, P.jumpThenSlide, P.triplet, P.zigzag, P.wagonCorridor];
    return [P.doubleBlock, P.wagonSide, P.triplet, P.wagonCorridor, P.gauntlet, P.zigzag];
  }

  patterns() {
    const G = this.game;
    const coinRow = (lane, z, n, dz = 2.3, y = 1.05) => {
      for (let i = 0; i < n; i++) G.coins.push(new Coin(lane, z + i * dz, y));
    };
    const coinJumpArc = (lane, z) => {
      const ys = [1.0, 1.7, 2.15, 2.3, 2.15, 1.7, 1.0];
      ys.forEach((y, i) => G.coins.push(new Coin(lane, z + i * 1.5, y)));
    };

    return {
      singleJump: (z, free, others) => {
        const lane = pick(others);
        G.obstacles.push(new Obstacle("barrier", lane, z + 4));
        coinJumpArc(lane, z);
        coinRow(free, z + 1, 4);
        return 14;
      },
      singleSlide: (z, free, others) => {
        const lane = pick(others);
        G.obstacles.push(new Obstacle("sign", lane, z + 4));
        coinRow(lane, z + 1, 5, 2.2, 0.75);
        return 13;
      },
      singleCrate: (z, free, others) => {
        G.obstacles.push(new Obstacle("crate", pick(others), z + 3));
        coinRow(free, z, 5);
        return 12;
      },
      coinLine: (z, free) => {
        coinRow(free, z, 7);
        return 16;
      },
      coinArc: (z, free) => {
        coinJumpArc(free, z);
        return 12;
      },
      doubleBlock: (z, free, others) => {
        G.obstacles.push(new Obstacle("crate", others[0], z + 3));
        G.obstacles.push(new Obstacle(pick(["barrier", "sign"]), others[1], z + 3));
        coinRow(free, z + 1, 5);
        return 14;
      },
      wagonSide: (z, free, others) => {
        const lane = pick(others);
        G.obstacles.push(new Obstacle("wagon", lane, z + 2));
        coinRow(free, z + 2, 6);
        return 20;
      },
      jumpThenSlide: (z, free, others) => {
        const lane = pick(others);
        const step = clamp(G.speed * 0.7, 11, 18);
        G.obstacles.push(new Obstacle("barrier", lane, z + 3));
        G.obstacles.push(new Obstacle("sign", lane, z + 3 + step));
        coinRow(free, z + 2, 6);
        return 6 + step + 6;
      },
      triplet: (z, free, others) => {
        const step = clamp(G.speed * 0.62, 10, 17);
        const l1 = pick(others);
        G.obstacles.push(new Obstacle("crate", l1, z + 2));
        const free2 = pick([free, ...others.filter((l) => l !== l1)]);
        const blocked2 = [0, 1, 2].filter((l) => l !== free2);
        G.obstacles.push(new Obstacle("barrier", pick(blocked2), z + 2 + step));
        G.obstacles.push(new Obstacle("sign", pick(blocked2), z + 2 + step * 2));
        coinRow(free2, z + step, 4);
        return 2 + step * 2 + 6;
      },
      wagonCorridor: (z, free, others) => {
        G.obstacles.push(new Obstacle("wagon", others[0], z + 2));
        G.obstacles.push(new Obstacle("wagon", others[1], z + 5));
        coinRow(free, z + 3, 8, 2.2);
        return 24;
      },
      zigzag: (z, free, others) => {
        const step = clamp(G.speed * 0.66, 11, 18);
        G.obstacles.push(new Obstacle("crate", others[0], z + 2));
        G.obstacles.push(new Obstacle("crate", others[1], z + 2 + step));
        coinRow(free, z, 3);
        coinRow(others[1], z + 2, 3);
        coinRow(others[0], z + 2 + step, 3);
        return 4 + step + 8;
      },
      gauntlet: (z, free, others) => {
        const step = clamp(G.speed * 0.58, 10, 16);
        const seq = ["barrier", "sign", "crate", "barrier"];
        seq.forEach((type, i) => G.obstacles.push(new Obstacle(type, pick(others), z + 2 + i * step)));
        coinRow(free, z + 2, 4);
        coinJumpArc(free, z + 2 + step * 2);
        return 2 + step * 4 + 4;
      },
    };
  }
}

/* --------------------------------------------------------------------------
   CollisionManager — hitboxes logiques par voie / hauteur / profondeur
   -------------------------------------------------------------------------- */
class CollisionManager {
  static check(player, obstacles) {
    const px = player.x;
    for (const o of obstacles) {
      if (o.dead) continue;
      const halfD = o.def.d / 2 + 0.45;
      const center = o.z + o.def.d / 2;
      if (Math.abs(center - CONFIG.PLAYER_Z) > halfD) continue;
      if (Math.abs(px - o.x) > 1.35) continue;

      if (o.type === "barrier") {
        if (player.y > o.def.h * 0.7) continue;
        return o;
      }
      if (o.type === "sign") {
        const top = player.y + player.height;
        if (top < o.def.gapBottom) continue;
        return o;
      }
      return o;
    }
    return null;
  }
}

/* --------------------------------------------------------------------------
   ScoreManager — score, pièces, meilleur score (localStorage)
   -------------------------------------------------------------------------- */
class ScoreManager {
  constructor() {
    this.best = parseInt(localStorage.getItem("metrodash_best") || "0", 10);
    this.reset();
  }
  reset() {
    this.score = 0;
    this.coins = 0;
    this.newBest = false;
  }
  addDistance(d, mult) { this.score += d * 1.8 * mult; }
  addCoin(mult) { this.coins++; this.score += CONFIG.COIN_SCORE * mult; }
  finalize() {
    const s = Math.floor(this.score);
    if (s > this.best) {
      this.best = s;
      this.newBest = true;
      localStorage.setItem("metrodash_best", String(s));
    }
    return s;
  }
  resetBest() {
    this.best = 0;
    localStorage.removeItem("metrodash_best");
  }
}

/* --------------------------------------------------------------------------
   UIManager — écrans DOM + HUD
   -------------------------------------------------------------------------- */
class UIManager {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.screens = ["loading", "menu", "instructions", "options", "pause", "gameover"];
    this.hud = this.$("hud");
    this.puContainer = this.$("hud-powerups");
    this.puBars = {};
  }

  show(name) {
    for (const s of this.screens) {
      const el = this.$(s);
      el.classList.toggle("active", s === name);
      el.setAttribute("aria-hidden", s === name ? "false" : "true");
    }
  }

  setHud(on) { this.hud.classList.toggle("active", on); }

  updateHud(score, coins, best) {
    this.$("hud-score").textContent = Math.floor(score);
    this.$("hud-coins").textContent = coins;
    this.$("hud-best").textContent = best;
  }

  updatePowerups(active) {
    for (const kind of Object.keys(POWERUP_DEFS)) {
      const a = active[kind];
      let el = this.puBars[kind];
      if (a && !el) {
        el = document.createElement("div");
        el.className = "pu-badge";
        el.innerHTML = `<span class="pu pu-${kind}">${POWERUP_DEFS[kind].label}</span><div class="pu-bar"><div class="pu-fill" style="background:${POWERUP_DEFS[kind].css}"></div></div>`;
        this.puContainer.appendChild(el);
        this.puBars[kind] = el;
      } else if (!a && el) {
        el.remove();
        delete this.puBars[kind];
      }
      if (a && el) el.querySelector(".pu-fill").style.width = `${(a.t / a.dur) * 100}%`;
    }
  }

  showGameOver(stats) {
    this.$("go-score").textContent = stats.score;
    this.$("go-best").textContent = stats.best;
    this.$("go-coins").textContent = stats.coins;
    this.$("go-distance").textContent = `${stats.distance} m`;
    this.$("go-newbest").classList.toggle("show", stats.newBest);
    this.show("gameover");
  }
}

/* ==========================================================================
   TEXTURES PROCÉDURALES — tout est dessiné en canvas, aucun asset externe
   ========================================================================== */
function makeTexture(w, h, draw, { repeat, anis = 4 } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anis;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

const Tex = {
  /* Ciel : dégradé crépuscule + soleil + étoiles + skyline en silhouette */
  sky() {
    return makeTexture(1024, 512, (g, w, h) => {
      const HOR = h * 0.72; // ligne d'horizon dans la texture
      const grad = g.createLinearGradient(0, 0, 0, HOR);
      grad.addColorStop(0, "#12102e");
      grad.addColorStop(0.5, "#3c2560");
      grad.addColorStop(0.85, "#8a4550");
      grad.addColorStop(1, "#d97a45");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, HOR + 2);
      g.fillStyle = "#1a1330";
      g.fillRect(0, HOR, w, h - HOR);
      // soleil bas
      const sun = g.createRadialGradient(w / 2, HOR, 5, w / 2, HOR, 190);
      sun.addColorStop(0, "rgba(255,196,110,0.95)");
      sun.addColorStop(0.35, "rgba(255,150,70,0.4)");
      sun.addColorStop(1, "rgba(255,150,70,0)");
      g.fillStyle = sun;
      g.fillRect(0, 0, w, h);
      // étoiles
      g.fillStyle = "rgba(255,255,255,0.7)";
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * w, y = Math.random() * HOR * 0.55;
        const r = Math.random() * 1.3 + 0.3;
        g.globalAlpha = Math.random() * 0.7 + 0.2;
        g.fillRect(x, y, r, r);
      }
      g.globalAlpha = 1;
      // skyline lointaine
      g.fillStyle = "#191338";
      let x = 0;
      while (x < w) {
        const bw = rand(28, 90), bh = rand(28, 120);
        g.fillRect(x, HOR - bh, bw, bh + 4);
        // quelques fenêtres
        g.fillStyle = "rgba(255,205,130,0.5)";
        for (let i = 0; i < bw * bh * 0.002; i++) {
          g.fillRect(x + rand(3, bw - 5), HOR - bh + rand(4, bh - 6), 2, 3);
        }
        g.fillStyle = "#191338";
        x += bw + rand(4, 26);
      }
    });
  },

  /* Sol : ballast + dalle centrale + traverses + lisérés jaunes (tuile 48×12 m) */
  ground() {
    return makeTexture(1024, 256, (g, w, h) => {
      const mPerPx = 48 / w;
      const xOf = (m) => (m + 24) / 48 * w;
      // ballast latéral
      g.fillStyle = "#20232f";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${120 + rand(-30, 30)},${125 + rand(-30, 30)},${150 + rand(-30, 30)},0.12)`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      // dalle centrale (zone des 3 voies)
      const slabL = xOf(-4.3), slabR = xOf(4.3);
      const slab = g.createLinearGradient(slabL, 0, slabR, 0);
      slab.addColorStop(0, "#343850");
      slab.addColorStop(0.5, "#3b3f5a");
      slab.addColorStop(1, "#343850");
      g.fillStyle = slab;
      g.fillRect(slabL, 0, slabR - slabL, h);
      // traverses : 5 par tuile de 12 m
      g.fillStyle = "#23263a";
      for (let i = 0; i < 5; i++) {
        const y = (i + 0.5) / 5 * h;
        g.fillRect(slabL + 6, y - 5, slabR - slabL - 12, 10);
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.fillRect(slabL + 6, y + 4, slabR - slabL - 12, 2);
        g.fillStyle = "#23263a";
      }
      // lits de rails (bandes sombres sous chaque rail)
      g.fillStyle = "rgba(0,0,0,0.3)";
      for (const lane of CONFIG.LANE_X) {
        for (const off of [-0.72, 0.72]) {
          g.fillRect(xOf(lane + off) - 3, 0, 6, h);
        }
      }
      // lisérés jaunes de bord de quai
      g.fillStyle = "#d9a92e";
      g.fillRect(slabL - 3, 0, 5, h);
      g.fillRect(slabR - 2, 0, 5, h);
      // marquage pointillé central léger
      g.fillStyle = "rgba(255,255,255,0.06)";
      for (const lane of [-1.2, 1.2]) g.fillRect(xOf(lane) - 1, 0, 2, h);
    }, { repeat: [1, 1] });
  },

  /* Mur de quai avec graffitis originaux (répété le long de la voie) */
  wall() {
    return makeTexture(1024, 128, (g, w, h) => {
      g.fillStyle = "#3a3f58";
      g.fillRect(0, 0, w, h);
      // joints de béton
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 2;
      for (let x = 0; x < w; x += 128) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
      }
      // salissures
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(0,0,0,${rand(0.05, 0.18)})`;
        g.beginPath();
        g.ellipse(Math.random() * w, rand(h * 0.5, h), rand(10, 50), rand(4, 14), 0, 0, Math.PI * 2);
        g.fill();
      }
      // graffitis colorés (formes + tags fictifs)
      const tags = ["DASH", "VLT", "NOVA", "GO!", "ZINC", "K7"];
      const cols = ["#ff5c8a", "#00e08a", "#ffc93c", "#00d0ff", "#c084fc"];
      for (let i = 0; i < 7; i++) {
        const x = rand(30, w - 90), y = rand(h * 0.25, h * 0.7);
        const col = pick(cols);
        g.fillStyle = col + "55";
        g.beginPath();
        g.ellipse(x + 34, y + 8, rand(34, 58), rand(14, 22), rand(-0.2, 0.2), 0, Math.PI * 2);
        g.fill();
        g.font = `900 ${rand(20, 30)}px system-ui, sans-serif`;
        g.strokeStyle = "rgba(10,10,20,0.8)";
        g.lineWidth = 5;
        g.strokeText(pick(tags), x, y + 16);
        g.fillStyle = col;
        g.fillText(pick(tags), x, y + 16);
      }
    }, { repeat: [10, 1] });
  },

  /* Façades d'immeubles : 4 variantes, fenêtres allumées (servent d'emissiveMap) */
  facade(base) {
    return makeTexture(256, 512, (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      // fenêtres
      const cols = 6, rows = 14;
      for (let r = 1; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = Math.random() < 0.42;
          const x = (c + 0.22) / cols * w;
          const y = (r + 0.15) / rows * h;
          const ww = w / cols * 0.56, wh = h / rows * 0.55;
          if (lit) {
            g.fillStyle = pick(["#ffcf8a", "#ffe9b8", "#9fd8ff"]);
            g.fillRect(x, y, ww, wh);
            g.fillStyle = "rgba(255,255,255,0.35)";
            g.fillRect(x, y, ww, wh * 0.4);
          } else {
            g.fillStyle = "rgba(10,12,22,0.85)";
            g.fillRect(x, y, ww, wh);
          }
        }
      }
      // corniche
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(0, 0, w, h * 0.03);
    });
  },

  /* Enseigne néon (texte au choix) */
  neon(text, color) {
    return makeTexture(256, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = "900 34px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = color;
      g.shadowBlur = 16;
      g.fillStyle = color;
      g.fillText(text, w / 2, h / 2);
      g.shadowBlur = 0;
      g.fillStyle = "#ffffff";
      g.globalAlpha = 0.8;
      g.font = "900 32px system-ui, sans-serif";
      g.fillText(text, w / 2, h / 2);
    });
  },

  /* Panneau publicitaire */
  billboard(text) {
    return makeTexture(512, 160, (g, w, h) => {
      g.fillStyle = "#10131f";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#00d0ff";
      g.lineWidth = 6;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.font = "900 52px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = "#00d0ff";
      g.shadowBlur = 18;
      g.fillStyle = "#7ae4ff";
      g.fillText(text, w / 2, h / 2);
    });
  },

  /* Barrière rayée */
  barrier() {
    return makeTexture(256, 96, (g, w, h) => {
      g.fillStyle = "#ff8a2a";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#f4f6ff";
      for (let x = -h; x < w + h; x += 64) {
        g.beginPath();
        g.moveTo(x, h); g.lineTo(x + 32, h); g.lineTo(x + 32 + h * 0.6, 0); g.lineTo(x + h * 0.6, 0);
        g.closePath(); g.fill();
      }
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.fillRect(0, h - 10, w, 10);
    });
  },

  /* Caisse taguée */
  crate(base, tag) {
    return makeTexture(256, 256, (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 10;
      g.strokeRect(5, 5, w - 10, h - 10);
      g.strokeStyle = "rgba(255,255,255,0.12)";
      g.lineWidth = 4;
      g.strokeRect(18, 18, w - 36, h - 36);
      g.font = "900 72px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.strokeStyle = "rgba(0,0,0,0.7)";
      g.lineWidth = 10;
      g.strokeText(tag, w / 2, h / 2);
      g.fillStyle = "#f4f6ff";
      g.fillText(tag, w / 2, h / 2);
    });
  },

  /* Panneau "baisse-toi" */
  signPanel() {
    return makeTexture(512, 128, (g, w, h) => {
      g.fillStyle = "#0e1220";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#00d0ff";
      g.lineWidth = 8;
      g.strokeRect(4, 4, w - 8, h - 8);
      g.font = "900 56px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = "#00d0ff";
      g.shadowBlur = 16;
      g.fillStyle = "#7ae4ff";
      g.fillText("⬇ BAISSE-TOI ⬇", w / 2, h / 2);
    });
  },

  /* Flanc de wagon : fenêtres + portes */
  wagonSide(base) {
    return makeTexture(1024, 256, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, base[0]);
      grad.addColorStop(0.55, base[1]);
      grad.addColorStop(1, base[2]);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      // bande fenêtres
      for (let i = 0; i < 8; i++) {
        const x = 20 + i * 124;
        g.fillStyle = "#0d1626";
        g.beginPath();
        g.roundRect(x, 42, 96, 66, 10);
        g.fill();
        g.fillStyle = "rgba(160,210,255,0.75)";
        g.beginPath();
        g.roundRect(x + 5, 47, 86, 56, 7);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.fillRect(x + 8, 50, 80, 16);
      }
      // portes
      g.fillStyle = "rgba(0,0,0,0.3)";
      for (const x of [250, 640]) g.fillRect(x, 36, 6, h - 60);
      // bas de caisse
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(0, h - 34, w, 34);
      g.fillStyle = "#ffc93c";
      g.fillRect(0, h - 40, w, 5);
    });
  },

  /* Avant de wagon */
  wagonFront(base) {
    return makeTexture(256, 256, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, base[0]);
      grad.addColorStop(0.6, base[1]);
      grad.addColorStop(1, base[2]);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      // pare-brise
      g.fillStyle = "#0d1626";
      g.beginPath();
      g.roundRect(30, 34, w - 60, 76, 14);
      g.fill();
      g.fillStyle = "rgba(150,200,255,0.5)";
      g.beginPath();
      g.roundRect(38, 40, w - 76, 62, 10);
      g.fill();
      // phares
      for (const x of [46, w - 46]) {
        g.fillStyle = "#ffe9a8";
        g.beginPath();
        g.arc(x, 168, 14, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(0, h - 40, w, 40);
    });
  },

  /* Halo radial (sprites additifs : lampes, glows, particules) */
  glow() {
    return makeTexture(128, 128, (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
  },

  /* Ombre portée circulaire */
  blob() {
    return makeTexture(128, 128, (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      grad.addColorStop(0, "rgba(0,0,0,0.55)");
      grad.addColorStop(0.7, "rgba(0,0,0,0.3)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
  },

  /* Icône de power-up */
  puIcon(label, css) {
    return makeTexture(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "rgba(13,15,25,0.92)";
      g.strokeStyle = css;
      g.lineWidth = 10;
      g.beginPath();
      g.roundRect(10, 10, w - 20, h - 20, 30);
      g.fill();
      g.stroke();
      g.font = "900 58px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = css;
      g.shadowBlur = 14;
      g.fillStyle = css;
      g.fillText(label, w / 2, h / 2 + 2);
    });
  },
};

/* ==========================================================================
   PlayerRig — coureur 3D articulé (torse, tête, casquette, sac, bras, jambes)
   ========================================================================== */
class PlayerRig {
  constructor(scene, glowTex, blobTex) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b087 });
    const jacket = new THREE.MeshLambertMaterial({ color: 0xff8a2a });
    const jacketD = new THREE.MeshLambertMaterial({ color: 0xd96f14 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2c3150 });
    const shoe = new THREE.MeshLambertMaterial({ color: 0xf4f6ff });
    const bag = new THREE.MeshLambertMaterial({ color: 0x8b5cf6 });
    const cap = new THREE.MeshLambertMaterial({ color: 0x2f7bff });
    const hair = new THREE.MeshLambertMaterial({ color: 0x503a28 });
    const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

    // Corps : pivot au niveau des hanches pour la glissade
    this.body = new THREE.Group();
    this.body.position.y = 0.85;
    this.group.add(this.body);

    // torse + bande de veste
    const torso = box(0.52, 0.64, 0.3, jacket);
    torso.position.y = 0.32;
    this.body.add(torso);
    const stripe = box(0.08, 0.6, 0.31, jacketD);
    stripe.position.set(0, 0.32, 0.005);
    this.body.add(stripe);

    // sac à dos (face caméra : +z)
    const pack = box(0.42, 0.5, 0.2, bag);
    pack.position.set(0, 0.36, 0.25);
    this.body.add(pack);
    const strapL = box(0.07, 0.5, 0.05, bag);
    strapL.position.set(-0.18, 0.36, 0.16);
    this.body.add(strapL);
    const strapR = strapL.clone();
    strapR.position.x = 0.18;
    this.body.add(strapR);

    // tête + cheveux + casquette (visière vers -z, sens de course)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), skin);
    head.position.y = 0.82;
    this.body.add(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.195, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.y = 0.83;
    this.body.add(hairCap);
    const capTop = box(0.34, 0.11, 0.34, cap);
    capTop.position.y = 0.97;
    this.body.add(capTop);
    const brim = box(0.3, 0.045, 0.18, cap);
    brim.position.set(0, 0.94, -0.24);
    this.body.add(brim);

    // bras (pivot épaule)
    const mkArm = (side) => {
      const g = new THREE.Group();
      g.position.set(0.32 * side, 0.56, 0);
      const arm = box(0.14, 0.46, 0.14, jacket);
      arm.position.y = -0.22;
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), skin);
      hand.position.y = -0.48;
      g.add(hand);
      this.body.add(g);
      return g;
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);

    // jambes (pivot hanche, attachées au groupe racine pour rester au sol)
    const mkLeg = (side, mat) => {
      const g = new THREE.Group();
      g.position.set(0.14 * side, 0.85, 0);
      const leg = box(0.17, 0.58, 0.17, mat);
      leg.position.y = -0.29;
      g.add(leg);
      const foot = box(0.18, 0.1, 0.3, shoe);
      foot.position.set(0, -0.6, -0.05);
      g.add(foot);
      this.group.add(g);
      return g;
    };
    this.legL = mkLeg(-1, pants);
    this.legR = mkLeg(1, new THREE.MeshLambertMaterial({ color: 0x3a4066 }));

    // ombre portée
    this.shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.1),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })
    );
    this.shadowMesh.rotation.x = -Math.PI / 2;
    scene.add(this.shadowMesh);

    // aura bouclier
    this.shieldFx = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0x00d0ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.shieldFx.visible = false;
    this.group.add(this.shieldFx);
    this.shieldFx.position.y = 1.0;

    // halo boost
    this.boostFx = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff8a2a, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.boostFx.scale.set(2.6, 2.6, 1);
    this.boostFx.position.y = 1.0;
    this.boostFx.visible = false;
    this.group.add(this.boostFx);

    this.slideW = 0; // poids de la pose de glissade (0..1)
    this.airW = 0;   // poids de la pose aérienne
  }

  update(player, dt, fx) {
    const g = this.group;
    g.position.x = player.x;
    g.position.z = -CONFIG.PLAYER_Z;

    // Poids de poses lissés
    this.slideW = damp(this.slideW, player.sliding ? 1 : 0, 14, dt);
    this.airW = damp(this.airW, player.jumping ? 1 : 0, 12, dt);

    const t = player.runPhase;
    const run = Math.sin(t);
    const bob = Math.abs(Math.cos(t)) * 0.05 * (1 - this.airW) * (1 - this.slideW);
    g.position.y = player.y + bob - this.slideW * 0.52;

    // inclinaison lors des changements de voie + penché en avant en course
    const lean = clamp((CONFIG.LANE_X[player.lane] - player.x) * 0.4, -0.35, 0.35);
    g.rotation.z = damp(g.rotation.z, -lean, 12, dt);

    // pose de course
    const swing = run * 0.85;
    const runLegL = swing, runLegR = -swing;
    const runArmL = -swing * 0.8, runArmR = swing * 0.8;

    // pose aérienne : jambes groupées, bras levés
    const airLegL = -0.9, airLegR = 0.45, airArm = -2.3;

    // pose de glissade : corps basculé en arrière, jambes tendues devant
    const slideBody = -1.25, slideLeg = -1.35, slideArm = -0.6;

    const mix = (runV, airV, slideV) =>
      lerp(lerp(runV, airV, this.airW), slideV, this.slideW);

    this.legL.rotation.x = mix(runLegL, airLegL, slideLeg);
    this.legR.rotation.x = mix(runLegR, airLegR, slideLeg + 0.25);
    this.armL.rotation.x = mix(runArmL, airArm, slideArm);
    this.armR.rotation.x = mix(runArmR, airArm * 0.85, slideArm);
    this.body.rotation.x = mix(0.12, -0.05, slideBody);
    this.body.position.z = this.slideW * 0.25;

    // ombre au sol
    this.shadowMesh.position.set(player.x, 0.02, -CONFIG.PLAYER_Z);
    const sh = clamp(1 - player.y / 3, 0.3, 1);
    this.shadowMesh.scale.set(sh, sh * (1 + this.slideW * 0.7), 1);
    this.shadowMesh.material.opacity = sh;

    // effets
    this.shieldFx.visible = fx.shield;
    if (fx.shield) {
      const p = 1 + Math.sin(performance.now() / 160) * 0.06;
      this.shieldFx.scale.set(p, p * 1.15, p);
    }
    this.boostFx.visible = fx.boost;

    // clignotement d'invulnérabilité
    g.visible = !(player.invincibleT > 0 && Math.floor(performance.now() / 90) % 2 === 0);
  }
}

/* ==========================================================================
   World3D — décor : ciel, sol défilant, murs, immeubles, lampes, tunnels
   ========================================================================== */
class World3D {
  constructor(scene, glowTex) {
    this.scene = scene;
    this.dist = 0;

    /* Ciel (plan lointain, insensible au brouillard) */
    this.sky = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 240),
      new THREE.MeshBasicMaterial({ map: Tex.sky(), fog: false, depthWrite: false })
    );
    this.sky.position.set(0, 55, -250);
    scene.add(this.sky);

    /* Sol + murs : groupe « scroller » décalé de (dist % TILE) pour le défilement */
    this.TILE = 12;
    this.scroller = new THREE.Group();
    scene.add(this.scroller);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 288),
      new THREE.MeshLambertMaterial({ map: Tex.ground() })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -116);
    ground.material.map.repeat.set(1, 288 / this.TILE);
    this.scroller.add(ground);

    const wallTex = Tex.wall();
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 1.1, 288),
        new THREE.MeshLambertMaterial({ map: wallTex })
      );
      wall.position.set(side * 5.1, 0.55, -116);
      this.scroller.add(wall);
    }

    /* Rails : boîtes fines métalliques, statiques */
    const railMat = new THREE.MeshStandardMaterial({ color: 0xaab6d0, metalness: 0.85, roughness: 0.35 });
    for (const lane of CONFIG.LANE_X) {
      for (const off of [-0.72, 0.72]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 288), railMat);
        rail.position.set(lane + off, 0.05, -116);
        scene.add(rail);
      }
    }

    /* Immeubles recyclés (8 par côté) */
    this.buildings = [];
    const facades = ["#232842", "#1e2338", "#2a2440", "#20304a"].map((c) => Tex.facade(c));
    const neonNames = ["NOVA", "VOLT CAFÉ", "RAPID+", "PIXEL BAR", "ORBIT", "KUMO", "LUMA", "DASH 24"];
    const neonCols = ["#00d0ff", "#ff8a2a", "#c084fc", "#ff5c8a"];
    this.BSPAN = 8 * 34;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 8; i++) {
        const h = rand(9, 18);
        const geo = new THREE.BoxGeometry(10, 1, 26);
        const matIn = new THREE.MeshLambertMaterial({
          map: pick(facades),
          emissive: 0xffffff,
          emissiveMap: null,
          emissiveIntensity: 0.55,
        });
        matIn.emissiveMap = matIn.map;
        const plain = new THREE.MeshLambertMaterial({ color: 0x191d30 });
        // face intérieure texturée (index 0 = +x, 1 = -x)
        const mats = [side < 0 ? matIn : plain, side < 0 ? plain : matIn, plain, plain, plain, plain];
        const mesh = new THREE.Mesh(geo, mats);
        mesh.scale.y = h;
        mesh.position.set(side * (11.5 + rand(0, 2.5)), h / 2, 0);

        const grp = new THREE.Group();
        grp.add(mesh);

        // enseigne néon éventuelle
        let sign = null;
        if (Math.random() < 0.5) {
          sign = new THREE.Mesh(
            new THREE.PlaneGeometry(5.5, 1.4),
            new THREE.MeshBasicMaterial({
              map: Tex.neon(pick(neonNames), pick(neonCols)),
              transparent: true, depthWrite: false,
            })
          );
          sign.position.set(side * (11.5 - 5.2), h * 0.55, 0);
          sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          grp.add(sign);
        }

        grp.position.z = -i * 34 - rand(0, 8);
        grp.userData = { mesh, sign, side };
        this.scene.add(grp);
        this.buildings.push(grp);
      }
    }

    /* Lampadaires recyclés */
    this.lamps = [];
    this.LSPAN = 8 * 26;
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 4.6, 8);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f58 });
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const grp = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 2.3;
      grp.add(pole);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffdc96 })
      );
      head.position.y = 4.65;
      grp.add(head);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xffc878, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.set(2.4, 2.4, 1);
      halo.position.y = 4.65;
      grp.add(halo);
      grp.position.set(side * 4.85, 0, -i * 26 - 12);
      scene.add(grp);
      this.lamps.push(grp);
    }

    /* Portiques publicitaires recyclés */
    this.gantries = [];
    this.GSPAN = 2 * 130;
    const adTexts = ["NOVA COLA", "VOLT ⚡ ENERGY", "FLY KICKS", "METRO DASH"];
    for (let i = 0; i < 2; i++) {
      const grp = new THREE.Group();
      const legGeo = new THREE.CylinderGeometry(0.09, 0.12, 4.6, 8);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, poleMat);
        leg.position.set(side * 4.6, 2.3, 0);
        grp.add(leg);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.22, 0.22), poleMat);
      bar.position.y = 4.5;
      grp.add(bar);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 2),
        new THREE.MeshBasicMaterial({ map: Tex.billboard(pick(adTexts)), depthWrite: true })
      );
      panel.position.y = 3.4;
      grp.add(panel);
      grp.position.z = -60 - i * 130;
      scene.add(grp);
      this.gantries.push(grp);
    }

    /* Tunnel néon recyclé (voûte + anneaux) */
    this.TUNNEL_LEN = 60;
    this.tunnel = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(5.8, 5.8, this.TUNNEL_LEN, 24, 1, true, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x14161f, side: THREE.DoubleSide })
    );
    shell.rotation.z = Math.PI / 2;      // axe le long de X → on veut Z
    shell.rotation.y = Math.PI / 2;
    shell.position.y = 0.4;
    this.tunnel.add(shell);
    const ringGeo = new THREE.TorusGeometry(5.3, 0.09, 8, 40, Math.PI);
    for (let i = 0; i < this.TUNNEL_LEN / 6; i++) {
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8b5cf6 : 0x00d0ff })
      );
      ring.position.set(0, 0.4, this.TUNNEL_LEN / 2 - i * 6);
      this.tunnel.add(ring);
    }
    this.tunnel.position.z = -350;
    scene.add(this.tunnel);
    this.tunnelGapMin = 320;
    this.tunnelGapMax = 480;
  }

  reset() {
    this.dist = 0;
  }

  /* Le joueur (caméra) est-il sous la voûte du tunnel ? */
  inTunnel() {
    const z = this.tunnel.position.z;
    return z + this.TUNNEL_LEN / 2 > -CONFIG.PLAYER_Z - 4 && z - this.TUNNEL_LEN / 2 < 2;
  }

  update(dt, speed) {
    const dz = speed * dt;      // le monde avance vers +z (vers la caméra)
    this.dist += dz;

    this.scroller.position.z = this.dist % this.TILE;

    const recycle = (grp, span, rerand) => {
      grp.position.z += dz;
      if (grp.position.z > 20) {
        grp.position.z -= span;
        if (rerand) rerand(grp);
      }
    };

    for (const b of this.buildings) {
      recycle(b, this.BSPAN, (g) => {
        const h = rand(9, 18);
        g.userData.mesh.scale.y = h;
        g.userData.mesh.position.y = h / 2;
        if (g.userData.sign) {
          g.userData.sign.position.y = h * 0.55;
          g.userData.sign.visible = Math.random() < 0.75;
        }
      });
    }
    for (const l of this.lamps) recycle(l, this.LSPAN);
    for (const g of this.gantries) recycle(g, this.GSPAN);

    // tunnel : réapparaît plus loin après son passage
    this.tunnel.position.z += dz;
    if (this.tunnel.position.z - this.TUNNEL_LEN / 2 > 10) {
      this.tunnel.position.z = -rand(this.tunnelGapMin, this.tunnelGapMax);
    }
  }
}

/* ==========================================================================
   FXOverlay — canvas 2D : lignes de vitesse + flashs (au-dessus du rendu 3D)
   ========================================================================== */
class FXOverlay {
  constructor() {
    this.canvas = document.getElementById("fx");
    this.ctx = this.canvas.getContext("2d");
    this.flash = null; // {color, t, dur}
    this.resize();
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  doFlash(color, dur = 0.35) {
    this.flash = { color, t: dur, dur };
  }
  render(dt, speedFx, dying, dieT) {
    const { ctx } = this;
    const w = innerWidth, h = innerHeight;
    ctx.clearRect(0, 0, w, h);

    if (speedFx > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${0.15 * speedFx})`;
      ctx.lineWidth = 2;
      const n = Math.floor(10 * speedFx);
      for (let i = 0; i < n; i++) {
        const y = Math.random() * h;
        const edge = Math.random() < 0.5;
        const x0 = edge ? Math.random() * w * 0.15 : w - Math.random() * w * 0.15;
        const len = rand(30, 100) * speedFx;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + (edge ? -len : len), y);
        ctx.stroke();
      }
    }

    if (this.flash) {
      this.flash.t -= dt;
      if (this.flash.t <= 0) this.flash = null;
      else {
        ctx.fillStyle = this.flash.color;
        ctx.globalAlpha = 0.3 * (this.flash.t / this.flash.dur);
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
    }

    if (dying) {
      ctx.fillStyle = `rgba(255,60,40,${0.25 * dieT})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

/* ==========================================================================
   Game — boucle principale, scène 3D, pools de meshes, états
   ========================================================================== */
class Game {
  constructor() {
    this.ui = new UIManager();
    this.audio = new AudioManager();
    this.player = new Player(this);
    this.spawner = new Spawner(this);
    this.scoreMgr = new ScoreManager();
    this.fx = new FXOverlay();

    this.state = "loading";
    this.fxHigh = localStorage.getItem("metrodash_fx") !== "low";

    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.active = {};

    this.elapsed = 0;
    this.speed = CONFIG.BASE_SPEED;
    this.timescale = 1;
    this.shakeT = 0;
    this.dieT = 0;

    this.initThree();
    this.initPools();

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.input = new InputManager(document.getElementById("game"), {
      left: () => this.state === "playing" && this.player.moveLane(-1),
      right: () => this.state === "playing" && this.player.moveLane(1),
      jump: () => this.state === "playing" && this.player.jump(),
      slide: () => this.state === "playing" && this.player.slide(),
      pause: () => this.togglePause(),
    });
    this.bindUI();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") this.togglePause();
    });

    this.last = performance.now();
    this.renderer.setAnimationLoop((t) => this.loop(t));
    setTimeout(() => this.toMenu(), 500);
  }

  /* ------------------------------ scène 3D ------------------------------ */
  initThree() {
    const canvas = document.getElementById("game");
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.fogNormal = new THREE.Color(0x33224e);
    this.fogTunnel = new THREE.Color(0x0a0c14);
    this.scene.fog = new THREE.Fog(this.fogNormal.clone(), 35, 130);

    this.camera = new THREE.PerspectiveCamera(63, 1, 0.1, 400);
    this.camera.position.set(0, 3.35, 0);

    // Éclairage crépusculaire : dôme violet + soleil orange bas + rebond bleu
    this.hemi = new THREE.HemisphereLight(0x8a6ac9, 0x2a2436, 0.95);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffa050, 1.15);
    this.sun.position.set(4, 6, -40);
    this.scene.add(this.sun);
    const rim = new THREE.DirectionalLight(0x4a6aff, 0.35);
    rim.position.set(-6, 8, 12);
    this.scene.add(rim);

    this.glowTex = Tex.glow();
    this.blobTex = Tex.blob();
    this.world = new World3D(this.scene, this.glowTex);
    this.rig = new PlayerRig(this.scene, this.glowTex, this.blobTex);
  }

  /* -------------------- pools de meshes pour les entités -------------------- */
  initPools() {
    const D = OBSTACLE_DEFS;

    /* Barrière */
    const barrierTex = Tex.barrier();
    const mkBarrier = () => {
      const grp = new THREE.Group();
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(D.barrier.w, 0.5, 0.16),
        new THREE.MeshLambertMaterial({ map: barrierTex })
      );
      panel.position.y = 0.75;
      grp.add(panel);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x454b68 });
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.09), legMat);
        leg.position.set(s * (D.barrier.w / 2 - 0.15), 0.27, 0);
        grp.add(leg);
      }
      return grp;
    };

    /* Panneau suspendu */
    const signTex = Tex.signPanel();
    const mkSign = () => {
      const grp = new THREE.Group();
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x454b68 });
      for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8), poleMat);
        pole.position.set(s * D.sign.w / 2, 1.3, 0);
        grp.add(pole);
      }
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(D.sign.w, D.sign.h, 0.12),
        new THREE.MeshLambertMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.7 })
      );
      panel.position.y = D.sign.gapBottom + D.sign.h / 2;
      grp.add(panel);
      return grp;
    };

    /* Caisse */
    const crateTexs = [Tex.crate("#8b5cf6", "DASH"), Tex.crate("#4a5178", "ZONE"), Tex.crate("#6d3fd6", "VLT")];
    const mkCrate = () => {
      const tex = pick(crateTexs);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(D.crate.w, D.crate.h, D.crate.d),
        new THREE.MeshLambertMaterial({ map: tex })
      );
      mesh.position.y = D.crate.h / 2;
      const grp = new THREE.Group();
      grp.add(mesh);
      return grp;
    };

    /* Wagon */
    const wagonSkins = [
      { side: Tex.wagonSide(["#5d9aff", "#2f7bff", "#1f5cd0"]), front: Tex.wagonFront(["#5d9aff", "#2f7bff", "#1f5cd0"]) },
      { side: Tex.wagonSide(["#4c548a", "#39406b", "#2b3050"]), front: Tex.wagonFront(["#4c548a", "#39406b", "#2b3050"]) },
    ];
    const mkWagon = () => {
      const skin = pick(wagonSkins);
      const grp = new THREE.Group();
      const sideMat = new THREE.MeshLambertMaterial({ map: skin.side, emissive: 0xffffff, emissiveMap: skin.side, emissiveIntensity: 0.28 });
      const frontMat = new THREE.MeshLambertMaterial({ map: skin.front, emissive: 0xffffff, emissiveMap: skin.front, emissiveIntensity: 0.28 });
      const topMat = new THREE.MeshLambertMaterial({ color: 0x9aa3bd });
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(D.wagon.w, D.wagon.h - 0.5, D.wagon.d),
        [sideMat, sideMat, topMat, topMat, frontMat, frontMat]
      );
      body.position.y = 0.45 + (D.wagon.h - 0.5) / 2;
      grp.add(body);
      // toit arrondi
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(D.wagon.w / 2, D.wagon.w / 2, D.wagon.d, 14, 1, false, 0, Math.PI),
        topMat
      );
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      // local X → hauteur monde : on aplatit le dôme du toit
      roof.scale.set(0.3, 1, 1);
      roof.position.y = D.wagon.h - 0.05;
      grp.add(roof);
      // bogies
      const bogieMat = new THREE.MeshLambertMaterial({ color: 0x14161f });
      for (const zz of [-D.wagon.d / 2 + 1.4, D.wagon.d / 2 - 1.4]) {
        const bogie = new THREE.Mesh(new THREE.BoxGeometry(D.wagon.w - 0.5, 0.5, 1.8), bogieMat);
        bogie.position.set(0, 0.25, zz);
        grp.add(bogie);
      }
      // halo de phare (face avant = -z, vers le joueur)
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: 0xffe9a8, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      lamp.scale.set(1.1, 1.1, 1);
      lamp.position.set(0, 0.8, -D.wagon.d / 2 - 0.05);
      grp.add(lamp);
      return grp;
    };

    this.factories = { barrier: mkBarrier, sign: mkSign, crate: mkCrate, wagon: mkWagon };
    this.pools = { barrier: [], sign: [], crate: [], wagon: [] };

    /* Pièces : InstancedMesh doré */
    const coinGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 22);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffc93c, metalness: 0.75, roughness: 0.28,
      emissive: 0x92610d, emissiveIntensity: 0.55,
    });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, 128);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinMesh.frustumCulled = false;
    this.coinMesh.count = 0;
    this.scene.add(this.coinMesh);
    this.coinDummy = new THREE.Object3D();
    this.coinDummy.rotation.order = "YXZ";

    /* Power-ups : capsule + icône + halo */
    this.puIconTex = {};
    for (const [k, def] of Object.entries(POWERUP_DEFS)) {
      this.puIconTex[k] = Tex.puIcon(def.label, def.css);
    }
    this.puPool = [];

    /* Particules : pool de sprites additifs */
    this.particles = [];
    this.particlePool = [];
    for (let i = 0; i < 90; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sp.visible = false;
      this.scene.add(sp);
      this.particlePool.push(sp);
    }
  }

  obtainObstacleMesh(o) {
    const pool = this.pools[o.type];
    const mesh = pool.pop() || this.factories[o.type]();
    mesh.visible = true;
    this.scene.add(mesh);
    return mesh;
  }
  releaseObstacleMesh(o) {
    if (!o.mesh) return;
    o.mesh.visible = false;
    this.scene.remove(o.mesh);
    this.pools[o.type].push(o.mesh);
    o.mesh = null;
  }

  obtainPuMesh(pu) {
    let grp = this.puPool.pop();
    if (!grp) {
      grp = new THREE.Group();
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      icon.scale.set(0.9, 0.9, 1);
      grp.add(icon);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.set(2.2, 2.2, 1);
      grp.add(halo);
      grp.userData = { icon, halo };
    }
    grp.userData.icon.material.map = this.puIconTex[pu.kind];
    grp.userData.icon.material.needsUpdate = true;
    grp.userData.halo.material.color.setHex(POWERUP_DEFS[pu.kind].color);
    grp.visible = true;
    this.scene.add(grp);
    return grp;
  }
  releasePuMesh(pu) {
    if (!pu.mesh) return;
    pu.mesh.visible = false;
    this.scene.remove(pu.mesh);
    this.puPool.push(pu.mesh);
    pu.mesh = null;
  }

  /* Particules 3D */
  emit({ x, y, z, count = 8, color = 0xffc93c, speed = 5, size = 0.35, life = 0.5, gravity = -9 }) {
    if (!this.fxHigh) count = Math.ceil(count / 2);
    for (let i = 0; i < count; i++) {
      const sp = this.particlePool.pop();
      if (!sp) return;
      sp.visible = true;
      sp.material.color.setHex(color);
      sp.position.set(x + rand(-0.2, 0.2), y + rand(-0.2, 0.2), z + rand(-0.2, 0.2));
      const a = Math.random() * Math.PI * 2;
      const v = speed * rand(0.4, 1);
      this.particles.push({
        sp,
        vx: Math.cos(a) * v,
        vy: rand(0.3, 1) * speed * 0.8,
        vz: Math.sin(a) * v * 0.4,
        size: size * rand(0.7, 1.4),
        life, maxLife: life, gravity,
      });
    }
  }
  updateParticles(dt, dz) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sp.visible = false;
        this.particlePool.push(p.sp);
        this.particles.splice(i, 1);
        continue;
      }
      p.sp.position.x += p.vx * dt;
      p.sp.position.y += p.vy * dt;
      p.sp.position.z += p.vz * dt + dz; // suit le défilement du monde
      p.vy += p.gravity * dt;
      const a = p.life / p.maxLife;
      const s = p.size * (0.5 + a * 0.5);
      p.sp.scale.set(s, s, 1);
      p.sp.material.opacity = a;
    }
  }

  /* ------------------------------ UI events ------------------------------ */
  bindUI() {
    const $ = this.ui.$;
    $("btn-play").addEventListener("click", () => this.start());
    $("btn-instructions").addEventListener("click", () => this.ui.show("instructions"));
    $("btn-options").addEventListener("click", () => this.ui.show("options"));
    document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => this.ui.show("menu")));

    $("btn-pause").addEventListener("click", () => this.togglePause());
    $("btn-resume").addEventListener("click", () => this.togglePause());
    $("btn-restart").addEventListener("click", () => this.start());
    $("btn-quit").addEventListener("click", () => this.toMenu());
    $("btn-replay").addEventListener("click", () => this.start());
    $("btn-menu").addEventListener("click", () => this.toMenu());

    const soundBtn = $("btn-sound");
    const fxBtn = $("btn-fx");
    const syncOptions = () => {
      soundBtn.textContent = this.audio.muted ? "🔇 Son : coupé" : "🔊 Son : activé";
      fxBtn.textContent = this.fxHigh ? "✨ Effets : élevés" : "✨ Effets : réduits";
    };
    soundBtn.addEventListener("click", () => { this.audio.setMuted(!this.audio.muted); syncOptions(); });
    fxBtn.addEventListener("click", () => {
      this.fxHigh = !this.fxHigh;
      localStorage.setItem("metrodash_fx", this.fxHigh ? "high" : "low");
      this.applyQuality();
      syncOptions();
    });
    $("btn-reset-best").addEventListener("click", () => {
      this.scoreMgr.resetBest();
      this.ui.$("menu-best").textContent = "0";
    });
    syncOptions();
    this.applyQuality();
  }

  applyQuality() {
    const dpr = devicePixelRatio || 1;
    this.renderer.setPixelRatio(this.fxHigh ? Math.min(dpr, 2) : Math.min(dpr, 1.25));
  }

  /* ------------------------------ états ------------------------------ */
  clearEntities() {
    for (const o of this.obstacles) this.releaseObstacleMesh(o);
    for (const p of this.powerups) this.releasePuMesh(p);
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
  }

  toMenu() {
    this.state = "menu";
    this.audio.stopMusic();
    this.ui.setHud(false);
    this.ui.$("menu-best").textContent = this.scoreMgr.best;
    this.ui.show("menu");
    this.resetRun();
  }

  resetRun() {
    this.clearEntities();
    this.active = {};
    this.elapsed = 0;
    this.speed = CONFIG.BASE_SPEED;
    this.timescale = 1;
    this.shakeT = 0;
    this.player.reset();
    this.world.reset();
    this.spawner.reset();
    this.scoreMgr.reset();
    this.ui.updatePowerups({});
  }

  start() {
    this.resetRun();
    this.state = "playing";
    this.ui.show("__none__");
    this.ui.setHud(true);
    this.audio.ensure();
    this.audio.startMusic();
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.audio.stopMusic();
      this.ui.show("pause");
    } else if (this.state === "paused") {
      this.state = "playing";
      this.ui.show("__none__");
      this.audio.startMusic();
      this.last = performance.now();
    }
  }

  die() {
    this.state = "dying";
    this.dieT = 0.9;
    this.timescale = 0.25;
    this.shakeT = 0.55;
    this.audio.crash();
    this.audio.stopMusic();
    this.fx.doFlash("rgba(255,60,40,1)", 0.5);
    this.emit({ x: this.player.x, y: 1, z: -CONFIG.PLAYER_Z, count: 26, color: 0xff8a2a, speed: 7, size: 0.5, life: 0.8 });
    this.emit({ x: this.player.x, y: 1, z: -CONFIG.PLAYER_Z, count: 14, color: 0xf4f6ff, speed: 6, size: 0.35, life: 0.6 });
  }

  finishGameOver() {
    this.state = "gameover";
    this.timescale = 1;
    const score = this.scoreMgr.finalize();
    this.ui.setHud(false);
    this.ui.showGameOver({
      score,
      best: this.scoreMgr.best,
      coins: this.scoreMgr.coins,
      distance: Math.floor(this.world.dist),
      newBest: this.scoreMgr.newBest,
    });
  }

  activate(kind) {
    this.active[kind] = { t: CONFIG.POWERUP_DUR[kind], dur: CONFIG.POWERUP_DUR[kind] };
    this.audio.powerup();
  }
  has(kind) { return !!this.active[kind]; }

  /* ------------------------------ boucle ------------------------------ */
  loop(now) {
    let dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    dt *= this.timescale;

    let dz = 0;
    if (this.state === "menu" || this.state === "loading") {
      this.world.update(dt, 9);
      this.player.runPhase += dt * 9;
      dz = 9 * dt;
    } else if (this.state === "playing") {
      dz = this.update(dt);
    } else if (this.state === "dying") {
      this.dieT -= dt / this.timescale;
      this.shakeT = Math.max(0, this.shakeT - dt);
      if (this.dieT <= 0) this.finishGameOver();
    }

    this.updateParticles(dt, dz);
    this.render(dt);
  }

  update(dt) {
    this.elapsed += dt;

    const target = Math.min(
      CONFIG.BASE_SPEED + Math.floor(this.elapsed / 15) * 0.95 + this.elapsed * 0.02,
      CONFIG.MAX_SPEED
    );
    const boost = this.has("boost") ? 1.55 : 1;
    this.speed = damp(this.speed, target * boost, 1.6, dt);

    const mult = this.has("x2") ? 2 : 1;
    this.scoreMgr.addDistance(this.speed * dt, mult);

    this.player.update(dt);
    this.world.update(dt, this.speed);
    this.spawner.update(dt, this.speed, this.elapsed);

    // Avancement des entités
    const dz = this.speed * dt;
    for (const o of this.obstacles) o.z -= dz;
    for (const c of this.coins) c.z -= dz;
    for (const p of this.powerups) p.z -= dz;

    this.obstacles = this.obstacles.filter((o) => {
      const keep = !o.dead && o.z + o.def.d > CONFIG.KILL_Z;
      if (!keep) this.releaseObstacleMesh(o);
      return keep;
    });
    this.coins = this.coins.filter((c) => !c.dead && c.z > CONFIG.KILL_Z);
    this.powerups = this.powerups.filter((p) => {
      const keep = !p.dead && p.z > CONFIG.KILL_Z;
      if (!keep) this.releasePuMesh(p);
      return keep;
    });

    for (const kind of Object.keys(this.active)) {
      this.active[kind].t -= dt;
      if (this.active[kind].t <= 0) delete this.active[kind];
    }

    // Aimant
    if (this.has("magnet")) {
      for (const c of this.coins) {
        if (c.z < 20) {
          c.x = damp(c.x, this.player.x, 8, dt);
          c.y = damp(c.y, 1.0 + this.player.y, 8, dt);
        }
      }
    }

    // Collecte de pièces
    for (const c of this.coins) {
      const grabR = this.has("magnet") ? 1.6 : 0.95;
      if (Math.abs(c.z - CONFIG.PLAYER_Z) < 1.4 &&
          Math.abs(c.x - this.player.x) < grabR &&
          Math.abs(c.y - (this.player.y + 1.0)) < 1.25) {
        c.dead = true;
        this.scoreMgr.addCoin(mult);
        this.audio.coin();
        this.emit({ x: c.x, y: c.y, z: -c.z, count: 7, color: 0xffc93c, speed: 3.5, size: 0.3, life: 0.45, gravity: -4 });
      }
    }

    // Power-ups
    for (const p of this.powerups) {
      if (Math.abs(p.z - CONFIG.PLAYER_Z) < 1.4 && Math.abs(p.x - this.player.x) < 1.1 && this.player.y < 1.6) {
        p.dead = true;
        this.activate(p.kind);
        this.emit({ x: p.x, y: 1.2, z: -p.z, count: 14, color: POWERUP_DEFS[p.kind].color, speed: 5, size: 0.45, life: 0.6, gravity: -2 });
      }
    }

    // Collisions
    if (this.player.invincibleT <= 0 && !this.has("boost")) {
      const hit = CollisionManager.check(this.player, this.obstacles);
      if (hit) {
        if (this.has("shield")) {
          delete this.active.shield;
          hit.dead = true;
          this.player.invincibleT = 1.2;
          this.shakeT = 0.28;
          this.audio.shieldHit();
          this.fx.doFlash("rgba(0,208,255,1)", 0.3);
          this.emit({ x: hit.x, y: 1, z: -hit.z, count: 16, color: 0x00d0ff, speed: 6, size: 0.45, life: 0.6 });
        } else {
          this.die();
        }
      }
    } else if (this.has("boost")) {
      const hit = CollisionManager.check(this.player, this.obstacles);
      if (hit) {
        hit.dead = true;
        this.shakeT = 0.18;
        this.audio.smash();
        this.emit({ x: hit.x, y: 1.2, z: -hit.z, count: 18, color: 0xff8a2a, speed: 7, size: 0.5, life: 0.7 });
      }
    }

    // Poussière de foulée + traînée de boost
    if (this.fxHigh) {
      if (!this.player.jumping && Math.random() < dt * 18) {
        this.emit({ x: this.player.x + rand(-0.25, 0.25), y: 0.1, z: -CONFIG.PLAYER_Z + rand(-0.4, 0.1), count: 1, color: 0x8890b8, speed: 0.7, size: 0.22, life: 0.4, gravity: 1.5 });
      }
      if (this.has("boost") && Math.random() < dt * 50) {
        this.emit({ x: this.player.x + rand(-0.3, 0.3), y: rand(0.3, 1.6) + this.player.y, z: -CONFIG.PLAYER_Z + 0.5, count: 1, color: pick([0xff8a2a, 0xffc93c]), speed: 1.2, size: 0.4, life: 0.5, gravity: 0 });
      }
    }

    this.shakeT = Math.max(0, this.shakeT - dt);
    this.ui.updateHud(this.scoreMgr.score, this.scoreMgr.coins, this.scoreMgr.best);
    this.ui.updatePowerups(this.active);
    return dz;
  }

  /* ------------------------------ rendu ------------------------------ */
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.baseFov = h > w ? 74 : 62;
    this.camera.updateProjectionMatrix();
    this.fx.resize();
    this.applyQuality();
  }

  syncEntityMeshes() {
    // Obstacles
    for (const o of this.obstacles) {
      if (!o.mesh) o.mesh = this.obtainObstacleMesh(o);
      o.mesh.position.set(o.x, 0, -(o.z + o.def.d / 2));
    }
    // Pièces (instanciées)
    let n = 0;
    const spin = performance.now() / 260;
    for (const c of this.coins) {
      if (n >= 128 || c.z > 100) continue;
      this.coinDummy.position.set(c.x, c.y, -c.z);
      this.coinDummy.rotation.set(Math.PI / 2, spin + c.spin, 0);
      this.coinDummy.updateMatrix();
      this.coinMesh.setMatrixAt(n++, this.coinDummy.matrix);
    }
    this.coinMesh.count = n;
    this.coinMesh.instanceMatrix.needsUpdate = true;
    // Power-ups
    const now = performance.now() / 300;
    for (const p of this.powerups) {
      if (!p.mesh) p.mesh = this.obtainPuMesh(p);
      p.mesh.position.set(p.x, 1.2 + Math.sin(now + p.bob) * 0.15, -p.z);
      const pulse = 1 + Math.sin(now * 2 + p.bob) * 0.08;
      p.mesh.userData.halo.scale.set(2.2 * pulse, 2.2 * pulse, 1);
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const targetX = p.x * 0.45;
    this.camera.position.x = damp(this.camera.position.x, targetX, 6, dt);
    this.camera.position.y = damp(this.camera.position.y, 3.35 + p.y * 0.22, 8, dt);

    // FOV dynamique : la vitesse « étire » la perspective
    const speedK = clamp((this.speed - CONFIG.BASE_SPEED) / (CONFIG.MAX_SPEED - CONFIG.BASE_SPEED), 0, 1);
    const targetFov = this.baseFov + speedK * 9 + (this.has("boost") ? 7 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, targetFov, 4, dt);
      this.camera.updateProjectionMatrix();
    }

    // secousse
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      const a = this.shakeT * 0.28;
      sx = rand(-a, a);
      sy = rand(-a, a);
    }
    this.camera.position.x += sx;
    this.camera.position.y += sy;
    this.camera.lookAt(p.x * 0.72 + sx * 0.5, 1.1 + p.y * 0.3, -16);
  }

  render(dt) {
    // ambiance tunnel : brouillard + lumière assombris
    const tun = this.world.inTunnel() ? 1 : 0;
    this.tunnelK = damp(this.tunnelK ?? 0, tun, 3, dt);
    this.scene.fog.color.lerpColors(this.fogNormal, this.fogTunnel, this.tunnelK);
    this.scene.fog.near = lerp(35, 14, this.tunnelK);
    this.scene.fog.far = lerp(130, 70, this.tunnelK);
    this.hemi.intensity = lerp(0.95, 0.45, this.tunnelK);
    this.sun.intensity = lerp(1.15, 0.2, this.tunnelK);
    this.sky.visible = this.tunnelK < 0.85;

    this.syncEntityMeshes();
    this.rig.update(this.player, dt, { shield: this.has("shield"), boost: this.has("boost") });
    this.rig.group.visible = this.state !== "gameover" && this.rig.group.visible;
    this.updateCamera(dt);

    this.renderer.render(this.scene, this.camera);

    // overlay 2D : lignes de vitesse + flashs
    const speedFx = this.state === "playing" || this.state === "dying"
      ? clamp((this.speed - 20) / 14, 0, 1) + (this.has("boost") ? 0.5 : 0)
      : 0;
    this.fx.render(dt, this.fxHigh ? speedFx : 0, this.state === "dying", this.dieT / 0.9);
  }

  get sky() { return this.world.sky; }
}

/* --------------------------------------------------------------------------
   Lancement (avec garde WebGL)
   -------------------------------------------------------------------------- */
function boot() {
  try {
    window.metroDash = new Game();
  } catch (err) {
    console.error(err);
    const msg = document.getElementById("loading-msg");
    if (msg) msg.textContent = "⚠️ WebGL indisponible sur cet appareil — impossible de lancer le jeu.";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
