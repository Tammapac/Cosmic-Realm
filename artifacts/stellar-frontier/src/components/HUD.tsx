import { useGame, state, bump, save, pushNotification } from "../game/store";
import { EXP_FOR_LEVEL, SHIP_CLASSES, ZONES } from "../game/types";

export function HUD() {
  const player = useGame((s) => s.player);
  const cls = SHIP_CLASSES[player.shipClass];
  const shieldMax = cls.shieldMax + player.equipment.shieldTier * 25;
  const expNeeded = EXP_FOR_LEVEL(player.level);
  const zone = ZONES[player.zone];

  return (
    <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
      {/* Left: stats */}
      <div className="panel p-3 pointer-events-auto" style={{ width: 280 }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-cyan glow-cyan text-sm font-bold tracking-widest">{player.name}</div>
            <div className="text-mute text-[10px]">{cls.name}</div>
          </div>
          <div className="text-right">
            <div className="text-amber glow-amber text-xl font-bold">LV {player.level}</div>
          </div>
        </div>
        <Stat label="HULL" value={player.hull} max={cls.hullMax} color="#5cff8a" />
        <Stat label="SHIELD" value={player.shield} max={shieldMax} color="#4ee2ff" />
        <Stat label="EXP" value={player.exp} max={expNeeded} color="#ff5cf0" />
        <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
          <div>
            <div className="text-mute">CREDITS</div>
            <div className="text-amber font-bold">{player.credits.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-mute">HONOR</div>
            <div className="text-magenta font-bold">{player.honor}</div>
          </div>
          <div>
            <div className="text-mute">CARGO</div>
            <div className="text-cyan font-bold">
              {player.cargo.reduce((a, c) => a + c.qty, 0)}/{cls.cargoMax}
            </div>
          </div>
        </div>
      </div>

      {/* Right: zone, minimap, buttons */}
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        <div className="panel px-4 py-2 text-right">
          <div className="text-mute text-[10px]">SECTOR</div>
          <div className="text-cyan glow-cyan text-sm font-bold tracking-widest">{zone.name.toUpperCase()}</div>
          <div className="text-mute text-[9px]">TIER {zone.enemyTier}</div>
        </div>
        <Minimap />
        <div className="flex gap-2">
          <button
            className="btn"
            onClick={() => {
              state.showMap = !state.showMap;
              bump();
            }}
          >
            ★ Galaxy Map
          </button>
          <button
            className="btn"
            onClick={() => {
              state.showClan = !state.showClan;
              bump();
            }}
          >
            ⚑ Clan
          </button>
          <button
            className="btn btn-amber"
            onClick={() => {
              save();
              pushNotification("Game saved", "good");
            }}
          >
            ♥ Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[9px] tracking-widest">
        <span className="text-mute">{label}</span>
        <span style={{ color }}>
          {Math.round(value)}/{Math.round(max)}
        </span>
      </div>
      <div className="bar">
        <div
          className="bar-fill"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}

function Minimap() {
  const player = useGame((s) => s.player);
  const enemies = useGame((s) => s.enemies);
  const others = useGame((s) => s.others);
  const size = 160;
  const range = 1800;
  const scale = size / (range * 2);

  return (
    <div className="panel" style={{ width: size, height: size, padding: 0 }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0">
          <defs>
            <radialGradient id="mm-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0a1230" />
              <stop offset="100%" stopColor="#02040c" />
            </radialGradient>
          </defs>
          <rect width={size} height={size} fill="url(#mm-bg)" />
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill="none" stroke="#1a2348" strokeDasharray="2 4" />
          <line x1={size / 2} y1={4} x2={size / 2} y2={size - 4} stroke="#1a2348" />
          <line x1={4} y1={size / 2} x2={size - 4} y2={size / 2} stroke="#1a2348" />
          {/* Stations */}
          {STATIONS_RENDER(player.zone, player.pos, scale, size)}
          {/* Portals */}
          {PORTALS_RENDER(player.zone, player.pos, scale, size)}
          {/* Others */}
          {others.map((o) => {
            const x = size / 2 + (o.pos.x - player.pos.x) * scale;
            const y = size / 2 + (o.pos.y - player.pos.y) * scale;
            if (x < 0 || x > size || y < 0 || y > size) return null;
            return <rect key={o.id} x={x - 1.5} y={y - 1.5} width={3} height={3} fill="#8a9ac8" />;
          })}
          {/* Enemies */}
          {enemies.map((e) => {
            const x = size / 2 + (e.pos.x - player.pos.x) * scale;
            const y = size / 2 + (e.pos.y - player.pos.y) * scale;
            if (x < 0 || x > size || y < 0 || y > size) return null;
            return <rect key={e.id} x={x - 2} y={y - 2} width={4} height={4} fill="#ff5c6c" />;
          })}
          {/* Player */}
          <circle cx={size / 2} cy={size / 2} r={4} fill="#4ee2ff" />
        </svg>
        <div className="absolute top-1 left-2 text-mute text-[9px] tracking-widest">RADAR</div>
      </div>
    </div>
  );
}

import { STATIONS, PORTALS, ZONES as Z } from "../game/types";

function STATIONS_RENDER(zone: string, ppos: { x: number; y: number }, scale: number, size: number) {
  return STATIONS.filter((s) => s.zone === zone).map((s) => {
    const x = size / 2 + (s.pos.x - ppos.x) * scale;
    const y = size / 2 + (s.pos.y - ppos.y) * scale;
    if (x < 0 || x > size || y < 0 || y > size) return null;
    return <rect key={s.id} x={x - 3} y={y - 3} width={6} height={6} fill="#4ee2ff" stroke="#fff" strokeWidth={0.5} />;
  });
}

function PORTALS_RENDER(zone: string, ppos: { x: number; y: number }, scale: number, size: number) {
  return PORTALS.filter((p) => p.fromZone === zone).map((p) => {
    const x = size / 2 + (p.pos.x - ppos.x) * scale;
    const y = size / 2 + (p.pos.y - ppos.y) * scale;
    if (x < 0 || x > size || y < 0 || y > size) {
      // edge marker
      const cx = Math.max(6, Math.min(size - 6, x));
      const cy = Math.max(6, Math.min(size - 6, y));
      return <circle key={p.id} cx={cx} cy={cy} r={2} fill="#ff5cf0" />;
    }
    return <circle key={p.id} cx={x} cy={y} r={3} fill="#ff5cf0" stroke="#fff" strokeWidth={0.5} />;
  });
}

void Z;
