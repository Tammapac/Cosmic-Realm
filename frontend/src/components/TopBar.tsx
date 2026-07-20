import { useState, useEffect } from "react";
import { GameButton } from "./GameButton";
import { useGame, state, bump, cargoCapacity } from "../game/store";
import { clearToken } from "../net/api";
import { disconnectSocket } from "../net/socket";
import { EXP_FOR_LEVEL, FACTIONS, SHIP_CLASSES, rankFor, HONOR_RANKS } from "../game/types";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
}

export function TopBar() {
  const player = useGame((s) => s.player);
  const cls = SHIP_CLASSES[player.shipClass];
  const expNeeded = EXP_FOR_LEVEL(player.level);
  const rank = rankFor(player.honor);
  const nextRank = HONOR_RANKS.find((r) => r.minHonor > player.honor);

  const cargoUsed = player.cargo.reduce((a, c) => a + c.qty, 0);

  return (
    <>
    <div className="absolute top-2 left-2 right-2 z-30 flex items-start gap-2 pointer-events-none flex-wrap">
      {/* Pilot console — avatar.png frame: rank in the octagon, stats in the dark panel */}
      <AvatarConsole
        player={player}
        rank={rank}
        nextRank={nextRank}
        expNeeded={expNeeded}
        clsName={cls.name}
        cargoUsed={cargoUsed}
      />

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Floating menu icons (PNG GUI pack) */}
      <div className="pointer-events-auto flex gap-1.5 shrink-0 items-start">
        <IconBtn icon="ic-map" label="Galaxy Map (M)" short="Map" onClick={() => { state.showMap = !state.showMap; bump(); }} />
        <IconBtn icon="ic-journal" label="Mission Journal" short="Journal" onClick={() => { state.showJournal = !state.showJournal; bump(); }} />
        <IconBtn icon="ic-quests" label="Quest Log on/off" short="Quests" onClick={() => { state.showQuestTracker = !state.showQuestTracker; localStorage.setItem("sf-quest-tracker", state.showQuestTracker ? "on" : "off"); bump(); }} />
        <IconBtn icon="ic-social" label="Social" short="Social" onClick={() => { state.showSocial = !state.showSocial; bump(); }} />
        <IconBtn icon="ic-clan" label="Clan (C)" short="Clan" onClick={() => { state.showClan = !state.showClan; bump(); }} />
        <IconBtn icon="ic-settings" label="Settings" short="Settings" onClick={() => { state.showSettings = !state.showSettings; bump(); }} />
        <IconBtn icon="ic-logout" label="Logout" short="Logout" onClick={() => { state.showLogoutConfirm = true; bump(); }} />
      </div>
    </div>
    <LogoutFlow />
    </>
  );
}

