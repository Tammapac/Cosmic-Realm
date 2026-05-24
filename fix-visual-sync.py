#!/usr/bin/env python3
"""Fix visual sync issues for other players in multiplayer."""
import re

# ── FIX 1: engine.ts - Only face attack target when actually firing ──
print("FIX 1: engine.ts - angle only when firing...")
with open('backend/src/game/engine.ts', 'r') as f:
    content = f.read()

old = '''      if (p.attackTargetId) {
        const zs = this.zones.get(p.zone);
        if (zs) {
          const enemy = zs.enemies.get(p.attackTargetId);
          if (enemy) {
            p.angle = angleFromTo({ x: p.posX, y: p.posY }, enemy.pos);
          }
        }
      }'''

new = '''      if (p.attackTargetId && (p.isLaserFiring || p.isRocketFiring)) {
        const zs = this.zones.get(p.zone);
        if (zs) {
          const enemy = zs.enemies.get(p.attackTargetId);
          if (enemy) {
            p.angle = angleFromTo({ x: p.posX, y: p.posY }, enemy.pos);
          }
        }
      }'''

if old in content:
    content = content.replace(old, new)
    print("  -> Fixed: angle only updates when firing")
else:
    print("  -> WARNING: Could not find angle code to patch")

# FIX 1b: engine.ts - Push projectile:spawn event for NPC projectiles
old_npc_proj = '''          zs.projectiles.set(npcProj.id, npcProj);
        }

        if (d > 600) {'''

new_npc_proj = '''          zs.projectiles.set(npcProj.id, npcProj);
          events.push({
            type: "projectile:spawn", zone: zoneId, fromPlayerId: 0,
            x: npcProj.pos.x, y: npcProj.pos.y,
            vx: npcProj.vel.x, vy: npcProj.vel.y,
            damage: npcProj.damage, color: npcProj.color, size: npcProj.size,
            crit: false, weaponKind: "laser" as const, homing: false,
          });
        }

        if (d > 600) {'''

if old_npc_proj in content:
    content = content.replace(old_npc_proj, new_npc_proj)
    print("  -> Fixed: NPC projectiles now push projectile:spawn events")
else:
    print("  -> WARNING: Could not find NPC projectile code")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(content)


# ── FIX 2: handler.ts - Broadcast NPC projectiles to entire zone ──
print("FIX 2: handler.ts - broadcast NPC projectiles to zone...")
with open('backend/src/socket/handler.ts', 'r') as f:
    content = f.read()

old_broadcast = '''      case "projectile:spawn": {
        const source = getPlayer(ev.fromPlayerId);
        if (source) {
          const sock = io.sockets.sockets.get(source.socketId);
          if (sock) {
            sock.to(`zone:${ev.zone}`).emit("projectile:spawn", {
              x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy,
              damage: ev.damage, color: ev.color, size: ev.size,
              crit: ev.crit, weaponKind: ev.weaponKind, homing: ev.homing,
              fromPlayer: true,
            });
          }
        }
        break;
      }'''

new_broadcast = '''      case "projectile:spawn": {
        const source = getPlayer(ev.fromPlayerId);
        if (source) {
          const sock = io.sockets.sockets.get(source.socketId);
          if (sock) {
            sock.to(`zone:${ev.zone}`).emit("projectile:spawn", {
              x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy,
              damage: ev.damage, color: ev.color, size: ev.size,
              crit: ev.crit, weaponKind: ev.weaponKind, homing: ev.homing,
              fromPlayer: true,
            });
          }
        } else {
          io.to(`zone:${ev.zone}`).emit("projectile:spawn", {
            x: ev.x, y: ev.y, vx: ev.vx, vy: ev.vy,
            damage: ev.damage, color: ev.color, size: ev.size,
            crit: ev.crit, weaponKind: ev.weaponKind, homing: ev.homing,
            fromPlayer: false,
          });
        }
        break;
      }'''

if old_broadcast in content:
    content = content.replace(old_broadcast, new_broadcast)
    print("  -> Fixed: NPC projectiles broadcast to entire zone")
