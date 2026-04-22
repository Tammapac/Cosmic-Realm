import { useEffect, useRef } from "react";
import { state, bump, useGame, save, pushNotification, abandonDungeon, useConsumable, getRocketWeaponIds, rocketAmmoMax, getActiveAmmoType, switchRocketAmmoType, runDockingServices } from "./game/store";
import { startLoop, stopLoop, checkPortal, checkStationDock, effectiveStats } from "./game/loop";
import { render } from "./game/render";
import { TopBar, WorldTargetHud } from "./components/TopBar";
import { MiniMap } from "./components/MiniMap";
import { Hangar } from "./components/Hangar";
import { SocialPanel, ClanPanel, GalaxyMap } from "./components/SocialPanel";
import { FactionPicker } from "./components/FactionPicker";
import { IdleRewardModal } from "./components/IdleRewardModal";
import { EventBanners } from "./components/EventBanners";
import { Hotbar } from "./components/Hotbar";
import { QuestTracker } from "./components/QuestTracker";
import { DUNGEONS, STATIONS, PORTALS, ZONES, MODULE_DEFS, ROCKET_AMMO_TYPE_DEFS, RocketAmmoType } from "./game/types";
import { travelToZone, state as gameState } from "./game/store";

function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    startLoop();
    return () => stopLoop();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      render(ctx, w, h);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (state.dockedAt) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const wx = state.player.pos.x + (cx - rect.width / 2);
    const wy = state.player.pos.y + (cy - rect.height / 2);
    state.cameraTarget = { x: wx, y: wy };
    state.selectedWorldTarget = null;

    // Pull toward nearest station if clicked nearby
    for (const s of STATIONS) {
      if (s.zone !== state.player.zone) continue;
      if (Math.hypot(s.pos.x - wx, s.pos.y - wy) < 60) {
        state.cameraTarget = { x: s.pos.x, y: s.pos.y };
        break;
      }
    }

    const enemy = state.enemies.find((en) => Math.hypot(en.pos.x - wx, en.pos.y - wy) < Math.max(24, en.size + 14));
    if (enemy) {
      state.selectedWorldTarget = {
        kind: "enemy",
        id: enemy.id,
        name: enemy.name ?? enemy.type.toUpperCase(),
        detail: `${enemy.type.toUpperCase()} · ${Math.max(0, Math.round(enemy.hull))}/${Math.round(enemy.hullMax)} HP`,
      };
      state.cameraTarget = { x: enemy.pos.x, y: enemy.pos.y };
      bump();
      return;
    }

    const asteroid = state.asteroids.find((a) => a.zone === state.player.zone && Math.hypot(a.pos.x - wx, a.pos.y - wy) < a.size + 10);
    if (asteroid) {
      state.selectedWorldTarget = {
        kind: "asteroid",
        id: asteroid.id,
        name: asteroid.yields === "lumenite" ? "LUMENITE ROCK" : "ORE ROCK",
        detail: `${asteroid.yields.toUpperCase()} · ${Math.round(asteroid.hp)}/${Math.round(asteroid.hpMax)} HP`,
      };
      state.miningTargetId = asteroid.id;
      bump();
      return;
    }

    bump();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 || state.dockedAt) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    state.cameraTarget = {
      x: state.player.pos.x + (cx - rect.width / 2),
      y: state.player.pos.y + (cy - rect.height / 2),
    };
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: "crosshair", display: "block" }}
    />
  );
}

function Notifications() {
  const items = useGame((s) => s.notifications);
  return (
    <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-40" style={{ bottom: 96 }}>
      {items.slice(-4).map((n) => (
        <div
          key={n.id}
          className="panel px-2.5 py-1 text-[10px] font-bold tracking-widest"
          style={{
            opacity: Math.min(1, n.ttl),
            color: n.kind === "good" ? "#5cff8a" : n.kind === "bad" ? "#ff5c6c" : "#4ee2ff",
            borderColor: n.kind === "good" ? "#5cff8a" : n.kind === "bad" ? "#ff5c6c" : "#4ee2ff",
          }}
        >
          {n.text}
        </div>
      ))}
    </div>
  );
}

function DungeonHud() {
  const dungeon = useGame((s) => s.dungeon);
  if (!dungeon) return null;
  const def = DUNGEONS[dungeon.id];
  return (
    <>
      {/* corner tint to signal instance mode */}
      <div className="absolute inset-0 pointer-events-none z-[5]" style={{
        boxShadow: `inset 0 0 220px ${def.color}33`,
      }} />
      <div className="absolute z-30 pointer-events-auto" style={{ top: 64, left: "50%", transform: "translateX(-50%)" }}>
        <div className="panel px-3 py-1.5 flex items-center gap-3" style={{ borderColor: def.color, boxShadow: `0 0 14px ${def.color}55` }}>
          <div className="text-[10px] tracking-[0.25em] font-bold" style={{ color: def.color }}>▼ {def.name.toUpperCase()}</div>
          <div className="text-[10px] text-mute tabular-nums">WAVE {dungeon.wave}/{dungeon.totalWaves}</div>
          <div className="text-[10px] text-amber tabular-nums">ENEMIES: {state.enemies.length}</div>
          <button className="btn btn-danger" style={{ padding: "1px 6px", fontSize: 9 }} onClick={abandonDungeon}>
            Abandon
          </button>
        </div>
      </div>
    </>
  );
}

