// MIGRATED from the Cosmic Kit design export — not reconstructed.
//
// Source: export-cosmic-kit/Cosmic Kit.dc.html, section "I-05 · GALAXY MAP"
// (markup) and its "─── GALAXY MAP ───" script block (GMF/GMZ/GML/GM_SIZE/
// GM_GLYPH/GM_HOME/GM_YIELD/GM_ADJ/gmHops, plus the gmNodes/gmRoutes builders).
// Chart space, palette, node geometry, gradients, shadows, filters, clip-paths
// and the five cGm* keyframes are copied verbatim from that file.
//
// Earlier revisions of this component were rebuilt from screenshots and were
// wrong in the aspect ratio, the palette, the
// connection graph (20 links vs 25), the node build (SVG polygons vs three
// clip-path plates) and every animation. Do not re-derive these values from
// images — the export is the source of truth.
//
// LOGIC stays this project's own: sector codes map onto real ZoneIds by
// Zone.label, warping goes through travelToZone(), and SET COURSE is a local
// TRACKED marker (no autopilot exists here).
import { useEffect, useState } from "react";
import { useGame, state as gameState, bump, travelToZone } from "../game/store";
import { ZONES, RESOURCES, type ZoneId, type ResourceId } from "../game/types";
import { PrintPortal } from "./hud/PrintPortal";
import { usePressable } from "./hud/usePressable";

const ACCENT = "#4ee2ff";