else:
    print("  -> WARNING: Could not find projectile:spawn broadcast code")

with open('backend/src/socket/handler.ts', 'w') as f:
    f.write(content)


# ── FIX 3-5: loop.ts - Multiple fixes ──
print("FIX 3-5: loop.ts - multiple visual sync fixes...")
with open('frontend/src/game/loop.ts', 'r') as f:
    content = f.read()

# FIX 3: Disable client-side NPC AI when server-authoritative
old_npc = '''function updateNpcShips(dt: number): void {
  for (let i = state.npcShips.length - 1; i >= 0; i--) {'''

new_npc = '''function updateNpcShips(dt: number): void {
  if (serverAuthoritative) return;
  for (let i = state.npcShips.length - 1; i >= 0; i--) {'''

if old_npc in content:
    content = content.replace(old_npc, new_npc)
    print("  FIX 3 -> Disabled client-side NPC AI when server-authoritative")
else:
    print("  FIX 3 -> WARNING: Could not find NPC update function")

# FIX 4: Add muzzle flash + sparks in onProjectileSpawnFromServer
old_proj = '''export function onProjectileSpawnFromServer(data: ProjectileSpawnEvent): void {
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
}'''

new_proj = '''export function onProjectileSpawnFromServer(data: ProjectileSpawnEvent): void {
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
  }
}'''

if old_proj in content:
    content = content.replace(old_proj, new_proj)
    print("  FIX 4 -> Added muzzle flash + sparks for remote player projectiles")
else:
    print("  FIX 4 -> WARNING: Could not find onProjectileSpawnFromServer")

# FIX 5: Add thruster trail for other players
old_others_loop = '''  for (const o of state.others) {
    const tgt = _entityTargets.get(`p-${o.id}`);
    if (!tgt) continue;
    o.pos.x += (tgt.x - o.pos.x) * lerp;
    o.pos.y += (tgt.y - o.pos.y) * lerp;
    o.vel.x = tgt.vx;
    o.vel.y = tgt.vy;
  }
  for (const e of state.enemies) {'''

new_others_loop = '''  for (const o of state.others) {
    const tgt = _entityTargets.get(`p-${o.id}`);
    if (!tgt) continue;
    o.pos.x += (tgt.x - o.pos.x) * lerp;
    o.pos.y += (tgt.y - o.pos.y) * lerp;
    o.vel.x = tgt.vx;
    o.vel.y = tgt.vy;
    const oSpeed = Math.sqrt(o.vel.x * o.vel.x + o.vel.y * o.vel.y);
    if (oSpeed > 30 && Math.random() < 0.3) {
      const back = o.angle + Math.PI;
      emitTrail(o.pos.x + Math.cos(back) * 8, o.pos.y + Math.sin(back) * 8, "#4ee2ff");
    }
  }
  for (const e of state.enemies) {'''

if old_others_loop in content:
    content = content.replace(old_others_loop, new_others_loop)
    print("  FIX 5 -> Added thruster trails for other players")
else:
    print("  FIX 5 -> WARNING: Could not find other players smoothing loop")

# FIX 6: Only grant loot to the player who killed the enemy
old_loot = '''  // Grant loot from server
  const loot = data.loot;
  const p = state.player;
  p.exp += loot.exp;
  p.credits += loot.credits;
  p.honor += loot.honor;'''

new_loot = '''  // Grant loot from server (only to killer)
  const loot = data.loot;
  const p = state.player;
  if (data.killerId !== serverPlayerId) {
    state.enemies = state.enemies.filter(en => en.id !== data.enemyId);
    bump();
    return;
  }
  p.exp += loot.exp;
  p.credits += loot.credits;
  p.honor += loot.honor;'''

if old_loot in content:
    content = content.replace(old_loot, new_loot)
    print("  FIX 6 -> Only grant loot to the killer player")
else:
    print("  FIX 6 -> WARNING: Could not find loot grant code")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(content)


print("\nAll visual sync fixes applied!")
