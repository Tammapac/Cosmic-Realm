import { useEffect, useState } from "react";
import { state, bump, useGame, ATTRIBUTES, attrValue, attrSpent, attrBudget, buyAttribute } from "../game/store";
import { effectiveStats } from "../game/loop";
import { getLeaderboard } from "../net/api";
import { FACTIONS, SHIP_CLASSES, rankFor } from "../game/types";

// ── Pilot dossier: MMORPG-style character sheet ─────────────────────────────
// Opened by clicking the rank octagon in the top-left avatar console.
//  - ATTRIBUTES: spendable stat points (2/level, applied server-side too)
//  - CAREER PATHS: passive ranks that level from what you actually do
//    (kills → Bounty Hunter, mining → Miner, credits earned → Trader)
//  - RANKINGS: server leaderboard (honor / level / kills)

const PATHS = [
  {
    id: "hunter", name: "BOUNTY HUNTER", icon: "⌖", color: "#ff5c6c",
    metric: (m: any) => (m?.totalKills ?? 0) + (m?.bossKills ?? 0) * 10,
    unit: "kills",
    tiers: [0, 50, 150, 400, 1000, 2500, 6000, 15000, 40000, 100000],
    titles: ["Recruit", "Gunhand", "Stalker", "Marauder", "Executioner", "Warlord", "Reaper", "Dread Pilot", "Void Slayer", "Legend"],
  },
  {
    id: "miner", name: "MINER", icon: "⛏", color: "#c69060",
    metric: (m: any) => m?.totalMined ?? 0,
    unit: "ore",
    tiers: [0, 40, 120, 300, 800, 2000, 5000, 12000, 30000, 80000],
    titles: ["Prospector", "Digger", "Rockbreaker", "Vein Chaser", "Drill Master", "Core Splitter", "Belt Baron", "Depth Lord", "Asteroid King", "Legend"],
  },
  {
    id: "trader", name: "TRADER", icon: "⇄", color: "#ffd24a",
    metric: (m: any) => m?.totalCreditsEarned ?? 0,
    unit: "cr earned",
    tiers: [0, 5000, 20000, 60000, 150000, 400000, 1000000, 2500000, 6000000, 15000000],
    titles: ["Peddler", "Hauler", "Merchant", "Broker", "Financier", "Magnate", "Tycoon", "Cartel Boss", "Trade Prince", "Legend"],
  },
];

function pathProgress(path: (typeof PATHS)[number], milestones: any) {
  const v = path.metric(milestones);
  let lv = 0;
  for (let i = 0; i < path.tiers.length; i++) if (v >= path.tiers[i]) lv = i;
  const cur = path.tiers[lv];
  const next = path.tiers[lv + 1];
  const pct = next != null ? Math.min(100, ((v - cur) / Math.max(1, next - cur)) * 100) : 100;
  return { v, lv: lv + 1, title: path.titles[lv], next, pct, maxed: next == null };
}

type LbRow = {
  playerName: string; level: number; honor: number; totalKills: number;
  faction: string | null; clanTag: string | null;
};

