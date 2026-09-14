import {
  availablePowers,
  comboMult,
  comboWindow,
  critChance,
  critPayout,
  fanInterval,
  FIXED_DT,
  fumigateNeed,
  gatesCrossed,
  maxFlies,
  nextUnlock,
  paperIps,
  PESTS,
  pickSpawnKind,
  POWER_META,
  prestigeMult,
  ROOM_ORDER,
  ROOMS,
  roomOwned,
  roomRevealed,
  roomTempo,
  smashDamage,
  smashRadius,
  spawnInterval,
  swatterKind,
  trapBites,
  trapInterval,
  trapRadius,
  upgradeCost,
  upgradeUnlocked,
  UPGRADE_META,
  WORLD_H,
  WORLD_W,
  zapperInterval,
} from "./catalog";
import { playFumigate, playSlap, playSplat, playUpgrade, playZap, setBuzz } from "./audio";
import { clamp, finite } from "./assert";
import { Juice } from "./juice";
import { defaultSave, loadSave, writeSave } from "./save";
import type {
  Decal,
  Fly,
  Floater,
  GoreLevel,
  HudSnap,
  Impact,
  Particle,
  PestKind,
  Pickup,
  PowerId,
  RoomId,
  SaveData,
  Screen,
  Settings,
  UpgradeId,
} from "./types";

const PLAY = { x0: 90, y0: 150, x1: WORLD_W - 90, y1: WORLD_H - 70 };
const PARTICLE_CAP = 96;
const DECAL_CAP = 36;
const FLOATER_CAP = 6;
const IMPACT_CAP = 5;
const CHAIN_CAP = 4;
const FLY_HARD_CAP = 16;
export const TRAP_POS = { x: WORLD_W * 0.78, y: WORLD_H * 0.62 };
export const FAN_POS = { x: WORLD_W - 168, y: 208 };
export const ZAPPER_POS = { x: WORLD_W * 0.5, y: 198 };
export const PAPER_POS = { x: 310, y: 210 };

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

const BLOOD = ["#7f1d1d", "#991b1b", "#450a0a", "#b91c1c", "#3f0d0d"];
const BILE = ["#3f6212", "#4d7c0f", "#166534", "#a3e635", "#14532d"];

export class Sim {
  save: SaveData = defaultSave();
  screen: Screen = "title";
  flies: Fly[] = [];
  pickups: Pickup[] = [];
  particles: Particle[] = [];
  decals: Decal[] = [];
  impacts: Impact[] = [];
  floaters: Floater[] = [];
  juice = new Juice();
  combo = 0;
  comboT = 0;
  kills = 0;
  spawnT = 0;
  fanT = 0;
  trapT = 0;
  zapperT = 0;
  paperAcc = 0;
  queenCD = 40;
  hint: string | null = "Tap a fly. Do not miss the wet part.";
  firstKill = false;
  nextId = 1;
  lastSave = 0;
  dirty = false;
  reduced = false;
  pointer = { x: WORLD_W / 2, y: WORLD_H / 2, slam: 0, sx: WORLD_W / 2, sy: WORLD_H / 2 };
  chains: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
  power: { kind: PowerId; t: number } | null = null;
  animT = 0;
  trapChomp = 0;
  private partI = 0;
  private buzzT = 0;
  private floorT = 0;
  private killDepth = 0;
  lowFx = false;

  constructor() {
    this.particles = Array.from({ length: PARTICLE_CAP }, () => ({
      live: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 4,
      rot: 0,
      spin: 0,
      color: "#7f1d1d",
      kind: "drop" as const,
    }));
  }

  boot() {
    this.save = loadSave();
    this.applySettings(this.save.settings);
    this.seedAttract();
  }

  applySettings(s: Settings) {
    this.save.settings = s;
    this.juice.shakeOn = s.shake;
    this.juice.reduced = this.reduced;
    this.dirty = true;
  }

  setReduced(on: boolean) {
    this.reduced = on;
    this.juice.reduced = on;
  }

  startPlay() {
    if (this.screen === "play") return;
    this.screen = "play";
    if (this.flies.length < 3) this.seedAttract();
    this.hint = this.firstKill ? null : "Tap a fly. Do not miss the wet part.";
  }

  pause() {
    if (this.screen === "play") this.screen = "paused";
  }

  resume() {
    if (this.screen === "paused") this.screen = "play";
  }

  private owns(id: RoomId) {
    return roomOwned(this.save.unlockedRooms, id);
  }

