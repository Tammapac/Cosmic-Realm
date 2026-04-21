export type Vec2 = { x: number; y: number };

export type ZoneId = "alpha" | "nebula" | "crimson" | "void";

export type Zone = {
  id: ZoneId;
  name: string;
  bgHueA: string;
  bgHueB: string;
  enemyTier: number;
  enemyTypes: EnemyType[];
  description: string;
  unlockLevel: number;
};

export type EnemyType = "scout" | "raider" | "destroyer" | "voidling" | "dread";

export type ShipClassId = "skimmer" | "vanguard" | "obsidian" | "titan";

export type ShipClass = {
  id: ShipClassId;
  name: string;
  hullMax: number;
  shieldMax: number;
  baseSpeed: number;
  baseDamage: number;
  cargoMax: number;
  price: number;
  description: string;
  color: string;
};

export type Equipment = {
  laserTier: number;
  thrusterTier: number;
  shieldTier: number;
};

export type Quest = {
  id: string;
  title: string;
  description: string;
  zone: ZoneId;
  killType: EnemyType;
  killCount: number;
  rewardCredits: number;
  rewardExp: number;
  rewardHonor: number;
};

export type ActiveQuest = Quest & {
  progress: number;
  completed: boolean;
};

export type CargoItem = {
  id: string;
  name: string;
  qty: number;
  pricePerUnit: number;
};

export type Player = {
  name: string;
  shipClass: ShipClassId;
  equipment: Equipment;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  hull: number;
  shield: number;
  level: number;
  exp: number;
  credits: number;
  honor: number;
  cargo: CargoItem[];
  zone: ZoneId;
  ownedShips: ShipClassId[];
  activeQuests: ActiveQuest[];
  completedQuests: string[];
  clan: string | null;
  party: string[];
};

export type Enemy = {
  id: string;
  type: EnemyType;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  hull: number;
  hullMax: number;
  damage: number;
  speed: number;
  fireCd: number;
  exp: number;
  credits: number;
  loot?: { name: string; price: number };
  color: string;
  size: number;
};

export type Projectile = {
  id: string;
  pos: Vec2;
  vel: Vec2;
  damage: number;
  ttl: number;
  fromPlayer: boolean;
  color: string;
};

export type Particle = {
  id: string;
  pos: Vec2;
  vel: Vec2;
  ttl: number;
  maxTtl: number;
  color: string;
  size: number;
};

export type Station = {
  id: string;
  name: string;
  pos: Vec2;
  zone: ZoneId;
};

export type Portal = {
  id: string;
  pos: Vec2;
  fromZone: ZoneId;
  toZone: ZoneId;
};

export type OtherPlayer = {
  id: string;
  name: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  level: number;
  shipClass: ShipClassId;
  zone: ZoneId;
  inParty: boolean;
  clan: string | null;
};

export type ChatMessage = {
  id: string;
  channel: "local" | "party" | "clan" | "system";
  from: string;
  text: string;
  time: number;
};

export const ZONES: Record<ZoneId, Zone> = {
  alpha: {
    id: "alpha",
    name: "Alpha Sector",
    bgHueA: "#0a1240",
    bgHueB: "#020414",
    enemyTier: 1,
    enemyTypes: ["scout", "raider"],
    description: "Frontier territory. Pirates and scouts patrol the lanes.",
    unlockLevel: 1,
  },
  nebula: {
    id: "nebula",
    name: "Veil Nebula",
    bgHueA: "#3a0a4a",
    bgHueB: "#0a0220",
    enemyTier: 2,
    enemyTypes: ["raider", "destroyer"],
    description: "Glowing dust clouds hide raider strongholds.",
    unlockLevel: 4,
  },
  crimson: {
    id: "crimson",
    name: "Crimson Reach",
    bgHueA: "#4a0a18",
    bgHueB: "#1a0208",
    enemyTier: 3,
    enemyTypes: ["destroyer", "dread"],
    description: "Blood-red expanse. Destroyers hunt in packs.",
    unlockLevel: 8,
  },
  void: {
    id: "void",
    name: "The Void",
    bgHueA: "#001a1a",
    bgHueB: "#000508",
    enemyTier: 4,
    enemyTypes: ["voidling", "dread"],
    description: "An empty stretch where reality bends. Voidlings dwell here.",
    unlockLevel: 12,
  },
};