function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255), g = (n >> 8 & 255), b = (n & 255);
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { const k = 1 + amt; r *= k; g *= k; b *= k; }
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}
function rgbaHex(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

// Two-corner chamfer clip-paths — the Kit's actual convention (panelFrame()
// comment: "Panels: TR + BL. Cards: TL + BR."), replacing the four-corner
// single-diagonal shape borrowed from Social/Settings in the first pass.
const clipTrBl = (c: number) => `polygon(0 0,calc(100% - ${c}px) 0,100% ${c}px,100% 100%,${c}px 100%,0 calc(100% - ${c}px))`;
const clipTlBr = (c: number) => `polygon(${c}px 0,100% 0,100% calc(100% - ${c}px),calc(100% - ${c}px) 100%,0 100%,0 ${c}px)`;

// ── Migrated verbatim from the Cosmic Kit export (I-05 · GALAXY MAP) ────────
// Source: export-cosmic-kit/Cosmic Kit.dc.html, "─── GALAXY MAP ───" block.
// Values are copied, not re-derived: every earlier attempt here measured them
// off screenshots and was wrong in the aspect ratio, the palette and the graph.

type FactionKey = "EIC" | "MMO" | "VRU" | "RIM";
type FacId = "eic" | "mmo" | "vru" | "rim";
type NodeKind = "home" | "gate" | "zone" | "maw";

// GMF
const FACTION_HEX: Record<FactionKey, string> = { EIC: "#4ea3ff", MMO: "#ff8b3d", VRU: "#5cff8a", RIM: "#c3d2e8" };
const FACTION_LABEL: Record<FactionKey, string> = { EIC: "EIC", MMO: "MMO", VRU: "VRU", RIM: "RIM" };
const FACTION_HOME: Record<FactionKey, string> = { EIC: "EARTH", MMO: "MARS", VRU: "VENUS", RIM: "UNCLAIMED" };

// The Kit's comment says "Chart space is 660 × 540", but that is NOT the extent
// of the data: with GM_SIZE applied, the nodes actually span x 51..789 and
// y 43..649. The Kit gets away with it because it positions every node in
// ABSOLUTE px inside a 690px-tall container that is wide enough (1fr next to a
// 262px card at max-width 1180px ≈ 890px), and simply lets the layout be larger
// than the quoted space.
//
// Expressing those px as percentages of 660×540 (an earlier attempt here) both
// clipped everything past x=660 / y=540 and skewed the graph, because X and Y
// were then scaled by different factors. Keep absolute px, like the source.
const CHART_W = 840;   // covers x 51..789 with margin
const CHART_H = 690;   // the Kit's own container height, covers y 43..649

// GM_SIZE / GM_GLYPH / GM_HOME
const GM_SIZE: Record<NodeKind, number> = { home: 54, gate: 42, maw: 48, zone: 34 };
const GM_GLYPH: Record<string, string> = { gate: "◎", zone: "◈", maw: "✺" };
const GM_HOME: Partial<Record<FacId, string>> = { mmo: "⛏", vru: "✸" };

// GM_YIELD — resource name -> hex
const GM_YIELD: Record<string, string> = {
  "Ferrite Ore": "#8aa0c0", "Silicate Dust": "#5cff8a", "Cryo Hydrogen": "#4ee2ff",
  "Iridium Shards": "#b866ff", "Bio Resin": "#5cff8a", "Void Salt": "#e8b94d",
  "Dark Matter": "#ff4d5e", "Relic Core": "#ff5cf0",
};

// GMZ — code, faction, name, x, y, kind, level band, security, pvp, threat, yield, brief
type GmZone = [string, FacId, string, number, number, NodeKind, string, string, string, number, string[], string];
const GMZ: GmZone[] = [
  ["1-1", "eic", "Terra Prime", 78, 70, "home", "1–10", "SECURE", "OFF", .04, ["Ferrite Ore", "Silicate Dust"],
    "Consortium homeworld. Full patrol ring, station repair on every dock, and no weapons fire inside the shell."],
  ["1-2", "eic", "Halcyon Reach", 200, 126, "zone", "8–18", "SECURE", "OFF", .16, ["Ferrite Ore", "Cryo Hydrogen"],
    "Shipping lanes and ore barges. Quiet enough that most pilots fly it on autopilot."],
  ["1-3", "eic", "Cobalt Verge", 76, 232, "zone", "16–26", "PATROLLED", "OFF", .34, ["Cryo Hydrogen", "Iridium Shards"],
    "Cold-gas fields on the shoulder of the spur. Patrols answer, but not quickly."],
  ["1-4", "eic", "Meridian Shoals", 200, 278, "zone", "24–34", "PATROLLED", "ON", .48, ["Iridium Shards", "Ferrite Ore"],
    "Debris shoals the navy never finished clearing. Free-fire beyond the marker buoys."],
  ["1-5", "eic", "Aurora Gate", 264, 164, "gate", "30–42", "CONTESTED", "ON", .66, ["Iridium Shards", "Void Salt"],
    "The Consortium border gate. Everything past this ring belongs to whoever is holding it today."],

  ["2-1", "mmo", "Ares Foundry", 762, 70, "home", "1–10", "SECURE", "OFF", .04, ["Ferrite Ore", "Silicate Dust"],
    "Mars operations HQ, built into the slag terraces. Refinery queues run around the clock."],
  ["2-2", "mmo", "Rust Basin", 640, 126, "zone", "8–18", "SECURE", "OFF", .18, ["Ferrite Ore", "Silicate Dust"],
    "Open-pit belt with company beacons on every rock. Safe, crowded, thin margins."],
  ["2-3", "mmo", "Ochre Span", 764, 232, "zone", "16–26", "PATROLLED", "OFF", .36, ["Silicate Dust", "Cryo Hydrogen"],
    "A dust corridor between two claims. Company security patrols it, loosely."],
  ["2-4", "mmo", "Cinder Fields", 640, 278, "zone", "24–34", "PATROLLED", "ON", .5, ["Iridium Shards", "Ferrite Ore"],
    "Burnt-out smelter platforms. Salvage is good, and so is the ambush cover."],
  ["2-5", "mmo", "Ember Gate", 576, 164, "gate", "30–42", "CONTESTED", "ON", .68, ["Iridium Shards", "Void Salt"],
    "Mars' border gate. Convoys stage here before the rim run, and raiders know it."],

  ["3-1", "vru", "Cytherea Spire", 420, 622, "home", "1–10", "SECURE", "OFF", .05, ["Silicate Dust", "Bio Resin"],
    "Research spire above the Venusian cloud deck. Lab contracts, no combat inside the aerostat ring."],
  ["3-2", "vru", "Sulphur Bloom", 286, 580, "zone", "8–18", "SECURE", "OFF", .2, ["Bio Resin", "Silicate Dust"],
    "Acid blooms that grow useful compounds. Harvesters run the whole shift unbothered."],
  ["3-3", "vru", "Verdant Drift", 554, 580, "zone", "16–26", "PATROLLED", "OFF", .32, ["Bio Resin", "Cryo Hydrogen"],
    "Terraform test drift. Union hulls only in theory — plenty of others fly it anyway."],
  ["3-4", "vru", "Chloris Loom", 330, 488, "zone", "26–38", "PATROLLED", "ON", .5, ["Bio Resin", "Iridium Shards"],
    "The Union's outermost cultivation ring. Last quiet stop before the gate."],
  ["3-5", "vru", "Emerald Gate", 510, 488, "gate", "30–42", "CONTESTED", "ON", .64, ["Iridium Shards", "Void Salt"],
    "The Union's border gate and its only road to the rim. Wide, well-lit, covered by exactly two guns."],

  ["4-1", "rim", "Cassini Verge", 338, 236, "zone", "36–46", "LAWLESS", "ON", .74, ["Void Salt", "Iridium Shards"],
    "The rim shelf behind the Consortium gate — Aurora Gate is the only way in. No flag holds it a full week."],
  ["4-2", "rim", "Null Passage", 502, 236, "zone", "40–50", "LAWLESS", "ON", .8, ["Void Salt", "Dark Matter"],
    "The Mars approach, reached from Ember Gate alone. No beacons: whatever your scanner finds here found you first."],
  ["4-3", "rim", "Iron Reef", 420, 432, "zone", "40–50", "LAWLESS", "ON", .82, ["Void Salt", "Dark Matter"],
    "The Union approach, hanging off Emerald Gate. Hull graveyard from the last border war — rich salvage, permanent hostiles."],
  ["4-4", "rim", "Shatter Belt", 378, 336, "zone", "46–56", "LAWLESS", "ON", .9, ["Dark Matter", "Void Salt"],
    "Common ground. All three rim shelves feed into it, so every flag meets here sooner or later."],
  ["4-5", "rim", "The Maw", 462, 336, "maw", "55–60", "LAWLESS", "ON", 1, ["Dark Matter", "Relic Core"],
    "The collapsed core at the centre of the galaxy, open from every rim shelf. Endgame space — go in a fleet or don't go."],
];

// GML — [from, to, isBorderGate]
const GML: [string, string, number][] = [
  ["1-1", "1-2", 0], ["1-2", "1-3", 0], ["1-3", "1-4", 0], ["1-4", "1-5", 0], ["1-2", "1-5", 0],
  ["2-1", "2-2", 0], ["2-2", "2-3", 0], ["2-3", "2-4", 0], ["2-4", "2-5", 0], ["2-2", "2-5", 0],
  ["3-1", "3-2", 0], ["3-1", "3-3", 0], ["3-2", "3-4", 0], ["3-3", "3-5", 0], ["3-4", "3-5", 0],
  ["4-1", "4-4", 0], ["4-1", "4-5", 0], ["4-2", "4-4", 0], ["4-2", "4-5", 0], ["4-3", "4-4", 0], ["4-3", "4-5", 0], ["4-4", "4-5", 0],
  ["1-5", "4-1", 1], ["2-5", "4-2", 1], ["3-5", "4-3", 1],
];

const GM_BY_CODE: Record<string, GmZone> = Object.fromEntries(GMZ.map((z) => [z[0], z]));
const FAC_KEY: Record<FacId, FactionKey> = { eic: "EIC", mmo: "MMO", vru: "VRU", rim: "RIM" };

// GM_ADJ + gmHops
const GM_ADJ: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  GMZ.forEach((z) => { m[z[0]] = []; });
  GML.forEach(([a, b]) => { m[a].push(b); m[b].push(a); });
  return m;
})();
function gmHops(from: string, to: string): string {
  if (from === to) return "0";
  const seen: Record<string, number> = { [from]: 0 };
  let q = [from];
  while (q.length) {
    const nx: string[] = [];
    for (const c of q) for (const d of GM_ADJ[c] ?? []) {
      if (seen[d] === undefined) { seen[d] = seen[c] + 1; if (d === to) return String(seen[d]); nx.push(d); }
    }
    q = nx;
  }
  return "—";
}

