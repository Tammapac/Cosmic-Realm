import { useEffect, useRef } from "react";
import { state, bump, useGame, save, pushNotification } from "./game/store";
import { startLoop, stopLoop, checkPortal, checkStationDock } from "./game/loop";
import { render } from "./game/render";
import { HUD } from "./components/HUD";
import { Hangar } from "./components/Hangar";
import { SocialPanel, ClanPanel, GalaxyMap } from "./components/SocialPanel";

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

  // Click to set move target
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (state.dockedAt) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const wx = state.player.pos.x + (cx - rect.width / 2);
    const wy = state.player.pos.y + (cy - rect.height / 2);
    state.cameraTarget = { x: wx, y: wy };

    // Check station dock click
    const stationId = nearestInteractable(wx, wy);
    if (stationId) {
      // pull toward station
      const station = STATIONS_FOR.find((s) => s.id === stationId)!;
      state.cameraTarget = { x: station.pos.x, y: station.pos.y };
    }
    bump();
  };

  // Mouse move target while right-button held? Simpler: support mousedown drag for continuous follow
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

import { STATIONS as STATIONS_FOR, PORTALS as PORTALS_FOR, ZONES as ZONES_FOR } from "./game/types";
import { travelToZone } from "./game/store";

function nearestInteractable(x: number, y: number): string | null {
  for (const s of STATIONS_FOR) {
    if (s.zone !== state.player.zone) continue;
    const d = Math.hypot(s.pos.x - x, s.pos.y - y);
    if (d < 50) return s.id;
  }
  return null;
}

function Notifications() {
  const items = useGame((s) => s.notifications);
  return (
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-40">
      {items.map((n) => (
        <div
          key={n.id}
          className="panel px-4 py-2 text-sm font-bold tracking-widest"
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

function DockPrompt() {
  const player = useGame((s) => s.player);
  useGame((s) => s.tick);

  const station = STATIONS_FOR.find(
    (s) => s.zone === player.zone && Math.hypot(s.pos.x - player.pos.x, s.pos.y - player.pos.y) < 90
  );
  const portal = PORTALS_FOR.find(
    (po) => po.fromZone === player.zone && Math.hypot(po.pos.x - player.pos.x, po.pos.y - player.pos.y) < 70
  );

  if (!station && !portal) return null;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40">
      {station && !state.dockedAt && (
        <button
          className="btn btn-primary text-base px-6 py-3"
          style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
          onClick={() => {
            state.dockedAt = station.id;
            state.player.vel = { x: 0, y: 0 };
            pushNotification(`Docking with ${station.name}`, "good");
            save();
            bump();
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
            const z = ZONES_FOR[portal.toZone];
            if (player.level < z.unlockLevel) {
              pushNotification(`Need level ${z.unlockLevel} to enter ${z.name}`, "bad");
              return;
            }
            travelToZone(portal.toZone);
          }}
        >
          ▶ WARP TO {ZONES_FOR[portal.toZone].name.toUpperCase()}
        </button>
      )}
    </div>
  );
}

function Title() {
  return (
    <div className="absolute bottom-3 left-3 z-30 pointer-events-none">
      <div className="text-cyan glow-cyan text-[10px] tracking-[0.3em]">STELLAR FRONTIER</div>
      <div className="text-mute text-[9px] tracking-widest">v 1.0 · CLICK to move · DOCK at stations · WARP via portals</div>
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
          save();
          bump();
        }
      } else if (e.key === "m" || e.key === "M") {
        state.showMap = !state.showMap;
        bump();
      } else if (e.key === "c" || e.key === "C") {
        state.showClan = !state.showClan;
        bump();
      } else if (e.key === "Escape") {
        state.showMap = false;
        state.showClan = false;
        bump();
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

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#02040c" }}>
      <GameCanvas />
      <HUD />
      <DockPrompt />
      <Notifications />
      <SocialPanel />
      <ClanPanel />
      <GalaxyMap />
      <Title />
      {docked && <Hangar stationId={docked} />}
      <div className="crt-overlay" />
    </div>
  );
}
