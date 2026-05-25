import { useState } from "react";
import { useGame, state, bump, maxDroneSlots, cargoCapacity } from "../game/store";
import { EXP_FOR_LEVEL, FACTIONS, SHIP_CLASSES, ZONES, rankFor, HONOR_RANKS } from "../game/types";
import { effectiveStats } from "../game/loop";
import { setMuted, getMuted, setVolume, getVolume } from "../game/sound";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
}

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
    <div className="absolute top-2 left-2 right-2 z-30 flex items-center gap-2 pointer-events-none flex-wrap">
      {/* Player identity + rank */}
      <div className="panel pointer-events-auto flex items-center gap-2.5 px-3 py-2" style={{ minWidth: 0, boxShadow: "0 0 16px rgba(78,226,255,0.08), inset 0 0 20px rgba(0,0,0,0.4)" }}>
        <RankBadge rank={rank} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="font-bold tracking-widest truncate"
              style={{ color: "#fff", fontSize: 14, maxWidth: 140 }}
            >
              {player.name}
            </span>
            <span
              className="font-bold shrink-0 tabular-nums"
              style={{ color: "var(--accent-amber)", fontSize: 13 }}
            >
              Lv{player.level}
            </span>
            {player.skillPoints > 0 && (
              <span
                className="shrink-0 font-bold tabular-nums"
                style={{
                  fontSize: 11,
                  color: "#ff5cf0",
                  border: "1px solid #ff5cf088",
                  padding: "0px 4px",
                  boxShadow: "0 0 4px #ff5cf088",
                  animation: "pulse-glow 1.5s ease-in-out infinite",
                  whiteSpace: "nowrap",
                }}
              >
                +{player.skillPoints} SP
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 min-w-0" style={{ fontSize: 11 }}>
            <span className="shrink-0 font-semibold tracking-widest" style={{ color: rank.color }}>
              {rank.name.toUpperCase()}
            </span>
            <span className="text-mute shrink-0">·</span>
            <span className="text-mute truncate" style={{ maxWidth: 80 }}>{cls.name}</span>
            {player.faction && (
              <>
                <span className="text-mute shrink-0">·</span>
                <span className="shrink-0 font-bold" style={{ color: FACTIONS[player.faction].color }}>
                  [{FACTIONS[player.faction].tag}]
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* HULL/SHIELD micro bars */}
      <div className="panel pointer-events-auto px-3 py-2" style={{ minWidth: 170 }}>
        <MicroBar label="HUL" value={player.hull} max={hullMax} color="#5cff8a" />
        <MicroBar label="SHD" value={player.shield} max={shieldMax} color="#4ee2ff" />
      </div>

      {/* EXP / Honor bars */}
      <div className="panel pointer-events-auto px-3 py-2" style={{ minWidth: 170 }}>
        <MicroBar label="XP" value={player.exp} max={expNeeded} color="#ff5cf0" />
        <MicroBar
          label="HNR"
          value={player.honor - rank.minHonor}
          max={(nextRank?.minHonor ?? rank.minHonor + 1000) - rank.minHonor}
          color={rank.color}
        />
      </div>

      {/* Numeric stats */}
      <div className="panel pointer-events-auto flex items-center py-2 px-1" style={{ minWidth: 0 }}>
        <Stat label="CR" value={fmtNum(player.credits)} color="var(--accent-amber)" />
        <Stat label="HONOR" value={fmtNum(player.honor)} color={rank.color} />
        <Stat label="CARGO" value={`${cargoUsed}/${cargoCapacity()}`} color="#4ee2ff" />
        <Stat label="DRONES" value={`${player.drones.length}/${maxDroneSlots()}`} color="#aaff5c" />
      </div>

      {/* Sector chip */}
      <div className="panel pointer-events-auto px-3 py-2 text-right" style={{ minWidth: 0 }}>
        <div className="hud-label">SECTOR</div>
        <div
          className="font-bold tracking-widest glow-cyan truncate"
          style={{ color: "var(--accent-cyan)", fontSize: 13, maxWidth: 110 }}
        >
          {zone.name.toUpperCase()}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Action buttons */}
      <div className="pointer-events-auto flex gap-1 shrink-0">
        <AudioToggle />
        <button
          className="btn"
          style={{ padding: "5px 10px", fontSize: 12 }}
          onClick={() => { state.showMap = !state.showMap; bump(); }}
          title="Galaxy Map (M)"
        >
          ★ Map
        </button>
        <button
          className="btn"
          style={{ padding: "5px 10px", fontSize: 12 }}
          onClick={() => { state.showSocial = !state.showSocial; bump(); }}
          title="Social"
        >
          ☷ Social
        </button>
        <button
          className="btn"
          style={{ padding: "5px 10px", fontSize: 12 }}
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
        minWidth: 190,
        maxWidth: 240,
        padding: "10px 12px",
      }}
    >
      <div className="hud-label mb-0.5">TARGET</div>
      <div
        className="font-bold truncate"
        style={{ color: hpColor, fontSize: 14, maxWidth: 210 }}
      >
        {target.name}
      </div>
      <div className="text-dim mt-0.5 mb-2 truncate" style={{ fontSize: 11, maxWidth: 210 }}>
        {target.detail}
      </div>
      {entity && (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="hud-label w-5 shrink-0">HP</span>
            <div
              className="flex-1 overflow-hidden"
              style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}
            >
              <div
                style={{
                  height: "100%",
                  width: hpPct + "%",
                  background: `linear-gradient(90deg, ${hpColor}66, ${hpColor})`,
                  boxShadow: "0 0 4px " + hpColor,
                  transition: "width 0.15s ease-out",
                  borderRadius: 2,
                }}
              />
            </div>
            <span
              className="tabular-nums shrink-0"
              style={{ color: hpColor, fontSize: 11, minWidth: 60, textAlign: "right" }}
            >
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
  const valStr = `${Math.round(value)}/${Math.round(max)}`;
  return (
    <div className="flex items-center gap-1.5 mb-0.5 last:mb-0">
      <span
        className="shrink-0 text-right tabular-nums"
        style={{ color: "#aabbd8", fontSize: 11, width: 28, letterSpacing: "0.08em" }}
      >
        {label}
      </span>
      <div className="bar flex-1" style={{ height: 10, minWidth: 60 }}>
        <div
          className="bar-fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}55, ${color})`,
            boxShadow: `0 0 4px ${color}88`,
          }}
        />
      </div>
      <span
        className="tabular-nums shrink-0 text-right"
        style={{ color, fontSize: 10, minWidth: 56 }}
      >
        {valStr}
      </span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="stat-box">
      <div className="hud-label whitespace-nowrap">{label}</div>
      <div
        className="font-bold tabular-nums whitespace-nowrap"
        style={{ color, fontSize: 13 }}
      >
        {value}
      </div>
    </div>
  );
}

