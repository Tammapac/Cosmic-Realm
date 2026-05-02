// ── INSTANCE SYSTEM ──────────────────────────────────────────────────────
// Server-side instance manager for rifts, galaxy gates, boss arenas, etc.
// Each instance is an isolated zone with its own enemies, waves, and lifecycle.

import type { OnlinePlayer } from "../socket/state.js";
import type { Vec2, EnemyType } from "./data.js";
import { ENEMY_DEFS, ENEMY_NAMES } from "./data.js";

export type InstanceType = "rift" | "galaxy-gate" | "boss-arena";

export type InstanceEnemy = {
  id: string;
  type: EnemyType;
  behavior: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  hull: number;
  hullMax: number;
  damage: number;
  speed: number;
  fireCd: number;
  color: string;
  size: number;
  name: string;
  aggroTarget: number | null;
  aggroRange: number;
  stunUntil: number;
  loot: { resourceId: string; qty: number } | null;
  exp: number;
  credits: number;
  honor: number;
};

export type Instance = {
  id: string;
  type: InstanceType;
  dungeonId: string;
  playerIds: Set<number>;
  returnPositions: Map<number, { zone: string; x: number; y: number }>;
  enemies: Map<string, InstanceEnemy>;
  wave: number;
  totalWaves: number;
  enemiesPerWave: number;
  enemyTypes: EnemyType[];
  enemyHpMul: number;
  enemyDmgMul: number;
  waveSpawned: number;
  spawnedThisWave: boolean;
  spawnCd: number;
  startedAt: number;
  completed: boolean;
  color: string;
  name: string;
};

let _instanceSeq = 0;

export class InstanceManager {
  instances = new Map<string, Instance>();
  playerInstances = new Map<number, string>();

  createInstance(
    type: InstanceType,
    dungeonId: string,
    config: {
      waves: number;
      enemiesPerWave: number;
      enemyTypes: EnemyType[];
      enemyHpMul: number;
      enemyDmgMul: number;
      color: string;
      name: string;
    }
  ): Instance {
    const id = `inst-${Date.now().toString(36)}-${(++_instanceSeq).toString(36)}`;
    const inst: Instance = {
      id, type, dungeonId,
      playerIds: new Set(),
      returnPositions: new Map(),
      enemies: new Map(),
      wave: 1,
      totalWaves: config.waves,
      enemiesPerWave: config.enemiesPerWave,
      enemyTypes: config.enemyTypes,
      enemyHpMul: config.enemyHpMul,
      enemyDmgMul: config.enemyDmgMul,
      waveSpawned: 0,
      spawnedThisWave: false,
      spawnCd: 0.5,
      startedAt: Date.now(),
      completed: false,
      color: config.color,
      name: config.name,
    };
    this.instances.set(id, inst);
    return inst;
  }

  addPlayer(instanceId: string, playerId: number, returnZone: string, returnX: number, returnY: number): boolean {
    const inst = this.instances.get(instanceId);
    if (!inst) return false;
    inst.playerIds.add(playerId);
    inst.returnPositions.set(playerId, { zone: returnZone, x: returnX, y: returnY });
    this.playerInstances.set(playerId, instanceId);
    return true;
  }

  removePlayer(playerId: number): { zone: string; x: number; y: number } | null {
    const instanceId = this.playerInstances.get(playerId);
    if (!instanceId) return null;
    const inst = this.instances.get(instanceId);
    if (!inst) { this.playerInstances.delete(playerId); return null; }
    inst.playerIds.delete(playerId);
    const ret = inst.returnPositions.get(playerId) ?? null;
    inst.returnPositions.delete(playerId);
    this.playerInstances.delete(playerId);
    if (inst.playerIds.size === 0) {
      this.instances.delete(instanceId);
    }
    return ret;
  }

  getPlayerInstance(playerId: number): Instance | null {
    const instanceId = this.playerInstances.get(playerId);
    if (!instanceId) return null;
    return this.instances.get(instanceId) ?? null;
  }

  isInInstance(playerId: number): boolean {
    return this.playerInstances.has(playerId);
  }

