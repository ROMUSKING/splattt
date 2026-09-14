import type { PestKind, PowerId, RoomId, ShopRow, SwatterKind, UpgradeId } from "./types";

export const SAVE_VERSION = 3;
export const SAVE_KEY = "splattt-save-v1";
export const WORLD_W = 1280;
export const WORLD_H = 720;
export const FIXED_DT = 1 / 60;

export const UPGRADE_IDS: UpgradeId[] = [
  "reach",
  "power",
  "snap",
  "crit",
  "spike",
  "volt",
  "lure",
  "swarm",
  "breed",
  "paper",
  "fan",
  "zapper",
  "trap",
];

export const UPGRADE_META: Record<
  UpgradeId,
  {
    name: string;
    blurb: string;
    base: number;
    rate: number;
    group: string;
    unlockKills: number;
  }
> = {
  reach: {
    name: "Longer Reach",
    blurb: "The mesh covers more table.",
    base: 8,
    rate: 1.55,
    group: "Swatter",
    unlockKills: 0,
  },
  power: {
    name: "Heavier Mesh",
    blurb: "Fat flies stay down.",
    base: 32,
    rate: 1.58,
    group: "Swatter",
    unlockKills: 22,
  },
  snap: {
    name: "Snap Timing",
    blurb: "Combo window stays open longer.",
    base: 70,
    rate: 1.62,
    group: "Swatter",
    unlockKills: 100,
  },
  crit: {
    name: "Brutal Crits",
    blurb: "Chance to burst a fly into double ichor.",
    base: 140,
    rate: 1.65,
    group: "Swatter",
    unlockKills: 200,
  },
  spike: {
    name: "Barbed Mesh",
    blurb: "Hooks rip extra guts. Swatter looks mean.",
    base: 240,
    rate: 1.68,
    group: "Swatter",
    unlockKills: 300,
  },
  volt: {
    name: "Live Wire",
    blurb: "Every slam arcs. Electric swatter.",
    base: 480,
    rate: 1.74,
    group: "Swatter",
    unlockKills: 620,
  },
  lure: {
    name: "Rot Lure",
    blurb: "They come faster.",
    base: 22,
    rate: 1.52,
    group: "Infestation",
    unlockKills: 18,
  },
  swarm: {
    name: "Open Windows",
    blurb: "More pests on the table at once.",
    base: 50,
    rate: 1.56,
    group: "Infestation",
    unlockKills: 70,
  },
  breed: {
    name: "Breeding Grounds",
    blurb: "Nastier pests show up more often.",
    base: 200,
    rate: 1.64,
    group: "Infestation",
    unlockKills: 400,
  },
  paper: {
    name: "Flypaper",
    blurb: "Sticky strips drip ichor while you rest.",
    base: 55,
    rate: 1.58,
    group: "Automation",
    unlockKills: 45,
  },
  fan: {
    name: "Ceiling Fan",
    blurb: "Blades clip a fly on their own.",
    base: 320,
    rate: 1.68,
    group: "Automation",
    unlockKills: 480,
  },
  zapper: {
    name: "Bug Zapper",
    blurb: "A hanging lamp fries pests and chains crits.",
    base: 520,
    rate: 1.74,
    group: "Automation",
    unlockKills: 780,
  },
  trap: {
    name: "Fly Trap",
    blurb: "A hungry plant on the table. Levels make it fatter.",
    base: 170,
    rate: 1.64,
    group: "Automation",
    unlockKills: 160,
  },
};

export const GROUPS = ["Swatter", "Infestation", "Automation"] as const;

export type PestDef = {
  kind: PestKind;
  label: string;
  hp: number;
  speed: number;
  r: number;
  ichor: number;
  unlockKills: number;
  draw: number;
  ground: boolean;
};

