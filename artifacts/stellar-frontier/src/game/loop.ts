import {
  bump,
  pushChat,
  pushNotification,
  refreshOthers,
  save,
  state,
} from "./store";
import {
  ENEMY_DEFS,
  EXP_FOR_LEVEL,
  Enemy,
  EnemyType,
  Particle,
  PORTALS,
  Projectile,
  SHIP_CLASSES,
  STATIONS,
  ZONES,
  ZoneId,
} from "./types";

let last = performance.now();
let raf = 0;
let enemySpawnTimer = 0;
let saveTimer = 0;
let chatTimer = 6;
let aiUpdateTimer = 0;

const CHAT_LINES = [
  "anyone selling void crystals?",
  "wtb plasma cells, 35cr each",
  "raider stronghold spotted near veiled outpost",
  "lfg crimson dread x2",
  "nebula portal is HOT, watch yourselves",
  "just hit lvl 10 lets gooo",
  "this thruster mk3 hits different",
  "obsidian build > vanguard, fight me",
  "anyone in my clan online?",
  "scout swarm @ alpha sector",
  "anyone got spare scrap plating",
];

function spawnEnemy(): void {
  const z = ZONES[state.player.zone];
  if (state.enemies.length >= 8 + z.enemyTier * 2) return;
  const type: EnemyType = z.enemyTypes[Math.floor(Math.random() * z.enemyTypes.length)];
  const def = ENEMY_DEFS[type];
  const angle = Math.random() * Math.PI * 2;
  const dist = 700 + Math.random() * 400;
  const px = state.player.pos.x + Math.cos(angle) * dist;
  const py = state.player.pos.y + Math.sin(angle) * dist;
  const tierMult = 1 + (z.enemyTier - 1) * 0.25;
  state.enemies.push({
    id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    pos: { x: px, y: py },
    vel: { x: 0, y: 0 },
    angle: 0,
    hull: def.hullMax * tierMult,
    hullMax: def.hullMax * tierMult,
    damage: def.damage * tierMult,
    speed: def.speed,
    fireCd: Math.random() * 2,
    exp: Math.round(def.exp * tierMult),
    credits: Math.round(def.credits * tierMult),
    color: def.color,
    size: def.size,
    loot: def.loot,
  });
}

function emitParticles(x: number, y: number, color: string, count: number, speed = 80, size = 2): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.4 + Math.random() * 0.6) * speed;
    state.particles.push({
      id: `p-${Math.random().toString(36).slice(2, 8)}`,
      pos: { x, y },
      vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
      ttl: 0.5 + Math.random() * 0.6,
      maxTtl: 1,
      color,
      size,
    });
  }
}

function fireProjectile(from: "player" | "enemy", x: number, y: number, angle: number, damage: number, color: string): void {
  const speed = from === "player" ? 520 : 320;
  state.projectiles.push({
    id: `pr-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    damage,
    ttl: 1.6,
    fromPlayer: from === "player",
    color,
  });
}

function tryLevelUp(): void {
  const p = state.player;
  while (p.exp >= EXP_FOR_LEVEL(p.level)) {
    p.exp -= EXP_FOR_LEVEL(p.level);
    p.level++;
    pushNotification(`LEVEL UP! Now level ${p.level}`, "good");
    pushChat("system", "SYSTEM", `You reached level ${p.level}.`);
    const cls = SHIP_CLASSES[p.shipClass];
    p.hull = cls.hullMax;
    p.shield = cls.shieldMax;
  }
}

function killEnemy(e: Enemy): void {
  emitParticles(e.pos.x, e.pos.y, e.color, 24, 160, 3);
  emitParticles(e.pos.x, e.pos.y, "#ffd24a", 10, 100, 2);
  state.player.exp += e.exp;
  state.player.credits += e.credits;
  pushNotification(`+${e.exp} XP  +${e.credits}cr`, "good");
  if (e.loot && state.player.cargo.length < SHIP_CLASSES[state.player.shipClass].cargoMax) {
    const existing = state.player.cargo.find((c) => c.name === e.loot!.name);
    if (existing) {
      existing.qty++;
    } else {
      state.player.cargo.push({
        id: `cargo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: e.loot.name,
        qty: 1,
        pricePerUnit: e.loot.price,
      });
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
  tryLevelUp();
}

