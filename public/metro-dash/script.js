/* ==========================================================================
   METRO DASH — endless runner urbain 2.5D (Canvas, vanilla JS)
   Architecture : Game / Player / Obstacle / Coin / PowerUp / World / Spawner
   / CollisionManager / ScoreManager / UIManager / InputManager / AudioManager
   ========================================================================== */

"use strict";

/* --------------------------------------------------------------------------
   Configuration globale
   -------------------------------------------------------------------------- */
const CONFIG = {
  LANE_X: [-2.4, 0, 2.4],      // position X (mètres) des trois voies
  CAM_H: 3.1,                  // hauteur caméra (m)
  PLAYER_Z: 6,                 // distance du joueur devant la caméra (m)
  SPAWN_Z: 95,                 // distance d'apparition des entités (m)
  KILL_Z: 2.2,                 // distance de recyclage derrière le joueur
  BASE_SPEED: 15,              // vitesse de départ (m/s)
  MAX_SPEED: 33,               // vitesse max hors boost
  SPEED_STEP: 0.95,            // gain de vitesse toutes les 15 s
  JUMP_V: 9.4,                 // vitesse verticale du saut (m/s)
  GRAVITY: 24,                 // gravité (m/s²)
  SLIDE_TIME: 0.62,            // durée d'une glissade (s)
  PLAYER_H: 1.75,              // hauteur du joueur debout (m)
  SLIDE_H: 0.82,               // hauteur du joueur en glissade (m)
  LANE_SNAP: 11,               // vitesse de changement de voie (plus haut = plus vif)
  COIN_SCORE: 25,
  POWERUP_DUR: { magnet: 8, shield: 10, x2: 10, boost: 4 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
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

  // Le contexte audio doit être créé après une interaction utilisateur.
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
  swoosh()  { this.noise({ dur: 0.1, vol: 0.08, freq: 1800 }); }

  // Boucle musicale minimaliste (basse + arpège), légère et coupable à tout moment.
  startMusic() {
    if (this.muted || !this.ensure() || this.musicTimer) return;
    const bass = [110, 110, 131, 98];
    const arp = [440, 523, 659, 523, 440, 659, 784, 659];
    const stepDur = 0.24;
    const loop = () => {
      if (this.muted) return this.stopMusic();
      const s = this.musicStep++;
      this.tone({ type: "triangle", from: bass[Math.floor(s / 4) % 4], dur: stepDur * 0.9, vol: 0.1 });
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

    // Tactile : swipe directionnel dès 24 px (réactif), tap rapide = saut.
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
      if (t && performance.now() - this.touch.t < 220) this.h.jump(); // tap = saut
      this.touch = null;
    }, opts);
  }
}

/* --------------------------------------------------------------------------
   ParticleSystem — poussière, éclats de pièces, débris, traînée de boost
   -------------------------------------------------------------------------- */
class ParticleSystem {
  constructor() { this.list = []; }

  emit({ x, y, count = 8, color = "#ffc93c", speed = 90, size = 4, life = 0.5, gravity = 160, spread = Math.PI * 2, angle = 0 }) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * rand(0.4, 1);
      this.list.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        size: size * rand(0.6, 1.3),
        life, maxLife: life,
        color, gravity,
      });
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.size * (0.5 + a * 0.5);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }
}

/* --------------------------------------------------------------------------
   Player — course, changement de voie, saut, glissade + dessin du coureur
   -------------------------------------------------------------------------- */
