import React from "react";
import styles from "./HangarDockOverlay.module.css";
import type { HangarDockOverlayProps, StatRow } from "./HangarDockOverlay.types";
import {
  DEFAULT_STATION_STATS, DEFAULT_SHIP_STATS, DEFAULT_SERVICES, DEFAULT_DOCK_TABS,
  METAL_RIM_BG, DOCK_TAB_WIDTH, DOCK_TAB_GAP,
} from "./HangarDockOverlay.constants";

/**
 * S-01 · Hangar Dock Overlay
 *
 * MIGRATED from the design handoff, not rebuilt:
 *   Downloads/Cosmic Realm UI Upgrade (2).zip
 *     -> design_handoff_hangar_dock_overlay/src/HangarDockOverlay.tsx
 *
 * Every gradient, clip-path, shadow, inset and animation value is the
 * handoff's own. Two adaptations were required for this project and are the
 * only deviations:
 *
 *   1. Fonts. NONE any more. The handoff specifies Orbitron / JetBrains Mono and
 *      ships no binaries ("binaryIncluded": false in export-manifest.json), so
 *      this port originally substituted --font-display / --font-mono. That was
 *      wrong: Kenney Future Narrow draws U+2039/U+203A as ROUND glyphs, so the
 *      carousel arrows came out as circles rather than the design's sharp
 *      angular arrows. Both faces are now loaded from Google Fonts in
 *      index.html and the export's own font-family values are used verbatim.
 *   2. Asset path. The handoff's metal-rim-atlas.png is byte-identical
 *      (2,965,805 bytes) to /assets/ui/atlas/brushed-metal.png already served
 *      here, and faction-eic.png (1,214 bytes) to /assets/ui/factions/eic.png,
 *      so the existing files are reused rather than duplicated.
 *
 * The handoff's README notes the src/ files are "design references … not
 * production code to import as-is" because no target framework was given.
 * The target here IS React, so the implementation transfers directly.
 */

const orbitron: React.CSSProperties = { fontFamily: "Orbitron,sans-serif" };
// The export writes "font-family:'JetBrains Mono',monospace" on 86 rules.
// --font-mono was never defined anywhere in this project, so this resolved
// to nothing and every figure fell back to the browser default.
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace" };

function StatRows({ rows }: { rows: StatRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <small style={{ flex: 1, ...mono, fontSize: 9.5, letterSpacing: ".03em", color: "rgba(214,200,190,.75)" }}>
            {r.label}
          </small>
          <b style={{ ...mono, fontSize: 10, fontVariantNumeric: "tabular-nums", color: r.hex, textShadow: `0 0 8px ${r.glow}` }}>
            {r.value}
          </b>
        </div>
      ))}
    </>
  );
}

/** Shared 3-layer bevel: steel rim -> amber accent band -> dark face. Used by
 *  both Station Status and Quick Info. Station Services intentionally has NO
 *  frame (see handoff README — "unframed" panels use floating text only). */
