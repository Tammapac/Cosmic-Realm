import { useSyncExternalStore } from "react";
import {
  ActiveMission,
  Asteroid,
  CargoBox,
  CargoItem,
  ChatMessage,
  CONSUMABLE_DEFS,
  ConsumableId,
  DAILY_MISSION_POOL,
  Drone,
  DAILY_DUNGEON_BONUS,
  DUNGEONS,
  DungeonId,
  DungeonRun,
  getDailyFeaturedDungeon,
  Enemy,
  EquippedSlots,
  FACTIONS,
  FAKE_CLANS,
  FAKE_NAMES,
  FactionId,
  Floater,
  GameEvent,
  Milestones,
  MAP_RADIUS,
  MODULE_DEFS,
  ModuleItem,
  ModuleSlot,
  NpcShip,
  OtherPlayer,
  Particle,
  Player,
  Projectile,
  PORTALS,
  Quest,
  QUEST_POOL,
  RESOURCES,
  ResourceId,
  ROCKET_AMMO_TYPE_DEFS,
  ROCKET_MISSILE_TYPE_DEFS,
  RocketAmmoType,
  RocketMissileType,
  ROCKET_MISSILE_TYPE_ORDER,
  SHIP_CLASSES,
  SKILL_NODES,
  STATIONS,
  ShipClassId,
  SkillId,
  ZONES,
  ZoneId,
} from "./types";
import { sfx } from "./sound";
import { sendWarp } from "../net/socket";

export type HangarTab =
  | "bounties" | "loadout" | "ships" | "drones" | "market" | "ammo" | "cargo" | "repair" | "skills" | "missions" | "dungeons";
// "ammo" kept as valid value for internal use by loadout popup

export type DockServiceEntry = {
  kind: "repair" | "shield" | "ammo" | "failed";
  label: string;
  cost: number;
};

export type GameState = {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  floaters: Floater[];
  asteroids: Asteroid[];
  others: OtherPlayer[];
  npcShips: NpcShip[];
  chat: ChatMessage[];
  events: GameEvent[];
  cameraTarget: { x: number; y: number };
  cameraShake: number;          // 0..1, decays
  dockedAt: string | null;
  hangarTab: HangarTab;
  showMap: boolean;
  showClan: boolean;
  showSocial: boolean;
  showFactionPicker: boolean;
  showSkillTree: boolean;
  showMissions: boolean;
  paused: boolean;
  notifications: { id: string; text: string; ttl: number; kind: "info" | "good" | "bad" }[];
  availableQuests: Quest[];
  tick: number;
  recentHonor: { id: string; amount: number; ttl: number }[];
  levelUpFlash: number;          // seconds remaining of level-up overlay
  playerDeathFlash: number;      // seconds remaining of death screen overlay
  playerRespawnTimer: number;    // >0 = ship destroyed, awaiting respawn; 0 = alive
  bossSpawnTimer: number;        // countdown to next boss event
  pendingIdleReward: { credits: number; exp: number; secondsAway: number } | null;
  dungeon: DungeonRun | null;
  // consumable effects (game-time seconds)
  lastHitTick: number;            // game-tick when player was last damaged (for regen delay)
  repairBotUntil: number;        // gradual hull heal active until this game-time
  afterburnUntil: number;        // speed boost active until this game-time
  miningTargetId: string | null; // asteroid being mined (for beam visual)
  combatLaserFlash: { enemyId: string; ttl: number; maxTtl: number } | null; // brief flash beam on attack fire
  attackCooldownUntil: number;   // game-tick when attack cooldown expires
  attackCooldownDuration: number; // total duration of last attack cooldown (for progress bar)
  hotbarCooldowns: number[];     // 8 slots, remaining cooldown seconds
  pendingRocketSalvo: number;    // rockets left to fire this tick
  pendingDronePod: boolean;      // spawn a temp combat drone
  dockingSummary: DockServiceEntry[] | null;
  selectedWorldTarget: {
    kind: "enemy" | "asteroid";
    id: string;
    name: string;
    detail: string;
  } | null;
  attackTargetId: string | null;
  isAttacking: boolean;
  isLaserFiring: boolean;
  isRocketFiring: boolean;
  cargoBoxes: CargoBox[];
  showAmmoSelector: boolean;
  showRocketAmmoSelector: boolean;
  minimapScale: number;
  showFullZoneMap: boolean;
  cameraZoom: number;
};

const STORAGE_KEY = "stellar-frontier-save-v5";

function newMilestones(): Milestones {
  return { totalKills: 0, totalMined: 0, totalCreditsEarned: 0, totalWarps: 0, totalDeaths: 0, bossKills: 0 };
}

function rollDailyMissions(): ActiveMission[] {
  const pool = [...DAILY_MISSION_POOL];
  const out: ActiveMission[] = [];
  while (out.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    const m = pool.splice(i, 1)[0];
    out.push({ ...m, progress: 0, completed: false, claimed: false });
  }
  return out;
}

let _instanceSeq = 1;
export function newInstanceId(): string {
  return `mi-${Date.now().toString(36)}-${(_instanceSeq++).toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export function newModuleItem(defId: string): ModuleItem {
  return { instanceId: newInstanceId(), defId };
}

function emptyEquipped(shipId: ShipClassId): EquippedSlots {
  const cls = SHIP_CLASSES[shipId];
  return {
    weapon:    new Array(cls.slots.weapon).fill(null),
    generator: new Array(cls.slots.generator).fill(null),
    module:    new Array(cls.slots.module).fill(null),
  };
}

function makeInitialPlayer(): Player {
  const starterWeapon = newModuleItem("wp-pulse-1");
  const starterCore   = newModuleItem("gn-core-1");
  const starterMod    = newModuleItem("md-thrust-1");
  const equipped = emptyEquipped("skimmer");
  equipped.weapon[0]    = starterWeapon.instanceId;
  equipped.generator[0] = starterCore.instanceId;
  equipped.module[0]    = starterMod.instanceId;
  return {
    name: "Captain",
    shipClass: "skimmer",
    inventory: [starterWeapon, starterCore, starterMod],
    equipped,
    pos: { x: 0, y: 80 },
    vel: { x: 0, y: 0 },
    angle: -Math.PI / 2,
    hull: SHIP_CLASSES.skimmer.hullMax,
    shield: SHIP_CLASSES.skimmer.shieldMax,
    level: 1,
    exp: 0,
    credits: 10000,
    honor: 0,
    cargo: [],
    zone: "alpha",
    ownedShips: ["skimmer"],
    activeQuests: [],
    completedQuests: [],
    clan: null,
    party: [],
    drones: [],
    faction: null,
    skills: {},
    skillPoints: 0,
    milestones: newMilestones(),
    dailyMissions: rollDailyMissions(),
    lastDailyReset: Date.now(),
    lastSeen: Date.now(),
    consumables: { "repair-bot": 2, "shield-charge": 1 },
    hotbar: ["repair-bot", "shield-charge", null, null, null, null, null, null],
    ammo: { x1: 2000, x2: 0, x3: 0, x4: 0 },
    activeAmmoType: "x1" as RocketAmmoType,
    rocketAmmo: { cl1: 100, cl2: 0, bm3: 0, drock: 0 },
    activeRocketAmmoType: "cl1" as RocketMissileType,
    autoRestock: false,
    autoRepairHull: false,
    autoShieldRecharge: false,
    dungeonClears: {},
    dungeonBestTimes: {},
  };
}

function loadSaved(): Partial<Player> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function makeOthers(zone: ZoneId): OtherPlayer[] {
  const count = 6 + Math.floor(Math.random() * 4);
  const used = new Set<string>();
  const out: OtherPlayer[] = [];
  const ships: ShipClassId[] = ["skimmer", "wasp", "vanguard", "reaver", "obsidian", "marauder", "phalanx", "titan"];
  for (let i = 0; i < count; i++) {
    let name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    while (used.has(name)) {
      name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)] + Math.floor(Math.random() * 9);
    }
    used.add(name);
    out.push({
      id: `other-${i}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      pos: { x: (Math.random() - 0.5) * 3000, y: (Math.random() - 0.5) * 3000 },
      vel: { x: 0, y: 0 },
      angle: Math.random() * Math.PI * 2,
      level: 1 + Math.floor(Math.random() * 14),
      shipClass: ships[Math.floor(Math.random() * ships.length)],
      zone,
      inParty: false,
      clan: Math.random() < 0.5 ? FAKE_CLANS[Math.floor(Math.random() * FAKE_CLANS.length)] : null,
    });
  }
  return out;
}

