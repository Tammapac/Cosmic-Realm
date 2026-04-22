import {
  bump, pushChat, pushNotification, pushHonor, save, addCargo, pushFloater,
  pushEvent, bumpMission, state, travelToZone, completeDungeon,
  tickHotbarCooldowns,
  ensureAmmoInitialized, getAmmoWeaponIds, rocketAmmoMax,
  getActiveAmmoType,
} from "./store";
import {
  DRONE_DEFS, Drone, DUNGEONS, ENEMY_DEFS, ENEMY_NAMES, EXP_FOR_LEVEL,
  Enemy, EnemyType, FACTION_ENEMY_MODS, FACTIONS, MODULE_DEFS, ModuleStats,
  PORTALS, ROCKET_AMMO_TYPE_DEFS,
  SHIP_CLASSES, STATIONS, ZONES, ZoneId,
  rankFor,
} from "./types";
import { sfx } from "./sound";

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
    hullMax: 0, speed: 0, damageReduction: 0, cargoBonus: 0, lootBonus: 0, aoeRadius: 0,
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
    acc.cargoBonus      += s.cargoBonus ?? 0;
    acc.lootBonus       += s.lootBonus ?? 0;
    acc.aoeRadius       = Math.max(acc.aoeRadius, s.aoeRadius ?? 0);
  }
  return acc;
}

let last = performance.now();
let raf = 0;
let enemySpawnTimer = 0;
let saveTimer = 0;
let chatTimer = 6;
let aiUpdateTimer = 0;
let trailTimer = 0;
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

// ── PLAYER STATS (with drone bonuses + skills + faction) ─────────────────
export function effectiveStats(): {
  damage: number; speed: number; hullMax: number; shieldMax: number;
  fireRate: number; critChance: number; aoeRadius: number; damageReduction: number; shieldRegen: number; lootBonus: number;
} {
  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];

  const skOffPower  = p.skills["off-power"]  ?? 0;
  const skOffRapid  = p.skills["off-rapid"]  ?? 0;
  const skOffCrit   = p.skills["off-crit"]   ?? 0;
  const skOffPierce = p.skills["off-pierce"] ?? 0;
  const skDefShield = p.skills["def-shield"] ?? 0;
  const skDefRegen  = p.skills["def-regen"]  ?? 0;
  const skDefArmor  = p.skills["def-armor"]  ?? 0;
  const skDefBulw   = p.skills["def-bulwark"] ?? 0;
  const skUtThrust  = p.skills["ut-thrust"]  ?? 0;

  const mod = sumEquippedStats() as Required<ModuleStats>;
  let damage = (cls.baseDamage + mod.damage) * (1 + skOffPower * 0.05);
  let hullMax = (cls.hullMax + (mod.hullMax ?? 0)) * (1 + skDefArmor * 0.08);
  let shieldMax = (cls.shieldMax + (mod.shieldMax ?? 0)) * (1 + skDefShield * 0.08);
  let speed = (cls.baseSpeed + (mod.speed ?? 0)) * (1 + skUtThrust * 0.05);
  let shieldRegen = 5 + (mod.shieldRegen ?? 0);
  let damageReduction = (skDefBulw * 0.04) + (mod.damageReduction ?? 0);
  let aoeRadius = (skOffPierce * 4) + (mod.aoeRadius ?? 0);
  let critChance = 0.05 + skOffCrit * 0.03 + (mod.critChance ?? 0);
  let fireRate = (1 + skOffRapid * 0.05) * (mod.fireRate ?? 1);
  let lootBonus = mod.lootBonus ?? 0;

  for (const d of p.drones) {
    const def = DRONE_DEFS[d.kind];
    damage += def.damageBonus;
    hullMax += def.hullBonus;
    shieldMax += def.shieldBonus;
  }

  if (p.faction) {
    const f = FACTIONS[p.faction].bonus;
    if (f.damage)      damage *= (1 + f.damage);
    if (f.speed)       speed *= (1 + f.speed);
    if (f.shieldRegen) shieldRegen *= f.shieldRegen;
    if (f.lootBonus)   lootBonus += f.lootBonus;
  }
  shieldRegen *= (1 + skDefRegen * 0.15);

  return { damage, speed, hullMax, shieldMax, fireRate, critChance, aoeRadius, damageReduction, shieldRegen, lootBonus };
}

