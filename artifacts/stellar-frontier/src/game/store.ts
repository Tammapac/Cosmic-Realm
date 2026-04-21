import { useSyncExternalStore } from "react";
import {
  ChatMessage,
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
  SHIP_CLASSES,
  STATIONS,
  ShipClassId,
  ZONES,
  ZoneId,
} from "./types";

export type GameState = {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  others: OtherPlayer[];
  chat: ChatMessage[];
  cameraTarget: { x: number; y: number };
  dockedAt: string | null;
  hangarTab: "ships" | "equip" | "quests" | "cargo";
  showMap: boolean;
  showClan: boolean;
  paused: boolean;
  notifications: { id: string; text: string; ttl: number; kind: "info" | "good" | "bad" }[];
  availableQuests: Quest[];
  tick: number;
};

const STORAGE_KEY = "stellar-frontier-save-v1";

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
  for (let i = 0; i < count; i++) {
    let name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
    while (used.has(name)) {
      name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)] + Math.floor(Math.random() * 9);
    }
    used.add(name);
    const ships: ShipClassId[] = ["skimmer", "vanguard", "obsidian", "titan"];
    out.push({
      id: `other-${i}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      pos: {
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 3000,
      },
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

function pickQuests(zone: ZoneId): Quest[] {
  return QUEST_POOL.filter((q) => q.zone === zone);
}

const saved = loadSaved();
const initialPlayer: Player = saved
  ? { ...makeInitialPlayer(), ...saved, pos: { x: 0, y: 80 }, vel: { x: 0, y: 0 } }
  : makeInitialPlayer();

const cls = SHIP_CLASSES[initialPlayer.shipClass];
initialPlayer.hull = Math.min(initialPlayer.hull || cls.hullMax, cls.hullMax);
initialPlayer.shield = cls.shieldMax;

export const state: GameState = {
  player: initialPlayer,
  enemies: [],
  projectiles: [],
  particles: [],
  others: makeOthers(initialPlayer.zone),
  chat: [
    { id: "c0", channel: "system", from: "SYSTEM", text: "Welcome to Stellar Frontier, Captain.", time: Date.now() },
    { id: "c1", channel: "local", from: "Aurora", text: "anyone running nebula bounties?", time: Date.now() },
    { id: "c2", channel: "local", from: "VoidPilot", text: "lfg crimson dread, need 2 more", time: Date.now() },
  ],
  cameraTarget: { x: 0, y: 80 },
  dockedAt: null,
  hangarTab: "quests",
  showMap: false,
  showClan: false,
  paused: false,
  notifications: [],
  availableQuests: pickQuests(initialPlayer.zone),
  tick: 0,
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
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore quota errors
  }
}

export function pushNotification(text: string, kind: "info" | "good" | "bad" = "info"): void {
  state.notifications.push({
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    ttl: 4,
    kind,
  });
  bump();
}

export function pushChat(channel: ChatMessage["channel"], from: string, text: string): void {
  state.chat.push({
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    channel,
    from,
    text,
    time: Date.now(),
  });
  if (state.chat.length > 80) state.chat.shift();
  bump();
}

export function refreshOthers(zone: ZoneId): void {
  state.others = makeOthers(zone);
  state.availableQuests = pickQuests(zone);
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

export { STATIONS, PORTALS };
