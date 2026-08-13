/**
 * S-04 · Shipyard — data and geometry, MIGRATED verbatim from the design export:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (const SHIPS, STAT_CAPS, shipyardCards/shipyardTrackX in the
 *         data-dc-script block)
 *
 * The export's own numbers, not re-derived. PORT_NOTES.md §1 states this list is
 * fixed and not user-sorted, and that the fields are the project's real ship-data
 * shape — prices/names may later be pointed at live game data, the structure stays.
 *
 * NOTE: PORT_NOTES.md claims 8 hulls; the source array has SEVEN (its own list
 * trails off at "(8.)" with no name). Verified by parsing the array — imgIds
 * therefore run shipyard-hero-0 … shipyard-hero-6.
 */

export interface ShipStats {
  HULL: number; SHD: number; SPD: number; DMG: number;
  DRN: number; WPN: number; GEN: number; MOD: number;
}

export interface ShipLore {
  LENGTH: string; MASS: string; CREW: string;
  BUILT: string; MAKER: string; CLASS: string;
}

export interface ShipyardHull {
  name: string;
  tagline: string;
  price: number;
  stats: ShipStats;
  lore: ShipLore;
}

export const SHIPYARD_HULLS: ShipyardHull[] = [
  { name: "Skimmer Mk-I", tagline: "Cheap, nimble, easy to lose.", price: 8000,
    stats: { HULL: 100, SHD: 50, SPD: 120, DMG: 8, DRN: 1, WPN: 1, GEN: 2, MOD: 1 },
    lore: { LENGTH: "12 m", MASS: "8 t", CREW: "1", BUILT: "2871", MAKER: "Kestrel Yards", CLASS: "Scout" } },
  { name: "Wasp Interceptor", tagline: "Glass cannon. Fastest hull in the sector.", price: 26000,
    stats: { HULL: 90, SHD: 70, SPD: 145, DMG: 10, DRN: 1, WPN: 2, GEN: 2, MOD: 1 },
    lore: { LENGTH: "14 m", MASS: "9 t", CREW: "1", BUILT: "2874", MAKER: "Kestrel Yards", CLASS: "Interceptor" } },
  { name: "Vanguard", tagline: "All-rounder hull. Solid in any zone.", price: 64000,
    stats: { HULL: 180, SHD: 120, SPD: 90, DMG: 14, DRN: 2, WPN: 2, GEN: 3, MOD: 2 },
    lore: { LENGTH: "26 m", MASS: "40 t", CREW: "2", BUILT: "2868", MAKER: "Halcyon Foundries", CLASS: "Frigate" } },
  { name: "Reaver Mk-II", tagline: "Swift hunter. Built for raids.", price: 148000,
    stats: { HULL: 160, SHD: 140, SPD: 120, DMG: 18, DRN: 2, WPN: 3, GEN: 3, MOD: 2 },
    lore: { LENGTH: "24 m", MASS: "34 t", CREW: "2", BUILT: "2877", MAKER: "Blacklane Works", CLASS: "Raider" } },
  { name: "Marauder", tagline: "Heavy gunship with cargo to spare.", price: 320000,
    stats: { HULL: 280, SHD: 200, SPD: 100, DMG: 26, DRN: 4, WPN: 4, GEN: 4, MOD: 3 },
    lore: { LENGTH: "52 m", MASS: "180 t", CREW: "4", BUILT: "2861", MAKER: "Ironreach Shipwrights", CLASS: "Gunship" } },
  { name: "Phalanx Cruiser", tagline: "Drone-carrier cruiser. Projects power through the swarm.", price: 610000,
    stats: { HULL: 340, SHD: 280, SPD: 90, DMG: 24, DRN: 5, WPN: 4, GEN: 5, MOD: 4 },
    lore: { LENGTH: "88 m", MASS: "340 t", CREW: "6", BUILT: "2855", MAKER: "Ironreach Shipwrights", CLASS: "Cruiser" } },
  { name: "Titan Bulwark", tagline: "Walking fortress. Slow but devastating.", price: 1250000,
    stats: { HULL: 520, SHD: 400, SPD: 55, DMG: 34, DRN: 6, WPN: 5, GEN: 6, MOD: 5 },
    lore: { LENGTH: "140 m", MASS: "820 t", CREW: "10", BUILT: "2840", MAKER: "Outer Dark Consortium", CLASS: "Dreadnought" } },
];

/** Denominator for the stat bars — bar width is value / cap. */
export const STAT_CAPS: ShipStats = {
  HULL: 550, SHD: 420, SPD: 150, DMG: 36, DRN: 6, WPN: 6, GEN: 6, MOD: 6,
};

/** Carousel geometry, verbatim from shipyardCards/shipyardTrackX. */
export const CARD_W = 680;
export const CARD_GAP = 34;
export const CARD_STEP = CARD_W + CARD_GAP;
export const VIEW_W = 1040;
export const VIEW_H = 560;
export const PANEL_W = 1340;

/** Depth falloff by distance from the centred card (index 0 = centred). */
export const CARD_SCALE = [1.02, 0.86, 0.74, 0.64];
export const CARD_OPACITY = [1, 0.6, 0.36, 0.2];

export const TRACK_TRANSITION = "transform 420ms cubic-bezier(.22,.9,.25,1)";

/** Stat rows in the order the export prints them (right column). */
export const STAT_ORDER: (keyof ShipStats)[] = ["HULL", "SHD", "SPD", "DMG", "DRN", "WPN", "GEN", "MOD"];

/** Lore rows in the order the export prints them (left column). */
export const LORE_ORDER: (keyof ShipLore)[] = ["LENGTH", "MASS", "CREW", "BUILT", "MAKER", "CLASS"];
