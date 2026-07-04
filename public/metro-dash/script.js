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
  thud()    { this.noise({ dur: 0.12, vol: 0.28, freq: 220 }); }
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
    this.justLanded = false;
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
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.jumping = false; this.justLanded = true; }
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


/* Boîte aux angles arrondis (pour les objets colorés unis ; les textures
   détaillées sont posées en décalques plans par-dessus). */
function roundedBoxGeo(w, h, d, r, smooth = 3) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const shape = new THREE.Shape();
  const x = w / 2 - r, y = h / 2 - r;
  shape.absarc(x, y, r, 0, Math.PI / 2);
  shape.absarc(-x, y, r, Math.PI / 2, Math.PI);
  shape.absarc(-x, -y, r, Math.PI, Math.PI * 1.5);
  shape.absarc(x, -y, r, Math.PI * 1.5, Math.PI * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - r * 2, steps: 1, curveSegments: smooth * 2,
    bevelEnabled: true, bevelSegments: smooth, bevelSize: r, bevelThickness: r,
  });
  geo.center();
  return geo;
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
      // lune avec cratères et halo
      const mx = w * 0.78, my = h * 0.18, mr = 26;
      const mh = g.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.2);
      mh.addColorStop(0, "rgba(210,220,255,0.5)");
      mh.addColorStop(1, "rgba(210,220,255,0)");
      g.fillStyle = mh;
      g.fillRect(mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4);
      g.fillStyle = "#e8ecff";
      g.beginPath();
      g.arc(mx, my, mr, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(160,170,210,0.5)";
      for (const [cx2, cy2, cr] of [[-8, -4, 5], [7, 6, 7], [4, -9, 3.5], [-4, 10, 3]]) {
        g.beginPath();
        g.arc(mx + cx2, my + cy2, cr, 0, Math.PI * 2);
        g.fill();
      }
      // bancs de nuages fins
      g.fillStyle = "rgba(90,60,110,0.35)";
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        g.ellipse(Math.random() * w, HOR * (0.35 + Math.random() * 0.5), rand(120, 340), rand(6, 14), 0, 0, Math.PI * 2);
        g.fill();
      }
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

  /* Silhouettes de gratte-ciel intermédiaires (couche de parallaxe) */
  skyline() {
    return makeTexture(1024, 160, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      let x = 0;
      while (x < w) {
        const bw = rand(30, 80), bh = rand(40, 140);
        g.fillStyle = "#221a3f";
        g.fillRect(x, h - bh, bw, bh);
        g.fillStyle = "rgba(255,200,120,0.35)";
        for (let i = 0; i < bw * bh * 0.0012; i++) {
          g.fillRect(x + rand(3, bw - 5), h - bh + rand(3, bh - 6), 2, 3);
        }
        if (Math.random() < 0.25) {
          g.fillStyle = pick(["#00d0ff", "#ff5c8a", "#ffc93c"]);
          g.fillRect(x + 4, h - bh - 4, bw - 8, 3);
        }
        x += bw + rand(6, 30);
      }
    });
  },

  /* Vitrine de boutique éclairée (rez-de-chaussée des immeubles) */
  shopWindow() {
    return makeTexture(512, 170, (g, w, h) => {
      g.fillStyle = "#182338";
      g.fillRect(0, 0, w, h);
      const glow2 = g.createLinearGradient(0, 0, 0, h);
      glow2.addColorStop(0, "rgba(255,214,150,0.9)");
      glow2.addColorStop(1, "rgba(255,180,110,0.55)");
      g.fillStyle = glow2;
      g.fillRect(10, 14, w - 20, h - 34);
      g.fillStyle = "#10131f";
      for (let x = 10; x <= w - 12; x += (w - 20) / 4) g.fillRect(x, 14, 8, h - 34);
      g.fillStyle = "rgba(20,24,40,0.8)";
      for (let i = 0; i < 8; i++) {
        const bx = 26 + i * 58, bh2 = rand(20, 50);
        g.fillRect(bx, h - 26 - bh2, 26, bh2);
      }
      g.fillStyle = "rgba(0,0,0,0.4)";
      g.fillRect(0, h - 16, w, 16);
    });
  },

  /* Façade lumineuse de distributeur automatique */
  vending() {
    return makeTexture(128, 256, (g, w, h) => {
      g.fillStyle = "#16305a";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(120,200,255,0.85)";
      g.fillRect(12, 14, w - 24, h * 0.55);
      g.fillStyle = "#10131f";
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          g.fillRect(18 + c * 32, 22 + r * 42, 24, 32);
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++)
          if (Math.random() < 0.7) {
            g.fillStyle = pick(["#ff5c8a", "#ffc93c", "#00e08a"]);
            g.fillRect(22 + c * 32, 28 + r * 42, 16, 20);
          }
      g.fillStyle = "#0d1626";
      g.fillRect(12, h * 0.62, w - 24, 34);
    });
  },

  /* Tache douce pour les flaques réfléchissant les néons */
  puddle() {
    return makeTexture(128, 128, (g, w, h) => {
      const grad = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      grad.addColorStop(0, "rgba(255,255,255,0.9)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.3)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
  },

  /* Enseigne suspendue de la station */
  stationSign() {
    return makeTexture(512, 96, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = "#101a2e";
      g.beginPath();
      g.roundRect(2, 2, w - 4, h - 4, 18);
      g.fill();
      g.strokeStyle = "#ffc93c";
      g.lineWidth = 5;
      g.stroke();
      g.font = "900 44px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = "#ffc93c";
      g.shadowBlur = 14;
      g.fillStyle = "#ffe9a8";
      g.fillText("Ⓜ STATION NOVA", w / 2, h / 2);
    });
  },

  /* Paroi de tunnel : panneaux boulonnés, câbles, bandes de danger */
  tunnelWall() {
    return makeTexture(512, 256, (g, w, h) => {
      g.fillStyle = "#171a26";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(0,0,0,0.5)";
      g.lineWidth = 3;
      for (let x = 0; x < w; x += 86) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
      }
      g.strokeStyle = "#2a3046";
      g.lineWidth = 5;
      for (const y of [h * 0.2, h * 0.28]) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      }
      for (let x = 0; x < w; x += 40) {
        g.fillStyle = (x / 40) % 2 ? "#d9a92e" : "#181818";
        g.fillRect(x, h - 22, 40, 12);
      }
      for (let i = 0; i < 26; i++) {
        g.fillStyle = `rgba(0,0,0,${rand(0.08, 0.2)})`;
        g.beginPath();
        g.ellipse(Math.random() * w, Math.random() * h, rand(12, 44), rand(6, 16), 0, 0, Math.PI * 2);
        g.fill();
      }
    });
  },
};

/* ==========================================================================
   PlayerRig — coureur organique : silhouette entièrement arrondie
   (capsules + sphères d'articulation), matériaux PBR, respiration,
   cycle de course avec genoux/coudes, squash d'atterrissage, poses fondues.
   ========================================================================== */
