import { useState } from "react";
import { useGame, state, bump, save, pushNotification, maxDroneSlots, cargoCapacity } from "../game/store";
import { EXP_FOR_LEVEL, FACTIONS, MODULE_DEFS, SHIP_CLASSES, ZONES, rankFor, HONOR_RANKS, DRONE_DEFS, RESOURCES } from "../game/types";
import { effectiveStats } from "../game/loop";
import { setMuted, getMuted, setVolume, getVolume } from "../game/sound";

export function TopBar() {
  const player = useGame((s) => s.player);
  const cls = SHIP_CLASSES[player.shipClass];
  const es = effectiveStats();
  const shieldMax = es.shieldMax;
  const hullMax = es.hullMax;
  const expNeeded = EXP_FOR_LEVEL(player.level);
  const zone = ZONES[player.zone];
  const rank = rankFor(player.honor);
  const nextRank = HONOR_RANKS.find((r) => r.minHonor > player.honor);

  const cargoUsed = player.cargo.reduce((a, c) => a + c.qty, 0);

  return (
    <div className="absolute top-2 left-2 right-2 z-30 flex items-center gap-2 pointer-events-none">
      {/* Player identity + rank */}
      <div className="panel pointer-events-auto flex items-center gap-2 px-3 py-1.5">
        <RankBadge rank={rank} />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-bright text-[16px] font-bold tracking-widest">{player.name}</span>
            <span className="text-amber font-bold text-[16px]">Lv {player.level}</span>
            {player.skillPoints > 0 && (
              <span
                className="text-[14px] font-bold px-1"
                style={{ color: "#ff5cf0", border: "1px solid #ff5cf0", boxShadow: "0 0 4px #ff5cf088", animation: "pulse-glow 1.5s ease-in-out infinite" }}
              >
                +{player.skillPoints} SP
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[13px] text-mute tracking-widest">
            <span style={{ color: rank.color }}>{rank.name.toUpperCase()}</span>
            <span>·</span>
            <span>{cls.name}</span>
            {player.faction && (
              <>
                <span>·</span>
                <span style={{ color: FACTIONS[player.faction].color }}>
                  ◆ [{FACTIONS[player.faction].tag}]
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* HULL/SHIELD micro bars */}
      <div className="panel pointer-events-auto px-3 py-2" style={{ minWidth: 165 }}>
        <MicroBar label="HUL" value={player.hull} max={hullMax} color="#5cff8a" />
        <MicroBar label="SHD" value={player.shield} max={shieldMax} color="#4ee2ff" />
      </div>

      {/* EXP bar */}
      <div className="panel pointer-events-auto px-3 py-2" style={{ minWidth: 165 }}>
        <MicroBar label="XP" value={player.exp} max={expNeeded} color="#ff5cf0" />
        <MicroBar label="HNR" value={player.honor - rank.minHonor} max={(nextRank?.minHonor ?? rank.minHonor + 1000) - rank.minHonor} color={rank.color} />
      </div>

      {/* Numbers */}
      <div className="panel pointer-events-auto flex items-center gap-3 px-3 py-2 text-[15px] tracking-widest">
        <Stat label="CR" value={player.credits.toLocaleString()} color="#ffd24a" />
        <Stat label="HONOR" value={player.honor.toLocaleString()} color={rank.color} />
        <Stat label="CARGO [J]" value={`${cargoUsed}/${cargoCapacity()}`} color="#4ee2ff" />
        <Stat label="DRONES" value={`${player.drones.length}/${maxDroneSlots()}`} color="#aaff5c" />
      </div>

      {/* Sector chip */}
      <div className="panel pointer-events-auto px-3 py-1.5 text-right">
        <div className="text-[13px] text-mute tracking-widest">SECTOR</div>
        <div className="text-cyan glow-cyan text-[16px] font-bold tracking-widest">
          {zone.name.toUpperCase()}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="pointer-events-auto flex gap-1">
        <AudioToggle />
        <button
          className="btn"
          style={{ padding: "5px 10px", fontSize: 15 }}
          onClick={() => { state.showMap = !state.showMap; bump(); }}
          title="Galaxy Map (M)"
        >
          ★ Map
        </button>
        <button
          className="btn"
          style={{ padding: "5px 10px", fontSize: 15 }}
          onClick={() => { state.showSocial = !state.showSocial; bump(); }}
          title="Social"
        >
          ☷ Social
        </button>
        <button
          className="btn"
          style={{ padding: "5px 10px", fontSize: 15 }}
          onClick={() => { state.showClan = !state.showClan; bump(); }}
          title="Clan (C)"
        >
          ⚑ Clan
        </button>
      </div>
    </div>
  );
}

export function WorldTargetHud() {
  const target = useGame((s) => s.selectedWorldTarget);
  const enemies = useGame((s) => s.enemies);
  const asteroids = useGame((s) => s.asteroids);
  if (!target) return null;
  const entity = target.kind === "enemy"
    ? enemies.find((e) => e.id === target.id)
    : asteroids.find((a) => a.id === target.id);
  const hp = entity ? ("hull" in entity ? entity.hull : entity.hp) : 0;
  const hpMax = entity ? ("hullMax" in entity ? entity.hullMax : entity.hpMax) : 1;
  const hpPct = Math.max(0, Math.min(100, (hp / Math.max(1, hpMax)) * 100));
  const hpColor = target.kind === "enemy" ? "#ff5c6c" : "#c69060";
  return (
    <div
      className="panel pointer-events-none"
      style={{
        position: "fixed",
        left: 14,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 35,
        minWidth: 180,
        maxWidth: 240,
        padding: "8px 10px",
      }}
    >
      <div className="text-[13px] tracking-widest text-mute">TARGET</div>
      <div className="text-[15px] font-bold" style={{ color: hpColor }}>
        {target.name}
      </div>
      <div className="text-[13px] text-dim mt-1 mb-2">{target.detail}</div>
      {entity && (
        <div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] tracking-widest text-mute w-6">HP</span>
            <div className="flex-1 h-[8px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full" style={{
                width: hpPct + "%",
                background: `linear-gradient(90deg, ${hpColor}66, ${hpColor})`,
                boxShadow: "0 0 4px " + hpColor,
                transition: "width 0.15s ease-out",
              }} />
            </div>
            <span className="text-[11px] w-16 text-right tabular-nums" style={{ color: hpColor }}>
              {Math.round(hp)}/{Math.round(hpMax)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MicroBar({
  label, value, max, color,
}: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="flex items-center gap-1 mb-0.5">
      <span className="text-[13px] w-9 tracking-widest" style={{ color: "#ffffff" }}>{label}</span>
      <div className="bar flex-1" style={{ height: 12 }}>
        <div className="bar-fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            boxShadow: `0 0 4px ${color}`,
            transition: "width 0.2s ease-out",
          }}
        />
      </div>
      <span className="text-[13px] w-14 text-right tabular-nums" style={{ color }}>
        {Math.round(value)}/{Math.round(max)}
      </span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[13px]" style={{ color: "#ffffff" }}>{label}</div>
      <div className="font-bold text-[16px] tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function AudioToggle() {
  const [muted, setMutedState] = useState(getMuted());
  const [vol, setVol] = useState(getVolume());
  return (
    <div className="panel pointer-events-auto flex items-center gap-1 px-2 py-1" title="Audio">
      <button
        className="btn"
        style={{ padding: "2px 6px", fontSize: 15 }}
        onClick={() => { const m = !muted; setMuted(m); setMutedState(m); }}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <input
        type="range" min={0} max={1} step={0.05} value={vol}
        onChange={(e) => { const v = +e.target.value; setVol(v); setVolume(v); }}
        style={{ width: 50 }}
      />
    </div>
  );
}

export function RankBadge({ rank }: { rank: { color: string; symbol: string; pips: number; name: string } }) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        width: 40, height: 40,
        background: `${rank.color}22`,
        border: `1px solid ${rank.color}`,
        boxShadow: `0 0 6px ${rank.color}66`,
      }}
      title={rank.name}
    >
      <div style={{ color: rank.color, fontSize: 19, lineHeight: 1, textShadow: `0 0 4px ${rank.color}` }}>
        {rank.symbol}
      </div>
      <div className="flex gap-[1px] mt-[1px]">
        {Array.from({ length: rank.pips }).map((_, i) => (
          <div key={i} style={{ width: 3, height: 3, background: rank.color }} />
        ))}
      </div>
    </div>
  );
}
