/** Recovering checks — log, never throw. A throw in the game loop freezes the table. */

export function finite(n: number, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

export function clamp(n: number, lo: number, hi: number): number {
  const x = finite(n, lo);
  return x < lo ? lo : x > hi ? hi : x;
}

export function assert(cond: unknown, msg: string): void {
  if (!cond) console.warn("[splattt]", msg);
}

export function tryRun(fn: () => void, label: string): void {
  try {
    fn();
  } catch (err) {
    console.warn("[splattt]", label, err);
  }
}
