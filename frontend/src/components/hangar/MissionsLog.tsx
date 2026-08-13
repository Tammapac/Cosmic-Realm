import React from "react";
import styles from "./HangarDockOverlay.module.css";
import { HeroFrame, PanelHeader, SubHeader, TabIndicator, CardFrame } from "./HeroFrame";
import {
  MISSION_TYPES, DAILY_MISSIONS, VARIANT_TIERS, LEVEL_MAPS,
  buildMissions, MISSION_PANEL_W, MISSION_TAB_PCT,
  type MissionTypeKey, type Mission,
} from "./Missions.constants";

/**
 * S-03 · Missions Log
 *
 * MIGRATED from the design export, not rebuilt:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (section "S-03 · MISSIONS LOG")
 *
 * Two views behind six tabs: DAILY (a 3-column card grid) and one ladder per
 * mission type (level bands as an accordion, six difficulty variants inside
 * each). The ladder content is generated — see buildMissions() in
 * Missions.constants.ts, which is a verbatim port of the export's own generator.
 *
 * Locking is the export's rule: a band is locked when its level exceeds the
 * player's. That level is game state, so it arrives as a prop.
 */

// The export writes "font-family:Orbitron,sans-serif" literally on 154 rules.
// NOT var(--font-display): that token is the project's Kenney Future Narrow,
// whose U+2039/U+203A chevrons are round — the carousel arrows then read as
// circles instead of the design's sharp angular arrows. Orbitron is loaded in
// index.html for exactly this reason.
const display: React.CSSProperties = { fontFamily: "Orbitron,sans-serif" };
// The export writes "font-family:'JetBrains Mono',monospace" on 86 rules.
// --font-mono was never defined anywhere in this project, so this resolved
// to nothing and every figure fell back to the browser default.
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace" };

/** Level bands shown per ladder page. The export renders the ladder in pages
 *  with a "‹ LV n+–m+ · PAGE x/y ›" control underneath
 *  (hint-placeholder-count="3" on the band loop), not as one long scroll. */
const LEVEL_BANDS_PER_PAGE = 3;

export interface MissionsLogProps {
  playerLevel?: number;
  trackedCount?: number;
  trackedCap?: number;
  /** Daily cards. Defaults to the export's DAILY_MISSIONS demo set; the host
   *  passes the player's REAL dailies so progress and claim state are live. */
  dailies?: DailyCard[];
  /** Which ladder rows are already accepted, keyed by mission id. Lets the host
   *  drive accepted state from real game data instead of the panel's own local
   *  toggle. */
  acceptedIds?: Record<string, boolean>;
  onAccept?: (mission: Mission) => void;
  onReroll?: () => void;
  onClose?: () => void;
}

/** A daily card with live progress — the export's own row shape
 *  ({{ dm.name }}, {{ dm.obj }}, {{ dm.curFmt }} / {{ dm.maxFmt }}, rewards). */
export interface DailyCard {
  name: string;
  obj: string;
  cur: number;
  max: number;
  credits: number;
  honor: number;
  exp: number;
  icon: string;
  /** Accent colour for the card's glyph and drop-shadow. */
  hex: string;
  /** Real mission id, when the card comes from live game data. */
  id?: string;
  completed?: boolean;
  claimed?: boolean;
}

/** Reward chips shared by daily cards and ladder rows. */
function Rewards({ credits, honor, exp }: { credits: string; honor: number | string; exp: string }) {
  const chip: React.CSSProperties = { ...mono, fontSize: 8, letterSpacing: ".04em" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ ...chip, color: "#e8b94d", textShadow: "0 0 6px rgba(232,185,77,.45)" }}>CREDITS {credits}</span>
      <span style={{ ...chip, color: "#ff5cf0", textShadow: "0 0 6px rgba(255,92,240,.4)" }}>HONOR {honor}</span>
      <span style={{ ...chip, color: "#4ee2ff", textShadow: "0 0 6px rgba(78,226,255,.4)" }}>EXP {exp}</span>
    </div>
  );
}

function AcceptButton({
  accepted, onClick, label,
}: { accepted: boolean; onClick?: () => void; label: string }) {
  const hex = accepted ? "#5cff8a" : "#ff8a3d";
  const text = accepted ? "✓ ACCEPTED" : "ACCEPT";
  const fg = accepted ? "#eaffef" : "#fff2e2";
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={styles.cta}
      style={{
        position: "relative", display: "grid", justifyItems: "center", gap: 5,
        padding: "5px 4px", border: "none", background: "none", width: "100%",
        cursor: "pointer", transition: "filter .14s ease",
      }}
    >
      <i className={styles.pulse} style={{ width: "100%", height: 2, background: `linear-gradient(90deg,transparent,${hex} 12%,#ffe4c9 50%,${hex} 88%,transparent)`, boxShadow: `0 0 6px ${hex},0 0 16px ${hex}cc` }} />
      <b style={{ ...display, fontSize: 9, fontWeight: 900, letterSpacing: ".22em", color: fg, textShadow: `0 0 8px ${hex},0 0 18px ${hex}e6` }}>{text}</b>
      <i className={styles.pulse} style={{ width: "100%", height: 2, background: `linear-gradient(90deg,transparent,${hex} 12%,#ffe4c9 50%,${hex} 88%,transparent)`, boxShadow: `0 0 6px ${hex},0 0 16px ${hex}cc` }} />
    </button>
  );
}

