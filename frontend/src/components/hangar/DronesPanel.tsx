import React from "react";
import styles from "./HangarDockOverlay.module.css";
import { HeroFrame, PanelHeader, TabIndicator } from "./HeroFrame";
import { RARITY } from "./rarity";
import {
  DRONE, DRONE_EQUIPPED, DRONE_INVENTORY, DRONE_TABS, DRONE_BANKS, CAT_GLYPH,
  DRONE_PANEL_W, DRONE_TAB_PCT,
  type DroneSlotKey, type DroneItem,
} from "./Drones.constants";

/**
 * S-06 · Drones
 *
 * MIGRATED from the design export, not rebuilt:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (section "S-06 · DRONES")
 *
 * Four-column layout, verbatim: 150px weapon bank | 1fr turntable viewport |
 * 150px module+generator banks | 280px status/upgrade/ammo stack, with the
 * filterable inventory grid underneath.
 *
 * The hex sockets are a six-layer chamfered bevel whose insets are expressed as
 * fractions of the socket size (--sk), so one markup block serves every socket
 * size. Those fractions (0.02 / 0.0375 / 0.055 / 0.075 / 0.0925) are the
 * export's own — they keep the metal bands parallel through the hexagon's
 * corners the same way the panel bevel's 0.6px steps do.
 *
 * The drone render is an empty <image-slot id="drone-hero"> in the export
 * (EXPORT_MANIFEST §Assets). PORT_NOTES.md §1 resolves it to this project's own
 * render; `renderDrone` supplies the node and the 210x190 / perspective:800px /
 * cTurntable wrapper around it is preserved exactly.
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

const HEX = "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)";

export interface DronesPanelProps {
  /** Live drone render, drawn inside the export's turntable wrapper. */
  renderDrone?: () => React.ReactNode;
  onEquip?: (item: DroneItem) => void;
  onUpgrade?: () => void;
  onBuyAmmo?: () => void;
  onClose?: () => void;
}

/**
 * One hex socket. `size` drives every inner inset via --sk, so the same bevel
 * works at bank size and at inventory size.
 */
function HexSocket({
  size, border, glow, glyph, selected, onClick, label,
}: {
  size: number; border: string; glow: string; glyph: string;
  selected?: boolean; onClick?: () => void; label: string;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", width: size, height: size, padding: 0,
        border: "none", background: "none",
        cursor: onClick ? "pointer" : "default",
        // Custom property drives the bevel insets below.
        ["--sk" as string]: `${size}px`,
        filter: hover && onClick ? "brightness(1.15)" : "none",
        transition: "filter .14s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#ffffff,#8592a8)", opacity: .9, clipPath: HEX }} />
      <i style={{ position: "absolute", inset: "calc(var(--sk)*0.02)", background: "linear-gradient(135deg,#c3cedd,#414c5e)", opacity: .8, clipPath: HEX }} />
      <i style={{ position: "absolute", inset: "calc(var(--sk)*0.0375)", background: "linear-gradient(135deg,#5b6678,#1a1e26)", opacity: .85, clipPath: HEX }} />
      <i style={{ position: "absolute", inset: "calc(var(--sk)*0.055)", background: "linear-gradient(135deg,#242a34,#000000)", opacity: .9, clipPath: HEX }} />
      <i style={{ position: "absolute", inset: "calc(var(--sk)*0.075)", background: "linear-gradient(135deg,#0c0e12,#000000)", opacity: .8, clipPath: HEX }} />
      <i style={{ position: "absolute", inset: "calc(var(--sk)*0.0925)", background: "linear-gradient(150deg,#2a2015,#0e0a06)", clipPath: HEX }} />
      {/* rarity wash */}
      <i style={{ position: "absolute", inset: 0, margin: "auto", width: "56%", height: "56%", background: border, opacity: .28, boxShadow: `0 0 10px ${border}`, clipPath: HEX }} />
      <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(200,235,255,.05) 0 1px,transparent 1px 3px)", clipPath: HEX }} />
      <i style={{ position: "relative", ...display, fontStyle: "normal", fontSize: size * 0.26, fontWeight: 800, color: border, textShadow: `0 0 8px ${glow}`, zIndex: 3 }}>
        {glyph}
      </i>
      {selected && (
        <i style={{ position: "absolute", inset: -2, border: "1px solid #ffd9b8", boxShadow: "0 0 10px rgba(255,217,184,.7)", clipPath: HEX, pointerEvents: "none" }} />
      )}
    </button>
  );
}

