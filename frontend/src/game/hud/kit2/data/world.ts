// Weltdaten: Zonen, Kontakte, Missionen.

import type { Contact } from "../panels/types";

/** Fraktionsfarbe je Kürzel. */
export const FACTION_HEX: Record<string, string> = {
  EIC: "#4ee2ff", MMO: "#ff8c4d", VRU: "#5cff8a", RIM: "#b866ff",
};

export type Zone = {
  id: string; label: string; name: string; faction: string;
  x: number; y: number; levelFrom: number; levelTo: number; links: string[];
};

/**
 * Die Galaxiekarte. EIC oben links, MMO oben rechts, VRU unten mittig;
 * 4-1 bis 4-3 hängen je an 1-5, 2-5 und 3-5 — jede Fraktion hat ihren eigenen
 * Zugang. 4-4 und 4-5 sitzen zentral und sind nur über die 4-x-Karten
 * erreichbar, für alle gleich weit.
 */
export const ZONES: Zone[] = [
  { id: "1-1", label: "1-1", name: "Kepler Reach", faction: "EIC", x: 96, y: 66, levelFrom: 1, levelTo: 10, links: ["1-2"] },
  { id: "1-2", label: "1-2", name: "Cobalt Verge", faction: "EIC", x: 178, y: 118, levelFrom: 8, levelTo: 18, links: ["1-3"] },
  { id: "1-3", label: "1-3", name: "Alpha Sector", faction: "EIC", x: 118, y: 186, levelFrom: 16, levelTo: 26, links: ["1-4"] },
  { id: "1-4", label: "1-4", name: "Foundry Belt", faction: "EIC", x: 200, y: 240, levelFrom: 24, levelTo: 34, links: ["1-5"] },
  { id: "1-5", label: "1-5", name: "Kepler Deep", faction: "EIC", x: 138, y: 306, levelFrom: 32, levelTo: 42, links: ["4-1"] },

  { id: "2-1", label: "2-1", name: "Tessera Yards", faction: "MMO", x: 904, y: 66, levelFrom: 1, levelTo: 10, links: ["2-2"] },
  { id: "2-2", label: "2-2", name: "Rust Corridor", faction: "MMO", x: 822, y: 118, levelFrom: 8, levelTo: 18, links: ["2-3"] },
  { id: "2-3", label: "2-3", name: "Drift Market", faction: "MMO", x: 882, y: 186, levelFrom: 16, levelTo: 26, links: ["2-4"] },
  { id: "2-4", label: "2-4", name: "Ashfall", faction: "MMO", x: 800, y: 240, levelFrom: 24, levelTo: 34, links: ["2-5"] },
  { id: "2-5", label: "2-5", name: "Tessera Deep", faction: "MMO", x: 862, y: 306, levelFrom: 32, levelTo: 42, links: ["4-2"] },

  { id: "3-1", label: "3-1", name: "Solace Anchorage", faction: "VRU", x: 452, y: 612, levelFrom: 1, levelTo: 10, links: ["3-2"] },
  { id: "3-2", label: "3-2", name: "Verdant Span", faction: "VRU", x: 548, y: 612, levelFrom: 8, levelTo: 18, links: ["3-3"] },
  { id: "3-3", label: "3-3", name: "Thorn Cluster", faction: "VRU", x: 500, y: 546, levelFrom: 16, levelTo: 26, links: ["3-4"] },
  { id: "3-4", label: "3-4", name: "Bloomfield", faction: "VRU", x: 596, y: 546, levelFrom: 24, levelTo: 34, links: ["3-5"] },
  { id: "3-5", label: "3-5", name: "Solace Deep", faction: "VRU", x: 548, y: 480, levelFrom: 32, levelTo: 42, links: ["4-3"] },

  { id: "4-1", label: "4-1", name: "Ember Fields", faction: "RIM", x: 302, y: 372, levelFrom: 40, levelTo: 50, links: ["4-4"] },
  { id: "4-2", label: "4-2", name: "Cinder Gate", faction: "RIM", x: 698, y: 372, levelFrom: 40, levelTo: 50, links: ["4-4"] },
  { id: "4-3", label: "4-3", name: "Ash Meridian", faction: "RIM", x: 500, y: 428, levelFrom: 40, levelTo: 50, links: ["4-4"] },
  { id: "4-4", label: "4-4", name: "Null Span", faction: "RIM", x: 500, y: 300, levelFrom: 48, levelTo: 56, links: ["4-5"] },
  { id: "4-5", label: "4-5", name: "The Rift", faction: "RIM", x: 500, y: 196, levelFrom: 54, levelTo: 60, links: [] },
];