export const SHIP_CLASSES: Record<ShipClassId, ShipClass> = {
  skimmer: {
    id: "skimmer",
    name: "Skimmer Mk-I",
    hullMax: 100,
    shieldMax: 50,
    baseSpeed: 180,
    baseDamage: 8,
    cargoMax: 20,
    price: 0,
    description: "Cheap, nimble, easy to lose.",
    color: "#7ad8ff",
  },
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    hullMax: 180,
    shieldMax: 120,
    baseSpeed: 160,
    baseDamage: 14,
    cargoMax: 40,
    price: 12000,
    description: "All-rounder hull. Solid in any zone.",
    color: "#5cff8a",
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidian Reaver",
    hullMax: 220,
    shieldMax: 180,
    baseSpeed: 200,
    baseDamage: 22,
    cargoMax: 30,
    price: 48000,
    description: "Predator of the deep lanes.",
    color: "#ff5cf0",
  },
  titan: {
    id: "titan",
    name: "Titan Bulwark",
    hullMax: 400,
    shieldMax: 300,
    baseSpeed: 130,
    baseDamage: 30,
    cargoMax: 80,
    price: 140000,
    description: "Walking fortress. Slow but devastating.",
    color: "#ffd24a",
  },
};

export const UPGRADE_COST = (tier: number) => 500 * tier * tier;

export const EXP_FOR_LEVEL = (level: number) => 100 * level * level;

export const ENEMY_DEFS: Record<EnemyType, Omit<Enemy, "id" | "pos" | "vel" | "angle" | "hull" | "fireCd">> = {
  scout: {
    type: "scout",
    hullMax: 30,
    damage: 4,
    speed: 80,
    exp: 10,
    credits: 25,
    color: "#ff8866",
    size: 10,
    loot: { name: "Scrap Plating", price: 10 },
  },
  raider: {
    type: "raider",
    hullMax: 70,
    damage: 9,
    speed: 70,
    exp: 28,
    credits: 80,
    color: "#ff4466",
    size: 13,
    loot: { name: "Plasma Cell", price: 30 },
  },
  destroyer: {
    type: "destroyer",
    hullMax: 180,
    damage: 18,
    speed: 55,
    exp: 70,
    credits: 220,
    color: "#aa44ff",
    size: 18,
    loot: { name: "Warp Coil", price: 90 },
  },
  voidling: {
    type: "voidling",
    hullMax: 140,
    damage: 14,
    speed: 110,
    exp: 90,
    credits: 280,
    color: "#44ffe2",
    size: 14,
    loot: { name: "Void Crystal", price: 150 },
  },
  dread: {
    type: "dread",
    hullMax: 380,
    damage: 28,
    speed: 45,
    exp: 180,
    credits: 600,
    color: "#ffaa22",
    size: 24,
    loot: { name: "Dread Core", price: 400 },
  },
};