// THREAT wording/colour is the Kit's own security band, carried on each GMZ row
// (z[7]) alongside its 0..1 threat value (z[9]). Nothing derived here.
const GM_SEC_HEX: Record<string, string> = {
  SECURE: "#5cff8a", PATROLLED: "#4ee2ff", CONTESTED: "#e8b94d", LAWLESS: "#ff4d5e",
};

const factionOf = (code: string): FactionKey => FAC_KEY[(GM_BY_CODE[code]?.[1] ?? "rim")];

// Kit node clip-path, used for every plate and the selection ring:
//   polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)
const HEX_CLIP = "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)";

// Starfield — the Kit's own radial-gradient dots, copied verbatim.
const STARFIELD = "radial-gradient(1.5px 1.5px at 543px 268px,#dff1ff,transparent),radial-gradient(1.4px 1.4px at 275px 272px,#cfe6ff,transparent),radial-gradient(1.1px 1.1px at 668px 478px,#ffffff,transparent),radial-gradient(1.3px 1.3px at 511px 548px,#bcd8f5,transparent),radial-gradient(1.5px 1.5px at 672px 79px,#eaf5ff,transparent),radial-gradient(1.6px 1.6px at 529px 28px,#dff1ff,transparent),radial-gradient(1.5px 1.5px at 372px 612px,#cfe6ff,transparent),radial-gradient(1.4px 1.4px at 481px 206px,#ffffff,transparent),radial-gradient(1.4px 1.4px at 518px 373px,#bcd8f5,transparent),radial-gradient(1.5px 1.5px at 255px 151px,#eaf5ff,transparent),radial-gradient(1.1px 1.1px at 385px 127px,#dff1ff,transparent),radial-gradient(1.5px 1.5px at 147px 584px,#cfe6ff,transparent),radial-gradient(1.1px 1.1px at 229px 69px,#ffffff,transparent),radial-gradient(1.2px 1.2px at 594px 348px,#bcd8f5,transparent),radial-gradient(1.3px 1.3px at 244px 54px,#eaf5ff,transparent),radial-gradient(1.2px 1.2px at 269px 63px,#dff1ff,transparent),radial-gradient(1.6px 1.6px at 505px 229px,#cfe6ff,transparent),radial-gradient(1.6px 1.6px at 574px 579px,#ffffff,transparent),radial-gradient(1.2px 1.2px at 432px 36px,#bcd8f5,transparent),radial-gradient(1.1px 1.1px at 96px 95px,#eaf5ff,transparent),radial-gradient(1.5px 1.5px at 329px 94px,#dff1ff,transparent),radial-gradient(1.4px 1.4px at 328px 349px,#cfe6ff,transparent),radial-gradient(1.1px 1.1px at 286px 24px,#ffffff,transparent),radial-gradient(1.4px 1.4px at 424px 111px,#bcd8f5,transparent),radial-gradient(1.3px 1.3px at 50px 608px,#eaf5ff,transparent),radial-gradient(1.6px 1.6px at 270px 421px,#dff1ff,transparent),radial-gradient(1.6px 1.6px at 268px 569px,#cfe6ff,transparent),radial-gradient(1.2px 1.2px at 609px 645px,#ffffff,transparent),radial-gradient(1.6px 1.6px at 548px 118px,#bcd8f5,transparent),radial-gradient(1.2px 1.2px at 509px 492px,#eaf5ff,transparent),radial-gradient(1.3px 1.3px at 548px 522px,#dff1ff,transparent),radial-gradient(1.2px 1.2px at 530px 460px,#cfe6ff,transparent),radial-gradient(1.5px 1.5px at 714px 659px,#ffffff,transparent),radial-gradient(1.3px 1.3px at 31px 297px,#bcd8f5,transparent),radial-gradient(1.3px 1.3px at 699px 195px,#eaf5ff,transparent),radial-gradient(1.3px 1.3px at 476px 313px,#dff1ff,transparent),radial-gradient(1.1px 1.1px at 566px 582px,#cfe6ff,transparent),radial-gradient(1.4px 1.4px at 575px 390px,#ffffff,transparent)";

// Map a Kit sector code onto the real game zone, so warping still uses the
// project's own ZoneId. Visual layer stays the Kit's; logic stays ours.
const LABEL_TO_ZONE: Record<string, ZoneId> = Object.fromEntries(
  (Object.entries(ZONES) as [ZoneId, (typeof ZONES)[ZoneId]][])
    .filter(([id]) => id !== "debug")
    .map(([id, z]) => [z.label, id]),
);
const zoneIdOf = (label: string): ZoneId | null => LABEL_TO_ZONE[label] ?? null;