/** Kontakttypen: Label, Farbe, Glyphe. */
export const CONTACT_KIND: Record<string, [string, string, string]> = {
  station: ["STATION", "#4ee2ff", "◈"],
  portal: ["PORTAL", "#b866ff", "◉"],
  void: ["VOID PORTAL", "#ff5cf0", "✦"],
  factory: ["FACTORY", "#e8b94d", "▣"],
  enemy: ["HOSTILE", "#ff4d5e", "▲"],
  party: ["PARTY", "#5cff8a", "◆"],
  belt: ["ASTEROID BELT", "#8aa0c0", "▪"],
};

export const CONTACTS: Contact[] = [
  { id: "st1", kind: "station", name: "Kepler Station", x: 166, y: 148, tag: "DOCK OPEN",
    brief: "Zone hub. Repairs, refit, market access and the contract board." },
  { id: "st2", kind: "station", name: "Relay Outpost", x: 648, y: 512, tag: "TRADE ONLY",
    brief: "Small relay. Sells ammunition and buys ore above station rate." },
  { id: "p1", kind: "portal", name: "Gate to 1-4", x: 742, y: 132, tag: "LV 24+",
    brief: "Lane portal into the Foundry Belt. Level gate holds at twenty-four." },
  { id: "p2", kind: "portal", name: "Gate to 1-2", x: 92, y: 470, tag: "LV 8+",
    brief: "Back door to the Cobalt Verge. Quiet, and usually empty." },
  { id: "v1", kind: "void", name: "Void Portal", x: 500, y: 84, tag: "GROUP 4",
    brief: "Dungeon entry. Four hulls minimum, no re-entry once it seals." },
  { id: "f1", kind: "factory", name: "Refinery Delta", x: 300, y: 546, tag: "ONLINE",
    brief: "Ore refinery. Processes prometium and endurium on a shift clock." },
  { id: "f2", kind: "factory", name: "Munitions Works", x: 700, y: 300, tag: "ONLINE",
    brief: "Turns salvage into ammunition. Pays in credits or rounds." },
  { id: "h1", kind: "enemy", name: "Corsair Ace", x: 420, y: 220, tag: "LV 50", level: 50,
    brief: "Modified interceptor. Fast, shielded, and it commits as soon as you do." },
  { id: "h2", kind: "enemy", name: "Corsair Wing", x: 452, y: 258, tag: "LV 46", level: 46,
    brief: "Four hulls flying tight. They break formation only when the lead dies." },
  { id: "h3", kind: "enemy", name: "Hive Drone", x: 300, y: 466, tag: "LV 21", level: 21,
    brief: "Drone off the belt swarm. No shield, heavy hull, and it never disengages." },
  { id: "h4", kind: "enemy", name: "Hive Cluster", x: 262, y: 430, tag: "LV 19", level: 19,
    brief: "Six drones on a patrol arc. Individually harmless, together a problem." },
  { id: "pt1", kind: "party", name: "Vega_9", x: 380, y: 340, tag: "LV 58", level: 58,
    brief: "Holding the north approach. Shields at eighty-four percent." },
  { id: "pt2", kind: "party", name: "Sable", x: 344, y: 372, tag: "LV 55", level: 55,
    brief: "Pulled back to repair. Two minutes out." },
];

/** Asteroidengürtel der aktuellen Zone. */
export const BELT = { x: 260, y: 420, w: 420, h: 150, rotation: -13 };

/** Zoomstufen der Zonenkarte: Reichweite in km auf Maßstab. */
export const SCOPE_RANGE: Record<number, number> = { 2: 2.5, 5: 1, 10: 0.5 };

export type Mission = {
  id: string; type: string; title: string; level: number; zone: string;
  credits: number; xp: number; brief: string;
  steps: { text: string; done: boolean }[];
  rewards: { rarity: string; name: string; icon: string; qty?: number }[];
};