function DockPrompt() {
  const player = useGame((s) => s.player);
  useGame((s) => s.tick);

  const station = STATIONS.find(
    (s) => s.zone === player.zone && Math.hypot(s.pos.x - player.pos.x, s.pos.y - player.pos.y) < 90
  );
  const portal = PORTALS.find(
    (po) => po.fromZone === player.zone && Math.hypot(po.pos.x - player.pos.x, po.pos.y - player.pos.y) < 70
  );

  if (!station && !portal) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40">
      {station && !state.dockedAt && (
        <button
          className="btn btn-primary text-base px-8 py-3"
          style={{ animation: "pulse-glow 2s ease-in-out infinite", whiteSpace: "nowrap", minWidth: "fit-content" }}
          onClick={() => {
            state.dockedAt = station.id;
            state.player.vel = { x: 0, y: 0 };
            pushNotification(`Docking with ${station.name}`, "good");
            save(); bump();
            const stats = effectiveStats();
            runDockingServices(stats.hullMax, stats.shieldMax);
          }}
        >
          [SPACE] DOCK AT {station.name.toUpperCase()}
        </button>
      )}
      {portal && (
        <button
          className="btn px-6 py-3"
          style={{ borderColor: "#ff5cf0", color: "#ff5cf0", animation: "pulse-glow 2s ease-in-out infinite" }}
          onClick={() => {
            const z = ZONES[portal.toZone];
            if (player.level < z.unlockLevel) {
              pushNotification(`Need level ${z.unlockLevel} to enter ${z.name}`, "bad");
              return;
            }
            travelToZone(portal.toZone);
          }}
        >
          ▶ WARP TO {ZONES[portal.toZone].name.toUpperCase()}
        </button>
      )}
    </div>
  );
}

const AMMO_TYPE_ORDER: RocketAmmoType[] = ["x1", "x2", "x3", "x4"];