  setRoom(id: RoomId): boolean {
    if (this.owns(id)) {
      if (id === this.save.room) return true;
      this.save.room = id;
      this.flies = [];
      this.pickups = [];
      this.combo = 0;
      this.comboT = 0;
      this.seedAttract();
      this.hint = `Now in the ${ROOMS[id].name.toLowerCase()}.`;
      this.dirty = true;
      this.flushSave();
      this.pushFloater(WORLD_W / 2, 110, ROOMS[id].name.toUpperCase(), "#f3ece4", 34);
      if (this.screen === "title") this.startPlay();
      return true;
    }
    const need = ROOMS[id].unlockKills;
    const remain = need - this.save.lifetimeKills;
    if (remain > 0) {
      this.hint = `${ROOMS[id].name} in ${remain} kill${remain === 1 ? "" : "s"}.`;
    } else {
      this.hint = `Unlock ${ROOMS[id].name} in the shop for ${ROOMS[id].cost} ichor.`;
    }
    return false;
  }

  buyRoom(id: RoomId): boolean {
    if (id === "kitchen" || this.owns(id)) return this.setRoom(id);
    if (!roomRevealed(id, this.save.lifetimeKills)) {
      const remain = ROOMS[id].unlockKills - this.save.lifetimeKills;
      this.hint = `${ROOMS[id].name} in ${remain} kill${remain === 1 ? "" : "s"}.`;
      return false;
    }
    const cost = ROOMS[id].cost;
    if (this.save.ichor < cost) {
      this.hint = `${ROOMS[id].name} costs ${cost} ichor.`;
      return false;
    }
    if (this.screen === "title") this.startPlay();
    this.save.ichor -= cost;
    this.save.unlockedRooms = [...this.save.unlockedRooms, id];
    this.dirty = true;
    if (this.save.settings.sfx) playUpgrade();
    this.hint = `${ROOMS[id].name} is yours.`;
    this.flushSave();
    return this.setRoom(id);
  }

  resetAll() {
    this.save = defaultSave();
    this.combo = 0;
    this.comboT = 0;
    this.kills = 0;
    this.decals = [];
    this.flies = [];
    this.pickups = [];
    this.impacts = [];
    this.floaters = [];
    this.power = null;
    this.trapChomp = 0;
    this.firstKill = false;
    this.killDepth = 0;
    this.screen = "title";
    this.seedAttract();
    this.dirty = true;
    this.flushSave();
  }

  private pMult() {
    return prestigeMult(this.save.prestige);
  }

  private gore(): GoreLevel {
    return this.save.settings.gore;
  }

  private giant() {
    return this.power?.kind === "giant";
  }

  private acidOn() {
    return this.power?.kind === "acid";
  }

  private frenzyOn() {
    return this.combo >= 8 || this.power?.kind === "frenzy";
  }

  private voltOn() {
    return this.save.upgrades.volt > 0 || this.power?.kind === "volt";
  }

  seedAttract() {
    this.flies = [];
    const roster = ROOMS[this.save.room].pests;
    const kind = roster.includes("housefly") ? "housefly" : roster[0];
    for (let i = 0; i < 3; i++) this.spawnOne(kind, true);
  }

  spawn(kind: PestKind, anywhere = false): Fly | null {
    const first = this.spawnOne(kind, anywhere);
    if (kind === "fruitfly" && this.screen === "play" && first) {
      const since = this.save.lifetimeKills - PESTS.fruitfly.unlockKills;
      const extraCount = since < 80 ? 0 : since < 220 ? 1 : 2;
      const cap = this.flyCap();
      for (let i = 0; i < extraCount; i++) {
        if (this.flies.length >= cap) break;
        const extra = this.spawnOne("fruitfly", true);
        if (extra) {
          extra.x = first.x + rand(-28, 28);
          extra.y = first.y + rand(-22, 22);
        }
      }
    }
    return first;
  }

  private flyCap() {
    return Math.min(FLY_HARD_CAP, maxFlies(this.save.upgrades.swarm, this.save.prestige));
  }

  private spawnOne(kind: PestKind, anywhere = false): Fly | null {
    if (this.flies.length >= FLY_HARD_CAP) return null;
    const def = PESTS[kind];
    const edge = Math.floor(Math.random() * 4);
    let x = rand(PLAY.x0, PLAY.x1);
    let y = def.ground
      ? rand(PLAY.y0 + (PLAY.y1 - PLAY.y0) * 0.48, PLAY.y1)
      : rand(PLAY.y0, PLAY.y1);
    if (!anywhere) {
      if (def.ground) {
        x = edge % 2 === 0 ? PLAY.x0 : PLAY.x1;
      } else {
        if (edge === 0) y = PLAY.y0;
        if (edge === 1) y = PLAY.y1;
        if (edge === 2) x = PLAY.x0;
        if (edge === 3) x = PLAY.x1;
      }
    }
    const fly: Fly = {
      id: this.nextId++,
      kind,
      x,
      y,
      vx: rand(-40, 40),
      vy: rand(-40, 40),
      heading: rand(0, Math.PI * 2),
      hp: def.hp,
      maxHp: def.hp,
      r: def.r,
      speed: def.speed * (0.9 + Math.random() * 0.25),
      frame: Math.random() * 4,
      bob: Math.random() * Math.PI * 2,
      turnT: rand(0.2, 0.9),
      dartT: rand(0.4, 1.6),
      flash: 0,
      life: 0,
      maxLife: kind === "goldfly" ? 7.5 : 999,
    };
    this.flies.push(fly);
    return fly;
  }

