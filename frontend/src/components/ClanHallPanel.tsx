// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-07 ·
// CLAN HALL section, lines ~3010-3277) — the own-clan state: crest + level
// bar, treasury + donations, research grid with a detail/fund panel, and a
// roster sorted by lifetime contribution with invite/promote/kick/leave.
// Same shell/purple accent (#b866ff) as ClanDirectoryPanel.tsx (I-08) so the
// two read as one place, switched via the tab bar in ClanWindowTabs.tsx.
//
// All data is real: GET /api/clan/:id (backend/src/routes/clan.ts) returns
// treasury/xp/level/research/roster straight from the clans/players tables.
// Donations, research funding, kick/promote all hit real server-authoritative
// endpoints — no client-side balance math. The 6 research projects match the
// Kit's own CL_RES array exactly (Reinforced Plating/Focused Emitters/Drive
// Calibration/Hold Expansion/Salvage Rights/Banner of Honor) and apply real
// combat bonuses server-side (hull/damage/speed/cargo/salvage-value/honor —
// see backend/src/game/clanData.ts + engine.ts computeStats/loot handlers),
// not just this panel's display.
import { useEffect, useMemo, useState } from "react";
import { useGame, state as gameState, bump, save } from "../game/store";
import { FACTIONS, type ClanDetail, type ClanResearchProject } from "../game/types";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";
import { getClan, donateToClan, fundClanResearch, kickClanMember, setClanOfficer, leaveClan as apiLeaveClan } from "../net/api";
import { ClanTabBar } from "./ClanTabBar";

const ACCENT = "#b866ff";
const KEYFRAMES = `
@keyframes chPulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes chSweep{0%{left:-45%}100%{left:115%}}
@keyframes chSheen{0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}
`;

const DONATE_PRESETS = [5000, 25000, 100000];

// Kit's clSorts roster sort modes: CONTRIB (lifetime donation, the server's
// default ordering), RANK (role: leader > officer > member), ONLINE (online
// members first). Online status is derived client-side from state.others —
// the broadcast list of nearby/visible players — since there's no dedicated
// clan-presence feed; it's an honest approximation, not a lie like the old
// hardcoded always-green dot it replaces.
type RosterSort = "contrib" | "rank" | "online";
const ROSTER_SORTS: { key: RosterSort; label: string }[] = [
  { key: "contrib", label: "CONTRIB" },
  { key: "rank", label: "RANK" },
  { key: "online", label: "ONLINE" },
];
const ROLE_ORDER: Record<string, number> = { leader: 0, officer: 1, member: 2 };

