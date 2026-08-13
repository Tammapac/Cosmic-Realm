import type { RarityKey } from "./rarity";

/**
 * S-02 · Bounty Board — data and geometry, MIGRATED verbatim from the export:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (const BOUNTIES, DANGER_LABELS, bountyCards/bountyTrackX)
 *
 * The export stores each contract as a positional array:
 *   [tierKey, kind, name, subtitle, sector, zone, credits, honor, danger, level, ship]
 * with level/ship only set for "player" targets — NPC rows carry squad
 * composition in `subtitle` instead. Unpacked to named fields; values untouched.
 */

export interface BountyContract {
  tier: RarityKey;
  kind: "npc" | "player";
  name: string;
  /** Squad composition for NPC contracts; empty for player targets. */
  subtitle: string;
  sector: string;
  zone: string;
  credits: number;
  honor: number;
  /** 1–5, indexes DANGER_LABELS. */
  danger: number;
  /** Player targets only. */
  level: number | null;
  ship: string | null;
}

export const DANGER_LABELS = ["GUARDED", "ELEVATED", "HIGH", "SEVERE", "EXTREME"];

/** Pip colour per danger step, from the export's bountyTabs dot palette. */
export const DANGER_COLORS = ["#ffb673", "#ff8a3d", "#ff8a94", "#ff4d5e", "#ff4d5e"];

export const BOUNTIES: BountyContract[] = [
  { tier: "common",    kind: "npc",    name: "Scout Patrol",       subtitle: "4× Scout",  sector: "Halcyon Drift", zone: "1-1", credits: 180,  honor: 5,   danger: 1, level: null, ship: null },
  { tier: "common",    kind: "player", name: "“Rooke”",            subtitle: "",          sector: "Halcyon Drift", zone: "1-2", credits: 150,  honor: 4,   danger: 1, level: 8,    ship: "Nomad Skiff · Scout" },
  { tier: "common",    kind: "player", name: "“Ashen”",            subtitle: "",          sector: "Cold Reach",    zone: "1-3", credits: 320,  honor: 9,   danger: 2, level: 19,   ship: "Ember Cutter · Interceptor" },
  { tier: "uncommon",  kind: "player", name: "“Draüge”",           subtitle: "",          sector: "Ember Fields",  zone: "2-1", credits: 410,  honor: 11,  danger: 2, level: 22,   ship: "Nightfall · Interceptor" },
  { tier: "uncommon",  kind: "player", name: "“Vantage”",          subtitle: "",          sector: "Crimson Lane",  zone: "2-4", credits: 600,  honor: 18,  danger: 3, level: 24,   ship: "Ghost Wing · Interceptor" },
  { tier: "rare",      kind: "player", name: "“Solvane”",          subtitle: "",          sector: "Black Furrow",  zone: "3-1", credits: 950,  honor: 26,  danger: 3, level: 29,   ship: "Black Comet · Heavy Fighter" },
  { tier: "epic",      kind: "player", name: "“Kessler”",          subtitle: "",          sector: "Rift Verge",    zone: "4-1", credits: 1800, honor: 45,  danger: 4, level: 41,   ship: "Void Reaver · Heavy Fighter" },
  { tier: "epic",      kind: "player", name: "“Marrow”",           subtitle: "",          sector: "Warden Post",   zone: "3-3", credits: 1400, honor: 36,  danger: 4, level: 38,   ship: "Dreadnought Wing · Gunship" },
  { tier: "epic",      kind: "player", name: "“Voss”",             subtitle: "",          sector: "The Sable",     zone: "4-4", credits: 3200, honor: 88,  danger: 5, level: 52,   ship: "Nullbringer · Dreadnought" },
  { tier: "legendary", kind: "npc",    name: "Void Lance Warlord", subtitle: "Elite Boss", sector: "Outer Dark",   zone: "5-1", credits: 4500, honor: 120, danger: 5, level: null, ship: null },
];

/** Carousel geometry, verbatim from bountyCards/bountyTrackX. */
export const BOUNTY_CARD_W = 260;
export const BOUNTY_CARD_GAP = 26;
export const BOUNTY_CARD_STEP = BOUNTY_CARD_W + BOUNTY_CARD_GAP;
export const BOUNTY_VIEW_W = 760;
export const BOUNTY_VIEW_H = 400;
export const BOUNTY_PANEL_W = 1340;

/** Six tabs: ALL + one per danger band, so each is 100/6 % wide. */
export const BOUNTY_TAB_COUNT = 6;
export const BOUNTY_TAB_PCT = 100 / BOUNTY_TAB_COUNT;

/** Active-contract counter shown in the sub-header (static in the export). */
export const BOUNTY_ACTIVE = { count: 2, cap: 5 };
