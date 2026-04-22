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
  | "specter";

export type ShipClass = {
  id: ShipClassId;
  name: string;
  hullMax: number;
  shieldMax: number;
  baseSpeed: number;
  baseDamage: number;
  cargoMax: number;
  droneSlots: number;
  price: number;
  description: string;
  color: string;
  accent: string;
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

export type ResourceId =
  | "scrap"
  | "plasma"
  | "warp"
  | "void"
  | "dread"
  | "iron"
  | "lumenite"
  | "medpack"
  | "synth"
  | "quantum";

export type Resource = {
  id: ResourceId;
  name: string;
  basePrice: number;
  glyph: string;
  color: string;
  description: string;
};

export type CargoItem = {
  resourceId: ResourceId;
  qty: number;
};

export type DroneKind = "combat-i" | "combat-ii" | "shield-i" | "shield-ii" | "salvage";
export type DroneMode = "orbit" | "forward" | "defensive";

export type DroneDef = {
  id: DroneKind;
  name: string;
  price: number;
  damageBonus: number;
  shieldBonus: number;
  hullBonus: number;
  fireRate: number;     // shots per second from drone
  description: string;
  color: string;
};

export type Drone = {
  id: string;            // instance id
  kind: DroneKind;
  mode: DroneMode;       // behavior mode
  hp: number;
  hpMax: number;
  orbitPhase: number;    // for animated orbit
  fireCd: number;
};

export type HonorRank = {
  index: number;
  name: string;
  minHonor: number;
  color: string;
  symbol: string;        // small ASCII glyph
  pips: number;          // number of icon pips
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
  drones: Drone[];
  // Phase 2 additions
  faction: FactionId | null;
  skills: Partial<Record<SkillId, number>>;  // skillId → ranks
  skillPoints: number;
  milestones: Milestones;
  dailyMissions: ActiveMission[];
  lastDailyReset: number;       // ms timestamp
  lastSeen: number;             // ms timestamp for idle calc
};

// ── FACTIONS ─────────────────────────────────────────────────────────────
export type FactionId = "aurora" | "crimson" | "syndicate";

export type Faction = {
  id: FactionId;
  name: string;
  motto: string;
  description: string;
  color: string;
  bonus: { damage?: number; speed?: number; shieldRegen?: number; tradeDiscount?: number; lootBonus?: number };
  bonusText: string;
};

export const FACTIONS: Record<FactionId, Faction> = {
  aurora: {
    id: "aurora", name: "Aurora Concord", motto: "Vigil over the lanes.",
    description: "Defenders of the trade routes. Renowned for shielding tech and disciplined cruisers.",
    color: "#4ee2ff",
    bonus: { shieldRegen: 1.5, tradeDiscount: 0.05 },
    bonusText: "+50% shield regen · 5% trade discount at Concord stations",
  },
  crimson: {
    id: "crimson", name: "Crimson Vanguard", motto: "Burn or be burned.",
    description: "A military doctrine forged in the Crimson Reach. Heavy guns, heavier consequences.",
    color: "#ff5c6c",
    bonus: { damage: 0.10, lootBonus: 1 },
    bonusText: "+10% laser damage · +1 bonus loot per kill",
  },
  syndicate: {
    id: "syndicate", name: "Void Syndicate", motto: "Profit between the stars.",
    description: "A smuggler-backed syndicate. Faster ships, deeper cargo, smarter deals.",
    color: "#ff5cf0",
    bonus: { speed: 0.10, tradeDiscount: 0.10 },
    bonusText: "+10% speed · 10% better market prices",
  },
};

// ── SKILLS ───────────────────────────────────────────────────────────────
export type SkillBranch = "offense" | "defense" | "utility";
export type SkillId =
  | "off-power" | "off-rapid" | "off-crit" | "off-pierce"
  | "def-shield" | "def-regen" | "def-armor" | "def-bulwark"
  | "ut-cargo" | "ut-thrust" | "ut-salvage" | "ut-droneops";

export type SkillNode = {
  id: SkillId;
  branch: SkillBranch;
  name: string;
  description: string;
  maxRank: number;
  cost: number;            // skill points per rank
  requires?: SkillId;      // gate
  pos: { row: number; col: number }; // grid layout per branch
  icon: string;
};

export const SKILL_NODES: SkillNode[] = [
  // OFFENSE
  { id: "off-power",  branch: "offense", name: "Overcharge",       description: "+5% laser damage per rank.",                 maxRank: 5, cost: 1, pos: { row: 0, col: 0 }, icon: "⚡" },
  { id: "off-rapid",  branch: "offense", name: "Rapid Fire",       description: "-5% laser cooldown per rank.",               maxRank: 5, cost: 1, pos: { row: 1, col: 0 }, icon: "≫", requires: "off-power" },
  { id: "off-crit",   branch: "offense", name: "Critical Strikes", description: "+3% crit chance per rank.",                  maxRank: 5, cost: 1, pos: { row: 2, col: 0 }, icon: "✦", requires: "off-rapid" },
  { id: "off-pierce", branch: "offense", name: "Phase Pierce",     description: "Lasers gain a small splash radius (rank x4 px).", maxRank: 3, cost: 2, pos: { row: 3, col: 0 }, icon: "✺", requires: "off-crit" },
  // DEFENSE
  { id: "def-shield", branch: "defense", name: "Shield Capacitors",description: "+8% max shield per rank.",                   maxRank: 5, cost: 1, pos: { row: 0, col: 0 }, icon: "◈" },
  { id: "def-regen",  branch: "defense", name: "Recharge Matrix",  description: "+15% shield regen per rank.",                maxRank: 5, cost: 1, pos: { row: 1, col: 0 }, icon: "↺", requires: "def-shield" },
  { id: "def-armor",  branch: "defense", name: "Reinforced Hull",  description: "+8% max hull per rank.",                     maxRank: 5, cost: 1, pos: { row: 2, col: 0 }, icon: "▣", requires: "def-regen" },
  { id: "def-bulwark",branch: "defense", name: "Bulwark Protocol", description: "Reduce all damage by 4% per rank.",          maxRank: 3, cost: 2, pos: { row: 3, col: 0 }, icon: "⛨", requires: "def-armor" },
  // UTILITY
  { id: "ut-cargo",   branch: "utility", name: "Cargo Frame",      description: "+15% cargo capacity per rank.",              maxRank: 5, cost: 1, pos: { row: 0, col: 0 }, icon: "▤" },
  { id: "ut-thrust",  branch: "utility", name: "Thruster Tuning",  description: "+5% top speed per rank.",                    maxRank: 5, cost: 1, pos: { row: 1, col: 0 }, icon: "➤", requires: "ut-cargo" },
  { id: "ut-salvage", branch: "utility", name: "Scavenger",        description: "+1 bonus credits per rank from kills (multiplied by enemy honor).", maxRank: 5, cost: 1, pos: { row: 2, col: 0 }, icon: "$", requires: "ut-thrust" },
  { id: "ut-droneops",branch: "utility", name: "Drone Ops",        description: "+1 drone slot per rank (max 3).",            maxRank: 3, cost: 2, pos: { row: 3, col: 0 }, icon: "✦", requires: "ut-salvage" },
];

// ── MISSIONS & MILESTONES ────────────────────────────────────────────────
export type MissionKind =
  | "kill-any" | "kill-zone" | "mine" | "earn-credits" | "spend-credits" | "warp-zones" | "level-up";

export type Mission = {
  id: string;
  kind: MissionKind;
  title: string;
  description: string;
  target: number;
  rewardCredits: number;
  rewardExp: number;
  rewardHonor: number;
  zoneFilter?: ZoneId;
};

export type ActiveMission = Mission & {
  progress: number;
  completed: boolean;
  claimed: boolean;
};

export type Milestones = {
  totalKills: number;
  totalMined: number;
  totalCreditsEarned: number;
  totalWarps: number;
  totalDeaths: number;
  bossKills: number;
};

export const MILESTONE_TIERS: { kind: keyof Milestones; name: string; tiers: number[]; rewardPerTier: number; color: string; icon: string }[] = [
  { kind: "totalKills",         name: "Combat Veteran",  tiers: [10, 50, 200, 1000, 5000], rewardPerTier: 500, color: "#ff5c6c", icon: "⚔" },
  { kind: "totalMined",         name: "Belt Driller",    tiers: [10, 100, 500, 2500, 10000], rewardPerTier: 400, color: "#c69060", icon: "▰" },
  { kind: "totalCreditsEarned", name: "Tycoon",          tiers: [1000, 10000, 100000, 1000000, 10000000], rewardPerTier: 600, color: "#ffd24a", icon: "$" },
  { kind: "totalWarps",         name: "Pathfinder",      tiers: [5, 25, 100, 500, 2000], rewardPerTier: 300, color: "#ff5cf0", icon: "▶" },
  { kind: "bossKills",          name: "Dread Hunter",    tiers: [1, 5, 20, 50, 200], rewardPerTier: 1500, color: "#ff8a4e", icon: "✪" },
];

export const DAILY_MISSION_POOL: Mission[] = [
  { id: "d-kills-10",   kind: "kill-any", title: "Daily: Bug Sweep",      description: "Eliminate 10 hostiles anywhere.",          target: 10,    rewardCredits: 600,  rewardExp: 200, rewardHonor: 8 },
  { id: "d-kills-25",   kind: "kill-any", title: "Daily: Patrol Duty",    description: "Eliminate 25 hostiles anywhere.",          target: 25,    rewardCredits: 1500, rewardExp: 500, rewardHonor: 18 },
  { id: "d-mine-30",    kind: "mine",     title: "Daily: Belt Run",       description: "Mine 30 units of any ore.",                target: 30,    rewardCredits: 800,  rewardExp: 250, rewardHonor: 6 },
  { id: "d-credits-5k", kind: "earn-credits", title: "Daily: Hustler",    description: "Earn 5,000 credits.",                       target: 5000,  rewardCredits: 1500, rewardExp: 300, rewardHonor: 10 },
  { id: "d-warp-3",     kind: "warp-zones",  title: "Daily: Sector Rounds", description: "Warp between sectors 3 times.",         target: 3,     rewardCredits: 700,  rewardExp: 200, rewardHonor: 6 },
  { id: "d-spend-3k",   kind: "spend-credits", title: "Daily: Resupply",  description: "Spend 3,000 credits at stations.",         target: 3000,  rewardCredits: 600,  rewardExp: 150, rewardHonor: 4 },
  { id: "d-zone-alpha", kind: "kill-zone", title: "Daily: Alpha Sweep",   description: "Kill 8 hostiles in Alpha Sector.",         target: 8,     rewardCredits: 700,  rewardExp: 220, rewardHonor: 7,  zoneFilter: "alpha" },
  { id: "d-zone-nebula",kind: "kill-zone", title: "Daily: Nebula Cleanup",description: "Kill 6 hostiles in Veil Nebula.",          target: 6,     rewardCredits: 1400, rewardExp: 400, rewardHonor: 14, zoneFilter: "nebula" },
];

// ── EVENTS ───────────────────────────────────────────────────────────────
export type GameEvent = {
  id: string;
  title: string;
  body: string;
  startedAt: number;
  ttl: number;
  kind: "boss" | "global" | "info";
  zone?: ZoneId;
  color: string;
};

export type Enemy = {
  id: string;
  type: EnemyType;
  behavior: EnemyBehavior;
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
  honor: number;
  loot?: { resourceId: ResourceId; qty: number };
  color: string;
  size: number;
  isBoss?: boolean;
  bossPhase?: number;       // 0-2, segments
  combo?: { stacks: number; ttl: number };  // player combo mark
  hitFlash?: number;        // 0..1 brief white tint after hit
  // ranged kiting helpers
  burstCd?: number;
  burstShots?: number;
};

export type Projectile = {
  id: string;
  pos: Vec2;
  vel: Vec2;
  damage: number;
  ttl: number;
  fromPlayer: boolean;
  color: string;
  size: number;
  crit?: boolean;
  aoeRadius?: number;       // splash radius if set
  homing?: boolean;
};

export type Floater = {
  id: string;
  text: string;
  color: string;
  pos: Vec2;
  vy: number;
  ttl: number;
  maxTtl: number;
  scale: number;            // text scale (crits start big)
  bold?: boolean;
};

export type Particle = {
  id: string;
  pos: Vec2;
  vel: Vec2;
  ttl: number;
  maxTtl: number;
  color: string;
  size: number;
  kind?: "trail" | "spark" | "ring" | "engine";
};

export type StationKind = "hub" | "trade" | "mining" | "military" | "outpost";

export type Station = {
  id: string;
  name: string;
  pos: Vec2;
  zone: ZoneId;
  kind: StationKind;
  description: string;
  /** Per-resource price modifiers vs basePrice (1.0 = base). */
  prices: Partial<Record<ResourceId, number>>;
  /** Controlling faction (gives bonuses to aligned players). */
  controlledBy: FactionId;
};

export type Asteroid = {
  id: string;
  pos: Vec2;
  hp: number;
  hpMax: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  zone: ZoneId;
  yields: ResourceId;
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
    hullMax: 100, shieldMax: 50, baseSpeed: 180, baseDamage: 8,
    cargoMax: 20, droneSlots: 1, price: 0,
    description: "Cheap, nimble, easy to lose.",
    color: "#7ad8ff", accent: "#0a1230",
  },
  wasp: {
    id: "wasp",
    name: "Wasp Interceptor",
    hullMax: 90, shieldMax: 70, baseSpeed: 240, baseDamage: 10,
    cargoMax: 14, droneSlots: 1, price: 4500,
    description: "Glass cannon. Fastest hull in the sector.",
    color: "#ffe25c", accent: "#3a2a08",
  },
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    hullMax: 180, shieldMax: 120, baseSpeed: 160, baseDamage: 14,
    cargoMax: 40, droneSlots: 2, price: 12000,
    description: "All-rounder hull. Solid in any zone.",
    color: "#5cff8a", accent: "#0a2a14",
  },
  reaver: {
    id: "reaver",
    name: "Reaver Mk-II",
    hullMax: 160, shieldMax: 140, baseSpeed: 200, baseDamage: 18,
    cargoMax: 30, droneSlots: 2, price: 24000,
    description: "Swift hunter. Built for raids.",
    color: "#ff8a4e", accent: "#3a1a08",
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidian Reaver",
    hullMax: 220, shieldMax: 180, baseSpeed: 200, baseDamage: 22,
    cargoMax: 30, droneSlots: 3, price: 48000,
    description: "Predator of the deep lanes.",
    color: "#ff5cf0", accent: "#2a0a30",
  },
  marauder: {
    id: "marauder",
    name: "Marauder",
    hullMax: 280, shieldMax: 200, baseSpeed: 170, baseDamage: 26,
    cargoMax: 60, droneSlots: 3, price: 78000,
    description: "Heavy gunship with cargo to spare.",
    color: "#aaff5c", accent: "#1a3008",
  },
  phalanx: {
    id: "phalanx",
    name: "Phalanx Cruiser",
    hullMax: 340, shieldMax: 280, baseSpeed: 150, baseDamage: 24,
    cargoMax: 70, droneSlots: 4, price: 110000,
    description: "Drone-carrier cruiser. Project power through the swarm.",
    color: "#4ee2ff", accent: "#08203a",
  },
  titan: {
    id: "titan",
    name: "Titan Bulwark",
    hullMax: 400, shieldMax: 300, baseSpeed: 130, baseDamage: 30,
    cargoMax: 80, droneSlots: 3, price: 140000,
    description: "Walking fortress. Slow but devastating.",
    color: "#ffd24a", accent: "#3a2a08",
  },
  leviathan: {
    id: "leviathan",
    name: "Leviathan Dreadnought",
    hullMax: 600, shieldMax: 480, baseSpeed: 110, baseDamage: 42,
    cargoMax: 120, droneSlots: 5, price: 320000,
    description: "Capital-class warship. Sectors part before it.",
    color: "#ff5c6c", accent: "#3a0810",
  },
  specter: {
    id: "specter",
    name: "Specter Phaseframe",
    hullMax: 220, shieldMax: 360, baseSpeed: 220, baseDamage: 34,
    cargoMax: 40, droneSlots: 4, price: 480000,
    description: "Phase-shifted void hull. The endgame chassis.",
    color: "#b06cff", accent: "#15083a",
  },
};

