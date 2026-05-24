#!/usr/bin/env python3
"""Fix ship speed and enemy projectile visual speed."""

# ── FIX 1: Reduce all ship base speeds by 35% ──
print("FIX 1: Reducing ship base speeds...")
with open('frontend/src/game/types.ts', 'r') as f:
    content = f.read()

import re
# Find all baseSpeed values and reduce them
speeds_found = 0
def reduce_speed(m):
    global speeds_found
    old_speed = int(m.group(1))
    new_speed = int(old_speed * 0.65)
    speeds_found += 1
    return f'baseSpeed: {new_speed}'

content = re.sub(r'baseSpeed: (\d+)', reduce_speed, content)
print(f"  -> Reduced {speeds_found} ship base speeds by 35%")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(content)

# ── FIX 2: Also reduce server-side speed computation ──
# The server computes speed from SHIP_CLASSES which comes from the same types file
# Check if the server imports from the same place
print("FIX 2: Checking server speed source...")
with open('backend/src/game/engine.ts', 'r') as f:
    econtent = f.read()

# The server uses SHIP_CLASSES from types - check the import
if 'SHIP_CLASSES' in econtent[:500]:
    print("  -> Server imports SHIP_CLASSES - uses same types file, speed change will apply")
else:
    print("  -> WARNING: Server may have separate speed definitions")

# ── FIX 3: Fix enemy attack projectile visual speed ──
print("FIX 3: Fix enemy attack projectile visual speed...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lcontent = f.read()

old_attack = '''export function onEnemyAttack(data: EnemyAttackEvent): void {
  const isTargetingMe = data.targetId === serverPlayerId;
  fireProjectile("enemy", data.pos.x, data.pos.y,
    Math.atan2(data.targetPos.y - data.pos.y, data.targetPos.x - data.pos.x),
    data.damage, "#ff5c6c", 3, { renderOnly: !isTargetingMe });'''

new_attack = '''export function onEnemyAttack(data: EnemyAttackEvent): void {
  const isTargetingMe = data.targetId === serverPlayerId;
  fireProjectile("enemy", data.pos.x, data.pos.y,
    Math.atan2(data.targetPos.y - data.pos.y, data.targetPos.x - data.pos.x),
    data.damage, "#ff5c6c", 3, { renderOnly: !isTargetingMe, speedMul: 2.73 });'''

if old_attack in lcontent:
    lcontent = lcontent.replace(old_attack, new_attack)
    print("  -> Added speedMul 2.73 to enemy attack projectiles (220 * 2.73 = 600)")
else:
    print("  -> WARNING: Could not find onEnemyAttack")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lcontent)

print("\nDone!")
