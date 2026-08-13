// Fortschritt: Skillbäume, Attribute, Karrierepfade, Ranglisten, Einstellungen.

import type { Pilot } from "../panels/types";

/* ── Skillbäume ───────────────────────────────────────────────────────────── */

export type SkillNode = {
  id: string; name: string; tier: number;
  x: number; y: number; max: number;
  kind: "normal" | "elite" | "capstone";
  parent: string | null;
  brief: string;
  /** Wirkung je Stufe. */
  effect: string;
};

export type SkillTree = { key: string; label: string; hex: string; nodes: SkillNode[] };

export const SKILL_TREES: SkillTree[] = [
  { key: "off", label: "OFFENSIVE", hex: "#ff4d5e", nodes: [
    { id: "o1", name: "Focused Barrel", tier: 1, x: 0, y: 0, max: 5, kind: "normal", parent: null,
      brief: "Tighter bore, straighter shot. The first thing any gunner pays for.", effect: "+3% weapon damage" },
    { id: "o2", name: "Heat Sink", tier: 1, x: -150, y: 96, max: 5, kind: "normal", parent: "o1",
      brief: "Vented sink bolted to the mount. Lets you hold the trigger longer.", effect: "-4% heat build-up" },
    { id: "o3", name: "Rapid Cycle", tier: 1, x: 150, y: 96, max: 5, kind: "normal", parent: "o1",
      brief: "Reworked feed mechanism. More shots in the same window.", effect: "+2.5% fire rate" },
    { id: "o4", name: "Piercing Core", tier: 2, x: -230, y: 196, max: 4, kind: "normal", parent: "o2",
      brief: "Hardened penetrator. Goes through plate that used to stop you.", effect: "+4% armour penetration" },
    { id: "o5", name: "Overcharge", tier: 2, x: -76, y: 196, max: 4, kind: "elite", parent: "o2",
      brief: "Dumps the capacitor into the first shot of every burst.", effect: "+9% opening burst" },
    { id: "o6", name: "Splinter Rounds", tier: 2, x: 76, y: 196, max: 4, kind: "elite", parent: "o3",
      brief: "Rounds break on impact and spray the hull behind.", effect: "+7% splash damage" },
    { id: "o7", name: "Hair Trigger", tier: 2, x: 230, y: 196, max: 4, kind: "normal", parent: "o3",
      brief: "Shorter travel on the trigger. Milliseconds add up.", effect: "+3% fire rate" },
    { id: "o8", name: "Executioner", tier: 3, x: -150, y: 302, max: 3, kind: "elite", parent: "o5",
      brief: "Targets under a third health take noticeably more.", effect: "+12% damage below 33% hull" },
    { id: "o9", name: "Chain Fire", tier: 3, x: 150, y: 302, max: 3, kind: "elite", parent: "o6",
      brief: "Every kill shortens the next reload.", effect: "-14% reload after a kill" },
    { id: "o10", name: "Annihilation Field", tier: 4, x: 0, y: 412, max: 1, kind: "capstone", parent: "o8",
      brief: "Your kills detonate. Anything close to the wreck takes it too.", effect: "Kills deal 40% splash in 900 m" },
  ] },
  { key: "def", label: "DEFENCE", hex: "#4ee2ff", nodes: [
    { id: "d1", name: "Hull Weave", tier: 1, x: 0, y: 0, max: 5, kind: "normal", parent: null,
      brief: "Cross-woven plate. Cheap tonnage that keeps you flying.", effect: "+2.5% hull" },
    { id: "d2", name: "Shield Cell", tier: 1, x: -190, y: 92, max: 5, kind: "normal", parent: "d1",
      brief: "Extra cell in the deflector bank. More ceiling, same draw.", effect: "+3% shield capacity" },
    { id: "d3", name: "Reactive Plating", tier: 1, x: 0, y: 92, max: 5, kind: "normal", parent: "d1",
      brief: "Plate that stiffens on impact. Blunts repeat hits.", effect: "-2% damage taken" },
    { id: "d4", name: "Coolant Loop", tier: 1, x: 190, y: 92, max: 5, kind: "normal", parent: "d1",
      brief: "Closed loop that keeps the deflector from browning out.", effect: "-4% shield recharge delay" },
    { id: "d5", name: "Bulwark", tier: 2, x: -120, y: 200, max: 4, kind: "elite", parent: "d2",
      brief: "Locks the deflector open while the bank drains.", effect: "+11% shield under fire" },
    { id: "d6", name: "Ablative Skin", tier: 2, x: 120, y: 200, max: 4, kind: "elite", parent: "d3",
      brief: "Outer layer burns off instead of the hull.", effect: "-8% first hit damage" },
    { id: "d7", name: "Fast Cycle", tier: 2, x: 0, y: 296, max: 4, kind: "normal", parent: "d4",
      brief: "Shortens the gap before the deflector comes back.", effect: "-5% recharge time" },
    { id: "d8", name: "Last Stand", tier: 3, x: -170, y: 388, max: 3, kind: "elite", parent: "d5",
      brief: "Under a quarter hull, everything toughens.", effect: "-18% damage below 25% hull" },
    { id: "d9", name: "Mirror Field", tier: 3, x: 170, y: 388, max: 3, kind: "elite", parent: "d6",
      brief: "A share of what hits the deflector goes back out.", effect: "Reflect 6% of shield damage" },
    { id: "d10", name: "Aegis Protocol", tier: 4, x: 0, y: 492, max: 1, kind: "capstone", parent: "d8",
      brief: "One full stop. Everything bounces for three seconds.", effect: "3 s immunity, 180 s cooldown" },
  ] },
  { key: "uti", label: "UTILITY", hex: "#5cff8a", nodes: [
    { id: "u1", name: "Drive Trim", tier: 1, x: 0, y: 0, max: 5, kind: "normal", parent: null,
      brief: "Trimmed thruster profile. Free speed for a weekend's work.", effect: "+2% top speed" },
    { id: "u2", name: "Cargo Frames", tier: 1, x: -210, y: 104, max: 5, kind: "normal", parent: "u1",
      brief: "Modular frames in the hold. More ore per run.", effect: "+40 cargo units" },
    { id: "u3", name: "Scanner Gain", tier: 1, x: -70, y: 104, max: 5, kind: "normal", parent: "u1",
      brief: "Stronger return on the passive array.", effect: "+8% scan range" },
    { id: "u4", name: "Salvage Arms", tier: 1, x: 70, y: 104, max: 5, kind: "normal", parent: "u1",
      brief: "Better grip on wrecks. Less left behind.", effect: "+3% salvage yield" },
    { id: "u5", name: "Warp Tuning", tier: 1, x: 210, y: 104, max: 5, kind: "normal", parent: "u1",
      brief: "Shorter spool, smoother exit.", effect: "-5% warp spool" },
    { id: "u6", name: "Prospector", tier: 2, x: -140, y: 212, max: 4, kind: "elite", parent: "u2",
      brief: "Reads ore density before you commit to a rock.", effect: "+9% mining yield" },
    { id: "u7", name: "Ghost Signature", tier: 2, x: 0, y: 212, max: 4, kind: "elite", parent: "u3",
      brief: "Damps your return. Hostiles notice you later.", effect: "-11% detection range" },
    { id: "u8", name: "Wreck Rights", tier: 2, x: 140, y: 212, max: 4, kind: "normal", parent: "u4",
      brief: "Negotiated claims. Better rolls on salvage.", effect: "+5% rare salvage chance" },
    { id: "u9", name: "Slipstream", tier: 3, x: -110, y: 320, max: 3, kind: "elite", parent: "u6",
      brief: "Drafts the wake of your own jump.", effect: "+14% speed after warp" },
    { id: "u10", name: "Deep Survey", tier: 3, x: 110, y: 320, max: 3, kind: "elite", parent: "u8",
      brief: "Finds the seams nobody else bothered to map.", effect: "Reveals hidden belt nodes" },
    { id: "u11", name: "Quantum Anchor", tier: 4, x: 0, y: 424, max: 1, kind: "capstone", parent: "u9",
      brief: "Drops a return point. One jump back, any time.", effect: "Recall to anchor, 300 s cooldown" },
  ] },
];