function damagePlayer(amount: number): void {
  const p = state.player;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, amount);
    p.shield -= absorbed;
    amount -= absorbed;
  }
  if (amount > 0) {
    p.hull -= amount;
    if (p.hull <= 0) {
      // Death: respawn at station
      p.hull = SHIP_CLASSES[p.shipClass].hullMax;
      p.shield = SHIP_CLASSES[p.shipClass].shieldMax;
      const lostCr = Math.floor(p.credits * 0.1);
      p.credits = Math.max(0, p.credits - lostCr);
      p.pos = { x: 0, y: 80 };
      p.vel = { x: 0, y: 0 };
      state.cameraTarget = { ...p.pos };
      state.enemies = [];
      pushNotification(`Ship destroyed. -${lostCr}cr. Respawned.`, "bad");
      pushChat("system", "SYSTEM", `Your ship was destroyed. -${lostCr} credits.`);
    }
  }
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function startLoop(): void {
  if (raf) return;
  last = performance.now();
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!state.paused && !state.dockedAt) {
      tickWorld(dt);
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

export function stopLoop(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function tickWorld(dt: number): void {
  state.tick += dt;
  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];
  const speed = cls.baseSpeed + p.equipment.thrusterTier * 30;
  const damage = cls.baseDamage + p.equipment.laserTier * 6;
  const shieldMax = cls.shieldMax + p.equipment.shieldTier * 25;

  // Player movement toward cameraTarget
  const dx = state.cameraTarget.x - p.pos.x;
  const dy = state.cameraTarget.y - p.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 6) {
    p.angle = Math.atan2(dy, dx);
    const accel = speed * 4;
    p.vel.x += Math.cos(p.angle) * accel * dt;
    p.vel.y += Math.sin(p.angle) * accel * dt;
  }
  // Cap velocity
  const v = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
  if (v > speed) {
    p.vel.x = (p.vel.x / v) * speed;
    p.vel.y = (p.vel.y / v) * speed;
  }
  // Drag
  p.vel.x *= 0.96;
  p.vel.y *= 0.96;
  p.pos.x += p.vel.x * dt;
  p.pos.y += p.vel.y * dt;

  // Engine particles
  if (Math.abs(p.vel.x) + Math.abs(p.vel.y) > 30 && Math.random() < 0.7) {
    const back = p.angle + Math.PI;
    state.particles.push({
      id: `p-${Math.random().toString(36).slice(2, 8)}`,
      pos: {
        x: p.pos.x + Math.cos(back) * 12,
        y: p.pos.y + Math.sin(back) * 12,
      },
      vel: {
        x: Math.cos(back) * 60 + (Math.random() - 0.5) * 30,
        y: Math.sin(back) * 60 + (Math.random() - 0.5) * 30,
      },
      ttl: 0.4,
      maxTtl: 0.4,
      color: cls.color,
      size: 2,
    });
  }

  // Shield regen
  if (p.shield < shieldMax) {
    p.shield = Math.min(shieldMax, p.shield + (5 + p.equipment.shieldTier * 2) * dt);
  }

  // Spawn enemies
  enemySpawnTimer -= dt;
  if (enemySpawnTimer <= 0) {
    spawnEnemy();
    enemySpawnTimer = 1.6 + Math.random() * 1.4;
  }

  // Update enemies
  for (const e of state.enemies) {
    const exd = p.pos.x - e.pos.x;
    const eyd = p.pos.y - e.pos.y;
    const ed = Math.sqrt(exd * exd + eyd * eyd);
    e.angle = Math.atan2(eyd, exd);
    if (ed > 80) {
      e.vel.x = Math.cos(e.angle) * e.speed;
      e.vel.y = Math.sin(e.angle) * e.speed;
    } else {
      e.vel.x *= 0.9;
      e.vel.y *= 0.9;
    }
    e.pos.x += e.vel.x * dt;
    e.pos.y += e.vel.y * dt;

    e.fireCd -= dt;
    if (e.fireCd <= 0 && ed < 480) {
      fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color);
      e.fireCd = 1.4 + Math.random() * 1.2;
    }
  }

  // Player auto-fire at nearest enemy
  let nearest: Enemy | null = null;
  let nearestD = 520;
  for (const e of state.enemies) {
    const d = distance(p.pos.x, p.pos.y, e.pos.x, e.pos.y);
    if (d < nearestD) {
      nearest = e;
      nearestD = d;
    }
  }
  if (nearest) {
    if (!playerFireCd.value || playerFireCd.value <= 0) {
      const ang = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x);
      fireProjectile("player", p.pos.x, p.pos.y, ang, damage, "#4ee2ff");
      playerFireCd.value = Math.max(0.18, 0.55 - p.equipment.laserTier * 0.04);
    }
  }
  playerFireCd.value -= dt;

  // Update projectiles
  state.projectiles = state.projectiles.filter((pr) => {
    pr.pos.x += pr.vel.x * dt;
    pr.pos.y += pr.vel.y * dt;
    pr.ttl -= dt;
    if (pr.ttl <= 0) return false;
    if (pr.fromPlayer) {
      for (const e of state.enemies) {
        if (distance(pr.pos.x, pr.pos.y, e.pos.x, e.pos.y) < e.size + 4) {
          e.hull -= pr.damage;
          emitParticles(pr.pos.x, pr.pos.y, e.color, 4, 80, 2);
          if (e.hull <= 0) killEnemy(e);
          return false;
        }
      }
    } else {
      if (distance(pr.pos.x, pr.pos.y, p.pos.x, p.pos.y) < 12) {
        damagePlayer(pr.damage);
        emitParticles(pr.pos.x, pr.pos.y, "#ff5cf0", 6, 80, 2);
        return false;
      }
    }
    return true;
  });

  state.enemies = state.enemies.filter((e) => e.hull > 0);

  // Particles
  for (const pa of state.particles) {
    pa.pos.x += pa.vel.x * dt;
    pa.pos.y += pa.vel.y * dt;
    pa.vel.x *= 0.95;
    pa.vel.y *= 0.95;
    pa.ttl -= dt;
  }
  state.particles = state.particles.filter((pa) => pa.ttl > 0);
  if (state.particles.length > 220) {
    state.particles.splice(0, state.particles.length - 220);
  }

  // AI other players drift
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

  // Auto chat chatter
  chatTimer -= dt;
  if (chatTimer <= 0) {
    const o = state.others[Math.floor(Math.random() * state.others.length)];
    if (o) {
      const line = CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)];
      pushChat("local", o.name, line);
    }
    chatTimer = 8 + Math.random() * 10;
  }

  // Notification ttl
  for (const n of state.notifications) n.ttl -= dt;
  state.notifications = state.notifications.filter((n) => n.ttl > 0);
  if (state.notifications.length > 5) {
    state.notifications.splice(0, state.notifications.length - 5);
  }

  // Save periodically
  saveTimer -= dt;
  if (saveTimer <= 0) {
    save();
    saveTimer = 6;
  }

  bump();
}

const playerFireCd = { value: 0 };

export function checkPortal(): void {
  const p = state.player;
  const portal = PORTALS.find(
    (po) => po.fromZone === p.zone && distance(p.pos.x, p.pos.y, po.pos.x, po.pos.y) < 70
  );
  if (portal) {
    // travel handled by store.travelToZone
    travelByPortal(portal.toZone);
  }
}

import { travelToZone } from "./store";
function travelByPortal(zone: ZoneId): void {
  const z = ZONES[zone];
  if (state.player.level < z.unlockLevel) {
    pushNotification(`Need level ${z.unlockLevel} to enter ${z.name}`, "bad");
    return;
  }
  travelToZone(zone);
}

export function checkStationDock(): string | null {
  const p = state.player;
  const station = STATIONS.find(
    (s) => s.zone === p.zone && distance(p.pos.x, p.pos.y, s.pos.x, s.pos.y) < 90
  );
  return station ? station.id : null;
}

// keep imports happy
void refreshOthers;