export function PlayerStatsPanel() {
  const show = useGame((s) => s.showPlayerStats);
  useGame((s) => s.tick);
  const player = useGame((s) => s.player);
  const [tab, setTab] = useState<"profile" | "rankings">("profile");
  const [sort, setSort] = useState<"honor" | "level" | "kills">("honor");
  const [rows, setRows] = useState<LbRow[] | null>(null);
  const [lbError, setLbError] = useState(false);

  useEffect(() => {
    if (!show || tab !== "rankings") return;
    let alive = true;
    setRows(null); setLbError(false);
    getLeaderboard(sort, 25)
      .then((d: any) => { if (alive) setRows(d.leaderboard ?? []); })
      .catch(() => { if (alive) setLbError(true); });
    return () => { alive = false; };
  }, [show, tab, sort]);

  if (!show) return null;

  const close = () => { state.showPlayerStats = false; bump(); };
  const rank = rankFor(player.honor);
  const cls = SHIP_CLASSES[player.shipClass];
  const stats = effectiveStats();
  const free = attrBudget() - attrSpent();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.62)", pointerEvents: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="panel panel-framed panel-gold relative"
        style={{ width: "min(680px, 94vw)", maxHeight: "88vh", display: "flex", flexDirection: "column" }}
      >
        {/* glass-band title */}
        <div
          style={{
            position: "absolute", top: -37, left: "18%", right: "18%", height: 30,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#3a2000", fontWeight: 800, fontSize: 14, letterSpacing: "0.32em",
            fontFamily: "var(--font-display)", textShadow: "0 1px 0 rgba(255,255,255,0.25)",
            userSelect: "none", pointerEvents: "none",
          }}
        >
          PILOT DOSSIER
        </div>
        <button className="gbtn gbtn-red" style={{ position: "absolute", top: -38, right: -16, padding: "3px 10px", fontSize: 11 }} onClick={close}>✕</button>

        {/* identity strip */}
        <div className="flex items-center gap-3 mb-3 min-w-0">
          <img
            src={`/assets/ui/ranks/rank_${String(rank.index + 1).padStart(2, "0")}.png`}
            alt="" draggable={false}
            style={{ height: 30, width: "auto", filter: `drop-shadow(0 0 8px ${rank.color}66) drop-shadow(0 1px 2px #000)` }}
          />
          <div className="min-w-0">
            <div className="font-bold tracking-widest truncate" style={{ color: "#ffe9c4", fontSize: 15, fontFamily: "var(--font-display)" }}>
              {player.name}
              {player.faction && (
                <span style={{ color: FACTIONS[player.faction].color, fontSize: 12 }}> [{FACTIONS[player.faction].tag}]</span>
              )}
            </div>
            <div className="text-[11px]" style={{ color: rank.color }}>
              {rank.name.toUpperCase()} · LEVEL {player.level} · {cls.name.toUpperCase()}
            </div>
          </div>
          <div className="ml-auto flex gap-1.5 shrink-0">
            <button className={`gbtn ${tab === "profile" ? "gbtn-gold" : ""}`} style={{ padding: "4px 14px", fontSize: 11 }} onClick={() => setTab("profile")}>PROFILE</button>
            <button className={`gbtn ${tab === "rankings" ? "gbtn-gold" : ""}`} style={{ padding: "4px 14px", fontSize: 11 }} onClick={() => setTab("rankings")}>RANKINGS</button>
          </div>
        </div>

        {tab === "profile" ? (
          <div className="overflow-y-auto min-h-0 space-y-3" style={{ paddingRight: 4 }}>
            {/* attributes */}
            <div className="dob-hdr">
              <span>◈ ATTRIBUTES</span>
              <span className="tabular-nums" style={{ color: free > 0 ? "var(--accent-amber)" : "#8f96a6" }}>
                {free} POINT{free === 1 ? "" : "S"} AVAILABLE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ATTRIBUTES.map((a) => {
                const v = attrValue(a.id);
                return (
                  <div key={a.id} className="console-sq flex items-center gap-2.5" style={{ padding: "8px 10px" }}>
                    <div className="shrink-0 flex items-center justify-center"
                      style={{ width: 34, height: 34, border: `1px solid ${a.color}66`, background: `${a.color}14`, color: a.color, fontSize: 17 }}>
                      {a.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold tracking-widest text-[11px]" style={{ color: a.color, fontFamily: "var(--font-display)" }}>{a.name}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-mute)" }}>{a.desc}</div>
                    </div>
                    <div className="tabular-nums font-bold text-[15px] shrink-0" style={{ color: v > 0 ? a.color : "#4a4c58" }}>{v}</div>
                    <button
                      className="gbtn gbtn-gold shrink-0"
                      style={{ padding: "2px 9px", fontSize: 13, opacity: free > 0 ? 1 : 0.45 }}
                      disabled={free <= 0}
                      title={free > 0 ? `Spend 1 point on ${a.name}` : "No points — earn 2 per level"}
                      onClick={() => buyAttribute(a.id)}
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-mute)" }}>
              2 points per level · applied to your live ship stats: DMG {Math.round(stats.damage)} · HUL {Math.round(stats.hullMax)} · SHD {Math.round(stats.shieldMax)} · SPD {Math.round(stats.speed)}
            </div>

            {/* career paths */}
            <div className="dob-hdr"><span>★ CAREER PATHS</span><span style={{ color: "#8f96a6" }}>LEVEL UP BY PLAYING</span></div>
            <div className="space-y-2">
              {PATHS.map((p) => {
                const pr = pathProgress(p, player.milestones);
                return (
                  <div key={p.id} className="console-sq" style={{ padding: "8px 10px" }}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="shrink-0 flex items-center justify-center"
                        style={{ width: 30, height: 30, border: `1px solid ${p.color}66`, background: `${p.color}14`, color: p.color, fontSize: 15 }}>
                        {p.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold tracking-widest text-[11px]" style={{ color: p.color, fontFamily: "var(--font-display)" }}>{p.name}</span>
                          <span className="font-bold tabular-nums px-1 text-[10px]" style={{ color: p.color, background: `${p.color}18`, border: `1px solid ${p.color}55` }}>
                            LV {pr.lv}
                          </span>
                          <span className="text-[11px] italic" style={{ color: "#b8bdca" }}>"{pr.title}"</span>
                        </div>
                        <div className="text-[10px] tabular-nums" style={{ color: "var(--text-mute)" }}>
                          {pr.v.toLocaleString()} {p.unit}{pr.maxed ? " · MAX RANK" : ` · next rank at ${pr.next!.toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ height: 5, background: "#000a", border: `1px solid ${p.color}33` }}>
                      <div style={{ width: `${pr.pct}%`, height: "100%", background: p.color, boxShadow: `0 0 6px ${p.color}`, transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto min-h-0 flex flex-col" style={{ paddingRight: 4 }}>
            <div className="dob-hdr shrink-0" style={{ marginBottom: 8 }}>
              <span>♛ GALACTIC RANKINGS</span>
              <span className="flex gap-1">
                {(["honor", "level", "kills"] as const).map((k) => (
                  <button key={k} className={`gbtn ${sort === k ? "gbtn-gold" : ""}`} style={{ padding: "2px 9px", fontSize: 10 }} onClick={() => setSort(k)}>
                    {k.toUpperCase()}
                  </button>
                ))}
              </span>
            </div>
            <div className="grid gap-2 px-2 py-1 text-[10px] tracking-widest" style={{ color: "var(--text-mute)", gridTemplateColumns: "34px 1fr 60px 70px 70px" }}>
              <div>#</div><div>PILOT</div><div className="text-right">LEVEL</div><div className="text-right">HONOR</div><div className="text-right">KILLS</div>
            </div>
            {rows === null && !lbError && <div className="text-mute text-sm italic p-2">Contacting ranking network…</div>}
            {lbError && <div className="text-sm italic p-2" style={{ color: "#ff5c6c" }}>Ranking network unreachable.</div>}
            {rows?.map((r, i) => {
              const me = r.playerName === player.name;
              const medal = i === 0 ? "#ffd24a" : i === 1 ? "#c9d2e0" : i === 2 ? "#c69060" : undefined;
              return (
                <div
                  key={r.playerName + i}
                  className="grid gap-2 items-center px-2 py-1.5 border-b"
                  style={{
                    gridTemplateColumns: "34px 1fr 60px 70px 70px",
                    borderColor: "var(--border-soft)",
                    background: me ? "rgba(247,168,50,0.10)" : i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                  }}
                >
                  <div className="font-bold tabular-nums" style={{ color: medal ?? "#8f96a6" }}>{i + 1}</div>
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="truncate font-bold text-[12px]" style={{ color: me ? "var(--accent-amber)" : "#ffe9c4" }}>{r.playerName}</span>
                    {r.clanTag && <span className="text-[10px] shrink-0" style={{ color: "#4ee2ff" }}>[{r.clanTag}]</span>}
                    {r.faction && (FACTIONS as any)[r.faction] && (
                      <span className="text-[10px] shrink-0" style={{ color: (FACTIONS as any)[r.faction].color }}>{(FACTIONS as any)[r.faction].tag}</span>
                    )}
                  </div>
                  <div className="text-right tabular-nums text-[12px]" style={{ color: "var(--accent-amber)" }}>{r.level}</div>
                  <div className="text-right tabular-nums text-[12px]" style={{ color: "#c9a8ff" }}>{r.honor.toLocaleString()}</div>
                  <div className="text-right tabular-nums text-[12px]" style={{ color: "#ff5c6c" }}>{(r.totalKills ?? 0).toLocaleString()}</div>
                </div>
              );
            })}
            {rows && rows.length === 0 && <div className="text-mute text-sm italic p-2">No ranked pilots yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