// ── Pilot console on the avatar.png frame art (383×193 native) ────────────
// Geometry is % of the artwork so it scales: octagon inner ≈ x36..167/y32..172,
// name strip ≈ x216..372/y15..34, dark hex panel ≈ x206..366/y44..108,
// three octagon buttons ≈ y115..168 starting at x203, pitch ~47px.
function AvatarConsole({
  player, rank, nextRank, expNeeded, clsName, cargoUsed,
}: {
  player: any;
  rank: { index: number; color: string; symbol: string; pips: number; name: string; minHonor: number };
  nextRank: { minHonor: number } | undefined;
  expNeeded: number;
  clsName: string;
  cargoUsed: number;
}) {
  const honorSpan = (nextRank?.minHonor ?? rank.minHonor + 1000) - rank.minHonor;
  const honorPct = Math.max(0, Math.min(100, ((player.honor - rank.minHonor) / Math.max(1, honorSpan)) * 100));
  const xpPct = Math.max(0, Math.min(100, (player.exp / Math.max(1, expNeeded)) * 100));

  const rankTip =
    `${rank.name.toUpperCase()}\n` +
    `Pilot rank — earned through honor.\n` +
    `HONOR ${fmtNum(player.honor)}${nextRank ? ` · NEXT RANK AT ${fmtNum(nextRank.minHonor)}` : " · MAX RANK"}\n` +
    `SHIP ${clsName}${player.faction ? ` · FACTION [${FACTIONS[player.faction].tag}]` : ""}`;

  // Button frames measured in the art: x≈216/272/326 (48px wide), y≈118..180.
  // The skill-shield icon is baked directly into avatar-frame.png (helmet
  // erased in the asset), so buttons are pure click zones.
  const consoleBtn = (left: string, label: string, onClick: () => void, opts?: { badge?: number }) => (
    <button
      onClick={onClick}
      title={label}
      className="avatar-btn"
      style={{ position: "absolute", left, top: "61.1%", width: "9.8%", height: "32.1%" }}
    >
      {opts?.badge != null && opts.badge > 0 && (
        <span
          style={{
            position: "absolute", top: "-12%", right: "-8%",
            minWidth: 15, height: 15, padding: "0 3px",
            background: "#ff5cf0", color: "#0b0b12",
            fontSize: 10, fontWeight: 800, lineHeight: "15px",
            borderRadius: 8, textShadow: "none",
            animation: "pulse-glow 1.5s ease-in-out infinite",
            zIndex: 1,
          }}
        >
          {opts.badge}
        </span>
      )}
    </button>
  );

  // Sliced composite: the art is NOT scaled uniformly. The octagon (native
  // x0..214) and the button row (x214..383, y114..193) render at natural
  // scale; only the name-strip + dark-panel band (x214..383, y0..114) is
  // stretched horizontally so the console gets LONGER without getting taller.
  const H = 170;                       // total height (octagon smaller)
  const W = 432;                       // total width (panel longer)
  const s = H / 193;                   // uniform scale (0.881)
  const AW = Math.round(214 * s);      // octagon slice width (≈189)
  const NAT_BG = `${Math.round(383 * s)}px ${H}px`;          // natural bg size
  const bandNative = (383 - 214) * s;                        // right band natural width
  const fB = (W - AW) / bandNative;                          // panel stretch (≈1.63)
  const BAND_H = Math.round(114 * s);                        // panel band height (≈100)

  return (
    <div
      className="pointer-events-auto shrink-0"
      style={{
        position: "relative",
        width: W,
        height: H,
        filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.55))",
        userSelect: "none",
      }}
    >
      {/* art layer A — octagon assembly, natural scale */}
      <div aria-hidden style={{
        position: "absolute", left: 0, top: 0, width: AW, height: H,
        backgroundImage: "url(/assets/ui/avatar-frame.png?v=3)",
        backgroundSize: NAT_BG, backgroundPosition: "0 0", backgroundRepeat: "no-repeat",
      }} />
      {/* art layer B — name strip + dark panel band, stretched horizontally */}
      <div aria-hidden style={{
        position: "absolute", left: AW, top: 0, width: W - AW, height: BAND_H,
        backgroundImage: "url(/assets/ui/avatar-frame.png?v=3)",
        backgroundSize: `${383 * s * fB}px ${H}px`,
        backgroundPosition: `-${214 * s * fB}px 0`, backgroundRepeat: "no-repeat",
      }} />
      {/* art layer C — octagon buttons row, natural scale (no distortion) */}
      <div aria-hidden style={{
        position: "absolute", left: AW, top: BAND_H, width: Math.ceil(bandNative), height: H - BAND_H,
        backgroundImage: "url(/assets/ui/avatar-frame.png?v=3)",
        backgroundSize: NAT_BG, backgroundPosition: `-${214 * s}px -${BAND_H}px`, backgroundRepeat: "no-repeat",
      }} />

      {/* octagon — pilot rank; clicking opens the pilot dossier (attributes,
          career paths, rankings) */}
      <div
        title={rankTip + "\nCLICK TO OPEN PILOT DOSSIER"}
        role="button"
        onClick={() => { state.showPlayerStats = true; bump(); }}
        style={{
          position: "absolute", left: "9.4%", top: "18.6%", width: "25.1%", height: "68.6%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 1, cursor: "pointer",
        }}
      >
        <img
          src={`/assets/ui/ranks/rank_${String(rank.index + 1).padStart(2, "0")}.png`}
          alt=""
          draggable={false}
          style={{
            height: 34, width: "auto", maxWidth: "82%", objectFit: "contain",
            filter: `drop-shadow(0 0 8px ${rank.color}66) drop-shadow(0 1px 2px #000)`,
          }}
        />
        <div
          className="font-bold text-center"
          style={{
            color: rank.color, fontSize: 9.5, letterSpacing: "0.12em", lineHeight: 1.15,
            fontFamily: "var(--font-display)", textShadow: `0 0 8px ${rank.color}55, 0 1px 2px #000`,
            maxWidth: "100%",
          }}
        >
          {rank.name.toUpperCase()}
        </div>
        {/* honor progress to next rank */}
        <div style={{ width: "70%", height: 3, background: "#000a", border: `1px solid ${rank.color}44`, marginTop: 2 }}>
          <div style={{ width: `${honorPct}%`, height: "100%", background: rank.color, boxShadow: `0 0 5px ${rank.color}` }} />
        </div>
      </div>

      {/* pilot name — upper section of the dark panel (ends before the
          baked angled divider kicks up at the right) */}
      <div
        style={{
          position: "absolute", left: "45.8%", top: "23.5%", width: "32.5%", height: "11.8%",
          display: "flex", alignItems: "center", gap: 5, overflow: "hidden",
        }}
        title={`${player.name} · ${clsName}${player.faction ? ` · ${FACTIONS[player.faction].name}` : ""}`}
      >
        <span className="font-bold truncate" style={{ fontSize: 12, color: "#ffe9c4", textShadow: "0 1px 2px #000", letterSpacing: "0.06em" }}>
          {player.name}
        </span>
        {player.faction && (
          <span className="shrink-0 font-bold" style={{ fontSize: 10, color: FACTIONS[player.faction].color, textShadow: "0 1px 2px #000" }}>
            [{FACTIONS[player.faction].tag}]
          </span>
        )}
      </div>

      {/* lower section of the dark panel — level / honor / credits / cargo */}
      <div
        style={{
          position: "absolute", left: "45.8%", top: "40%", width: "47.7%", height: "15.9%",
          display: "grid", gridTemplateColumns: "0.8fr 1fr 1.2fr 1fr",
          columnGap: "3.5%", alignItems: "center",
        }}
      >
        <PanelStat
          label="LEVEL" value={String(player.level)} color="var(--accent-amber)"
          tip={`Level ${player.level}\nXP ${fmtNum(player.exp)} / ${fmtNum(expNeeded)} to next level`}
          barPct={xpPct} barColor="#ff5cf0"
        />
        <PanelStat
          label="HONOR" value={fmtNum(player.honor)} color={rank.color}
          tip={`Honor ${fmtNum(player.honor)}\n${nextRank ? `Next rank at ${fmtNum(nextRank.minHonor)}` : "Maximum rank reached"}`}
        />
        <PanelStat
          label="CREDITS" value={fmtNum(player.credits)} color="var(--accent-amber)"
          tip={`${player.credits.toLocaleString()} credits`}
        />
        <PanelStat
          label="CARGO" value={`${cargoUsed}/${cargoCapacity()}`} color="#4ee2ff"
          tip={`Cargo hold ${cargoUsed}/${cargoCapacity()} units\nPress J to open`}
        />
      </div>

      {/* octagon buttons — skills / inventory (backpack) / cargo manifest.
          Zones follow layer C (natural scale): screen_x = AW + (native_x - 214) * s */}
      {consoleBtn("44.2%", `Skill Tree${player.skillPoints > 0 ? `\n${player.skillPoints} skill points available` : ""}`, () => { state.showSkillTree = !state.showSkillTree; bump(); }, { badge: player.skillPoints })}
      {consoleBtn("55.6%", "Inventory (I)", () => { state.showInventory = !state.showInventory; bump(); })}
      {consoleBtn("66.6%", "Cargo Hold (J)", () => { state.showCargo = !state.showCargo; bump(); })}
    </div>
  );
}

