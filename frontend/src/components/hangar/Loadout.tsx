import React from "react";
import { createPortal } from "react-dom";
import styles from "./HangarDockOverlay.module.css";
import { LoadoutSocket, type SocketState } from "./LoadoutSocket";
import { LoadoutTooltip, LoadoutItemCard, type LoadoutTipData } from "./LoadoutTooltip";
import { LoadoutButton } from "./LoadoutButton";
import { CloseDiamond } from "./HeroFrame";
import {
  LOADOUT_RARITY, LOADOUT_RARITY_FILTERS, LOADOUT_STATUS_FILTERS, LOADOUT_FRAME,
  LOADOUT_PANEL_W, LOADOUT_BODY_GRID, LOADOUT_MAIN_GRID, LOADOUT_SOCKET_GRID,
  type LoadoutSlot,
} from "./Loadout.constants";

/**
 * Loadout Panel — MIGRATED from the design export's MARKUP.
 *
 * Source: Downloads/Cosmic Realm UI Upgrade (8).zip
 *   -> design_handoff_hangar_panels_strict_export/
 *      "Loadout Panel (UI Redesign Directions - Armor).dc.html", `<div id="1c">`
 *
 * REWRITTEN after a first attempt was rejected: that version reproduced the
 * export's DATA (rarity ramp, capacities, filters) but wrote its own JSX around
 * it — 12 of 210 bevel layers, 3 of 149 clip-paths. See PORT_FAILURES.md §F-01.
 * This version walks the export's DOM in order and translates each element.
 *
 * Structure, verbatim:
 *   shell       5 amber plates 34 → 26, content plate 24
 *   main frame  chamfer 46, 2px border + 3 inner rules at inset 4/8/12
 *   body        minmax(0,1fr) 372px, no gap, stretch
 *   main        224px minmax(0,1fr) 224px, gap 22, centred
 *   viewport    spin rings 26s/44s/90s, conic sweep, ground grid, 4 clamps,
 *               hexagonal 262px frame
 *   filter      a DROPDOWN behind one button — not an open chip row
 *   cards       fixed height 54px, 5-plate bevel 7.5 → 6, grouped by slot
 *
 * ONE deliberate deviation, requested by the user: the tab row is
 * WEAPONS / GENERATORS / MODULES with no ALL. The export has ALL because its
 * demo inventory is tiny; against a real 40+ item inventory it renders all
 * three groups at once and the panel outgrows the viewport.
 */

const display: React.CSSProperties = { fontFamily: "Orbitron,sans-serif" };
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace" };

/** shadeHex — the export's own helper, used by bevelBands(). */
function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) + Math.round(255 * amt);
  let g = ((n >> 8) & 255) + Math.round(255 * amt);
  let b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** The export's METAL_RIM — its brushed-metal atlas tile. The design file points
 *  at an editor upload that does not ship; this project serves the same texture
 *  at /assets/ui/atlas/brushed-metal.png, so that real file is used. */
const METAL_RIM =
  "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";

/** Panel chamfer (top-right / bottom-left). */
const clipTR = (c: number) =>
  `polygon(0 0,calc(100% - ${c}px) 0,100% ${c}px,100% 100%,${c}px 100%,0 calc(100% - ${c}px))`;
/** Button chamfer (top-left / bottom-right), mirrored. */
const clipTL = (c: number) =>
  `polygon(${c}px 0,100% 0,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,0 100%,0 ${c}px)`;

const HEX = "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)";

export interface LoadoutItem {
  instanceId: string;
  slot: LoadoutSlot;
  name: string;
  rarity: string;
  ilvl: number;
  glyph: string;
  icon: string;
  equipped: boolean;
  equippedIndex: number;
  description?: string;
}

export interface LoadoutBank {
  slot: LoadoutSlot;
  label: string;
  color: string;
  glyph: string;
  count: string;
  sockets: (LoadoutItem | null)[];
}

/** A tactical-readout stat group — the export's STAT_GROUPS_DEF shape. */
export interface LoadoutStatGroup {
  label: string;
  color: string;
  rows: { glyph: string; label: string; value: string }[];
}

export interface LoadoutProps {
  items?: LoadoutItem[];
  /** Five colour-coded stat blocks. The host builds them from effectiveStats();
   *  defaults to an empty list so the panel still renders standalone. */
  statGroups?: LoadoutStatGroup[];
  banks?: LoadoutBank[];
  credits?: number;
  shipName?: string;
  renderShip?: () => React.ReactNode;
  onEquip?: (item: LoadoutItem) => void;
  onUnequip?: (slot: LoadoutSlot, index: number) => void;
  onSell?: (item: LoadoutItem) => void;
  onClose?: () => void;
}

/** Inventory groups — the export lists items grouped by slot, each with its own
 *  header and "N ITEMS · M ACTIVE" meta, not as one flat list. */
