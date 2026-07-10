import { useState, useEffect } from "react";
import { GameButton } from "./GameButton";
import { TopPanel } from "./TopPanel";
import { useGame, state, bump, maxDroneSlots, cargoCapacity } from "../game/store";
import { clearToken } from "../net/api";
import { disconnectSocket } from "../net/socket";
import { EXP_FOR_LEVEL, FACTIONS, SHIP_CLASSES, ZONES, rankFor, HONOR_RANKS } from "../game/types";
import { effectiveStats } from "../game/loop";

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
  const rank = rankFor(player.honor);
  const nextRank = HONOR_RANKS.find((r) => r.minHonor > player.honor);

  const cargoUsed = player.cargo.reduce((a, c) => a + c.qty, 0);

  return (
    <>
    <div className="absolute top-2 left-2 right-2 z-30 flex items-start gap-2 pointer-events-none flex-wrap">
      {/* Command console — two instrument rows: identity+vitals / progression+resources */}
      <TopPanel style={{ minWidth: 0 }}>
      <div className="flex flex-col" style={{ padding: "0px 6px 2px" }}>
      {/* amber glass banner — pilot identity header */}
      <div
        className="banner-amber flex items-center justify-center gap-2"
        style={{ height: 30, margin: "-8px -10px 4px", padding: "0 26px" }}
      >
        <span className="font-bold tracking-widest truncate" style={{ fontSize: 13, maxWidth: 170 }}>
          {player.name}
        </span>
        <span className="font-bold shrink-0 tabular-nums" style={{ fontSize: 12, color: "#5a3204" }}>
          Lv{player.level}
        </span>
        {player.skillPoints > 0 && (
          <span
            className="shrink-0 font-bold tabular-nums"
            style={{
              fontSize: 10,
              color: "#7a0a5e",
              border: "1px solid #7a0a5e66",
              padding: "0px 4px",
              whiteSpace: "nowrap",
              textShadow: "none",
            }}
          >
            +{player.skillPoints} SP
          </span>
        )}
      </div>

      <div className="flex items-stretch">
        {/* identity */}
        <div className="flex items-center gap-2.5 pr-3">
          <RankBadge rank={rank} />
          <div className="min-w-0">
            <div className="flex items-center gap-1 min-w-0" style={{ fontSize: 11 }}>
              <span className="shrink-0 font-semibold tracking-widest" style={{ color: rank.color }}>
                {rank.name.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-1 min-w-0" style={{ fontSize: 11 }}>
              <span className="text-mute truncate" style={{ maxWidth: 96 }}>{cls.name}</span>
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

        <ConsoleDivider />

        {/* vitals */}
        <div className="px-3 flex flex-col justify-center" style={{ minWidth: 176 }}>
          <MicroBar label="HUL" value={player.hull} max={hullMax} color="#5cff8a" />
          <MicroBar label="SHD" value={player.shield} max={shieldMax} color="#4ee2ff" />
        </div>
      </div>

      <div className="sw-hr" />

      {/* row 2: progression + resources readout strip */}
      <div className="flex items-center">
        <div className="px-1 flex flex-col justify-center" style={{ minWidth: 168, paddingRight: 12 }}>
          <MicroBar label="XP" value={player.exp} max={expNeeded} color="#ff5cf0" />
          <MicroBar
            label="HNR"
            value={player.honor - rank.minHonor}
            max={(nextRank?.minHonor ?? rank.minHonor + 1000) - rank.minHonor}
            color={rank.color}
          />
        </div>

        <ConsoleDivider />

        <div className="flex items-center px-1">
          <Stat label="Credits" value={fmtNum(player.credits)} color="var(--accent-amber)" />
          <Stat label="HONOR" value={fmtNum(player.honor)} color={rank.color} />
          <Stat label="CARGO" value={`${cargoUsed}/${cargoCapacity()}`} color="#4ee2ff" />
          <Stat label="DRONES" value={`${player.drones.length}/${maxDroneSlots()}`} color="#aaff5c" />
        </div>
      </div>
      </div>
      </TopPanel>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Floating menu icons (PNG GUI pack) */}
      <div className="pointer-events-auto flex gap-1.5 shrink-0 items-start">
        <IconBtn icon="ic-map" label="Galaxy Map (M)" onClick={() => { state.showMap = !state.showMap; bump(); }} />
        <IconBtn icon="ic-journal" label="Mission Journal" onClick={() => { state.showJournal = !state.showJournal; bump(); }} />
        <IconBtn icon="ic-quests" label="Quest Log on/off" onClick={() => { state.showQuestTracker = !state.showQuestTracker; bump(); }} />
        <IconBtn icon="ic-social" label="Social" onClick={() => { state.showSocial = !state.showSocial; bump(); }} />
        <IconBtn icon="ic-clan" label="Clan (C)" onClick={() => { state.showClan = !state.showClan; bump(); }} />
        <IconBtn icon="ic-settings" label="Settings" onClick={() => { state.showSettings = !state.showSettings; bump(); }} />
        <IconBtn icon="ic-logout" label="Logout" onClick={() => { state.showLogoutConfirm = true; bump(); }} />
      </div>
    </div>
    <LogoutFlow />
    </>
  );
}

