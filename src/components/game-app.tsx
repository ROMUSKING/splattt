import { Component, startTransition, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import {
  Droplets,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Settings,
  ShoppingBag,
  Vibrate,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { emptyUpgrades, formatIchor, ROOM_ORDER, ROOMS } from "@/game/catalog";
import { GameEngine } from "@/game/engine";
import { cn } from "@/lib/utils";
import type { HudSnap, RoomChip, Settings as GameSettings, ShopRow } from "@/game/types";

const idleHud = (): HudSnap => ({
  screen: "title",
  ichor: 0,
  combo: 0,
  comboMult: 1,
  kills: 0,
  lifetimeKills: 0,
  bestCombo: 0,
  ips: 0,
  frenzy: false,
  prestige: 0,
  prestigeMult: 1,
  canFumigate: false,
  fumigateNeed: 2200,
  earnedThisRun: 0,
  upgrades: emptyUpgrades(),
  nextUnlock: { label: "Rot Lure", at: 18 },
  hint: "Tap a fly. Do not miss the wet part.",
  mess: 0,
  ready: false,
  settings: { shake: true, sfx: true, gore: "full" },
  room: "kitchen",
  rooms: ROOM_ORDER.map((id) => ({
    id,
    name: ROOMS[id].name,
    owned: id === "kitchen",
    revealed: id === "kitchen",
    cost: ROOMS[id].cost,
    needKills: ROOMS[id].unlockKills,
    affordable: false,
    blurb: ROOMS[id].blurb,
  })),
  power: null,
  swatter: "mesh",
});

export function GameApp() {
  return (
    <KitchenGuard>
      <GameShell />
    </KitchenGuard>
  );
}

class KitchenGuard extends Component<{ children: ReactNode }, { msg: string | null }> {
  state: { msg: string | null } = { msg: null };
  static getDerivedStateFromError(err: unknown) {
    return { msg: err instanceof Error && err.message ? err.message : "Something in the kitchen broke." };
  }
  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.warn("[splattt] ui", err, info.componentStack);
  }
  render() {
    if (this.state.msg) {
      return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-fg">
          <p className="font-display text-5xl leading-none text-accent">The kitchen seized up.</p>
          <p className="max-w-sm text-sm text-muted">{this.state.msg}</p>
          <Button size="lg" className="font-display text-xl tracking-wide" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnap>(idleHud);
  const [shopOpen, setShopOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GameEngine(canvas, (next) => {
      startTransition(() => setHud(next));
    });
    engineRef.current = engine;
    void engine.start().catch((err) => console.warn("[splattt] start", err));
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const shop = useMemo(() => {
    if (!shopOpen) return [];
    return engineRef.current?.shop() ?? [];
  }, [shopOpen, hud.ichor, hud.lifetimeKills, hud.upgrades, hud.room, hud.prestige]);

  const playing = hud.screen === "play";
  const paused = hud.screen === "paused";
  const titled = hud.screen === "title";
  const hasSave = hud.lifetimeKills > 0 || hud.ichor > 0 || hud.prestige > 0;
  const nextBonus = Math.round((hud.prestigeMult + 0.15 - 1) * 100);
  const roomName = (ROOMS[hud.room] ?? ROOMS.kitchen).name;
  const chromeOpen = shopOpen || settingsOpen || paused;

  const patchSettings = (partial: Partial<GameSettings>) => {
    engineRef.current?.setSettings({ ...hud.settings, ...partial });
  };

  const openShop = () => {
    setShopOpen(true);
    setSettingsOpen(false);
    setConfirmReset(false);
  };

  const openSettings = () => {
    setSettingsOpen(true);
    setShopOpen(false);
    setConfirmReset(false);
  };

  const closePanels = () => {
    setShopOpen(false);
    setSettingsOpen(false);
    setConfirmReset(false);
  };

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-bg text-fg">
      <header
        className={cn(
          "z-20 flex items-center justify-between gap-2 px-3 py-2",
          "pt-[max(0.5rem,env(safe-area-inset-top))]",
          "landscape:absolute landscape:inset-x-0 landscape:top-0 landscape:pointer-events-none",
        )}
      >
        <div className="pointer-events-auto flex min-w-0 items-center gap-2">
          <StatChip
            label="Ichor"
            value={formatIchor(hud.ichor)}
            sub={hud.ips > 0 && Number.isFinite(hud.ips) ? `${hud.ips.toFixed(1)}/s` : undefined}
            hot
          />
          <StatChip
            label="Combo"
            value={`x${hud.combo}`}
            sub={hud.combo > 1 && Number.isFinite(hud.comboMult) ? `${hud.comboMult.toFixed(2)}×` : undefined}
            hot={hud.frenzy}
          />
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {playing && (
            <IconBtn
              label="Pause"
              onClick={() => {
                engineRef.current?.pause();
                closePanels();
              }}
            >
              <Pause className="size-5" />
            </IconBtn>
          )}
          {paused && (
            <IconBtn
              label="Resume"
              onClick={() => {
                engineRef.current?.resume();
                closePanels();
              }}
            >
              <Play className="size-5" />
            </IconBtn>
          )}
          <IconBtn label="Shop" onClick={() => (shopOpen ? closePanels() : openShop())}>
            <ShoppingBag className="size-5" />
          </IconBtn>
        </div>
      </header>

      <div
        className={cn(
          "relative w-full shrink-0 overflow-hidden bg-bg contain-layout contain-paint",
          "aspect-video",
          "landscape:absolute landscape:inset-0 landscape:z-0 landscape:m-auto landscape:aspect-video",
          "landscape:h-[min(100dvh,calc(100dvw*9/16))] landscape:w-[min(100dvw,calc(100dvh*16/9))]",
        )}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full touch-none select-none"
          aria-label="Splattt playfield"
        />
        {hud.power && (
          <div className="pointer-events-none absolute left-3 top-3">
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/90 px-3 py-1.5 text-sm">
              <span className="font-display text-lg leading-none text-accent">{hud.power.label}</span>
              <span className="text-muted">{Number.isFinite(hud.power.t) ? hud.power.t.toFixed(1) : "0"}s</span>
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col",
          "landscape:absolute landscape:inset-0 landscape:pointer-events-none",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col landscape:contents">
          {titled && !chromeOpen && (
            <TitlePanel
              hasSave={hasSave}
              onStart={() => {
                closePanels();
                engineRef.current?.startPlay();
              }}
              onSettings={openSettings}
            />
          )}

          {paused && !shopOpen && !settingsOpen && (
            <PausePanel
              roomName={roomName}
              onResume={() => {
                closePanels();
                engineRef.current?.resume();
              }}
              onShop={openShop}
              onSettings={openSettings}
            />
          )}

          {settingsOpen && (
            <SettingsPanel
              settings={hud.settings}
              confirmReset={confirmReset}
              onPatch={patchSettings}
              onClose={() => {
                setSettingsOpen(false);
                setConfirmReset(false);
              }}
              onReset={() => {
                if (!confirmReset) {
                  setConfirmReset(true);
                  return;
                }
                engineRef.current?.reset();
                closePanels();
              }}
            />
          )}

          {shopOpen && (
            <ShopPanel
              hud={hud}
              shop={shop}
              nextBonus={nextBonus}
              onClose={closePanels}
              onGo={(id) => engineRef.current?.setRoom(id)}
              onBuyRoom={(id) => engineRef.current?.buyRoom(id)}
              onBuy={(id) => engineRef.current?.buy(id)}
              onFumigate={() => engineRef.current?.fumigate()}
            />
          )}

          {!titled && !chromeOpen && (
            <div className="pointer-events-none px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 landscape:absolute landscape:inset-x-0 landscape:bottom-0">
              {hud.nextUnlock && (
                <p className="mb-2 text-center text-sm text-muted">
                  Next {hud.nextUnlock.label}
                  {hud.nextUnlock.at > hud.lifetimeKills
                    ? ` · ${hud.nextUnlock.at - hud.lifetimeKills} left`
                    : " · shop"}
                </p>
              )}
              {hud.hint && <p className="text-center text-sm text-accent">{hud.hint}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TitlePanel({
  hasSave,
  onStart,
  onSettings,
}: {
  hasSave: boolean;
  onStart: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-4 text-center landscape:absolute landscape:inset-0">
      <h1 className="font-display mb-3 text-5xl leading-none tracking-tight text-accent sm:text-7xl landscape:text-8xl">
        SPATTT!
      </h1>
      <p className="max-w-md text-sm text-muted sm:text-base">
        Kitchen extermination. Smash flies. Spend the mess.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col items-stretch gap-2 sm:mt-8 sm:gap-3">
        <Button size="xl" className="font-display text-2xl tracking-wide" onClick={onStart}>
          Kill them
        </Button>
        {hasSave && (
          <Button size="lg" variant="secondary" className="font-display text-xl tracking-wide" onClick={onStart}>
            Continue
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={onSettings}>
          <Settings className="size-4" />
          Settings
        </Button>
        <p className="mt-1 text-sm text-accent">Tap a fly. Do not miss the wet part.</p>
      </div>
    </div>
  );
}

function PausePanel({
  roomName,
  onResume,
  onShop,
  onSettings,
}: {
  roomName: string;
  onResume: () => void;
  onShop: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-bg/70 px-6 py-6 text-center landscape:absolute landscape:inset-0">
      <p className="font-display text-6xl leading-none text-accent">Paused</p>
      <p className="mt-2 text-sm text-muted">Now in the {roomName.toLowerCase()}</p>
      <div className="mt-8 flex w-full max-w-xs flex-col items-stretch gap-3">
        <Button size="xl" className="font-display text-2xl tracking-wide" onClick={onResume}>
          Resume
        </Button>
        <Button size="lg" variant="secondary" onClick={onShop}>
          <ShoppingBag className="size-4" />
          Shop
        </Button>
        <Button size="lg" variant="ghost" onClick={onSettings}>
          <Settings className="size-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  confirmReset,
  onPatch,
  onClose,
  onReset,
}: {
  settings: GameSettings;
  confirmReset: boolean;
  onPatch: (partial: Partial<GameSettings>) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  return (
    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col bg-surface landscape:absolute landscape:inset-y-0 landscape:left-0 landscape:w-80 landscape:border-r landscape:border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-3xl leading-none">Settings</h2>
        <IconBtn label="Close settings" onClick={onClose}>
          <X className="size-5" />
        </IconBtn>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto px-4 py-4">
        <ToggleRow
          icon={settings.sfx ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          label="Sound"
          value={settings.sfx ? "On" : "Off"}
          onClick={() => onPatch({ sfx: !settings.sfx })}
        />
        <ToggleRow
          icon={<Vibrate className="size-4" />}
          label="Shake"
          value={settings.shake ? "On" : "Off"}
          onClick={() => onPatch({ shake: !settings.shake })}
        />
        <ToggleRow
          icon={<Droplets className="size-4" />}
          label="Gore"
          value={settings.gore === "full" ? "Full" : "Low"}
          onClick={() => onPatch({ gore: settings.gore === "full" ? "low" : "full" })}
        />
        <button
          type="button"
          className="mt-2 flex h-11 items-center justify-between rounded-md border border-border bg-surface-2 px-3 text-sm text-muted hover:text-fg"
          onClick={onReset}
        >
          <span className="inline-flex items-center gap-2">
            <RotateCcw className="size-4" />
            {confirmReset ? "Tap again to wipe save" : "Reset save"}
          </span>
        </button>
      </div>
    </div>
  );
}

function ShopPanel({
  hud,
  shop,
  nextBonus,
  onClose,
  onGo,
  onBuyRoom,
  onBuy,
  onFumigate,
}: {
  hud: HudSnap;
  shop: { group: string; rows: ShopRow[] }[];
  nextBonus: number;
  onClose: () => void;
  onGo: (id: RoomChip["id"]) => void;
  onBuyRoom: (id: RoomChip["id"]) => void;
  onBuy: (id: ShopRow["id"]) => void;
  onFumigate: () => void;
}) {
  return (
    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col bg-surface landscape:absolute landscape:inset-y-0 landscape:right-0 landscape:w-96 landscape:border-l landscape:border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-3xl leading-none">Shop</h2>
          <p className="mt-1 text-sm text-muted">
            {formatIchor(hud.ichor)} ichor · {(ROOMS[hud.room] ?? ROOMS.kitchen).name}
          </p>
        </div>
        <IconBtn label="Close shop" onClick={onClose}>
          <X className="size-5" />
        </IconBtn>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <ShopSection title="Rooms">
          {hud.rooms.map((chip) => (
            <RoomShopRow
              key={chip.id}
              chip={chip}
              current={hud.room === chip.id}
              kills={hud.lifetimeKills}
              onGo={() => onGo(chip.id)}
              onBuy={() => onBuyRoom(chip.id)}
            />
          ))}
        </ShopSection>
        {shop.map((block) => (
          <ShopSection key={block.group} title={block.group}>
            {block.rows.map((row) => (
              <UpgradeRow key={row.id} row={row} onBuy={() => onBuy(row.id)} />
            ))}
          </ShopSection>
        ))}
      </div>
      <div className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="text-xs uppercase tracking-wider text-subtle">Fumigate</p>
        <p className="mt-1 text-sm text-muted">
          {formatIchor(hud.earnedThisRun)} / {formatIchor(hud.fumigateNeed)} this run
        </p>
        <p className="mt-1 text-sm text-fg">
          +{nextBonus}% ichor bonus as Exterminator {hud.prestige + 1}
        </p>
        <Button
          variant="ichor"
          size="lg"
          className="mt-3 w-full font-display text-xl tracking-wide"
          disabled={!hud.canFumigate}
          onClick={onFumigate}
        >
          Fumigate
        </Button>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-surface/90 text-fg hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

function StatChip({
  label,
  value,
  sub,
  hot,
}: {
  label: string;
  value: string;
  sub?: string;
  hot?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-11 rounded-md border border-border bg-surface/90 px-2 py-1 tabular-nums sm:px-2.5 sm:py-1.5",
        hot && "border-ichor text-ichor-bright",
      )}
    >
      <p className="text-xs uppercase tracking-wider text-subtle">{label}</p>
      <p className="font-display text-xl leading-none sm:text-2xl">
        {value}
        {sub ? <span className="ml-1 text-sm text-muted">{sub}</span> : null}
      </p>
    </div>
  );
}

function ShopSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 font-display text-xl leading-none text-muted">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function RoomShopRow({
  chip,
  current,
  kills,
  onGo,
  onBuy,
}: {
  chip: RoomChip;
  current: boolean;
  kills: number;
  onGo: () => void;
  onBuy: () => void;
}) {
  const remain = Math.max(0, chip.needKills - kills);
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl leading-none">{chip.name}</p>
          <p className="mt-1 text-sm text-muted">{chip.blurb}</p>
        </div>
        {chip.owned ? (
          current ? (
            <span className="text-sm text-muted">here</span>
          ) : (
            <Button size="sm" variant="secondary" onClick={onGo}>
              Go
            </Button>
          )
        ) : chip.revealed ? (
          <Button size="sm" variant={chip.affordable ? "primary" : "secondary"} disabled={!chip.affordable} onClick={onBuy}>
            {chip.cost} ichor
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-muted">
            <Lock className="size-3.5" />
            {remain} remaining
          </span>
        )}
      </div>
    </div>
  );
}

function UpgradeRow({ row, onBuy }: { row: ShopRow; onBuy: () => void }) {
  if (row.locked) {
    return (
      <div className="rounded-md border border-border bg-surface-2/70 px-3 py-2.5 text-muted">
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 font-display text-xl leading-none">
            <Lock className="size-3.5" />
            {row.name}
          </p>
          <span className="text-sm">{row.unlockLabel}</span>
        </div>
        <p className="mt-1 text-sm">{row.blurb}</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl leading-none">
            {row.name} <span className="text-muted">Lv {row.level}</span>
          </p>
          <p className="mt-1 text-sm text-muted">{row.effect}</p>
        </div>
        <Button size="sm" variant={row.affordable ? "primary" : "secondary"} disabled={!row.affordable} onClick={onBuy}>
          {row.cost}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center justify-between rounded-md border border-border bg-surface-2 px-3 text-sm"
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="text-muted">{value}</span>
    </button>
  );
}
