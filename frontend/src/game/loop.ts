import {
  bump, pushChat, pushNotification, pushHonor, save, addCargo, pushFloater,
  pushEvent, bumpMission, state, travelToZone, completeDungeon,
  tickHotbarCooldowns,
  ensureAmmoInitialized, getAmmoWeaponIds, rocketAmmoMax,
  getActiveAmmoType, getActiveRocketAmmoType, getRocketAmmoCount, rocketMissileMax, tryCollectNearbyBoxes,
} from "./store";
import {
  CargoBox, DRONE_DEFS, Drone, DUNGEONS, ENEMY_DEFS, ENEMY_NAMES, EXP_FOR_LEVEL,
  Enemy, EnemyType, FACTION_ENEMY_MODS, FACTIONS, MODULE_DEFS, ModuleStats,
  MAP_RADIUS, NpcShip, PORTALS, ROCKET_AMMO_TYPE_DEFS, ROCKET_MISSILE_TYPE_DEFS, WeaponKind,
  SHIP_CLASSES, STATIONS, ZONES, ZoneId,
  rankFor,
RESOURCES, pickAsteroidYield, } from "./types";
import { sfx } from "./sound";
import { type ServerEnemy, type ServerAsteroid, type ServerNpc, type EnemyHitEvent, type EnemyDieEvent, type EnemyAttackEvent, type DeltaPayload, type SnapshotPayload, type WelcomePayload, type DeltaEntity, type LaserFireEvent, type RocketFireEvent, type ProjectileSpawnEvent } from "../net/socket";
import { MOVEMENT, NETCODE } from "../../../lib/game-constants";

// Returns the equipped weapon's color (used for laser projectiles)
function equippedWeaponColor(): string {
  const p = state.player;
  for (const id of p.equipped.weapon) {
    if (!id) continue;
    const item = p.inventory.find((m) => m.instanceId === id);
    if (item && MODULE_DEFS[item.defId]) return MODULE_DEFS[item.defId].color;
  }
  return "#4ee2ff";
}

function sumEquippedStats(): ModuleStats {
  const p = state.player;
  const acc: Required<ModuleStats> = {
    damage: 0, fireRate: 1, critChance: 0, shieldMax: 0, shieldRegen: 0,
    hullMax: 0, speed: 0, damageReduction: 0, shieldAbsorb: 0, cargoBonus: 0, lootBonus: 0, aoeRadius: 0,
    ammoCapacity: 0,
  };
  let weaponDmg = 0, weaponFireRate = 1, weaponCrit = 0, weaponAoe = 0, weaponCount = 0;
  for (const id of p.equipped.weapon) {
    if (!id) continue;
    const item = p.inventory.find((m) => m.instanceId === id);
    const def = item ? MODULE_DEFS[item.defId] : null;
    if (!def) continue;
    weaponCount++;
    weaponDmg += def.stats.damage ?? 0;
    weaponFireRate *= def.stats.fireRate ?? 1;
    weaponCrit += def.stats.critChance ?? 0;
    weaponAoe = Math.max(weaponAoe, def.stats.aoeRadius ?? 0);
    acc.miningBonus += def.stats.miningBonus ?? 0;
  }
  // Weapons stack damage; fire rate averaged so dual-equip doesn't 2× the rate
  acc.damage += weaponDmg;
  acc.fireRate = weaponCount > 0 ? Math.pow(weaponFireRate, 1 / weaponCount) : 1;
  acc.critChance += weaponCrit;
  acc.aoeRadius = Math.max(acc.aoeRadius, weaponAoe);

  for (const id of [...p.equipped.generator, ...p.equipped.module]) {
    if (!id) continue;
    const item = p.inventory.find((m) => m.instanceId === id);
    const def = item ? MODULE_DEFS[item.defId] : null;
    if (!def) continue;
    const s = def.stats;
    acc.damage          += s.damage ?? 0;
    if (s.fireRate)     acc.fireRate *= s.fireRate;
    acc.critChance      += s.critChance ?? 0;
    acc.shieldMax       += s.shieldMax ?? 0;
    acc.shieldRegen     += s.shieldRegen ?? 0;
    acc.hullMax         += s.hullMax ?? 0;
    acc.speed           += s.speed ?? 0;
    acc.damageReduction += s.damageReduction ?? 0;
    acc.shieldAbsorb    += s.shieldAbsorb ?? 0;
    acc.cargoBonus      += s.cargoBonus ?? 0;
    acc.lootBonus       += s.lootBonus ?? 0;
    acc.aoeRadius       = Math.max(acc.aoeRadius, s.aoeRadius ?? 0);
  }
  return acc;
}

let last = performance.now();
let raf = 0;
let enemySpawnTimer = 0;
let npcSpawnTimer = 0;
let saveTimer = 0;
let chatTimer = 6;
let aiUpdateTimer = 0;
let trailTimer = 0;

// Initialize particle density from settings
const _storedParticles = localStorage.getItem("sf-particles");
(window as any).__particleDensity = _storedParticles === "low" ? 0.3 : _storedParticles === "medium" ? 0.6 : 1;
const _otherTrailTimers: Record<string, number> = {};
let bossActive = false;
let queuedAttackTargetId: string | null = null;

const CHAT_LINES = [
  "anyone selling void crystals?",
  "wtb plasma cells, 35cr each",
  "raider stronghold spotted near veiled outpost",
  "lfg crimson dread x2",
  "nebula portal is HOT, watch yourselves",
  "just hit lvl 10 lets gooo",
  "this thruster mk3 hits different",
  "iron belt prices are steal rn",
  "anyone in my clan online?",
  "scout swarm @ alpha sector",
  "anyone got spare scrap plating",
  "azure port buying quantum chips premium",
  "boss event spawned, headed there now",
  "syndicate just took echo anchorage lol",
];

// ── NPC SHIPS ─────────────────────────────────────────────────────────────
const NPC_NAMES = [
  "Trader Vex", "Patrol Hawk", "Cargo Runner", "Scout Nova", "Enforcer",
  "Merchant Iris", "Hauler Kain", "Sentinel Ray", "Courier Ash", "Marshal",
  "Freighter Bo", "Ranger Kel", "Supply Runner", "Warden Pax", "Navigator",
];
const NPC_COLORS = ["#4ee2ff", "#5cff8a", "#ffd24a", "#ff8a4e", "#c8a0ff", "#7ad8ff"];

function spawnNpcShip(): void {
  const zone = state.player.zone;
  const zoneStations = STATIONS.filter((s) => s.zone === zone);
  if (zoneStations.length === 0) return;
  if (state.npcShips.filter((n) => n.zone === zone).length >= 5) return;
  const start = zoneStations[Math.floor(Math.random() * zoneStations.length)];
  const dest = zoneStations.length > 1
    ? zoneStations.filter((s) => s.id !== start.id)[Math.floor(Math.random() * (zoneStations.length - 1))]
    : start;
  const name = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
  const color = NPC_COLORS[Math.floor(Math.random() * NPC_COLORS.length)];
  state.npcShips.push({
    id: `npc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name, color, size: 12,
    pos: { x: start.pos.x + (Math.random() - 0.5) * 60, y: start.pos.y + (Math.random() - 0.5) * 60 },
    vel: { x: 0, y: 0 }, angle: 0,
    hull: 200, hullMax: 200, speed: 80 + Math.random() * 40,
    damage: 8 + Math.random() * 6, fireCd: 0,
    targetPos: { x: dest.pos.x, y: dest.pos.y },
    state: "patrol", targetEnemyId: null, zone,
  });
}

function updateNpcShips(dt: number): void {
  if (serverAuthoritative) return;
  for (let i = state.npcShips.length - 1; i >= 0; i--) {
    const npc = state.npcShips[i];
    if (npc.zone !== state.player.zone) { state.npcShips.splice(i, 1); continue; }
    npc.fireCd = Math.max(0, npc.fireCd - dt);

    // Check for nearby enemies to fight
    let nearestEnemy: Enemy | null = null;
    let nearestDist = 350;
    for (const e of state.enemies) {
      const d = Math.hypot(e.pos.x - npc.pos.x, e.pos.y - npc.pos.y);
      if (d < nearestDist) { nearestEnemy = e; nearestDist = d; }
    }

    if (nearestEnemy) {
      npc.state = "fight";
      npc.targetEnemyId = nearestEnemy.id;
      const dx = nearestEnemy.pos.x - npc.pos.x;
      const dy = nearestEnemy.pos.y - npc.pos.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      npc.angle = Math.atan2(dy, dx);
      if (dist > 120) {
        npc.vel.x = (dx / dist) * npc.speed;
        npc.vel.y = (dy / dist) * npc.speed;
      } else {
        npc.vel.x *= 0.9;
        npc.vel.y *= 0.9;
      }
      if (npc.fireCd <= 0 && dist < 300) {
        fireProjectile("player", npc.pos.x, npc.pos.y, npc.angle + (Math.random() - 0.5) * 0.1, npc.damage, npc.color, 2);
        npc.fireCd = 0.8 + Math.random() * 0.4;
      }
    } else {
      npc.state = "patrol";
      npc.targetEnemyId = null;
      const dx = npc.targetPos.x - npc.pos.x;
      const dy = npc.targetPos.y - npc.pos.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      npc.angle = Math.atan2(dy, dx);
      if (dist < 50) {
        const zoneStations = STATIONS.filter((s) => s.zone === npc.zone);
        const next = zoneStations[Math.floor(Math.random() * zoneStations.length)];
        npc.targetPos = { x: next.pos.x + (Math.random() - 0.5) * 80, y: next.pos.y + (Math.random() - 0.5) * 80 };
      }
      npc.vel.x = (dx / dist) * npc.speed * 0.6;
      npc.vel.y = (dy / dist) * npc.speed * 0.6;
    }

    npc.pos.x += npc.vel.x * dt;
    npc.pos.y += npc.vel.y * dt;

    // NPC engine trail
    const npcSpd = Math.sqrt(npc.vel.x * npc.vel.x + npc.vel.y * npc.vel.y);
    if (npcSpd > 15) {
      const nBack = npc.angle + Math.PI;
      if (Math.random() < 0.5) {
        emitTrail(npc.pos.x + Math.cos(nBack) * 7, npc.pos.y + Math.sin(nBack) * 7, npc.color, 0.5, 2.5);
      }
    }

    if (npc.hull <= 0) {
      emitDeath(npc.pos.x, npc.pos.y, npc.color, false, npc.size);
      state.npcShips.splice(i, 1);
    }
  }
}

// ── PLAYER STATS (with drone bonuses + skills + faction) ─────────────────
function shadeHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = factor > 0 ? factor : factor;
  const nr = factor > 0 ? Math.min(255, r + (255 - r) * f) : Math.max(0, r + r * f);
  const ng = factor > 0 ? Math.min(255, g + (255 - g) * f) : Math.max(0, g + g * f);
  const nb = factor > 0 ? Math.min(255, b + (255 - b) * f) : Math.max(0, b + b * f);
  return `#${Math.round(nr).toString(16).padStart(2, "0")}${Math.round(ng).toString(16).padStart(2, "0")}${Math.round(nb).toString(16).padStart(2, "0")}`;
}

export function effectiveStats(): {
  damage: number; speed: number; hullMax: number; shieldMax: number;
  fireRate: number; critChance: number; aoeRadius: number; damageReduction: number; shieldAbsorb: number; shieldRegen: number; lootBonus: number;
} {
  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];
  const sk = (id: string) => (p.skills[id] ?? 0);

  const mod = sumEquippedStats() as Required<ModuleStats>;

  // Log skills once every 5 seconds for debugging
  if (!((window as any).__lastSkillLog) || Date.now() - (window as any).__lastSkillLog > 5000) {
    (window as any).__lastSkillLog = Date.now();
    const allocated = Object.entries(p.skills).filter(([_, v]) => (v as number) > 0);
    if (allocated.length > 0) {
      console.log("[SKILLS]", JSON.stringify(p.skills), "pts:", p.skillPoints, "base spd:", cls.baseSpeed, "base dmg:", cls.baseDamage);
    }
  }

  // Base stats from ship class + equipment
  let damage = (cls.baseDamage + mod.damage) + sk("off-power") * 3;
  let hullMax = (cls.hullMax + (mod.hullMax ?? 0)) + sk("def-armor") * 20;
  let shieldMax = (cls.shieldMax + (mod.shieldMax ?? 0)) + sk("def-shield") * 15 + sk("def-barrier") * 25;
  let speed = (cls.baseSpeed + (mod.speed ?? 0)) + sk("ut-thrust") * 5;
  let shieldRegen = 5 + (mod.shieldRegen ?? 0);
  let damageReduction = (sk("def-bulwark") * 0.03) + (mod.damageReduction ?? 0);
  let shieldAbsorb = Math.min(0.5, mod.shieldAbsorb ?? 0);
  let aoeRadius = (sk("off-pierce") * 6) + (mod.aoeRadius ?? 0);
  let critChance = 0.02 + sk("off-crit") * 0.02 + (mod.critChance ?? 0);
  let fireRate = (mod.fireRate ?? 1) + sk("off-rapid") * 0.05;
  let lootBonus = (mod.lootBonus ?? 0) + sk("ut-scan") * 0.04;

  // Snipe skill: +4% damage & +2% crit per rank
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

  // Nano-repair: +10% shield regen & +5% hull per rank
  shieldRegen += sk("def-nano") * 2;
  hullMax += sk("def-nano") * 15;

  // Volley: +15% fire rate per rank
  fireRate += sk("off-volley") * 0.06;

  // Shield regen skill
  shieldRegen += sk("def-regen") * 2;

  // Drone bonuses
  for (const d of p.drones) {
    const def = DRONE_DEFS[d.kind];
    damage += def.damageBonus;
    hullMax += def.hullBonus;
    shieldMax += def.shieldBonus;
  }

  // Faction bonuses
  const faction = p.faction ? FACTIONS[p.faction as keyof typeof FACTIONS] : undefined;
  if (faction) {
    if (faction.bonus.damage) damage *= (1 + faction.bonus.damage);
    if (faction.bonus.speed) speed *= (1 + faction.bonus.speed);
    if (faction.bonus.shieldRegen) shieldRegen *= faction.bonus.shieldRegen;
    if (faction.bonus.lootBonus) lootBonus += faction.bonus.lootBonus;
  }

  damageReduction = Math.min(0.8, damageReduction);
  shieldAbsorb = 0.5 + shieldAbsorb;

  return { damage, speed, hullMax, shieldMax, fireRate, critChance, aoeRadius, damageReduction, shieldAbsorb, shieldRegen, lootBonus, miningBonus: mod.miningBonus ?? 0 };
}

export function queueAttackTarget(enemyId: string): void {
  // Gate: only accept when weapon is off cooldown.
  // Prevents double-clicks, keyboard repeat, or any other repeated triggers
  // from causing more than one shot per cooldown window.
  if (playerFireCd.value > 0 && rocketFireCd.value > 0) return;
  queuedAttackTargetId = enemyId;
}

// ── SPAWN ──────────────────────────────────────────────────────────────────
function spawnEnemy(): void {
  const z = ZONES[state.player.zone];
  if (state.enemies.filter((e) => !e.isBoss).length >= 18 + z.enemyTier * 4) return;
  const type: EnemyType = z.enemyTypes[Math.floor(Math.random() * z.enemyTypes.length)];
  const def = ENEMY_DEFS[type];
  const angle = Math.random() * Math.PI * 2;
  // Spawn across the whole map, not just near player
  const nearPlayer = Math.random() < 0.4;
  let px: number, py: number;
  if (nearPlayer) {
    const dist = 500 + Math.random() * 500;
    px = state.player.pos.x + Math.cos(angle) * dist;
    py = state.player.pos.y + Math.sin(angle) * dist;
  } else {
    const mapR = MAP_RADIUS * 0.85;
    px = (Math.random() - 0.5) * 2 * mapR;
    py = (Math.random() - 0.5) * 2 * mapR;
  }
  const tierMult = Math.pow(2, z.enemyTier - 1);
  const namePool = ENEMY_NAMES[type] ?? [type];
  const eName = namePool[Math.floor(Math.random() * namePool.length)];
  // Apply faction-specific stat/color overrides
  const fMod = FACTION_ENEMY_MODS[z.faction]?.[type];
  const hullFac  = fMod?.hullMul  ?? 1;
  const dmgFac   = fMod?.damageMul ?? 1;
  const spdFac   = fMod?.speedMul  ?? 1;
  const color    = fMod?.color     ?? def.color;
  state.enemies.push({
    id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    name: eName,
    behavior: def.behavior,
    pos: { x: px, y: py },
    vel: { x: 0, y: 0 },
    angle: 0,
    hull: def.hullMax * tierMult * hullFac,
    hullMax: def.hullMax * tierMult * hullFac,
    damage: def.damage * tierMult * dmgFac,
    speed: def.speed * spdFac,
    fireCd: Math.random() * 2,
    exp: Math.round(def.exp * tierMult),
    credits: Math.round(def.credits * tierMult),
    honor: Math.round(def.honor * tierMult),
    color,
    size: def.size,
    loot: def.loot,
    burstCd: 0,
    burstShots: 0,
    spawnPos: { x: px, y: py },
    aggro: false,
  });
}

// ── DUNGEON ───────────────────────────────────────────────────────────────
let dungeonSpawnCd = 0;
let autoSaveTimer = 900;

function spawnDungeonEnemy(type: EnemyType, hpMul: number, dmgMul: number): void {
  const def = ENEMY_DEFS[type];
  const angle = Math.random() * Math.PI * 2;
  const dist = 200 + Math.random() * 250;
  const px = state.player.pos.x + Math.cos(angle) * dist;
  const py = state.player.pos.y + Math.sin(angle) * dist;
  const hullMax = def.hullMax * hpMul;
  state.enemies.push({
    id: `dg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type, behavior: def.behavior,
    pos: { x: px, y: py }, vel: { x: 0, y: 0 }, angle: 0,
    name: ENEMY_NAMES[type]?.[Math.floor(Math.random() * (ENEMY_NAMES[type]?.length ?? 1))],
    hull: hullMax, hullMax,
    damage: def.damage * dmgMul,
    speed: def.speed,
    fireCd: Math.random() * 1.5,
    exp: Math.round(def.exp * 1.4),
    credits: Math.round(def.credits * 1.4),
    honor: Math.round(def.honor * 1.4),
    color: def.color, size: def.size,
    loot: def.loot, burstCd: 0, burstShots: 0,
    spawnPos: { x: px, y: py },
    aggro: true,
  });
}

let _waveSpawned = 0;

function updateDungeon(dt: number): void {
  const run = state.dungeon;
  if (!run) { _waveSpawned = 0; return; }
  const def = DUNGEONS[run.id];
  const aliveCount = state.enemies.filter(e => e.hull > 0).length;
  // Spawn the wave's enemies (staggered)
  if (!run.spawnedThisWave) {
    dungeonSpawnCd -= dt;
    if (dungeonSpawnCd <= 0) {
      const target = def.enemiesPerWave;
      if (_waveSpawned < target) {
        const t: EnemyType = def.enemyTypes[Math.floor(Math.random() * def.enemyTypes.length)];
        spawnDungeonEnemy(t, def.enemyHpMul, def.enemyDmgMul);
        _waveSpawned++;
        dungeonSpawnCd = 0.45;
      } else {
        run.spawnedThisWave = true;
      }
    }
  } else if (aliveCount === 0) {
    // Wave clear
    if (run.wave >= run.totalWaves) {
      pushEvent({ title: "✦ ALL WAVES CLEAR", body: `${def.name} subdued.`, ttl: 4, kind: "global", color: def.color });
      completeDungeon();
      return;
    }
    run.wave++;
    run.spawnedThisWave = false;
    _waveSpawned = 0;
    run.enemiesLeft = def.enemiesPerWave;
    dungeonSpawnCd = 1.2;
    pushEvent({ title: `▼ WAVE ${run.wave} / ${run.totalWaves}`, body: `Hostiles re-engaging.`, ttl: 3.5, kind: "info", color: def.color });
    sfx.bossWarn();
  }
}

function spawnBoss(): void {
  const z = ZONES[state.player.zone];
  const tierMult = Math.pow(2, z.enemyTier - 1);
  const angle = Math.random() * Math.PI * 2;
  const dist = 600;
  const px = state.player.pos.x + Math.cos(angle) * dist;
  const py = state.player.pos.y + Math.sin(angle) * dist;
  const def = ENEMY_DEFS.dread;
  const hullMax = def.hullMax * 4 * tierMult;
  state.enemies.push({
    id: `boss-${Date.now()}`,
    type: "dread",
    behavior: "tank",
    pos: { x: px, y: py },
    vel: { x: 0, y: 0 },
    angle: 0,
    hull: hullMax,
    hullMax,
    damage: def.damage * 1.5 * tierMult,
    speed: 38,
    fireCd: 1,
    exp: Math.round(def.exp * 5 * tierMult),
    credits: Math.round(def.credits * 5 * tierMult),
    honor: Math.round(def.honor * 4 * tierMult),
    color: "#ff8a4e",
    size: def.size * 1.6,
    loot: { resourceId: "dread", qty: 4 },
    isBoss: true,
    bossPhase: 0,
    burstCd: 0,
    burstShots: 0,
    spawnPos: { x: px, y: py },
    aggro: true,
  });
  bossActive = true;
  pushEvent({
    title: "BOSS WARSHIP ARRIVES",
    body: `A heavy dreadnought has materialized in ${z.name}. Engage with caution.`,
    ttl: 10, kind: "boss", zone: state.player.zone, color: "#ff8a4e",
  });
  pushChat("system", "SYSTEM", `A boss dreadnought has spawned in ${z.name}.`);
  pushNotification("BOSS SPAWNED — Engage!", "bad");
  sfx.bossWarn();
  state.cameraShake = Math.max(state.cameraShake, 0.6);
}

// ── PARTICLES & FX ────────────────────────────────────────────────────────
function emitSpark(x: number, y: number, color: string, count = 6, speed = 90, size = 2): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.4 + Math.random() * 0.6) * speed;
    state.particles.push({
      id: `p-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x, y },
      vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
      ttl: 0.3 + Math.random() * 0.4,
      maxTtl: 0.6,
      color, size, kind: "spark",
    });
  }
}