export const UPGRADE_COST = (tier: number) => 500 * tier * tier;
export const EXP_FOR_LEVEL = (level: number) => 100 * level * level;

export const ENEMY_DEFS: Record<
  EnemyType,
  Omit<Enemy, "id" | "pos" | "vel" | "angle" | "hull" | "fireCd">
> = {
  scout: {
    type: "scout", behavior: "fast",
    hullMax: 30, damage: 4, speed: 130, exp: 10, credits: 25, honor: 1,
    color: "#ff8866", size: 10,
    loot: { resourceId: "scrap", qty: 1 },
  },
  raider: {
    type: "raider", behavior: "chaser",
    hullMax: 70, damage: 9, speed: 75, exp: 28, credits: 80, honor: 3,
    color: "#ff4466", size: 13,
    loot: { resourceId: "plasma", qty: 1 },
  },
  destroyer: {
    type: "destroyer", behavior: "tank",
    hullMax: 220, damage: 18, speed: 50, exp: 70, credits: 220, honor: 8,
    color: "#aa44ff", size: 18,
    loot: { resourceId: "warp", qty: 1 },
  },
  voidling: {
    type: "voidling", behavior: "ranged",
    hullMax: 110, damage: 16, speed: 90, exp: 90, credits: 280, honor: 12,
    color: "#44ffe2", size: 14,
    loot: { resourceId: "void", qty: 1 },
  },
  dread: {
    type: "dread", behavior: "tank",
    hullMax: 380, damage: 28, speed: 45, exp: 180, credits: 600, honor: 25,
    color: "#ffaa22", size: 24,
    loot: { resourceId: "dread", qty: 1 },
  },
};