// Filter pill — re-verified against a live 90% Kit screenshot: a simple
// FULL colored outline around a dark plate (not a 3-layer inset chamfer),
// small diamond + label, small chamfer on all corners (the pill reads as
// nearly rectangular at this scale, not steeply cut).
// Faction banner — migrated from the Kit's gmBanners builder + its button
// markup (bg / shadow / rail / railGlow / wash / color / dotOp all copied).
function FactionBanner({ label, hex, active, onClick }: { label: string; hex: string; active: boolean; anyFocus: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  return (
    <button
      onClick={onClick} aria-label={active ? "Show every spur" : `Isolate ${label} space`} {...handlers}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 7,
        padding: "7px 13px 8px", border: "none", cursor: "pointer", overflow: "hidden",
        background: active
          ? `linear-gradient(180deg,${rgbaHex(hex, 0.26)},${rgbaHex(hex, 0.05)} 62%,rgba(4,7,13,.92))`
          : "linear-gradient(180deg,#151c26,#080c13)",
        boxShadow: active
          ? `inset 0 1px 0 ${rgbaHex(hex, 0.4)},inset 0 -1px 0 rgba(0,0,0,.7),inset 0 0 18px ${rgbaHex(hex, 0.16)},0 3px 8px rgba(0,0,0,.5)`
          : "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 3px 6px rgba(0,0,0,.5)",
        clipPath: "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))",
        transition: "transform .15s cubic-bezier(.2,.9,.25,1),background .24s ease,box-shadow .24s ease",
        transform: pressed ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        filter: pressed ? "brightness(1.34)" : hover ? "brightness(1.18)" : "none",
      }}
    >
      <i style={{ position: "absolute", left: 0, right: 0, top: 0, height: 2, background: active ? `linear-gradient(90deg,transparent,${hex},transparent)` : `linear-gradient(90deg,transparent,${rgbaHex(hex, 0.35)},transparent)`, boxShadow: `0 0 ${active ? "10px" : "4px"} ${hex}` }} />
      <i style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 50% 0%,${active ? rgbaHex(hex, 0.18) : "rgba(0,0,0,0)"},transparent 72%)`, pointerEvents: "none" }} />
      <i style={{ width: 7, height: 7, flex: "0 0 auto", background: hex, boxShadow: `0 0 9px ${hex}`, opacity: active ? 1 : 0.45, transform: "rotate(45deg)" }} />
      <small style={{ position: "relative", fontFamily: "Orbitron,sans-serif", fontSize: 8.5, letterSpacing: ".2em", color: active ? "#f6faff" : rgbaHex(hex, 0.75) }}>{label}</small>
    </button>
  );
}

// Gate row — migrated from the Kit's gmGates button markup.
function GateRow({ name, code, hex, onClick }: { name: string; code: string; hex: string; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  return (
    <button
      onClick={onClick} aria-label={`Select ${name} ${code}`} {...handlers}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 7,
        padding: "6px 9px", border: "none", textAlign: "left", cursor: "pointer",
        background: `linear-gradient(180deg,${rgbaHex(hex, 0.1)},rgba(6,10,17,.92))`,
        boxShadow: "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.6),inset 0 2px 4px rgba(0,0,0,.42)",
        clipPath: "polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px))",
        transition: "transform .14s cubic-bezier(.2,.9,.25,1),background .2s ease",
        transform: pressed ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        filter: pressed ? "brightness(1.4)" : hover ? "brightness(1.22)" : "none",
      }}
    >
      <i style={{ width: 5, height: 5, flex: "0 0 auto", background: hex, boxShadow: `0 0 7px ${hex}`, transform: "rotate(45deg)" }} />
      <small style={{ flex: 1, fontSize: 10, color: "#eaf3ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</small>
      <small style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: hex }}>{code}</small>
    </button>
  );
}

// Chamfered rim + plate + spec-highlight, tl-br per the Kit's card/button
// convention (panels use tr-bl, everything drawn ON them uses the opposite).
function ActionButton({ label, rim, plate, text, line, disabled, onClick }: { label: string; rim: [string, string, string]; plate: [string, string]; text: string; line: string; disabled?: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const [top, mid, bot] = rim;
  const [plateTop, plateBot] = plate;
  return (
    <button
      onClick={onClick} disabled={disabled} {...(disabled ? {} : handlers)}
      style={{
        position: "relative", width: "100%", padding: 0, border: "none", background: "none", cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        filter: active ? "brightness(1.3)" : hover ? "brightness(1.16)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: `linear-gradient(150deg,${top},${mid} 46%,${bot})`, clipPath: clipTlBr(7) }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", margin: 2, padding: "9px 10px", overflow: "hidden", background: `linear-gradient(180deg,${plateTop},${plateBot})`, color: text, fontFamily: "var(--font-display)", fontSize: 9.5, letterSpacing: "0.14em", fontWeight: 700, boxShadow: `inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 ${rgbaHex(line, 0.25)}`, clipPath: clipTlBr(5) }}>
        <i style={{ position: "absolute", left: 5, right: 5, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${rgbaHex(line, 0.6)},transparent)` }} />
        <span style={{ position: "relative" }}>{label}</span>
      </span>
    </button>
  );
}

