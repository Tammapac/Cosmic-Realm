#!/usr/bin/env python3
"""
Fix pirate issues:
1. Too many pirates - cap max pirates per zone, increase spawn interval
2. Pirates missing engine trails - ensure velocity is above threshold
3. Pirates missing muzzle flash + hit effects on player
"""

import re

print("═══ Fixing pirate count + visual effects ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    eng = f.read()

# 1. Cap pirate count per zone and increase spawn interval
old_pirate_spawn = '''  private tickPirateSpawns(zoneId: string, zs: ZoneState, players: OnlinePlayer[], dt: number, events: GameEvent[]): void {
    if (players.length === 0) return;
    // Pirate group spawn timer (every 60-120 seconds)
    zs.pirateTimer = (zs.pirateTimer ?? randRange(60, 120)) - dt;
    if (zs.pirateTimer > 0) return;
    zs.pirateTimer = randRange(60, 120);

    const zoneDef = ZONES[zoneId as ZoneId];
    if (!zoneDef) return;
    const tierMult = Math.pow(2, zoneDef.enemyTier - 1);

    // Pick a random player to spawn near
    const rp = players[Math.floor(Math.random() * players.length)];
    const baseAng = Math.random() * Math.PI * 2;
    const baseDist = 600 + Math.random() * 800;
    const baseX = clamp(rp.posX + Math.cos(baseAng) * baseDist, -MAP_RADIUS * 0.9, MAP_RADIUS * 0.9);
    const baseY = clamp(rp.posY + Math.sin(baseAng) * baseDist, -MAP_RADIUS * 0.9, MAP_RADIUS * 0.9);

    // Spawn 5-10 pirates in a group
    const groupSize = 5 + Math.floor(Math.random() * 6);'''

new_pirate_spawn = '''  private tickPirateSpawns(zoneId: string, zs: ZoneState, players: OnlinePlayer[], dt: number, events: GameEvent[]): void {
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
    if (groupSize <= 0) return;'''

eng = eng.replace(old_pirate_spawn, new_pirate_spawn)
print("  -> Capped pirates at 10 per zone, reduced group size to 3-6, increased interval to 90-180s")

# 2. Increase pirate base speed so trails show (they orbit at 40% speed)
# Pirate speed is baseDef.speed * 1.2 - but raiders (speed 75) orbit at 75*1.2*0.4=36
# Need to make sure orbit speed is above the trail threshold of 15
# Actually the issue might be that vel isn't being sent at all for new spawned enemies
# Let me ensure pirates are initialized with some velocity
old_pirate_init = '''      const pirate: ServerEnemy = {
        id: eid("pir"),
        type: pType,
        behavior: baseDef.behavior,
        name: "Pirate",
        pos: { x: baseX + offsetX, y: baseY + offsetY },
        vel: { x: 0, y: 0 },'''

new_pirate_init = '''      const pirate: ServerEnemy = {
        id: eid("pir"),
        type: pType,
        behavior: baseDef.behavior,
        name: "Pirate",
        pos: { x: baseX + offsetX, y: baseY + offsetY },
        vel: { x: Math.cos(Math.random() * Math.PI * 2) * baseDef.speed * 0.5, y: Math.sin(Math.random() * Math.PI * 2) * baseDef.speed * 0.5 },'''

eng = eng.replace(old_pirate_init, new_pirate_init)
print("  -> Pirates spawn with initial velocity for immediate trails")

# Also for boss pirate
old_boss_init = '''      const boss: ServerEnemy = {
        id: eid("pboss"),
        type: bossType,
        behavior: "tank",
        name: "Pirate Captain",
        pos: { x: baseX, y: baseY },
        vel: { x: 0, y: 0 },'''

new_boss_init = '''      const boss: ServerEnemy = {
        id: eid("pboss"),
        type: bossType,
        behavior: "tank",
        name: "Pirate Captain",
        pos: { x: baseX, y: baseY },
        vel: { x: Math.cos(Math.random() * Math.PI * 2) * 20, y: Math.sin(Math.random() * Math.PI * 2) * 20 },'''

eng = eng.replace(old_boss_init, new_boss_init)
print("  -> Pirate Captain spawns with initial velocity")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(eng)

# 3. Fix frontend - ensure enemy hit effects work for ALL projectile types
# The issue is that when enemy projectile hits player, there's no impact effect
# Check if onEnemyAttack creates hit particles

with open('frontend/src/game/loop.ts', 'r') as f:
    loop = f.read()

# Check the damagePlayer function for hit effects
damage_idx = loop.find('function damagePlayer')
if damage_idx == -1:
    damage_idx = loop.find('damagePlayer(')
    print(f"  -> damagePlayer reference at index {damage_idx}")

# Find where enemy projectiles hit the player and check for impact VFX
# The server sends damage via enemy:attack event -> onEnemyAttack -> damagePlayer
# But the projectile itself is fireProjectile with renderOnly flag
# So we need VFX on the player when hit

# Let's find the onEnemyAttack function and add impact particles
old_on_enemy_attack = loop[loop.find('export function onEnemyAttack'):]
old_on_enemy_attack = old_on_enemy_attack[:old_on_enemy_attack.find('\n}\n') + 3]

print(f"  -> Found onEnemyAttack ({len(old_on_enemy_attack)} chars)")

# Check if there's already hit VFX in damagePlayer
has_hit_vfx = 'hitFlash' in loop[loop.find('damagePlayer'):loop.find('damagePlayer')+500] if 'damagePlayer' in loop else False
print(f"  -> damagePlayer has hitFlash: {has_hit_vfx}")

# Let's look for where enemy projectiles impact the player visually
# In server-authoritative mode, the projectile with renderOnly just fades out
# We need to add impact particles when damagePlayer is called from onEnemyAttack

new_on_enemy_attack = '''export function onEnemyAttack(data: EnemyAttackEvent): void {
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
'''

loop = loop.replace(old_on_enemy_attack, new_on_enemy_attack)
print("  -> Added muzzle flash + impact particles to onEnemyAttack")

# 4. Lower the trail velocity threshold for server mode to catch slower enemies
old_trail_server = '''      // Enemy engine trail even in server mode
      const eSpd2 = Math.sqrt(e.vel.x * e.vel.x + e.vel.y * e.vel.y);
      if (eSpd2 > 15) {
        const eBack2 = e.angle + Math.PI;
        if (Math.random() < Math.min(0.7, eSpd2 / 100)) {
          emitTrail(e.pos.x + Math.cos(eBack2) * (e.size * 0.6), e.pos.y + Math.sin(eBack2) * (e.size * 0.6), e.color, 0.5, 2.5);
        }
      }'''

new_trail_server = '''      // Enemy engine trail even in server mode
      const eSpd2 = Math.sqrt(e.vel.x * e.vel.x + e.vel.y * e.vel.y);
      if (eSpd2 > 5) {
        const eBack2 = e.angle + Math.PI;
        const trailRate = Math.min(0.8, eSpd2 / 60);
        if (Math.random() < trailRate) {
          const trailSz = Math.min(4, 1.5 + eSpd2 / 40);
          emitTrail(e.pos.x + Math.cos(eBack2) * (e.size * 0.6), e.pos.y + Math.sin(eBack2) * (e.size * 0.6), e.color, 0.5, trailSz);
        }
      }'''

loop = loop.replace(old_trail_server, new_trail_server)
print("  -> Lowered trail velocity threshold from 15 to 5, scaled trail size by speed")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(loop)

print("\nDONE!")
print("  - Pirates capped at 10 per zone, spawn in groups of 3-6 every 90-180s")
print("  - Pirates spawn with initial velocity for immediate trails")
print("  - Enemy attacks have muzzle flash at enemy + impact particles on player")
print("  - Trail threshold lowered so all moving enemies show engine trails")
