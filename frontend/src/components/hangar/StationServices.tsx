import React from "react";
import styles from "./HangarDockOverlay.module.css";
import { HeroFrame, PanelHeader, SubHeader } from "./HeroFrame";
import { CtaButton } from "./CtaButton";
import {
  STATION_SVC, SERVICE_CARDS, AUTO_TOGGLES, renewCredits, toMcoins,
  SERVICES_PANEL_W,
  type StationServices as StationServicesData,
} from "./Services.constants";

/**
 * S-08 · Station Services
 *
 * MIGRATED from the design export, not rebuilt:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (section "S-08 · STATION SERVICES")
 *
 * Four blocks: repair/recharge/resupply cards, the ammo banks with their grade
 * tabs, insurance, and the auto-service toggles.
 *
 * Insurance prices are computed, not stored — see renewCredits()/toMcoins() in
 * Services.constants.ts, which carry the export's own .12/.06 and 14:1 ratios.
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

export interface StationServicesProps {
  data?: StationServicesData;
  /** Docked station's name — the export's sub-header is the station itself
   *  ("Halcyon Drift Outpost · SERVICE BAY"), not a generic section title. */
  stationName?: string;
  onRepair?: (key: "hull" | "shield" | "drone") => void;
  onRefill?: (ammoKey: string, variant: string) => void;
  onRenewInsurance?: (pay: "CREDITS" | "MCOINS") => void;
  onClose?: () => void;
}

/** Recessed condition bar used by every repair card and ammo bank. */
function Meter({ pct, hex }: { pct: number; hex: string }) {
  return (
    <i style={{ display: "block", height: 6, background: "rgba(0,0,0,.5)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.7)" }}>
      <i style={{ display: "block", height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: `linear-gradient(90deg,${hex}88,${hex})`, boxShadow: `0 0 8px ${hex}99` }} />
    </i>
  );
}

/** The card shell the export reuses for services, ammo and insurance. */
function SvcCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid", gap: 9, padding: 14,
        background: "linear-gradient(165deg,#140f0b,#050301)",
        border: "1px solid rgba(255,138,61,.22)",
        boxShadow: "inset 0 3px 6px rgba(0,0,0,.6)",
        clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)",
      }}
    >
      {children}
    </div>
  );
}

