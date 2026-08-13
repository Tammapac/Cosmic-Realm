// Sozialdaten: Freunde, Anfragen, Blocks, Chat, Clans.

export type Friend = {
  name: string; level: number;
  status: "on" | "away" | "off";
  zone: string; hex: string; lastSeen: string;
};

export const FRIENDS: Friend[] = [
  { name: "Vega_9", level: 58, status: "on", zone: "Alpha Sector 3 · EIC 1-3", hex: "#4ee2ff", lastSeen: "now" },
  { name: "Sable", level: 55, status: "on", zone: "Ember Fields · RIM 4-2", hex: "#ff4d5e", lastSeen: "now" },
  { name: "Ilya", level: 51, status: "away", zone: "Kepler Station · docked", hex: "#5cff8a", lastSeen: "8 min" },
  { name: "Orin", level: 44, status: "on", zone: "Cobalt Verge · EIC 1-2", hex: "#b866ff", lastSeen: "now" },
  { name: "Halcyon", level: 41, status: "off", zone: "Tessera Yards · MMO 2-1", hex: "#e8b94d", lastSeen: "2 h" },
  { name: "Bruk", level: 39, status: "on", zone: "Null Span · RIM 4-4", hex: "#ff8c4d", lastSeen: "now" },
  { name: "Mera", level: 36, status: "off", zone: "Solace Anchorage · VRU 3-1", hex: "#9fb6d4", lastSeen: "1 d" },
  { name: "Tass", level: 28, status: "away", zone: "Foundry Belt · EIC 1-4", hex: "#5cff8a", lastSeen: "23 min" },
  { name: "Juno", level: 24, status: "off", zone: "last seen at Drift Market", hex: "#ff5cf0", lastSeen: "3 d" },
];

export const STATUS_LABEL: Record<string, [string, number]> = {
  on: ["ONLINE", 0x5cff8a], away: ["AWAY", 0xe8b94d], off: ["OFFLINE", 0x7f8ea4],
};

export type FriendRequest = {
  name: string; level: number; direction: "in" | "out"; note: string;
};

export const REQUESTS: FriendRequest[] = [
  { name: "Kestrel", level: 62, direction: "in", note: "Clan officer — flew the Erebus run with you last week." },
  { name: "Pike", level: 19, direction: "in", note: "Met you at the belt. Wants a mining wing." },
  { name: "Corvus", level: 47, direction: "out", note: "You sent this one after the Nova Tide event." },
];

export const BLOCKS: { name: string; level: number; reason: string }[] = [
  { name: "Rask", level: 33, reason: "Spammed trade invites in Alpha 3." },
];

/** Vorbelegte Direktverläufe. */
export const THREADS: Record<string, [string, string, string][]> = {
  Vega_9: [
    ["them", "holding the north approach, shields at 84", "21:04"],
    ["me", "copy — swinging round the belt", "21:05"],
    ["them", "corsair ace is still up, dont solo it", "21:06"],
  ],
  Sable: [
    ["them", "pulled back to repair, give me two minutes", "20:51"],
    ["me", "take your time, im clearing drones", "20:52"],
  ],
  Orin: [
    ["me", "you running the void portal tonight?", "19:32"],
    ["them", "yeah, need two more", "19:40"],
  ],
};

/** Chatkanäle. */
export const CHANNELS: { key: string; label: string; hex: string }[] = [
  { key: "zone", label: "ZONE", hex: "#4ee2ff" },
  { key: "clan", label: "CLAN", hex: "#b866ff" },
  { key: "party", label: "PARTY", hex: "#5cff8a" },
  { key: "trade", label: "TRADE", hex: "#e8b94d" },
  { key: "system", label: "SYSTEM", hex: "#ff8c4d" },
];

export type ChatLine = { channel: string; sender: string; text: string; time: string };

export const CHAT_SEED: ChatLine[] = [
  { channel: "system", sender: "", text: "Entered Alpha Sector · EIC 1-3", time: "20:44" },
  { channel: "zone", sender: "Bruk", text: "anyone seen the corsair wing north of the belt", time: "20:46" },
  { channel: "zone", sender: "Wren", text: "they were at 400 by 220 ten minutes ago", time: "20:47" },
  { channel: "clan", sender: "Kestrel", text: "research funded — plating is tier 4 now", time: "20:49" },
  { channel: "party", sender: "Vega_9", text: "holding the north approach, shields at 84", time: "21:04" },
  { channel: "party", sender: "Nyx_7", text: "copy, swinging round the belt", time: "21:05" },
  { channel: "trade", sender: "Grist", text: "buying prometium above station rate, 18 a unit", time: "21:06" },
  { channel: "zone", sender: "Sable", text: "void portal opens in twenty, need two more", time: "21:08" },
  { channel: "system", sender: "", text: "Contract cleared · Foundry Run · +186,000 credits", time: "21:09" },
  { channel: "clan", sender: "Ilya", text: "who is on for sector war tonight", time: "21:11" },
];

