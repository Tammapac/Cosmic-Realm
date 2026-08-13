/**
 * Server-side game constants for Cosmic Realm.
 * Ported from frontend/src/game/types.ts — visual-only fields stripped
 * (bgHueA, bgHueB, glyph, icon, accent, description for non-client items).
 * Colors for enemies, factions, and dungeons are kept since they get sent to clients.
 */

// ── TYPE DEFINITIONS ─────────────────────────────────────────────────────────

export type Vec2 = { x: number; y: number };

export type ZoneId =
  | "alpha" | "nebula" | "crimson" | "void" | "forge"
  | "corona" | "fracture" | "abyss" | "marsdepth" | "maelstrom"
  | "venus1" | "venus2" | "venus3" | "venus4" | "venus5"
  | "danger1" | "danger2" | "danger3" | "danger4" | "danger5"
  | "debug";

export type EnemyType = "scout" | "raider" | "destroyer" | "voidling" | "dread" | "sentinel" | "wraith" | "titan" | "overlord" | "interceptor" | "corvette" | "specter" | "phantom" | "juggernaut" | "leviathan" | "erix" | "angin" | "crobium" | "draug" | "knoton" | "maron" | "nabas" | "silikum" | "simonit";
export type EnemyBehavior = "fast" | "chaser" | "tank" | "ranged";

export type ShipClassId =
  | "skimmer"
  | "wasp"
  | "vanguard"
  | "reaver"
  | "obsidian"
  | "marauder"
  | "phalanx"
  | "titan"
  | "leviathan"
  | "specter"
  | "colossus"
  | "harbinger"
  | "eclipse"
  | "sovereign"
  | "apex";

export type ModuleSlot = "weapon" | "generator" | "module";
export type ModuleRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type WeaponKind = "laser" | "rocket" | "energy" | "plasma";

export type ModuleStats = {
  damage?: number;
  fireRate?: number;
  critChance?: number;
  shieldMax?: number;
  shieldRegen?: number;
  hullMax?: number;
  speed?: number;
  damageReduction?: number;
  shieldAbsorb?: number;
  cargoBonus?: number;
  lootBonus?: number;
  aoeRadius?: number;
  ammoCapacity?: number;
  miningBonus?: number;
};

export type RocketAmmoType = "x1" | "x2" | "x3" | "x4";
export type RocketMissileType = "cl1" | "cl2" | "bm3" | "drock";

export type FactionId = "earth" | "mars" | "venus";

export type SkillBranch = "offense" | "defense" | "utility" | "engineering";
export type SkillId =
  | "off-power" | "off-rapid" | "off-crit" | "off-pierce"
  | "off-snipe" | "off-volley" | "off-execute" | "off-void"
  | "def-shield" | "def-regen" | "def-armor" | "def-bulwark"
  | "def-barrier" | "def-nano" | "def-fortress" | "def-reflect"
  | "ut-cargo" | "ut-thrust" | "ut-salvage" | "ut-droneops"
  | "ut-trade" | "ut-scan" | "ut-warp" | "ut-drone2"
  | "eng-coolant" | "eng-capacitor" | "eng-targeting" | "eng-warp-core"
  | "eng-overdrive" | "eng-singularity"
  // ── expansion: offense (16) ──
  | "off-caliber" | "off-steady" | "off-weakpoint" | "off-firstblood"
  | "off-coldbore" | "off-headhunter" | "off-sustain" | "off-cadence"
  | "off-attrition" | "off-barrage" | "off-splash" | "off-shrapnel"
  | "off-chain" | "off-saturation" | "off-render" | "off-apex"
  // ── expansion: defense (15) ──
  | "def-lattice" | "def-diffuse" | "def-overshield" | "def-aegis"
  | "def-coolant" | "def-triage" | "def-secondwind" | "def-phoenix"
  | "def-ablative" | "def-hardened" | "def-lastditch" | "def-immovable"
  | "def-spines" | "def-backlash" | "def-nemesis"
  // ── expansion: utility (15) ──
  | "ut-hold" | "ut-broker" | "ut-contraband" | "ut-magnate"
  | "ut-vector" | "ut-slipstream" | "ut-evasion" | "ut-phaserunner"
  | "ut-swarm" | "ut-repairbay" | "ut-hivemind" | "ut-survey"
  | "ut-refinery" | "ut-assay" | "ut-prospector"
  // ── expansion: engineering (16) ──
  | "eng-plasma" | "eng-fusion" | "eng-surge" | "eng-meltdown"
  | "eng-radiator" | "eng-cryoflow" | "eng-heatsink" | "eng-runaway"
  | "eng-regulator" | "eng-harmonics" | "eng-transfer" | "eng-resonance"
  | "eng-equilibrium" | "eng-recursion" | "eng-eventhorizon" | "eng-zeropoint";

export type ConsumableId =
  | "rocket-ammo"
  | "repair-bot"
  | "combat-drone-pod"
  | "shield-charge"
  | "emp-burst"
  | "afterburn-fuel";

export type DroneKind = "combat-i" | "combat-ii" | "shield-i" | "shield-ii" | "salvage";
export type DroneMode = "orbit" | "forward" | "defensive";

export type ResourceId =
  | "scrap" | "plasma" | "warp" | "void" | "dread"
  | "iron" | "lumenite" | "medpack" | "synth" | "quantum"
  | "food" | "medicine" | "luxury" | "nanite" | "bio-matter"
  | "precursor" | "fuel-cell" | "contraband" | "relic" | "exotic"
  | "artifacts" | "spice" | "silk" | "ore" | "data-core"
  | "cloning-gel" | "medical-serum" | "fusion-lattice" | "star-map"
  | "blackglass" | "titanium" | "cryo-fluid" | "neural-chip"
  | "dark-matter" | "plasma-coil" | "bio-crystal"
  | "copper" | "cobalt" | "crystal-shard" | "palladium"
  | "helium-3" | "iridium" | "sulfur" | "obsidian" | "refined-alloy" | "crystal-matrix" | "fusion-core" | "void-steel" | "nano-compound" | "plasma-cell";

export type StationKind = "hub" | "trade" | "mining" | "military" | "outpost" | "factory";

export type MissionKind =
  | "kill-any" | "kill-zone" | "mine" | "earn-credits" | "spend-credits" | "warp-zones" | "level-up";

export type DungeonId =
  | "alpha-rift" | "nebula-rift" | "crimson-rift" | "void-rift" | "forge-rift"
  | "corona-rift" | "fracture-rift" | "abyss-rift"
  | "marsdepth-rift" | "maelstrom-rift"
  | "venus1-rift" | "venus2-rift" | "venus3-rift" | "venus4-rift" | "venus5-rift";

// ── CONSTANTS ────────────────────────────────────────────────────────────────

export const MAP_RADIUS = 8000;

export const ENEMY_MAX_BASE = 18;
export const ENEMY_MAX_PER_TIER = 4;
export const BOSS_HP_MUL_MIN = 4.5;
export const BOSS_HP_MUL_MAX = 6.0;
export const BOSS_DMG_MUL_MIN = 3.0;
export const BOSS_DMG_MUL_MAX = 4.0;
export const NPC_MAX_PER_ZONE = 5;
export const NPC_SPAWN_MIN = 8;
export const NPC_SPAWN_MAX = 20;
export const MINING_RANGE = 450;
export const MINING_DPS_FACTOR = 0.25;
export const ASTEROID_RESPAWN = 6;

// ── EXP FORMULA ──────────────────────────────────────────────────────────────

export const EXP_FOR_LEVEL = (level: number) => 100 * level * level;

// ── SHIP CLASSES (15) ────────────────────────────────────────────────────────

export const SHIP_CLASSES: Record<ShipClassId, {
  id: ShipClassId;
  hullMax: number;
  shieldMax: number;
  baseSpeed: number;
  baseDamage: number;
  cargoMax: number;
  droneSlots: number;
  slots: { weapon: number; generator: number; module: number };
  price: number;
}> = {
  skimmer: {
    id: "skimmer",
    hullMax: 100, shieldMax: 50, baseSpeed: 180, baseDamage: 8,
    cargoMax: 20, droneSlots: 1, price: 0,
    slots: { weapon: 1, generator: 2, module: 1 },
  },
  wasp: {
    id: "wasp",
    hullMax: 90, shieldMax: 70, baseSpeed: 240, baseDamage: 10,
    cargoMax: 14, droneSlots: 1, price: 15000,
    slots: { weapon: 2, generator: 2, module: 1 },
  },
  vanguard: {
    id: "vanguard",
    hullMax: 180, shieldMax: 120, baseSpeed: 160, baseDamage: 14,
    cargoMax: 40, droneSlots: 2, price: 50000,
    slots: { weapon: 2, generator: 3, module: 2 },
  },
  reaver: {
    id: "reaver",
    hullMax: 160, shieldMax: 140, baseSpeed: 200, baseDamage: 18,
    cargoMax: 30, droneSlots: 2, price: 120000,
    slots: { weapon: 3, generator: 3, module: 2 },
  },
  obsidian: {
  // refined materials
  "refined-alloy":  { id: "refined-alloy",  name: "Refined Alloy",    basePrice: 120,  glyph: "H", color: "#dd8844", description: "High-grade alloy." },
  "crystal-matrix": { id: "crystal-matrix", name: "Crystal Matrix",   basePrice: 340,  glyph: "*", color: "#dd88ff", description: "Crystalline lattice." },
  "fusion-core":    { id: "fusion-core",    name: "Fusion Core",      basePrice: 480,  glyph: "O", color: "#88ffaa", description: "Miniaturized fusion reactor." },
  "void-steel":     { id: "void-steel",     name: "Void Steel",       basePrice: 850,  glyph: "D", color: "#8866cc", description: "Ultra-hard void-forged steel." },
  "nano-compound":  { id: "nano-compound",  name: "Nano-Compound",    basePrice: 220,  glyph: "o", color: "#66ddcc", description: "Self-assembling nano-material." },
  "plasma-cell":    { id: "plasma-cell",     name: "Plasma Cell",      basePrice: 180,  glyph: "#", color: "#ff8866", description: "Concentrated plasma fuel cell." },
    id: "obsidian",
    hullMax: 220, shieldMax: 180, baseSpeed: 200, baseDamage: 22,
    cargoMax: 30, droneSlots: 3, price: 65000,
    slots: { weapon: 3, generator: 4, module: 3 },
  },
  marauder: {
    id: "marauder",
    hullMax: 280, shieldMax: 200, baseSpeed: 170, baseDamage: 26,
    cargoMax: 60, droneSlots: 4, price: 500000,
    slots: { weapon: 4, generator: 4, module: 3 },
  },
  phalanx: {
    id: "phalanx",
    hullMax: 340, shieldMax: 280, baseSpeed: 150, baseDamage: 24,
    cargoMax: 70, droneSlots: 5, price: 900000,
    slots: { weapon: 4, generator: 5, module: 4 },
  },
  titan: {
    id: "titan",
    hullMax: 400, shieldMax: 300, baseSpeed: 130, baseDamage: 30,
    cargoMax: 80, droneSlots: 5, price: 1500000,
    slots: { weapon: 6, generator: 7, module: 5 },
  },
  leviathan: {
    id: "leviathan",
    hullMax: 600, shieldMax: 480, baseSpeed: 110, baseDamage: 42,
    cargoMax: 120, droneSlots: 6, price: 3200000,
    slots: { weapon: 7, generator: 8, module: 7 },
  },
  specter: {
    id: "specter",
    hullMax: 220, shieldMax: 360, baseSpeed: 220, baseDamage: 34,
    cargoMax: 40, droneSlots: 6, price: 5000000,
    slots: { weapon: 7, generator: 8, module: 7 },
  },
  colossus: {
    id: "colossus",
    hullMax: 800, shieldMax: 600, baseSpeed: 100, baseDamage: 50,
    cargoMax: 150, droneSlots: 7, price: 8000000,
    slots: { weapon: 9, generator: 10, module: 8 },
  },
  harbinger: {
    id: "harbinger",
    hullMax: 500, shieldMax: 700, baseSpeed: 160, baseDamage: 44,
    cargoMax: 80, droneSlots: 7, price: 12000000,
    slots: { weapon: 10, generator: 11, module: 9 },
  },
  eclipse: {
    id: "eclipse",
    hullMax: 1000, shieldMax: 800, baseSpeed: 90, baseDamage: 60,
    cargoMax: 200, droneSlots: 8, price: 20000000,
    slots: { weapon: 12, generator: 12, module: 10 },
  },
  sovereign: {
    id: "sovereign",
    hullMax: 1400, shieldMax: 1100, baseSpeed: 80, baseDamage: 70,
    cargoMax: 250, droneSlots: 8, price: 35000000,
    slots: { weapon: 14, generator: 14, module: 12 },
  },
  apex: {
    id: "apex",
    hullMax: 2000, shieldMax: 1600, baseSpeed: 70, baseDamage: 85,
    cargoMax: 300, droneSlots: 10, price: 60000000,
    slots: { weapon: 16, generator: 18, module: 14 },
  },
};

// ── ENEMY DEFINITIONS (5) ────────────────────────────────────────────────────