export const SKILL_RANKS: Record<string, number> = {
  o1: 5, o2: 3, o3: 4, o4: 2, o5: 1, o6: 0, o7: 2, o8: 0, o9: 0, o10: 0,
  d1: 4, d2: 5, d3: 2, d4: 1, d5: 2, d6: 0, d7: 0, d8: 0, d9: 0, d10: 0,
  u1: 3, u2: 5, u3: 2, u4: 1, u5: 0, u6: 1, u7: 0, u8: 0, u9: 0, u10: 0, u11: 0,
};

/* ── Attribute ────────────────────────────────────────────────────────────── */

export type Attribute = {
  key: string; label: string; perPoint: number; unit: string; hex: string; glyph: string;
};

/** Damage 1 %, Hitpoints 1,5 %, Max Shield 1,5 %, Speed 0,5 % je Punkt. */
export const ATTRIBUTES: Attribute[] = [
  { key: "dmg", label: "Damage", perPoint: 1.0, unit: "%", hex: "#ff4d5e", glyph: "◆" },
  { key: "hp", label: "Hitpoints", perPoint: 1.5, unit: "%", hex: "#5cff8a", glyph: "▲" },
  { key: "shield", label: "Max Shield", perPoint: 1.5, unit: "%", hex: "#4ee2ff", glyph: "◈" },
  { key: "speed", label: "Speed", perPoint: 0.5, unit: "%", hex: "#e8b94d", glyph: "✦" },
];