/* ── Clan ─────────────────────────────────────────────────────────────────── */

export type ClanMember = {
  name: string; role: string; level: number; contribution: number; online: boolean;
};

export const CLAN_ROSTER: ClanMember[] = [
  { name: "Kestrel", role: "LEADER", level: 62, contribution: 1840000, online: true },
  { name: "Vega_9", role: "OFFICER", level: 58, contribution: 1210000, online: true },
  { name: "Sable", role: "OFFICER", level: 55, contribution: 986000, online: false },
  { name: "Ilya", role: "VETERAN", level: 51, contribution: 742000, online: true },
  { name: "Nyx_7", role: "VETERAN", level: 49, contribution: 412000, online: true },
  { name: "Orin", role: "PILOT", level: 44, contribution: 388000, online: true },
  { name: "Halcyon", role: "PILOT", level: 41, contribution: 301000, online: false },
  { name: "Bruk", role: "PILOT", level: 39, contribution: 264000, online: true },
  { name: "Mera", role: "PILOT", level: 36, contribution: 198000, online: false },
  { name: "Tass", role: "RECRUIT", level: 28, contribution: 96000, online: true },
  { name: "Juno", role: "RECRUIT", level: 24, contribution: 61000, online: false },
  { name: "Pike", role: "RECRUIT", level: 19, contribution: 24000, online: true },
];

export const ROLE_HEX: Record<string, number> = {
  LEADER: 0xe8b94d, OFFICER: 0xb866ff, VETERAN: 0x4ee2ff, PILOT: 0x9fb6d4, RECRUIT: 0x7f8ea4,
};
export const ROLE_ORDER: Record<string, number> = {
  LEADER: 0, OFFICER: 1, VETERAN: 2, PILOT: 3, RECRUIT: 4,
};

export type ClanProject = {
  key: string; name: string; icon: string; max: number;
  baseCost: number; unit: string; perTier: number; brief: string; hex: string;
};

export const CLAN_RESEARCH: ClanProject[] = [
  { key: "hull", name: "Reinforced Plating", icon: "genshield-t4", max: 5, baseCost: 180000,
    unit: "%", perTier: 2.5, hex: "#4ee2ff",
    brief: "Rolled alloy plate shipped to every hangar under the tag. Adds hull to each member's ship the moment they undock." },
  { key: "dmg", name: "Focused Emitters", icon: "laser-t9", max: 5, baseCost: 240000,
    unit: "%", perTier: 2.0, hex: "#ff4d5e",
    brief: "Shared targeting firmware pushed to every weapon mount in the clan. Raises damage for anyone flying the banner." },
  { key: "drive", name: "Drive Calibration", icon: "genspeed-t3", max: 5, baseCost: 150000,
    unit: "%", perTier: 3.0, hex: "#5cff8a",
    brief: "Clan-wide engine profile. Shorter warp spool and quicker acceleration on every hull in the roster." },
  { key: "cargo", name: "Hold Expansion", icon: "mod2-t4", max: 5, baseCost: 120000,
    unit: " units", perTier: 40, hex: "#e8b94d",
    brief: "Modular hold frames fitted at the clan dock. Every member hauls more ore before a run has to end." },
  { key: "salv", name: "Salvage Rights", icon: "mod3-t3", max: 5, baseCost: 210000,
    unit: "%", perTier: 4.0, hex: "#ff5cf0",
    brief: "Negotiated wreck claims across the rim. Better salvage yield from anything the clan kills." },
  { key: "hon", name: "Banner of Honor", icon: "mod0-t3", max: 5, baseCost: 300000,
    unit: "%", perTier: 5.0, hex: "#b866ff",
    brief: "Season banner filed with the faction office. Raises the honor every member earns from contracts." },
];

export const CLAN_TIERS: Record<string, number> = {
  hull: 3, dmg: 2, drive: 4, cargo: 1, salv: 2, hon: 0,
};

export const DONATION_AMOUNTS = [5000, 25000, 100000];
export const CLAN_XP_PER_LEVEL = 92000;
/** Plätze = 10 + Clanlevel. */
export const clanCapacity = (level: number): number => 10 + level;

export type Charter = {
  id: string; name: string; tag: string; level: number; seasonRank: number;
  members: number; focus: string; brief: string;
  minLevel: number; minHonor: number; hex: string; recruiting: boolean;
};