export const QUEST_POOL: Quest[] = [
  { id: "q-alpha-scouts", title: "Sweep the Lanes", description: "Pirate scouts have been raiding traders in Alpha Sector. Eliminate them.", zone: "alpha", killType: "scout", killCount: 5, rewardCredits: 350, rewardExp: 80, rewardHonor: 5 },
  { id: "q-alpha-raiders", title: "Raider Bounty", description: "A raider crew is harassing the Helix Station. Take them down.", zone: "alpha", killType: "raider", killCount: 3, rewardCredits: 600, rewardExp: 140, rewardHonor: 10 },
  { id: "q-nebula-raiders", title: "Veil Cleanup", description: "The Veil Nebula is thick with raider holdouts. Clear them.", zone: "nebula", killType: "raider", killCount: 6, rewardCredits: 1400, rewardExp: 320, rewardHonor: 18 },
  { id: "q-nebula-destroyers", title: "Hunt the Hunters", description: "Hostile destroyers prowl the Veil. End their patrol.", zone: "nebula", killType: "destroyer", killCount: 3, rewardCredits: 2400, rewardExp: 600, rewardHonor: 30 },
  { id: "q-crimson-destroyers", title: "Crimson Purge", description: "Destroyers have established a beachhead in Crimson Reach.", zone: "crimson", killType: "destroyer", killCount: 5, rewardCredits: 4000, rewardExp: 1100, rewardHonor: 50 },
  { id: "q-crimson-dread", title: "Bring Down a Dread", description: "A Dread-class warship looms in Crimson Reach. Send it home in pieces.", zone: "crimson", killType: "dread", killCount: 1, rewardCredits: 6000, rewardExp: 1800, rewardHonor: 100 },
  { id: "q-void-voidlings", title: "Voidling Eradication", description: "Voidlings flicker between dimensions in The Void. Banish them.", zone: "void", killType: "voidling", killCount: 6, rewardCredits: 9000, rewardExp: 2600, rewardHonor: 140 },
  { id: "q-void-dread", title: "Apex Predator", description: "A Dread haunts The Void. Become its end.", zone: "void", killType: "dread", killCount: 2, rewardCredits: 18000, rewardExp: 5000, rewardHonor: 280 },
];