function emitRing(x: number, y: number, color: string, radius = 20): void {
  state.particles.push({
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: 0.45, maxTtl: 0.45,
    color, size: radius, kind: "ring",
  });
}

function emitTrail(x: number, y: number, color: string, alpha?: number, size?: number): void {
  state.particles.push({
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: 2.0, maxTtl: 2.0,
    color, size: size ?? 5, kind: "trail",
    ...(alpha !== undefined ? { alpha } : {}),
  });
}

function emitDeath(_x: number, _y: number, _color: string, _big = false, _enemySize = 12): void {
  return; // PixiJS effect manager handles all explosions now
  const sizeMul = Math.max(1, enemySize / 12);

  // Central white flash bloom — scaled by enemy size
  state.particles.push({
    id: `fl-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: B ? 0.6 : 0.35 + sizeMul * 0.05, maxTtl: B ? 0.6 : 0.35 + sizeMul * 0.05,
    color: "#ffffff",
    size: B ? 300 : Math.round(160 * sizeMul), kind: "flash",
  });
  state.particles.push({
    id: `fl2-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: B ? 0.5 : 0.32, maxTtl: B ? 0.5 : 0.32,
    color, size: B ? 220 : 130, kind: "flash",
  });
  state.particles.push({
    id: `fl3-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: B ? 0.35 : 0.24, maxTtl: B ? 0.35 : 0.24,
    color: "#ffd24a", size: B ? 180 : 100, kind: "flash",
  });
  // Delayed secondary flash
  setTimeout(() => {
    state.particles.push({
      id: `fl4-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x, y }, vel: { x: 0, y: 0 },
      ttl: 0.2, maxTtl: 0.2,
      color: "#ff8c00", size: B ? 150 : 80, kind: "flash",
    });
  }, 120);

  // Expanding shockwave rings — huge and staggered
  const ringR = B ? 220 : 130;
  for (let i = 0; i < (B ? 6 : 4); i++) {
    const ringColor = i === 0 ? "#ffffff" : i === 1 ? color : i === 2 ? "#ffd24a" : "#ff8c00";
    const rSize = ringR * (1 - i * 0.12);
    setTimeout(() => emitRing(x, y, ringColor, rSize), i * 70);
  }

  // Fireballs — large fire blobs that fly outward
  const fbColors = ["#ff8c00", "#ff4500", "#ffd700", "#ff6600", "#ff2244", "#ff0066", "#ffaa00", "#ff7700"];
  const fbCount = B ? 28 : 16;
  for (let i = 0; i < fbCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = (0.3 + Math.random() * 0.7) * (B ? 160 : 110);
    state.particles.push({
      id: `fb-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20 },
      vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
      ttl: 0.7 + Math.random() * 0.6, maxTtl: 1.3,
      color: fbColors[Math.floor(Math.random() * fbColors.length)],
      size: B ? (100 + Math.random() * 80) : (55 + Math.random() * 40),
      kind: "fireball",
    });
  }

  // Smoke puffs — dark billowing clouds
  const smokeCount = B ? 20 : 10;
  for (let i = 0; i < smokeCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = (0.1 + Math.random() * 0.4) * (B ? 60 : 40);
    state.particles.push({
      id: `sm-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14 },
      vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
      ttl: 0.9 + Math.random() * 0.7, maxTtl: 1.6,
      color: i % 3 === 0 ? "#111" : i % 3 === 1 ? "#333" : "#555",
      size: B ? (50 + Math.random() * 45) : (28 + Math.random() * 22),
      kind: "smoke",
    });
  }

  // Large burning hull fragments — big chunks flying far in all directions, scaled by ship size
  const debrisCount = B ? 24 : Math.round(12 * sizeMul);
  const debrisColors = [color, "#ff8a4e", "#ffd24a", "#ffccaa", "#cccccc", "#ff5c6c"];
  for (let i = 0; i < debrisCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = (0.4 + Math.random() * 0.6) * (B ? 300 : 180 * sizeMul);
    state.particles.push({
      id: `db-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10 },
      vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
      ttl: 1.0 + Math.random() * 1.2, maxTtl: 2.2,
      color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
      size: B ? (12 + Math.random() * 18) : (6 + Math.random() * 10) * sizeMul,
      rot: Math.random() * Math.PI * 2,
      rotVel: (Math.random() - 0.5) * 18,
      kind: "debris",
    });
  }
  // Burning wreckage pieces that linger and fade (bigger ships = more wreckage)
  if (sizeMul >= 1.3 || B) {
    const wreckCount = B ? 6 : Math.round(3 * sizeMul);
    for (let wi = 0; wi < wreckCount; wi++) {
      const wa = Math.random() * Math.PI * 2;
      const ws = 40 + Math.random() * 80;
      state.particles.push({
        id: `wrk-${Math.random().toString(36).slice(2, 8)}`,
        pos: { x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20 },
        vel: { x: Math.cos(wa) * ws, y: Math.sin(wa) * ws },
        ttl: 2.5 + Math.random() * 2.0, maxTtl: 4.5,
        color: Math.random() > 0.5 ? color : "#555",
        size: B ? (18 + Math.random() * 14) : (10 + Math.random() * 8) * sizeMul,
        rot: Math.random() * Math.PI * 2,
        rotVel: (Math.random() - 0.5) * 6,
        kind: "debris",
      });
    }
  }

  // Sparks — five tiers, fast and bright, flying far from explosion
  emitSpark(x, y, "#ffffff", B ? 60 : 30, B ? 500 : 380, B ? 5 : 3);
  emitSpark(x, y, color, B ? 80 : 40, B ? 360 : 280, B ? 5 : 4);
  emitSpark(x, y, "#ffd24a", B ? 60 : 24, B ? 280 : 200, B ? 4 : 3);
  emitSpark(x, y, "#ff8c00", B ? 40 : 18, B ? 320 : 220, B ? 4 : 3);
  emitSpark(x, y, "#ff5cf0", B ? 24 : 10, B ? 240 : 160, B ? 3 : 2);

  // Burning embers — big glowing fire chunks flying far in all directions
  const emberCount = B ? 40 : 22;
  const emberColors = ["#ff8c00", "#ff4500", "#ffd700", "#ffaa00", "#ff6600", "#ff2244", color];
  for (let i = 0; i < emberCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = (180 + Math.random() * 350) * (B ? 1.5 : 1);
    state.particles.push({
      id: `em-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14 },
      vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
      ttl: 0.8 + Math.random() * 1.0, maxTtl: 1.8,
      color: emberColors[Math.floor(Math.random() * emberColors.length)],
      size: B ? (5 + Math.random() * 8) : (4 + Math.random() * 5), kind: "ember",
    });
  }
}

// ── PROJECTILES ───────────────────────────────────────────────────────────
function fireProjectile(
  from: "player" | "enemy" | "drone",
  x: number, y: number, angle: number, damage: number, color: string, size = 3,
  opts?: { crit?: boolean; aoeRadius?: number; speedMul?: number; homing?: boolean; empStun?: number; armorPiercing?: boolean; weaponKind?: WeaponKind; renderOnly?: boolean },
): void {
  const speedBase = from === "player" ? 230 : from === "drone" ? 340 : 200;
  const speed = speedBase * (opts?.speedMul ?? 1);
  state.projectiles.push({
    id: `pr-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    damage,
    ttl: opts?.homing ? 4.0 : 1.6,
    fromPlayer: from !== "enemy",
    color,
    size: opts?.crit ? size + 2 : size,
    crit: opts?.crit,
    aoeRadius: opts?.aoeRadius,
    homing: opts?.homing,
    empStun: opts?.empStun,
    armorPiercing: opts?.armorPiercing,
    weaponKind: opts?.weaponKind,
    renderOnly: opts?.renderOnly,
  });
  bump(); // Trigger React re-render to show projectile
}

export function hasRocketWeapon(): boolean {
  const p = state.player;
  for (const id of p.equipped.weapon) {
    if (!id) continue;
    const item = p.inventory.find((m) => m.instanceId === id);
    if (item && MODULE_DEFS[item.defId]?.weaponKind === "rocket") return true;
  }
  return false;
}

// ── XP / LEVEL ────────────────────────────────────────────────────────────
function tryLevelUp(): void {
  const p = state.player;
  while (p.exp >= EXP_FOR_LEVEL(p.level)) {
    p.exp -= EXP_FOR_LEVEL(p.level);
    p.level++;
    p.skillPoints += 1;
    pushNotification(`LEVEL UP! Now level ${p.level} (+1 skill pt)`, "good");
    pushChat("system", "SYSTEM", `You reached level ${p.level}.`);
    bumpMission("level-up", 1);
    const stats = effectiveStats();
    p.hull = stats.hullMax;
    p.shield = stats.shieldMax;
    state.levelUpFlash = 1.6;
    state.cameraShake = Math.max(state.cameraShake, 0.5);
    sfx.levelUp();
    // burst ring at player
    for (let i = 0; i < 3; i++) {
      setTimeout(() => emitRing(p.pos.x, p.pos.y, "#ffd24a"), i * 100);
    }
  }
}

const MILESTONE_KEYS = ["totalKills", "totalMined", "totalCreditsEarned", "totalWarps", "bossKills"] as const;
const MILESTONE_TIER_THRESHOLDS: Record<typeof MILESTONE_KEYS[number], number[]> = {
  totalKills: [10, 50, 200, 1000, 5000],
  totalMined: [10, 100, 500, 2500, 10000],
  totalCreditsEarned: [1000, 10000, 100000, 1000000, 10000000],
  totalWarps: [5, 25, 100, 500, 2000],
  bossKills: [1, 5, 20, 50, 200],
};
const MILESTONE_REWARDS: Record<typeof MILESTONE_KEYS[number], number> = {
  totalKills: 500, totalMined: 400, totalCreditsEarned: 600, totalWarps: 300, bossKills: 1500,
};

function checkMilestoneTier(kind: typeof MILESTONE_KEYS[number], previous: number, current: number): void {
  const tiers = MILESTONE_TIER_THRESHOLDS[kind];
  for (const t of tiers) {
    if (previous < t && current >= t) {
      const reward = MILESTONE_REWARDS[kind] * (tiers.indexOf(t) + 1);
      state.player.credits += reward;
      state.player.skillPoints += 1;
      pushNotification(`MILESTONE: ${kind} ${t.toLocaleString()} (+${reward}cr +1pt)`, "good");
      pushChat("system", "SYSTEM", `Milestone reached: ${kind} ${t.toLocaleString()}.`);
    }
  }
}

function applyKill(e: Enemy, killerCrit: boolean): void {
  const stats = effectiveStats();
  emitDeath(e.pos.x, e.pos.y, e.color, !!e.isBoss);
  if (e.isBoss) {
    sfx.bossKill();
    // Boss always shakes hard (~0.6 s at decay 1.6/s), regardless of distance
    state.cameraShake = Math.max(state.cameraShake, 1);
  } else {
    sfx.explosion(e.size > 16);
    const dist = Math.hypot(e.pos.x - state.player.pos.x, e.pos.y - state.player.pos.y);
    const proximity = Math.max(0, 1 - dist / 800);
    const baseShake = e.size > 16 ? 0.75 : 0.5;
    state.cameraShake = Math.max(state.cameraShake, baseShake * proximity);
  }

  const expGain = e.exp;
  const credGain = e.credits + (state.player.skills["ut-salvage"] ?? 0) * Math.max(1, Math.floor(e.honor));
  const honorGain = e.honor;

  // Grant exp, credits, honor directly on kill
  const p2 = state.player;
  p2.exp += expGain;
  p2.credits += credGain;
  p2.honor += honorGain;
  while (p2.exp >= EXP_FOR_LEVEL(p2.level)) {
    p2.exp -= EXP_FOR_LEVEL(p2.level);
    p2.level++;
    p2.skillPoints += 1;
    state.levelUpFlash = 1.6;
  }
  pushFloater({ text: `+${expGain} XP`, color: "#ff5cf0", x: state.player.pos.x, y: state.player.pos.y - 30, scale: 1.3, bold: true, ttl: 2.0 });
  pushFloater({ text: `+${credGain} CR`, color: "#ffd24a", x: state.player.pos.x, y: state.player.pos.y - 30, scale: 1.3, bold: true, ttl: 2.0 });
  if (honorGain > 0) pushFloater({ text: `+${honorGain} ✪`, color: "#c8a0ff", x: state.player.pos.x, y: state.player.pos.y - 30, scale: 1.3, bold: true, ttl: 2.0 });

  // Loot box only contains resources (no exp/credits/honor)
  const hasSalvage = state.player.drones.some((d) => d.kind === "salvage");
  const lootQty = e.loot ? e.loot.qty + (hasSalvage ? 1 : 0) + stats.lootBonus : 0;

  if (lootQty > 0) {
    const box: CargoBox = {
      id: `cb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x: e.pos.x + (Math.random() - 0.5) * 30, y: e.pos.y + (Math.random() - 0.5) * 30 },
      resourceId: e.loot?.resourceId ?? "scrap",
      qty: lootQty,
      credits: 0,
      exp: 0,
      honor: 0,
      ttl: 30,
      color: e.isBoss ? "#ffd24a" : "#5cff8a",
    };
    state.cargoBoxes.push(box);
    pushFloater({ text: "LOOT ▼", color: box.color, x: e.pos.x, y: e.pos.y - 12, scale: 1, bold: true });
  }

  // Ammo drop (x1 basic ammo)
  const zDef = ZONES[state.player.zone];
  const zTier = zDef ? zDef.enemyTier : 1;
  const ammoDrop = Math.ceil((1 + Math.floor(Math.random() * 3)) * (1 + (zTier - 1) * 0.4));
  p2.ammo.x1 = (p2.ammo.x1 ?? 0) + ammoDrop;
  pushFloater({ text: `+${ammoDrop} x1 ammo`, color: "#aabbcc", x: e.pos.x + 30, y: e.pos.y - 20, scale: 0.7, bold: false });

  // Quest progress
  for (const q of state.player.activeQuests) {
    if (!q.completed && q.killType === e.type && q.zone === state.player.zone) {
      q.progress++;
      if (q.progress >= q.killCount) {
        q.completed = true;
        pushNotification(`Quest complete: ${q.title}`, "good");
        pushChat("system", "SYSTEM", `Quest "${q.title}" ready to turn in.`);
      }
    }
  }

  // Milestones
  const m = state.player.milestones;
  const prevKills = m.totalKills;
  m.totalKills++;
  checkMilestoneTier("totalKills", prevKills, m.totalKills);
  if (e.isBoss) {
    const prevBoss = m.bossKills;
    m.bossKills++;
    checkMilestoneTier("bossKills", prevBoss, m.bossKills);
    bossActive = false;
    pushEvent({
      title: "BOSS DEFEATED",
      body: `Excellent shooting, Captain. Premium loot dropped.`,
      ttl: 6, kind: "boss", color: "#5cff8a",
    });
  }

  // Mission progress
  bumpMission("kill-any", 1);
  bumpMission("kill-zone", 1, state.player.zone);
  bumpMission("earn-credits", credGain);

  if (killerCrit) {
    pushFloater({ text: "CRIT!", color: "#ffee00", x: e.pos.x, y: e.pos.y - 28, scale: 1.6, bold: true, ttl: 1.0 });
    emitSpark(e.pos.x, e.pos.y, "#ffee00", 8, 140, 3);
    emitSpark(e.pos.x, e.pos.y, "#ffffff", 4, 100, 2);
  }

  tryLevelUp();
}