export const CHARTERS: Charter[] = [
  { id: "c1", name: "Iron Covenant", tag: "IRC", level: 22, seasonRank: 3, members: 29,
    focus: "Sector war · fleet ops", minLevel: 52, minHonor: 120000, hex: "#4ee2ff", recruiting: true,
    brief: "Fleet doctrine, nightly war ops and a drilled wing structure. Applications read by an officer within a day." },
  { id: "c2", name: "Ember Wake", tag: "EMW", level: 18, seasonRank: 7, members: 24,
    focus: "Bounty hunting · rim patrol", minLevel: 44, minHonor: 60000, hex: "#ff4d5e", recruiting: true,
    brief: "Bounty crew working the contested rim. Loose hours, hard targets, salvage split by kill share." },
  { id: "c3", name: "Silent Meridian", tag: "SLM", level: 16, seasonRank: 11, members: 23,
    focus: "Mining · logistics", minLevel: 30, minHonor: 20000, hex: "#e8b94d", recruiting: true,
    brief: "Industrial charter. Belt claims, refinery access and a hauling roster that never sits idle." },
  { id: "c4", name: "Nova Praetorium", tag: "NVP", level: 25, seasonRank: 1, members: 35,
    focus: "Elite · invite only", minLevel: 60, minHonor: 400000, hex: "#ff5cf0", recruiting: false,
    brief: "Top of the season ladder. Closed roster — the charter takes referrals from officers only." },
  { id: "c5", name: "Drift Collective", tag: "DFC", level: 11, seasonRank: 19, members: 17,
    focus: "Casual · exploration", minLevel: 12, minHonor: 0, hex: "#5cff8a", recruiting: true,
    brief: "Slow-lane charter for pilots who fly to look around. No attendance rules, shared map intel." },
  { id: "c6", name: "Halcyon Vanguard", tag: "HLV", level: 20, seasonRank: 5, members: 26,
    focus: "Dungeon runs · void portals", minLevel: 48, minHonor: 90000, hex: "#b866ff", recruiting: true,
    brief: "Runs the void portals on rotation. Fixed groups, voice on entry, loot council on relics." },
  { id: "c7", name: "Scrapline Union", tag: "SCU", level: 14, seasonRank: 14, members: 21,
    focus: "Salvage · trade", minLevel: 26, minHonor: 10000, hex: "#9fb6d4", recruiting: true,
    brief: "Salvage and market crew. Buys member ore above station rate and funds hauls up front." },
  { id: "c8", name: "Ashen Compact", tag: "ASH", level: 19, seasonRank: 9, members: 25,
    focus: "PvP · escort contracts", minLevel: 40, minHonor: 45000, hex: "#ff8c4d", recruiting: true,
    brief: "Escort contracts and open-space PvP. Pays a stipend per contract cleared under the tag." },
];

/** Wappenbau: Formen, Symbole, Farben. */
export const CREST_SHAPES: { key: string; label: string }[] = [
  { key: "hex", label: "HEXAGON" }, { key: "shield", label: "SHIELD" },
  { key: "diamond", label: "DIAMOND" }, { key: "oct", label: "OCTAGON" },
  { key: "chev", label: "CHEVRON" }, { key: "blade", label: "BLADE" },
];

export const CREST_SYMBOLS: { glyph: string; label: string }[] = [
  { glyph: "◆", label: "DIAMOND" }, { glyph: "✦", label: "STAR" },
  { glyph: "▲", label: "SPEAR" }, { glyph: "◉", label: "ORB" },
  { glyph: "❖", label: "PRISM" }, { glyph: "✧", label: "SPARK" },
  { glyph: "⬟", label: "CORE" }, { glyph: "⚔", label: "BLADES" },
  { glyph: "☓", label: "CROSS" }, { glyph: "◈", label: "GATE" },
  { glyph: "▣", label: "BASTION" }, { glyph: "✹", label: "NOVA" },
];

export const CREST_COLORS = [
  "#b866ff", "#4ee2ff", "#5cff8a", "#e8b94d",
  "#ff4d5e", "#ff5cf0", "#ff8c4d", "#9fb6d4",
];

export const GLYPH_COLORS = [
  "#ffffff", "#0a0810", "#f5dda6", "#9df2ff", "#ffc9f6", "#c8ffd8",
];

export const CLAN_FOCUS_TAGS = [
  "SECTOR WAR", "BOUNTY", "MINING", "SALVAGE",
  "EXPLORATION", "DUNGEONS", "TRADE", "ESCORT",
];

export const CHARTER_FEE = 250000;
