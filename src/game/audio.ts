import { clamp, tryRun } from "./assert";

type Bus = {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
};

const MAX_VOICES = 4;

let bus: Bus | null = null;
let splatBuf: AudioBuffer | null = null;
let slapBuf: AudioBuffer | null = null;
let critBuf: AudioBuffer | null = null;
let enabled = true;
let voices = 0;

function makeNoise(ctx: AudioContext, seconds: number, fn: (t: number) => number) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = fn(i / ctx.sampleRate);
  return buf;
}

function buildBuffers(ctx: AudioContext) {
  splatBuf = makeNoise(ctx, 0.12, (t) => {
    const env = Math.exp(-t * 28);
    const thump = Math.sin(2 * Math.PI * (88 + t * 40) * t) * Math.exp(-t * 16);
    return thump * 0.7 + (Math.random() * 2 - 1) * env * 0.5;
  });
  slapBuf = makeNoise(ctx, 0.06, (t) => {
    const env = Math.exp(-t * 55);
    return (Math.random() * 2 - 1) * env * 0.4;
  });
  critBuf = makeNoise(ctx, 0.16, (t) => {
    const env = Math.exp(-t * 14);
    const boom = Math.sin(2 * Math.PI * 56 * t) * Math.exp(-t * 10);
    return boom * 0.75 + (Math.random() * 2 - 1) * Math.exp(-t * 20) * 0.4 * env;
  });
}

export function unlockAudio(phone = false): void {
  if (typeof window === "undefined") return;
  tryRun(() => {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!bus) {
      const ctx = new AC({ latencyHint: phone ? "playback" : "interactive" });
      const master = ctx.createGain();
      const sfx = ctx.createGain();
      master.gain.value = 0.85;
      sfx.gain.value = 0.9;
      sfx.connect(master);
      master.connect(ctx.destination);
      bus = { ctx, master, sfx };
      buildBuffers(ctx);
    }
    if (bus.ctx.state === "suspended") void bus.ctx.resume();
  }, "unlockAudio");
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
  if (!bus) return;
  try {
    bus.master.gain.value = on ? 0.85 : 0;
  } catch {
    /* closed context */
  }
}

export function resumeAudio() {
  if (bus && bus.ctx.state === "suspended") void bus.ctx.resume().catch(() => undefined);
}

export function suspendAudio() {
  if (bus && bus.ctx.state === "running") void bus.ctx.suspend().catch(() => undefined);
}

function takeVoice(): boolean {
  if (voices >= MAX_VOICES) return false;
  voices += 1;
  return true;
}

function dropVoice() {
  voices = Math.max(0, voices - 1);
}

function fire(buf: AudioBuffer | null, rate: number, vol: number) {
  if (!enabled || !bus || !buf) return;
  if (!takeVoice()) return;
  try {
    const src = bus.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = clamp(rate, 0.5, 2);
    const g = bus.ctx.createGain();
    g.gain.value = clamp(vol, 0, 1);
    src.connect(g);
    g.connect(bus.sfx);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      dropVoice();
      try {
        src.disconnect();
        g.disconnect();
      } catch {
        /* already gone */
      }
    };
    src.onended = release;
    const dur = Math.min(0.4, buf.duration / Math.max(0.5, rate) + 0.04);
    src.start();
    try {
      src.stop(bus.ctx.currentTime + dur);
    } catch {
      /* some WebViews reject stop-after-start */
    }
  } catch (err) {
    dropVoice();
    console.warn("[splattt] sfx", err);
  }
}

export function playSplat(crit: boolean, _pan: number, combo: number) {
  const rate = 0.92 + Math.random() * 0.18 + Math.min(0.2, combo * 0.012);
  fire(splatBuf, rate, crit ? 0.5 : 0.38);
  if (crit) fire(critBuf, 0.85 + Math.random() * 0.2, 0.42);
}

export function playSlap(_pan: number) {
  fire(slapBuf, 0.9 + Math.random() * 0.25, 0.24);
}

export function playUpgrade() {
  fire(slapBuf, 1.4, 0.18);
}

export function playZap(_pan: number) {
  fire(critBuf, 1.6, 0.2);
}

export function playFumigate() {
  fire(critBuf, 0.55, 0.3);
}

export function setBuzz(_flyCount: number, _frenzy: boolean) {
  /* live oscillators crash some Android WebViews after a few minutes */
}

export function audioStats() {
  return {
    voices,
    hasBus: Boolean(bus),
    ctx: bus?.ctx.state ?? "none",
  };
}

export function disposeAudio() {
  try {
    void bus?.ctx.close();
  } catch {
    /* already closed */
  }
  bus = null;
  voices = 0;
  splatBuf = null;
  slapBuf = null;
  critBuf = null;
}