export const PESTS: Record<PestKind, PestDef> = {
  housefly: { kind: "housefly", label: "Housefly", hp: 1, speed: 92, r: 26, ichor: 1, unlockKills: 0, draw: 96, ground: false },
  fruitfly: { kind: "fruitfly", label: "Fruit Fly", hp: 1, speed: 130, r: 14, ichor: 1, unlockKills: 35, draw: 64, ground: false },
  blowfly: { kind: "blowfly", label: "Blowfly", hp: 4, speed: 50, r: 36, ichor: 5, unlockKills: 80, draw: 128, ground: false },
  cockroach: { kind: "cockroach", label: "Cockroach", hp: 6, speed: 88, r: 28, ichor: 10, unlockKills: 140, draw: 92, ground: true },
  mosquito: { kind: "mosquito", label: "Mosquito", hp: 1, speed: 160, r: 20, ichor: 6, unlockKills: 175, draw: 84, ground: false },
  maggot: { kind: "maggot", label: "Maggot", hp: 2, speed: 34, r: 18, ichor: 2, unlockKills: 220, draw: 72, ground: true },
  goldfly: { kind: "goldfly", label: "Gold Fly", hp: 1, speed: 170, r: 24, ichor: 22, unlockKills: 280, draw: 100, ground: false },
  moth: { kind: "moth", label: "Moth", hp: 3, speed: 60, r: 34, ichor: 9, unlockKills: 340, draw: 140, ground: false },
  wasp: { kind: "wasp", label: "Wasp", hp: 3, speed: 122, r: 28, ichor: 12, unlockKills: 460, draw: 108, ground: false },
  stinkbug: { kind: "stinkbug", label: "Stink Bug", hp: 4, speed: 66, r: 30, ichor: 16, unlockKills: 560, draw: 110, ground: false },
  beetle: { kind: "beetle", label: "Beetle", hp: 9, speed: 42, r: 32, ichor: 20, unlockKills: 720, draw: 108, ground: true },
  queen: { kind: "queen", label: "Queen", hp: 40, speed: 40, r: 54, ichor: 220, unlockKills: 920, draw: 176, ground: false },
  firefly: { kind: "firefly", label: "Firefly", hp: 1, speed: 100, r: 22, ichor: 24, unlockKills: 1080, draw: 92, ground: false },
};

export const ROOM_ORDER: RoomId[] = ["kitchen", "bathroom", "bedroom", "garage", "porch"];

export const ROOMS: Record<
  RoomId,
  { id: RoomId; name: string; unlockKills: number; cost: number; blurb: string; pests: PestKind[] }
> = {
  kitchen: {
    id: "kitchen",
    name: "Kitchen",
    unlockKills: 0,
    cost: 0,
    blurb: "Home. Houseflies first.",
    pests: ["housefly", "blowfly", "fruitfly", "goldfly", "maggot", "queen"],
  },
  bathroom: {
    id: "bathroom",
    name: "Bathroom",
    unlockKills: 140,
    cost: 160,
    blurb: "Drains, tiles, things that scuttle.",
    pests: ["mosquito", "cockroach", "stinkbug", "maggot", "housefly", "fruitfly"],
  },
  bedroom: {
    id: "bedroom",
    name: "Bedroom",
    unlockKills: 340,
    cost: 650,
    blurb: "Moths at the lamp. Soft and slow.",
    pests: ["moth", "fruitfly", "housefly", "maggot", "cockroach"],
  },
  garage: {
    id: "garage",
    name: "Garage",
    unlockKills: 720,
    cost: 2000,
    blurb: "Armor, stingers, the heavy shift.",
    pests: ["beetle", "wasp", "cockroach", "stinkbug", "blowfly"],
  },
  porch: {
    id: "porch",
    name: "Porch",
    unlockKills: 1250,
    cost: 5500,
    blurb: "Night shift. Gold and glow.",
    pests: ["moth", "firefly", "goldfly", "wasp", "fruitfly", "queen"],
  },
};

export const POWER_META: Record<PowerId, { label: string; duration: number; unlockKills: number }> = {
  frenzy: { label: "FRENZY", duration: 8, unlockKills: 80 },
  giant: { label: "GIANT MESH", duration: 8, unlockKills: 180 },
  volt: { label: "LIVE WIRE", duration: 7, unlockKills: 400 },
  acid: { label: "ACID BATH", duration: 8, unlockKills: 280 },
};

export const POWER_IDS: PowerId[] = ["frenzy", "giant", "volt", "acid"];

export const PICKUP_FRAME: Record<PowerId, number> = {
  frenzy: 0,
  volt: 1,
  giant: 2,
  acid: 3,
};

export const UNLOCK_ORDER: { label: string; at: number }[] = [
  { label: "Rot Lure", at: 18 },
  { label: "Heavier Mesh", at: 22 },
  { label: "Fruit Fly", at: 35 },
  { label: "Flypaper", at: 45 },
  { label: "Open Windows", at: 70 },
  { label: "Blowfly", at: 80 },
  { label: "Snap Timing", at: 100 },
  { label: "Bathroom", at: 140 },
  { label: "Fly Trap", at: 160 },
  { label: "Mosquito", at: 175 },
  { label: "Brutal Crits", at: 200 },
  { label: "Maggot", at: 220 },
  { label: "Gold Fly", at: 280 },
  { label: "Barbed Mesh", at: 300 },
  { label: "Bedroom", at: 340 },
  { label: "Breeding Grounds", at: 400 },
  { label: "Wasp", at: 460 },
  { label: "Ceiling Fan", at: 480 },
  { label: "Stink Bug", at: 560 },
  { label: "Live Wire", at: 620 },
  { label: "Garage", at: 720 },
  { label: "Bug Zapper", at: 780 },
  { label: "Queen", at: 920 },
  { label: "Firefly", at: 1080 },
  { label: "Porch", at: 1250 },
];

