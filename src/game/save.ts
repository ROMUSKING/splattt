import { emptyUpgrades, ROOM_ORDER, SAVE_KEY, SAVE_VERSION } from "./catalog";
import type { RoomId, SaveData, Settings, UpgradeId } from "./types";

const defaultSettings = (): Settings => ({
  shake: true,
  sfx: true,
  gore: "full",
});

const LEGACY_ROOM_KILLS: Record<RoomId, number> = {
  kitchen: 0,
  bathroom: 32,
  bedroom: 85,
  garage: 165,
  porch: 270,
};

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    ichor: 0,
    upgrades: emptyUpgrades(),
    prestige: 0,
    lifetimeKills: 0,
    lifetimeIchor: 0,
    bestCombo: 0,
    earnedThisRun: 0,
    room: "kitchen",
    unlockedRooms: ["kitchen"],
    settings: defaultSettings(),
  };
}

function migrate(raw: SaveData): SaveData {
  const base = defaultSave();
  const upgrades = { ...base.upgrades };
  if (raw.upgrades) {
    for (const key of Object.keys(upgrades) as UpgradeId[]) {
      const n = raw.upgrades[key];
      if (typeof n === "number" && Number.isFinite(n) && n >= 0) {
        upgrades[key] = Math.floor(n);
      }
    }
  }
  const room: RoomId =
    raw.room === "bathroom" ||
    raw.room === "bedroom" ||
    raw.room === "garage" ||
    raw.room === "porch"
      ? raw.room
      : "kitchen";
  const kills = num(raw.lifetimeKills, 0);
  let unlockedRooms: RoomId[] = ["kitchen"];
  if (Array.isArray(raw.unlockedRooms)) {
    for (const id of raw.unlockedRooms) {
      if (
        (id === "bathroom" || id === "bedroom" || id === "garage" || id === "porch") &&
        !unlockedRooms.includes(id)
      ) {
        unlockedRooms.push(id);
      }
    }
  } else {
    for (const id of ROOM_ORDER) {
      if (id !== "kitchen" && kills >= LEGACY_ROOM_KILLS[id] && !unlockedRooms.includes(id)) {
        unlockedRooms.push(id);
      }
    }
  }
  if (room !== "kitchen" && !unlockedRooms.includes(room)) unlockedRooms.push(room);
  return {
    version: SAVE_VERSION,
    ichor: num(raw.ichor, 0),
    upgrades,
    prestige: num(raw.prestige, 0),
    lifetimeKills: kills,
    lifetimeIchor: num(raw.lifetimeIchor, 0),
    bestCombo: num(raw.bestCombo, 0),
    earnedThisRun: num(raw.earnedThisRun, 0),
    room: unlockedRooms.includes(room) ? room : "kitchen",
    unlockedRooms,
    settings: {
      shake: raw.settings?.shake !== false,
      sfx: raw.settings?.sfx !== false,
      gore: raw.settings?.gore === "low" ? "low" : "full",
    },
  };
}

function num(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : d;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    return migrate(parsed);
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    const blob = JSON.stringify({ ...data, version: SAVE_VERSION });
    localStorage.setItem(SAVE_KEY, blob);
  } catch {
    /* private mode / quota */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
