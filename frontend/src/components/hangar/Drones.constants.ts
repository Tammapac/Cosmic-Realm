import type { RarityKey } from "./rarity";

/**
 * S-06 · Drones — data, MIGRATED verbatim from the design export:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (const DRONE, DRONE_EQUIPPED, DRONE_INVENTORY, droneTabs)
 *
 * NOTE on the slot keys: the export labels the third bank "GENERATOR" in the UI
 * but keys it `aux` internally (see droneTabs — ["GENERATOR","aux"]). That split
 * is preserved rather than renamed, so the key still matches the inventory rows.
 */

export type DroneSlotKey = "weapon" | "module" | "aux";

export interface DroneStats {
  name: string;
  level: number;
  levelCap: number;
  hull: number;
  slotsUsed: number;
  slotsCap: number;
  credits: number;
  ammo: number;
  ammoCap: number;
  ammoCost: number;
}

export const DRONE: DroneStats = {
  name: "Wraith Drone", level: 6, levelCap: 6, hull: 1600,
  slotsUsed: 3, slotsCap: 3, credits: 15420,
  ammo: 948, ammoCap: 1400, ammoCost: 3000,
};

/** [rarity, item name] currently fitted per bank. */
export const DRONE_EQUIPPED: Record<DroneSlotKey, [RarityKey, string]> = {
  weapon: ["epic", "Micro Railgun"],
  module: ["rare", "Nav Amplifier"],
  aux: ["legendary", "Overclock Core"],
};

export interface DroneItem {
  rarity: RarityKey;
  cat: DroneSlotKey;
  name: string;
}

export const DRONE_INVENTORY: DroneItem[] = [
  { rarity: "common",    cat: "weapon", name: "Stub Cannon" },
  { rarity: "uncommon",  cat: "weapon", name: "Arc Blaster" },
  { rarity: "rare",      cat: "weapon", name: "Flechette Pod" },
  { rarity: "epic",      cat: "weapon", name: "Micro Railgun" },
  { rarity: "common",    cat: "module", name: "Scan Relay" },
  { rarity: "uncommon",  cat: "module", name: "Signal Booster" },
  { rarity: "rare",      cat: "module", name: "Nav Amplifier" },
  { rarity: "epic",      cat: "module", name: "Threat Jammer" },
  { rarity: "common",    cat: "aux",    name: "Patch Kit" },
  { rarity: "uncommon",  cat: "aux",    name: "Flare Dispenser" },
  { rarity: "rare",      cat: "aux",    name: "Repair Node" },
  { rarity: "legendary", cat: "aux",    name: "Overclock Core" },
  { rarity: "common",    cat: "aux",    name: "Backup Cell" },
  { rarity: "uncommon",  cat: "aux",    name: "Fusion Regulator" },
  { rarity: "rare",      cat: "aux",    name: "Ion Generator" },
];

/** Filter tabs: label shown vs. the inventory `cat` it matches. */
export const DRONE_TABS: { label: string; key: "all" | DroneSlotKey }[] = [
  { label: "ALL", key: "all" },
  { label: "WEAPON", key: "weapon" },
  { label: "MODULE", key: "module" },
  { label: "GENERATOR", key: "aux" },
];

/** Bank headers, in the export's own layout order (weapon left, other two right). */
export const DRONE_BANKS: { key: DroneSlotKey; label: string; glyph: string }[] = [
  { key: "weapon", label: "WEAPON", glyph: "⚔" },
  { key: "module", label: "MODULE", glyph: "◆" },
  { key: "aux",    label: "GENERATOR", glyph: "✦" },
];

/** Glyph per category, used by both the sockets and the inventory rows. */
export const CAT_GLYPH: Record<DroneSlotKey, string> = {
  weapon: "⚔", module: "◆", aux: "✦",
};

export const DRONE_PANEL_W = 1340;
export const DRONE_TAB_PCT = 25; // four tabs