function PanelFrame({
  chamferOuter, glowDelay, children,
}: { chamferOuter: number; glowDelay?: string; children: React.ReactNode }) {
  const cOuter = chamferOuter, cMid = chamferOuter - 1, cInner = chamferOuter - 2.5;
  const clip = (c: number) => `polygon(0 0,calc(100% - ${c}px) 0,100% ${c}px,100% 100%,${c}px 100%,0 calc(100% - ${c}px))`;
  return (
    <div style={{ filter: "drop-shadow(0 0 6px rgba(255,138,61,.55)) drop-shadow(0 0 14px rgba(255,138,61,.3))" }}
         className={glowDelay ? styles.frameGlowDelayed : styles.frameGlow}>
      <div style={{ position: "relative", padding: 2, background: "linear-gradient(150deg,#3d4a58,#151a20 45%,#05070a)", clipPath: clip(cOuter) }}>
        <i className={styles.cornerGlow} style={{ position: "absolute", top: 6, left: 6, width: 10, height: 10, borderTop: "1px solid rgba(255,205,160,1)", borderLeft: "1px solid rgba(255,205,160,1)", zIndex: 3, pointerEvents: "none" }} />
        <i className={styles.cornerGlow} style={{ position: "absolute", bottom: 6, right: 6, width: 10, height: 10, borderBottom: "1px solid rgba(255,205,160,1)", borderRight: "1px solid rgba(255,205,160,1)", zIndex: 3, pointerEvents: "none", animationDelay: ".4s" }} />
        <div className={styles.frameGlow} style={{ padding: 1.5, background: "linear-gradient(160deg,#ffb673,#a34e12 45%,#2a1206)", boxShadow: "0 0 22px rgba(255,138,61,.9)", clipPath: clip(cMid) }}>
          <div style={{ position: "relative", background: "linear-gradient(165deg,#140f0b,#020101)", boxShadow: "inset 0 4px 10px rgba(0,0,0,.8),inset 0 0 0 1px rgba(255,173,110,.16),inset 0 -18px 26px rgba(0,0,0,.5)", clipPath: clip(cInner) }}>
            {children}
            <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(180deg,rgba(0,0,0,.24) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
            <i style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 50% 0%,rgba(255,173,110,.14),transparent 62%)", boxShadow: "inset 0 0 30px rgba(0,0,0,.65)", pointerEvents: "none" }} />
            <i style={{ position: "absolute", top: 0, left: "-20%", width: "55%", height: "180%", background: "linear-gradient(115deg,rgba(255,255,255,.05),transparent 55%)", transform: "rotate(8deg)", pointerEvents: "none" }} />
            <i className={styles.bootScan} style={{ position: "absolute", left: 0, right: 0, height: "34%", background: "linear-gradient(180deg,transparent,rgba(255,190,140,.16),transparent)", pointerEvents: "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HangarDockOverlay({
  bayBackgroundSrc, stationName, stationTag, stationCode, factionIconSrc, ownerLabel,
  stationOnline = true, stationStats = DEFAULT_STATION_STATS,
  shipName, shipClassLabel, shipSilhouetteSrc, shipViewport, shipOnline = true, shipStats = DEFAULT_SHIP_STATS,
  onShipLoadout, services = DEFAULT_SERVICES, onServiceSelect,
  dockTabs = DEFAULT_DOCK_TABS, activeDockTab, onDockTabSelect,
  onUndock, undockSubtext = "All systems nominal",
}: HangarDockOverlayProps) {
  return (
    // Root. The handoff renders this as a standalone 700px page section with a
    // black fill and an amber ring. Here it is an overlay ON TOP of the live 3D
    // hangar, so the fill and ring only apply when a bay image is actually
    // supplied (`bayBackgroundSrc` — the handoff's own "not supplied by the
    // design" slot). Without one it stays transparent so the real scene shows
    // through, and it fills its parent instead of forcing 700px.
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: bayBackgroundSrc ? "#000" : "transparent", boxShadow: bayBackgroundSrc ? "0 0 0 2px #ff8a3d,0 0 16px rgba(255,138,61,.65),0 0 40px rgba(255,138,61,.4)" : undefined, pointerEvents: "none" }}>
      {/* Bay render — NOT supplied by the design; wire to the real 3D scene capture. */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: bayBackgroundSrc ? `url(${bayBackgroundSrc})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
      {bayBackgroundSrc && <i style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 50% 42%,transparent 40%,rgba(3,4,10,.55) 100%),linear-gradient(180deg,rgba(3,4,10,.55),transparent 20%,transparent 66%,rgba(3,4,10,.68))", pointerEvents: "none" }} />}

      {/* ---------- Station Status (top-left) ---------- */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 2, width: 270, pointerEvents: "auto", filter: "drop-shadow(0 4px 0 rgba(2,1,1,.9)) drop-shadow(0 10px 12px rgba(0,0,0,.65)) drop-shadow(0 20px 30px rgba(0,0,0,.55))" }}>
        <PanelFrame chamferOuter={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,.6)", background: "linear-gradient(100deg,rgba(255,138,61,.16),transparent 74%)" }}>
            <span style={{ width: 30, height: 30, flex: "0 0 auto", display: "grid", placeItems: "center", background: "linear-gradient(150deg,#3a2c1e,#0c0805)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", boxShadow: "inset 0 0 0 1px rgba(255,161,90,.35)" }}>
              <img src={factionIconSrc} alt="" style={{ display: "block", width: 20, height: 20, objectFit: "contain", filter: "drop-shadow(0 0 7px rgba(255,138,61,.75))" }} />
            </span>
            <div style={{ display: "grid", gap: 2, flex: 1 }}>
              <small style={{ fontSize: 8, letterSpacing: ".22em", color: "rgba(210,190,175,.6)", fontWeight: 700 }}>{stationTag}</small>
              <b style={{ ...orbitron, fontSize: 13, letterSpacing: ".07em", color: "#fbe9d8" }}>{stationName}</b>
            </div>
            <div style={{ display: "grid", gap: 3, justifyItems: "end" }}>
              <i className={stationOnline ? styles.pulse : undefined} style={{ width: 6, height: 6, background: "#5cff8a", boxShadow: "0 0 8px #5cff8a", transform: "rotate(45deg)" }} />
              <small style={{ ...mono, fontSize: 6.5, letterSpacing: ".05em", color: "rgba(210,190,175,.5)" }}>{stationCode}</small>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8, padding: "13px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i style={{ width: 6, height: 6, flex: "0 0 auto", background: "#ff8a3d", boxShadow: "0 0 7px #ff8a3d", transform: "rotate(45deg)" }} />
              <small style={{ fontSize: 8.5, letterSpacing: ".18em", color: "rgba(230,210,195,.75)", fontWeight: 700 }}>STATION STATUS</small>
              <i style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(255,138,61,.4),transparent)" }} />
            </div>
            <StatRows rows={stationStats} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 1 }}>
              <small style={{ fontSize: 8, letterSpacing: ".16em", color: "rgba(210,190,175,.55)", fontWeight: 700 }}>OWNER</small>
              <span style={{ padding: "2px 7px", ...orbitron, fontSize: 7.5, letterSpacing: ".14em", fontWeight: 700, color: "#9fe0ff", border: "1px solid rgba(78,226,255,.4)", background: "rgba(10,30,48,.55)", clipPath: "polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%)" }}>{ownerLabel}</span>
            </div>
          </div>
        </PanelFrame>
      </div>

      {/* ---------- Ready to Undock (unframed, floating) ----------
          Sits directly on the 3D hangar, whose brightness varies with the
          camera and the deck's light strips — pale hull or a lit strip behind
          the text dropped the contrast badly. A soft dark radial scrim keeps it
          readable without introducing a panel frame here (the block is
          deliberately unframed): it has no edge of its own, just falls off to
          fully transparent well inside the block's bounds. */}
      <div style={{ position: "absolute", bottom: 130, left: 20, zIndex: 2, width: 270, pointerEvents: "auto", display: "grid", gap: 11, padding: "8px 6px" }}>
        <i aria-hidden style={{
          position: "absolute", inset: "-14px -10px", zIndex: -1, pointerEvents: "none",
          background: "radial-gradient(ellipse 78% 62% at 50% 50%, rgba(0,0,0,.62), rgba(0,0,0,.42) 52%, rgba(0,0,0,0) 78%)",
        }} />
        <div style={{ display: "grid", gap: 1, textAlign: "center" }}>
          <b style={{ ...orbitron, fontSize: 12, letterSpacing: ".15em", color: "#ffd9b8", textShadow: "0 0 10px rgba(255,138,61,.5)" }}>READY TO UNDOCK</b>
          <small style={{ fontSize: 8.5, letterSpacing: ".08em", color: "rgba(210,190,175,.65)" }}>{undockSubtext}</small>
        </div>
        <button aria-label="Undock from station" onClick={onUndock}
                style={{ position: "relative", display: "grid", justifyItems: "center", gap: 11, padding: "6px 4px", border: "none", background: "none", cursor: "pointer", transition: "filter .14s ease" }}
                onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
                onMouseDown={(e) => (e.currentTarget.style.filter = "brightness(1.4)")}
                onMouseUp={(e) => (e.currentTarget.style.filter = "brightness(1.2)")}>
          <i className={styles.pulse} style={{ width: "100%", height: 3, background: "linear-gradient(90deg,transparent,#ff8a3d 12%,#ffe4c9 50%,#ff8a3d 88%,transparent)", boxShadow: "0 0 8px #ff8a3d,0 0 20px rgba(255,138,61,.85),0 0 42px rgba(255,138,61,.55)" }} />
          <b style={{ ...orbitron, fontSize: 17, fontWeight: 900, letterSpacing: ".34em", color: "#fff2e2", textShadow: "0 0 10px #ff8a3d,0 0 24px rgba(255,138,61,.95),0 0 52px rgba(255,138,61,.7),0 0 90px rgba(255,138,61,.4)" }}>UNDOCK</b>
          <i className={styles.pulse} style={{ width: "100%", height: 3, background: "linear-gradient(90deg,transparent,#ff8a3d 12%,#ffe4c9 50%,#ff8a3d 88%,transparent)", boxShadow: "0 0 8px #ff8a3d,0 0 20px rgba(255,138,61,.85),0 0 42px rgba(255,138,61,.55)" }} />
        </button>
        <small style={{ fontSize: 8, letterSpacing: ".04em", color: "rgba(210,190,175,.55)", textAlign: "center" }}>Docking clamps release on confirm</small>
      </div>

      {/* ---------- Right column: Quick Info (framed) + Station Services (unframed) ---------- */}
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 2, width: 270, pointerEvents: "auto", display: "grid", gap: 12, filter: "drop-shadow(0 4px 0 rgba(2,1,1,.9)) drop-shadow(0 10px 12px rgba(0,0,0,.65)) drop-shadow(0 20px 30px rgba(0,0,0,.55))" }}>
        <PanelFrame chamferOuter={20} glowDelay=".4s">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 16px", borderBottom: "1px solid rgba(0,0,0,.6)", background: "linear-gradient(100deg,rgba(255,138,61,.16),transparent 74%)" }}>
            <b style={{ ...orbitron, fontSize: 11, letterSpacing: ".2em", color: "#ffd9b8" }}>QUICK INFO</b>
            <div style={{ display: "grid", gap: 3, justifyItems: "end" }}>
              <i className={shipOnline ? styles.pulse : undefined} style={{ width: 6, height: 6, background: "#5cff8a", boxShadow: "0 0 8px #5cff8a", transform: "rotate(45deg)" }} />
              <small style={{ ...mono, fontSize: 6.5, letterSpacing: ".05em", color: "rgba(210,190,175,.5)" }}>NAV-01</small>
            </div>
          </div>
          <div style={{ display: "grid", gap: 10, padding: "14px 16px" }}>
            <div style={{ position: "relative", padding: 2, background: "linear-gradient(150deg,#3d4a58,#0a0d11)", clipPath: "polygon(6px 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%,0 6px)" }}>
              <div style={{ position: "relative", overflow: "hidden", height: 88, background: "#020507", boxShadow: "inset 0 3px 8px rgba(0,0,0,.85),inset 0 0 0 1px rgba(78,226,255,.28)", clipPath: "polygon(5px 0,calc(100% - 5px) 0,100% 5px,100% 100%,0 100%,0 5px)" }}>
                {/* Design ships an image slot here; this project renders the
                    real hull instead (see shipViewport). Image path kept as the
                    documented fallback. */}
                {shipViewport
                  ? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{shipViewport}</div>
                  : shipSilhouetteSrc && <img src={shipSilhouetteSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(180deg,rgba(0,0,0,.3) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
                <i style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 50% 0%,rgba(78,226,255,.16),transparent 62%)", pointerEvents: "none" }} />
                <i style={{ position: "absolute", top: 5, left: 5, width: 9, height: 9, borderTop: "1px solid rgba(78,226,255,.8)", borderLeft: "1px solid rgba(78,226,255,.8)", pointerEvents: "none" }} />
                <i style={{ position: "absolute", bottom: 5, right: 5, width: 9, height: 9, borderBottom: "1px solid rgba(78,226,255,.8)", borderRight: "1px solid rgba(78,226,255,.8)", pointerEvents: "none" }} />
              </div>
            </div>
            <div style={{ display: "grid", gap: 1 }}>
              <small style={{ fontSize: 8, letterSpacing: ".18em", color: "rgba(210,190,175,.55)", fontWeight: 700 }}>{shipClassLabel}</small>
              <b style={{ ...orbitron, fontSize: 13, letterSpacing: ".05em", color: "#fbe9d8" }}>{shipName}</b>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <StatRows rows={shipStats} />
            </div>
            <button onClick={onShipLoadout}
                    style={{ padding: 9, border: "1px solid rgba(255,138,61,.4)", background: "linear-gradient(180deg,rgba(255,138,61,.14),rgba(8,5,3,.9))", color: "#ffd9b8", ...orbitron, fontSize: 9, letterSpacing: ".16em", fontWeight: 700, cursor: "pointer", transition: "all .15s ease" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ff8a3d"; e.currentTarget.style.color = "#fff2e2"; e.currentTarget.style.background = "rgba(255,138,61,.22)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,138,61,.4)"; e.currentTarget.style.color = "#ffd9b8"; e.currentTarget.style.background = "linear-gradient(180deg,rgba(255,138,61,.14),rgba(8,5,3,.9))"; }}>
              SHIP LOADOUT
            </button>
          </div>
        </PanelFrame>

        {/* Station Services — unframed, same treatment as Ready-to-Undock: floating
            text, glow lives only in the underline/text, no card or border. */}
        <div style={{ width: 270, display: "grid", gap: 11, padding: "8px 6px" }}>
          <div style={{ display: "grid", gap: 1 }}>
            <b style={{ ...orbitron, fontSize: 12, letterSpacing: ".15em", color: "#ffd9b8", textShadow: "0 0 10px rgba(255,138,61,.5)" }}>STATION SERVICES</b>
            <small style={{ fontSize: 8.5, letterSpacing: ".08em", color: "rgba(210,190,175,.65)" }}>Docked · full access</small>
          </div>
          {services.map((sv, i) => (
            <button key={sv.label} aria-label={sv.label} onClick={() => onServiceSelect?.(i)}
                    style={{ position: "relative", display: "grid", justifyItems: "start", gap: 6, padding: "2px 0", border: "none", background: "none", cursor: "pointer", transition: "filter .14s ease" }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.25)")}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
                    onMouseDown={(e) => (e.currentTarget.style.filter = "brightness(1.4)")}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <i style={{ fontStyle: "normal", fontSize: 12, color: "#ffb673", textShadow: "0 0 8px rgba(255,138,61,.6)" }}>{sv.icon}</i>
                <small style={{ ...orbitron, fontSize: 10, letterSpacing: ".1em", fontWeight: 700, color: "#ffd9b8", textShadow: "0 0 8px rgba(255,138,61,.4)" }}>{sv.label}</small>
              </div>
              <i className={styles.pulse} style={{ width: "100%", height: 2, background: "linear-gradient(90deg,#ff8a3d,rgba(255,138,61,.2) 75%,transparent)", boxShadow: "0 0 6px #ff8a3d,0 0 16px rgba(255,138,61,.65)" }} />
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Dock tab row (bottom-center) ---------- */}
      <div style={{ position: "absolute", left: "50%", bottom: 20, transform: "translateX(-50%)", zIndex: 2, display: "flex", gap: DOCK_TAB_GAP, pointerEvents: "auto" }}>
        {dockTabs.map((d, i) => {
          const on = i === activeDockTab;
          const glowSize = on ? "28px" : "0px";
          const bg = on
            ? "linear-gradient(180deg,rgba(255,138,61,.28),rgba(8,5,3,.97) 60%)"
            : "linear-gradient(180deg,#0d0906,#020101)";
          const color = on ? "#ffd9b8" : "rgba(226,210,196,.72)";
          return (
            <button key={d.label} aria-label={`${d.label} — ${d.sub}`} onClick={() => onDockTabSelect(i)}
                    style={{ position: "relative", width: DOCK_TAB_WIDTH, padding: 0, border: "none", background: "none", cursor: "pointer", filter: `drop-shadow(0 3px 0 rgba(2,1,1,.9)) drop-shadow(0 7px 8px rgba(0,0,0,.55)) drop-shadow(0 0 ${glowSize} #ff8a3d)`, transition: "transform .14s ease" }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
                    onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}>
              <i style={{ position: "absolute", inset: 0, display: "block", background: METAL_RIM_BG, backgroundSize: "cover,400% 400%", backgroundPosition: "center,100% 0%", clipPath: "polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%,0 10px)" }} />
              <span style={{ position: "relative", display: "grid", justifyItems: "center", gap: 7, margin: 2, padding: "10px 6px 10px", overflow: "hidden", background: bg, boxShadow: "inset 0 3px 8px rgba(0,0,0,.8)", clipPath: "polygon(9px 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%,0 9px)" }}>
                <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(180deg,rgba(0,0,0,.22) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
                <i className={styles.sweep} style={{ position: "absolute", top: 0, left: "-45%", width: "26%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(255,190,140,.16),transparent)" }} />
                <i style={{ position: "absolute", top: 4, left: 4, width: 7, height: 7, borderTop: "1px solid rgba(255,138,61,.6)", borderLeft: "1px solid rgba(255,138,61,.6)", pointerEvents: "none" }} />
                <i style={{ position: "absolute", bottom: 4, right: 4, width: 7, height: 7, borderBottom: "1px solid rgba(255,138,61,.6)", borderRight: "1px solid rgba(255,138,61,.6)", pointerEvents: "none" }} />
                <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,#ff8a3d,transparent)", opacity: on ? 1 : 0, boxShadow: "0 0 10px #ff8a3d" }} />
                <span style={{ position: "relative", display: "grid", placeItems: "center", width: 46, height: 34, overflow: "hidden", background: "radial-gradient(120% 140% at 50% 18%,rgba(255,138,61,.22),rgba(4,3,2,.95) 72%)", boxShadow: `inset 0 0 0 1px rgba(255,161,90,.4),inset 0 3px 6px rgba(0,0,0,.85),0 0 ${glowSize} #ff8a3d`, clipPath: "polygon(6px 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%,0 6px)" }}>
                  <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(180deg,rgba(255,180,120,.08) 0 1px,transparent 1px 3px)", pointerEvents: "none" }} />
                  <i className={styles.sweep} style={{ position: "absolute", top: 0, left: "-40%", width: "22%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(255,220,190,.4),transparent)", animationDuration: "3.6s" }} />
                  <i style={{ position: "absolute", top: 3, right: 4, width: 4, height: 4, background: "#ff8a3d", boxShadow: "0 0 6px #ff8a3d", transform: "rotate(45deg)", opacity: on ? 1 : 0 }} />
                  <b style={{ position: "relative", ...orbitron, fontSize: 17, fontWeight: 700, color, textShadow: "0 0 9px #ff8a3d" }}>{d.icon}</b>
                </span>
                <small style={{ position: "relative", fontSize: 8.5, letterSpacing: ".12em", fontWeight: 700, color, whiteSpace: "nowrap" }}>{d.label}</small>
              </span>
            </button>
          );
        })}
        {/* 3-layer glow-smear indicator, slides via CSS transition when activeDockTab changes */}
        {[
          { height: 5, opacity: .3, blur: 4, duration: "480ms" },
          { height: 3, opacity: .55, blur: 2, duration: "380ms" },
          { height: 2, opacity: 1, blur: 0, duration: "260ms" },
        ].map((layer, idx) => (
          <i key={idx} style={{
            position: "absolute", left: activeDockTab * (DOCK_TAB_WIDTH + DOCK_TAB_GAP), bottom: -10,
            width: DOCK_TAB_WIDTH, height: layer.height, pointerEvents: "none", opacity: layer.opacity,
            filter: layer.blur ? `blur(${layer.blur}px)` : undefined,
            background: idx < 2 ? "linear-gradient(90deg,transparent,#ff8a3d,transparent)" : "linear-gradient(90deg,transparent,#ff8a3d 22%,#ff8a3d 78%,transparent)",
            boxShadow: idx === 2 ? "0 0 10px #ff8a3d,0 0 24px #ff8a3d" : undefined,
            transition: `left ${layer.duration} cubic-bezier(.22,.9,.25,1)`,
          }} />
        ))}
      </div>
    </div>
  );
}

export default HangarDockOverlay;
