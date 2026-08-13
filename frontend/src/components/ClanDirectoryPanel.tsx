// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-08 ·
// CLAN DIRECTORY section, lines ~3278-3443) — "the no-clan state": browse
// charters, read the dossier, file an application or found your own.
// Same shell/purple accent (#b866ff) as the Kit's I-07 Clan Hall so joining
// and belonging read as one place — Clan Hall is a separate, later panel.
//
// All data is real: GET /api/clan lists every clan (name/tag/faction/
// memberCount/motto/tags/minLevel/minHonor/openSlots/seasonRank, all backed
// by real DB columns — see backend/src/routes/clan.ts and db/schema.ts).
// Entry requirements are enforced server-side too (POST /api/clan/:id/apply
// re-checks level/honor/openSlots) — the red/green dossier check here is a
// preview, not the real gate.
import { useEffect, useMemo, useState } from "react";
import { useGame, state as gameState, bump, save } from "../game/store";
import { FACTIONS, type Clan } from "../game/types";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";
import { listClans, applyToClan } from "../net/api";
import { ClanTabBar } from "./ClanTabBar";
import { ClanCreatePanel } from "./ClanCreatePanel";

const ACCENT = "#b866ff";
const CLAN_KEYFRAMES = `
@keyframes ccPulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes ccSweep{0%{left:-45%}100%{left:115%}}
`;

type SortKey = "rank" | "level" | "name";
const SORTS: { key: SortKey; label: string; aria: string }[] = [
  { key: "rank", label: "RANK", aria: "Sort by season rank" },
  { key: "level", label: "MEMBERS", aria: "Sort by member count" },
  { key: "name", label: "NAME", aria: "Sort alphabetically" },
];

function SortButton({ label, aria, active, onClick }: { label: string; aria: string; active: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  return (
    <button
      onClick={onClick} aria-label={aria} {...handlers}
      style={{
        position: "relative", padding: "4px 9px", border: "none", cursor: "pointer",
        fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.16em",
        color: active ? "#eddcff" : "rgba(214,200,242,.55)",
        background: active ? `${ACCENT}2a` : "rgba(255,255,255,.03)",
        boxShadow: active ? `inset 0 0 0 1px ${ACCENT}88` : "inset 0 0 0 1px rgba(255,255,255,.06)",
        clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)",
        transform: pressed ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        filter: pressed ? "brightness(1.3)" : hover ? "brightness(1.18)" : "none",
        transition: "transform .13s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      {label}
    </button>
  );
}

// Renders a clan's ACTUAL stored crest (shape/symbol/colors from the I-09
// charter form — see backend/src/game/clanData.ts CREST_SHAPES for the same
// clip-path set), not a hash-derived placeholder. shadeHex/rgbaHex mirror
// the Kit's own shadeHex()/rgba() so band/face read identically here and in
// ClanCreatePanel's live preview.
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
function crestOf(c: Clan) {
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

function ClanRow({ c, isSelected, onPick }: { c: Clan; isSelected: boolean; onPick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const crest = crestOf(c);
  const full = c.openSlots <= 0;
  return (
    <div
      role="button" tabIndex={0} onClick={onPick} {...handlers}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(); }}
      aria-label={`${c.name} [${c.tag}] — ${c.memberCount}/${c.maxMembers} members, rank #${c.seasonRank}`}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", cursor: "pointer", overflow: "hidden",
        background: isSelected ? `${ACCENT}1c` : "rgba(255,255,255,.02)",
        boxShadow: isSelected ? `inset 0 0 0 1px ${ACCENT}66,inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.6)` : "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.6),inset 0 2px 4px rgba(0,0,0,.42)",
        clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)",
        transform: active ? "translateX(2px) translateY(1px)" : hover ? "translateX(3px)" : "none",
        transition: "transform .14s cubic-bezier(.2,.9,.25,1),background .2s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 9px,rgba(255,255,255,.03) 9px 10px,transparent 10px 19px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", width: 40, height: 40, flex: "0 0 auto", filter: `drop-shadow(0 2px 0 rgba(3,5,10,.9)) drop-shadow(0 0 6px ${crest.glow})` }}>
        <i style={{ position: "absolute", inset: 0, background: crest.band, clipPath: crest.clip }} />
        <i style={{ position: "absolute", inset: 2.5, background: crest.face, boxShadow: "inset 0 2px 5px rgba(0,0,0,.7)", clipPath: crest.clip }} />
        <b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontStyle: "normal", fontWeight: 400, fontSize: 17, lineHeight: 1, color: crest.symbolColor, textShadow: `0 0 8px ${crest.glow}` }}>{crest.symbol}</b>
      </div>
      <div style={{ position: "relative", display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <b style={{ flex: "0 1 auto", fontSize: 11.5, fontWeight: 700, color: "#f0f6ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</b>
          <small style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.14em", color: "rgba(240,246,255,.88)" }}>[{c.tag}]</small>
          <small style={{
            padding: "2px 6px", flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 6, letterSpacing: "0.16em",
            color: full ? "#ffd0d5" : "#9fe0ff", background: full ? "rgba(255,77,94,.16)" : "rgba(78,226,255,.12)",
            boxShadow: `inset 0 0 0 1px ${full ? "rgba(255,77,94,.45)" : "rgba(78,226,255,.4)"}`,
          }}>{full ? "FULL" : "RECRUITING"}</small>
        </div>
        <small style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.05em", color: "rgba(196,214,238,.68)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.motto || (c.tags.length ? c.tags.join(" · ") : "No motto filed.")}
        </small>
      </div>
      <div style={{ position: "relative", display: "grid", gap: 2, justifyItems: "end", flex: "0 0 auto" }}>
        <small style={{ fontFamily: "var(--font-display)", fontSize: 6.5, letterSpacing: "0.18em", color: crest.hex }}>{c.faction ? FACTIONS[c.faction]?.tag ?? "" : "—"}</small>
        <small style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontVariantNumeric: "tabular-nums", color: "rgba(214,230,248,.75)" }}>{c.memberCount}/{c.maxMembers}</small>
      </div>
      <div style={{ position: "relative", display: "grid", gap: 2, justifyItems: "end", width: 62, flex: "0 0 auto" }}>
        <small style={{ fontFamily: "var(--font-display)", fontSize: 6, letterSpacing: "0.16em", color: "rgba(190,214,236,.5)" }}>RANK</small>
        <b style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontVariantNumeric: "tabular-nums", color: crest.hex, textShadow: `0 0 8px ${crest.glow}` }}>#{c.seasonRank}</b>
      </div>
    </div>
  );
}