export const ENEMY_DEFS: Record<EnemyType, {
  type: EnemyType;
  behavior: EnemyBehavior;
  hullMax: number;
  damage: number;
  speed: number;
  exp: number;
  credits: number;
  honor: number;
  loot: { resourceId: ResourceId; qty: number };
  color: string;
  size: number;
}> = {
  scout: {
    type: "scout", behavior: "fast",
    hullMax: 70, damage: 12, speed: 130, exp: 8, credits: 18, honor: 0,
    color: "#ff8866", size: 10,
    loot: { resourceId: "scrap", qty: 2 },
  },
  raider: {
    type: "raider", behavior: "chaser",
    hullMax: 170, damage: 22, speed: 75, exp: 18, credits: 45, honor: 1,
    color: "#ff4466", size: 13,
    loot: { resourceId: "plasma", qty: 2 },
  },
  destroyer: {
    type: "destroyer", behavior: "tank",
    hullMax: 500, damage: 40, speed: 50, exp: 45, credits: 120, honor: 4,
    color: "#aa44ff", size: 18,
    loot: { resourceId: "warp", qty: 2 },
  },
  voidling: {
    type: "voidling", behavior: "ranged",
    hullMax: 280, damage: 35, speed: 90, exp: 55, credits: 160, honor: 6,
    color: "#44ffe2", size: 14,
    loot: { resourceId: "void", qty: 2 },
  },
  dread: {
    type: "dread", behavior: "tank",
    hullMax: 850, damage: 55, speed: 85, exp: 100, credits: 350, honor: 12,
    color: "#ffaa22", size: 24,
    loot: { resourceId: "dread", qty: 3 },
  },
  sentinel: {
    type: "sentinel", behavior: "ranged",
    hullMax: 450, damage: 48, speed: 100, exp: 65, credits: 220, honor: 8,
    color: "#22ccff", size: 16,
    loot: { resourceId: "quantum", qty: 2 },
  },
  wraith: {
    type: "wraith", behavior: "fast",
    hullMax: 320, damage: 60, speed: 160, exp: 80, credits: 280, honor: 10,
    color: "#cc44ff", size: 12,
    loot: { resourceId: "void", qty: 3 },
  },
  titan: {
    type: "titan", behavior: "tank",
    hullMax: 1500, damage: 75, speed: 80, exp: 150, credits: 500, honor: 18,
    color: "#ff2244", size: 30,
    loot: { resourceId: "dread", qty: 4 },
  },
  overlord: {
    type: "overlord", behavior: "tank",
    hullMax: 2200, damage: 95, speed: 70, exp: 250, credits: 800, honor: 30,
    color: "#ffffff", size: 35,
    loot: { resourceId: "dread", qty: 6 },
  },
  interceptor: {
    type: "interceptor", behavior: "fast",
    hullMax: 130, damage: 28, speed: 150, exp: 22, credits: 60, honor: 2,
    color: "#ff6a00", size: 11,
    loot: { resourceId: "scrap", qty: 3 },
  },
  corvette: {
    type: "corvette", behavior: "chaser",
    hullMax: 340, damage: 38, speed: 95, exp: 50, credits: 140, honor: 5,
    color: "#00cfff", size: 15,
    loot: { resourceId: "iron", qty: 3 },
  },
  specter: {
    type: "specter", behavior: "fast",
    hullMax: 260, damage: 52, speed: 145, exp: 70, credits: 240, honor: 9,
    color: "#a855f7", size: 12,
    loot: { resourceId: "void", qty: 2 },
  },
  phantom: {
    type: "phantom", behavior: "ranged",
    hullMax: 380, damage: 65, speed: 110, exp: 90, credits: 300, honor: 11,
    color: "#38bdf8", size: 14,
    loot: { resourceId: "quantum", qty: 3 },
  },
  juggernaut: {
    type: "juggernaut", behavior: "tank",
    hullMax: 1800, damage: 85, speed: 55, exp: 180, credits: 620, honor: 22,
    color: "#f97316", size: 32,
    loot: { resourceId: "dread", qty: 5 },
  },
  leviathan: {
    type: "leviathan", behavior: "tank",
    hullMax: 3500, damage: 120, speed: 45, exp: 400, credits: 1200, honor: 45,
    color: "#e11d48", size: 40,
    loot: { resourceId: "dread", qty: 8 },
  },
  erix: {
    type: "erix", behavior: "chaser",
    hullMax: 150, damage: 18, speed: 95, exp: 15, credits: 40, honor: 1,
    color: "#5ce1ff", size: 14,
    loot: { resourceId: "scrap", qty: 3 },
  },
  // ── New-generation NPCs (GLB models) — stats anchored to the tier of the
  // map they spawn on so combat balance stays consistent.
  angin: {
    type: "angin", behavior: "ranged", // x-4, sentinel-tier
    hullMax: 460, damage: 50, speed: 105, exp: 68, credits: 230, honor: 8,
    color: "#7dd3fc", size: 15,
    loot: { resourceId: "quantum", qty: 2 },
  },
  crobium: {
    type: "crobium", behavior: "chaser", // x-4, phantom-tier
    hullMax: 400, damage: 62, speed: 115, exp: 88, credits: 295, honor: 11,
    color: "#84cc16", size: 14,
    loot: { resourceId: "quantum", qty: 3 },
  },
  draug: {
    type: "draug", behavior: "fast", // x-5, wraith-tier
    hullMax: 340, damage: 62, speed: 155, exp: 85, credits: 290, honor: 10,
    color: "#94a3b8", size: 13,
    loot: { resourceId: "void", qty: 3 },
  },
  knoton: {
    type: "knoton", behavior: "tank", // x-5, juggernaut-tier
    hullMax: 1700, damage: 82, speed: 60, exp: 175, credits: 600, honor: 21,
    color: "#fb923c", size: 30,
    loot: { resourceId: "dread", qty: 5 },
  },
  maron: {
    type: "maron", behavior: "tank", // 4-1, titan-tier
    hullMax: 1450, damage: 72, speed: 85, exp: 145, credits: 480, honor: 17,
    color: "#b45309", size: 28,
    loot: { resourceId: "dread", qty: 4 },
  },
  nabas: {
    type: "nabas", behavior: "ranged", // 4-2, dread-tier
    hullMax: 800, damage: 58, speed: 90, exp: 105, credits: 360, honor: 12,
    color: "#f472b6", size: 22,
    loot: { resourceId: "dread", qty: 3 },
  },
  silikum: {
    type: "silikum", behavior: "tank", // 4-3, overlord-tier
    hullMax: 2100, damage: 92, speed: 72, exp: 240, credits: 780, honor: 29,
    color: "#e2e8f0", size: 33,
    loot: { resourceId: "dread", qty: 6 },
  },
  simonit: {
    type: "simonit", behavior: "tank", // 4-4, leviathan-tier
    hullMax: 3300, damage: 115, speed: 48, exp: 380, credits: 1150, honor: 43,
    color: "#14b8a6", size: 38,
    loot: { resourceId: "dread", qty: 7 },
  },
};

// ── FACTION-SPECIFIC ENEMY MODS ──────────────────────────────────────────────

export const FACTION_ENEMY_MODS: Partial<Record<
  "earth" | "mars" | "venus",
  Partial<Record<EnemyType, { color: string; hullMul?: number; damageMul?: number; speedMul?: number }>>
>> = {
  mars: {
    scout:     { color: "#ff5500", speedMul: 1.18 },
    raider:    { color: "#ff3300", hullMul: 1.22 },
    destroyer: { color: "#cc2200", hullMul: 1.12, damageMul: 1.18 },
    voidling:  { color: "#ff6600", speedMul: 1.20 },
    dread:     { color: "#ff8800", hullMul: 1.15, damageMul: 1.10 },
    sentinel:  { color: "#ff6622", damageMul: 1.15, speedMul: 1.10 },
    wraith:    { color: "#ff4400", speedMul: 1.25, damageMul: 1.10 },
    titan:     { color: "#cc2200", hullMul: 1.20, damageMul: 1.15 },
    overlord:  { color: "#ff0000", hullMul: 1.25, damageMul: 1.20 },
  },
  venus: {
    scout:     { color: "#ffee22", damageMul: 1.22 },
    raider:    { color: "#cc44ff", hullMul: 1.22 },
    destroyer: { color: "#9911cc", hullMul: 1.12, damageMul: 1.12 },
    voidling:  { color: "#ff44cc", damageMul: 1.28, speedMul: 0.88 },
    dread:     { color: "#aa00ff", hullMul: 1.20, damageMul: 1.12 },
    sentinel:  { color: "#8844ff", damageMul: 1.20, hullMul: 1.10 },
    wraith:    { color: "#ff22cc", speedMul: 1.15, damageMul: 1.25 },
    titan:     { color: "#9900cc", hullMul: 1.15, damageMul: 1.20 },
    overlord:  { color: "#cc00ff", hullMul: 1.30, damageMul: 1.25 },
  },
};

// ── ZONES (20) ───────────────────────────────────────────────────────────────

export const ZONES: Record<ZoneId, {
  id: ZoneId;
  name: string;
  label: string;
  faction: "earth" | "mars" | "venus";
  enemyTier: number;
  enemyTypes: EnemyType[];
  unlockLevel: number;
}> = {
  // Earth Faction (1-1 to 1-5)
  alpha: {
    id: "alpha", name: "Alpha Sector", label: "1-1", faction: "earth",
    enemyTier: 1, enemyTypes: ["scout", "interceptor", "erix"], unlockLevel: 1,
  },
  nebula: {
    id: "nebula", name: "Veil Nebula", label: "1-2", faction: "earth",
    enemyTier: 2, enemyTypes: ["raider", "corvette"], unlockLevel: 8,
  },
  crimson: {
    id: "crimson", name: "Crimson Reach", label: "1-3", faction: "earth",
        enemyTier: 3, enemyTypes: ["destroyer", "specter", "voidling"], unlockLevel: 16,
  },
  void: {
    id: "void", name: "The Void", label: "1-4", faction: "earth",
        enemyTier: 4, enemyTypes: ["sentinel", "phantom", "wraith"], unlockLevel: 24,
  },
  forge: {
    id: "forge", name: "Iron Forge", label: "1-5", faction: "earth",
        enemyTier: 5, enemyTypes: ["titan", "overlord", "juggernaut"], unlockLevel: 32,
  },
  // Mars Faction (2-1 to 2-5)
  corona: {
    id: "corona", name: "Mars Frontier", label: "2-1", faction: "mars",
    enemyTier: 1, enemyTypes: ["scout", "interceptor", "erix"], unlockLevel: 1,
  },
  fracture: {
    id: "fracture", name: "Dust Expanse", label: "2-2", faction: "mars",
    enemyTier: 2, enemyTypes: ["raider", "corvette"], unlockLevel: 8,
  },
  abyss: {
    id: "abyss", name: "Red Reaches", label: "2-3", faction: "mars",
        enemyTier: 3, enemyTypes: ["destroyer", "specter", "voidling"], unlockLevel: 16,
  },
  marsdepth: {
    id: "marsdepth", name: "Mars Deep Field", label: "2-4", faction: "mars",
        enemyTier: 4, enemyTypes: ["sentinel", "phantom", "wraith"], unlockLevel: 24,
  },
  maelstrom: {
    id: "maelstrom", name: "The Maelstrom", label: "2-5", faction: "mars",
        enemyTier: 5, enemyTypes: ["titan", "overlord", "juggernaut"], unlockLevel: 32,
  },
  // Venus Faction (3-1 to 3-5)
  venus1: {
    id: "venus1", name: "Venus Cloud Gate", label: "3-1", faction: "venus",
    enemyTier: 1, enemyTypes: ["scout", "interceptor", "erix"], unlockLevel: 1,
  },
  venus2: {
    id: "venus2", name: "Sulphur Winds", label: "3-2", faction: "venus",
    enemyTier: 2, enemyTypes: ["raider", "corvette"], unlockLevel: 8,
  },
  venus3: {
    id: "venus3", name: "Acidic Deep", label: "3-3", faction: "venus",
        enemyTier: 3, enemyTypes: ["destroyer", "specter", "voidling"], unlockLevel: 16,
  },
  venus4: {
    id: "venus4", name: "Pressure Core", label: "3-4", faction: "venus",
        enemyTier: 4, enemyTypes: ["sentinel", "phantom", "wraith"], unlockLevel: 24,
  },
  venus5: {
    id: "venus5", name: "Eye of Venus", label: "3-5", faction: "venus",
        enemyTier: 5, enemyTypes: ["titan", "overlord", "juggernaut"], unlockLevel: 32,
  },
  // Danger Zones (4-1 to 4-5)
  danger1: {
    id: "danger1", name: "Outer Rift", label: "4-1", faction: "earth",
        enemyTier: 4, enemyTypes: ["nabas", "dread"], unlockLevel: 20,
  },
  danger2: {
    id: "danger2", name: "Dead Zone", label: "4-2", faction: "mars",
        enemyTier: 5, enemyTypes: ["angin", "crobium"], unlockLevel: 26,
  },
  danger3: {
    id: "danger3", name: "Pirate Haven", label: "4-3", faction: "venus",
        enemyTier: 5, enemyTypes: ["draug", "knoton"], unlockLevel: 30,
  },
  danger4: {
    id: "danger4", name: "Null Sector", label: "4-4", faction: "earth",
        enemyTier: 6, enemyTypes: ["leviathan", "silikum"], unlockLevel: 36,
  },
  danger5: {
    id: "danger5", name: "The Abyss Gate", label: "4-5", faction: "mars",
        enemyTier: 7, enemyTypes: ["maron", "simonit"], unlockLevel: 42,
  },
  debug: {
    id: "debug", name: "Debug Arena", label: "DBG", faction: "earth",
        enemyTier: 0, enemyTypes: [], unlockLevel: 1,
  },
};

// ── MODULE DEFINITIONS (~45) ─────────────────────────────────────────────────

export const MODULE_DEFS: Record<string, {
  id: string;
  slot: ModuleSlot;
  stats: ModuleStats;
  price: number;
  tier: number;
  weaponKind?: WeaponKind;
  firingPattern?: "standard" | "sniper" | "scatter" | "rail" | "mining";
}> = buildBackendCatalog();