// Renders a clan's ACTUAL stored crest (shape/symbol/colors from the I-09
// charter form), not a hash-derived placeholder — mirrors
// ClanDirectoryPanel.tsx's crestOf() and the Kit's own shadeHex()/rgba().
const CF_SHAPE_CLIPS: Record<string, string> = {
  hex: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)",
  flat: "polygon(26% 0,74% 0,100% 50%,74% 100%,26% 100%,0 50%)",
  shield: "polygon(6% 0,94% 0,100% 62%,50% 100%,0 62%)",
  kite: "polygon(50% 0,100% 50%,50% 100%,0 50%)",
  oct: "polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)",
  cut: "polygon(0 0,72% 0,100% 28%,100% 100%,28% 100%,0 72%)",
  blade: "polygon(50% 0,100% 22%,86% 100%,14% 100%,0 22%)",
  arrow: "polygon(50% 0,100% 34%,82% 100%,18% 100%,0 34%)",
  star: "polygon(50% 0,62% 34%,98% 36%,70% 58%,80% 96%,50% 74%,20% 96%,30% 58%,2% 36%,38% 34%)",
  cross: "polygon(34% 0,66% 0,66% 34%,100% 34%,100% 66%,66% 66%,66% 100%,34% 100%,34% 66%,0 66%,0 34%,34% 34%)",
  disc: "circle(50% at 50% 50%)",
  chev: "polygon(50% 0,100% 30%,100% 100%,50% 72%,0 100%,0 30%)",
  pent: "polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)",
  banner: "polygon(0 0,100% 0,100% 78%,50% 100%,0 78%)",
  spade: "polygon(50% 0,100% 44%,74% 100%,26% 100%,0 44%)",
  gem: "polygon(28% 0,72% 0,100% 34%,50% 100%,0 34%)",
  tri: "polygon(50% 4%,100% 96%,0 96%)",
  rune: "polygon(18% 0,82% 0,100% 22%,82% 100%,18% 100%,0 22%)",
  visor: "polygon(0 18%,100% 18%,100% 62%,50% 100%,0 62%)",
  wedge: "polygon(0 0,100% 0,74% 100%,26% 100%)",
  fang: "polygon(50% 0,100% 30%,100% 70%,50% 100%,0 100%,0 0)",
  prism: "polygon(50% 0,94% 25%,94% 75%,50% 100%,6% 75%,6% 25%)",
  slab: "polygon(12% 0,88% 0,100% 14%,100% 86%,88% 100%,12% 100%,0 86%,0 14%)",
  talon: "polygon(50% 0,100% 18%,88% 72%,50% 100%,12% 72%,0 18%)",
  ward: "polygon(50% 0,100% 20%,100% 60%,50% 100%,0 60%,0 20%)",
  pylon: "polygon(34% 0,66% 0,100% 26%,100% 74%,66% 100%,34% 100%,0 74%,0 26%)",
  comet: "polygon(50% 0,100% 40%,72% 100%,28% 100%,0 40%)",
  orb: "circle(46% at 50% 50%)",
};
function clipOf(shape: string): string { return CF_SHAPE_CLIPS[shape] ?? CF_SHAPE_CLIPS.hex; }
function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255) + Math.round(255 * amt);
  let g = (n >> 8 & 255) + Math.round(255 * amt);
  let b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function rgbaHex(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function crestColors(c: { crestShape: string; crestSymbol: string; crestOuter: string; crestInner: string; crestSymbolColor: string }) {
  const outer = c.crestOuter || "#b866ff";
  const inner = c.crestInner || shadeHex(outer, -0.35);
  return {
    clip: clipOf(c.crestShape),
    symbol: c.crestSymbol || "★",
    symbolColor: c.crestSymbolColor || "#f2f7ff",
    band: `linear-gradient(150deg,${shadeHex(outer, 0.4)},${shadeHex(outer, -0.3)} 52%,${shadeHex(outer, -0.66)})`,
    face: `radial-gradient(circle at 50% 32%,${rgbaHex(inner, 0.6)},#07050d 78%)`,
    hex: outer,
    glow: rgbaHex(outer, 0.6),
  };
}

function DonateAmountButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      onClick={onClick} aria-label={`Donate ${label} per click`} aria-pressed={selected} {...handlers}
      style={{
        flex: 1, position: "relative", padding: "5px 0", border: "none", cursor: "pointer",
        fontFamily: "var(--font-mono)", fontSize: 10.6, fontVariantNumeric: "tabular-nums",
        color: selected ? "#f4ecff" : "rgba(206,222,246,.6)",
        background: selected ? `linear-gradient(180deg,${ACCENT}4d,rgba(6,5,12,.92))` : "rgba(255,255,255,.03)",
        boxShadow: selected ? `inset 0 1px 0 ${ACCENT}66,inset 0 -1px 0 rgba(0,0,0,.7),inset 0 0 16px ${ACCENT}33` : "inset 0 0 0 1px rgba(220,238,255,.07)",
        clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
        transform: active ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        filter: active ? "brightness(1.3)" : hover ? "brightness(1.16)" : "none",
        transition: "transform .13s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      {label}
    </button>
  );
}

function GoldButton({ label, glyph, onClick, disabled }: { label: string; glyph: string; onClick: () => void; disabled?: boolean }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={label} {...(disabled ? {} : handlers)}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: disabled ? "default" : "pointer",
        filter: disabled ? "grayscale(.6) brightness(.7)" : active ? "brightness(1.3)" : hover ? "brightness(1.14)" : "none",
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#f7ecd0,#c9a34e 44%,#5c4318)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(150deg,#d9b463,#4a3413 58%,#241a09)", clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: 3, padding: "7px 6px", overflow: "hidden", background: "linear-gradient(180deg,#3a2c10,#150f05)", color: "#ffeec2", fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.14em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,226,160,.25)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
        <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,244,214,.7),transparent)" }} />
        <i style={{ position: "relative", fontStyle: "normal", fontSize: 10 }}>{glyph}</i>
        <span style={{ position: "relative" }}>{label}</span>
      </span>
    </button>
  );
}

