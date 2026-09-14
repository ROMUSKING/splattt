import { PESTS, PICKUP_FRAME, swatterKind, WORLD_H, WORLD_W } from "./catalog";
import { clamp, finite } from "./assert";
import { FAN_POS, PAPER_POS, TRAP_POS, ZAPPER_POS, type Sim } from "./sim";
import { drawSheet, type SpriteBank } from "./sprites";

let frenzyGrad: CanvasGradient | null = null;
let frenzyGradCtx: CanvasRenderingContext2D | null = null;

export function resetRenderCache() {
  frenzyGrad = null;
  frenzyGradCtx = null;
}

export function render(
  ctx: CanvasRenderingContext2D,
  sim: Sim,
  sprites: SpriteBank,
  sx: number,
  sy: number,
) {
  const { ox, oy, rot, flash } = sim.juice;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.fillStyle = "#120e0c";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.save();
  ctx.translate(WORLD_W / 2 + ox, WORLD_H / 2 + oy);
  if (rot) ctx.rotate(rot);
  ctx.translate(-WORLD_W / 2, -WORLD_H / 2);

  const room = sprites.rooms[sim.save.room] ?? sprites.rooms.kitchen;
  drawCover(ctx, room, WORLD_W, WORLD_H);

  drawCeilingKit(ctx, sim, sprites);

  for (const d of sim.decals) {
    const sheet = d.sheet === 1 ? sprites.decals2 : sprites.decals;
    drawSheet(ctx, sheet, d.variant, d.x, d.y, 110 * d.scale, d.rot, d.alpha);
  }

  drawTrap(ctx, sim, sprites);

  for (const p of sim.pickups) {
    const bob = Math.sin(p.bob) * 6;
    const pulse = 0.88 + Math.sin(p.bob * 2) * 0.12;
    drawSheet(ctx, sprites.pickups, PICKUP_FRAME[p.kind], p.x, p.y + bob, 56 * pulse);
  }

  const skipShadow = sim.lowFx;
  for (const f of sim.flies) {
    const def = PESTS[f.kind];
    const bob = Math.sin(f.bob) * (def.ground ? 1.5 : 5);
    const size = def.draw;
    if (!skipShadow) {
      ctx.fillStyle = "rgba(20,12,8,0.28)";
      ctx.beginPath();
      ctx.arc(f.x, f.y + size * 0.28, size * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    const tilt = Math.max(-0.45, Math.min(0.45, finite(f.vx) / 220));
    const pest = sprites.pests[f.kind];
    drawSheet(ctx, pest, Math.floor(f.frame), f.x, f.y + bob, size, tilt);

    if (f.kind === "firefly") {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(f.bob * 2) * 0.2;
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(f.x, f.y + bob, size * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (f.flash > 0) {
      ctx.save();
      ctx.globalAlpha = f.flash * 0.45;
      ctx.fillStyle = "#f3ece4";
      ctx.beginPath();
      ctx.arc(f.x, f.y + bob, size * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (f.maxHp > 1) {
      const w = Math.max(28, size * 0.45);
      const h = 4;
      const x = f.x - w / 2;
      const y = f.y + bob - size * 0.42;
      ctx.fillStyle = "rgba(18,14,12,0.7)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = f.kind === "queen" ? "#e11d48" : "#d6c7b8";
      ctx.fillRect(x, y, w * (f.maxHp > 0 ? clamp(f.hp / f.maxHp, 0, 1) : 0), h);
    }
  }

  let drawn = 0;
  const partCap = sim.lowFx ? 18 : 36;
  for (const p of sim.particles) {
    if (!p.live) continue;
    if (drawn++ > partCap) break;
    const a = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.rot) ctx.rotate(p.rot);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.kind === "spark" ? "#f3ece4" : p.color;
    if (p.kind === "spark") {
      ctx.fillRect(-p.size * 0.15, -p.size, p.size * 0.3, p.size * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const im of sim.impacts) {
    const frame = Math.min(3, Math.floor(im.t / 0.08));
    const fade = 1 - im.t / 0.32;
    const sheet = im.sheet === 2 ? sprites.zapfx : im.sheet === 1 ? sprites.impact2 : sprites.impact;
    drawSheet(ctx, sheet, frame, im.x, im.y, 150 * im.scale, 0, fade);
  }

  drawBolts(ctx, sim);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of sim.floaters) {
    const a = f.t < 0.12 ? f.t / 0.12 : Math.max(0, 1 - (f.t - 0.12) / 0.73);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color;
    ctx.font = f.size >= 30 ? FONT_LG : f.size >= 22 ? FONT_MD : FONT_SM;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }

  drawSwatter(ctx, sim, sprites);

  ctx.restore();

  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = flash * 0.28;
    ctx.fillStyle = sim.power?.kind === "acid" ? "#4d7c0f" : "#7f1d1d";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  if (sim.combo >= 8 || sim.power?.kind === "frenzy") {
    if (frenzyGradCtx !== ctx) {
      frenzyGrad = ctx.createRadialGradient(
        WORLD_W / 2,
        WORLD_H / 2,
        WORLD_H * 0.2,
        WORLD_W / 2,
        WORLD_H / 2,
        WORLD_H * 0.75,
      );
      frenzyGrad.addColorStop(0, "rgba(0,0,0,0)");
      frenzyGrad.addColorStop(1, "rgba(70,10,10,0.35)");
      frenzyGradCtx = ctx;
    }
    ctx.save();
    ctx.fillStyle = frenzyGrad!;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }
}

const FONT_SM = '600 16px sans-serif';
const FONT_MD = '600 22px sans-serif';
const FONT_LG = '600 34px sans-serif';

function drawCeilingKit(ctx: CanvasRenderingContext2D, sim: Sim, sprites: SpriteBank) {
  const paper = sim.save.upgrades.paper;
  if (paper > 0) {
    const frame = Math.floor(sim.animT * 2) % 4;
    ctx.fillStyle = "rgba(18,14,12,0.28)";
    ctx.beginPath();
    ctx.arc(PAPER_POS.x, PAPER_POS.y + 58, 18, 0, Math.PI * 2);
    ctx.fill();
    drawSheet(ctx, sprites.flypaper, frame, PAPER_POS.x, PAPER_POS.y, 148);
    if (paper > 2) {
      drawSheet(ctx, sprites.flypaper, (frame + 1) % 4, PAPER_POS.x + 58, PAPER_POS.y + 14, 128);
    }
  }

  if (sim.save.upgrades.zapper > 0) {
    const pulse = 0.22 + Math.sin(sim.animT * 6) * 0.08;
    ctx.fillStyle = `rgba(232, 80, 180, ${pulse})`;
    ctx.beginPath();
    ctx.arc(ZAPPER_POS.x, ZAPPER_POS.y + 70, 42, 0, Math.PI * 2);
    ctx.fill();
    const zf = Math.floor(sim.animT * 8) % 4;
    drawSheet(ctx, sprites.zapper, zf, ZAPPER_POS.x, ZAPPER_POS.y, 176);
  }

  if (sim.save.upgrades.fan > 0) {
    const ff = Math.floor(sim.animT * (10 + sim.save.upgrades.fan * 2)) % 4;
    ctx.fillStyle = "rgba(18,14,12,0.3)";
    ctx.beginPath();
    ctx.arc(FAN_POS.x, FAN_POS.y + 40, 22, 0, Math.PI * 2);
    ctx.fill();
    drawSheet(ctx, sprites.fan, ff, FAN_POS.x, FAN_POS.y, 186);
  }
}

function drawTrap(ctx: CanvasRenderingContext2D, sim: Sim, sprites: SpriteBank) {
  const trap = sim.save.upgrades.trap;
  if (trap <= 0) return;
  const size = 156 + trap * 24;
  const frame =
    sim.trapChomp > 0 ? (sim.trapChomp > 0.18 ? 2 : 3) : Math.floor(sim.animT * 3) % 2;
  ctx.fillStyle = "rgba(20, 40, 16, 0.45)";
  ctx.beginPath();
  ctx.arc(TRAP_POS.x, TRAP_POS.y + size * 0.28, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  drawSheet(ctx, sprites.flytrap, frame, TRAP_POS.x, TRAP_POS.y, size);
}

function drawBolts(ctx: CanvasRenderingContext2D, sim: Sim) {
  if (sim.chains.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const c of sim.chains) {
    const a = Math.max(0, c.t / 0.16);
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#f3ece4";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(c.x0, c.y0);
    ctx.lineTo(c.x1, c.y1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  w: number,
  h: number,
) {
  if (!img || !img.width || !img.height) {
    ctx.fillStyle = "#1c1612";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const ir = img.width / img.height;
  const cr = w / h;
  if (!Number.isFinite(ir) || ir <= 0) {
    ctx.fillStyle = "#1c1612";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  let dw = w;
  let dh = h;
  let dx = 0;
  let dy = 0;
  if (ir > cr) {
    dw = h * ir;
    dx = (w - dw) / 2;
  } else {
    dh = w / ir;
    dy = (h - dh) / 2;
  }
  if (!Number.isFinite(dw) || !Number.isFinite(dh)) return;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawSwatter(ctx: CanvasRenderingContext2D, sim: Sim, sprites: SpriteBank) {
  const slam = sim.pointer.slam;
  const squash = 1 - slam * 0.28;
  const stretch = 1 + slam * 0.12;
  const giant = sim.power?.kind === "giant";
  const kind = swatterKind(sim.save.upgrades);
  const size = 168 * stretch * (giant ? 1.7 : 1);
  const sheet = sprites.swatter[kind];
  ctx.save();
  ctx.translate(sim.pointer.sx, sim.pointer.sy - 18 * slam);
  ctx.scale(1, squash);
  ctx.rotate(-0.18 + slam * 0.12);
  drawSheet(ctx, sheet, 0, 0, 0, size, 0, 1);
  ctx.restore();
}