// Server-authoritative catalog. MUST match the stat formulas in
// frontend/src/game/types.ts buildCatalog() exactly (client predicts, server
// resolves — divergent stats desync damage). Stats-only shape.
function buildBackendCatalog() {
  const out: Record<string, {
    id: string; slot: ModuleSlot; stats: ModuleStats; price: number; tier: number;
    weaponKind?: WeaponKind; firingPattern?: "standard" | "sniper" | "scatter" | "rail" | "mining";
  }> = {};
  const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
  const laserPatterns: ("standard" | "rail" | "scatter" | "sniper")[] = ["standard", "rail", "scatter", "sniper"];

  for (let t = 0; t <= 10; t++) {
    const stats: ModuleStats = { damage: round(5 + t * 4.7), fireRate: round(0.9 + t * 0.045, 2) };
    if (t >= 3) stats.critChance = round((t - 2) * 0.015, 3);
    if (t >= 4) stats.aoeRadius = round(6 + (t - 4) * 3);
    out[`wp-laser-t${t}`] = {
      id: `wp-laser-t${t}`, slot: "weapon", weaponKind: "laser",
      firingPattern: laserPatterns[t % laserPatterns.length],
      tier: t, price: t === 0 ? 0 : Math.round(3000 * 1.9 ** t), stats,
    };
  }
  for (let t = 0; t <= 5; t++) {
    const stats: ModuleStats = {
      damage: round(22 + t * 14), fireRate: round(0.55 - t * 0.04, 2), aoeRadius: round(18 + t * 6),
    };
    if (t >= 2) stats.critChance = round((t - 1) * 0.02, 3);
    out[`wp-rocket-t${t}`] = {
      id: `wp-rocket-t${t}`, slot: "weapon", weaponKind: "rocket",
      tier: t, price: t === 0 ? 0 : Math.round(18000 * 2.2 ** t), stats,
    };
  }
  // SHIELD GENERATORS 0-5 (must match frontend gn-shield-t* formulas)
  for (let t = 0; t <= 5; t++) {
    out[`gn-shield-t${t}`] = {
      id: `gn-shield-t${t}`, slot: "generator", tier: t, price: t === 0 ? 0 : Math.round(2500 * 2.6 ** t),
      stats: {
        shieldMax: round(30 + t * 95), shieldRegen: round(2 + t * 4.6),
        shieldAbsorb: round(0.05 + t * 0.05, 2),
      },
    };
  }
  // SPEED GENERATORS 0-5 (must match frontend gn-speed-t* formulas)
  for (let t = 0; t <= 5; t++) {
    out[`gn-speed-t${t}`] = {
      id: `gn-speed-t${t}`, slot: "generator", tier: t, price: t === 0 ? 0 : Math.round(2800 * 2.6 ** t),
      stats: {
        speed: round(30 + t * 36), shieldMax: round(20 + t * 40),
        shieldRegen: round(2 + t * 1.6), shieldAbsorb: round(0.04 + t * 0.02, 2),
      },
    };
  }
  // MODULES: 9 types x tier 0-4 (must match frontend modRoles stat formulas)
  const modStat: ((t: number) => ModuleStats)[] = [
    (t) => ({ speed: round(25 + t * 22) }),
    (t) => ({ hullMax: round(30 + t * 45), damageReduction: round(0.03 + t * 0.03, 3) }),
    (t) => ({ critChance: round(0.04 + t * 0.035, 3) }),
    (t) => ({ shieldMax: round(40 + t * 55), shieldRegen: round(1 + t * 2) }),
    (t) => ({ cargoBonus: round(0.15 + t * 0.15, 2) }),
    (t) => ({ lootBonus: t >= 2 ? Math.floor((t - 1) / 1.5) + 1 : 1 }),
    (t) => ({ ammoCapacity: round(8 + t * 8) }),
    (t) => ({ fireRate: round(1.05 + t * 0.06, 2), damage: round(4 + t * 4) }),
    (t) => ({ speed: round(15 + t * 12), critChance: round(0.02 + t * 0.015, 3), damageReduction: round(0.02 + t * 0.02, 3), shieldMax: round(20 + t * 30) }),
  ];
  modStat.forEach((fn, ty) => {
    for (let t = 0; t <= 4; t++) {
      out[`md${ty}-t${t}`] = {
        id: `md${ty}-t${t}`, slot: "module", tier: t, price: t === 0 ? 1500 : Math.round(3000 * 3 ** t),
        stats: fn(t),
      };
    }
  });
  const miningPrice = [2000, 15000, 50000, 120000];
  for (let t = 1; t <= 4; t++) {
    out[`wp-mining-${t}`] = {
      id: `wp-mining-${t}`, slot: "weapon", weaponKind: "laser", firingPattern: "mining",
      tier: t, price: miningPrice[t - 1],
      stats: { damage: 3 + t, fireRate: 1.0, miningBonus: t * 1.2 },
    };
  }
  return out;
}

// Legacy id -> new tier id (mirrors frontend LEGACY_ITEM_ALIAS). Old saved
// inventories / equipped slots resolve through this so nothing desyncs.
export const LEGACY_ITEM_ALIAS: Record<string, string> = {
  "wp-sniper-0": "wp-laser-t0", "wp-scatter-0": "wp-laser-t0", "wp-rail-0": "wp-laser-t1",
  "wp-pulse-1": "wp-laser-t1", "wp-pulse-2": "wp-laser-t3", "wp-pulse-3": "wp-laser-t5",
  "wp-ion": "wp-laser-t3", "wp-scatter": "wp-laser-t3", "wp-sniper-1": "wp-laser-t3",
  "wp-rail-1": "wp-laser-t3", "wp-plasma": "wp-laser-t5", "wp-phase": "wp-laser-t5",
  "wp-arc": "wp-laser-t5", "wp-sniper-2": "wp-laser-t5", "wp-scatter-2": "wp-laser-t5",
  "wp-rail-2": "wp-laser-t5", "wp-sniper": "wp-laser-t7", "wp-solar": "wp-laser-t7",
  "wp-scatter-3": "wp-laser-t7", "wp-rail-3": "wp-laser-t7",
  "wp-void-lance": "wp-laser-t9", "wp-singular": "wp-laser-t10",
  "wp-rocket-1": "wp-rocket-t1", "wp-rocket-2": "wp-rocket-t2",
  "wp-torpedo": "wp-rocket-t3", "wp-hellfire": "wp-rocket-t3",
  "gn-core-1": "gn-shield-t1", "gn-core-2": "gn-shield-t2",
  "gn-aegis": "gn-shield-t3", "gn-fortify": "gn-shield-t3", "gn-prism": "gn-shield-t3",
  "gn-quantum": "gn-shield-t4", "gn-leviathan": "gn-shield-t5",
  "gn-sprint": "gn-speed-t2", "gn-hyper": "gn-speed-t3",
  "gn-warp-drive": "gn-speed-t4", "gn-phase-drive": "gn-speed-t5",
  "gn-t1": "gn-shield-t1", "gn-t2": "gn-shield-t2", "gn-t3": "gn-shield-t3",
  "gn-t4": "gn-shield-t4", "gn-t5": "gn-shield-t5",
  "md-thrust-1": "md0-t1", "md-thrust-2": "md0-t3", "md-afterburn": "md0-t4",
  "md-plating": "md1-t2", "md-heavy-armor": "md1-t4",
  "md-targeter": "md2-t2", "md-targeter-2": "md2-t4", "md-shield-boost": "md3-t3",
  "md-cargo": "md4-t1", "md-cargo-2": "md4-t3", "md-scavenger": "md5-t2", "md-loot-2": "md5-t4",
  "md-ammo-bay": "md6-t1", "md-ammo-bay-2": "md6-t3",
  "md-overcharge": "md7-t3", "md-overclock": "md7-t4", "md-nano-rep": "md3-t1",
  "md-voidframe": "md8-t3", "md-singularity": "md8-t4",
  "md-t1": "md8-t1", "md-t2": "md8-t2", "md-t3": "md8-t3", "md-t4": "md8-t4", "md-t5": "md8-t4",
};
export function resolveItemId(id: string): string {
  if (MODULE_DEFS[id]) return id;
  return LEGACY_ITEM_ALIAS[id] ?? id;
}

// ── ROCKET AMMO TYPE DEFINITIONS ─────────────────────────────────────────────

export const ROCKET_AMMO_TYPE_DEFS: Record<RocketAmmoType, {
  id: RocketAmmoType;
  damageMul: number;
  costPerRound: number;
}> = {
  "x1": { id: "x1", damageMul: 1.0,  costPerRound: 6 },
  "x2": { id: "x2", damageMul: 1.15, costPerRound: 12 },
  "x3": { id: "x3", damageMul: 1.3,  costPerRound: 18 },
  "x4": { id: "x4", damageMul: 1.5,  costPerRound: 28 },
};

// ── ROCKET MISSILE TYPE DEFINITIONS ──────────────────────────────────────────

export const ROCKET_MISSILE_TYPE_DEFS: Record<RocketMissileType, {
  id: RocketMissileType;
  damageMul: number;
  costPerRound: number;
}> = {
  "cl1":   { id: "cl1",   damageMul: 1.0, costPerRound: 25 },
  "cl2":   { id: "cl2",   damageMul: 2.0, costPerRound: 50 },
  "bm3":   { id: "bm3",   damageMul: 3.0, costPerRound: 90 },
  "drock": { id: "drock", damageMul: 4.0, costPerRound: 160 },
};

// ── FACTIONS (3) ─────────────────────────────────────────────────────────────

export const FACTIONS: Record<FactionId, {
  id: FactionId;
  color: string;
  bonus: { damage?: number; speed?: number; shieldRegen?: number; tradeDiscount?: number; lootBonus?: number };
  startZone: ZoneId;
}> = {
  earth: {
    id: "earth",
    color: "#4ea8ff",
    bonus: { shieldRegen: 1.5, tradeDiscount: 0.05 },
    startZone: "alpha",
  },
  mars: {
    id: "mars",
    color: "#ff8a4e",
    bonus: { damage: 0.10, lootBonus: 1 },
    startZone: "corona",
  },
  venus: {
    id: "venus",
    color: "#5cff8a",
    bonus: { speed: 0.10, tradeDiscount: 0.10 },
    startZone: "venus1",
  },
};

// ── SKILL NODES (26 + 4 engineering = 30) ────────────────────────────────────

export const SKILL_NODES: {
  id: SkillId;
  branch: SkillBranch;
  maxRank: number;
  cost: number;
  requires?: SkillId;
}[] = [
  // Offense
  { id: "off-power",   branch: "offense",  maxRank: 5, cost: 1 },
  { id: "off-snipe",   branch: "offense",  maxRank: 5, cost: 1, requires: "off-power" },
  { id: "off-void",    branch: "offense",  maxRank: 3, cost: 2, requires: "off-snipe" },
  { id: "off-rapid",   branch: "offense",  maxRank: 5, cost: 1, requires: "off-power" },
  { id: "off-volley",  branch: "offense",  maxRank: 3, cost: 1, requires: "off-rapid" },
  { id: "off-crit",    branch: "offense",  maxRank: 5, cost: 1, requires: "off-rapid" },
  { id: "off-execute", branch: "offense",  maxRank: 3, cost: 2, requires: "off-crit" },
  { id: "off-pierce",  branch: "offense",  maxRank: 3, cost: 2, requires: "off-crit" },

  // Defense
  { id: "def-shield",  branch: "defense",  maxRank: 5, cost: 1 },
  { id: "def-barrier", branch: "defense",  maxRank: 3, cost: 1, requires: "def-shield" },
  { id: "def-fortress",branch: "defense",  maxRank: 3, cost: 2, requires: "def-barrier" },
  { id: "def-regen",   branch: "defense",  maxRank: 5, cost: 1, requires: "def-shield" },
  { id: "def-nano",    branch: "defense",  maxRank: 3, cost: 2, requires: "def-regen" },
  { id: "def-armor",   branch: "defense",  maxRank: 5, cost: 1, requires: "def-regen" },
  { id: "def-reflect", branch: "defense",  maxRank: 3, cost: 2, requires: "def-armor" },
  { id: "def-bulwark", branch: "defense",  maxRank: 3, cost: 2, requires: "def-armor" },

  // Utility
  { id: "ut-cargo",    branch: "utility",  maxRank: 5, cost: 1 },
  { id: "ut-trade",    branch: "utility",  maxRank: 3, cost: 1, requires: "ut-cargo" },
  { id: "ut-scan",     branch: "utility",  maxRank: 3, cost: 2, requires: "ut-trade" },
  { id: "ut-thrust",   branch: "utility",  maxRank: 5, cost: 1, requires: "ut-cargo" },
  { id: "ut-warp",     branch: "utility",  maxRank: 3, cost: 1, requires: "ut-thrust" },
  { id: "ut-salvage",  branch: "utility",  maxRank: 5, cost: 1, requires: "ut-thrust" },
  { id: "ut-drone2",   branch: "utility",  maxRank: 3, cost: 2, requires: "ut-salvage" },
  { id: "ut-droneops", branch: "utility",  maxRank: 3, cost: 2, requires: "ut-salvage" },

  // Engineering
  { id: "eng-coolant",     branch: "engineering", maxRank: 5, cost: 1 },
  { id: "eng-capacitor",   branch: "engineering", maxRank: 5, cost: 1, requires: "eng-coolant" },
  { id: "eng-targeting",   branch: "engineering", maxRank: 3, cost: 1, requires: "eng-capacitor" },
  { id: "eng-warp-core",   branch: "engineering", maxRank: 3, cost: 2, requires: "eng-targeting" },
  { id: "eng-overdrive",   branch: "engineering", maxRank: 3, cost: 2, requires: "eng-warp-core" },
  { id: "eng-singularity", branch: "engineering", maxRank: 1, cost: 3, requires: "eng-overdrive" },

  // Offense (expansion)
  { id: "off-caliber",    branch: "offense",  maxRank: 5, cost: 1, requires: "off-power" },
  { id: "off-steady",     branch: "offense",  maxRank: 5, cost: 1, requires: "off-caliber" },
  { id: "off-weakpoint",  branch: "offense",  maxRank: 5, cost: 1, requires: "off-steady" },
  { id: "off-firstblood", branch: "offense",  maxRank: 3, cost: 2, requires: "off-weakpoint" },
  { id: "off-coldbore",   branch: "offense",  maxRank: 3, cost: 2, requires: "off-firstblood" },
  { id: "off-headhunter", branch: "offense",  maxRank: 1, cost: 3, requires: "off-coldbore" },
  { id: "off-sustain",    branch: "offense",  maxRank: 5, cost: 1, requires: "off-rapid" },
  { id: "off-cadence",    branch: "offense",  maxRank: 3, cost: 2, requires: "off-sustain" },
  { id: "off-attrition",  branch: "offense",  maxRank: 3, cost: 2, requires: "off-cadence" },
  { id: "off-barrage",    branch: "offense",  maxRank: 1, cost: 3, requires: "off-attrition" },
  { id: "off-splash",     branch: "offense",  maxRank: 5, cost: 1, requires: "off-pierce" },
  { id: "off-shrapnel",   branch: "offense",  maxRank: 3, cost: 2, requires: "off-splash" },
  { id: "off-chain",      branch: "offense",  maxRank: 3, cost: 2, requires: "off-shrapnel" },
  { id: "off-saturation", branch: "offense",  maxRank: 1, cost: 3, requires: "off-chain" },
  { id: "off-render",     branch: "offense",  maxRank: 3, cost: 2, requires: "off-execute" },
  { id: "off-apex",       branch: "offense",  maxRank: 1, cost: 3, requires: "off-render" },

  // Defense (expansion)
  { id: "def-lattice",    branch: "defense",  maxRank: 5, cost: 1, requires: "def-shield" },
  { id: "def-diffuse",    branch: "defense",  maxRank: 5, cost: 1, requires: "def-lattice" },
  { id: "def-overshield", branch: "defense",  maxRank: 3, cost: 2, requires: "def-diffuse" },
  { id: "def-aegis",      branch: "defense",  maxRank: 1, cost: 3, requires: "def-overshield" },
  { id: "def-coolant",    branch: "defense",  maxRank: 5, cost: 1, requires: "def-regen" },
  { id: "def-triage",     branch: "defense",  maxRank: 3, cost: 2, requires: "def-coolant" },
  { id: "def-secondwind", branch: "defense",  maxRank: 3, cost: 2, requires: "def-triage" },
  { id: "def-phoenix",    branch: "defense",  maxRank: 1, cost: 3, requires: "def-secondwind" },
  { id: "def-ablative",   branch: "defense",  maxRank: 5, cost: 1, requires: "def-armor" },
  { id: "def-hardened",   branch: "defense",  maxRank: 5, cost: 1, requires: "def-ablative" },
  { id: "def-lastditch",  branch: "defense",  maxRank: 3, cost: 2, requires: "def-hardened" },
  { id: "def-immovable",  branch: "defense",  maxRank: 1, cost: 3, requires: "def-lastditch" },
  { id: "def-spines",     branch: "defense",  maxRank: 3, cost: 2, requires: "def-reflect" },
  { id: "def-backlash",   branch: "defense",  maxRank: 3, cost: 2, requires: "def-spines" },
  { id: "def-nemesis",    branch: "defense",  maxRank: 1, cost: 3, requires: "def-backlash" },

  // Utility (expansion)
  { id: "ut-hold",        branch: "utility",  maxRank: 5, cost: 1, requires: "ut-cargo" },
  { id: "ut-broker",      branch: "utility",  maxRank: 5, cost: 1, requires: "ut-trade" },
  { id: "ut-contraband",  branch: "utility",  maxRank: 3, cost: 2, requires: "ut-broker" },
  { id: "ut-magnate",     branch: "utility",  maxRank: 1, cost: 3, requires: "ut-contraband" },
  { id: "ut-vector",      branch: "utility",  maxRank: 5, cost: 1, requires: "ut-thrust" },
  { id: "ut-slipstream",  branch: "utility",  maxRank: 3, cost: 2, requires: "ut-vector" },
  { id: "ut-evasion",     branch: "utility",  maxRank: 3, cost: 2, requires: "ut-slipstream" },
  { id: "ut-phaserunner", branch: "utility",  maxRank: 1, cost: 3, requires: "ut-evasion" },
  { id: "ut-swarm",       branch: "utility",  maxRank: 5, cost: 1, requires: "ut-drone2" },
  { id: "ut-repairbay",   branch: "utility",  maxRank: 3, cost: 2, requires: "ut-swarm" },
  { id: "ut-hivemind",    branch: "utility",  maxRank: 1, cost: 3, requires: "ut-repairbay" },
  { id: "ut-survey",      branch: "utility",  maxRank: 5, cost: 1, requires: "ut-scan" },
  { id: "ut-refinery",    branch: "utility",  maxRank: 5, cost: 1, requires: "ut-survey" },
  { id: "ut-assay",       branch: "utility",  maxRank: 3, cost: 2, requires: "ut-refinery" },
  { id: "ut-prospector",  branch: "utility",  maxRank: 1, cost: 3, requires: "ut-assay" },

  // Engineering (expansion)
  { id: "eng-plasma",       branch: "engineering", maxRank: 5, cost: 1, requires: "eng-capacitor" },
  { id: "eng-fusion",       branch: "engineering", maxRank: 5, cost: 1, requires: "eng-plasma" },
  { id: "eng-surge",        branch: "engineering", maxRank: 3, cost: 2, requires: "eng-fusion" },
  { id: "eng-meltdown",     branch: "engineering", maxRank: 1, cost: 3, requires: "eng-surge" },
  { id: "eng-radiator",     branch: "engineering", maxRank: 5, cost: 1, requires: "eng-coolant" },
  { id: "eng-cryoflow",     branch: "engineering", maxRank: 5, cost: 1, requires: "eng-radiator" },
  { id: "eng-heatsink",     branch: "engineering", maxRank: 3, cost: 2, requires: "eng-cryoflow" },
  { id: "eng-runaway",      branch: "engineering", maxRank: 1, cost: 3, requires: "eng-heatsink" },
  { id: "eng-regulator",    branch: "engineering", maxRank: 5, cost: 1, requires: "eng-capacitor" },
  { id: "eng-harmonics",    branch: "engineering", maxRank: 5, cost: 1, requires: "eng-regulator" },
  { id: "eng-transfer",     branch: "engineering", maxRank: 3, cost: 2, requires: "eng-harmonics" },
  { id: "eng-resonance",    branch: "engineering", maxRank: 3, cost: 2, requires: "eng-transfer" },
  { id: "eng-equilibrium",  branch: "engineering", maxRank: 1, cost: 3, requires: "eng-resonance" },
  { id: "eng-recursion",    branch: "engineering", maxRank: 3, cost: 2, requires: "eng-overdrive" },
  { id: "eng-eventhorizon", branch: "engineering", maxRank: 1, cost: 3, requires: "eng-singularity" },
  { id: "eng-zeropoint",    branch: "engineering", maxRank: 1, cost: 3, requires: "eng-eventhorizon" },
];