export function MissionsLog({
  playerLevel = 47,
  trackedCount = 1,
  trackedCap = 3,
  dailies,
  acceptedIds,
  onAccept,
  onReroll,
  onClose,
}: MissionsLogProps) {
  const [tab, setTab] = React.useState<"daily" | MissionTypeKey>("daily");
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [accepted, setAccepted] = React.useState<Record<string, boolean>>({});
  // Ladder page — the export shows LEVEL_BANDS_PER_PAGE bands at a time with a
  // "‹ LV n+–m+ · PAGE x/y ›" pager underneath, not the whole 15-band ladder.
  const [page, setPage] = React.useState(0);

  const tabs = React.useMemo(
    () => [{ key: "daily" as const, label: "DAILY", icon: "★", hex: "#e8b94d" }, ...MISSION_TYPES],
    [],
  );
  const tabIdx = tabs.findIndex((t) => t.key === tab);
  const isDaily = tab === "daily";

  /** Ladder rows for the active type, grouped into level bands of 6. */
  const groups = React.useMemo(() => {
    if (isDaily) return [];
    const list = buildMissions(tab as MissionTypeKey, playerLevel);
    const n = VARIANT_TIERS.length;
    const out: { level: number; map: string; locked: boolean; items: Mission[] }[] = [];
    for (let g = 0; g * n < list.length; g++) {
      const items = list.slice(g * n, g * n + n);
      if (!items.length) continue;
      out.push({ level: LEVEL_MAPS[g][0], map: LEVEL_MAPS[g][1], locked: items[0].locked, items });
    }
    return out;
  }, [tab, isDaily, playerLevel]);

  // Pager over the level bands (the export pages the ladder rather than
  // scrolling all 15 bands at once).
  const totalPages = Math.max(1, Math.ceil(groups.length / LEVEL_BANDS_PER_PAGE));
  const pageIdx = Math.min(page, totalPages - 1);
  const pageGroups = groups.slice(
    pageIdx * LEVEL_BANDS_PER_PAGE,
    pageIdx * LEVEL_BANDS_PER_PAGE + LEVEL_BANDS_PER_PAGE,
  );

  // A new tab rebuilds the ladder, so the page must not stay on a band the new
  // list may not have.
  React.useEffect(() => { setPage(0); setExpanded(null); }, [tab]);

  const accept = (m: Mission) => {
    setAccepted((a) => ({ ...a, [m.id]: !a[m.id] }));
    onAccept?.(m);
  };

  /** Daily cards: the player's real dailies when supplied, the export's demo
   *  set otherwise. */
  const dailyCards: DailyCard[] = dailies ?? DAILY_MISSIONS;

  /** Accepted state: host-driven when acceptedIds is supplied, local otherwise. */
  const isAccepted = (m: Mission) => acceptedIds?.[m.id] ?? !!accepted[m.id];

  return (
    <div
      style={{
        position: "relative", padding: "40px 24px", display: "grid", placeItems: "center",
        background: "radial-gradient(600px 360px at 50% 26%,rgba(255,138,61,.1),transparent 70%),#05040a",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,.6)",
      }}
    >
      <HeroFrame width={MISSION_PANEL_W} chamfer={22}>
        <PanelHeader glyph="▣" title="MISSIONS" onClose={onClose} closeLabel="Close mission log" />

        <div style={{ display: "grid", gap: 10, padding: "16px 20px 8px" }}>
          <SubHeader glyph="▣" title="MISSION LOG">
            <small style={{ fontSize: 8.5, letterSpacing: ".14em", color: "rgba(210,190,175,.55)", fontWeight: 700 }}>
              OBJECTIVES · CREDITS · HONOR
            </small>
            <span style={{ ...mono, fontSize: 9, letterSpacing: ".04em", color: "#5cff8a", textShadow: "0 0 6px rgba(92,255,138,.5)" }}>
              TRACKED {trackedCount} / {trackedCap}
            </span>
          </SubHeader>

          {/* type tabs */}
          <div
            style={{
              position: "relative", display: "flex", alignItems: "stretch", gap: 1, overflow: "hidden",
              background: "rgba(4,8,16,.55)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)",
              clipPath: "polygon(10px 0,100% 0,100% 100%,0 100%,0 10px)",
            }}
          >
            {tabs.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  aria-label={t.label}
                  onClick={() => { setTab(t.key as "daily" | MissionTypeKey); setExpanded(null); }}
                  className={styles.tabBtn}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    padding: "9px 6px", border: "none", cursor: "pointer",
                    background: on ? "rgba(255,138,61,.14)" : "none",
                    color: on ? "#ffd9b8" : "rgba(226,210,196,.72)",
                    ...display, fontSize: 8.5, letterSpacing: ".12em", fontWeight: 700,
                  }}
                >
                  <i style={{ fontStyle: "normal", fontSize: 10, color: t.hex }}>{t.icon}</i>
                  {t.label}
                </button>
              );
            })}
            {tabIdx >= 0 && (
              <>
                <TabIndicator leftPct={tabIdx * MISSION_TAB_PCT} widthPct={MISSION_TAB_PCT} edge="top" />
                <TabIndicator leftPct={tabIdx * MISSION_TAB_PCT} widthPct={MISSION_TAB_PCT} edge="bottom" />
              </>
            )}
          </div>

          <small style={{ fontSize: 8.5, letterSpacing: ".03em", color: "rgba(210,190,175,.55)" }}>
            Level bands above {playerLevel} stay locked until you reach them.
          </small>
        </div>

        {/* DAILY view */}
        {isDaily && (
          <div style={{ display: "grid", gap: 12, padding: "8px 20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <b style={{ ...display, fontSize: 11, letterSpacing: ".14em", color: "#ffd9b8" }}>DAILY MISSIONS</b>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", border: "1px solid rgba(255,138,61,.35)", background: "rgba(255,138,61,.08)", ...mono, fontSize: 9, color: "#ffd9b8" }}>
                  <i style={{ fontStyle: "normal", fontSize: 10 }}>⏱</i>RESETS 06:40:00
                </span>
                <button
                  onClick={onReroll}
                  className={styles.chipBtn}
                  style={{ padding: "6px 10px", border: "1px solid rgba(255,138,61,.35)", background: "rgba(255,138,61,.08)", color: "#ffd9b8", ...display, fontSize: 8.5, letterSpacing: ".12em", fontWeight: 700, cursor: "pointer" }}
                >
                  REROLL · 500 CR
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {dailyCards.map((dm, i) => {
                const pct = Math.min(100, Math.round((dm.cur / dm.max) * 100));
                const done = dm.cur >= dm.max;
                return (
                  <div
                    key={dm.name}
                    style={{
                      position: "relative",
                      transform: `translateY(${i * -2}px)`,
                      filter: `drop-shadow(0 4px 0 rgba(2,1,1,.9)) drop-shadow(0 8px 9px rgba(0,0,0,.55)) drop-shadow(0 0 12px ${dm.hex}55)`,
                    }}
                  >
                    <CardFrame sheen={done} padding="13px 14px">
                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 5, ...display, fontSize: 7.5, fontWeight: 700, letterSpacing: ".06em", color: dm.hex }}>
                            <i style={{ fontStyle: "normal", fontSize: 10 }}>{dm.icon}</i>DAILY
                          </span>
                          <b style={{ flex: 1, minWidth: 0, ...display, fontSize: 9.5, letterSpacing: ".08em", color: "#fff6ea", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {dm.name}
                          </b>
                        </div>
                        <small style={{ fontSize: 9, lineHeight: 1.35, color: "rgba(226,212,198,.8)" }}>{dm.obj}</small>
                        <div style={{ position: "relative", height: 6, background: "rgba(0,0,0,.5)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.7)" }}>
                          <i style={{ position: "absolute", inset: 0, width: `${pct}%`, background: "linear-gradient(90deg,#1c8fb0,#4ee2ff)", boxShadow: "0 0 8px rgba(78,226,255,.6)" }} />
                        </div>
                        <small style={{ ...mono, fontSize: 8.5, color: "rgba(210,190,175,.7)" }}>
                          {dm.cur.toLocaleString("en-US")} / {dm.max.toLocaleString("en-US")}
                        </small>
                        <Rewards credits={dm.credits.toLocaleString("en-US")} honor={dm.honor} exp={dm.exp.toLocaleString("en-US")} />
                      </div>
                    </CardFrame>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LADDER view */}
        {!isDaily && (
          <div style={{ display: "grid", gap: 8, padding: "8px 20px 24px", maxHeight: 620, overflowY: "auto" }}>
            {pageGroups.map((mg, gi) => {
              const open = expanded === gi;
              return (
                <div key={`${mg.level}-${mg.map}`} style={{ display: "grid", gap: 6 }}>
                  <div
                    onClick={() => setExpanded(open ? null : gi)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                      border: "1px solid rgba(255,138,61,.28)",
                      background: open ? "rgba(255,138,61,.12)" : "rgba(40,20,8,.4)",
                      cursor: "pointer", opacity: mg.locked ? 0.55 : 1,
                      clipPath: "polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)",
                    }}
                  >
                    <span style={{ ...mono, fontSize: 9.5, color: "#ffb673" }}>LV {mg.level}+</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <i style={{ fontStyle: "normal", fontSize: 9, color: "rgba(210,190,175,.5)" }}>◎</i>
                      <b style={{ ...display, fontSize: 9.5, letterSpacing: ".1em", color: "#ffd9b8" }}>{mg.map}</b>
                    </div>
                    <i style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(255,138,61,.35),transparent)" }} />
                    {mg.locked && (
                      <small style={{ fontSize: 8, letterSpacing: ".14em", fontWeight: 700, color: "rgba(226,210,196,.6)" }}>⌧ LOCKED</small>
                    )}
                    <i style={{ fontStyle: "normal", fontSize: 10, color: "#ffb673" }}>{open ? "▾" : "▸"}</i>
                  </div>

                  {open && (
                    <div style={{ display: "grid", gap: 6, paddingLeft: 10 }}>
                      {mg.items.map((mc) => (
                        <div
                          key={mc.id}
                          style={{
                            position: "relative", opacity: mc.locked ? 0.55 : 1,
                            filter: "drop-shadow(0 3px 0 rgba(2,1,1,.85)) drop-shadow(0 6px 8px rgba(0,0,0,.5))",
                          }}
                        >
                          <CardFrame padding="11px 13px">
                            <div style={{ display: "grid", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ flex: "0 0 auto", ...mono, fontSize: 8, letterSpacing: ".08em", color: mc.typeHex, textShadow: `0 0 6px ${mc.typeHex}77` }}>
                                  {mc.tier}
                                </span>
                                <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                                  <b style={{ ...display, fontSize: 9.5, letterSpacing: ".06em", color: "#fff6ea" }}>
                                    <i style={{ fontStyle: "normal", marginRight: 6, color: mc.typeHex }}>{mc.typeIcon}</i>
                                    {mc.title}
                                  </b>
                                  <small style={{ fontSize: 8.5, lineHeight: 1.35, color: "rgba(226,212,198,.75)" }}>{mc.obj}</small>
                                </div>
                              </div>
                              <Rewards credits={mc.credits} honor={mc.honor} exp={mc.exp} />
                              {mc.locked ? (
                                <small style={{ textAlign: "center", fontSize: 8, letterSpacing: ".18em", fontWeight: 700, color: "rgba(226,210,196,.55)" }}>⌧ LOCKED</small>
                              ) : (
                                <AcceptButton
                                  accepted={isAccepted(mc)}
                                  onClick={() => accept(mc)}
                                  label={`Accept ${mc.title}`}
                                />
                              )}
                            </div>
                          </CardFrame>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ladder pager — "‹ LV 1+–4+ · PAGE 1/5 ›". Present in the export
                (missionPager.prev / .next with fromLv/toLv/page1/totalPages)
                and missing from this port entirely, which is why the whole
                15-band ladder rendered at once. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "8px 4px 4px" }}>
              <button
                aria-label="Previous levels"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={pageIdx <= 0}
                className={styles.arrowBtn}
                style={{
                  border: "none", background: "none", padding: "2px 6px",
                  cursor: pageIdx <= 0 ? "not-allowed" : "pointer",
                  opacity: pageIdx <= 0 ? 0.3 : 1,
                }}
              >
                <i style={{ fontStyle: "normal", display: "block", ...display, fontSize: 30, fontWeight: 900, lineHeight: 1, color: "#ff8a3d", textShadow: "0 0 10px #ff8a3d,0 0 22px rgba(255,138,61,.85)" }}>‹</i>
              </button>
              <small style={{ ...mono, fontSize: 8.5, letterSpacing: ".08em", color: "rgba(210,190,175,.6)" }}>
                LV {pageGroups[0]?.level ?? 1}+–{pageGroups[pageGroups.length - 1]?.level ?? 1}+ · PAGE {pageIdx + 1}/{totalPages}
              </small>
              <button
                aria-label="Next levels"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={pageIdx >= totalPages - 1}
                className={styles.arrowBtn}
                style={{
                  border: "none", background: "none", padding: "2px 6px",
                  cursor: pageIdx >= totalPages - 1 ? "not-allowed" : "pointer",
                  opacity: pageIdx >= totalPages - 1 ? 0.3 : 1,
                }}
              >
                <i style={{ fontStyle: "normal", display: "block", ...display, fontSize: 30, fontWeight: 900, lineHeight: 1, color: "#ff8a3d", textShadow: "0 0 10px #ff8a3d,0 0 22px rgba(255,138,61,.85)" }}>›</i>
              </button>
            </div>
          </div>
        )}
      </HeroFrame>
    </div>
  );
}