function makeAsteroids(zone: ZoneId): Asteroid[] {
  const countMap: Partial<Record<ZoneId, number>> = {
    alpha: 80, nebula: 70, crimson: 60, void: 50, forge: 40,
    corona: 80, fracture: 70, abyss: 60, marsdepth: 50, maelstrom: 40,
    venus1: 80, venus2: 70, venus3: 60, venus4: 50, venus5: 40,
    danger1: 30, danger2: 30, danger3: 30, danger4: 25, danger5: 20,
  };
  const count = countMap[zone] ?? 20;
  const out: Asteroid[] = [];
  const mapR = MAP_RADIUS * 0.8;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 2 * mapR;
    const y = (Math.random() - 0.5) * 2 * mapR;
    const size = 14 + Math.random() * 22;
    const yieldsLumenite = Math.random() < 0.18;
    out.push({
      id: `ast-${i}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x, y },
      hp: size * 4,
      hpMax: size * 4,
      size,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.4,
      zone,
      yields: yieldsLumenite ? "lumenite" : "iron",
    });
  }
  return out;
}

function pickQuests(zone: ZoneId): Quest[] {
  return QUEST_POOL.filter((q) => q.zone === zone);
}

const saved = loadSaved();
const fresh = makeInitialPlayer();
const initialPlayer: Player = saved
  ? { ...fresh, ...saved, pos: { x: 0, y: 80 }, vel: { x: 0, y: 0 } }
  : fresh;

// Migration: ensure cargo, drones, milestones, missions, skills exist
if (Array.isArray(initialPlayer.cargo)) {
  initialPlayer.cargo = initialPlayer.cargo.filter(
    (c) => c && typeof (c as CargoItem).resourceId === "string" && RESOURCES[(c as CargoItem).resourceId]
  );
}
if (!Array.isArray(initialPlayer.drones)) initialPlayer.drones = [];
for (const d of initialPlayer.drones) if (!d.mode) d.mode = "orbit";
if (!initialPlayer.ammo || typeof initialPlayer.ammo !== "object" || Array.isArray(initialPlayer.ammo)) {
  initialPlayer.ammo = { x1: 0, x2: 0, x3: 0, x4: 0 };
} else {
  // Migrate from old per-weapon ammo to global pool
  const a = initialPlayer.ammo as any;
  if (typeof a.x1 !== "number") {
    const oldTotal = Object.values(a).reduce((s: number, v: any) => s + (typeof v === "number" ? v : 0), 0);
    initialPlayer.ammo = { x1: oldTotal as number, x2: 0, x3: 0, x4: 0 };
  }
}
if (!initialPlayer.activeAmmoType || !["x1","x2","x3","x4"].includes(initialPlayer.activeAmmoType)) {
  initialPlayer.activeAmmoType = "x1" as RocketAmmoType;
}
if (!initialPlayer.rocketAmmo || typeof initialPlayer.rocketAmmo !== "object") {
  initialPlayer.rocketAmmo = { cl1: 0, cl2: 0, bm3: 0, drock: 0 };
}
for (const t of ["cl1", "cl2", "bm3", "drock"] as RocketMissileType[]) {
  if (typeof initialPlayer.rocketAmmo[t] !== "number") initialPlayer.rocketAmmo[t] = 0;
}
if (!initialPlayer.activeRocketAmmoType || !["cl1","cl2","bm3","drock"].includes(initialPlayer.activeRocketAmmoType)) {
  initialPlayer.activeRocketAmmoType = "cl1" as RocketMissileType;
}
if (!initialPlayer.milestones) initialPlayer.milestones = newMilestones();
if (!initialPlayer.skills) initialPlayer.skills = {};
if (typeof initialPlayer.skillPoints !== "number") initialPlayer.skillPoints = Math.max(0, (initialPlayer.level ?? 1) - 1);
if (!Array.isArray(initialPlayer.dailyMissions)) initialPlayer.dailyMissions = rollDailyMissions();
if (typeof initialPlayer.lastDailyReset !== "number") initialPlayer.lastDailyReset = Date.now();
const prevLastSeen = typeof initialPlayer.lastSeen === "number" ? initialPlayer.lastSeen : Date.now();
initialPlayer.lastSeen = Date.now();
if (initialPlayer.faction !== "earth" && initialPlayer.faction !== "mars" && initialPlayer.faction !== "venus") {
  initialPlayer.faction = null;
}
if (!initialPlayer.dungeonClears || typeof initialPlayer.dungeonClears !== "object") initialPlayer.dungeonClears = {};
if (!initialPlayer.dungeonBestTimes || typeof initialPlayer.dungeonBestTimes !== "object") initialPlayer.dungeonBestTimes = {};

// ── Module/equip migration: ensure inventory + equipped exist ─────────────
function reconcileEquippedToShip(p: Player): void {
  const cls = SHIP_CLASSES[p.shipClass];
  const ids = new Set(p.inventory.map((m) => m.instanceId));
  const fix = (slot: ModuleSlot) => {
    const cur = (p.equipped as any)[slot] as (string | null)[] | undefined;
    const want = cls.slots[slot];
    const arr: (string | null)[] = new Array(want).fill(null);
    if (Array.isArray(cur)) {
      // Move existing into the new array (truncate if shrinking)
      let written = 0;
      for (const id of cur) {
        if (written >= want) break;
        if (id && ids.has(id)) { arr[written++] = id; }
      }
    }
    (p.equipped as any)[slot] = arr;
  };
  fix("weapon"); fix("generator"); fix("module");
}

if (!Array.isArray(initialPlayer.inventory)) initialPlayer.inventory = [];
// strip orphan defIds
initialPlayer.inventory = initialPlayer.inventory.filter(
  (m) => m && typeof m.defId === "string" && MODULE_DEFS[m.defId] && typeof m.instanceId === "string"
);
const legacy = initialPlayer as any;
if (!initialPlayer.equipped || typeof initialPlayer.equipped !== "object") {
  initialPlayer.equipped = emptyEquipped(initialPlayer.shipClass);
}
// If migrating from v3 (no inventory), seed starters
if (initialPlayer.inventory.length === 0) {
  const starters = [
    newModuleItem(legacy.equipment?.laserTier >= 4 ? "wp-pulse-2" : "wp-pulse-1"),
    newModuleItem(legacy.equipment?.shieldTier >= 4 ? "gn-core-2" : "gn-core-1"),
    newModuleItem(legacy.equipment?.thrusterTier >= 4 ? "md-thrust-2" : "md-thrust-1"),
  ];
  initialPlayer.inventory.push(...starters);
  initialPlayer.equipped = emptyEquipped(initialPlayer.shipClass);
  initialPlayer.equipped.weapon[0]    = starters[0].instanceId;
  initialPlayer.equipped.generator[0] = starters[1].instanceId;
  initialPlayer.equipped.module[0]    = starters[2].instanceId;
}
delete legacy.equipment;
reconcileEquippedToShip(initialPlayer);
// Reconcile new consumable fields
if (!initialPlayer.consumables || typeof initialPlayer.consumables !== "object") {
  initialPlayer.consumables = { "repair-bot": 2, "shield-charge": 1 };
}
if (!Array.isArray(initialPlayer.hotbar) || initialPlayer.hotbar.length !== 8) {
  initialPlayer.hotbar = ["repair-bot", "shield-charge", null, null, null, null, null, null];
}
if (typeof initialPlayer.autoRestock !== "boolean") initialPlayer.autoRestock = false;
if (typeof initialPlayer.autoRepairHull !== "boolean") initialPlayer.autoRepairHull = false;
if (typeof initialPlayer.autoShieldRecharge !== "boolean") initialPlayer.autoShieldRecharge = false;
// Clean up old per-weapon ammo fields
delete (initialPlayer as any).rocketAmmoType;
delete (initialPlayer as any).ammoByType;

// Daily reset: if >24h since last reset, refresh missions
const dayMs = 24 * 60 * 60 * 1000;
if (Date.now() - initialPlayer.lastDailyReset > dayMs) {
  initialPlayer.dailyMissions = rollDailyMissions();
  initialPlayer.lastDailyReset = Date.now();
}

const cls = SHIP_CLASSES[initialPlayer.shipClass];
initialPlayer.hull = Math.min(initialPlayer.hull || cls.hullMax, cls.hullMax);
initialPlayer.shield = cls.shieldMax;

// Idle engine disabled
let pendingIdleReward: GameState["pendingIdleReward"] = null;

export const state: GameState = {
  player: initialPlayer,
  enemies: [],
  projectiles: [],
  particles: [],
  floaters: [],
  asteroids: makeAsteroids(initialPlayer.zone),
  others: makeOthers(initialPlayer.zone),
  npcShips: [],
  chat: [
    { id: "c0", channel: "system", from: "SYSTEM", text: "Welcome to Stellar Frontier, Captain.", time: Date.now() },
    { id: "c1", channel: "local", from: "Aurora", text: "anyone running nebula bounties?", time: Date.now() },
    { id: "c2", channel: "local", from: "VoidPilot", text: "lfg crimson dread, need 2 more", time: Date.now() },
  ],
  events: [],
  cameraTarget: { x: 0, y: 80 },
  cameraShake: 0,
  dockedAt: null,
  hangarTab: "bounties",
  showMap: false,
  showClan: false,
  showSocial: false,
  showFactionPicker: initialPlayer.faction === null,
  showSkillTree: false,
  showMissions: false,
  paused: false,
  notifications: [],
  availableQuests: pickQuests(initialPlayer.zone),
  tick: 0,
  recentHonor: [],
  levelUpFlash: 0,
  playerDeathFlash: 0,
  playerRespawnTimer: 0,
  bossSpawnTimer: 240, // first boss event ~4 minutes in
  pendingIdleReward,
  dungeon: null,
  lastHitTick: 0,
  repairBotUntil: 0,
  afterburnUntil: 0,
  miningTargetId: null,
  combatLaserFlash: null,
  attackCooldownUntil: 0,
  attackCooldownDuration: 0.45,
  hotbarCooldowns: [0, 0, 0, 0, 0, 0, 0, 0],
  pendingRocketSalvo: 0,
  pendingDronePod: false,
  dockingSummary: null,
  selectedWorldTarget: null,
  attackTargetId: null,
  isAttacking: false,
  isLaserFiring: false,
  isRocketFiring: false,
  cargoBoxes: [],
  showAmmoSelector: false,
  showRocketAmmoSelector: false,
  minimapScale: 1,
  showFullZoneMap: false,
  cameraZoom: 1,
};

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(): void {
  for (const fn of listeners) fn();
}

let snap = 0;
export function getSnapshot(): number {
  return snap;
}

export function bump(): void {
  snap++;
  notify();
}

export function useGame<T>(selector: (s: GameState) => T): T {
  useSyncExternalStore(subscribe, getSnapshot);
  return selector(state);
}

export function save(): void {
  try {
    const p = state.player;
    p.lastSeen = Date.now();
    const toSave: Partial<Player> = {
      name: p.name,
      shipClass: p.shipClass,
      inventory: p.inventory,
      equipped: p.equipped,
      hull: p.hull,
      level: p.level,
      exp: p.exp,
      credits: p.credits,
      honor: p.honor,
      cargo: p.cargo,
      zone: p.zone,
      ownedShips: p.ownedShips,
      activeQuests: p.activeQuests,
      completedQuests: p.completedQuests,
      clan: p.clan,
      drones: p.drones,
      faction: p.faction,
      skills: p.skills,
      skillPoints: p.skillPoints,
      milestones: p.milestones,
      dailyMissions: p.dailyMissions,
      lastDailyReset: p.lastDailyReset,
      lastSeen: p.lastSeen,
      ammo: p.ammo,
      activeAmmoType: p.activeAmmoType,
      rocketAmmo: p.rocketAmmo,
      activeRocketAmmoType: p.activeRocketAmmoType,
      autoRestock: p.autoRestock,
      autoRepairHull: p.autoRepairHull,
      autoShieldRecharge: p.autoShieldRecharge,
      dungeonClears: p.dungeonClears,
      dungeonBestTimes: p.dungeonBestTimes,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    // Also save to server if logged in
    if (localStorage.getItem("cosmic-token")) {
      fetch("/api/player/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("cosmic-token")}`,
        },
        body: JSON.stringify({ ...toSave, pos: p.pos }),
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

export function loadServerPlayer(data: any): void {
  const p = state.player;
  if (data.name) p.name = data.name;
  if (data.shipClass) p.shipClass = data.shipClass;
  if (data.level != null) p.level = data.level;
  if (data.exp != null) p.exp = data.exp;
  if (data.credits != null) p.credits = data.credits;
  if (data.honor != null) p.honor = data.honor;
  if (data.hull != null) p.hull = data.hull;
  if (data.shield != null) p.shield = data.shield;
  if (data.zone) p.zone = data.zone;
  if (data.pos) { p.pos.x = data.pos.x; p.pos.y = data.pos.y; }
  if (data.faction !== undefined) {
    const FACTION_MIGRATE: Record<string, string> = { aurora: "earth", crimson: "mars", syndicate: "venus" };
    p.faction = (FACTION_MIGRATE[data.faction] ?? data.faction) as any;
    if (p.faction !== "earth" && p.faction !== "mars" && p.faction !== "venus") p.faction = null;
    state.showFactionPicker = p.faction === null;
  }
  if (data.skillPoints != null) p.skillPoints = data.skillPoints;
  if (data.skills) p.skills = data.skills;
  if (data.ownedShips) p.ownedShips = data.ownedShips;
  if (data.inventory) p.inventory = data.inventory;
  if (data.equipped) p.equipped = data.equipped;
  if (data.cargo) p.cargo = data.cargo;
  if (data.drones) p.drones = data.drones;
  if (data.consumables) p.consumables = data.consumables;
  if (data.hotbar) p.hotbar = data.hotbar;
  if (data.ammo && typeof data.ammo === "object" && typeof data.ammo.x1 === "number") p.ammo = data.ammo;
  if (data.activeAmmoType && ["x1","x2","x3","x4"].includes(data.activeAmmoType)) p.activeAmmoType = data.activeAmmoType;
  if (data.rocketAmmo && typeof data.rocketAmmo === "object") p.rocketAmmo = data.rocketAmmo;
  if (data.activeRocketAmmoType && ["cl1","cl2","bm3","drock"].includes(data.activeRocketAmmoType)) p.activeRocketAmmoType = data.activeRocketAmmoType;
  if (data.autoRestock != null) p.autoRestock = data.autoRestock;
  if (data.autoRepairHull != null) p.autoRepairHull = data.autoRepairHull;
  if (data.autoShieldRecharge != null) p.autoShieldRecharge = data.autoShieldRecharge;
  if (data.activeQuests) p.activeQuests = data.activeQuests;
  if (data.completedQuests) p.completedQuests = data.completedQuests;
  if (data.dailyMissions) p.dailyMissions = data.dailyMissions;
  if (data.lastDailyReset != null) p.lastDailyReset = data.lastDailyReset;
  if (data.milestones) p.milestones = data.milestones;
  if (data.dungeonClears) p.dungeonClears = data.dungeonClears;
  if (data.dungeonBestTimes) p.dungeonBestTimes = data.dungeonBestTimes;
  bump();
}

export function pushNotification(text: string, kind: "info" | "good" | "bad" = "info"): void {
  state.notifications.push({
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text, ttl: 4, kind,
  });
  sfx.notify(kind);
  bump();
}

export function pushHonor(amount: number): void {
  state.recentHonor.push({
    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
    amount, ttl: 1.4,
  });
  if (state.recentHonor.length > 8) state.recentHonor.shift();
}

export function pushChat(channel: ChatMessage["channel"], from: string, text: string): void {
  state.chat.push({
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    channel, from, text, time: Date.now(),
  });
  if (state.chat.length > 80) state.chat.shift();
  bump();
}

export function pushFloater(opts: {
  text: string; color: string; x: number; y: number; bold?: boolean; scale?: number; ttl?: number;
}): void {
  const ttl = opts.ttl ?? 0.8;
  state.floaters.push({
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    text: opts.text, color: opts.color,
    pos: { x: opts.x, y: opts.y },
    vy: -40 - Math.random() * 30,
    ttl, maxTtl: ttl,
    scale: opts.scale ?? 1,
    bold: opts.bold,
  });
  if (state.floaters.length > 60) state.floaters.shift();
}

export function pushEvent(ev: Omit<GameEvent, "id" | "startedAt">): void {
  state.events.push({
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    startedAt: Date.now(),
    ...ev,
  });
  bump();
}

export function refreshOthers(zone: ZoneId): void {
  state.others = makeOthers(zone);
  state.availableQuests = pickQuests(zone);
  state.asteroids = makeAsteroids(zone);
  bump();
}

export function travelToZone(zoneId: ZoneId): void {
  if (state.player.zone !== zoneId) {
    state.player.milestones.totalWarps++;
    bumpMission("warp-zones", 1);
  }
  state.player.zone = zoneId;
  state.player.pos = { x: 0, y: 80 };
  state.player.vel = { x: 0, y: 0 };
  state.cameraTarget = { ...state.player.pos };
  state.enemies = [];
  state.projectiles = [];
  state.particles = [];
  state.cargoBoxes = [];
  state.npcShips = [];
  refreshOthers(zoneId);
  sendWarp(zoneId, 0, 80);
  pushNotification(`Warped to ${ZONES[zoneId].name}`, "good");
  pushChat("system", "SYSTEM", `You entered ${ZONES[zoneId].name}.`);
  sfx.warp();
  save();
}

// ── ECONOMY HELPERS ────────────────────────────────────────────────────────
export function stationPrice(stationId: string, resourceId: ResourceId): number {
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station) return RESOURCES[resourceId].basePrice;
  const mod = station.prices[resourceId];
  let price = RESOURCES[resourceId].basePrice * (mod ?? 1.0);
  // Faction discounts disabled
  return Math.max(1, Math.round(price));
}

export function cargoUsed(): number {
  return state.player.cargo.reduce((a, c) => a + c.qty, 0);
}

export function cargoCapacity(): number {
  const cls = SHIP_CLASSES[state.player.shipClass];
  const p = state.player;
  const cargoSkill = p.skills["ut-cargo"] ?? 0;
  let modBonus = 0;
  for (const id of [...p.equipped.weapon, ...p.equipped.generator, ...p.equipped.module]) {
    if (!id) continue;
    const item = p.inventory.find((m) => m.instanceId === id);
    const def = item ? MODULE_DEFS[item.defId] : null;
    if (def?.stats.cargoBonus) modBonus += def.stats.cargoBonus;
  }
  return Math.floor(cls.cargoMax * (1 + cargoSkill * 0.15 + modBonus));
}

export function addCargo(resourceId: ResourceId, qty: number): number {
  const space = cargoCapacity() - cargoUsed();
  const take = Math.min(space, qty);
  if (take <= 0) return 0;
  const existing = state.player.cargo.find((c) => c.resourceId === resourceId);
  if (existing) existing.qty += take;
  else state.player.cargo.push({ resourceId, qty: take });
  return take;
}

export function removeCargo(resourceId: ResourceId, qty: number): number {
  const item = state.player.cargo.find((c) => c.resourceId === resourceId);
  if (!item) return 0;
  const take = Math.min(item.qty, qty);
  item.qty -= take;
  if (item.qty <= 0) {
    state.player.cargo = state.player.cargo.filter((c) => c.resourceId !== resourceId);
  }
  return take;
}

// ── CARGO BOX PICKUP (proximity-based with tractor beam) ─────────────────
const COLLECT_RANGE = 40;
const TRACTOR_RANGE = 80;

export function tryCollectNearbyBoxes(): void {
  const p = state.player;
  for (let i = state.cargoBoxes.length - 1; i >= 0; i--) {
    const cb = state.cargoBoxes[i];
    const dist = Math.hypot(cb.pos.x - p.pos.x, cb.pos.y - p.pos.y);
    if (dist < COLLECT_RANGE) {
      if (cb.qty > 0) {
        const got = addCargo(cb.resourceId, cb.qty);
        if (got > 0) {
          pushFloater({ text: `+${got} ${RESOURCES[cb.resourceId].name}`, color: "#5cff8a", x: cb.pos.x, y: cb.pos.y - 12, scale: 1, bold: true });
          sfx.pickup();
          state.cargoBoxes.splice(i, 1);
        }
      } else {
        state.cargoBoxes.splice(i, 1);
      }
    } else if (dist < TRACTOR_RANGE) {
      const pull = 120;
      const ang = Math.atan2(p.pos.y - cb.pos.y, p.pos.x - cb.pos.x);
      cb.pos.x += Math.cos(ang) * pull * 0.016;
      cb.pos.y += Math.sin(ang) * pull * 0.016;
    }
  }
}

export function collectCargoBox(boxId: string): void {
  const idx = state.cargoBoxes.findIndex((cb) => cb.id === boxId);
  if (idx < 0) return;
  const cb = state.cargoBoxes[idx];
  const p = state.player;
  const dist = Math.hypot(cb.pos.x - p.pos.x, cb.pos.y - p.pos.y);
  if (dist > COLLECT_RANGE) {
    pushNotification("Fly closer to collect", "bad");
    return;
  }
  if (cb.qty > 0) {
    const got = addCargo(cb.resourceId, cb.qty);
    if (got > 0) {
      pushFloater({ text: `+${got} ${RESOURCES[cb.resourceId].name}`, color: "#5cff8a", x: cb.pos.x, y: cb.pos.y - 12, scale: 1, bold: true });
    } else {
      pushNotification("Cargo bay full", "bad");
      return;
    }
  }
  sfx.pickup();
  state.cargoBoxes.splice(idx, 1);
  save(); bump();
}

// ── DRONES ────────────────────────────────────────────────────────────────
export function addDrone(d: Drone): void {
  state.player.drones.push(d);
}

export function removeDrone(droneId: string): void {
  state.player.drones = state.player.drones.filter((d) => d.id !== droneId);
}

export function maxDroneSlots(): number {
  const cls = SHIP_CLASSES[state.player.shipClass];
  return cls.droneSlots + (state.player.skills["ut-droneops"] ?? 0);
}

// ── AMMO ──────────────────────────────────────────────────────────────────
export const ROCKET_AMMO_BASE = 999999;
export const ROCKET_AMMO_COST_PER = 8; // credits per rocket round when restocking

export function rocketAmmoMax(): number {
  const p = state.player;
  let bonus = 0;
  for (const id of [...p.equipped.generator, ...p.equipped.module]) {
    if (!id) continue;
    const item = p.inventory.find((m) => m.instanceId === id);
    const def = item ? MODULE_DEFS[item.defId] : null;
    if (def?.stats.ammoCapacity) bonus += def.stats.ammoCapacity;
  }
  return ROCKET_AMMO_BASE + bonus;
}

export function getRocketWeaponIds(): string[] {
  return getAmmoWeaponIds();
}

export function getAmmoWeaponIds(): string[] {
  const p = state.player;
  const ids: string[] = [];
  for (const id of p.equipped.weapon) {
    if (!id) continue;
    const item = p.inventory.find((m) => m.instanceId === id);
    const kind = item ? MODULE_DEFS[item.defId]?.weaponKind : undefined;
    if (kind === "laser" || kind === "rocket") ids.push(id);
  }
  return ids;
}

export function ensureAmmoInitialized(): void {
  const p = state.player;
  const max = rocketAmmoMax();
  if (!p.ammo || typeof p.ammo !== "object") p.ammo = { x1: 0, x2: 0, x3: 0, x4: 0 };
  for (const t of ["x1", "x2", "x3", "x4"] as RocketAmmoType[]) {
    if (typeof p.ammo[t] !== "number") p.ammo[t] = 0;
    p.ammo[t] = Math.min(p.ammo[t], max);
  }
  if (!p.activeAmmoType || !["x1","x2","x3","x4"].includes(p.activeAmmoType)) p.activeAmmoType = "x1";
  // Also init rocket ammo
  const rMax = Math.floor(max * 0.25);
  if (!p.rocketAmmo || typeof p.rocketAmmo !== "object") p.rocketAmmo = { cl1: 0, cl2: 0, bm3: 0, drock: 0 };
  for (const t of ["cl1", "cl2", "bm3", "drock"] as RocketMissileType[]) {
    if (typeof p.rocketAmmo[t] !== "number") p.rocketAmmo[t] = 0;
    p.rocketAmmo[t] = Math.min(p.rocketAmmo[t], rMax);
  }
  if (!p.activeRocketAmmoType || !["cl1","cl2","bm3","drock"].includes(p.activeRocketAmmoType)) p.activeRocketAmmoType = "cl1";
}

export function restockAmmo(): void {
  const p = state.player;
  const max = rocketAmmoMax();
  ensureAmmoInitialized();
  const type = p.activeAmmoType;
  const cur = p.ammo[type] ?? 0;
  const missing = Math.max(0, max - cur);
  if (missing === 0) {
    pushNotification("Ammo already full", "info");
    return;
  }
  const def = ROCKET_AMMO_TYPE_DEFS[type];
  const cost = missing * def.costPerRound;
  if (p.credits < cost) {
    pushNotification(`Need ${cost}cr to restock ammo`, "bad");
    return;
  }
  p.credits -= cost;
  p.ammo[type] = max;
  bumpMission("spend-credits", cost);
  pushNotification(`${def.shortName} ammo restocked · -${cost}cr`, "good");
  save(); bump();
}

export function purchaseAmmoAmount(type: RocketAmmoType, amount: number): void {
  const p = state.player;
  const max = rocketAmmoMax();
  ensureAmmoInitialized();
  const cur = p.ammo[type] ?? 0;
  const canBuy = Math.min(amount, max - cur);
  if (canBuy <= 0) {
    pushNotification("Ammo already full", "info");
    return;
  }
  const def = ROCKET_AMMO_TYPE_DEFS[type];
  const cost = canBuy * def.costPerRound;
  if (p.credits < cost) {
    pushNotification(`Need ${cost}cr for ${canBuy} ${def.shortName} rounds`, "bad");
    return;
  }
  p.credits -= cost;
  p.ammo[type] = cur + canBuy;
  bumpMission("spend-credits", cost);
  pushNotification(`Bought ${canBuy} ${def.shortName} · -${cost}cr`, "good");
  save(); bump();
}

export function setAutoRestock(enabled: boolean): void {
  state.player.autoRestock = enabled;
  pushNotification(enabled ? "Auto-Restock enabled" : "Auto-Restock disabled", "info");
  save(); bump();
}

export function setAutoRepairHull(enabled: boolean): void {
  state.player.autoRepairHull = enabled;
  pushNotification(enabled ? "Auto-Repair Hull enabled" : "Auto-Repair Hull disabled", "info");
  save(); bump();
}

export function setAutoShieldRecharge(enabled: boolean): void {
  state.player.autoShieldRecharge = enabled;
  pushNotification(enabled ? "Auto-Shield Recharge enabled" : "Auto-Shield Recharge disabled", "info");
  save(); bump();
}

export function autoRepairIfEnabled(hullMax: number, collect?: DockServiceEntry[]): void {
  const p = state.player;
  if (!p.autoRepairHull) return;
  const hullDamage = hullMax - p.hull;
  if (hullDamage <= 0) return;
  const cost = Math.ceil(hullDamage * 2);
  if (p.credits < cost) {
    if (collect) collect.push({ kind: "failed", label: `Hull repair — insufficient credits (need ${cost}cr)`, cost: 0 });
    else pushNotification(`Auto-Repair: need ${cost}cr to repair hull`, "bad");
    return;
  }
  p.credits -= cost;
  p.hull = hullMax;
  bumpMission("spend-credits", cost);
  if (collect) collect.push({ kind: "repair", label: "Hull repaired to full", cost });
  else pushNotification(`Auto-Repair: hull restored · -${cost}cr`, "good");
  save(); bump();
}

export function autoShieldIfEnabled(shieldMax: number, collect?: DockServiceEntry[]): void {
  const p = state.player;
  if (!p.autoShieldRecharge) return;
  if (p.shield >= shieldMax) return;
  p.shield = shieldMax;
  if (collect) collect.push({ kind: "shield", label: "Shields recharged to full", cost: 0 });
  else pushNotification("Auto-Shield: shields recharged", "good");
  save(); bump();
}

// ── AMMO TYPE HELPERS ──────────────────────────────────────────────────────

/** Get the global active ammo type. */
export function getActiveAmmoType(): RocketAmmoType {
  return state.player.activeAmmoType ?? "x1";
}

/** Get the current global ammo count for a type. */
export function getAmmoCount(type?: RocketAmmoType): number {
  const t = type ?? state.player.activeAmmoType ?? "x1";
  return state.player.ammo[t] ?? 0;
}

/** Switch the global active ammo type. */
export function switchAmmoType(type: RocketAmmoType): void {
  ensureAmmoInitialized();
  state.player.activeAmmoType = type;
  const def = ROCKET_AMMO_TYPE_DEFS[type];
  pushNotification(`Ammo switched to ${def.name}`, "good");
  save(); bump();
}

export function autoRestockIfEnabled(collect?: DockServiceEntry[]): void {
  const p = state.player;
  if (!p.autoRestock) return;
  const max = rocketAmmoMax();
  ensureAmmoInitialized();
  const type = p.activeAmmoType;
  const cur = p.ammo[type] ?? 0;
  const missing = Math.max(0, max - cur);
  if (missing === 0) return;
  const def = ROCKET_AMMO_TYPE_DEFS[type];
  const cost = missing * def.costPerRound;
  if (p.credits < cost) {
    if (collect) collect.push({ kind: "failed", label: `Ammo restock — insufficient credits (need ${cost}cr)`, cost: 0 });
    else pushNotification(`Auto-Restock: need ${cost}cr to restock ammo`, "bad");
    return;
  }
  p.credits -= cost;
  p.ammo[type] = max;
  bumpMission("spend-credits", cost);
  if (collect) collect.push({ kind: "ammo", label: `${def.shortName} ammo restocked (${missing} rounds)`, cost });
  else pushNotification(`Auto-Restock: ${def.shortName} topped up · -${cost}cr`, "good");
  save(); bump();
}

// ── ROCKET AMMO HELPERS ──────────────────────────────────────────────────

export function rocketMissileMax(): number {
  return Math.floor(rocketAmmoMax() * 0.25);
}

export function ensureRocketAmmoInitialized(): void {
  const p = state.player;
  const max = rocketMissileMax();
  if (!p.rocketAmmo || typeof p.rocketAmmo !== "object") p.rocketAmmo = { cl1: 0, cl2: 0, bm3: 0, drock: 0 };
  for (const t of ["cl1", "cl2", "bm3", "drock"] as RocketMissileType[]) {
    if (typeof p.rocketAmmo[t] !== "number") p.rocketAmmo[t] = 0;
    p.rocketAmmo[t] = Math.min(p.rocketAmmo[t], max);
  }
  if (!p.activeRocketAmmoType || !["cl1","cl2","bm3","drock"].includes(p.activeRocketAmmoType)) p.activeRocketAmmoType = "cl1";
}

export function getActiveRocketAmmoType(): RocketMissileType {
  return state.player.activeRocketAmmoType ?? "cl1";
}

export function getRocketAmmoCount(type?: RocketMissileType): number {
  const t = type ?? state.player.activeRocketAmmoType ?? "cl1";
  return state.player.rocketAmmo[t] ?? 0;
}

export function switchRocketAmmoType(type: RocketMissileType): void {
  ensureRocketAmmoInitialized();
  state.player.activeRocketAmmoType = type;
  const def = ROCKET_MISSILE_TYPE_DEFS[type];
  pushNotification(`Rocket ammo switched to ${def.name}`, "good");
  save(); bump();
}

export function purchaseRocketAmmo(type: RocketMissileType, amount: number): void {
  const p = state.player;
  const max = rocketMissileMax();
  ensureRocketAmmoInitialized();
  const cur = p.rocketAmmo[type] ?? 0;
  const canBuy = Math.min(amount, max - cur);
  if (canBuy <= 0) {
    pushNotification("Rocket ammo already full", "info");
    return;
  }
  const def = ROCKET_MISSILE_TYPE_DEFS[type];
  const cost = canBuy * def.costPerRound;
  if (p.credits < cost) {
    pushNotification(`Need ${cost}cr for ${canBuy} ${def.shortName} rounds`, "bad");
    return;
  }
  p.credits -= cost;
  p.rocketAmmo[type] = cur + canBuy;
  bumpMission("spend-credits", cost);
  pushNotification(`Bought ${canBuy} ${def.shortName} · -${cost}cr`, "good");
  save(); bump();
}

export function runDockingServices(hullMax: number, shieldMax: number): void {
  state.dockingSummary = null;
  const entries: DockServiceEntry[] = [];
  autoRestockIfEnabled(entries);
  autoRepairIfEnabled(hullMax, entries);
  autoShieldIfEnabled(shieldMax, entries);
  if (entries.length > 0) {
    state.dockingSummary = entries;
    bump();
  }
}

// ── FACTIONS ──────────────────────────────────────────────────────────────
export function chooseFaction(id: FactionId): void {
  state.player.faction = id;
  state.showFactionPicker = false;
  const f = FACTIONS[id];
  pushNotification(`Joined ${f.name} [${f.tag}]`, "good");
  pushChat("system", "SYSTEM", `You pledged loyalty to ${f.name} [${f.tag}].`);
  travelToZone(f.startZone);
  save(); bump();
}

// ── SKILLS ────────────────────────────────────────────────────────────────
export function buySkillRank(skillId: SkillId): boolean {
  const node = SKILL_NODES.find((n) => n.id === skillId);
  if (!node) return false;
  const p = state.player;
  const cur = p.skills[skillId] ?? 0;
  if (cur >= node.maxRank) return false;
  if (node.requires) {
    const req = p.skills[node.requires] ?? 0;
    if (req <= 0) { pushNotification("Requires prior skill", "bad"); return false; }
  }
  if (p.skillPoints < node.cost) { pushNotification("Not enough skill points", "bad"); return false; }
  p.skillPoints -= node.cost;
  p.skills[skillId] = cur + 1;
  pushNotification(`${node.name} → rank ${cur + 1}`, "good");
  save(); bump();
  return true;
}

export function resetSkills(): void {
  const p = state.player;
  if (p.credits < 2000) { pushNotification("Respec costs 2000cr", "bad"); return; }
  let totalSpent = 0;
  for (const node of SKILL_NODES) {
    const r = p.skills[node.id] ?? 0;
    totalSpent += r * node.cost;
  }
  p.credits -= 2000;
  p.skills = {};
  p.skillPoints += totalSpent;
  pushNotification(`Skills reset · refunded ${totalSpent} pts`, "good");
  save(); bump();
}

// ── MISSIONS / MILESTONES ─────────────────────────────────────────────────
export function bumpMission(kind: ActiveMission["kind"], amount: number, zone?: ZoneId): void {
  for (const m of state.player.dailyMissions) {
    if (m.completed) continue;
    if (m.kind !== kind) continue;
    if (m.zoneFilter && m.zoneFilter !== zone) continue;
    m.progress = Math.min(m.target, m.progress + amount);
    if (m.progress >= m.target) {
      m.completed = true;
      pushNotification(`Daily complete: ${m.title}`, "good");
    }
  }
}

export function claimMission(missionId: string): void {
  const m = state.player.dailyMissions.find((x) => x.id === missionId);
  if (!m || !m.completed || m.claimed) return;
  m.claimed = true;
  state.player.credits += m.rewardCredits;
  state.player.exp += m.rewardExp;
  state.player.honor += m.rewardHonor;
  state.player.milestones.totalCreditsEarned += m.rewardCredits;
  pushNotification(`+${m.rewardCredits}cr +${m.rewardExp}xp +${m.rewardHonor}hr`, "good");
  save(); bump();
}

export function rerollDaily(): void {
  if (state.player.credits < 500) { pushNotification("Reroll costs 500cr", "bad"); return; }
  state.player.credits -= 500;
  state.player.dailyMissions = rollDailyMissions();
  pushNotification("Daily missions rerolled", "good");
  save(); bump();
}

export function checkMilestones(): void {
  const p = state.player;
  // Each crossed tier gives reward + chat
  // We track which tiers have been claimed via skillPoints free credit; simpler: check on-the-fly and award if just crossed a tier.
  // Use an internal "claimedTiers" key in a hidden Map per kind via skills field — to avoid extra schema, we'll store in a single key inside skills.
}

// ── IDLE REWARD ───────────────────────────────────────────────────────────
export function claimIdleReward(): void {
  const r = state.pendingIdleReward;
  if (!r) return;
  state.player.credits += r.credits;
  state.player.exp += r.exp;
  state.player.milestones.totalCreditsEarned += r.credits;
  state.pendingIdleReward = null;
  pushNotification(`Idle reward: +${r.credits}cr +${r.exp}xp`, "good");
  save(); bump();
}

export function dismissIdleReward(): void {
  state.pendingIdleReward = null;
  bump();
}

// ── MODULES / LOADOUT ─────────────────────────────────────────────────────
export function addInventoryItem(defId: string): ModuleItem | null {
  if (!MODULE_DEFS[defId]) return null;
  const item = newModuleItem(defId);
  state.player.inventory.push(item);
  return item;
}

export function equipModule(instanceId: string, slot: ModuleSlot, slotIndex: number): boolean {
  const p = state.player;
  const item = p.inventory.find((m) => m.instanceId === instanceId);
  if (!item) return false;
  const def = MODULE_DEFS[item.defId];
  if (!def || def.slot !== slot) { pushNotification("Wrong slot", "bad"); return false; }
  const arr = p.equipped[slot];
  if (slotIndex < 0 || slotIndex >= arr.length) return false;
  // Unequip from any other slot first to avoid double-equip
  unequipInstance(instanceId);
  p.equipped[slot][slotIndex] = instanceId;
  // Reclamp hull/shield to (possibly new) max
  // (caller-side recompute happens via effectiveStats at render time)
  ensureAmmoInitialized();
  pushNotification(`Equipped ${def.name}`, "good");
  save(); bump();
  return true;
}

export function unequipInstance(instanceId: string): void {
  const p = state.player;
  for (const slot of ["weapon", "generator", "module"] as ModuleSlot[]) {
    const arr = p.equipped[slot];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === instanceId) arr[i] = null;
    }
  }
}