// ── DRONE DEFINITIONS (5) ────────────────────────────────────────────────────

export const DRONE_DEFS: Record<DroneKind, {
  id: DroneKind;
  price: number;
  damageBonus: number;
  shieldBonus: number;
  hullBonus: number;
  fireRate: number;
}> = {
  "combat-i":  { id: "combat-i",  price: 50000,  damageBonus: 6,  shieldBonus: 0,   hullBonus: 0,  fireRate: 0.7 },
  "combat-ii": { id: "combat-ii", price: 180000, damageBonus: 14, shieldBonus: 0,   hullBonus: 0,  fireRate: 1.1 },
  "shield-i":  { id: "shield-i",  price: 75000,  damageBonus: 0,  shieldBonus: 60,  hullBonus: 20, fireRate: 0 },
  "shield-ii": { id: "shield-ii", price: 250000, damageBonus: 0,  shieldBonus: 140, hullBonus: 40, fireRate: 0 },
  "salvage":   { id: "salvage",   price: 120000, damageBonus: 2,  shieldBonus: 30,  hullBonus: 30, fireRate: 0.4 },
};

// ── CONSUMABLE DEFINITIONS (6) ───────────────────────────────────────────────

export const CONSUMABLE_DEFS: Record<ConsumableId, {
  id: ConsumableId;
  price: number;
  cooldown: number;
  stackMax: number;
}> = {
  "rocket-ammo":       { id: "rocket-ammo",       price: 400, cooldown: 0,  stackMax: 20 },
  "repair-bot":        { id: "repair-bot",        price: 350, cooldown: 15, stackMax: 10 },
  "combat-drone-pod":  { id: "combat-drone-pod",  price: 600, cooldown: 30, stackMax: 5 },
  "shield-charge":     { id: "shield-charge",     price: 280, cooldown: 20, stackMax: 10 },
  "emp-burst":         { id: "emp-burst",         price: 500, cooldown: 0,  stackMax: 8 },
  "afterburn-fuel":    { id: "afterburn-fuel",    price: 250, cooldown: 0,  stackMax: 12 },
};

// ── STATIONS ─────────────────────────────────────────────────────────────────

