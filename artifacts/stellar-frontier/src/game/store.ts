import { useSyncExternalStore } from "react";
import {
  ActiveMission,
  Asteroid,
  CargoItem,
  ChatMessage,
  CONSUMABLE_DEFS,
  ConsumableId,
  DAILY_MISSION_POOL,
  Drone,
  DUNGEONS,
  DungeonId,
  DungeonRun,
  Enemy,
  EquippedSlots,
  FACTIONS,
  FAKE_CLANS,
  FAKE_NAMES,
  FactionId,
  Floater,
  GameEvent,
  Milestones,
  MODULE_DEFS,
  ModuleItem,
  ModuleSlot,
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
  RocketAmmoType,
  SHIP_CLASSES,
  SKILL_NODES,
  STATIONS,
  ShipClassId,
  SkillId,
  ZONES,
  ZoneId,
} from "./types";
import { sfx } from "./sound";

export type HangarTab =
  | "bounties" | "loadout" | "ships" | "drones" | "market" | "cargo" | "repair" | "skills" | "missions" | "dungeons";

export type GameState = {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  floaters: Floater[];
  asteroids: Asteroid[];
  others: OtherPlayer[];
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
  bossSpawnTimer: number;        // countdown to next boss event
  pendingIdleReward: { credits: number; exp: number; secondsAway: number } | null;
  dungeon: DungeonRun | null;
  // consumable effects (game-time seconds)
  repairBotUntil: number;        // gradual hull heal active until this game-time
  afterburnUntil: number;        // speed boost active until this game-time
  miningTargetId: string | null; // asteroid being mined (for beam visual)
  hotbarCooldowns: number[];     // 8 slots, remaining cooldown seconds
  pendingRocketSalvo: number;    // rockets left to fire this tick
  pendingDronePod: boolean;      // spawn a temp combat drone
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
    credits: 250,
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
    ammo: {},
    autoRestock: false,
    rocketAmmoType: {},
    ammoByType: {},
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
    alpha: 14, nebula: 12, crimson: 10, void: 8, forge: 6,
    corona: 14, fracture: 12, abyss: 10, marsdepth: 8, maelstrom: 6,
    venus1: 14, venus2: 12, venus3: 10, venus4: 8, venus5: 6,
  };
  const count = countMap[zone] ?? 6;
  const out: Asteroid[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 600 + Math.random() * 1500;
    const size = 14 + Math.random() * 18;
    const yieldsLumenite = Math.random() < 0.18;
    out.push({
      id: `ast-${i}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
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
if (!initialPlayer.ammo || typeof initialPlayer.ammo !== "object") initialPlayer.ammo = {};
if (!initialPlayer.milestones) initialPlayer.milestones = newMilestones();
if (!initialPlayer.skills) initialPlayer.skills = {};
if (typeof initialPlayer.skillPoints !== "number") initialPlayer.skillPoints = Math.max(0, (initialPlayer.level ?? 1) - 1);
if (!Array.isArray(initialPlayer.dailyMissions)) initialPlayer.dailyMissions = rollDailyMissions();
if (typeof initialPlayer.lastDailyReset !== "number") initialPlayer.lastDailyReset = Date.now();
const prevLastSeen = typeof initialPlayer.lastSeen === "number" ? initialPlayer.lastSeen : Date.now();
initialPlayer.lastSeen = Date.now();
if (initialPlayer.faction !== "aurora" && initialPlayer.faction !== "crimson" && initialPlayer.faction !== "syndicate") {
  initialPlayer.faction = null;
}

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
if (!initialPlayer.rocketAmmoType || typeof initialPlayer.rocketAmmoType !== "object") initialPlayer.rocketAmmoType = {};
if (!initialPlayer.ammoByType || typeof initialPlayer.ammoByType !== "object") initialPlayer.ammoByType = {};

// Daily reset: if >24h since last reset, refresh missions
const dayMs = 24 * 60 * 60 * 1000;
if (Date.now() - initialPlayer.lastDailyReset > dayMs) {
  initialPlayer.dailyMissions = rollDailyMissions();
  initialPlayer.lastDailyReset = Date.now();
}

const cls = SHIP_CLASSES[initialPlayer.shipClass];
initialPlayer.hull = Math.min(initialPlayer.hull || cls.hullMax, cls.hullMax);
initialPlayer.shield = cls.shieldMax;

// Compute idle reward (only if 5min+ away)
let pendingIdleReward: GameState["pendingIdleReward"] = null;
if (saved) {
  const secondsAway = Math.max(0, (Date.now() - prevLastSeen) / 1000);
  if (secondsAway > 300) {
    // cap at 8 hours
    const cappedSec = Math.min(secondsAway, 8 * 3600);
    const baseRate = 6 + initialPlayer.level * 2; // credits/sec
    const expRate = 2 + initialPlayer.level * 0.6;
    pendingIdleReward = {
      credits: Math.floor(baseRate * cappedSec),
      exp: Math.floor(expRate * cappedSec),
      secondsAway: Math.floor(cappedSec),
    };
  }
}

export const state: GameState = {
  player: initialPlayer,
  enemies: [],
  projectiles: [],
  particles: [],
  floaters: [],
  asteroids: makeAsteroids(initialPlayer.zone),
  others: makeOthers(initialPlayer.zone),
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
  bossSpawnTimer: 240, // first boss event ~4 minutes in
  pendingIdleReward,
  dungeon: null,
  repairBotUntil: 0,
  afterburnUntil: 0,
  miningTargetId: null,
  hotbarCooldowns: [0, 0, 0, 0, 0, 0, 0, 0],
  pendingRocketSalvo: 0,
  pendingDronePod: false,
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
      autoRestock: p.autoRestock,
      rocketAmmoType: p.rocketAmmoType,
      ammoByType: p.ammoByType,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    /* ignore */
  }
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
  refreshOthers(zoneId);
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
  // Faction discount (own faction OR aurora-aligned discount)
  const p = state.player;
  if (p.faction && station.controlledBy === p.faction) {
    const f = FACTIONS[p.faction];
    if (f.bonus.tradeDiscount) price *= (1 - f.bonus.tradeDiscount);
  }
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
export const ROCKET_AMMO_BASE = 20;
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
  const p = state.player;
  const ids: string[] = [];
  for (const id of p.equipped.weapon) {
    if (!id) continue;
    const item = p.inventory.find((m) => m.instanceId === id);
    if (item && MODULE_DEFS[item.defId]?.weaponKind === "rocket") ids.push(id);
  }
  return ids;
}

export function ensureAmmoInitialized(): void {
  const p = state.player;
  const max = rocketAmmoMax();
  if (!p.rocketAmmoType) p.rocketAmmoType = {};
  if (!p.ammoByType) p.ammoByType = {};
  for (const id of getRocketWeaponIds()) {
    if (typeof p.ammo[id] !== "number") {
      p.ammo[id] = max;
    } else {
      p.ammo[id] = Math.min(p.ammo[id], max);
    }
    if (!p.rocketAmmoType[id]) p.rocketAmmoType[id] = "standard";
    if (!p.ammoByType[id]) p.ammoByType[id] = {};
  }
  // Clean up ammo entries for unequipped weapons
  for (const key of Object.keys(p.ammo)) {
    if (!p.equipped.weapon.includes(key)) delete p.ammo[key];
  }
  for (const key of Object.keys(p.rocketAmmoType)) {
    if (!p.equipped.weapon.includes(key)) delete p.rocketAmmoType[key];
  }
  for (const key of Object.keys(p.ammoByType)) {
    if (!p.equipped.weapon.includes(key)) delete p.ammoByType[key];
  }
}

export function restockAmmo(): void {
  const p = state.player;
  const max = rocketAmmoMax();
  ensureAmmoInitialized();
  const rocketIds = getRocketWeaponIds();
  if (rocketIds.length === 0) {
    pushNotification("No rocket weapons equipped", "info");
    return;
  }
  let totalMissing = 0;
  for (const id of rocketIds) {
    totalMissing += Math.max(0, max - (p.ammo[id] ?? 0));
  }
  if (totalMissing === 0) {
    pushNotification("Ammo already full", "info");
    return;
  }
  const cost = totalMissing * ROCKET_AMMO_COST_PER;
  if (p.credits < cost) {
    pushNotification(`Need ${cost}cr to restock ammo`, "bad");
    return;
  }
  p.credits -= cost;
  for (const id of rocketIds) p.ammo[id] = max;
  bumpMission("spend-credits", cost);
  pushNotification(`Ammo restocked · -${cost}cr`, "good");
  save(); bump();
}

export function setAutoRestock(enabled: boolean): void {
  state.player.autoRestock = enabled;
  pushNotification(enabled ? "Auto-Restock enabled" : "Auto-Restock disabled", "info");
  save(); bump();
}

// ── AMMO TYPE HELPERS ──────────────────────────────────────────────────────

/** Get the active ammo type for a given rocket weapon instance. */
export function getActiveAmmoType(weaponId: string): RocketAmmoType {
  return state.player.rocketAmmoType?.[weaponId] ?? "standard";
}

/** Get the current ammo count for the active type of a weapon. */
export function getAmmoCountForType(weaponId: string, type: RocketAmmoType): number {
  if (type === "standard") return state.player.ammo[weaponId] ?? 0;
  return state.player.ammoByType?.[weaponId]?.[type] ?? 0;
}

/** Switch the active ammo type for a rocket weapon. */
export function switchRocketAmmoType(weaponId: string, type: RocketAmmoType): void {
  ensureAmmoInitialized();
  const p = state.player;
  if (!p.rocketAmmoType) p.rocketAmmoType = {};
  p.rocketAmmoType[weaponId] = type;
  const def = ROCKET_AMMO_TYPE_DEFS[type];
  pushNotification(`Ammo switched to ${def.name}`, "good");
  save(); bump();
}

/** Purchase a batch of typed ammo (fills up to max for the given type). */
export function purchaseTypedAmmo(weaponId: string, type: RocketAmmoType): void {
  ensureAmmoInitialized();
  const p = state.player;
  const def = ROCKET_AMMO_TYPE_DEFS[type];
  const max = rocketAmmoMax();
  if (!p.ammoByType) p.ammoByType = {};
  if (!p.ammoByType[weaponId]) p.ammoByType[weaponId] = {};

  if (type === "standard") {
    // Delegate to regular restockAmmo for a single weapon
    const cur = p.ammo[weaponId] ?? 0;
    const missing = Math.max(0, max - cur);
    if (missing === 0) { pushNotification("Ammo already full", "info"); return; }
    const cost = missing * def.costPerRound;
    if (p.credits < cost) { pushNotification(`Need ${cost}cr to restock ammo`, "bad"); return; }
    p.credits -= cost;
    p.ammo[weaponId] = max;
    bumpMission("spend-credits", cost);
    pushNotification(`Restocked ${missing} STD · -${cost}cr`, "good");
    save(); bump();
    return;
  }

  const cur = p.ammoByType[weaponId][type] ?? 0;
  const missing = Math.max(0, max - cur);
  if (missing === 0) { pushNotification("Ammo already full", "info"); return; }
  const cost = missing * def.costPerRound;
  if (p.credits < cost) { pushNotification(`Need ${cost}cr for ${def.shortName} ammo`, "bad"); return; }
  p.credits -= cost;
  p.ammoByType[weaponId][type] = max;
  bumpMission("spend-credits", cost);
  pushNotification(`Restocked ${missing} ${def.shortName} · -${cost}cr`, "good");
  save(); bump();
}

export function autoRestockIfEnabled(): void {
  const p = state.player;
  if (!p.autoRestock) return;
  const rocketIds = getRocketWeaponIds();
  if (rocketIds.length === 0) return;
  const max = rocketAmmoMax();
  ensureAmmoInitialized();
  let totalMissing = 0;
  for (const id of rocketIds) {
    totalMissing += Math.max(0, max - (p.ammo[id] ?? 0));
  }
  if (totalMissing === 0) return;
  const cost = totalMissing * ROCKET_AMMO_COST_PER;
  if (p.credits < cost) {
    pushNotification(`Auto-Restock: need ${cost}cr to restock ammo`, "bad");
    return;
  }
  p.credits -= cost;
  for (const id of rocketIds) p.ammo[id] = max;
  bumpMission("spend-credits", cost);
  pushNotification(`Auto-Restock: ammo topped up · -${cost}cr`, "good");
  save(); bump();
}

// ── FACTIONS ──────────────────────────────────────────────────────────────
export function chooseFaction(id: FactionId): void {
  state.player.faction = id;
  state.showFactionPicker = false;
  pushNotification(`Allied with ${FACTIONS[id].name}`, "good");
  pushChat("system", "SYSTEM", `You pledged loyalty to ${FACTIONS[id].name}.`);
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
  state.dungeon = null;
  // Rewards
  const p = state.player;
  p.credits += def.rewardCredits;
  p.exp += def.rewardExp;
  p.milestones.totalCreditsEarned += def.rewardCredits;
  for (const m of def.rewardMaterials) {
    const taken = addCargo(m.resourceId, m.qty);
    if (taken < m.qty) pushNotification(`Cargo overflow: lost ${m.qty - taken} ${RESOURCES[m.resourceId].name}`, "bad");
  }
  // Pick a random module from the pool
  const pickId = def.rewardModules[Math.floor(Math.random() * def.rewardModules.length)];
  const item = addInventoryItem(pickId);
  if (item) {
    pushNotification(`Module acquired: ${MODULE_DEFS[pickId].name}`, "good");
    pushEvent({ title: "✦ DUNGEON CLEARED", body: `+${def.rewardCredits}cr · +${def.rewardExp}xp · ${MODULE_DEFS[pickId].name}`, ttl: 6, kind: "global", color: def.color });
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