class PlayerRig {
  constructor(scene, glowTex, blobTex) {
    this.group = new THREE.Group();
    scene.add(this.group);

    /* Matériaux PBR : peau satinée, textile mat, sneakers semi-brillantes */
    const S = (c, rough = 0.85, metal = 0) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
    const skin = S(0xe8b087, 0.55);
    const jacket = S(0xff8a2a, 0.8);
    const jacketD = S(0xd96f14, 0.8);
    const pants = S(0x2c3150, 0.9);
    const pantsD = S(0x222744, 0.9);
    const shoe = S(0xf4f6ff, 0.45);
    const sole = S(0x20242f, 0.6);
    const bag = S(0x7c4ce0, 0.75);
    const bagD = S(0x5f35c4, 0.75);
    const capM = S(0x2f7bff, 0.7);
    const hair = S(0x503a28, 0.95);

    const caps = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 18), m);
    const sph = (r, m, ws = 22, hs = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m);
    const cyl = (r1, r2, hgt, m, seg = 18) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, hgt, seg), m);

    /* ----- bassin : ellipsoïde souple ----- */
    this.pelvisG = new THREE.Group();
    this.pelvisG.position.y = 0.98;
    this.group.add(this.pelvisG);
    const pelvis = sph(0.19, pantsD);
    pelvis.scale.set(1.05, 0.72, 0.82);
    pelvis.position.y = -0.05;
    this.pelvisG.add(pelvis);

    /* ----- torse : capsule galbée + épaules rondes ----- */
    this.torso = new THREE.Group();
    this.torso.position.y = 0.02;
    this.pelvisG.add(this.torso);
    this.chest = caps(0.2, 0.26, jacket);
    this.chest.scale.set(1.14, 1, 0.86);
    this.chest.position.y = 0.32;
    this.torso.add(this.chest);
    for (const s of [-1, 1]) {                        // épaules
      const shoulder = sph(0.105, jacket);
      shoulder.position.set(0.23 * s, 0.5, 0);
      this.torso.add(shoulder);
    }
    const collar = cyl(0.115, 0.135, 0.07, jacketD);  // col de la veste
    collar.position.y = 0.56;
    this.torso.add(collar);
    const hood = sph(0.15, jacketD);                  // capuche roulée
    hood.scale.set(1, 0.6, 0.85);
    hood.position.set(0, 0.52, 0.17);
    this.torso.add(hood);

    /* sac à dos arrondi + poche + gourde */
    const pack = new THREE.Mesh(roundedBoxGeo(0.34, 0.44, 0.17, 0.06), bag);
    pack.position.set(0, 0.3, 0.26);
    this.torso.add(pack);
    const pocket = new THREE.Mesh(roundedBoxGeo(0.22, 0.16, 0.06, 0.03), bagD);
    pocket.position.set(0, 0.18, 0.36);
    this.torso.add(pocket);
    const bottle = cyl(0.045, 0.045, 0.2, S(0x9adcff, 0.3), 14);
    bottle.position.set(0.2, 0.28, 0.3);
    this.torso.add(bottle);
    for (const s of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.024, 8, 18, Math.PI * 1.1), bagD);
      strap.position.set(0.13 * s, 0.38, 0.1);
      strap.rotation.y = Math.PI / 2;
      strap.rotation.z = -0.25;
      this.torso.add(strap);
    }

    /* ----- cou + tête ronde, casquette galbée, casque audio ----- */
    const neck = cyl(0.065, 0.075, 0.09, skin, 14);
    neck.position.y = 0.6;
    this.torso.add(neck);
    this.headG = new THREE.Group();
    this.headG.position.y = 0.64;
    this.torso.add(this.headG);
    const head = sph(0.175, skin, 26, 20);
    head.position.y = 0.1;
    head.scale.set(0.94, 1, 0.98);
    this.headG.add(head);
    const hairC = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hair);
    hairC.position.y = 0.1;
    this.headG.add(hairC);
    const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.185, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), capM);
    capDome.position.y = 0.12;
    this.headG.add(capDome);
    const capRim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 8, 24), capM);
    capRim.position.y = 0.2;
    capRim.rotation.x = Math.PI / 2;
    this.headG.add(capRim);
    const brim = sph(0.12, capM, 18, 10);              // visière : ellipsoïde plat
    brim.scale.set(1.1, 0.16, 1.4);
    brim.position.set(0, 0.19, -0.2);
    this.headG.add(brim);
    for (const s of [-1, 1]) {                          // écouteurs ronds
      const cup = cyl(0.055, 0.05, 0.045, bagD, 16);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(0.17 * s, 0.08, 0);
      this.headG.add(cup);
      const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.014, 8, 14), S(0x2a2140, 0.95));
      cushion.rotation.y = Math.PI / 2;
      cushion.position.set(0.155 * s, 0.08, 0);
      this.headG.add(cushion);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.02, 8, 22, Math.PI), bagD);
    band.position.y = 0.09;
    this.headG.add(band);

    /* ----- bras : articulation sphérique visible à chaque jointure ----- */
    const mkArm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(0.26 * side, 0.5, 0);
      this.torso.add(sh);
      const up = caps(0.06, 0.16, jacket);
      up.position.y = -0.13;
      sh.add(up);
      const elbowBall = sph(0.06, jacketD);
      elbowBall.position.y = -0.27;
      sh.add(elbowBall);
      const el = new THREE.Group();
      el.position.y = -0.27;
      sh.add(el);
      const fo = caps(0.05, 0.15, jacketD);
      fo.position.y = -0.12;
      el.add(fo);
      const wrist = sph(0.045, skin);
      wrist.position.y = -0.22;
      el.add(wrist);
      const hand = sph(0.058, skin);
      hand.scale.set(0.9, 1.15, 0.75);
      hand.position.y = -0.28;
      el.add(hand);
      return { sh, el };
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);

    /* ----- jambes : hanche/genou/cheville sphériques + sneakers galbées ----- */
    const mkLeg = (side, thighMat) => {
      const hip = new THREE.Group();
      hip.position.set(0.12 * side, 0.98, 0);
      this.group.add(hip);
      const hipBall = sph(0.09, pantsD);
      hipBall.position.y = -0.02;
      hip.add(hipBall);
      const th = caps(0.082, 0.22, thighMat);
      th.position.y = -0.19;
      hip.add(th);
      const kneeBall = sph(0.072, pantsD);
      kneeBall.position.y = -0.42;
      hip.add(kneeBall);
      const kn = new THREE.Group();
      kn.position.y = -0.42;
      hip.add(kn);
      const shn = caps(0.06, 0.22, pantsD);
      shn.position.y = -0.18;
      kn.add(shn);
      const ankle = sph(0.05, pantsD);
      ankle.position.y = -0.4;
      kn.add(ankle);
      const foot = new THREE.Group();
      foot.position.y = -0.44;
      kn.add(foot);
      const sneak = sph(0.085, shoe, 20, 14);          // chaussure : ellipsoïde
      sneak.scale.set(0.95, 0.62, 1.9);
      sneak.position.set(0, -0.015, -0.06);
      foot.add(sneak);
      const soleM = new THREE.Mesh(roundedBoxGeo(0.15, 0.045, 0.3, 0.02), sole);
      soleM.position.set(0, -0.065, -0.05);
      foot.add(soleM);
      return { hip, kn, foot };
    };
    this.legL = mkLeg(-1, pants);
    this.legR = mkLeg(1, S(0x343a5e, 0.9));

    /* le personnage projette de vraies ombres */
    this.group.traverse((m) => { if (m.isMesh) m.castShadow = true; });

    /* ombre douce d'appoint (renforce l'ancrage au sol) */
    this.shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.1),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.5, depthWrite: false })
    );
    this.shadowMesh.rotation.x = -Math.PI / 2;
    scene.add(this.shadowMesh);

    /* aura bouclier */
    this.shieldFx = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x00d0ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.shieldFx.visible = false;
    this.shieldFx.position.y = 1.0;
    this.group.add(this.shieldFx);

    /* halo boost */
    this.boostFx = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff8a2a, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.boostFx.scale.set(2.6, 2.6, 1);
    this.boostFx.position.y = 1.0;
    this.boostFx.visible = false;
    this.group.add(this.boostFx);

    this.slideW = 0;
    this.airW = 0;
    this.squashT = 0;
  }

  /* déclenché par le jeu à l'atterrissage d'un saut */
  land() { this.squashT = 0.16; }

  update(player, dt, fx, speedK = 0) {
    const g = this.group;
    const now = performance.now();
    g.position.x = player.x;
    g.position.z = -CONFIG.PLAYER_Z;

    this.slideW = damp(this.slideW, player.sliding ? 1 : 0, 14, dt);
    this.airW = damp(this.airW, player.jumping ? 1 : 0, 12, dt);
    const slideW = this.slideW, airW = this.airW;
    const ground = (1 - airW) * (1 - slideW);

    const t = player.runPhase;
    const bob = Math.abs(Math.cos(t)) * 0.05 * ground;
    g.position.y = player.y + bob - slideW * 0.55;

    /* respiration : la cage thoracique se dilate doucement */
    const breath = 1 + Math.sin(now / 850) * 0.022;
    this.chest.scale.set(1.14 * breath, 1, 0.86 * breath);

    /* squash d'atterrissage : compression puis rebond */
    if (this.squashT > 0) {
      this.squashT -= dt;
      const k = Math.max(this.squashT, 0) / 0.16;
      const sq = Math.sin(k * Math.PI) * 0.2;
      g.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
    } else {
      g.scale.set(1, 1, 1);
    }

    /* inclinaison dans les virages */
    const lean = clamp((CONFIG.LANE_X[player.lane] - player.x) * 0.4, -0.35, 0.35);
    g.rotation.z = damp(g.rotation.z, -lean, 12, dt);
    g.rotation.y = damp(g.rotation.y, lean * 0.5, 10, dt);

    /* ---- cycle de course : hanche + genou + cheville ---- */
    const legCycle = (p) => ({
      thigh: Math.sin(p) * (0.85 + speedK * 0.25),
      shin: Math.max(0, Math.sin(p - 1.5)) * 1.5 + 0.12,
      foot: Math.max(0, -Math.sin(p - 0.5)) * 0.45 - 0.1,
    });
    const airL = { thigh: -1.05, shin: 1.7, foot: 0.3 };
    const airR = { thigh: 0.5, shin: 0.55, foot: -0.3 };
    const slideL = { thigh: -1.5, shin: 0.25, foot: 0.1 };
    const slideR = { thigh: -1.15, shin: 0.7, foot: 0.1 };

    const mixPose = (run, air, slide) =>
      lerp(lerp(run, air, airW), slide, slideW);

    const cL = legCycle(t), cR = legCycle(t + Math.PI);
    this.legL.hip.rotation.x = mixPose(cL.thigh, airL.thigh, slideL.thigh);
    this.legL.kn.rotation.x = mixPose(cL.shin, airL.shin, slideL.shin);
    this.legL.foot.rotation.x = mixPose(cL.foot, airL.foot, slideL.foot);
    this.legR.hip.rotation.x = mixPose(cR.thigh, airR.thigh, slideR.thigh);
    this.legR.kn.rotation.x = mixPose(cR.shin, airR.shin, slideR.shin);
    this.legR.foot.rotation.x = mixPose(cR.foot, airR.foot, slideR.foot);

    /* jambes suivent le bassin en glissade */
    this.legL.hip.position.y = 0.98 - slideW * 0.55;
    this.legR.hip.position.y = 0.98 - slideW * 0.55;
    this.legL.hip.position.z = slideW * -0.15;
    this.legR.hip.position.z = slideW * -0.15;

    /* ---- bras : balancement opposé + coude vivant ---- */
    const armSwing = Math.sin(t + Math.PI) * (0.7 + speedK * 0.2);
    const elbowRun = -0.85 - Math.max(0, Math.sin(t + Math.PI)) * 0.35;
    const elbowRunR = -0.85 - Math.max(0, Math.sin(t)) * 0.35;
    this.armL.sh.rotation.x = mixPose(armSwing, -2.4, -0.5);
    this.armR.sh.rotation.x = mixPose(-armSwing, -2.1, -0.7);
    this.armL.el.rotation.x = mixPose(elbowRun, -0.4, -0.5);
    this.armR.el.rotation.x = mixPose(elbowRunR, -0.5, -0.4);
    this.armL.sh.rotation.z = 0.12 + slideW * 0.5;
    this.armR.sh.rotation.z = -0.12 - slideW * 0.5;

    /* ---- torse penché, contre-rotation, tête stabilisée + micro-vie ---- */
    this.pelvisG.rotation.x = mixPose(0.14 + speedK * 0.12, -0.02, -1.3);
    this.torso.rotation.y = Math.sin(t) * 0.1 * ground;
    this.headG.rotation.x = -this.pelvisG.rotation.x * 0.55 + Math.sin(now / 1400) * 0.03;
    this.headG.rotation.y = -this.torso.rotation.y * 0.6 + Math.sin(now / 2300) * 0.05;

    /* ombre d'appoint */
    this.shadowMesh.position.set(player.x, 0.02, -CONFIG.PLAYER_Z);
    const sh = clamp(1 - player.y / 3, 0.3, 1);
    this.shadowMesh.scale.set(sh, sh * (1 + slideW * 0.7), 1);
    this.shadowMesh.material.opacity = sh * 0.5;

    /* effets d'état */
    this.shieldFx.visible = fx.shield;
    if (fx.shield) {
      const p = 1 + Math.sin(now / 160) * 0.06;
      this.shieldFx.scale.set(p, p * 1.15, p);
    }
    this.boostFx.visible = fx.boost;

    g.visible = !(player.invincibleT > 0 && Math.floor(now / 90) % 2 === 0);
  }
}