export const STATIONS: {
  id: string;
  name: string;
  pos: Vec2;
  zone: ZoneId;
  kind: StationKind;
  prices: Partial<Record<ResourceId, number>>;
  controlledBy: FactionId;
}[] = [
] = [
  // alpha
  { id: "helix", name: "Helix Station", pos: { x: 0, y: 0 }, zone: "alpha", kind: "hub",
    controlledBy: "earth",
    prices: { scrap: 1.0, plasma: 1.0, iron: 0.95, synth: 0.9, medpack: 1.1, lumenite: 1.0, food: 0.8, "fuel-cell": 0.9, "refined-alloy": 1.4, "plasma-cell": 1.3, "nano-compound": 1.2} },
  { id: "iron-belt", name: "Iron Belt Refinery", pos: { x: -4500, y: -2800 }, zone: "alpha", kind: "mining",
    controlledBy: "earth",
    prices: { iron: 0.6, lumenite: 0.7, scrap: 1.2, synth: 1.0, medpack: 1.1, plasma: 1.05,
              food: 0.6, "fuel-cell": 0.7, medicine: 1.2, ore: 0.65, "star-map": 1.25 } },
  // nebula
  { id: "veiled", name: "Veiled Outpost", pos: { x: 3200, y: -4800 }, zone: "nebula", kind: "outpost",
    controlledBy: "earth",
    prices: { plasma: 0.7, warp: 0.85, scrap: 1.2, synth: 1.15, medpack: 1.2, void: 1.3,
              food: 1.3, medicine: 1.4, nanite: 0.8, "bio-matter": 0.7, luxury: 1.6, silk: 0.75, artifacts: 1.2, "crystal-matrix": 1.5, "fusion-core": 1.4, "void-steel": 1.3} },
  { id: "azure-port", name: "Azure Trade Port", pos: { x: -4200, y: -5200 }, zone: "nebula", kind: "trade",
    controlledBy: "earth",
    prices: { quantum: 0.7, lumenite: 0.85, dread: 0.9, void: 0.95, plasma: 1.2, warp: 1.25, iron: 1.15, scrap: 1.25,
              luxury: 0.7, precursor: 1.5, relic: 1.6, food: 1.5, medicine: 1.3, nanite: 1.4, blackglass: 0.8, "data-core": 0.9 } },
  // crimson
  { id: "ember", name: "Ember Citadel", pos: { x: -3800, y: 2400 }, zone: "crimson", kind: "military",
    controlledBy: "earth",
    prices: { dread: 1.3, warp: 1.3, plasma: 1.4, medpack: 0.85, synth: 0.95, quantum: 1.2,
              food: 1.6, medicine: 0.7, "fuel-cell": 1.5, contraband: 0.6, blackglass: 0.7, "fusion-lattice": 0.9, "refined-alloy": 1.3, "nano-compound": 1.5, "plasma-cell": 1.2} },
  { id: "scarlet-yard", name: "Scarlet Shipyards", pos: { x: 4800, y: 3600 }, zone: "crimson", kind: "trade",
    controlledBy: "earth",
    prices: { iron: 1.4, scrap: 1.35, lumenite: 1.2, plasma: 1.1, dread: 0.85,
              nanite: 1.5, "fuel-cell": 1.3, food: 1.5, luxury: 1.7, ore: 1.15, "fusion-lattice": 1.05 } },
  // void
  { id: "echo", name: "Echo Anchorage", pos: { x: 800, y: -3200 }, zone: "void", kind: "outpost",
    controlledBy: "earth",
    prices: { void: 0.6, dread: 1.2, quantum: 1.4, medpack: 1.3, synth: 1.2,
              contraband: 0.5, relic: 0.7, exotic: 0.8, food: 1.8, medicine: 1.6, "medical-serum": 0.85, "cloning-gel": 0.75, "void-steel": 1.6, "crystal-matrix": 1.3, "fusion-core": 1.2} },
  { id: "obsidian-port", name: "Obsidian Free Port", pos: { x: 4600, y: 3800 }, zone: "void", kind: "trade",
    controlledBy: "earth",
    prices: { quantum: 0.55, void: 1.4, dread: 1.4, lumenite: 1.3, warp: 1.2,
              contraband: 0.4, luxury: 0.6, relic: 0.65, precursor: 0.7, food: 1.9, exotic: 1.5, artifacts: 0.7, "data-core": 0.75 } },
  // forge
  { id: "ironclad", name: "Ironclad Bastion", pos: { x: 0, y: 0 }, zone: "forge", kind: "military",
    controlledBy: "earth",
    prices: { dread: 1.5, warp: 1.4, plasma: 1.6, iron: 0.7, scrap: 0.8, "refined-alloy": 1.5, "plasma-cell": 1.4, "fusion-core": 1.3} },
  { id: "forge-gate", name: "Forge Gate Depot", pos: { x: -4200, y: 4400 }, zone: "forge", kind: "trade",
    controlledBy: "earth",
    prices: { iron: 0.5, scrap: 0.6, lumenite: 0.75, quantum: 0.9, dread: 1.2, void: 1.3, blackglass: 0.6, ore: 0.55 } },
  // corona
  { id: "solar-haven", name: "Solar Haven", pos: { x: 3200, y: -4200 }, zone: "corona", kind: "outpost",
    controlledBy: "mars",
    prices: { lumenite: 0.5, plasma: 0.6, warp: 0.8, void: 1.2, dread: 1.3, quantum: 1.0, "star-map": 0.7, "fusion-lattice": 0.75, "crystal-matrix": 1.4, "void-steel": 1.5, "nano-compound": 1.3} },
  { id: "corona-mkt", name: "Corona Market", pos: { x: 5000, y: 3800 }, zone: "corona", kind: "trade",
    controlledBy: "mars",
    prices: { quantum: 0.6, void: 0.7, dread: 1.1, plasma: 1.3, lumenite: 1.2, iron: 1.5, artifacts: 0.8, relic: 0.9 } },
  // fracture
  { id: "rift-base", name: "Rift Base Omega", pos: { x: -3800, y: 3200 }, zone: "fracture", kind: "military",
    controlledBy: "mars",
    prices: { dread: 2.0, warp: 1.8, plasma: 2.0, medpack: 0.7, quantum: 1.5, void: 1.6, blackglass: 0.55, precursor: 1.2, "void-steel": 1.8, "fusion-core": 1.6, "crystal-matrix": 1.4} },
  { id: "null-post", name: "Null-Point Station", pos: { x: 4200, y: -4800 }, zone: "fracture", kind: "outpost",
    controlledBy: "mars",
    prices: { void: 0.5, quantum: 0.7, dread: 1.4, lumenite: 1.5, synth: 1.3, "data-core": 0.8, "medical-serum": 0.9 } },
  // abyss
  { id: "void-heart", name: "Void Heart Station", pos: { x: 0, y: 0 }, zone: "abyss", kind: "outpost",
    controlledBy: "mars",
    prices: { void: 0.4, dread: 0.8, quantum: 0.5, lumenite: 1.8, plasma: 2.5, warp: 2.0, "void-steel": 2.0, "fusion-core": 1.8, "refined-alloy": 1.5} },
  { id: "abyss-anchor", name: "Abyss Anchorage", pos: { x: -5200, y: 4200 }, zone: "abyss", kind: "trade",
    controlledBy: "mars",
    prices: { quantum: 0.4, void: 1.8, dread: 2.2, iron: 2.0, synth: 1.8, medpack: 0.5 } },
  // marsdepth
  { id: "deep-haven", name: "Deep Field Haven", pos: { x: 0, y: 0 }, zone: "marsdepth", kind: "outpost",
    controlledBy: "mars",
    prices: { void: 0.55, dread: 1.2, quantum: 1.4, medpack: 1.3, synth: 1.2, contraband: 0.5, relic: 0.7, exotic: 0.8 } },
  { id: "iron-depth", name: "Iron Depth Exchange", pos: { x: 4600, y: -4200 }, zone: "marsdepth", kind: "trade",
    controlledBy: "mars",
    prices: { dread: 1.8, warp: 1.7, plasma: 1.9, medpack: 0.75, quantum: 1.5, void: 1.4, lumenite: 1.2 } },
  // maelstrom
  { id: "storm-eye", name: "Eye of the Storm", pos: { x: 0, y: 0 }, zone: "maelstrom", kind: "military",
    controlledBy: "mars",
    prices: { dread: 2.2, warp: 2.0, plasma: 2.3, iron: 0.65, scrap: 0.7, lumenite: 1.1, quantum: 1.6, "refined-alloy": 1.6, "plasma-cell": 1.5, "fusion-core": 1.4} },
  { id: "wreck-point", name: "Wreckage Point", pos: { x: -4800, y: 4200 }, zone: "maelstrom", kind: "trade",
    controlledBy: "mars",
    prices: { iron: 0.45, scrap: 0.5, lumenite: 0.7, quantum: 0.85, void: 1.5, dread: 1.9, exotic: 0.7 } },
  // venus1
  { id: "cloud-gate", name: "Cloud Gate Station", pos: { x: 0, y: 0 }, zone: "venus1", kind: "hub",
    controlledBy: "venus",
    prices: { scrap: 1.0, plasma: 1.0, iron: 0.95, synth: 0.9, medpack: 1.1, lumenite: 1.0, warp: 1.1, void: 1.2, dread: 1.1, food: 0.75, medicine: 0.85, luxury: 1.3, "refined-alloy": 1.3, "nano-compound": 1.4, "plasma-cell": 1.2} },
  { id: "mist-dock", name: "Mist Dock Outpost", pos: { x: -4400, y: -2800 }, zone: "venus1", kind: "mining",
    controlledBy: "venus",
    prices: { iron: 0.6, lumenite: 0.65, scrap: 1.2, synth: 1.0, medpack: 1.1, "fuel-cell": 0.7, food: 0.65, medicine: 1.1 } },
  { id: "halo-walk", name: "Halo Walk Station", pos: { x: 4200, y: 3400 }, zone: "venus1", kind: "trade",
    controlledBy: "venus",
    prices: { food: 0.7, medicine: 0.9, luxury: 1.1, scrap: 1.1, plasma: 1.05, lumenite: 0.9, synth: 1.0 } },
  // venus2
  { id: "sulphur-port", name: "Sulphur Port", pos: { x: 2800, y: -4800 }, zone: "venus2", kind: "outpost",
    controlledBy: "venus",
    prices: { plasma: 0.75, warp: 0.9, scrap: 1.2, synth: 1.1, medpack: 1.2, void: 1.3, food: 1.3, medicine: 1.4, nanite: 0.85, "bio-matter": 0.75 } },
  { id: "wind-market", name: "Wind Market", pos: { x: -4600, y: -5200 }, zone: "venus2", kind: "trade",
    controlledBy: "venus",
    prices: { quantum: 0.65, lumenite: 0.8, dread: 0.95, void: 0.9, plasma: 1.2, warp: 1.3, iron: 1.1, luxury: 0.75, precursor: 1.4 } },
  { id: "brass-spire", name: "Brass Spire", pos: { x: 5400, y: -2000 }, zone: "venus2", kind: "outpost",
    controlledBy: "venus",
    prices: { plasma: 0.85, warp: 0.95, food: 1.2, medicine: 1.25, nanite: 0.9, luxury: 1.0, "fuel-cell": 0.8 } },
  // venus3
  { id: "acid-citadel", name: "Acid Citadel", pos: { x: -3800, y: 3200 }, zone: "venus3", kind: "military",
    controlledBy: "venus",
    prices: { dread: 1.4, warp: 1.3, plasma: 1.5, medpack: 0.8, synth: 0.9, quantum: 1.2, "fuel-cell": 1.4, contraband: 0.65 } },
  { id: "pressure-yard", name: "Pressure Yards", pos: { x: 4800, y: 3800 }, zone: "venus3", kind: "trade",
    controlledBy: "venus",
    prices: { iron: 1.4, scrap: 1.3, lumenite: 1.2, plasma: 1.1, dread: 0.9, nanite: 1.5, "fuel-cell": 1.2, luxury: 1.6 } },
  { id: "acid-exchange", name: "Acid Exchange", pos: { x: -5400, y: -4200 }, zone: "venus3", kind: "mining",
    controlledBy: "venus",
    prices: { iron: 0.55, scrap: 0.65, lumenite: 0.8, plasma: 1.0, synth: 1.1, food: 1.3, medicine: 1.2 } },
  // venus4
  { id: "core-refuge", name: "Core Refuge", pos: { x: 800, y: -3200 }, zone: "venus4", kind: "outpost",
    controlledBy: "venus",
    prices: { void: 0.6, dread: 1.2, quantum: 1.4, medpack: 1.3, synth: 1.2, contraband: 0.5, relic: 0.7, exotic: 0.8, food: 1.8 } },
  { id: "pressure-port", name: "Pressure Point Port", pos: { x: 4600, y: 3800 }, zone: "venus4", kind: "trade",
    controlledBy: "venus",
    prices: { quantum: 0.5, void: 1.4, dread: 1.5, lumenite: 1.3, warp: 1.2, contraband: 0.4, luxury: 0.6, relic: 0.65, precursor: 0.7, exotic: 1.4 } },
  { id: "cradle", name: "Cradle Station", pos: { x: -5200, y: 2400 }, zone: "venus4", kind: "outpost",
    controlledBy: "venus",
    prices: { food: 1.6, medicine: 1.4, medpack: 1.1, synth: 1.0, quantum: 0.9, relic: 0.8, exotic: 0.9 } },
  // venus5
  { id: "venus-bastion", name: "Venusian Bastion", pos: { x: 0, y: 0 }, zone: "venus5", kind: "military",
    controlledBy: "venus",
    prices: { dread: 2.0, warp: 1.9, plasma: 2.2, iron: 0.68, scrap: 0.75, lumenite: 1.1, quantum: 1.5, "void-steel": 1.7, "crystal-matrix": 1.5, "fusion-core": 1.6} },
  { id: "eye-bazaar", name: "Eye Bazaar", pos: { x: -4600, y: 4400 }, zone: "venus5", kind: "trade",
    controlledBy: "venus",
    prices: { iron: 0.5, scrap: 0.55, lumenite: 0.7, quantum: 0.8, void: 1.5, dread: 2.0, exotic: 0.65, relic: 0.7 } },
  { id: "singularity-dock", name: "Singularity Dock", pos: { x: 5400, y: -3600 }, zone: "venus5", kind: "military",
    controlledBy: "venus",
    prices: { dread: 1.5, warp: 1.6, plasma: 1.8, quantum: 1.0, relic: 0.95, exotic: 0.9, lumenite: 1.1 } },
  // Extra trading posts
  { id: "alpha-bazaar", name: "Alpha Bazaar", pos: { x: 5200, y: -3800 }, zone: "alpha", kind: "trade",
    controlledBy: "earth",
    prices: { scrap: 1.3, iron: 1.2, plasma: 0.8, food: 0.6, medicine: 0.7, titanium: 0.8, "cryo-fluid": 1.1, luxury: 1.5, spice: 0.7, "plasma-coil": 0.75 } },
  { id: "nebula-exchange", name: "Nebula Exchange", pos: { x: 5400, y: 4200 }, zone: "nebula", kind: "trade",
    controlledBy: "earth",
    prices: { quantum: 0.75, void: 0.8, warp: 1.2, contraband: 0.5, "neural-chip": 0.7, "dark-matter": 1.3, "bio-crystal": 0.8, exotic: 1.4 } },
  { id: "crimson-market", name: "Crimson Market", pos: { x: -5400, y: 5000 }, zone: "crimson", kind: "trade",
    controlledBy: "earth",
    prices: { dread: 0.8, plasma: 1.3, iron: 1.4, "fuel-cell": 1.3, titanium: 0.7, "plasma-coil": 0.6, contraband: 0.5, "neural-chip": 1.2 } },
  { id: "void-trade", name: "Void Trade Nexus", pos: { x: -5200, y: -4800 }, zone: "void", kind: "trade",
    controlledBy: "earth",
    prices: { void: 0.5, quantum: 0.6, dread: 1.3, "dark-matter": 0.6, "bio-crystal": 0.7, relic: 0.7, exotic: 1.2, blackglass: 0.65 } },
  { id: "forge-market", name: "Forge Market", pos: { x: 5400, y: -3800 }, zone: "forge", kind: "trade",
    controlledBy: "earth",
    prices: { iron: 0.4, scrap: 0.5, titanium: 0.55, "plasma-coil": 0.5, lumenite: 0.7, "cryo-fluid": 0.8, dread: 1.4, void: 1.5 } },
  { id: "corona-exchange", name: "Corona Exchange", pos: { x: -5000, y: -4600 }, zone: "corona", kind: "trade",
    controlledBy: "mars",
    prices: { lumenite: 0.4, "cryo-fluid": 0.5, plasma: 0.6, "plasma-coil": 0.55, quantum: 1.1, dread: 1.3, "dark-matter": 1.4 } },
  { id: "fracture-bazaar", name: "Fracture Bazaar", pos: { x: 5200, y: 3800 }, zone: "fracture", kind: "trade",
    controlledBy: "mars",
    prices: { void: 0.4, "dark-matter": 0.5, "neural-chip": 0.6, quantum: 0.65, dread: 1.6, lumenite: 1.5, "bio-crystal": 0.55, relic: 0.6 } },
  { id: "abyss-exchange", name: "Abyss Exchange", pos: { x: 5400, y: -4600 }, zone: "abyss", kind: "trade",
    controlledBy: "mars",
    prices: { quantum: 0.35, void: 1.6, dread: 2.0, "dark-matter": 0.4, exotic: 0.5, precursor: 0.5, relic: 0.55, "neural-chip": 0.5 } },
  { id: "mars-trade", name: "Martian Trade Hub", pos: { x: -5400, y: -4200 }, zone: "marsdepth", kind: "trade",
    controlledBy: "mars",
    prices: { iron: 0.5, titanium: 0.6, "plasma-coil": 0.55, dread: 1.6, warp: 1.5, "cryo-fluid": 0.7, contraband: 0.4, "fusion-lattice": 0.8 } },
  { id: "storm-bazaar", name: "Storm Bazaar", pos: { x: 5600, y: -3200 }, zone: "maelstrom", kind: "trade",
    controlledBy: "mars",
    prices: { iron: 0.4, scrap: 0.45, titanium: 0.5, lumenite: 0.6, quantum: 0.8, void: 1.4, dread: 1.8, exotic: 0.6, "dark-matter": 0.7 } },
  { id: "venus2-trade", name: "Sulphur Exchange", pos: { x: 5400, y: 4200 }, zone: "venus2", kind: "trade",
    controlledBy: "venus",
    prices: { "bio-matter": 0.6, nanite: 0.7, "bio-crystal": 0.65, food: 1.4, medicine: 1.3, luxury: 0.8, "cryo-fluid": 0.75, "neural-chip": 1.1 } },
  { id: "venus3-trade", name: "Deep Acid Market", pos: { x: -5600, y: -5200 }, zone: "venus3", kind: "trade",
    controlledBy: "venus",
    prices: { titanium: 0.6, "plasma-coil": 0.55, iron: 1.3, dread: 0.85, contraband: 0.5, "dark-matter": 1.2, blackglass: 0.6, "fusion-lattice": 0.9 } },
  { id: "venus4-trade", name: "Core Trade Post", pos: { x: -5400, y: -4000 }, zone: "venus4", kind: "trade",
    controlledBy: "venus",
    prices: { quantum: 0.45, void: 1.5, dread: 1.6, "dark-matter": 0.55, exotic: 1.3, relic: 0.6, "neural-chip": 0.55, "bio-crystal": 0.6 } },
  { id: "venus5-trade", name: "Eye Trade Ring", pos: { x: 5600, y: 3800 }, zone: "venus5", kind: "trade",
    controlledBy: "venus",
    prices: { quantum: 0.4, void: 1.6, dread: 2.1, exotic: 0.55, precursor: 0.45, "dark-matter": 0.5, "neural-chip": 0.5, blackglass: 0.55 } },
  { id: "danger1-trade", name: "Rift Market", pos: { x: 5200, y: -4600 }, zone: "danger1", kind: "trade",
    controlledBy: "earth",
    prices: { contraband: 0.3, dread: 2.0, void: 1.8, exotic: 0.5, "dark-matter": 0.4, "neural-chip": 0.45, relic: 0.45, precursor: 0.5 } },
  { id: "danger2-trade", name: "Dead Zone Bazaar", pos: { x: 5400, y: 3800 }, zone: "danger2", kind: "trade",
    controlledBy: "venus",
    prices: { contraband: 0.25, exotic: 0.4, "dark-matter": 0.35, relic: 0.4, precursor: 0.45, dread: 2.4, void: 2.2, quantum: 1.8 } },
  { id: "danger3-trade", name: "Pirate Freeport", pos: { x: -5200, y: 4200 }, zone: "danger3", kind: "trade",
    controlledBy: "venus",
    prices: { contraband: 0.15, luxury: 0.3, exotic: 0.45, "dark-matter": 0.4, dread: 2.8, void: 2.5, quantum: 2.0, blackglass: 0.4 } },
  { id: "danger4-trade", name: "Null Zone Exchange", pos: { x: 5000, y: -4200 }, zone: "danger4", kind: "trade",
    controlledBy: "earth",
    prices: { "dark-matter": 0.3, precursor: 0.35, exotic: 0.35, relic: 0.35, dread: 2.8, void: 2.8, quantum: 2.2, "neural-chip": 0.4 } },
  { id: "danger5-trade", name: "Abyss Gate Bazaar", pos: { x: 4800, y: 4400 }, zone: "danger5", kind: "trade",
    controlledBy: "mars",
    prices: { "dark-matter": 0.2, precursor: 0.25, exotic: 0.25, relic: 0.25, "neural-chip": 0.3, dread: 3.5, void: 3.5, quantum: 3.0 } },
  // Danger zone stations
  { id: "rift-outpost", name: "Rift Outpost", pos: { x: 0, y: 0 }, zone: "danger1", kind: "outpost",
    controlledBy: "earth",
    prices: { dread: 1.8, void: 1.5, quantum: 1.3, scrap: 0.5, iron: 0.6, contraband: 0.4, exotic: 0.7 } },
  { id: "dead-market", name: "Dead Zone Market", pos: { x: -3600, y: 4200 }, zone: "danger2", kind: "trade",
    controlledBy: "mars",
    prices: { dread: 2.2, void: 2.0, quantum: 0.4, contraband: 0.3, relic: 0.5, exotic: 0.5, precursor: 0.6, luxury: 0.4 } },
  { id: "pirate-dock", name: "Pirate Stronghold", pos: { x: 2800, y: -3200 }, zone: "danger3", kind: "outpost",
    controlledBy: "venus",
    prices: { contraband: 0.2, relic: 0.6, exotic: 0.6, dread: 2.5, void: 2.2, quantum: 1.8, luxury: 0.3 } },
  { id: "null-station", name: "Null Station", pos: { x: 800, y: 3600 }, zone: "danger4", kind: "military",
    controlledBy: "earth",
    prices: { dread: 2.5, void: 2.5, quantum: 2.0, precursor: 0.4, relic: 0.4, exotic: 0.4, "star-map": 0.3 } },
  { id: "abyss-gate", name: "Abyss Gate Station", pos: { x: -2400, y: -2800 }, zone: "danger5", kind: "trade",
    controlledBy: "mars",
    prices: { dread: 3.0, void: 3.0, quantum: 2.5, precursor: 0.3, relic: 0.3, exotic: 0.3, "fusion-lattice": 0.2, "star-map": 0.2 } },

  // Factory stations
  { id: "alpha-foundry",    name: "Alpha Foundry",       pos: { x: -2800, y: 1800 },  zone: "alpha",    kind: "factory",
    controlledBy: "earth",
    prices: { iron: 0.7, copper: 0.75, "refined-alloy": 0.9, scrap: 0.8 } },
  { id: "nebula-works",     name: "Nebula Works",        pos: { x: 1200, y: 3200 },   zone: "nebula",   kind: "factory",
    controlledBy: "earth",
    prices: { cobalt: 0.7, "crystal-shard": 0.75, "crystal-matrix": 0.9, plasma: 0.8 } },
  { id: "crimson-forge",    name: "Crimson Forge",       pos: { x: 3200, y: -1400 },  zone: "crimson",  kind: "factory",
    controlledBy: "earth",
    prices: { iron: 0.65, copper: 0.7, cobalt: 0.7, "refined-alloy": 0.85, "plasma-cell": 0.9 } },
  { id: "void-refinery",    name: "Void Refinery",       pos: { x: -2200, y: -2800 }, zone: "void",     kind: "factory",
    controlledBy: "mars",
    prices: { obsidian: 0.65, "void-steel": 0.85, "nano-compound": 0.9, "crystal-shard": 0.7 } },
  { id: "forge-smelter",    name: "Forge Smelter",       pos: { x: -3500, y: 2000 },  zone: "forge",    kind: "factory",
    controlledBy: "mars",
    prices: { iron: 0.6, copper: 0.65, cobalt: 0.65, "refined-alloy": 0.8, "fusion-core": 0.9 } },
  { id: "corona-refinery",  name: "Corona Refinery",     pos: { x: -2800, y: -2000 }, zone: "corona",   kind: "factory",
    controlledBy: "mars",
    prices: { "helium-3": 0.6, palladium: 0.7, "fusion-core": 0.85, "crystal-matrix": 0.9 } },
  { id: "fracture-mill",    name: "Fracture Mill",       pos: { x: -2500, y: -2200 }, zone: "fracture", kind: "factory",
    controlledBy: "earth",
    prices: { obsidian: 0.7, iridium: 0.75, "void-steel": 0.9, "nano-compound": 0.85 } },
  { id: "venus-foundry",    name: "Venus Cloud Foundry", pos: { x: 2800, y: -1800 },  zone: "venus1",   kind: "factory",
    controlledBy: "venus",
    prices: { sulfur: 0.6, copper: 0.65, iron: 0.7, "refined-alloy": 0.85, "plasma-cell": 0.85 } },
  { id: "venus3-refinery",  name: "Acid Vat Refinery",   pos: { x: 2800, y: 2200 },   zone: "venus3",   kind: "factory",
    controlledBy: "venus",
    prices: { sulfur: 0.55, cobalt: 0.65, "crystal-shard": 0.7, "nano-compound": 0.8, "crystal-matrix": 0.85 } },
  { id: "venus5-forge",     name: "Eye Forge",           pos: { x: -3200, y: 2800 },  zone: "venus5",   kind: "factory",
    controlledBy: "venus",
    prices: { obsidian: 0.6, iridium: 0.65, palladium: 0.65, "void-steel": 0.8, "fusion-core": 0.8 } },
  { id: "mars-refinery",    name: "Deep Mars Refinery",  pos: { x: 2800, y: 2800 },   zone: "marsdepth", kind: "factory",
    controlledBy: "mars",
    prices: { cobalt: 0.6, palladium: 0.65, "helium-3": 0.65, "fusion-core": 0.85, "crystal-matrix": 0.85 } },
  { id: "storm-works",      name: "Storm Works",         pos: { x: -3200, y: -2400 }, zone: "maelstrom", kind: "factory",
    controlledBy: "mars",
    prices: { iron: 0.6, obsidian: 0.65, copper: 0.6, "refined-alloy": 0.8, "void-steel": 0.85 } },
];