/** A labelled bank: header row + its socket. */
function Bank({ label, glyph, slotKey }: { label: string; glyph: string; slotKey: DroneSlotKey }) {
  const [rarity, name] = DRONE_EQUIPPED[slotKey];
  const r = RARITY[rarity];
  return (
    <div style={{ display: "grid", gap: 8, alignContent: "center", justifyItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <small style={{ fontSize: 8, letterSpacing: ".14em", color: "rgba(210,190,175,.6)", fontWeight: 700 }}>{label}</small>
        <small style={{ fontSize: 8, ...mono, color: "rgba(210,190,175,.5)" }}>1 / 1</small>
      </div>
      <HexSocket size={92} border={r.hex} glow={r.glow} glyph={glyph} label={name} />
      <small style={{ fontSize: 8, color: r.hex, textShadow: `0 0 6px ${r.glow}` }}>{name}</small>
    </div>
  );
}

export function DronesPanel({
  renderDrone, onEquip, onUpgrade, onBuyAmmo, onClose,
}: DronesPanelProps) {
  const [tab, setTab] = React.useState<"all" | DroneSlotKey>("all");
  const [selIdx, setSelIdx] = React.useState<number | null>(null);

  const items = React.useMemo(
    () => DRONE_INVENTORY.map((it, i) => ({ ...it, i }))
      .filter((o) => tab === "all" || o.cat === tab),
    [tab],
  );
  const tabIdx = DRONE_TABS.findIndex((t) => t.key === tab);
  const maxed = DRONE.level >= DRONE.levelCap;
  const ammoPct = Math.round((DRONE.ammo / DRONE.ammoCap) * 100);

  const statusRows = [
    { k: "LEVEL", v: `${DRONE.level} / ${DRONE.levelCap}` },
    { k: "SLOTS", v: `${DRONE.slotsUsed} / ${DRONE.slotsCap}` },
    { k: "HULL", v: DRONE.hull.toLocaleString("en-US") },
  ];

  return (
    <div
      style={{
        position: "relative", padding: "40px 24px", display: "grid", placeItems: "center",
        background: "radial-gradient(600px 360px at 50% 26%,rgba(255,138,61,.1),transparent 70%),#05040a",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,.6)",
      }}
    >
      <HeroFrame width={DRONE_PANEL_W} chamfer={22}>
        <PanelHeader glyph="⌬" title="DRONES" onClose={onClose} closeLabel="Close drone bay" />

        {/* title row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px 8px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <b style={{ ...display, fontSize: 14, letterSpacing: ".06em", color: "#ffb673", textShadow: "0 0 10px rgba(255,138,61,.6)" }}>
              {DRONE.name}
            </b>
            <span style={{ padding: "2px 7px", ...display, fontSize: 8, fontWeight: 700, letterSpacing: ".08em", color: "#ffd9b8", border: "1px solid rgba(255,138,61,.4)", background: "rgba(255,138,61,.1)" }}>
              LV {DRONE.level}
            </span>
            <small style={{ fontSize: 8.5, letterSpacing: ".06em", color: "rgba(210,190,175,.6)" }}>COMPANION DRONE</small>
          </div>
          <span style={{ padding: "6px 10px", border: "1px solid rgba(255,138,61,.35)", background: "rgba(255,138,61,.08)", ...mono, fontSize: 9.5, fontWeight: 700, color: "#e8b94d" }}>
            {DRONE.credits.toLocaleString("en-US")} CR
          </span>
        </div>

        {/* 4-column fit area */}
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 150px 280px", gap: 14, padding: "8px 20px 4px", alignItems: "stretch" }}>
          <Bank label={DRONE_BANKS[0].label} glyph={DRONE_BANKS[0].glyph} slotKey="weapon" />

          {/* turntable viewport */}
          <div style={{ position: "relative", overflow: "hidden", minHeight: 300, background: "radial-gradient(120% 130% at 50% 26%,rgba(255,138,61,.14),#070502 72%)" }}>
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(180deg,rgba(0,0,0,.24) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
            <i style={{ position: "absolute", left: "50%", top: "50%", width: 270, height: 270, transform: "translate(-50%,-50%)", border: "1px dashed rgba(255,173,110,.28)", borderRadius: "50%", pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", perspective: "800px" }}>
              <div
                className={styles.turntable}
                style={{ width: 210, height: 190, filter: "drop-shadow(0 20px 16px rgba(0,0,0,.6)) drop-shadow(0 0 20px rgba(255,138,61,.4))" }}
              >
                {renderDrone?.()}
              </div>
            </div>
            <b style={{ position: "absolute", left: "50%", bottom: 14, transform: "translateX(-50%)", ...display, fontSize: 9, letterSpacing: ".2em", color: "rgba(255,205,160,.55)" }}>
              DRONE BAY
            </b>
          </div>

          <div style={{ display: "grid", gap: 14, alignContent: "center", justifyItems: "center" }}>
            <Bank label={DRONE_BANKS[1].label} glyph={DRONE_BANKS[1].glyph} slotKey="module" />
            <Bank label={DRONE_BANKS[2].label} glyph={DRONE_BANKS[2].glyph} slotKey="aux" />
          </div>

          {/* status / upgrade / ammo stack */}
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            <div style={{ display: "grid", gap: 6, padding: "10px 12px", background: "rgba(4,5,11,.55)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.4),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
              <small style={{ fontSize: 7, letterSpacing: ".16em", color: "rgba(210,190,175,.55)", fontWeight: 700 }}>STATUS</small>
              {statusRows.map((row) => (
                <div key={row.k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid rgba(255,138,61,.1)" }}>
                  <small style={{ fontSize: 8.5, color: "rgba(226,212,198,.7)" }}>{row.k}</small>
                  <b style={{ ...mono, fontSize: 10, color: "#f2ece0" }}>{row.v}</b>
                </div>
              ))}
            </div>

            {/* upgrade — the export swaps the button for a MAX LEVEL notice
                rather than disabling it (PORT_NOTES.md §4). */}
            {maxed ? (
              <div style={{ textAlign: "center", padding: "9px 4px", border: "1px solid rgba(92,255,138,.35)", background: "rgba(92,255,138,.08)", ...display, fontSize: 9, letterSpacing: ".16em", fontWeight: 700, color: "#5cff8a" }}>
                MAX LEVEL REACHED
              </div>
            ) : (
              <button
                onClick={onUpgrade}
                className={styles.chipBtn}
                style={{ padding: "9px 4px", border: "1px solid rgba(255,138,61,.4)", background: "rgba(255,138,61,.1)", ...display, fontSize: 9, letterSpacing: ".16em", fontWeight: 700, color: "#ffd9b8", cursor: "pointer" }}
              >
                UPGRADE DRONE
              </button>
            )}

            <div style={{ display: "grid", gap: 6, padding: "10px 12px", background: "rgba(4,5,11,.55)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.4),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <small style={{ fontSize: 7, letterSpacing: ".16em", color: "rgba(210,190,175,.55)", fontWeight: 700 }}>AMMO</small>
                <b style={{ ...mono, fontSize: 9.5, color: "#ffd9b8" }}>
                  {DRONE.ammo.toLocaleString("en-US")} / {DRONE.ammoCap.toLocaleString("en-US")}
                </b>
              </div>
              <i style={{ display: "block", height: 6, background: "rgba(0,0,0,.5)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.7)" }}>
                <i style={{ display: "block", height: "100%", width: `${ammoPct}%`, background: "linear-gradient(90deg,#1c8fb0,#4ee2ff)", boxShadow: "0 0 8px rgba(78,226,255,.6)" }} />
              </i>
              <button
                onClick={onBuyAmmo}
                className={styles.chipBtn}
                style={{ marginTop: 2, padding: "7px 4px", border: "1px solid rgba(232,185,77,.4)", background: "rgba(232,185,77,.08)", ...mono, fontSize: 9, fontWeight: 700, color: "#e8b94d", cursor: "pointer" }}
              >
                REFILL · {DRONE.ammoCost.toLocaleString("en-US")} CR
              </button>
            </div>
          </div>
        </div>

        {/* inventory */}
        <div style={{ display: "grid", gap: 10, padding: "10px 20px 24px" }}>
          <div
            style={{
              position: "relative", display: "flex", alignItems: "stretch", gap: 1, overflow: "hidden",
              background: "rgba(4,8,16,.55)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)",
              clipPath: "polygon(10px 0,100% 0,100% 100%,0 100%,0 10px)",
            }}
          >
            {DRONE_TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  aria-label={t.label}
                  onClick={() => { setTab(t.key); setSelIdx(null); }}
                  className={styles.tabBtn}
                  style={{
                    flex: 1, padding: "9px 6px", border: "none", cursor: "pointer",
                    background: on ? "rgba(255,138,61,.14)" : "none",
                    color: on ? "#ffd9b8" : "rgba(226,210,196,.72)",
                    ...display, fontSize: 8.5, letterSpacing: ".12em", fontWeight: 700,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
            {tabIdx >= 0 && (
              <>
                <TabIndicator leftPct={tabIdx * DRONE_TAB_PCT} widthPct={DRONE_TAB_PCT} edge="top" />
                <TabIndicator leftPct={tabIdx * DRONE_TAB_PCT} widthPct={DRONE_TAB_PCT} edge="bottom" />
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 10 }}>
            {items.map((it) => {
              const r = RARITY[it.rarity];
              const sel = selIdx === it.i;
              return (
                <div key={`${it.name}-${it.i}`} style={{ display: "grid", gap: 5, justifyItems: "center" }}>
                  <HexSocket
                    size={72}
                    border={sel ? "#ffd9b8" : r.hex}
                    glow={r.glow}
                    glyph={CAT_GLYPH[it.cat]}
                    selected={sel}
                    onClick={() => setSelIdx(it.i)}
                    label={it.name}
                  />
                  <small style={{ fontSize: 7.5, textAlign: "center", color: "rgba(226,212,198,.75)" }}>{it.name}</small>
                  <small style={{ fontSize: 6.5, letterSpacing: ".1em", fontWeight: 700, color: r.hex }}>{r.label}</small>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => { const s = items.find((o) => o.i === selIdx); if (s) onEquip?.(s); }}
            className={styles.chipBtn}
            disabled={selIdx === null}
            style={{
              justifySelf: "center", minWidth: 220, padding: "9px 18px",
              border: "1px solid rgba(255,138,61,.45)",
              background: selIdx === null ? "rgba(255,138,61,.05)" : "rgba(255,138,61,.12)",
              ...display, fontSize: 10, letterSpacing: ".2em", fontWeight: 900,
              color: "#fff2e2", cursor: selIdx === null ? "not-allowed" : "pointer",
              opacity: selIdx === null ? 0.45 : 1,
              textShadow: "0 0 8px #ff8a3d,0 0 18px rgba(255,138,61,.8)",
            }}
          >
            EQUIP
          </button>
        </div>
      </HeroFrame>
    </div>
  );
}