class Player {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.lane = 1;                       // index de voie cible (0..2)
    this.x = CONFIG.LANE_X[1];           // position X interpolée (m)
    this.y = 0;                          // hauteur au-dessus du sol (m)
    this.vy = 0;
    this.jumping = false;
    this.sliding = false;
    this.slideT = 0;
    this.runPhase = 0;                   // phase de l'animation de course
    this.invincibleT = 0;                // frames d'invulnérabilité post-bouclier
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
    // Glisser en plein saut ⇒ retombée accélérée (feeling arcade)
    if (this.jumping) this.vy = Math.min(this.vy, -10);
  }

  update(dt) {
    // Interpolation fluide vers la voie cible
    this.x = lerp(this.x, CONFIG.LANE_X[this.lane], 1 - Math.exp(-CONFIG.LANE_SNAP * dt));

    // Saut : montée rapide, gravité naturelle
    if (this.jumping) {
      this.y += this.vy * dt;
      this.vy -= CONFIG.GRAVITY * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.jumping = false; }
    }

    // Glissade limitée dans le temps
    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0) this.sliding = false;
    }

    if (this.invincibleT > 0) this.invincibleT -= dt;

    // Animation de course, cadence liée à la vitesse
    this.runPhase += dt * (8 + this.game.speed * 0.35);
  }

  /* Dessin du coureur : silhouette stylisée orientée dos (veste, sac, casquette) */
  draw(ctx, proj, fx) {
    const p = proj(this.x, 0, CONFIG.PLAYER_Z);
    const s = p.s; // px par mètre à la profondeur du joueur
    const groundY = p.y;
    const bodyX = p.x;
    const yOff = this.y * s;

    const t = this.runPhase;
    const legSwing = Math.sin(t) * 0.5;
    const bob = this.jumping ? 0 : Math.abs(Math.sin(t)) * 0.05 * s;

    // Ombre au sol (rétrécit pendant le saut)
    const shScale = clamp(1 - this.y / 3, 0.35, 1);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(bodyX, groundY, 0.62 * s * shScale, 0.16 * s * shScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(bodyX, groundY - yOff - bob);

    // Aura bouclier / boost
    if (fx.shield) {
      ctx.strokeStyle = "rgba(0,208,255,0.85)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -performance.now() / 30;
      ctx.beginPath();
      ctx.ellipse(0, -0.95 * s, 0.85 * s, 1.15 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,208,255,0.10)";
      ctx.fill();
    }
    if (fx.boost) {
      const g = ctx.createRadialGradient(0, -0.9 * s, 0.1 * s, 0, -0.9 * s, 1.3 * s);
      g.addColorStop(0, "rgba(255,138,42,0.35)");
      g.addColorStop(1, "rgba(255,138,42,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-1.4 * s, -2.3 * s, 2.8 * s, 2.6 * s);
    }

    // Clignotement pendant l'invulnérabilité temporaire
    if (this.invincibleT > 0 && Math.floor(performance.now() / 90) % 2 === 0) ctx.globalAlpha = 0.35;

    const skin = "#e8b087";
    const jacket = "#ff8a2a";
    const jacketDark = "#e06f14";
    const pants = "#2c3150";
    const shoe = "#f4f6ff";
    const bag = "#8b5cf6";
    const cap = "#2f7bff";

    if (this.sliding) {
      /* ---- Pose de glissade : corps allongé vers l'arrière ---- */
      ctx.save();
      ctx.rotate(-0.18);
      // jambe tendue
      ctx.fillStyle = pants;
      this.rr(ctx, -0.12 * s, -0.42 * s, 0.72 * s, 0.2 * s, 0.08 * s);
      ctx.fillStyle = shoe;
      this.rr(ctx, 0.5 * s, -0.46 * s, 0.26 * s, 0.16 * s, 0.06 * s);
      // torse penché
      ctx.fillStyle = jacket;
      this.rr(ctx, -0.62 * s, -0.78 * s, 0.68 * s, 0.42 * s, 0.14 * s);
      ctx.fillStyle = bag;
      this.rr(ctx, -0.68 * s, -0.92 * s, 0.3 * s, 0.34 * s, 0.09 * s);
      // tête
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(-0.66 * s, -1.02 * s, 0.19 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cap;
      this.rr(ctx, -0.88 * s, -1.16 * s, 0.42 * s, 0.14 * s, 0.06 * s);
      ctx.restore();
    } else {
      /* ---- Pose de course / saut ---- */
      const legA = this.jumping ? 0.45 : legSwing;
      const legB = this.jumping ? -0.25 : -legSwing;

      // jambe arrière
      ctx.save();
      ctx.translate(0, -0.78 * s);
      ctx.rotate(legB * 0.8);
      ctx.fillStyle = pants;
      this.rr(ctx, -0.1 * s, 0, 0.2 * s, 0.62 * s, 0.09 * s);
      ctx.fillStyle = shoe;
      this.rr(ctx, -0.12 * s, 0.56 * s, 0.26 * s, 0.16 * s, 0.06 * s);
      ctx.restore();

      // jambe avant
      ctx.save();
      ctx.translate(0, -0.78 * s);
      ctx.rotate(legA * 0.8);
      ctx.fillStyle = "#3a4066";
      this.rr(ctx, -0.1 * s, 0, 0.2 * s, 0.62 * s, 0.09 * s);
      ctx.fillStyle = shoe;
      this.rr(ctx, -0.12 * s, 0.56 * s, 0.26 * s, 0.16 * s, 0.06 * s);
      ctx.restore();

      // torse + veste
      ctx.fillStyle = jacket;
      this.rr(ctx, -0.26 * s, -1.42 * s, 0.52 * s, 0.7 * s, 0.16 * s);
      ctx.fillStyle = jacketDark;
      ctx.fillRect(-0.03 * s, -1.42 * s, 0.06 * s, 0.68 * s);

      // sac à dos (dépasse des épaules)
      ctx.fillStyle = bag;
      this.rr(ctx, -0.34 * s, -1.38 * s, 0.2 * s, 0.5 * s, 0.08 * s);
      this.rr(ctx, 0.14 * s, -1.38 * s, 0.2 * s, 0.5 * s, 0.08 * s);

      // bras balancés
      const armA = -legSwing;
      ctx.save();
      ctx.translate(-0.3 * s, -1.32 * s);
      ctx.rotate(armA * 0.7 + (this.jumping ? -0.9 : 0));
      ctx.fillStyle = jacket;
      this.rr(ctx, -0.08 * s, 0, 0.16 * s, 0.5 * s, 0.08 * s);
      ctx.restore();
      ctx.save();
      ctx.translate(0.3 * s, -1.32 * s);
      ctx.rotate(-armA * 0.7 + (this.jumping ? 0.9 : 0));
      ctx.fillStyle = jacket;
      this.rr(ctx, -0.08 * s, 0, 0.16 * s, 0.5 * s, 0.08 * s);
      ctx.restore();

      // tête + casquette (vue de dos)
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(0, -1.62 * s, 0.2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#503a28";
      ctx.beginPath();
      ctx.arc(0, -1.64 * s, 0.2 * s, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cap;
      this.rr(ctx, -0.22 * s, -1.86 * s, 0.44 * s, 0.16 * s, 0.07 * s);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Rectangle arrondi utilitaire
  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }
}

/* --------------------------------------------------------------------------
   Entités : Obstacle, Coin, PowerUp
   -------------------------------------------------------------------------- */

// Types d'obstacles :
//   barrier : barrière basse (sautable)
//   sign    : panneau suspendu (glissade obligatoire)
//   crate   : caisse pleine hauteur (changer de voie)
//   wagon   : rame à l'arrêt, longue (changer de voie)
const OBSTACLE_DEFS = {
  barrier: { w: 2.0, h: 1.0, d: 0.5, jumpable: true },
  sign:    { w: 2.1, h: 1.2, d: 0.4, gapBottom: 1.22 },      // panneau : de 1.22 m au sommet
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
    // Variante graphique stable par instance
    this.tint = Math.random();
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
  magnet: { color: "#00d0ff", label: "U" },
  shield: { color: "#7fd4ff", label: "◈" },
  x2:     { color: "#8b5cf6", label: "x2" },
  boost:  { color: "#ff8a2a", label: "≫" },
};

class PowerUp {
  constructor(kind, lane, z) {
    this.kind = kind;
    this.lane = lane;
    this.z = z;
    this.dead = false;
    this.bob = Math.random() * Math.PI * 2;
  }
  get x() { return CONFIG.LANE_X[this.lane]; }
}

/* --------------------------------------------------------------------------
   World — décor urbain infini : ciel, skyline, immeubles, rails, tunnels
   -------------------------------------------------------------------------- */
class World {
  constructor(game) {
    this.game = game;
    this.reset();
    // Skyline lointaine générée une fois (silhouettes)
    this.skyline = [];
    let x = 0;
    while (x < 3) {
      this.skyline.push({ x, w: rand(0.04, 0.1), h: rand(0.08, 0.26) });
      x += rand(0.05, 0.11);
    }
  }

  reset() {
    this.dist = 0;
    this.buildings = [];       // segments d'immeubles latéraux {side, z, d, h, hue, sign}
    this.lamps = [];           // lampadaires {side, z}
    this.gantries = [];        // portiques publicitaires {z, text}
    this.tunnels = [];         // tunnels {z, len}
    this.nextBuildingZ = 8;
    this.nextLampZ = 18;
    this.nextGantryZ = 120;
    this.nextTunnelZ = 320;
    this.seedAhead();
  }

  seedAhead() {
    while (this.nextBuildingZ < CONFIG.SPAWN_Z + 40) this.spawnBuilding();
    while (this.nextLampZ < CONFIG.SPAWN_Z + 40) this.spawnLamp();
  }

  spawnBuilding() {
    const names = ["NOVA", "VOLT CAFÉ", "RAPID+", "PIXEL BAR", "ORBIT", "KUMO", "LUMA", "DASH 24"];
    const side = this.buildings.length % 2 === 0 ? -1 : 1;
    const d = rand(14, 22);
    this.buildings.push({
      side,
      z: this.nextBuildingZ,
      d,
      h: rand(7, 15),
      hue: pick(["#232842", "#1e2338", "#2a2440", "#20304a", "#252031"]),
      sign: Math.random() < 0.45 ? { text: pick(names), color: pick(["#00d0ff", "#ff8a2a", "#8b5cf6", "#ff5c8a"]) } : null,
      graffiti: Math.random() < 0.5 ? pick(["#ff5c8a", "#00e08a", "#ffc93c", "#00d0ff"]) : null,
    });
    this.nextBuildingZ += d + rand(0, 4);
  }

  spawnLamp() {
    this.lamps.push({ side: this.lamps.length % 2 === 0 ? 1 : -1, z: this.nextLampZ });
    this.nextLampZ += 26;
  }

  update(dt, speed) {
    const dz = speed * dt;
    this.dist += dz;

    const advance = (arr) => {
      for (const o of arr) o.z -= dz;
    };
    advance(this.buildings);
    advance(this.lamps);
    advance(this.gantries);
    advance(this.tunnels);

    this.buildings = this.buildings.filter((b) => b.z + b.d > -4);
    this.lamps = this.lamps.filter((l) => l.z > -4);
    this.gantries = this.gantries.filter((g) => g.z > -4);
    this.tunnels = this.tunnels.filter((t) => t.z + t.len > -4);

    this.nextBuildingZ -= dz;
    this.nextLampZ -= dz;
    this.nextGantryZ -= dz;
    this.nextTunnelZ -= dz;

    this.seedAhead();
    if (this.nextGantryZ < CONFIG.SPAWN_Z) {
      this.gantries.push({ z: CONFIG.SPAWN_Z + 10, text: pick(["NOVA COLA", "VOLT ⚡ ENERGY", "FLY KICKS", "METRO DASH", "SODA POP"]) });
      this.nextGantryZ = CONFIG.SPAWN_Z + rand(90, 150);
    }
    if (this.nextTunnelZ < CONFIG.SPAWN_Z) {
      this.tunnels.push({ z: CONFIG.SPAWN_Z + 20, len: rand(45, 70) });
      this.nextTunnelZ = CONFIG.SPAWN_Z + rand(320, 460);
    }
  }

  // Le joueur est-il dans un tunnel ? (assombrit l'ambiance)
  inTunnel() {
    return this.tunnels.some((t) => t.z < CONFIG.PLAYER_Z && t.z + t.len > CONFIG.PLAYER_Z);
  }

  /* Gradients coûteux mis en cache (reconstruits au redimensionnement) */
  ensureGradients(ctx, w, h, horizon) {
    const key = `${w}x${h}x${horizon | 0}`;
    if (this._gradKey === key) return;
    this._gradKey = key;

    const mk = (stops, y0, y1) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      for (const [o, c] of stops) g.addColorStop(o, c);
      return g;
    };
    this.gradSky = mk([[0, "#1a1440"], [0.65, "#3c2560"], [1, "#b04a3a"]], 0, horizon + h * 0.1);
    this.gradSkyTunnel = mk([[0, "#0a0c14"], [0.65, "#0c0e18"], [1, "#10121c"]], 0, horizon + h * 0.1);
    this.gradGround = mk([[0, "#262a39"], [1, "#31354a"]], horizon, h);
    this.gradGroundTunnel = mk([[0, "#151722"], [1, "#1a1c28"]], horizon, h);
    this.gradFog = mk([[0, "rgba(30,26,58,0)"], [0.5, "rgba(60,42,80,0.55)"], [1, "rgba(30,26,58,0)"]],
      horizon - h * 0.05, horizon + h * 0.15);
    this.gradFogTunnel = mk([[0, "rgba(10,12,20,0)"], [0.5, "rgba(10,12,20,0.7)"], [1, "rgba(10,12,20,0)"]],
      horizon - h * 0.05, horizon + h * 0.15);
  }

  /* ------------------------- rendu du décor ------------------------- */
  draw(ctx, proj, w, h, horizon) {
    const tunnelAmb = this.inTunnel() ? 1 : 0;
    this.ensureGradients(ctx, w, h, horizon);

    // Ciel crépusculaire
    ctx.fillStyle = tunnelAmb ? this.gradSkyTunnel : this.gradSky;
    ctx.fillRect(0, 0, w, horizon + h * 0.1);

    if (!tunnelAmb) {
      // Soleil couchant + skyline
      const g = ctx.createRadialGradient(w * 0.5, horizon, 4, w * 0.5, horizon, w * 0.24);
      g.addColorStop(0, "rgba(255,170,80,0.75)");
      g.addColorStop(1, "rgba(255,170,80,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, horizon + 4);

      ctx.fillStyle = "#171331";
      for (const b of this.skyline) {
        const bw = b.w * w;
        const bh = b.h * h * 0.6;
        ctx.fillRect((b.x % 1.2 - 0.1) * w, horizon - bh, bw, bh + 2);
      }
    }

    // Sol : ballast sombre pleine largeur
    ctx.fillStyle = tunnelAmb ? this.gradGroundTunnel : this.gradGround;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Plateforme de la voie (dalle centrale) — trapèze convergent
    const half = 4.3;
    const near = 2.5, far = 80;
    const nl = proj(-half, 0, near), nr = proj(half, 0, near);
    const fl = proj(-half, 0, far), fr = proj(half, 0, far);
    ctx.fillStyle = tunnelAmb ? "#20232e" : "#363a52";
    ctx.beginPath();
    ctx.moveTo(nl.x, nl.y); ctx.lineTo(nr.x, nr.y); ctx.lineTo(fr.x, fr.y); ctx.lineTo(fl.x, fl.y);
    ctx.closePath();
    ctx.fill();

    // Traverses (défilement = sensation de vitesse)
    const spacing = 2.4;
    const offset = this.dist % spacing;
    ctx.fillStyle = tunnelAmb ? "#12141c" : "#1c1e2c";
    for (let z = near + spacing - offset; z < far; z += spacing) {
      const a = proj(-half + 0.2, 0, z);
      const b = proj(half - 0.2, 0, z);
      const th = Math.max(1, 5.2 * (proj(0, 0, z).s / proj(0, 0, CONFIG.PLAYER_Z).s) * (h / 500));
      ctx.fillRect(a.x, a.y - th / 2, b.x - a.x, th);
    }

    // Rails : 2 par voie, lignes convergentes brillantes
    ctx.lineWidth = Math.max(1, h / 380);
    for (const lx of CONFIG.LANE_X) {
      for (const off of [-0.72, 0.72]) {
        const a = proj(lx + off, 0.02, near);
        const b = proj(lx + off, 0.02, far);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, "rgba(190,205,235,0.85)");
        grad.addColorStop(1, "rgba(190,205,235,0.05)");
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Bordures lumineuses de la plateforme
    for (const side of [-1, 1]) {
      const a = proj(side * half, 0.05, near);
      const b = proj(side * half, 0.05, far);
      ctx.strokeStyle = "rgba(255,201,60,0.5)";
      ctx.lineWidth = Math.max(1, h / 320);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Immeubles latéraux (du plus loin au plus proche).
    // Les segments trop proches s'estompent pour ne pas envahir l'écran.
    const sorted = [...this.buildings].sort((a, b) => b.z - a.z);
    for (const b of sorted) {
      const zn = Math.max(b.z, 4);
      const zf = b.z + b.d;
      if (zf < 4) continue;
      const xIn = b.side * 6.4;
      const nearFade = clamp((zn - 4) / 5, 0, 1);
      const fogA = clamp(1 - zn / 95, 0.12, 1) * nearFade;
      if (fogA < 0.04) continue;

      const pInNear = proj(xIn, 0, zn);
      const pInFar = proj(xIn, 0, zf);
      const pTopNear = proj(xIn, b.h, zn);
      const pTopFar = proj(xIn, b.h, zf);

      ctx.globalAlpha = fogA;
      // face intérieure (visible)
      ctx.fillStyle = b.hue;
      ctx.beginPath();
      ctx.moveTo(pInNear.x, pInNear.y);
      ctx.lineTo(pInFar.x, pInFar.y);
      ctx.lineTo(pTopFar.x, pTopFar.y);
      ctx.lineTo(pTopNear.x, pTopNear.y);
      ctx.closePath();
      ctx.fill();

      // fenêtres éclairées (grille simple, seulement à distance raisonnable)
      if (zn > 7) {
        ctx.fillStyle = "rgba(255,205,120,0.55)";
        const rows = 4, cols = Math.max(2, Math.floor(b.d / 4));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if ((r * 7 + c * 3 + Math.floor(b.z * 0.1)) % 3 === 0) continue; // fenêtres éteintes stables
            const zz = zn + ((c + 0.5) / cols) * (zf - zn);
            const yy = b.h * (0.25 + (r / rows) * 0.62);
            const pw = proj(xIn, yy, zz);
            const ws = Math.max(1.5, pw.s * 0.26);
            ctx.fillRect(pw.x - ws / 2, pw.y - ws / 2, ws, ws * 1.2);
          }
        }
      }

      // enseigne néon
      if (b.sign && zn > 9 && zn < 60) {
        const zz = (zn + zf) / 2;
        const pn = proj(xIn, b.h * 0.55, zz);
        ctx.fillStyle = b.sign.color;
        ctx.font = `700 ${Math.max(8, pn.s * 0.42)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(b.sign.text, pn.x, pn.y);
        // léger halo (deux passes, moins coûteux qu'un shadowBlur)
        ctx.globalAlpha = fogA * 0.3;
        ctx.font = `700 ${Math.max(9, pn.s * 0.46)}px system-ui, sans-serif`;
        ctx.fillText(b.sign.text, pn.x, pn.y);
        ctx.globalAlpha = fogA;
      }

      // graffiti en pied de mur (tache colorée + trait)
      if (b.graffiti && zn > 9 && zn < 45) {
        const zz = zn + (zf - zn) * 0.35;
        const pg = proj(xIn, 0.55, zz);
        ctx.globalAlpha = fogA * 0.6;
        ctx.fillStyle = b.graffiti;
        ctx.beginPath();
        ctx.ellipse(pg.x, pg.y, pg.s * 0.65, pg.s * 0.26, -0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = Math.max(1, pg.s * 0.05);
        ctx.beginPath();
        ctx.moveTo(pg.x - pg.s * 0.4, pg.y + pg.s * 0.05);
        ctx.quadraticCurveTo(pg.x, pg.y - pg.s * 0.18, pg.x + pg.s * 0.4, pg.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Lampadaires
    for (const l of this.lamps) {
      if (l.z < 3 || l.z > 90) continue;
      const x = l.side * 4.9;
      const base = proj(x, 0, l.z);
      const top = proj(x, 4.6, l.z);
      const fogA = clamp(1 - l.z / 95, 0.15, 1);
      ctx.globalAlpha = fogA;
      ctx.strokeStyle = "#3a3f58";
      ctx.lineWidth = Math.max(1, base.s * 0.07);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      // halo
      const r = Math.max(2, top.s * 0.3);
      const gl = ctx.createRadialGradient(top.x, top.y, 1, top.x, top.y, r * 3);
      gl.addColorStop(0, "rgba(255,220,150,0.9)");
      gl.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(top.x - r * 3, top.y - r * 3, r * 6, r * 6);
      ctx.globalAlpha = 1;
    }

    // Portiques publicitaires
    for (const g of this.gantries) {
      if (g.z < 3 || g.z > 90) continue;
      const fogA = clamp(1 - g.z / 95, 0.15, 1);
      const l = proj(-4.6, 0, g.z), r = proj(4.6, 0, g.z);
      const lt = proj(-4.6, 4.4, g.z), rt = proj(4.6, 4.4, g.z);
      ctx.globalAlpha = fogA;
      ctx.strokeStyle = "#454b68";
      ctx.lineWidth = Math.max(1.5, l.s * 0.09);
      ctx.beginPath();
      ctx.moveTo(l.x, l.y); ctx.lineTo(lt.x, lt.y);
      ctx.moveTo(r.x, r.y); ctx.lineTo(rt.x, rt.y);
      ctx.stroke();
      // panneau
      const pl = proj(-3.4, 3.2, g.z), pr = proj(3.4, 4.35, g.z);
      ctx.fillStyle = "#141724";
      ctx.fillRect(pl.x, pr.y, pr.x - pl.x, pl.y - pr.y);
      ctx.strokeStyle = "#00d0ff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pl.x, pr.y, pr.x - pl.x, pl.y - pr.y);
      ctx.fillStyle = "#00d0ff";
      ctx.font = `800 ${Math.max(7, pl.s * 0.5)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(g.text, (pl.x + pr.x) / 2, (pl.y + pr.y) / 2 + pl.s * 0.16);
      ctx.globalAlpha = 1;
    }

    // Tunnels : anneaux néon + voûte
    for (const t of this.tunnels) {
      const step = 7;
      for (let z = Math.max(t.z, 3.2); z < Math.min(t.z + t.len, 92); z += step) {
        const fogA = clamp(1 - z / 95, 0.1, 1);
        const c = proj(0, 0, z);
        const rw = 5.4 * c.s;
        const rh = 5.2 * c.s;
        ctx.globalAlpha = fogA;
        // voûte sombre
        ctx.strokeStyle = "rgba(16,18,28,0.9)";
        ctx.lineWidth = Math.max(4, c.s * 1.3);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rw, rh, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        // liseré néon
        ctx.strokeStyle = ((z / step) | 0) % 2 ? "rgba(139,92,246,0.8)" : "rgba(0,208,255,0.8)";
        ctx.lineWidth = Math.max(1.2, c.s * 0.09);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rw * 0.94, rh * 0.94, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Brouillard près de l'horizon (profondeur)
    ctx.fillStyle = tunnelAmb ? this.gradFogTunnel : this.gradFog;
    ctx.fillRect(0, horizon - h * 0.05, w, h * 0.2);
  }
}

/* --------------------------------------------------------------------------
   Spawner — patterns équitables : au moins une issue possible à chaque rangée
   -------------------------------------------------------------------------- */
class Spawner {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.zAhead = 40;          // prochaine position libre pour poser un pattern
    this.powerupClock = rand(12, 18);
  }

  update(dt, speed, elapsed) {
    this.zAhead -= speed * dt;
    this.powerupClock -= dt;

    while (this.zAhead < CONFIG.SPAWN_Z) {
      const gap = clamp(speed * 0.62, 10, 21); // distance de réaction équitable
      const tier = elapsed > 90 ? 3 : elapsed > 60 ? 2 : elapsed > 30 ? 1 : 0;
      const used = this.spawnPattern(this.zAhead + gap, tier);
      this.zAhead += gap + used;
    }
  }

  /* Pose un pattern à partir de z, renvoie la profondeur occupée. */
  spawnPattern(z, tier) {
    const G = this.game;
    const lanes = [0, 1, 2];
    const free = pick(lanes); // voie garantie libre pour ce pattern
    const others = lanes.filter((l) => l !== free);

    // Insertion éventuelle d'un power-up sur la voie libre, avant le pattern
    if (this.powerupClock <= 0) {
      G.powerups.push(new PowerUp(pick(Object.keys(POWERUP_DEFS)), free, z - 5));
      this.powerupClock = rand(16, 26);
    }

    const patterns = this.patternsForTier(tier);
    const fn = pick(patterns);
    return fn(z, free, others);
  }

  patternsForTier(tier) {
    const P = this.patterns();
    if (tier === 0) return [P.singleJump, P.singleSlide, P.singleCrate, P.coinLine, P.coinArc];
    if (tier === 1) return [P.singleJump, P.singleSlide, P.doubleBlock, P.wagonSide, P.jumpThenSlide, P.coinArc, P.zigzag];
    if (tier === 2) return [P.doubleBlock, P.wagonSide, P.jumpThenSlide, P.triplet, P.zigzag, P.wagonCorridor];
    return [P.doubleBlock, P.wagonSide, P.triplet, P.wagonCorridor, P.gauntlet, P.zigzag];
  }

  /* Chaque pattern renvoie sa profondeur totale. Règle d'or :
     jamais les 3 voies bloquées à la même profondeur par un obstacle infranchissable. */
  patterns() {
    const G = this.game;
    const coinRow = (lane, z, n, dz = 2.3, y = 1.05) => {
      for (let i = 0; i < n; i++) G.coins.push(new Coin(lane, z + i * dz, y));
    };
    // Arc de pièces épousant un saut
    const coinJumpArc = (lane, z) => {
      const ys = [1.0, 1.7, 2.15, 2.3, 2.15, 1.7, 1.0];
      ys.forEach((y, i) => G.coins.push(new Coin(lane, z + i * 1.5, y)));
    };

    return {
      // Barrière basse sur 1-2 voies, pièces en arc sur l'une d'elles
      singleJump: (z, free, others) => {
        const lane = pick(others);
        G.obstacles.push(new Obstacle("barrier", lane, z + 4));
        coinJumpArc(lane, z);
        coinRow(free, z + 1, 4);
        return 14;
      },

      // Panneau suspendu : glissade
      singleSlide: (z, free, others) => {
        const lane = pick(others);
        G.obstacles.push(new Obstacle("sign", lane, z + 4));
        coinRow(lane, z + 1, 5, 2.2, 0.75); // pièces basses sous le panneau
        return 13;
      },

      // Caisse pleine : forcer un changement de voie
      singleCrate: (z, free, others) => {
        G.obstacles.push(new Obstacle("crate", pick(others), z + 3));
        coinRow(free, z, 5);
        return 12;
      },

      // Ligne de pièces simple
      coinLine: (z, free) => {
        coinRow(free, z, 7);
        return 16;
      },

      // Arc de pièces sur voie libre (récompense un saut stylé)
      coinArc: (z, free) => {
        coinJumpArc(free, z);
        return 12;
      },

      // Deux voies bloquées (caisse + barrière), une libre avec pièces
      doubleBlock: (z, free, others) => {
        G.obstacles.push(new Obstacle("crate", others[0], z + 3));
        G.obstacles.push(new Obstacle(pick(["barrier", "sign"]), others[1], z + 3));
        coinRow(free, z + 1, 5);
        return 14;
      },

      // Wagon long sur une voie, pièces à côté
      wagonSide: (z, free, others) => {
        const lane = pick(others);
        G.obstacles.push(new Obstacle("wagon", lane, z + 2));
        coinRow(free, z + 2, 6);
        return 20;
      },

      // Enchaînement : saute puis glisse (voies différentes ou même voie espacée)
      jumpThenSlide: (z, free, others) => {
        const lane = pick(others);
        G.obstacles.push(new Obstacle("barrier", lane, z + 3));
        G.obstacles.push(new Obstacle("sign", lane, z + 3 + clamp(G.speed * 0.7, 11, 18)));
        coinRow(free, z + 2, 6);
        return 6 + clamp(G.speed * 0.7, 11, 18) + 6;
      },

      // Trois rangées successives, chacune évitable
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

      // Couloir : deux wagons laissant la voie du centre ou un côté libre
      wagonCorridor: (z, free, others) => {
        G.obstacles.push(new Obstacle("wagon", others[0], z + 2));
        G.obstacles.push(new Obstacle("wagon", others[1], z + 5));
        coinRow(free, z + 3, 8, 2.2);
        return 24;
      },

      // Zigzag de pièces entre deux obstacles décalés
      zigzag: (z, free, others) => {
        const step = clamp(G.speed * 0.66, 11, 18);
        G.obstacles.push(new Obstacle("crate", others[0], z + 2));
        G.obstacles.push(new Obstacle("crate", others[1], z + 2 + step));
        coinRow(free, z, 3);
        coinRow(others[1], z + 2, 3);   // libre au moment de la 1re caisse
        coinRow(others[0], z + 2 + step, 3); // libre au moment de la 2e
        return 4 + step + 8;
      },

      // Rafale finale : alternance rapide mais réactive
      gauntlet: (z, free, others) => {
        const step = clamp(G.speed * 0.58, 10, 16);
        const seq = [
          { type: "barrier", lane: pick(others) },
          { type: "sign", lane: pick(others) },
          { type: "crate", lane: pick(others) },
          { type: "barrier", lane: pick(others) },
        ];
        seq.forEach((s, i) => G.obstacles.push(new Obstacle(s.type, s.lane, z + 2 + i * step)));
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
  /* Renvoie l'obstacle percuté, ou null. Hitbox volontairement indulgente. */
  static check(player, obstacles) {
    const px = player.x;
    for (const o of obstacles) {
      if (o.dead) continue;
      const halfD = o.def.d / 2 + 0.45;             // fenêtre de profondeur
      const center = o.z + o.def.d / 2;
      if (Math.abs(center - CONFIG.PLAYER_Z) > halfD) continue;
      if (Math.abs(px - o.x) > 1.35) continue;      // pas sur la même voie

      if (o.type === "barrier") {
        // Sautable : les pieds doivent dépasser ~70 % de la barrière
        if (player.y > o.def.h * 0.7) continue;
        return o;
      }
      if (o.type === "sign") {
        // Glissade : la tête doit passer sous le panneau
        const top = player.y + player.height;
        if (top < o.def.gapBottom) continue;
        return o;
      }
      // crate / wagon : infranchissable
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
  hideAll() { this.show("__none__"); }

  setHud(on) { this.hud.classList.toggle("active", on); }

  updateHud(score, coins, best) {
    this.$("hud-score").textContent = Math.floor(score);
    this.$("hud-coins").textContent = coins;
    this.$("hud-best").textContent = best;
  }

  updatePowerups(active) {
    // active : { kind: {t, dur} }
    for (const kind of Object.keys(POWERUP_DEFS)) {
      const a = active[kind];
      let el = this.puBars[kind];
      if (a && !el) {
        el = document.createElement("div");
        el.className = "pu-badge";
        el.innerHTML = `<span class="pu pu-${kind}">${POWERUP_DEFS[kind].label}</span><div class="pu-bar"><div class="pu-fill" style="background:${POWERUP_DEFS[kind].color}"></div></div>`;
        this.puContainer.appendChild(el);
        this.puBars[kind] = el;
      } else if (!a && el) {
        el.remove();
        delete this.puBars[kind];
      }
      if (a && el) {
        el.querySelector(".pu-fill").style.width = `${(a.t / a.dur) * 100}%`;
      }
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

/* --------------------------------------------------------------------------
   Game — boucle principale, états, rendu des entités et effets
   -------------------------------------------------------------------------- */
class Game {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    this.ui = new UIManager();
    this.audio = new AudioManager();
    this.particles = new ParticleSystem();
    this.player = new Player(this);
    this.world = new World(this);
    this.spawner = new Spawner(this);
    this.scoreMgr = new ScoreManager();

    this.state = "loading"; // loading | menu | playing | paused | dying | gameover
    this.fxHigh = localStorage.getItem("metrodash_fx") !== "low";

    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.active = {};        // power-ups actifs { kind: {t, dur} }

    this.elapsed = 0;
    this.speed = CONFIG.BASE_SPEED;
    this.timescale = 1;
    this.shakeT = 0;
    this.dieT = 0;

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.input = new InputManager(this.canvas, {
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
    requestAnimationFrame((t) => this.loop(t));

    // Chargement éclair : tout est procédural
    setTimeout(() => this.toMenu(), 700);
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
      syncOptions();
    });
    $("btn-reset-best").addEventListener("click", () => {
      this.scoreMgr.resetBest();
      this.ui.$("menu-best").textContent = "0";
    });
    syncOptions();
  }

  /* ------------------------------ états ------------------------------ */
  toMenu() {
    this.state = "menu";
    this.audio.stopMusic();
    this.ui.setHud(false);
    this.ui.$("menu-best").textContent = this.scoreMgr.best;
    this.ui.show("menu");
    this.resetRun(); // décor animé derrière le menu
  }

  resetRun() {
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.active = {};
    this.elapsed = 0;
    this.speed = CONFIG.BASE_SPEED;
    this.timescale = 1;
    this.shakeT = 0;
    this.player.reset();
    this.world.reset();
    this.spawner.reset();
    this.scoreMgr.reset();
    this.particles.list.length = 0;
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
      this.last = performance.now(); // évite un dt géant à la reprise
    }
  }

  die() {
    this.state = "dying";
    this.dieT = 0.9;
    this.timescale = 0.25;   // ralenti dramatique
    this.shakeT = 0.5;
    this.audio.crash();
    this.audio.stopMusic();
    const p = this.projFn()(this.player.x, 1, CONFIG.PLAYER_Z);
    this.particles.emit({ x: p.x, y: p.y, count: this.fxHigh ? 26 : 12, color: "#ff8a2a", speed: 260, size: 6, life: 0.8 });
    this.particles.emit({ x: p.x, y: p.y, count: this.fxHigh ? 18 : 8, color: "#f4f6ff", speed: 200, size: 4, life: 0.6 });
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

  /* ------------------------------ power-ups ------------------------------ */
  activate(kind) {
    this.active[kind] = { t: CONFIG.POWERUP_DUR[kind], dur: CONFIG.POWERUP_DUR[kind] };
    this.audio.powerup();
  }
  has(kind) { return !!this.active[kind]; }

  /* ------------------------------ boucle ------------------------------ */
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    dt *= this.timescale;

    if (this.state === "menu" || this.state === "loading") {
      // décor qui défile doucement derrière le menu
      this.world.update(dt, 9);
    } else if (this.state === "playing") {
      this.update(dt);
    } else if (this.state === "dying") {
      this.dieT -= dt / this.timescale; // temps réel
      this.shakeT = Math.max(0, this.shakeT - dt);
      this.particles.update(dt);
      if (this.dieT <= 0) this.finishGameOver();
    }

    this.render();
  }

  update(dt) {
    this.elapsed += dt;

    // Progression de difficulté : +vitesse toutes les 15 s
    const target = Math.min(CONFIG.BASE_SPEED + Math.floor(this.elapsed / 15) * CONFIG.SPEED_STEP * 1.0
      + this.elapsed * 0.02, CONFIG.MAX_SPEED);
    const boost = this.has("boost") ? 1.55 : 1;
    this.speed = lerp(this.speed, target * boost, 1 - Math.exp(-1.6 * dt));

    const mult = this.has("x2") ? 2 : 1;
    this.scoreMgr.addDistance(this.speed * dt, mult);

    this.player.update(dt);
    this.world.update(dt, this.speed);
    this.spawner.update(dt, this.speed, this.elapsed);
    this.particles.update(dt);

    // Avancement des entités
    const dz = this.speed * dt;
    for (const o of this.obstacles) o.z -= dz;
    for (const c of this.coins) c.z -= dz;
    for (const p of this.powerups) p.z -= dz;
    this.obstacles = this.obstacles.filter((o) => !o.dead && o.z + o.def.d > CONFIG.KILL_Z);
    this.coins = this.coins.filter((c) => !c.dead && c.z > CONFIG.KILL_Z);
    this.powerups = this.powerups.filter((p) => !p.dead && p.z > CONFIG.KILL_Z);

    // Timers de power-ups
    for (const kind of Object.keys(this.active)) {
      this.active[kind].t -= dt;
      if (this.active[kind].t <= 0) delete this.active[kind];
    }

    // Aimant : attire les pièces proches vers le joueur
    if (this.has("magnet")) {
      for (const c of this.coins) {
        if (c.z < 20) {
          c.x = lerp(c.x, this.player.x, 1 - Math.exp(-8 * dt));
          c.y = lerp(c.y, 1.0 + this.player.y, 1 - Math.exp(-8 * dt));
        }
      }
    }

    // Collecte de pièces (fenêtre généreuse)
    const proj = this.projFn();
    for (const c of this.coins) {
      const grabR = this.has("magnet") ? 1.6 : 0.95;
      if (Math.abs(c.z - CONFIG.PLAYER_Z) < 1.4 &&
          Math.abs(c.x - this.player.x) < grabR &&
          Math.abs(c.y - (this.player.y + 1.0)) < 1.25) {
        c.dead = true;
        this.scoreMgr.addCoin(mult);
        this.audio.coin();
        const pc = proj(c.x, c.y, c.z);
        this.particles.emit({ x: pc.x, y: pc.y, count: this.fxHigh ? 8 : 4, color: "#ffc93c", speed: 140, size: 4, life: 0.45, gravity: 60 });
      }
    }

    // Ramassage de power-ups
    for (const p of this.powerups) {
      if (Math.abs(p.z - CONFIG.PLAYER_Z) < 1.4 && Math.abs(p.x - this.player.x) < 1.1 && this.player.y < 1.6) {
        p.dead = true;
        this.activate(p.kind);
        const pp = proj(p.x, 1.2, p.z);
        this.particles.emit({ x: pp.x, y: pp.y, count: this.fxHigh ? 14 : 7, color: POWERUP_DEFS[p.kind].color, speed: 180, size: 5, life: 0.6, gravity: 40 });
      }
    }

    // Collisions
    if (this.player.invincibleT <= 0 && !this.has("boost")) {
      const hit = CollisionManager.check(this.player, this.obstacles);
      if (hit) {
        if (this.has("shield")) {
          delete this.active.shield;       // le bouclier absorbe UN choc
          hit.dead = true;
          this.player.invincibleT = 1.2;
          this.shakeT = 0.25;
          this.audio.shieldHit();
          const ph = proj(hit.x, 1, hit.z);
          this.particles.emit({ x: ph.x, y: ph.y, count: this.fxHigh ? 16 : 8, color: "#00d0ff", speed: 220, size: 5, life: 0.6 });
        } else {
          this.die();
        }
      }
    } else if (this.has("boost")) {
      // En boost : on pulvérise les obstacles traversés
      const hit = CollisionManager.check(this.player, this.obstacles);
      if (hit) {
        hit.dead = true;
        this.shakeT = 0.18;
        this.audio.noise({ dur: 0.15, vol: 0.25, freq: 700 });
        const ph = proj(hit.x, 1.2, hit.z);
        this.particles.emit({ x: ph.x, y: ph.y, count: this.fxHigh ? 20 : 10, color: "#ff8a2a", speed: 260, size: 6, life: 0.7 });
      }
    }

    // Particules de foulée / traînée de boost
    if (this.fxHigh) {
      if (!this.player.jumping && Math.random() < dt * 22) {
        const pp = proj(this.player.x + rand(-0.3, 0.3), 0.05, CONFIG.PLAYER_Z + rand(-0.4, 0));
        this.particles.emit({ x: pp.x, y: pp.y, count: 1, color: "rgba(180,190,220,0.8)", speed: 30, size: 3, life: 0.4, gravity: -30 });
      }
      if (this.has("boost") && Math.random() < dt * 60) {
        const pp = proj(this.player.x + rand(-0.35, 0.35), rand(0.2, 1.6) + this.player.y, CONFIG.PLAYER_Z + 0.4);
        this.particles.emit({ x: pp.x, y: pp.y, count: 1, color: pick(["#ff8a2a", "#ffc93c"]), speed: 60, size: 5, life: 0.5, gravity: 0, angle: Math.PI / 2, spread: 0.6 });
      }
    }

    this.shakeT = Math.max(0, this.shakeT - dt);
    this.ui.updateHud(this.scoreMgr.score, this.scoreMgr.coins, this.scoreMgr.best);
    this.ui.updatePowerups(this.active);
  }

  /* ------------------------------ rendu ------------------------------ */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = innerWidth;
    this.h = innerHeight;
    // Focale adaptée au format (portrait ↔ paysage) sans déformer le gameplay :
    // en portrait le joueur descend vers le bas de l'écran pour dégager la vue.
    const portrait = this.h > this.w;
    this.focal = portrait
      ? Math.min(this.h * 0.52, this.w * 1.05)
      : Math.min(this.h * 0.92, this.w * 0.78);
    this.horizon = this.h * (portrait ? 0.44 : 0.36);
    this.vignette = null; // regénérée au prochain rendu
  }

  projFn() {
    const { focal, horizon, w } = this;
    const cx = w / 2;
    const shx = this.shakeX || 0, shy = this.shakeY || 0;
    return (x, y, z) => {
      const s = focal / Math.max(z, 0.6);
      return { x: cx + x * s + shx, y: horizon + (CONFIG.CAM_H - y) * s + shy, s };
    };
  }

  render() {
    const ctx = this.ctx;
    const { w, h, horizon } = this;

    // Secousse caméra
    if (this.shakeT > 0) {
      const a = this.shakeT * 14;
      this.shakeX = rand(-a, a);
      this.shakeY = rand(-a, a);
    } else {
      this.shakeX = this.shakeY = 0;
    }
    const proj = this.projFn();

    ctx.clearRect(0, 0, w, h);
    this.world.draw(ctx, proj, w, h, horizon + (this.shakeY || 0));

    // Entités triées de la plus lointaine à la plus proche
    const drawables = [
      ...this.obstacles.map((o) => ({ z: o.z + o.def.d, kind: "obs", o })),
      ...this.coins.map((c) => ({ z: c.z, kind: "coin", o: c })),
      ...this.powerups.map((p) => ({ z: p.z, kind: "pu", o: p })),
    ].sort((a, b) => b.z - a.z);

    for (const d of drawables) {
      if (d.o.z > 92 || d.o.z < 2) continue;
      if (d.kind === "obs") this.drawObstacle(ctx, proj, d.o);
      else if (d.kind === "coin") this.drawCoin(ctx, proj, d.o);
      else this.drawPowerUp(ctx, proj, d.o);
    }

    // Joueur (sauf une fois l'écran game over affiché)
    if (this.state !== "gameover") {
      this.player.draw(ctx, proj, { shield: this.has("shield"), boost: this.has("boost") });
    }

    this.particles.draw(ctx);

    // Lignes de vitesse sur les bords quand ça va vite
    const speedFx = clamp((this.speed - 20) / 14, 0, 1) + (this.has("boost") ? 0.5 : 0);
    if (this.fxHigh && speedFx > 0 && (this.state === "playing" || this.state === "dying")) {
      ctx.strokeStyle = `rgba(255,255,255,${0.16 * speedFx})`;
      ctx.lineWidth = 2;
      const n = Math.floor(9 * speedFx);
      for (let i = 0; i < n; i++) {
        const y = rand(0, h);
        const edge = Math.random() < 0.5;
        const x0 = edge ? rand(0, w * 0.16) : rand(w * 0.84, w);
        const len = rand(30, 90) * speedFx;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + (edge ? -len : len), y);
        ctx.stroke();
      }
    }

    // Vignette pour le focus central (mise en cache)
    if (!this.vignette) {
      const vg = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, h * 0.95);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.42)");
      this.vignette = vg;
    }
    ctx.fillStyle = this.vignette;
    ctx.fillRect(0, 0, w, h);

    // Flash rouge translucide pendant la mort
    if (this.state === "dying") {
      ctx.fillStyle = `rgba(255,60,40,${0.22 * (this.dieT / 0.9)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /* Boîte pseudo-3D générique : faces avant + dessus + côté */
  drawBox(ctx, proj, cx, w2, y0, y1, z0, z1, faces) {
    const fl = proj(cx - w2, y0, z0), fr = proj(cx + w2, y0, z0);
    const ftl = proj(cx - w2, y1, z0), ftr = proj(cx + w2, y1, z0);
    const btl = proj(cx - w2, y1, z1), btr = proj(cx + w2, y1, z1);

    // dessus
    ctx.fillStyle = faces.top;
    ctx.beginPath();
    ctx.moveTo(ftl.x, ftl.y); ctx.lineTo(ftr.x, ftr.y);
    ctx.lineTo(btr.x, btr.y); ctx.lineTo(btl.x, btl.y);
    ctx.closePath(); ctx.fill();

    // côté visible (selon la position par rapport au centre de l'écran)
    if (cx !== 0 && faces.side) {
      const inner = cx > 0 ? -w2 : w2;
      const bl = proj(cx + inner, y0, z1);
      const tl = proj(cx + inner, y1, z1);
      const fl2 = proj(cx + inner, y0, z0);
      const ftl2 = proj(cx + inner, y1, z0);
      ctx.fillStyle = faces.side;
      ctx.beginPath();
      ctx.moveTo(fl2.x, fl2.y); ctx.lineTo(ftl2.x, ftl2.y);
      ctx.lineTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y);
      ctx.closePath(); ctx.fill();
    }

    // face avant
    ctx.fillStyle = faces.front;
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y); ctx.lineTo(fr.x, fr.y);
    ctx.lineTo(ftr.x, ftr.y); ctx.lineTo(ftl.x, ftl.y);
    ctx.closePath(); ctx.fill();

    return { fl, fr, ftl, ftr };
  }

  drawObstacle(ctx, proj, o) {
    const fog = clamp(1 - o.z / 95, 0.15, 1);
    ctx.globalAlpha = fog;
    const def = o.def;

    if (o.type === "barrier") {
      // Barrière rayée orange/blanc sur pieds
      const f = this.drawBox(ctx, proj, o.x, def.w / 2, 0.55, def.h, o.z, o.z + def.d,
        { front: "#ff8a2a", top: "#ffab5e", side: "#d96f15" });
      // rayures blanches
      const stripes = 3;
      ctx.fillStyle = "#f4f6ff";
      for (let i = 0; i < stripes; i++) {
        const t0 = (i + 0.15) / stripes, t1 = (i + 0.5) / stripes;
        ctx.beginPath();
        ctx.moveTo(lerp(f.fl.x, f.fr.x, t0), lerp(f.fl.y, f.fr.y, t0));
        ctx.lineTo(lerp(f.fl.x, f.fr.x, t1), lerp(f.fl.y, f.fr.y, t1));
        ctx.lineTo(lerp(f.ftl.x, f.ftr.x, t1), lerp(f.ftl.y, f.ftr.y, t1));
        ctx.lineTo(lerp(f.ftl.x, f.ftr.x, t0), lerp(f.ftl.y, f.ftr.y, t0));
        ctx.closePath(); ctx.fill();
      }
      // pieds
      const s = proj(o.x, 0, o.z).s;
      ctx.fillStyle = "#454b68";
      for (const sx of [-def.w / 2 + 0.2, def.w / 2 - 0.2]) {
        const pf = proj(o.x + sx, 0, o.z);
        ctx.fillRect(pf.x - s * 0.05, pf.y - s * 0.56, s * 0.1, s * 0.56);
      }
    } else if (o.type === "sign") {
      // Panneau suspendu entre deux poteaux : passage en glissade
      const gap = def.gapBottom;
      const top = gap + def.h;
      // poteaux
      ctx.strokeStyle = "#454b68";
      const pb = proj(o.x, 0, o.z);
      ctx.lineWidth = Math.max(2, pb.s * 0.09);
      for (const sx of [-def.w / 2, def.w / 2]) {
        const a = proj(o.x + sx, 0, o.z);
        const b = proj(o.x + sx, top, o.z);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // panneau néon
      const tl = proj(o.x - def.w / 2, top, o.z), br = proj(o.x + def.w / 2, gap, o.z);
      ctx.fillStyle = "#141724";
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeStyle = "#00d0ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.fillStyle = "#00d0ff";
      ctx.font = `800 ${Math.max(8, pb.s * 0.34)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("⬇ BAISSE-TOI", (tl.x + br.x) / 2, (tl.y + br.y) / 2 + pb.s * 0.12);
      // flèche clignotante dessous
      if (Math.floor(performance.now() / 400) % 2 === 0) {
        ctx.fillStyle = "rgba(0,208,255,0.7)";
        const pa = proj(o.x, gap - 0.25, o.z);
        ctx.beginPath();
        ctx.moveTo(pa.x - pa.s * 0.14, pa.y - pa.s * 0.12);
        ctx.lineTo(pa.x + pa.s * 0.14, pa.y - pa.s * 0.12);
        ctx.lineTo(pa.x, pa.y + pa.s * 0.08);
        ctx.closePath(); ctx.fill();
      }
    } else if (o.type === "crate") {
      // Caisse taguée
      const hue = o.tint < 0.5 ? { f: "#8b5cf6", t: "#a78bfa", s: "#6d3fd6" } : { f: "#4a5178", t: "#5d6591", s: "#3a4060" };
      const f = this.drawBox(ctx, proj, o.x, def.w / 2, 0, def.h, o.z, o.z + def.d,
        { front: hue.f, top: hue.t, side: hue.s });
      // tag graffiti
      const pc = proj(o.x, def.h * 0.5, o.z);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `900 ${Math.max(8, pc.s * 0.4)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(o.tint < 0.33 ? "DASH" : o.tint < 0.66 ? "ZONE" : "VLT", pc.x, pc.y + pc.s * 0.14);
      // liseré de contour
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(f.fl.x, f.fl.y); ctx.lineTo(f.fr.x, f.fr.y);
      ctx.lineTo(f.ftr.x, f.ftr.y); ctx.lineTo(f.ftl.x, f.ftl.y);
      ctx.closePath(); ctx.stroke();
    } else if (o.type === "wagon") {
      // Rame de métro à l'arrêt : longue, avec fenêtres et phare
      const c = o.tint < 0.5 ? { f: "#2f7bff", t: "#5d9aff", s: "#1f5cd0" } : { f: "#39406b", t: "#4c548a", s: "#2b3050" };
      this.drawBox(ctx, proj, o.x, def.w / 2, 0.25, def.h, o.z, o.z + def.d,
        { front: c.f, top: c.t, side: c.s });
      const front = proj(o.x, 0, o.z);
      // bandeau + fenêtres avant
      const wl = proj(o.x - def.w / 2 + 0.25, def.h * 0.55, o.z);
      const wr = proj(o.x + def.w / 2 - 0.25, def.h * 0.8, o.z);
      ctx.fillStyle = "#101322";
      ctx.fillRect(wl.x, wr.y, wr.x - wl.x, wl.y - wr.y);
      // phare (halo en deux passes, sans shadowBlur coûteux)
      const lampY = proj(o.x, 0.75, o.z).y;
      const lampR = Math.max(2, front.s * 0.09);
      ctx.fillStyle = "rgba(255,233,168,0.35)";
      ctx.beginPath();
      ctx.arc(front.x, lampY, lampR * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe9a8";
      ctx.beginPath();
      ctx.arc(front.x, lampY, lampR, 0, Math.PI * 2);
      ctx.fill();
      // fenêtres latérales le long du wagon
      ctx.fillStyle = "rgba(190,215,255,0.5)";
      const inner = o.x > 0 ? -1 : 1;
      for (let zz = o.z + 2; zz < o.z + def.d - 1; zz += 2.4) {
        const pw = proj(o.x + inner * def.w / 2, 1.9, zz);
        const ws = Math.max(2, pw.s * 0.5);
        ctx.fillRect(pw.x - ws / 2, pw.y - ws * 0.4, ws * 0.8, ws * 0.55);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawCoin(ctx, proj, c) {
    const fog = clamp(1 - c.z / 95, 0.2, 1);
    const p = proj(c.x, c.y, c.z);
    const spin = Math.cos(performance.now() / 180 + c.spin);
    const r = Math.max(2, p.s * 0.32);
    ctx.globalAlpha = fog;
    // halo
    ctx.fillStyle = "rgba(255,201,60,0.25)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    // pièce qui tourne (ellipse)
    ctx.fillStyle = "#ffc93c";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * Math.max(0.18, Math.abs(spin)), r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.stroke();
    if (Math.abs(spin) > 0.5) {
      ctx.fillStyle = "#ffe9a8";
      ctx.font = `900 ${r * 1.05}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("¤", p.x, p.y + r * 0.38);
    }
    ctx.globalAlpha = 1;
  }

  drawPowerUp(ctx, proj, pu) {
    const def = POWERUP_DEFS[pu.kind];
    const bob = Math.sin(performance.now() / 300 + pu.bob) * 0.15;
    const p = proj(pu.x, 1.2 + bob, pu.z);
    const r = Math.max(4, p.s * 0.42);
    const fog = clamp(1 - pu.z / 95, 0.2, 1);
    ctx.globalAlpha = fog;
    // halo pulsant
    const pulse = 1 + Math.sin(performance.now() / 200) * 0.12;
    const g = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r * 2.2 * pulse);
    g.addColorStop(0, def.color + "");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = fog * 0.35;
    ctx.fillStyle = g;
    ctx.fillRect(p.x - r * 2.4, p.y - r * 2.4, r * 4.8, r * 4.8);
    ctx.globalAlpha = fog;
    // capsule
    ctx.fillStyle = "#12141c";
    ctx.strokeStyle = def.color;
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.beginPath();
    ctx.roundRect(p.x - r, p.y - r, r * 2, r * 2, r * 0.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.font = `900 ${r * 1.05}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(def.label, p.x, p.y + r * 0.4);
    ctx.globalAlpha = 1;
  }
}

/* --------------------------------------------------------------------------
   Lancement
   -------------------------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  window.metroDash = new Game();
});