// ── ECONOMY ────────────────────────────────────────────────────────────────
export const RESOURCES: Record<ResourceId, Resource> = {
  scrap:    { id: "scrap",    name: "Scrap Plating", basePrice: 12,  glyph: "▤", color: "#aaaaaa", description: "Salvaged hull fragments. Cheap but always in demand." },
  plasma:   { id: "plasma",   name: "Plasma Cell",   basePrice: 35,  glyph: "◊", color: "#ff8866", description: "Volatile energy cell from raider weapons." },
  warp:     { id: "warp",     name: "Warp Coil",     basePrice: 95,  glyph: "@", color: "#aa44ff", description: "Used for FTL drives. Worth more far from the frontier." },
  void:     { id: "void",     name: "Void Crystal",  basePrice: 160, glyph: "✦", color: "#44ffe2", description: "Crystalline matter only found near voidlings." },
  dread:    { id: "dread",    name: "Dread Core",    basePrice: 420, glyph: "▣", color: "#ffaa22", description: "Reactor core ripped from a Dread. Highly regulated." },
  iron:     { id: "iron",     name: "Iron Ore",      basePrice: 18,  glyph: "▰", color: "#c69060", description: "Mined from asteroids. Foundation of every shipyard." },
  lumenite: { id: "lumenite", name: "Lumenite",      basePrice: 80,  glyph: "❖", color: "#7ad8ff", description: "Glowing crystalline ore. Used in shield generators." },
  medpack:  { id: "medpack",  name: "Med Packs",     basePrice: 60,  glyph: "✚", color: "#5cff8a", description: "Field-grade medical kits." },
  synth:    { id: "synth",    name: "Synth Fuel",    basePrice: 28,  glyph: "≈", color: "#ffd24a", description: "Refined fuel. Stations always need more." },
  quantum:  { id: "quantum",  name: "Quantum Chip",  basePrice: 220, glyph: "⌬", color: "#ff5cf0", description: "Bleeding-edge processors. Specialty cargo." },
};