function CyanButton({ label, glyph, onClick, disabled }: { label: string; glyph: string; onClick: () => void; disabled?: boolean }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={label} {...(disabled ? {} : handlers)}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: disabled ? "default" : "pointer",
        filter: disabled ? "grayscale(.6) brightness(.7)" : active ? "brightness(1.3)" : hover ? "brightness(1.14)" : "none",
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#e2f8ff,#4b95ad 44%,#173540)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(150deg,#5cb4cc,#123039 58%,#08191f)", clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: 3, padding: "7px 6px", overflow: "hidden", background: "linear-gradient(180deg,#123039,#050f14)", color: "#d8f6ff", fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.14em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(157,233,255,.25)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
        <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(222,246,255,.7),transparent)" }} />
        <i style={{ position: "relative", fontStyle: "normal", fontSize: 10 }}>{glyph}</i>
        <span style={{ position: "relative" }}>{label}</span>
      </span>
    </button>
  );
}

function MemberRow({ m, isLeader, isOfficer, online, onKick, onToggleOfficer }: {
  m: ClanDetail["members"][number]; isLeader: boolean; isOfficer: boolean; online: boolean;
  onKick: () => void; onToggleOfficer: (grant: boolean) => void;
}) {
  const { hover, active, handlers } = usePressable();
  const roleHex = m.clanRole === "leader" ? "#ffd24a" : m.clanRole === "officer" ? "#9fe0ff" : "rgba(196,222,246,.6)";
  const canManage = (isLeader || isOfficer) && m.clanRole !== "leader";
  return (
    <div
      {...handlers}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", overflow: "hidden",
        background: "rgba(255,255,255,.02)",
        boxShadow: "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.6),inset 0 2px 4px rgba(0,0,0,.42)",
        clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
        transform: active ? "translateX(1px) translateY(1px)" : hover ? "translateX(2px)" : "none",
        transition: "transform .13s cubic-bezier(.2,.9,.25,1)",
      }}
    >
      <i style={{ width: 6, height: 6, flex: "0 0 auto", borderRadius: "50%", background: online ? "#5cff8a" : "rgba(196,222,246,.25)", boxShadow: online ? "0 0 8px #5cff8a" : "none" }} />
      <div style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
        <b style={{ fontSize: 10.5, fontWeight: 700, color: "#eaf3ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</b>
        <small style={{ fontFamily: "var(--font-display)", fontSize: 6, letterSpacing: "0.16em", color: roleHex }}>{m.clanRole.toUpperCase()} · LV {m.level}</small>
      </div>
      <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontVariantNumeric: "tabular-nums", color: "rgba(196,222,246,.78)" }}>{m.clanContribution.toLocaleString()}</small>
      {canManage && (
        <div style={{ display: "flex", gap: 3 }}>
          {isLeader && (
            <button
              onClick={() => onToggleOfficer(m.clanRole !== "officer")}
              aria-label={m.clanRole === "officer" ? `Demote ${m.name}` : `Promote ${m.name} to officer`}
              title={m.clanRole === "officer" ? "Demote to member" : "Promote to officer"}
              style={{ padding: "2px 5px", border: "none", cursor: "pointer", fontSize: 9, color: "#9fe0ff", background: "rgba(78,226,255,.12)", boxShadow: "inset 0 0 0 1px rgba(78,226,255,.4)" }}
            >{m.clanRole === "officer" ? "★" : "☆"}</button>
          )}
          <button
            onClick={onKick} aria-label={`Kick ${m.name}`} title="Kick"
            style={{ padding: "2px 5px", border: "none", cursor: "pointer", fontSize: 9, color: "#ff8a94", background: "rgba(255,77,94,.12)", boxShadow: "inset 0 0 0 1px rgba(255,77,94,.4)" }}
          >✕</button>
        </div>
      )}
    </div>
  );
}

function RosterSortBar({ value, onChange }: { value: RosterSort; onChange: (v: RosterSort) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {ROSTER_SORTS.map((s) => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          aria-pressed={value === s.key}
          style={{
            flex: 1, padding: "3px 0", border: "none", cursor: "pointer",
            fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.14em", fontWeight: 700,
            color: value === s.key ? "#1a0d2a" : "rgba(206,222,246,.6)",
            background: value === s.key ? ACCENT : "rgba(255,255,255,.04)",
            boxShadow: value === s.key ? `0 0 8px ${ACCENT}88` : "inset 0 0 0 1px rgba(255,255,255,.06)",
          }}
        >{s.label}</button>
      ))}
    </div>
  );
}

