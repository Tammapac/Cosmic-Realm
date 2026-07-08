import { useGame, useGameSlow, state, bump } from "../game/store";
import { GameButton } from "./GameButton";
import { DUNGEONS, MAP_RADIUS, STATIONS, PORTALS, ZONES, RESOURCES, ASTEROID_BELTS, } from "../game/types";

const BASE_SIZE = 110;
const BASE_RANGE = 1800;

export function MiniMap() {
  // Player + minimap-scale + show-full stay on the fast tick (they change on
  // input). The heavy list arrays subscribe to the 5 Hz slow tick — MiniMap
  // draws 40+ SVG elements per render, and 5 Hz is plenty for a radar.
  const player = useGame((s) => s.player);
  const minimapScale = useGame((s) => s.minimapScale);
  const showFull = useGame((s) => s.showFullZoneMap);
  const docked = useGame((s) => s.dockedAt);
  const enemies = useGameSlow((s) => s.enemies);
  const others = useGameSlow((s) => s.others);
  const npcShips = useGameSlow((s) => s.npcShips);
  const asteroids = useGameSlow((s) => s.asteroids);
  const cargoBoxes = useGameSlow((s) => s.cargoBoxes);

  if (docked) return null;

  const SIZE = Math.round(BASE_SIZE * minimapScale);
  const RANGE = BASE_RANGE;
  const scale = SIZE / (RANGE * 2);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (state.dockedAt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const dx = (rx - 0.5) * RANGE * 2;
    const dy = (ry - 0.5) * RANGE * 2;
    state.cameraTarget = {
      x: state.player.pos.x + dx,
      y: state.player.pos.y + dy,
    };
    bump();
  };

  const zone = ZONES[player.zone];
  const zoneRadius = MAP_RADIUS;

  if (showFull) {
    const fullSize = 500;
    const fullScale = fullSize / (zoneRadius * 2.2);
    const handleFullClick = (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / rect.width;
      const ry = (e.clientY - rect.top) / rect.height;
      const wx = (rx - 0.5) * zoneRadius * 2.2;
      const wy = (ry - 0.5) * zoneRadius * 2.2;
      state.cameraTarget = { x: wx, y: wy };
      bump();
    };
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 55,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.75)",
          pointerEvents: "auto",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) { state.showFullZoneMap = false; bump(); }}}
      >
        <div
          className="panel panel-framed"
          style={{
            padding: 10,
            boxShadow: "0 0 30px rgba(78,226,255,0.12), inset 0 0 20px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="flex items-center justify-between mb-2"
            style={{ borderBottom: "1px solid rgba(78,226,255,0.08)", paddingBottom: 6 }}
          >
            <div
              className="font-bold tracking-widest glow-cyan"
              style={{ color: "#4ee2ff", fontSize: 12 }}
            >
              ◈ {zone?.name ?? player.zone.toUpperCase()} — ZONE MAP
            </div>
            <GameButton style={{ fontSize: 10 }} onClick={() => { state.showFullZoneMap = false; bump(); }}>ESC ✕</GameButton>
          </div>
          <svg width={fullSize} height={fullSize} onClick={handleFullClick} style={{ cursor: "crosshair", display: "block" }}>
            <defs>
              <radialGradient id="fm-bg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0a1230" />
                <stop offset="100%" stopColor="#02040c" />
              </radialGradient>
            </defs>
            <rect width={fullSize} height={fullSize} fill="url(#fm-bg)" rx={4} />
            <circle cx={fullSize / 2} cy={fullSize / 2} r={zoneRadius * fullScale} fill="none" stroke="#1a234866" strokeDasharray="4 6" />

            {(ASTEROID_BELTS[player.zone] ?? []).map((belt, i) => (
              <ellipse key={`belt-${i}`}
                cx={fullSize / 2 + belt.cx * fullScale}
                cy={fullSize / 2 + belt.cy * fullScale}
                rx={belt.rx * fullScale}
                ry={belt.ry * fullScale}
                fill="#a8784a11" stroke="#a8784a33" strokeDasharray="3 5" strokeWidth={1}
              />
            ))}
            <line x1={fullSize / 2} y1={4} x2={fullSize / 2} y2={fullSize - 4} stroke="#1a234844" />
            <line x1={4} y1={fullSize / 2} x2={fullSize - 4} y2={fullSize / 2} stroke="#1a234844" />

            {asteroids.filter(a => a.zone === player.zone).map((a) => {
              const x = fullSize / 2 + a.pos.x * fullScale;
              const y = fullSize / 2 + a.pos.y * fullScale;
              if (x < 0 || x > fullSize || y < 0 || y > fullSize) return null;
              return <rect key={a.id} x={x - 1.5} y={y - 1.5} width={3} height={3} fill={RESOURCES[a.yields]?.color ?? "#a8784a"} opacity={0.6} />;
            })}

            {STATIONS.filter(s => s.zone === player.zone).map((s) => {
              const x = fullSize / 2 + s.pos.x * fullScale;
              const y = fullSize / 2 + s.pos.y * fullScale;
              const isFactory = s.kind === "factory";
              const color = isFactory ? "#ff8844" : "#4ee2ff";
              return (
                <g key={s.id}>
                  {isFactory ? (
                    <polygon points={`${x},${y-6} ${x+6},${y} ${x},${y+6} ${x-6},${y}`} fill={color} stroke="#fff" strokeWidth={0.5} />
                  ) : (
                    <rect x={x - 5} y={y - 5} width={10} height={10} fill={color} stroke="#fff" strokeWidth={0.5} />
                  )}
                  <text x={x} y={y + 16} fill={color} fontSize={8} textAnchor="middle">{s.name}</text>
                </g>
              );
            })}

            {PORTALS.filter(p => p.fromZone === player.zone).map((p) => {
              const x = fullSize / 2 + p.pos.x * fullScale;
              const y = fullSize / 2 + p.pos.y * fullScale;
              return (
                <g key={p.id}>
                  <circle cx={x} cy={y} r={5} fill="#ff5cf0" stroke="#fff" strokeWidth={0.5} />
                  <text x={x} y={y + 14} fill="#ff5cf0" fontSize={7} textAnchor="middle">→{p.toZone}</text>
                </g>
              );
            })}

            {Object.values(DUNGEONS).filter(d => d.zone === player.zone).map((d) => {
              const x = fullSize / 2 + d.pos.x * fullScale;
              const y = fullSize / 2 + d.pos.y * fullScale;
              return (
                <polygon key={d.id}
                  points={`${x},${y - 6} ${x + 6},${y} ${x},${y + 6} ${x - 6},${y}`}
                  fill={d.color} stroke="#fff" strokeWidth={0.5} opacity={0.9}
                />
              );
            })}

            {others.map((o) => {
              const x = fullSize / 2 + o.pos.x * fullScale;
              const y = fullSize / 2 + o.pos.y * fullScale;
              if (x < 0 || x > fullSize || y < 0 || y > fullSize) return null;
              return <rect key={o.id} x={x - 2} y={y - 2} width={4} height={4} fill="#8a9ac8" />;
            })}

            {npcShips.map((n) => {
              const x = fullSize / 2 + n.pos.x * fullScale;
              const y = fullSize / 2 + n.pos.y * fullScale;
              if (x < 0 || x > fullSize || y < 0 || y > fullSize) return null;
              return <polygon key={n.id} points={`${x},${y - 3} ${x + 3},${y + 2} ${x - 3},${y + 2}`} fill={n.color} />;
            })}

            {enemies.map((e) => {
              const x = fullSize / 2 + e.pos.x * fullScale;
              const y = fullSize / 2 + e.pos.y * fullScale;
              if (x < 0 || x > fullSize || y < 0 || y > fullSize) return null;
              return <rect key={e.id} x={x - 2} y={y - 2} width={4} height={4} fill="#ff5c6c" />;
            })}

            {cargoBoxes.map((cb) => {
              const x = fullSize / 2 + cb.pos.x * fullScale;
              const y = fullSize / 2 + cb.pos.y * fullScale;
              if (x < 0 || x > fullSize || y < 0 || y > fullSize) return null;
              return <rect key={cb.id} x={x - 2} y={y - 2} width={4} height={4} fill={cb.color} />;
            })}

            <circle cx={fullSize / 2 + player.pos.x * fullScale} cy={fullSize / 2 + player.pos.y * fullScale} r={5} fill="#4ee2ff" stroke="#fff" strokeWidth={1} />
          </svg>
          <div
            className="tracking-widest text-center mt-2"
            style={{ color: "var(--text-mute)", fontSize: 9, letterSpacing: "0.18em" }}
          >
            CLICK MAP TO WARP · M TO CLOSE · +/− RESIZE MINIMAP
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto hud-chip chip-map"
      style={{
        position: "absolute",
        bottom: 8,
        right: 8,
        padding: 4,
      }}
    >
      {/* Sector readout (moved here from the top bar) */}
      <div
        className="flex items-center justify-between gap-2"
        style={{ marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid rgba(78,226,255,0.15)" }}
      >
        <span
          className="truncate"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 9,
            letterSpacing: "0.16em",
            color: "var(--accent-cyan)",
            textShadow: "0 0 6px rgba(78,226,255,0.5)",
            maxWidth: SIZE - 30,
          }}
        >
          ◈ {(zone?.name ?? player.zone).toUpperCase()}
        </span>
        <span
          className="shrink-0 tabular-nums"
          style={{ fontFamily: "var(--font-display)", fontSize: 8, color: "var(--text-mute)" }}
        >
          {(zone as any)?.label ?? ""} · {Math.round(player.pos.x / 100)}:{Math.round(player.pos.y / 100)}
        </span>
      </div>
      <div style={{ position: "relative", width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          onClick={handleClick}
          style={{ cursor: "crosshair", display: "block", borderRadius: 1 }}
        >
        <defs>
          <radialGradient id="mm-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0a1230" />
            <stop offset="100%" stopColor="#02040c" />
          </radialGradient>
        </defs>
        <rect width={SIZE} height={SIZE} fill="url(#mm-bg)" />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2 - 4} fill="none" stroke="#1a2348" strokeDasharray="2 4" />
        <line x1={SIZE / 2} y1={4} x2={SIZE / 2} y2={SIZE - 4} stroke="#1a2348" />
        <line x1={4} y1={SIZE / 2} x2={SIZE - 4} y2={SIZE / 2} stroke="#1a2348" />

        {asteroids.map((a) => {
          if (a.zone !== player.zone) return null;
          const x = SIZE / 2 + (a.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (a.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return <rect key={a.id} x={x - 1} y={y - 1} width={2} height={2} fill={RESOURCES[a.yields]?.color ?? "#a8784a"} />;
        })}

        {STATIONS.filter((s) => s.zone === player.zone).map((s) => {
          const x = SIZE / 2 + (s.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (s.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          const isFactory = s.kind === "factory";
          const color = isFactory ? "#ff8844" : "#4ee2ff";
          return (
            <g key={s.id}>
              {isFactory ? (
                <polygon points={`${x},${y-3} ${x+3},${y} ${x},${y+3} ${x-3},${y}`} fill={color} stroke="#fff" strokeWidth={0.5} />
              ) : (
                <rect x={x - 3} y={y - 3} width={6} height={6} fill={color} stroke="#fff" strokeWidth={0.5} />
              )}
            </g>
          );
        })}

        {PORTALS.filter((p) => p.fromZone === player.zone).map((p) => {
          const x = SIZE / 2 + (p.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (p.pos.y - player.pos.y) * scale;
          const inside = !(x < 0 || x > SIZE || y < 0 || y > SIZE);
          const cx = Math.max(6, Math.min(SIZE - 6, x));
          const cy = Math.max(6, Math.min(SIZE - 6, y));
          return <circle key={p.id} cx={cx} cy={cy} r={inside ? 3 : 2} fill="#ff5cf0" stroke={inside ? "#fff" : "none"} strokeWidth={0.5} />;
        })}

        {Object.values(DUNGEONS).filter((d) => d.zone === player.zone).map((d) => {
          const x = SIZE / 2 + (d.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (d.pos.y - player.pos.y) * scale;
          const cx = Math.max(6, Math.min(SIZE - 6, x));
          const cy = Math.max(6, Math.min(SIZE - 6, y));
          const inside = !(x < 0 || x > SIZE || y < 0 || y > SIZE);
          return (
            <polygon
              key={d.id}
              points={`${cx},${cy - 4} ${cx + 4},${cy} ${cx},${cy + 4} ${cx - 4},${cy}`}
              fill={d.color}
              stroke={inside ? "#fff" : "none"}
              strokeWidth={0.5}
              opacity={0.9}
            />
          );
        })}

        {others.map((o) => {
          const x = SIZE / 2 + (o.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (o.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return <rect key={o.id} x={x - 1} y={y - 1} width={2} height={2} fill="#8a9ac8" />;
        })}

        {npcShips.map((n) => {
          const x = SIZE / 2 + (n.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (n.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return <polygon key={n.id} points={`${x},${y - 2} ${x + 2},${y + 1} ${x - 2},${y + 1}`} fill={n.color} />;
        })}

        {enemies.map((e) => {
          const x = SIZE / 2 + (e.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (e.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return <rect key={e.id} x={x - 1.5} y={y - 1.5} width={3} height={3} fill="#ff5c6c" />;
        })}

        {cargoBoxes.map((cb) => {
          const x = SIZE / 2 + (cb.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (cb.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return <rect key={cb.id} x={x - 1.5} y={y - 1.5} width={3} height={3} fill={cb.color} />;
        })}

        <circle cx={SIZE / 2} cy={SIZE / 2} r={3} fill="#4ee2ff" stroke="#fff" strokeWidth={0.5} />
        </svg>
      </div>
      <div className="flex items-center justify-between gap-1 mt-1 px-0.5">
        <button
          className="leading-none transition-colors duration-150"
          style={{
            background: "rgba(78,226,255,0.08)",
            border: "1px solid rgba(78,226,255,0.2)",
            color: "#4ee2ff",
            cursor: "pointer",
            borderRadius: 2,
            fontSize: 11,
            padding: "1px 6px",
          }}
          onClick={(e) => { e.stopPropagation(); state.minimapScale = Math.max(0.5, state.minimapScale - 0.25); bump(); }}
        >−</button>
        <span
          className="tracking-widest select-none"
          style={{ color: "var(--text-mute)", fontSize: 8, letterSpacing: "0.2em" }}
        >
          M · MAP
        </span>
        <button
          className="leading-none transition-colors duration-150"
          style={{
            background: "rgba(78,226,255,0.08)",
            border: "1px solid rgba(78,226,255,0.2)",
            color: "#4ee2ff",
            cursor: "pointer",
            borderRadius: 2,
            fontSize: 11,
            padding: "1px 6px",
          }}
          onClick={(e) => { e.stopPropagation(); state.minimapScale = Math.min(3, state.minimapScale + 0.25); bump(); }}
        >+</button>
      </div>
    </div>
  );
}