function AudioToggle() {
  const [muted, setMutedState] = useState(getMuted());
  const [vol, setVol] = useState(getVolume());
  return (
    <div
      className="panel pointer-events-auto flex items-center gap-1.5 px-2 py-1"
      title="Audio"
      style={{ minWidth: 0 }}
    >
      <button
        className="btn shrink-0"
        style={{ padding: "2px 5px", fontSize: 13 }}
        onClick={() => { const m = !muted; setMuted(m); setMutedState(m); }}
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <input
        type="range" min={0} max={1} step={0.05} value={vol}
        onChange={(e) => { const v = +e.target.value; setVol(v); setVolume(v); }}
        style={{ width: 46, accentColor: "var(--accent-cyan)" }}
      />
    </div>
  );
}

export function RankBadge({ rank }: { rank: { color: string; symbol: string; pips: number; name: string } }) {
  return (
    <div
      className="flex flex-col items-center justify-center shrink-0"
      style={{
        width: 38, height: 38,
        background: `${rank.color}1a`,
        border: `1px solid ${rank.color}cc`,
        boxShadow: `0 0 8px ${rank.color}44, inset 0 0 6px ${rank.color}0a`,
      }}
      title={rank.name}
    >
      <div style={{ color: rank.color, fontSize: 17, lineHeight: 1, textShadow: `0 0 6px ${rank.color}` }}>
        {rank.symbol}
      </div>
      <div className="flex gap-[2px] mt-[2px]">
        {Array.from({ length: rank.pips }).map((_, i) => (
          <div key={i} style={{ width: 3, height: 3, background: rank.color, borderRadius: 1 }} />
        ))}
      </div>
    </div>
  );
}
