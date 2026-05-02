import {
  type Vec2, type ZoneId, type EnemyType, type EnemyBehavior, type FactionId,
  type ShipClassId, type RocketAmmoType, type RocketMissileType, type ResourceId,
  type SkillId, type DroneKind,
  ZONES, ENEMY_DEFS, FACTION_ENEMY_MODS, SHIP_CLASSES, MODULE_DEFS,
  FACTIONS, DRONE_DEFS, SKILL_NODES, ENEMY_NAMES,
  ROCKET_AMMO_TYPE_DEFS, ROCKET_MISSILE_TYPE_DEFS,
  MAP_RADIUS, EXP_FOR_LEVEL,
  MINING_RANGE, MINING_DPS_FACTOR,
  pickAsteroidYield,
} from "./data.js";
import type { OnlinePlayer } from "../socket/state.js";
import { MOVEMENT } from "../../../lib/game-constants.js";


// ── ASTEROID BELT DEFINITIONS ────────────────────────────────────────────
const ASTEROID_BELTS: Record<string, { cx: number; cy: number; rx: number; ry: number }[]> = {
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

function randomPointInBelt(belt: { cx: number; cy: number; rx: number; ry: number }): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random());
  return {
    x: belt.cx + Math.cos(angle) * belt.rx * r,
    y: belt.cy + Math.sin(angle) * belt.ry * r,
  };
}

// ── CULLING ──────────────────────────────────────────────────────────────

const CULL_RADIUS = 2000;

function inView(px: number, py: number, ex: number, ey: number): boolean {
  const dx = px - ex;
  const dy = py - ey;
  return dx * dx + dy * dy < CULL_RADIUS * CULL_RADIUS;
}

// ── SERVER PROJECTILE ───────────────────────────────────────────────────

export type ServerProjectile = {
  id: string;
  zone: string;
  fromPlayerId: number | null;
  fromEnemyId: string | null;
  fromNpcId: string | null;
  pos: Vec2;
  vel: Vec2;
  damage: number;
  ttl: number;
  color: string;
  size: number;
  crit: boolean;
  weaponKind: "laser" | "rocket" | "energy" | "plasma";
  homing: boolean;
  homingTargetId: string | null;
  aoeRadius: number;
  empStun: number;
  armorPiercing: boolean;
};

// ── SERVER ENTITY TYPES ──────────────────────────────────────────────────

export type ServerEnemy = {
  id: string;
  type: EnemyType;
  behavior: EnemyBehavior;
  name: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  hull: number;
  hullMax: number;
  damage: number;
  speed: number;
  exp: number;
  credits: number;
  honor: number;
  loot?: { resourceId: ResourceId; qty: number };
  color: string;
  size: number;
  isBoss: boolean;
  bossPhase: number;
  phaseTimer: number;
  fireTimer: number;
  burstCd: number;
  burstShots: number;
  aggroTarget: number | null;
  retargetCd: number;
  aggroRange: number;
  spawnPos: Vec2;
  stunUntil: number;
  combo: Map<number, { stacks: number; ttl: number }>;
};

export type ServerAsteroid = {
  id: string;
  pos: Vec2;
  hp: number;
  hpMax: number;
  size: number;
  yields: ResourceId;
  respawnAt: number;
};

export type ServerNpc = {
  id: string;
  name: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  hull: number;
  hullMax: number;
  speed: number;
  damage: number;
  fireTimer: number;
  targetPos: Vec2;
  state: "patrol" | "fight";
  targetEnemyId: string | null;
  color: string;
  size: number;
};

export type LootDrop = {
  credits: number;
  exp: number;
  honor: number;
  bonusResource?: { resourceId: ResourceId; qty: number };
  resource?: { resourceId: ResourceId; qty: number };
};

// Events emitted by the engine for the socket handler to broadcast
export type GameEvent =
  | { type: "enemy:spawn"; zone: string; enemy: ClientEnemy }
  | { type: "enemy:die"; zone: string; enemyId: string; killerId: number; loot: LootDrop; pos: Vec2 }
  | { type: "enemy:hit"; zone: string; enemyId: string; damage: number; hp: number; hpMax: number; crit: boolean; attackerId: number }
  | { type: "enemy:attack"; zone: string; enemyId: string; enemyType: string; targetId: number; damage: number; pos: Vec2; targetPos: Vec2 }
  | { type: "player:damage"; playerId: number; damage: number; shieldDmg: number; hullDmg: number }
  | { type: "asteroid:mine"; zone: string; asteroidId: string; hp: number; hpMax: number }
  | { type: "asteroid:destroy"; zone: string; asteroidId: string; playerId: number; ore: { resourceId: ResourceId; qty: number } }
  | { type: "asteroid:respawn"; zone: string; asteroid: ClientAsteroid }
  | { type: "boss:warn"; zone: string }
  | { type: "npc:spawn"; zone: string; npc: ClientNpc }
  | { type: "npc:die"; zone: string; npcId: string }
  | { type: "player:hit"; playerId: number; damage: number; zone: string }
  | { type: "projectile:spawn"; zone: string; fromPlayerId: number; x: number; y: number; vx: number; vy: number; damage: number; color: string; size: number; crit: boolean; weaponKind: "laser" | "rocket" | "energy" | "plasma"; homing: boolean };

export type ClientEnemy = {
  id: string;
  type: EnemyType;
  behavior: EnemyBehavior;
  name: string;
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  hull: number;
  hullMax: number;
  damage: number;
  speed: number;
  color: string;
  size: number;
  isBoss: boolean;
  bossPhase: number;
};

export type ClientAsteroid = {
  id: string;
  x: number; y: number;
  hp: number; hpMax: number;
  size: number;
  yields: ResourceId;
};

export type ClientNpc = {
  id: string;
  name: string;
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  hull: number;
  hullMax: number;
  speed: number;
  color: string;
  size: number;
  state: string;
};

export type ClientProjectile = {
  id: string;
  x: number; y: number;
  vx: number; vy: number;
  damage: number;
  color: string;
  size: number;
  fromPlayer: boolean;
  crit: boolean;
  weaponKind: "laser" | "rocket" | "energy" | "plasma";
  homing: boolean;
};

// ── PLAYER STATS COMPUTATION ─────────────────────────────────────────────

export type EffectiveStats = {
  damage: number;
  speed: number;
  hullMax: number;
  shieldMax: number;
  shieldRegen: number;
  fireRate: number;
  critChance: number;
  damageReduction: number;
  shieldAbsorb: number;
  aoeRadius: number;
  lootBonus: number;
  cargoMax: number;
};

export function computeStats(playerData: any): EffectiveStats {
  const cls = SHIP_CLASSES[playerData.shipClass as ShipClassId];
  if (!cls) {
    return {
      damage: 8, speed: 180, hullMax: 100, shieldMax: 50,
      shieldRegen: 5, fireRate: 1, critChance: 0.03,
      damageReduction: 0, shieldAbsorb: 0.5, aoeRadius: 0,
      lootBonus: 0, cargoMax: 20,
    };
  }

  const mod = sumEquippedStats(playerData.inventory, playerData.equipped);
  const sk = (id: SkillId) => (playerData.skills?.[id] ?? 0) as number;

  // Debug: log when skills are non-empty
  const skillEntries = Object.entries(playerData.skills || {}).filter(([_, v]) => (v as number) > 0);
  if (skillEntries.length > 0) {
    // console.log("[SERVER SKILLS]", JSON.stringify(playerData.skills));
  }

  let damage = (cls.baseDamage + (mod.damage ?? 0)) + sk("off-power") * 3;
  let hullMax = (cls.hullMax + (mod.hullMax ?? 0)) + sk("def-armor") * 20;
  let shieldMax = (cls.shieldMax + (mod.shieldMax ?? 0)) + sk("def-shield") * 15 + sk("def-barrier") * 25;
  let speed = (cls.baseSpeed + (mod.speed ?? 0)) + sk("ut-thrust") * 5;
  let shieldRegen = 5 + (mod.shieldRegen ?? 0);
  let damageReduction = (sk("def-bulwark") * 0.03) + (mod.damageReduction ?? 0);
  let shieldAbsorb = Math.min(0.5, mod.shieldAbsorb ?? 0);
  let aoeRadius = (sk("off-pierce") * 6) + (mod.aoeRadius ?? 0);
  let critChance = 0.02 + sk("off-crit") * 0.02 + (mod.critChance ?? 0);
  let fireRate = (mod.fireRate ?? 1) + sk("off-rapid") * 0.05;
  let lootBonus = (mod.lootBonus ?? 0);
  let cargoMax = cls.cargoMax;

  // Snipe skill
  damage += sk("off-snipe") * 2;
  critChance += sk("off-snipe") * 0.01;

  // Engineering skills
  fireRate += sk("eng-coolant") * 0.04;
  damage += sk("eng-capacitor") * 2;
  shieldRegen += sk("eng-capacitor") * 1;
  critChance += sk("eng-targeting") * 0.02;
  speed += sk("eng-warp-core") * 4;

  // Overdrive & singularity
  const od = sk("eng-overdrive");
  if (od > 0) {
    damage += od * 4;
    shieldMax += od * 20;
    speed += od * 3;
  }
  if (sk("eng-singularity") > 0) {
    damage += 8;
    fireRate += 0.1;
    speed += 6;
  }

  // Nano-repair
  shieldRegen += sk("def-nano") * 2;
  hullMax += sk("def-nano") * 15;

  // Volley
  fireRate += sk("off-volley") * 0.06;

  shieldRegen += sk("def-regen") * 2;

  // Drone bonuses
  const drones = playerData.drones ?? [];
  for (const drone of drones) {
    const def = DRONE_DEFS[drone.kind as DroneKind];
    if (!def) continue;
    damage += def.damageBonus;
    hullMax += def.hullBonus;
    shieldMax += def.shieldBonus;
  }

  // Faction bonuses
  const faction = FACTIONS[playerData.faction as FactionId];
  if (faction) {
    if (faction.bonus.damage) damage *= (1 + faction.bonus.damage);
    if (faction.bonus.speed) speed *= (1 + faction.bonus.speed);
    if (faction.bonus.shieldRegen) shieldRegen *= faction.bonus.shieldRegen;
    if (faction.bonus.lootBonus) lootBonus += faction.bonus.lootBonus;
  }

  // Cargo skill
  cargoMax = Math.floor(cargoMax * (1 + sk("ut-cargo") * 0.15) * (1 + (mod.cargoBonus ?? 0)));

  return {
    damage, speed, hullMax, shieldMax, shieldRegen,
    fireRate, critChance, damageReduction: Math.min(0.8, damageReduction),
    shieldAbsorb: 0.5 + shieldAbsorb,
    aoeRadius, lootBonus, cargoMax,
  };
}

function sumEquippedStats(inventory: any[], equipped: any): Record<string, number> {
  const result: Record<string, number> = {};
  if (!inventory || !equipped) return result;

  const allSlotIds: string[] = [
    ...(equipped.weapon ?? []),
    ...(equipped.generator ?? []),
    ...(equipped.module ?? []),
  ].filter(Boolean);

  for (const instanceId of allSlotIds) {
    const item = inventory.find((i: any) => i.instanceId === instanceId);
    if (!item) continue;
    const def = MODULE_DEFS[item.defId];
    if (!def) continue;
    for (const [key, val] of Object.entries(def.stats)) {
      if (typeof val !== "number") continue;
      if (key === "fireRate") {
        result.fireRate = (result.fireRate ?? 1) * val;
      } else {
        result[key] = (result[key] ?? 0) + val;
      }
    }
  }
  return result;
}