export function unequipSlot(slot: ModuleSlot, slotIndex: number): void {
  const p = state.player;
  if (slotIndex < 0 || slotIndex >= p.equipped[slot].length) return;
  p.equipped[slot][slotIndex] = null;
  save(); bump();
}

export function sellInventoryItem(instanceId: string): void {
  const p = state.player;
  const item = p.inventory.find((m) => m.instanceId === instanceId);
  if (!item) return;
  const def = MODULE_DEFS[item.defId];
  if (!def) return;
  const price = Math.floor(def.price * 0.4);
  unequipInstance(instanceId);
  p.inventory = p.inventory.filter((m) => m.instanceId !== instanceId);
  p.credits += price;
  p.milestones.totalCreditsEarned += price;
  pushNotification(`Sold ${def.name} · +${price}cr`, "good");
  save(); bump();
}

export function reconcileShipSlots(): void {
  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];
  for (const slot of ["weapon", "generator", "module"] as ModuleSlot[]) {
    const want = cls.slots[slot];
    const cur = p.equipped[slot] ?? [];
    const next: (string | null)[] = new Array(want).fill(null);
    let written = 0;
    for (const id of cur) {
      if (written >= want) break;
      if (id) next[written++] = id;
    }
    p.equipped[slot] = next;
  }
}

