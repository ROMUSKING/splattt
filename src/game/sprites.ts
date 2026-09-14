import { assert, finite } from "./assert";
import type { PestKind, RoomId, SwatterKind } from "./types";

export type Sheet = {
  img: HTMLImageElement;
  cols: number;
  rows: number;
};

export type SpriteBank = {
  pests: Record<PestKind, Sheet>;
  impact: Sheet;
  impact2: Sheet;
  decals: Sheet;
  decals2: Sheet;
  swatter: Record<SwatterKind, Sheet>;
  rooms: Record<RoomId, HTMLImageElement>;
  zapper: Sheet;
  flypaper: Sheet;
  fan: Sheet;
  flytrap: Sheet;
  pickups: Sheet;
  zapfx: Sheet;
};

const LOAD_MS = 4000;

function fallbackBlob(color = "#3a322b"): string {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(32, 32, 20, 14, 0, 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL("image/png");
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let settled = false;
    let usedFallback = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve(img);
    };
    img.onload = () => {
      if (img.width > 0 && img.height > 0) settle();
      else if (!usedFallback) {
        usedFallback = true;
        img.src = fallbackBlob();
      } else settle();
    };
    img.onerror = () => {
      if (usedFallback) {
        settle();
        return;
      }
      usedFallback = true;
      console.warn("[splattt] missing sprite", src);
      img.src = fallbackBlob();
    };
    img.src = src;
    window.setTimeout(() => {
      if (settled) return;
      if (!usedFallback) {
        usedFallback = true;
        console.warn("[splattt] sprite timeout", src);
        img.src = fallbackBlob();
      } else settle();
    }, LOAD_MS);
  });
}

function sheet(img: HTMLImageElement, cols: number, rows: number): Sheet {
  assert(img.width > 0, "sheet image has no size");
  return { img, cols, rows };
}

export async function loadSprites(): Promise<SpriteBank> {
  const keys = [
    "housefly",
    "blowfly",
    "mosquito",
    "wasp",
    "maggot",
    "goldfly",
    "queen",
    "cockroach",
    "moth",
    "fruitfly",
    "beetle",
    "firefly",
    "stinkbug",
    "impact",
    "gore2",
    "decals",
    "decals2",
    "swatter",
    "swatter-volt",
    "swatter-spike",
    "zapper",
    "flypaper",
    "fan",
    "flytrap",
    "pickups",
    "zapfx",
  ] as const;
  const rooms = ["kitchen", "bathroom", "bedroom", "garage", "porch"] as const;

  const [pestImgs, roomImgs] = await Promise.all([
    Promise.all(keys.map((k) => load(`/sprites/${k}.png`))),
    Promise.all(rooms.map((r) => load(`/bg/${r}.jpg`))),
  ]);

  const by = Object.fromEntries(keys.map((k, i) => [k, pestImgs[i]])) as Record<
    (typeof keys)[number],
    HTMLImageElement
  >;

  return {
    pests: {
      housefly: sheet(by.housefly, 2, 2),
      blowfly: sheet(by.blowfly, 2, 2),
      mosquito: sheet(by.mosquito, 2, 2),
      wasp: sheet(by.wasp, 2, 2),
      maggot: sheet(by.maggot, 2, 2),
      goldfly: sheet(by.goldfly, 2, 2),
      queen: sheet(by.queen, 2, 2),
      cockroach: sheet(by.cockroach, 2, 2),
      moth: sheet(by.moth, 2, 2),
      fruitfly: sheet(by.fruitfly, 2, 2),
      beetle: sheet(by.beetle, 2, 2),
      firefly: sheet(by.firefly, 2, 2),
      stinkbug: sheet(by.stinkbug, 2, 2),
    },
    impact: sheet(by.impact, 2, 2),
    impact2: sheet(by.gore2, 2, 2),
    decals: sheet(by.decals, 2, 2),
    decals2: sheet(by.decals2, 2, 2),
    swatter: {
      mesh: sheet(by.swatter, 1, 1),
      volt: sheet(by["swatter-volt"], 1, 1),
      spike: sheet(by["swatter-spike"], 1, 1),
    },
    rooms: {
      kitchen: roomImgs[0],
      bathroom: roomImgs[1],
      bedroom: roomImgs[2],
      garage: roomImgs[3],
      porch: roomImgs[4],
    },
    zapper: sheet(by.zapper, 2, 2),
    flypaper: sheet(by.flypaper, 2, 2),
    fan: sheet(by.fan, 2, 2),
    flytrap: sheet(by.flytrap, 2, 2),
    pickups: sheet(by.pickups, 2, 2),
    zapfx: sheet(by.zapfx, 2, 2),
  };
}

export function drawSheet(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet | undefined,
  frame: number,
  x: number,
  y: number,
  size: number,
  rot = 0,
  alpha = 1,
) {
  if (!sheet?.img || !sheet.img.width || !sheet.img.height) return;
  const px = finite(x);
  const py = finite(y);
  const s = finite(size, 32);
  if (s <= 0) return;
  const cols = sheet.cols || 1;
  const rows = sheet.rows || 1;
  const total = cols * rows;
  const f = ((Math.floor(finite(frame)) % total) + total) % total;
  const sw = sheet.img.width / cols;
  const sh = sheet.img.height / rows;
  if (!Number.isFinite(sw) || !Number.isFinite(sh) || sw <= 0 || sh <= 0) return;
  const sx = (f % cols) * sw;
  const sy = Math.floor(f / cols) * sh;
  const a = finite(alpha, 1);
  if (!rot && a >= 0.995) {
    ctx.drawImage(sheet.img, sx, sy, sw, sh, px - s / 2, py - s / 2, s, s);
    return;
  }
  ctx.save();
  try {
    ctx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a;
    ctx.translate(px, py);
    if (rot) ctx.rotate(finite(rot));
    ctx.drawImage(sheet.img, sx, sy, sw, sh, -s / 2, -s / 2, s, s);
  } catch {
    /* drawImage can throw on a lost context; skip the sprite */
  } finally {
    ctx.restore();
  }
}