export function emptyUpgrades(): Record<UpgradeId, number> {
  return {
    reach: 0,
    power: 0,
    snap: 0,
    crit: 0,
    spike: 0,
    volt: 0,
    lure: 0,
    swarm: 0,
    breed: 0,
    paper: 0,
    fan: 0,
    zapper: 0,
    trap: 0,
  };
}

export function upgradeCost(id: UpgradeId, level: number): number {
  const m = UPGRADE_META[id];
  return Math.floor(m.base * Math.pow(m.rate, level) * (1 + level * 0.22));
}

export function upgradeUnlocked(id: UpgradeId, kills: number): boolean {
  return kills >= UPGRADE_META[id].unlockKills;
}

export function prestigeMult(prestige: number): number {
  return 1 + prestige * 0.15;
}

export function smashRadius(reach: number, giant = false): number {
  return (54 + reach * 9) * (giant ? 1.75 : 1);
}

export function smashDamage(power: number, spike: number, acid = false): number {
  return 1 + power + Math.floor(spike * 0.7) + (acid ? 2 : 0);
}

export function comboMult(combo: number): number {
  return 1 + combo * 0.045;
}

export function comboWindow(snap: number, frenzy = false): number {
  return (0.55 + snap * 0.07) * (frenzy ? 1.85 : 1);
}

export function critChance(crit: number): number {
  return Math.min(0.38, 0.04 + crit * 0.028);
}

export function critPayout(): number {
  return 2;
}

export function maxFlies(swarm: number, prestige: number): number {
  return Math.min(16, 4 + swarm + Math.min(3, prestige));
}

export function spawnInterval(lure: number): number {
  return Math.max(0.62, 1.55 / (1 + lure * 0.1));
}

export function roomTempo(room: RoomId): number {
  switch (room) {
    case "bathroom":
      return 0.9;
    case "bedroom":
      return 1.08;
    case "garage":
      return 1.14;
    case "porch":
      return 0.96;
    default:
      return 1;
  }
}

export function paperIps(paper: number, pMult: number): number {
  if (paper <= 0) return 0;
  return paper * 0.22 * (1 + paper * 0.04) * pMult;
}

export function fanInterval(fan: number): number {
  if (fan <= 0) return 999;
  return Math.max(0.55, 3.2 / (1 + fan * 0.26));
}

export function zapperInterval(zapper: number): number {
  if (zapper <= 0) return 999;
  return Math.max(0.7, 3.4 / (1 + zapper * 0.24));
}

export function trapRadius(trap: number): number {
  return 48 + trap * 14;
}

export function trapInterval(trap: number): number {
  if (trap <= 0) return 999;
  return Math.max(0.55, 2.7 / (1 + trap * 0.26));
}

export function trapBites(trap: number): number {
  return 1 + Math.floor(trap / 5);
}

export function fumigateNeed(prestige: number): number {
  return Math.floor(2200 * Math.pow(2.6, prestige));
}

export function swatterKind(upgrades: Record<UpgradeId, number>): SwatterKind {
  if (upgrades.spike > 0) return "spike";
  if (upgrades.volt > 0) return "volt";
  return "mesh";
}

export function roomRevealed(id: RoomId, kills: number): boolean {
  return kills >= ROOMS[id].unlockKills;
}

export function roomOwned(owned: RoomId[], id: RoomId): boolean {
  if (id === "kitchen") return true;
  return owned.includes(id);
}

export function formatIchor(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const v = Math.floor(n);
  if (v < 1000) return String(v);
  const units = ["k", "M", "B", "T"];
  let x = v;
  let u = -1;
  while (x >= 1000 && u < units.length - 1) {
    x /= 1000;
    u += 1;
  }
  const digits = x >= 100 ? 0 : x >= 10 ? 1 : 2;
  return `${x.toFixed(digits)}${units[u]}`;
}

