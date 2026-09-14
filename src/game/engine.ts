import { GROUPS, shopRows, UPGRADE_META, WORLD_H, WORLD_W } from "./catalog";
import { audioStats, disposeAudio, resumeAudio, setSfxEnabled, suspendAudio, unlockAudio } from "./audio";
import { clamp, finite } from "./assert";
import { render, resetRenderCache } from "./render";
import { Sim } from "./sim";
import { loadSprites, type SpriteBank } from "./sprites";
import type { HudSnap, RoomId, Settings, ShopRow, UpgradeId } from "./types";

export type EngineApi = {
  smash: (nx: number, ny: number) => void;
  start: () => void;
  buy: (id: UpgradeId) => boolean;
  buyRoom: (id: RoomId) => boolean;
  fumigate: () => boolean;
  pause: () => void;
  resume: () => void;
  setRoom: (id: RoomId) => boolean;
  hud: () => HudSnap;
  shop: () => { group: string; rows: ShopRow[] }[];
  stats: () => Record<string, number | string | boolean>;
};

function isPhone() {
  return (
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    window.matchMedia("(pointer: coarse)").matches ||
    Math.min(window.innerWidth, window.innerHeight) < 900
  );
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim = new Sim();
  private sprites: SpriteBank | null = null;
  private raf = 0;
  private last = 0;
  private running = false;
  private booted = false;
  private dead = false;
  private hidden = false;
  private audioArmed = false;
  private phone = false;
  private dpr = 1;
  private sx = 1;
  private sy = 1;
  private onHud: (h: HudSnap) => void;
  private hudAcc = 0;
  private unbind: Array<() => void> = [];
  private hudDirty = false;
  private lastHudKey = "";
  private fitT = 0;
  private frameMs = 16;
  private slowStreak = 0;
  private lastErrAt = 0;
  private frames = 0;
  private view = { left: 0, top: 0, w: 1, h: 1 };
  private pageHide = () => this.sim.flushSave();

  constructor(canvas: HTMLCanvasElement, onHud: (h: HudSnap) => void) {
    this.canvas = canvas;
    this.phone = isPhone();
    const ctx = canvas.getContext("2d", { alpha: false });
    this.ctx = (ctx ?? canvas.getContext("2d")) as CanvasRenderingContext2D;
    this.onHud = onHud;
    canvas.style.touchAction = "none";
  }

  async start() {
    if (this.booted || this.dead) return;
    if (!this.ctx) {
      console.warn("[splattt] no 2d context");
      return;
    }
    this.booted = true;
    this.phone = isPhone();
    this.sim.boot();
    this.fit();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.sim.setReduced(reduced || this.phone);
    this.bind();
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.pushHud();
    this.publishApi();
    try {
      const sprites = await loadSprites();
      if (this.dead) return;
      this.sprites = sprites;
    } catch (err) {
      console.warn("[splattt] sprites", err);
    }
  }

  destroy() {
    this.dead = true;
    this.running = false;
    this.booted = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.fitT) window.clearTimeout(this.fitT);
    this.fitT = 0;
    this.sim.flushSave();
    for (const u of this.unbind) u();
    this.unbind = [];
    this.sprites = null;
    disposeAudio();
  }

  startPlay() {
    this.armAudio();
    this.sim.startPlay();
    this.pushHud();
  }

  buy(id: UpgradeId) {
    const ok = this.sim.buy(id);
    this.pushHud();
    return ok;
  }

  buyRoom(id: RoomId) {
    const ok = this.sim.buyRoom(id);
    this.pushHud();
    return ok;
  }

  fumigate() {
    const ok = this.sim.fumigate();
    this.pushHud();
    return ok;
  }

  setRoom(id: RoomId) {
    const ok = this.sim.setRoom(id);
    this.pushHud();
    return ok;
  }

  pause() {
    this.sim.pause();
    this.pushHud();
  }

  resume() {
    this.sim.resume();
    this.pushHud();
  }

  setSettings(s: Settings) {
    this.sim.applySettings(s);
    setSfxEnabled(s.sfx);
    this.sim.flushSave();
    this.pushHud();
  }

  reset() {
    this.sim.resetAll();
    this.pushHud();
  }

  shop() {
    return GROUPS.map((group) => ({
      group,
      rows: shopRows(this.sim.save.upgrades, this.sim.save.ichor, this.sim.save.lifetimeKills).filter(
        (r) => UPGRADE_META[r.id].group === group,
      ),
    }));
  }

  private armAudio() {
    if (!this.audioArmed) {
      unlockAudio(this.phone);
      setSfxEnabled(this.sim.save.settings.sfx);
      this.audioArmed = true;
      return;
    }
    resumeAudio();
  }

  private pushHud() {
    try {
      const h = this.sim.hud();
      const key = `${h.screen}|${h.ichor}|${h.combo}|${h.lifetimeKills}|${h.hint}|${h.room}|${h.power?.kind ?? ""}|${h.power ? Math.floor(h.power.t) : ""}|${h.ips}|${h.canFumigate}`;
      if (key === this.lastHudKey) return;
      this.lastHudKey = key;
      this.onHud(h);
    } catch (err) {
      this.warn("hud", err);
    }
  }

  private publishApi() {
    const api: EngineApi = {
      smash: (nx, ny) => {
        const x = finite(nx) * WORLD_W;
        const y = finite(ny) * WORLD_H;
        this.sim.smashAt(x, y);
      },
      start: () => this.startPlay(),
      buy: (id) => this.buy(id),
      buyRoom: (id) => this.buyRoom(id),
      fumigate: () => this.fumigate(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      setRoom: (id) => this.setRoom(id),
      hud: () => this.sim.hud(),
      shop: () => this.shop(),
      stats: () => {
        const s = this.sim.stats();
        const a = audioStats();
        return {
          ...s,
          voices: a.voices,
          audio: a.ctx,
          dpr: this.dpr,
          frameMs: Math.round(this.frameMs * 10) / 10,
          lowFx: this.sim.lowFx,
          frames: this.frames,
        };
      },
    };
    (window as unknown as { __splattt: EngineApi }).__splattt = api;
  }

  private loop = (now: number) => {
    this.raf = 0;
    if (!this.running || this.dead || this.hidden) return;
    const t0 = now;
    try {
      const raw = (now - this.last) / 1000;
      const dt = clamp(Number.isFinite(raw) ? raw : 0.016, 0, 0.05);
      this.last = now;
      this.sim.tick(dt);
      if (this.canvas.width < 8) this.fit();
      if (this.sprites) render(this.ctx, this.sim, this.sprites, this.sx, this.sy);
      else this.blank();
      this.hudAcc += dt;
      const hudEvery = this.phone || this.sim.lowFx ? 0.32 : 0.18;
      if (this.hudAcc > hudEvery || this.hudDirty) {
        this.hudAcc = 0;
        this.hudDirty = false;
        this.pushHud();
      }
    } catch (err) {
      this.warn("frame", err);
    }
    this.frames += 1;
    const spent = performance.now() - t0;
    this.frameMs = this.frameMs * 0.85 + spent * 0.15;
    if (spent > 22) this.slowStreak += 1;
    else this.slowStreak = Math.max(0, this.slowStreak - 1);
    this.sim.lowFx = this.phone || this.slowStreak > 12;
    if (this.running && !this.dead && !this.hidden) this.raf = requestAnimationFrame(this.loop);
  };

  private blank() {
    this.ctx.setTransform(this.sx, 0, 0, this.sy, 0, 0);
    this.ctx.fillStyle = "#120e0c";
    this.ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  private bind() {
    const onVis = () => {
      if (document.hidden) {
        this.hidden = true;
        this.sim.flushSave();
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = 0;
        suspendAudio();
      } else {
        this.hidden = false;
        resumeAudio();
        this.last = performance.now();
        this.slowStreak = 0;
        this.syncView();
        if (this.running && !this.dead && !this.raf) this.raf = requestAnimationFrame(this.loop);
      }
    };
    const onResize = () => {
      if (this.fitT) return;
      this.fitT = window.setTimeout(() => {
        this.fitT = 0;
        this.fit();
      }, 250);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyP") {
        if (this.sim.screen === "play") this.pause();
        else if (this.sim.screen === "paused") this.resume();
      }
      if (e.code === "Space" && this.sim.screen === "title") {
        e.preventDefault();
        this.startPlay();
      }
    };

    this.canvas.addEventListener("pointerdown", this.onDown, { passive: false });
    this.canvas.addEventListener("pointermove", this.onMove, { passive: true });
    this.canvas.addEventListener("pointerup", this.onUp, { passive: true });
    this.canvas.addEventListener("pointercancel", this.onUp, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pagehide", this.pageHide);

    this.unbind.push(() => this.canvas.removeEventListener("pointerdown", this.onDown));
    this.unbind.push(() => this.canvas.removeEventListener("pointermove", this.onMove));
    this.unbind.push(() => this.canvas.removeEventListener("pointerup", this.onUp));
    this.unbind.push(() => this.canvas.removeEventListener("pointercancel", this.onUp));
    this.unbind.push(() => window.removeEventListener("resize", onResize));
    this.unbind.push(() => document.removeEventListener("visibilitychange", onVis));
    this.unbind.push(() => window.removeEventListener("keydown", onKey));
    this.unbind.push(() => window.removeEventListener("pagehide", this.pageHide));
  }

  private syncView() {
    const r = this.canvas.getBoundingClientRect();
    this.view.left = r.left;
    this.view.top = r.top;
    this.view.w = r.width;
    this.view.h = r.height;
  }

  private toWorld(e: PointerEvent) {
    const w = this.view.w;
    const h = this.view.h;
    if (w < 2 || h < 2) return null;
    const x = ((e.clientX - this.view.left) / w) * WORLD_W;
    const y = ((e.clientY - this.view.top) / h) * WORLD_H;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  private onDown = (e: PointerEvent) => {
    if (this.sim.screen === "paused") return;
    this.syncView();
    this.armAudio();
    const pos = this.toWorld(e);
    if (!pos) return;
    this.sim.pointerMove(pos.x, pos.y);
    this.sim.smashAt(pos.x, pos.y);
    this.hudDirty = true;
    if (e.cancelable) e.preventDefault();
  };

  private onMove = (e: PointerEvent) => {
    const pos = this.toWorld(e);
    if (!pos) return;
    const dx = pos.x - this.sim.pointer.x;
    const dy = pos.y - this.sim.pointer.y;
    if (dx * dx + dy * dy < 36) return;
    this.sim.pointerMove(pos.x, pos.y);
  };

  private onUp = (_e: PointerEvent) => {
    /* smash is on down */
  };

  private fit(force = false) {
    this.syncView();
    const cssW = Math.max(1, this.view.w);
    const cssH = Math.max(1, this.view.h);
    if (cssW < 4 || cssH < 4) return;
    this.phone = isPhone();
    const next = this.phone ? 1 : Math.min(1.25, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(cssW * next));
    const h = Math.max(1, Math.floor(cssH * next));
    if (
      !force &&
      Math.abs(this.canvas.width - w) < 8 &&
      Math.abs(this.canvas.height - h) < 8 &&
      this.dpr === next
    ) {
      return;
    }
    this.dpr = next;
    this.sx = w / WORLD_W;
    this.sy = h / WORLD_H;
    this.canvas.width = w;
    this.canvas.height = h;
    resetRenderCache();
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "low";
  }

  private warn(label: string, err: unknown) {
    const now = performance.now();
    if (now - this.lastErrAt < 2000) return;
    this.lastErrAt = now;
    console.warn("[splattt]", label, err);
  }
}
