import { useSyncExternalStore } from "react";
import {
  ActiveMission,
  Asteroid,
  CargoItem,
  ChatMessage,
  DAILY_MISSION_POOL,
  Drone,
  Enemy,
  FACTIONS,
  FAKE_CLANS,
  FAKE_NAMES,
  FactionId,
  Floater,
  GameEvent,
  Milestones,
  OtherPlayer,
  Particle,
  Player,
  Projectile,
  PORTALS,
  Quest,
  QUEST_POOL,
  RESOURCES,
  ResourceId,
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
  | "bounties" | "equip" | "ships" | "drones" | "market" | "cargo" | "repair" | "skills" | "missions";

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
};

const STORAGE_KEY = "stellar-frontier-save-v3";

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

function makeInitialPlayer(): Player {
  return {
    name: "Captain",
    shipClass: "skimmer",
    equipment: { laserTier: 1, thrusterTier: 1, shieldTier: 1 },
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
  const count = zone === "alpha" ? 14 : zone === "nebula" ? 12 : zone === "crimson" ? 10 : 6;
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
      equipment: p.equipment,
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
  const cargoSkill = state.player.skills["ut-cargo"] ?? 0;
  return Math.floor(cls.cargoMax * (1 + cargoSkill * 0.15));
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

export { STATIONS, PORTALS };
