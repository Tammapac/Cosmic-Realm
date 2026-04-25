import { useGame, state, bump } from "../game/store";
import { DUNGEONS, MAP_RADIUS, STATIONS, PORTALS, ZONES } from "../game/types";

const BASE_SIZE = 130;
const BASE_RANGE = 1800;

export function MiniMap() {
  const player = useGame((s) => s.player);
  const enemies = useGame((s) => s.enemies);
  const others = useGame((s) => s.others);
  const asteroids = useGame((s) => s.asteroids);
  const cargoBoxes = useGame((s) => s.cargoBoxes);
  const minimapScale = useGame((s) => s.minimapScale);
  const showFull = useGame((s) => s.showFullZoneMap);
  const docked = useGame((s) => s.dockedAt);

  if (docked) return null;

  const SIZE = Math.round(BASE_SIZE * minimapScale);
  const RANGE = BASE_RANGE;
  const scale = SIZE / (RANGE * 2);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (state.dockedAt) return;
    const rect = (e.target as SVGSVGElement).getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dx = (cx - SIZE / 2) / scale;
    const dy = (cy - SIZE / 2) / scale;
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
      const rect = (e.target as SVGSVGElement).getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const wx = (cx - fullSize / 2) / fullScale;
      const wy = (cy - fullSize / 2) / fullScale;
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
        <div className="panel" style={{ padding: 8 }}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] tracking-widest" style={{ color: "#4ee2ff" }}>
              ◈ {zone?.name ?? player.zone.toUpperCase()} — FULL MAP
            </div>
            <div
              className="text-[10px] cursor-pointer"
              style={{ color: "#667" }}
              onClick={() => { state.showFullZoneMap = false; bump(); }}
            >
              [ESC]
            </div>
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
            <line x1={fullSize / 2} y1={4} x2={fullSize / 2} y2={fullSize - 4} stroke="#1a234844" />
            <line x1={4} y1={fullSize / 2} x2={fullSize - 4} y2={fullSize / 2} stroke="#1a234844" />

            {asteroids.filter(a => a.zone === player.zone).map((a) => {
              const x = fullSize / 2 + a.pos.x * fullScale;
              const y = fullSize / 2 + a.pos.y * fullScale;
              if (x < 0 || x > fullSize || y < 0 || y > fullSize) return null;
              return <rect key={a.id} x={x - 1.5} y={y - 1.5} width={3} height={3} fill={a.yields === "lumenite" ? "#7ad8ff" : "#a8784a"} opacity={0.6} />;
            })}

            {STATIONS.filter(s => s.zone === player.zone).map((s) => {
              const x = fullSize / 2 + s.pos.x * fullScale;
              const y = fullSize / 2 + s.pos.y * fullScale;
              return (
                <g key={s.id}>
                  <rect x={x - 5} y={y - 5} width={10} height={10} fill="#4ee2ff" stroke="#fff" strokeWidth={0.5} />
                  <text x={x} y={y + 16} fill="#4ee2ff" fontSize={8} textAnchor="middle">{s.name}</text>
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
          <div className="text-mute text-[8px] tracking-widest text-center mt-1">CLICK TO WARP · M TO CLOSE · +/- RESIZE MINIMAP</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="panel pointer-events-auto"
      style={{
        position: "absolute",
        top: 60,
        right: 8,
        width: SIZE + 4,
        padding: 2,
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        onClick={handleClick}
        style={{ cursor: "crosshair", display: "block" }}
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
          return <rect key={a.id} x={x - 1} y={y - 1} width={2} height={2} fill={a.yields === "lumenite" ? "#7ad8ff" : "#a8784a"} />;
        })}

        {STATIONS.filter((s) => s.zone === player.zone).map((s) => {
          const x = SIZE / 2 + (s.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (s.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return (
            <g key={s.id}>
              <rect x={x - 3} y={y - 3} width={6} height={6} fill="#4ee2ff" stroke="#fff" strokeWidth={0.5} />
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
      <div className="text-mute text-[8px] tracking-widest text-center mt-0.5">CLICK WARP · M FULL MAP · +/- SIZE</div>
    </div>
  );
}