// ── ZONE STATE ───────────────────────────────────────────────────────────

type ZoneState = {
  enemies: Map<string, ServerEnemy>;
  asteroids: Map<string, ServerAsteroid>;
  npcShips: Map<string, ServerNpc>;
  projectiles: Map<string, ServerProjectile>;
  spawnTimer: number;
  bossTimer: number;
  bossActive: boolean;
  npcSpawnTimer: number;
};

// ── GAME ENGINE ──────────────────────────────────────────────────────────

let _eidSeq = 0;
function eid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(++_eidSeq).toString(36)}`;
}

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

function angleFromTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

// ── LOOT POOLS (variety per enemy tier) ──────────────────────────────────────
const LOOT_POOLS: Record<string, { resourceId: ResourceId; qty: number; weight: number }[]> = {
  scout: [
    { resourceId: "scrap", qty: 2, weight: 3 },
    { resourceId: "iron", qty: 1, weight: 2 },
    { resourceId: "fuel-cell", qty: 1, weight: 2 },
    { resourceId: "food", qty: 1, weight: 1 },
    { resourceId: "medpack", qty: 1, weight: 1 },
  ],
  raider: [
    { resourceId: "plasma", qty: 2, weight: 3 },
    { resourceId: "scrap", qty: 2, weight: 1 },
    { resourceId: "synth", qty: 1, weight: 2 },
    { resourceId: "nanite", qty: 1, weight: 2 },
    { resourceId: "spice", qty: 1, weight: 1 },
    { resourceId: "titanium", qty: 1, weight: 1 },
  ],
  destroyer: [
    { resourceId: "warp", qty: 2, weight: 3 },
    { resourceId: "plasma", qty: 2, weight: 1 },
    { resourceId: "titanium", qty: 2, weight: 2 },
    { resourceId: "fusion-lattice", qty: 1, weight: 1 },
    { resourceId: "plasma-coil", qty: 1, weight: 2 },
    { resourceId: "neural-chip", qty: 1, weight: 1 },
  ],
  voidling: [
    { resourceId: "void", qty: 2, weight: 3 },
    { resourceId: "dark-matter", qty: 1, weight: 2 },
    { resourceId: "bio-crystal", qty: 1, weight: 2 },
    { resourceId: "exotic", qty: 1, weight: 1 },
    { resourceId: "cryo-fluid", qty: 1, weight: 1 },
    { resourceId: "quantum", qty: 1, weight: 1 },
  ],
  dread: [
    { resourceId: "dread", qty: 3, weight: 3 },
    { resourceId: "quantum", qty: 2, weight: 2 },
    { resourceId: "precursor", qty: 1, weight: 1 },
    { resourceId: "relic", qty: 1, weight: 1 },
    { resourceId: "dark-matter", qty: 2, weight: 2 },
    { resourceId: "blackglass", qty: 1, weight: 1 },
  ],
};

function pickLoot(enemyType: string): { resourceId: ResourceId; qty: number } {
  const pool = LOOT_POOLS[enemyType];
  if (!pool || pool.length === 0) return { resourceId: "scrap" as ResourceId, qty: 1 };
  const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return { resourceId: entry.resourceId, qty: entry.qty };
  }
  return { resourceId: pool[0].resourceId, qty: pool[0].qty };
}

export class GameEngine {
  zones = new Map<string, ZoneState>();
  playerDataCache = new Map<number, any>();
  playerStatsCache = new Map<number, EffectiveStats>();

  constructor() {
    for (const zone of Object.values(ZONES)) {
      const zs: ZoneState = {
        enemies: new Map(),
        asteroids: new Map(),
        npcShips: new Map(),
        projectiles: new Map(),
        spawnTimer: randRange(0.05, 0.15),
        bossTimer: randRange(120, 300),
        bossActive: false,
        npcSpawnTimer: randRange(5, 15),
      };
      this.zones.set(zone.id, zs);
      this.spawnInitialAsteroids(zone.id, zs);
      this.spawnInitialEnemies(zone.id, zs);
    }
  }

  cachePlayerData(playerId: number, data: any): void {
    this.playerDataCache.set(playerId, data);
    this.playerStatsCache.set(playerId, computeStats(data));
  }

  removePlayerData(playerId: number): void {
    this.playerDataCache.delete(playerId);
    this.playerStatsCache.delete(playerId);
  }

  refreshPlayerStats(playerId: number): EffectiveStats | undefined {
    const data = this.playerDataCache.get(playerId);
    if (!data) return undefined;
    const stats = computeStats(data);
    this.playerStatsCache.set(playerId, stats);
    return stats;
  }

  getStats(playerId: number): EffectiveStats | undefined {
    return this.playerStatsCache.get(playerId);
  }

  // Main tick — call at 20Hz
  tick(dt: number, getPlayersInZone: (zone: string) => OnlinePlayer[]): GameEvent[] {
    const events: GameEvent[] = [];

    for (const [zoneId, zs] of this.zones) {
      const players = getPlayersInZone(zoneId);

      if (players.length === 0) {
        if (zs.bossActive) {
          for (const [id, e] of zs.enemies) if (e.isBoss) zs.enemies.delete(id);
          zs.bossActive = false;
          zs.bossTimer = randRange(180, 420);
        }
        continue;
      }

      // Server-authoritative player movement
      this.tickPlayerMovement(players, dt);

      // Server-authoritative player combat (fire cooldowns, spawn projectiles)
      this.tickPlayerCombat(zoneId, zs, players, dt, events);

      // Server-authoritative player mining
      this.tickPlayerMining(zoneId, zs, players, dt, events);

      // Shield regen for players
      this.tickPlayerShieldRegen(players, dt);

      if (players.length > 0) {
        this.tickEnemySpawns(zoneId, zs, players, dt, events);
        this.tickPirateSpawns(zoneId, zs, players, dt, events);
        this.tickBossSpawn(zoneId, zs, players, dt, events);
        this.tickNpcSpawns(zoneId, zs, dt, events);
      }

      this.tickEnemyAI(zoneId, zs, players, dt, events);
      this.tickNpcAI(zoneId, zs, dt, events);
      this.tickProjectiles(zoneId, zs, players, dt, events);
      this.tickAsteroidRespawn(zoneId, zs, dt, events);

      // Decay combos
      for (const e of zs.enemies.values()) {
        for (const [pid, combo] of e.combo) {
          combo.ttl -= dt;
          if (combo.ttl <= 0) e.combo.delete(pid);
        }
      }
    }

    return events;
  }

  private tickPlayerMovement(players: OnlinePlayer[], dt: number): void {
    const stopDistanceSq = MOVEMENT.STOP_DISTANCE * MOVEMENT.STOP_DISTANCE;
    const snapDistanceSq = MOVEMENT.SNAP_DISTANCE * MOVEMENT.SNAP_DISTANCE;
    const idleSpeedSq = MOVEMENT.IDLE_SPEED * MOVEMENT.IDLE_SPEED;

    for (const p of players) {
      if (p.isDocked) continue;
      if (p.targetX !== null && p.targetY !== null) {
        const dx = p.targetX - p.posX;
        const dy = p.targetY - p.posY;
        const distSqToTarget = dx * dx + dy * dy;

        if (distSqToTarget <= stopDistanceSq) {
          if (distSqToTarget <= snapDistanceSq) {
            p.posX = p.targetX;
            p.posY = p.targetY;
          }
          p.targetX = null;
          p.targetY = null;
          p.velX = 0;
          p.velY = 0;
        } else {
          const d = Math.sqrt(distSqToTarget);
          const toAngle = Math.atan2(dy, dx);
          if (d > 40) p.angle = toAngle;
          const accel = 500;
          p.velX += Math.cos(toAngle) * accel * dt;
          p.velY += Math.sin(toAngle) * accel * dt;
        }
      }
      const v = Math.sqrt(p.velX * p.velX + p.velY * p.velY);
      const now = Date.now() / 1000;
      const speedCap = p.afterburnUntil > now ? p.speed * MOVEMENT.AFTERBURN_MULTIPLIER : p.speed;
      if (v > speedCap) {
        p.velX = (p.velX / v) * speedCap;
        p.velY = (p.velY / v) * speedCap;
      }
      const friction = Math.pow(MOVEMENT.FRICTION_PER_60FPS_FRAME, dt * 60);
      p.velX *= friction;
      p.velY *= friction;
      p.posX += p.velX * dt;
      p.posY += p.velY * dt;

      const speedSq = p.velX * p.velX + p.velY * p.velY;
      if (speedSq <= idleSpeedSq) {
        p.velX = 0;
        p.velY = 0;
      }

      if (p.targetX !== null && p.targetY !== null) {
        const dx = p.targetX - p.posX;
        const dy = p.targetY - p.posY;
        const distSqToTarget = dx * dx + dy * dy;
        if (distSqToTarget <= snapDistanceSq && (p.velX * p.velX + p.velY * p.velY) <= idleSpeedSq) {
          p.posX = p.targetX;
          p.posY = p.targetY;
          p.targetX = null;
          p.targetY = null;
          p.velX = 0;
          p.velY = 0;
        }
      }

      // Asteroid collision - push player out of asteroids
      const pZone = this.zones.get(p.zone);
      if (pZone) {
        for (const ast of pZone.asteroids.values()) {
          if (ast.hp <= 0) continue;
          const adx = p.posX - ast.pos.x;
          const ady = p.posY - ast.pos.y;
          const adist = Math.sqrt(adx * adx + ady * ady);
          const minDist = ast.size + 12;
          if (adist < minDist && adist > 0) {
            const pushX = (adx / adist) * minDist;
            const pushY = (ady / adist) * minDist;
            p.posX = ast.pos.x + pushX;
            p.posY = ast.pos.y + pushY;
            const dot = p.velX * (adx / adist) + p.velY * (ady / adist);
            if (dot < 0) {
              p.velX -= (adx / adist) * dot * 1.5;
              p.velY -= (ady / adist) * dot * 1.5;
            }
          }
        }
      }

      p.posX = clamp(p.posX, -MAP_RADIUS, MAP_RADIUS);
      p.posY = clamp(p.posY, -MAP_RADIUS, MAP_RADIUS);

      if (p.attackTargetId && (p.isLaserFiring || p.isRocketFiring)) {
        const zs = this.zones.get(p.zone);
        if (zs) {
          const enemy = zs.enemies.get(p.attackTargetId);
          if (enemy) {
            p.angle = angleFromTo({ x: p.posX, y: p.posY }, enemy.pos);
          }
        }
      }
    }
  }

  // ── SERVER-AUTHORITATIVE PLAYER COMBAT ──────────────────────────────────

  private tickPlayerCombat(zoneId: string, zs: ZoneState, players: OnlinePlayer[], dt: number, events: GameEvent[]): void {
    for (const p of players) {
      if (p.isDocked) continue;
      if (p.isDocked) continue;
      p.laserFireCd -= dt;
      p.rocketFireCd -= dt;

      const target = p.attackTargetId ? zs.enemies.get(p.attackTargetId) : null;
      if (!target) {
        if (p.attackTargetId) p.attackTargetId = null;
        continue;
      }

      const atkDist = dist({ x: p.posX, y: p.posY }, target.pos);
      if (atkDist > 400) continue;

      const pData = this.playerDataCache.get(p.playerId);
      if (!pData) continue;
      const stats = this.playerStatsCache.get(p.playerId);
      if (!stats) continue;
      const ang = angleFromTo({ x: p.posX, y: p.posY }, target.pos);

      // Fire laser
      if (p.isLaserFiring && p.laserFireCd <= 0) {
        const ammoDef = ROCKET_AMMO_TYPE_DEFS[p.laserAmmoType as RocketAmmoType];
        const mul = ammoDef ? ammoDef.damageMul : 1;
        const laserDmg = stats.damage * mul * 0.4;
        const perpAng = ang + Math.PI / 2;
        const crit = Math.random() < stats.critChance;
        const laserColor = "#4ee2ff";

        // Determine firing pattern from equipped weapon
        const pCache = this.playerDataCache.get(p.playerId);
        let firingPattern = "standard";
        if (pCache?.equipped?.weapon) {
          for (const wid of pCache.equipped.weapon) {
            if (!wid) continue;
            const wi = pCache.inventory?.find((m: any) => m.instanceId === wid);
            if (wi && MODULE_DEFS[wi.defId]?.weaponKind === "laser") {
              firingPattern = (MODULE_DEFS[wi.defId] as any).firingPattern || "standard";
              break;
            }
          }
        }

        const fireProj = (ox: number, oy: number, fireAng: number, dmg: number, sz: number, spd: number) => {
          const proj: ServerProjectile = {
            id: eid("proj"), zone: zoneId, fromPlayerId: p.playerId,
            fromEnemyId: null, fromNpcId: null,
            pos: { x: ox, y: oy },
            vel: { x: Math.cos(fireAng) * spd, y: Math.sin(fireAng) * spd },
            damage: dmg, ttl: 1.5, color: laserColor, size: sz, crit,
            weaponKind: "laser", homing: false, homingTargetId: null,
            aoeRadius: stats.aoeRadius, empStun: 0, armorPiercing: false,
          };
          zs.projectiles.set(proj.id, proj);
          events.push({
            type: "projectile:spawn", zone: zoneId, fromPlayerId: p.playerId,
            x: proj.pos.x, y: proj.pos.y, vx: proj.vel.x, vy: proj.vel.y,
            damage: proj.damage, color: proj.color, size: proj.size,
            crit: proj.crit, weaponKind: proj.weaponKind, homing: proj.homing,
          });
        };

        if (firingPattern === "sniper") {
          const dmg = Math.round(laserDmg);
          const ox = p.posX + Math.cos(ang) * 10;
          const oy = p.posY + Math.sin(ang) * 10;
          fireProj(ox, oy, ang, dmg, 6, 900);
        } else if (firingPattern === "scatter") {
          const pellets = 3;
          const perPellet = Math.round(laserDmg * 2.5 / pellets);
          const spread = 0.1;
          for (let si = 0; si < pellets; si++) {
            const spreadAng = ang + (si - 1) * spread;
            const side = si === 0 ? -1 : si === 2 ? 1 : 0;
            const ox = p.posX + Math.cos(perpAng) * 10 * side;
            const oy = p.posY + Math.sin(perpAng) * 10 * side;
            fireProj(ox, oy, spreadAng, perPellet, 4, 500);
          }
        } else if (firingPattern === "rail") {
          const perBurst = Math.round(laserDmg * 1.3 / 3);
          for (let bi = 0; bi < 3; bi++) {
            const side = bi === 0 ? -1 : bi === 1 ? 1 : 0;
            const ox = p.posX + Math.cos(perpAng) * 10 * side;
            const oy = p.posY + Math.sin(perpAng) * 10 * side;
            const burstAng = ang + (Math.random() - 0.5) * 0.04;
            fireProj(ox, oy, burstAng, perBurst, 4, 700);
          }
        } else {
          const perShot = Math.round(laserDmg / 2);
          for (let si = 0; si < 2; si++) {
            const side = si === 0 ? -1 : 1;
            const ox = p.posX + Math.cos(perpAng) * 14 * side;
            const oy = p.posY + Math.sin(perpAng) * 14 * side;
            fireProj(ox, oy, ang - side * 0.03, perShot, 4, 600);
          }
        }

        const cd = Math.max(0.2, 0.85 / stats.fireRate);
        p.laserFireCd = cd;
      }

      // Fire rocket (only if player has a rocket weapon equipped)
      const pCached = this.playerDataCache.get(p.playerId);
      const hasRocket = pCached?.equipped?.weapon?.some((wid: string | null) => {
        if (!wid) return false;
        const item = pCached.inventory?.find((m: any) => m.instanceId === wid);
        return item && MODULE_DEFS[item.defId]?.weaponKind === "rocket";
      }) ?? false;
      if (p.isRocketFiring && p.rocketFireCd <= 0 && hasRocket) {
        const missileDef = ROCKET_MISSILE_TYPE_DEFS[p.rocketAmmoType as RocketMissileType];
        const mul = missileDef ? missileDef.damageMul : 1;
        const rocketDmg = Math.round(stats.damage * mul * 0.4 * 2.5);
        const crit = Math.random() < stats.critChance;
        const rocketColor = "#ff8a4e";
        const projSpeed = 330;

        const proj: ServerProjectile = {
          id: eid("proj"),
          zone: zoneId,
          fromPlayerId: p.playerId,
          fromEnemyId: null,
          fromNpcId: null,
          pos: { x: p.posX, y: p.posY },
          vel: { x: Math.cos(ang) * projSpeed, y: Math.sin(ang) * projSpeed },
          damage: rocketDmg,
          ttl: 3.0,
          color: rocketColor,
          size: 5,
          crit,
          weaponKind: "rocket",
          homing: true,
          homingTargetId: target.id,
          aoeRadius: stats.aoeRadius,
          empStun: 0,
          armorPiercing: false,
        };
        zs.projectiles.set(proj.id, proj);
        events.push({
          type: "projectile:spawn", zone: zoneId, fromPlayerId: p.playerId,
          x: proj.pos.x, y: proj.pos.y, vx: proj.vel.x, vy: proj.vel.y,
          damage: proj.damage, color: proj.color, size: proj.size,
          crit: proj.crit, weaponKind: proj.weaponKind, homing: proj.homing,
        });

        const rCd = 1.5 / (stats.fireRate * 0.5);
        p.rocketFireCd = rCd;
      }
    }
  }

  // ── SERVER-AUTHORITATIVE MINING ─────────────────────────────────────────

  private tickPlayerMining(zoneId: string, zs: ZoneState, players: OnlinePlayer[], dt: number, events: GameEvent[]): void {
    for (const p of players) {
      if (p.isDocked) continue;
      if (!p.miningTargetId) continue;
      const ast = zs.asteroids.get(p.miningTargetId);
      if (!ast || ast.respawnAt > 0) { p.miningTargetId = null; continue; }

      const mDist = dist({ x: p.posX, y: p.posY }, ast.pos);
      if (mDist > MINING_RANGE) { p.miningTargetId = null; continue; }

      const stats = this.playerStatsCache.get(p.playerId);
      if (!stats) continue;
      const miningDps = stats.damage * MINING_DPS_FACTOR * (1 + (stats.miningBonus ?? 0));
      ast.hp -= miningDps * dt;

      if (ast.hp <= 0) {
        const qty = 2 + Math.floor(Math.random() * 3);
        events.push({
          type: "asteroid:destroy", zone: zoneId,
          asteroidId: ast.id, playerId: p.playerId,
          ore: { resourceId: ast.yields, qty },
        });
        ast.hp = 0;
        ast.respawnAt = Date.now() + 6000;
        p.miningTargetId = null;
      } else {
        events.push({
          type: "asteroid:mine", zone: zoneId,
          asteroidId: ast.id, hp: ast.hp, hpMax: ast.hpMax,
        });
      }
    }
  }

  // ── SHIELD REGEN ────────────────────────────────────────────────────────

  private tickPlayerShieldRegen(players: OnlinePlayer[], dt: number): void {
    const now = Date.now() / 1000;
    for (const p of players) {
      if (now - p.lastHitTick < 5) continue;
      if (p.shield >= p.shieldMax) continue;
      p.shield = Math.min(p.shieldMax, p.shield + p.shieldRegen * dt);
    }
  }

  // ── PROJECTILE PHYSICS + COLLISION ──────────────────────────────────────

  private tickProjectiles(zoneId: string, zs: ZoneState, players: OnlinePlayer[], dt: number, events: GameEvent[]): void {
    for (const [projId, proj] of zs.projectiles) {
      // Homing
      if (proj.homing && proj.homingTargetId) {
        const target = zs.enemies.get(proj.homingTargetId);
        if (target) {
          const desiredAng = angleFromTo(proj.pos, target.pos);
          const curAng = Math.atan2(proj.vel.y, proj.vel.x);
          let diff = desiredAng - curAng;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turnRate = 3.5 * dt;
          const newAng = curAng + Math.sign(diff) * Math.min(Math.abs(diff), turnRate);
          const spd = Math.sqrt(proj.vel.x * proj.vel.x + proj.vel.y * proj.vel.y);
          proj.vel.x = Math.cos(newAng) * spd;
          proj.vel.y = Math.sin(newAng) * spd;
        }
      }

      proj.pos.x += proj.vel.x * dt;
      proj.pos.y += proj.vel.y * dt;
      proj.ttl -= dt;
      if (proj.ttl <= 0) { zs.projectiles.delete(projId); continue; }

      if (proj.fromPlayerId !== null) {
        // Player projectile -> hit enemies
        for (const e of zs.enemies.values()) {
          if (dist(proj.pos, e.pos) < e.size + 4) {
            // Combo system
            let combo = e.combo.get(proj.fromPlayerId);
            const stacks = combo ? Math.min(5, combo.stacks + 1) : 1;
            e.combo.set(proj.fromPlayerId, { stacks, ttl: 3 });
            const comboMul = 1 + (stacks - 1) * 0.10;

            const pData = this.playerDataCache.get(proj.fromPlayerId);
            const sk = (id: SkillId) => (pData?.skills?.[id] ?? 0) as number;
            const execMul = (e.hull / e.hullMax < 0.25 && sk("off-execute") > 0) ? (1 + sk("off-execute") * 0.20) : 1;
            const voidMul = ((e.type === "dread" || e.type === "voidling") && sk("off-void") > 0) ? (1 + sk("off-void") * 0.08) : 1;
            const critMul = proj.crit ? 1.5 : 1;

            let dmg = Math.round(proj.damage * comboMul * critMul * execMul * voidMul);
            if (dmg < 1) dmg = 1;
            e.hull -= dmg;
            if (e.isBoss && e.hullMax > 0) { const hpPct = e.hull / e.hullMax; e.bossPhase = hpPct > 0.66 ? 0 : hpPct > 0.33 ? 1 : 2; }
            if (e.aggroTarget !== proj.fromPlayerId && (!e.retargetCd || e.retargetCd <= 0)) {
              e.aggroTarget = proj.fromPlayerId;
              e.retargetCd = 2.5;
            }

            if (e.hull <= 0) {
              const tierMult = this.getZoneTierMult(zoneId);
              const zoneDef = ZONES[zoneId as ZoneId];
              // Bonus loot variety: chance to drop extra trade goods
              const dropResource = e.loot ? { ...e.loot } : pickLoot(e.type);
              if (dropResource) dropResource.qty = Math.ceil(dropResource.qty * (1 + (zoneDef.enemyTier - 1) * 0.5));
              const bonusDrops: ResourceId[] = ["fuel-cell", "synth", "nanite", "food", "spice", "titanium", "medpack", "iron", "silk", "ore"];
              let bonusResource: { resourceId: ResourceId; qty: number } | undefined;
              const bonusChance = 0.40 + zoneDef.enemyTier * 0.05;
              if (Math.random() < bonusChance && !e.isBoss) {
                const bonusRes = bonusDrops[Math.floor(Math.random() * bonusDrops.length)];
                bonusResource = { resourceId: bonusRes, qty: Math.ceil((1 + Math.floor(Math.random() * 2)) * (1 + (zoneDef.enemyTier - 1) * 0.3)) };
              }
              const loot: LootDrop = {
                credits: Math.round(e.credits * tierMult) + Math.round((proj.fromPlayerId != null ? (this.playerStatsCache.get(proj.fromPlayerId)?.lootBonus ?? 0) : 0) * 2),
                exp: Math.round(e.exp * tierMult * (e.isBoss ? 2 : 1)),
                honor: e.honor,
                resource: dropResource,
                bonusResource,
              };
              events.push({ type: "enemy:die", zone: zoneId, enemyId: e.id, killerId: proj.fromPlayerId, loot, pos: { ...e.pos } });
              zs.enemies.delete(e.id);
              if (e.isBoss) { zs.bossActive = false; zs.bossTimer = randRange(180, 420); }
            } else {
              events.push({
                type: "enemy:hit", zone: zoneId, enemyId: e.id,
                damage: dmg, hp: e.hull, hpMax: e.hullMax,
                crit: proj.crit, attackerId: proj.fromPlayerId,
              });
              // AOE splash
              if (proj.aoeRadius > 0) {
                const splashRange = proj.aoeRadius * 3;
                const splashDmg = Math.round(dmg * 0.4);
                for (const e2 of zs.enemies.values()) {
                  if (e2.id === e.id) continue;
                  if (dist(e.pos, e2.pos) < splashRange) {
                    e2.hull -= splashDmg;
                    if (e2.hull <= 0) {
                      const loot2: LootDrop = {
                        credits: Math.round(e2.credits * this.getZoneTierMult(zoneId)),
                        exp: Math.round(e2.exp * this.getZoneTierMult(zoneId)),
                        honor: e2.honor,
                        resource: e2.loot ? { ...e2.loot } : undefined,
                      };
                      events.push({ type: "enemy:die", zone: zoneId, enemyId: e2.id, killerId: proj.fromPlayerId, loot: loot2, pos: { ...e2.pos } });
                      zs.enemies.delete(e2.id);
                    } else {
                      events.push({ type: "enemy:hit", zone: zoneId, enemyId: e2.id, damage: splashDmg, hp: e2.hull, hpMax: e2.hullMax, crit: false, attackerId: proj.fromPlayerId });
                    }
                  }
                }
              }
            }
            zs.projectiles.delete(projId);
            break;
          }
        }
      } else if (proj.fromNpcId !== null) {
        // NPC projectile -> hit enemies
        for (const e of zs.enemies.values()) {
          if (dist(proj.pos, e.pos) < e.size + 4) {
            e.hull -= proj.damage;
            if (e.hull <= 0) {
              const loot: LootDrop = {
                credits: Math.round(e.credits * this.getZoneTierMult(zoneId)),
                exp: 0, honor: 0,
              };
              events.push({ type: "enemy:die", zone: zoneId, enemyId: e.id, killerId: 0, loot, pos: { ...e.pos } });
              zs.enemies.delete(e.id);
              if (e.isBoss) { zs.bossActive = false; zs.bossTimer = randRange(180, 420); }
            } else {
              events.push({ type: "enemy:hit", zone: zoneId, enemyId: e.id, damage: proj.damage, hp: e.hull, hpMax: e.hullMax, crit: false, attackerId: 0 });
            }
            zs.projectiles.delete(projId);
            break;
          }
        }
      } else if (proj.fromEnemyId !== null) {
        // Enemy projectile -> hit players
        for (const p of players) {
          if (p.isDocked) continue;
          if (dist(proj.pos, { x: p.posX, y: p.posY }) < 12) {
            this.damagePlayer(p, proj.damage);
            events.push({ type: "player:hit", playerId: p.playerId, damage: proj.damage, zone: zoneId });
            zs.projectiles.delete(projId);
            break;
          }
        }
      }
    }
  }

  // ── DAMAGE PLAYER (server-authoritative) ────────────────────────────────

  private damagePlayer(p: OnlinePlayer, rawDamage: number): void {
    const stats = this.playerStatsCache.get(p.playerId) ?? null;
    const reduction = stats ? stats.damageReduction : 0;
    const absorb = stats ? stats.shieldAbsorb : 0.5;
    let dmg = Math.round(rawDamage * (1 - Math.min(0.8, reduction)));
    if (dmg < 1) dmg = 1;
    const shieldDmg = Math.round(dmg * absorb);
    const hullDmg = dmg - shieldDmg;
    p.shield = Math.max(0, p.shield - shieldDmg);
    p.hull = Math.max(0, p.hull - hullDmg);
    p.lastHitTick = Date.now() / 1000;
  }

  // ── CULLED STATE PER PLAYER ─────────────────────────────────────────────

  getCulledStateForPlayer(p: OnlinePlayer): {
    self: { x: number; y: number; vx: number; vy: number; a: number; hp: number; hpMax: number; sp: number; spMax: number };
    players: { id: number; x: number; y: number; vx: number; vy: number; a: number; hp: number; sp: number; name: string; shipClass: string; level: number; faction: string | null }[];
    enemies: any[];
    npcs: any[];
    projectiles: ClientProjectile[];
    asteroids: { id: string; x: number; y: number; hp: number; hpMax: number; size: number; yields: string }[];
  } {
    const zs = this.zones.get(p.zone);
    const px = p.posX, py = p.posY;

    const stats = this.playerStatsCache.get(p.playerId) ?? null;

    const self = {
      x: px, y: py,
      vx: p.velX, vy: p.velY,
      a: p.angle,
      hp: p.hull, hpMax: stats ? stats.hullMax : p.hullMax,
      sp: p.shield, spMax: stats ? stats.shieldMax : p.shieldMax,
    };

    if (!zs) return { self, players: [], enemies: [], npcs: [], projectiles: [], asteroids: [] };

    // Culled players
    const playersResult: any[] = [];
    // We need all players in the zone - get from handler via callback
    // For now, we'll return empty and let handler fill this in

    // Culled enemies
    const enemies: any[] = [];
    for (const e of zs.enemies.values()) {
      if (!inView(px, py, e.pos.x, e.pos.y)) continue;
      enemies.push({
        id: e.id, x: e.pos.x, y: e.pos.y,
        vx: e.vel.x, vy: e.vel.y, a: e.angle,
        hp: e.hull, hpMax: e.hullMax,
        type: e.type, size: e.size, color: e.color,
        isBoss: e.isBoss, bossPhase: e.bossPhase,
        aggro: e.aggroTarget !== null,
        damage: e.damage, speed: e.speed,
        behavior: e.behavior, name: e.name,
      });
    }

    // Culled NPCs
    const npcs: any[] = [];
    for (const n of zs.npcShips.values()) {
      if (!inView(px, py, n.pos.x, n.pos.y)) continue;
      npcs.push({
        id: n.id, x: n.pos.x, y: n.pos.y,
        vx: n.vel.x, vy: n.vel.y, a: n.angle,
        hp: n.hull, hpMax: n.hullMax,
        state: n.state, color: n.color, size: n.size, name: n.name,
      });
    }

    // Culled projectiles
    const projectiles: ClientProjectile[] = [];
    for (const proj of zs.projectiles.values()) {
      if (!inView(px, py, proj.pos.x, proj.pos.y)) continue;
      projectiles.push({
        id: proj.id,
        x: proj.pos.x, y: proj.pos.y,
        vx: proj.vel.x, vy: proj.vel.y,
        damage: proj.damage,
        color: proj.color, size: proj.size,
        fromPlayer: proj.fromPlayerId !== null,
        crit: proj.crit,
        weaponKind: proj.weaponKind,
        homing: proj.homing,
      });
    }

    // Culled asteroids
    const asteroids: any[] = [];
    for (const a of zs.asteroids.values()) {
      if (a.respawnAt > 0) continue;
      if (!inView(px, py, a.pos.x, a.pos.y)) continue;
      asteroids.push({
        id: a.id, x: a.pos.x, y: a.pos.y,
        hp: a.hp, hpMax: a.hpMax, size: a.size,
        yields: a.yields,
      });
    }

    return { self, players: playersResult, enemies, npcs, projectiles, asteroids };
  }

  // ── ZONE STATE QUERIES ───────────────────────────────────────────────

  getZoneEnemies(zone: string): ClientEnemy[] {
    const zs = this.zones.get(zone);
    if (!zs) return [];
    return Array.from(zs.enemies.values()).map(enemyToClient);
  }

  getZoneAsteroids(zone: string): ClientAsteroid[] {
    const zs = this.zones.get(zone);
    if (!zs) return [];
    return Array.from(zs.asteroids.values())
      .filter(a => a.respawnAt === 0)
      .map(asteroidToClient);
  }

  getZoneNpcs(zone: string): ClientNpc[] {
    const zs = this.zones.get(zone);
    if (!zs) return [];
    return Array.from(zs.npcShips.values()).map(npcToClient);
  }

  getZoneEnemyTick(zone: string): any[] {
    const zs = this.zones.get(zone);
    if (!zs) return [];
    const result: any[] = [];
    for (const e of zs.enemies.values()) {
      result.push({
        id: e.id, x: e.pos.x, y: e.pos.y,
        vx: e.vel.x, vy: e.vel.y, a: e.angle,
        hp: e.hull, hpMax: e.hullMax,
        type: e.type, size: e.size, color: e.color,
        isBoss: e.isBoss, bossPhase: e.bossPhase,
        aggro: e.aggroTarget !== null,
      });
    }
    return result;
  }

  getZoneNpcTick(zone: string): any[] {
    const zs = this.zones.get(zone);
    if (!zs) return [];
    const result: any[] = [];
    for (const n of zs.npcShips.values()) {
      result.push({
        id: n.id, x: n.pos.x, y: n.pos.y,
        vx: n.vel.x, vy: n.vel.y, a: n.angle,
        hp: n.hull, hpMax: n.hullMax,
        state: n.state, color: n.color, size: n.size,
        name: n.name,
      });
    }
    return result;
  }

  // ── PLAYER ACTIONS ───────────────────────────────────────────────────

  playerAttackEnemy(
    playerId: number, enemyId: string, zone: string,
    weaponKind: "laser" | "rocket" | "energy" | "plasma", ammoType: string,
  ): GameEvent[] {
    const events: GameEvent[] = [];
    const zs = this.zones.get(zone);
    if (!zs) return events;
    const e = zs.enemies.get(enemyId);
    if (!e) return events;

    const pData = this.playerDataCache.get(playerId);
    if (!pData) return events;

    const stats = this.playerStatsCache.get(playerId);
    if (!stats) return events;

    let baseDmg: number;
    if (weaponKind === "laser") {
      const ammoDef = ROCKET_AMMO_TYPE_DEFS[ammoType as RocketAmmoType];
      const mul = ammoDef ? ammoDef.damageMul : 1;
      baseDmg = stats.damage * mul * 0.4;
    } else {
      const missileDef = ROCKET_MISSILE_TYPE_DEFS[ammoType as RocketMissileType];
      const mul = missileDef ? missileDef.damageMul : 1;
      baseDmg = stats.damage * mul * 0.4 * 2.5;
    }

    // Combo system
    let combo = e.combo.get(playerId);
    const stacks = combo ? Math.min(5, combo.stacks + 1) : 1;
    e.combo.set(playerId, { stacks, ttl: 3 });
    const comboMul = 1 + (stacks - 1) * 0.10;

    // Crit
    const crit = Math.random() < stats.critChance;
    const critMul = crit ? 1.5 : 1;

    // Execute bonus (below 25% HP)
    const sk = (id: SkillId) => (pData.skills?.[id] ?? 0) as number;
    const execMul = (e.hull / e.hullMax < 0.25 && sk("off-execute") > 0) ? (1 + sk("off-execute") * 0.20) : 1;

    // Void rounds bonus (vs dread/voidling)
    const voidMul = ((e.type === "dread" || e.type === "voidling") && sk("off-void") > 0) ? (1 + sk("off-void") * 0.08) : 1;

    let dmg = Math.round(baseDmg * comboMul * critMul * execMul * voidMul);
    if (dmg < 1) dmg = 1;

    e.hull -= dmg;
    e.aggroTarget = playerId;

    if (e.hull <= 0) {
      // Enemy killed
      const tierMult = this.getZoneTierMult(zone);
      let dropResource2 = e.loot ? { ...e.loot } : undefined;
      const bonusDrops2: ResourceId[] = ["fuel-cell", "synth", "nanite", "food", "spice", "titanium"];
      if (Math.random() < 0.25 && !e.isBoss) {
        const bonusRes2 = bonusDrops2[Math.floor(Math.random() * bonusDrops2.length)];
        dropResource2 = { resourceId: bonusRes2, qty: 1 + Math.floor(Math.random() * 2) };
      }
      const loot: LootDrop = {
        credits: Math.round(e.credits * tierMult) + Math.round(stats.lootBonus * 2),
        exp: Math.round(e.exp * tierMult * (e.isBoss ? 2 : 1)),
        honor: e.honor,
        resource: dropResource2,
      };
      events.push({
        type: "enemy:die", zone, enemyId: e.id,
        killerId: playerId, loot, pos: { ...e.pos },
      });
      zs.enemies.delete(e.id);
      if (e.isBoss) {
        zs.bossActive = false;
        zs.bossTimer = randRange(180, 420);
      }
    } else {
      events.push({
        type: "enemy:hit", zone, enemyId: e.id,
        damage: dmg, hp: e.hull, hpMax: e.hullMax,
        crit, attackerId: playerId,
      });

      // AOE splash
      if (stats.aoeRadius > 0) {
        const splashRange = stats.aoeRadius * 3;
        const splashDmg = Math.round(dmg * 0.4);
        for (const e2 of zs.enemies.values()) {
          if (e2.id === e.id) continue;
          if (dist(e.pos, e2.pos) < splashRange) {
            e2.hull -= splashDmg;
            if (e2.hull <= 0) {
              const loot2: LootDrop = {
                credits: Math.round(e2.credits * this.getZoneTierMult(zone)),
                exp: Math.round(e2.exp * this.getZoneTierMult(zone)),
                honor: e2.honor,
                resource: e2.loot ? { ...e2.loot } : undefined,
              };
              events.push({ type: "enemy:die", zone, enemyId: e2.id, killerId: playerId, loot: loot2, pos: { ...e2.pos } });
              zs.enemies.delete(e2.id);
            } else {
              events.push({ type: "enemy:hit", zone, enemyId: e2.id, damage: splashDmg, hp: e2.hull, hpMax: e2.hullMax, crit: false, attackerId: playerId });
            }
          }
        }
      }
    }

    return events;
  }

  playerMine(playerId: number, asteroidId: string, zone: string, dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    const zs = this.zones.get(zone);
    if (!zs) return events;
    const ast = zs.asteroids.get(asteroidId);
    if (!ast || ast.respawnAt > 0) return events;

    const stats = this.playerStatsCache.get(playerId);
    if (!stats) return events;

    const miningDps = stats.damage * 0.25 * (1 + (stats.miningBonus ?? 0));
    ast.hp -= miningDps * dt;

    if (ast.hp <= 0) {
      const qty = 2 + Math.floor(Math.random() * 3);
      const ore: { resourceId: ResourceId; qty: number } = {
        resourceId: ast.yields,
        qty,
      };
      events.push({ type: "asteroid:destroy", zone, asteroidId: ast.id, playerId, ore });
      ast.hp = 0;
      ast.respawnAt = Date.now() + 6000;
    } else {
      events.push({ type: "asteroid:mine", zone, asteroidId: ast.id, hp: ast.hp, hpMax: ast.hpMax });
    }

    return events;
  }

  // ── ENEMY SPAWNING ──────────────────────────────────────────��────────

  private tickPirateSpawns(zoneId: string, zs: ZoneState, players: OnlinePlayer[], dt: number, events: GameEvent[]): void {
    if (players.length === 0) return;
    // Pirate group spawn timer (every 90-180 seconds)
    zs.pirateTimer = (zs.pirateTimer ?? randRange(90, 180)) - dt;
    if (zs.pirateTimer > 0) return;
    zs.pirateTimer = randRange(90, 180);

    // Cap pirates per zone - count existing pirates
    let pirateCount = 0;
    for (const e of zs.enemies.values()) {
      if (e.id.startsWith("pir") || e.id.startsWith("pboss")) pirateCount++;
    }
    if (pirateCount >= 10) return;

    const zoneDef = ZONES[zoneId as ZoneId];
    if (!zoneDef) return;
    const tierMult = Math.pow(2, zoneDef.enemyTier - 1);

    // Pick a random player to spawn near
    const rp = players[Math.floor(Math.random() * players.length)];
    const baseAng = Math.random() * Math.PI * 2;
    const baseDist = 600 + Math.random() * 800;
    const baseX = clamp(rp.posX + Math.cos(baseAng) * baseDist, -MAP_RADIUS * 0.9, MAP_RADIUS * 0.9);
    const baseY = clamp(rp.posY + Math.sin(baseAng) * baseDist, -MAP_RADIUS * 0.9, MAP_RADIUS * 0.9);

    // Spawn 3-6 pirates in a group (capped to not exceed zone limit)
    const maxToSpawn = Math.max(0, 10 - pirateCount);
    const groupSize = Math.min(3 + Math.floor(Math.random() * 4), maxToSpawn);
    if (groupSize <= 0) return;
    const pirateTypes: EnemyType[] = ["raider", "scout", "destroyer"];
    const pirateColor = "#ff6633";

    // 15% chance for bounty boss pirate event
    const isBountyEvent = Math.random() < 0.15;

    for (let i = 0; i < groupSize; i++) {
      const pType = pirateTypes[Math.floor(Math.random() * pirateTypes.length)];
      const baseDef = ENEMY_DEFS[pType];
      const offsetX = (Math.random() - 0.5) * 300;
      const offsetY = (Math.random() - 0.5) * 300;

      const pirate: ServerEnemy = {
        id: eid("pir"),
        type: pType,
        behavior: baseDef.behavior,
        name: "Pirate",
        pos: { x: baseX + offsetX, y: baseY + offsetY },
        vel: { x: Math.cos(Math.random() * Math.PI * 2) * baseDef.speed * 0.5, y: Math.sin(Math.random() * Math.PI * 2) * baseDef.speed * 0.5 },
        angle: Math.random() * Math.PI * 2,
        hull: Math.round(baseDef.hullMax * tierMult * 1.2),
        hullMax: Math.round(baseDef.hullMax * tierMult * 1.2),
        damage: Math.round(baseDef.damage * tierMult * 1.1),
        speed: Math.round(baseDef.speed * 1.2),
        exp: Math.round(baseDef.exp * 1.5),
        credits: Math.round(baseDef.credits * 2),
        honor: baseDef.honor + 2,
        loot: { resourceId: "plasma" as any, qty: Math.ceil(2 * (1 + (zoneDef.enemyTier - 1) * 0.5)) },
        color: pirateColor,
        size: baseDef.size + 2,
        isBoss: false,
        bossPhase: 0,
        phaseTimer: 0,
        fireTimer: randRange(0.5, 1.5),
        burstCd: 0,
        burstShots: 0,
        aggroTarget: null, retargetCd: 0,
        aggroRange: 500,
        spawnPos: { x: baseX + offsetX, y: baseY + offsetY },
        stunUntil: 0,
        combo: new Map(),
      };
      zs.enemies.set(pirate.id, pirate);
      events.push({ type: "enemy:spawn", zone: zoneId, enemy: this.serializeEnemy(pirate) });
    }

    // Bounty boss pirate (special event)
    if (isBountyEvent) {
      const bossType: EnemyType = "dread";
      const bossDef = ENEMY_DEFS[bossType];
      const boss: ServerEnemy = {
        id: eid("pboss"),
        type: bossType,
        behavior: "tank",
        name: "Pirate Captain",
        pos: { x: baseX, y: baseY },
        vel: { x: Math.cos(Math.random() * Math.PI * 2) * 20, y: Math.sin(Math.random() * Math.PI * 2) * 20 },
        angle: Math.random() * Math.PI * 2,
        hull: Math.round(bossDef.hullMax * tierMult * 4),
        hullMax: Math.round(bossDef.hullMax * tierMult * 4),
        damage: Math.round(bossDef.damage * tierMult * 2.5),
        speed: Math.round(bossDef.speed * 0.8),
        exp: Math.round(bossDef.exp * 5),
        credits: Math.round(bossDef.credits * 8),
        honor: bossDef.honor * 3,
        loot: { resourceId: "dread" as any, qty: Math.ceil(5 * (1 + (zoneDef.enemyTier - 1) * 0.5)) },
        color: "#ff2200",
        size: bossDef.size + 8,
        isBoss: true,
        bossPhase: 0,
        phaseTimer: randRange(8, 14),
        fireTimer: 1.0,
        burstCd: 0,
        burstShots: 0,
        aggroTarget: null, retargetCd: 0,
        aggroRange: 800,
        spawnPos: { x: baseX, y: baseY },
        stunUntil: 0,
        combo: new Map(),
      };
      zs.enemies.set(boss.id, boss);
      events.push({ type: "enemy:spawn", zone: zoneId, enemy: this.serializeEnemy(boss) });
      events.push({ type: "boss:warn", zone: zoneId });
    }
  }

  private serializeEnemy(e: ServerEnemy): ClientEnemy {
    return {
      id: e.id, type: e.type, behavior: e.behavior, name: e.name,
      x: e.pos.x, y: e.pos.y, vx: e.vel.x, vy: e.vel.y, angle: e.angle,
      hull: e.hull, hullMax: e.hullMax, damage: e.damage, speed: e.speed,
      color: e.color, size: e.size,
      isBoss: e.isBoss, bossPhase: e.bossPhase,
      aggro: e.aggroTarget !== null,
    };
  }

    private tickEnemySpawns(zoneId: string, zs: ZoneState, players: OnlinePlayer[], dt: number, events: GameEvent[]): void {
    zs.spawnTimer -= dt;
    if (zs.spawnTimer > 0) return;
    zs.spawnTimer = randRange(0.4, 1.0);

    const zoneDef = ZONES[zoneId as ZoneId];
    if (!zoneDef) return;

    const maxEnemies = 40 + zoneDef.enemyTier * 5;
    const nonBossCount = Array.from(zs.enemies.values()).filter(e => !e.isBoss).length;
    if (nonBossCount >= maxEnemies) return;

    const tierMult = Math.pow(2, zoneDef.enemyTier - 1);
    const typePool = zoneDef.enemyTypes;
    const enemyType = typePool[Math.floor(Math.random() * typePool.length)];
    const baseDef = ENEMY_DEFS[enemyType];
    if (!baseDef) return;

    // Faction modifiers
    const fMods = FACTION_ENEMY_MODS[zoneDef.faction]?.[enemyType];
    const hullMul = (fMods?.hullMul ?? 1) * tierMult;
    const dmgMul = (fMods?.damageMul ?? 1) * tierMult;
    const spdMul = fMods?.speedMul ?? 1;
    const color = fMods?.color ?? baseDef.color;

    // Spawn position: 65% near a player (but at distance), 35% random on map
    let spawnPos: Vec2;
    if (players.length > 0 && Math.random() < 0.50) {
      const rp = players[Math.floor(Math.random() * players.length)];
      const ang = Math.random() * Math.PI * 2;
      const d = 800 + Math.random() * 1000;
      spawnPos = {
        x: clamp(rp.posX + Math.cos(ang) * d, -MAP_RADIUS, MAP_RADIUS),
        y: clamp(rp.posY + Math.sin(ang) * d, -MAP_RADIUS, MAP_RADIUS),
      };
    } else {
      spawnPos = {
        x: randRange(-MAP_RADIUS * 0.9, MAP_RADIUS * 0.9),
        y: randRange(-MAP_RADIUS * 0.9, MAP_RADIUS * 0.9),
      };
    }

    const names = ENEMY_NAMES[enemyType];
    const name = names[Math.floor(Math.random() * names.length)];

    const enemy: ServerEnemy = {
      id: eid("e"),
      type: enemyType,
      behavior: baseDef.behavior,
      name,
      pos: { ...spawnPos },
      vel: { x: 0, y: 0 },
      angle: Math.random() * Math.PI * 2,
      hull: Math.round(baseDef.hullMax * hullMul),
      hullMax: Math.round(baseDef.hullMax * hullMul),
      damage: Math.round(baseDef.damage * dmgMul),
      speed: Math.round(baseDef.speed * spdMul),
      exp: baseDef.exp,
      credits: baseDef.credits,
      honor: baseDef.honor,
      loot: pickLoot(enemyType),
      color,
      size: baseDef.size,
      isBoss: false,
      bossPhase: 0,
      phaseTimer: 0,
      fireTimer: randRange(1, 3),
      burstCd: 0,
      burstShots: 0,
      aggroTarget: null, retargetCd: 0,
      aggroRange: 400,
      spawnPos: { ...spawnPos },
      stunUntil: 0,
      combo: new Map(),
    };

    zs.enemies.set(enemy.id, enemy);
    events.push({ type: "enemy:spawn", zone: zoneId, enemy: enemyToClient(enemy) });
  }

  // ── BOSS SPAWNING ────────────────────────────────────────────────────

  private tickBossSpawn(zoneId: string, zs: ZoneState, players: OnlinePlayer[], dt: number, events: GameEvent[]): void {
    if (zs.bossActive) return;
    zs.bossTimer -= dt;
    if (zs.bossTimer > 0) return;

    const zoneDef = ZONES[zoneId as ZoneId];
    if (!zoneDef) return;
    const tierMult = Math.pow(2, zoneDef.enemyTier - 1);

    // Pick the strongest enemy type in this zone for the boss
    const bossType = zoneDef.enemyTypes[zoneDef.enemyTypes.length - 1];
    const baseDef = ENEMY_DEFS[bossType];
    if (!baseDef) return;

    const hpMul = randRange(4.5, 6.0) * tierMult;
    const dmgMul = randRange(3.0, 4.0) * tierMult;
    const fMods = FACTION_ENEMY_MODS[zoneDef.faction]?.[bossType];
    const color = fMods?.color ?? baseDef.color;

    // Spawn near center or random player
    const rp = players[Math.floor(Math.random() * players.length)];
    const spawnPos: Vec2 = rp
      ? {
        x: clamp(rp.posX + randRange(-600, 600), -MAP_RADIUS * 0.8, MAP_RADIUS * 0.8),
        y: clamp(rp.posY + randRange(-600, 600), -MAP_RADIUS * 0.8, MAP_RADIUS * 0.8)
      }
      : { x: 0, y: 0 };

    const boss: ServerEnemy = {
      id: eid("boss"),
      type: bossType,
      behavior: "tank",
      name: `BOSS ${ENEMY_NAMES[bossType][0]}`,
      pos: { ...spawnPos },
      vel: { x: 0, y: 0 },
      angle: Math.random() * Math.PI * 2,
      hull: Math.round(baseDef.hullMax * hpMul),
      hullMax: Math.round(baseDef.hullMax * hpMul),
      damage: Math.round(baseDef.damage * dmgMul),
      speed: Math.round(baseDef.speed * 0.6),
      exp: Math.round(baseDef.exp * hpMul),
      credits: Math.round(baseDef.credits * hpMul * 1.2),
      honor: Math.round(baseDef.honor * hpMul),
      loot: { resourceId: "dread" as ResourceId, qty: Math.ceil(tierMult * 2) },
      color,
      size: Math.round(baseDef.size * 2.5),
      isBoss: true,
      bossPhase: 0,
      phaseTimer: randRange(10, 15),
      fireTimer: 1.4,
      burstCd: 0,
      burstShots: 3,
      aggroTarget: null, retargetCd: 0,
      aggroRange: 800,
      spawnPos: { ...spawnPos },
      stunUntil: 0,
      combo: new Map(),
    };

    zs.enemies.set(boss.id, boss);
    zs.bossActive = true;
    // 40% chance for carrier boss variant (spawns fighters)
    if (Math.random() < 0.4 && zoneDef.enemyTier >= 3) {
      boss.behavior = "carrier" as any;
      boss.hullMax = Math.round(boss.hullMax * 1.5);
      boss.hull = boss.hullMax;
      boss.speed = Math.round(boss.speed * 0.5);
      boss.size = Math.round(boss.size * 1.3);
      boss.name = "CARRIER " + boss.name.replace("BOSS ", "");
    }
    events.push({ type: "boss:warn", zone: zoneId });
    events.push({ type: "enemy:spawn", zone: zoneId, enemy: enemyToClient(boss) });
  }

  // ── ENEMY AI ─────────────────────────────────────────────────────────

  private tickEnemyAI(zoneId: string, zs: ZoneState, players: OnlinePlayer[], dt: number, events: GameEvent[]): void {
    for (const e of zs.enemies.values()) {
      if (e.retargetCd && e.retargetCd > 0) e.retargetCd -= dt;
      if (Date.now() < e.stunUntil) continue;

      // Find aggro target
      let target: OnlinePlayer | null = null;
      if (e.aggroTarget !== null) {
        target = players.find(p => p.playerId === e.aggroTarget) ?? null;
        if (!target || target.isDocked || dist(e.pos, { x: target.posX, y: target.posY }) > e.aggroRange * 3) {
          e.aggroTarget = null;
          target = null;
        }
      }
      if (!target) {
        // Look for nearby player to aggro
        let closestDist = e.aggroRange;
        for (const p of players) {
          if (p.isDocked) continue;
          const d = dist(e.pos, { x: p.posX, y: p.posY });
          if (d < closestDist) {
            closestDist = d;
            target = p;
          }
        }
        if (target) {
          e.aggroTarget = target.playerId;
          e.retargetCd = 2.5;
        }
      }

      if (target) {
        // Move toward target
        const tPos = { x: target.posX, y: target.posY };
        const d = dist(e.pos, tPos);
        const fireRange = e.isBoss ? 500 : (e.behavior === "ranged" ? 350 : 250);

        if (d > fireRange * 0.8) {
          const ang = angleFromTo(e.pos, tPos);
          e.angle = ang;
          const spd = e.speed * dt;
          e.vel.x = Math.cos(ang) * e.speed;
          e.vel.y = Math.sin(ang) * e.speed;
          e.pos.x += Math.cos(ang) * spd;
          e.pos.y += Math.sin(ang) * spd;
        } else {
          // Orbit/strafe when in range instead of stopping
          const ang = angleFromTo(e.pos, tPos);
          e.angle = ang;
          // Perpendicular orbit direction (alternates based on enemy id hash)
          const orbitDir = (e.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
          const orbitAng = ang + (Math.PI / 2) * orbitDir;
          const orbitSpeed = e.speed * 0.4;
          e.vel.x = Math.cos(orbitAng) * orbitSpeed;
          e.vel.y = Math.sin(orbitAng) * orbitSpeed;
          e.pos.x += e.vel.x * dt;
          e.pos.y += e.vel.y * dt;
          // Gently push back to optimal range if too close
          if (d < fireRange * 0.4) {
            const pushAng = ang + Math.PI;
            e.pos.x += Math.cos(pushAng) * e.speed * 0.3 * dt;
            e.pos.y += Math.sin(pushAng) * e.speed * 0.3 * dt;
          }
        }

        // Fire at target
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && d < fireRange) {
          e.fireTimer = e.isBoss ? this.bossFireCd(e) : (e.type === "wraith" ? randRange(0.4, 0.7) : e.type === "sentinel" ? randRange(0.5, 0.8) : e.type === "overlord" ? randRange(0.7, 1.0) : e.behavior === "fast" ? randRange(0.5, 0.8) : randRange(0.7, 1.2));

          const dmg = this.calcEnemyDamage(e, target);
          const tPos = { x: target.posX, y: target.posY };
          const projAng = angleFromTo(e.pos, tPos);

          // Spawn server projectile(s) - ROTMG style
          if (e.isBoss) {
            const phase = e.bossPhase ?? 0;
            if (e.type === "titan" || e.type === "overlord") {
              // TITAN/OVERLORD: Heavy plasma + energy ring
              const shotCount = phase === 0 ? 7 : phase === 1 ? 9 : 16;
              if (phase < 2) {
                for (let i = 0; i < shotCount; i++) {
                  const shotAng = projAng + (i - (shotCount - 1) / 2) * 0.09;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg / shotCount), shotAng, e.color, "plasma", 6, 0.8);
                }
              } else {
                for (let i = 0; i < 16; i++) {
                  const ra = (Math.PI * 2 / 16) * i;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.6 / 16), ra, "#ff2244", "energy", 5, 0.65);
                }
                for (let i = -3; i <= 3; i++) {
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.2 / 7), projAng + i * 0.07, "#ffffff", "plasma", 7, 1.0);
                }
              }
            } else if (e.type === "wraith" || e.type === "sentinel") {
              // WRAITH/SENTINEL: Rapid energy storm
              const shotCount = phase === 0 ? 7 : phase === 1 ? 9 : 20;
              const spd = phase === 0 ? 1.2 : phase === 1 ? 1.4 : 1.1;
              if (phase < 2) {
                for (let i = 0; i < shotCount; i++) {
                  const shotAng = projAng + (i - (shotCount - 1) / 2) * 0.12;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg / shotCount), shotAng, e.color, "energy", 4, spd);
                }
              } else {
                for (let i = 0; i < 20; i++) {
                  const ra = (Math.PI * 2 / 20) * i;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.5 / 20), ra, "#cc44ff", "energy", 3, 1.1);
                }
                for (let i = -3; i <= 3; i++) {
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.0 / 7), projAng + i * 0.06, "#ffffff", "energy", 5, 1.5);
                }
              }
            } else {
              // DREAD (default): Massive plasma barrage
              const shotCount = phase === 0 ? 9 : phase === 1 ? 11 : 24;
              if (phase < 2) {
                for (let i = 0; i < shotCount; i++) {
                  const shotAng = projAng + (i - (shotCount - 1) / 2) * 0.08;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg / shotCount), shotAng, e.color, "plasma", 5, phase === 1 ? 1.1 : 0.95);
                }
                if (phase === 1) {
                  for (let i = 0; i < 6; i++) {
                    const ra = (Math.PI * 2 / 6) * i;
                    this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.5 / 6), ra, "#ffaa22", "energy", 4, 0.7);
                  }
                }
              } else {
                for (let i = 0; i < 24; i++) {
                  const ra = (Math.PI * 2 / 24) * i;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.6 / 24), ra, "#ff3b4d", "plasma", 4, 0.75);
                }
                for (let i = -4; i <= 4; i++) {
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.2 / 9), projAng + i * 0.06, "#ffffff", "plasma", 6, 1.2);
                }
              }
            }
          } else if (e.type === "sentinel") {
            // Predictive aim + area denial
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 1.2);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 80, y: tPos.y + pVelY * predTime * 80 });
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.9), predAng - 0.04, e.color, "energy", 4, 1.2);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.9), predAng + 0.04, e.color, "energy", 4, 1.2);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.4), predAng + 0.3, e.color, "energy", 3, 0.9);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.4), predAng - 0.3, e.color, "energy", 3, 0.9);
          } else if (e.type === "wraith") {
            // Fast predictive burst + flanking
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 1.4);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 90, y: tPos.y + pVelY * predTime * 90 });
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.6), predAng + i * 0.12, e.color, "energy", 3, 1.4);
            }
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.3), predAng + Math.PI * 0.4, e.color, "energy", 2, 1.6);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.3), predAng - Math.PI * 0.4, e.color, "energy", 2, 1.6);
          } else if (e.type === "titan") {
            // Predictive heavy spread + area denial
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 0.7);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 50, y: tPos.y + pVelY * predTime * 50 });
            // Heavy predictive plasma volley
            for (let i = -2; i <= 2; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.7), predAng + i * 0.07, e.color, "plasma", 6, 0.75);
            }
            // Area denial around predicted position
            for (let i = 0; i < 5; i++) {
              const offsetAng = predAng + (i - 2) * 0.3 + (Math.random() - 0.5) * 0.15;
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.4), offsetAng, "#ff6644", "plasma", 5, 0.5);
            }
          } else if (e.type === "overlord") {
            // Predictive barrage + area denial ring
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 1.1);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 70, y: tPos.y + pVelY * predTime * 70 });
            for (let i = -2; i <= 2; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.5), predAng + i * 0.09, e.color, "energy", 4, 1.1);
            }
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.2), predAng, "#ff4466", "plasma", 7, 0.8);
            for (let i = 0; i < 4; i++) {
              const ringAng = predAng + (Math.PI / 3) * (i - 1.5);
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.3), ringAng, e.color, "energy", 3, 0.7);
            }
          } else if (e.type === "dread") {
            // Predictive plasma spread
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 0.9);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 60, y: tPos.y + pVelY * predTime * 60 });
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.8), predAng + i * 0.06, e.color, "plasma", 5, 0.9);
            }
          } else if (e.type === "destroyer") {
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.7), projAng + i * 0.06, e.color, "plasma", 4);
            }
          } else if (e.type === "voidling") {
            this.spawnEnemyProjectile(zoneId, zs, e, dmg, projAng, e.color, "energy", 4);
          } else {
            this.spawnEnemyProjectile(zoneId, zs, e, dmg, projAng, e.color);
          }

          // Also emit the event for VFX purposes
          events.push({
            type: "enemy:attack", zone: zoneId,
            enemyId: e.id, enemyType: e.type, targetId: target.playerId,
            damage: dmg, pos: { ...e.pos },
            targetPos: tPos,
          });
        }

        // Boss secondary attacks (spiral + area denial between main volleys)
        if (e.isBoss && target) {
          e.secondaryTimer = (e.secondaryTimer ?? 0.5) - dt;
          if (e.secondaryTimer <= 0 && d < 700) {
            const secDmg = this.calcEnemyDamage(e, target);
            const secTPos = { x: target.posX, y: target.posY };
            const secAng = angleFromTo(e.pos, secTPos);
            const phase = e.bossPhase ?? 0;
            if (phase >= 1) {
              // Rotating spiral (2 arms)
              const spiralBase = (this.tickCount ?? 0) * 0.08;
              for (let arm = 0; arm < 2; arm++) {
                const sAng = spiralBase + arm * Math.PI;
                this.spawnEnemyProjectile(zoneId, zs, e, Math.round(secDmg * 0.3), sAng, e.color, "energy", 3, 0.55);
              }
            }
            if (phase >= 2) {
              // Area denial around player
              for (let i = 0; i < 3; i++) {
                const offsetAng = secAng + (i - 1) * 0.4 + (Math.random() - 0.5) * 0.2;
                this.spawnEnemyProjectile(zoneId, zs, e, Math.round(secDmg * 0.4), offsetAng, "#ff8844", "plasma", 4, 0.6);
              }
            }
            e.secondaryTimer = phase >= 2 ? 0.35 : 0.6;
          }
        }

        // Boss phase cycling
        if (e.isBoss) {
          e.phaseTimer -= dt;
          if (e.phaseTimer <= 0) {
            e.bossPhase = (e.bossPhase + 1) % 3;
            e.phaseTimer = randRange(10, 15);
          }
        }
      } else {
        // Idle: patrol around spawn area actively
        const dFromSpawn = dist(e.pos, e.spawnPos);
        if (dFromSpawn > 500) {
          // Too far from spawn - head back
          const ang = angleFromTo(e.pos, e.spawnPos);
          e.vel.x = Math.cos(ang) * e.speed * 0.5;
          e.vel.y = Math.sin(ang) * e.speed * 0.5;
          e.angle = ang;
        } else {
          // Active patrol: fly in a direction, change often
          e.pos.x += e.vel.x * dt;
          e.pos.y += e.vel.y * dt;
          const spdSq = e.vel.x * e.vel.x + e.vel.y * e.vel.y;
          if (spdSq < e.speed * e.speed * 0.04 || Math.random() < 0.03) {
            const ang = Math.random() * Math.PI * 2;
            const patrolSpd = e.speed * (0.3 + Math.random() * 0.3);
            e.vel.x = Math.cos(ang) * patrolSpd;
            e.vel.y = Math.sin(ang) * patrolSpd;
            e.angle = ang;
          }
        }
        e.pos.x += e.vel.x * dt;
        e.pos.y += e.vel.y * dt;
      }

      // Clamp to map
      e.pos.x = clamp(e.pos.x, -MAP_RADIUS, MAP_RADIUS);
      e.pos.y = clamp(e.pos.y, -MAP_RADIUS, MAP_RADIUS);
    }
  }

  private spawnEnemyProjectile(zoneId: string, zs: ZoneState, e: ServerEnemy, damage: number, angle: number, color: string, weaponKind: string = "laser", size: number = 3, speedMul: number = 1): void {
    const projSpeed = 600 * speedMul;
    const proj: ServerProjectile = {
      id: eid("ep"),
      zone: zoneId,
      fromPlayerId: null,
      fromEnemyId: e.id,
      fromNpcId: null,
      pos: { x: e.pos.x, y: e.pos.y },
      vel: { x: Math.cos(angle) * projSpeed, y: Math.sin(angle) * projSpeed },
      damage,
      ttl: 2.5,
      color,
      size,
      crit: false,
      weaponKind: weaponKind as any,
      homing: false,
      homingTargetId: null,
      aoeRadius: 0,
      empStun: 0,
      armorPiercing: false,
    };
    zs.projectiles.set(proj.id, proj);
  }

  private bossFireCd(e: ServerEnemy): number {
    if (e.type === "wraith" || e.type === "sentinel") {
      if (e.bossPhase === 0) return 0.8;
      if (e.bossPhase === 1) return 0.5;
      return 0.4;
    }
    if (e.type === "titan" || e.type === "overlord") {
      if (e.bossPhase === 0) return 1.3;
      if (e.bossPhase === 1) return 1.0;
      return 0.9;
    }
    // Dread default - slightly faster than before
    if (e.bossPhase === 0) return 1.1;
    if (e.bossPhase === 1) return 0.7;
    return 0.6;
  }

  private calcEnemyDamage(e: ServerEnemy, target: OnlinePlayer): number {
    let dmg = e.damage;
    if (e.isBoss) {
      dmg *= (e.bossPhase === 2 ? 1.5 : 1.0);
    }
    return Math.round(dmg);
  }

  // ── NPC SHIPS ────────────────────────────────────────────────────────

  private tickNpcSpawns(zoneId: string, zs: ZoneState, dt: number, events: GameEvent[]): void {
    zs.npcSpawnTimer -= dt;
    if (zs.npcSpawnTimer > 0) return;
    zs.npcSpawnTimer = randRange(5, 12);

    if (zs.npcShips.size >= 8) return;

    const spawnPos: Vec2 = {
      x: randRange(-MAP_RADIUS * 0.7, MAP_RADIUS * 0.7),
      y: randRange(-MAP_RADIUS * 0.7, MAP_RADIUS * 0.7),
    };
    const targetPos: Vec2 = {
      x: randRange(-MAP_RADIUS * 0.7, MAP_RADIUS * 0.7),
      y: randRange(-MAP_RADIUS * 0.7, MAP_RADIUS * 0.7),
    };

    const npcNames = ["Patrol Hawk", "Sentinel Ray", "Enforcer", "Marshal", "Ranger Kel", "Warden Pax", "Scout Nova", "Navigator", "Trader Vex", "Cargo Runner", "Merchant Iris", "Hauler Kain"];
    const npcColors = ["#4ee2ff", "#5cff8a", "#ffd24a", "#ff8a4e", "#c8a0ff", "#7ad8ff"];
    const npc: ServerNpc = {
      id: eid("npc"),
      name: npcNames[Math.floor(Math.random() * npcNames.length)],
      pos: { ...spawnPos },
      vel: { x: 0, y: 0 },
      angle: angleFromTo(spawnPos, targetPos),
      hull: 300,
      hullMax: 300,
      speed: randRange(90, 140),
      damage: randRange(10, 18),
      fireTimer: randRange(0.8, 1.2),
      targetPos: { ...targetPos },
      state: "patrol",
      targetEnemyId: null,
      color: npcColors[Math.floor(Math.random() * npcColors.length)],
      size: 12,
    };

    zs.npcShips.set(npc.id, npc);
    events.push({ type: "npc:spawn", zone: zoneId, npc: npcToClient(npc) });
  }

  private tickNpcAI(zoneId: string, zs: ZoneState, dt: number, events: GameEvent[]): void {
    for (const npc of zs.npcShips.values()) {
      // Always scan for nearby enemies regardless of state
      let closestEnemy: ServerEnemy | null = null;
      let closestDist = 500;
      for (const e of zs.enemies.values()) {
        const ed = dist(npc.pos, e.pos);
        if (ed < closestDist) {
          closestDist = ed;
          closestEnemy = e;
        }
      }
      if (closestEnemy && npc.state !== "fight") {
        npc.state = "fight";
        npc.targetEnemyId = closestEnemy.id;
      }

      if (npc.state === "patrol") {
        // Move toward target position
        const d = dist(npc.pos, npc.targetPos);
        if (d < 50) {
          // Pick new target
          npc.targetPos = {
            x: randRange(-MAP_RADIUS * 0.7, MAP_RADIUS * 0.7),
            y: randRange(-MAP_RADIUS * 0.7, MAP_RADIUS * 0.7),
          };
        }
        const ang = angleFromTo(npc.pos, npc.targetPos);
        npc.angle = ang;
        npc.vel.x = Math.cos(ang) * npc.speed;
        npc.vel.y = Math.sin(ang) * npc.speed;
        npc.pos.x += npc.vel.x * dt;
        npc.pos.y += npc.vel.y * dt;
      } else {
        // Fighting
        const target = npc.targetEnemyId ? zs.enemies.get(npc.targetEnemyId) : null;
        if (!target) {
          npc.state = "patrol";
          npc.targetEnemyId = null;
          continue;
        }

        const d = dist(npc.pos, target.pos);
        if (d > 300) {
          const ang = angleFromTo(npc.pos, target.pos);
          npc.angle = ang;
          npc.pos.x += Math.cos(ang) * npc.speed * dt;
          npc.pos.y += Math.sin(ang) * npc.speed * dt;
          npc.vel.x = Math.cos(ang) * npc.speed;
          npc.vel.y = Math.sin(ang) * npc.speed;
        } else {
          npc.angle = angleFromTo(npc.pos, target.pos);
          npc.vel.x *= 0.9;
          npc.vel.y *= 0.9;
        }

        npc.fireTimer -= dt;
        if (npc.fireTimer <= 0 && d < 400) {
          npc.fireTimer = randRange(0.5, 0.9);
          const npcAng = angleFromTo(npc.pos, target.pos);
          const npcProjSpeed = 600;
          const npcProj: ServerProjectile = {
            id: eid("np"),
            zone: zoneId,
            fromPlayerId: null,
            fromEnemyId: null,
            fromNpcId: npc.id,
            pos: { x: npc.pos.x, y: npc.pos.y },
            vel: { x: Math.cos(npcAng) * npcProjSpeed, y: Math.sin(npcAng) * npcProjSpeed },
            damage: npc.damage,
            ttl: 2.0,
            color: npc.color,
            size: 3,
            crit: false,
            weaponKind: "laser",
            homing: false,
            homingTargetId: null,
            aoeRadius: 0,
            empStun: 0,
            armorPiercing: false,
          };
          zs.projectiles.set(npcProj.id, npcProj);
          events.push({
            type: "projectile:spawn", zone: zoneId, fromPlayerId: 0,
            x: npcProj.pos.x, y: npcProj.pos.y,
            vx: npcProj.vel.x, vy: npcProj.vel.y,
            damage: npcProj.damage, color: npcProj.color, size: npcProj.size,
            crit: false, weaponKind: "laser" as const, homing: false,
          });
        }

        if (d > 800) {
          npc.state = "patrol";
          npc.targetEnemyId = null;
        }
      }

      npc.pos.x = clamp(npc.pos.x, -MAP_RADIUS, MAP_RADIUS);
      npc.pos.y = clamp(npc.pos.y, -MAP_RADIUS, MAP_RADIUS);
    }
  }

  // ── ASTEROIDS ────────────────────────────────────────────────────────

  private spawnInitialAsteroids(zoneId: string, zs: ZoneState): void {
    const zoneDef = ZONES[zoneId as ZoneId];
    if (!zoneDef) return;

    const belts = ASTEROID_BELTS[zoneId] ?? [];
    const beltCount = belts.length > 0 ? 120 : 0;
    const scatterCount = 30;

    // Spawn dense asteroid belt clusters
    for (let i = 0; i < beltCount; i++) {
      const belt = belts[i % belts.length];
      const pos = randomPointInBelt(belt);
      const size = randRange(12, 40);
      const ast: ServerAsteroid = {
        id: eid("ast"),
        pos,
        hp: size * 4,
        hpMax: size * 4,
        size,
        yields: pickAsteroidYield(zoneId),
        respawnAt: 0,
      };
      zs.asteroids.set(ast.id, ast);
    }

    // Scatter a few random asteroids outside belts
    for (let i = 0; i < scatterCount; i++) {
      const size = randRange(14, 36);
      const ast: ServerAsteroid = {
        id: eid("ast"),
        pos: {
          x: randRange(-MAP_RADIUS * 0.85, MAP_RADIUS * 0.85),
          y: randRange(-MAP_RADIUS * 0.85, MAP_RADIUS * 0.85),
        },
        hp: size * 4,
        hpMax: size * 4,
        size,
        yields: pickAsteroidYield(zoneId),
        respawnAt: 0,
      };
      zs.asteroids.set(ast.id, ast);
    }
  }

  private spawnInitialEnemies(zoneId: string, zs: ZoneState): void {
    const zoneDef = ZONES[zoneId as ZoneId];
    if (!zoneDef) return;
    const initialCount = 25 + zoneDef.enemyTier * 4;
    const tierMult = Math.pow(2, zoneDef.enemyTier - 1);
    for (let i = 0; i < initialCount; i++) {
      const enemyType = zoneDef.enemyTypes[Math.floor(Math.random() * zoneDef.enemyTypes.length)];
      const baseDef = ENEMY_DEFS[enemyType];
      if (!baseDef) continue;
      const fMods = FACTION_ENEMY_MODS[zoneDef.faction]?.[enemyType];
      const hullMul = (fMods?.hullMul ?? 1) * tierMult;
      const dmgMul = (fMods?.damageMul ?? 1) * tierMult;
      const spdMul = fMods?.speedMul ?? 1;
      const color = fMods?.color ?? baseDef.color;
      const spawnPos: Vec2 = {
        x: randRange(-MAP_RADIUS * 0.9, MAP_RADIUS * 0.9),
        y: randRange(-MAP_RADIUS * 0.9, MAP_RADIUS * 0.9),
      };
      const names = ENEMY_NAMES[enemyType];
      const name = names[Math.floor(Math.random() * names.length)];
      const enemy: ServerEnemy = {
        id: eid("e"), type: enemyType, behavior: baseDef.behavior, name,
        pos: { ...spawnPos }, vel: { x: 0, y: 0 },
        angle: Math.random() * Math.PI * 2,
        hull: Math.round(baseDef.hullMax * hullMul),
        hullMax: Math.round(baseDef.hullMax * hullMul),
        damage: Math.round(baseDef.damage * dmgMul),
        speed: Math.round(baseDef.speed * spdMul),
        exp: baseDef.exp, credits: baseDef.credits, honor: baseDef.honor,
        loot: pickLoot(enemyType),
        color, size: baseDef.size,
        isBoss: false, bossPhase: 0, phaseTimer: 0,
        fireTimer: randRange(1, 3), burstCd: 0, burstShots: 0,
        aggroTarget: null, retargetCd: 0, aggroRange: 400,
        spawnPos: { ...spawnPos }, stunUntil: 0, combo: new Map(),
      };
      zs.enemies.set(enemy.id, enemy);
    }
  }

  private tickAsteroidRespawn(zoneId: string, zs: ZoneState, dt: number, events: GameEvent[]): void {
    const now = Date.now();
    for (const ast of zs.asteroids.values()) {
      if (ast.respawnAt > 0 && now >= ast.respawnAt) {
        ast.respawnAt = 0;
        const size = randRange(14, 36);
        ast.size = size;
        ast.hp = size * 4;
        ast.hpMax = size * 4;
        const belts = ASTEROID_BELTS[zoneId] ?? [];
        if (belts.length > 0 && Math.random() < 0.8) {
          const belt = belts[Math.floor(Math.random() * belts.length)];
          ast.pos = randomPointInBelt(belt);
        } else {
          ast.pos = {
            x: randRange(-MAP_RADIUS * 0.85, MAP_RADIUS * 0.85),
            y: randRange(-MAP_RADIUS * 0.85, MAP_RADIUS * 0.85),
          };
        }
        ast.yields = pickAsteroidYield(zoneId);
        events.push({ type: "asteroid:respawn", zone: zoneId, asteroid: asteroidToClient(ast) });
      }
    }
  }

  // ── HELPERS ──────────────────────────────────────────────────────────

  private getZoneTierMult(zone: string): number {
    const z = ZONES[zone as ZoneId];
    if (!z) return 1;
    return 1 + (z.enemyTier - 1) * 0.5;
  }
}

// ── SERIALIZATION ────────────────────────────────────────────────────────

function enemyToClient(e: ServerEnemy): ClientEnemy {
  return {
    id: e.id, type: e.type, behavior: e.behavior, name: e.name,
    x: e.pos.x, y: e.pos.y, vx: e.vel.x, vy: e.vel.y,
    angle: e.angle, hull: e.hull, hullMax: e.hullMax,
    damage: e.damage, speed: e.speed,
    color: e.color, size: e.size,
    isBoss: e.isBoss, bossPhase: e.bossPhase,
  };
}

function asteroidToClient(a: ServerAsteroid): ClientAsteroid {
  return {
    id: a.id, x: a.pos.x, y: a.pos.y,
    hp: a.hp, hpMax: a.hpMax, size: a.size,
    yields: a.yields,
  };
}

function npcToClient(n: ServerNpc): ClientNpc {
  return {
    id: n.id, name: n.name,
    x: n.pos.x, y: n.pos.y, vx: n.vel.x, vy: n.vel.y,
    angle: n.angle, hull: n.hull, hullMax: n.hullMax,
    speed: n.speed, color: n.color, size: n.size,
    state: n.state,
  };
}
