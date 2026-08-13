import { useGame, state } from "../game/store";

// Boss HP bars — world-anchored: one floating plate ABOVE each living boss
// (name + recessed HP track), tracking the ship through the same camera
// math the renderer uses (screen = (world - playerPos - cameraOffset) *
// zoom + screenCenter). Replaces the old fixed top-center single bar at
// explicit user direction. The Pixi renderer's own mini boss bar and boss
// name text are suppressed (pixi-renderer-v2-integrated.ts) so this is the
// one source of boss identity/health over the hull. Re-renders every tick
// (same cadence the old bar already used), pointer-events none throughout.
//
// Mounted in App.tsx directly after <GameCanvas>, BEFORE the HUD wrapper
// (zIndex:10) — this component belongs to the world layer, not the HUD, so
// it must render (and stack) beneath every fixed HUD panel. Do not move
// this back inside the HUD wrapper: a boss drifting under the Hotbar's
// vitals track (or any other panel) would render on top of it again.
export function BossBar() {
  useGame((s) => s.tick);
  const enemies = useGame((s) => s.enemies);
  const docked = useGame((s) => s.dockedAt);
  if (docked) return null;

  // The world canvas is fullscreen, so CSS viewport size == renderer screen
  // size — no import from the pixi module needed (importing that module
  // here changes its evaluation order and breaks its ?instance= imports).
  const screen = { w: window.innerWidth, h: window.innerHeight };
  const zoom = state.cameraZoom;
  // cameraOffset only exists once the docking flow has initialized it
  const off = state.cameraOffset ?? { x: 0, y: 0 };
  const camX = state.player.pos.x + off.x;
  const camY = state.player.pos.y + off.y;

  const bars = [];
  for (const e of enemies) {
    if (!e.isBoss || e.hull <= 0) continue;
    const sx = (e.pos.x - camX) * zoom + screen.w / 2;
    const sy = (e.pos.y - camY) * zoom + screen.h / 2;
    // off-screen cull (margin covers the bar's own width/height)
    if (sx < -220 || sx > screen.w + 220 || sy < -160 || sy > screen.h + 160) continue;
    const pct = Math.max(0, Math.min(100, (e.hull / Math.max(1, e.hullMax)) * 100));
    // clear the hull silhouette: ship radius in screen px + fixed clearance
    const lift = e.size * zoom + 34;
    bars.push(
      <div
        key={e.id}
        className="pointer-events-none"
        style={{ position: "fixed", left: sx, top: sy - lift, transform: "translate(-50%, -100%)", width: 232, zIndex: 2 }}
      >
        <div
          className="text-center font-bold truncate"
          style={{
            color: "var(--hud-gold)", fontSize: 12.5, letterSpacing: "0.18em",
            fontFamily: "var(--font-display)", textShadow: "0 0 10px rgba(232,185,77,0.4), 0 1px 2px #000",
            marginBottom: 2,
          }}
        >
          ◆ {(e.name || "DREADNOUGHT").toUpperCase()} ◆
        </div>
        {/* Same frosted .panel + recessed red track as the old bar, sized
            down to an overhead plate. */}
        <div className="panel" style={{ position: "relative", padding: "4px 7px 5px" }}>
          <div
            style={{
              position: "relative",
              height: 11,
              background: "rgba(5, 9, 18, 0.85)",
              border: "1px solid rgba(90, 130, 180, 0.35)",
              boxShadow: "inset 0 2px 5px rgba(0,0,0,0.6)",
              clipPath: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct}%`, height: "100%",
                background: "linear-gradient(180deg, #ff8a6a 0%, #ff3b4d 50%, #8f1622 100%)",
                boxShadow: "0 0 10px #ff3b4daa",
                transition: "width 0.2s ease-out",
              }}
            />
            <div
              className="absolute inset-0 flex items-center justify-center tabular-nums font-bold"
              style={{ fontSize: 9.5, color: "#fff", textShadow: "0 1px 2px #000, 0 0 6px #000", letterSpacing: "0.06em" }}
            >
              {Math.round(e.hull)} / {Math.round(e.hullMax)}
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!bars.length) return null;
  return <>{bars}</>;
}
