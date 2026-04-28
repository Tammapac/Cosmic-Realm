export type Vec2 = { x: number; y: number };

export type ZoneId =
  | "alpha" | "nebula" | "crimson" | "void" | "forge"
  | "corona" | "fracture" | "abyss" | "marsdepth" | "maelstrom"
  | "venus1" | "venus2" | "venus3" | "venus4" | "venus5"
  | "danger1" | "danger2" | "danger3" | "danger4" | "danger5";

export type Zone = {
  id: ZoneId;
  name: string;
  label: string;
  faction: "earth" | "mars" | "venus";
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
  | "specter"
  | "colossus"
  | "harbinger"
  | "eclipse"
  | "sovereign"
  | "apex";

export type ShipClass = {
  id: ShipClassId;
  name: string;
  hullMax: number;
  shieldMax: number;
  baseSpeed: number;
  baseDamage: number;
  cargoMax: number;
  droneSlots: number;
  slots: { weapon: number; generator: number; module: number };
  price: number;
  description: string;
  color: string;
  accent: string;
};

// ── MODULES (replaces tier upgrade system) ────────────────────────────────
export type ModuleSlot = "weapon" | "generator" | "module";
export type ModuleRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ModuleStats = {
  damage?: number;
  fireRate?: number;        // multiplier (1.2 = +20% rate)
  critChance?: number;      // additive (0.05 = +5%)
  shieldMax?: number;
  shieldRegen?: number;
  hullMax?: number;
  speed?: number;
  damageReduction?: number; // 0..1
  shieldAbsorb?: number;   // additive, base 0.5 + this = shield absorption %
  cargoBonus?: number;
  lootBonus?: number;
  aoeRadius?: number;
  ammoCapacity?: number;    // additive bonus to max ammo per rocket weapon
  miningBonus?: number;     // multiplier bonus to mining DPS (0.5 = +50%)
};

export type WeaponKind = "laser" | "rocket";

export type ModuleDef = {
  id: string;
  slot: ModuleSlot;
  name: string;
  description: string;
  rarity: ModuleRarity;
  color: string;
  glyph: string;
  stats: ModuleStats;
  price: number;
  tier: number; // 1..5 power level
  weaponKind?: WeaponKind; // only for weapon slot modules
  firingPattern?: string;
};

export type ModuleItem = {
  instanceId: string;
  defId: string;
};

export type EquippedSlots = {
  weapon: (string | null)[];
  generator: (string | null)[];
  module: (string | null)[];
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
  | "quantum"
  // trade goods (station-to-station economy)
  | "food"
  | "medicine"
  | "luxury"
  | "nanite"
  | "bio-matter"
  | "precursor"
  | "fuel-cell"
  | "contraband"
  | "relic"
  | "exotic"
  | "artifacts"
  | "spice"
  | "silk"
  | "ore"
  | "data-core"
  | "cloning-gel"
  | "medical-serum"
  | "fusion-lattice"
  | "star-map"
  | "blackglass"
  | "titanium"
  | "cryo-fluid"
  | "neural-chip"
  | "dark-matter"
  | "plasma-coil"
  | "bio-crystal"
  // mineable ores (zone-specific asteroid drops)
  | "copper"
  | "cobalt"
  | "crystal-shard"
  | "palladium"
  | "helium-3"
  | "iridium"
  | "sulfur"
  | "obsidian"
  | "refined-alloy"
  | "crystal-matrix"
  | "fusion-core"
  | "void-steel"
  | "nano-compound"
  | "plasma-cell";

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

// ── CONSUMABLES ────────────────────────────────────────────────────────────
export type ConsumableId =
  | "rocket-ammo"
  | "repair-bot"
  | "combat-drone-pod"
  | "shield-charge"
  | "emp-burst"
  | "afterburn-fuel";

export type ConsumableDef = {
  id: ConsumableId;
  name: string;
  icon: string;
  description: string;
  price: number;
  cooldown: number;   // seconds; 0 = no cooldown
  stackMax: number;
  color: string;
};

export const CONSUMABLE_DEFS: Record<ConsumableId, ConsumableDef> = {
  "rocket-ammo":       { id: "rocket-ammo",       name: "Rocket Salvo",    icon: "◈", description: "Fire 3 homing rockets instantly.",           price: 400,  cooldown: 0,  stackMax: 20, color: "#ff8a4e" },
  "repair-bot":        { id: "repair-bot",         name: "Repair Bot",      icon: "⚙", description: "Restore 40 hull over 8 seconds.",             price: 350,  cooldown: 15, stackMax: 10, color: "#5cff8a" },
  "combat-drone-pod":  { id: "combat-drone-pod",   name: "Drone Pod",       icon: "◉", description: "Deploy an extra combat drone for 30 s.",      price: 600,  cooldown: 30, stackMax: 5,  color: "#4ee2ff" },
  "shield-charge":     { id: "shield-charge",      name: "Shield Charge",   icon: "⬡", description: "Instantly restore 60 % of max shield.",       price: 280,  cooldown: 20, stackMax: 10, color: "#4ee2ff" },
  "emp-burst":         { id: "emp-burst",           name: "EMP Burst",       icon: "⚡", description: "Stun all enemies within 500 units for 3 s.", price: 500,  cooldown: 0,  stackMax: 8,  color: "#ffd24a" },
  "afterburn-fuel":    { id: "afterburn-fuel",      name: "Afterburn",       icon: "≫", description: "Triple ship speed for 5 seconds.",            price: 250,  cooldown: 0,  stackMax: 12, color: "#ff5cf0" },
};

export type Player = {
  name: string;
  shipClass: ShipClassId;
  inventory: ModuleItem[];
  equipped: EquippedSlots;
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
  // Consumables & hotbar
  consumables: Partial<Record<ConsumableId, number>>;
  hotbar: (ConsumableId | null)[];   // 8 slots
  ammo: Record<RocketAmmoType, number>; // laser ammo pool per type
  activeAmmoType: RocketAmmoType;        // active laser ammo type
  rocketAmmo: Record<RocketMissileType, number>; // rocket ammo pool per type
  activeRocketAmmoType: RocketMissileType;       // active rocket ammo type
  autoRestock: boolean;
  autoRepairHull: boolean;
  autoShieldRecharge: boolean;
  dungeonClears: Partial<Record<DungeonId, number>>;     // how many times each dungeon has been cleared
  dungeonBestTimes: Partial<Record<DungeonId, number>>;  // fastest clear time in ms per dungeon
};

// ── FACTIONS ─────────────────────────────────────────────────────────────
export type FactionId = "earth" | "mars" | "venus";

export type Faction = {
  id: FactionId;
  name: string;
  tag: string;
  motto: string;
  description: string;
  color: string;
  bonus: { damage?: number; speed?: number; shieldRegen?: number; tradeDiscount?: number; lootBonus?: number };
  bonusText: string;
  startZone: ZoneId;
};

export const FACTIONS: Record<FactionId, Faction> = {
  earth: {
    id: "earth", name: "Earth Imperial Command", tag: "EIC", motto: "Order through strength.",
    description: "The disciplined military force of Earth. Renowned for shielding tech and armored cruisers.",
    color: "#4ea8ff",
    bonus: { shieldRegen: 1.5, tradeDiscount: 0.05 },
    bonusText: "+50% shield regen · 5% trade discount at EIC stations",
    startZone: "alpha",
  },
  mars: {
    id: "mars", name: "Mars Mining Operations", tag: "MMO", motto: "Forge the frontier.",
    description: "The industrial war machine of Mars. Heavy guns, relentless firepower, and iron resolve.",
    color: "#ff8a4e",
    bonus: { damage: 0.10, lootBonus: 1 },
    bonusText: "+10% laser damage · +1 bonus loot per kill",
    startZone: "corona",
  },
  venus: {
    id: "venus", name: "Venus Revolutionary Unit", tag: "VRU", motto: "Speed is survival.",
    description: "The cunning traders and pilots of Venus. Faster ships, deeper cargo, smarter deals.",
    color: "#5cff8a",
    bonus: { speed: 0.10, tradeDiscount: 0.10 },
    bonusText: "+10% speed · 10% better market prices",
    startZone: "venus1",
  },
};

// ── SKILLS ───────────────────────────────────────────────────────────────
export type SkillBranch = "offense" | "defense" | "utility" | "engineering";
export type SkillId =
  | "off-power" | "off-rapid" | "off-crit" | "off-pierce"
  | "off-snipe" | "off-volley" | "off-execute" | "off-void"
  | "def-shield" | "def-regen" | "def-armor" | "def-bulwark"
  | "def-barrier" | "def-nano" | "def-fortress" | "def-reflect"
  | "ut-cargo" | "ut-thrust" | "ut-salvage" | "ut-droneops"
  | "ut-trade" | "ut-scan" | "ut-warp" | "ut-drone2"
  | "eng-coolant" | "eng-capacitor" | "eng-targeting" | "eng-warp-core"
  | "eng-overdrive" | "eng-singularity";

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
  // ── OFFENSE ──────────────────────────────────────────────────────────────
  { id: "off-power",   branch: "offense", name: "Overcharge",        description: "+10% laser damage per rank.",                       maxRank: 5, cost: 1, pos: { row: 0, col: 0 }, icon: "⚡" },
  { id: "off-snipe",   branch: "offense", name: "Sniper Focus",      description: "+8% damage & +4% crit per rank.",                  maxRank: 5, cost: 1, pos: { row: 0, col: 1 }, icon: "◎", requires: "off-power" },
  { id: "off-void",    branch: "offense", name: "Void Rounds",       description: "+8% damage vs Dread & Voidling per rank.",          maxRank: 3, cost: 2, pos: { row: 0, col: 2 }, icon: "✺", requires: "off-snipe" },
  { id: "off-rapid",   branch: "offense", name: "Rapid Fire",        description: "+15% fire rate per rank.",                          maxRank: 5, cost: 1, pos: { row: 1, col: 0 }, icon: "≫", requires: "off-power" },
  { id: "off-volley",  branch: "offense", name: "Volley Protocol",   description: "Fire rate burst: +20% fire rate per rank.",        maxRank: 3, cost: 1, pos: { row: 1, col: 1 }, icon: "⋙", requires: "off-rapid" },
  { id: "off-crit",    branch: "offense", name: "Critical Strikes",  description: "+5% crit chance per rank.",                        maxRank: 5, cost: 1, pos: { row: 2, col: 0 }, icon: "✦", requires: "off-rapid" },
  { id: "off-execute", branch: "offense", name: "Execute",           description: "+20% damage vs enemies below 25% HP per rank.",    maxRank: 3, cost: 2, pos: { row: 2, col: 1 }, icon: "⚔", requires: "off-crit" },
  { id: "off-pierce",  branch: "offense", name: "Phase Pierce",      description: "Shots gain splash radius (rank×6 px).",            maxRank: 3, cost: 2, pos: { row: 3, col: 0 }, icon: "✸", requires: "off-crit" },

  // ── DEFENSE ──────────────────────────────────────────────────────────────
  { id: "def-shield",  branch: "defense", name: "Shield Capacitors", description: "+15% max shield per rank.",                         maxRank: 5, cost: 1, pos: { row: 0, col: 0 }, icon: "◈" },
  { id: "def-barrier", branch: "defense", name: "Energy Barrier",    description: "+20% max shield per rank.",                        maxRank: 3, cost: 1, pos: { row: 0, col: 1 }, icon: "◇", requires: "def-shield" },
  { id: "def-fortress",branch: "defense", name: "Fortress Mode",     description: "-15% damage taken when shield > 50%, per rank.",   maxRank: 3, cost: 2, pos: { row: 0, col: 2 }, icon: "⛨", requires: "def-barrier" },
  { id: "def-regen",   branch: "defense", name: "Recharge Matrix",   description: "+20% shield regen per rank.",                      maxRank: 5, cost: 1, pos: { row: 1, col: 0 }, icon: "↺", requires: "def-shield" },
  { id: "def-nano",    branch: "defense", name: "Nano-Repair",       description: "+15% shield regen & +10% hull per rank.",           maxRank: 3, cost: 2, pos: { row: 1, col: 1 }, icon: "⬡", requires: "def-regen" },
  { id: "def-armor",   branch: "defense", name: "Reinforced Hull",   description: "+15% max hull per rank.",                           maxRank: 5, cost: 1, pos: { row: 2, col: 0 }, icon: "▣", requires: "def-regen" },
  { id: "def-reflect", branch: "defense", name: "Reactive Plating",  description: "+5% chance to reflect 30% of incoming damage.",    maxRank: 3, cost: 2, pos: { row: 2, col: 1 }, icon: "⟲", requires: "def-armor" },
  { id: "def-bulwark", branch: "defense", name: "Bulwark Protocol",  description: "Reduce all damage taken by 8% per rank.",          maxRank: 3, cost: 2, pos: { row: 3, col: 0 }, icon: "⬛", requires: "def-armor" },

  // ── UTILITY ──────────────────────────────────────────────────────────────
  { id: "ut-cargo",    branch: "utility", name: "Cargo Frame",       description: "+15% cargo capacity per rank.",                    maxRank: 5, cost: 1, pos: { row: 0, col: 0 }, icon: "▤" },
  { id: "ut-trade",    branch: "utility", name: "Trade Acumen",      description: "+5% credits from selling cargo per rank.",         maxRank: 3, cost: 1, pos: { row: 0, col: 1 }, icon: "$", requires: "ut-cargo" },
  { id: "ut-scan",     branch: "utility", name: "Deep Scanner",      description: "+8% loot bonus per rank.",                         maxRank: 3, cost: 2, pos: { row: 0, col: 2 }, icon: "❖", requires: "ut-trade" },
  { id: "ut-thrust",   branch: "utility", name: "Thruster Tuning",   description: "+10% top speed per rank.",                          maxRank: 5, cost: 1, pos: { row: 1, col: 0 }, icon: "➤", requires: "ut-cargo" },
  { id: "ut-warp",     branch: "utility", name: "Warp Navigator",    description: "+3% speed & instant warp charge per rank.",        maxRank: 3, cost: 1, pos: { row: 1, col: 1 }, icon: "▶", requires: "ut-thrust" },
  { id: "ut-salvage",  branch: "utility", name: "Scavenger",         description: "+1 bonus credits per kill per rank.",              maxRank: 5, cost: 1, pos: { row: 2, col: 0 }, icon: "↯", requires: "ut-thrust" },
  { id: "ut-drone2",   branch: "utility", name: "Drone Commander",   description: "+30% drone HP & +10% drone damage per rank.",      maxRank: 3, cost: 2, pos: { row: 2, col: 1 }, icon: "✦", requires: "ut-salvage" },
  { id: "ut-droneops", branch: "utility", name: "Drone Ops",         description: "+1 drone slot per rank (max 3).",                  maxRank: 3, cost: 2, pos: { row: 3, col: 0 }, icon: "◆", requires: "ut-salvage" },

  // ── ENGINEERING ──────────────────────────────────────────────────────────
  { id: "eng-coolant",    branch: "engineering", name: "Coolant System",     description: "+15% fire rate & -heat buildup per rank.",      maxRank: 5, cost: 1, pos: { row: 0, col: 0 }, icon: "❄" },
  { id: "eng-capacitor",  branch: "engineering", name: "Power Capacitor",    description: "+10% damage & +10% shield regen per rank.",      maxRank: 5, cost: 1, pos: { row: 1, col: 0 }, icon: "◉", requires: "eng-coolant" },
  { id: "eng-targeting",  branch: "engineering", name: "Target Computer",    description: "+8% crit chance & rockets track better.",       maxRank: 3, cost: 1, pos: { row: 2, col: 0 }, icon: "⊕", requires: "eng-capacitor" },
  { id: "eng-warp-core",  branch: "engineering", name: "Warp Core Shunt",    description: "+15% speed per rank from generator overclock.",  maxRank: 3, cost: 2, pos: { row: 3, col: 0 }, icon: "⌬", requires: "eng-targeting" },
  { id: "eng-overdrive",  branch: "engineering", name: "Overdrive Module",   description: "+18% all stats (damage, shield, speed) per rank.", maxRank: 3, cost: 2, pos: { row: 4, col: 0 }, icon: "⚙", requires: "eng-warp-core" },
  { id: "eng-singularity",branch: "engineering", name: "Singularity Core",   description: "Endgame: +30% damage, +25% fire rate, +15% speed.", maxRank: 1, cost: 3, pos: { row: 5, col: 0 }, icon: "✸", requires: "eng-overdrive" },
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
  name?: string;
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
  bossPhase?: number;
  combo?: { stacks: number; ttl: number };
  hitFlash?: number;
  burstCd?: number;
  burstShots?: number;
  stunUntil?: number;
  spawnPos: Vec2;
  aggro: boolean;
};

// ── ROCKET AMMO TYPES ────────────────────────────────────────────────────
export type RocketAmmoType = "x1" | "x2" | "x3" | "x4";

export type RocketAmmoTypeDef = {
  id: RocketAmmoType;
  name: string;
  shortName: string;
  description: string;
  color: string;
  costPerRound: number;
  damageMul: number;     // damage multiplier vs base
  hasAoe: boolean;       // whether it has splash AOE
  stunDuration: number;  // seconds of stun on hit (0 = no stun)
  glyph: string;
};

export const ROCKET_AMMO_TYPE_DEFS: Record<RocketAmmoType, RocketAmmoTypeDef> = {
  "x1": {
    id: "x1", name: "Laser Ammo X1", shortName: "X1",
    description: "Basic laser charge cells.",
    color: "#4ee2ff", costPerRound: 6, damageMul: 1.0, hasAoe: false, stunDuration: 0, glyph: "Ⅰ",
  },
  "x2": {
    id: "x2", name: "Laser Ammo X2", shortName: "X2",
    description: "Improved laser charge cells.",
    color: "#5cff8a", costPerRound: 12, damageMul: 1.15, hasAoe: false, stunDuration: 0, glyph: "Ⅱ",
  },
  "x3": {
    id: "x3", name: "Laser Ammo X3", shortName: "X3",
    description: "High-output laser charge cells.",
    color: "#ffd24a", costPerRound: 18, damageMul: 1.3, hasAoe: false, stunDuration: 0, glyph: "Ⅲ",
  },
  "x4": {
    id: "x4", name: "Laser Ammo X4", shortName: "X4",
    description: "Overclocked laser charge cells.",
    color: "#ff5c6c", costPerRound: 28, damageMul: 1.5, hasAoe: false, stunDuration: 0, glyph: "Ⅳ",
  },
};

export const LASER_AMMO_TYPE_ORDER: RocketAmmoType[] = ["x1", "x2", "x3", "x4"];

export type RocketMissileType = "cl1" | "cl2" | "bm3" | "drock";

export type RocketMissileTypeDef = {
  id: RocketMissileType;
  name: string;
  shortName: string;
  description: string;
  color: string;
  costPerRound: number;
  damageMul: number;
  glyph: string;
};

export const ROCKET_MISSILE_TYPE_DEFS: Record<RocketMissileType, RocketMissileTypeDef> = {
  "cl1": {
    id: "cl1", name: "CL-1 Rocket", shortName: "CL-1",
    description: "Standard warhead rocket.",
    color: "#ff8a4e", costPerRound: 25, damageMul: 1.0, glyph: "①",
  },
  "cl2": {
    id: "cl2", name: "CL-2 Rocket", shortName: "CL-2",
    description: "Enhanced explosive payload.",
    color: "#ff5c6c", costPerRound: 50, damageMul: 2.0, glyph: "②",
  },
  "bm3": {
    id: "bm3", name: "BM-3 Rocket", shortName: "BM-3",
    description: "Heavy blast warhead. Devastating impact.",
    color: "#ffd24a", costPerRound: 90, damageMul: 3.0, glyph: "③",
  },
  "drock": {
    id: "drock", name: "D-ROCK", shortName: "D-ROCK",
    description: "Destroyer-class missile. Maximum destruction.",
    color: "#ff5cf0", costPerRound: 160, damageMul: 4.0, glyph: "④",
  },
};

export const ROCKET_MISSILE_TYPE_ORDER: RocketMissileType[] = ["cl1", "cl2", "bm3", "drock"];

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
  empStun?: number;         // stun duration in seconds (EMP ammo)
  armorPiercing?: boolean;  // AP ammo marker
  weaponKind?: WeaponKind;
  renderOnly?: boolean;
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

export type CargoBox = {
  id: string;
  pos: Vec2;
  resourceId: ResourceId;
  qty: number;
  credits: number;
  exp: number;
  honor: number;
  ttl: number;
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
  rot?: number;
  rotVel?: number;
  kind?: "trail" | "spark" | "ring" | "engine" | "flash" | "debris" | "fireball" | "smoke" | "ember";
  alpha?: number;
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

export type NpcShip = {
  id: string;
  name: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  color: string;
  size: number;
  hull: number;
  hullMax: number;
  speed: number;
  damage: number;
  fireCd: number;
  targetPos: Vec2;
  state: "patrol" | "fight";
  targetEnemyId: string | null;
  zone: ZoneId;
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
  faction: string | null;
  honor: number;
  miningTargetId: string | null;
  hull: number;
  hullMax: number;
  shield: number;
};

export type ChatMessage = {
  id: string;
  channel: "local" | "party" | "clan" | "system";
  from: string;
  text: string;
  time: number;
};

export const ZONES: Record<ZoneId, Zone> = {
  // ── EARTH FACTION (1-1 → 1-5) ────────────────────────────────────────────
  alpha: {
    id: "alpha", name: "Alpha Sector", label: "1-1", faction: "earth",
    bgHueA: "#0a1240", bgHueB: "#020414", enemyTier: 1,
    enemyTypes: ["scout", "raider"],
    description: "Frontier territory. Pirates and scouts patrol the lanes.", unlockLevel: 1,
  },
  nebula: {
    id: "nebula", name: "Veil Nebula", label: "1-2", faction: "earth",
    bgHueA: "#3a0a4a", bgHueB: "#0a0220", enemyTier: 2,
    enemyTypes: ["raider", "destroyer"],
    description: "Glowing dust clouds hide raider strongholds.", unlockLevel: 8,
  },
  crimson: {
    id: "crimson", name: "Crimson Reach", label: "1-3", faction: "earth",
    bgHueA: "#4a0a18", bgHueB: "#1a0208", enemyTier: 3,
    enemyTypes: ["destroyer", "dread"],
    description: "Blood-red expanse. Destroyers hunt in packs.", unlockLevel: 16,
  },
  void: {
    id: "void", name: "The Void", label: "1-4", faction: "earth",
    bgHueA: "#001a1a", bgHueB: "#000508", enemyTier: 4,
    enemyTypes: ["voidling", "dread"],
    description: "An empty stretch where reality bends. Voidlings dwell here.", unlockLevel: 24,
  },
  forge: {
    id: "forge", name: "Iron Forge", label: "1-5", faction: "earth",
    bgHueA: "#3a2210", bgHueB: "#1a0c04", enemyTier: 5,
    enemyTypes: ["dread"],
    description: "Industrial hellscape. Only Dreadnoughts remain here.", unlockLevel: 32,
  },
  // ── MARS FACTION (2-1 → 2-5) ─────────────────────────────────────────────
  corona: {
    id: "corona", name: "Mars Frontier", label: "2-1", faction: "mars",
    bgHueA: "#3a1800", bgHueB: "#1a0800", enemyTier: 1,
    enemyTypes: ["scout", "raider"],
    description: "The outer Martian reaches. Raiders rule the rust-colored lanes.", unlockLevel: 1,
  },
  fracture: {
    id: "fracture", name: "Dust Expanse", label: "2-2", faction: "mars",
    bgHueA: "#4a1a0a", bgHueB: "#1e0804", enemyTier: 2,
    enemyTypes: ["raider", "destroyer"],
    description: "Swirling iron dust storms hide outlaw strongholds.", unlockLevel: 8,
  },
  abyss: {
    id: "abyss", name: "Red Reaches", label: "2-3", faction: "mars",
    bgHueA: "#5a0a0a", bgHueB: "#220404", enemyTier: 3,
    enemyTypes: ["destroyer", "dread"],
    description: "Combat-torn Martian space. Destroyer fleets fight for control.", unlockLevel: 16,
  },
  marsdepth: {
    id: "marsdepth", name: "Mars Deep Field", label: "2-4", faction: "mars",
    bgHueA: "#400010", bgHueB: "#180006", enemyTier: 4,
    enemyTypes: ["voidling", "dread"],
    description: "The deep unknown of Martian space. Void entities breach the hull lines.", unlockLevel: 24,
  },
  maelstrom: {
    id: "maelstrom", name: "The Maelstrom", label: "2-5", faction: "mars",
    bgHueA: "#2a0020", bgHueB: "#0e0008", enemyTier: 5,
    enemyTypes: ["dread"],
    description: "A perpetual storm of wreckage and dread. The ultimate Martian challenge.", unlockLevel: 32,
  },
  // ── VENUS FACTION (3-1 → 3-5) ────────────────────────────────────────────
  venus1: {
    id: "venus1", name: "Venus Cloud Gate", label: "3-1", faction: "venus",
    bgHueA: "#2a1a00", bgHueB: "#0e0800", enemyTier: 1,
    enemyTypes: ["scout", "raider"],
    description: "The upper cloud layers. Strange energy-based pirates lurk in the mist.", unlockLevel: 1,
  },
  venus2: {
    id: "venus2", name: "Sulphur Winds", label: "3-2", faction: "venus",
    bgHueA: "#3a2800", bgHueB: "#160e00", enemyTier: 2,
    enemyTypes: ["raider", "destroyer"],
    description: "Corrosive winds and raider fleets adapted to Venus's brutal atmosphere.", unlockLevel: 8,
  },
  venus3: {
    id: "venus3", name: "Acidic Deep", label: "3-3", faction: "venus",
    bgHueA: "#400a30", bgHueB: "#1a0418", enemyTier: 3,
    enemyTypes: ["destroyer", "dread"],
    description: "The pressure increases. Heavy destroyer fleets guard Venusian secrets.", unlockLevel: 16,
  },
  venus4: {
    id: "venus4", name: "Pressure Core", label: "3-4", faction: "venus",
    bgHueA: "#2a003a", bgHueB: "#0e0018", enemyTier: 4,
    enemyTypes: ["voidling", "dread"],
    description: "Near the crushing core of Venus. Reality warps under immense force.", unlockLevel: 24,
  },
  venus5: {
    id: "venus5", name: "Eye of Venus", label: "3-5", faction: "venus",
    bgHueA: "#1a0030", bgHueB: "#080010", enemyTier: 5,
    enemyTypes: ["dread"],
    description: "The heart of Venusian mystery. Legendary endgame territory.", unlockLevel: 32,
  },
  // ── DANGER ZONES (4-1 → 4-5) — center, free PvP, no faction ─────────────
  danger1: {
    id: "danger1", name: "Outer Rift", label: "4-1", faction: "earth",
    bgHueA: "#1a0000", bgHueB: "#0a0000", enemyTier: 4,
    enemyTypes: ["destroyer", "voidling", "dread"],
    description: "Contested space. All factions fight here. PvP enabled.", unlockLevel: 20,
  },
  danger2: {
    id: "danger2", name: "Dead Zone", label: "4-2", faction: "mars",
    bgHueA: "#200008", bgHueB: "#0c0004", enemyTier: 5,
    enemyTypes: ["voidling", "dread"],
    description: "Wrecked fleets drift here. Extreme danger, extreme loot.", unlockLevel: 26,
  },
  danger3: {
    id: "danger3", name: "Pirate Haven", label: "4-3", faction: "venus",
    bgHueA: "#180018", bgHueB: "#08000a", enemyTier: 5,
    enemyTypes: ["dread", "voidling"],
    description: "Pirate stronghold. High-value loot crates and deadly ambushes.", unlockLevel: 30,
  },
  danger4: {
    id: "danger4", name: "Null Sector", label: "4-4", faction: "earth",
    bgHueA: "#0a0a1a", bgHueB: "#020208", enemyTier: 6,
    enemyTypes: ["dread"],
    description: "Reality collapses. Only the strongest survive. Premium loot.", unlockLevel: 36,
  },
  danger5: {
    id: "danger5", name: "The Abyss Gate", label: "4-5", faction: "mars",
    bgHueA: "#100005", bgHueB: "#050002", enemyTier: 7,
    enemyTypes: ["dread"],
    description: "The deepest point. Legendary enemies and endgame rewards.", unlockLevel: 42,
  },
};

export const SHIP_CLASSES: Record<ShipClassId, ShipClass> = {
  skimmer: {
    id: "skimmer",
    name: "Skimmer Mk-I",
    hullMax: 100, shieldMax: 50, baseSpeed: 120, baseDamage: 8,
    cargoMax: 20, droneSlots: 1, price: 0,
    slots: { weapon: 1, generator: 1, module: 1 },
    description: "Cheap, nimble, easy to lose.",
    color: "#7ad8ff", accent: "#0a1230",
  },
  wasp: {
    id: "wasp",
    name: "Wasp Interceptor",
    hullMax: 90, shieldMax: 70, baseSpeed: 145, baseDamage: 10,
    cargoMax: 14, droneSlots: 1, price: 15000,
    slots: { weapon: 2, generator: 1, module: 1 },
    description: "Glass cannon. Fastest hull in the sector.",
    color: "#ffe25c", accent: "#3a2a08",
  },
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    hullMax: 180, shieldMax: 120, baseSpeed: 90, baseDamage: 14,
    cargoMax: 40, droneSlots: 2, price: 50000,
    slots: { weapon: 2, generator: 2, module: 2 },
    description: "All-rounder hull. Solid in any zone.",
    color: "#5cff8a", accent: "#0a2a14",
  },
  reaver: {
    id: "reaver",
    name: "Reaver Mk-II",
    hullMax: 160, shieldMax: 140, baseSpeed: 120, baseDamage: 18,
    cargoMax: 30, droneSlots: 2, price: 120000,
    slots: { weapon: 3, generator: 2, module: 2 },
    description: "Swift hunter. Built for raids.",
    color: "#ff8a4e", accent: "#3a1a08",
  },
  obsidian: {
    id: "obsidian",
    name: "Obsidian Reaver",
    hullMax: 220, shieldMax: 180, baseSpeed: 120, baseDamage: 22,
    cargoMax: 30, droneSlots: 3, price: 65000,
    slots: { weapon: 3, generator: 3, module: 3 },
    description: "Predator of the deep lanes.",
    color: "#ff5cf0", accent: "#2a0a30",
  },
  marauder: {
    id: "marauder",
    name: "Marauder",
    hullMax: 280, shieldMax: 200, baseSpeed: 100, baseDamage: 26,
    cargoMax: 60, droneSlots: 4, price: 500000,
    slots: { weapon: 4, generator: 3, module: 3 },
    description: "Heavy gunship with cargo to spare.",
    color: "#aaff5c", accent: "#1a3008",
  },
  phalanx: {
    id: "phalanx",
    name: "Phalanx Cruiser",
    hullMax: 340, shieldMax: 280, baseSpeed: 90, baseDamage: 24,
    cargoMax: 70, droneSlots: 5, price: 900000,
    slots: { weapon: 4, generator: 3, module: 4 },
    description: "Drone-carrier cruiser. Project power through the swarm.",
    color: "#4ee2ff", accent: "#08203a",
  },
  titan: {
    id: "titan",
    name: "Titan Bulwark",
    hullMax: 400, shieldMax: 300, baseSpeed: 78, baseDamage: 30,
    cargoMax: 80, droneSlots: 5, price: 1500000,
    slots: { weapon: 6, generator: 5, module: 5 },
    description: "Walking fortress. Slow but devastating.",
    color: "#ffd24a", accent: "#3a2a08",
  },
  leviathan: {
    id: "leviathan",
    name: "Leviathan Dreadnought",
    hullMax: 600, shieldMax: 480, baseSpeed: 65, baseDamage: 42,
    cargoMax: 120, droneSlots: 6, price: 3200000,
    slots: { weapon: 7, generator: 6, module: 7 },
    description: "Capital-class warship. Sectors part before it.",
    color: "#ff5c6c", accent: "#3a0810",
  },
  specter: {
    id: "specter",
    name: "Specter Phaseframe",
    hullMax: 220, shieldMax: 360, baseSpeed: 130, baseDamage: 34,
    cargoMax: 40, droneSlots: 6, price: 5000000,
    slots: { weapon: 7, generator: 6, module: 7 },
    description: "Phase-shifted void hull. The endgame chassis.",
    color: "#b06cff", accent: "#15083a",
  },
  colossus: {
    id: "colossus",
    name: "Colossus Mk-X",
    hullMax: 800, shieldMax: 600, baseSpeed: 55, baseDamage: 50,
    cargoMax: 150, droneSlots: 7, price: 8000000,
    slots: { weapon: 9, generator: 8, module: 8 },
    description: "Massive capital ship. Bristling with weapon banks.",
    color: "#ff4444", accent: "#2a0505",
  },
  harbinger: {
    id: "harbinger",
    name: "Harbinger Class",
    hullMax: 500, shieldMax: 700, baseSpeed: 90, baseDamage: 44,
    cargoMax: 80, droneSlots: 7, price: 12000000,
    slots: { weapon: 10, generator: 9, module: 9 },
    description: "Advanced stealth dreadnought. Speed and firepower combined.",
    color: "#44ffaa", accent: "#082a18",
  },
  eclipse: {
    id: "eclipse",
    name: "Eclipse Destroyer",
    hullMax: 1000, shieldMax: 800, baseSpeed: 48, baseDamage: 60,
    cargoMax: 200, droneSlots: 8, price: 20000000,
    slots: { weapon: 12, generator: 10, module: 10 },
    description: "Endgame destroyer. Unstoppable broadside.",
    color: "#ff8800", accent: "#3a2208",
  },
  sovereign: {
    id: "sovereign",
    name: "Sovereign Flagship",
    hullMax: 1400, shieldMax: 1100, baseSpeed: 42, baseDamage: 70,
    cargoMax: 250, droneSlots: 8, price: 35000000,
    slots: { weapon: 14, generator: 12, module: 12 },
    description: "Fleet command ship. The ultimate in raw power.",
    color: "#ffdd00", accent: "#3a3008",
  },
  apex: {
    id: "apex",
    name: "Apex Predator",
    hullMax: 2000, shieldMax: 1600, baseSpeed: 35, baseDamage: 85,
    cargoMax: 300, droneSlots: 10, price: 60000000,
    slots: { weapon: 16, generator: 16, module: 14 },
    description: "The final ship. 16 weapon slots. Nothing survives.",
    color: "#ffffff", accent: "#1a1a1a",
  },
};

export const EXP_FOR_LEVEL = (level: number) => 100 * level * level;

export const ENEMY_DEFS: Record<
  EnemyType,
  Omit<Enemy, "id" | "pos" | "vel" | "angle" | "hull" | "fireCd" | "spawnPos" | "aggro">
> = {
  scout: {
    type: "scout", behavior: "fast",
    hullMax: 70, damage: 12, speed: 130, exp: 5, credits: 10, honor: 0,
    color: "#ff8866", size: 10,
    loot: { resourceId: "scrap", qty: 1 },
  },
  raider: {
    type: "raider", behavior: "chaser",
    hullMax: 170, damage: 22, speed: 75, exp: 12, credits: 25, honor: 1,
    color: "#ff4466", size: 13,
    loot: { resourceId: "plasma", qty: 1 },
  },
  destroyer: {
    type: "destroyer", behavior: "tank",
    hullMax: 500, damage: 40, speed: 50, exp: 30, credits: 75, honor: 3,
    color: "#aa44ff", size: 18,
    loot: { resourceId: "warp", qty: 1 },
  },
  voidling: {
    type: "voidling", behavior: "ranged",
    hullMax: 280, damage: 35, speed: 90, exp: 40, credits: 100, honor: 5,
    color: "#44ffe2", size: 14,
    loot: { resourceId: "void", qty: 1 },
  },
  dread: {
    type: "dread", behavior: "tank",
    hullMax: 850, damage: 55, speed: 45, exp: 75, credits: 200, honor: 10,
    color: "#ffaa22", size: 24,
    loot: { resourceId: "dread", qty: 1 },
  },
};

// Faction-specific stat/color overrides applied at enemy spawn time.
// Earth faction uses the default ENEMY_DEFS values (no entry needed).
// Mars enemies: faster scouts, tougher hulls, orange/rust palette.
// Venus enemies: higher damage, slower where appropriate, purple/gold palette.
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
  },
  venus: {
    scout:     { color: "#ffee22", damageMul: 1.22 },
    raider:    { color: "#cc44ff", hullMul: 1.22 },
    destroyer: { color: "#9911cc", hullMul: 1.12, damageMul: 1.12 },
    voidling:  { color: "#ff44cc", damageMul: 1.28, speedMul: 0.88 },
    dread:     { color: "#aa00ff", hullMul: 1.20, damageMul: 1.12 },
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
  { id: "q-forge-destroyers", title: "Iron Curtain", description: "Destroyer squadrons have locked down the Iron Forge supply lanes. Break through.", zone: "forge", killType: "destroyer", killCount: 8, rewardCredits: 32000, rewardExp: 9500, rewardHonor: 500 },
  { id: "q-forge-voidlings", title: "Forge Phantoms", description: "Voidlings are warping through the superheated forges, disrupting production. Eliminate them.", zone: "forge", killType: "voidling", killCount: 5, rewardCredits: 55000, rewardExp: 16000, rewardHonor: 850 },
  { id: "q-corona-voidlings", title: "Solar Infestation", description: "A voidling swarm orbits the corona, feeding on solar energy. Cleanse it before they breach the station.", zone: "corona", killType: "voidling", killCount: 7, rewardCredits: 90000, rewardExp: 26000, rewardHonor: 1400 },
  { id: "q-corona-dread", title: "Solarburn Contract", description: "Two Dread-class warships are using the corona as cover. Flush them out and destroy them.", zone: "corona", killType: "dread", killCount: 2, rewardCredits: 150000, rewardExp: 44000, rewardHonor: 2300 },
  { id: "q-fracture-voidlings", title: "Rift Surge", description: "Voidlings pour through a dimensional fracture in waves. Seal it with their destruction.", zone: "fracture", killType: "voidling", killCount: 9, rewardCredits: 240000, rewardExp: 70000, rewardHonor: 3800 },
  { id: "q-fracture-dread", title: "Fracture Wardens", description: "Three Dreads patrol the Fracture Zone, blockading the path to the Abyss. Remove them.", zone: "fracture", killType: "dread", killCount: 3, rewardCredits: 400000, rewardExp: 115000, rewardHonor: 6000 },
  { id: "q-abyss-dread", title: "Into the Dark", description: "The Abyss harbors a pack of Dreads unlike any seen before. Hunt them down and return with proof.", zone: "abyss", killType: "dread", killCount: 4, rewardCredits: 650000, rewardExp: 190000, rewardHonor: 10000 },
  { id: "q-abyss-apex", title: "God of the Abyss", description: "A legendary Dread fleet dominates the deepest sector of known space. Become the last thing they see.", zone: "abyss", killType: "dread", killCount: 6, rewardCredits: 1100000, rewardExp: 320000, rewardHonor: 17000 },
  // Mars deep zones
  { id: "q-marsdepth-voidlings", title: "Deep Field Haunting", description: "Voidlings have swarmed the outer Martian deep field, disrupting passage. Clear the infestation.", zone: "marsdepth", killType: "voidling", killCount: 6, rewardCredits: 9500, rewardExp: 2800, rewardHonor: 150 },
  { id: "q-marsdepth-dread", title: "Martian Apex", description: "A Dread warship lurks in the Martian deep. Bring back its core as proof.", zone: "marsdepth", killType: "dread", killCount: 2, rewardCredits: 19000, rewardExp: 5500, rewardHonor: 300 },
  { id: "q-maelstrom-dread", title: "Eye of the Storm", description: "A Dread armada is using The Maelstrom as a staging ground. Tear through them.", zone: "maelstrom", killType: "dread", killCount: 4, rewardCredits: 34000, rewardExp: 10000, rewardHonor: 550 },
  { id: "q-maelstrom-apex", title: "Master of the Maelstrom", description: "The Maelstrom's supreme Dread fleet blocks all passage. Eliminate them completely.", zone: "maelstrom", killType: "dread", killCount: 6, rewardCredits: 58000, rewardExp: 17000, rewardHonor: 920 },
  // Venus zones
  { id: "q-venus1-scouts", title: "Cloud Layer Sweep", description: "Scout ships harry the upper Venus cloud lanes. Dispatch them and restore safe passage.", zone: "venus1", killType: "scout", killCount: 5, rewardCredits: 380, rewardExp: 90, rewardHonor: 6 },
  { id: "q-venus1-raiders", title: "Citadel Raiders", description: "A raider gang has been looting Venusian cloud-city outposts. Shut them down.", zone: "venus1", killType: "raider", killCount: 3, rewardCredits: 650, rewardExp: 150, rewardHonor: 11 },
  { id: "q-venus2-raiders", title: "Sulphur Gate Cleanup", description: "Raider packs lurk in the sulphur wind corridors. Clear the route.", zone: "venus2", killType: "raider", killCount: 6, rewardCredits: 1500, rewardExp: 340, rewardHonor: 19 },
  { id: "q-venus2-destroyers", title: "Atmospheric Threat", description: "Destroyer squadrons patrol the Sulphur Winds, enforcing blockades. Break them.", zone: "venus2", killType: "destroyer", killCount: 3, rewardCredits: 2600, rewardExp: 650, rewardHonor: 32 },
  { id: "q-venus3-destroyers", title: "Acid Corridor Purge", description: "Destroyer packs control the Acidic Deep passages. Burn through them.", zone: "venus3", killType: "destroyer", killCount: 5, rewardCredits: 4200, rewardExp: 1200, rewardHonor: 55 },
  { id: "q-venus3-dread", title: "Venusian Dread Hunt", description: "A Dread-class warship lurks in the corrosive depths. Its reactor is your prize.", zone: "venus3", killType: "dread", killCount: 1, rewardCredits: 6500, rewardExp: 1900, rewardHonor: 110 },
  { id: "q-venus4-voidlings", title: "Pressure Zone Phantoms", description: "Voidlings phase in and out of the crushing core. Exterminate them before the breach widens.", zone: "venus4", killType: "voidling", killCount: 6, rewardCredits: 9500, rewardExp: 2800, rewardHonor: 150 },
  { id: "q-venus4-dread", title: "Core Guardian", description: "Two Dread warships orbit the Pressure Core as self-appointed warlords. Dethrone them.", zone: "venus4", killType: "dread", killCount: 2, rewardCredits: 19000, rewardExp: 5500, rewardHonor: 300 },
  { id: "q-venus5-dread", title: "Eye of Venus", description: "The Eye of Venus is guarded by a Dread armada. Only the bold enter — and fewer leave.", zone: "venus5", killType: "dread", killCount: 4, rewardCredits: 34000, rewardExp: 10000, rewardHonor: 550 },
  { id: "q-venus5-apex", title: "Sovereign of Venus", description: "Six Dread warships orbit the Eye's singularity. Destroy them all and claim the title.", zone: "venus5", killType: "dread", killCount: 6, rewardCredits: 58000, rewardExp: 17000, rewardHonor: 920 },
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
  // trade goods
  food:        { id: "food",        name: "Food Supplies",    basePrice: 20,  glyph: "≋", color: "#aadd77", description: "Essential rations for frontier stations. Always needed." },
  medicine:    { id: "medicine",    name: "Medicine",         basePrice: 55,  glyph: "✚", color: "#ff7777", description: "Field-grade medicine. Valuable in combat zones." },
  luxury:      { id: "luxury",      name: "Luxury Goods",     basePrice: 110, glyph: "◆", color: "#ffcc44", description: "Rare commodities. Stations on the outer rim pay big." },
  nanite:      { id: "nanite",      name: "Nanite Paste",     basePrice: 145, glyph: "∷", color: "#44ddff", description: "Self-replicating nano-machines. Used in hull repairs." },
  "bio-matter":{ id: "bio-matter",  name: "Bio-Matter",       basePrice: 75,  glyph: "❧", color: "#88ff88", description: "Biological specimens. Research stations pay premium." },
  precursor:   { id: "precursor",   name: "Precursor Tech",   basePrice: 300, glyph: "⎔", color: "#dd88ff", description: "Ancient alien artifacts. Worth a fortune in the right market." },
  "fuel-cell": { id: "fuel-cell",   name: "Fuel Cell",        basePrice: 40,  glyph: "▶", color: "#ffaa44", description: "Standard fuel cells. Military stations always need them." },
  contraband:  { id: "contraband",  name: "Contraband",       basePrice: 180, glyph: "☠", color: "#ff4466", description: "Illegal goods. Huge profit if you can dodge the law." },
  relic:       { id: "relic",       name: "Ancient Relic",    basePrice: 380, glyph: "⌘", color: "#ddcc00", description: "Priceless historical artifacts. Only the deepest vaults hold them." },
  exotic:      { id: "exotic",      name: "Exotic Matter",    basePrice: 500, glyph: "✧", color: "#ff44cc", description: "Unstable matter from beyond the Abyss. Worth fortunes." },
  artifacts:   { id: "artifacts",   name: "Alien Artifacts",  basePrice: 260, glyph: "⟠", color: "#d4b0ff", description: "Recovered relics from dead civilizations. Dealers pay well." },
  spice:       { id: "spice",       name: "Solar Spice",      basePrice: 34,  glyph: "⚘", color: "#ffb36b", description: "A luxury export prized by outer-rim markets and traders." },
  silk:        { id: "silk",        name: "Void Silk",        basePrice: 88,  glyph: "≋", color: "#e4e7ff", description: "Rare woven fibers harvested from deep-space organisms." },
  ore:         { id: "ore",         name: "Refined Ore",      basePrice: 22,  glyph: "▰", color: "#d8a26b", description: "Processed ore ready for shipyard fabrication." },
  "data-core": { id: "data-core",   name: "Data Core",        basePrice: 155, glyph: "⌂", color: "#66ddff", description: "Encrypted navigation data and corporate secrets." },
  "cloning-gel": { id: "cloning-gel", name: "Cloning Gel",     basePrice: 140, glyph: "◌", color: "#88ffcc", description: "Medical growth medium used by high-end clinics." },
  "medical-serum": { id: "medical-serum", name: "Medical Serum", basePrice: 72, glyph: "✚", color: "#ff9da0", description: "Advanced field treatment for frontier hospitals." },
  "fusion-lattice": { id: "fusion-lattice", name: "Fusion Lattice", basePrice: 210, glyph: "⧉", color: "#ffee88", description: "Precision reactor parts for elite shipyards." },
  "star-map": { id: "star-map", name: "Star Map", basePrice: 120, glyph: "✦", color: "#7ad8ff", description: "Chart fragments that improve route planning." },
  blackglass:  { id: "blackglass",  name: "Blackglass",       basePrice: 310, glyph: "▣", color: "#9a88ff", description: "Dark translucent material used in luxury hull design." },
  titanium:    { id: "titanium",    name: "Titanium Alloy",   basePrice: 48,  glyph: "▰", color: "#c0c8d8", description: "High-grade structural alloy for advanced ship hulls." },
  "cryo-fluid":{ id: "cryo-fluid",  name: "Cryo Fluid",      basePrice: 92,  glyph: "≈", color: "#88ddff", description: "Super-cooled coolant for reactor cores and weapons." },
  "neural-chip":{ id: "neural-chip", name: "Neural Chip",     basePrice: 280, glyph: "⌬", color: "#ff88cc", description: "Bio-mechanical processor. Powers advanced targeting systems." },
  "dark-matter":{ id: "dark-matter", name: "Dark Matter",     basePrice: 450, glyph: "●", color: "#8844cc", description: "Unstable exotic matter. Used in warp drive construction." },
  "plasma-coil":{ id: "plasma-coil", name: "Plasma Coil",     basePrice: 65,  glyph: "◎", color: "#ff6644", description: "Compact energy coil for weapon charging systems." },
  "bio-crystal":{ id: "bio-crystal", name: "Bio Crystal",     basePrice: 195, glyph: "◇", color: "#44ff88", description: "Living crystalline organisms. Medical and research value." },
  // mineable ores
  copper:          { id: "copper",          name: "Copper Ore",       basePrice: 22,  glyph: "▰", color: "#e8a050", description: "Common conductive ore. Used in wiring and circuitry." },
  cobalt:          { id: "cobalt",          name: "Cobalt Ore",       basePrice: 48,  glyph: "▰", color: "#4466cc", description: "Dense blue ore. Essential for high-strength alloys." },
  "crystal-shard": { id: "crystal-shard",   name: "Crystal Shard",    basePrice: 135, glyph: "◆", color: "#cc88ff", description: "Prismatic energy crystal. Powers advanced shield tech." },
  palladium:       { id: "palladium",       name: "Palladium",        basePrice: 210, glyph: "◈", color: "#d4e4f0", description: "Precious catalytic metal. Rare and highly sought." },
  "helium-3":      { id: "helium-3",        name: "Helium-3",         basePrice: 95,  glyph: "◎", color: "#88ddaa", description: "Fusion fuel isotope. Harvested from gas-rich nebulae." },
  iridium:         { id: "iridium",         name: "Iridium Ore",      basePrice: 380, glyph: "▣", color: "#f0e068", description: "Ultra-dense precious metal. Only found in danger zones." },
  sulfur:          { id: "sulfur",          name: "Sulfur Deposit",   basePrice: 30,  glyph: "▰", color: "#cccc44", description: "Volcanic mineral. Common near Venus cloud layers." },
  obsidian:        { id: "obsidian",        name: "Void Obsidian",    basePrice: 165, glyph: "▣", color: "#6644aa", description: "Dark glass forged in the void. Valued for hull reinforcement." },
  // refined materials (factory output)
  "refined-alloy":  { id: "refined-alloy",  name: "Refined Alloy",    basePrice: 120,  glyph: "⬡", color: "#dd8844", description: "High-grade alloy refined from iron and copper. Used in advanced hull plating." },
  "crystal-matrix": { id: "crystal-matrix", name: "Crystal Matrix",   basePrice: 340,  glyph: "✦", color: "#dd88ff", description: "Crystalline lattice structure. Powers advanced shield generators." },
  "fusion-core":    { id: "fusion-core",    name: "Fusion Core",      basePrice: 480,  glyph: "⊛", color: "#88ffaa", description: "Miniaturized fusion reactor. Extremely valuable to military stations." },
  "void-steel":     { id: "void-steel",     name: "Void Steel",       basePrice: 850,  glyph: "◆", color: "#8866cc", description: "Ultra-hard steel forged from void obsidian. The rarest refined material." },
  "nano-compound":  { id: "nano-compound",  name: "Nano-Compound",    basePrice: 220,  glyph: "◎", color: "#66ddcc", description: "Self-assembling nano-material. Medical and engineering applications." },
  "plasma-cell":    { id: "plasma-cell",     name: "Plasma Cell",      basePrice: 180,  glyph: "▣", color: "#ff8866", description: "Concentrated plasma fuel cell. High energy density for starship reactors." },
};