export const ATTRIBUTE_SPENT: Record<string, number> = { dmg: 24, hp: 18, shield: 16, speed: 9 };
export const ATTRIBUTE_STEPS = [1, 5, 10];

/* ── Karrierepfade ───────────────────────────────────────────────────────── */

export type CareerPath = {
  key: string; label: string; level: number; xp: number; xpMax: number;
  source: string; hex: string;
};

export const CAREER_PATHS: CareerPath[] = [
  { key: "trade", label: "Merchant", level: 24, xp: 68400, xpMax: 92000,
    source: "Credits earned through trade and hauling", hex: "#e8b94d" },
  { key: "combat", label: "Warrior", level: 31, xp: 41200, xpMax: 68000,
    source: "Player and NPC kills", hex: "#ff4d5e" },
  { key: "mining", label: "Prospector", level: 19, xp: 22800, xpMax: 42000,
    source: "Ore refined and volume hauled", hex: "#4ee2ff" },
  { key: "contracts", label: "Operative", level: 27, xp: 55100, xpMax: 74000,
    source: "Contracts cleared", hex: "#b866ff" },
  { key: "explore", label: "Pathfinder", level: 14, xp: 9600, xpMax: 26000,
    source: "Zones charted and portals cleared", hex: "#5cff8a" },
];

export const SERVICE_RECORD: [string, string, string][] = [
  ["PLAYER SHIPS DESTROYED", "1,284", "#ff4d5e"],
  ["NPC HULLS DESTROYED", "48,912", "#ff8c4d"],
  ["CONTRACTS CLEARED", "2,406", "#b866ff"],
  ["VOID PORTALS CLEARED", "184", "#ff5cf0"],
  ["ORE REFINED", "9.4 M", "#4ee2ff"],
  ["CREDITS TRADED", "1.82 B", "#e8b94d"],
  ["DEATHS", "312", "#8aa0c0"],
  ["K / D RATIO", "4.12", "#5cff8a"],
];

/* ── Der eigene Pilot ────────────────────────────────────────────────────── */

