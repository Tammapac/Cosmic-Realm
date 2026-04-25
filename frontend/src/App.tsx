import { useEffect, useRef, useState } from "react";
import { state, bump, useGame, save, pushNotification, abandonDungeon, useConsumable, getAmmoWeaponIds, rocketAmmoMax, getActiveAmmoType, getAmmoCount, runDockingServices, loadServerPlayer, collectCargoBox, enterDungeon } from "./game/store";
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
import { DUNGEONS, STATIONS, PORTALS, ZONES, MODULE_DEFS, ROCKET_AMMO_TYPE_DEFS } from "./game/types";
import { travelToZone, state as gameState } from "./game/store";
import AuthScreen from "./components/AuthScreen";
import { hasToken, getPlayer, clearToken } from "./net/api";
import { connectSocket, disconnectSocket, setSocketListeners, sendPosition } from "./net/socket";

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

  const screenToWorld = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const zoom = state.cameraZoom;
    return {
      x: state.player.pos.x + (cx - rect.width / 2) / zoom,
      y: state.player.pos.y + (cy - rect.height / 2) / zoom,
    };
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (state.dockedAt) return;
    const { x: wx, y: wy } = screenToWorld(e);

    // Check if clicking on enemy — lock target (stays locked), do NOT auto-attack
    const enemy = state.enemies.find((en) => Math.hypot(en.pos.x - wx, en.pos.y - wy) < Math.max(24, en.size + 14));
    if (enemy) {
      state.selectedWorldTarget = {
        kind: "enemy",
        id: enemy.id,
        name: enemy.name ?? enemy.type.toUpperCase(),
        detail: `${enemy.type.toUpperCase()} · ${Math.max(0, Math.round(enemy.hull))}/${Math.round(enemy.hullMax)} HP`,
      };
      state.attackTargetId = enemy.id;
      state.miningTargetId = null;
      bump();
      return;
    }

    // Check if clicking on asteroid — select but do NOT move ship
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

    // Check if clicking on cargo box — fly to it to collect
    const cargoBox = state.cargoBoxes.find((cb) => Math.hypot(cb.pos.x - wx, cb.pos.y - wy) < 24);
    if (cargoBox) {
      state.cameraTarget = { x: cargoBox.pos.x, y: cargoBox.pos.y };
      bump();
      return;
    }

    // Check if clicking on dungeon rift — enter if close enough, otherwise fly to it
    for (const d of Object.values(DUNGEONS)) {
      if (d.zone !== state.player.zone) continue;
      if (Math.hypot(d.pos.x - wx, d.pos.y - wy) < 50) {
        const playerDist = Math.hypot(d.pos.x - state.player.pos.x, d.pos.y - state.player.pos.y);
        if (playerDist < 120) {
          enterDungeon(d.id);
        } else {
          state.cameraTarget = { x: d.pos.x, y: d.pos.y };
          pushNotification(`Fly closer to enter ${d.name}`, "info");
        }
        bump();
        return;
      }
    }

    // Clicked on free space — move ship there, keep target lock
    state.cameraTarget = { x: wx, y: wy };
    state.miningTargetId = null;

    // Snap to station if clicked nearby
    for (const s of STATIONS) {
      if (s.zone !== state.player.zone) continue;
      if (Math.hypot(s.pos.x - wx, s.pos.y - wy) < 60) {
        state.cameraTarget = { x: s.pos.x, y: s.pos.y };
        break;
      }
    }
    bump();
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (state.dockedAt) return;
    const { x: wx, y: wy } = screenToWorld(e);
    const enemy = state.enemies.find((en) => Math.hypot(en.pos.x - wx, en.pos.y - wy) < Math.max(24, en.size + 14));
    if (enemy) {
      state.selectedWorldTarget = {
        kind: "enemy",
        id: enemy.id,
        name: enemy.name ?? enemy.type.toUpperCase(),
        detail: `${enemy.type.toUpperCase()} · ${Math.max(0, Math.round(enemy.hull))}/${Math.round(enemy.hullMax)} HP`,
      };
      state.attackTargetId = enemy.id;
      state.miningTargetId = null;
      // Double-click also starts attacking
      state.isAttacking = true;
      bump();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 || state.dockedAt) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    state.cameraTarget = {
      x: state.player.pos.x + (cx - rect.width / 2) / state.cameraZoom,
      y: state.player.pos.y + (cy - rect.height / 2) / state.cameraZoom,
    };
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    state.cameraZoom = Math.max(0.4, Math.min(2.5, state.cameraZoom + delta));
    bump();
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 w-full h-full"
      style={{ cursor: "crosshair", display: "block" }}
    />
  );
}