function PanelStat({
  label, value, color, tip, barPct, barColor,
}: { label: string; value: string; color: string; tip: string; barPct?: number; barColor?: string }) {
  return (
    <div title={tip} style={{ minWidth: 0, cursor: "default" }}>
      <div
        className="whitespace-nowrap"
        style={{
          fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.16em",
          color: "#9a9484", textShadow: "0 1px 2px #000", lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        className="font-bold tabular-nums whitespace-nowrap truncate"
        style={{ color, fontSize: 12, lineHeight: 1.15, textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
      >
        {value}
      </div>
      {barPct !== undefined && (
        <div style={{ width: "86%", height: 2, background: "#000a", marginTop: 1 }}>
          <div style={{ width: `${barPct}%`, height: "100%", background: barColor, boxShadow: `0 0 4px ${barColor}` }} />
        </div>
      )}
    </div>
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
      className="console-sq pointer-events-none"
      style={{
        position: "fixed",
        left: 14,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 35,
        width: 216,
        padding: "8px 10px 10px",
      }}
    >
      <span className="console-corner tl" />
      <span className="console-corner tr" />
      <span className="console-corner bl" />
      <span className="console-corner br" />
      <div
        className="font-bold truncate text-center"
        style={{
          color: hpColor, fontSize: 15, letterSpacing: "0.08em",
          fontFamily: "var(--font-display)", textShadow: "0 1px 2px #000",
        }}
      >
        {target.name}
      </div>
      {entity && (
        <div
          className="relative overflow-hidden"
          style={{
            height: 15, marginTop: 6,
            background: "rgba(0,0,0,0.55)",
            border: `1px solid ${hpColor}55`,
          }}
        >
          <div
            style={{
              position: "absolute", inset: 0,
              width: hpPct + "%",
              background: `linear-gradient(90deg, ${hpColor}55, ${hpColor})`,
              boxShadow: "0 0 6px " + hpColor,
              transition: "width 0.15s ease-out",
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center tabular-nums font-bold"
            style={{ fontSize: 10.5, color: "#fff", textShadow: "0 1px 2px #000", letterSpacing: "0.04em" }}
          >
            {Math.round(hp)}/{Math.round(hpMax)}
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ icon, label, short, onClick }: { icon: string; label: string; short: string; onClick: () => void }) {
  // Short caption under the icon so the command buttons read at a glance
  // instead of being bare icons (full label stays in the tooltip).
  return (
    <button
      className="ic-btn"
      title={label}
      onClick={onClick}
      style={{ backgroundImage: `url(/assets/ui/atlas/${icon}.png?v=4)` }}
    >
      <span className="ic-btn-label">{short}</span>
    </button>
  );
}