export function queueAttackTarget(enemyId: string): void {
  queuedAttackTargetId = enemyId;
}

// ── SPAWN ──────────────────────────────────────────────────────────────────
function spawnEnemy(): void {
  const z = ZONES[state.player.zone];
  if (state.enemies.filter((e) => !e.isBoss).length >= 8 + z.enemyTier * 2) return;
  const type: EnemyType = z.enemyTypes[Math.floor(Math.random() * z.enemyTypes.length)];
  const def = ENEMY_DEFS[type];
  const angle = Math.random() * Math.PI * 2;
  const dist = 700 + Math.random() * 400;
  const px = state.player.pos.x + Math.cos(angle) * dist;
  const py = state.player.pos.y + Math.sin(angle) * dist;
  const tierMult = 1 + (z.enemyTier - 1) * 0.25;
  const namePool = ENEMY_NAMES[type];
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
  });
}

// ── DUNGEON ───────────────────────────────────────────────────────────────
let dungeonSpawnCd = 0;

function spawnDungeonEnemy(type: EnemyType, hpMul: number, dmgMul: number): void {
  const def = ENEMY_DEFS[type];
  const angle = Math.random() * Math.PI * 2;
  const dist = 480 + Math.random() * 220;
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
  });
}

function updateDungeon(dt: number): void {
  const run = state.dungeon;
  if (!run) return;
  const def = DUNGEONS[run.id];
  const aliveCount = state.enemies.length;
  // Spawn the wave's enemies (staggered)
  if (!run.spawnedThisWave) {
    dungeonSpawnCd -= dt;
    if (dungeonSpawnCd <= 0) {
      const spawned = aliveCount;
      const target = def.enemiesPerWave;
      if (spawned < target) {
        const t: EnemyType = def.enemyTypes[Math.floor(Math.random() * def.enemyTypes.length)];
        spawnDungeonEnemy(t, def.enemyHpMul, def.enemyDmgMul);
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
    run.enemiesLeft = def.enemiesPerWave;
    dungeonSpawnCd = 1.2;
    pushEvent({ title: `▼ WAVE ${run.wave} / ${run.totalWaves}`, body: `Hostiles re-engaging.`, ttl: 3.5, kind: "info", color: def.color });
    sfx.bossWarn();
  }
}

function spawnBoss(): void {
  const z = ZONES[state.player.zone];
  const tierMult = 1 + (z.enemyTier - 1) * 0.25;
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

function emitRing(x: number, y: number, color: string): void {
  state.particles.push({
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: 0.35, maxTtl: 0.35,
    color, size: 4, kind: "ring",
  });
}

function emitTrail(x: number, y: number, color: string): void {
  state.particles.push({
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: 0.5, maxTtl: 0.5,
    color, size: 3, kind: "trail",
  });
}

function emitDeath(x: number, y: number, color: string, big = false): void {
  const B = big;

  // Central white flash bloom
  state.particles.push({
    id: `fl-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: B ? 0.22 : 0.15, maxTtl: B ? 0.22 : 0.15,
    color: B ? "#ffffff" : "#ffcc66",
    size: B ? 80 : 40, kind: "flash",
  });
  state.particles.push({
    id: `fl2-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: B ? 0.18 : 0.12, maxTtl: B ? 0.18 : 0.12,
    color, size: B ? 60 : 28, kind: "flash",
  });

  // Fireballs — orange/red blobs that linger and expand
  const fbColors = ["#ff8c00", "#ff4500", "#ffd700", "#ff6600"];
  const fbCount = B ? 5 : 3;
  for (let i = 0; i < fbCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = (0.2 + Math.random() * 0.5) * (B ? 55 : 35);
    state.particles.push({
      id: `fb-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6 },
      vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
      ttl: 0.35 + Math.random() * 0.25, maxTtl: 0.6,
      color: fbColors[Math.floor(Math.random() * fbColors.length)],
      size: B ? (55 + Math.random() * 35) : (28 + Math.random() * 18),
      kind: "fireball",
    });
  }

  // Smoke puffs — dark expanding circles that billow and linger
  const smokeCount = B ? 8 : 4;
  for (let i = 0; i < smokeCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = (0.1 + Math.random() * 0.35) * (B ? 40 : 25);
    state.particles.push({
      id: `sm-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8 },
      vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
      ttl: 0.7 + Math.random() * 0.5, maxTtl: 1.2,
      color: i % 2 === 0 ? "#222" : "#444",
      size: B ? (30 + Math.random() * 25) : (16 + Math.random() * 14),
      kind: "smoke",
    });
  }

  // Spinning hull debris chunks
  const debrisCount = B ? 18 : 8;
  const debrisColors = [color, "#ff8a4e", "#ffd24a", "#ffccaa", "#cccccc"];
  for (let i = 0; i < debrisCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = (0.3 + Math.random() * 0.7) * (B ? 100 : 65);
    state.particles.push({
      id: `db-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x, y },
      vel: { x: Math.cos(a) * spd, y: Math.sin(a) * spd },
      ttl: 0.5 + Math.random() * 0.5, maxTtl: 1.0,
      color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
      size: B ? (5 + Math.random() * 7) : (3 + Math.random() * 4),
      rot: Math.random() * Math.PI * 2,
      rotVel: (Math.random() - 0.5) * 14,
      kind: "debris",
    });
  }

  // Sparks — three tiers
  emitSpark(x, y, "#ffffff", B ? 20 : 8, B ? 280 : 210, B ? 3 : 2);
  emitSpark(x, y, color, B ? 40 : 16, B ? 190 : 140, B ? 4 : 3);
  emitSpark(x, y, "#ffd24a", B ? 25 : 8, B ? 110 : 75, B ? 3 : 2);

  // Rings — staggered
  emitRing(x, y, "#ffffff");
  emitRing(x, y, color);
  if (B) {
    setTimeout(() => emitRing(x, y, "#ffd24a"), 80);
    setTimeout(() => emitRing(x, y, color), 160);
    setTimeout(() => emitRing(x, y, "#ffffff"), 280);
    setTimeout(() => emitRing(x, y, "#ff8a4e"), 400);
  } else {
    setTimeout(() => emitRing(x, y, "#ffd24a"), 80);
  }
}

// ── PROJECTILES ───────────────────────────────────────────────────────────
function fireProjectile(
  from: "player" | "enemy" | "drone",
  x: number, y: number, angle: number, damage: number, color: string, size = 3,
  opts?: { crit?: boolean; aoeRadius?: number; speedMul?: number; homing?: boolean; empStun?: number; armorPiercing?: boolean },
): void {
  const speedBase = from === "player" ? 560 : from === "drone" ? 480 : 320;
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
  });
}

function hasRocketWeapon(): boolean {
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
    // Scale shake by proximity — enemies > 700 u away don't shake the camera.
    // baseShake: large=0.32 (~0.2 s), small=0.16 (~0.1 s) at decay rate 1.6/s.
    const dist = Math.hypot(e.pos.x - state.player.pos.x, e.pos.y - state.player.pos.y);
    const proximity = Math.max(0, 1 - dist / 700);
    const baseShake = e.size > 16 ? 0.32 : 0.16;
    state.cameraShake = Math.max(state.cameraShake, baseShake * proximity);
  }

  const expGain = e.exp;
  const credGain = e.credits + (state.player.skills["ut-salvage"] ?? 0) * Math.max(1, Math.floor(e.honor));
  const honorGain = e.honor;

  state.player.exp += expGain;
  state.player.credits += credGain;
  const prevCredEarned = state.player.milestones.totalCreditsEarned;
  state.player.milestones.totalCreditsEarned += credGain;
  checkMilestoneTier("totalCreditsEarned", prevCredEarned, state.player.milestones.totalCreditsEarned);

  const prevRank = rankFor(state.player.honor).index;
  state.player.honor += honorGain;
  pushHonor(honorGain);
  const newRank = rankFor(state.player.honor).index;
  if (newRank > prevRank) {
    pushNotification(`PROMOTED → ${rankFor(state.player.honor).name}`, "good");
    pushChat("system", "SYSTEM", `You earned the rank of ${rankFor(state.player.honor).name}.`);
  }

  // Floating numbers at enemy pos
  pushFloater({ text: `+${expGain} XP`, color: "#ff5cf0", x: e.pos.x, y: e.pos.y - 12, scale: 1.1, bold: true });
  pushFloater({ text: `+${credGain}cr`, color: "#ffd24a", x: e.pos.x + 14, y: e.pos.y, scale: 1, ttl: 0.9 });
  if (honorGain > 0) {
    pushFloater({ text: `+${honorGain} ✪`, color: rankFor(state.player.honor).color, x: e.pos.x - 14, y: e.pos.y + 12, ttl: 1, scale: 0.9 });
  }

  // Loot
  if (e.loot) {
    const hasSalvage = state.player.drones.some((d) => d.kind === "salvage");
    const qty = e.loot.qty + (hasSalvage ? 1 : 0) + stats.lootBonus;
    const got = addCargo(e.loot.resourceId, qty);
    if (got > 0) {
      pushFloater({ text: `+${got} loot`, color: "#5cff8a", x: e.pos.x, y: e.pos.y + 24, scale: 0.85, ttl: 0.9 });
      sfx.pickup();
    } else {
      pushNotification("Cargo bay full", "bad");
    }
  }

  // Ammo scavenge: ~18% chance to recover 1 rocket round from debris
  if (Math.random() < 0.18) {
    const rocketIds = getAmmoWeaponIds();
    if (rocketIds.length > 0) {
      const max = rocketAmmoMax();
      // Give ammo to the weapon with the lowest current count
      let lowestId = rocketIds[0];
      let lowestCur = state.player.ammo[lowestId] ?? 0;
      for (const rid of rocketIds) {
        const c = state.player.ammo[rid] ?? 0;
        if (c < lowestCur) { lowestId = rid; lowestCur = c; }
      }
      if (lowestCur < max) {
        state.player.ammo[lowestId] = Math.min(max, lowestCur + 1);
        pushFloater({ text: "+1 ammo", color: "#ff8a4e", x: e.pos.x + 20, y: e.pos.y - 18, scale: 0.8, ttl: 0.7 });
      }
    }
  }

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
    pushFloater({ text: "CRIT!", color: "#ffd24a", x: e.pos.x, y: e.pos.y - 28, scale: 1.4, bold: true, ttl: 0.7 });
  }

  tryLevelUp();
}

function damagePlayer(amount: number): void {
  const p = state.player;
  const stats = effectiveStats();
  amount *= Math.max(0.2, 1 - stats.damageReduction);

  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, amount);
    p.shield -= absorbed;
    amount -= absorbed;
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
      sfx.explosion(true);
      state.cameraShake = 1;
    }
  }
}

function damageDrone(d: { id: string; hp: number; hpMax: number }, amount: number): boolean {
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

function tickWorld(dt: number): void {
  state.tick += dt;
  if (state.levelUpFlash > 0) state.levelUpFlash = Math.max(0, state.levelUpFlash - dt);
  if (state.playerDeathFlash > 0) state.playerDeathFlash = Math.max(0, state.playerDeathFlash - dt);
  if (state.cameraShake > 0) state.cameraShake = Math.max(0, state.cameraShake - dt * 1.6);

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
      p2.pos = { x: 0, y: 80 };
      p2.vel = { x: 0, y: 0 };
      state.cameraTarget = { ...p2.pos };
      state.enemies = [];
      bossActive = false;
      pushNotification(`Ship destroyed. -${lostCr}cr. Respawned.`, "bad");
      pushChat("system", "SYSTEM", `Your ship was destroyed. -${lostCr} credits.`);
    }
    // Keep VFX alive during the death window so explosion particles animate
    for (const pa of state.particles) {
      pa.pos.x += pa.vel.x * dt; pa.pos.y += pa.vel.y * dt;
      pa.vel.x *= 0.95; pa.vel.y *= 0.95;
      if (pa.rotVel !== undefined && pa.rot !== undefined) pa.rot += pa.rotVel * dt;
      pa.ttl -= dt;
    }
    state.particles = state.particles.filter((pa) => pa.ttl > 0);
    for (const f of state.floaters) { f.pos.y += f.vy * dt; f.vy *= 0.96; f.ttl -= dt; }
    state.floaters = state.floaters.filter((f) => f.ttl > 0);
    for (const ev of state.events) ev.ttl -= dt;
    state.events = state.events.filter((ev) => ev.ttl > 0);
    return; // skip combat/movement/AI while awaiting respawn
  }
  tickHotbarCooldowns(dt);
  const p = state.player;
  const stats = effectiveStats();

  // ── Consumable: Repair Bot HoT
  if (state.repairBotUntil > 0 && state.tick < state.repairBotUntil) {
    const cls = SHIP_CLASSES[p.shipClass];
    p.hull = Math.min(p.hull + (40 / 8) * dt, cls.hullMax);
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
  const dx = state.cameraTarget.x - p.pos.x;
  const dy = state.cameraTarget.y - p.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 6) {
    p.angle = Math.atan2(dy, dx);
    const accel = stats.speed * 4;
    p.vel.x += Math.cos(p.angle) * accel * dt;
    p.vel.y += Math.sin(p.angle) * accel * dt;
  }
  const v = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
  const speedCap = state.afterburnUntil > state.tick ? stats.speed * 3 : stats.speed;
  if (v > speedCap) {
    p.vel.x = (p.vel.x / v) * speedCap;
    p.vel.y = (p.vel.y / v) * speedCap;
  }
  p.vel.x *= 0.96;
  p.vel.y *= 0.96;
  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;

  // ── Engine particles + 16-bit trail
  const cls = SHIP_CLASSES[p.shipClass];
  if (Math.abs(p.vel.x) + Math.abs(p.vel.y) > 30) {
    if (Math.random() < 0.7) {
      const back = p.angle + Math.PI;
      state.particles.push({
        id: `p-${Math.random().toString(36).slice(2, 8)}`,
        pos: { x: p.pos.x + Math.cos(back) * 12, y: p.pos.y + Math.sin(back) * 12 },
        vel: { x: Math.cos(back) * 60 + (Math.random() - 0.5) * 30, y: Math.sin(back) * 60 + (Math.random() - 0.5) * 30 },
        ttl: 0.4, maxTtl: 0.4,
        color: cls.color, size: 2, kind: "engine",
      });
    }
    trailTimer -= dt;
    if (trailTimer <= 0) {
      const back = p.angle + Math.PI;
      emitTrail(p.pos.x + Math.cos(back) * 8, p.pos.y + Math.sin(back) * 8, cls.color);
      trailTimer = 0.05;
    }
  }

  // ── Shield regen
  if (p.shield < stats.shieldMax) {
    p.shield = Math.min(stats.shieldMax, p.shield + stats.shieldRegen * dt);
  }

  // ── Enemies spawn (dungeon mode replaces ambient spawning)
  if (state.dungeon) {
    updateDungeon(dt);
  } else {
    enemySpawnTimer -= dt;
    if (enemySpawnTimer <= 0) {
      spawnEnemy();
      enemySpawnTimer = 1.6 + Math.random() * 1.4;
    }
  }

  // ── Boss event timer (only when no boss currently active and not in dungeon)
  if (!bossActive && !state.dungeon) {
    state.bossSpawnTimer -= dt;
    // pre-warning event 30s before
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
      state.bossSpawnTimer = 300 + Math.random() * 120; // 5-7 min cycle
    }
  }

  // ── Update enemies (varied AI per behavior)
  for (const e of state.enemies) {
    const exd = p.pos.x - e.pos.x;
    const eyd = p.pos.y - e.pos.y;
    const ed = Math.sqrt(exd * exd + eyd * eyd);
    e.angle = Math.atan2(eyd, exd);
    if (e.hitFlash !== undefined && e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
    if (e.combo) {
      e.combo.ttl -= dt;
      if (e.combo.ttl <= 0) e.combo = undefined;
    }
    // EMP stun: skip AI while stunned
    if (e.stunUntil !== undefined && e.stunUntil > state.tick) {
      e.vel.x *= 0.85; e.vel.y *= 0.85;  // decelerate
      e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt;
      continue;
    }

    if (e.behavior === "fast") {
      // zigzag fast pursuit
      const wobble = Math.sin(state.tick * 5 + (e.pos.x + e.pos.y)) * 0.6;
      const ang = e.angle + wobble;
      e.vel.x = Math.cos(ang) * e.speed;
      e.vel.y = Math.sin(ang) * e.speed;
    } else if (e.behavior === "ranged") {
      // kite at ~340px range
      const ideal = 340;
      const speed = e.speed * (ed < ideal - 40 ? -1 : ed > ideal + 40 ? 1 : 0.2);
      e.vel.x = Math.cos(e.angle) * speed;
      e.vel.y = Math.sin(e.angle) * speed;
    } else if (e.behavior === "tank") {
      // slow steady advance, hold at ~120
      if (ed > 140) {
        e.vel.x = Math.cos(e.angle) * e.speed;
        e.vel.y = Math.sin(e.angle) * e.speed;
      } else {
        e.vel.x *= 0.85;
        e.vel.y *= 0.85;
      }
    } else {
      // chaser default
      if (ed > 80) {
        e.vel.x = Math.cos(e.angle) * e.speed;
        e.vel.y = Math.sin(e.angle) * e.speed;
      } else {
        e.vel.x *= 0.9;
        e.vel.y *= 0.9;
      }
    }
    e.pos.x += e.vel.x * dt;
    e.pos.y += e.vel.y * dt;

    // Firing: ranged fires more, tanks fire bursts, bosses fire spread
    e.fireCd -= dt;
    if (e.isBoss) {
      if (e.fireCd <= 0 && ed < 600) {
        // 5-shot spread
        for (let i = -2; i <= 2; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.18, e.damage, e.color, 4, { speedMul: 0.9 });
        }
        e.fireCd = 1.6;
        // burst follow-up: 3 quick shots after a beat
        e.burstShots = 3;
        e.burstCd = 0.2;
      }
      if ((e.burstShots ?? 0) > 0) {
        e.burstCd = (e.burstCd ?? 0) - dt;
        if ((e.burstCd ?? 0) <= 0) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage * 0.7, e.color, 3);
          e.burstShots = (e.burstShots ?? 0) - 1;
          e.burstCd = 0.18;
        }
      }
    } else if (e.behavior === "ranged") {
      if (e.fireCd <= 0 && ed < 460) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color);
        e.fireCd = 0.8 + Math.random() * 0.6;
      }
    } else if (e.behavior === "tank") {
      if (e.fireCd <= 0 && ed < 420) {
        // small burst of 2
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle - 0.08, e.damage * 0.9, e.color);
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + 0.08, e.damage * 0.9, e.color);
        e.fireCd = 1.8 + Math.random() * 0.8;
      }
    } else if (e.behavior === "fast") {
      if (e.fireCd <= 0 && ed < 220) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color, 2);
        e.fireCd = 0.7 + Math.random() * 0.6;
      }
    } else {
      if (e.fireCd <= 0 && ed < 480) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color);
        e.fireCd = 1.4 + Math.random() * 1.2;
      }
    }
  }

  playerFireCd.value -= dt;
  if (queuedAttackTargetId) {
    const enemy = state.enemies.find((e) => e.id === queuedAttackTargetId);
    if (enemy && playerFireCd.value <= 0) {
      const ang = Math.atan2(enemy.pos.y - p.pos.y, enemy.pos.x - p.pos.x);
      const stats = effectiveStats();
      const ammoType = getActiveAmmoType(p.equipped.weapon.find(Boolean) ?? "");
      if (ammoType === "x1") {
        const weaponId = p.equipped.weapon.find(Boolean);
        if (weaponId && (p.ammo[weaponId] ?? 0) > 0) {
          p.ammo[weaponId] -= 1;
          fireProjectile("player", p.pos.x, p.pos.y, ang, stats.damage, "#4ee2ff", 4);
          playerFireCd.value = Math.max(0.10, 0.45 / stats.fireRate);
        } else {
          pushNotification("No X1 ammo loaded", "bad");
        }
      }
    }
    queuedAttackTargetId = null;
  }

  // ── Update drones (mode-aware: orbit/forward/defensive)
  const droneCount = p.drones.length;
  let nearest: Enemy | null = null;
  let nearestD = 600;
  for (const e of state.enemies) {
    const d = distance(p.pos.x, p.pos.y, e.pos.x, e.pos.y);
    const adj = d * (e.isBoss ? 0.6 : 1);
    if (adj < nearestD) { nearest = e; nearestD = adj; }
  }
  for (let i = 0; i < droneCount; i++) {
    const d = p.drones[i];
    const def = DRONE_DEFS[d.kind];
    d.orbitPhase += dt * 1.5;

    let radius = 38 + (i % 2) * 12;
    let centerX = p.pos.x;
    let centerY = p.pos.y;
    let ang = d.orbitPhase + (i / Math.max(1, droneCount)) * Math.PI * 2;
    if (d.mode === "forward" && nearest) {
      // sit between player and target
      const tx = (p.pos.x + nearest.pos.x) / 2;
      const ty = (p.pos.y + nearest.pos.y) / 2;
      centerX = tx; centerY = ty;
      radius = 18;
    } else if (d.mode === "defensive") {
      radius = 24;
    }
    (d as Drone & { anchor?: { x: number; y: number } }).anchor = {
      x: centerX + Math.cos(ang) * radius,
      y: centerY + Math.sin(ang) * radius,
    };
    if (def.fireRate > 0) {
      d.fireCd -= dt;
      if (d.fireCd <= 0 && nearest) {
        const dpos = (d as Drone & { anchor: { x: number; y: number } }).anchor;
        const fireRange = d.mode === "defensive" ? 280 : 720;
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
    if (pr.fromPlayer) {
      // hit enemies
      for (const e of state.enemies) {
        if (distance(pr.pos.x, pr.pos.y, e.pos.x, e.pos.y) < e.size + 4) {
          // combo bonus
          const stacks = e.combo ? Math.min(5, e.combo.stacks + 1) : 1;
          e.combo = { stacks, ttl: 3 };
          const comboMul = 1 + (stacks - 1) * 0.10;
          const dmg = pr.damage * comboMul;
          e.hull -= dmg;
          e.hitFlash = 1;
          emitSpark(pr.pos.x, pr.pos.y, e.color, pr.crit ? 8 : 4, pr.crit ? 140 : 80, 2);
          emitRing(pr.pos.x, pr.pos.y, pr.color);
          // damage floater
          pushFloater({
            text: pr.crit ? `${Math.round(dmg)}!` : `${Math.round(dmg)}`,
            color: pr.crit ? "#ffd24a" : "#e8f0ff",
            x: e.pos.x + (Math.random() - 0.5) * 14,
            y: e.pos.y - e.size - 6,
            scale: pr.crit ? 1.3 : 0.9, ttl: 0.6, bold: pr.crit,
          });
          if (stacks >= 3) {
            pushFloater({ text: `x${stacks}`, color: "#ff5cf0", x: e.pos.x, y: e.pos.y + e.size + 8, scale: 0.9, ttl: 0.5 });
          }
          // EMP stun: disable enemy fire/movement briefly
          if (pr.empStun && pr.empStun > 0) {
            e.stunUntil = state.tick + pr.empStun;
            pushFloater({ text: "EMP!", color: "#ffd24a", x: e.pos.x, y: e.pos.y - e.size - 14, scale: 1.1, ttl: 0.9, bold: true });
            emitRing(pr.pos.x, pr.pos.y, "#ffd24a");
          }
          // AP floater
          if (pr.armorPiercing) {
            pushFloater({ text: "AP", color: "#ff5c6c", x: e.pos.x + 10, y: e.pos.y - e.size - 8, scale: 0.85, ttl: 0.5 });
          }
          // splash
          if (pr.aoeRadius && pr.aoeRadius > 0) {
            for (const e2 of state.enemies) {
              if (e2.id === e.id) continue;
              if (distance(e.pos.x, e.pos.y, e2.pos.x, e2.pos.y) < pr.aoeRadius * 8) {
                e2.hull -= dmg * 0.4;
                e2.hitFlash = 1;
              }
            }
            emitRing(pr.pos.x, pr.pos.y, "#ffaa44");
          }
          if (e.hull <= 0) applyKill(e, !!pr.crit);
          return false;
        }
      }
      // hit asteroids
      for (const a of state.asteroids) {
        if (a.zone !== state.player.zone) continue;
        if (distance(pr.pos.x, pr.pos.y, a.pos.x, a.pos.y) < a.size + 2) {
          a.hp -= pr.damage;
          emitSpark(pr.pos.x, pr.pos.y, "#c69060", 3, 60, 2);
          state.miningTargetId = a.id;   // track for laser beam visual
          if (a.hp <= 0) { state.miningTargetId = null; destroyAsteroid(a.id); }
          return false;
        }
      }
      // Clear stale mining target if no projectile hit this frame
      // (cleared each ~300ms naturally since miningTargetId only updates on hit)
    } else {
      // enemy projectile -> hit drones first, then player
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
      if (distance(pr.pos.x, pr.pos.y, p.pos.x, p.pos.y) < 12) {
        damagePlayer(pr.damage);
        return false;
      }
    }
    return true;
  });

  state.enemies = state.enemies.filter((e) => e.hull > 0);

  // ── Particles update
  for (const pa of state.particles) {
    pa.pos.x += pa.vel.x * dt;
    pa.pos.y += pa.vel.y * dt;
    pa.vel.x *= 0.95;
    pa.vel.y *= 0.95;
    if (pa.rotVel !== undefined && pa.rot !== undefined) {
      pa.rot += pa.rotVel * dt;
    }
    pa.ttl -= dt;
  }
  state.particles = state.particles.filter((pa) => pa.ttl > 0);
  if (state.particles.length > 320) {
    state.particles.splice(0, state.particles.length - 320);
  }

  // ── Floaters update
  for (const f of state.floaters) {
    f.pos.y += f.vy * dt;
    f.vy *= 0.96;
    f.ttl -= dt;
  }
  state.floaters = state.floaters.filter((f) => f.ttl > 0);

  // ── Events ttl
  for (const ev of state.events) ev.ttl -= dt;
  state.events = state.events.filter((ev) => ev.ttl > 0);

  // ── AI other players drift
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

  // ── Auto chat chatter
  chatTimer -= dt;
  if (chatTimer <= 0) {
    const o = state.others[Math.floor(Math.random() * state.others.length)];
    if (o) pushChat("local", o.name, CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]);
    chatTimer = 8 + Math.random() * 10;
  }

  // ── Notification ttl
  for (const n of state.notifications) n.ttl -= dt;
  state.notifications = state.notifications.filter((n) => n.ttl > 0);
  if (state.notifications.length > 5) {
    state.notifications.splice(0, state.notifications.length - 5);
  }
  for (const h of state.recentHonor) h.ttl -= dt;
  state.recentHonor = state.recentHonor.filter((h) => h.ttl > 0);

  // ── Asteroid rotation
  for (const a of state.asteroids) a.rotation += a.rotSpeed * dt;

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
  emitSpark(a.pos.x, a.pos.y, "#c69060", 16, 120, 3);
  emitSpark(a.pos.x, a.pos.y, "#7a5028", 8, 80, 2);
  emitDeath(a.pos.x, a.pos.y, a.yields === "lumenite" ? "#80b0b0" : "#c0a070", false);
  sfx.explosion();
  const qty = 2 + Math.floor(Math.random() * 3);
  const got = addCargo(a.yields, qty);
  if (got > 0) {
    pushFloater({ text: `+${got} ${a.yields === "iron" ? "Iron" : "Lumenite"}`, color: "#5cff8a", x: a.pos.x, y: a.pos.y - 12, scale: 1, ttl: 0.9 });
    sfx.pickup();
    state.player.milestones.totalMined += got;
    bumpMission("mine", got);
    const prev = state.player.milestones.totalMined - got;
    checkMilestoneTier("totalMined", prev, state.player.milestones.totalMined);
  } else {
    pushNotification("Cargo full — ore lost", "bad");
  }
  state.asteroids = state.asteroids.filter((x) => x.id !== id);
  setTimeout(() => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1200 + Math.random() * 1200;
    const yieldsLumenite = Math.random() < 0.18;
    state.asteroids.push({
      id: `ast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      pos: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
      hp: 80, hpMax: 80, size: 16 + Math.random() * 14,
      rotation: 0, rotSpeed: (Math.random() - 0.5) * 0.4,
      zone: state.player.zone,
      yields: yieldsLumenite ? "lumenite" : "iron",
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
    travelToZone(portal.toZone);
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