function Notifications() {
  const items = useGame((s) => s.notifications);
  return (
    <div className="absolute flex flex-col items-start gap-1 pointer-events-none z-40" style={{ bottom: 80, left: 12 }}>
      {items.slice(-4).map((n) => (
        <div
          key={n.id}
          className="panel px-3 py-1.5 text-[14px] font-bold tracking-widest"
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

function AmmoHud() {
  const docked = useGame((s) => s.dockedAt);
  const player = useGame((s) => s.player);
  useGame((s) => s.tick);

  if (docked) return null;

  const weaponIds = getAmmoWeaponIds();
  if (weaponIds.length === 0) return null;

  const activeType = getActiveAmmoType();
  const typeDef = ROCKET_AMMO_TYPE_DEFS[activeType];
  const ammoMax = rocketAmmoMax();
  const cur = getAmmoCount(activeType);
  const pct = ammoMax > 0 ? cur / ammoMax : 0;
  const isEmpty = cur === 0;
  const isLow = cur > 0 && cur <= 10;
  const barColor = isEmpty || isLow ? "#ff5c6c" : typeDef.color;

  const handleClick = () => {
    state.hangarTab = "loadout";
    bump();
  };

  return (
    <div className="absolute z-30" style={{ bottom: 56, right: 12 }}>
      <div
        className="panel px-2 py-1"
        style={{
          borderColor: barColor,
          boxShadow: (isEmpty || isLow) ? `0 0 8px ${barColor}66` : undefined,
          minWidth: 148,
          cursor: "pointer",
          animation: isLow ? "hud-pulse 1s ease-in-out infinite" : undefined,
        }}
        title="Click to go to Ammo tab when docked"
        onClick={handleClick}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-[9px] tracking-widest truncate" style={{ color: typeDef.color }}>
            {typeDef.glyph} {typeDef.shortName} AMMO
          </div>
          <div className="text-[10px] font-bold tabular-nums" style={{ color: barColor }}>
            {isEmpty ? "EMPTY" : isLow ? `${cur} LOW` : cur}
            <span className="text-mute text-[8px]">/{ammoMax}</span>
          </div>
        </div>
        <div className="mt-0.5 h-1" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full"
            style={{ width: `${pct * 100}%`, background: barColor, transition: "width 0.2s" }}
          />
        </div>
      </div>
    </div>
  );
}

function Title() {
  return (
    <div className="absolute bottom-3 left-3 z-30 pointer-events-none">
      <div className="text-cyan glow-cyan text-[10px] tracking-[0.3em]">COSMIC REALM</div>
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

function GameApp() {
  // Send position to server every 100ms for other players
  useEffect(() => {
    const id = setInterval(() => {
      sendPosition(
        state.player.pos.x,
        state.player.pos.y,
        state.player.vel.x,
        state.player.vel.y,
        state.player.angle
      );
    }, 100);
    return () => clearInterval(id);
  }, []);

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
        state.showFullZoneMap = !state.showFullZoneMap; bump();
      } else if (e.key === "+" || e.key === "=") {
        state.minimapScale = Math.min(3, state.minimapScale + 0.25); bump();
      } else if (e.key === "-" || e.key === "_") {
        state.minimapScale = Math.max(0.5, state.minimapScale - 0.25); bump();
      } else if (e.key === "c" || e.key === "C") {
        state.showClan = !state.showClan; bump();
      } else if (e.key === "h" || e.key === "H") {
        state.showSocial = !state.showSocial; bump();
      } else if (e.key === "Escape") {
        state.showMap = false;
        state.showClan = false;
        state.showAmmoSelector = false;
        state.showFullZoneMap = false;
        bump();
      } else if (e.key === "1") {
        if (!state.dockedAt) {
          if (state.selectedWorldTarget?.kind === "enemy") {
            state.isAttacking = !state.isAttacking;
            bump();
          }
        }
      } else if (e.key >= "2" && e.key <= "9") {
        if (!state.dockedAt) {
          useConsumable(parseInt(e.key) - 2);
        }
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
      <button
        onClick={() => { clearToken(); disconnectSocket(); window.location.reload(); }}
        style={{
          position: "fixed", top: 8, right: 8, zIndex: 60,
          background: "rgba(255,60,80,0.12)", border: "1px solid #ff3b4d55",
          color: "#ff8a9a", fontSize: 10, letterSpacing: "0.12em",
          padding: "3px 10px", borderRadius: 4, cursor: "pointer",
          fontFamily: "'Courier New', monospace",
        }}
      >
        LOGOUT
      </button>
      <div className="crt-overlay" />
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    getPlayer()
      .then((data) => {
        loadServerPlayer(data.player);
        connectSocket(localStorage.getItem("cosmic-token")!);
        setAuthed(true);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", background: "#020408", color: "#4ee2ff",
        fontSize: 14, letterSpacing: 4,
      }}>
        CONNECTING...
      </div>
    );
  }

  if (!authed) {
    return (
      <AuthScreen
        onAuth={(playerData) => {
          loadServerPlayer(playerData);
          connectSocket(localStorage.getItem("cosmic-token")!);
          setAuthed(true);
        }}
      />
    );
  }

  return <GameApp />;
}