export function ClanDirectoryPanel() {
  const showClan = useGame((s) => s.showClan);
  const clanTab = useGame((s) => s.clanTab);
  const player = useGame((s) => s.player);
  // Directory is the "no clan" tab — once you're in a clan, showClan opens
  // straight into the Hall (see ClanHallPanel's redirect effect below) and
  // this tab only reappears if you deliberately switch back to it to browse
  // other charters, so it stays mountable even with a clan.
  const show = showClan && clanTab === "directory";

  const [playToken] = useState(0);
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const [clans, setClans] = useState<Clan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("rank");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (show) { setMounted(true); setClosing(false); }
    // Switching to the Hall tab (window stays open, showClan is still true)
    // unmounts this panel immediately with no close animation — the two are
    // full-screen dimmer overlays (rgba background) and playing the ~1.7s
    // print-portal close animation while the Hall's own open animation runs
    // stacks both dimmers on top of each other, reading as a near-black
    // screen for that whole window. The animation is reserved for an actual
    // close (X/ESC/click-outside → showClan goes false).
    else if (mounted && !showClan) { setClosing(true); }
    else if (mounted && showClan) { setMounted(false); setClosing(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, showClan]);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    listClans()
      .then((data) => { if (!cancelled) setClans(data.clans); })
      .catch((err) => { if (!cancelled) setLoadError(err.message || "Failed to load charters"); });
    return () => { cancelled = true; };
  }, [show, player.clan]);

  const filtered = useMemo(() => {
    if (!clans) return [];
    const q = query.trim().toLowerCase();
    let list = q ? clans.filter((c) => c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q)) : clans;
    list = [...list];
    if (sort === "rank") list.sort((a, b) => a.seasonRank - b.seasonRank);
    else if (sort === "level") list.sort((a, b) => b.memberCount - a.memberCount);
    else list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [clans, query, sort]);

  if (!mounted) return null;

  const close = () => { gameState.showClan = false; bump(); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); };

  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;
  const crest = selected ? crestOf(selected) : null;

  const levelOk = selected ? player.level >= selected.minLevel : true;
  const honorOk = selected ? player.honor >= selected.minHonor : true;
  const slotsOk = selected ? selected.openSlots > 0 : true;
  const canApply = !!selected && levelOk && honorOk && slotsOk && !applying;

  const doApply = async () => {
    if (!selected || !canApply) return;
    setApplying(true);
    try {
      await applyToClan(selected.id);
      gameState.player.clan = selected.name;
      gameState.player.clanId = selected.id;
      gameState.clanTab = "hall";
      save();
      setToast({ text: `Joined ${selected.name}.` });
      bump();
    } catch (err: any) {
      setToast({ text: err.message || "Application failed.", bad: true });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "grid", placeItems: "center", background: "rgba(2,4,12,.7)" }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <style>{CLAN_KEYFRAMES}</style>
      <PrintPortal
        playToken={playToken}
        accent={ACCENT}
        duration={1300}
        chamfer={34}
        closing={closing}
        onClosed={closing ? onPortalClosed : undefined}
        style={{ width: "min(94vw, 1180px)" }}
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
              <i style={{ width: 7, height: 7, flex: "0 0 auto", background: ACCENT, boxShadow: `0 0 10px ${ACCENT}`, transform: "rotate(45deg)", animation: "ccPulse 1.9s ease-in-out infinite" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 14.2, letterSpacing: "0.24em", color: "#eddcff" }}>CLAN DIRECTORY</b>
              {player.clan ? (
                <small style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.16em", color: "rgba(226,236,250,.9)", background: `${ACCENT}29`, boxShadow: `inset 0 0 0 1px ${ACCENT}73` }}>{player.clan}</small>
              ) : (
                <small style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.16em", color: "rgba(255,208,213,.9)", background: "rgba(255,77,94,.16)", boxShadow: "inset 0 0 0 1px rgba(255,77,94,.45)" }}>NO CLAN</small>
              )}
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 12.4, letterSpacing: "0.1em", color: "rgba(214,200,242,.72)" }}>PILOT LV {player.level} · HONOR {player.honor.toLocaleString()}</small>
              <span style={{ flex: 1 }} />
              {player.clan && <ClanTabBar active="directory" />}
              <small style={{ fontFamily: "var(--font-mono)", fontSize: 12.4, letterSpacing: "0.08em", color: "rgba(201,168,255,.8)" }}>{filtered.length} CHARTERS</small>
              <CloseButton onClick={close} title="Close" size={24} fontSize={10} />
            </div>

            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 300px", gap: 12, alignItems: "stretch" }}>

              {/* left — charter list */}
              <div style={{ position: "relative", display: "grid", gap: 9, alignContent: "start", padding: "22px 20px", border: `2px solid ${ACCENT}80`, background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 0 0 2px rgba(243,232,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(201,168,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(126,72,176,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(62,32,86,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "0 2px 2px" }}>
                  <b style={{ flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 12.4, letterSpacing: "0.24em", color: "#eddcff" }}>OPEN CHARTERS</b>
                  <span style={{ position: "relative", flex: 1, display: "block" }}>
                    <input
                      value={query} onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name or tag" aria-label="Search charters by name or tag"
                      style={{
                        width: "100%", boxSizing: "border-box", padding: "6px 10px 6px 22px", border: "none", outline: "none",
                        fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.04em", color: "#f2f7ff",
                        background: "linear-gradient(180deg,#0a0810,#040309)",
                        boxShadow: "inset 0 3px 6px rgba(0,0,0,.8),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -1px 0 rgba(201,168,255,.16)",
                        clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
                      }}
                    />
                    <i style={{ position: "absolute", left: 9, top: 0, bottom: 0, display: "grid", placeItems: "center", fontStyle: "normal", fontSize: 10.6, color: "rgba(201,168,255,.7)", pointerEvents: "none" }}>⌕</i>
                  </span>
                  {SORTS.map((s) => (
                    <SortButton key={s.key} label={s.label} aria={s.aria} active={sort === s.key} onClick={() => setSort(s.key)} />
                  ))}
                </div>

                <div style={{ position: "relative", display: "grid", gap: 6 }}>
                  {loadError && <small style={{ padding: "16px 4px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "#ff8a94" }}>{loadError}</small>}
                  {!loadError && clans === null && <small style={{ padding: "16px 4px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(190,214,236,.45)" }}>Loading charters…</small>}
                  {clans && filtered.map((c) => (
                    <ClanRow key={c.id} c={c} isSelected={selected?.id === c.id} onPick={() => setSelectedId(c.id)} />
                  ))}
                  {clans && filtered.length === 0 && (
                    <small style={{ padding: "16px 4px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(190,214,236,.45)" }}>No charter matches that name or tag.</small>
                  )}
                </div>
              </div>

              {/* right — dossier */}
              <div style={{ position: "relative", display: "grid", gap: 9, alignContent: "start", gridTemplateRows: "auto auto auto 1fr auto", padding: "22px 20px", border: `2px solid ${ACCENT}80`, background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 0 0 2px rgba(243,232,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(201,168,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(126,72,176,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(62,32,86,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>

                {selected && crest ? (
                  <>
                    <div style={{ position: "relative", display: "grid", gap: 10, padding: "13px 13px 14px", overflow: "hidden", background: `radial-gradient(130% 100% at 50% 0%,${crest.glow},transparent 74%),linear-gradient(180deg,#141020,#06050c)`, boxShadow: `inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 ${ACCENT}33`, clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                      <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(170,140,220,.05) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
                      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ position: "relative", width: 64, height: 64, flex: "0 0 auto", filter: `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 7px 9px rgba(0,0,0,.7)) drop-shadow(0 0 16px ${crest.glow})` }}>
                          <i style={{ position: "absolute", inset: 0, background: crest.band, clipPath: crest.clip }} />
                          <i style={{ position: "absolute", inset: 3, background: crest.face, boxShadow: "inset 0 3px 8px rgba(0,0,0,.7)", clipPath: crest.clip }} />
                          <b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontStyle: "normal", fontWeight: 400, fontSize: 26, lineHeight: 1, color: crest.symbolColor, textShadow: `0 0 10px ${crest.glow}` }}>{crest.symbol}</b>
                        </div>
                        <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                          <b style={{ fontFamily: "var(--font-display)", fontSize: 12.5, letterSpacing: "0.06em", color: "#eddcff", textShadow: `0 0 12px ${crest.glow}` }}>{selected.name}</b>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <small style={{ padding: "2px 7px", fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.16em", color: crest.hex, background: `${ACCENT}22`, boxShadow: `inset 0 0 0 1px ${ACCENT}55` }}>{selected.faction ? FACTIONS[selected.faction]?.tag ?? "" : "NEUTRAL"}</small>
                            <small style={{ fontFamily: "var(--font-mono)", fontSize: 12.4, color: "rgba(214,200,242,.8)" }}>SEASON RANK #{selected.seasonRank}</small>
                          </div>
                        </div>
                      </div>
                      <p style={{ position: "relative", margin: 0, fontSize: 10.5, lineHeight: 1.55, color: "rgba(218,232,248,.84)" }}>{selected.motto || "This charter has not filed a motto."}</p>
                    </div>

                    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { k: "MEMBERS", v: `${selected.memberCount}/${selected.maxMembers}`, hex: crest.hex },
                        { k: "OPEN SLOTS", v: `${selected.openSlots}`, hex: selected.openSlots > 0 ? "#7cffb0" : "#ff8a94" },
                        { k: "TOTAL HONOR", v: selected.totalHonor.toLocaleString(), hex: crest.hex },
                        { k: "SEASON RANK", v: `#${selected.seasonRank}`, hex: crest.hex },
                      ].map((t) => (
                        <div key={t.k} style={{ display: "grid", gap: 2, padding: "8px 10px", background: "linear-gradient(180deg,#0b0910,#050409)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(201,168,255,.14)" }}>
                          <small style={{ fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.2em", color: t.hex }}>{t.k}</small>
                          <b style={{ fontFamily: "var(--font-mono)", fontSize: 14.2, fontVariantNumeric: "tabular-nums", color: "#dbe9fb" }}>{t.v}</b>
                        </div>
                      ))}
                    </div>

                    <div style={{ position: "relative", display: "grid", gap: 6, padding: "11px 12px 12px", overflow: "hidden", background: "linear-gradient(180deg,#141020,#06050c)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(201,168,255,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                      <small style={{ fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>ENTRY REQUIREMENTS</small>
                      {[
                        { k: "PILOT LEVEL", v: `${selected.minLevel}+`, ok: levelOk },
                        { k: "HONOR", v: selected.minHonor.toLocaleString(), ok: honorOk },
                        { k: "OPEN SLOT", v: slotsOk ? "AVAILABLE" : "NONE", ok: slotsOk },
                      ].map((q) => (
                        <div key={q.k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <i style={{ width: 5, height: 5, flex: "0 0 auto", background: q.ok ? "#7cffb0" : "#ff4d5e", boxShadow: `0 0 7px ${q.ok ? "#7cffb0" : "#ff4d5e"}`, transform: "rotate(45deg)" }} />
                          <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.05em", color: "rgba(196,214,238,.72)" }}>{q.k}</small>
                          <small style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontVariantNumeric: "tabular-nums", color: q.ok ? "#9fe0ff" : "#ff8a94" }}>{q.v}</small>
                        </div>
                      ))}
                    </div>

                    <div style={{ position: "relative", display: "grid", gap: 7, alignContent: "start", padding: "11px 12px 12px", overflow: "hidden", background: "linear-gradient(180deg,#141020,#06050c)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(201,168,255,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                      <small style={{ fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>RECRUITING FOR</small>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {selected.tags.length === 0 && <small style={{ fontSize: 10.5, color: "rgba(190,214,236,.4)" }}>No focus tags filed.</small>}
                        {selected.tags.map((g) => (
                          <small key={g} style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.16em", color: crest.hex, background: `${ACCENT}1c`, boxShadow: `inset 0 0 0 1px ${ACCENT}55`, clipPath: "polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px)" }}>{g}</small>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "grid", placeItems: "center", padding: "20px 10px" }}>
                    <small style={{ fontSize: 11, color: "rgba(190,214,236,.5)", textAlign: "center" }}>{clans === null ? "Loading…" : "No charter selected."}</small>
                  </div>
                )}

                {/* Apply/Found only make sense with no clan — browsing other
                    charters while already in one (via the tab bar) is
                    read-only here. Always visible regardless of selection
                    when clanless: founding a clan doesn't require picking one
                    from the list first. This was previously nested inside the
                    `selected && crest` branch, which meant an empty/loading
                    directory left no way to ever reach the create flow. */}
                {!player.clan && (
                  <div style={{ position: "relative", display: "grid", gap: 7 }}>
                    <ApplyButton disabled={!canApply} label={applying ? "APPLYING…" : !selected ? "SELECT A CHARTER" : slotsOk ? "APPLY TO JOIN" : "CHARTER FULL"} onClick={doApply} />
                    <FoundButton onClick={() => setShowCreate(true)} />
                    {toast && (
                      <small style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10.6, letterSpacing: "0.04em", color: toast.bad ? "#ff8a94" : "#7cffb0" }}>{toast.text}</small>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </PrintPortal>

      {showCreate && (
        <ClanCreatePanel
          onClose={() => setShowCreate(false)}
          onCreated={(name, id) => {
            setShowCreate(false);
            gameState.player.clan = name;
            gameState.player.clanId = id;
            gameState.clanTab = "hall";
            save();
            bump();
          }}
        />
      )}
    </div>
  );
}

function ApplyButton({ disabled, label, onClick }: { disabled: boolean; label: string; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={label} {...(disabled ? {} : handlers)}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: disabled ? "default" : "pointer",
        filter: disabled ? "grayscale(.6) brightness(.7)" : active ? "brightness(1.32)" : hover ? "brightness(1.14)" : "none",
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: `linear-gradient(150deg,#e0c3ff,${ACCENT} 46%,#3a1a5c)`, clipPath: "polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(158deg,#c48fff,#6a2ea6 58%,#2a1042)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: 3, padding: "10px 12px", overflow: "hidden", background: "linear-gradient(180deg,#2a1a40,#100a1a)", color: "#f3e8ff", fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.18em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,190,255,.25)", clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }}>
        <i style={{ position: "absolute", left: 7, right: 7, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(236,220,255,.7),transparent)" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${ACCENT},transparent)`, opacity: 0.8 }} />
        <span style={{ position: "relative" }}>{label}</span>
      </span>
    </button>
  );
}

function FoundButton({ onClick }: { onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      onClick={onClick} aria-label="Create your own clan for 250,000 credits" {...handlers}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer",
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        filter: active ? "brightness(1.3)" : hover ? "brightness(1.14)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#f7ecd0,#c9a34e 44%,#5c4318)", clipPath: "polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(150deg,#d9b463,#4a3413 58%,#241a09)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, margin: 3, padding: "9px 12px", overflow: "hidden", background: "linear-gradient(180deg,#3a2c10,#150f05)", color: "#ffeec2", fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.16em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(255,226,160,.25)", clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }}>
        <i style={{ position: "absolute", left: 7, right: 7, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(255,244,214,.7),transparent)" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(232,185,77,.8),transparent)", opacity: 0.75 }} />
        <i style={{ position: "relative", fontStyle: "normal", fontSize: 11 }}>✦</i>
        <span style={{ position: "relative" }}>CREATE A CLAN · 250,000</span>
      </span>
    </button>
  );
}