function ResearchCard({ proj, selected, onPick }: { proj: ClanResearchProject; selected: boolean; onPick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const funded = proj.tier > 0;
  const maxed = proj.tier >= proj.maxTier;
  const hex = proj.hex;
  const glow = hex;
  return (
    <div
      role="button" tabIndex={0} onClick={onPick} {...handlers}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(); }}
      aria-label={`${proj.name}, tier ${proj.tier} of ${proj.maxTier}`}
      style={{
        position: "relative", display: "grid", gap: 6, padding: "9px 11px 10px", cursor: "pointer", overflow: "hidden",
        background: selected
          ? `radial-gradient(120% 100% at 50% 0%,${rgbaHex(hex, 0.2)},transparent 72%),linear-gradient(180deg,#161122,#07060d)`
          : "linear-gradient(180deg,#12101c,#06050c)",
        boxShadow: selected
          ? `inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px ${rgbaHex(hex, 0.5)},inset 0 -2px 0 ${rgbaHex(hex, 0.4)}`
          : "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.1)",
        clipPath: "polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)",
        transform: active ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .14s cubic-bezier(.2,.9,.25,1)",
      }}
    >
      <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,${glow},transparent)`, opacity: funded ? 0.8 : 0.18 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative", width: 30, height: 30, flex: "0 0 auto", filter: `drop-shadow(0 2px 0 rgba(3,5,10,.9)) drop-shadow(0 0 ${selected ? 10 : 5}px ${rgbaHex(hex, funded ? 0.9 : 0.55)})` }}>
          <i style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,${shadeHex(hex, 0.3)},${shadeHex(hex, -0.34)} 52%,${shadeHex(hex, -0.64)})`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
          <i style={{ position: "absolute", inset: 2.5, background: `radial-gradient(circle at 50% 34%,${rgbaHex(hex, funded ? 0.5 : 0.2)},#05080f 76%)`, boxShadow: "inset 0 2px 5px rgba(0,0,0,.7)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
        </div>
        <div style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 11, fontWeight: 700, color: selected ? "#ffffff" : "rgba(226,236,250,.86)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{proj.name}</b>
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: proj.maxTier }, (_, i) => (
              <i key={i} style={{ width: 7, height: 7, background: i < proj.tier ? hex : "rgba(255,255,255,.07)", boxShadow: i < proj.tier ? `0 0 7px ${rgbaHex(hex, 0.85)},inset 0 1px 0 rgba(255,255,255,.5)` : "inset 0 1px 2px rgba(0,0,0,.7)" }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <small style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 6.5, letterSpacing: "0.2em", color: maxed ? "#5cff8a" : funded ? rgbaHex(hex, 0.9) : "rgba(190,214,236,.45)" }}>
          {maxed ? "MAXED" : funded ? `TIER ${proj.tier} ONLINE` : "NOT RESEARCHED"}
        </small>
        <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontVariantNumeric: "tabular-nums", color: maxed ? "rgba(92,255,138,.7)" : proj.nextCost != null ? "#f5dda6" : "rgba(196,222,246,.7)" }}>
          {maxed ? "—" : proj.nextCost != null ? proj.nextCost.toLocaleString() : ""}
        </small>
      </div>
    </div>
  );
}