const GROUPS: { slot: LoadoutSlot; label: string; color: string }[] = [
  { slot: "weapon", label: "WEAPONS", color: "#ff5c6c" },
  { slot: "generator", label: "GENERATORS", color: "#ffd24a" },
  { slot: "module", label: "MODULES", color: "#4ee2ff" },
];

/** Corner clamps around the ship stage — the export's own four positions. */
const CLAMPS = [
  { left: "16px", top: "16px", bt: "#ffb673", bl: "#ffb673", br: "transparent", bb: "transparent" },
  { right: "16px", top: "16px", bt: "#ffb673", br: "#ffb673", bl: "transparent", bb: "transparent" },
  { left: "16px", bottom: "16px", bb: "#ffb673", bl: "#ffb673", bt: "transparent", br: "transparent" },
  { right: "16px", bottom: "16px", bb: "#ffb673", br: "#ffb673", bt: "transparent", bl: "transparent" },
] as const;

export function Loadout({
  items = [], banks = [], statGroups = [], credits = 0, shipName = "SOVEREIGN",
  renderShip, onEquip, onUnequip, onSell, onClose,
}: LoadoutProps) {
  // DELIBERATE DEVIATION from the export: no ALL tab.
  // The export offers ALL because its demo inventory is small. With a real
  // 40+ item inventory it renders all three groups at once and the panel grows
  // far past the viewport — the user asked for it to be removed.
  const [tab, setTab] = React.useState<LoadoutSlot>("weapon");
  const [rarityFilter, setRarityFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [selId, setSelId] = React.useState<string | null>(null);
  const [compareId, setCompareId] = React.useState<string | null>(null);
  // COMPARE arms a pick: the next item clicked lands in the compare slot
  // instead of replacing the selection.
  const [comparing, setComparing] = React.useState(false);
  // Hover tooltip — the export tracks the cursor in PANEL space and clamps
  // x to 1680-260 so it never leaves the frame.
  const [tip, setTip] = React.useState<LoadoutTipData | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const showTip = (e: React.MouseEvent, it: LoadoutItem) => {
    // VIEWPORT coordinates: the tooltip renders through a portal on <body>, so
    // it is outside the panel's clip-path and its scale transform. Rendering it
    // inside the panel looked correct in the DOM but was invisible — a
    // clip-path clips every descendant regardless of z-index.
    setTip({
      name: it.name, rarity: it.rarity, slot: it.slot.toUpperCase(),
      ilvl: it.ilvl, icon: it.icon, equipped: it.equipped,
      x: Math.min(e.clientX + 16, window.innerWidth - 276),
      y: Math.min(Math.max(0, e.clientY + 16), window.innerHeight - 180),
    });
  };

  const visible = items.filter((i) =>
    i.slot === tab &&
    (rarityFilter === "all" || i.rarity === rarityFilter) &&
    (statusFilter === "all" || (statusFilter === "eq" ? i.equipped : !i.equipped)));

  const sel = items.find((i) => i.instanceId === selId) ?? null;
  const cmp = items.find((i) => i.instanceId === compareId) ?? null;

  const filterLabel = "FILTER"
    + (rarityFilter !== "all" ? " · " + (LOADOUT_RARITY[rarityFilter]?.[4] ?? "") : "")
    + (statusFilter !== "all" ? " · " + (statusFilter === "eq" ? "EQUIPPED" : "IN STORAGE") : "")
    + " ▾";

  const count = (s: LoadoutSlot) => items.filter((i) => i.slot === s).length;
  const TABS: [string, LoadoutSlot][] = [
    [`WEAPONS (${count("weapon")})`, "weapon"],
    [`GENERATORS (${count("generator")})`, "generator"],
    [`MODULES (${count("module")})`, "module"],
  ];
  const tabIdx = TABS.findIndex(([, k]) => k === tab);

  const socketState = (it: LoadoutItem | null): SocketState =>
    it
      ? { kind: "filled", rarity: it.rarity, name: it.name, ilvl: it.ilvl, icon: it.icon, glyph: it.glyph }
      : { kind: "empty" };

  const renderBank = (b: LoadoutBank, mirrored: boolean) => (
    <section key={b.slot} style={{ display: "grid", gap: 8 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {mirrored ? (
          <>
            <small style={{ fontSize: 9, letterSpacing: ".12em", color: "rgba(180,205,230,.55)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{b.count}</small>
            <i style={{ flex: 1, height: 1, background: `linear-gradient(90deg,transparent,${b.color}66)` }} />
            <b style={{ ...display, fontSize: 9.5, letterSpacing: ".24em", color: "rgba(226,210,248,.8)", fontWeight: 700 }}>{b.label}</b>
            <i style={{ fontStyle: "normal", fontSize: 12, color: b.color }}>{b.glyph}</i>
          </>
        ) : (
          <>
            <i style={{ fontStyle: "normal", fontSize: 12, color: b.color }}>{b.glyph}</i>
            <b style={{ ...display, fontSize: 9.5, letterSpacing: ".24em", color: "rgba(226,210,248,.8)", fontWeight: 700 }}>{b.label}</b>
            <i style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${b.color}66,transparent)` }} />
            <small style={{ fontSize: 9, letterSpacing: ".12em", color: "rgba(180,205,230,.55)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{b.count}</small>
          </>
        )}
      </header>
      <div style={{ display: "grid", gridTemplateColumns: LOADOUT_SOCKET_GRID, gap: 6 }}>
        {b.sockets.map((it, i) => (
          <LoadoutSocket
            key={`${b.slot}-${i}`}
            state={socketState(it)}
            active={!!it && it.instanceId === selId}
            title={it ? `${it.name} · ${LOADOUT_RARITY[it.rarity]?.[4] ?? ""}` : "Empty slot"}
            onClick={() => it && setSelId(it.instanceId)}
            onDoubleClick={() => it && onUnequip?.(b.slot, i)}
            onHover={(e) => it && showTip(e, it)}
            onLeave={() => setTip(null)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div
      ref={rootRef}
      onMouseLeave={() => setTip(null)}
      style={{
        position: "relative", width: LOADOUT_PANEL_W, maxWidth: "100%",
        padding: 10, boxSizing: "border-box",
        filter: "drop-shadow(0 10px 4px rgba(0,0,0,.5)) drop-shadow(0 24px 50px rgba(0,0,0,.6)) drop-shadow(0 0 30px rgba(255,138,61,.3))",
        clipPath: clipTR(34),
      }}
    >
      {/* Shell — five amber plates, 34 → 26. */}
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#fff6ec,#ffb673)", clipPath: clipTR(34) }} />
      <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(135deg,#ffcfa0,#d9791f)", clipPath: clipTR(32) }} />
      <i style={{ position: "absolute", inset: 4, display: "block", background: "linear-gradient(135deg,#b8681f,#5c2e0a)", clipPath: clipTR(30) }} />
      <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#3d2410,#170e06)", clipPath: clipTR(28) }} />
      <i style={{ position: "absolute", inset: 8, display: "block", background: "linear-gradient(135deg,#160d05,#050302)", clipPath: clipTR(26) }} />

      <div
        style={{
          position: "relative", zIndex: 1,
          background: "radial-gradient(1100px 620px at 18% -8%,rgba(255,138,61,.22),transparent 62%),linear-gradient(165deg,#1c150e,#050301)",
          boxShadow: "inset 0 3px 6px rgba(0,0,0,.55)",
          clipPath: clipTR(24),
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: LOADOUT_BODY_GRID, alignItems: "stretch" }}>

          {/* ── main section ─────────────────────────────────────────── */}
          <section style={{ position: "relative", padding: "26px 30px 30px", overflow: "hidden" }}>
            <i style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(115deg,rgba(255,255,255,.035) 1px,transparent 1px)", backgroundSize: "26px 100%", pointerEvents: "none" }} />

            {/* header row */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, paddingBottom: 18 }}>
              <i style={{ fontStyle: "normal", fontSize: 13, color: "#ff9e4f" }}>⚙</i>
              <b style={{ ...display, fontSize: 14, letterSpacing: ".22em", color: "rgba(255,224,196,.92)" }}>LOADOUT</b>
              <small style={{ ...mono, fontSize: 10, color: "rgba(200,180,150,.7)" }}>{shipName}</small>
              <span style={{ flex: 1 }} />
              <span style={{ padding: "6px 10px", border: "1px solid rgba(255,158,79,.35)", background: "rgba(255,158,79,.08)", ...mono, fontSize: 9.5, fontWeight: 700, color: "#e8b94d" }}>
                CREDITS {credits.toLocaleString("en-US")}
              </span>
              {/* The project's shared diamond, not a bordered box — every other
                  hangar panel closes with this, and the Loadout export draws the
                  same one at 30px. */}
              <CloseDiamond onClick={onClose} label="Close loadout" size={30} />
            </div>

            {/* Machined frame around banks + stage: chamfer 46, 2px border and
                THREE inner rules at inset 4 / 8 / 12. */}
            <div
              style={{
                position: "relative", display: "grid", gridTemplateColumns: LOADOUT_MAIN_GRID,
                gap: 22, alignItems: "center", padding: "26px 24px",
                border: "2px solid rgba(255,138,61,.5)",
                background: "linear-gradient(160deg,rgba(56,32,18,.94) 0%,rgba(34,22,16,.94) 45%,rgba(13,7,5,.92) 100%)",
                boxShadow: "0 12px 0 -8px rgba(2,3,10,.9),0 20px 0 -12px rgba(10,7,22,.85),0 26px 60px rgba(0,0,0,.55)",
                clipPath: clipTR(46),
              }}
            >
              <i style={{ position: "absolute", inset: 4, border: "1px solid rgba(255,225,190,.32)", clipPath: clipTR(46), pointerEvents: "none" }} />
              <i style={{ position: "absolute", inset: 8, border: "1px solid rgba(5,3,10,.55)", clipPath: clipTR(46), pointerEvents: "none" }} />
              <i style={{ position: "absolute", inset: 12, border: "1px solid rgba(255,150,80,.3)", clipPath: clipTR(46), pointerEvents: "none" }} />

              {/* left banks */}
              <div style={{ display: "grid", gap: 16, alignContent: "center" }}>
                {banks.slice(0, 2).map((b) => renderBank(b, false))}
              </div>

              {/* ship stage */}
              <div style={{ position: "relative", display: "grid", placeItems: "center", minHeight: 360 }}>
                {/* perspective floor + grid */}
                <i style={{ position: "absolute", bottom: 30, width: 280, height: 70, background: "linear-gradient(180deg,rgba(255,138,61,.14),transparent)", transform: "perspective(340px) rotateX(66deg)", boxShadow: "inset 0 0 40px rgba(255,138,61,.22)" }} />
                <i style={{ position: "absolute", bottom: 30, width: 210, height: 56, backgroundImage: "linear-gradient(rgba(157,242,255,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(157,242,255,.22) 1px,transparent 1px)", backgroundSize: "26px 14px", transform: "perspective(300px) rotateX(66deg)", opacity: 0.7 }} />
                {/* rotating rings */}
                <i className={styles.spin26} style={{ position: "absolute", width: 250, height: 250, border: "1px dashed rgba(255,138,61,.34)", borderRadius: "50%" }} />
                <i className={styles.spin44r} style={{ position: "absolute", width: 320, height: 320, border: "1px solid rgba(255,138,61,.2)", borderTopColor: "rgba(255,205,160,.55)", borderRadius: "50%" }} />
                <i
                  className={styles.spin90}
                  style={{
                    position: "absolute", width: 300, height: 300, borderRadius: "50%",
                    background: "repeating-conic-gradient(from 0deg,rgba(157,242,255,.4) 0deg 0.5deg,transparent 0.5deg 9deg)",
                    WebkitMaskImage: "radial-gradient(circle,transparent 146px,#000 146px)",
                    maskImage: "radial-gradient(circle,transparent 146px,#000 146px)",
                  }}
                />
                {/* corner clamps */}
                {CLAMPS.map((c, i) => (
                  <i
                    key={i}
                    style={{
                      position: "absolute", ...c, width: 32, height: 32,
                      borderTop: `2px solid ${c.bt}`, borderLeft: `2px solid ${c.bl}`,
                      borderRight: `2px solid ${c.br}`, borderBottom: `2px solid ${c.bb}`,
                      filter: "drop-shadow(0 0 6px rgba(255,180,90,.6))",
                    }}
                  />
                ))}
                {/* hexagonal ship frame */}
                <div style={{ position: "relative", display: "grid", placeItems: "center", width: 262, height: 262, background: "repeating-linear-gradient(125deg,rgba(255,255,255,.04) 0 2px,transparent 2px 13px)", border: "1px solid rgba(255,255,255,.1)", boxShadow: "inset 0 0 60px rgba(157,242,255,.1)", clipPath: HEX }}>
                  {renderShip ? renderShip() : (
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center", padding: "0 18px" }}>
                      <b style={{ ...display, fontSize: 12, letterSpacing: ".2em", color: "rgba(255,179,102,.9)" }}>{shipName}</b>
                      <small style={{ fontSize: 11, lineHeight: 1.5, color: "rgba(210,190,245,.6)" }}>SYSTEME NOMINAL</small>
                    </span>
                  )}
                </div>
                <i style={{ position: "absolute", bottom: 6, width: 300, height: 26, background: "radial-gradient(closest-side,rgba(255,138,61,.4),transparent)", filter: "blur(3px)" }} />
                <b style={{ position: "absolute", top: 8, left: 8, ...display, fontSize: 11, letterSpacing: ".24em", color: "rgba(232,185,77,.85)" }}>{shipName}</b>
              </div>

              {/* right bank */}
              <div style={{ display: "grid", gap: 16, alignContent: "center" }}>
                {banks.slice(2).map((b) => renderBank(b, true))}
              </div>
            </div>

            {/* ── tabs + filter dropdown ─────────────────────────────── */}
            <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 12, marginTop: 22 }}>
              <div style={{ position: "relative", flex: 1, display: "flex", gap: 1, overflow: "hidden", background: "rgba(4,8,16,.55)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)" }}>
                {TABS.map(([label, key]) => {
                  const on = tab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={styles.tabBtn}
                      style={{
                        flex: 1, position: "relative", zIndex: 2, padding: "10px 4px", border: "none",
                        background: on ? "rgba(255,138,61,.14)" : "none",
                        color: on ? "#ffd9b8" : "rgba(226,210,196,.72)",
                        ...display, fontSize: 9, letterSpacing: ".14em", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                {/* three-layer edge glow, the kit's own timing */}
                <i style={{ position: "absolute", zIndex: 4, bottom: 0, left: `${tabIdx * (100 / TABS.length)}%`, width: `${100 / TABS.length}%`, height: 5, pointerEvents: "none", opacity: 0.28, filter: "blur(4px)", background: "linear-gradient(90deg,transparent,#ff8a3d,transparent)", transition: "left 480ms cubic-bezier(.22,.9,.25,1)" }} />
                <i style={{ position: "absolute", zIndex: 4, bottom: 0, left: `${tabIdx * (100 / TABS.length)}%`, width: `${100 / TABS.length}%`, height: 3, pointerEvents: "none", opacity: 0.55, filter: "blur(2px)", background: "linear-gradient(90deg,transparent,#ff8a3d,transparent)", transition: "left 380ms cubic-bezier(.22,.9,.25,1)" }} />
                <i style={{ position: "absolute", zIndex: 5, bottom: 0, left: `${tabIdx * (100 / TABS.length)}%`, width: `${100 / TABS.length}%`, height: 2, pointerEvents: "none", background: "linear-gradient(90deg,transparent,#ff8a3d 22%,#ff8a3d 78%,transparent)", boxShadow: "0 0 10px #ff8a3d,0 0 24px #ff8a3d", transition: "left 260ms cubic-bezier(.22,.9,.25,1)" }} />
              </div>

              <span style={{ position: "relative" }}>
                <button
                  onClick={() => setFilterOpen((o) => !o)}
                  className={styles.filterBtn}
                  style={{
                    position: "relative", padding: 0, border: "none",
                    background: "linear-gradient(135deg,rgba(200,222,255,.5),rgba(255,255,255,.16) 45%,rgba(5,7,13,.85))",
                    color: "rgba(214,196,244,.8)", fontSize: 11.5, letterSpacing: ".2em", fontWeight: 700, cursor: "pointer",
                    filter: "drop-shadow(0 4px 2px rgba(2,3,10,.9)) drop-shadow(0 10px 18px rgba(0,0,0,.45))",
                    clipPath: clipTL(8),
                  }}
                >
                  <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(150deg,rgba(255,255,255,.05),rgba(20,13,32,.9))", boxShadow: "inset 0 3px 7px rgba(0,0,0,.75),inset 3px 0 6px rgba(0,0,0,.55),inset 0 -1px 0 rgba(200,180,235,.14),inset -1px 0 0 rgba(200,180,235,.08)", clipPath: clipTL(6) }} />
                  <span style={{ position: "relative", display: "block", padding: "10px 18px" }}>{filterLabel}</span>
                </button>

                {filterOpen && (
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 40, width: 230, padding: 2, background: "linear-gradient(135deg,rgba(200,222,255,.55),rgba(184,102,255,.55) 45%,rgba(5,7,13,.85))", filter: "drop-shadow(0 10px 20px rgba(0,0,0,.6))", clipPath: clipTR(14) }}>
                    <div style={{ display: "grid", gap: 12, padding: "14px 16px", background: "linear-gradient(165deg,#241638,#0a0714)", boxShadow: "inset 0 4px 9px rgba(0,0,0,.75),inset 3px 0 7px rgba(0,0,0,.55),inset 0 -1px 0 rgba(200,180,235,.12)", clipPath: clipTR(12) }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <small style={{ ...display, fontSize: 8.5, letterSpacing: ".24em", color: "rgba(206,188,238,.55)", fontWeight: 700 }}>RARITY</small>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {LOADOUT_RARITY_FILTERS.map(([label, key]) => {
                            const on = rarityFilter === key;
                            return (
                              <button
                                key={key}
                                onClick={() => setRarityFilter(key)}
                                className={styles.chipBtn}
                                style={{ padding: "5px 9px", border: `1px solid ${on ? "rgba(184,102,255,.5)" : "rgba(255,255,255,.08)"}`, background: on ? "rgba(184,102,255,.2)" : "transparent", color: on ? "#ecd6ff" : "rgba(206,188,238,.6)", fontSize: 8.5, letterSpacing: ".14em", fontWeight: 700, cursor: "pointer" }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <small style={{ ...display, fontSize: 8.5, letterSpacing: ".24em", color: "rgba(206,188,238,.55)", fontWeight: 700 }}>STATUS</small>
                        <div style={{ display: "flex", gap: 5 }}>
                          {LOADOUT_STATUS_FILTERS.map(([label, key]) => {
                            const on = statusFilter === key;
                            return (
                              <button
                                key={key}
                                onClick={() => setStatusFilter(key)}
                                className={styles.chipBtn}
                                style={{ padding: "5px 9px", border: `1px solid ${on ? "rgba(184,102,255,.5)" : "rgba(255,255,255,.08)"}`, background: on ? "rgba(184,102,255,.2)" : "transparent", color: on ? "#ecd6ff" : "rgba(206,188,238,.6)", fontSize: 8.5, letterSpacing: ".14em", fontWeight: 700, cursor: "pointer" }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => { setRarityFilter("all"); setStatusFilter("all"); }}
                        className={styles.chipBtn}
                        style={{ padding: "6px 9px", border: "1px solid rgba(255,158,79,.35)", background: "transparent", color: "rgba(255,200,150,.8)", fontSize: 8.5, letterSpacing: ".14em", fontWeight: 700, cursor: "pointer" }}
                      >
                        RESET
                      </button>
                    </div>
                  </div>
                )}
              </span>
            </div>

            {/* ── inventory: grouped by slot, inside a recessed well ──── */}
            <div style={{ display: "grid", gap: 16, padding: 18, marginTop: 14, border: "1px solid rgba(255,255,255,.07)", background: "repeating-linear-gradient(90deg,rgba(140,190,220,.035) 0 1px,transparent 1px 3px),linear-gradient(180deg,rgba(9,6,16,.94),rgba(16,11,26,.9))", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5),inset 0 14px 26px rgba(0,0,0,.55)" }}>
              {GROUPS.map((g) => {
                const rows = visible.filter((i) => i.slot === g.slot);
                if (!rows.length) return null;
                const activeCount = rows.filter((i) => i.equipped).length;
                return (
                  <section key={g.slot} style={{ display: "grid", gap: 9 }}>
                    <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <i style={{ width: 7, height: 7, background: g.color, boxShadow: `0 0 9px ${g.color}`, transform: "rotate(45deg)" }} />
                      <b style={{ ...display, fontSize: 10, letterSpacing: ".28em", color: "rgba(226,210,248,.85)", fontWeight: 700 }}>{g.label}</b>
                      <i style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(150,195,235,.25),transparent)" }} />
                      <small style={{ fontSize: 9.5, letterSpacing: ".18em", color: "rgba(180,205,230,.55)", fontWeight: 600 }}>
                        {rows.length} ITEMS · {activeCount} ACTIVE
                      </small>
                    </header>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(11,1fr)", gap: 7 }}>
                      {rows.map((it) => {
                        const d = LOADOUT_RARITY[it.rarity] ?? LOADOUT_RARITY.common;
                        const frame = LOADOUT_FRAME[it.rarity] ?? "plain";
                        const lined = frame !== "plain";
                        const glow = frame === "glow" || frame === "star";
                        return (
                          <div
                            key={it.instanceId}
                            role="button"
                            aria-label={`${it.name} · ${d[4]}, ilvl ${it.ilvl}`}
                            onClick={() => {
                              if (comparing && selId && it.instanceId !== selId) {
                                setCompareId(it.instanceId); setComparing(false);
                              } else {
                                setSelId(it.instanceId);
                              }
                            }}
                            onDoubleClick={() => onEquip?.(it)}
                            onMouseEnter={(e) => showTip(e, it)}
                            onMouseMove={(e) => showTip(e, it)}
                            onMouseLeave={() => setTip(null)}
                            className={styles.loCard}
                            style={{
                              // Fixed 54px height, NOT aspect-ratio: at 11
                              // columns across a 1680 panel a square cell is
                              // enormous. This is the export's own value.
                              position: "relative", display: "block", height: 54, cursor: "pointer",
                              filter: `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 8px rgba(0,0,0,.6))${glow ? ` drop-shadow(0 0 ${d[2]} ${d[3]})` : ""}`,
                              outline: it.instanceId === selId ? `1px solid ${d[0]}` : "none",
                              ["--card-glow" as string]: d[3],
                            }}
                          >
                            {/* Five-plate bevel ladder, 9 → 6, insets 0/2/2.5/3/3.5.
                                b1 is the brushed-metal atlas (the export's
                                METAL_RIM); b2..b5 are the rarity hex shaded by
                                +.24 / -.08 / -.4 / -.7 — its own bevelBands(). */}
                            <i style={{ position: "absolute", inset: 0, display: "block", background: METAL_RIM, backgroundSize: "cover,400% 400%", backgroundPosition: "center,100% 0%", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.35),inset -1px -1px 1px rgba(0,0,0,.5)", clipPath: clipTR(9) }} />
                            <i style={{ position: "absolute", inset: 2, display: "block", background: shadeHex(d[0], 0.24), boxShadow: "inset 1px 1px 0 rgba(255,255,255,.25),inset -1px -1px 2px rgba(0,0,0,.5)", clipPath: clipTR(7.5) }} />
                            <i style={{ position: "absolute", inset: 2.5, display: "block", background: shadeHex(d[0], -0.08), clipPath: clipTR(7) }} />
                            <i style={{ position: "absolute", inset: 3, display: "block", background: shadeHex(d[0], -0.4), clipPath: clipTR(6.5) }} />
                            <i style={{ position: "absolute", inset: 3.5, display: "block", background: shadeHex(d[0], -0.7), clipPath: clipTR(6) }} />
                            {/* Card FACE at inset 4 — this is what makes cards
                                dark with only a rarity wash at the top. Without
                                it the b5 bevel plate is the visible surface and
                                every card reads as flat gold-brown. */}
                            <i
                              style={{
                                position: "absolute", inset: 4, display: "block",
                                background: `linear-gradient(180deg,${d[1]} 0%,transparent 55%),linear-gradient(160deg,#1c2536,#06060d)`,
                                boxShadow: "inset 0 0 0 1px rgba(0,0,0,.7),inset 0 4px 7px rgba(0,0,0,.7),inset 0 -3px 6px rgba(0,0,0,.55),inset 4px 0 7px rgba(0,0,0,.5),inset -4px 0 7px rgba(0,0,0,.5),inset 0 0 14px rgba(0,0,0,.6)",
                                clipPath: clipTR(6),
                              }}
                            />
                            {/* accent rule + corner wedge */}
                            <i style={{ position: "absolute", left: 5, top: 5, right: 5, height: 2, background: `linear-gradient(90deg,${d[0]},transparent)`, opacity: 0.85 }} />
                            <em style={{ position: "absolute", top: 5, left: 5, width: 0, height: 0, borderTop: `8px solid ${d[0]}`, borderRight: "8px solid transparent" }} />
                            {lined && (
                              <i style={{ position: "absolute", inset: 8, border: `1px solid ${d[0]}`, opacity: 0.55, clipPath: clipTR(5) }} />
                            )}
                            {glow && (
                              <i className={styles.pulse} style={{ position: "absolute", inset: 3, border: `1px solid ${d[0]}`, filter: "blur(2px)" }} />
                            )}
                            {/* icon on its own radial plate */}
                            <span style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%,-50%)", display: "grid", placeItems: "center", width: 34, height: 26, background: `radial-gradient(ellipse at 50% 45%,${d[0]}2e,transparent 70%)` }}>
                              <i style={{ width: 26, height: 22, backgroundImage: `url(${it.icon})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 6px ${d[3]})` }} />
                            </span>
                            {frame === "star" && (
                              <em style={{ position: "absolute", right: 7, top: 6, fontStyle: "normal", fontSize: 8, color: "#ffd24a", textShadow: "0 0 6px rgba(255,210,74,.7)" }}>✦</em>
                            )}
                            <small style={{ position: "absolute", right: 7, bottom: 5, ...mono, fontSize: 8, fontWeight: 700, color: "rgba(226,210,248,.72)", fontVariantNumeric: "tabular-nums" }}>{it.ilvl}</small>
                            {it.equipped && (
                              <em style={{ position: "absolute", left: 7, bottom: 5, fontStyle: "normal", fontSize: 8, fontWeight: 700, color: "#5cff8a", textShadow: "0 0 6px rgba(92,255,138,.7)" }}>E</em>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              {visible.length === 0 && (
                <small style={{ padding: "18px 0", textAlign: "center", fontSize: 10, color: "rgba(200,215,235,.45)" }}>
                  No items match this filter.
                </small>
              )}
            </div>
          </section>

          {/* ── tactical readout ─────────────────────────────────────── */}
          <aside className={styles.readoutCol} style={{ display: "flex", flexDirection: "column", gap: 14, padding: "26px 24px",
            // The readout must never resize the panel: its content changes with
            // the selection (stat groups, legendary box, compare card), which
            // previously pushed the whole 1680px frame past the viewport. Fixed
            // height + internal scrolling keeps the outer frame constant.
            height: 760, boxSizing: "border-box", overflowY: "auto", overflowX: "hidden",
            // Children of a fixed-height flex column shrink by default, which
            // squeezed the item card to a sliver and clipped its content.
            // `flex-shrink: 0` on every direct child makes the column scroll
            // instead — that is what the fixed height is for.
            border: "2px solid rgba(255,158,79,.5)", background: "linear-gradient(150deg,#2e2012,#120c07)", boxShadow: "inset 0 0 0 2px rgba(255,226,190,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(255,180,110,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(196,110,50,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(92,50,20,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>
            <h3 style={{ margin: 0, ...display, fontSize: 14, fontWeight: 800, letterSpacing: ".22em", color: "rgba(255,224,196,.92)" }}>TACTICAL READOUT</h3>

            {/* Stat groups — the export's STAT_GROUPS_DEF: five colour-coded
                blocks, each a 3x10 bar + rule + one row per stat. These were
                missing entirely; the readout only ever showed the selection. */}
            <div style={{ display: "grid", gap: 2 }}>
              {statGroups.map((g) => (
                <div key={g.label} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "6px 0 4px" }}>
                    <i style={{ width: 3, height: 10, background: g.color, boxShadow: "0 0 8px " + g.color + "88" }} />
                    <b style={{ ...display, fontSize: 9.5, letterSpacing: ".24em", color: g.color, fontWeight: 700 }}>{g.label}</b>
                    <i style={{ flex: 1, height: 1, background: g.color, opacity: 0.18 }} />
                  </div>
                  {g.rows.map((r) => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                      <em style={{ fontStyle: "normal", fontSize: 12, width: 16, textAlign: "center", color: g.color }}>{r.glyph}</em>
                      <small style={{ fontSize: 10.5, letterSpacing: ".03em", color: "#d7dde8", fontWeight: 700 }}>{r.label}</small>
                      <span style={{ flex: 1 }} />
                      <b style={{ ...display, fontSize: 13, color: "#ffffff" }}>{r.value}</b>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* LEGENDARY EFFECT box — legendary and above only. */}
            {sel && (sel.rarity === "legendary" || sel.rarity === "relic" || sel.rarity === "celestial") && (
              <div style={{ position: "relative", marginTop: 6, padding: 16, border: "2px solid rgba(232,185,77,.55)", background: "linear-gradient(155deg,#2e2410,#161022 55%,#07050d)", boxShadow: "0 8px 0 -5px rgba(2,3,10,.9),inset 2px 2px 0 rgba(255,224,160,.18),inset -2px -2px 0 rgba(0,0,0,.6),0 0 22px rgba(232,185,77,.45)", clipPath: clipTR(18) }}>
                <small style={{ ...display, fontSize: 8, letterSpacing: ".22em", color: "rgba(232,185,77,.9)", fontWeight: 700 }}>LEGENDARY EFFECT</small>
                <b style={{ display: "block", marginTop: 6, fontSize: 12, color: "#ffe6b0" }}>{sel.name}</b>
                {sel.description && (
                  <small style={{ display: "block", marginTop: 4, fontSize: 10, lineHeight: 1.5, color: "rgba(226,212,198,.78)" }}>{sel.description}</small>
                )}
              </div>
            )}

            {/* Selected item — the SAME card the hover tooltip renders, and in
                the SAME variant: identical head, stat wells and "Click to …"
                line, so hovering an item and selecting it look alike. */}
            {sel ? (
              <LoadoutItemCard
                tip={{
                  name: sel.name, rarity: sel.rarity, slot: sel.slot.toUpperCase(),
                  ilvl: sel.ilvl, icon: sel.icon, equipped: sel.equipped, x: 0, y: 0,
                }}
              />
            ) : (
              <small style={{ fontSize: 10.5, color: "rgba(200,215,235,.55)" }}>SELECT A SOCKET</small>
            )}

            {/* Comparison — the SAME card again, with "a → b" stat rows and a
                "NEW · <RARITY>" head, exactly as the export renders it. */}
            {cmp ? (
              <LoadoutItemCard
                headLabel={`NEW · ${LOADOUT_RARITY[cmp.rarity]?.[4] ?? ""}`}
                tip={{
                  name: cmp.name, rarity: cmp.rarity, slot: cmp.slot.toUpperCase(),
                  ilvl: cmp.ilvl, icon: cmp.icon, equipped: cmp.equipped, x: 0, y: 0,
                }}
                compareRows={sel ? [{
                  label: "ITEM LEVEL",
                  aVal: sel.ilvl,
                  bVal: cmp.ilvl,
                  arrow: cmp.ilvl > sel.ilvl ? "▲" : cmp.ilvl < sel.ilvl ? "▼" : "=",
                  arrowColor: cmp.ilvl > sel.ilvl ? "#5cff8a" : cmp.ilvl < sel.ilvl ? "#ff4d5e" : "rgba(200,215,235,.6)",
                }] : undefined}
              />
            ) : (
              <small style={{ fontSize: 9, letterSpacing: ".08em", color: "rgba(200,215,235,.45)" }}>
                PICK A SECOND ITEM TO COMPARE…
              </small>
            )}

            {/* Action bar — the export's own five-plate banded buttons.
                EQUIP spans the width with both top corners cut; COMPARE and
                SELL sit below it with mirrored bottom cuts. */}
            <div style={{ display: "grid", gap: 9, marginTop: "auto" }}>
              <LoadoutButton
                variant="equip"
                glyph="◈"
                label="EQUIP"
                ariaLabel="Equip selected item"
                disabled={!sel || sel.equipped}
                onClick={() => sel && onEquip?.(sel)}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <LoadoutButton
                  variant="compare"
                  glyph="⇄"
                  label={comparing ? "PICK ONE" : "COMPARE"}
                  active={comparing}
                  disabled={!sel}
                  onClick={() => setComparing((c) => !c)}
                />
                <LoadoutButton
                  variant="sell"
                  glyph="$"
                  label="SELL"
                  disabled={!sel || sel.equipped}
                  onClick={() => sel && onSell?.(sel)}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {tip && createPortal(<LoadoutTooltip tip={tip} />, document.body)}
    </div>
  );
}

export default Loadout;