function AmmoHud() {
  const player = useGame((s) => s.player);
  useGame((s) => s.tick);
  const rocketIds = getRocketWeaponIds();
  if (rocketIds.length === 0) return null;
  const ammoMax = rocketAmmoMax();

  const cycleAmmoType = (weaponId: string) => {
    if (state.dockedAt) return;
    const current = getActiveAmmoType(weaponId);
    const idx = AMMO_TYPE_ORDER.indexOf(current);
    const next = AMMO_TYPE_ORDER[(idx + 1) % AMMO_TYPE_ORDER.length];
    switchRocketAmmoType(weaponId, next);
  };

  return (
    <div className="absolute z-30" style={{ bottom: 56, right: 12, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      {rocketIds.map((id) => {
        const item = player.inventory.find((m) => m.instanceId === id);
        const def = item ? MODULE_DEFS[item.defId] : null;
        const activeType = getActiveAmmoType(id);
        const typeDef = ROCKET_AMMO_TYPE_DEFS[activeType];
        const cur = activeType === "x1"
          ? (player.ammo[id] ?? 0)
          : (player.ammoByType?.[id]?.[activeType] ?? 0);
        const pct = ammoMax > 0 ? cur / ammoMax : 0;
        const isEmpty = cur === 0;
        const isLow = cur > 0 && cur <= 5;
        const barColor = isEmpty ? "#ff5c6c" : isLow ? "#ffd24a" : typeDef.color;
        return (
          <div
            key={id}
            className="panel px-2 py-1"
            style={{
              borderColor: barColor,
              boxShadow: (isEmpty || isLow) ? `0 0 8px ${barColor}66` : undefined,
              minWidth: 148,
              cursor: "pointer",
            }}
            title="Click to cycle ammo type"
            onClick={() => cycleAmmoType(id)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[9px] tracking-widest truncate" style={{ color: def?.color ?? barColor }}>
                {typeDef.glyph} {def?.name ?? "Rocket"}
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="text-[8px] font-bold px-1 rounded"
                  style={{ background: typeDef.color + "30", color: typeDef.color, border: `1px solid ${typeDef.color}80` }}
                >
                  {typeDef.shortName}
                </span>
                <div className="text-[10px] font-bold tabular-nums" style={{ color: barColor }}>
                  {isEmpty ? "EMPTY" : isLow ? `${cur} LOW` : cur}
                  <span className="text-mute text-[8px]">/{ammoMax}</span>
                </div>
              </div>
            </div>
            <div className="mt-0.5 h-1" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full"
                style={{
                  width: `${pct * 100}%`,
                  background: barColor,
                  transition: "width 0.2s",
                }}
              />
            </div>
          </div>
        );
      })}
      <div className="text-[8px] text-mute text-right" style={{ pointerEvents: "none" }}>click ammo to cycle type</div>
    </div>
  );
}

function Title() {
  return (
    <div className="absolute bottom-3 left-3 z-30 pointer-events-none">
      <div className="text-cyan glow-cyan text-[10px] tracking-[0.3em]">STELLAR FRONTIER</div>
      <div className="text-mute text-[9px] tracking-widest">
        v 2.0 · CLICK to move · MINIMAP click warps · SPACE docks · SHOOT asteroids to mine
      </div>
    </div>
  );
}

function DockingSummary() {
  const summary = useGame((s) => s.dockingSummary);

  useEffect(() => {
    if (!summary) return;
    const dismiss = () => { state.dockingSummary = null; bump(); };
    const timer = setTimeout(dismiss, 6000);
    document.addEventListener("click", dismiss, { once: true });
    return () => { clearTimeout(timer); document.removeEventListener("click", dismiss); };
  }, [summary]);

  if (!summary) return null;

  const totalCost = summary.reduce((acc, e) => acc + e.cost, 0);
  const iconFor = (kind: string) => {
    if (kind === "repair") return "⬡";
    if (kind === "shield") return "◈";
    if (kind === "ammo") return "▸";
    return "✕";
  };
  const colorFor = (kind: string) => {
    if (kind === "repair") return "#4ade80";
    if (kind === "shield") return "#60a5fa";
    if (kind === "ammo") return "#facc15";
    return "#f87171";
  };

  return (
    <div
      className="absolute top-16 left-1/2 -translate-x-1/2 z-50"
      style={{ animation: "fadeInDown 0.3s ease" }}
    >
      <div
        className="rounded border px-5 py-4 cursor-pointer select-none"
        style={{
          background: "rgba(2,6,20,0.92)",
          borderColor: "#1e3a5f",
          boxShadow: "0 0 24px rgba(0,180,255,0.15)",
          minWidth: 260,
        }}
      >
        <div className="text-cyan text-[11px] tracking-[0.25em] font-bold mb-3">◉ DOCKING REPORT</div>
        <div className="flex flex-col gap-2">
          {summary.map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-[12px]">
              <div className="flex items-center gap-2">
                <span style={{ color: colorFor(entry.kind) }}>{iconFor(entry.kind)}</span>
                <span style={{ color: entry.kind === "failed" ? "#f87171" : "#c8d8f0" }}>{entry.label}</span>
              </div>
              {entry.cost > 0 && (
                <span style={{ color: "#facc15" }} className="shrink-0">-{entry.cost}cr</span>
              )}
            </div>
          ))}
        </div>
        {totalCost > 0 && (
          <>
            <div className="border-t mt-3 mb-2" style={{ borderColor: "#1e3a5f" }} />
            <div className="flex justify-between text-[12px]">
              <span style={{ color: "#7a9cbf" }}>Total spent</span>
              <span style={{ color: "#facc15" }}>-{totalCost}cr</span>
            </div>
          </>
        )}
        <div className="text-[9px] tracking-widest mt-3" style={{ color: "#3a5a7a" }}>CLICK TO DISMISS</div>
      </div>
    </div>
  );
}

export default function App() {
  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (state.dockedAt) return;
        const sid = checkStationDock();
        if (sid) {
          state.dockedAt = sid;
          state.player.vel = { x: 0, y: 0 };
          pushNotification("Docking...", "good");
          save(); bump();
          const stats = effectiveStats();
          runDockingServices(stats.hullMax, stats.shieldMax);
        }
      } else if (e.key === "m" || e.key === "M") {
        state.showMap = !state.showMap; bump();
      } else if (e.key === "c" || e.key === "C") {
        state.showClan = !state.showClan; bump();
      } else if (e.key === "h" || e.key === "H") {
        state.showSocial = !state.showSocial; bump();
      } else if (e.key === "Escape") {
        state.showMap = false;
        state.showClan = false;
        bump();
      } else if (e.key >= "1" && e.key <= "8") {
        if (!state.dockedAt) useConsumable(parseInt(e.key) - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-check portal collision
  useEffect(() => {
    const id = setInterval(() => {
      if (state.dockedAt) return;
      checkPortal();
    }, 200);
    return () => clearInterval(id);
  }, []);

  const docked = useGame((s) => s.dockedAt);
  const showSocial = useGame((s) => s.showSocial);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#02040c" }}>
      <GameCanvas />
      <TopBar />
      <WorldTargetHud />
      <MiniMap />
      <Notifications />
      <DungeonHud />
      <QuestTracker />
      <AmmoHud />
      {showSocial && <SocialPanel />}
      <ClanPanel />
      <GalaxyMap />
      <EventBanners />
      <Title />
      {docked && <Hangar stationId={docked} />}
      <DockingSummary />
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 74,
          transform: "translateX(-50%)",
          zIndex: 51,
          pointerEvents: "auto",
        }}
      >
        <DockPrompt />
      </div>
      <Hotbar />
      <IdleRewardModal />
      <FactionPicker />
      <div className="crt-overlay" />
    </div>
  );
}