function damagePlayer(amount: number): void {
  const p = state.player;
  const stats = effectiveStats();
  state.lastHitTick = state.tick;
  amount *= Math.max(0.2, 1 - stats.damageReduction);

  // Shield absorbs a percentage of damage (base 50%, generators increase up to 80%)
  const absorbPct = Math.min(0.95, 0.5 + stats.shieldAbsorb);
  if (p.shield > 0) {
    const shieldDmg = Math.min(p.shield, amount * absorbPct);
    p.shield -= shieldDmg;
    const hullBleed = amount - shieldDmg;
    amount = hullBleed;
    emitRing(p.pos.x, p.pos.y, "#4ee2ff");
    sfx.shieldHit();
  }
  if (amount > 0) {
    p.hull -= amount;
    emitSpark(p.pos.x, p.pos.y, "#ff5c6c", 6, 70, 2);
    sfx.hit();
    state.cameraShake = Math.max(state.cameraShake, 0.15);
    if (p.hull <= 0 && state.playerRespawnTimer <= 0) {
      const deathX = p.pos.x;
      const deathY = p.pos.y;
      const shipColor = SHIP_CLASSES[p.shipClass].color;
      emitDeath(deathX, deathY, shipColor, true);
      state.playerDeathFlash = 0.6;
      state.playerRespawnTimer = 0.5;
      p.hull = 1;
      p.vel = { x: 0, y: 0 };
      state.player.milestones.totalDeaths++;
      sfx.thrusterStop();
      sfx.explosion(true);
      state.cameraShake = 1;
    }
  }
}