// ── DUNGEONS ──────────────────────────────────────────────────────────────
export function enterDungeon(id: DungeonId): void {
  const def = DUNGEONS[id];
  if (!def) return;
  if (state.dungeon) { pushNotification("Already in a dungeon", "bad"); return; }
  if (state.player.level < def.unlockLevel) {
    pushNotification(`Requires Lv ${def.unlockLevel}`, "bad"); return;
  }
  // Travel to dungeon zone if needed
  if (state.player.zone !== def.zone) travelToZone(def.zone);
  state.dungeon = {
    id, wave: 1, totalWaves: def.waves,
    enemiesLeft: def.enemiesPerWave, spawnedThisWave: false,
    startedAt: Date.now(),
    isFeatured: id === getDailyFeaturedDungeon(),
  };
  // Clear ambient enemies for a clean instance feel
  state.enemies = [];
  state.projectiles = [];
  pushEvent({ title: `▼ ${def.name.toUpperCase()}`, body: `Wave 1 / ${def.waves} incoming.`, ttl: 5, kind: "info", color: def.color });
  pushNotification(`Entered ${def.name}`, "good");
  state.dockedAt = null;
  state.hangarTab = "bounties";
  save(); bump();
}

export function completeDungeon(): void {
  const run = state.dungeon;
  if (!run) return;
  const def = DUNGEONS[run.id];
  // Track completion history and best clear time
  const p = state.player;
  p.dungeonClears[run.id] = (p.dungeonClears[run.id] ?? 0) + 1;
  const elapsed = Date.now() - run.startedAt;
  const prevBest = p.dungeonBestTimes[run.id];
  if (prevBest === undefined || elapsed < prevBest) {
    p.dungeonBestTimes[run.id] = elapsed;
  }
  state.dungeon = null;
  // Use the featured flag captured at entry time (so runs crossing UTC midnight don't change payout mid-run)
  const isFeatured = run.isFeatured;
  const creditReward = isFeatured ? Math.round(def.rewardCredits * DAILY_DUNGEON_BONUS.creditsMul) : def.rewardCredits;
  // Rewards
  p.credits += creditReward;
  p.exp += def.rewardExp;
  p.milestones.totalCreditsEarned += creditReward;
  for (const m of def.rewardMaterials) {
    const taken = addCargo(m.resourceId, m.qty);
    if (taken < m.qty) pushNotification(`Cargo overflow: lost ${m.qty - taken} ${RESOURCES[m.resourceId].name}`, "bad");
  }
  // Pick random module(s) from the pool (2 if featured, 1 normally)
  // Rarer items have lower drop weight
  const rarityWeight: Record<string, number> = { common: 1, uncommon: 0.8, rare: 0.5, epic: 0.2, legendary: 0.08 };
  const modulesToDrop = isFeatured ? 1 + DAILY_DUNGEON_BONUS.extraModules : 1;
  const droppedModuleNames: string[] = [];
  const pool = [...def.rewardModules];
  const weights = pool.map((id) => rarityWeight[MODULE_DEFS[id]?.rarity ?? "common"] ?? 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < modulesToDrop; i++) {
    let roll = Math.random() * totalWeight;
    let pickId = pool[0];
    for (let j = 0; j < pool.length; j++) {
      roll -= weights[j];
      if (roll <= 0) { pickId = pool[j]; break; }
    }
    const item = addInventoryItem(pickId);
    if (item) droppedModuleNames.push(MODULE_DEFS[pickId].name);
  }
  if (droppedModuleNames.length > 0) {
    const modList = droppedModuleNames.join(" · ");
    const bonusTag = isFeatured ? " ⭐ DAILY BONUS" : "";
    pushNotification(`Module${droppedModuleNames.length > 1 ? "s" : ""} acquired: ${modList}${bonusTag}`, "good");
    pushEvent({
      title: `✦ DUNGEON CLEARED${isFeatured ? " ⭐" : ""}`,
      body: `+${creditReward.toLocaleString()}cr · +${def.rewardExp}xp · ${modList}${isFeatured ? " (Daily Bonus!)" : ""}`,
      ttl: 6, kind: "global", color: isFeatured ? "#ffd24a" : def.color,
    });
  }
  state.enemies = [];
  state.projectiles = [];
  save(); bump();
}