export const PILOT: Pilot = {
  name: "Nyx_7", faction: "EIC", clanTag: "VSD",
  rank: 11, rankName: "COMMANDER",
  level: 49, xp: 96400, xpMax: 148000,
  honor: 96400, honorNext: 120000,
  credits: 812000, mcoins: 18400,
  premium: false, docked: true,
};

export const REPUTATION: [string, number, number][] = [
  ["EIC", 0.82, 0x4ee2ff],
  ["MMO", 0.34, 0xff8c4d],
  ["VRU", 0.11, 0x5cff8a],
];

/* ── Rangliste ───────────────────────────────────────────────────────────── */

export type Standing = {
  name: string; faction: string; tag: string;
  level: number; honor: number; kills: number; credits: number;
};

const TOP: Standing[] = [
  { name: "Kestrel", faction: "EIC", tag: "VSD", level: 62, honor: 1840000, kills: 9840, credits: 182400000 },
  { name: "Ashmark", faction: "MMO", tag: "NVP", level: 61, honor: 1712000, kills: 11204, credits: 164900000 },
  { name: "Sable", faction: "EIC", tag: "VSD", level: 60, honor: 1655000, kills: 8620, credits: 158200000 },
  { name: "Corvus_X", faction: "VRU", tag: "IRC", level: 59, honor: 1498000, kills: 10412, credits: 149600000 },
  { name: "Vega_9", faction: "EIC", tag: "VSD", level: 58, honor: 1402000, kills: 7318, credits: 141800000 },
  { name: "Rell", faction: "MMO", tag: "EMW", level: 58, honor: 1366000, kills: 9106, credits: 138400000 },
  { name: "Ilya", faction: "EIC", tag: "VSD", level: 57, honor: 1284000, kills: 6842, credits: 132900000 },
  { name: "Nakamura", faction: "VRU", tag: "HLV", level: 56, honor: 1198000, kills: 8004, credits: 127300000 },
  { name: "Sorrow", faction: "MMO", tag: "ASH", level: 56, honor: 1142000, kills: 7690, credits: 121600000 },
  { name: "Bruk", faction: "EIC", tag: "VSD", level: 55, honor: 1088000, kills: 6218, credits: 118200000 },
  { name: "Wren", faction: "VRU", tag: "SLM", level: 54, honor: 1024000, kills: 5904, credits: 114700000 },
  { name: "Kova", faction: "MMO", tag: "EMW", level: 53, honor: 968000, kills: 6440, credits: 109300000 },
  { name: "Halcyon", faction: "EIC", tag: "VSD", level: 52, honor: 912000, kills: 5312, credits: 104800000 },
  { name: "Vasquez", faction: "VRU", tag: "IRC", level: 51, honor: 864000, kills: 5788, credits: 101200000 },
  { name: "Orin", faction: "EIC", tag: "VSD", level: 50, honor: 806000, kills: 4920, credits: 96400000 },
  { name: "Nyx_7", faction: "EIC", tag: "VSD", level: 49, honor: 96400, kills: 4182, credits: 46200000 },
];

const FILLER_NAMES = [
  "Torvald", "Ash_Vela", "Quill", "Renn", "Marrow", "Six_Cade", "Ollo", "Prae", "Suri_K", "Vandt",
  "Ketch", "Nova_Lin", "Brim", "Ozar", "Talia", "Grist", "Ephra", "Sundo", "Ryke", "Calla",
  "Merrow", "Dax_9", "Fenn", "Ivor", "Solace", "Yorne", "Pell", "Anka", "Drift_V", "Bram",
  "Sable_II", "Krieg", "Nim", "Osric", "Vex", "Lark", "Thann", "Ivy_R", "Corda", "Bex",
  "Mirek", "Sova", "Halt", "Ren_K", "Ulric", "Vail", "Wick", "Xan", "Yuri", "Zeb",
  "Adair", "Brann", "Cass", "Dovan", "Elin", "Foss", "Garr", "Hux", "Ilm", "Jory",
  "Kell", "Lyss", "Mott", "Nash", "Oren", "Pyre", "Quen", "Rask_II", "Syl", "Tarn",
  "Umbo", "Vane", "Wren_II", "Xero", "Yael", "Zane", "Alto", "Bode", "Cyra", "Doro",
  "Esk", "Faye", "Gunn", "Hale", "Iris", "Joss",
];
const FILLER_TAGS = ["IRC", "EMW", "SLM", "NVP", "DFC", "HLV", "SCU", "ASH", "VSD", "—"];
const FILLER_FACS = ["EIC", "MMO", "VRU"];