// ── RESOURCES ────────────────────────────────────────────────────────────────

export const RESOURCES: Record<ResourceId, {
  id: ResourceId;
  name: string;
  basePrice: number;
}> = {
  scrap:           { id: "scrap",           name: "Scrap Plating",    basePrice: 12 },
  plasma:          { id: "plasma",          name: "Plasma Cell",      basePrice: 35 },
  warp:            { id: "warp",            name: "Warp Coil",        basePrice: 95 },
  void:            { id: "void",            name: "Void Crystal",     basePrice: 160 },
  dread:           { id: "dread",           name: "Dread Core",       basePrice: 420 },
  iron:            { id: "iron",            name: "Iron Ore",         basePrice: 18 },
  lumenite:        { id: "lumenite",        name: "Lumenite",         basePrice: 80 },
  medpack:         { id: "medpack",         name: "Med Packs",        basePrice: 60 },
  synth:           { id: "synth",           name: "Synth Fuel",       basePrice: 28 },
  quantum:         { id: "quantum",         name: "Quantum Chip",     basePrice: 220 },
  food:            { id: "food",            name: "Food Supplies",    basePrice: 20 },
  medicine:        { id: "medicine",        name: "Medicine",         basePrice: 55 },
  luxury:          { id: "luxury",          name: "Luxury Goods",     basePrice: 110 },
  nanite:          { id: "nanite",          name: "Nanite Paste",     basePrice: 145 },
  "bio-matter":    { id: "bio-matter",      name: "Bio-Matter",       basePrice: 75 },
  precursor:       { id: "precursor",       name: "Precursor Tech",   basePrice: 300 },
  "fuel-cell":     { id: "fuel-cell",       name: "Fuel Cell",        basePrice: 40 },
  contraband:      { id: "contraband",      name: "Contraband",       basePrice: 180 },
  relic:           { id: "relic",           name: "Ancient Relic",    basePrice: 380 },
  exotic:          { id: "exotic",          name: "Exotic Matter",    basePrice: 500 },
  artifacts:       { id: "artifacts",       name: "Alien Artifacts",  basePrice: 260 },
  spice:           { id: "spice",           name: "Solar Spice",      basePrice: 34 },
  silk:            { id: "silk",            name: "Void Silk",        basePrice: 88 },
  ore:             { id: "ore",             name: "Refined Ore",      basePrice: 22 },
  "data-core":     { id: "data-core",       name: "Data Core",        basePrice: 155 },
  "cloning-gel":   { id: "cloning-gel",     name: "Cloning Gel",      basePrice: 140 },
  "medical-serum": { id: "medical-serum",   name: "Medical Serum",    basePrice: 72 },
  "fusion-lattice":{ id: "fusion-lattice",  name: "Fusion Lattice",   basePrice: 210 },
  "star-map":      { id: "star-map",        name: "Star Map",         basePrice: 120 },
  blackglass:      { id: "blackglass",      name: "Blackglass",       basePrice: 310 },
  titanium:        { id: "titanium",        name: "Titanium Alloy",   basePrice: 48 },
  "cryo-fluid":    { id: "cryo-fluid",      name: "Cryo Fluid",       basePrice: 92 },
  "neural-chip":   { id: "neural-chip",     name: "Neural Chip",      basePrice: 280 },
  "dark-matter":   { id: "dark-matter",     name: "Dark Matter",      basePrice: 450 },
  "plasma-coil":   { id: "plasma-coil",     name: "Plasma Coil",      basePrice: 65 },
  "bio-crystal":   { id: "bio-crystal",     name: "Bio Crystal",      basePrice: 195 },
  // mineable ores
  copper:          { id: "copper",          name: "Copper Ore",       basePrice: 22 },
  cobalt:          { id: "cobalt",          name: "Cobalt Ore",       basePrice: 48 },
  "crystal-shard": { id: "crystal-shard",   name: "Crystal Shard",    basePrice: 135 },
  palladium:       { id: "palladium",       name: "Palladium",        basePrice: 210 },
  "helium-3":      { id: "helium-3",        name: "Helium-3",         basePrice: 95 },
  iridium:         { id: "iridium",         name: "Iridium Ore",      basePrice: 380 },
  sulfur:          { id: "sulfur",          name: "Sulfur Deposit",   basePrice: 30 },
  obsidian:        { id: "obsidian",        name: "Void Obsidian",    basePrice: 165 },
};