// Zone-specific asteroid yield pools (weighted)
export const ZONE_ASTEROID_YIELDS: Record<ZoneId, { resourceId: ResourceId; weight: number }[]> = {
  // Earth faction (tier 1-5)
  alpha:     [{ resourceId: "iron", weight: 45 }, { resourceId: "copper", weight: 35 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "cobalt", weight: 5 }],
  nebula:    [{ resourceId: "iron", weight: 25 }, { resourceId: "copper", weight: 20 }, { resourceId: "lumenite", weight: 25 }, { resourceId: "helium-3", weight: 20 }, { resourceId: "cobalt", weight: 10 }],
  crimson:   [{ resourceId: "iron", weight: 15 }, { resourceId: "cobalt", weight: 30 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "copper", weight: 10 }],
  void:      [{ resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 25 }, { resourceId: "palladium", weight: 15 }],
  forge:     [{ resourceId: "iron", weight: 10 }, { resourceId: "cobalt", weight: 15 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "palladium", weight: 30 }, { resourceId: "iridium", weight: 15 }, { resourceId: "obsidian", weight: 10 }],
  // Mars faction (tier 1-5)
  corona:    [{ resourceId: "iron", weight: 40 }, { resourceId: "copper", weight: 25 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "helium-3", weight: 10 }, { resourceId: "cobalt", weight: 5 }],
  fracture:  [{ resourceId: "iron", weight: 15 }, { resourceId: "copper", weight: 15 }, { resourceId: "cobalt", weight: 25 }, { resourceId: "lumenite", weight: 20 }, { resourceId: "helium-3", weight: 15 }, { resourceId: "crystal-shard", weight: 10 }],
  abyss:     [{ resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 10 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  marsdepth: [{ resourceId: "cobalt", weight: 10 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  maelstrom: [{ resourceId: "crystal-shard", weight: 15 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 25 }, { resourceId: "cobalt", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
  // Venus faction (tier 1-5)
  venus1:    [{ resourceId: "iron", weight: 35 }, { resourceId: "copper", weight: 20 }, { resourceId: "sulfur", weight: 30 }, { resourceId: "lumenite", weight: 10 }, { resourceId: "cobalt", weight: 5 }],
  venus2:    [{ resourceId: "iron", weight: 15 }, { resourceId: "sulfur", weight: 25 }, { resourceId: "copper", weight: 15 }, { resourceId: "cobalt", weight: 20 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  venus3:    [{ resourceId: "sulfur", weight: 15 }, { resourceId: "cobalt", weight: 20 }, { resourceId: "crystal-shard", weight: 25 }, { resourceId: "lumenite", weight: 15 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "copper", weight: 10 }],
  venus4:    [{ resourceId: "crystal-shard", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "palladium", weight: 20 }, { resourceId: "sulfur", weight: 10 }, { resourceId: "cobalt", weight: 15 }, { resourceId: "helium-3", weight: 10 }],
  venus5:    [{ resourceId: "obsidian", weight: 15 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 20 }, { resourceId: "crystal-shard", weight: 20 }, { resourceId: "cobalt", weight: 10 }, { resourceId: "sulfur", weight: 10 }],
  // Danger zones (tier 4-7) — premium ores
  danger1:   [{ resourceId: "crystal-shard", weight: 20 }, { resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 20 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "cobalt", weight: 15 }],
  danger2:   [{ resourceId: "palladium", weight: 25 }, { resourceId: "iridium", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "crystal-shard", weight: 15 }, { resourceId: "helium-3", weight: 15 }],
  danger3:   [{ resourceId: "iridium", weight: 30 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "crystal-shard", weight: 15 }, { resourceId: "cobalt", weight: 15 }],
  danger4:   [{ resourceId: "iridium", weight: 35 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 20 }, { resourceId: "crystal-shard", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
  danger5:   [{ resourceId: "iridium", weight: 40 }, { resourceId: "palladium", weight: 25 }, { resourceId: "obsidian", weight: 15 }, { resourceId: "crystal-shard", weight: 10 }, { resourceId: "helium-3", weight: 10 }],
};

export function pickAsteroidYield(zone: ZoneId): ResourceId {
  const pool = ZONE_ASTEROID_YIELDS[zone];
  if (!pool || pool.length === 0) return "iron";
  const totalW = pool.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalW;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.resourceId;
  }
  return pool[pool.length - 1].resourceId;
}


// ── ASTEROID BELTS: dense mining regions per zone ─────────────────────────

// ── REFINING RECIPES ──────────────────────────────────────────────────────
export type RefineRecipe = {
  id: string;
  name: string;
  inputs: { resourceId: ResourceId; qty: number }[];
  output: { resourceId: ResourceId; qty: number };
  timeSeconds: number;
  minFactoryLevel: number;
};

export const REFINE_RECIPES: RefineRecipe[] = [
  { id: "r-alloy",   name: "Smelt Alloy",       inputs: [{ resourceId: "iron", qty: 8 }, { resourceId: "copper", qty: 4 }],                     output: { resourceId: "refined-alloy", qty: 2 },  timeSeconds: 120, minFactoryLevel: 1 },
  { id: "r-plasma",  name: "Compress Plasma",    inputs: [{ resourceId: "plasma", qty: 5 }, { resourceId: "fuel-cell", qty: 3 }],                output: { resourceId: "plasma-cell", qty: 2 },   timeSeconds: 150, minFactoryLevel: 1 },
  { id: "r-nano",    name: "Synthesize Nano",    inputs: [{ resourceId: "nanite", qty: 4 }, { resourceId: "bio-matter", qty: 3 }],               output: { resourceId: "nano-compound", qty: 2 }, timeSeconds: 180, minFactoryLevel: 2 },
  { id: "r-crystal", name: "Grow Crystal Matrix", inputs: [{ resourceId: "crystal-shard", qty: 3 }, { resourceId: "cobalt", qty: 5 }],           output: { resourceId: "crystal-matrix", qty: 1 }, timeSeconds: 240, minFactoryLevel: 2 },
  { id: "r-fusion",  name: "Forge Fusion Core",  inputs: [{ resourceId: "helium-3", qty: 6 }, { resourceId: "palladium", qty: 2 }],              output: { resourceId: "fusion-core", qty: 1 },   timeSeconds: 300, minFactoryLevel: 3 },
  { id: "r-vsteel",  name: "Forge Void Steel",   inputs: [{ resourceId: "obsidian", qty: 3 }, { resourceId: "iridium", qty: 1 }],                output: { resourceId: "void-steel", qty: 1 },    timeSeconds: 420, minFactoryLevel: 4 },
];

export type RefineJob = {
  recipeId: string;
  startedAt: number;
  completesAt: number;
};

export const FACTORY_UPGRADE_COSTS = [0, 5000, 25000, 80000, 200000];
export const FACTORY_SPEED_BONUS = [1.0, 1.0, 0.85, 0.7, 0.55, 0.4];

export const ASTEROID_BELTS: Record<ZoneId, { cx: number; cy: number; rx: number; ry: number }[]> = {
  alpha:    [{ cx: -3000, cy: 1500, rx: 2000, ry: 800 }, { cx: 2500, cy: -2000, rx: 1500, ry: 1000 }],
  nebula:   [{ cx: 0, cy: 3500, rx: 2500, ry: 600 }, { cx: -3000, cy: -2000, rx: 1800, ry: 900 }],
  crimson:  [{ cx: 3500, cy: 0, rx: 800, ry: 2500 }, { cx: -2500, cy: 3000, rx: 1500, ry: 700 }],
  void:     [{ cx: -2000, cy: -3000, rx: 2200, ry: 700 }, { cx: 3000, cy: 2000, rx: 1200, ry: 1500 }],
  forge:    [{ cx: 0, cy: -3500, rx: 3000, ry: 600 }, { cx: -3500, cy: 1500, rx: 1000, ry: 2000 }],
  corona:   [{ cx: 3000, cy: -1500, rx: 2000, ry: 900 }, { cx: -2000, cy: 3500, rx: 1800, ry: 600 }],
  fracture: [{ cx: -3500, cy: -1000, rx: 1500, ry: 2000 }, { cx: 2500, cy: 2500, rx: 2000, ry: 800 }],
  abyss:    [{ cx: 0, cy: 0, rx: 3000, ry: 1000 }],
  marsdepth:[{ cx: -2500, cy: 2500, rx: 2000, ry: 900 }, { cx: 3000, cy: -1500, rx: 1500, ry: 1200 }],
  maelstrom:[{ cx: 2000, cy: 3000, rx: 1800, ry: 700 }, { cx: -3000, cy: -2500, rx: 1200, ry: 1800 }],
  venus1:   [{ cx: -2500, cy: -1500, rx: 2000, ry: 800 }, { cx: 3000, cy: 2000, rx: 1500, ry: 1000 }],
  venus2:   [{ cx: 0, cy: -3500, rx: 2500, ry: 700 }, { cx: -3500, cy: 1000, rx: 1200, ry: 1800 }],
  venus3:   [{ cx: 3500, cy: 1500, rx: 900, ry: 2500 }, { cx: -2000, cy: -3000, rx: 2000, ry: 600 }],
  venus4:   [{ cx: -3000, cy: 0, rx: 800, ry: 3000 }, { cx: 2500, cy: -2500, rx: 1800, ry: 800 }],
  venus5:   [{ cx: 0, cy: 3000, rx: 3000, ry: 800 }, { cx: -2500, cy: -2000, rx: 1500, ry: 1500 }],
  danger1:  [{ cx: 2000, cy: -2000, rx: 1500, ry: 1500 }],
  danger2:  [{ cx: -2500, cy: 2500, rx: 1800, ry: 800 }],
  danger3:  [{ cx: 3000, cy: 0, rx: 800, ry: 2000 }],
  danger4:  [{ cx: 0, cy: -3000, rx: 2000, ry: 700 }],
  danger5:  [{ cx: -2000, cy: 2000, rx: 1200, ry: 1200 }],
};

export const STATIONS: Station[] = [
  // alpha
  { id: "helix",   name: "Helix Station",  pos: { x: 0, y: 0 },     zone: "alpha",   kind: "hub",
    description: "Capital hub of the Alpha Frontier.", controlledBy: "earth",
    prices: { scrap: 1.0, plasma: 1.0, iron: 0.95, synth: 0.9, medpack: 1.1, lumenite: 1.0, food: 0.8, "fuel-cell": 0.9 , copper: 1.2, cobalt: 1.3, "refined-alloy": 1.4, "plasma-cell": 1.3, "nano-compound": 1.2} },
  { id: "iron-belt", name: "Iron Belt Refinery", pos: { x: -4500, y: -2800 }, zone: "alpha", kind: "mining",
    description: "Refinery sitting on a rich mineral belt.", controlledBy: "earth",
    prices: { iron: 0.6, lumenite: 0.7, scrap: 1.2, synth: 1.0, medpack: 1.1, plasma: 1.05,
              food: 0.6, "fuel-cell": 0.7, medicine: 1.2, ore: 0.65, "star-map": 1.25 , copper: 0.65, cobalt: 0.8} },
  // nebula
  { id: "veiled",   name: "Veiled Outpost", pos: { x: 3200, y: -4800 }, zone: "nebula",  kind: "outpost",
    description: "A mining outpost run by a raider truce.", controlledBy: "earth",
    prices: { plasma: 0.7, warp: 0.85, scrap: 1.2, synth: 1.15, medpack: 1.2, void: 1.3,
              food: 1.3, medicine: 1.4, nanite: 0.8, "bio-matter": 0.7, luxury: 1.6, silk: 0.75, artifacts: 1.2, "crystal-matrix": 1.5, "fusion-core": 1.4, "void-steel": 1.3} },
  { id: "azure-port", name: "Azure Trade Port", pos: { x: -4200, y: -5200 }, zone: "nebula", kind: "trade",
    description: "Bustling free-port. Buys high, sells fair.", controlledBy: "earth",
    prices: { quantum: 0.7, lumenite: 0.85, dread: 0.9, void: 0.95, plasma: 1.2, warp: 1.25, iron: 1.15, scrap: 1.25,
              luxury: 0.7, precursor: 1.5, relic: 1.6, food: 1.5, medicine: 1.3, nanite: 1.4, blackglass: 0.8, "data-core": 0.9 , cobalt: 1.1, "crystal-shard": 1.3, "helium-3": 1.2} },
  // crimson
  { id: "ember",    name: "Ember Citadel",  pos: { x: -3800, y: 2400 },  zone: "crimson", kind: "military",
    description: "Crimson Reach naval citadel. Premium for war goods.", controlledBy: "earth",
    prices: { dread: 1.3, warp: 1.3, plasma: 1.4, medpack: 0.85, synth: 0.95, quantum: 1.2,
              food: 1.6, medicine: 0.7, "fuel-cell": 1.5, contraband: 0.6, blackglass: 0.7, "fusion-lattice": 0.9 , cobalt: 1.4, "crystal-shard": 1.5, "refined-alloy": 1.3, "nano-compound": 1.5, "plasma-cell": 1.2} },
  { id: "scarlet-yard", name: "Scarlet Shipyards", pos: { x: 4800, y: 3600 }, zone: "crimson", kind: "trade",
    description: "Capital ship construction yards.", controlledBy: "earth",
    prices: { iron: 1.4, scrap: 1.35, lumenite: 1.2, plasma: 1.1, dread: 0.85,
              nanite: 1.5, "fuel-cell": 1.3, food: 1.5, luxury: 1.7, ore: 1.15, "fusion-lattice": 1.05 , copper: 1.3, cobalt: 1.2} },
  // void
  { id: "echo",     name: "Echo Anchorage", pos: { x: 800, y: -3200 },    zone: "void",    kind: "outpost",
    description: "Last refuge in The Void.", controlledBy: "earth",
    prices: { void: 0.6, dread: 1.2, quantum: 1.4, medpack: 1.3, synth: 1.2,
              contraband: 0.5, relic: 0.7, exotic: 0.8, food: 1.8, medicine: 1.6, "medical-serum": 0.85, "cloning-gel": 0.75, "void-steel": 1.6, "crystal-matrix": 1.3, "fusion-core": 1.2} },
  { id: "obsidian-port", name: "Obsidian Free Port", pos: { x: 4600, y: 3800 }, zone: "void", kind: "trade",
    description: "A trade haven for ghosts and smugglers.", controlledBy: "earth",
    prices: { quantum: 0.55, void: 1.4, dread: 1.4, lumenite: 1.3, warp: 1.2,
              contraband: 0.4, luxury: 0.6, relic: 0.65, precursor: 0.7, food: 1.9, exotic: 1.5, artifacts: 0.7, "data-core": 0.75 } },
  // forge
  { id: "ironclad",    name: "Ironclad Bastion",   pos: { x: 0, y: 0 },       zone: "forge",    kind: "military",
    description: "Heavily fortified military hub. Sells advanced weapons at a premium.", controlledBy: "earth",
    prices: { dread: 1.5, warp: 1.4, plasma: 1.6, iron: 0.7, scrap: 0.8, "refined-alloy": 1.5, "plasma-cell": 1.4, "fusion-core": 1.3} },
  { id: "forge-gate",  name: "Forge Gate Depot",   pos: { x: -4200, y: 4400 },  zone: "forge",    kind: "trade",
    description: "Industrial depot trading raw ore and components.", controlledBy: "earth",
    prices: { iron: 0.5, scrap: 0.6, lumenite: 0.75, quantum: 0.9, dread: 1.2, void: 1.3, blackglass: 0.6, ore: 0.55 , cobalt: 0.6, palladium: 0.8, copper: 0.7} },
  // corona
  { id: "solar-haven", name: "Solar Haven",         pos: { x: 3200, y: -4200 }, zone: "corona",   kind: "outpost",
    description: "Heat-shielded station orbiting the corona. Rare energy crystals for sale.", controlledBy: "mars",
    prices: { lumenite: 0.5, plasma: 0.6, warp: 0.8, void: 1.2, dread: 1.3, quantum: 1.0, "star-map": 0.7, "fusion-lattice": 0.75 , "crystal-shard": 0.7, "helium-3": 0.6, "crystal-matrix": 1.4, "void-steel": 1.5, "nano-compound": 1.3} },
  { id: "corona-mkt",  name: "Corona Market",       pos: { x: 5000, y: 3800 }, zone: "corona",   kind: "trade",
    description: "Black-market hub. Strange goods at strange prices.", controlledBy: "mars",
    prices: { quantum: 0.6, void: 0.7, dread: 1.1, plasma: 1.3, lumenite: 1.2, iron: 1.5, artifacts: 0.8, relic: 0.9 } },
  // fracture
  { id: "rift-base",   name: "Rift Base Omega",     pos: { x: -3800, y: 3200 }, zone: "fracture", kind: "military",
    description: "Last militarized foothold before the Abyss. Legendary gear.", controlledBy: "mars",
    prices: { dread: 2.0, warp: 1.8, plasma: 2.0, medpack: 0.7, quantum: 1.5, void: 1.6, blackglass: 0.55, precursor: 1.2, "void-steel": 1.8, "fusion-core": 1.6, "crystal-matrix": 1.4} },
  { id: "null-post",   name: "Null-Point Station",  pos: { x: 4200, y: -4800 }, zone: "fracture", kind: "outpost",
    description: "Barely functional outpost in folded space.", controlledBy: "mars",
    prices: { void: 0.5, quantum: 0.7, dread: 1.4, lumenite: 1.5, synth: 1.3, "data-core": 0.8, "medical-serum": 0.9 } },
  // abyss
  { id: "void-heart",  name: "Void Heart Station",  pos: { x: 0, y: 0 },      zone: "abyss",    kind: "outpost",
    description: "The deepest station in known space. No questions asked.", controlledBy: "mars",
    prices: { void: 0.4, dread: 0.8, quantum: 0.5, lumenite: 1.8, plasma: 2.5, warp: 2.0 , obsidian: 0.5, palladium: 0.7, "void-steel": 2.0, "fusion-core": 1.8, "refined-alloy": 1.5} },
  { id: "abyss-anchor",name: "Abyss Anchorage",     pos: { x: -5200, y: 4200 }, zone: "abyss",   kind: "trade",
    description: "Endgame trading post. Buy or sell anything at extreme prices.", controlledBy: "mars",
    prices: { quantum: 0.4, void: 1.8, dread: 2.2, iron: 2.0, synth: 1.8, medpack: 0.5 } },
  // marsdepth
  { id: "deep-haven",  name: "Deep Field Haven",   pos: { x: 0, y: 0 },       zone: "marsdepth", kind: "outpost",
    description: "Isolated Martian outpost in the outer deep field. Last stop before the Maelstrom.", controlledBy: "mars",
    prices: { void: 0.55, dread: 1.2, quantum: 1.4, medpack: 1.3, synth: 1.2, contraband: 0.5, relic: 0.7, exotic: 0.8 } },
  { id: "iron-depth",  name: "Iron Depth Exchange", pos: { x: 4600, y: -4200 }, zone: "marsdepth", kind: "trade",
    description: "Remote Martian trade post for rare salvage and tactical goods.", controlledBy: "mars",
    prices: { dread: 1.8, warp: 1.7, plasma: 1.9, medpack: 0.75, quantum: 1.5, void: 1.4, lumenite: 1.2 } },
  // maelstrom
  { id: "storm-eye",   name: "Eye of the Storm",   pos: { x: 0, y: 0 },       zone: "maelstrom", kind: "military",
    description: "Entrenched Martian warstation at the storm's calm center. Top-tier military gear only.", controlledBy: "mars",
    prices: { dread: 2.2, warp: 2.0, plasma: 2.3, iron: 0.65, scrap: 0.7, lumenite: 1.1, quantum: 1.6, "refined-alloy": 1.6, "plasma-cell": 1.5, "fusion-core": 1.4} },
  { id: "wreck-point", name: "Wreckage Point",     pos: { x: -4800, y: 4200 }, zone: "maelstrom", kind: "trade",
    description: "Salvage bazaar built into the wreckage field. Everything's for sale, no questions asked.", controlledBy: "mars",
    prices: { iron: 0.45, scrap: 0.5, lumenite: 0.7, quantum: 0.85, void: 1.5, dread: 1.9, exotic: 0.7 } },
  // venus1
  { id: "cloud-gate",  name: "Cloud Gate Station", pos: { x: 0, y: 0 },       zone: "venus1",   kind: "hub",
    description: "Entry hub to the Venusian cloud cities. Friendly to all factions.", controlledBy: "venus",
    prices: { scrap: 1.0, plasma: 1.0, iron: 0.95, synth: 0.9, medpack: 1.1, lumenite: 1.0, warp: 1.1, void: 1.2, dread: 1.1, food: 0.75, medicine: 0.85, luxury: 1.3 , sulfur: 1.2, copper: 1.1, "refined-alloy": 1.3, "nano-compound": 1.4, "plasma-cell": 1.2} },
  { id: "mist-dock",   name: "Mist Dock Outpost",  pos: { x: -4400, y: -2800 }, zone: "venus1",   kind: "mining",
    description: "Floating mining platform harvesting rare cloud minerals.", controlledBy: "venus",
    prices: { iron: 0.6, lumenite: 0.65, scrap: 1.2, synth: 1.0, medpack: 1.1, "fuel-cell": 0.7, food: 0.65, medicine: 1.1 , sulfur: 0.55, copper: 0.6} },
  { id: "halo-walk",  name: "Halo Walk Station",  pos: { x: 4200, y: 3400 },   zone: "venus1",   kind: "trade",
    description: "A bright civilian waypoint for cloud travelers and merchants.", controlledBy: "venus",
    prices: { food: 0.7, medicine: 0.9, luxury: 1.1, scrap: 1.1, plasma: 1.05, lumenite: 0.9, synth: 1.0 } },
  // venus2
  { id: "sulphur-port", name: "Sulphur Port",      pos: { x: 2800, y: -4800 },  zone: "venus2",   kind: "outpost",
    description: "Corrosive atmosphere station. Raider-truce outpost with exotic supplies.", controlledBy: "venus",
    prices: { plasma: 0.75, warp: 0.9, scrap: 1.2, synth: 1.1, medpack: 1.2, void: 1.3, food: 1.3, medicine: 1.4, nanite: 0.85, "bio-matter": 0.75 } },
  { id: "wind-market", name: "Wind Market",        pos: { x: -4600, y: -5200 }, zone: "venus2",  kind: "trade",
    description: "Chaotic trade station deep in the Sulphur Winds. Cheap quantum parts.", controlledBy: "venus",
    prices: { quantum: 0.65, lumenite: 0.8, dread: 0.95, void: 0.9, plasma: 1.2, warp: 1.3, iron: 1.1, luxury: 0.75, precursor: 1.4 } },
  { id: "brass-spire", name: "Brass Spire",       pos: { x: 5400, y: -2000 }, zone: "venus2",  kind: "outpost",
    description: "A wind-battered relay with fuel, repairs, and hot gossip.", controlledBy: "venus",
    prices: { plasma: 0.85, warp: 0.95, food: 1.2, medicine: 1.25, nanite: 0.9, luxury: 1.0, "fuel-cell": 0.8 } },
  // venus3
  { id: "acid-citadel", name: "Acid Citadel",      pos: { x: -3800, y: 3200 },  zone: "venus3",   kind: "military",
    description: "Fortified deep-atmosphere platform. Specialized war contracts available.", controlledBy: "venus",
    prices: { dread: 1.4, warp: 1.3, plasma: 1.5, medpack: 0.8, synth: 0.9, quantum: 1.2, "fuel-cell": 1.4, contraband: 0.65 } },
  { id: "pressure-yard", name: "Pressure Yards",   pos: { x: 4800, y: 3800 },  zone: "venus3",   kind: "trade",
    description: "High-pressure fabrication yards building deep-atmosphere hulls.", controlledBy: "venus",
    prices: { iron: 1.4, scrap: 1.3, lumenite: 1.2, plasma: 1.1, dread: 0.9, nanite: 1.5, "fuel-cell": 1.2, luxury: 1.6 } },
  { id: "acid-exchange", name: "Acid Exchange",   pos: { x: -5400, y: -4200 }, zone: "venus3", kind: "mining",
    description: "Strip-mining exchange for hulls, ore, and deep-atmosphere salvage.", controlledBy: "venus",
    prices: { iron: 0.55, scrap: 0.65, lumenite: 0.8, plasma: 1.0, synth: 1.1, food: 1.3, medicine: 1.2 , sulfur: 0.5, cobalt: 0.65, "crystal-shard": 0.8} },
  // venus4
  { id: "core-refuge",  name: "Core Refuge",       pos: { x: 800, y: -3200 },    zone: "venus4",   kind: "outpost",
    description: "Shielded station near the crushing core. Last refuge before the Eye.", controlledBy: "venus",
    prices: { void: 0.6, dread: 1.2, quantum: 1.4, medpack: 1.3, synth: 1.2, contraband: 0.5, relic: 0.7, exotic: 0.8, food: 1.8 } },
  { id: "pressure-port", name: "Pressure Point Port", pos: { x: 4600, y: 3800 }, zone: "venus4",  kind: "trade",
    description: "Shadow market near the core. Extreme rarity items surface here.", controlledBy: "venus",
    prices: { quantum: 0.5, void: 1.4, dread: 1.5, lumenite: 1.3, warp: 1.2, contraband: 0.4, luxury: 0.6, relic: 0.65, precursor: 0.7, exotic: 1.4 } },
  { id: "cradle", name: "Cradle Station",          pos: { x: -5200, y: 2400 }, zone: "venus4", kind: "outpost",
    description: "A shielded refuge that services long-haul couriers and prospectors.", controlledBy: "venus",
    prices: { food: 1.6, medicine: 1.4, medpack: 1.1, synth: 1.0, quantum: 0.9, relic: 0.8, exotic: 0.9 } },
  // venus5
  { id: "venus-bastion", name: "Venusian Bastion",  pos: { x: 0, y: 0 },      zone: "venus5",   kind: "military",
    description: "The ultimate Venusian military fortress. Sells the rarest gear in the solar system.", controlledBy: "venus",
    prices: { dread: 2.0, warp: 1.9, plasma: 2.2, iron: 0.68, scrap: 0.75, lumenite: 1.1, quantum: 1.5 , obsidian: 1.4, palladium: 1.3, iridium: 1.5, "void-steel": 1.7, "crystal-matrix": 1.5, "fusion-core": 1.6} },
  { id: "eye-bazaar",   name: "Eye Bazaar",         pos: { x: -4600, y: 4400 }, zone: "venus5",   kind: "trade",
    description: "Legendary trading post in the heart of Venus. Anything can be bought — at a price.", controlledBy: "venus",
    prices: { iron: 0.5, scrap: 0.55, lumenite: 0.7, quantum: 0.8, void: 1.5, dread: 2.0, exotic: 0.65, relic: 0.7 , palladium: 0.7, iridium: 0.8, obsidian: 0.6} },
  { id: "singularity-dock", name: "Singularity Dock", pos: { x: 5400, y: -3600 }, zone: "venus5", kind: "military",
    description: "A blackglass dock for elite escorts and endgame merchants.", controlledBy: "venus",
    prices: { dread: 1.5, warp: 1.6, plasma: 1.8, quantum: 1.0, relic: 0.95, exotic: 0.9, lumenite: 1.1 } },
  // ── EXTRA TRADING POSTS ──────────────────────────────────────────────────
  { id: "alpha-bazaar", name: "Alpha Bazaar",       pos: { x: 5200, y: -3800 }, zone: "alpha", kind: "trade",
    description: "Busy frontier market. Traders flock here for bulk deals.", controlledBy: "earth",
    prices: { scrap: 1.3, iron: 1.2, plasma: 0.8, food: 0.6, medicine: 0.7, titanium: 0.8, "cryo-fluid": 1.1, luxury: 1.5, spice: 0.7, "plasma-coil": 0.75 } },
  { id: "nebula-exchange", name: "Nebula Exchange", pos: { x: 5400, y: 4200 }, zone: "nebula", kind: "trade",
    description: "Hidden exchange deep in the nebula clouds.", controlledBy: "earth",
    prices: { quantum: 0.75, void: 0.8, warp: 1.2, contraband: 0.5, "neural-chip": 0.7, "dark-matter": 1.3, "bio-crystal": 0.8, exotic: 1.4 } },
  { id: "crimson-market", name: "Crimson Market",   pos: { x: -5400, y: 5000 }, zone: "crimson", kind: "trade",
    description: "War-zone black market. Weapons and rare goods.", controlledBy: "earth",
    prices: { dread: 0.8, plasma: 1.3, iron: 1.4, "fuel-cell": 1.3, titanium: 0.7, "plasma-coil": 0.6, contraband: 0.5, "neural-chip": 1.2 } },
  { id: "void-trade", name: "Void Trade Nexus",     pos: { x: -5200, y: -4800 }, zone: "void", kind: "trade",
    description: "Nexus point where void traders gather.", controlledBy: "earth",
    prices: { void: 0.5, quantum: 0.6, dread: 1.3, "dark-matter": 0.6, "bio-crystal": 0.7, relic: 0.7, exotic: 1.2, blackglass: 0.65 } },
  { id: "forge-market", name: "Forge Market",       pos: { x: 5400, y: -3800 }, zone: "forge", kind: "trade",
    description: "Industrial market for refined materials.", controlledBy: "earth",
    prices: { iron: 0.4, scrap: 0.5, titanium: 0.55, "plasma-coil": 0.5, lumenite: 0.7, "cryo-fluid": 0.8, dread: 1.4, void: 1.5 , cobalt: 0.55, copper: 0.6, palladium: 0.7} },
  { id: "corona-exchange", name: "Corona Exchange", pos: { x: -5000, y: -4600 }, zone: "corona", kind: "trade",
    description: "High-energy trade hub near the solar corona.", controlledBy: "mars",
    prices: { lumenite: 0.4, "cryo-fluid": 0.5, plasma: 0.6, "plasma-coil": 0.55, quantum: 1.1, dread: 1.3, "dark-matter": 1.4 , "helium-3": 0.55, "crystal-shard": 0.65} },
  { id: "fracture-bazaar", name: "Fracture Bazaar", pos: { x: 5200, y: 3800 }, zone: "fracture", kind: "trade",
    description: "Dimensional rift bazaar. Strange goods at strange prices.", controlledBy: "mars",
    prices: { void: 0.4, "dark-matter": 0.5, "neural-chip": 0.6, quantum: 0.65, dread: 1.6, lumenite: 1.5, "bio-crystal": 0.55, relic: 0.6 } },
  { id: "abyss-exchange", name: "Abyss Exchange",   pos: { x: 5400, y: -4600 }, zone: "abyss", kind: "trade",
    description: "Deep-space exchange post. Ultimate trade goods.", controlledBy: "mars",
    prices: { quantum: 0.35, void: 1.6, dread: 2.0, "dark-matter": 0.4, exotic: 0.5, precursor: 0.5, relic: 0.55, "neural-chip": 0.5 , obsidian: 0.55, palladium: 0.6, iridium: 0.7} },
  { id: "mars-trade", name: "Martian Trade Hub",    pos: { x: -5400, y: -4200 }, zone: "marsdepth", kind: "trade",
    description: "Remote Martian trading hub for rare salvage.", controlledBy: "mars",
    prices: { iron: 0.5, titanium: 0.6, "plasma-coil": 0.55, dread: 1.6, warp: 1.5, "cryo-fluid": 0.7, contraband: 0.4, "fusion-lattice": 0.8 } },
  { id: "storm-bazaar", name: "Storm Bazaar",       pos: { x: 5600, y: -3200 }, zone: "maelstrom", kind: "trade",
    description: "Floating bazaar in the storm's edge. Everything for sale.", controlledBy: "mars",
    prices: { iron: 0.4, scrap: 0.45, titanium: 0.5, lumenite: 0.6, quantum: 0.8, void: 1.4, dread: 1.8, exotic: 0.6, "dark-matter": 0.7 , palladium: 0.6, iridium: 0.65, obsidian: 0.7} },
  { id: "venus2-trade", name: "Sulphur Exchange",   pos: { x: 5400, y: 4200 }, zone: "venus2", kind: "trade",
    description: "Secondary trade post in the sulphur corridors.", controlledBy: "venus",
    prices: { "bio-matter": 0.6, nanite: 0.7, "bio-crystal": 0.65, food: 1.4, medicine: 1.3, luxury: 0.8, "cryo-fluid": 0.75, "neural-chip": 1.1 } },
  { id: "venus3-trade", name: "Deep Acid Market",   pos: { x: -5600, y: -5200 }, zone: "venus3", kind: "trade",
    description: "Market at the acid layer boundary. Hazardous but lucrative.", controlledBy: "venus",
    prices: { titanium: 0.6, "plasma-coil": 0.55, iron: 1.3, dread: 0.85, contraband: 0.5, "dark-matter": 1.2, blackglass: 0.6, "fusion-lattice": 0.9 } },
  { id: "venus4-trade", name: "Core Trade Post",    pos: { x: -5400, y: -4000 }, zone: "venus4", kind: "trade",
    description: "Trade post near the crushing core. Extreme prices.", controlledBy: "venus",
    prices: { quantum: 0.45, void: 1.5, dread: 1.6, "dark-matter": 0.55, exotic: 1.3, relic: 0.6, "neural-chip": 0.55, "bio-crystal": 0.6 } },
  { id: "venus5-trade", name: "Eye Trade Ring",     pos: { x: 5600, y: 3800 }, zone: "venus5", kind: "trade",
    description: "Ring station orbiting the Eye of Venus. Legendary goods.", controlledBy: "venus",
    prices: { quantum: 0.4, void: 1.6, dread: 2.1, exotic: 0.55, precursor: 0.45, "dark-matter": 0.5, "neural-chip": 0.5, blackglass: 0.55 } },
  { id: "danger1-trade", name: "Rift Market",       pos: { x: 5200, y: -4600 }, zone: "danger1", kind: "trade",
    description: "Lawless market in the rift zone. No rules, no refunds.", controlledBy: "earth",
    prices: { contraband: 0.3, dread: 2.0, void: 1.8, exotic: 0.5, "dark-matter": 0.4, "neural-chip": 0.45, relic: 0.45, precursor: 0.5 , iridium: 0.5, palladium: 0.6, obsidian: 0.65} },
  { id: "danger2-trade", name: "Dead Zone Bazaar",  pos: { x: 5400, y: 3800 }, zone: "danger2", kind: "trade",
    description: "Ghost station bazaar. Deals that shouldn't exist.", controlledBy: "venus",
    prices: { contraband: 0.25, exotic: 0.4, "dark-matter": 0.35, relic: 0.4, precursor: 0.45, dread: 2.4, void: 2.2, quantum: 1.8 } },
  { id: "danger3-trade", name: "Pirate Freeport",   pos: { x: -5200, y: 4200 }, zone: "danger3", kind: "trade",
    description: "Pirate-run freeport. Everything has a price.", controlledBy: "venus",
    prices: { contraband: 0.15, luxury: 0.3, exotic: 0.45, "dark-matter": 0.4, dread: 2.8, void: 2.5, quantum: 2.0, blackglass: 0.4 } },
  { id: "danger4-trade", name: "Null Zone Exchange", pos: { x: 5000, y: -4200 }, zone: "danger4", kind: "trade",
    description: "Exchange post in null space. Reality is optional.", controlledBy: "earth",
    prices: { "dark-matter": 0.3, precursor: 0.35, exotic: 0.35, relic: 0.35, dread: 2.8, void: 2.8, quantum: 2.2, "neural-chip": 0.4 } },
  { id: "danger5-trade", name: "Abyss Gate Bazaar", pos: { x: 4800, y: 4400 }, zone: "danger5", kind: "trade",
    description: "The deepest market. Prices beyond comprehension.", controlledBy: "mars",
    prices: { "dark-matter": 0.2, precursor: 0.25, exotic: 0.25, relic: 0.25, "neural-chip": 0.3, dread: 3.5, void: 3.5, quantum: 3.0 , iridium: 0.4, palladium: 0.5} },
  // ── DANGER ZONES ──────────────────────────────────────────────────────────
  { id: "rift-outpost", name: "Rift Outpost",      pos: { x: 0, y: 0 },     zone: "danger1", kind: "outpost",
    description: "A lawless outpost in contested space. No faction protection.", controlledBy: "earth",
    prices: { dread: 1.8, void: 1.5, quantum: 1.3, scrap: 0.5, iron: 0.6, contraband: 0.4, exotic: 0.7 } },
  { id: "dead-market", name: "Dead Zone Market",   pos: { x: -3600, y: 4200 }, zone: "danger2", kind: "trade",
    description: "Black market deep in the Dead Zone. Extreme prices, extreme goods.", controlledBy: "mars",
    prices: { dread: 2.2, void: 2.0, quantum: 0.4, contraband: 0.3, relic: 0.5, exotic: 0.5, precursor: 0.6, luxury: 0.4 } },
  { id: "pirate-dock", name: "Pirate Stronghold",  pos: { x: 2800, y: -3200 }, zone: "danger3", kind: "outpost",
    description: "Pirate-run dock. They'll sell to anyone with credits.", controlledBy: "venus",
    prices: { contraband: 0.2, relic: 0.6, exotic: 0.6, dread: 2.5, void: 2.2, quantum: 1.8, luxury: 0.3 } },
  { id: "null-station", name: "Null Station",      pos: { x: 800, y: 3600 },   zone: "danger4", kind: "military",
    description: "Abandoned military station, now a neutral ground for all factions.", controlledBy: "earth",
    prices: { dread: 2.5, void: 2.5, quantum: 2.0, precursor: 0.4, relic: 0.4, exotic: 0.4, "star-map": 0.3 } },
  { id: "abyss-gate", name: "Abyss Gate Station",  pos: { x: -2400, y: -2800 }, zone: "danger5", kind: "trade",
    description: "The deepest station in known space. Legendary equipment and resources.", controlledBy: "mars",
    prices: { dread: 3.0, void: 3.0, quantum: 2.5, precursor: 0.3, relic: 0.3, exotic: 0.3, "fusion-lattice": 0.2, "star-map": 0.2 } },
];

export const PORTALS: Portal[] = [
  // Earth chain: alpha ↔ nebula ↔ crimson ↔ void ↔ forge (top-right / bottom-left corners)
  { id: "p-a-n",   pos: { x:  6500, y: -6500 }, fromZone: "alpha",    toZone: "nebula"   },
  { id: "p-n-a",   pos: { x: -6500, y:  6500 }, fromZone: "nebula",   toZone: "alpha"    },
  { id: "p-n-c",   pos: { x:  6500, y:  6500 }, fromZone: "nebula",   toZone: "crimson"  },
  { id: "p-c-n",   pos: { x: -6500, y: -6500 }, fromZone: "crimson",  toZone: "nebula"   },
  { id: "p-c-v",   pos: { x:  6500, y: -6500 }, fromZone: "crimson",  toZone: "void"     },
  { id: "p-v-c",   pos: { x: -6500, y:  6500 }, fromZone: "void",     toZone: "crimson"  },
  { id: "p-v-f",   pos: { x:  6500, y:  6500 }, fromZone: "void",     toZone: "forge"    },
  { id: "p-f-v",   pos: { x: -6500, y: -6500 }, fromZone: "forge",    toZone: "void"     },
  // Cross-faction: Earth endgame → Mars entry
  { id: "p-f-co",  pos: { x: -6500, y:  6500 }, fromZone: "forge",    toZone: "corona"   },
  { id: "p-co-f",  pos: { x:  6500, y: -6500 }, fromZone: "corona",   toZone: "forge"    },
  // Mars chain: corona ↔ fracture ↔ abyss ↔ marsdepth ↔ maelstrom
  { id: "p-co-fr", pos: { x: -6500, y: -6500 }, fromZone: "corona",   toZone: "fracture" },
  { id: "p-fr-co", pos: { x:  6500, y:  6500 }, fromZone: "fracture", toZone: "corona"   },
  { id: "p-fr-ab", pos: { x: -6500, y:  6500 }, fromZone: "fracture", toZone: "abyss"    },
  { id: "p-ab-fr", pos: { x:  6500, y: -6500 }, fromZone: "abyss",    toZone: "fracture" },
  { id: "p-ab-md", pos: { x: -6500, y: -6500 }, fromZone: "abyss",    toZone: "marsdepth"},
  { id: "p-md-ab", pos: { x:  6500, y:  6500 }, fromZone: "marsdepth",toZone: "abyss"    },
  { id: "p-md-ml", pos: { x: -6500, y:  6500 }, fromZone: "marsdepth",toZone: "maelstrom"},
  { id: "p-ml-md", pos: { x:  6500, y: -6500 }, fromZone: "maelstrom",toZone: "marsdepth"},
  // Cross-faction: Mars endgame → Venus entry
  { id: "p-ml-v1", pos: { x: -6500, y: -6500 }, fromZone: "maelstrom",toZone: "venus1"   },
  { id: "p-v1-ml", pos: { x:  6500, y:  6500 }, fromZone: "venus1",   toZone: "maelstrom"},
  // Venus chain: venus1 ↔ venus2 ↔ venus3 ↔ venus4 ↔ venus5
  { id: "p-v1-v2", pos: { x:  6500, y: -6500 }, fromZone: "venus1",   toZone: "venus2"   },
  { id: "p-v2-v1", pos: { x: -6500, y:  6500 }, fromZone: "venus2",   toZone: "venus1"   },
  { id: "p-v2-v3", pos: { x:  6500, y:  6500 }, fromZone: "venus2",   toZone: "venus3"   },
  { id: "p-v3-v2", pos: { x: -6500, y: -6500 }, fromZone: "venus3",   toZone: "venus2"   },
  { id: "p-v3-v4", pos: { x:  6500, y: -6500 }, fromZone: "venus3",   toZone: "venus4"   },
  { id: "p-v4-v3", pos: { x: -6500, y:  6500 }, fromZone: "venus4",   toZone: "venus3"   },
  { id: "p-v4-v5", pos: { x:  6500, y:  6500 }, fromZone: "venus4",   toZone: "venus5"   },
  { id: "p-v5-v4", pos: { x: -6500, y: -6500 }, fromZone: "venus5",   toZone: "venus4"   },
  // Cross-faction: Venus endgame → Earth entry (completing the triangle)
  { id: "p-v5-a",  pos: { x:  6500, y: -6500 }, fromZone: "venus5",   toZone: "alpha"    },
  { id: "p-a-v5",  pos: { x: -6500, y:  6500 }, fromZone: "alpha",    toZone: "venus5"   },
  // Danger zone portals — accessible from faction endgame zones
  { id: "p-f-d1",  pos: { x:  6500, y:  6500 }, fromZone: "forge",    toZone: "danger1"  },
  { id: "p-d1-f",  pos: { x: -6500, y: -6500 }, fromZone: "danger1",  toZone: "forge"    },
  { id: "p-ml-d1", pos: { x:  6500, y:  6500 }, fromZone: "maelstrom",toZone: "danger1"  },
  { id: "p-d1-ml", pos: { x: -6500, y:  6500 }, fromZone: "danger1",  toZone: "maelstrom"},
  { id: "p-v5-d1", pos: { x: -6500, y:  6500 }, fromZone: "venus5",   toZone: "danger1"  },
  { id: "p-d1-v5", pos: { x:  6500, y:  6500 }, fromZone: "danger1",  toZone: "venus5"   },
  // Danger zone chain: danger1 ↔ danger2 ↔ danger3 ↔ danger4 ↔ danger5
  { id: "p-d1-d2", pos: { x:  6500, y: -6500 }, fromZone: "danger1",  toZone: "danger2"  },
  { id: "p-d2-d1", pos: { x: -6500, y:  6500 }, fromZone: "danger2",  toZone: "danger1"  },
  { id: "p-d2-d3", pos: { x:  6500, y:  6500 }, fromZone: "danger2",  toZone: "danger3"  },
  { id: "p-d3-d2", pos: { x: -6500, y: -6500 }, fromZone: "danger3",  toZone: "danger2"  },
  { id: "p-d3-d4", pos: { x:  6500, y: -6500 }, fromZone: "danger3",  toZone: "danger4"  },
  { id: "p-d4-d3", pos: { x: -6500, y:  6500 }, fromZone: "danger4",  toZone: "danger3"  },
  { id: "p-d4-d5", pos: { x:  6500, y:  6500 }, fromZone: "danger4",  toZone: "danger5"  },
  { id: "p-d5-d4", pos: { x: -6500, y: -6500 }, fromZone: "danger5",  toZone: "danger4"  },
];

export const MAP_RADIUS = 8000;

export const FAKE_NAMES = [
  "Nyx_77","VoidPilot","StarbornAce","RogueComet","Hex.Drift","Aurora",
  "Cipher","Nebula_Q","Solenoid","Vanta","Quasar","Mira-7","Helios",
  "Lumen","Apex","Drekk",
];

export const FAKE_CLANS = [
  "Iron Wake","Crimson Veil","Pale Horizon","Null Sector","Aegis Pact","Starforge",
];

export const ENEMY_NAMES: Record<EnemyType, string[]> = {
  scout:     ["Scout"],
  raider:    ["Raider"],
  destroyer: ["Destroyer"],
  voidling:  ["Voidling"],
  dread:     ["Dread"],
};

// ── DRONES ────────────────────────────────────────────────────────────────
export const DRONE_DEFS: Record<DroneKind, DroneDef> = {
  "combat-i":  { id: "combat-i",  name: "Hornet Combat Drone",  price: 50000,  damageBonus: 6,  shieldBonus: 0,  hullBonus: 0,  fireRate: 0.7, color: "#ff5c6c", description: "Light auto-cannon drone. Fires at hostiles in range." },
  "combat-ii": { id: "combat-ii", name: "Wasp Mk-II Drone",     price: 180000, damageBonus: 14, shieldBonus: 0,  hullBonus: 0,  fireRate: 1.1, color: "#ff8a4e", description: "Heavy combat drone with rapid pulse cannons." },
  "shield-i":  { id: "shield-i",  name: "Aegis Shield Drone",   price: 75000,  damageBonus: 0,  shieldBonus: 60, hullBonus: 20, fireRate: 0,   color: "#4ee2ff", description: "Projects an additional shield bubble. Boosts your shield max." },
  "shield-ii": { id: "shield-ii", name: "Bulwark Shield Drone", price: 250000, damageBonus: 0,  shieldBonus: 140, hullBonus: 40, fireRate: 0,  color: "#7ad8ff", description: "Capital-grade defense drone. Massive shield bonus." },
  "salvage":   { id: "salvage",   name: "Salvager Drone",       price: 120000, damageBonus: 2,  shieldBonus: 30, hullBonus: 30, fireRate: 0.4, color: "#5cff8a", description: "Retrieves extra cargo from kills, light defenses." },
};

// ── HONOR RANKS ───────────────────────────────────────────────────────────
export const HONOR_RANKS: HonorRank[] = [
  { index: 0,  name: "Recruit",          minHonor: 0,        color: "#7a8ad8", symbol: "·",  pips: 0 },
  { index: 1,  name: "Space Pilot",      minHonor: 500,      color: "#7ad8ff", symbol: "▿",  pips: 1 },
  { index: 2,  name: "Basic Pilot",      minHonor: 2000,     color: "#5cff8a", symbol: "◇",  pips: 1 },
  { index: 3,  name: "Pilot",            minHonor: 5000,     color: "#aaff5c", symbol: "◆",  pips: 2 },
  { index: 4,  name: "Chief Pilot",      minHonor: 12000,    color: "#ffd24a", symbol: "★",  pips: 2 },
  { index: 5,  name: "Lieutenant",       minHonor: 30000,    color: "#ff8a4e", symbol: "★",  pips: 3 },
  { index: 6,  name: "Commander",        minHonor: 80000,    color: "#ff5c6c", symbol: "✪",  pips: 3 },
  { index: 7,  name: "Captain",          minHonor: 200000,   color: "#ff5cf0", symbol: "✪",  pips: 4 },
  { index: 8,  name: "Admiral",          minHonor: 500000,   color: "#b06cff", symbol: "✸",  pips: 4 },
  { index: 9,  name: "General",          minHonor: 1200000,  color: "#fff75c", symbol: "✺",  pips: 5 },
  { index: 10, name: "Marshal",          minHonor: 3000000,  color: "#ff4444", symbol: "✸",  pips: 5 },
  { index: 11, name: "Grand Marshal",    minHonor: 8000000,  color: "#ffd700", symbol: "✺",  pips: 6 },
  { index: 12, name: "Legend",           minHonor: 20000000, color: "#ffffff", symbol: "✸",  pips: 7 },
];

export function rankFor(honor: number): HonorRank {
  let r = HONOR_RANKS[0];
  for (const x of HONOR_RANKS) if (honor >= x.minHonor) r = x;
  return r;
}

// ── MODULE CATALOG ────────────────────────────────────────────────────────
export const RARITY_COLOR: Record<ModuleRarity, string> = {
  common: "#8aa0c0", uncommon: "#5cff8a", rare: "#4ee2ff", epic: "#ff5cf0", legendary: "#ffd24a",
};

export const MODULE_DEFS: Record<string, ModuleDef> = {
  // ── LASER WEAPONS ────────────────────────────────────────────────────────

  // ── TIER 1 STARTER VARIANTS ─────────────────────────────────────────────
  "wp-sniper-0":  { id: "wp-sniper-0",  slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  name: "Focus Beam",           description: "Entry-level beam weapon. One shot, big hit.",             rarity: "common",    color: "#aaddff", glyph: "\u2014", tier: 1, price: 4000,   stats: { damage: 8,  fireRate: 0.6 } },
  "wp-scatter-0": { id: "wp-scatter-0", slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", name: "Pellet Blaster",        description: "Basic shotgun laser. Short range, wide spread.",          rarity: "common",    color: "#7ad8ff", glyph: "\u22d9", tier: 1, price: 4500,   stats: { damage: 10,  fireRate: 1.1, aoeRadius: 6 } },
  "wp-rail-0":    { id: "wp-rail-0",    slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    name: "Tri-Shot",              description: "Entry burst cannon. 3 quick shots per trigger.",          rarity: "common",    color: "#ffaa44", glyph: "\u2261", tier: 1, price: 4200,   stats: { damage: 9,  fireRate: 0.95 } },

  "wp-pulse-1":   { id: "wp-pulse-1",   slot: "weapon", weaponKind: "laser",  name: "Pulse Laser Mk-I",     description: "Basic laser. Reliable starter weapon.",                   rarity: "common",    color: "#4ee2ff", glyph: "▶", tier: 1, price: 5000,   stats: { damage: 6,  fireRate: 1.0 } },
  "wp-pulse-2":   { id: "wp-pulse-2",   slot: "weapon", weaponKind: "laser",  name: "Pulse Laser Mk-II",    description: "Tuned pulse array. More damage, faster fire.",             rarity: "uncommon",  color: "#5cff8a", glyph: "▶", tier: 2, price: 22000,  stats: { damage: 12, fireRate: 1.15 } },
  "wp-pulse-3":   { id: "wp-pulse-3",   slot: "weapon", weaponKind: "laser",  name: "Pulse Laser Mk-III",   description: "Military-grade pulse array. High output.",                 rarity: "rare",      color: "#4ee2ff", glyph: "▶", tier: 3, price: 85000,  stats: { damage: 20, fireRate: 1.3, critChance: 0.03 } },
  "wp-ion":       { id: "wp-ion",       slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  name: "Ion Cannon",           description: "Heavy ion burst. Solid damage at mid range.",              rarity: "uncommon",  color: "#aaff5c", glyph: "≫", tier: 2, price: 34000,  stats: { damage: 16, fireRate: 0.95 } },
  "wp-scatter":   { id: "wp-scatter",   slot: "weapon", weaponKind: "laser",  firingPattern: "scatter",  name: "Scatter Laser",        description: "Fires 3 thin beams at once. Great vs groups.",             rarity: "uncommon",  color: "#7ad8ff", glyph: "⋙", tier: 2, price: 38000,  stats: { damage: 18,  fireRate: 1.4, aoeRadius: 8 } },
  "wp-plasma":    { id: "wp-plasma",    slot: "weapon", weaponKind: "laser",  name: "Plasma Cannon",        description: "Heavy plasma slug. High damage, slower cycle.",            rarity: "rare",      color: "#ff5cf0", glyph: "◆", tier: 3, price: 78000,  stats: { damage: 22, fireRate: 0.85, critChance: 0.04 } },
  "wp-phase":     { id: "wp-phase",     slot: "weapon", weaponKind: "laser",  firingPattern: "rail",  name: "Phase Repeater",       description: "Rapid-fire phase array. Crit-leaning.",                    rarity: "rare",      color: "#ff5cf0", glyph: "≫", tier: 3, price: 90000,  stats: { damage: 14, fireRate: 1.5, critChance: 0.08 } },
  "wp-arc":       { id: "wp-arc",       slot: "weapon", weaponKind: "laser",  firingPattern: "rail",  name: "Arc Disruptor",        description: "Chain-arc lightning. Splash effect on hit.",               rarity: "rare",      color: "#c8ffaa", glyph: "⚡", tier: 3, price: 110000, stats: { damage: 18, fireRate: 1.1, aoeRadius: 14, critChance: 0.05 } },
  "wp-sniper":    { id: "wp-sniper",    slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  name: "Precision Sniper",     description: "Long-range beam. Extreme damage, very slow fire.",         rarity: "epic",      color: "#ffffff", glyph: "—", tier: 4, price: 180000, stats: { damage: 48, fireRate: 0.45, critChance: 0.18 } },
  "wp-solar":     { id: "wp-solar",     slot: "weapon", weaponKind: "laser",  name: "Solar Lance",          description: "Star-grade lance. Splash damage, brutal output.",          rarity: "epic",      color: "#ffd24a", glyph: "✺", tier: 4, price: 240000, stats: { damage: 34, fireRate: 1.0, aoeRadius: 18, critChance: 0.06 } },
  "wp-void-lance":{ id: "wp-void-lance",slot: "weapon", weaponKind: "laser",  name: "Void Lance",           description: "Phase-shifted lance. Endgame laser weapon.",               rarity: "legendary", color: "#b06cff", glyph: "✸", tier: 5, price: 550000, stats: { damage: 44, fireRate: 1.3, aoeRadius: 22, critChance: 0.10 } },
  "wp-singular":  { id: "wp-singular",  slot: "weapon", weaponKind: "laser",  name: "Singularity Driver",   description: "Endgame weapon. Massive splash + crit.",                   rarity: "legendary", color: "#ff5c6c", glyph: "✸", tier: 5, price: 800000, stats: { damage: 52, fireRate: 1.1, aoeRadius: 28, critChance: 0.12 } },


  // ── SNIPER WEAPONS (beam) ───────────────────────────────────────────────
  "wp-sniper-1":  { id: "wp-sniper-1",  slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  name: "Marksman Beam Mk-I",   description: "Focused beam. High damage, slow fire.",                   rarity: "uncommon",  color: "#aaddff", glyph: "—", tier: 2, price: 32000,  stats: { damage: 18, fireRate: 0.55, critChance: 0.08 } },
  "wp-sniper-2":  { id: "wp-sniper-2",  slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  name: "Marksman Beam Mk-II",  description: "Enhanced beam. Devastating single-shot power.",            rarity: "rare",      color: "#88ccff", glyph: "—", tier: 3, price: 95000,  stats: { damage: 32, fireRate: 0.5, critChance: 0.12 } },

  // ── SCATTER WEAPONS (shotgun) ───────────────────────────────────────────
  "wp-scatter-2": { id: "wp-scatter-2", slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", name: "Spread Cannon Mk-II",  description: "Wide cone of pellets. Devastating at close range.",        rarity: "rare",      color: "#88eeff", glyph: "\u22d9", tier: 3, price: 82000,  stats: { damage: 28, fireRate: 1.2, aoeRadius: 10 } },
  "wp-scatter-3": { id: "wp-scatter-3", slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", name: "Storm Blaster",        description: "Military-grade shotgun array. Shreds close targets.",      rarity: "epic",      color: "#55ddff", glyph: "\u22d9", tier: 4, price: 200000, stats: { damage: 40, fireRate: 1.1, aoeRadius: 14, critChance: 0.06 } },

  // ── RAIL WEAPONS (burst/salvo) ──────────────────────────────────────────
  "wp-rail-1":    { id: "wp-rail-1",    slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    name: "Burst Cannon Mk-I",    description: "Fires 3 rapid shots per burst. Good sustained damage.",    rarity: "uncommon",  color: "#ffaa44", glyph: "\u2261", tier: 2, price: 35000,  stats: { damage: 17, fireRate: 0.9 } },
  "wp-rail-2":    { id: "wp-rail-2",    slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    name: "Burst Cannon Mk-II",   description: "Triple-shot rail system. Fast and lethal.",                rarity: "rare",      color: "#ff8844", glyph: "\u2261", tier: 3, price: 88000,  stats: { damage: 25, fireRate: 0.85, critChance: 0.04 } },
  "wp-rail-3":    { id: "wp-rail-3",    slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    name: "Railstorm Driver",     description: "Endgame burst weapon. Rapid triple-shot devastation.",     rarity: "epic",      color: "#ff6622", glyph: "\u2261", tier: 4, price: 220000, stats: { damage: 42, fireRate: 0.8, critChance: 0.08 } },

  // ── ROCKET WEAPONS ───────────────────────────────────────────────────────
  "wp-rocket-1":  { id: "wp-rocket-1",  slot: "weapon", weaponKind: "rocket", name: "Rocket Launcher Mk-I", description: "Fires slow homing rockets. High damage, low fire rate.",    rarity: "uncommon",  color: "#ff8a4e", glyph: "↑", tier: 2, price: 55000,  stats: { damage: 30, fireRate: 0.5,  aoeRadius: 20 } },
  "wp-rocket-2":  { id: "wp-rocket-2",  slot: "weapon", weaponKind: "rocket", name: "Heavy Rocket Pod",     description: "Twin heavy rockets. More blast, slower reload.",           rarity: "rare",      color: "#ff5c6c", glyph: "↑", tier: 3, price: 140000, stats: { damage: 55, fireRate: 0.4,  aoeRadius: 30, critChance: 0.04 } },
  "wp-torpedo":   { id: "wp-torpedo",   slot: "weapon", weaponKind: "rocket", name: "Void Torpedo",         description: "Endgame guided torpedo. Massive AoE destruction.",         rarity: "epic",      color: "#ffd24a", glyph: "⬆", tier: 4, price: 380000, stats: { damage: 90, fireRate: 0.3,  aoeRadius: 45, critChance: 0.08 } },
  "wp-hellfire":  { id: "wp-hellfire",  slot: "weapon", weaponKind: "rocket", name: "Hellfire Barrage",     description: "Rapid-fire mini rockets. Trades damage for fire rate.",     rarity: "epic",      color: "#ff5cf0", glyph: "⇑", tier: 4, price: 420000, stats: { damage: 35, fireRate: 0.85, aoeRadius: 18, critChance: 0.06 } },

  // ── GENERATORS (shields + regen, speed-focused, hybrid) ──────────────────
  "gn-core-1":    { id: "gn-core-1",    slot: "generator", name: "Core Generator Mk-I",   description: "Stock reactor. Modest shield + regen. 55% absorb.",    rarity: "common",    color: "#8aa0c0", glyph: "◈", tier: 1, price: 2500,   stats: { shieldMax: 30,  shieldRegen: 2, shieldAbsorb: 0.05 } },
  "gn-core-2":    { id: "gn-core-2",    slot: "generator", name: "Core Generator Mk-II",  description: "Improved reactor. Better shield & hull. 60% absorb.",  rarity: "uncommon",  color: "#5cff8a", glyph: "◈", tier: 2, price: 12000,  stats: { shieldMax: 70,  shieldRegen: 4,  hullMax: 20, shieldAbsorb: 0.10 } },
  "gn-sprint":    { id: "gn-sprint",    slot: "generator", name: "Sprint Drive",          description: "Speed-focused reactor. Light shield, 55% absorb.",     rarity: "uncommon",  color: "#aaff5c", glyph: "➤", tier: 2, price: 16000,  stats: { speed: 45,      shieldMax: 30,   shieldRegen: 2, shieldAbsorb: 0.05 } },
  "gn-aegis":     { id: "gn-aegis",     slot: "generator", name: "Aegis Reactor",         description: "Shield-focused core. 65% absorb.",                    rarity: "rare",      color: "#4ee2ff", glyph: "◇", tier: 3, price: 45000,  stats: { shieldMax: 140, shieldRegen: 7, shieldAbsorb: 0.15 } },
  "gn-fortify":   { id: "gn-fortify",   slot: "generator", name: "Fortify Reactor",       description: "Hull-focused core. Tanky, 60% absorb.",               rarity: "rare",      color: "#ff8a4e", glyph: "▣", tier: 3, price: 45000,  stats: { hullMax: 90,    shieldMax: 60,   damageReduction: 0.05, shieldAbsorb: 0.10 } },
  "gn-hyper":     { id: "gn-hyper",     slot: "generator", name: "Hyperdrive Core",       description: "Massive speed boost. 58% absorb.",                    rarity: "rare",      color: "#5cff8a", glyph: "≫", tier: 3, price: 60000, stats: { speed: 90,      shieldMax: 50,   shieldRegen: 3, shieldAbsorb: 0.08 } },
  "gn-prism":     { id: "gn-prism",     slot: "generator", name: "Prism Reactor",         description: "Balanced: speed + damage + shield. 60% absorb.",      rarity: "rare",      color: "#ffd24a", glyph: "◉", tier: 3, price: 55000, stats: { speed: 40,      damage: 8,       shieldMax: 80,   shieldRegen: 4, shieldAbsorb: 0.10 } },
  "gn-quantum":   { id: "gn-quantum",   slot: "generator", name: "Quantum Reactor",       description: "Endgame core. Massive shield & regen. 75% absorb.",   rarity: "epic",      color: "#ff5cf0", glyph: "⌬", tier: 4, price: 130000, stats: { shieldMax: 240, shieldRegen: 12, hullMax: 80, shieldAbsorb: 0.25 } },
  "gn-warp-drive":{ id: "gn-warp-drive",slot: "generator", name: "Warp Drive Core",       description: "Speed-endgame: fastest gen. 62% absorb.",             rarity: "epic",      color: "#aaff5c", glyph: "⇒", tier: 4, price: 150000, stats: { speed: 130,     shieldMax: 100,  shieldRegen: 6, shieldAbsorb: 0.12 } },
  "gn-leviathan": { id: "gn-leviathan", slot: "generator", name: "Leviathan Core",        description: "Legendary generator. Max survivability. 80% absorb.", rarity: "legendary", color: "#ff5c6c", glyph: "✸", tier: 5, price: 475000, stats: { shieldMax: 400, shieldRegen: 20, hullMax: 160, damageReduction: 0.08, shieldAbsorb: 0.30 } },
  "gn-phase-drive":{ id:"gn-phase-drive",slot:"generator", name: "Phase Drive",           description: "Legendary speed gen. 65% absorb.",                    rarity: "legendary", color: "#b06cff", glyph: "✺", tier: 5, price: 450000, stats: { speed: 180,     shieldMax: 160,  shieldRegen: 8,  hullMax: 40, shieldAbsorb: 0.15 } },

  // ── MODULES (utility: speed, cargo, loot, crit, AoE, armor, etc.) ────────
  "md-thrust-1":  { id: "md-thrust-1",  slot: "module", name: "Ion Thruster Mk-I",      description: "Boosts top speed by 30.",                               rarity: "common",    color: "#5cff8a", glyph: "➤", tier: 1, price: 3000,   stats: { speed: 30 } },
  "md-thrust-2":  { id: "md-thrust-2",  slot: "module", name: "Ion Thruster Mk-II",     description: "Substantial speed boost.",                              rarity: "uncommon",  color: "#5cff8a", glyph: "➤", tier: 2, price: 14000,  stats: { speed: 70 } },
  "md-afterburn": { id: "md-afterburn", slot: "module", name: "Afterburner",             description: "Speed +110, no other bonuses. Pure velocity.",          rarity: "rare",      color: "#aaff5c", glyph: "⇒", tier: 3, price: 47500,  stats: { speed: 110 } },
  "md-cargo":     { id: "md-cargo",     slot: "module", name: "Expanded Cargo Bay",     description: "+25% cargo capacity.",                                  rarity: "uncommon",  color: "#c69060", glyph: "▤", tier: 2, price: 16000,  stats: { cargoBonus: 0.25 } },
  "md-cargo-2":   { id: "md-cargo-2",   slot: "module", name: "Bulk Cargo Bay",         description: "+50% cargo capacity.",                                  rarity: "rare",      color: "#c69060", glyph: "▤", tier: 3, price: 40000,  stats: { cargoBonus: 0.50 } },
  "md-ammo-bay":  { id: "md-ammo-bay",  slot: "module", name: "Munitions Bay",          description: "+10 max ammo capacity for rocket weapons.",             rarity: "uncommon",  color: "#ff8a4e", glyph: "⟁", tier: 2, price: 17500,  stats: { ammoCapacity: 10 } },
  "md-ammo-bay-2":{ id: "md-ammo-bay-2",slot: "module", name: "Expanded Munitions Bay", description: "+25 max ammo capacity for rocket weapons.",             rarity: "rare",      color: "#ff5c6c", glyph: "⟁", tier: 3, price: 47500,  stats: { ammoCapacity: 25 } },
  "md-targeter":  { id: "md-targeter",  slot: "module", name: "Targeter Array",         description: "+10% crit chance.",                                     rarity: "rare",      color: "#ff5cf0", glyph: "✦", tier: 3, price: 40000,  stats: { critChance: 0.10 } },
  "md-targeter-2":{ id: "md-targeter-2",slot: "module", name: "Advanced Targeter",      description: "+18% crit chance.",                                     rarity: "epic",      color: "#ff5cf0", glyph: "⊕", tier: 4, price: 110000, stats: { critChance: 0.18 } },
  "md-plating":   { id: "md-plating",   slot: "module", name: "Reactive Plating",       description: "-8% incoming damage, +40 hull.",                        rarity: "rare",      color: "#ff8a4e", glyph: "⛨", tier: 3, price: 47500,  stats: { damageReduction: 0.08, hullMax: 40 } },
  "md-heavy-armor":{ id:"md-heavy-armor",slot:"module", name: "Heavy Combat Armor",     description: "-15% damage taken, +80 hull.",                          rarity: "epic",      color: "#ff8a4e", glyph: "⬛", tier: 4, price: 130000, stats: { damageReduction: 0.15, hullMax: 80 } },
  "md-shield-boost":{ id:"md-shield-boost",slot:"module",name: "Shield Booster",        description: "+120 max shield, +3 shield regen.",                     rarity: "rare",      color: "#4ee2ff", glyph: "◈", tier: 3, price: 42500,  stats: { shieldMax: 120, shieldRegen: 3 } },
  "md-scavenger": { id: "md-scavenger", slot: "module", name: "Scavenger Module",       description: "+1 loot per kill.",                                     rarity: "rare",      color: "#ffd24a", glyph: "$", tier: 3, price: 37500,  stats: { lootBonus: 1 } },
  "md-loot-2":    { id: "md-loot-2",    slot: "module", name: "Syndicate Scanner",      description: "+2 loot per kill.",                                     rarity: "epic",      color: "#ffd24a", glyph: "❖", tier: 4, price: 100000, stats: { lootBonus: 2 } },
  "md-overcharge":{ id: "md-overcharge",slot: "module", name: "Overcharge Capacitor",   description: "+14 damage to all weapons, +10% fire rate.",             rarity: "epic",      color: "#ff5c6c", glyph: "⚡", tier: 4, price: 140000, stats: { damage: 14, fireRate: 1.1 } },
  "md-overclock": { id: "md-overclock", slot: "module", name: "Overclock Module",       description: "+25% fire rate, +8 damage, -30 hull (trade-off).",      rarity: "epic",      color: "#ffaa22", glyph: "⚙", tier: 4, price: 150000, stats: { fireRate: 1.25, damage: 8, hullMax: -30 } },
  "md-nano-rep":  { id: "md-nano-rep",  slot: "module", name: "Nano-Repair Bot",        description: "+5 shield regen & +30 hull.",                           rarity: "uncommon",  color: "#5cff8a", glyph: "⬡", tier: 2, price: 22500,  stats: { shieldRegen: 5, hullMax: 30 } },
  "md-voidframe": { id: "md-voidframe", slot: "module", name: "Voidframe Stabilizer",   description: "Endgame: speed + DR + shield + crit.",                   rarity: "legendary", color: "#b06cff", glyph: "✺", tier: 5, price: 450000, stats: { speed: 60, damageReduction: 0.12, shieldMax: 120, critChance: 0.05 } },
  "md-singularity":{ id:"md-singularity",slot:"module", name: "Singularity Field",      description: "Legendary utility module. All stats boosted.",           rarity: "legendary", color: "#ff5c6c", glyph: "✸", tier: 5, price: 600000,stats: { damage: 20, speed: 50, shieldMax: 150, shieldRegen: 8, critChance: 0.08, damageReduction: 0.10 } },
};

export function moduleDef(idOrItem: string | ModuleItem): ModuleDef {
  const id = typeof idOrItem === "string" ? idOrItem : idOrItem.defId;
  return MODULE_DEFS[id];
}

// ── DUNGEONS ──────────────────────────────────────────────────────────────
export type DungeonId =
  | "alpha-rift" | "nebula-rift" | "crimson-rift" | "void-rift" | "forge-rift"
  | "corona-rift" | "fracture-rift" | "abyss-rift"
  | "marsdepth-rift" | "maelstrom-rift"
  | "venus1-rift" | "venus2-rift" | "venus3-rift" | "venus4-rift" | "venus5-rift";

export type DungeonDef = {
  id: DungeonId;
  name: string;
  zone: ZoneId;
  pos: Vec2;
  description: string;
  enemyTypes: EnemyType[];
  enemyHpMul: number;
  enemyDmgMul: number;
  waves: number;
  enemiesPerWave: number;
  rewardCredits: number;
  rewardExp: number;
  rewardModules: string[];      // pool of defIds (1 random drops)
  rewardMaterials: { resourceId: ResourceId; qty: number }[];
  color: string;
  unlockLevel: number;
};

export const DUNGEONS: Record<DungeonId, DungeonDef> = {
  "alpha-rift": {
    id: "alpha-rift", name: "Alpha Anomaly", zone: "alpha", pos: { x: -1400, y: 1100 },
    description: "A pirate fleet hideout. Good place to learn the ropes and earn alloy.",
    enemyTypes: ["scout", "raider"], enemyHpMul: 1.4, enemyDmgMul: 1.2,
    waves: 3, enemiesPerWave: 4,
    rewardCredits: 1500, rewardExp: 400,
    rewardModules: ["wp-pulse-2", "wp-pulse-3", "gn-core-2", "gn-sprint", "md-thrust-2", "md-cargo", "wp-rocket-1"],
    rewardMaterials: [{ resourceId: "iron", qty: 6 }, { resourceId: "scrap", qty: 8 }],
    color: "#7ad8ff", unlockLevel: 1,
  },
  "nebula-rift": {
    id: "nebula-rift", name: "Veil Vortex", zone: "nebula", pos: { x: -1100, y: 600 },
    description: "Raider stronghold inside a nebula tear. Drops plasma cores and rare modules.",
    enemyTypes: ["raider", "destroyer"], enemyHpMul: 1.6, enemyDmgMul: 1.4,
    waves: 4, enemiesPerWave: 5,
    rewardCredits: 4500, rewardExp: 1200,
    rewardModules: ["wp-plasma", "wp-phase", "wp-ion", "wp-rocket-2", "gn-aegis", "gn-fortify", "gn-hyper", "md-targeter", "md-plating", "md-scavenger", "md-afterburn", "md-overclock"],
    rewardMaterials: [{ resourceId: "plasma", qty: 8 }, { resourceId: "warp", qty: 4 }, { resourceId: "lumenite", qty: 5 }],
    color: "#ff5cf0", unlockLevel: 5,
  },
  "crimson-rift": {
    id: "crimson-rift", name: "Crimson Furnace", zone: "crimson", pos: { x: 1300, y: -900 },
    description: "Dread incursion site. High risk, epic-grade module drops.",
    enemyTypes: ["destroyer", "dread"], enemyHpMul: 1.8, enemyDmgMul: 1.5,
    waves: 4, enemiesPerWave: 5,
    rewardCredits: 12000, rewardExp: 3200,
    rewardModules: ["wp-solar", "wp-scatter", "wp-arc", "wp-torpedo", "gn-quantum", "gn-warp-drive", "md-overcharge", "md-plating", "md-heavy-armor", "md-shield-boost", "md-nano-rep"],
    rewardMaterials: [{ resourceId: "dread", qty: 3 }, { resourceId: "warp", qty: 8 }, { resourceId: "quantum", qty: 4 }],
    color: "#ff5c6c", unlockLevel: 10,
  },
  "void-rift": {
    id: "void-rift", name: "Void Maw", zone: "void", pos: { x: -800, y: 1200 },
    description: "A wound in spacetime. Legendary modules drop here.",
    enemyTypes: ["voidling", "dread"], enemyHpMul: 2.2, enemyDmgMul: 1.8,
    waves: 5, enemiesPerWave: 6,
    rewardCredits: 30000, rewardExp: 8000,
    rewardModules: ["wp-singular", "wp-sniper", "wp-void-lance", "wp-hellfire", "md-voidframe", "md-singularity", "gn-quantum", "gn-phase-drive", "gn-leviathan", "wp-solar"],
    rewardMaterials: [{ resourceId: "void", qty: 8 }, { resourceId: "dread", qty: 5 }, { resourceId: "quantum", qty: 8 }],
    color: "#b06cff", unlockLevel: 15,
  },
  "forge-rift": {
    id: "forge-rift", name: "Iron Crucible", zone: "forge", pos: { x: -1300, y: -900 },
    description: "Ancient automated warships guard a scorching foundry. Bring heavy armor — they hit back hard.",
    enemyTypes: ["destroyer", "dread"], enemyHpMul: 2.4, enemyDmgMul: 2.0,
    waves: 5, enemiesPerWave: 6,
    rewardCredits: 65000, rewardExp: 18000,
    rewardModules: ["wp-void-lance", "wp-hellfire", "wp-torpedo", "wp-solar", "gn-phase-drive", "gn-leviathan", "gn-quantum", "md-heavy-armor", "md-overcharge", "md-voidframe", "md-singularity"],
    rewardMaterials: [{ resourceId: "dread", qty: 6 }, { resourceId: "quantum", qty: 8 }, { resourceId: "void", qty: 5 }],
    color: "#ff8a4e", unlockLevel: 18,
  },
  "corona-rift": {
    id: "corona-rift", name: "Solar Pyre", zone: "corona", pos: { x: -1500, y: 800 },
    description: "Reality-bent hunters swarming a dying star's corona. Voidlings and Dreads orbit the plasma jets.",
    enemyTypes: ["voidling", "dread"], enemyHpMul: 2.7, enemyDmgMul: 2.3,
    waves: 5, enemiesPerWave: 7,
    rewardCredits: 100000, rewardExp: 6500,
    rewardModules: ["wp-void-lance", "wp-singular", "wp-hellfire", "wp-sniper", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe", "md-targeter-2", "md-overclock"],
    rewardMaterials: [{ resourceId: "void", qty: 10 }, { resourceId: "dread", qty: 7 }, { resourceId: "quantum", qty: 10 }],
    color: "#ffd24a", unlockLevel: 22,
  },
  "fracture-rift": {
    id: "fracture-rift", name: "Fracture Void", zone: "fracture", pos: { x: 1200, y: 1000 },
    description: "Spacetime tears unleash interdimensional horrors. Six waves of Dread-class threats await the reckless.",
    enemyTypes: ["voidling", "dread"], enemyHpMul: 3.0, enemyDmgMul: 2.6,
    waves: 6, enemiesPerWave: 7,
    rewardCredits: 175000, rewardExp: 50000,
    rewardModules: ["wp-singular", "wp-void-lance", "wp-hellfire", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe", "md-heavy-armor", "md-loot-2"],
    rewardMaterials: [{ resourceId: "void", qty: 14 }, { resourceId: "dread", qty: 10 }, { resourceId: "quantum", qty: 14 }],
    color: "#b06cff", unlockLevel: 27,
  },
  "abyss-rift": {
    id: "abyss-rift", name: "The Dread Abyss", zone: "abyss", pos: { x: 1300, y: -1000 },
    description: "Pure endgame. Seven brutal waves of Dreadnoughts in the darkest reach of known space. Legendary drops only.",
    enemyTypes: ["dread"], enemyHpMul: 3.6, enemyDmgMul: 3.0,
    waves: 7, enemiesPerWave: 8,
    rewardCredits: 300000, rewardExp: 85000,
    rewardModules: ["wp-singular", "wp-void-lance", "wp-hellfire", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe"],
    rewardMaterials: [{ resourceId: "void", qty: 20 }, { resourceId: "dread", qty: 15 }, { resourceId: "quantum", qty: 18 }],
    color: "#ff5c6c", unlockLevel: 32,
  },
  // ── Mars deep dungeons ────────────────────────────────────────────────────
  "marsdepth-rift": {
    id: "marsdepth-rift", name: "The Deep Maw", zone: "marsdepth", pos: { x: -1200, y: 900 },
    description: "Voidlings and Dreads haunt the Martian deep field. Ancient war machines guard a hidden reactor.",
    enemyTypes: ["voidling", "dread"], enemyHpMul: 2.5, enemyDmgMul: 2.2,
    waves: 5, enemiesPerWave: 7,
    rewardCredits: 140000, rewardExp: 40000,
    rewardModules: ["wp-void-lance", "wp-singular", "wp-hellfire", "wp-sniper", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe", "md-targeter-2", "md-overclock"],
    rewardMaterials: [{ resourceId: "void", qty: 12 }, { resourceId: "dread", qty: 8 }, { resourceId: "quantum", qty: 12 }],
    color: "#ff6844", unlockLevel: 25,
  },
  "maelstrom-rift": {
    id: "maelstrom-rift", name: "The Storm Crucible", zone: "maelstrom", pos: { x: 1100, y: -900 },
    description: "Six brutal waves of Dreadnoughts churn through the Maelstrom's core. The hardest Mars content.",
    enemyTypes: ["dread"], enemyHpMul: 3.2, enemyDmgMul: 2.8,
    waves: 6, enemiesPerWave: 8,
    rewardCredits: 250000, rewardExp: 70000,
    rewardModules: ["wp-singular", "wp-void-lance", "wp-hellfire", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe", "md-heavy-armor"],
    rewardMaterials: [{ resourceId: "void", qty: 18 }, { resourceId: "dread", qty: 13 }, { resourceId: "quantum", qty: 16 }],
    color: "#cc4488", unlockLevel: 33,
  },
  // ── Venus dungeons ────────────────────────────────────────────────────────
  "venus1-rift": {
    id: "venus1-rift", name: "Cloud Gate Anomaly", zone: "venus1", pos: { x: -1300, y: 1000 },
    description: "Pirate crews nest in the upper cloud layers. A good first challenge for fresh Venusian pilots.",
    enemyTypes: ["scout", "raider"], enemyHpMul: 1.4, enemyDmgMul: 1.2,
    waves: 3, enemiesPerWave: 4,
    rewardCredits: 1600, rewardExp: 420,
    rewardModules: ["wp-pulse-2", "wp-pulse-3", "gn-core-2", "gn-sprint", "md-thrust-2", "md-cargo", "wp-rocket-1"],
    rewardMaterials: [{ resourceId: "iron", qty: 6 }, { resourceId: "scrap", qty: 8 }],
    color: "#c86cff", unlockLevel: 2,
  },
  "venus2-rift": {
    id: "venus2-rift", name: "Sulphur Vortex", zone: "venus2", pos: { x: -1100, y: -700 },
    description: "A raider fleet fortified inside a sulphur wind spiral. Drops rare plasma and exotic cargo.",
    enemyTypes: ["raider", "destroyer"], enemyHpMul: 1.6, enemyDmgMul: 1.4,
    waves: 4, enemiesPerWave: 5,
    rewardCredits: 4800, rewardExp: 1300,
    rewardModules: ["wp-plasma", "wp-phase", "wp-ion", "wp-rocket-2", "gn-aegis", "gn-fortify", "gn-hyper", "md-targeter", "md-plating", "md-scavenger", "md-afterburn", "md-overclock"],
    rewardMaterials: [{ resourceId: "plasma", qty: 8 }, { resourceId: "warp", qty: 4 }, { resourceId: "lumenite", qty: 5 }],
    color: "#dd88ff", unlockLevel: 7,
  },
  "venus3-rift": {
    id: "venus3-rift", name: "Acidic Furnace", zone: "venus3", pos: { x: 1200, y: -800 },
    description: "Dreads and destroyers lurk in the acidic deep layers. Epic-grade Venusian modules await.",
    enemyTypes: ["destroyer", "dread"], enemyHpMul: 1.8, enemyDmgMul: 1.5,
    waves: 4, enemiesPerWave: 5,
    rewardCredits: 13000, rewardExp: 3500,
    rewardModules: ["wp-solar", "wp-scatter", "wp-arc", "wp-torpedo", "gn-quantum", "gn-warp-drive", "md-overcharge", "md-plating", "md-heavy-armor", "md-shield-boost", "md-nano-rep"],
    rewardMaterials: [{ resourceId: "dread", qty: 3 }, { resourceId: "warp", qty: 8 }, { resourceId: "quantum", qty: 4 }],
    color: "#bb55ee", unlockLevel: 12,
  },
  "venus4-rift": {
    id: "venus4-rift", name: "Pressure Core Maw", zone: "venus4", pos: { x: -900, y: 1100 },
    description: "A rift near the crushing core spawns voidlings and Dreads. Legendary modules are your reward.",
    enemyTypes: ["voidling", "dread"], enemyHpMul: 2.2, enemyDmgMul: 1.8,
    waves: 5, enemiesPerWave: 6,
    rewardCredits: 32000, rewardExp: 9000,
    rewardModules: ["wp-singular", "wp-sniper", "wp-void-lance", "wp-hellfire", "md-voidframe", "md-singularity", "gn-quantum", "gn-phase-drive", "gn-leviathan", "wp-solar"],
    rewardMaterials: [{ resourceId: "void", qty: 9 }, { resourceId: "dread", qty: 6 }, { resourceId: "quantum", qty: 9 }],
    color: "#9933dd", unlockLevel: 20,
  },
  "venus5-rift": {
    id: "venus5-rift", name: "The Eye Ascendant", zone: "venus5", pos: { x: -1200, y: -900 },
    description: "Seven waves of Dreadnoughts circle the Eye of Venus singularity. The ultimate Venusian challenge.",
    enemyTypes: ["dread"], enemyHpMul: 3.5, enemyDmgMul: 2.9,
    waves: 7, enemiesPerWave: 8,
    rewardCredits: 290000, rewardExp: 82000,
    rewardModules: ["wp-singular", "wp-void-lance", "wp-hellfire", "gn-leviathan", "gn-phase-drive", "md-singularity", "md-voidframe"],

  // ── Mining Lasers ──
  "wp-mining-1": { id: "wp-mining-1", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Mining Laser Mk-I",    description: "Basic mining beam. Doubles asteroid mining speed.",                rarity: "common",    color: "#e8a050", glyph: "⛏", tier: 1, price: 2000,   stats: { damage: 3,  fireRate: 1.0, miningBonus: 1.0 } },
  "wp-mining-2": { id: "wp-mining-2", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Mining Laser Mk-II",   description: "Improved mining beam with focused ore extraction.",                rarity: "uncommon",  color: "#ffcc44", glyph: "⛏", tier: 2, price: 15000,  stats: { damage: 5,  fireRate: 1.0, miningBonus: 2.0 } },
  "wp-mining-3": { id: "wp-mining-3", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Deep Core Drill",      description: "Industrial-grade mining beam. Chews through asteroids.",           rarity: "rare",      color: "#44ddff", glyph: "⛏", tier: 3, price: 50000,  stats: { damage: 8,  fireRate: 1.0, miningBonus: 3.5 } },
  "wp-mining-4": { id: "wp-mining-4", slot: "weapon", weaponKind: "laser", firingPattern: "mining", name: "Plasma Core Extractor", description: "Top-tier mining beam. Extracts ore at incredible speed.",           rarity: "epic",      color: "#ff8844", glyph: "⛏", tier: 4, price: 120000, stats: { damage: 12, fireRate: 1.0, miningBonus: 5.0 } },
    rewardMaterials: [{ resourceId: "void", qty: 20 }, { resourceId: "dread", qty: 14 }, { resourceId: "quantum", qty: 18 }],
    color: "#7722cc", unlockLevel: 30,
  },
};

export type DungeonRun = {
  id: DungeonId;
  wave: number;          // 1-indexed
  totalWaves: number;
  enemiesLeft: number;
  spawnedThisWave: boolean;
  startedAt: number;
  isFeatured: boolean;   // snapshotted at entry so runs crossing UTC midnight use correct bonus
};

// ── DAILY FEATURED DUNGEON ────────────────────────────────────────────────
export const DAILY_DUNGEON_BONUS = {
  creditsMul: 1.5,        // +50% credits
  extraModules: 1,        // 1 extra module drop (total 2)
  label: "+50% Credits · Double Module Drop",
};

/** Returns the featured DungeonId for today, seeded by UTC date so all players worldwide share the same one. */
export function getDailyFeaturedDungeon(): DungeonId {
  const now = new Date();
  // Use UTC date components so all players — regardless of timezone — resolve the same dungeon
  const dateKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  // Simple djb2-style hash of the date string
  let hash = 5381;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 33) ^ dateKey.charCodeAt(i);
  }
  const ids = Object.keys(DUNGEONS) as DungeonId[];
  return ids[Math.abs(hash) % ids.length];
}