// Red rotated-diamond close button — same recipe as CloseButton.tsx, but
// this panel positions it INSIDE the frame's own tr-bl chamfer corner
// (verified live: the Kit's close diamond sits right in the cut corner),
// so it's inlined here rather than reusing the shared component's absolute
// top-right placement.
function CloseDiamond({ onClick }: { onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const scale = active ? 0.92 : hover ? 1.07 : 1;
  return (
    <button
      aria-label="Close" onClick={onClick} title="Close" {...handlers}
      style={{
        position: "relative", display: "grid", placeItems: "center", width: 22, height: 22, padding: 0, border: "none",
        background: "linear-gradient(135deg,#ffd7db,#c8303f 46%,#5c0d16)", color: "#fff2f3", fontSize: 9, fontWeight: 700, cursor: "pointer",
        transform: `rotate(45deg) scale(${scale})`, filter: hover || active ? "brightness(1.2)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
        boxShadow: "0 3px 0 -1px rgba(58,6,12,.95),0 6px 0 -3px rgba(26,3,7,.92),0 0 12px rgba(255,77,94,.35)",
      }}
    >
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#ff97a2,#9c1c29 52%,#3d080f)" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(158deg,#ff6b7c,#8d1723 58%,#2c060c)", boxShadow: "inset 0 1px 0 rgba(255,224,228,.55),inset 0 -1px 0 rgba(0,0,0,.65)" }} />
      <i style={{ position: "relative", transform: "rotate(-45deg)" }}>✕</i>
    </button>
  );
}

export function GalaxyMapPanel() {
  const showMap = useGame((s) => s.showMap);
  const player = useGame((s) => s.player);
  const [playToken] = useState(0);
  const [mounted, setMounted] = useState(showMap);
  const [closing, setClosing] = useState(false);
  const [focus, setFocus] = useState<FacId | null>(null);
  const [tracked, setTracked] = useState<string | null>(null);
  const [sel, setSel] = useState<string>(() => ZONES[player.zone]?.label ?? "1-1");
  // Bumped on every click so the selection ring remounts and replays even when
  // the same system is clicked twice.
  const [selPulse, setSelPulse] = useState(0);

  // Mirrors Social/Settings: `closing` must reset on reopen, or a stale
  // closing=true from the previous close survives the component staying
  // mounted at "if (!mounted) return null" (a null render, not an unmount —
  // local state persists) and PrintPortal immediately replays its close
  // animation on the next open instead of opening.
  useEffect(() => {
    if (showMap) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap]);

  if (!mounted) return null;

  // The player's real zone maps onto a Kit sector code via its label.
  const hereCode = ZONES[player.zone]?.label ?? null;
  const selRow = GM_BY_CODE[sel];

  const close = () => { gameState.showMap = false; bump(); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); };

  const warp = (label: string) => {
    const id = zoneIdOf(label);
    if (!id || id === player.zone) return;
    travelToZone(id);
    close();
  };

  const SIDE_W = 262;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 40, paddingBottom: 32, overflowY: "auto", background: "rgba(2,6,12,.75)" }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <style>{`
        /* ── Kit keyframes, copied verbatim from the Cosmic Kit export ──
           @keyframes cGmSpark / cGmFlow / cGmRing / cGmHere / cGmTwinkle.
           These replace a set of hand-written approximations (gmRun,
           gmGateCrawl, gmSelectRing, gmSelHalo, gmFlagFloat/Pulse) that were
           reconstructed from screenshots and never matched the source. */
        @keyframes cGmSpark{0%{left:0;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:100%;opacity:0}}
        @keyframes cGmFlow{to{background-position:-16px 0}}
        @keyframes cGmRing{0%{transform:scale(.9);opacity:.9}70%{opacity:.12}100%{transform:scale(1.55);opacity:0}}
        @keyframes cGmHere{0%,100%{transform:translate(-50%,0);opacity:.55}50%{transform:translate(-50%,-3px);opacity:1}}
        @keyframes cGmTwinkle{0%,100%{opacity:.45}50%{opacity:.9}}
        /* Node hover/press, from the Kit's style-hover / style-active. */
        .gm-node:hover{transform:translateY(-3px) scale(1.09)}
        .gm-node:active{transform:translateY(1px) scale(.94)}
      `}</style>
      <PrintPortal playToken={playToken} closing={closing} onClosed={onPortalClosed} accent={ACCENT} duration={1300} chamfer={34} style={{ width: "min(96vw, 1180px)", flexShrink: 0 }}>
        {/* Outer frame — the project's STANDARD 10-band chamfer shell, copied
            verbatim from ZoneMapPanel (CargoPanel/Social/ClanHall/Leaderboard/
            Skills all carry the identical recipe: inset 0..16, chamfer 34 ->
            23.47 in 1.17 steps, alternating light rail / dark gap).
            This panel was the ONLY one hand-rolling its own frame, which is
            why it never matched the rest of the game. */}
        <div style={{ position: "relative", padding: 18, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(78,226,255,.18))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: "#05070d", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 0, display: "block", background: "rgba(78,226,255,.5)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "rgba(234,252,255,.65)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "rgba(5,3,10,.7)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "rgba(157,233,255,.45)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "rgba(5,3,10,.65)", clipPath: "polygon(0 0,calc(100% - 29.32px) 0,100% 29.32px,100% 100%,29.32px 100%,0 calc(100% - 29.32px))" }} />
          <i style={{ position: "absolute", inset: 10, display: "block", background: "rgba(63,168,196,.3)", clipPath: "polygon(0 0,calc(100% - 28.15px) 0,100% 28.15px,100% 100%,28.15px 100%,0 calc(100% - 28.15px))" }} />
          <i style={{ position: "absolute", inset: 12, display: "block", background: "rgba(5,3,10,.6)", clipPath: "polygon(0 0,calc(100% - 26.98px) 0,100% 26.98px,100% 100%,26.98px 100%,0 calc(100% - 26.98px))" }} />
          <i style={{ position: "absolute", inset: 14, display: "block", background: "rgba(22,74,92,.25)", clipPath: "polygon(0 0,calc(100% - 25.81px) 0,100% 25.81px,100% 100%,25.81px 100%,0 calc(100% - 25.81px))" }} />
          <i style={{ position: "absolute", inset: 16, display: "block", background: "rgba(5,3,10,.55)", clipPath: "polygon(0 0,calc(100% - 24.64px) 0,100% 24.64px,100% 100%,24.64px 100%,0 calc(100% - 24.64px))" }} />

              <div style={{ position: "relative", zIndex: 1, padding: "14px 15px 15px", overflow: "hidden", background: "linear-gradient(150deg,#233047,#0a0e16)", boxShadow: "inset 0 5px 12px rgba(0,0,0,.6),inset 0 0 0 1px rgba(5,3,10,.6),inset 0 -2px 0 rgba(157,233,255,.2)", clipPath: "polygon(0 0,calc(100% - 23.47px) 0,100% 23.47px,100% 100%,23.47px 100%,0 calc(100% - 23.47px))" }}>
                <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.04) 11px 12px,transparent 12px 23px)", pointerEvents: "none" }} />
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0 0 10px" }}>
                  <i style={{ width: 7, height: 7, flex: "0 0 auto", background: ACCENT, boxShadow: `0 0 10px ${ACCENT}`, transform: "rotate(45deg)" }} />
                  <b style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.24em", fontWeight: 700, color: shadeHex(ACCENT, 0.75) }}>GALAXY MAP</b>
                  <small style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.16em", color: "#a8bdd6" }}>{GMZ.length} SYSTEMS · {GML.filter((l) => l[2]).length} SPURS</small>
                  <span style={{ flex: 1 }} />
                  <CloseDiamond onClick={close} />
                </div>
                <i style={{ display: "block", height: 1, marginBottom: 10, background: "rgba(0,0,0,.55)" }} />

                <div style={{ display: "grid", gridTemplateColumns: `${CHART_W}px ${SIDE_W}px`, gap: 14, alignItems: "stretch" }}>
                  {/* ── Chart plate ──────────────────────────────────────────
                      Migrated from the Kit: absolutely-positioned DOM in a
                      660x540 chart space, not an SVG re-drawing. Background is
                      the Kit's own four radial faction washes + linear base;
                      the grid, starfield, banners, routes, nodes and legend all
                      carry their source values. */}
                  <div style={{
                    position: "relative", width: CHART_W, height: CHART_H, overflow: "hidden",
                    background: "radial-gradient(370px 300px at 130px 160px,rgba(78,163,255,.17),transparent 72%),radial-gradient(370px 300px at 710px 160px,rgba(255,139,61,.15),transparent 72%),radial-gradient(420px 300px at 420px 570px,rgba(92,255,138,.13),transparent 72%),radial-gradient(340px 300px at 420px 330px,rgba(184,102,255,.13),transparent 74%),linear-gradient(180deg,#080c15,#04060d 58%,#02030a)",
                    boxShadow: "inset 0 6px 14px rgba(0,0,0,.8),inset 0 0 0 1px rgba(0,0,0,.7),inset 0 -2px 0 rgba(170,205,245,.12)",
                  }}>
                    <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,transparent 0 43px,rgba(140,190,235,.05) 43px 44px),repeating-linear-gradient(0deg,transparent 0 43px,rgba(140,190,235,.05) 43px 44px)", pointerEvents: "none" }} />
                    <i style={{ position: "absolute", inset: 0, backgroundImage: STARFIELD, animation: "cGmTwinkle 5.5s ease-in-out infinite", pointerEvents: "none" }} />

                    {/* Faction banner bar */}
                    <div style={{ position: "absolute", left: "50%", top: 12, display: "flex", alignItems: "stretch", gap: 7, padding: "6px 7px", transform: "translateX(-50%)", zIndex: 12, background: "linear-gradient(180deg,rgba(9,14,22,.88),rgba(4,7,12,.82))", boxShadow: "inset 0 1px 0 rgba(220,238,255,.09),inset 0 -1px 0 rgba(0,0,0,.7),0 6px 16px rgba(0,0,0,.55)", clipPath: "polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))" }}>
                      {(["eic", "mmo", "vru", "rim"] as FacId[]).map((f) => {
                        const key = FAC_KEY[f];
                        const hx = FACTION_HEX[key];
                        const on = focus === f;
                        return (
                          <FactionBanner key={f} label={FACTION_LABEL[key]} hex={hx} active={on} anyFocus={!!focus}
                            onClick={() => setFocus(focus === f ? null : f)} />
                        );
                      })}
                    </div>

                    {/* Routes — gmRoutes */}
                    {GML.map(([a, b, border], i) => {
                      const A = GM_BY_CODE[a], B = GM_BY_CODE[b];
                      if (!A || !B) return null;
                      const dx = B[3] - A[3], dy = B[4] - A[4];
                      const ha = FACTION_HEX[FAC_KEY[A[1]]], hb = FACTION_HEX[FAC_KEY[B[1]]];
                      const lit = !focus || A[1] === focus || B[1] === focus;
                      const spark = border ? "#f7dc9a" : shadeHex(ha, 0.28);
                      const dur = (2.3 + (i % 5) * 0.34).toFixed(2) + "s";
                      const delay = ((i % 7) * 0.33).toFixed(2) + "s";
                      return (
                        <i key={`${a}-${b}`} style={{
                          position: "absolute", left: A[3], top: A[4] - 1,
                          width: Math.hypot(dx, dy), height: 2,
                          transformOrigin: "0 50%", transform: `rotate(${(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2)}deg)`,
                          background: border
                            ? "repeating-linear-gradient(90deg,rgba(232,185,77,.9) 0 8px,transparent 8px 16px)"
                            : `linear-gradient(90deg,${rgbaHex(ha, 0.6)},${rgbaHex(hb, 0.6)})`,
                          backgroundSize: border ? "16px 100%" : "100% 100%",
                          animation: border ? "cGmFlow .8s linear infinite" : "none",
                          opacity: lit ? 1 : 0.1, transition: "opacity .32s ease", pointerEvents: "none",
                        }}>
                          <i style={{ position: "absolute", top: -2, left: 0, width: 6, height: 6, borderRadius: "50%", background: spark, boxShadow: `0 0 9px ${spark}`, opacity: lit ? 1 : 0, animation: `cGmSpark ${dur} linear infinite`, animationDelay: delay }} />
                        </i>
                      );
                    })}

                    {/* Nodes — gmNodes */}
                    {GMZ.map((n) => {
                      const [code, fac, name, x, y, kind, lvl] = n;
                      const key = FAC_KEY[fac];
                      const fh = FACTION_HEX[key];
                      const size = GM_SIZE[kind];
                      const on = sel === code;
                      const lit = !focus || fac === focus;
                      const isEic = fac === "eic" && kind === "home";
                      const lvHex = lvl === "55–60" ? "#ff4d5e" : parseInt(lvl, 10) >= 36 ? "#e8b94d" : fh;
                      const glow = rgbaHex(fh, on ? 0.8 : 0.5);
                      const glowR = on ? "22px" : kind === "zone" ? "11px" : "17px";
                      const isHere = code === hereCode;
                      const isTracked = tracked === code;
                      return (
                        <div key={code} style={{
                          position: "absolute", left: x - size / 2, top: y - size / 2,
                          width: size, height: size,
                          zIndex: (kind === "home" || kind === "maw" ? 6 : kind === "gate" ? 5 : 4) + (on ? 3 : 0),
                          opacity: lit ? 1 : 0.16, transition: "opacity .32s ease",
                        }}>
                          {isHere && (
                            <i style={{ position: "absolute", left: "50%", top: -19, display: "block", fontFamily: "Orbitron,sans-serif", fontSize: 6.5, fontStyle: "normal", letterSpacing: ".18em", whiteSpace: "nowrap", color: "#9df2ff", textShadow: "0 0 8px rgba(78,226,255,.9)", animation: "cGmHere 2.2s ease-in-out infinite" }}>▼ HERE</i>
                          )}
                          {isTracked && (
                            <i style={{ position: "absolute", left: "50%", top: isHere ? -30 : -19, display: "block", fontFamily: "Orbitron,sans-serif", fontSize: 6.5, fontStyle: "normal", letterSpacing: ".18em", whiteSpace: "nowrap", color: "#d9a6ff", textShadow: "0 0 8px rgba(184,102,255,.9)", animation: "cGmHere 2.2s ease-in-out infinite" }}>▼ TRACKED</i>
                          )}
                          {on && (
                            <i style={{ position: "absolute", inset: -9, display: "block", background: `radial-gradient(circle,transparent 52%,${glow} 66%,transparent 76%)`, clipPath: HEX_CLIP, animation: "cGmRing 2s ease-out infinite", pointerEvents: "none" }} />
                          )}
                          <button
                            onClick={() => { setSel(code); setSelPulse((p) => p + 1); }}
                            aria-label={`${name} ${code}, level ${lvl}`} title={`${name} ${code}, level ${lvl}`}
                            className="gm-node"
                            style={{
                              position: "relative", display: "block", width: "100%", height: "100%", padding: 0,
                              border: "none", background: "none", cursor: "pointer",
                              filter: `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 6px 7px rgba(0,0,0,.7)) drop-shadow(0 0 ${glowR} ${glow})`,
                              transition: "transform .16s cubic-bezier(.2,.9,.25,1),filter .2s ease",
                            }}
                          >
                            <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#e6eefa,#8e9aab 42%,#39424f 72%,#1a212c)", clipPath: HEX_CLIP }} />
                            <i style={{ position: "absolute", inset: "6.25%", display: "block", background: `linear-gradient(150deg,${shadeHex(fh, 0.3)},${shadeHex(fh, -0.34)} 52%,${shadeHex(fh, -0.64)})`, clipPath: HEX_CLIP }} />
                            <i style={{ position: "absolute", inset: "14%", display: "block", background: `radial-gradient(circle at 50% 34%,${rgbaHex(fh, on ? 0.62 : 0.3)},#05080f 76%)`, boxShadow: "inset 0 3px 5px rgba(0,0,0,.65),inset 0 -1px 0 rgba(220,238,255,.14)", clipPath: HEX_CLIP }} />
                            {isEic ? (
                              <i style={{ position: "absolute", inset: "14%", display: "block", backgroundImage: "url(/assets/ui/factions/eic.png)", backgroundSize: "56%", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 6px ${glow})` }} />
                            ) : (
                              <i style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontStyle: "normal", fontSize: kind === "home" ? 19 : kind === "maw" ? 18 : kind === "gate" ? 14 : 11, color: fh, textShadow: `0 0 9px ${glow}` }}>
                                {(kind === "home" ? GM_HOME[fac] : GM_GLYPH[kind]) || "◈"}
                              </i>
                            )}
                          </button>
                          <span style={{ position: "absolute", left: "50%", top: "calc(100% + 5px)", display: "grid", gap: 1, justifyItems: "center", transform: "translateX(-50%)", whiteSpace: "nowrap", pointerEvents: "none" }}>
                            <b style={{ fontSize: kind === "home" ? 10.5 : kind === "maw" ? 10 : 9, fontWeight: 700, color: on ? "#ffffff" : "rgba(214,230,248,.82)", textShadow: "0 1px 3px rgba(0,0,0,.95)" }}>{name}</b>
                            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <small style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: ".1em", color: fh, textShadow: "0 1px 3px rgba(0,0,0,.95)" }}>{code}</small>
                              <small style={{ padding: "1px 5px", fontFamily: "'JetBrains Mono',monospace", fontSize: 8, fontVariantNumeric: "tabular-nums", color: shadeHex(lvHex, 0.42), background: rgbaHex(lvHex, 0.16), boxShadow: `inset 0 0 0 1px ${rgbaHex(lvHex, 0.38)}`, textShadow: "0 1px 3px rgba(0,0,0,.95)" }}>LV {lvl}</small>
                            </span>
                          </span>
                        </div>
                      );
                    })}

                    {/* Legend */}
                    <div style={{ position: "absolute", left: 12, bottom: 11, display: "flex", alignItems: "center", gap: 9, padding: "5px 10px", background: "rgba(4,7,13,.72)", boxShadow: "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.6)", clipPath: "polygon(0 0,calc(100% - 7px) 0,100% 7px,100% 100%,7px 100%,0 calc(100% - 7px))" }}>
                      <small style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: ".1em", color: "rgba(196,222,246,.75)" }}>SOLID = PATROLLED LANE</small>
                      <i style={{ width: 1, height: 9, background: "rgba(140,180,220,.25)" }} />
                      <small style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, letterSpacing: ".1em", color: "rgba(240,205,122,.9)" }}>DASHED = BORDER GATE</small>
                    </div>
                  </div>

                  {/* ── Detail card ──────────────────────────────────────────
                      Migrated from the Kit's right-hand column: brief block,
                      LEVEL/JUMPS OUT tiles, THREAT bar, YIELD chips, GATES
                      buttons and the two actions. All backgrounds, shadows and
                      type sizes are the source values. */}
                  {selRow && (() => {
                    const facKey = FAC_KEY[selRow[1]];
                    const hx = FACTION_HEX[facKey];
                    const pvpOn = selRow[8] === "ON";
                    const secHex = GM_SEC_HEX[selRow[7]] ?? hx;
                    const gates = (GM_ADJ[sel] ?? []).map((c) => GM_BY_CODE[c]).filter(Boolean);
                    const zoneId = zoneIdOf(sel);
                    const realZone = zoneId ? ZONES[zoneId] : null;
                    const isHere = sel === hereCode;
                    return (
                      <div style={{ display: "grid", gap: 9, alignContent: "start" }}>
                        <div style={{ position: "relative", display: "grid", gap: 7, padding: "11px 12px 12px", overflow: "hidden", background: `radial-gradient(120% 100% at 50% 0%,${rgbaHex(hx, 0.15)},transparent 72%),linear-gradient(180deg,#0c1019,#05080e)`, boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <i style={{ width: 6, height: 6, flex: "0 0 auto", background: hx, boxShadow: `0 0 9px ${hx}`, transform: "rotate(45deg)" }} />
                            <b style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#f0f6ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selRow[2]}</b>
                            <small style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: hx }}>{sel}</small>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <small style={{ padding: "3px 7px", fontFamily: "Orbitron,sans-serif", fontSize: 7, letterSpacing: ".18em", color: hx, background: rgbaHex(hx, 0.16), boxShadow: `inset 0 0 0 1px ${rgbaHex(hx, 0.42)}` }}>{FACTION_LABEL[facKey]} · {FACTION_HOME[facKey]}</small>
                            <small style={{ padding: "3px 7px", fontFamily: "Orbitron,sans-serif", fontSize: 7, letterSpacing: ".18em", color: pvpOn ? "#ffd0d5" : "#c8f7d8", background: pvpOn ? "rgba(255,77,94,.16)" : "rgba(92,255,138,.14)", boxShadow: `inset 0 0 0 1px ${pvpOn ? "rgba(255,77,94,.4)" : "rgba(92,255,138,.36)"}` }}>PVP {selRow[8]}</small>
                          </div>
                          <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.55, color: "rgba(218,232,248,.86)" }}>{selRow[11]}</p>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <div style={{ display: "grid", gap: 2, padding: "7px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                            <small style={{ fontFamily: "Orbitron,sans-serif", fontSize: 6.5, letterSpacing: ".2em", color: "rgba(196,222,246,.78)" }}>LEVEL</small>
                            <b style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontVariantNumeric: "tabular-nums", color: "#f2f8ff" }}>{selRow[6]}</b>
                          </div>
                          <div style={{ display: "grid", gap: 2, padding: "7px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                            <small style={{ fontFamily: "Orbitron,sans-serif", fontSize: 6.5, letterSpacing: ".2em", color: "rgba(196,222,246,.78)" }}>JUMPS OUT</small>
                            <b style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontVariantNumeric: "tabular-nums", color: "#9df2ff" }}>{hereCode ? gmHops(hereCode, sel) : "—"}</b>
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: 5, padding: "9px 10px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                            <small style={{ flex: 1, fontFamily: "Orbitron,sans-serif", fontSize: 6.5, letterSpacing: ".2em", color: "rgba(196,222,246,.78)" }}>THREAT</small>
                            <small style={{ fontFamily: "Orbitron,sans-serif", fontSize: 7.5, letterSpacing: ".14em", color: secHex }}>{selRow[7]}</small>
                          </div>
                          <span style={{ position: "relative", display: "block", height: 5, overflow: "hidden", background: "linear-gradient(180deg,#050810,#03050a)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.85)" }}>
                            <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(selRow[9] * 100)}%`, background: `linear-gradient(90deg,${secHex},${shadeHex(secHex, 0.35)})`, boxShadow: `0 0 10px ${rgbaHex(secHex, 0.55)}`, transition: "width .35s cubic-bezier(.2,.9,.25,1)" }} />
                          </span>
                        </div>

                        <div style={{ display: "grid", gap: 5 }}>
                          <small style={{ padding: "0 1px", fontFamily: "Orbitron,sans-serif", fontSize: 6.5, letterSpacing: ".22em", color: "rgba(240,205,122,.95)" }}>YIELD</small>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {selRow[10].map((r) => {
                              const rh = GM_YIELD[r] ?? hx;
                              return (
                                <small key={r} style={{ padding: "4px 8px", fontFamily: "'JetBrains Mono',monospace", fontSize: 8.5, color: shadeHex(rh, 0.35), background: rgbaHex(rh, 0.14), boxShadow: "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.55)", clipPath: "polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))" }}>{r}</small>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: 5 }}>
                          <small style={{ padding: "0 1px", fontFamily: "Orbitron,sans-serif", fontSize: 6.5, letterSpacing: ".22em", color: "rgba(196,222,246,.78)" }}>GATES</small>
                          <div style={{ display: "grid", gap: 3 }}>
                            {gates.map((g) => {
                              const gh = FACTION_HEX[FAC_KEY[g[1]]];
                              return (
                                <GateRow key={g[0]} name={g[2]} code={g[0]} hex={gh} onClick={() => { setSel(g[0]); setSelPulse((p) => p + 1); }} />
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: 7 }}>
                          <ActionButton
                            label={isHere ? "CURRENT SYSTEM" : "WARP JUMP · PREMIUM"}
                            rim={["#f0e2ff", "#e8b94d", "#5c3d0d"]} plate={["#3b2c05", "#150e02"]} text="#fff2d0" line="#ffe8b0"
                            disabled={isHere || !realZone || player.level < realZone.unlockLevel}
                            onClick={() => warp(sel)}
                          />
                          <ActionButton
                            label={isHere ? "NO MARKER NEEDED" : tracked === sel ? "CLEAR COURSE" : "SET COURSE · TRACK ROUTE"}
                            rim={["#f0e2ff", "#a274d6", "#3a2450"]} plate={["#3b2358", "#150c22"]} text="#f4ecff" line="#f3e8ff"
                            disabled={isHere}
                            onClick={() => setTracked(tracked === sel ? null : sel)}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
          </div>
      </PrintPortal>
    </div>
  );
}
