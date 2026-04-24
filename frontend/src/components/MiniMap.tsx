import { useGame, state, bump } from "../game/store";
import { DUNGEONS, STATIONS, PORTALS } from "../game/types";

const SIZE = 130;
const RANGE = 1800;

export function MiniMap() {
  const player = useGame((s) => s.player);
  const enemies = useGame((s) => s.enemies);
  const others = useGame((s) => s.others);
  const asteroids = useGame((s) => s.asteroids);
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

        {/* Asteroids */}
        {asteroids.map((a) => {
          if (a.zone !== player.zone) return null;
          const x = SIZE / 2 + (a.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (a.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return <rect key={a.id} x={x - 1} y={y - 1} width={2} height={2} fill={a.yields === "lumenite" ? "#7ad8ff" : "#a8784a"} />;
        })}

        {/* Stations */}
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

        {/* Portals */}
        {PORTALS.filter((p) => p.fromZone === player.zone).map((p) => {
          const x = SIZE / 2 + (p.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (p.pos.y - player.pos.y) * scale;
          const inside = !(x < 0 || x > SIZE || y < 0 || y > SIZE);
          const cx = Math.max(6, Math.min(SIZE - 6, x));
          const cy = Math.max(6, Math.min(SIZE - 6, y));
          return <circle key={p.id} cx={cx} cy={cy} r={inside ? 3 : 2} fill="#ff5cf0" stroke={inside ? "#fff" : "none"} strokeWidth={0.5} />;
        })}

        {/* Dungeon rifts */}
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

        {/* Others */}
        {others.map((o) => {
          const x = SIZE / 2 + (o.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (o.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return <rect key={o.id} x={x - 1} y={y - 1} width={2} height={2} fill="#8a9ac8" />;
        })}

        {/* Enemies */}
        {enemies.map((e) => {
          const x = SIZE / 2 + (e.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (e.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return <rect key={e.id} x={x - 1.5} y={y - 1.5} width={3} height={3} fill="#ff5c6c" />;
        })}

        {/* Player at center */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={3} fill="#4ee2ff" stroke="#fff" strokeWidth={0.5} />
      </svg>
      <div className="text-mute text-[8px] tracking-widest text-center mt-0.5">CLICK · WARP</div>
    </div>
  );
}
