import { useSyncExternalStore } from "react";
import {
  Asteroid,
  CargoItem,
  ChatMessage,
  Drone,
  Enemy,
  FAKE_CLANS,
  FAKE_NAMES,
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
  STATIONS,
  ShipClassId,
  ZONES,
  ZoneId,
} from "./types";

export type HangarTab =
  | "bounties" | "equip" | "ships" | "drones" | "market" | "cargo" | "repair";

export type GameState = {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  asteroids: Asteroid[];
  others: OtherPlayer[];
  chat: ChatMessage[];
  cameraTarget: { x: number; y: number };
  dockedAt: string | null;
  hangarTab: HangarTab;
  showMap: boolean;
  showClan: boolean;
  showSocial: boolean;
  paused: boolean;
  notifications: { id: string; text: string; ttl: number; kind: "info" | "good" | "bad" }[];
  availableQuests: Quest[];
  tick: number;
  recentHonor: { id: string; amount: number; ttl: number }[];
};

const STORAGE_KEY = "stellar-frontier-save-v2";

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
  // mining belts only in alpha, nebula, crimson; void has fewer
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
const initialPlayer: Player = saved
  ? { ...makeInitialPlayer(), ...saved, pos: { x: 0, y: 80 }, vel: { x: 0, y: 0 } }
  : makeInitialPlayer();

// migration: ensure cargo items use new schema
if (Array.isArray(initialPlayer.cargo)) {
  initialPlayer.cargo = initialPlayer.cargo.filter(
    (c) => c && typeof (c as CargoItem).resourceId === "string" && RESOURCES[(c as CargoItem).resourceId]
  );
}
if (!Array.isArray(initialPlayer.drones)) initialPlayer.drones = [];

const cls = SHIP_CLASSES[initialPlayer.shipClass];
initialPlayer.hull = Math.min(initialPlayer.hull || cls.hullMax, cls.hullMax);
initialPlayer.shield = cls.shieldMax;

export const state: GameState = {
  player: initialPlayer,
  enemies: [],
  projectiles: [],
  particles: [],
  asteroids: makeAsteroids(initialPlayer.zone),
  others: makeOthers(initialPlayer.zone),
  chat: [
    { id: "c0", channel: "system", from: "SYSTEM", text: "Welcome to Stellar Frontier, Captain.", time: Date.now() },
    { id: "c1", channel: "local", from: "Aurora", text: "anyone running nebula bounties?", time: Date.now() },
    { id: "c2", channel: "local", from: "VoidPilot", text: "lfg crimson dread, need 2 more", time: Date.now() },
  ],
  cameraTarget: { x: 0, y: 80 },
  dockedAt: null,
  hangarTab: "bounties",
  showMap: false,
  showClan: false,
  showSocial: false,
  paused: false,
  notifications: [],
  availableQuests: pickQuests(initialPlayer.zone),
  tick: 0,
  recentHonor: [],
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

export function refreshOthers(zone: ZoneId): void {
  state.others = makeOthers(zone);
  state.availableQuests = pickQuests(zone);
  state.asteroids = makeAsteroids(zone);
  bump();
}

export function travelToZone(zoneId: ZoneId): void {
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
  save();
}

// ── ECONOMY HELPERS ────────────────────────────────────────────────────────
export function stationPrice(stationId: string, resourceId: ResourceId): number {
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station) return RESOURCES[resourceId].basePrice;
  const mod = station.prices[resourceId];
  // stations without explicit price quote at base * 1.0
  return Math.round(RESOURCES[resourceId].basePrice * (mod ?? 1.0));
}

export function cargoUsed(): number {
  return state.player.cargo.reduce((a, c) => a + c.qty, 0);
}

export function addCargo(resourceId: ResourceId, qty: number): number {
  const cls = SHIP_CLASSES[state.player.shipClass];
  const space = cls.cargoMax - cargoUsed();
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

export { STATIONS, PORTALS };