export const QUEST_POOL: Quest[] = [
  {
    id: "q-alpha-scouts",
    title: "Sweep the Lanes",
    description: "Pirate scouts have been raiding traders in Alpha Sector. Eliminate them.",
    zone: "alpha",
    killType: "scout",
    killCount: 5,
    rewardCredits: 350,
    rewardExp: 80,
    rewardHonor: 5,
  },
  {
    id: "q-alpha-raiders",
    title: "Raider Bounty",
    description: "A raider crew is harassing the Helix Station. Take them down.",
    zone: "alpha",
    killType: "raider",
    killCount: 3,
    rewardCredits: 600,
    rewardExp: 140,
    rewardHonor: 10,
  },
  {
    id: "q-nebula-raiders",
    title: "Veil Cleanup",
    description: "The Veil Nebula is thick with raider holdouts. Clear them.",
    zone: "nebula",
    killType: "raider",
    killCount: 6,
    rewardCredits: 1400,
    rewardExp: 320,
    rewardHonor: 18,
  },
  {
    id: "q-nebula-destroyers",
    title: "Hunt the Hunters",
    description: "Hostile destroyers prowl the Veil. End their patrol.",
    zone: "nebula",
    killType: "destroyer",
    killCount: 3,
    rewardCredits: 2400,
    rewardExp: 600,
    rewardHonor: 30,
  },
  {
    id: "q-crimson-destroyers",
    title: "Crimson Purge",
    description: "Destroyers have established a beachhead in Crimson Reach.",
    zone: "crimson",
    killType: "destroyer",
    killCount: 5,
    rewardCredits: 4000,
    rewardExp: 1100,
    rewardHonor: 50,
  },
  {
    id: "q-crimson-dread",
    title: "Bring Down a Dread",
    description: "A Dread-class warship looms in Crimson Reach. Send it home in pieces.",
    zone: "crimson",
    killType: "dread",
    killCount: 1,
    rewardCredits: 6000,
    rewardExp: 1800,
    rewardHonor: 100,
  },
  {
    id: "q-void-voidlings",
    title: "Voidling Eradication",
    description: "Voidlings flicker between dimensions in The Void. Banish them.",
    zone: "void",
    killType: "voidling",
    killCount: 6,
    rewardCredits: 9000,
    rewardExp: 2600,
    rewardHonor: 140,
  },
  {
    id: "q-void-dread",
    title: "Apex Predator",
    description: "A Dread haunts The Void. Become its end.",
    zone: "void",
    killType: "dread",
    killCount: 2,
    rewardCredits: 18000,
    rewardExp: 5000,
    rewardHonor: 280,
  },
];

export const STATIONS: Station[] = [
  { id: "helix", name: "Helix Station", pos: { x: 0, y: 0 }, zone: "alpha" },
  { id: "veiled", name: "Veiled Outpost", pos: { x: 200, y: -800 }, zone: "nebula" },
  { id: "ember", name: "Ember Citadel", pos: { x: -600, y: 400 }, zone: "crimson" },
  { id: "echo", name: "Echo Anchorage", pos: { x: 0, y: -300 }, zone: "void" },
];

export const PORTALS: Portal[] = [
  { id: "p-a-n", pos: { x: 1400, y: -1200 }, fromZone: "alpha", toZone: "nebula" },
  { id: "p-n-a", pos: { x: -1200, y: 1100 }, fromZone: "nebula", toZone: "alpha" },
  { id: "p-a-c", pos: { x: -1600, y: 1500 }, fromZone: "alpha", toZone: "crimson" },
  { id: "p-c-a", pos: { x: 1500, y: -1300 }, fromZone: "crimson", toZone: "alpha" },
  { id: "p-c-v", pos: { x: -1700, y: -1500 }, fromZone: "crimson", toZone: "void" },
  { id: "p-v-c", pos: { x: 1600, y: 1400 }, fromZone: "void", toZone: "crimson" },
];

export const MAP_RADIUS = 2400;

export const FAKE_NAMES = [
  "Nyx_77",
  "VoidPilot",
  "StarbornAce",
  "RogueComet",
  "Hex.Drift",
  "Aurora",
  "Cipher",
  "Nebula_Q",
  "Solenoid",
  "Vanta",
  "Quasar",
  "Mira-7",
  "Helios",
  "Lumen",
  "Apex",
  "Drekk",
];

export const FAKE_CLANS = [
  "Iron Wake",
  "Crimson Veil",
  "Pale Horizon",
  "Null Sector",
  "Aegis Pact",
  "Starforge",
];