export function shopRows(
  upgrades: Record<UpgradeId, number>,
  ichor: number,
  kills: number,
): ShopRow[] {
  const rows: ShopRow[] = [];
  for (const group of GROUPS) {
    const ids = UPGRADE_IDS.filter((id) => UPGRADE_META[id].group === group).sort(
      (a, b) => UPGRADE_META[a].unlockKills - UPGRADE_META[b].unlockKills,
    );
    let teased = false;
    for (const id of ids) {
      const open = upgradeUnlocked(id, kills);
      if (!open && teased) continue;
      if (!open) teased = true;
      const level = upgrades[id];
      const cost = upgradeCost(id, level);
      const meta = UPGRADE_META[id];
      const remain = Math.max(0, meta.unlockKills - kills);
      rows.push({
        id,
        name: meta.name,
        blurb: meta.blurb,
        level,
        cost,
        effect: open ? effectLine(id, level) : meta.blurb,
        affordable: open && ichor >= cost,
        locked: !open,
        unlockLabel: open ? null : `${remain} remaining`,
      });
    }
  }
  return rows;
}

function effectLine(id: UpgradeId, level: number): string {
  switch (id) {
    case "reach":
      return `${Math.round(smashRadius(level))}px mesh`;
    case "power":
      return `${smashDamage(level, 0)} dmg`;
    case "snap":
      return `${comboWindow(level).toFixed(2)}s combo`;
    case "crit":
      return `${Math.round(critChance(level) * 100)}% crit`;
    case "spike":
      return level === 0 ? "idle" : `+${Math.floor(level * 0.7)} rip, extra gore`;
    case "volt":
      return level === 0 ? "idle" : `slam arcs ${1 + Math.floor(level / 2)} hops`;
    case "lure":
      return `${spawnInterval(level).toFixed(2)}s spawn`;
    case "swarm":
      return `${4 + level} cap`;
    case "breed":
      return `tier weight +${level * 6}%`;
    case "paper":
      return `${paperIps(level, 1).toFixed(1)}/s`;
    case "fan":
      return level === 0 ? "idle" : `auto every ${fanInterval(level).toFixed(2)}s`;
    case "zapper":
      return level === 0 ? "idle" : `lamp every ${zapperInterval(level).toFixed(2)}s`;
    case "trap":
      return level === 0 ? "idle" : `${Math.round(trapRadius(level))}px jaws`;
  }
}

function introMul(kills: number, unlockAt: number, ramp = 140): number {
  const since = kills - unlockAt;
  if (since < 0) return 0;
  const t = Math.min(1, since / ramp);
  return 0.08 + 0.92 * t * t;
}

export function pickSpawnKind(
  kills: number,
  breed: number,
  hasQueen: boolean,
  room: RoomId,
): PestKind {
  const roster = ROOMS[room].pests;
  const weights: { kind: PestKind; w: number }[] = [];
  const add = (kind: PestKind, target: number) => {
    if (!roster.includes(kind)) return;
    const def = PESTS[kind];
    if (kills < def.unlockKills) return;
    const w = target * introMul(kills, def.unlockKills);
    if (w > 0) weights.push({ kind, w });
  };

  add("housefly", Math.max(36, 110 - kills * 0.04));
  add("fruitfly", 14 + breed * 1.4);
  add("blowfly", 10 + breed * 1.6);
  add("mosquito", 9 + breed * 1.4);
  add("cockroach", 9 + breed * 1.4);
  add("moth", 8 + breed * 1.4);
  add("wasp", 7 + breed * 1.6);
  add("maggot", 8 + breed * 1.1);
  add("stinkbug", 6 + breed * 1.3);
  add("beetle", 6 + breed * 1.4);
  add("firefly", 4 + breed * 0.9);
  add("goldfly", 1.4 + breed * 0.22);
  if (!hasQueen) add("queen", 0.55 + breed * 0.12);

  if (weights.length === 0) return roster.includes("housefly") ? "housefly" : roster[0];
  let total = 0;
  for (const w of weights) total += w.w;
  let roll = Math.random() * total;
  for (const w of weights) {
    roll -= w.w;
    if (roll <= 0) return w.kind;
  }
  return weights[0].kind;
}

export function availablePowers(
  kills: number,
  upgrades: Record<UpgradeId, number>,
): PowerId[] {
  const out: PowerId[] = [];
  if (kills >= POWER_META.frenzy.unlockKills) out.push("frenzy");
  if (kills >= POWER_META.giant.unlockKills) out.push("giant");
  if (kills >= POWER_META.acid.unlockKills) out.push("acid");
  if (kills >= POWER_META.volt.unlockKills || upgrades.volt > 0) out.push("volt");
  return out;
}

export function nextUnlock(kills: number): { label: string; at: number } | null {
  for (const u of UNLOCK_ORDER) {
    if (kills < u.at) return u;
  }
  return null;
}

export function gatesCrossed(before: number, after: number): { label: string; at: number }[] {
  return UNLOCK_ORDER.filter((u) => before < u.at && after >= u.at);
}
