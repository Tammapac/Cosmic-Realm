import type { StatRow, ServiceItem, DockTabItem } from "./HangarDockOverlay.types";

// Copied from the design handoff
// (design_handoff_hangar_dock_overlay/src/HangarDockOverlay.constants.ts).
// The DEFAULT_* rows are the design's authored reference content; the live
// overlay passes real game data instead (see HangarDockOverlayHost.tsx) and
// only falls back to these when a value is genuinely unavailable.

export const DEFAULT_STATION_STATS: StatRow[] = [
  { label: "MOST TRADED",    value: "Titanium Ore",  hex: "#e8b94d", glow: "rgba(232,185,77,.6)" },
  { label: "HIGHEST VALUE",  value: "Iridium Ore",   hex: "#e8b94d", glow: "rgba(232,185,77,.6)" },
  { label: "LOWEST VALUE",   value: "Silicate Dust", hex: "#8aa0c0", glow: "rgba(138,160,192,.5)" },
  { label: "NET WORTH",      value: "48.2M CR",      hex: "#e8b94d", glow: "rgba(232,185,77,.6)" },
  { label: "DOCKED SHIPS",   value: "12",            hex: "#5cff8a", glow: "rgba(92,255,138,.6)" },
  { label: "SECTOR",         value: "Halcyon Drift", hex: "#4ee2ff", glow: "rgba(78,226,255,.6)" },
  { label: "HULL INTEGRITY", value: "98%",           hex: "#4ee2ff", glow: "rgba(78,226,255,.6)" },
  { label: "STATUS",         value: "CONTESTED",     hex: "#ff4d5e", glow: "rgba(255,77,94,.6)" },
];

export const DEFAULT_SHIP_STATS: StatRow[] = [
  { label: "SHIELD",       value: "3,200",   hex: "#4ee2ff", glow: "rgba(78,226,255,.6)" },
  { label: "HULL",         value: "4,300",   hex: "#e2f0ff", glow: "rgba(220,240,255,.4)" },
  { label: "DAMAGE",       value: "860 dps", hex: "#ff4d5e", glow: "rgba(255,77,94,.6)" },
  { label: "CARGO",        value: "18.4 t",  hex: "#9fe0ff", glow: "rgba(159,224,255,.6)" },
  { label: "SPEED",        value: "412 m/s", hex: "#5cff8a", glow: "rgba(92,255,138,.6)" },
  { label: "HULL DAMAGE",  value: "6%",      hex: "#ff8a94", glow: "rgba(255,77,94,.6)" },
  { label: "SHIP CLASS",   value: "S",       hex: "#e8b94d", glow: "rgba(232,185,77,.6)" },
];

export const DEFAULT_SERVICES: ServiceItem[] = [
  { icon: "✚", label: "Repair & Resupply" },
  { icon: "⚒", label: "Ship Customization" },
  { icon: "$", label: "Commerce Board" },
  { icon: "▣", label: "Community Market" },
];

export const DEFAULT_DOCK_TABS: DockTabItem[] = [
  { icon: "★", label: "BOUNTIES", sub: "Contracts" },
  { icon: "▣", label: "MISSIONS", sub: "Story · Side" },
  { icon: "✦", label: "SKILLS",   sub: "Perks" },
  { icon: "▲", label: "SHIPYARD", sub: "Buy · Sell" },
  { icon: "⚙", label: "LOADOUT",  sub: "Fit ship" },
  { icon: "⌬", label: "DRONES",   sub: "Manage" },
  { icon: "$", label: "MARKET",   sub: "Trade" },
  { icon: "✚", label: "SERVICES", sub: "Repair · Ammo" },
];

// linear-gradient(150deg, rgba(255,255,255,.08), rgba(0,0,0,.35)) composited over
// the brushed-metal atlas — reused, unmodified, from the Cosmic Kit.
//
// Path adapted for this project: the handoff ships the same texture as
// assets/textures/metal-rim-atlas.png, byte-identical (2,965,805 bytes) to the
// atlas already served here, so the existing file is reused rather than
// duplicated.
export const METAL_RIM_BG =
  "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)), url('/assets/ui/atlas/brushed-metal.png')";

export const DOCK_TAB_WIDTH = 112;
export const DOCK_TAB_GAP = 10;