  spawnEnemy(inst: Instance): void {
    const type = inst.enemyTypes[Math.floor(Math.random() * inst.enemyTypes.length)];
    const def = ENEMY_DEFS[type];
    const hullMax = def.hullMax * inst.enemyHpMul;
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 300;
    // Spawn relative to center (0,0) of instance
    const id = `ie-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const enemy: InstanceEnemy = {
      id, type,
      behavior: def.behavior,
      pos: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
      vel: { x: 0, y: 0 },
      angle: 0,
      hull: hullMax, hullMax,
      damage: def.damage * inst.enemyDmgMul,
      speed: def.speed,
      fireCd: Math.random() * 1.5,
      color: def.color, size: def.size,
      name: ENEMY_NAMES[type]?.[Math.floor(Math.random() * (ENEMY_NAMES[type]?.length ?? 1))] ?? type,
      aggroTarget: null,
      aggroRange: 500,
      stunUntil: 0,
      loot: def.loot,
      exp: Math.round(def.exp * 1.4),
      credits: Math.round(def.credits * 1.4),
      honor: Math.round(def.honor * 1.4),
    };
    inst.enemies.set(id, enemy);
    inst.waveSpawned++;
  }

  tickInstance(inst: Instance, players: OnlinePlayer[], dt: number): {
    events: { type: string; data: any }[];
    waveCleared: boolean;
    allCleared: boolean;
  } {
    const events: { type: string; data: any }[] = [];
    let waveCleared = false;
    let allCleared = false;

    if (inst.completed) return { events: [], waveCleared: false, allCleared: false };

    const aliveCount = Array.from(inst.enemies.values()).filter(e => e.hull > 0).length;

    // Wave spawning
    if (!inst.spawnedThisWave) {
      inst.spawnCd -= dt;
      if (inst.spawnCd <= 0) {
        if (inst.waveSpawned < inst.enemiesPerWave) {
          this.spawnEnemy(inst);
          inst.spawnCd = 0.3;
          events.push({ type: "enemy:spawn", data: this.serializeLastEnemy(inst) });
        } else {
          inst.spawnedThisWave = true;
        }
      }
    } else if (aliveCount === 0) {
      // Wave clear
      if (inst.wave >= inst.totalWaves) {
        inst.completed = true;
        allCleared = true;
        events.push({ type: "wave:clear", data: { wave: inst.wave, final: true } });
      } else {
        inst.wave++;
        inst.spawnedThisWave = false;
        inst.waveSpawned = 0;
        inst.spawnCd = 0.8;
        waveCleared = true;
        console.log("[INSTANCE] Wave " + (inst.wave - 1) + " cleared, starting wave " + inst.wave + "/" + inst.totalWaves);
        events.push({ type: "wave:clear", data: { wave: inst.wave - 1, final: false } });
        events.push({ type: "wave:start", data: { wave: inst.wave, totalWaves: inst.totalWaves } });
      }
    }

    // Enemy AI - simple chase + attack
    for (const e of inst.enemies.values()) {
      if (e.hull <= 0) continue;
      if (Date.now() < e.stunUntil) continue;

      // Find closest player
      let closest: OnlinePlayer | null = null;
      let closestDist = e.aggroRange;
      for (const p of players) {
        const dx = e.pos.x - p.posX;
        const dy = e.pos.y - p.posY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < closestDist) {
          closestDist = d;
          closest = p;
        }
      }

      if (closest) {
        const tPos = { x: closest.posX, y: closest.posY };
        const d = Math.sqrt((e.pos.x - tPos.x) ** 2 + (e.pos.y - tPos.y) ** 2);
        const fireRange = 300;
        const ang = Math.atan2(tPos.y - e.pos.y, tPos.x - e.pos.x);
        e.angle = ang;

        if (d > fireRange * 0.8) {
          e.vel.x = Math.cos(ang) * e.speed;
          e.vel.y = Math.sin(ang) * e.speed;
          e.pos.x += e.vel.x * dt;
          e.pos.y += e.vel.y * dt;
        } else {
          // Orbit
          const orbitDir = (e.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
          const orbitAng = ang + (Math.PI / 2) * orbitDir;
          const orbitSpeed = e.speed * 0.4;
          e.vel.x = Math.cos(orbitAng) * orbitSpeed;
          e.vel.y = Math.sin(orbitAng) * orbitSpeed;
          e.pos.x += e.vel.x * dt;
          e.pos.y += e.vel.y * dt;
        }

        // Fire
        e.fireCd -= dt;
        if (e.fireCd <= 0 && d < fireRange) {
          e.fireCd = 0.7 + Math.random() * 0.5;
          events.push({
            type: "enemy:fire",
            data: {
              enemyId: e.id,
              targetId: closest.playerId,
              damage: e.damage,
              x: e.pos.x, y: e.pos.y,
              angle: ang,
              color: e.color,
            },
          });
        }
      } else {
        e.vel.x *= 0.95;
        e.vel.y *= 0.95;
      }
    }

    // Remove dead enemies
    for (const [id, e] of inst.enemies) {
      if (e.hull <= 0) inst.enemies.delete(id);
    }

    return { events, waveCleared, allCleared };
  }

  serializeLastEnemy(inst: Instance): any {
    const entries = Array.from(inst.enemies.values());
    const e = entries[entries.length - 1];
    if (!e) return null;
    return {
      id: e.id, type: e.type, behavior: e.behavior,
      x: e.pos.x, y: e.pos.y, vx: e.vel.x, vy: e.vel.y,
      angle: e.angle, hp: e.hull, hpMax: e.hullMax,
      damage: e.damage, speed: e.speed,
      color: e.color, size: e.size, name: e.name,
      exp: e.exp, credits: e.credits, honor: e.honor,
      loot: e.loot,
    };
  }

  serializeEnemies(inst: Instance): any[] {
    const result: any[] = [];
    for (const e of inst.enemies.values()) {
      if (e.hull <= 0) continue;
      result.push({
        id: e.id, type: e.type, behavior: e.behavior,
        x: e.pos.x, y: e.pos.y, vx: e.vel.x, vy: e.vel.y,
        angle: e.angle, hp: e.hull, hpMax: e.hullMax,
        damage: e.damage, speed: e.speed,
        color: e.color, size: e.size, name: e.name,
        exp: e.exp, credits: e.credits, honor: e.honor,
        loot: e.loot,
      });
    }
    return result;
  }

  getInstanceState(instanceId: string): { wave: number; totalWaves: number; enemies: any[]; completed: boolean } | null {
    const inst = this.instances.get(instanceId);
    if (!inst) return null;
    return {
      wave: inst.wave,
      totalWaves: inst.totalWaves,
      enemies: this.serializeEnemies(inst),
      completed: inst.completed,
    };
  }
}