function LogoutFlow() {
  const showConfirm = useGame((s) => s.showLogoutConfirm);
  const countingDown = useGame((s) => s.logoutCountdown);
  const [remaining, setRemaining] = useState(5);

  useEffect(() => {
    if (!countingDown) return;
    setRemaining(5);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, 5 - Math.floor(elapsed));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(interval);
        clearToken();
        disconnectSocket();
        window.location.reload();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [countingDown]);

  if (!showConfirm && !countingDown) return null;

  if (countingDown) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.65)",
          pointerEvents: "auto",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#ff8a9a", fontSize: 18, letterSpacing: "0.25em", marginBottom: 16, textShadow: "0 0 12px rgba(255,60,80,0.8)" }}>
            LOGGING OUT IN
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: 120,
              fontWeight: 800,
              lineHeight: 1,
              textShadow: "0 0 24px rgba(255,60,80,0.9), 0 0 48px rgba(255,60,80,0.5)",
              fontFamily: "'Courier New', monospace",
            }}
          >
            {remaining}
          </div>
          <div style={{ marginTop: 24 }}>
            <GameButton
              onClick={() => { state.logoutCountdown = false; state.showLogoutConfirm = false; bump(); }}
              style={{ color: "#ffffff", fontSize: 13, padding: "8px 24px" }}
            >
              ✕ Cancel
            </GameButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        pointerEvents: "auto",
      }}
    >
      <div style={{
        background: "rgba(8,12,30,0.95)",
        border: "1px solid rgba(255,60,80,0.4)",
        boxShadow: "0 0 40px rgba(255,60,80,0.3), inset 0 0 30px rgba(0,0,0,0.6)",
        padding: "28px 40px",
        maxWidth: 440,
        textAlign: "center",
      }}>
        <div style={{ color: "#ff8a9a", fontSize: 16, letterSpacing: "0.2em", marginBottom: 12, textShadow: "0 0 8px rgba(255,60,80,0.6)" }}>
          CONFIRM LOGOUT
        </div>
        <div style={{ color: "#e8ecff", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
          Are you sure you want to log out?
        </div>
        <div className="flex justify-center gap-3">
          <GameButton
            onClick={() => { state.showLogoutConfirm = false; state.logoutCountdown = true; bump(); }}
            style={{ color: "#ff8a9a", fontSize: 13, padding: "6px 20px" }}
          >
            ✓ Confirm
          </GameButton>
          <GameButton
            onClick={() => { state.showLogoutConfirm = false; bump(); }}
            style={{ color: "#e8ecff", fontSize: 13, padding: "6px 20px" }}
          >
            ✕ Cancel
          </GameButton>
        </div>
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
      className="hud-chip chip-target pointer-events-none"
      style={{
        position: "fixed",
        left: 14,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 35,
        minWidth: 190,
        maxWidth: 240,
        padding: "4px 6px",
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

function IconBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      className="ic-btn"
      title={label}
      onClick={onClick}
      style={{ backgroundImage: `url(/assets/ui/atlas/${icon}.png?v=3)` }}
    />
  );
}

function ConsoleDivider() {
  return (
    <div
      aria-hidden
      style={{
        width: 1,
        alignSelf: "stretch",
        background:
          "linear-gradient(180deg, transparent 0%, rgba(78,226,255,0.35) 20%, rgba(78,226,255,0.35) 80%, transparent 100%)",
        boxShadow: "1px 0 0 rgba(0,0,0,0.6)",
        flexShrink: 0,
      }}
    />
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
        className="shrink-0 text-right tabular-nums font-bold"
        style={{ color: "#ffffff", fontSize: 11, width: 28, letterSpacing: "0.08em", textShadow: "0 0 6px rgba(255,255,255,0.7), 0 0 10px rgba(255,255,255,0.35)" }}
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
      <div
        className="hud-label whitespace-nowrap font-bold"
        style={{ color: "#ffffff", textShadow: "0 0 6px rgba(255,255,255,0.7), 0 0 10px rgba(255,255,255,0.35)" }}
      >
        {label}
      </div>
      <div
        className="font-bold tabular-nums whitespace-nowrap"
        style={{ color, fontSize: 13 }}
      >
        {value}
      </div>
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