/** Rangliste bis Platz 100 auffüllen — deterministisch, damit Tests stabil sind. */
export const STANDINGS: Standing[] = TOP.concat(FILLER_NAMES.map((name, i) => {
  const k = i + 1, wob = ((i * 37) % 11) / 10;
  return {
    name, faction: FILLER_FACS[(i * 7) % 3], tag: FILLER_TAGS[(i * 3) % 10],
    level: Math.max(12, 54 - Math.round(k * 0.42 + wob)),
    honor: Math.round(1024000 / (1 + k * 0.09) - wob * 9000),
    kills: Math.round(5904 / (1 + k * 0.05) - wob * 60),
    credits: Math.round(92000000 / (1 + k * 0.1) - wob * 400000),
  };
}));

export const BOARDS: { key: keyof Standing; label: string; hex: string; unit: string }[] = [
  { key: "level", label: "LEVEL", hex: "#4ee2ff", unit: "LEVEL" },
  { key: "honor", label: "HONOR", hex: "#ff5cf0", unit: "HONOR" },
  { key: "kills", label: "KILLS", hex: "#ff4d5e", unit: "KILLS" },
  { key: "credits", label: "CREDITS", hex: "#e8b94d", unit: "CREDITS" },
];

export const MEDAL = [0xffdf8a, 0xdfe8f2, 0xe09a5a];

export type RewardTier = { label: string; badge: string; items: string[]; premium: boolean };

export const REWARDS: Record<string, { title: string; hex: string; brief: string; tiers: RewardTier[] }> = {
  monthly: {
    title: "MONTHLY REWARDS", hex: "#e8b94d",
    brief: "The monthly board wipes at the start of every cycle. Placement pays MCoins the moment the season closes, plus the cosmetics filed for that cycle.",
    tiers: [
      { label: "RANK 1", badge: "1st", items: ["25,000 MCOINS", "SEASON CREST", "TITLE: ASCENDANT"], premium: true },
      { label: "RANK 2", badge: "2nd", items: ["15,000 MCOINS", "SEASON CREST"], premium: true },
      { label: "RANK 3", badge: "3rd", items: ["10,000 MCOINS", "SEASON CREST"], premium: true },
      { label: "RANK 4 – 10", badge: "4-10", items: ["4,000 MCOINS"], premium: false },
      { label: "RANK 11 – 50", badge: "11+", items: ["1,500 MCOINS"], premium: false },
      { label: "RANK 51 – 100", badge: "51+", items: ["500 MCOINS"], premium: false },
    ],
  },
  alltime: {
    title: "ALL-TIME REWARDS", hex: "#b866ff",
    brief: "The all-time board never resets. Standing pays a permanent boost that applies while you hold the seat — lose the rank and the boost goes with it.",
    tiers: [
      { label: "RANK 1", badge: "1st", items: ["+15% EXPERIENCE", "+15% CREDITS", "PREMIUM WHILE HELD"], premium: true },
      { label: "RANK 2", badge: "2nd", items: ["+12% EXPERIENCE", "+12% CREDITS", "PREMIUM WHILE HELD"], premium: true },
      { label: "RANK 3", badge: "3rd", items: ["+10% EXPERIENCE", "+10% CREDITS", "PREMIUM WHILE HELD"], premium: true },
      { label: "RANK 4 – 10", badge: "4-10", items: ["+6% EXPERIENCE", "+6% CREDITS"], premium: false },
      { label: "RANK 11 – 50", badge: "11+", items: ["+3% EXPERIENCE", "+3% CREDITS"], premium: false },
      { label: "RANK 51 – 100", badge: "51+", items: ["+1% EXPERIENCE"], premium: false },
    ],
  },
};

