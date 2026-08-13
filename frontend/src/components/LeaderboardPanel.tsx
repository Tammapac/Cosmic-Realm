// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-13 ·
// LEADERBOARD section — HTML template ~line 4706, LB_BOARDS/LB_REW ~line
// 7857, state builder ~line 5674). 4 boards (Level/Honor/Kills/Credits),
// Monthly/All-Time seasons, top-3 podium, ranked list to 100, your-standing
// strip, and reward tiers.
//
// All data is real: GET /api/leaderboard/board (backend/src/routes/
// leaderboard.ts) ranks level/honor/kills off the leaderboard cache and
// credits live off players.credits — never a client-trusted value. Monthly
// MCoin payouts and all-time rank buffs (+XP%/+Credits%, applied in
// engine.ts's loot payout, same call sites as clan research) are real
// server-authoritative effects, lazily settled on read (backend/src/game/
// leaderboardData.ts), not just this panel's display.
import { useEffect, useState } from "react";
import { useGame, state as gameState, bump } from "../game/store";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";
import { getLeaderboardBoard } from "../net/api";

const ACCENT = "#e8b94d";

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
function fmtVal(board: string, n: number): string {
  if (board === "credits") {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    return n.toLocaleString("en-US");
  }
  return n.toLocaleString("en-US");
}

const FACTION_HEX: Record<string, string> = { earth: "#4ee2ff", mars: "#ff8a4e", venus: "#c86cff" };
const MEDAL = ["#ffdf8a", "#dfe8f2", "#e09a5a"];

type BoardMeta = { id: string; label: string; hex: string; unit: string };
type PodiumEntry = { rank: number; name: string; faction: string | null; clanTag: string | null; value: number; prize: string };
type RowEntry = { rank: number; name: string; faction: string | null; clanTag: string | null; value: number; isMe: boolean };
type RewardTier = { rank: string; badge: string; premium: boolean; items: string[] };
type BoardSnapshot = {
  board: string; season: string; unit: string; resetsAt: number | null;
  boards: BoardMeta[]; podium: PodiumEntry[]; rows: RowEntry[];
  you: { rank: number | null; value: number | null; note: string };
  rewards: { title: string; hex: string; brief: string; tiers: RewardTier[] };
};

function BoardButton({ b, active, onClick }: { b: BoardMeta; active: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  const rim = active
    ? `linear-gradient(150deg,${shadeHex(b.hex, 0.5)},${shadeHex(b.hex, -0.08)} 40%,${shadeHex(b.hex, -0.52)} 72%,${shadeHex(b.hex, -0.72)})`
    : "linear-gradient(150deg,#7d7361,#3b352c 46%,#181510)";
  const rim2 = active
    ? `linear-gradient(150deg,${shadeHex(b.hex, -0.2)},${shadeHex(b.hex, -0.64)} 50%,${shadeHex(b.hex, -0.84)})`
    : "linear-gradient(150deg,#3b352c,#14110d)";
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        flex: 1, position: "relative", padding: 2, border: "none", cursor: "pointer",
        background: rim,
        filter: `drop-shadow(0 2px 0 rgba(6,4,2,.92)) drop-shadow(0 4px 5px rgba(0,0,0,.6)) drop-shadow(0 0 ${active ? 14 : 5}px ${rgbaHex(b.hex, active ? 0.5 : 0.12)})`,
        transform: pressed ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .13s cubic-bezier(.2,.9,.25,1),filter .2s ease",
        clipPath: "polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)",
      }}
    >
      <i style={{ position: "absolute", inset: 1, display: "block", background: rim2, clipPath: "polygon(8.5px 0,100% 0,100% calc(100% - 8.5px),calc(100% - 8.5px) 100%,0 100%,0 8.5px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "7px 0", overflow: "hidden", background: active ? `radial-gradient(130% 100% at 50% -10%,${rgbaHex(b.hex, 0.26)},transparent 74%),linear-gradient(180deg,#1c1710,#0a0805)` : "linear-gradient(180deg,#161209,#080603)", boxShadow: active ? `inset 0 3px 6px rgba(0,0,0,.6),inset 0 0 0 1px rgba(0,0,0,.55),inset 0 -2px 0 ${rgbaHex(b.hex, 0.5)}` : "inset 0 3px 6px rgba(0,0,0,.72),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(245,221,166,.1)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }}>
        <i style={{ position: "absolute", left: 7, right: 7, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${active ? rgbaHex(shadeHex(b.hex, 0.7), 0.75) : "rgba(245,235,215,.3)"},transparent)` }} />
        <i style={{ position: "absolute", left: 7, right: 7, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${active ? b.hex : rgbaHex(b.hex, 0.25)},transparent)`, boxShadow: `0 0 ${active ? 10 : 3}px ${active ? b.hex : rgbaHex(b.hex, 0.25)}` }} />
        <i style={{ position: "relative", width: 6, height: 6, background: b.hex, boxShadow: `0 0 8px ${b.hex}`, opacity: active ? 1 : 0.45, transform: "rotate(45deg)" }} />
        <span style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 9.5, letterSpacing: "0.16em", fontWeight: 700, color: active ? "#fff6e2" : "rgba(230,212,178,.55)" }}>{b.label}</span>
      </span>
    </button>
  );
}

function SeasonButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  const rail = active ? ACCENT : "rgba(232,185,77,.25)";
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        position: "relative", padding: "6px 13px", border: "none", cursor: "pointer",
        fontFamily: "var(--font-display)", fontSize: 9.5, letterSpacing: "0.16em", fontWeight: 700,
        color: active ? "#ffeec2" : "rgba(230,212,178,.7)",
        background: active ? "linear-gradient(180deg,rgba(232,185,77,.3),rgba(8,6,3,.92))" : "linear-gradient(180deg,#1c1710,#0a0805)",
        boxShadow: active ? "inset 0 1px 0 rgba(255,238,194,.42),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 0 14px rgba(232,185,77,.22)" : "inset 0 1px 0 rgba(255,247,224,.07),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 3px 6px rgba(0,0,0,.5)",
        transform: pressed ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .13s cubic-bezier(.2,.9,.25,1),filter .16s ease",
        clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
      }}
    >
      <i style={{ position: "absolute", left: 5, right: 5, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${rail},transparent)`, boxShadow: `0 0 ${active ? 9 : 3}px ${rail}` }} />
      <span style={{ position: "relative" }}>{label}</span>
    </button>
  );
}

function PodiumCard({ p, boardHex, unit, board, onPick }: { p: PodiumEntry; boardHex: string; unit: string; board: string; onPick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const first = p.rank === 1;
  const hex = MEDAL[p.rank - 1] ?? boardHex;
  const facHex = p.faction ? FACTION_HEX[p.faction] ?? "#9fb6d4" : "#9fb6d4";
  const specHex = rgbaHex(shadeHex(hex, 0.7), 0.8);
  return (
    <div
      role="button" tabIndex={0} onClick={onPick} {...handlers}
      style={{
        position: "relative", cursor: "pointer", padding: first ? 5 : 4, boxSizing: "border-box",
        background: `linear-gradient(150deg,${shadeHex(hex, 0.5)},${shadeHex(hex, -0.06)} 40%,${shadeHex(hex, -0.52)} 72%,${shadeHex(hex, -0.72)})`,
        filter: `drop-shadow(0 3px 0 rgba(6,4,2,.92)) drop-shadow(0 7px 9px rgba(0,0,0,.7)) drop-shadow(0 0 ${first ? 26 : 14}px ${rgbaHex(hex, first ? 0.65 : 0.45)})`,
        transform: active ? "translateY(1px)" : hover ? "translateY(-3px)" : "none",
        transition: "transform .14s cubic-bezier(.2,.9,.25,1),filter .2s ease",
        clipPath: "polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)",
        order: p.rank === 1 ? 2 : p.rank === 2 ? 1 : 3,
      }}
    >
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: `linear-gradient(150deg,${shadeHex(hex, -0.16)},${shadeHex(hex, -0.6)} 48%,${shadeHex(hex, -0.84)})`, clipPath: "polygon(13px 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%,0 13px)" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: `linear-gradient(150deg,${shadeHex(hex, -0.55)},${shadeHex(hex, -0.86)} 60%,#05040a)`, clipPath: "polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 11, padding: first ? "13px 13px 12px" : "11px 11px 10px", overflow: "hidden", background: `radial-gradient(130% 100% at 50% -12%,${rgbaHex(hex, first ? 0.24 : 0.14)},transparent 74%),linear-gradient(180deg,#15110a,#080603)`, boxShadow: `inset 0 5px 11px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 ${rgbaHex(hex, first ? 0.6 : 0.4)}`, clipPath: "polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)" }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 9px,rgba(255,255,255,.035) 9px 10px,transparent 10px 19px)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 9, right: 9, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${specHex},transparent)`, pointerEvents: "none" }} />
        {first && (
          <i style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <i style={{ position: "absolute", top: "-20%", bottom: "-20%", left: 0, width: "22%", background: `linear-gradient(100deg,transparent,${rgbaHex(shadeHex(hex, 0.6), 0.4)},transparent)`, filter: "blur(5px)", animation: "lbCelSheen 5.5s linear infinite" }} />
          </i>
        )}
        <b style={{ position: "absolute", left: 0, top: 0, display: "grid", placeItems: "center", width: first ? 38 : 33, height: first ? 17 : 15, zIndex: 2, fontFamily: "var(--font-display)", fontSize: first ? 10.5 : 9, lineHeight: 1, color: shadeHex(hex, -0.82), background: `linear-gradient(135deg,${shadeHex(hex, 0.5)},${shadeHex(hex, -0.24)} 62%,${shadeHex(hex, -0.6)})`, boxShadow: `inset -1px -1px 0 rgba(0,0,0,.45),inset 1px 1px 0 ${specHex},2px 2px 7px rgba(0,0,0,.6)`, clipPath: "polygon(0 0,100% 0,calc(100% - 9px) 100%,0 100%)" }}>{p.rank}</b>
        <div style={{ position: "relative", width: first ? 42 : 34, height: first ? 42 : 34, flex: "0 0 auto", marginLeft: first ? 13 : 11, filter: `drop-shadow(0 3px 0 rgba(6,4,2,.9)) drop-shadow(0 0 16px ${rgbaHex(hex, 0.5)})` }}>
          <i style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,${shadeHex(hex, 0.4)},${shadeHex(hex, -0.3)} 52%,${shadeHex(hex, -0.66)})`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
          <i style={{ position: "absolute", inset: 2.5, background: `radial-gradient(circle at 50% 32%,${rgbaHex(hex, 0.5)},#08060c 76%)`, boxShadow: "inset 0 3px 7px rgba(0,0,0,.7)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
          <i style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontStyle: "normal", fontSize: first ? 17 : 14, color: hex, textShadow: `0 0 10px ${rgbaHex(hex, 0.6)}` }}>◆</i>
        </div>
        <div style={{ position: "relative", display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {p.faction && <small style={{ flex: "0 0 auto", padding: "2px 6px", fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.14em", color: facHex, background: rgbaHex(facHex, 0.16), boxShadow: `inset 0 0 0 1px ${rgbaHex(facHex, 0.45)}` }}>{p.faction.toUpperCase()}</small>}
            <b style={{ minWidth: 0, fontFamily: "var(--font-display)", fontSize: first ? 12.5 : 10.5, letterSpacing: "0.04em", color: "#fff6e2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: `0 0 11px ${rgbaHex(hex, 0.6)}` }}>{p.name}</b>
            {p.clanTag && <small style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(230,212,178,.8)" }}>[{p.clanTag}]</small>}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
            <b style={{ flex: "0 1 auto", minWidth: 0, fontFamily: "var(--font-mono)", fontSize: first ? 19 : 15, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: hex, textShadow: `0 0 12px ${rgbaHex(hex, 0.6)}` }}>{fmtVal(board, p.value)}</b>
            <small style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.2em", color: "rgba(230,212,178,.7)" }}>{unit}</small>
          </div>
          {p.prize && <small style={{ justifySelf: "start", padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.14em", whiteSpace: "nowrap", color: hex, background: rgbaHex(hex, 0.16), boxShadow: `inset 0 0 0 1px ${rgbaHex(hex, 0.4)}` }}>{p.prize}</small>}
        </div>
      </div>
    </div>
  );
}

function RankRow({ r, unit, board }: { r: RowEntry; unit: string; board: string }) {
  const { hover, handlers } = usePressable();
  const facHex = r.faction ? FACTION_HEX[r.faction] ?? "#9fb6d4" : "#9fb6d4";
  const top10 = r.rank <= 10;
  return (
    <div
      {...handlers}
      style={{
        position: "relative", display: "flex", alignItems: "stretch", cursor: "default", overflow: "hidden",
        background: r.isMe
          ? "radial-gradient(120% 100% at 0% 50%,rgba(232,185,77,.16),transparent 70%),linear-gradient(180deg,#181207,#080603)"
          : hover ? "rgba(150,190,235,.05)" : (r.rank % 2 ? "linear-gradient(180deg,#100d07,#070502)" : "linear-gradient(180deg,#131009,#080603)"),
        boxShadow: r.isMe ? "inset 0 2px 5px rgba(0,0,0,.7),inset 0 0 0 1px rgba(232,185,77,.45),inset 0 -1px 0 rgba(232,185,77,.4)" : "inset 0 2px 5px rgba(0,0,0,.7),inset 0 -1px 0 rgba(245,221,166,.09)",
        transition: "background .16s ease",
      }}
    >
      <b style={{ width: 54, flex: "0 0 auto", padding: "6px 0", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: top10 ? "#ffeec2" : "rgba(230,212,178,.85)", textShadow: top10 ? "0 0 8px rgba(232,185,77,.45)" : "none" }}>{String(r.rank).padStart(2, "0")}</b>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, padding: "6px 12px", borderLeft: "1px solid rgba(0,0,0,.55)" }}>
        <b style={{ minWidth: 0, fontSize: 11, fontWeight: 700, color: r.isMe ? "#fff6e2" : "rgba(238,228,208,.92)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</b>
        {r.faction && <small style={{ flex: "0 0 auto", padding: "1px 5px", fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.14em", color: facHex, background: rgbaHex(facHex, 0.14), boxShadow: `inset 0 0 0 1px ${rgbaHex(facHex, 0.4)}` }}>{r.faction.toUpperCase()}</small>}
        {r.isMe && <small style={{ flex: "0 0 auto", padding: "1px 5px", fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.14em", color: "#ffeec2", background: "rgba(232,185,77,.2)", boxShadow: "inset 0 0 0 1px rgba(232,185,77,.5)" }}>YOU</small>}
      </div>
      <small style={{ width: 76, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(230,212,178,.78)", borderLeft: "1px solid rgba(0,0,0,.55)" }}>{r.clanTag ? `[${r.clanTag}]` : "—"}</small>
      <b style={{ width: 108, flex: "0 0 auto", display: "grid", alignItems: "center", justifyItems: "end", paddingRight: 13, fontFamily: "var(--font-mono)", fontSize: 11, fontVariantNumeric: "tabular-nums", color: "rgba(240,230,212,.94)", borderLeft: "1px solid rgba(0,0,0,.55)" }}>{fmtVal(board, r.value)}</b>
    </div>
  );
}

export function LeaderboardPanel() {
  const showLeaderboard = useGame((s) => s.showLeaderboard);

  const [playToken] = useState(0);
  const [mounted, setMounted] = useState(showLeaderboard);
  const [closing, setClosing] = useState(false);
  const [data, setData] = useState<BoardSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [board, setBoard] = useState("honor");
  const [season, setSeason] = useState<"monthly" | "alltime">("monthly");

  useEffect(() => {
    if (showLeaderboard) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLeaderboard]);

  useEffect(() => {
    if (!showLeaderboard) return;
    getLeaderboardBoard(board, season)
      .then((snap: BoardSnapshot) => { setData(snap); setLoadError(null); })
      .catch((err: any) => setLoadError(err.message || "Failed to load leaderboard"));
  }, [showLeaderboard, board, season]);

  if (!mounted) return null;

  const close = () => { gameState.showLeaderboard = false; bump(); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); };

  const boardHex = data?.boards.find((b) => b.id === board)?.hex ?? ACCENT;
  const resetLabel = data?.resetsAt ? `CYCLE ENDS ${new Date(data.resetsAt).toLocaleDateString()}` : "NEVER RESETS · SINCE LAUNCH";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 64, paddingBottom: 32, overflowY: "auto", background: "rgba(2,4,12,.7)" }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <style>{`@keyframes lbCelSheen{from{transform:translateX(-160%) skewX(-20deg)}to{transform:translateX(420%) skewX(-20deg)}}`}</style>
      <PrintPortal playToken={playToken} closing={closing} onClosed={onPortalClosed} accent={ACCENT} duration={1300} chamfer={34} style={{ width: "min(96vw, 1120px)", flexShrink: 0 }}>
        <div style={{ position: "relative", padding: 18, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(6,4,2,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(232,185,77,.18))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,rgba(255,255,255,.14),rgba(0,0,0,.4)),linear-gradient(135deg,#f7ecc8,#c9a34e 38%,#5c4318 72%,#241a09)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(135deg,#f7ecc8,#c9a34e 38%,#5c4318 72%,#241a09)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "linear-gradient(135deg,#b48f42,#4a3413 45%,#181009)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#4a3413,#180f05 60%,#050301)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "linear-gradient(135deg,#241a0e,#0a0704)", clipPath: "polygon(0 0,calc(100% - 29.31px) 0,100% 29.31px,100% 100%,29.31px 100%,0 calc(100% - 29.31px))" }} />
          <i style={{ position: "absolute", left: 26, right: 48, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
          <i style={{ position: "absolute", left: 48, right: 26, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(245,221,166,.45),transparent)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 12, padding: "14px 15px 15px", overflow: "hidden", background: "linear-gradient(150deg,#3a2e14,#0d0a04)", boxShadow: "inset 0 5px 12px rgba(0,0,0,.6),inset 0 -2px 0 rgba(245,221,166,.2)", clipPath: "polygon(0 0,calc(100% - 23.47px) 0,100% 23.47px,100% 100%,23.47px 100%,0 calc(100% - 23.47px))" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0 1px 10px", borderBottom: "1px solid rgba(0,0,0,.55)" }}>
            <i style={{ width: 7, height: 7, flex: "0 0 auto", background: ACCENT, boxShadow: `0 0 10px ${ACCENT}`, transform: "rotate(45deg)" }} />
            <b style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.24em", color: "#ffeec2" }}>LEADERBOARD</b>
            <div style={{ display: "flex", gap: 5 }}>
              <SeasonButton label="MONTHLY" active={season === "monthly"} onClick={() => setSeason("monthly")} />
              <SeasonButton label="ALL-TIME" active={season === "alltime"} onClick={() => setSeason("alltime")} />
            </div>
            <span style={{ flex: 1 }} />
            <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.1em", color: "rgba(230,212,178,.85)" }}>{resetLabel}</small>
            <CloseButton onClick={close} title="Close" size={24} fontSize={10} />
          </div>

          {loadError && <small style={{ padding: 20, textAlign: "center", color: "#ff8a94" }}>{loadError}</small>}
          {!data && !loadError && <small style={{ padding: 20, textAlign: "center", color: "rgba(230,212,178,.6)" }}>Loading…</small>}

          {data && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 316px", gap: 12, alignItems: "stretch" }}>
              <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr auto", gap: 9, padding: "20px 18px", border: "2px solid rgba(232,185,77,.5)", background: "linear-gradient(150deg,#3a2e14,#0d0a04)", boxShadow: "inset 0 0 0 2px rgba(255,247,224,.65),inset 0 0 0 4px rgba(10,7,3,.7),inset 0 0 0 6px rgba(245,221,166,.45),inset 0 0 0 8px rgba(10,7,3,.65),inset 0 0 0 10px rgba(158,124,48,.3),inset 0 0 0 12px rgba(10,7,3,.6),inset 0 0 0 14px rgba(78,60,22,.25),inset 0 0 0 16px rgba(10,7,3,.55)" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {data.boards.map((b) => (
                    <BoardButton key={b.id} b={b} active={board === b.id} onClick={() => setBoard(b.id)} />
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.16fr 1fr", gap: 8, alignItems: "end" }}>
                  {data.podium.map((p) => (
                    <PodiumCard key={p.rank} p={p} boardHex={boardHex} unit={data.unit} board={board} onPick={() => {}} />
                  ))}
                </div>

                <div style={{ display: "grid", gap: 0, minHeight: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "7px 0", background: "linear-gradient(180deg,#1a150c,#0a0805)", boxShadow: "inset 0 1px 0 rgba(245,221,166,.14)" }}>
                    <small style={{ width: 54, flex: "0 0 auto", textAlign: "center", fontFamily: "var(--font-display)", fontSize: 8.5, letterSpacing: "0.2em", color: "rgba(245,221,166,.8)" }}>RANK</small>
                    <small style={{ flex: 1, paddingLeft: 12, fontFamily: "var(--font-display)", fontSize: 8.5, letterSpacing: "0.2em", color: "rgba(245,221,166,.8)" }}>PILOT</small>
                    <small style={{ width: 76, flex: "0 0 auto", textAlign: "center", fontFamily: "var(--font-display)", fontSize: 8.5, letterSpacing: "0.2em", color: "rgba(245,221,166,.8)" }}>CLAN</small>
                    <small style={{ width: 108, flex: "0 0 auto", paddingRight: 13, textAlign: "right", fontFamily: "var(--font-display)", fontSize: 8.5, letterSpacing: "0.2em", color: "rgba(245,221,166,.8)" }}>{data.unit}</small>
                  </div>
                  <div style={{ position: "relative", height: 406, overflowY: "auto", background: "linear-gradient(180deg,#0b0905,#060402)", boxShadow: "inset 0 4px 8px rgba(0,0,0,.7)" }}>
                    {data.rows.map((r) => <RankRow key={r.rank} r={r} unit={data.unit} board={board} />)}
                  </div>
                </div>

                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", overflow: "hidden", background: "radial-gradient(130% 100% at 0% 50%,rgba(232,185,77,.14),transparent 74%),linear-gradient(180deg,#171208,#080602)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 -2px 0 rgba(232,185,77,.35)" }}>
                  <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: ACCENT, boxShadow: "0 0 10px rgba(232,185,77,.8)" }} />
                  <small style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 6.5, letterSpacing: "0.2em", color: "rgba(245,221,166,.8)" }}>YOUR STANDING</small>
                  <b style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontVariantNumeric: "tabular-nums", color: "#ffeec2", textShadow: "0 0 10px rgba(232,185,77,.5)" }}>{data.you.rank != null ? `#${data.you.rank}` : "—"}</b>
                  <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(230,212,178,.7)" }}>{data.you.note}</small>
                  <span style={{ flex: 1 }} />
                  <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontVariantNumeric: "tabular-nums", color: "#ffeec2" }}>{data.you.value != null ? fmtVal(board, data.you.value) : "—"}</small>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: 9, padding: "20px 18px", border: "2px solid rgba(232,185,77,.5)", background: "linear-gradient(150deg,#3a2e14,#0d0a04)", boxShadow: "inset 0 0 0 2px rgba(255,247,224,.65),inset 0 0 0 4px rgba(10,7,3,.7),inset 0 0 0 6px rgba(245,221,166,.45),inset 0 0 0 8px rgba(10,7,3,.65),inset 0 0 0 10px rgba(158,124,48,.3),inset 0 0 0 12px rgba(10,7,3,.6),inset 0 0 0 14px rgba(78,60,22,.25),inset 0 0 0 16px rgba(10,7,3,.55)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 2px 2px" }}>
                  <i style={{ width: 6, height: 6, background: data.rewards.hex, boxShadow: `0 0 9px ${data.rewards.hex}`, transform: "rotate(45deg)" }} />
                  <b style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.24em", color: "#ffeec2" }}>{data.rewards.title}</b>
                </div>
                <div style={{ position: "relative", padding: "11px 12px 12px", overflow: "hidden", background: `radial-gradient(130% 100% at 50% 0%,${rgbaHex(data.rewards.hex, 0.14)},transparent 74%),linear-gradient(180deg,#171208,#080602)`, boxShadow: `inset 0 3px 7px rgba(0,0,0,.7),inset 0 -2px 0 ${rgbaHex(data.rewards.hex, 0.4)}` }}>
                  <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.55, color: "rgba(238,224,200,.84)" }}>{data.rewards.brief}</p>
                </div>
                <div style={{ display: "grid", gap: 6, alignContent: "start", maxHeight: 420, overflowY: "auto" }}>
                  {data.rewards.tiers.map((t, i) => {
                    // Ranks 1-3 keep their medal gold/silver/bronze; ranks
                    // 4-100 read as a duller unlit stone/wood tone instead
                    // of the reward category's own accent — that shiny
                    // color is meant to read as "you're in the spotlight",
                    // which the mass-tier brackets aren't.
                    const hex = i < 3 ? MEDAL[i] : "#8a7a5e";
                    const lit = i < 3;
                    return (
                      <div key={t.rank} style={{ position: "relative", display: "grid", gap: 6, padding: "10px 11px 11px", overflow: "hidden", background: lit ? `radial-gradient(120% 100% at 0% 0%,${rgbaHex(hex, 0.16)},transparent 72%),linear-gradient(180deg,#15110a,#070502)` : "linear-gradient(180deg,#100d07,#060402)", boxShadow: lit ? `inset 0 3px 6px rgba(0,0,0,.72),inset 0 0 0 1px ${rgbaHex(hex, 0.42)}` : "inset 0 3px 6px rgba(0,0,0,.72)", clipPath: "polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)" }}>
                        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 9px,rgba(255,255,255,.03) 9px 10px,transparent 10px 19px)", pointerEvents: "none" }} />
                        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,${hex},transparent)`, opacity: lit ? 1 : 0.35 }} />
                        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ position: "relative", width: 26, height: 26, flex: "0 0 auto", filter: `drop-shadow(0 2px 0 rgba(6,4,2,.9)) drop-shadow(0 0 9px ${rgbaHex(hex, 0.55)})` }}>
                            <i style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,${shadeHex(hex, 0.35)},${shadeHex(hex, -0.34)} 52%,${shadeHex(hex, -0.64)})`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                            <i style={{ position: "absolute", inset: 2, background: `radial-gradient(circle at 50% 34%,${rgbaHex(hex, 0.42)},#07050b 76%)`, boxShadow: "inset 0 2px 4px rgba(0,0,0,.7)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                            <b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 8, color: hex, textShadow: `0 0 7px ${rgbaHex(hex, 0.55)}` }}>{t.badge}</b>
                          </div>
                          <b style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.16em", color: lit ? "#fff6e2" : "rgba(238,228,208,.85)" }}>{t.rank}</b>
                          {t.premium && season === "alltime" && <small style={{ padding: "2px 6px", fontFamily: "var(--font-display)", fontSize: 7, letterSpacing: "0.14em", color: "#ffeec2", background: "rgba(232,185,77,.2)", boxShadow: "inset 0 0 0 1px rgba(232,185,77,.5)" }}>+ PREMIUM</small>}
                        </div>
                        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {t.items.map((it) => (
                            <small key={it} style={{ padding: "3px 8px", fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.03em", color: lit ? "#fff2d8" : "rgba(238,228,208,.8)", background: rgbaHex(hex, lit ? 0.14 : 0.08), boxShadow: `inset 0 0 0 1px ${rgbaHex(hex, lit ? 0.4 : 0.25)}` }}>{it}</small>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