export const STATIONS: Station[] = [
  // alpha
  { id: "helix",   name: "Helix Station",  pos: { x: 0, y: 0 },     zone: "alpha",   kind: "hub",
    description: "Capital hub of the Alpha Frontier.", controlledBy: "aurora",
    prices: { scrap: 1.0, plasma: 1.0, iron: 0.95, synth: 0.9, medpack: 1.1, lumenite: 1.0, warp: 1.1, void: 1.2, dread: 1.1, quantum: 1.0 } },
  { id: "iron-belt", name: "Iron Belt Refinery", pos: { x: -900, y: -200 }, zone: "alpha", kind: "mining",
    description: "Refinery sitting on a rich mineral belt.", controlledBy: "aurora",
    prices: { iron: 0.6, lumenite: 0.7, scrap: 1.2, synth: 1.0, medpack: 1.1, plasma: 1.05 } },
  // nebula
  { id: "veiled",   name: "Veiled Outpost", pos: { x: 200, y: -800 }, zone: "nebula",  kind: "outpost",
    description: "A mining outpost run by a raider truce.", controlledBy: "syndicate",
    prices: { plasma: 0.7, warp: 0.85, scrap: 1.2, synth: 1.15, medpack: 1.2, void: 1.3 } },
  { id: "azure-port", name: "Azure Trade Port", pos: { x: -600, y: -1200 }, zone: "nebula", kind: "trade",
    description: "Bustling free-port. Buys high, sells fair.", controlledBy: "syndicate",
    prices: { quantum: 0.7, lumenite: 0.85, dread: 0.9, void: 0.95, plasma: 1.2, warp: 1.25, iron: 1.15, scrap: 1.25 } },
  // crimson
  { id: "ember",    name: "Ember Citadel",  pos: { x: -600, y: 400 },  zone: "crimson", kind: "military",
    description: "Crimson Reach naval citadel. Premium for war goods.", controlledBy: "crimson",
    prices: { dread: 1.3, warp: 1.3, plasma: 1.4, medpack: 0.85, synth: 0.95, quantum: 1.2 } },
  { id: "scarlet-yard", name: "Scarlet Shipyards", pos: { x: 1100, y: 800 }, zone: "crimson", kind: "trade",
    description: "Capital ship construction yards.", controlledBy: "crimson",
    prices: { iron: 1.4, scrap: 1.35, lumenite: 1.2, plasma: 1.1, dread: 0.85 } },
  // void
  { id: "echo",     name: "Echo Anchorage", pos: { x: 0, y: -300 },    zone: "void",    kind: "outpost",
    description: "Last refuge in The Void.", controlledBy: "syndicate",
    prices: { void: 0.6, dread: 1.2, quantum: 1.4, medpack: 1.3, synth: 1.2 } },
  { id: "obsidian-port", name: "Obsidian Free Port", pos: { x: 900, y: 600 }, zone: "void", kind: "trade",
    description: "A trade haven for ghosts and smugglers.", controlledBy: "syndicate",
    prices: { quantum: 0.55, void: 1.4, dread: 1.4, lumenite: 1.3, warp: 1.2 } },
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
  "Nyx_77","VoidPilot","StarbornAce","RogueComet","Hex.Drift","Aurora",
  "Cipher","Nebula_Q","Solenoid","Vanta","Quasar","Mira-7","Helios",
  "Lumen","Apex","Drekk",
];