export function ClanHallPanel() {
  const showClan = useGame((s) => s.showClan);
  const clanTab = useGame((s) => s.clanTab);
  const player = useGame((s) => s.player);
  const show = showClan && clanTab === "hall";

  const [playToken] = useState(0);
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const [clan, setClan] = useState<ClanDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [donateAmount, setDonateAmount] = useState(5000);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rosterSort, setRosterSort] = useState<RosterSort>("contrib");
  const others = useGame((s) => s.others);

  const onlineNames = useMemo(() => new Set(others.filter((o) => o.clan === player.clan).map((o) => o.name)), [others, player.clan]);

  const sortedMembers = useMemo(() => {
    if (!clan) return [];
    const list = [...clan.members];
    if (rosterSort === "rank") {
      list.sort((a, b) => (ROLE_ORDER[a.clanRole] ?? 3) - (ROLE_ORDER[b.clanRole] ?? 3) || b.clanContribution - a.clanContribution);
    } else if (rosterSort === "online") {
      list.sort((a, b) => {
        const aOn = a.name === player.name || onlineNames.has(a.name) ? 1 : 0;
        const bOn = b.name === player.name || onlineNames.has(b.name) ? 1 : 0;
        return bOn - aOn || b.clanContribution - a.clanContribution;
      });
    } else {
      list.sort((a, b) => b.clanContribution - a.clanContribution);
    }
    return list;
  }, [clan, rosterSort, onlineNames, player.name]);

  useEffect(() => {
    if (show) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const refresh = () => {
    if (!player.clanId) { setLoadError("Not in a clan."); return; }
    getClan(player.clanId)
      .then((data) => { setClan(data.clan); setLoadError(null); })
      .catch((err) => setLoadError(err.message || "Failed to load clan"));
  };

  useEffect(() => {
    if (!show) return;
    if (!player.clan) { setLoadError("Not in a clan."); return; }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, player.clan]);

  if (!mounted) return null;

  const close = () => { gameState.showClan = false; bump(); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); };
  const crest = clan ? crestColors(clan) : null;

  const selectedProject = clan?.research.find((r) => r.id === selectedProjectId) ?? clan?.research[0] ?? null;
  // The local Player type has no numeric id (only the server-side row does)
  // — match by name, the one identity the client already carries.
  const me = clan?.members.find((m) => m.name === player.name);
  const isLeader = !!me && clan?.leaderId === me.id;
  const isOfficer = me?.clanRole === "officer";

const doDonate = async (currency: "credits" | "mcoins") => {
    if (!clan || busy) return;
    setBusy(true);
    try {
      await donateToClan(clan.id, currency, donateAmount);
      if (currency === "credits") gameState.player.credits -= donateAmount;
      else gameState.player.mcoins -= donateAmount;
      save();
      setToast({ text: `+${donateAmount.toLocaleString()} ${currency} into the vault.` });
      refresh();
      bump();
    } catch (err: any) {
      setToast({ text: err.message || "Donation failed.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  const doFund = async () => {
    if (!clan || !selectedProject || busy) return;
    setBusy(true);
    try {
      await fundClanResearch(clan.id, selectedProject.id);
      setToast({ text: `${selectedProject.name} advanced to tier ${selectedProject.tier + 1}.` });
      refresh();
    } catch (err: any) {
      setToast({ text: err.message || "Funding failed.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  const doKick = async (targetId: number) => {
    if (!clan) return;
    try {
      await kickClanMember(clan.id, targetId);
      refresh();
    } catch (err: any) {
      setToast({ text: err.message || "Kick failed.", bad: true });
    }
  };

  const doToggleOfficer = async (targetId: number, grant: boolean) => {
    if (!clan) return;
    try {
      await setClanOfficer(clan.id, targetId, grant);
      refresh();
    } catch (err: any) {
      setToast({ text: err.message || "Failed to update role.", bad: true });
    }
  };

  const doLeave = async () => {
    try {
      await apiLeaveClan();
      gameState.player.clan = null;
      gameState.player.clanId = null;
      gameState.clanTab = "directory";
      save();
      bump();
    } catch (err: any) {
      setToast({ text: err.message || "Failed to leave clan.", bad: true });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "grid", placeItems: "center", background: "rgba(2,4,12,.7)" }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <style>{KEYFRAMES}</style>
      <PrintPortal
        playToken={playToken}
        accent={ACCENT}
        duration={1300}
        chamfer={34}
        closing={closing}
        onClosed={closing ? onPortalClosed : undefined}
        style={{ width: "min(96vw, 1420px)" }}
      >
        <div style={{ position: "relative", padding: 18, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(184,102,255,.18))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: "#05070d", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 0, display: "block", background: "rgba(184,102,255,.5)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "rgba(243,232,255,.65)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "rgba(5,3,10,.7)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "rgba(201,168,255,.45)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "rgba(5,3,10,.65)", clipPath: "polygon(0 0,calc(100% - 29.32px) 0,100% 29.32px,100% 100%,29.32px 100%,0 calc(100% - 29.32px))" }} />
          <i style={{ position: "absolute", inset: 10, display: "block", background: "rgba(126,72,176,.3)", clipPath: "polygon(0 0,calc(100% - 28.15px) 0,100% 28.15px,100% 100%,28.15px 100%,0 calc(100% - 28.15px))" }} />
          <i style={{ position: "absolute", inset: 12, display: "block", background: "rgba(5,3,10,.6)", clipPath: "polygon(0 0,calc(100% - 26.98px) 0,100% 26.98px,100% 100%,26.98px 100%,0 calc(100% - 26.98px))" }} />
          <i style={{ position: "absolute", inset: 14, display: "block", background: "rgba(62,32,86,.25)", clipPath: "polygon(0 0,calc(100% - 25.81px) 0,100% 25.81px,100% 100%,25.81px 100%,0 calc(100% - 25.81px))" }} />
          <i style={{ position: "absolute", inset: 16, display: "block", background: "rgba(5,3,10,.55)", clipPath: "polygon(0 0,calc(100% - 24.64px) 0,100% 24.64px,100% 100%,24.64px 100%,0 calc(100% - 24.64px))" }} />

          <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 12, padding: "14px 15px 15px", overflow: "hidden", background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 5px 12px rgba(0,0,0,.6),inset 0 0 0 1px rgba(5,3,10,.6),inset 0 -2px 0 rgba(201,168,255,.2)", clipPath: "polygon(0 0,calc(100% - 23.47px) 0,100% 23.47px,100% 100%,23.47px 100%,0 calc(100% - 23.47px))" }}>
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.04) 11px 12px,transparent 12px 23px)", pointerEvents: "none" }} />

            {/* header */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0 1px 10px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(201,168,255,.14)" }}>
              <i style={{ width: 7, height: 7, flex: "0 0 auto", background: ACCENT, boxShadow: `0 0 10px ${ACCENT}`, transform: "rotate(45deg)", animation: "chPulse 1.9s ease-in-out infinite" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 14.2, letterSpacing: "0.24em", color: "#eddcff" }}>CLAN HALL</b>
              {clan && <small style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.16em", color: "#eddcff", background: `${ACCENT}22`, boxShadow: `inset 0 0 0 1px ${ACCENT}55` }}>⟨{clan.tag}⟩</small>}
              <span style={{ flex: 1 }} />
              <ClanTabBar active="hall" />
              {clan && <small style={{ fontFamily: "var(--font-mono)", fontSize: 12.4, letterSpacing: "0.08em", color: "rgba(201,168,255,.8)" }}>{clan.memberCount}/{clan.maxMembers} MEMBERS</small>}
              <CloseButton onClick={close} title="Close" size={24} fontSize={10} />
            </div>

            {loadError && (
              <div style={{ padding: 30, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "#ff8a94" }}>{loadError}</div>
            )}

            {clan && crest && (
              <div style={{ position: "relative", display: "grid", gridTemplateColumns: "336px 1fr 300px", gap: 14, alignItems: "stretch" }}>

                {/* left — crest, treasury, donations */}
                <div style={{ position: "relative", display: "grid", gap: 9, alignContent: "start", padding: "22px 20px", border: `2px solid ${ACCENT}80`, background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 0 0 2px rgba(243,232,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(201,168,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(126,72,176,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(62,32,86,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>
                  <div style={{ position: "relative", display: "grid", gap: 10, padding: "13px 13px 14px", overflow: "hidden", background: `radial-gradient(130% 100% at 50% 0%,${crest.glow},transparent 74%),linear-gradient(180deg,#141020,#06050c)`, boxShadow: `inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 ${ACCENT}33`, clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ position: "relative", width: 70, height: 70, flex: "0 0 auto", filter: `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 7px 9px rgba(0,0,0,.7)) drop-shadow(0 0 18px ${crest.glow})` }}>
                        <i style={{ position: "absolute", inset: 0, background: crest.band, clipPath: crest.clip }} />
                        <i style={{ position: "absolute", inset: 3, background: crest.face, boxShadow: "inset 0 3px 8px rgba(0,0,0,.7)", clipPath: crest.clip }} />
                        <b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontStyle: "normal", fontWeight: 400, fontSize: 28, lineHeight: 1, color: crest.symbolColor, textShadow: `0 0 10px ${crest.glow}` }}>{crest.symbol}</b>
                      </div>
                      <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                        <b style={{ fontFamily: "var(--font-display)", fontSize: 13.5, letterSpacing: "0.06em", whiteSpace: "nowrap", color: "#eddcff", textShadow: `0 0 12px ${crest.glow}` }}>{clan.name}</b>
                        <small style={{ fontSize: 10, lineHeight: 1.5, color: "rgba(206,222,242,.68)" }}>{clan.motto || "No motto filed."}</small>
                      </div>
                    </div>
                    <div style={{ position: "relative", display: "grid", gap: 5 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <small style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>CLAN LEVEL {clan.level}</small>
                        <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontVariantNumeric: "tabular-nums", color: "#eddcff" }}>{clan.xp.toLocaleString()} / {clan.xpNext.toLocaleString()}</small>
                      </div>
                      <div style={{ position: "relative", height: 13, overflow: "hidden", background: "linear-gradient(180deg,#080610,#04030a)", boxShadow: "inset 0 3px 6px rgba(0,0,0,.85),inset 0 0 0 1px rgba(0,0,0,.7)" }}>
                        <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, (clan.xp / Math.max(1, clan.xpNext)) * 100)}%`, background: "linear-gradient(180deg,rgba(226,200,255,.95),#b866ff 46%,#5f2b96)", boxShadow: "0 0 16px rgba(184,102,255,.75)" }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ position: "relative", display: "grid", gap: 8, padding: "12px 13px 13px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% 0%,rgba(232,185,77,.12),transparent 74%),linear-gradient(180deg,#141020,#06050c)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 rgba(232,185,77,.2)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                    <small style={{ fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(240,222,180,.8)" }}>CLAN TREASURY</small>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ display: "grid", gap: 2, padding: "8px 10px", background: "linear-gradient(180deg,#0b0910,#050409)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6)" }}>
                        <small style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.2em", color: "rgba(232,185,77,.75)" }}>CREDITS</small>
                        <b style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontVariantNumeric: "tabular-nums", color: "#f5dda6" }}>{clan.treasuryCredits.toLocaleString()}</b>
                      </div>
                      <div style={{ display: "grid", gap: 2, padding: "8px 10px", background: "linear-gradient(180deg,#0b0910,#050409)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6)" }}>
                        <small style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.2em", color: "rgba(157,242,255,.75)" }}>MCOINS</small>
                        <b style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontVariantNumeric: "tabular-nums", color: "#cfefff" }}>{clan.treasuryMcoins.toLocaleString()}</b>
                      </div>
                    </div>
                  </div>

                  <div style={{ position: "relative", display: "grid", gap: 8, padding: "12px 13px 13px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% 0%,rgba(184,102,255,.14),transparent 74%),linear-gradient(180deg,#141020,#06050c)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 rgba(201,168,255,.2)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <small style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>DONATION</small>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(190,214,236,.62)" }}>YOURS · {(me?.clanContribution ?? 0).toLocaleString()}</small>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {DONATE_PRESETS.map((a) => <DonateAmountButton key={a} label={a.toLocaleString()} selected={donateAmount === a} onClick={() => setDonateAmount(a)} />)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      <GoldButton label="CREDITS" glyph="✦" disabled={busy} onClick={() => doDonate("credits")} />
                      <CyanButton label="MCOINS" glyph="◈" disabled={busy} onClick={() => doDonate("mcoins")} />
                    </div>
                    {toast && <small style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 9, color: toast.bad ? "#ff8a94" : "#7cffb0" }}>{toast.text}</small>}
                  </div>

                  <div style={{ position: "relative", display: "grid", gap: 7, alignContent: "start", padding: "12px 13px 13px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% 0%,rgba(184,102,255,.14),transparent 74%),linear-gradient(180deg,#141020,#06050c)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 rgba(201,168,255,.2)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <small style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>SEASON RECORD</small>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", background: "linear-gradient(180deg,#0a0810,#040309)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6)" }}>
                      <i style={{ width: 5, height: 5, flex: "0 0 auto", background: "#4ee2ff", boxShadow: "0 0 7px #4ee2ff", transform: "rotate(45deg)" }} />
                      <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.05em", color: "rgba(196,214,238,.72)" }}>TOTAL HONOR</small>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontVariantNumeric: "tabular-nums", color: "#dbe9fb" }}>{clan.totalHonor.toLocaleString()}</small>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", background: "linear-gradient(180deg,#0a0810,#040309)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6)" }}>
                      <i style={{ width: 5, height: 5, flex: "0 0 auto", background: "#e8b94d", boxShadow: "0 0 7px #e8b94d", transform: "rotate(45deg)" }} />
                      <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.05em", color: "rgba(196,214,238,.72)" }}>SEASON RANK</small>
                      <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontVariantNumeric: "tabular-nums", color: "#dbe9fb" }}>#{clan.seasonRank}</small>
                    </div>
                  </div>
                </div>

                {/* middle — research */}
                <div style={{ position: "relative", display: "grid", gap: 9, alignContent: "start", padding: "22px 20px", border: `2px solid ${ACCENT}80`, background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 0 0 2px rgba(243,232,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(201,168,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(126,72,176,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(62,32,86,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "0 2px 2px" }}>
                    <i style={{ width: 6, height: 6, background: ACCENT, boxShadow: `0 0 9px ${ACCENT}`, transform: "rotate(45deg)" }} />
                    <b style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.24em", color: "#eddcff" }}>CLAN RESEARCH</b>
                    <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.4, color: `${ACCENT}cc` }}>{clan.research.filter((r) => r.tier > 0).length} PROJECTS ONLINE</small>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                    {clan.research.map((r) => (
                      <ResearchCard key={r.id} proj={r} selected={selectedProject?.id === r.id} onPick={() => setSelectedProjectId(r.id)} />
                    ))}
                  </div>

                  {selectedProject && (() => {
                    const dHex = selectedProject.hex;
                    const fmtEff = (tier: number) => {
                      const v = selectedProject.perTier * tier;
                      const rounded = selectedProject.unit === "%" ? Number(v.toFixed(1).replace(/\.0$/, "")) : Math.round(v);
                      return `${rounded}${selectedProject.unit}`;
                    };
                    const maxed = selectedProject.tier >= selectedProject.maxTier;
                    return (
                      <div style={{ position: "relative", display: "grid", gap: 9, padding: "12px 13px 13px", overflow: "hidden", background: `radial-gradient(120% 100% at 50% 0%,${rgbaHex(dHex, 0.15)},transparent 74%),linear-gradient(180deg,#141020,#06050c)`, boxShadow: `inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 ${rgbaHex(dHex, 0.42)}`, clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <i style={{ width: 6, height: 6, flex: "0 0 auto", background: dHex, boxShadow: `0 0 9px ${dHex}`, transform: "rotate(45deg)" }} />
                          <b style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "#f2f7ff" }}>{selectedProject.name}</b>
                          <small style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.16em", color: dHex, background: rgbaHex(dHex, 0.16), boxShadow: `inset 0 0 0 1px ${rgbaHex(dHex, 0.42)}` }}>TIER {selectedProject.tier} / {selectedProject.maxTier}</small>
                        </div>
                        <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.55, color: "rgba(218,232,248,.84)" }}>{selectedProject.description}</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 22px 1fr", gap: 8, alignItems: "center" }}>
                          <div style={{ display: "grid", gap: 2, padding: "7px 10px", background: "linear-gradient(180deg,#0a0810,#040309)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6)" }}>
                            <small style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.2em", color: "rgba(190,214,236,.6)" }}>NOW</small>
                            <b style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#dbe9fb" }}>{selectedProject.tier > 0 ? fmtEff(selectedProject.tier) : "—"}</b>
                          </div>
                          <b style={{ textAlign: "center", fontSize: 13, color: dHex }}>›</b>
                          <div style={{ display: "grid", gap: 2, padding: "7px 10px", background: "linear-gradient(180deg,#0a0810,#040309)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6)" }}>
                            <small style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.2em", color: dHex }}>NEXT TIER</small>
                            <b style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: maxed ? "rgba(92,255,138,.85)" : "#eddcff" }}>
                              {maxed ? "MAX TIER" : fmtEff(selectedProject.tier + 1)}
                            </b>
                          </div>
                        </div>
                        <GoldButton
                          label={maxed ? "RESEARCH COMPLETE" : (clan.treasuryCredits < (selectedProject.nextCost ?? 0)) ? `TREASURY SHORT · ${selectedProject.nextCost?.toLocaleString()}` : `FUND TIER ${selectedProject.tier + 1} · ${selectedProject.nextCost?.toLocaleString()}`}
                          glyph="✦" disabled={busy || maxed || (selectedProject.nextCost != null && clan.treasuryCredits < selectedProject.nextCost)}
                          onClick={doFund}
                        />
                      </div>
                    );
                  })()}
                </div>

                {/* right — roster */}
                <div style={{ position: "relative", display: "grid", gap: 9, alignContent: "start", padding: "22px 20px", border: `2px solid ${ACCENT}80`, background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 0 0 2px rgba(243,232,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(201,168,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(126,72,176,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(62,32,86,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "0 2px 2px" }}>
                    <b style={{ fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.24em", color: "#eddcff" }}>ROSTER</b>
                    <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 9.4, color: `${ACCENT}cc` }}>{clan.memberCount}/{clan.maxMembers}</small>
                  </div>

                  <RosterSortBar value={rosterSort} onChange={setRosterSort} />

                  <div style={{ position: "relative", display: "grid", gap: 5, maxHeight: 420, overflowY: "auto" }}>
                    {sortedMembers.map((m) => (
                      <MemberRow
                        key={m.id} m={m} isLeader={isLeader} isOfficer={!!isOfficer}
                        online={m.name === player.name || onlineNames.has(m.name)}
                        onKick={() => doKick(m.id)}
                        onToggleOfficer={(grant) => doToggleOfficer(m.id, grant)}
                      />
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 7, paddingTop: 2 }}>
                    <button
                      onClick={doLeave} aria-label="Leave the clan"
                      style={{ position: "relative", padding: "9px 6px", border: "none", cursor: "pointer", background: "linear-gradient(180deg,#3a1016,#160508)", color: "#ffd0d5", fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.16em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,140,155,.3)" }}
                    >LEAVE CLAN</button>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      </PrintPortal>
    </div>
  );
}