// Zone-specific asteroid yield pools (weighted)
export const ZONE_ASTEROID_YIELDS: Record<string, { resourceId: ResourceId; weight: number }[]> = {
  alpha:     [{ resourceId: "iron", weight: 45 }, { resourceId: "copper", weight: 35 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "cobalt", weight: 5 }],
  nebula:    [{ resourceId: "iron", weight: 25 }, { resourceId: "copper", weight: 20 }, { resourceId: "lumenite", weight: 25 }, { resourceId: "helium-3", weight: 20 }, { resourceId: "cobalt", weight: 10 }],
  crimson:   [{ resourceId: "iron", weight: 15 }, { resourceId: "cobalt", weight: 30 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "copper", weight: 10 }],
  void:      [{ resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 25 }, { resourceId: "palladium", weight: 15 }],
  forge:     [{ resourceId: "iron", weight: 10 }, { resourceId: "cobalt", weight: 15 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "palladium", weight: 30 }, { resourceId: "iridium", weight: 15 }, { resourceId: "obsidian", weight: 10 }],
  corona:    [{ resourceId: "iron", weight: 40 }, { resourceId: "copper", weight: 25 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "helium-3", weight: 10 }, { resourceId: "cobalt", weight: 5 }],
  fracture:  [{ resourceId: "iron", weight: 15 }, { resourceId: "copper", weight: 15 }, { resourceId: "cobalt", weight: 25 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "helium-3", weight: 15 }, { resourceId: "crystal-shard", weight: 10 }],
  abyss:     [{ resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 10 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  marsdepth: [{ resourceId: "cobalt", weight: 10 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  maelstrom: [{ resourceId: "crystal-shard", weight: 15 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 25 }, { resourceId: "cobalt", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
  venus1:    [{ resourceId: "iron", weight: 35 }, { resourceId: "copper", weight: 20 }, { resourceId: "sulfur", weight: 30 }, { resourceId: "lumenite", weight: 10 }, { resourceId: "cobalt", weight: 5 }],
  venus2:    [{ resourceId: "iron", weight: 15 }, { resourceId: "sulfur", weight: 25 }, { resourceId: "copper", weight: 15 }, { resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  venus3:    [{ resourceId: "sulfur", weight: 15 }, { resourceId: "cobalt", weight: 20 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "copper", weight: 10 }],
  venus4:    [{ resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 20 }, { resourceId: "sulfur", weight: 10 }, { resourceId: "cobalt", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  venus5:    [{ resourceId: "obsidian", weight: 15 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 20 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "cobalt", weight: 10 }, { resourceId: "sulfur", weight: 10 }],
  danger1:   [{ resourceId: "crystal-shard", weight: 20 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 20 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "cobalt", weight: 15 }],
  danger2:   [{ resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "crystal-shard", weight: 15 }, { resourceId: "helium-3", weight: 15 }],
  danger3:   [{ resourceId: "iridium", weight: 30 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "crystal-shard", weight: 15 }, { resourceId: "cobalt", weight: 15 }],
  danger4:   [{ resourceId: "iridium", weight: 35 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "crystal-shard", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
  danger5:   [{ resourceId: "iridium", weight: 40 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "crystal-shard", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
};

export function pickAsteroidYield(zone: string): ResourceId {
  const pool = ZONE_ASTEROID_YIELDS[zone];
  if (!pool || pool.length === 0) return "iron" as ResourceId;
  const totalW = pool.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalW;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.resourceId;
  }
  return pool[pool.length - 1].resourceId;
}

// ── QUEST POOL ────────────────────────────────────────────────────────────
// Kept in sync with frontend/src/game/types.ts QUEST_POOL by id+zone+killType.
// The client owns quest *assignment*; this copy exists ONLY so the server can
// validate a player's stored activeQuests against reality on load (see
// validateActiveQuests below) and strip/repair anything that no longer
// matches a live pool entry — e.g. an id whose kill zone changed, or an id
// that was removed from the pool entirely (stale save data).
export const QUEST_POOL: {
  id: string;
  zone: ZoneId;
  targetZone?: ZoneId;
  killType: EnemyType;
  killCount: number;
  rewardCredits: number;
  rewardExp: number;
  rewardHonor: number;
}[] = [
  { id: "q-t1-scouts",        zone: "alpha",     killType: "scout",     killCount: 5, rewardCredits: 150,   rewardExp: 40,    rewardHonor: 2 },
  { id: "q-t1-raiders",       zone: "alpha",     killType: "raider",    killCount: 3, rewardCredits: 250,   rewardExp: 60,    rewardHonor: 4 },
  { id: "q-t1-scouts2",       zone: "corona",    killType: "scout",     killCount: 8, rewardCredits: 200,   rewardExp: 50,    rewardHonor: 3 },
  { id: "q-t1-raiders2",      zone: "venus1",    killType: "raider",    killCount: 4, rewardCredits: 300,   rewardExp: 70,    rewardHonor: 5 },

  { id: "q-t2-raiders",       zone: "nebula",    killType: "raider",    killCount: 6, rewardCredits: 500,   rewardExp: 120,   rewardHonor: 8 },
  { id: "q-t2-destroyers",    zone: "nebula",    killType: "destroyer", killCount: 3, rewardCredits: 800,   rewardExp: 200,   rewardHonor: 12 },
  { id: "q-t2-raiders2",      zone: "fracture",  killType: "raider",    killCount: 8, rewardCredits: 600,   rewardExp: 150,   rewardHonor: 10 },
  { id: "q-t2-destroyers2",   zone: "venus2",    killType: "destroyer", killCount: 4, rewardCredits: 900,   rewardExp: 220,   rewardHonor: 14 },

  { id: "q-t3-destroyers",    zone: "crimson",   killType: "destroyer", killCount: 5, rewardCredits: 1200,  rewardExp: 350,   rewardHonor: 18 },
  { id: "q-t3-sentinels",     zone: "crimson",   killType: "sentinel",  killCount: 4, rewardCredits: 1500,  rewardExp: 400,   rewardHonor: 22 },
  { id: "q-t3-dread",         zone: "crimson",   killType: "dread",     killCount: 1, rewardCredits: 2000,  rewardExp: 500,   rewardHonor: 30 },
  { id: "q-t3-sentinels2",    zone: "abyss",     killType: "sentinel",  killCount: 5, rewardCredits: 1800,  rewardExp: 450,   rewardHonor: 25 },
  { id: "q-t3-destroyers2",   zone: "venus3",    killType: "destroyer", killCount: 6, rewardCredits: 1400,  rewardExp: 380,   rewardHonor: 20 },

  { id: "q-t4-wraiths",       zone: "void",      killType: "wraith",    killCount: 5, rewardCredits: 3000,  rewardExp: 800,   rewardHonor: 40 },
  { id: "q-t4-sentinels",     zone: "void",      killType: "sentinel",  killCount: 6, rewardCredits: 3500,  rewardExp: 900,   rewardHonor: 45 },
  { id: "q-t4-dread",         zone: "void",      killType: "dread",     killCount: 2, rewardCredits: 5000,  rewardExp: 1200,  rewardHonor: 60 },
  { id: "q-t4-wraiths2",      zone: "marsdepth", killType: "wraith",    killCount: 6, rewardCredits: 3500,  rewardExp: 850,   rewardHonor: 42 },
  { id: "q-t4-sentinels2",    zone: "venus4",    killType: "sentinel",  killCount: 7, rewardCredits: 4000,  rewardExp: 1000,  rewardHonor: 50 },

  { id: "q-t5-titans",        zone: "forge",     killType: "titan",     killCount: 3, rewardCredits: 8000,  rewardExp: 2000,  rewardHonor: 100 },
  { id: "q-t5-wraiths",       zone: "forge",     killType: "wraith",    killCount: 6, rewardCredits: 6000,  rewardExp: 1500,  rewardHonor: 75 },
  { id: "q-t5-dread",         zone: "forge",     killType: "dread",     killCount: 3, rewardCredits: 10000, rewardExp: 2500,  rewardHonor: 120 },
  { id: "q-t5-titans2",       zone: "maelstrom", killType: "titan",     killCount: 4, rewardCredits: 9000,  rewardExp: 2200,  rewardHonor: 110 },
  { id: "q-t5-wraiths2",      zone: "venus5",    killType: "wraith",    killCount: 8, rewardCredits: 7000,  rewardExp: 1800,  rewardHonor: 85 },

  { id: "q-t6-titans",        zone: "danger1",   killType: "titan",     killCount: 4, rewardCredits: 12000, rewardExp: 3000,  rewardHonor: 150 },
  { id: "q-t6-overlords",     zone: "danger3",   killType: "overlord",  killCount: 2, rewardCredits: 18000, rewardExp: 5000,  rewardHonor: 250 },
  { id: "q-t7-overlords",     zone: "danger4",   killType: "overlord",  killCount: 3, rewardCredits: 25000, rewardExp: 8000,  rewardHonor: 400 },
  { id: "q-t8-titans",        zone: "danger5",   killType: "titan",     killCount: 5, rewardCredits: 30000, rewardExp: 10000, rewardHonor: 500 },
  { id: "q-t8-overlords",     zone: "danger5",   killType: "overlord",  killCount: 4, rewardCredits: 40000, rewardExp: 15000, rewardHonor: 800 },

  // Legacy ids kept alive with a repaired targetZone rather than deleted —
  // players who already accepted these before the pool changed keep a
  // completable quest instead of losing progress/rewards outright.
  { id: "q-corona-voidlings", zone: "corona", targetZone: "abyss",   killType: "voidling", killCount: 7, rewardCredits: 90000,  rewardExp: 26000, rewardHonor: 1400 },
  { id: "q-corona-dread",     zone: "corona", targetZone: "crimson", killType: "dread",    killCount: 2, rewardCredits: 150000, rewardExp: 44000, rewardHonor: 2300 },
];

const QUEST_POOL_BY_ID = new Map(QUEST_POOL.map((q) => [q.id, q]));

// Strips quest ids no longer in QUEST_POOL and repairs zone/killType/targetZone
// on any surviving quest to match the live pool entry — self-heals stale save
// data (removed/changed quests) on every load instead of needing a one-off
// manual DB patch. `progress`/`completed` on the stored quest are preserved.
export function validateActiveQuests(activeQuests: unknown): any[] {
  if (!Array.isArray(activeQuests)) return [];
  const result: any[] = [];
  for (const q of activeQuests) {
    if (!q || typeof q !== "object" || typeof q.id !== "string") continue;
    const def = QUEST_POOL_BY_ID.get(q.id);
    if (!def) continue; // orphaned id — quest no longer exists, drop it
    result.push({
      ...q,
      zone: def.zone,
      killType: def.killType,
      killCount: def.killCount,
      rewardCredits: def.rewardCredits,
      rewardExp: def.rewardExp,
      rewardHonor: def.rewardHonor,
      targetZone: def.targetZone,
    });
  }
  return result;
}

// ── DAILY MISSION POOL (8) ───────────────────────────────────────────────────

export const DAILY_MISSION_POOL: {
  id: string;
  kind: MissionKind;
  title: string;
  target: number;
  rewardCredits: number;
  rewardExp: number;
  rewardHonor: number;
  zoneFilter?: ZoneId;
}[] = [
  { id: "d-kills-10",   kind: "kill-any",      title: "Daily: Bug Sweep",       target: 10,   rewardCredits: 600,  rewardExp: 200, rewardHonor: 8 },
  { id: "d-kills-25",   kind: "kill-any",      title: "Daily: Patrol Duty",     target: 25,   rewardCredits: 1500, rewardExp: 500, rewardHonor: 18 },
  { id: "d-mine-30",    kind: "mine",          title: "Daily: Belt Run",        target: 30,   rewardCredits: 800,  rewardExp: 250, rewardHonor: 6 },
  { id: "d-credits-5k", kind: "earn-credits",  title: "Daily: Hustler",         target: 5000, rewardCredits: 1500, rewardExp: 300, rewardHonor: 10 },
  { id: "d-warp-3",     kind: "warp-zones",    title: "Daily: Sector Rounds",   target: 3,    rewardCredits: 700,  rewardExp: 200, rewardHonor: 6 },
  { id: "d-spend-3k",   kind: "spend-credits", title: "Daily: Resupply",        target: 3000, rewardCredits: 600,  rewardExp: 150, rewardHonor: 4 },
  { id: "d-zone-alpha", kind: "kill-zone",     title: "Daily: Alpha Sweep",     target: 8,    rewardCredits: 700,  rewardExp: 220, rewardHonor: 7,  zoneFilter: "alpha" },
  { id: "d-zone-nebula",kind: "kill-zone",     title: "Daily: Nebula Cleanup",  target: 6,    rewardCredits: 1400, rewardExp: 400, rewardHonor: 14, zoneFilter: "nebula" },
];

// ── DUNGEONS (15) ────────────────────────────────────────────────────────────

export const DUNGEONS: Record<DungeonId, {
  id: DungeonId;
  name: string;
  zone: ZoneId;
  pos: Vec2;
  enemyTypes: EnemyType[];
  enemyHpMul: number;
  enemyDmgMul: number;
  waves: number;
  enemiesPerWave: number;
  rewardCredits: number;
  rewardExp: number;
  rewardModules: string[];
  rewardMaterials: { resourceId: ResourceId; qty: number }[];
  color: string;
  unlockLevel: number;
}> = {
  "alpha-rift": {
    id: "alpha-rift", name: "Alpha Anomaly", zone: "alpha", pos: { x: -1400, y: 1100 },
    enemyTypes: ["scout", "raider"], enemyHpMul: 1.4, enemyDmgMul: 1.2,
    waves: 3, enemiesPerWave: 4,
    rewardCredits: 1500, rewardExp: 400,
    rewardModules: ["wp-pulse-2", "wp-pulse-3", "gn-core-2", "gn-sprint", "md-thrust-2", "md-cargo", "wp-rocket-1"],
    rewardMaterials: [{ resourceId: "iron", qty: 6 }, { resourceId: "scrap", qty: 8 }],
    color: "#7ad8ff", unlockLevel: 1,
  },
  "nebula-rift": {
    id: "nebula-rift", name: "Veil Vortex", zone: "nebula", pos: { x: -1100, y: 600 },
    enemyTypes: ["raider", "destroyer"], enemyHpMul: 1.6, enemyDmgMul: 1.4,
    waves: 4, enemiesPerWave: 5,
    rewardCredits: 4500, rewardExp: 1200,
    rewardModules: ["wp-plasma", "wp-phase", "wp-ion", "wp-rocket-2", "gn-aegis", "gn-fortify", "gn-hyper", "md-targeter", "md-plating", "md-scavenger", "md-afterburn", "md-overclock"],
    rewardMaterials: [{ resourceId: "plasma", qty: 8 }, { resourceId: "warp", qty: 4 }, { resourceId: "lumenite", qty: 5 }],
    color: "#ff5cf0", unlockLevel: 5,
  },
  "crimson-rift": {
    id: "crimson-rift", name: "Crimson Furnace", zone: "crimson", pos: { x: 1300, y: -900 },
    enemyTypes: ["destroyer", "dread"], enemyHpMul: 1.8, enemyDmgMul: 1.5,
    waves: 4, enemiesPerWave: 5,
    rewardCredits: 12000, rewardExp: 3200,
    rewardModules: ["wp-solar", "wp-scatter", "wp-arc", "wp-torpedo", "gn-quantum", "gn-warp-drive", "md-overcharge", "md-plating", "md-heavy-armor", "md-shield-boost", "md-nano-rep"],
    rewardMaterials: [{ resourceId: "dread", qty: 3 }, { resourceId: "warp", qty: 8 }, { resourceId: "quantum", qty: 4 }],
    color: "#ff5c6c", unlockLevel: 10,
  },
  "void-rift": {
    id: "void-rift", name: "Void Maw", zone: "void", pos: { x: -800, y: 1200 },
    enemyTypes: ["voidling", "dread"], enemyHpMul: 2.2, enemyDmgMul: 1.8,
    waves: 5, enemiesPerWave: 6,
    rewardCredits: 30000, rewardExp: 8000,
    rewardModules: ["wp-singular", "wp-sniper", "wp-void-lance", "wp-hellfire", "md-voidframe", "md-singularity", "gn-quantum", "gn-phase-drive", "gn-leviathan", "wp-solar"],
    rewardMaterials: [{ resourceId: "void", qty: 8 }, { resourceId: "dread", qty: 5 }, { resourceId: "quantum", qty: 8 }],
    color: "#b06cff", unlockLevel: 15,
  },
  "forge-rift": {
    id: "forge-rift", name: "Iron Crucible", zone: "forge", pos: { x: -1300, y: -900 },
    enemyTypes: ["destroyer", "dread"], enemyHpMul: 2.4, enemyDmgMul: 2.0,
    waves: 5, enemiesPerWave: 6,
    rewardCredits: 65000, rewardExp: 18000,
    rewardModules: ["wp-void-lance", "wp-hellfire", "wp-torpedo", "wp-solar", "gn-phase-drive", "gn-leviathan", "gn-quantum", "md-heavy-armor", "md-overcharge", "md-voidframe", "md-singularity"],
    rewardMaterials: [{ resourceId: "dread", qty: 6 }, { resourceId: "quantum", qty: 8 }, { resourceId: "void", qty: 5 }],
    color: "#ff8a4e", unlockLevel: 18,
  },
  "corona-rift": {
    id: "corona-rift", name: "Solar Pyre", zone: "corona", pos: { x: -1500, y: 800 },
    enemyTypes: ["voidling", "dread"], enemyHpMul: 2.7, enemyDmgMul: 2.3,
    waves: 5, enemiesPerWave: 7,
    rewardCredits: 100000, rewardExp: 6500,
    rewardModules: ["wp-void-lance", "wp-singular", "wp-hellfire", "wp-sniper", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe", "md-targeter-2", "md-overclock"],
    rewardMaterials: [{ resourceId: "void", qty: 10 }, { resourceId: "dread", qty: 7 }, { resourceId: "quantum", qty: 10 }],
    color: "#ffd24a", unlockLevel: 22,
  },
  "fracture-rift": {
    id: "fracture-rift", name: "Fracture Void", zone: "fracture", pos: { x: 1200, y: 1000 },
    enemyTypes: ["voidling", "dread"], enemyHpMul: 3.0, enemyDmgMul: 2.6,
    waves: 6, enemiesPerWave: 7,
    rewardCredits: 175000, rewardExp: 50000,
    rewardModules: ["wp-singular", "wp-void-lance", "wp-hellfire", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe", "md-heavy-armor", "md-loot-2"],
    rewardMaterials: [{ resourceId: "void", qty: 14 }, { resourceId: "dread", qty: 10 }, { resourceId: "quantum", qty: 14 }],
    color: "#b06cff", unlockLevel: 27,
  },
  "abyss-rift": {
    id: "abyss-rift", name: "The Dread Abyss", zone: "abyss", pos: { x: 1300, y: -1000 },
    enemyTypes: ["dread"], enemyHpMul: 3.6, enemyDmgMul: 3.0,
    waves: 7, enemiesPerWave: 8,
    rewardCredits: 300000, rewardExp: 85000,
    rewardModules: ["wp-singular", "wp-void-lance", "wp-hellfire", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe"],
    rewardMaterials: [{ resourceId: "void", qty: 20 }, { resourceId: "dread", qty: 15 }, { resourceId: "quantum", qty: 18 }],
    color: "#ff5c6c", unlockLevel: 32,
  },
  // Mars deep dungeons
  "marsdepth-rift": {
    id: "marsdepth-rift", name: "The Deep Maw", zone: "marsdepth", pos: { x: -1200, y: 900 },
    enemyTypes: ["voidling", "dread"], enemyHpMul: 2.5, enemyDmgMul: 2.2,
    waves: 5, enemiesPerWave: 7,
    rewardCredits: 140000, rewardExp: 40000,
    rewardModules: ["wp-void-lance", "wp-singular", "wp-hellfire", "wp-sniper", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe", "md-targeter-2", "md-overclock"],
    rewardMaterials: [{ resourceId: "void", qty: 12 }, { resourceId: "dread", qty: 8 }, { resourceId: "quantum", qty: 12 }],
    color: "#ff6844", unlockLevel: 25,
  },
  "maelstrom-rift": {
    id: "maelstrom-rift", name: "The Storm Crucible", zone: "maelstrom", pos: { x: 1100, y: -900 },
    enemyTypes: ["dread"], enemyHpMul: 3.2, enemyDmgMul: 2.8,
    waves: 6, enemiesPerWave: 8,
    rewardCredits: 250000, rewardExp: 70000,
    rewardModules: ["wp-singular", "wp-void-lance", "wp-hellfire", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe", "md-heavy-armor"],
    rewardMaterials: [{ resourceId: "void", qty: 18 }, { resourceId: "dread", qty: 13 }, { resourceId: "quantum", qty: 16 }],
    color: "#cc4488", unlockLevel: 33,
  },
  // Venus dungeons
  "venus1-rift": {
    id: "venus1-rift", name: "Cloud Gate Anomaly", zone: "venus1", pos: { x: -1300, y: 1000 },
    enemyTypes: ["scout", "raider"], enemyHpMul: 1.4, enemyDmgMul: 1.2,
    waves: 3, enemiesPerWave: 4,
    rewardCredits: 1600, rewardExp: 420,
    rewardModules: ["wp-pulse-2", "wp-pulse-3", "gn-core-2", "gn-sprint", "md-thrust-2", "md-cargo", "wp-rocket-1"],
    rewardMaterials: [{ resourceId: "iron", qty: 6 }, { resourceId: "scrap", qty: 8 }],
    color: "#c86cff", unlockLevel: 2,
  },
  "venus2-rift": {
    id: "venus2-rift", name: "Sulphur Vortex", zone: "venus2", pos: { x: -1100, y: -700 },
    enemyTypes: ["raider", "destroyer"], enemyHpMul: 1.6, enemyDmgMul: 1.4,
    waves: 4, enemiesPerWave: 5,
    rewardCredits: 4800, rewardExp: 1300,
    rewardModules: ["wp-plasma", "wp-phase", "wp-ion", "wp-rocket-2", "gn-aegis", "gn-fortify", "gn-hyper", "md-targeter", "md-plating", "md-scavenger", "md-afterburn", "md-overclock"],
    rewardMaterials: [{ resourceId: "plasma", qty: 8 }, { resourceId: "warp", qty: 4 }, { resourceId: "lumenite", qty: 5 }],
    color: "#dd88ff", unlockLevel: 7,
  },
  "venus3-rift": {
    id: "venus3-rift", name: "Acidic Furnace", zone: "venus3", pos: { x: 1200, y: -800 },
    enemyTypes: ["destroyer", "dread"], enemyHpMul: 1.8, enemyDmgMul: 1.5,
    waves: 4, enemiesPerWave: 5,
    rewardCredits: 13000, rewardExp: 3500,
    rewardModules: ["wp-solar", "wp-scatter", "wp-arc", "wp-torpedo", "gn-quantum", "gn-warp-drive", "md-overcharge", "md-plating", "md-heavy-armor", "md-shield-boost", "md-nano-rep"],
    rewardMaterials: [{ resourceId: "dread", qty: 3 }, { resourceId: "warp", qty: 8 }, { resourceId: "quantum", qty: 4 }],
    color: "#bb55ee", unlockLevel: 12,
  },
  "venus4-rift": {
    id: "venus4-rift", name: "Pressure Core Maw", zone: "venus4", pos: { x: -900, y: 1100 },
    enemyTypes: ["voidling", "dread"], enemyHpMul: 2.2, enemyDmgMul: 1.8,
    waves: 5, enemiesPerWave: 6,
    rewardCredits: 32000, rewardExp: 9000,
    rewardModules: ["wp-singular", "wp-sniper", "wp-void-lance", "wp-hellfire", "md-voidframe", "md-singularity", "gn-quantum", "gn-phase-drive", "gn-leviathan", "wp-solar"],
    rewardMaterials: [{ resourceId: "void", qty: 9 }, { resourceId: "dread", qty: 6 }, { resourceId: "quantum", qty: 9 }],
    color: "#9933dd", unlockLevel: 20,
  },
  "venus5-rift": {
    id: "venus5-rift", name: "The Eye Ascendant", zone: "venus5", pos: { x: -1200, y: -900 },
    enemyTypes: ["dread"], enemyHpMul: 3.5, enemyDmgMul: 2.9,
    waves: 7, enemiesPerWave: 8,
    rewardCredits: 290000, rewardExp: 82000,
    rewardModules: ["wp-laser-t10", "wp-laser-t9", "wp-rocket-t5", "gn-t5", "md-t5"],
    rewardMaterials: [{ resourceId: "void", qty: 20 }, { resourceId: "dread", qty: 14 }, { resourceId: "quantum", qty: 18 }],
    color: "#7722cc", unlockLevel: 30,
  },
};

// ── PORTALS ──────────────────────────────────────────────────────────────────

export const PORTALS: {
  id: string;
  pos: Vec2;
  fromZone: ZoneId;
  toZone: ZoneId;
}[] = [
  // Earth chain: alpha <-> nebula <-> crimson <-> void <-> forge
  { id: "p-a-n",   pos: { x:  6500, y: -6500 }, fromZone: "alpha",    toZone: "nebula" },
  { id: "p-n-a",   pos: { x: -6500, y:  6500 }, fromZone: "nebula",   toZone: "alpha" },
  { id: "p-n-c",   pos: { x:  6500, y:  6500 }, fromZone: "nebula",   toZone: "crimson" },
  { id: "p-c-n",   pos: { x: -6500, y: -6500 }, fromZone: "crimson",  toZone: "nebula" },
  { id: "p-c-v",   pos: { x:  6500, y: -6500 }, fromZone: "crimson",  toZone: "void" },
  { id: "p-v-c",   pos: { x: -6500, y:  6500 }, fromZone: "void",     toZone: "crimson" },
  { id: "p-v-f",   pos: { x:  6500, y:  6500 }, fromZone: "void",     toZone: "forge" },
  { id: "p-f-v",   pos: { x: -6500, y: -6500 }, fromZone: "forge",    toZone: "void" },
  // Cross-faction: Earth endgame -> Mars entry
  { id: "p-f-co",  pos: { x: -6500, y:  6500 }, fromZone: "forge",    toZone: "corona" },
  { id: "p-co-f",  pos: { x:  6500, y: -6500 }, fromZone: "corona",   toZone: "forge" },
  // Mars chain: corona <-> fracture <-> abyss <-> marsdepth <-> maelstrom
  { id: "p-co-fr", pos: { x: -6500, y: -6500 }, fromZone: "corona",   toZone: "fracture" },
  { id: "p-fr-co", pos: { x:  6500, y:  6500 }, fromZone: "fracture", toZone: "corona" },
  { id: "p-fr-ab", pos: { x: -6500, y:  6500 }, fromZone: "fracture", toZone: "abyss" },
  { id: "p-ab-fr", pos: { x:  6500, y: -6500 }, fromZone: "abyss",    toZone: "fracture" },
  { id: "p-ab-md", pos: { x: -6500, y: -6500 }, fromZone: "abyss",    toZone: "marsdepth" },
  { id: "p-md-ab", pos: { x:  6500, y:  6500 }, fromZone: "marsdepth",toZone: "abyss" },
  { id: "p-md-ml", pos: { x: -6500, y:  6500 }, fromZone: "marsdepth",toZone: "maelstrom" },
  { id: "p-ml-md", pos: { x:  6500, y: -6500 }, fromZone: "maelstrom",toZone: "marsdepth" },
  // Cross-faction: Mars endgame -> Venus entry
  { id: "p-ml-v1", pos: { x: -6500, y: -6500 }, fromZone: "maelstrom",toZone: "venus1" },
  { id: "p-v1-ml", pos: { x:  6500, y:  6500 }, fromZone: "venus1",   toZone: "maelstrom" },
  // Venus chain: venus1 <-> venus2 <-> venus3 <-> venus4 <-> venus5
  { id: "p-v1-v2", pos: { x:  6500, y: -6500 }, fromZone: "venus1",   toZone: "venus2" },
  { id: "p-v2-v1", pos: { x: -6500, y:  6500 }, fromZone: "venus2",   toZone: "venus1" },
  { id: "p-v2-v3", pos: { x:  6500, y:  6500 }, fromZone: "venus2",   toZone: "venus3" },
  { id: "p-v3-v2", pos: { x: -6500, y: -6500 }, fromZone: "venus3",   toZone: "venus2" },
  { id: "p-v3-v4", pos: { x:  6500, y: -6500 }, fromZone: "venus3",   toZone: "venus4" },
  { id: "p-v4-v3", pos: { x: -6500, y:  6500 }, fromZone: "venus4",   toZone: "venus3" },
  { id: "p-v4-v5", pos: { x:  6500, y:  6500 }, fromZone: "venus4",   toZone: "venus5" },
  { id: "p-v5-v4", pos: { x: -6500, y: -6500 }, fromZone: "venus5",   toZone: "venus4" },
  // Cross-faction: Venus endgame -> Earth entry (completing the triangle)
  { id: "p-v5-a",  pos: { x:  6500, y: -6500 }, fromZone: "venus5",   toZone: "alpha" },
  { id: "p-a-v5",  pos: { x: -6500, y:  6500 }, fromZone: "alpha",    toZone: "venus5" },
  // Danger zone portals - accessible from faction endgame zones
  { id: "p-f-d1",  pos: { x:  6500, y:  6500 }, fromZone: "forge",    toZone: "danger1" },
  { id: "p-d1-f",  pos: { x: -6500, y: -6500 }, fromZone: "danger1",  toZone: "forge" },
  { id: "p-ml-d1", pos: { x:  6500, y:  6500 }, fromZone: "maelstrom",toZone: "danger1" },
  { id: "p-d1-ml", pos: { x: -6500, y:  6500 }, fromZone: "danger1",  toZone: "maelstrom" },
  { id: "p-v5-d1", pos: { x: -6500, y:  6500 }, fromZone: "venus5",   toZone: "danger1" },
  { id: "p-d1-v5", pos: { x:  6500, y:  6500 }, fromZone: "danger1",  toZone: "venus5" },
  // Danger zone chain: danger1 <-> danger2 <-> danger3 <-> danger4 <-> danger5
  { id: "p-d1-d2", pos: { x:  6500, y: -6500 }, fromZone: "danger1",  toZone: "danger2" },
  { id: "p-d2-d1", pos: { x: -6500, y:  6500 }, fromZone: "danger2",  toZone: "danger1" },
  { id: "p-d2-d3", pos: { x:  6500, y:  6500 }, fromZone: "danger2",  toZone: "danger3" },
  { id: "p-d3-d2", pos: { x: -6500, y: -6500 }, fromZone: "danger3",  toZone: "danger2" },
  { id: "p-d3-d4", pos: { x:  6500, y: -6500 }, fromZone: "danger3",  toZone: "danger4" },
  { id: "p-d4-d3", pos: { x: -6500, y:  6500 }, fromZone: "danger4",  toZone: "danger3" },
  { id: "p-d4-d5", pos: { x:  6500, y:  6500 }, fromZone: "danger4",  toZone: "danger5" },
  { id: "p-d5-d4", pos: { x: -6500, y: -6500 }, fromZone: "danger5",  toZone: "danger4" },
];

// ── ENEMY NAMES ──────────────────────────────────────────────────────────────

export const ENEMY_NAMES: Record<EnemyType, string[]> = {
  scout:       ["Scout"],
  raider:      ["Raider"],
  destroyer:   ["Destroyer"],
  voidling:    ["Voidling"],
  dread:       ["Dread"],
  sentinel:    ["Sentinel"],
  wraith:      ["Wraith"],
  titan:       ["Titan"],
  overlord:    ["Overlord"],
  interceptor: ["Interceptor"],
  corvette:    ["Corvette"],
  specter:     ["Specter"],
  phantom:     ["Phantom"],
  juggernaut:  ["Juggernaut"],
  leviathan:   ["Leviathan"],
  erix:        ["Erix"],
  angin:       ["Angin"],
  crobium:     ["Crobium"],
  draug:       ["Draug"],
  knoton:      ["Knoton"],
  maron:       ["Maron"],
  nabas:       ["Nabas"],
  silikum:     ["Silikum"],
  simonit:     ["Simonit"],
};