  tick(dt: number) {
    const cap = clamp(dt, 0, 0.05);
    this.pointer.sx += (this.pointer.x - this.pointer.sx) * (1 - Math.exp(-14 * cap));
    this.pointer.sy += (this.pointer.y - this.pointer.sy) * (1 - Math.exp(-14 * cap));
    this.pointer.slam = Math.max(0, this.pointer.slam - cap * 6.5);
    this.animT += cap;
    if (this.animT > 256) this.animT -= 256;
    this.trapChomp = Math.max(0, this.trapChomp - cap);
    this.juice.tick(cap);
    this.tickPresentation(cap);

    if (this.screen === "paused") return;

    let acc = cap;
    if (this.juice.hitstop > 0) {
      this.tickFliesVisual(acc);
      return;
    }
    let guard = 0;
    while (acc > 0 && guard++ < 3) {
      const step = Math.min(FIXED_DT, acc);
      if (!Number.isFinite(step) || step <= 0) break;
      this.step(step);
      acc -= step;
    }
  }

  private step(dt: number) {
    this.tickFlies(dt);
    this.tickPickups(dt);
    this.spawnT += dt;
    this.queenCD = Math.max(0, this.queenCD - dt);
    if (this.power) {
      this.power.t -= dt;
      if (this.power.t <= 0) this.power = null;
    }

    const playing = this.screen === "play";
    const interval =
      (playing ? spawnInterval(this.save.upgrades.lure) : 1.6) * roomTempo(this.save.room);
    const cap = playing ? this.flyCap() : 6;
    if (this.spawnT >= interval && this.flies.length < cap) {
      this.spawnT = 0;
      const kind = this.pickKind(playing);
      if (kind === "queen") this.queenCD = 70;
      this.spawn(kind);
    }

    const floor = Math.min(3, cap);
    this.floorT += dt;
    if (this.flies.length < floor && this.floorT > 0.22) {
      this.floorT = 0;
      this.spawn(this.pickKind(playing));
    }

    if (playing) {
      this.paperAcc += paperIps(this.save.upgrades.paper, this.pMult()) * dt;
      if (this.paperAcc >= 1) {
        const add = Math.floor(this.paperAcc);
        this.grant(add, false);
        this.paperAcc -= add;
      }
      if (this.save.upgrades.fan > 0) {
        this.fanT += dt;
        if (this.fanT >= fanInterval(this.save.upgrades.fan)) {
          this.fanT = 0;
          this.autoSmash();
        }
      }
      if (this.save.upgrades.zapper > 0) {
        this.zapperT += dt;
        if (this.zapperT >= zapperInterval(this.save.upgrades.zapper)) {
          this.zapperT = 0;
          this.lampZap();
        }
      }
      if (this.save.upgrades.trap > 0) {
        this.trapT += dt;
        if (this.trapT >= trapInterval(this.save.upgrades.trap)) {
          this.trapT = 0;
          const bites = trapBites(this.save.upgrades.trap);
          for (let i = 0; i < bites; i++) this.trapEat();
        }
      }
    }

    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    if (this.flies.length > FLY_HARD_CAP) this.flies.length = FLY_HARD_CAP;

    this.buzzT += dt;
    if (this.buzzT > 0.12) {
      this.buzzT = 0;
      setBuzz(this.flies.length, this.frenzyOn());
    }
    this.lastSave += dt;
    if (this.dirty && this.lastSave > 8) this.flushSave();
  }

  private pickKind(playing: boolean): PestKind {
    if (!playing) {
      const roster = ROOMS[this.save.room].pests;
      return roster.includes("housefly") ? "housefly" : roster[0];
    }
    let kind = pickSpawnKind(
      this.save.lifetimeKills,
      this.save.upgrades.breed,
      this.flies.some((f) => f.kind === "queen") || this.queenCD > 0,
      this.save.room,
    );
    if (kind === "queen" && this.queenCD > 0) {
      const roster = ROOMS[this.save.room].pests;
      kind = roster.includes("housefly") ? "housefly" : roster[0];
    }
    return kind;
  }

  private tickFliesVisual(dt: number) {
    for (const f of this.flies) {
      const ground = PESTS[f.kind].ground;
      f.frame += dt * (ground ? 6 : 14);
      if (f.frame > 32) f.frame %= 4;
      f.bob += dt * (ground ? 3 : 7);
      if (f.bob > Math.PI * 8) f.bob %= Math.PI * 2;
      f.flash = Math.max(0, f.flash - dt * 8);
    }
  }