/* ==========================================================================
   World3D — ville ultra détaillée : ciel + skyline parallaxe, sol défilant,
   murs graffés, immeubles (balcons, toits équipés, vitrines, enseignes),
   lampadaires, portiques, câbles suspendus, mobilier urbain, flaques néon,
   poussière atmosphérique, drone, station de métro, tunnel équipé.
   Tous les éléments sont recyclés en boucle (aucune allocation en jeu).
   ========================================================================== */
class World3D {
  constructor(scene, glowTex) {
    this.scene = scene;
    this.dist = 0;
    this.detail = [];        // objets masqués en qualité « réduite »

    const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
    this.matPole = lambert(0x3a3f58);
    this.matDark = lambert(0x272d4a);
    this.matMetal = lambert(0x6a7290);

    /* ---------- ciel + skyline parallaxe ---------- */
    this.sky = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 240),
      new THREE.MeshBasicMaterial({ map: Tex.sky(), fog: false, depthWrite: false })
    );
    this.sky.position.set(0, 55, -250);
    scene.add(this.sky);

    this.skyline = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 60),
      new THREE.MeshBasicMaterial({ map: Tex.skyline(), transparent: true, fog: false, depthWrite: false })
    );
    this.skyline.position.set(0, 18, -160);
    scene.add(this.skyline);

    /* ---------- sol + murs défilants ---------- */
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
    ground.receiveShadow = true;
    this.scroller.add(ground);

    const wallTex = Tex.wall();
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 1.1, 288),
        new THREE.MeshLambertMaterial({ map: wallTex })
      );
      wall.position.set(side * 5.1, 0.55, -116);
      wall.receiveShadow = true;
      this.scroller.add(wall);
      /* couvre-mur arrondi */
      const coping = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 288, 12),
        new THREE.MeshLambertMaterial({ color: 0x4a5070 })
      );
      coping.rotation.x = Math.PI / 2;
      coping.position.set(side * 5.1, 1.12, -116);
      this.scroller.add(coping);
    }

    /* rails métalliques continus */
    const railMat = new THREE.MeshStandardMaterial({ color: 0xaab6d0, metalness: 0.85, roughness: 0.35 });
    for (const lane of CONFIG.LANE_X) {
      for (const off of [-0.72, 0.72]) {
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 288, 10), railMat);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(lane + off, 0.06, -116);
        scene.add(rail);
      }
    }

    /* ---------- immeubles détaillés (8 par côté, recyclés) ---------- */
    this.buildings = [];
    const facades = ["#232842", "#1e2338", "#2a2440", "#20304a"].map((c) => Tex.facade(c));
    const neonNames = ["NOVA", "VOLT CAFÉ", "RAPID+", "PIXEL BAR", "ORBIT", "KUMO", "LUMA", "DASH 24"];
    const neonCols = ["#00d0ff", "#ff8a2a", "#c084fc", "#ff5c8a"];
    const awningCols = [0xff5c8a, 0x00b8e0, 0xff8a2a, 0x8b5cf6];
    this.BSPAN = 8 * 34;

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 8; i++) {
        const grp = new THREE.Group();
        const h = rand(9, 18);
        const inX = 11.5 + rand(0, 2.5);

        /* corps du bâtiment */
        const matIn = new THREE.MeshLambertMaterial({
          map: pick(facades), emissive: 0xffffff, emissiveIntensity: 0.85,
        });
        matIn.emissiveMap = matIn.map;
        const mats = [side < 0 ? matIn : this.matDark, side < 0 ? this.matDark : matIn,
          this.matDark, this.matDark, this.matDark, this.matDark];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 26), mats);
        mesh.scale.y = h;
        mesh.position.set(side * inX, h / 2, 0);
        grp.add(mesh);

        /* enseigne néon murale (matériau cloné pour le grésillement) */
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(5.5, 1.4),
          new THREE.MeshBasicMaterial({
            map: Tex.neon(pick(neonNames), pick(neonCols)),
            transparent: true, depthWrite: false,
          })
        );
        sign.position.set(side * (inX - 5.2), h * 0.55, 0);
        sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        sign.userData.flickAt = performance.now() + rand(2000, 9000);
        grp.add(sign);

        /* balcons (3 rangées de dalles fines sur la face intérieure) */
        const balconies = new THREE.Group();
        for (let b = 0; b < 3; b++) {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 5.5), this.matDark);
          slab.position.set(side * (inX - 5.3), 0, -7 + b * 7);
          const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 5.5), this.matMetal);
          rail2.position.set(side * (inX - 5.65), 0.28, -7 + b * 7);
          balconies.add(slab, rail2);
        }
        grp.add(balconies);
        this.detail.push(balconies);

        /* toit : citerne + clim + antenne */
        const roof = new THREE.Group();
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 10), this.matMetal);
        tank.position.set(side * (inX - 2), 0.9, -6);
        const ac = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.2), this.matDark);
        ac.position.set(side * (inX + 1), 0.35, 4);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 2.6, 6), this.matPole);
        mast.position.set(side * inX, 1.3, 8);
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
        beacon.position.set(side * inX, 2.62, 8);
        roof.add(tank, ac, mast, beacon);
        grp.add(roof);
        grp.userData.roof = roof;
        this.detail.push(roof);

        /* rez-de-chaussée : vitrine + auvent + porte */
        const shop = new THREE.Group();
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(6, 2),
          new THREE.MeshBasicMaterial({ map: Tex.shopWindow(), fog: true })
        );
        win.position.set(side * (inX - 5.05), 1.25, 2);
        win.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        const awn = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 6.2), lambert(pick(awningCols)));
        awn.position.set(side * (inX - 5.5), 2.5, 2);
        awn.rotation.z = side * 0.28;
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.1, 1.1), this.matDark);
        door.position.set(side * (inX - 5.02), 1.05, -6.5);
        shop.add(win, awn, door);
        grp.add(shop);
        this.detail.push(shop);

        grp.position.z = -i * 34 - rand(0, 8);
        grp.userData = { ...grp.userData, mesh, sign, side, inX };
        scene.add(grp);
        this.buildings.push(grp);
      }
    }

    /* ---------- lampadaires ---------- */
    this.lamps = [];
    this.LSPAN = 8 * 26;
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 4.6, 8);
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const grp = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, this.matPole);
      pole.position.y = 2.3;
      grp.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), this.matPole);
      arm.position.set(0, 4.55, -side * 0 + 0);
      arm.position.x = -side * 0.4;
      arm.rotation.y = Math.PI / 2;
      grp.add(arm);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffdc96 }));
      head.position.set(-side * 0.75, 4.5, 0);
      grp.add(head);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xffc878, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.set(2.6, 2.6, 1);
      halo.position.copy(head.position);
      grp.add(halo);
      /* cône de lumière au sol */
      const poolLight = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 5),
        new THREE.MeshBasicMaterial({
          map: glowTex, color: 0x8a6a30, transparent: true, opacity: 0.4,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      poolLight.rotation.x = -Math.PI / 2;
      poolLight.position.set(-side * 0.75, 0.03, 0);
      grp.add(poolLight);
      this.detail.push(poolLight);
      grp.position.set(side * 4.85, 0, -i * 26 - 12);
      scene.add(grp);
      this.lamps.push(grp);
    }

    /* ---------- portiques publicitaires ---------- */
    this.gantries = [];
    this.GSPAN = 2 * 130;
    const adTexts = ["NOVA COLA", "VOLT ⚡ ENERGY", "FLY KICKS", "METRO DASH"];
    for (let i = 0; i < 2; i++) {
      const grp = new THREE.Group();
      const legGeo = new THREE.CylinderGeometry(0.09, 0.12, 4.6, 8);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(legGeo, this.matPole);
        leg.position.set(side * 4.6, 2.3, 0);
        grp.add(leg);
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), this.matMetal);
        brace.position.set(side * 4.25, 3.4, 0);
        brace.rotation.z = side * 0.5;
        grp.add(brace);
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.22, 0.22), this.matPole);
      bar.position.y = 4.5;
      grp.add(bar);
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 2),
        new THREE.MeshBasicMaterial({ map: Tex.billboard(pick(adTexts)) })
      );
      panel.position.y = 3.4;
      grp.add(panel);
      /* petits spots au-dessus du panneau */
      for (const sx of [-2.4, 0, 2.4]) {
        const spot = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: 0x9adcff, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        spot.scale.set(1, 1, 1);
        spot.position.set(sx, 4.55, -0.2);
        grp.add(spot);
        this.detail.push(spot);
      }
      grp.position.z = -60 - i * 130;
      scene.add(grp);
      this.gantries.push(grp);
    }

    /* ---------- câbles urbains suspendus (avec lanterne) ---------- */
    this.wires = [];
    this.WSPAN = 3 * 45;
    const wireMat = new THREE.LineBasicMaterial({ color: 0x161a26 });
    for (let i = 0; i < 3; i++) {
      const grp = new THREE.Group();
      for (const zo of [-0.6, 0, 0.6]) {
        const pts = [];
        for (let k = 0; k <= 20; k++) {
          const x = -7 + (k / 20) * 14;
          const sag = (1 - (x / 7) ** 2) * 1.1;
          pts.push(new THREE.Vector3(x, 7.6 - sag, zo));
        }
        grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
      }
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      lantern.position.set(0, 6.4, 0);
      grp.add(lantern);
      const lglow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xffc878, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      lglow.scale.set(1.6, 1.6, 1);
      lglow.position.copy(lantern.position);
      grp.add(lglow);
      grp.position.z = -30 - i * 45;
      scene.add(grp);
      this.wires.push(grp);
      this.detail.push(grp);
    }

    /* ---------- mobilier urbain le long des murs ---------- */
    this.props = [];
    this.PSPAN = 10 * 17;
    const mkProp = (kind, side) => {
      const grp = new THREE.Group();
      if (kind === 0) {           // poubelle
        const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.85, 10), lambert(0x2e5d43));
        bin.position.y = 0.43;
        grp.add(bin);
      } else if (kind === 1) {    // cônes de chantier
        for (let c = 0; c < 2; c++) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), lambert(0xff8a2a));
          cone.position.set(c * 0.5 - 0.25, 0.28, c * 0.3);
          grp.add(cone);
        }
      } else if (kind === 2) {    // palettes empilées
        for (let p = 0; p < 3; p++) {
          const pal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.9), lambert(0x6b5233));
          pal.position.y = 0.08 + p * 0.15;
          pal.rotation.y = p * 0.2;
          grp.add(pal);
        }
      } else if (kind === 3) {    // distributeur lumineux
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.6), lambert(0x223148));
        body.position.y = 0.85;
        grp.add(body);
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(0.55, 1.3),
          new THREE.MeshBasicMaterial({ map: Tex.vending() })
        );
        face.position.set(side < 0 ? 0.36 : -0.36, 0.9, 0);
        face.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        grp.add(face);
      } else {                    // feu de signalisation
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 8), this.matPole);
        pole.position.y = 1.2;
        grp.add(pole);
        const boxH = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.66, 0.22), this.matDark);
        boxH.position.y = 2.5;
        grp.add(boxH);
        const red = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10),
          new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
        red.position.set(0, 2.64, side < 0 ? 0.12 : -0.12);
        red.rotation.y = side < 0 ? 0 : Math.PI;
        const green = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10),
          new THREE.MeshBasicMaterial({ color: 0x1fd06a }));
        green.position.set(0, 2.4, side < 0 ? 0.12 : -0.12);
        green.rotation.y = red.rotation.y;
        grp.add(red, green);
        grp.userData.signal = { red: red.material, green: green.material };
      }
      return grp;
    };
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const grp = mkProp(i % 5, side);
      grp.position.set(side * (4.55 + rand(0, 0.25)), 0, -i * 17 - rand(0, 6));
      grp.rotation.y = rand(-0.4, 0.4);
      scene.add(grp);
      this.props.push(grp);
      this.detail.push(grp);
    }

    /* ---------- flaques « mouillées » reflétant les néons ---------- */
    this.puddles = [];
    this.PUSPAN = 6 * 22;
    const puddleTex = Tex.puddle();
    const puddleCols = [0x00d0ff, 0xff5c8a, 0x8b5cf6, 0xff8a2a];
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 3),
        new THREE.MeshBasicMaterial({
          map: puddleTex, color: pick(puddleCols), transparent: true, opacity: 0.32,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set((i % 2 ? 1 : -1) * rand(2.9, 4.2), 0.025, -i * 22 - rand(0, 8));
      scene.add(p);
      this.puddles.push(p);
      this.detail.push(p);
    }

    /* ---------- poussière atmosphérique ---------- */
    this.dust = [];
    for (let i = 0; i < 30; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xaab4dc, transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      const s = rand(0.06, 0.2);
      sp.scale.set(s, s, 1);
      sp.position.set(rand(-8, 8), rand(0.4, 7), rand(-90, 0));
      scene.add(sp);
      this.dust.push(sp);
      this.detail.push(sp);
    }

    /* ---------- drone qui traverse le ciel ---------- */
    this.drone = new THREE.Group();
    const dbody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), this.matDark);
    this.drone.add(dbody);
    for (const [ax, az] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.06), this.matMetal);
      arm2.position.set(ax * 0.3, 0.05, az * 0.3);
      arm2.rotation.y = Math.atan2(az, ax);
      this.drone.add(arm2);
      const rotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.015, 12),
        new THREE.MeshBasicMaterial({ color: 0x8a93b8, transparent: true, opacity: 0.35 })
      );
      rotor.position.set(ax * 0.42, 0.09, az * 0.42);
      this.drone.add(rotor);
    }
    this.droneLight = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff3b30, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.droneLight.scale.set(0.7, 0.7, 1);
    this.droneLight.position.y = -0.12;
    this.drone.add(this.droneLight);
    this.drone.position.set(-40, 14, -60);
    this.droneTimer = rand(4, 9);
    this.droneVx = 6;
    scene.add(this.drone);
    this.detail.push(this.drone);

    /* ---------- station de métro (quai + auvent + enseigne) ---------- */
    this.station = new THREE.Group();
    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 30), lambert(0x2c3147));
    platform.position.set(7.2, 0.45, 0);
    this.station.add(platform);
    for (let p = 0; p < 4; p++) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.4, 8), this.matPole);
      pillar.position.set(7.2, 2.6, -12 + p * 8);
      this.station.add(pillar);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 30), this.matDark);
    canopy.position.set(7.2, 4.3, 0);
    this.station.add(canopy);
    const stripLight = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.05, 29),
      new THREE.MeshBasicMaterial({ color: 0xbfd9ff })
    );
    stripLight.position.set(7.2, 4.2, 0);
    this.station.add(stripLight);
    const stSign = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1),
      new THREE.MeshBasicMaterial({ map: Tex.stationSign(), transparent: true })
    );
    stSign.position.set(5.3, 3.1, 0);
    stSign.rotation.y = -Math.PI / 2;
    this.station.add(stSign);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 2.4), lambert(0x6b5233));
    bench.position.set(7.6, 1.1, 4);
    this.station.add(bench);
    this.station.position.z = -260;
    scene.add(this.station);
    this.STSPAN = 420;

    /* ---------- tunnel équipé : voûte texturée, tuyaux, lampes, portail ---------- */
    this.TUNNEL_LEN = 60;
    this.tunnel = new THREE.Group();
    const wallTexT = Tex.tunnelWall();
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(5.8, 5.8, this.TUNNEL_LEN, 24, 1, true, 0, Math.PI),
      new THREE.MeshLambertMaterial({ map: wallTexT, side: THREE.DoubleSide })
    );
    wallTexT.wrapS = wallTexT.wrapT = THREE.RepeatWrapping;
    wallTexT.repeat.set(6, 1);
    shell.rotation.z = Math.PI / 2;
    shell.rotation.y = Math.PI / 2;
    shell.position.y = 0.4;
    this.tunnel.add(shell);

    const ringGeo = new THREE.TorusGeometry(5.3, 0.09, 8, 40, Math.PI);
    for (let i = 0; i < this.TUNNEL_LEN / 6; i++) {
      const ring = new THREE.Mesh(ringGeo,
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0x8b5cf6 : 0x00d0ff }));
      ring.position.set(0, 0.4, this.TUNNEL_LEN / 2 - i * 6);
      this.tunnel.add(ring);
    }
    /* tuyauterie le long des parois */
    for (const side of [-1, 1]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, this.TUNNEL_LEN, 8),
        this.matMetal
      );
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(side * 4.9, 2.4, 0);
      this.tunnel.add(pipe);
      const pipe2 = pipe.clone();
      pipe2.position.y = 2.1;
      this.tunnel.add(pipe2);
    }
    /* lampes suspendues */
    for (let i = 0; i < this.TUNNEL_LEN / 12; i++) {
      const lampT = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
      lampT.position.set(0, 4.6, this.TUNNEL_LEN / 2 - 6 - i * 12);
      this.tunnel.add(lampT);
      const lglow2 = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xffe0a0, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      lglow2.scale.set(2, 2, 1);
      lglow2.position.copy(lampT.position);
      this.tunnel.add(lglow2);
    }
    /* portail d'entrée : cadre + enseigne */
    const portal = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.35, 8, 40, Math.PI), lambert(0x262b40));
    portal.position.set(0, 0.4, this.TUNNEL_LEN / 2 + 0.2);
    this.tunnel.add(portal);
    const tSign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.8),
      new THREE.MeshBasicMaterial({ map: Tex.neon("TUNNEL 07", "#ffc93c"), transparent: true, depthWrite: false })
    );
    tSign.position.set(0, 5.2, this.TUNNEL_LEN / 2 + 0.5);
    this.tunnel.add(tSign);

    this.tunnel.position.z = -350;
    scene.add(this.tunnel);
    this.tunnelGapMin = 320;
    this.tunnelGapMax = 480;
  }

  reset() {
    this.dist = 0;
  }

  setDetail(on) {
    for (const d of this.detail) d.visible = on;
  }

  inTunnel() {
    const z = this.tunnel.position.z;
    return z + this.TUNNEL_LEN / 2 > -CONFIG.PLAYER_Z - 4 && z - this.TUNNEL_LEN / 2 < 2;
  }

  update(dt, speed) {
    const dz = speed * dt;
    this.dist += dz;
    const now = performance.now();

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
        g.userData.sign.position.y = h * 0.55;
        g.userData.sign.visible = Math.random() < 0.75;
        if (g.userData.roof) g.userData.roof.position.y = h;
      });
      /* grésillement des néons */
      const sign = b.userData.sign;
      if (sign.visible && now > sign.userData.flickAt) {
        sign.material.opacity = sign.material.opacity < 1 ? 1 : 0.3;
        sign.userData.flickAt = now + (sign.material.opacity < 1 ? rand(40, 130) : rand(2500, 9000));
      }
    }
    for (const l of this.lamps) recycle(l, this.LSPAN);
    for (const g of this.gantries) recycle(g, this.GSPAN);
    for (const w of this.wires) recycle(w, this.WSPAN);
    for (const p of this.props) recycle(p, this.PSPAN, (g) => { g.rotation.y = rand(-0.4, 0.4); });
    for (const p of this.puddles) recycle(p, this.PUSPAN);

    /* feux de signalisation : alternance rouge/vert */
    const phase = Math.floor(now / 1600) % 2;
    for (const p of this.props) {
      if (p.userData.signal) {
        p.userData.signal.red.color.setHex(phase ? 0xff3b30 : 0x40222a);
        p.userData.signal.green.color.setHex(phase ? 0x1a3a2a : 0x1fd06a);
      }
    }

    /* poussière : dérive lente vers la caméra */
    for (const sp of this.dust) {
      sp.position.z += dz * 0.55 + dt * 0.4;
      sp.position.y += Math.sin(now / 900 + sp.position.x) * dt * 0.12;
      if (sp.position.z > 2) {
        sp.position.z = -rand(60, 90);
        sp.position.x = rand(-8, 8);
        sp.position.y = rand(0.4, 7);
      }
    }

    /* drone : traverse le ciel par intervalles */
    if (this.droneTimer > 0) {
      this.droneTimer -= dt;
      if (this.droneTimer <= 0) {
        this.drone.position.set(this.droneVx > 0 ? -42 : 42, rand(10, 17), -rand(35, 75));
        this.droneVx = (Math.random() < 0.5 ? 1 : -1) * rand(5, 9);
      }
    } else {
      this.drone.position.x += this.droneVx * dt;
      this.drone.position.y += Math.sin(now / 600) * dt * 0.5;
      this.droneLight.material.opacity = Math.floor(now / 300) % 2 ? 0.9 : 0.15;
      if (Math.abs(this.drone.position.x) > 45) this.droneTimer = rand(6, 14);
    }

    /* station : repasse régulièrement, jamais dans un tunnel */
    this.station.position.z += dz;
    if (this.station.position.z > 30) {
      let nz = this.station.position.z - this.STSPAN;
      if (Math.abs(nz - this.tunnel.position.z) < 90) nz -= 120;
      this.station.position.z = nz;
    }

    /* tunnel */
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
    this.renderer.setClearColor(0x12102e); // nuit profonde hors du dôme céleste
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;   // rendu cinéma
    this.renderer.toneMappingExposure = 1.55;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.fogNormal = new THREE.Color(0x33224e);
    this.fogTunnel = new THREE.Color(0x0a0c14);
    this.scene.fog = new THREE.Fog(this.fogNormal.clone(), 35, 130);

    this.camera = new THREE.PerspectiveCamera(63, 1, 0.1, 400);
    this.camera.position.set(0, 3.35, 0);

    // Éclairage crépusculaire : dôme violet + soleil orange bas + rebond bleu
    this.hemi = new THREE.HemisphereLight(0x8a6ac9, 0x2a2436, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffa050, 1.35);
    this.sun.position.set(6, 11, -26);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -14;
    this.sun.shadow.camera.right = 14;
    this.sun.shadow.camera.top = 18;
    this.sun.shadow.camera.bottom = -12;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 70;
    this.sun.shadow.bias = -0.0008;
    this.sun.target.position.set(0, 0, -14);
    this.scene.add(this.sun, this.sun.target);
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
    const std = (c, rough = 0.7, metal = 0.1) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
    const castAll = (grp) => grp.traverse((m) => {
      if (m.isMesh && !m.material.transparent) m.castShadow = true;
    });

    /* Matériau partagé des gyrophares de chantier (clignote globalement) */
    this.blinkMat = new THREE.MeshBasicMaterial({ color: 0xffb020 });

    /* Barrière : panneau arrondi + décalque rayé + pieds cylindriques */
    const barrierTex = Tex.barrier();
    const mkBarrier = () => {
      const grp = new THREE.Group();
      const panel = new THREE.Mesh(roundedBoxGeo(D.barrier.w, 0.5, 0.16, 0.06), std(0xff8a2a, 0.65));
      panel.position.y = 0.75;
      grp.add(panel);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(D.barrier.w - 0.14, 0.42),
        new THREE.MeshLambertMaterial({ map: barrierTex })
      );
      decal.position.set(0, 0.75, 0.085);
      grp.add(decal);
      const legMat = std(0x454b68, 0.6, 0.3);
      for (const sd of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.55, 12), legMat);
        leg.position.set(sd * (D.barrier.w / 2 - 0.15), 0.27, 0);
        grp.add(leg);
        const footPad = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.04, 12), legMat);
        footPad.position.set(sd * (D.barrier.w / 2 - 0.15), 0.02, 0);
        grp.add(footPad);
      }
      const blink = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), this.blinkMat);
      blink.position.set(0, D.barrier.h + 0.08, 0);
      grp.add(blink);
      castAll(grp);
      return grp;
    };

    /* Panneau suspendu : cadre arrondi + décalque néon des deux côtés */
    const signTex = Tex.signPanel();
    const mkSign = () => {
      const grp = new THREE.Group();
      const poleMat = std(0x454b68, 0.55, 0.35);
      for (const sd of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 12), poleMat);
        pole.position.set(sd * D.sign.w / 2, 1.3, 0);
        grp.add(pole);
        const cap2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), poleMat);
        cap2.position.set(sd * D.sign.w / 2, 2.62, 0);
        grp.add(cap2);
      }
      const frame = new THREE.Mesh(roundedBoxGeo(D.sign.w, D.sign.h, 0.12, 0.05), std(0x1a2030, 0.8));
      frame.position.y = D.sign.gapBottom + D.sign.h / 2;
      grp.add(frame);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(D.sign.w - 0.12, D.sign.h - 0.12),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      face.position.set(0, D.sign.gapBottom + D.sign.h / 2, 0.065);
      grp.add(face);
      castAll(grp);
      return grp;
    };

    /* Caisse : volume arrondi + décalque graffiti sur la face avant */
    const crateSkins = [
      { color: 0x8b5cf6, tex: Tex.crate("#8b5cf6", "DASH") },
      { color: 0x4a5178, tex: Tex.crate("#4a5178", "ZONE") },
      { color: 0x6d3fd6, tex: Tex.crate("#6d3fd6", "VLT") },
    ];
    const mkCrate = () => {
      const skin = pick(crateSkins);
      const grp = new THREE.Group();
      const body = new THREE.Mesh(
        roundedBoxGeo(D.crate.w, D.crate.h, D.crate.d, 0.12),
        std(skin.color, 0.75)
      );
      body.position.y = D.crate.h / 2;
      grp.add(body);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(D.crate.w - 0.24, D.crate.h - 0.24),
        new THREE.MeshLambertMaterial({ map: skin.tex })
      );
      decal.position.set(0, D.crate.h / 2, D.crate.d / 2 + 0.005);
      grp.add(decal);
      /* sangles de levage arrondies */
      const strapMat = std(0x20242f, 0.9);
      for (const zz of [-D.crate.d * 0.28, D.crate.d * 0.28]) {
        const strap = new THREE.Mesh(new THREE.TorusGeometry(D.crate.h * 0.52, 0.035, 8, 22), strapMat);
        strap.position.set(0, D.crate.h / 2, zz);
        strap.scale.x = D.crate.w / D.crate.h;
        grp.add(strap);
      }
      castAll(grp);
      return grp;
    };

    /* Wagon : caisse galbée + décalques fenêtres + pantographe + feux */
    const wagonSkins = [
      { base: 0x2f7bff, side: Tex.wagonSide(["#5d9aff", "#2f7bff", "#1f5cd0"]), front: Tex.wagonFront(["#5d9aff", "#2f7bff", "#1f5cd0"]) },
      { base: 0x39406b, side: Tex.wagonSide(["#4c548a", "#39406b", "#2b3050"]), front: Tex.wagonFront(["#4c548a", "#39406b", "#2b3050"]) },
    ];
    const mkWagon = () => {
      const skin = pick(wagonSkins);
      const grp = new THREE.Group();
      const bodyH = D.wagon.h - 0.55;
      const body = new THREE.Mesh(
        roundedBoxGeo(D.wagon.w, bodyH, D.wagon.d, 0.3, 4),
        std(skin.base, 0.5, 0.35)
      );
      body.position.y = 0.5 + bodyH / 2;
      grp.add(body);
      /* décalques latéraux et avant (fenêtres, phares) */
      const emiss = (tex) => new THREE.MeshLambertMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5,
      });
      for (const sd of [-1, 1]) {
        const sideDecal = new THREE.Mesh(
          new THREE.PlaneGeometry(D.wagon.d - 0.9, bodyH - 0.55),
          emiss(skin.side)
        );
        sideDecal.position.set(sd * (D.wagon.w / 2 + 0.004), 0.62 + bodyH / 2, 0);
        sideDecal.rotation.y = sd * Math.PI / 2;
        grp.add(sideDecal);
      }
      const frontDecal = new THREE.Mesh(
        new THREE.PlaneGeometry(D.wagon.w - 0.5, bodyH - 0.35),
        emiss(skin.front)
      );
      frontDecal.position.set(0, 0.58 + bodyH / 2, D.wagon.d / 2 + 0.004);
      grp.add(frontDecal);
      /* toit galbé */
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(D.wagon.w / 2, D.wagon.w / 2, D.wagon.d - 0.5, 18, 1, false, 0, Math.PI),
        std(0x9aa3bd, 0.45, 0.4)
      );
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.scale.set(0.28, 1, 1);
      roof.position.y = D.wagon.h - 0.08;
      grp.add(roof);
      /* bogies arrondis + roues */
      const bogieMat = std(0x14161f, 0.8);
      for (const zz of [-D.wagon.d / 2 + 1.5, D.wagon.d / 2 - 1.5]) {
        const bogie = new THREE.Mesh(roundedBoxGeo(D.wagon.w - 0.6, 0.42, 1.7, 0.12), bogieMat);
        bogie.position.set(0, 0.3, zz);
        grp.add(bogie);
        for (const sd of [-1, 1]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 16), std(0x30364a, 0.4, 0.7));
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(sd * (D.wagon.w / 2 - 0.22), 0.24, zz);
          grp.add(wheel);
        }
      }
      /* phare avant + halo */
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: 0xffe9a8, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      lamp.scale.set(1.1, 1.1, 1);
      lamp.position.set(0, 0.8, D.wagon.d / 2 + 0.05);
      grp.add(lamp);
      /* pantographe fin (cylindres) */
      const panMat = std(0x20242f, 0.5, 0.5);
      const pbase = new THREE.Mesh(roundedBoxGeo(0.6, 0.07, 0.8, 0.03), panMat);
      pbase.position.set(0, D.wagon.h + 0.02, -2);
      grp.add(pbase);
      for (const sd of [-1, 1]) {
        const armP = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.78, 8), panMat);
        armP.position.set(0.14 * sd, D.wagon.h + 0.38, -2);
        armP.rotation.x = 0.45 * sd;
        grp.add(armP);
      }
      const pTop = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 8), panMat);
      pTop.rotation.z = Math.PI / 2;
      pTop.position.set(0, D.wagon.h + 0.72, -2);
      grp.add(pTop);
      /* feu arrière rouge clignotant */
      const tail = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTex, color: 0xff3b30, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      tail.scale.set(0.8, 0.8, 1);
      tail.position.set(0.7, 2.2, -D.wagon.d / 2 - 0.05);
      grp.add(tail);
      grp.userData.tail = tail.material;
      castAll(grp);
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
    this.coinMat = coinMat;
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
    if (this.world) this.world.setDetail(this.fxHigh);
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
    this.introT = 0;
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
    this.introT = 1.4;       // swoop d'entrée de la caméra
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

    // Atterrissage : squash du personnage, creux caméra, poussière, bruit sourd
    if (this.player.justLanded) {
      this.player.justLanded = false;
      this.rig.land();
      this.landDip = 1;
      this.audio.thud();
      this.emit({ x: this.player.x, y: 0.08, z: -CONFIG.PLAYER_Z, count: 8, color: 0x8890b8, speed: 2.4, size: 0.3, life: 0.4, gravity: 2 });
    }
    // Traînée de poussière pendant la glissade
    if (this.player.sliding && this.fxHigh && Math.random() < dt * 26) {
      this.emit({ x: this.player.x + rand(-0.3, 0.3), y: 0.08, z: -CONFIG.PLAYER_Z + 0.3, count: 1, color: 0x9aa3c8, speed: 1.4, size: 0.26, life: 0.35, gravity: 1 });
    }

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
      if (o.mesh.userData.tail) {
        o.mesh.userData.tail.opacity = Math.floor(performance.now() / 500) % 2 ? 0.9 : 0.12;
      }
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
    const now = performance.now();

    /* Menu : lente dérive latérale pour faire vivre la ville */
    if (this.state === "menu" || this.state === "loading") {
      this.camera.position.x = damp(this.camera.position.x, Math.sin(now / 5200) * 1.4, 2, dt);
      this.camera.position.y = damp(this.camera.position.y, 3.6 + Math.sin(now / 3900) * 0.25, 2, dt);
      this.camera.position.z = 0;
      this.camera.fov = damp(this.camera.fov, this.baseFov, 4, dt);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(0, 1.6, -20);
      return;
    }

    /* Swoop d'intro : la caméra part du niveau du sol, face au coureur,
       puis glisse en arc jusqu'à sa position de poursuite */
    let intro = 0;
    if (this.introT > 0) {
      this.introT -= dt;
      const k = clamp(1 - this.introT / 1.4, 0, 1);
      intro = 1 - k * k * (3 - 2 * k);
    }

    const targetX = p.x * 0.45;
    this.camera.position.x = damp(this.camera.position.x, targetX, 6, dt);

    /* bob de course + creux d'atterrissage */
    this.landDip = damp(this.landDip ?? 0, 0, 7, dt);
    const bobY = (!p.jumping && !p.sliding) ? Math.sin(p.runPhase * 2) * 0.05 : 0;
    const baseY = 3.35 + p.y * 0.22 + bobY - this.landDip * 0.24;
    this.camera.position.y = damp(this.camera.position.y, baseY, 8, dt);

    /* dolly dramatique pendant la mort */
    const dieK = this.state === "dying" ? 1 - this.dieT / 0.9 : 0;
    const camZ = -dieK * 2.2;

    /* mélange avec la position d'intro (trois-quarts avant, au ras du sol) */
    this.camera.position.x = lerp(this.camera.position.x, p.x + 2.4, intro);
    this.camera.position.y = lerp(this.camera.position.y, 1.25, intro);
    this.camera.position.z = lerp(camZ, -CONFIG.PLAYER_Z + 3.2, intro);

    /* FOV dynamique : la vitesse « étire » la perspective */
    const speedK = clamp((this.speed - CONFIG.BASE_SPEED) / (CONFIG.MAX_SPEED - CONFIG.BASE_SPEED), 0, 1);
    const targetFov = this.baseFov + speedK * 9 + (this.has("boost") ? 7 : 0) - dieK * 6;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, targetFov, 4, dt);
      this.camera.updateProjectionMatrix();
    }

    /* secousse */
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      const a = this.shakeT * 0.28;
      sx = rand(-a, a);
      sy = rand(-a, a);
    }
    this.camera.position.x += sx;
    this.camera.position.y += sy;

    this.camera.lookAt(
      lerp(p.x * 0.72 + sx * 0.5, p.x, intro),
      lerp(1.1 + p.y * 0.3, 1.25 + p.y, intro),
      lerp(-16, -CONFIG.PLAYER_Z - 6, intro)
    );

    /* roulis dans les changements de voie */
    const laneVel = (p.x - (this.prevPX ?? p.x)) / Math.max(dt, 1e-4);
    this.prevPX = p.x;
    this.camRoll = damp(this.camRoll ?? 0, clamp(-laneVel * 0.012, -0.05, 0.05), 8, dt);
    this.camera.rotateZ(this.camRoll);
  }

  render(dt) {
    // ambiance tunnel : brouillard + lumière assombris
    const tun = this.world.inTunnel() ? 1 : 0;
    this.tunnelK = damp(this.tunnelK ?? 0, tun, 3, dt);
    this.scene.fog.color.lerpColors(this.fogNormal, this.fogTunnel, this.tunnelK);
    this.scene.fog.near = lerp(35, 14, this.tunnelK);
    this.scene.fog.far = lerp(130, 70, this.tunnelK);
    this.hemi.intensity = lerp(1.25, 0.55, this.tunnelK);
    this.sun.intensity = lerp(1.35, 0.25, this.tunnelK);
    this.sky.visible = this.tunnelK < 0.85;

    // animations d'ambiance synchronisées
    const nowMs = performance.now();
    this.blinkMat.color.setHex(Math.floor(nowMs / 380) % 2 ? 0xffb020 : 0x4a3410);
    this.coinMat.emissiveIntensity = 0.45 + Math.sin(nowMs / 240) * 0.2;

    const speedK = clamp((this.speed - CONFIG.BASE_SPEED) / (CONFIG.MAX_SPEED - CONFIG.BASE_SPEED), 0, 1);
    this.syncEntityMeshes();
    this.rig.update(this.player, dt, { shield: this.has("shield"), boost: this.has("boost") }, speedK);
    this.rig.group.visible = this.state !== "gameover" && this.rig.group.visible;
    this.updateCamera(dt);

    // parallaxe de la skyline intermédiaire
    this.world.skyline.position.x = -this.camera.position.x * 1.4;

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