/* ── Einstellungen ───────────────────────────────────────────────────────── */

export type SettingKind = "toggle" | "slider" | "select" | "key";

export type SettingRow = {
  kind: SettingKind; label: string; key: string;
  options?: string[]; min?: number; max?: number; note?: string;
};

export const SETTINGS_TABS: { key: string; label: string }[] = [
  { key: "gfx", label: "GRAPHICS" }, { key: "aud", label: "AUDIO" },
  { key: "ctl", label: "CONTROLS" }, { key: "ui", label: "INTERFACE" },
  { key: "gpl", label: "GAMEPLAY" },
];

export const SETTINGS_ROWS: Record<string, SettingRow[]> = {
  gfx: [
    { kind: "select", label: "Preset", key: "preset", options: ["LOW", "MEDIUM", "HIGH", "ULTRA"], note: "Sets everything below in one move." },
    { kind: "select", label: "Resolution", key: "res", options: ["1280×720", "1600×900", "1920×1080", "2560×1440", "3840×2160"] },
    { kind: "toggle", label: "Fullscreen", key: "fullscreen" },
    { kind: "toggle", label: "VSync", key: "vsync", note: "Caps the frame rate to your monitor." },
    { kind: "slider", label: "Frame limit", key: "fps", min: 30, max: 240, note: "0 removes the cap." },
    { kind: "toggle", label: "Bloom", key: "bloom" },
    { kind: "toggle", label: "Motion blur", key: "blur" },
    { kind: "slider", label: "Particle density", key: "particles", min: 0, max: 200, note: "Sparks, thruster trails, debris." },
    { kind: "slider", label: "Render scale", key: "renderScale", min: 50, max: 200 },
    { kind: "toggle", label: "Screen shake", key: "shake" },
  ],
  aud: [
    { kind: "slider", label: "Master", key: "volMaster", min: 0, max: 100 },
    { kind: "slider", label: "Effects", key: "volFx", min: 0, max: 100 },
    { kind: "slider", label: "Music", key: "volMusic", min: 0, max: 100 },
    { kind: "slider", label: "Voice", key: "volVoice", min: 0, max: 100 },
    { kind: "slider", label: "Interface", key: "volUi", min: 0, max: 100 },
    { kind: "toggle", label: "Mute when unfocused", key: "muteBg" },
    { kind: "select", label: "Output device", key: "audioDev", options: ["SYSTEM DEFAULT", "HEADSET", "SPEAKERS"] },
  ],
  ctl: [
    { kind: "key", label: "Fire primary", key: "keyFire", note: "Hold to keep firing." },
    { kind: "key", label: "Boost", key: "keyBoost" },
    { kind: "key", label: "Inventory", key: "keyInv" },
    { kind: "key", label: "Skill matrix", key: "keySkill" },
    { kind: "key", label: "Galaxy map", key: "keyGalaxy" },
    { kind: "key", label: "Zone map", key: "keyZone" },
    { kind: "key", label: "Social", key: "keySocial" },
    { kind: "slider", label: "Mouse sensitivity", key: "sens", min: 10, max: 200 },
    { kind: "toggle", label: "Invert Y axis", key: "invertY" },
    { kind: "toggle", label: "Hold to aim", key: "holdAim" },
  ],
  ui: [
    { kind: "slider", label: "HUD scale", key: "hudScale", min: 70, max: 140 },
    { kind: "toggle", label: "Show damage numbers", key: "dmgNum" },
    { kind: "toggle", label: "Show enemy health bars", key: "enemyBars" },
    { kind: "toggle", label: "Show minimap", key: "minimap" },
    { kind: "select", label: "Minimap corner", key: "miniPos", options: ["TOP LEFT", "TOP RIGHT", "BOTTOM LEFT", "BOTTOM RIGHT"] },
    { kind: "toggle", label: "Chat timestamps", key: "chatTime" },
    { kind: "slider", label: "Chat opacity", key: "chatOpacity", min: 20, max: 100 },
    { kind: "toggle", label: "Compact tooltips", key: "tipCompact" },
  ],
  gpl: [
    { kind: "toggle", label: "Auto-collect salvage", key: "autoLoot" },
    { kind: "toggle", label: "Confirm before throwing items out", key: "confirmDrop" },
    { kind: "toggle", label: "Auto-target nearest hostile", key: "autoTarget" },
    { kind: "select", label: "Default chat channel", key: "chatDef", options: ["ZONE", "CLAN", "PARTY", "TRADE"] },
    { kind: "toggle", label: "Accept party invites from friends", key: "autoParty" },
    { kind: "toggle", label: "Show tutorial prompts", key: "tutorial" },
  ],
};