export function StationServices({
  data = STATION_SVC, stationName = "Halcyon Drift Outpost",
  onRepair, onRefill, onRenewInsurance, onClose,
}: StationServicesProps) {
  const [variant, setVariant] = React.useState<Record<string, string>>(
    () => Object.fromEntries(data.ammo.map((a) => [a.key, a.variants[0]])),
  );
  const [toggles, setToggles] = React.useState<Record<string, boolean>>({});
  const [pay, setPay] = React.useState<"CREDITS" | "MCOINS">("CREDITS");

  const ins = data.insurance;
  const credits = renewCredits(ins.shipPrice, ins.tier);
  const mcoins = toMcoins(credits);

  return (
    <div
      style={{
        position: "relative", padding: "40px 24px", display: "grid", placeItems: "center",
        background: "radial-gradient(600px 360px at 50% 26%,rgba(255,138,61,.1),transparent 70%),#05040a",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,.6)",
      }}
    >
      <HeroFrame width={SERVICES_PANEL_W} chamfer={22}>
        {/* The export's panel glyph is the gear ⚙ and its title is the full
            "STATION SERVICES"; the sub-header carries the station's own name
            with a SERVICE BAY chip, then CREDITS and MCOINS as separate
            readouts. */}
        <PanelHeader glyph="⚙" title="STATION SERVICES" onClose={onClose} closeLabel="Close station services" />

        <div style={{ display: "grid", gap: 10, padding: "16px 20px 8px" }}>
          <SubHeader glyph="⚙" title={stationName}>
            <span style={{ padding: "2px 7px", ...display, fontSize: 8, fontWeight: 700, letterSpacing: ".08em", color: "#ffd9b8", border: "1px solid rgba(255,138,61,.4)", background: "rgba(255,138,61,.14)" }}>
              SERVICE BAY
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <span style={{ ...mono, fontSize: 9.5, fontWeight: 700, color: "#e8b94d" }}>
                CREDITS {data.credits.toLocaleString("en-US")}
              </span>
              <span style={{ ...mono, fontSize: 9.5, fontWeight: 700, color: "#b866ff" }}>
                MCOINS {data.mcoins.toLocaleString("en-US")}
              </span>
            </span>
          </SubHeader>
        </div>

        {/* The export's body is TWO columns — "1fr 460px" — with repairs and
            ammo stacked on the left and insurance/respawn stacked alongside
            them on the right, not a full-width stack with a narrow row at the
            bottom. Quoting the export's own note: "Repairs and ammo stack in a
            left column; insurance and respawn stack in a right column alongside
            them." */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 460px", gap: 0, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 0 }}>

        {/* repair cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, padding: "8px 20px 4px" }}>
          {SERVICE_CARDS.map((c) => {
            const svc = data[c.key];
            const full = svc.pct >= 100;
            return (
              <SvcCard key={c.key}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <i style={{ fontStyle: "normal", fontSize: 13, color: c.hex, textShadow: `0 0 8px ${c.hex}88` }}>{c.glyph}</i>
                    <b style={{ ...display, fontSize: 9.5, letterSpacing: ".1em", color: "#fff6ea" }}>{c.label}</b>
                  </span>
                  <b style={{ ...mono, fontSize: 10, color: full ? "#5cff8a" : "#ffd9b8" }}>{svc.pct}%</b>
                </div>
                <Meter pct={svc.pct} hex={c.hex} />
                {/* The export puts the cost INSIDE the action as "· {{ cost }} CR"
                    and drops it entirely once the service reads FULL. */}
                <CtaButton
                  hex={c.hex}
                  label={full ? "FULL" : "REPAIR"}
                  suffix={full ? undefined : `· ${svc.cost.toLocaleString("en-US")} CR`}
                  dim={full}
                  onClick={() => onRepair?.(c.key)}
                  style={{ width: "100%" }}
                />
              </SvcCard>
            );
          })}
        </div>

        {/* Ammo resupply — ONE card in the export ("◆ AMMO RESUPPLY") with the
            per-type banks nested inside it, not one card per ammo type. */}
        <div style={{ display: "grid", gap: 12, padding: "0 20px 12px" }}>
          <SvcCard>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i style={{ fontStyle: "normal", fontSize: 13, color: "#ffb673", textShadow: "0 0 8px rgba(255,138,61,.6)" }}>◆</i>
              <b style={{ ...display, fontSize: 10, letterSpacing: ".14em", color: "#fff6ea" }}>AMMO RESUPPLY</b>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
          {data.ammo.map((a) => {
            const pct = Math.round((a.cur / a.max) * 100);
            const sel = variant[a.key] ?? a.variants[0];
            return (
              <div key={a.key} style={{ display: "grid", gap: 7, paddingTop: 7, borderTop: "1px solid rgba(255,138,61,.14)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <i style={{ fontStyle: "normal", fontSize: 13, color: "#ffb673", textShadow: "0 0 8px rgba(255,138,61,.6)" }}>{a.glyph}</i>
                    <b style={{ ...display, fontSize: 9.5, letterSpacing: ".1em", color: "#fff6ea" }}>{a.label}</b>
                  </span>
                  <b style={{ ...mono, fontSize: 10, color: "#ffd9b8" }}>
                    {a.cur.toLocaleString("en-US")} / {a.max.toLocaleString("en-US")}
                  </b>
                </div>
                <Meter pct={pct} hex="#ff8a3d" />
                {/* grade tabs */}
                <div style={{ display: "flex", gap: 1, overflow: "hidden", background: "rgba(4,8,16,.55)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45)" }}>
                  {a.variants.map((v) => {
                    const on = sel === v;
                    return (
                      <button
                        key={v}
                        onClick={() => setVariant((s) => ({ ...s, [a.key]: v }))}
                        className={styles.tabBtn}
                        style={{
                          flex: 1, padding: "6px 4px", border: "none", cursor: "pointer",
                          background: on ? "rgba(255,138,61,.14)" : "none",
                          color: on ? "#ffd9b8" : "rgba(226,210,196,.72)",
                          ...display, fontSize: 8, letterSpacing: ".1em", fontWeight: 700,
                        }}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
                {/* "Auto-refill from empty costs up to {{ n }} CR" — the
                    export's own hint line under each bank. */}
                <small style={{ fontSize: 8, letterSpacing: ".04em", color: "rgba(210,190,175,.55)" }}>
                  Auto-refill from empty costs up to{" "}
                  <b style={{ ...mono, color: "#e8b94d" }}>
                    {Math.round(a.cost * (a.max / Math.max(1, a.max - a.cur))).toLocaleString("en-US")} CR
                  </b>
                </small>
                <CtaButton
                  hex="#ff8a3d" label="RESUPPLY"
                  suffix={`· ${a.cost.toLocaleString("en-US")} CR`}
                  textColor="#ffd9b8"
                  onClick={() => onRefill?.(a.key, sel)}
                  style={{ width: "100%" }}
                />
              </div>
            );
          })}
            </div>
          </SvcCard>
        </div>

          </div>{/* ← end LEFT column (repairs + ammo) */}

        {/* RIGHT column — insurance above respawn, alongside the left stack. */}
        <div style={{ display: "grid", gap: 12, padding: "8px 20px 24px 0", alignItems: "start" }}>
          <SvcCard>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i style={{ fontStyle: "normal", fontSize: 13, color: "#ffb673", textShadow: "0 0 8px rgba(255,138,61,.6)" }}>⛨</i>
                <b style={{ ...display, fontSize: 10, letterSpacing: ".14em", color: "#fff6ea" }}>SHIP INSURANCE</b>
              </span>
              <span
                style={{
                  padding: "3px 8px", ...display, fontSize: 8, fontWeight: 700, letterSpacing: ".08em",
                  color: ins.active ? "#5cff8a" : "#ff4d5e",
                  border: `1px solid ${ins.active ? "#5cff8a" : "#ff4d5e"}`,
                  background: "rgba(0,0,0,.3)",
                  textShadow: `0 0 8px ${ins.active ? "rgba(92,255,138,.6)" : "rgba(255,77,94,.6)"}`,
                }}
              >
                {ins.active ? `${ins.tier.toUpperCase()} · ${ins.cyclesLeft} CYCLES` : "UNINSURED"}
              </span>
            </div>
            {/* The export's own copy, verbatim — it states the actual 20%/5%
                rates and the 30-day term rather than paraphrasing them. */}
            <small style={{ fontSize: 8.5, lineHeight: 1.5, color: "#f2ece0" }}>
              A destroyed ship without coverage costs its FULL price to rebuild. Standard
              coverage cuts that to 20%; Premium cuts it to just 5%. Coverage runs 30 days
              per purchase and scales with this ship's value.
            </small>

            {/* Rebuild cost table — missing entirely from the port. */}
            <div style={{ display: "grid", gap: 4 }}>
              {([
                ["SHIP VALUE", ins.shipPrice, "#f2ece0"],
                ["REBUILD · UNINSURED (100%)", ins.shipPrice, "#ff4d5e"],
                ["REBUILD · STANDARD (20%)", Math.round(ins.shipPrice * 0.2), "#e8b94d"],
                ["REBUILD · PREMIUM (5%)", Math.round(ins.shipPrice * 0.05), "#5cff8a"],
              ] as const).map(([k, v, hex]) => (
                <div key={k} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, paddingTop: 4, borderTop: "1px solid rgba(255,138,61,.12)" }}>
                  <small style={{ fontSize: 7.5, letterSpacing: ".12em", fontWeight: 700, color: "rgba(206,226,246,.6)" }}>{k}</small>
                  <b style={{ ...mono, fontSize: 10, color: hex }}>{v.toLocaleString("en-US")} CR</b>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, paddingTop: 4, borderTop: "1px solid rgba(255,138,61,.12)" }}>
                <small style={{ fontSize: 7.5, letterSpacing: ".12em", fontWeight: 700, color: "rgba(206,226,246,.6)" }}>CYCLES LEFT</small>
                <b style={{ ...mono, fontSize: 10, color: "#ffd9b8" }}>{ins.cyclesLeft} · renews every 30 days</b>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(["CREDITS", "MCOINS"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPay(p)}
                  className={styles.chipBtn}
                  style={{
                    padding: "5px 10px", border: `1px solid ${pay === p ? "rgba(255,138,61,.5)" : "rgba(255,138,61,.2)"}`,
                    background: pay === p ? "rgba(255,138,61,.14)" : "none",
                    color: pay === p ? "#ffd9b8" : "rgba(226,210,196,.6)",
                    ...display, fontSize: 8, letterSpacing: ".1em", fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
              <small style={{ flex: 1, ...mono, fontSize: 9.5, textAlign: "right", color: "#e8b94d" }}>
                {pay === "CREDITS"
                  ? `${credits.toLocaleString("en-US")} CR`
                  : `${mcoins.toLocaleString("en-US")} MC`}
              </small>
              <CtaButton hex="#5cff8a" label="RENEW" textColor="#eaffef" selected onClick={() => onRenewInsurance?.(pay)} />
            </div>
            <small style={{ fontSize: 8, lineHeight: 1.5, color: "rgba(210,190,175,.55)" }}>
              MCoins is real-money currency — coverage costs noticeably less than paying with credits.
            </small>
          </SvcCard>

          <SvcCard>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i style={{ fontStyle: "normal", fontSize: 13, color: "#ffb673", textShadow: "0 0 8px rgba(255,138,61,.6)" }}>⌖</i>
                <b style={{ ...display, fontSize: 10, letterSpacing: ".14em", color: "#fff6ea" }}>RESPAWN PROTOCOL</b>
              </span>
              <small style={{ fontSize: 8.5, lineHeight: 1.5, color: "#f2ece0" }}>
                Sets where you redeploy after destruction. A respawn fee applies each time it's used.
              </small>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <small style={{ fontSize: 8.5, color: "rgba(226,212,198,.75)" }}>
                  {data.respawn.isHome ? "Home station" : "Remote station"}
                </small>
                <small style={{ ...mono, fontSize: 9, color: "#e8b94d" }}>
                  {data.respawn.fee.toLocaleString("en-US")} CR · {data.respawn.time}s
                </small>
              </div>
          </SvcCard>

          <SvcCard>
              <b style={{ ...display, fontSize: 10, letterSpacing: ".14em", color: "#fff6ea" }}>AUTO-SERVICE</b>
              {AUTO_TOGGLES.map((t) => {
                const on = !!toggles[t.key];
                return (
                  <button
                    key={t.key}
                    aria-label={`${t.label}: ${on ? "on" : "off"}`}
                    onClick={() => setToggles((s) => ({ ...s, [t.key]: !s[t.key] }))}
                    className={styles.tabBtn}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                      padding: "7px 2px", border: "none", background: "none", cursor: "pointer",
                      borderTop: "1px solid rgba(255,138,61,.1)",
                    }}
                  >
                    <span style={{ display: "grid", gap: 1, textAlign: "left" }}>
                      <b style={{ ...display, fontSize: 8.5, letterSpacing: ".1em", color: on ? "#ffd9b8" : "rgba(226,210,196,.7)" }}>{t.label}</b>
                      <small style={{ fontSize: 7.5, color: "rgba(210,190,175,.55)" }}>{t.sub}</small>
                    </span>
                    <i
                      style={{
                        position: "relative", width: 30, height: 14, flex: "0 0 auto",
                        background: on ? "rgba(92,255,138,.25)" : "rgba(0,0,0,.5)",
                        boxShadow: `inset 0 1px 3px rgba(0,0,0,.7)${on ? ",0 0 8px rgba(92,255,138,.4)" : ""}`,
                      }}
                    >
                      <i
                        style={{
                          position: "absolute", top: 2, left: on ? 18 : 2, width: 10, height: 10,
                          background: on ? "#5cff8a" : "rgba(200,190,180,.5)",
                          boxShadow: on ? "0 0 8px #5cff8a" : "none",
                          transition: "left .16s cubic-bezier(.2,.9,.25,1)",
                        }}
                      />
                    </i>
                  </button>
                );
              })}
          </SvcCard>
        </div>{/* ← end RIGHT column */}
        </div>{/* ← end two-column body */}
      </HeroFrame>
    </div>
  );
}
