#!/usr/bin/env python3
"""
Fix 3 critical bugs:
1. Lasers don't do damage (server ammo check uses field that doesn't exist in cache)
2. Invisible projectiles at 0 ammo (client sends isLaserFiring/isRocketFiring even at 0 ammo)
3. Enemy projectiles all look like lasers (onEnemyAttack uses hardcoded laser visual)
"""

import re

# ════════════════���══════════════════��═══════════════════════════════════════════
# 1. BACKEND - Remove broken server-side ammo check for lasers
# ══════════════════��════════════════════════════════════════���═══════════════════
print("═══ Fixing backend laser/rocket firing ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    eng = f.read()

# Remove the broken laser ammo check - pData.ammo doesn't exist in the cache
# The cache only has: shipClass, inventory, equipped, skills, drones, faction, level
old_laser_check = '''      // Fire laser (only if player has ammo)
      const pLaserAmmo = pData?.ammo?.[p.laserAmmoType as string] ?? 0;
      if (p.isLaserFiring && p.laserFireCd <= 0 && pLaserAmmo >= 1) {'''

new_laser_check = '''      // Fire laser
      if (p.isLaserFiring && p.laserFireCd <= 0) {'''

eng = eng.replace(old_laser_check, new_laser_check)
print("  -> Removed broken laser ammo check (ammo not in playerDataCache)")

# For rockets: add ammo check using the rocketAmmo from cache
# Actually, rocketAmmo is also not in the cache, so don't add a check there either.
# The client will handle ammo gating by clearing isRocketFiring when ammo is 0.

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(eng)

# ═══════════════════════════════��═════════════════════════════��═════════════════
# 2. FRONTEND - Stop firing state when ammo is 0 (prevents invisible projectiles)
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Fixing client-side ammo gating ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    loop = f.read()

# Find the section where isLaserFiring/isRocketFiring is checked with ammo
# Current code:
#   const laserAmmo = p.ammo[laserAmmoType] ?? 0;
#   if (state.isLaserFiring && playerFireCd.value <= 0 && laserIds.length > 0 && laserAmmo >= 1) {
# We need to ADD: clear isLaserFiring when ammo is 0 so server also stops

old_laser_client = '''      const laserAmmo = p.ammo[laserAmmoType] ?? 0;
      if (state.isLaserFiring && playerFireCd.value <= 0 && laserIds.length > 0 && laserAmmo >= 1) {'''

new_laser_client = '''      const laserAmmo = p.ammo[laserAmmoType] ?? 0;
      if (laserAmmo < 1 && state.isLaserFiring) {
        state.isLaserFiring = false;
      }
      if (state.isLaserFiring && playerFireCd.value <= 0 && laserIds.length > 0 && laserAmmo >= 1) {'''

if 'if (laserAmmo < 1 && state.isLaserFiring)' not in loop:
    loop = loop.replace(old_laser_client, new_laser_client)
    print("  -> Added laser ammo gate (clears isLaserFiring when ammo=0)")

# Same for rockets
old_rocket_client = '''      const rocketAmmo = p.rocketAmmo[rocketAmmoType] ?? 0;
      if (state.isRocketFiring && rocketFireCd.value <= 0 && rocketIds.length > 0 && rocketAmmo >= 1) {'''

new_rocket_client = '''      const rocketAmmo = p.rocketAmmo[rocketAmmoType] ?? 0;
      if (rocketAmmo < 1 && state.isRocketFiring) {
        state.isRocketFiring = false;
      }
      if (state.isRocketFiring && rocketFireCd.value <= 0 && rocketIds.length > 0 && rocketAmmo >= 1) {'''

if 'if (rocketAmmo < 1 && state.isRocketFiring)' not in loop:
    loop = loop.replace(old_rocket_client, new_rocket_client)
    print("  -> Added rocket ammo gate (clears isRocketFiring when ammo=0)")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Fix onEnemyAttack to use enemy-type-specific projectile visuals
# ══════════���═════════════════��══════════════════════════════════════════════════
print("\n═══ Fixing enemy attack visuals ═══")

old_enemy_attack = '''export function onEnemyAttack(data: EnemyAttackEvent): void {
  const isTargetingMe = data.targetId === serverPlayerId;
  fireProjectile("enemy", data.pos.x, data.pos.y,
    Math.atan2(data.targetPos.y - data.pos.y, data.targetPos.x - data.pos.x),
    data.damage, "#ff5c6c", 3, { renderOnly: !isTargetingMe, speedMul: 2.73 });
  if (!serverAuthoritative && isTargetingMe) {
    damagePlayer(data.damage);
  }
}'''

new_enemy_attack = '''export function onEnemyAttack(data: EnemyAttackEvent): void {
  const isTargetingMe = data.targetId === serverPlayerId;
  const ang = Math.atan2(data.targetPos.y - data.pos.y, data.targetPos.x - data.pos.x);
  // Look up the enemy to determine projectile style
  const srcEnemy = state.enemies.find(e => e.id === data.enemyId);
  const eType = srcEnemy?.type;
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
  fireProjectile("enemy", data.pos.x, data.pos.y, ang, data.damage, projColor, projSize, { renderOnly: !isTargetingMe, speedMul: projSpeed, weaponKind: projWk as any });
  if (!serverAuthoritative && isTargetingMe) {
    damagePlayer(data.damage);
  }
}'''

if 'srcEnemy?.type' not in loop:
    loop = loop.replace(old_enemy_attack, new_enemy_attack)
    print("  -> Updated onEnemyAttack to use enemy-type-specific projectile visuals")

# ══════════════════════��══════════════════════════════════���═════════════════════
# 4. Remove duplicate local enemy firing (server handles it via events)
#    Actually NO - we keep local firing for visual prediction, but let's make sure
#    the local firing DOESN'T deal damage (it should be renderOnly in serverAuth mode)
# ════════════════════════���════════════════════════════════���═════════════════════

# Actually the local enemy firing IS needed for smooth visuals. The server event
# arrives with a delay, so local prediction provides instant visual feedback.
# The issue was that onEnemyAttack used hardcoded laser - now fixed above.

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(loop)

# ════════════════════════════════════════��═══════════════════════════��══════════
# 5. Update ClientProjectile type in backend to support new weaponKind values
# ════════════���══════════════════���════════════════════════════════════���══════════
print("\n═══ Updating type definitions ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    eng = f.read()

# Update ClientProjectile weaponKind type
old_cp_wk = '  weaponKind: "laser" | "rocket";\n'
new_cp_wk = '  weaponKind: "laser" | "rocket" | "energy" | "plasma";\n'
eng = eng.replace(old_cp_wk, new_cp_wk)
print("  -> Updated ClientProjectile weaponKind type")

# Update projectile:spawn event weaponKind type
old_event_wk = 'weaponKind: "laser" | "rocket"; homing: boolean }'
new_event_wk = 'weaponKind: "laser" | "rocket" | "energy" | "plasma"; homing: boolean }'
eng = eng.replace(old_event_wk, new_event_wk)
print("  -> Updated projectile:spawn event weaponKind type")

# Update playerAttackEnemy weaponKind parameter type
old_attack_wk = '    weaponKind: "laser" | "rocket", ammoType: string,'
new_attack_wk = '    weaponKind: "laser" | "rocket" | "energy" | "plasma", ammoType: string,'
eng = eng.replace(old_attack_wk, new_attack_wk)
print("  -> Updated playerAttackEnemy weaponKind parameter type")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(eng)

# ════════════════════════════════���═════════════════════════��════════════════════
# 6. Also update the enemy:attack event to include enemy type for client rendering
# ══════��══════════════════════════════════════════════════════════���═════════════

with open('backend/src/game/engine.ts', 'r') as f:
    eng = f.read()

# Check if enemy:attack event has enemyType field
old_attack_event = '| { type: "enemy:attack"; zone: string; enemyId: string; targetId: number; damage: number; pos: Vec2; targetPos: Vec2 }'
new_attack_event = '| { type: "enemy:attack"; zone: string; enemyId: string; enemyType: string; targetId: number; damage: number; pos: Vec2; targetPos: Vec2 }'

if 'enemyType: string; targetId' not in eng:
    eng = eng.replace(old_attack_event, new_attack_event)
    print("  -> Added enemyType field to enemy:attack event type")

    # Also add enemyType to the actual event emission
    old_emit = '''            type: "enemy:attack", zone: zoneId,
            enemyId: e.id, targetId: target.playerId,
            damage: dmg, pos: { ...e.pos },
            targetPos: tPos,'''
    new_emit = '''            type: "enemy:attack", zone: zoneId,
            enemyId: e.id, enemyType: e.type, targetId: target.playerId,
            damage: dmg, pos: { ...e.pos },
            targetPos: tPos,'''
    eng = eng.replace(old_emit, new_emit)
    print("  -> Added enemyType to enemy:attack event emission")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(eng)

# ═════════��═════════════════════════════════════════════════════════════════════
# 7. Update socket handler to forward enemyType in the event
# ════���══════════════════════════════════════════════════════════���═══════════════

# Check if socket handler forwards enemy:attack events
with open('backend/src/socket/handler.ts', 'r') as f:
    handler = f.read()

# Find enemy:attack handler and make sure it passes enemyType
if 'enemy:attack' in handler:
    # Check if it already has enemyType
    if 'enemyType' not in handler[handler.find('enemy:attack'):handler.find('enemy:attack')+300]:
        # Find the broadcast for enemy:attack
        old_broadcast = handler[handler.find('enemy:attack'):handler.find('enemy:attack')+300]
        # Try to add enemyType to the broadcast data
        if 'enemyId: ev.enemyId' in handler:
            handler = handler.replace(
                'enemyId: ev.enemyId, targetId: ev.targetId',
                'enemyId: ev.enemyId, enemyType: (ev as any).enemyType, targetId: ev.targetId'
            )
            print("  -> Added enemyType forwarding in socket handler")

with open('backend/src/socket/handler.ts', 'w') as f:
    f.write(handler)

# ═══════════════════════════════════════════════════════════════════════════════
# 8. Update frontend EnemyAttackEvent type and onEnemyAttack to use server-sent type
# ═════════════���═════════════════════════════════════════════════════════════════

with open('frontend/src/game/loop.ts', 'r') as f:
    loop = f.read()

# Find EnemyAttackEvent type or where it's used
# The data.enemyId is already used in onEnemyAttack - we look up the enemy
# But in case the enemy isn't in our local state, let's also handle the server-sent type

# Check if there's an EnemyAttackEvent type
if 'type EnemyAttackEvent' in loop:
    # Add enemyType to it
    old_eat = re.search(r'(type EnemyAttackEvent\s*=\s*\{[^}]+\})', loop)
    if old_eat and 'enemyType' not in old_eat.group(0):
        new_eat = old_eat.group(0).replace('enemyId: string;', 'enemyId: string;\n  enemyType?: string;')
        loop = loop.replace(old_eat.group(0), new_eat)
        print("  -> Added enemyType to EnemyAttackEvent type")
elif 'EnemyAttackEvent' in loop:
    # Find the interface/type elsewhere
    pass

# Now update onEnemyAttack to also use data.enemyType as fallback
old_lookup = "  const eType = srcEnemy?.type;"
new_lookup = "  const eType = srcEnemy?.type ?? (data as any).enemyType;"
loop = loop.replace(old_lookup, new_lookup)
print("  -> onEnemyAttack uses server-sent enemyType as fallback")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(loop)

print("\nDONE!")
print("  - Laser damage FIXED (removed broken ammo check from server)")
print("  - Client now clears isLaserFiring/isRocketFiring at 0 ammo (no invisible shots)")
print("  - Enemy projectiles now show correct visuals (energy/plasma based on type)")
print("  - Event types updated to carry weaponKind and enemyType properly")