function damageDrone(d: { id: string; hp: number; hpMax: number }, amount: number): boolean {
  return false; // Drones no longer die from damage
  d.hp -= amount;
  if (d.hp <= 0) return true;
  return false;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── MAIN LOOP ─────────────────────────────────────────────────────────────
export function startLoop(): void {
  if (raf) return;
  ensureAmmoInitialized();
  last = performance.now();
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!state.paused && !state.dockedAt) tickWorld(dt);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

export function stopLoop(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

const playerFireCd = { value: 0 };
const rocketFireCd = { value: 0 };

function tickWorld(dt: number): void {
  state.tick += dt;
  if (state.levelUpFlash > 0) state.levelUpFlash = Math.max(0, state.levelUpFlash - dt);
  if (state.playerDeathFlash > 0) state.playerDeathFlash = Math.max(0, state.playerDeathFlash - dt);
  if (state.cameraShake > 0) state.cameraShake = Math.max(0, state.cameraShake - dt * 1.6);
  if (state.combatLaserFlash) {
    state.combatLaserFlash.ttl -= dt;
    if (state.combatLaserFlash.ttl <= 0) state.combatLaserFlash = null;
  }

  if (serverAuthoritative) applyServerSmoothing(dt);

  // ── Respawn timer: fire actual respawn logic after explosion delay ────
  if (state.playerRespawnTimer > 0) {
    state.playerRespawnTimer -= dt;
    if (state.playerRespawnTimer <= 0) {
      state.playerRespawnTimer = 0;
      const p2 = state.player;
      const stats2 = effectiveStats();
      p2.hull = stats2.hullMax;
      p2.shield = stats2.shieldMax;
      const lostCr = Math.floor(p2.credits * 0.1);
      p2.credits = Math.max(0, p2.credits - lostCr);
      for (const dr of p2.drones) { dr.hp = Math.max(1, Math.round(dr.hp * 0.99)); }
      // Respawn at main station in current zone
      const homeStation = STATIONS.find((st) => st.zone === p2.zone && st.kind === "hub")
        || STATIONS.find((st) => st.zone === p2.zone)
        || STATIONS[0];
      p2.pos = { x: homeStation.pos.x, y: homeStation.pos.y + 80 };
      p2.vel = { x: 0, y: 0 };
      state.cameraTarget = { ...p2.pos };
      state.enemies = [];
      state.isAttacking = false;
      state.isLaserFiring = false;
      state.isRocketFiring = false;
      state.attackTargetId = null;
      state.selectedWorldTarget = null;
      bossActive = false;
      pushNotification(`Ship destroyed. -${lostCr}cr. Respawned at ${homeStation.name}.`, "bad");
      pushChat("system", "SYSTEM", `Your ship was destroyed. -${lostCr} credits. Respawned at ${homeStation.name}.`);
    }
    // Keep VFX alive during the death window so explosion particles animate
    for (const pa of state.particles) {
      pa.pos.x += pa.vel.x * dt; pa.pos.y += pa.vel.y * dt;
      pa.vel.x *= 0.95; pa.vel.y *= 0.95;
      if (pa.rotVel !== undefined && pa.rot !== undefined) pa.rot += pa.rotVel * dt;
      pa.ttl -= dt;
    }
    state.particles = state.particles.filter((pa) => pa.ttl > 0);
    for (const f of state.floaters) { if (f.trackPlayer) { f.pos.x = state.player.pos.x; f.pos.y = state.player.pos.y - 40 + f.vy * (f.maxTtl - f.ttl); } else { f.pos.y += f.vy * dt; } f.vy *= 0.96; f.ttl -= dt; }
    state.floaters = state.floaters.filter((f) => f.ttl > 0);
    for (const ev of state.events) ev.ttl -= dt;
    state.events = state.events.filter((ev) => ev.ttl > 0);
    return; // skip combat/movement/AI while awaiting respawn
  }
  tickHotbarCooldowns(dt);
  const p = state.player;
  const stats = effectiveStats();
  const outOfCombatFor = state.tick - state.lastHitTick;

  // ── Consumable: Repair Bot HoT (paused while in combat)
  if (state.repairBotUntil > 0 && state.tick < state.repairBotUntil && outOfCombatFor >= 5) {
    p.hull = Math.min(p.hull + (40 / 8) * dt, stats.hullMax);
  }

  // ── Consumable: Pending Rocket Salvo
  if (state.pendingRocketSalvo > 0) {
    const nearest = state.enemies.reduce<{ dist: number; e: Enemy | null }>(
      (acc, e) => { const dx = e.pos.x - p.pos.x, dy = e.pos.y - p.pos.y; const d = Math.sqrt(dx*dx+dy*dy); return d < acc.dist ? { dist: d, e } : acc; },
      { dist: 2000, e: null }
    );
    const targetAng = nearest.e ? Math.atan2(nearest.e.pos.y - p.pos.y, nearest.e.pos.x - p.pos.x) : p.angle;
    const spread = (state.pendingRocketSalvo - 1) * 0.22;
    const startAng = targetAng - spread;
    fireProjectile("player", p.pos.x, p.pos.y, startAng + (3 - state.pendingRocketSalvo) * 0.22, 35, "#ff8a4e", 4, { homing: true, speedMul: 0.35 });
    state.pendingRocketSalvo--;
  }

  // ── Consumable: Drone Pod — spawn temp drone
  if (state.pendingDronePod) {
    state.pendingDronePod = false;
    const tempDrone: import("./types").Drone = {
      id: `temp-drone-${Date.now()}`,
      kind: "combat-i",
      mode: "forward",
      hp: 200, hpMax: 200,
      orbitPhase: Math.random() * Math.PI * 2,
      fireCd: 0,
    };
    p.drones.push(tempDrone);
    // Mark for removal after 30s using a simple check via TTL on id
    setTimeout(() => {
      const idx = p.drones.findIndex(d => d.id === tempDrone.id);
      if (idx !== -1) { p.drones.splice(idx, 1); bump(); }
    }, 30000);
  }

  // ── Player movement
  if (!serverAuthoritative) {
    const dx = state.cameraTarget.x - p.pos.x;
    const dy = state.cameraTarget.y - p.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MOVEMENT.STOP_DISTANCE) {
      p.angle = Math.atan2(dy, dx);
      const accel = 500;
      p.vel.x += Math.cos(p.angle) * accel * dt;
      p.vel.y += Math.sin(p.angle) * accel * dt;
    }
    const v = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
    const speedCap = state.afterburnUntil > state.tick ? stats.speed * MOVEMENT.AFTERBURN_MULTIPLIER : stats.speed;
    if (v > speedCap) {
      p.vel.x = (p.vel.x / v) * speedCap;
      p.vel.y = (p.vel.y / v) * speedCap;
    }
    const friction = Math.pow(MOVEMENT.FRICTION_PER_60FPS_FRAME, dt * 60);
    p.vel.x *= friction;
    p.vel.y *= friction;
    const spd = p.vel.x * p.vel.x + p.vel.y * p.vel.y;
    if (spd < MOVEMENT.IDLE_SPEED * MOVEMENT.IDLE_SPEED) {
      p.vel.x = 0;
      p.vel.y = 0;
    }
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
  } else {
    // Server owns position; interpolation handles movement in applyServerSmoothing()
    // Do NOT extrapolate with velocity - causes double-speed movement
    // Just update angle based on velocity direction
    if (p.vel.x * p.vel.x + p.vel.y * p.vel.y > 9) {
      p.angle = Math.atan2(p.vel.y, p.vel.x);
    }
  }
  // Face attack target when fighting (DarkOrbit style)
  if ((state.isLaserFiring || state.isRocketFiring) && state.attackTargetId) {
    const atk = state.enemies.find(e => e.id === state.attackTargetId);
    if (atk) {
      p.angle = Math.atan2(atk.pos.y - p.pos.y, atk.pos.x - p.pos.x);
    }
  }

  // ── Engine particles + 16-bit trail + thruster sound
  const cls = SHIP_CLASSES[p.shipClass];
  const shipSpeed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
  if (shipSpeed > 30) {
    sfx.thrusterStart();
    sfx.thrusterUpdate(Math.min(1, shipSpeed / stats.speed));
    trailTimer -= dt;
    if (trailTimer <= 0) {
      const back = p.angle + Math.PI;
      emitTrail(p.pos.x + Math.cos(back) * 8, p.pos.y + Math.sin(back) * 8, "#4ee2ff");
      trailTimer = 0.08;
    }
  } else {
    sfx.thrusterUpdate(0);
  }
  // Player ship burning when damaged (<30% HP)
  if (stats.hullMax > 0 && p.hull / stats.hullMax < 0.3 && Math.random() < 0.4) {
    const pox = (Math.random() - 0.5) * 14;
    const poy = (Math.random() - 0.5) * 14;
    if (Math.random() < 0.6) {
      state.particles.push({
        id: `pfire-${Math.random().toString(36).slice(2, 6)}`,
        pos: { x: p.pos.x + pox, y: p.pos.y + poy },
        vel: { x: (Math.random() - 0.5) * 20 + p.vel.x * 0.15, y: (Math.random() - 0.5) * 20 + p.vel.y * 0.15 },
        ttl: 0.3 + Math.random() * 0.3, maxTtl: 0.6,
        color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
        size: 2.5 + Math.random() * 3, kind: "ember",
      });
    } else {
      state.particles.push({
        id: `psmk-${Math.random().toString(36).slice(2, 6)}`,
        pos: { x: p.pos.x + pox, y: p.pos.y + poy },
        vel: { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 - 6 },
        ttl: 0.4 + Math.random() * 0.4, maxTtl: 0.8,
        color: "#444",
        size: 3 + Math.random() * 4, kind: "smoke",
      });
    }
  }

  // ── Shield regen (only after 5s out of combat)
  if (!serverAuthoritative && outOfCombatFor >= 5 && p.shield < stats.shieldMax) {
    p.shield = Math.min(stats.shieldMax, p.shield + stats.shieldRegen * dt);
  }

  // ── Auto-save every 15 minutes
  autoSaveTimer -= dt;
  if (autoSaveTimer <= 0) {
    save();
    autoSaveTimer = 900;
  }

  // ── Enemies spawn (server handles spawning when connected, local fallback otherwise)
  if (state.dungeon) {
    updateDungeon(dt);
  } else if (!serverEnemiesReceived) {
    enemySpawnTimer -= dt;
    if (enemySpawnTimer <= 0) {
      spawnEnemy();
      enemySpawnTimer = 0.8 + Math.random() * 1.0;
    }
  }

  // ── Boss event timer (only when no boss currently active and not in dungeon, local fallback)
  if (!serverEnemiesReceived && !bossActive && !state.dungeon) {
    state.bossSpawnTimer -= dt;
    if (state.bossSpawnTimer < 30 && state.bossSpawnTimer > 28) {
      const z = ZONES[state.player.zone];
      pushEvent({
        title: "INCOMING DREAD",
        body: `Sensors detect a heavy warship inbound to ${z.name} in 30s.`,
        ttl: 6, kind: "global", color: "#ff8a4e",
      });
    }
    if (state.bossSpawnTimer <= 0) {
      spawnBoss();
      state.bossSpawnTimer = 300 + Math.random() * 120;
    }
  }

  // ── NPC ships spawn and update (server handles spawning when connected)
  if (!state.dungeon) {
    if (!serverEnemiesReceived) {
      npcSpawnTimer -= dt;
      if (npcSpawnTimer <= 0) {
        spawnNpcShip();
        npcSpawnTimer = 8 + Math.random() * 12;
      }
    }
    if (!serverAuthoritative) {
      updateNpcShips(dt);
    } else {
      // NPC trails + damage effects in server mode
      for (const npc of state.npcShips) {
        const ns = Math.sqrt(npc.vel.x * npc.vel.x + npc.vel.y * npc.vel.y);
        if (ns > 15) {
          if (Math.abs(npc.vel.x) > 1 || Math.abs(npc.vel.y) > 1) {
            npc.angle = Math.atan2(npc.vel.y, npc.vel.x);
          }
          const nb = npc.angle + Math.PI;
          if (Math.random() < 0.5) {
            emitTrail(npc.pos.x + Math.cos(nb) * 7, npc.pos.y + Math.sin(nb) * 7, npc.color, 0.5, 2.5);
          }
        }
        // NPC burning when damaged
        if (npc.hullMax > 0 && npc.hull / npc.hullMax < 0.3 && Math.random() < 0.35) {
          const ox = (Math.random() - 0.5) * npc.size;
          const oy = (Math.random() - 0.5) * npc.size;
          state.particles.push({
            id: `nfire-${Math.random().toString(36).slice(2, 6)}`,
            pos: { x: npc.pos.x + ox, y: npc.pos.y + oy },
            vel: { x: (Math.random() - 0.5) * 15, y: (Math.random() - 0.5) * 15 },
            ttl: 0.25 + Math.random() * 0.25, maxTtl: 0.5,
            color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
            size: 2 + Math.random() * 2.5, kind: "ember",
          });
        }
      }
    }
  }

  // ── Update enemies (patrol near spawn, aggro when attacked or NPC nearby)
  const LEASH_RANGE = 800;
  const MIN_DIST = 60;
  for (const e of state.enemies) {
    if (e.hitFlash !== undefined && e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
    if (e.combo) {
      e.combo.ttl -= dt;
      if (e.combo.ttl <= 0) e.combo = undefined;
    }
    if (serverAuthoritative && !state.dungeon) {
      // Server owns enemy positions; applyServerSmoothing handles interpolation
      if (Math.abs(e.vel.x) > 1 || Math.abs(e.vel.y) > 1) {
        e.angle = Math.atan2(e.vel.y, e.vel.x);
      }
      // Enemy engine trail even in server mode
      const eSpd2 = Math.sqrt(e.vel.x * e.vel.x + e.vel.y * e.vel.y);
      if (eSpd2 > 5) {
        const eBack2 = e.angle + Math.PI;
        const trailRate = Math.min(0.8, eSpd2 / 60);
        if (Math.random() < trailRate) {
          const trailSz = Math.min(4, 1.5 + eSpd2 / 40);
          emitTrail(e.pos.x + Math.cos(eBack2) * (e.size * 0.6), e.pos.y + Math.sin(eBack2) * (e.size * 0.6), e.color, 0.5, trailSz);
        }
      }
      // Burning smoke/fire when damaged (<30% HP)
      if (e.hullMax > 0 && e.hull / e.hullMax < 0.3) {
        const dmgRate = 1 - (e.hull / e.hullMax) / 0.3;
        if (Math.random() < 0.3 + dmgRate * 0.4) {
          const ox = (Math.random() - 0.5) * e.size;
          const oy = (Math.random() - 0.5) * e.size;
          if (Math.random() < 0.6) {
            state.particles.push({
              id: `efire-${Math.random().toString(36).slice(2, 6)}`,
              pos: { x: e.pos.x + ox, y: e.pos.y + oy },
              vel: { x: (Math.random() - 0.5) * 20 + e.vel.x * 0.2, y: (Math.random() - 0.5) * 20 + e.vel.y * 0.2 },
              ttl: 0.25 + Math.random() * 0.3, maxTtl: 0.55,
              color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
              size: 2.5 + Math.random() * 3, kind: "ember",
            });
          } else {
            state.particles.push({
              id: `esmk-${Math.random().toString(36).slice(2, 6)}`,
              pos: { x: e.pos.x + ox, y: e.pos.y + oy },
              vel: { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 - 8 },
              ttl: 0.4 + Math.random() * 0.4, maxTtl: 0.8,
              color: "#444",
              size: 3 + Math.random() * 4, kind: "smoke",
            });
          }
        }
      }
      continue;
    }
    const exd = p.pos.x - e.pos.x;
    const eyd = p.pos.y - e.pos.y;
    let ed = Math.sqrt(exd * exd + eyd * eyd);
    e.angle = Math.atan2(eyd, exd);
    // EMP stun: skip AI while stunned
    if (e.stunUntil !== undefined && e.stunUntil > state.tick) {
      e.vel.x *= 0.85; e.vel.y *= 0.85;
      e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt;
      continue;
    }

    // Check for nearby NPC ships — enemies aggro and target them
    let npcTarget: NpcShip | null = null;
    let npcDist = 400;
    for (const npc of state.npcShips) {
      const nd = Math.hypot(npc.pos.x - e.pos.x, npc.pos.y - e.pos.y);
      if (nd < npcDist) { npcTarget = npc; npcDist = nd; }
    }
    if (npcTarget && npcDist < ed) {
      e.aggro = true;
      e.angle = Math.atan2(npcTarget.pos.y - e.pos.y, npcTarget.pos.x - e.pos.x);
      ed = npcDist;
    }

    // Aggro: enters aggro when hit or NPC nearby, drops aggro when too far from spawn
    const distFromSpawn = Math.sqrt(
      (e.pos.x - e.spawnPos.x) ** 2 + (e.pos.y - e.spawnPos.y) ** 2
    );
    if (e.aggro && distFromSpawn > LEASH_RANGE && !npcTarget) e.aggro = false;
    if (e.isBoss) e.aggro = ed < 800;

    if (!e.aggro) {
      // PATROL: drift slowly near spawn position
      const toSpawnX = e.spawnPos.x - e.pos.x;
      const toSpawnY = e.spawnPos.y - e.pos.y;
      const toSpawnD = Math.sqrt(toSpawnX * toSpawnX + toSpawnY * toSpawnY);
      const patrolSpeed = e.speed * 0.25;
      if (toSpawnD > 120) {
        const ang = Math.atan2(toSpawnY, toSpawnX);
        e.vel.x = Math.cos(ang) * patrolSpeed;
        e.vel.y = Math.sin(ang) * patrolSpeed;
        e.angle = ang;
      } else {
        const wobble = Math.sin(state.tick * 0.8 + e.pos.x * 0.01) * Math.PI;
        e.vel.x = Math.cos(wobble) * patrolSpeed * 0.5;
        e.vel.y = Math.sin(wobble) * patrolSpeed * 0.5;
        e.angle = wobble;
      }
    } else if (ed < MIN_DIST) {
      // Too close to player — stop and hold position
      e.vel.x *= 0.8;
      e.vel.y *= 0.8;
    } else if (e.behavior === "fast") {
      const wobble = Math.sin(state.tick * 5 + (e.pos.x + e.pos.y)) * 0.6;
      const ang = e.angle + wobble;
      e.vel.x = Math.cos(ang) * e.speed;
      e.vel.y = Math.sin(ang) * e.speed;
    } else if (e.behavior === "ranged") {
      const ideal = 340;
      const speed = e.speed * (ed < ideal - 40 ? -1 : ed > ideal + 40 ? 1 : 0.2);
      e.vel.x = Math.cos(e.angle) * speed;
      e.vel.y = Math.sin(e.angle) * speed;
    } else if (e.behavior === "tank") {
      if (ed > 160) {
        e.vel.x = Math.cos(e.angle) * e.speed;
        e.vel.y = Math.sin(e.angle) * e.speed;
      } else {
        e.vel.x *= 0.85;
        e.vel.y *= 0.85;
      }
    } else {
      if (ed > 120) {
        e.vel.x = Math.cos(e.angle) * e.speed;
        e.vel.y = Math.sin(e.angle) * e.speed;
      } else {
        e.vel.x *= 0.9;
        e.vel.y *= 0.9;
      }
    }
    e.pos.x += e.vel.x * dt;
    e.pos.y += e.vel.y * dt;

    // Enemy engine trail (like player trails but in enemy color)
    const eSpd = Math.sqrt(e.vel.x * e.vel.x + e.vel.y * e.vel.y);
    if (eSpd > 20) {
      const eBack = e.angle + Math.PI;
      const trailChance = Math.min(1, eSpd / 120);
      if (Math.random() < trailChance * 0.6) {
        emitTrail(e.pos.x + Math.cos(eBack) * (e.size * 0.6), e.pos.y + Math.sin(eBack) * (e.size * 0.6), e.color, 0.5, 2.5);
      }
    }
    // Burning smoke/fire when damaged (<30% HP) - local mode
    if (e.hullMax > 0 && e.hull / e.hullMax < 0.3) {
      const dmgRate = 1 - (e.hull / e.hullMax) / 0.3;
      if (Math.random() < 0.3 + dmgRate * 0.4) {
        const ox = (Math.random() - 0.5) * e.size;
        const oy = (Math.random() - 0.5) * e.size;
        if (Math.random() < 0.6) {
          state.particles.push({
            id: `efire-${Math.random().toString(36).slice(2, 6)}`,
            pos: { x: e.pos.x + ox, y: e.pos.y + oy },
            vel: { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 },
            ttl: 0.25 + Math.random() * 0.3, maxTtl: 0.55,
            color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
            size: 2.5 + Math.random() * 3, kind: "ember",
          });
        } else {
          state.particles.push({
            id: `esmk-${Math.random().toString(36).slice(2, 6)}`,
            pos: { x: e.pos.x + ox, y: e.pos.y + oy },
            vel: { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 - 8 },
            ttl: 0.4 + Math.random() * 0.4, maxTtl: 0.8,
            color: "#444",
            size: 3 + Math.random() * 4, kind: "smoke",
          });
        }
      }
    }

    // Firing: only when aggroed
    e.fireCd -= dt;
    if (!e.aggro) continue;
    if (e.isBoss) {
      const hpPct = e.hull / e.hullMax;
      const newPhase = hpPct > 0.66 ? 0 : hpPct > 0.33 ? 1 : 2;
      if (newPhase > (e.bossPhase ?? 0)) {
        e.bossPhase = newPhase;
        state.cameraShake = Math.max(state.cameraShake, 0.5);
        emitRing(e.pos.x, e.pos.y, "#ff3b4d", 80);
        emitRing(e.pos.x, e.pos.y, "#ff8a4e", 60);
        emitSpark(e.pos.x, e.pos.y, "#ff8a4e", 20, 200, 3);
        pushNotification(newPhase === 1 ? "BOSS ENRAGED — Phase 2!" : "BOSS BERSERK — Phase 3!", "bad");
        const bossName = e.type === "titan" ? "Titan" : e.type === "overlord" ? "Overlord" : e.type === "wraith" ? "Wraith" : e.type === "sentinel" ? "Sentinel" : "Dreadnought";
        pushChat("system", "SYSTEM", newPhase === 1 ? `The ${bossName} powers up its secondary weapons!` : `The ${bossName} enters berserk mode!`);
        sfx.bossWarn();
      }
      const phase = e.bossPhase ?? 0;
      if (e.fireCd <= 0 && ed < 700) {
        if (e.type === "titan" || e.type === "overlord") {
          // TITAN/OVERLORD BOSS: Heavy plasma barrage + energy ring
          if (phase === 0) {
            for (let i = -3; i <= 3; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.09, e.damage, e.color, 6, { weaponKind: "plasma", speedMul: 0.8, aoeRadius: 25 });
            }
            e.fireCd = 1.3;
          } else if (phase === 1) {
            for (let i = -4; i <= 4; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.1, e.damage * 1.2, "#ff4466", 6, { weaponKind: "plasma", speedMul: 0.9, aoeRadius: 30 });
            }
            for (let i = 0; i < 8; i++) {
              const ra = (Math.PI * 2 / 8) * i + state.tick * 0.3;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.6, e.color, 5, { weaponKind: "energy", speedMul: 0.6 });
            }
            e.fireCd = 1.0;
          } else {
            for (let i = 0; i < 16; i++) {
              const ra = (Math.PI * 2 / 16) * i + state.tick * 0.4;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.9, "#ff2244", 5, { weaponKind: "energy", speedMul: 0.65 });
            }
            for (let i = -3; i <= 3; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.07, e.damage * 1.5, "#ffffff", 7, { weaponKind: "plasma", speedMul: 1.0, aoeRadius: 35 });
            }
            e.fireCd = 0.9;
          }
        } else if (e.type === "wraith" || e.type === "sentinel") {
          // WRAITH/SENTINEL BOSS: Rapid energy storm
          if (phase === 0) {
            for (let i = -3; i <= 3; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.12, e.damage * 0.8, e.color, 4, { weaponKind: "energy", speedMul: 1.2 });
            }
            e.fireCd = 0.8;
          } else if (phase === 1) {
            for (let i = -4; i <= 4; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.1, e.damage * 0.9, "#cc44ff", 4, { weaponKind: "energy", speedMul: 1.4 });
            }
            e.fireCd = 0.5;
          } else {
            for (let i = 0; i < 20; i++) {
              const ra = (Math.PI * 2 / 20) * i + state.tick * 0.7;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.6, "#cc44ff", 3, { weaponKind: "energy", speedMul: 1.1 });
            }
            for (let i = -3; i <= 3; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.06, e.damage * 1.3, "#ffffff", 5, { weaponKind: "energy", speedMul: 1.5 });
            }
            e.fireCd = 0.4;
          }
        } else {
          // DREAD BOSS (default): Massive plasma barrage - WAY more projectiles
          if (phase === 0) {
            for (let i = -4; i <= 4; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.08, e.damage, e.color, 5, { weaponKind: "plasma", speedMul: 0.95 });
            }
            e.fireCd = 1.1;
          } else if (phase === 1) {
            for (let i = -5; i <= 5; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.09, e.damage * 1.2, "#ff5c6c", 5, { weaponKind: "plasma", speedMul: 1.1 });
            }
            for (let i = 0; i < 6; i++) {
              const ra = (Math.PI * 2 / 6) * i + state.tick * 0.4;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.7, "#ffaa22", 4, { weaponKind: "energy", speedMul: 0.7 });
            }
            e.fireCd = 0.7;
          } else {
            for (let i = 0; i < 24; i++) {
              const ra = (Math.PI * 2 / 24) * i + state.tick * 0.5;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.7, "#ff3b4d", 4, { weaponKind: "plasma", speedMul: 0.75 });
            }
            for (let i = -4; i <= 4; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.06, e.damage * 1.5, "#ffffff", 6, { weaponKind: "plasma", speedMul: 1.2 });
            }
            e.fireCd = 0.6;
          }
        }
        e.burstShots = phase >= 1 ? 6 : 4;
        e.burstCd = 0.1;
      }
      if ((e.burstShots ?? 0) > 0) {
        e.burstCd = (e.burstCd ?? 0) - dt;
        if ((e.burstCd ?? 0) <= 0) {
          const bWk = (e.type === "wraith" || e.type === "sentinel") ? "energy" : "plasma";
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + (Math.random() - 0.5) * 0.2, e.damage * 0.6, e.color, 3, { weaponKind: bWk as any });
          e.burstShots = (e.burstShots ?? 0) - 1;
          e.burstCd = 0.1;
        }
      }
      // Boss secondary attacks: spiral + area denial (runs between main volleys)
      e.secondaryCd = (e.secondaryCd ?? 0.5) - dt;
      if (e.secondaryCd <= 0 && ed < 700) {
        const p = state.player;
        const pAng = Math.atan2(p.pos.y - e.pos.y, p.pos.x - e.pos.x);
        if (phase >= 1) {
          // Rotating spiral pattern (2 arms)
          const spiralBase = state.tick * 2.5;
          for (let arm = 0; arm < 2; arm++) {
            const sAng = spiralBase + arm * Math.PI;
            fireProjectile("enemy", e.pos.x, e.pos.y, sAng, e.damage * 0.4, e.color, 3, { weaponKind: "energy", speedMul: 0.55 });
          }
        }
        if (phase >= 2) {
          // Area denial: fire at positions around the player
          const pDist = ed * 0.8;
          for (let i = 0; i < 3; i++) {
            const offsetAng = pAng + (i - 1) * 0.4 + (Math.random() - 0.5) * 0.2;
            fireProjectile("enemy", e.pos.x, e.pos.y, offsetAng, e.damage * 0.5, "#ff8844", 4, { weaponKind: "plasma", speedMul: 0.6, aoeRadius: 35 });
          }
          // Slow homing orb (aims at player predicted position)
          const projSpd = 220 * 0.4;
          const tHit = ed / projSpd;
          const predX = p.pos.x + p.vel.x * tHit * 0.5;
          const predY = p.pos.y + p.vel.y * tHit * 0.5;
          const homingAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
          fireProjectile("enemy", e.pos.x, e.pos.y, homingAng, e.damage * 0.8, "#ffcc00", 5, { weaponKind: "energy", speedMul: 0.4, homing: true });
        }
        e.secondaryCd = phase >= 2 ? 0.35 : 0.6;
      }
      if (phase >= 2) { e.speed = 55; }
    } else if (e.type === "sentinel") {
      // Sentinel: predictive double-tap + area denial bursts
      if (e.fireCd <= 0 && ed < 520) {
        const p = state.player;
        // Predictive aim: lead the target based on player velocity
        const projSpd = 220 * 1.2;
        const tHit = ed / projSpd;
        const predX = p.pos.x + p.vel.x * tHit * 0.6;
        const predY = p.pos.y + p.vel.y * tHit * 0.6;
        const predAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
        // Main shots aimed at predicted position
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng - 0.04, e.damage, e.color, 4, { weaponKind: "energy", speedMul: 1.2 });
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng + 0.04, e.damage, e.color, 4, { weaponKind: "energy", speedMul: 1.2 });
        // Area denial: shots offset to sides of player
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng + 0.3, e.damage * 0.5, e.color, 3, { weaponKind: "energy", speedMul: 0.9 });
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng - 0.3, e.damage * 0.5, e.color, 3, { weaponKind: "energy", speedMul: 0.9 });
        e.fireCd = 0.6 + Math.random() * 0.3;
      }
    } else if (e.type === "wraith") {
      // Wraith: fast predictive burst + flanking shots
      if (e.fireCd <= 0 && ed < 400) {
        const p = state.player;
        const projSpd = 220 * 1.4;
        const tHit = ed / projSpd;
        const predX = p.pos.x + p.vel.x * tHit * 0.7;
        const predY = p.pos.y + p.vel.y * tHit * 0.7;
        const predAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
        // Fast triple burst at predicted position
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, predAng + i * 0.12, e.damage * 0.7, e.color, 3, { weaponKind: "energy", speedMul: 1.4 });
        }
        // Two flanking shots aimed where player might dodge
        const dodgeAng1 = predAng + Math.PI * 0.4;
        const dodgeAng2 = predAng - Math.PI * 0.4;
        fireProjectile("enemy", e.pos.x, e.pos.y, dodgeAng1, e.damage * 0.4, e.color, 2, { weaponKind: "energy", speedMul: 1.6 });
        fireProjectile("enemy", e.pos.x, e.pos.y, dodgeAng2, e.damage * 0.4, e.color, 2, { weaponKind: "energy", speedMul: 1.6 });
        e.fireCd = 0.35 + Math.random() * 0.25;
      }
    } else if (e.type === "titan") {
      // Titan: heavy plasma spread + slow homing orb + ground denial
      if (e.fireCd <= 0 && ed < 520) {
        const p = state.player;
        // Main heavy spread
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.08, e.damage * 1.2, e.color, 6, { weaponKind: "plasma", speedMul: 0.7, aoeRadius: 30 });
        }
        // Area denial: shots aimed around the player (not at them)
        const pAng = Math.atan2(p.pos.y - e.pos.y, p.pos.x - e.pos.x);
        for (let i = 0; i < 4; i++) {
          const offsetAng = pAng + (i - 1.5) * 0.25;
          fireProjectile("enemy", e.pos.x, e.pos.y, offsetAng, e.damage * 0.6, "#ff6644", 5, { weaponKind: "plasma", speedMul: 0.5, aoeRadius: 40 });
        }
        e.fireCd = 1.0 + Math.random() * 0.3;
      }
    } else if (e.type === "overlord") {
      // Overlord: predictive barrage + 360 pulse + homing
      if (e.fireCd <= 0 && ed < 600) {
        const p = state.player;
        const projSpd = 220 * 1.1;
        const tHit = ed / projSpd;
        const predX = p.pos.x + p.vel.x * tHit * 0.5;
        const predY = p.pos.y + p.vel.y * tHit * 0.5;
        const predAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
        // Main barrage at predicted position
        for (let i = -2; i <= 2; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, predAng + i * 0.09, e.damage * 0.7, e.color, 4, { weaponKind: "energy", speedMul: 1.1 });
        }
        // Heavy center shot
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng, e.damage * 1.5, "#ff4466", 7, { weaponKind: "plasma", speedMul: 0.8, aoeRadius: 40 });
        // Area denial ring (4 shots around player area)
        for (let i = 0; i < 4; i++) {
          const ringAng = predAng + (Math.PI / 3) * (i - 1.5);
          fireProjectile("enemy", e.pos.x, e.pos.y, ringAng, e.damage * 0.4, e.color, 3, { weaponKind: "energy", speedMul: 0.7 });
        }
        e.fireCd = 0.7 + Math.random() * 0.3;
      }
    } else if (e.type === "dread") {
      // Dread: heavy plasma spread + predictive shots
      if (e.fireCd <= 0 && ed < 500) {
        const p = state.player;
        const projSpd = 220 * 0.9;
        const tHit = ed / projSpd;
        const predX = p.pos.x + p.vel.x * tHit * 0.4;
        const predY = p.pos.y + p.vel.y * tHit * 0.4;
        const predAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.06, e.damage, e.color, 5, { weaponKind: "plasma", speedMul: 0.9 });
        }
        e.fireCd = 1.0 + Math.random() * 0.4;
      }
    } else if (e.type === "voidling") {
      // Voidling: pulsing energy shots
      if (e.fireCd <= 0 && ed < 480) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color, 4, { weaponKind: "energy" });
        e.fireCd = 0.6 + Math.random() * 0.3;
      }
    } else if (e.type === "destroyer") {
      // Destroyer: triple plasma spread
      if (e.fireCd <= 0 && ed < 440) {
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.06, e.damage * 0.8, e.color, 4, { weaponKind: "plasma" });
        }
        e.fireCd = 1.2 + Math.random() * 0.5;
      }
    } else if (e.behavior === "fast") {
      // Scout: rapid small lasers
      if (e.fireCd <= 0 && ed < 300) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color, 2);
        e.fireCd = 0.45 + Math.random() * 0.3;
      }
    } else {
      // Raider/default: dual laser
      if (e.fireCd <= 0 && ed < 500) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle - 0.03, e.damage * 0.9, e.color);
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + 0.03, e.damage * 0.9, e.color);
        e.fireCd = 0.8 + Math.random() * 0.5;
      }
    }
  }

  // ── Attack: only fire when player chooses to attack (isAttacking)
  playerFireCd.value -= dt;
  rocketFireCd.value -= dt;
  const atkTarget = state.attackTargetId
    ? state.enemies.find((e) => e.id === state.attackTargetId)
    : null;
  const FIRE_RANGE = 400;
  if ((state.isLaserFiring || state.isRocketFiring) && atkTarget) {
    const ang = Math.atan2(atkTarget.pos.y - p.pos.y, atkTarget.pos.x - p.pos.x);
    const atkDist = Math.sqrt((atkTarget.pos.x - p.pos.x) ** 2 + (atkTarget.pos.y - p.pos.y) ** 2);
    if (atkDist < FIRE_RANGE) {
      const weaponIds = p.equipped.weapon.filter(Boolean) as string[];
      const laserAmmoType = getActiveAmmoType();
      const laserTypeDef = ROCKET_AMMO_TYPE_DEFS[laserAmmoType];
      const laserDmgMul = (laserTypeDef?.damageMul ?? 1.0) * 0.4;
      const laserColor = laserTypeDef?.color ?? "#4ee2ff";
      const rocketAmmoType = getActiveRocketAmmoType();
      const rocketTypeDef = ROCKET_MISSILE_TYPE_DEFS[rocketAmmoType];
      const rocketDmgMul = (rocketTypeDef?.damageMul ?? 1.0) * 0.4;
      const rocketColor = rocketTypeDef?.color ?? "#ff8a4e";
      const laserIds: string[] = [];
      const rocketIds: string[] = [];
      for (const wid of weaponIds) {
        const wi = p.inventory.find((m) => m.instanceId === wid);
        const wd = wi ? MODULE_DEFS[wi.defId] : null;
        if (wd?.weaponKind === "rocket") rocketIds.push(wid);
        else laserIds.push(wid);
      }
      const perpAng = ang + Math.PI / 2;

      // Fire lasers on laser cooldown (uses laser ammo) - only when laser firing is active
      const laserAmmo = p.ammo[laserAmmoType] ?? 0;
      if (laserAmmo < 1 && state.isLaserFiring) {
        state.isLaserFiring = false;
      }
      if (state.isLaserFiring && playerFireCd.value <= 0 && laserIds.length > 0 && laserAmmo >= 1) {
        p.ammo[laserAmmoType] = laserAmmo - 1;
        const laserDmg = stats.damage * laserDmgMul;

        // Determine firing pattern from first equipped laser weapon
        const firstLaser = p.inventory.find(m => m.instanceId === laserIds[0]);
        const firstDef = firstLaser ? MODULE_DEFS[firstLaser.defId] : null;
        const pattern = firstDef?.firingPattern || "standard";

        if (pattern === "sniper") {
          // Single powerful beam from center
          const dmg = Math.round(laserDmg);
          const ox = p.pos.x + Math.cos(ang) * 10;
          const oy = p.pos.y + Math.sin(ang) * 10;
          fireProjectile("player", ox, oy, ang, dmg, laserColor, 6, {
            weaponKind: "laser", speedMul: 3.2,
          });
          state.particles.push({ id: `mf-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.25, maxTtl: 0.25, color: "#ffffff", size: 90, kind: "flash" });
          state.particles.push({ id: `mf2-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.15, maxTtl: 0.15, color: laserColor, size: 60, kind: "flash" });
          emitSpark(ox, oy, "#ffffff", 8, 160, 3);
          emitSpark(ox, oy, laserColor, 4, 100, 2);
        } else if (pattern === "scatter") {
          // Shotgun: 3 heavy pellets in a tight cone
          const pellets = 3;
          const perPellet = Math.round(laserDmg * 2.5 / pellets);
          const spread = 0.1;
          for (let si = 0; si < pellets; si++) {
            const spreadAng = ang + (si - 1) * spread;
            const side = si === 0 ? -1 : si === 2 ? 1 : 0;
            const ox = p.pos.x + Math.cos(perpAng) * 10 * side;
            const oy = p.pos.y + Math.sin(perpAng) * 10 * side;
            fireProjectile("player", ox, oy, spreadAng, perPellet, laserColor, 4, {
              weaponKind: "laser", speedMul: 1.8,
            });
          }
          const cx = p.pos.x + Math.cos(ang) * 8;
          const cy = p.pos.y + Math.sin(ang) * 8;
          state.particles.push({ id: `mf-${Math.random().toString(36).slice(2, 8)}`, pos: { x: cx, y: cy }, vel: { x: 0, y: 0 }, ttl: 0.15, maxTtl: 0.15, color: laserColor, size: 80, kind: "flash" });
          emitSpark(cx, cy, laserColor, 8, 100, 2);
          emitSpark(cx, cy, "#ffffff", 4, 70, 2);
        } else if (pattern === "rail") {
          // Burst: 3 rapid shots
          const perBurst = Math.round(laserDmg * 1.3 / 3);
          for (let bi = 0; bi < 3; bi++) {
            const side = bi === 0 ? -1 : bi === 1 ? 1 : 0;
            const ox = p.pos.x + Math.cos(perpAng) * 10 * side;
            const oy = p.pos.y + Math.sin(perpAng) * 10 * side;
            const burstAng = ang + (Math.random() - 0.5) * 0.04;
            fireProjectile("player", ox, oy, burstAng, perBurst, laserColor, 4, {
              weaponKind: "laser", speedMul: 2.5,
            });
            state.particles.push({ id: `mf-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.12, maxTtl: 0.12, color: laserColor, size: 55, kind: "flash" });
            emitSpark(ox, oy, laserColor, 4, 90, 2);
          }
          emitSpark(p.pos.x, p.pos.y, "#ffffff", 3, 60, 2);
        } else {
          // Standard dual-fire
          const perShot = Math.round(laserDmg / 2);
          for (let si = 0; si < 2; si++) {
            const side = si === 0 ? -1 : 1;
            const ox = p.pos.x + Math.cos(perpAng) * 14 * side;
            const oy = p.pos.y + Math.sin(perpAng) * 14 * side;
            fireProjectile("player", ox, oy, ang - side * 0.03, perShot, laserColor, 4, {
              weaponKind: "laser", speedMul: 2.14,
            });
            state.particles.push({ id: `mf-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.18, maxTtl: 0.18, color: laserColor, size: 70, kind: "flash" });
            state.particles.push({ id: `mf2-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.1, maxTtl: 0.1, color: "#ffffff", size: 45, kind: "flash" });
            emitSpark(ox, oy, laserColor, 6, 120, 3);
            emitSpark(ox, oy, "#ffffff", 3, 70, 2);
          }
        }
        sfx.laserShoot();
        atkTarget.aggro = true;
        const cd = Math.max(0.2, 0.85 / stats.fireRate);
        playerFireCd.value = cd;
        state.attackCooldownUntil = state.tick + cd;
        state.attackCooldownDuration = cd;
        // Server handles damage via input state (isLaserFiring + attackTargetId)
      }

      // Fire rockets on separate slower cooldown (uses rocket ammo, higher damage) - only when rocket firing is active
      const rocketAmmo = p.rocketAmmo[rocketAmmoType] ?? 0;
      if (rocketAmmo < 1 && state.isRocketFiring) {
        state.isRocketFiring = false;
      }
      if (state.isRocketFiring && rocketFireCd.value <= 0 && rocketIds.length > 0 && rocketAmmo >= 1) {
        p.rocketAmmo[rocketAmmoType] = rocketAmmo - 1;
        for (const rId of rocketIds) {
          const ri = p.inventory.find((m) => m.instanceId === rId);
          const rd = ri ? MODULE_DEFS[ri.defId] : null;
          const rocketBaseDmg = stats.damage * rocketDmgMul * 2.5;
          const rDmg = Math.round(rocketBaseDmg);
          fireProjectile("player", p.pos.x, p.pos.y, ang, rDmg, rocketColor, 5, {
            weaponKind: "rocket",
            homing: true,
            speedMul: 1.18,
          });
        }
        // Muzzle flash + smoke burst at ship (radial, not directional)
        state.particles.push({
          id: `rl-${Math.random().toString(36).slice(2, 8)}`,
          pos: { x: p.pos.x, y: p.pos.y }, vel: { x: 0, y: 0 },
          ttl: 0.2, maxTtl: 0.2,
          color: "#ff8a4e", size: 65, kind: "flash",
        });
        state.particles.push({
          id: `rl2-${Math.random().toString(36).slice(2, 8)}`,
          pos: { x: p.pos.x, y: p.pos.y }, vel: { x: 0, y: 0 },
          ttl: 0.1, maxTtl: 0.1,
          color: "#ffffff", size: 35, kind: "flash",
        });
        // Radial smoke puffs around ship
        for (let si = 0; si < 6; si++) {
          const sa = Math.random() * Math.PI * 2;
          const ss = 25 + Math.random() * 40;
          state.particles.push({
            id: `rls-${Math.random().toString(36).slice(2, 8)}`,
            pos: { x: p.pos.x, y: p.pos.y },
            vel: { x: Math.cos(sa) * ss, y: Math.sin(sa) * ss },
            ttl: 0.5 + Math.random() * 0.3, maxTtl: 0.8,
            color: "#888888", size: 4 + Math.random() * 3, kind: "smoke",
          });
        }
        emitSpark(p.pos.x, p.pos.y, "#ffd24a", 4, 80, 2);
        sfx.rocketShoot();
        atkTarget.aggro = true;
        // Server handles damage via input state (isRocketFiring + attackTargetId)
        const avgRocketRate = rocketIds.reduce((sum, rid) => {
          const ri = p.inventory.find((m) => m.instanceId === rid);
          const rd = ri ? MODULE_DEFS[ri.defId] : null;
          return sum + (rd?.stats.fireRate ?? 0.5);
        }, 0) / rocketIds.length;
        const rCd = 1.5 / avgRocketRate;
        rocketFireCd.value = rCd;
      }
    }
  }
  // Clear target lock only when enemy dies
  if (state.attackTargetId && !atkTarget) {
    state.attackTargetId = null;
    state.selectedWorldTarget = null;
    state.isAttacking = false;
    state.isLaserFiring = false;
    state.isRocketFiring = false;
    bump();
  }

  // ── Mining: beam damages asteroid continuously (no projectiles)
  if (!state.miningTargetId || state.attackTargetId) sfx.miningLaserStop();
  if (state.miningTargetId && !state.attackTargetId) {
    const mAst = state.asteroids.find((a) => a.id === state.miningTargetId && a.zone === p.zone);
    if (mAst) {
      const mDist = distance(p.pos.x, p.pos.y, mAst.pos.x, mAst.pos.y);
      if (mDist < 450) {
        const miningDps = stats.damage * 0.25 * (1 + (stats.miningBonus ?? 0));
        // Server handles mining via input state (miningTargetId)
        if (!serverEnemiesReceived) {
          mAst.hp -= miningDps * dt;
        }
        sfx.miningLaserStart();

        if ((!serverEnemiesReceived || state.dungeon) && mAst.hp <= 0) { state.miningTargetId = null; sfx.miningLaserStop(); destroyAsteroid(mAst.id); }
      } else {
        state.miningTargetId = null;
        sfx.miningLaserStop();
      }
    } else {
      state.miningTargetId = null;
      sfx.miningLaserStop();
    }
  }

  // ── Update drones (formation behind player)
  const droneCount = p.drones.length;
  let nearest: Enemy | null = null;
  let nearestD = 400;
  for (const e of state.enemies) {
    const d = distance(p.pos.x, p.pos.y, e.pos.x, e.pos.y);
    const adj = d * (e.isBoss ? 0.6 : 1);
    if (adj < nearestD) { nearest = e; nearestD = adj; }
  }
  for (let i = 0; i < droneCount; i++) {
    const d = p.drones[i];
    const def = DRONE_DEFS[d.kind];
    d.orbitPhase += dt * 1.5;

    // Formation: line up behind the player ship
    const behindAngle = p.angle + Math.PI;
    const cols = Math.min(4, droneCount);
    const row = Math.floor(i / cols);
    const col = i % cols;
    const spacing = 55;
    const rowOffset = (row + 1) * spacing;
    const colOffset = (col - (Math.min(cols, droneCount - row * cols) - 1) / 2) * spacing;
    const perpAngle = behindAngle + Math.PI / 2;
    const targetX = p.pos.x + Math.cos(behindAngle) * rowOffset + Math.cos(perpAngle) * colOffset;
    const targetY = p.pos.y + Math.sin(behindAngle) * rowOffset + Math.sin(perpAngle) * colOffset;
    const prev = (d as Drone & { anchor?: { x: number; y: number } }).anchor;
    const lerpFactor = Math.min(1, dt * 5);
    const anchorX = prev ? prev.x + (targetX - prev.x) * lerpFactor : targetX;
    const anchorY = prev ? prev.y + (targetY - prev.y) * lerpFactor : targetY;
    (d as Drone & { anchor?: { x: number; y: number } }).anchor = {
      x: anchorX,
      y: anchorY,
    };
    if (def.fireRate > 0) {
      d.fireCd -= dt;
      if (d.fireCd <= 0 && nearest && (state.isLaserFiring || state.isRocketFiring)) {
        const dpos = (d as Drone & { anchor: { x: number; y: number } }).anchor;
        const fireRange = d.mode === "defensive" ? 200 : 380;
        if (distance(dpos.x, dpos.y, nearest.pos.x, nearest.pos.y) < fireRange) {
          const dang = Math.atan2(nearest.pos.y - dpos.y, nearest.pos.x - dpos.x);
          fireProjectile("drone", dpos.x, dpos.y, dang, def.damageBonus, def.color, 2);
          d.fireCd = 1 / def.fireRate;
        }
      }
    }
  }

  // ── Projectiles update + collisions
  state.projectiles = state.projectiles.filter((pr) => {
    // Homing steering (rockets)
    if (pr.homing && pr.fromPlayer && state.enemies.length > 0) {
      let target: Enemy | null = null;
      let bestD = 9999;
      for (const e of state.enemies) {
        const d = distance(pr.pos.x, pr.pos.y, e.pos.x, e.pos.y);
        if (d < bestD) { bestD = d; target = e; }
      }
      if (target) {
        const desiredAng = Math.atan2(target.pos.y - pr.pos.y, target.pos.x - pr.pos.x);
        const curAng = Math.atan2(pr.vel.y, pr.vel.x);
        let diff = desiredAng - curAng;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turnRate = 3.5 * dt;
        const newAng = curAng + Math.sign(diff) * Math.min(Math.abs(diff), turnRate);
        const spd = Math.sqrt(pr.vel.x * pr.vel.x + pr.vel.y * pr.vel.y);
        pr.vel.x = Math.cos(newAng) * spd;
        pr.vel.y = Math.sin(newAng) * spd;
      }
    }
    pr.pos.x += pr.vel.x * dt;
    pr.pos.y += pr.vel.y * dt;
    pr.ttl -= dt;
    if (pr.ttl <= 0) return false;
    // ── Rocket trail: long fiery trail + bright smoke ──
    if (pr.weaponKind === "rocket" && pr.fromPlayer) {
      const isEmp = !!(pr.empStun && pr.empStun > 0);
      const velAng = Math.atan2(pr.vel.y, pr.vel.x);
      const backX = -Math.cos(velAng);
      const backY = -Math.sin(velAng);
      // Fiery core trail
      if (Math.random() < 0.9) {
        const spread = (Math.random() - 0.5) * 4;
        state.particles.push({
          id: `rt-${Math.random().toString(36).slice(2, 8)}`,
          pos: { x: pr.pos.x + backX * 6 + spread * backY, y: pr.pos.y + backY * 6 - spread * backX },
          vel: { x: backX * (20 + Math.random() * 40) + (Math.random() - 0.5) * 10, y: backY * (20 + Math.random() * 40) + (Math.random() - 0.5) * 10 },
          ttl: 0.35 + Math.random() * 0.25, maxTtl: 0.6,
          color: Math.random() > 0.5 ? "#ff8a4e" : "#ffd24a", size: 2.5 + Math.random() * 2, kind: "ember",
        });
      }
      // Smoke wisps behind rocket
      if (Math.random() < 0.6) {
        const spread = (Math.random() - 0.5) * 4;
        state.particles.push({
          id: `rs-${Math.random().toString(36).slice(2, 8)}`,
          pos: { x: pr.pos.x + backX * 10 + spread * backY, y: pr.pos.y + backY * 10 - spread * backX },
          vel: { x: backX * (8 + Math.random() * 15) + (Math.random() - 0.5) * 8, y: backY * (8 + Math.random() * 15) + (Math.random() - 0.5) * 8 },
          ttl: 0.5 + Math.random() * 0.3, maxTtl: 0.8,
          color: "#999999", size: 2.5 + Math.random() * 2.5, kind: "smoke",
        });
      }
      // EMP rockets also emit occasional electric ring pulse while in flight
      if (isEmp && Math.random() < 0.08) {
        emitRing(pr.pos.x, pr.pos.y, pr.color);
      }
    }
    if (pr.fromPlayer) {
      // hit enemies
      for (const e of state.enemies) {
        if (distance(pr.pos.x, pr.pos.y, e.pos.x, e.pos.y) < e.size + 4) {
          if (pr.renderOnly) {
            e.hitFlash = 1;
            sfx.enemyHit();
            emitSpark(pr.pos.x, pr.pos.y, e.color, pr.crit ? 8 : 4, pr.crit ? 180 : 120, pr.crit ? 4 : 3);
            emitSpark(pr.pos.x, pr.pos.y, "#ffffff", pr.crit ? 4 : 2, pr.crit ? 140 : 90, 2);
            emitRing(pr.pos.x, pr.pos.y, pr.color, pr.crit ? 35 : 22);
            state.particles.push({
              id: `hf-${Math.random().toString(36).slice(2, 8)}`,
              pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 },
              ttl: 0.14, maxTtl: 0.14,
              color: pr.crit ? "#ffd24a" : "#ffffff",
              size: pr.crit ? 40 : 25, kind: "flash",
            });
            const emberCount = pr.crit ? 12 : 7;
            for (let ei = 0; ei < emberCount; ei++) {
              const ea = Math.random() * Math.PI * 2;
              const es = 80 + Math.random() * 200;
              const eColors = ["#ff8c00", "#ff4500", "#ffd700", e.color, "#ffffff"];
              state.particles.push({
                id: `em-${Math.random().toString(36).slice(2, 8)}`,
                pos: { x: pr.pos.x, y: pr.pos.y },
                vel: { x: Math.cos(ea) * es, y: Math.sin(ea) * es },
                ttl: 0.4 + Math.random() * 0.35, maxTtl: 0.75,
                color: eColors[Math.floor(Math.random() * eColors.length)],
                size: 2 + Math.random() * 3, kind: "ember",
              });
            }
            // Fire particles on hit
            if (pr.crit || Math.random() < 0.4) {
              const fc = pr.crit ? 3 : 1;
              for (let fi = 0; fi < fc; fi++) {
                const fa = Math.random() * Math.PI * 2;
                const fs = 30 + Math.random() * 60;
                state.particles.push({
                  id: `hfb-${Math.random().toString(36).slice(2, 8)}`,
                  pos: { x: pr.pos.x + (Math.random() - 0.5) * 6, y: pr.pos.y + (Math.random() - 0.5) * 6 },
                  vel: { x: Math.cos(fa) * fs, y: Math.sin(fa) * fs },
                  ttl: 0.2 + Math.random() * 0.2, maxTtl: 0.4,
                  color: Math.random() > 0.5 ? "#ff8a4e" : "#ff4500", size: 4 + Math.random() * 5, kind: "fireball",
                });
              }
            }
            // Burning hull chunks flying off on hits (low HP enemies)
            if (e.hull / e.hullMax < 0.4 && Math.random() < 0.5) {
              const da = Math.random() * Math.PI * 2;
              const ds = 100 + Math.random() * 160;
              state.particles.push({
                id: `hdb-${Math.random().toString(36).slice(2, 8)}`,
                pos: { x: pr.pos.x, y: pr.pos.y },
                vel: { x: Math.cos(da) * ds, y: Math.sin(da) * ds },
                ttl: 0.5 + Math.random() * 0.6, maxTtl: 1.1,
                color: Math.random() > 0.5 ? e.color : "#ff8a4e",
                size: 3 + Math.random() * 4,
                rot: Math.random() * Math.PI * 2,
                rotVel: (Math.random() - 0.5) * 14,
                kind: "debris",
              });
            }
            if (pr.weaponKind === "rocket") {
              for (let fi = 0; fi < 4; fi++) {
                const fa = Math.random() * Math.PI * 2;
                const fs = 40 + Math.random() * 80;
                state.particles.push({
                  id: `rfb-${Math.random().toString(36).slice(2, 8)}`,
                  pos: { x: pr.pos.x, y: pr.pos.y },
                  vel: { x: Math.cos(fa) * fs, y: Math.sin(fa) * fs },
                  ttl: 0.25 + Math.random() * 0.25, maxTtl: 0.5,
                  color: Math.random() > 0.5 ? "#ff8a4e" : "#ffd24a", size: 5 + Math.random() * 6, kind: "fireball",
                });
              }
              for (let si = 0; si < 4; si++) {
                const sa = Math.random() * Math.PI * 2;
                const ss = 25 + Math.random() * 40;
                state.particles.push({
                  id: `rsmk-${Math.random().toString(36).slice(2, 8)}`,
                  pos: { x: pr.pos.x, y: pr.pos.y },
                  vel: { x: Math.cos(sa) * ss, y: Math.sin(sa) * ss },
                  ttl: 0.4 + Math.random() * 0.3, maxTtl: 0.7,
                  color: "#999999", size: 5 + Math.random() * 5, kind: "smoke",
                });
              }
              sfx.explosion();
            }
            const hitDist = Math.hypot(pr.pos.x - state.player.pos.x, pr.pos.y - state.player.pos.y);
            const hitShake = pr.weaponKind === "rocket" ? 0.2 : (pr.crit ? 0.1 : 0.05);
            state.cameraShake = Math.max(state.cameraShake, hitShake * Math.max(0, 1 - hitDist / 500));
            return false;
          }
          const stacks = e.combo ? Math.min(5, e.combo.stacks + 1) : 1;
          e.combo = { stacks, ttl: 3 };
          const comboMul = 1 + (stacks - 1) * 0.10;
          const dmg = pr.damage * comboMul;
          if (!serverEnemiesReceived || state.dungeon) {
            e.hull -= dmg;
          }
          e.hitFlash = 1;
          e.aggro = true;
          sfx.enemyHit();
          emitSpark(pr.pos.x, pr.pos.y, e.color, pr.crit ? 8 : 4, pr.crit ? 180 : 120, pr.crit ? 4 : 3);
          emitSpark(pr.pos.x, pr.pos.y, "#ffffff", pr.crit ? 4 : 2, pr.crit ? 140 : 90, 2);
          emitRing(pr.pos.x, pr.pos.y, pr.color, pr.crit ? 35 : 22);
          // Hit flash
          state.particles.push({
            id: `hf-${Math.random().toString(36).slice(2, 8)}`,
            pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 },
            ttl: 0.14, maxTtl: 0.14,
            color: pr.crit ? "#ffd24a" : "#ffffff",
            size: pr.crit ? 40 : 25, kind: "flash",
          });
          // A few embers flying outward from hit point
          const emberCount = pr.crit ? 4 : 2;
          for (let ei = 0; ei < emberCount; ei++) {
            const ea = Math.random() * Math.PI * 2;
            const es = 80 + Math.random() * 120;
            const eColors = ["#ff8c00", "#ff4500", "#ffd700", e.color];
            state.particles.push({
              id: `em-${Math.random().toString(36).slice(2, 8)}`,
              pos: { x: pr.pos.x, y: pr.pos.y },
              vel: { x: Math.cos(ea) * es, y: Math.sin(ea) * es },
              ttl: 0.3 + Math.random() * 0.25, maxTtl: 0.55,
              color: eColors[Math.floor(Math.random() * eColors.length)],
              size: 2 + Math.random() * 2, kind: "ember",
            });
          }
          // Rocket explosion on impact
          if (pr.weaponKind === "rocket") {
            state.particles.push({
              id: `rf-${Math.random().toString(36).slice(2, 8)}`,
              pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 },
              ttl: 0.28, maxTtl: 0.28,
              color: "#ff8a4e", size: 80, kind: "flash",
            });
            emitRing(pr.pos.x, pr.pos.y, "#ff8a4e", 60);
            emitRing(pr.pos.x, pr.pos.y, "#ffd24a", 45);
            emitRing(pr.pos.x, pr.pos.y, "#ff5c6c", 35);
            for (let fi = 0; fi < 10; fi++) {
              const fa = Math.random() * Math.PI * 2;
              const fs = 50 + Math.random() * 120;
              state.particles.push({
                id: `rfb-${Math.random().toString(36).slice(2, 8)}`,
                pos: { x: pr.pos.x, y: pr.pos.y },
                vel: { x: Math.cos(fa) * fs, y: Math.sin(fa) * fs },
                ttl: 0.25 + Math.random() * 0.25, maxTtl: 0.5,
                color: Math.random() > 0.5 ? "#ff8a4e" : "#ffd24a", size: 5 + Math.random() * 6, kind: "fireball",
              });
            }
            for (let ei = 0; ei < 6; ei++) {
              const ea = Math.random() * Math.PI * 2;
              const es = 80 + Math.random() * 160;
              state.particles.push({
                id: `rfe-${Math.random().toString(36).slice(2, 8)}`,
                pos: { x: pr.pos.x, y: pr.pos.y },
                vel: { x: Math.cos(ea) * es, y: Math.sin(ea) * es },
                ttl: 0.4 + Math.random() * 0.3, maxTtl: 0.7,
                color: ["#ff8c00", "#ff4500", "#ffd700"][Math.floor(Math.random() * 3)],
                size: 2 + Math.random() * 3, kind: "ember",
              });
            }
            for (let si = 0; si < 6; si++) {
              const sa = Math.random() * Math.PI * 2;
              const ss = 25 + Math.random() * 50;
              state.particles.push({
                id: `rfs-${Math.random().toString(36).slice(2, 8)}`,
                pos: { x: pr.pos.x, y: pr.pos.y },
                vel: { x: Math.cos(sa) * ss, y: Math.sin(sa) * ss },
                ttl: 0.5 + Math.random() * 0.4, maxTtl: 0.9,
                color: "#999999", size: 6 + Math.random() * 6, kind: "smoke",
              });
            }
            sfx.explosion();
          }
          // Camera shake on hit
          const hitDist = Math.hypot(pr.pos.x - state.player.pos.x, pr.pos.y - state.player.pos.y);
          const hitShake = pr.weaponKind === "rocket" ? 0.25 : (pr.crit ? 0.15 : 0.08);
          state.cameraShake = Math.max(state.cameraShake, hitShake * Math.max(0, 1 - hitDist / 500));
          // damage floater
          pushFloater({
            text: pr.crit ? `${Math.round(dmg)}!` : `${Math.round(dmg)}`,
            color: pr.crit ? "#ffee00" : "#e8f0ff",
            x: e.pos.x + (Math.random() - 0.5) * 18,
            y: e.pos.y - e.size - 8,
            scale: pr.crit ? 1.5 : 0.95, ttl: pr.crit ? 1.0 : 0.7, bold: pr.crit,
          });
          if (pr.crit) {
            emitSpark(e.pos.x, e.pos.y, "#ffee00", 6, 100, 2);
          }
          if (stacks >= 3) {
            pushFloater({ text: `x${stacks}`, color: "#ff5cf0", x: e.pos.x, y: e.pos.y + e.size + 8, scale: 0.9, ttl: 0.5 });
          }
          // EMP stun: disable enemy fire/movement briefly
          if (pr.empStun && pr.empStun > 0) {
            e.stunUntil = state.tick + pr.empStun;
            pushFloater({ text: "EMP!", color: "#ffd24a", x: e.pos.x, y: e.pos.y - e.size - 14, scale: 1.1, ttl: 0.9, bold: true });
            emitRing(pr.pos.x, pr.pos.y, pr.color);
            emitRing(pr.pos.x, pr.pos.y, "#ffffff");
            setTimeout(() => emitRing(pr.pos.x, pr.pos.y, pr.color), 100);
            setTimeout(() => emitRing(pr.pos.x, pr.pos.y, pr.color), 220);
          }
          // AP floater
          if (pr.armorPiercing) {
            pushFloater({ text: "AP", color: "#ff5c6c", x: e.pos.x + 10, y: e.pos.y - e.size - 8, scale: 0.85, ttl: 0.5 });
          }
          // splash
          if (pr.aoeRadius && pr.aoeRadius > 0) {
            for (const e2 of state.enemies) {
              if (e2.id === e.id) continue;
              if (distance(e.pos.x, e.pos.y, e2.pos.x, e2.pos.y) < pr.aoeRadius * 3) {
                if (!serverEnemiesReceived || state.dungeon) e2.hull -= dmg * 0.4;
                e2.hitFlash = 1;
              }
            }
            emitRing(pr.pos.x, pr.pos.y, "#ffaa44");
          }
          if ((!serverEnemiesReceived || state.dungeon) && e.hull <= 0) applyKill(e, !!pr.crit);
          return false;
        }
      }
      // Projectiles pass through asteroids (mining is beam-only now)
    } else {
      // enemy projectile -> hit NPC ships, drones, then player
      for (const npc of state.npcShips) {
        if (distance(pr.pos.x, pr.pos.y, npc.pos.x, npc.pos.y) < npc.size + 4) {
          if (!pr.renderOnly) npc.hull -= pr.damage;
          emitSpark(pr.pos.x, pr.pos.y, npc.color, 8, 140, 3);
          emitSpark(pr.pos.x, pr.pos.y, "#ffffff", 3, 100, 2);
          emitRing(pr.pos.x, pr.pos.y, pr.color, 25);
          state.particles.push({
            id: `nhf-${Math.random().toString(36).slice(2, 8)}`,
            pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 },
            ttl: 0.14, maxTtl: 0.14,
            color: "#ffffff", size: 28, kind: "flash",
          });
          // Fire embers on NPC hit
          for (let ei = 0; ei < 4; ei++) {
            const ea = Math.random() * Math.PI * 2;
            const es = 60 + Math.random() * 120;
            state.particles.push({
              id: `nem-${Math.random().toString(36).slice(2, 8)}`,
              pos: { x: pr.pos.x, y: pr.pos.y },
              vel: { x: Math.cos(ea) * es, y: Math.sin(ea) * es },
              ttl: 0.3 + Math.random() * 0.25, maxTtl: 0.55,
              color: ["#ff8c00", "#ff4500", "#ffd700", npc.color][Math.floor(Math.random() * 4)],
              size: 2 + Math.random() * 2.5, kind: "ember",
            });
          }
          sfx.enemyHit();
          return false;
        }
      }
      for (const dr of p.drones) {
        const anchor = (dr as Drone & { anchor?: { x: number; y: number } }).anchor;
        if (!anchor) continue;
        if (distance(pr.pos.x, pr.pos.y, anchor.x, anchor.y) < 10) {
          const dead = damageDrone(dr, pr.damage);
          emitSpark(pr.pos.x, pr.pos.y, DRONE_DEFS[dr.kind].color, 5, 80, 2);
          if (dead) {
            p.drones = p.drones.filter((x) => x.id !== dr.id);
            pushNotification(`Drone destroyed: ${DRONE_DEFS[dr.kind].name}`, "bad");
            emitDeath(anchor.x, anchor.y, DRONE_DEFS[dr.kind].color);
            sfx.explosion();
          }
          return false;
        }
      }
      for (const o of state.others) {
        if (distance(pr.pos.x, pr.pos.y, o.pos.x, o.pos.y) < 14) {
          emitSpark(pr.pos.x, pr.pos.y, "#ff5c6c", 5, 80, 2);
          emitRing(pr.pos.x, pr.pos.y, "#ff5c6c", 18);
          state.particles.push({
            id: `ohf-${Math.random().toString(36).slice(2, 8)}`,
            pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 },
            ttl: 0.1, maxTtl: 0.1,
            color: "#ff5c6c", size: 20, kind: "flash",
          });
          return false;
        }
      }
      if (distance(pr.pos.x, pr.pos.y, p.pos.x, p.pos.y) < 12) {
        emitSpark(pr.pos.x, pr.pos.y, "#ff5c6c", 6, 90, 2);
        emitRing(pr.pos.x, pr.pos.y, "#ff5c6c", 18);
        state.particles.push({
          id: `phf-${Math.random().toString(36).slice(2, 8)}`,
          pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 },
          ttl: 0.12, maxTtl: 0.12,
          color: "#ff5c6c", size: 25, kind: "flash",
        });
        sfx.hit();
        state.cameraShake = Math.max(state.cameraShake, 0.12);
        if (!serverAuthoritative) damagePlayer(pr.damage);
        return false;
      }
    }
    return true;
  });

  if (!serverEnemiesReceived || state.dungeon) {
    state.enemies = state.enemies.filter((e) => e.hull > 0);
  }

  // ── Particles update
  for (const pa of state.particles) {
    pa.pos.x += pa.vel.x * dt;
    pa.pos.y += pa.vel.y * dt;
    const drag = (pa.kind === "ember" || pa.kind === "debris") ? 0.985 : 0.95;
    pa.vel.x *= drag;
    pa.vel.y *= drag;
    if (pa.rotVel !== undefined && pa.rot !== undefined) {
      pa.rot += pa.rotVel * dt;
    }
    pa.ttl -= dt;
  }
  state.particles = state.particles.filter((pa) => pa.ttl > 0);
  if (state.particles.length > 600) {
    state.particles.splice(0, state.particles.length - 600);
  }

  // ── Cargo box TTL + proximity pickup
  for (const cb of state.cargoBoxes) cb.ttl -= dt;
  state.cargoBoxes = state.cargoBoxes.filter((cb) => cb.ttl > 0);
  tryCollectNearbyBoxes();

  // ── Floaters update
  for (const f of state.floaters) {
    if (f.trackPlayer) {
      f.pos.x = state.player.pos.x;
      f.pos.y = state.player.pos.y - 40 + f.vy * (f.maxTtl - f.ttl);
    } else {
      f.pos.y += f.vy * dt;
    }
    f.vy *= 0.96;
    f.ttl -= dt;
  }
  state.floaters = state.floaters.filter((f) => f.ttl > 0);

  // ── Events ttl
  for (const ev of state.events) ev.ttl -= dt;
  state.events = state.events.filter((ev) => ev.ttl > 0);

  // ── Other players movement
  if (serverAuthoritative) {
    // Server sends positions + angle via delta/snapshot; applyServerSmoothing handles lerp
    // Don't override angle here - server sends the correct angle (including attack facing)
  } else {
    // AI drift (singleplayer fallback)
    aiUpdateTimer -= dt;
    if (aiUpdateTimer <= 0) {
      for (const o of state.others) {
        if (Math.random() < 0.3) {
          o.vel.x = (Math.random() - 0.5) * 100;
          o.vel.y = (Math.random() - 0.5) * 100;
          o.angle = Math.atan2(o.vel.y, o.vel.x);
        }
      }
      aiUpdateTimer = 2;
    }
    for (const o of state.others) {
      o.pos.x += o.vel.x * dt;
      o.pos.y += o.vel.y * dt;
    }
  }

  // ── Auto chat chatter (singleplayer fallback only)
  if (!serverAuthoritative) {
    chatTimer -= dt;
    if (chatTimer <= 0) {
      const o = state.others[Math.floor(Math.random() * state.others.length)];
      if (o) pushChat("local", o.name, CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]);
      chatTimer = 8 + Math.random() * 10;
    }
  }

  // ── Notification ttl
  for (const n of state.notifications) n.ttl -= dt;
  state.notifications = state.notifications.filter((n) => n.ttl > 0);
  if (state.notifications.length > 5) {
    state.notifications.splice(0, state.notifications.length - 5);
  }
  for (const h of state.recentHonor) h.ttl -= dt;
  state.recentHonor = state.recentHonor.filter((h) => h.ttl > 0);

  // ── Asteroid rotation + player collision
  for (const a of state.asteroids) {
    a.rotation += a.rotSpeed * dt;
    if (a.zone !== state.player.zone) continue;
    const adist = distance(p.pos.x, p.pos.y, a.pos.x, a.pos.y);
    if (adist < a.size + 10) {
      const pushAng = Math.atan2(p.pos.y - a.pos.y, p.pos.x - a.pos.x);
      p.pos.x = a.pos.x + Math.cos(pushAng) * (a.size + 12);
      p.pos.y = a.pos.y + Math.sin(pushAng) * (a.size + 12);
      damagePlayer(Math.round(a.size * 0.3));
      emitSpark(p.pos.x, p.pos.y, "#c69060", 3, 50, 2);
    }
  }

  // ── Debris fire trails (burning wreckage from explosions)
  for (const pa of state.particles) {
    if (pa.kind === "debris" && pa.ttl > 0.3) {
      const spdSq = pa.vel.x * pa.vel.x + pa.vel.y * pa.vel.y;
      if (spdSq > 2500 && Math.random() < 0.35) {
        state.particles.push({
          id: `dft-${Math.random().toString(36).slice(2, 6)}`,
          pos: { x: pa.pos.x + (Math.random() - 0.5) * 3, y: pa.pos.y + (Math.random() - 0.5) * 3 },
          vel: { x: (Math.random() - 0.5) * 15, y: (Math.random() - 0.5) * 15 },
          ttl: 0.2 + Math.random() * 0.25, maxTtl: 0.45,
          color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
          size: 2 + Math.random() * 2, kind: "ember",
        });
      }
      if (spdSq > 4000 && Math.random() < 0.15) {
        state.particles.push({
          id: `dfs-${Math.random().toString(36).slice(2, 6)}`,
          pos: { x: pa.pos.x, y: pa.pos.y },
          vel: { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8 },
          ttl: 0.3 + Math.random() * 0.3, maxTtl: 0.6,
          color: "#555", size: 2.5 + Math.random() * 2, kind: "smoke",
        });
      }
    }
  }

  // ── Save periodically
  saveTimer -= dt;
  if (saveTimer <= 0) {
    save();
    saveTimer = 6;
  }

  bump();
}

function destroyAsteroid(id: string): void {
  const a = state.asteroids.find((x) => x.id === id);
  if (!a) return;
  // PixiJS handles asteroid death VFX
  sfx.explosion();
  const qty = 2 + Math.floor(Math.random() * 3);
  const got = addCargo(a.yields, qty);
  if (got > 0) {
    const res = RESOURCES[a.yields];
    pushFloater({ text: `+${got} ${res?.name ?? a.yields}`, color: res?.color ?? "#5cff8a", x: state.player.pos.x, y: state.player.pos.y - 30, scale: 1.3, bold: true, ttl: 2.0 });
    sfx.pickup();
    state.player.milestones.totalMined += got;
    bumpMission("mine", got);
    bumpMission("gather", got, state.player.zone, { resourceId: a.yields });
    const prev = state.player.milestones.totalMined - got;
    checkMilestoneTier("totalMined", prev, state.player.milestones.totalMined);
  } else {
    pushNotification("Cargo full — ore lost", "bad");
  }
  state.asteroids = state.asteroids.filter((x) => x.id !== id);
  setTimeout(() => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1200 + Math.random() * 1200;
    state.asteroids.push({
      id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      pos: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
      hp: 80, hpMax: 80, size: 16 + Math.random() * 14,
      rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.4,
      zone: state.player.zone,
      yields: pickAsteroidYield(state.player.zone),
    });
  }, 6000);
}

export function checkPortal(): void {
  const p = state.player;
  const portal = PORTALS.find(
    (po) => po.fromZone === p.zone && distance(p.pos.x, p.pos.y, po.pos.x, po.pos.y) < 70
  );
  if (portal) {
    const z = ZONES[portal.toZone];
    if (state.player.level < z.unlockLevel) {
      pushNotification(`Need level ${z.unlockLevel} to enter ${z.name}`, "bad");
      const ang = Math.atan2(p.pos.y - portal.pos.y, p.pos.x - portal.pos.x);
      p.pos.x += Math.cos(ang) * 80;
      p.pos.y += Math.sin(ang) * 80;
      return;
    }
    const destPortal = PORTALS.find(dp => dp.fromZone === portal.toZone && dp.toZone === portal.fromZone);
    const spawnX = destPortal ? destPortal.pos.x : 0;
    const spawnY = destPortal ? destPortal.pos.y + 80 : 80;
    travelToZone(portal.toZone, spawnX, spawnY);
  }
}

export function checkStationDock(): string | null {
  const p = state.player;
  const station = STATIONS.find(
    (s) => s.zone === p.zone && distance(p.pos.x, p.pos.y, s.pos.x, s.pos.y) < 90
  );
  return station ? station.id : null;
}

// silence unused export warning for ZoneId import
export type _ZoneId = ZoneId;

// ── SERVER EVENT HANDLERS (called from App.tsx socket listeners) ─────────

let serverEnemiesReceived = false;

export function onServerZoneEnemies(enemies: ServerEnemy[]): void {
  if (state.dungeon) return; // Dont overwrite client-side dungeon enemies
  serverEnemiesReceived = true;
  state.enemies = enemies.map(serverEnemyToLocal);
  bump();
}

export function onServerZoneAsteroids(asteroids: ServerAsteroid[]): void {
  state.asteroids = asteroids.map((a) => ({
    id: a.id,
    pos: { x: a.x, y: a.y },
    hp: a.hp, hpMax: a.hpMax, size: a.size,
    rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.4,
    zone: state.player.zone,
    yields: a.yields as any,
  }));
  bump();
}

export function onServerZoneNpcs(npcs: ServerNpc[]): void {
  state.npcShips = npcs.map((n) => ({
    id: n.id, name: n.name,
    pos: { x: n.x, y: n.y }, vel: { x: n.vx, y: n.vy },
    angle: n.angle, color: n.color, size: n.size,
    hull: n.hull, hullMax: n.hullMax, speed: n.speed,
    damage: 0, fireCd: 2,
    targetPos: { x: n.x, y: n.y },
    state: n.state as any,
    targetEnemyId: null,
    zone: state.player.zone,
  }));
  bump();
}

export function onEnemySpawn(data: ServerEnemy): void {
  if (state.dungeon) return;
  if (state.enemies.find((e) => e.id === data.id)) return;
  state.enemies.push(serverEnemyToLocal(data));
}

export function onEnemyHit(data: EnemyHitEvent): void {
  if (state.dungeon) return;
  const e = state.enemies.find((en) => en.id === data.enemyId);
  if (!e) return;
  e.hull = data.hp;
  e.hullMax = data.hpMax;
  e.hitFlash = 1;
  e.aggro = true;
  const hitDist = Math.hypot(e.pos.x - state.player.pos.x, e.pos.y - state.player.pos.y);
  if (hitDist < 800) sfx.enemyHit();
  if (data.crit) {
    emitSpark(e.pos.x, e.pos.y, "#ffee00", 8, 140, 3);
    emitSpark(e.pos.x, e.pos.y, "#ffffff", 4, 100, 2);
    pushFloater({ text: `${Math.round(data.damage)}!`, color: "#ffee00", x: e.pos.x + (Math.random() - 0.5) * 18, y: e.pos.y - e.size - 8, scale: 1.5, ttl: 1.0, bold: true });
  } else {
    pushFloater({ text: `${Math.round(data.damage)}`, color: "#e8f0ff", x: e.pos.x + (Math.random() - 0.5) * 18, y: e.pos.y - e.size - 8, scale: 0.95, ttl: 0.7 });
  }
  emitSpark(e.pos.x, e.pos.y, e.color, data.crit ? 10 : 5, data.crit ? 200 : 140, data.crit ? 4 : 3);
  emitSpark(e.pos.x, e.pos.y, "#ffffff", data.crit ? 5 : 2, data.crit ? 140 : 90, 2);

  // Fire particles on server-confirmed hits
  if (data.crit || Math.random() < 0.4) {
    const fCnt = data.crit ? 3 : 1;
    for (let fi = 0; fi < fCnt; fi++) {
      const fa = Math.random() * Math.PI * 2;
      const fs = 30 + Math.random() * 60;
      state.particles.push({
        id: `sfb-${Math.random().toString(36).slice(2, 8)}`,
        pos: { x: e.pos.x + (Math.random() - 0.5) * 6, y: e.pos.y + (Math.random() - 0.5) * 6 },
        vel: { x: Math.cos(fa) * fs, y: Math.sin(fa) * fs },
        ttl: 0.2 + Math.random() * 0.2, maxTtl: 0.4,
        color: Math.random() > 0.5 ? "#ff8a4e" : "#ff4500", size: 4 + Math.random() * 5, kind: "fireball",
      });
    }
  }
  // Burning hull chunks when enemy is low HP
  if (e.hull / e.hullMax < 0.4 && Math.random() < 0.5) {
    const da = Math.random() * Math.PI * 2;
    const ds = 100 + Math.random() * 160;
    state.particles.push({
      id: `sdb-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x: e.pos.x, y: e.pos.y },
      vel: { x: Math.cos(da) * ds, y: Math.sin(da) * ds },
      ttl: 0.5 + Math.random() * 0.6, maxTtl: 1.1,
      color: Math.random() > 0.5 ? e.color : "#ff8a4e",
      size: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      rotVel: (Math.random() - 0.5) * 14,
      kind: "debris",
    });
  }
}

export function onEnemyDie(data: EnemyDieEvent): void {
  if (state.dungeon) return;
  const e = state.enemies.find((en) => en.id === data.enemyId);
  const pos = e ? { x: e.pos.x, y: e.pos.y } : data.pos;
  const wasBoss = e?.isBoss;
  const color = e?.color ?? "#ff5c6c";
  const size = e?.size ?? 12;

  emitDeath(pos.x, pos.y, color, !!wasBoss, size);
  if (wasBoss) {
    sfx.bossKill();
    state.cameraShake = Math.max(state.cameraShake, 1);
    bossActive = false;
    pushEvent({
      title: "BOSS DEFEATED",
      body: "Excellent shooting, Captain. Premium loot dropped.",
      ttl: 6, kind: "boss", color: "#5cff8a",
    });
  } else {
    sfx.explosion(size > 16);
    const dist = Math.hypot(pos.x - state.player.pos.x, pos.y - state.player.pos.y);
    state.cameraShake = Math.max(state.cameraShake, (size > 16 ? 0.75 : 0.5) * Math.max(0, 1 - dist / 800));
  }

  // Grant loot from server (only to killer)
  const loot = data.loot;
  const p = state.player;
  if (data.killerId !== serverPlayerId) {
    state.enemies = state.enemies.filter(en => en.id !== data.enemyId);
    bump();
    return;
  }

  // XP + credits + honor are instant (no box needed)
  p.exp += loot.exp;
  p.credits += loot.credits;
  p.honor += loot.honor;
  while (p.exp >= EXP_FOR_LEVEL(p.level)) {
    p.exp -= EXP_FOR_LEVEL(p.level);
    p.level++;
    p.skillPoints += 1;
    state.levelUpFlash = 1.6;
  }
  pushFloater({ text: `+${loot.exp} XP`, color: "#ff5cf0", x: pos.x - 15, y: pos.y - 30, scale: 0.9 });
  pushFloater({ text: `+${loot.credits} CR`, color: "#ffd24a", x: pos.x + 15, y: pos.y - 16, scale: 0.9 });
  if (loot.honor > 0) pushFloater({ text: `+${loot.honor} H`, color: "#c8a0ff", x: pos.x, y: pos.y - 2, scale: 0.8 });

  // Drop loot boxes (multiple colored boxes per kill)
  const bossBox = wasBoss;
  const spread = 40;
  // Resource box (green / gold for boss)
  if (loot.resource && loot.resource.qty > 0) {
    state.cargoBoxes.push({
      id: `cb-res-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x: pos.x + (Math.random() - 0.5) * spread, y: pos.y + (Math.random() - 0.5) * spread },
      resourceId: loot.resource.resourceId as any,
      qty: loot.resource.qty,
      credits: 0, exp: 0, honor: 0,
      ttl: 45,
      color: bossBox ? "#ffd24a" : "#5cff8a",
    });
  }
  // Ammo box (blue)
  const ammoDrop = 1 + Math.floor(Math.random() * 3);
  state.cargoBoxes.push({
    id: `cb-ammo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    pos: { x: pos.x + (Math.random() - 0.5) * spread, y: pos.y + (Math.random() - 0.5) * spread },
    resourceId: "scrap" as any,
    qty: 0,
    credits: 0, exp: 0, honor: 0,
    ttl: 30,
    color: "#6688ff",
    ammoQty: ammoDrop,
  } as any);

  // Bonus resource box (orange) - extra trade goods
  if ((loot as any).bonusResource && (loot as any).bonusResource.qty > 0) {
    const br = (loot as any).bonusResource;
    state.cargoBoxes.push({
      id: `cb-bonus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x: pos.x + (Math.random() - 0.5) * spread, y: pos.y + (Math.random() - 0.5) * spread },
      resourceId: br.resourceId as any,
      qty: br.qty,
      credits: 0, exp: 0, honor: 0,
      ttl: 35,
      color: "#ffaa33",
    } as any);
  }

  // Kill log in chat
  const eName = e?.name ?? "Enemy";
  const eType = e?.type ?? "unknown";
  const bonusStr = (loot as any).bonusResource ? `, +${(loot as any).bonusResource.qty} ${(loot as any).bonusResource.resourceId}` : "";
  pushChat("system", "COMBAT", `Destroyed ${eName} (+${loot.credits} CR, +${loot.exp} XP${loot.resource ? `, +${loot.resource.qty} ${loot.resource.resourceId}` : ""}${bonusStr})`);

  // Quest + mission progress
  if (e) {
    for (const q of p.activeQuests) {
      if (!q.completed && q.killType === e.type && q.zone === p.zone) {
        q.progress++;
        if (q.progress >= q.killCount) {
          q.completed = true;
          pushNotification(`Quest complete: ${q.title}`, "good");
        }
      }
    }
  }
  p.milestones.totalKills++;
  if (wasBoss) p.milestones.bossKills++;
  bumpMission("kill-any", 1);
  bumpMission("kill-zone", 1, p.zone);
  bumpMission("earn-credits", loot.credits);
  tryLevelUp();

  state.enemies = state.enemies.filter((en) => en.id !== data.enemyId);
  bump();
}

export function onEnemyAttack(data: EnemyAttackEvent): void {
  if (state.dungeon) return;
  const isTargetingMe = data.targetId === serverPlayerId;
  const ang = Math.atan2(data.targetPos.y - data.pos.y, data.targetPos.x - data.pos.x);
  // Look up the enemy to determine projectile style
  const srcEnemy = state.enemies.find(e => e.id === data.enemyId);
  const eType = srcEnemy?.type ?? (data as any).enemyType;
  let projColor = srcEnemy?.color ?? "#ff5c6c";
  let projSize = 3;
  let projWk: "laser" | "energy" | "plasma" | undefined = undefined;
  let projSpeed = 2.73;
  if (eType === "sentinel" || eType === "wraith" || eType === "voidling" || eType === "overlord") {
    projWk = "energy";
    projSize = 4;
    projSpeed = eType === "wraith" ? 3.2 : 2.8;
  } else if (eType === "dread" || eType === "titan" || eType === "destroyer") {
    projWk = "plasma";
    projSize = eType === "titan" ? 6 : 5;
    projSpeed = eType === "titan" ? 2.0 : 2.5;
  }
  // Muzzle flash at enemy position
  state.particles.push({
    id: `emf-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x: data.pos.x, y: data.pos.y },
    vel: { x: 0, y: 0 }, ttl: 0.2, maxTtl: 0.2,
    color: projColor, size: 60 + (projSize * 8), kind: "flash",
  });
  state.particles.push({
    id: `emf2-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x: data.pos.x + Math.cos(ang) * 10, y: data.pos.y + Math.sin(ang) * 10 },
    vel: { x: 0, y: 0 }, ttl: 0.12, maxTtl: 0.12,
    color: "#ffffff", size: 40 + (projSize * 5), kind: "flash",
  });
  fireProjectile("enemy", data.pos.x, data.pos.y, ang, data.damage, projColor, projSize, { renderOnly: !isTargetingMe, speedMul: projSpeed, weaponKind: projWk as any });
  if (!serverAuthoritative && isTargetingMe) {
    damagePlayer(data.damage);
  }
  // Impact particles at player position when hit
  if (isTargetingMe) {
    const px = state.player?.pos.x ?? data.targetPos.x;
    const py = state.player?.pos.y ?? data.targetPos.y;
    const impactDelay = 0;
    for (let i = 0; i < 6; i++) {
      const ia = Math.random() * Math.PI * 2;
      const iv = 40 + Math.random() * 80;
      state.particles.push({
        id: `eimp-${Math.random().toString(36).slice(2, 8)}`,
        pos: { x: px + Math.cos(ia) * 5, y: py + Math.sin(ia) * 5 },
        vel: { x: Math.cos(ia) * iv, y: Math.sin(ia) * iv },
        ttl: 0.3 + Math.random() * 0.2, maxTtl: 0.5,
        color: projColor, size: 2 + Math.random() * 3, kind: "ember",
      });
    }
    state.particles.push({
      id: `eimpf-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x: px, y: py },
      vel: { x: 0, y: 0 }, ttl: 0.15, maxTtl: 0.15,
      color: "#ffffff", size: 80, kind: "flash",
    });
  }
}

export function onAsteroidMine(data: { asteroidId: string; hp: number; hpMax: number }): void {
  const a = state.asteroids.find((ast) => ast.id === data.asteroidId);
  if (a) {
    a.hp = data.hp;
    a.hpMax = data.hpMax;
  }
}

export function onAsteroidDestroy(data: { asteroidId: string; playerId: number; ore: { resourceId: string; qty: number } }): void {
  const a = state.asteroids.find((ast) => ast.id === data.asteroidId);
  if (a) {
    emitSpark(a.pos.x, a.pos.y, "#c69060", 16, 120, 3);
    emitRing(a.pos.x, a.pos.y, "#c0a070", 30);
    sfx.explosion();
    const got = addCargo(data.ore.resourceId as any, data.ore.qty);
    if (got > 0) {
      pushFloater({ text: `+${got} ${data.ore.resourceId}`, color: "#5cff8a", x: a.pos.x, y: a.pos.y - 12, scale: 1, ttl: 0.9 });
      sfx.pickup();
      state.player.milestones.totalMined += got;
      bumpMission("mine", got);
      bumpMission("gather", got, state.player.zone, { resourceId: data.ore.resourceId as string });
    }
  }
  state.asteroids = state.asteroids.filter((ast) => ast.id !== data.asteroidId);
  state.miningTargetId = null;
  sfx.miningLaserStop();
}

export function onAsteroidRespawn(data: ServerAsteroid): void {
  state.asteroids.push({
    id: data.id,
    pos: { x: data.x, y: data.y },
    hp: data.hp, hpMax: data.hpMax, size: data.size,
    rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.4,
    zone: state.player.zone,
    yields: data.yields as any,
  });
}

export function onBossWarn(): void {
  const z = ZONES[state.player.zone];
  pushEvent({
    title: "INCOMING DREAD",
    body: `Sensors detect a heavy warship inbound to ${z.name} in 30s.`,
    ttl: 6, kind: "global", color: "#ff8a4e",
  });
  sfx.bossWarn();
}

export function onNpcSpawn(data: ServerNpc): void {
  if (state.npcShips.find((n) => n.id === data.id)) return;
  state.npcShips.push({
    id: data.id, name: data.name,
    pos: { x: data.x, y: data.y }, vel: { x: data.vx, y: data.vy },
    angle: data.angle, color: data.color, size: data.size,
    hull: data.hull, hullMax: data.hullMax, speed: data.speed,
    damage: 0, fireCd: 2,
    targetPos: { x: data.x, y: data.y },
    state: data.state as any,
    targetEnemyId: null,
    zone: state.player.zone,
  });
}

export function onNpcDie(data: { npcId: string }): void {
  const n = state.npcShips.find((ns) => ns.id === data.npcId);
  if (n) {
    emitDeath(n.pos.x, n.pos.y, n.color);
    sfx.explosion();
  }
  state.npcShips = state.npcShips.filter((ns) => ns.id !== data.npcId);
}

export function onLaserFireFromServer(data: LaserFireEvent): void {
  if (data.attackerId === serverPlayerId) return;
  const attacker = state.others.find(o => o.id === String(data.attackerId));
  const target = state.enemies.find(e => e.id === data.targetId);
  if (!attacker || !target) return;
  const angle = Math.atan2(target.pos.y - attacker.pos.y, target.pos.x - attacker.pos.x);
  fireProjectile("player", attacker.pos.x, attacker.pos.y, angle, data.damage, "#4ee2ff", 3);
  if (data.crit) {
    emitSpark(target.pos.x, target.pos.y, "#ffee00", 6, 120, 3);
  }
}

export function onRocketFireFromServer(data: RocketFireEvent): void {
  if (data.attackerId === serverPlayerId) return;
  const angle = Math.atan2(data.targetPos.y - data.pos.y, data.targetPos.x - data.pos.x);
  fireProjectile("player", data.pos.x, data.pos.y, angle, data.damage, "#ff8844", 4, { speedMul: 0.7 });
  if (data.crit) {
    emitSpark(data.targetPos.x, data.targetPos.y, "#ffee00", 6, 120, 3);
  }
}

export function onProjectileSpawnFromServer(data: ProjectileSpawnEvent): void {
  const angle = Math.atan2(data.vy, data.vx);
  const speed = Math.sqrt(data.vx * data.vx + data.vy * data.vy);
  const baseSpeed = data.fromPlayer ? 280 : 220;
  const speedMul = baseSpeed > 0 ? speed / baseSpeed : 1;

  fireProjectile(data.fromPlayer ? "player" : "enemy", data.x, data.y, angle, data.damage, data.color, data.size, {
    crit: data.crit,
    homing: data.homing,
    speedMul,
    weaponKind: data.weaponKind,
    renderOnly: true,
  });

  if (data.fromPlayer) {
    const isRocket = data.weaponKind === "rocket";
    if (isRocket) {
      state.particles.push({
        id: `rf-${Math.random().toString(36).slice(2, 8)}`,
        pos: { x: data.x, y: data.y }, vel: { x: 0, y: 0 },
        ttl: 0.2, maxTtl: 0.2,
        color: "#ff8a4e", size: 55, kind: "flash",
      });
      state.particles.push({
        id: `rf2-${Math.random().toString(36).slice(2, 8)}`,
        pos: { x: data.x, y: data.y }, vel: { x: 0, y: 0 },
        ttl: 0.1, maxTtl: 0.1,
        color: "#ffffff", size: 30, kind: "flash",
      });
      for (let si = 0; si < 4; si++) {
        const sa = Math.random() * Math.PI * 2;
        const ss = 20 + Math.random() * 35;
        state.particles.push({
          id: `rfs-${Math.random().toString(36).slice(2, 8)}`,
          pos: { x: data.x, y: data.y },
          vel: { x: Math.cos(sa) * ss, y: Math.sin(sa) * ss },
          ttl: 0.4 + Math.random() * 0.2, maxTtl: 0.6,
          color: "#888888", size: 3 + Math.random() * 2, kind: "smoke",
        });
      }
    } else {
      state.particles.push({
        id: `lf-${Math.random().toString(36).slice(2, 8)}`,
        pos: { x: data.x, y: data.y }, vel: { x: 0, y: 0 },
        ttl: 0.12, maxTtl: 0.12,
        color: data.color || "#4ee2ff", size: 35, kind: "flash",
      });
    }
    emitSpark(data.x, data.y, data.color || "#4ee2ff", data.crit ? 6 : 3, 80, 2);

    // Play shoot sound for other players (distance-attenuated)
    const shootDist = Math.hypot(data.x - state.player.pos.x, data.y - state.player.pos.y);
    if (shootDist < 800) {
      if (isRocket) {
        sfx.rocketShoot();
      } else {
        sfx.laserShoot();
      }
    }
  }
}

function serverEnemyToLocal(se: ServerEnemy): Enemy {
  return {
    id: se.id,
    type: se.type as EnemyType,
    name: se.name,
    behavior: se.behavior as any,
    pos: { x: se.x, y: se.y },
    vel: { x: se.vx, y: se.vy },
    angle: se.angle,
    hull: se.hull, hullMax: se.hullMax,
    damage: se.damage, speed: se.speed,
    fireCd: Math.random() * 2,
    exp: 0, credits: 0, honor: 0,
    color: se.color, size: se.size,
    isBoss: se.isBoss, bossPhase: se.isBoss ? (se.hull/se.hullMax > 0.66 ? 0 : se.hull/se.hullMax > 0.33 ? 1 : 2) : 0,
    burstCd: 0, burstShots: 0,
    spawnPos: { x: se.x, y: se.y },
    aggro: false,
  };
}

// ── DELTA / SNAPSHOT HANDLERS (server-authoritative netcode) ──────────────

let serverConfig = { tickRate: 25, friction: 0.96, frictionRefFps: 60 };
export let serverAuthoritative = false;
let serverPlayerId = 0;
let _deltaCount = 0;

const ENTITY_LERP_RATE = NETCODE.INTERPOLATION_FACTOR;

type RenderTarget = { x: number; y: number; vx: number; vy: number };
const _selfTarget: RenderTarget & { set: boolean } = { x: 0, y: 0, vx: 0, vy: 0, set: false };
const _entityTargets = new Map<string, RenderTarget>();

function setSelfTarget(x: number, y: number, vx: number, vy: number): void {
  if (!_selfTarget.set) {
    state.player.pos.x = x;
    state.player.pos.y = y;
    _selfTarget.set = true;
  }
  _selfTarget.x = x;
  _selfTarget.y = y;
  _selfTarget.vx = vx;
  _selfTarget.vy = vy;
}

function setEntityTarget(id: string, x: number, y: number, vx: number, vy: number): void {
  const cur = _entityTargets.get(id);
  if (cur) { cur.x = x; cur.y = y; cur.vx = vx; cur.vy = vy; }
  else _entityTargets.set(id, { x, y, vx, vy });
}

function applyServerSmoothing(dt: number): void {
  const targetFPS = 60;
  const frameRatio = dt * targetFPS;
  const lerp = 1 - Math.pow(1 - NETCODE.INTERPOLATION_FACTOR, frameRatio);

  if (_selfTarget.set) {
    const p = state.player;
    const dx = _selfTarget.x - p.pos.x;
    const dy = _selfTarget.y - p.pos.y;
    const snapThreshold = 250;
    if (dx * dx + dy * dy > snapThreshold * snapThreshold) {
      p.pos.x = _selfTarget.x;
      p.pos.y = _selfTarget.y;
    } else {
      p.pos.x += dx * lerp;
      p.pos.y += dy * lerp;
    }
    p.vel.x = _selfTarget.vx;
    p.vel.y = _selfTarget.vy;
  }
  for (const o of state.others) {
    const tgt = _entityTargets.get(`p-${o.id}`);
    if (!tgt) continue;
    const odx = tgt.x - o.pos.x;
    const ody = tgt.y - o.pos.y;
    const oDist = odx * odx + ody * ody;
    const oStopped = tgt.vx * tgt.vx + tgt.vy * tgt.vy < 9;
    if (oStopped && oDist < 900) {
      o.pos.x = tgt.x;
      o.pos.y = tgt.y;
    } else {
      o.pos.x += odx * lerp;
      o.pos.y += ody * lerp;
    }
    o.vel.x = tgt.vx;
    o.vel.y = tgt.vy;
    const oSpeed = Math.sqrt(o.vel.x * o.vel.x + o.vel.y * o.vel.y);
    if (oSpeed > 30) {
      const tKey = `ot-${o.id}`;
      const last = (_otherTrailTimers as any)[tKey] ?? 0;
      const now = performance.now() / 1000;
      if (now - last >= 0.08) {
        ((_otherTrailTimers as any)[tKey] = now);
        const back = o.angle + Math.PI;
        emitTrail(o.pos.x + Math.cos(back) * 8, o.pos.y + Math.sin(back) * 8, "#4ee2ff");
      }
    }
    // Burning smoke/fire for other players below 30% HP
    if (o.hullMax > 0 && o.hull / o.hullMax < 0.3 && Math.random() < 0.4) {
      const pox = (Math.random() - 0.5) * 14;
      const poy = (Math.random() - 0.5) * 14;
      if (Math.random() < 0.6) {
        state.particles.push({
          id: `ofire-${Math.random().toString(36).slice(2, 6)}`,
          pos: { x: o.pos.x + pox, y: o.pos.y + poy },
          vel: { x: (Math.random() - 0.5) * 20 + o.vel.x * 0.15, y: (Math.random() - 0.5) * 20 + o.vel.y * 0.15 },
          ttl: 0.3 + Math.random() * 0.3, maxTtl: 0.6,
          color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
          size: 2.5 + Math.random() * 3, kind: "ember",
        });
      } else {
        state.particles.push({
          id: `osmk-${Math.random().toString(36).slice(2, 6)}`,
          pos: { x: o.pos.x + pox, y: o.pos.y + poy },
          vel: { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 - 6 },
          ttl: 0.4 + Math.random() * 0.4, maxTtl: 0.8,
          color: "#444",
          size: 3 + Math.random() * 4, kind: "smoke",
        });
      }
    }
  }
  for (const e of state.enemies) {
    const tgt = _entityTargets.get(e.id);
    if (!tgt) continue;
    const evx = tgt.vx || e.vel.x;
    const evy = tgt.vy || e.vel.y;
    const espd = Math.sqrt(evx * evx + evy * evy);
    // Velocity extrapolation for smooth motion
    e.pos.x += evx * dt;
    e.pos.y += evy * dt;
    // Correction toward server position - very gentle for slow/big enemies
    const edx = tgt.x - e.pos.x;
    const edy = tgt.y - e.pos.y;
    const errDist = Math.sqrt(edx * edx + edy * edy);
    if (errDist > 200) {
      // Snap if too far off (teleport/respawn)
      e.pos.x = tgt.x;
      e.pos.y = tgt.y;
    } else if (espd < 60) {
      // Slow/big enemies: very gentle correction to avoid stutter
      const corrLerp = Math.min(lerp * 0.3, 0.05);
      e.pos.x += edx * corrLerp;
      e.pos.y += edy * corrLerp;
    } else {
      // Fast enemies: normal correction
      e.pos.x += edx * lerp * 0.6;
      e.pos.y += edy * lerp * 0.6;
    }
    e.vel.x = tgt.vx;
    e.vel.y = tgt.vy;
  }
  for (const n of state.npcShips) {
    const tgt = _entityTargets.get(n.id);
    if (!tgt) continue;
    n.pos.x += tgt.vx * dt;
    n.pos.y += tgt.vy * dt;
    const nCorrLerp = Math.min(lerp * 2.0, 0.6);
    n.pos.x += (tgt.x - n.pos.x) * nCorrLerp;
    n.pos.y += (tgt.y - n.pos.y) * nCorrLerp;
    const ndx = tgt.x - n.pos.x;
    const ndy = tgt.y - n.pos.y;
    if (ndx * ndx + ndy * ndy > 200 * 200) {
      n.pos.x = tgt.x;
      n.pos.y = tgt.y;
    }
    n.vel.x = tgt.vx;
    n.vel.y = tgt.vy;
  }
}

export function onWelcome(data: WelcomePayload): void {
  serverConfig = {
    tickRate: data.tickRate,
    friction: data.friction,
    frictionRefFps: data.frictionRefFps,
  };
  serverPlayerId = data.playerId;
  serverAuthoritative = true;
  serverEnemiesReceived = true;
}

export function onDelta(data: DeltaPayload): void {
  serverAuthoritative = true;
  _deltaCount++;
  const p = state.player;
  const self = data.self;

  setSelfTarget(self.x, self.y, self.vx, self.vy);

  if (state.playerRespawnTimer <= 0) {
    p.hull = self.hp;
    p.shield = self.shield;
  }

  for (const entity of data.addOrUpdate) {
    applyEntityUpdate(entity);
  }

  for (const id of data.removals) {
    removeEntityById(id);
    _entityTargets.delete(id);
  }

  bump(); // Trigger React re-render
}

export function onSnapshot(data: SnapshotPayload): void {
  serverAuthoritative = true;
  const p = state.player;
  const self = data.self;

  setSelfTarget(self.x, self.y, self.vx, self.vy);

  if (state.playerRespawnTimer <= 0) {
    p.hull = self.hp;
    p.shield = self.shield;
  }

  // Track which entities are in this snapshot
  const snapshotIds = new Set<string>();
  for (const entity of data.entities) {
    snapshotIds.add(entity.id);
    applyEntityUpdate(entity);
  }

  // Snapshot is a full state resync - remove entities not present (out of view or dead)
  if (!state.dungeon) {
    state.enemies = state.enemies.filter(e => snapshotIds.has(e.id));
    state.npcShips = state.npcShips.filter(n => snapshotIds.has(n.id));
    state.others = state.others.filter(o => snapshotIds.has(`p-${o.id}`));
    // Clean up stale entity targets
    for (const id of _entityTargets.keys()) {
      if (!snapshotIds.has(id)) _entityTargets.delete(id);
    }
  }

  bump();
}

export function onPlayerHitFromServer(data: { damage: number; hp: number; shield: number }): void {
  const p = state.player;
  if (state.playerRespawnTimer > 0) return;
  p.hull = data.hp;
  p.shield = data.shield;
  emitSpark(p.pos.x, p.pos.y, "#ff5c6c", 6, 70, 2);
  sfx.hit();
  state.cameraShake = Math.max(state.cameraShake, 0.15);
  state.lastHitTick = state.tick;
}

export function onPlayerDieFromServer(data: { playerId: number; pos: { x: number; y: number } }): void {
  const p = state.player;
  if (data.playerId !== serverPlayerId) return;
  const shipColor = SHIP_CLASSES[p.shipClass].color;
  emitDeath(data.pos.x, data.pos.y, shipColor, true);
  state.playerDeathFlash = 0.6;
  state.player.milestones.totalDeaths++;
  state.isAttacking = false;
  state.isLaserFiring = false;
  state.isRocketFiring = false;
  state.attackTargetId = null;
  state.selectedWorldTarget = null;
  sfx.thrusterStop();
  sfx.explosion(true);
  state.cameraShake = 1;
  pushNotification("Ship destroyed. Respawning...", "bad");
}

function applyEntityUpdate(entity: DeltaEntity): void {
  switch (entity.entityType) {
    case "enemy": {
      const e = state.enemies.find(en => en.id === entity.id);
      if (e) {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        if (entity.angle != null) e.angle = entity.angle;
        if (entity.hp != null) e.hull = entity.hp;
        if (entity.hpMax != null) e.hullMax = entity.hpMax;
        if (entity.isBoss != null) e.isBoss = entity.isBoss;
        if (entity.bossPhase != null && entity.bossPhase > (e.bossPhase ?? 0)) e.bossPhase = entity.bossPhase;
      } else {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        state.enemies.push({
          id: entity.id,
          type: (entity.type || "scout") as EnemyType,
          name: entity.name || "Unknown",
          behavior: (entity.behavior || "chaser") as any,
          pos: { x: entity.x, y: entity.y },
          vel: { x: entity.vx || 0, y: entity.vy || 0 },
          angle: entity.angle || 0,
          hull: entity.hp || 100, hullMax: entity.hpMax || 100,
          damage: entity.damage || 10, speed: entity.speed || 80,
          fireCd: Math.random() * 2, exp: 0, credits: 0, honor: 0,
          color: entity.color || "#ff5c6c", size: entity.size || 12,
          isBoss: entity.isBoss || false, bossPhase: (entity.isBoss && entity.hp && entity.hpMax) ? (entity.hp/entity.hpMax > 0.66 ? 0 : entity.hp/entity.hpMax > 0.33 ? 1 : 2) : 0,
          burstCd: 0, burstShots: 0,
          spawnPos: { x: entity.x, y: entity.y },
          aggro: false,
        });
      }
      break;
    }
    case "player": {
      const numId = entity.id.replace("p-", "");
      const o = state.others.find(op => op.id === numId);
      if (o) {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        if (entity.angle != null) o.angle = entity.angle;
        if (entity.hp != null) o.hull = entity.hp;
        if (entity.hpMax != null) o.hullMax = entity.hpMax;
        if (entity.shield != null) o.shield = entity.shield;
        if (entity.faction !== undefined) o.faction = entity.faction ?? null;
        if (entity.honor != null) o.honor = entity.honor;
        if (entity.name) o.name = entity.name;
        if (entity.shipClass) o.shipClass = entity.shipClass as any;
        if (entity.level) o.level = entity.level;
        if (entity.miningTargetId !== undefined) o.miningTargetId = entity.miningTargetId ?? null;
      } else {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        state.others.push({
          id: numId,
          name: entity.name || "Pilot",
          shipClass: (entity.shipClass || "skimmer") as any,
          level: entity.level || 1,
          clan: null,
          zone: state.player.zone as any,
          pos: { x: entity.x, y: entity.y },
          vel: { x: entity.vx || 0, y: entity.vy || 0 },
          angle: entity.angle || 0,
          inParty: false,
          faction: entity.faction ?? null,
          honor: entity.honor ?? 0,
          miningTargetId: entity.miningTargetId ?? null,
          hull: entity.hp ?? 100,
          hullMax: entity.hpMax ?? 100,
          shield: entity.shield ?? 0,
        });
      }
      break;
    }
    case "npc": {
      const n = state.npcShips.find(ns => ns.id === entity.id);
      if (n) {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        if (entity.angle != null) n.angle = entity.angle;
        if (entity.hp != null) n.hull = entity.hp;
        if (entity.hpMax != null) n.hullMax = entity.hpMax;
        if (entity.state != null) n.state = entity.state as any;
      } else {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        state.npcShips.push({
          id: entity.id,
          name: entity.name || "NPC",
          pos: { x: entity.x, y: entity.y },
          vel: { x: entity.vx || 0, y: entity.vy || 0 },
          angle: entity.angle || 0,
          color: entity.color || "#4ee2ff",
          size: entity.size || 12,
          hull: entity.hp || 200, hullMax: entity.hpMax || 200,
          speed: entity.speed || 100, damage: 0, fireCd: 2,
          targetPos: { x: entity.x, y: entity.y },
          state: (entity.state || "patrol") as any,
          targetEnemyId: null,
          zone: state.player.zone,
        });
      }
      break;
    }
    case "asteroid": {
      const a = state.asteroids.find(ast => ast.id === entity.id);
      if (a) {
        if (entity.hp != null) a.hp = entity.hp;
        if (entity.hpMax != null) a.hpMax = entity.hpMax;
      } else {
        state.asteroids.push({
          id: entity.id,
          pos: { x: entity.x, y: entity.y },
          hp: entity.hp || 100, hpMax: entity.hpMax || 100,
          size: entity.size || 20,
          rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.4,
          zone: state.player.zone,
          yields: (entity.yields || "iron") as any,
        });
      }
      break;
    }
  }
}

function removeEntityById(id: string): void {
  if (id.startsWith("p-")) {
    const numId = id.replace("p-", "");
    state.others = state.others.filter(o => o.id !== numId);
  } else if (id.startsWith("e-") || id.startsWith("boss-")) {
    state.enemies = state.enemies.filter(e => e.id !== id);
  } else if (id.startsWith("npc-")) {
    state.npcShips = state.npcShips.filter(n => n.id !== id);
  } else if (id.startsWith("ast-")) {
    state.asteroids = state.asteroids.filter(a => a.id !== id);
  }
}