export const FAKE_CLANS = [
  "Iron Wake","Crimson Veil","Pale Horizon","Null Sector","Aegis Pact","Starforge",
];

// ── DRONES ────────────────────────────────────────────────────────────────
export const DRONE_DEFS: Record<DroneKind, DroneDef> = {
  "combat-i":  { id: "combat-i",  name: "Hornet Combat Drone",  price: 6000,  damageBonus: 6,  shieldBonus: 0,  hullBonus: 0,  fireRate: 0.7, color: "#ff5c6c", description: "Light auto-cannon drone. Fires at hostiles in range." },
  "combat-ii": { id: "combat-ii", name: "Wasp Mk-II Drone",     price: 22000, damageBonus: 14, shieldBonus: 0,  hullBonus: 0,  fireRate: 1.1, color: "#ff8a4e", description: "Heavy combat drone with rapid pulse cannons." },
  "shield-i":  { id: "shield-i",  name: "Aegis Shield Drone",   price: 9000,  damageBonus: 0,  shieldBonus: 60, hullBonus: 20, fireRate: 0,   color: "#4ee2ff", description: "Projects an additional shield bubble. Boosts your shield max." },
  "shield-ii": { id: "shield-ii", name: "Bulwark Shield Drone", price: 28000, damageBonus: 0,  shieldBonus: 140, hullBonus: 40, fireRate: 0,  color: "#7ad8ff", description: "Capital-grade defense drone. Massive shield bonus." },
  "salvage":   { id: "salvage",   name: "Salvager Drone",       price: 14000, damageBonus: 2,  shieldBonus: 30, hullBonus: 30, fireRate: 0.4, color: "#5cff8a", description: "Retrieves extra cargo from kills, light defenses." },
};

