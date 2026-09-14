export type PestKind =
  | "housefly"
  | "blowfly"
  | "mosquito"
  | "wasp"
  | "maggot"
  | "goldfly"
  | "queen"
  | "cockroach"
  | "moth"
  | "fruitfly"
  | "beetle"
  | "firefly"
  | "stinkbug";

export type UpgradeId =
  | "reach"
  | "power"
  | "snap"
  | "crit"
  | "spike"
  | "volt"
  | "lure"
  | "swarm"
  | "breed"
  | "paper"
  | "fan"
  | "zapper"
  | "trap";

export type RoomId = "kitchen" | "bathroom" | "bedroom" | "garage" | "porch";

export type PowerId = "frenzy" | "giant" | "volt" | "acid";

export type SwatterKind = "mesh" | "volt" | "spike";

export type Screen = "title" | "play" | "paused";

export type GoreLevel = "full" | "low";

export type Settings = {
  shake: boolean;
  sfx: boolean;
  gore: GoreLevel;
};

export type Fly = {
  id: number;
  kind: PestKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  frame: number;
  bob: number;
  turnT: number;
  dartT: number;
  flash: number;
  life: number;
  maxLife: number;
};

export type Pickup = {
  id: number;
  kind: PowerId;
  x: number;
  y: number;
  bob: number;
  life: number;
};

export type Particle = {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
  kind: "drop" | "chunk" | "spark";
};

export type Decal = {
  x: number;
  y: number;
  scale: number;
  rot: number;
  variant: number;
  alpha: number;
  sheet: 0 | 1;
};

export type Impact = {
  x: number;
  y: number;
  t: number;
  scale: number;
  sheet: 0 | 1 | 2;
};

export type Floater = {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
  size: number;
};

export type SaveData = {
  version: number;
  ichor: number;
  upgrades: Record<UpgradeId, number>;
  prestige: number;
  lifetimeKills: number;
  lifetimeIchor: number;
  bestCombo: number;
  earnedThisRun: number;
  room: RoomId;
  unlockedRooms: RoomId[];
  settings: Settings;
};

export type RoomChip = {
  id: RoomId;
  name: string;
  owned: boolean;
  revealed: boolean;
  cost: number;
  needKills: number;
  affordable: boolean;
  blurb: string;
};

export type HudSnap = {
  screen: Screen;
  ichor: number;
  combo: number;
  comboMult: number;
  kills: number;
  lifetimeKills: number;
  bestCombo: number;
  ips: number;
  frenzy: boolean;
  prestige: number;
  prestigeMult: number;
  canFumigate: boolean;
  fumigateNeed: number;
  earnedThisRun: number;
  upgrades: Record<UpgradeId, number>;
  nextUnlock: { label: string; at: number } | null;
  hint: string | null;
  mess: number;
  ready: boolean;
  settings: Settings;
  room: RoomId;
  rooms: RoomChip[];
  power: { kind: PowerId; label: string; t: number } | null;
  swatter: SwatterKind;
};

export type ShopRow = {
  id: UpgradeId;
  name: string;
  blurb: string;
  level: number;
  cost: number;
  effect: string;
  affordable: boolean;
  locked: boolean;
  unlockLabel: string | null;
};