export function abandonDungeon(): void {
  if (!state.dungeon) return;
  state.dungeon = null;
  state.enemies = [];
  pushNotification("Abandoned dungeon", "bad");
  bump();
}

// ── CONSUMABLES ───────────────────────────────────────────────────────────
export function setHotbarSlot(slot: number, id: ConsumableId | null): void {
  if (slot < 0 || slot >= 8) return;
  state.player.hotbar[slot] = id;
  save(); bump();
}

export function buyConsumable(id: ConsumableId, qty = 1): void {
  const def = CONSUMABLE_DEFS[id];
  if (!def) return;
  const stack = state.player.consumables[id] ?? 0;
  if (stack >= def.stackMax) { pushNotification(`Already at max stack (${def.stackMax})`, "bad"); return; }
  const buy = Math.min(qty, def.stackMax - stack);
  const cost = def.price * buy;
  if (state.player.credits < cost) { pushNotification("Not enough credits", "bad"); return; }
  state.player.credits -= cost;
  state.player.consumables[id] = stack + buy;
  pushNotification(`Bought ${buy}× ${def.name}`, "good");
  save(); bump();
}

/** Called from Hotbar or key handler. Returns false if can't use. */
export function useConsumable(slot: number): boolean {
  const id = state.player.hotbar[slot];
  if (!id) return false;
  const def = CONSUMABLE_DEFS[id];
  if (!def) return false;
  const count = state.player.consumables[id] ?? 0;
  if (count <= 0) { pushNotification(`No ${def.name} left`, "bad"); return false; }
  // Check cooldown
  if ((state.hotbarCooldowns[slot] ?? 0) > 0) {
    pushNotification(`${def.name} on cooldown`, "bad"); return false;
  }
  // Consume one
  state.player.consumables[id] = count - 1;
  // Apply cooldown
  if (def.cooldown > 0) state.hotbarCooldowns[slot] = def.cooldown;
  // Apply effect
  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];
  switch (id) {
    case "repair-bot":
      state.repairBotUntil = state.tick + 8;
      pushNotification("⚙ Repair Bot deployed", "good"); break;
    case "shield-charge": {
      const restore = cls.shieldMax * 0.6;
      p.shield = Math.min(p.shield + restore, cls.shieldMax);
      pushNotification("⬡ Shield charged", "good"); break;
    }
    case "afterburn-fuel":
      state.afterburnUntil = state.tick + 5;
      pushNotification("≫ Afterburn engaged", "good"); break;
    case "emp-burst":
      // Mark all nearby enemies as stunned (3s); handled in loop.ts
      for (const e of state.enemies) {
        const dx = e.pos.x - p.pos.x, dy = e.pos.y - p.pos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 500) e.stunUntil = state.tick + 3;
      }
      pushNotification("⚡ EMP Burst fired!", "good"); break;
    case "combat-drone-pod":
      state.pendingDronePod = true;
      pushNotification("◉ Drone Pod launched", "good"); break;
    case "rocket-ammo":
      state.pendingRocketSalvo = 3;
      pushNotification("◈ Rocket Salvo — 3 rockets incoming!", "good"); break;
  }
  sfx.pickup();
  save(); bump();
  return true;
}

/** Tick-update hotbar cooldowns. Called from game loop. */
export function tickHotbarCooldowns(dt: number): void {
  for (let i = 0; i < 8; i++) {
    if (state.hotbarCooldowns[i] > 0) state.hotbarCooldowns[i] = Math.max(0, state.hotbarCooldowns[i] - dt);
  }
}

export { STATIONS, PORTALS };

// Expose state for debugging in console
if (typeof window !== 'undefined') {
  (window as any).debugGameState = state;
}