// ── HONOR RANKS ───────────────────────────────────────────────────────────
export const HONOR_RANKS: HonorRank[] = [
  { index: 0, name: "Recruit",     minHonor: 0,      color: "#7a8ad8", symbol: "·",  pips: 0 },
  { index: 1, name: "Cadet",       minHonor: 30,     color: "#7ad8ff", symbol: "▿",  pips: 1 },
  { index: 2, name: "Pilot",       minHonor: 120,    color: "#5cff8a", symbol: "◇",  pips: 1 },
  { index: 3, name: "Lieutenant",  minHonor: 350,    color: "#aaff5c", symbol: "◆",  pips: 2 },
  { index: 4, name: "Veteran",     minHonor: 800,    color: "#ffd24a", symbol: "★",  pips: 2 },
  { index: 5, name: "Commander",   minHonor: 2000,   color: "#ff8a4e", symbol: "★",  pips: 3 },
  { index: 6, name: "Captain",     minHonor: 5000,   color: "#ff5c6c", symbol: "✪",  pips: 3 },
  { index: 7, name: "Admiral",     minHonor: 12000,  color: "#ff5cf0", symbol: "✪",  pips: 4 },
  { index: 8, name: "Warlord",     minHonor: 30000,  color: "#b06cff", symbol: "✸",  pips: 4 },
  { index: 9, name: "Legend",      minHonor: 80000,  color: "#fff75c", symbol: "✺",  pips: 5 },
];

export function rankFor(honor: number): HonorRank {
  let r = HONOR_RANKS[0];
  for (const x of HONOR_RANKS) if (honor >= x.minHonor) r = x;
  return r;
}

// ── LASERS BY TIER ────────────────────────────────────────────────────────
export const LASER_TIER_COLOR = (tier: number): string => {
  if (tier <= 2) return "#4ee2ff";
  if (tier <= 4) return "#5cff8a";
  if (tier <= 6) return "#ff5cf0";
  if (tier === 7) return "#ffd24a";
  return "#ff5c6c"; // tier 8 elite
};

export const LASER_TIER_NAME = (tier: number): string => {
  if (tier <= 2) return "Pulse";
  if (tier <= 4) return "Plasma";
  if (tier <= 6) return "Phase";
  if (tier === 7) return "Solar";
  return "Singularity";
};