export const SETTINGS_DEFAULTS: Record<string, string | number | boolean> = {
  preset: "HIGH", res: "1920×1080", fullscreen: true, vsync: true, fps: 144,
  bloom: true, blur: false, particles: 100, renderScale: 100, shake: true,
  volMaster: 80, volFx: 75, volMusic: 55, volVoice: 70, volUi: 60,
  muteBg: true, audioDev: "SYSTEM DEFAULT",
  keyFire: "MOUSE 1", keyBoost: "SHIFT", keyInv: "I", keySkill: "K",
  keyGalaxy: "M", keyZone: "N", keySocial: "O", sens: 100, invertY: false, holdAim: false,
  hudScale: 100, dmgNum: true, enemyBars: true, minimap: true, miniPos: "BOTTOM RIGHT",
  chatTime: true, chatOpacity: 80, tipCompact: false,
  autoLoot: true, confirmDrop: true, autoTarget: false, chatDef: "ZONE",
  autoParty: true, tutorial: true,
};

/* ── Hotbar ──────────────────────────────────────────────────────────────── */

export type HotbarSlot = {
  key: string; name: string; icon: string; rarity: string;
  qty: number; cooldown: number;
};

export const HOTBAR: HotbarSlot[] = [
  { key: "1", name: "Void Lance", icon: "laser-t10", rarity: "celestial", qty: 0, cooldown: 0 },
  { key: "2", name: "Nova Charge", icon: "mod0-t3", rarity: "epic", qty: 12, cooldown: 45 },
  { key: "3", name: "Repair Cell", icon: "mod2-t3", rarity: "uncommon", qty: 28, cooldown: 12 },
  { key: "4", name: "Ember Rounds", icon: "mod0-t3", rarity: "rare", qty: 220, cooldown: 0 },
  { key: "5", name: "Bastion Field", icon: "genshield-t4", rarity: "relic", qty: 0, cooldown: 90 },
  { key: "6", name: "Salvage Claw", icon: "mod3-t3", rarity: "uncommon", qty: 2, cooldown: 8 },
  { key: "7", name: "Solace Flare", icon: "mod0-t3", rarity: "common", qty: 60, cooldown: 20 },
  { key: "8", name: "Rift Coupler", icon: "mod3-t3", rarity: "celestial", qty: 0, cooldown: 300 },
  { key: "9", name: "", icon: "", rarity: "", qty: 0, cooldown: 0 },
  { key: "0", name: "", icon: "", rarity: "", qty: 0, cooldown: 0 },
];

export const AMMUNITION: { name: string; icon: string; rarity: string; qty: number }[] = [
  { name: "Ember Rounds", icon: "mod0-t3", rarity: "rare", qty: 220 },
  { name: "Piercing Slug", icon: "mod2-t4", rarity: "epic", qty: 84 },
  { name: "Standard Load", icon: "mod2-t3", rarity: "common", qty: 1840 },
  { name: "Prisma Tip", icon: "mod3-t3", rarity: "relic", qty: 12 },
];