  private tickFlies(dt: number) {
    const paper = this.save.upgrades.paper;
    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      const def = PESTS[f.kind];
      f.life += dt;
      f.frame += dt * (def.ground ? 6 : 14);
      if (f.frame > 32) f.frame %= 4;
      f.bob += dt * (def.ground ? 3 : 7);
      if (f.bob > Math.PI * 8) f.bob %= Math.PI * 2;
      f.flash = Math.max(0, f.flash - dt * 8);
      f.turnT -= dt;
      f.dartT -= dt;

      if (f.kind === "goldfly" && f.life > f.maxLife) {
        this.flies.splice(i, 1);
        continue;
      }

      if (f.turnT <= 0) {
        f.heading += rand(-1.1, 1.1);
        f.turnT = f.kind === "goldfly" ? rand(0.12, 0.28) : rand(0.28, 0.9);
      }

      if (f.kind === "moth" && this.save.upgrades.zapper > 0) {
        const tx = ZAPPER_POS.x;
        const ty = ZAPPER_POS.y + 90;
        f.heading = Math.atan2(ty - f.y, tx - f.x) + rand(-0.55, 0.55);
      }

      if (f.kind === "wasp" && f.dartT <= 0) {
        const toward = Math.atan2(this.pointer.sy - f.y, this.pointer.sx - f.x);
        f.heading = toward + rand(-0.4, 0.4);
        f.vx += Math.cos(f.heading) * f.speed * 1.8;
        f.vy += Math.sin(f.heading) * f.speed * 1.8;
        f.dartT = rand(0.7, 1.5);
      } else if ((f.kind === "mosquito" || f.kind === "goldfly") && f.dartT <= 0) {
        f.heading = rand(0, Math.PI * 2);
        f.vx += Math.cos(f.heading) * f.speed * 1.4;
        f.vy += Math.sin(f.heading) * f.speed * 1.4;
        f.dartT = rand(0.35, 0.9);
      } else if (f.kind === "cockroach" && f.dartT <= 0) {
        const away = Math.atan2(f.y - this.pointer.sy, f.x - this.pointer.sx);
        f.heading = away + rand(-0.25, 0.25);
        f.vx += Math.cos(f.heading) * f.speed * 2.4;
        f.vy += Math.sin(f.heading) * f.speed * 2.4;
        f.dartT = rand(0.45, 1.1);
      } else if (f.kind === "fruitfly" && f.dartT <= 0) {
        f.heading += rand(-0.8, 0.8);
        f.vx += Math.cos(f.heading) * f.speed * 0.9;
        f.vy += Math.sin(f.heading) * f.speed * 0.9;
        f.dartT = rand(0.2, 0.5);
      }

      if (f.kind === "queen") {
        const cx = WORLD_W / 2;
        const cy = WORLD_H * 0.52;
        f.heading = Math.atan2(cy - f.y, cx - f.x) + 0.9;
        if (this.screen === "play" && Math.random() < dt * 0.22 && this.flies.length < this.flyCap()) {
          const m = this.spawnOne(Math.random() < 0.5 ? "housefly" : "maggot", true);
          if (m) {
            m.x = f.x + rand(-20, 20);
            m.y = f.y + rand(-20, 20);
          }
        }
      }

      const accel = def.ground ? 2.2 : 3.4;
      f.vx += Math.cos(f.heading) * f.speed * accel * dt;
      f.vy += Math.sin(f.heading) * f.speed * accel * dt;
      const drag = def.ground ? 3.2 : 2.1;
      const d = Math.exp(-drag * dt);
      f.vx *= d;
      f.vy *= d;

      if (paper > 0) {
        const pd = Math.hypot(f.x - PAPER_POS.x, f.y - PAPER_POS.y);
        if (pd < 70 + paper * 12) {
          const stick = Math.exp(-(2.2 + paper * 0.35) * dt);
          f.vx *= stick;
          f.vy *= stick;
        }
      }

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) {
        f.x = WORLD_W / 2;
        f.y = WORLD_H * 0.55;
        f.vx = 0;
        f.vy = 0;
      }