export const MISSIONS: Mission[] = [
  { id: "m1", type: "BOUNTY", title: "Corsair Ace", level: 50, zone: "Ember Fields · RIM 4-2",
    credits: 840000, xp: 96000,
    brief: "A corsair wing has been running the lane between Ember Fields and the Null Span for three weeks. Their lead flies a modified interceptor and does not disengage. Station command wants the wing broken and the ace confirmed dead.",
    steps: [
      { text: "Clear the corsair escort wing", done: true },
      { text: "Disable the ace's drive", done: true },
      { text: "Confirm the kill", done: false },
    ],
    rewards: [
      { rarity: "legendary", name: "Corsair Repeater", icon: "laser-t9" },
      { rarity: "rare", name: "Ferrite Plate", icon: "mod2-t4", qty: 4 },
    ] },
  { id: "m2", type: "EVENT", title: "Nova Tide", level: 50, zone: "Null Span · RIM 4-4",
    credits: 1240000, xp: 148000,
    brief: "The Null Span is bleeding radiation from a collapsing star. Every faction has a claim on what drifts out of it. Hold the extraction point long enough for the haulers to fill and get out before the tide closes.",
    steps: [
      { text: "Reach the extraction point", done: true },
      { text: "Hold for four minutes", done: false },
      { text: "Escort the haulers clear", done: false },
      { text: "Survive the tide", done: false },
    ],
    rewards: [
      { rarity: "celestial", name: "Rift Coupler", icon: "mod3-t3" },
      { rarity: "relic", name: "Relic Shard", icon: "mod3-t3", qty: 3 },
      { rarity: "epic", name: "Nova Charge", icon: "mod0-t3", qty: 12 },
    ] },
  { id: "m3", type: "HAUL", title: "Foundry Run", level: 32, zone: "Foundry Belt · EIC 1-4",
    credits: 186000, xp: 24000,
    brief: "The Foundry Belt refinery is behind on quota and the yard will not wait. Fill your hold with prometium and bring it in before the shift closes.",
    steps: [
      { text: "Mine 8,000 units of prometium", done: true },
      { text: "Dock at the refinery", done: true },
      { text: "Deliver the load", done: true },
    ],
    rewards: [{ rarity: "uncommon", name: "Repair Cell", icon: "mod2-t3", qty: 28 }] },
  { id: "m4", type: "SURVEY", title: "Cobalt Seams", level: 27, zone: "Cobalt Verge · EIC 1-2",
    credits: 94000, xp: 16000,
    brief: "Survey drones lost contact with three seams on the far side of the Verge. Fly the arc, ping each one and bring the readings home.",
    steps: [
      { text: "Ping the northern seam", done: true },
      { text: "Ping the two southern seams", done: false },
    ],
    rewards: [{ rarity: "rare", name: "Wren Scope", icon: "mod2-t4" }] },
  { id: "m5", type: "PATROL", title: "Kepler Watch", level: 19, zone: "Kepler Station · EIC 1-1",
    credits: 42000, xp: 8600,
    brief: "Standing patrol contract. Fly the ring around Kepler Station and clear anything that drifts inside the perimeter.",
    steps: [
      { text: "Clear the perimeter, six sweeps", done: true },
      { text: "Report at the station", done: false },
    ],
    rewards: [{ rarity: "common", name: "Solace Flare", icon: "mod0-t3", qty: 60 }] },
  { id: "m6", type: "ESCORT", title: "Solace Convoy", level: 41, zone: "Solace Anchorage · VRU 3-1",
    credits: 312000, xp: 46000,
    brief: "A VRU hauler convoy needs a gun on the wing from the Anchorage to the Verdant Span. They fly slow and they do not stop for anything.",
    steps: [
      { text: "Meet the convoy at the Anchorage", done: false },
      { text: "Bring all four haulers through", done: false },
    ],
    rewards: [{ rarity: "epic", name: "Nyx Sight", icon: "mod2-t4" }] },
  { id: "m7", type: "SALVAGE", title: "Erebus Wreck", level: 46, zone: "Drift Market · MMO 2-3",
    credits: 520000, xp: 68000,
    brief: "The Erebus went down eleven years ago and the market has finally cleared the claim. Strip what is left before another crew files on it.",
    steps: [
      { text: "Cut the outer hull", done: true },
      { text: "Pull the deflector core", done: true },
      { text: "Strip the drive assembly", done: false },
      { text: "Clear the salvage guard", done: false },
      { text: "Dock at Drift Market", done: false },
    ],
    rewards: [
      { rarity: "celestial", name: "Erebus Core", icon: "genshield-t4" },
      { rarity: "legendary", name: "Kova Plating", icon: "mod2-t4", qty: 2 },
    ] },
];

/** Honor je Auftrag: quadratisch mit dem Level plus Klassenbonus. */
export function honorFor(m: Mission): number {
  const bonus = m.type === "BOUNTY" ? 140 : m.type === "EVENT" ? 260 : 60;
  return Math.round(m.level * m.level * 0.9 + bonus);
}
