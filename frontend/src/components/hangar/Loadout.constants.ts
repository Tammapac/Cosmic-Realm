/**
 * Loadout Panel — data and tokens, copied VERBATIM from the design export.
 *
 * Source: Downloads/Cosmic Realm UI Upgrade (8).zip
 *   -> design_handoff_hangar_panels_strict_export/
 *      "Loadout Panel (UI Redesign Directions - Armor).dc.html"
 *
 * The export document is a DESIGN-DIRECTIONS page: the real panel is the
 * `<div id="1c">` block (1680px wide), and everything before/after it is
 * reference material (tab-glow demo, button family, slot states, rarity frames,
 * inspection tooltip, three modals). Only the panel block and the modals are
 * ported; the catalogue sections are reference, not UI.
 *
 * Do NOT round or normalise these values.
 */

export type LoadoutSlot = "weapon" | "generator" | "module";

/** RARITY ramp — [hex, wash, glowRadius, border, label], verbatim from `const R`. */
export const LOADOUT_RARITY: Record<string, [string, string, string, string, string]> = {
  common:    ["#8aa0c0", "rgba(138,160,192,.12)", "12px", "rgba(138,160,192,.25)", "COMMON"],
  uncommon:  ["#5cff8a", "rgba(92,255,138,.14)",  "14px", "rgba(92,255,138,.3)",   "UNCOMMON"],
  rare:      ["#4ee2ff", "rgba(78,226,255,.16)",  "18px", "rgba(78,226,255,.34)",  "RARE"],
  epic:      ["#ff5cf0", "rgba(255,92,240,.18)",  "22px", "rgba(255,92,240,.4)",   "EPIC"],
  legendary: ["#ffd24a", "rgba(255,210,74,.2)",   "26px", "rgba(255,210,74,.45)",  "LEGENDARY"],
  relic:     ["#ff6a3c", "rgba(255,106,60,.2)",   "28px", "rgba(255,106,60,.48)",  "RELIC"],
  celestial: ["#9df2ff", "rgba(157,242,255,.22)", "32px", "rgba(157,242,255,.5)",  "CELESTIAL"],
};

export const LOADOUT_RARITY_ORDER = [
  "common", "uncommon", "rare", "epic", "legendary", "relic", "celestial",
] as const;

/** Socket capacity per bank — verbatim `const CAP`. */
export const LOADOUT_CAP: Record<LoadoutSlot, number> = {
  weapon: 14, generator: 14, module: 12,
};

/** Pet-drone sockets — verbatim `const DRONE_SLOTS`. */
export const LOADOUT_DRONE_SLOTS = ["weapon", "module", "extra"] as const;

/** Bank headers — [slot, label, colour, glyph], verbatim `const SLOTS`. */
export const LOADOUT_BANKS: [LoadoutSlot, string, string, string][] = [
  ["weapon", "WEAPONS", "#ff5c6c", "≡"],
  ["generator", "GENERATORS", "#ffd24a", "⌬"],
  ["module", "MODULES", "#4ee2ff", "◈"],
];

/** Icon path prefix — the export's `const IP`, rewritten from the design
 *  environment's repo-relative path to this project's served path. */
export const LOADOUT_ICON_PATH = "/assets/ui/items/";

/** 1x1 transparent GIF the export uses for empty sockets — verbatim BLANK. */
export const LOADOUT_BLANK =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** Panel geometry, verbatim from the `id="1c"` block. */
export const LOADOUT_PANEL_W = 1680;
/** Outer body split: main area + right column. */
export const LOADOUT_BODY_GRID = "minmax(0,1fr) 372px";
/** Main area: left banks · ship viewport · right banks. */
export const LOADOUT_MAIN_GRID = "224px minmax(0,1fr) 224px";
/** Socket rows inside a bank. */
export const LOADOUT_SOCKET_GRID = "repeat(5,1fr)";

/** Rarity filter chips — verbatim `filterRarities`, label + key. */
export const LOADOUT_RARITY_FILTERS: [string, string][] = [
  ["ALL RARITIES", "all"], ["COMMON", "common"], ["UNCOMMON", "uncommon"],
  ["RARE", "rare"], ["EPIC", "epic"], ["LEGENDARY", "legendary"],
  ["RELIC", "relic"], ["CELESTIAL", "celestial"],
];

/** Status filter chips — the export's `filterEq` keys and the labels its
 *  `filterLabel` builder prints for them ("EQUIPPED" / "IN STORAGE"). */
export const LOADOUT_STATUS_FILTERS: [string, string][] = [
  ["ALL", "all"], ["EQUIPPED", "eq"], ["IN STORAGE", "stored"],
];

/** Card frame treatment per rarity — verbatim from the export's own map. */
export const LOADOUT_FRAME: Record<string, "plain" | "lined" | "glow" | "star"> = {
  common: "plain", uncommon: "plain", rare: "lined", epic: "lined",
  legendary: "glow", relic: "glow", celestial: "star",
};