      const y0 = def.ground ? PLAY.y0 + (PLAY.y1 - PLAY.y0) * 0.42 : PLAY.y0;
      if (f.x < PLAY.x0) {
        f.x = PLAY.x0;
        f.vx = Math.abs(f.vx);
        f.heading = Math.atan2(f.vy, f.vx);
      }
      if (f.x > PLAY.x1) {
        f.x = PLAY.x1;
        f.vx = -Math.abs(f.vx);
        f.heading = Math.atan2(f.vy, f.vx);
      }
      if (f.y < y0) {
        f.y = y0;
        f.vy = Math.abs(f.vy);
        f.heading = Math.atan2(f.vy, f.vx);
      }
      if (f.y > PLAY.y1) {
        f.y = PLAY.y1;
        f.vy = -Math.abs(f.vy);
        f.heading = Math.atan2(f.vy, f.vx);
      }
    }
  }

  private tickPickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.bob += dt * 5;
      p.life -= dt;
      if (p.life <= 0) this.pickups.splice(i, 1);
    }
  }

  private tickPresentation(dt: number) {
    for (const p of this.particles) {
      if (!p.live) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.live = false;
        continue;
      }
      p.vy += (p.kind === "spark" ? 80 : 520) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.vx *= Math.exp(-1.2 * dt);
    }
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      this.impacts[i].t += dt;
      if (this.impacts[i].t > 0.32) this.impacts.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      f.y -= 42 * dt;
      if (f.t > 0.85) this.floaters.splice(i, 1);
    }
    for (let i = this.chains.length - 1; i >= 0; i--) {
      this.chains[i].t -= dt;
      if (this.chains[i].t <= 0) this.chains.splice(i, 1);
    }
    if (this.chains.length > CHAIN_CAP) this.chains.splice(0, this.chains.length - CHAIN_CAP);
  }

  pointerMove(x: number, y: number) {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  smashAt(x: number, y: number, auto = false): number {
    const px = finite(x);
    const py = finite(y);
    this.pointer.x = px;
    this.pointer.y = py;
    if (!auto) this.pointer.slam = 1;
    const r = smashRadius(this.save.upgrades.reach, this.giant()) * (auto ? 0.55 : 1);
    const dmg =
      smashDamage(this.save.upgrades.power, this.save.upgrades.spike, this.acidOn()) *
      (auto ? 0.7 : 1);
    const pan = (px / WORLD_W) * 2 - 1;
    let hits = 0;
    let killed = 0;

    this.collectPickups(px, py, r);

    for (let i = this.flies.length - 1; i >= 0; i--) {
      const f = this.flies[i];
      const d = Math.hypot(f.x - px, f.y - py);
      if (!Number.isFinite(d) || d >= r + f.r * 0.55) continue;
      if (f.hp <= 0) continue;
      hits += 1;
      this.hurt(f, dmg, px, py, auto);
      if (f.hp <= 0) killed += 1;
    }

    if (hits > 0 && this.voltOn() && !auto) {
      const hops = 1 + Math.floor(this.save.upgrades.volt / 2) + (this.power?.kind === "volt" ? 2 : 0);
      this.arcFrom(px, py, Math.min(6, hops));
    }

    if (hits === 0) {
      if (!auto && this.save.settings.sfx) playSlap(pan);
      this.juice.add(0.08, 0, 0);
      return 0;
    }

    if (this.screen === "title") this.startPlay();
    return killed;
  }

  private collectPickups(x: number, y: number, r: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.hypot(p.x - x, p.y - y) < r + 30) {
        this.activatePower(p.kind);
        this.pickups.splice(i, 1);
      }
    }
  }

  private activatePower(kind: PowerId) {
    this.power = { kind, t: POWER_META[kind].duration };
    this.pushFloater(
      WORLD_W / 2,
      128,
      POWER_META[kind].label,
      kind === "acid" ? "#a3e635" : "#f3ece4",
      34,
    );
    this.juice.add(0.28, 0.04, 0.2);
    if (this.save.settings.sfx) playUpgrade();
  }

  private hurt(f: Fly, dmg: number, ox: number, oy: number, auto: boolean) {
    f.hp -= dmg;
    f.flash = 1;
    const knock = 140;
    const ang = Math.atan2(f.y - oy, f.x - ox);
    f.vx += Math.cos(ang) * knock;
    f.vy += Math.sin(ang) * knock;

    if (f.hp > 0) {
      this.juice.add(0.18, 0.03, 0.12);
      this.burst(f.x, f.y, 5, false, f.kind);
      return;
    }

    this.kill(f, auto);
  }

  private kill(f: Fly, auto: boolean) {
    if (f.hp <= -999) return;
    if (this.killDepth > 8) {
      f.hp = -999;
      const stuck = this.flies.indexOf(f);
      if (stuck >= 0) this.flies.splice(stuck, 1);
      return;
    }
    this.killDepth += 1;
    try {
      this.killInner(f, auto);
    } finally {
      this.killDepth -= 1;
    }
  }

  private killInner(f: Fly, auto: boolean) {
    if (f.hp <= -999) return;
    f.hp = -999;
    const idx = this.flies.indexOf(f);
    if (idx >= 0) this.flies.splice(idx, 1);

    const critRoll = Math.random() < critChance(this.save.upgrades.crit);
    const window = comboWindow(this.save.upgrades.snap, this.frenzyOn());
    if (this.comboT > 0) this.combo += 1;
    else this.combo = 1;
    if (f.kind === "firefly") this.combo += 1;
    this.comboT = window;
    if (this.combo > this.save.bestCombo) this.save.bestCombo = this.combo;

    const mult = comboMult(this.combo) * this.pMult() * (critRoll ? critPayout() : 1);
    const gain = Math.max(1, Math.round(PESTS[f.kind].ichor * mult));
    this.grant(gain, true);
    this.kills += 1;
    const before = this.save.lifetimeKills;
    this.save.lifetimeKills += 1;
    this.announceGates(before, this.save.lifetimeKills);

    const pan = (f.x / WORLD_W) * 2 - 1;
    if (this.save.settings.sfx) playSplat(critRoll, pan, this.combo);

    const big = f.kind === "queen" || critRoll || this.combo >= 8 || this.save.upgrades.spike > 0;
    const extra = this.save.upgrades.spike > 0 || f.kind === "queen" || f.kind === "stinkbug";
    this.juice.add(big ? 0.78 : 0.34, big ? 0.08 : 0.035, big ? 0.62 : 0.25);
    const burstN = this.lowFx ? 6 : (big ? 18 : 10) + (extra ? 6 : 0);
    this.burst(f.x, f.y, burstN, critRoll || extra, f.kind);
    this.stamp(f.x, f.y, extra ? 2 : 1, extra || this.combo >= 6);
    const sheet: 0 | 1 | 2 = extra || critRoll ? 1 : 0;
    this.pushImpact(f.x, f.y, f.kind === "queen" ? 2.2 : extra ? 1.45 : 1.15, sheet);
    this.pushFloater(
      f.x,
      f.y - 10,
      critRoll ? `CRIT +${gain}` : `+${gain}`,
      critRoll ? "#f3ece4" : this.acidOn() || f.kind === "stinkbug" ? "#a3e635" : "#e11d48",
      critRoll || this.combo > 6 ? 22 : 16,
    );
    if (this.combo === 8) {
      this.pushFloater(WORLD_W / 2, 120, "FRENZY", "#f3ece4", 36);
    }

    if (!this.firstKill) {
      this.firstKill = true;
      this.hint = null;
    }

    if (f.kind === "queen") {
      for (let i = 0; i < 5; i++) {
        if (this.flies.length >= this.flyCap()) break;
        const m = this.spawnOne("maggot", true);
        if (m) {
          m.x = f.x + rand(-30, 30);
          m.y = f.y + rand(-16, 16);
        }
      }
    }

    this.maybeDropPickup(f);

    if (critRoll && this.save.upgrades.zapper > 0 && !auto) {
      this.arcFrom(f.x, f.y, 1 + Math.floor(this.save.upgrades.zapper / 3));
    }
  }

  private announceGates(before: number, after: number) {
    const crossed = gatesCrossed(before, after);
    if (crossed.length === 0) return;
    const last = crossed[crossed.length - 1];
    this.pushFloater(WORLD_W / 2, 108, last.label.toUpperCase(), "#f3ece4", 28);
    const roomHit = ROOM_ORDER.find((id) => ROOMS[id].name === last.label);
    if (roomHit && roomHit !== "kitchen") {
      this.hint = `${last.label} can be unlocked in the shop.`;
    } else if (Object.values(UPGRADE_META).some((m) => m.name === last.label)) {
      this.hint = `${last.label} is in the shop.`;
    } else {
      this.hint = `${last.label} just crawled in.`;
    }
  }

  private maybeDropPickup(f: Fly) {
    if (this.screen !== "play") return;
    if (this.pickups.length >= 2) return;
    const pool = availablePowers(this.save.lifetimeKills, this.save.upgrades);
    let chance = pool.length === 0 ? 0 : 0.028;
    if (f.kind === "goldfly") chance = 0.45;
    if (f.kind === "firefly") chance = 0.55;
    if (f.kind === "queen") chance = 1;
    if (Math.random() > chance) return;
    let kind: PowerId;
    if (f.kind === "firefly" && pool.includes("frenzy")) kind = "frenzy";
    else if (f.kind === "queen" && pool.includes("giant")) kind = "giant";
    else if (pool.length === 0) return;
    else kind = pool[Math.floor(Math.random() * pool.length)];
    this.pickups.push({
      id: this.nextId++,
      kind,
      x: f.x,
      y: f.y,
      bob: 0,
      life: 9,
    });
  }

  private arcFrom(x: number, y: number, hops: number, skip?: number) {
    let cx = x;
    let cy = y;
    const used = new Set<number>();
    if (skip != null) used.add(skip);
    const dmg = smashDamage(this.save.upgrades.power, this.save.upgrades.spike, this.acidOn());
    const n = Math.min(6, Math.max(0, hops | 0));
    for (let h = 0; h < n; h++) {
      let best: Fly | null = null;
      let bestD = 180 + this.save.upgrades.zapper * 12 + this.save.upgrades.volt * 10;
      for (const fly of this.flies) {
        if (used.has(fly.id)) continue;
        const d = Math.hypot(fly.x - cx, fly.y - cy);
        if (d < bestD) {
          bestD = d;
          best = fly;
        }
      }
      if (!best) break;
      used.add(best.id);
      this.chains.push({ x0: cx, y0: cy, x1: best.x, y1: best.y, t: 0.16 });
      if (this.chains.length > CHAIN_CAP) this.chains.shift();
      cx = best.x;
      cy = best.y;
      this.pushImpact(best.x, best.y, 0.85, 2);
      this.hurt(best, dmg, x, y, true);
    }
  }

  private lampZap() {
    let best: Fly | null = null;
    let bestD = 280 + this.save.upgrades.zapper * 20;
    for (const f of this.flies) {
      if (PESTS[f.kind].ground) continue;
      const d = Math.hypot(f.x - ZAPPER_POS.x, f.y - ZAPPER_POS.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    if (!best) return;
    if (this.save.settings.sfx) playZap((best.x / WORLD_W) * 2 - 1);
    this.pushImpact(ZAPPER_POS.x, ZAPPER_POS.y + 36, 1.1, 2);
    this.chains.push({
      x0: ZAPPER_POS.x,
      y0: ZAPPER_POS.y + 28,
      x1: best.x,
      y1: best.y,
      t: 0.18,
    });
    const hops = Math.min(4, 1 + Math.floor(this.save.upgrades.zapper / 3));
    const ox = best.x;
    const oy = best.y;
    this.hurt(
      best,
      smashDamage(this.save.upgrades.power, this.save.upgrades.spike, this.acidOn()),
      ZAPPER_POS.x,
      ZAPPER_POS.y,
      true,
    );
    this.arcFrom(ox, oy, hops, best.id);
  }

  private trapEat() {
    const r = trapRadius(this.save.upgrades.trap);
    let best: Fly | null = null;
    let bestD = r;
    for (const f of this.flies) {
      const d = Math.hypot(f.x - TRAP_POS.x, f.y - TRAP_POS.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    if (!best) return;
    this.trapChomp = 0.38;
    this.kill(best, true);
  }

  private autoSmash() {
    if (this.flies.length === 0) return;
    const f = this.flies[Math.floor(Math.random() * this.flies.length)];
    this.smashAt(f.x, f.y, true);
  }

  private grant(n: number, fromKill: boolean) {
    const add = Math.max(0, Math.floor(finite(n)));
    this.save.ichor += add;
    this.save.lifetimeIchor += add;
    if (fromKill || this.screen === "play") this.save.earnedThisRun += add;
    this.dirty = true;
  }

  private burst(x: number, y: number, n: number, chunky: boolean, kind?: PestKind) {
    const count = this.gore() === "low" || this.lowFx ? Math.min(6, Math.ceil(n * 0.3)) : Math.min(n, 12);
    const bile = this.acidOn() || kind === "stinkbug";
    const colors = bile ? BILE : BLOOD;
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.partI++ % PARTICLE_CAP];
      const ang = rand(0, Math.PI * 2);
      const sp = rand(80, chunky ? 560 : 340);
      p.live = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp - rand(40, 180);
      p.maxLife = rand(0.35, 0.9);
      p.life = p.maxLife;
      p.size = rand(3, chunky ? 16 : 8);
      p.rot = rand(0, Math.PI * 2);
      p.spin = rand(-8, 8);
      p.color = colors[i % colors.length];
      p.kind = i % 5 === 0 ? "spark" : i % 3 === 0 ? "chunk" : "drop";
    }
  }

  private stamp(x: number, y: number, n: number, gruesome: boolean) {
    if (this.gore() === "low") n = Math.min(1, n);
    const sheet: 0 | 1 = gruesome && this.gore() === "full" ? 1 : 0;
    for (let i = 0; i < n; i++) {
      this.decals.push({
        x: x + rand(-18, 18),
        y: y + rand(-12, 12),
        scale: rand(0.45, gruesome ? 1.35 : 1.15),
        rot: rand(0, Math.PI * 2),
        variant: Math.floor(Math.random() * 4),
        alpha: rand(0.55, 0.92),
        sheet,
      });
    }
    while (this.decals.length > DECAL_CAP) this.decals.shift();
  }

  buy(id: UpgradeId): boolean {
    if (!upgradeUnlocked(id, this.save.lifetimeKills)) {
      const remain = UPGRADE_META[id].unlockKills - this.save.lifetimeKills;
      this.hint = `${UPGRADE_META[id].name} in ${remain} kills.`;
      return false;
    }
    if (this.screen === "title") this.startPlay();
    const cost = upgradeCost(id, this.save.upgrades[id]);
    if (this.save.ichor < cost) return false;
    this.save.ichor -= cost;
    this.save.upgrades[id] += 1;
    this.dirty = true;
    if (this.save.settings.sfx) playUpgrade();
    if (this.save.upgrades[id] === 1) {
      if (id === "trap") this.hint = "The plant hunts anything that crawls close.";
      if (id === "zapper") this.hint = "The lamp fries anything that flies under it.";
      if (id === "fan") this.hint = "Blades clip a pest on their own.";
      if (id === "paper") this.hint = "Sticky strips slow anything that drifts near.";
      if (id === "spike") this.hint = "Barbs. More guts. The mesh looks mean.";
      if (id === "volt") this.hint = "Every slam jumps to the next pest.";
    }
    this.flushSave();
    return true;
  }

  fumigate(): boolean {
    const need = fumigateNeed(this.save.prestige);
    if (this.save.earnedThisRun < need) return false;
    this.save.prestige += 1;
    this.save.ichor = 0;
    this.save.earnedThisRun = 0;
    this.save.upgrades = { ...this.save.upgrades };
    for (const k of Object.keys(this.save.upgrades) as UpgradeId[]) {
      this.save.upgrades[k] = 0;
    }
    this.combo = 0;
    this.flies = [];
    this.pickups = [];
    this.decals = [];
    this.power = null;
    this.kills = 0;
    this.seedAttract();
    this.dirty = true;
    if (this.save.settings.sfx) playFumigate();
    this.juice.add(0.9, 0.12, 0.8);
    this.pushFloater(WORLD_W / 2, WORLD_H / 2, `EXTERMINATOR ${this.save.prestige}`, "#f3ece4", 34);
    this.flushSave();
    return true;
  }

  private pushFloater(x: number, y: number, text: string, color: string, size: number) {
    this.floaters.push({ x, y, text, t: 0, color, size });
    if (this.floaters.length > FLOATER_CAP) this.floaters.splice(0, this.floaters.length - FLOATER_CAP);
  }

  private pushImpact(x: number, y: number, scale: number, sheet: 0 | 1 | 2) {
    this.impacts.push({ x, y, t: 0, scale, sheet });
    if (this.impacts.length > IMPACT_CAP) this.impacts.splice(0, this.impacts.length - IMPACT_CAP);
  }

  private trimFx() {
    if (this.floaters.length > FLOATER_CAP) this.floaters.splice(0, this.floaters.length - FLOATER_CAP);
    if (this.impacts.length > IMPACT_CAP) this.impacts.splice(0, this.impacts.length - IMPACT_CAP);
  }

  wipeTable() {
    this.decals = [];
  }

  stats() {
    let live = 0;
    for (const p of this.particles) if (p.live) live += 1;
    return {
      flies: this.flies.length,
      particles: live,
      decals: this.decals.length,
      floaters: this.floaters.length,
      impacts: this.impacts.length,
      chains: this.chains.length,
      pickups: this.pickups.length,
      ids: this.nextId,
    };
  }

  hud(): HudSnap {
    const need = fumigateNeed(this.save.prestige);
    const revealedUnbought = ROOM_ORDER.find(
      (id) => id !== "kitchen" && roomRevealed(id, this.save.lifetimeKills) && !this.owns(id),
    );
    return {
      screen: this.screen,
      ichor: this.save.ichor,
      combo: this.combo,
      comboMult: comboMult(this.combo),
      kills: this.kills,
      lifetimeKills: this.save.lifetimeKills,
      bestCombo: this.save.bestCombo,
      ips: paperIps(this.save.upgrades.paper, this.pMult()),
      frenzy: this.frenzyOn(),
      prestige: this.save.prestige,
      prestigeMult: this.pMult(),
      canFumigate: this.save.earnedThisRun >= need,
      fumigateNeed: need,
      earnedThisRun: this.save.earnedThisRun,
      upgrades: { ...this.save.upgrades },
      nextUnlock: revealedUnbought
        ? { label: `Unlock ${ROOMS[revealedUnbought].name}`, at: this.save.lifetimeKills }
        : nextUnlock(this.save.lifetimeKills),
      hint: this.hint,
      mess: this.decals.length,
      ready: true,
      settings: { ...this.save.settings },
      room: this.save.room,
      rooms: ROOM_ORDER.map((id) => ({
        id,
        name: ROOMS[id].name,
        owned: this.owns(id),
        revealed: roomRevealed(id, this.save.lifetimeKills),
        cost: ROOMS[id].cost,
        needKills: ROOMS[id].unlockKills,
        affordable: this.save.ichor >= ROOMS[id].cost,
        blurb: ROOMS[id].blurb,
      })),
      power: this.power
        ? { kind: this.power.kind, label: POWER_META[this.power.kind].label, t: this.power.t }
        : null,
      swatter: swatterKind(this.save.upgrades),
    };
  }

  flushSave() {
    writeSave(this.save);
    this.dirty = false;
    this.lastSave = 0;
  }
}
