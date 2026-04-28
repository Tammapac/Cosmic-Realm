#!/usr/bin/env python3
"""Fix: remote player sounds + scatter/rail damage balance."""

# ── FIX 1: Add sounds for other players' actions ──
print("FIX 1: Adding sounds for other players...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Add shoot sounds in onProjectileSpawnFromServer
old_spawn_end = '''    emitSpark(data.x, data.y, data.color || "#4ee2ff", data.crit ? 6 : 3, 80, 2);
  }
}'''

new_spawn_end = '''    emitSpark(data.x, data.y, data.color || "#4ee2ff", data.crit ? 6 : 3, 80, 2);

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
}'''

if old_spawn_end in lc:
    lc = lc.replace(old_spawn_end, new_spawn_end)
    print("  -> Added laser/rocket shoot sounds for remote players")
else:
    print("  -> WARNING: Could not find onProjectileSpawnFromServer end")

# Add hit sound in onEnemyHit (server-sent enemy hit events)
old_hit = '''export function onEnemyHit(data: EnemyHitEvent): void {
  const e = state.enemies.find((en) => en.id === data.enemyId);
  if (!e) return;
  e.hull = data.hp;
  e.hullMax = data.hpMax;
  e.hitFlash = 1;
  e.aggro = true;'''

new_hit = '''export function onEnemyHit(data: EnemyHitEvent): void {
  const e = state.enemies.find((en) => en.id === data.enemyId);
  if (!e) return;
  e.hull = data.hp;
  e.hullMax = data.hpMax;
  e.hitFlash = 1;
  e.aggro = true;
  const hitDist = Math.hypot(e.pos.x - state.player.pos.x, e.pos.y - state.player.pos.y);
  if (hitDist < 800) sfx.enemyHit();'''

if old_hit in lc:
    lc = lc.replace(old_hit, new_hit)
    print("  -> Added enemy hit sound for server-sent hit events")
else:
    print("  -> WARNING: Could not find onEnemyHit")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

# ── FIX 2: Increase scatter and rail damage multipliers ──
print("\nFIX 2: Buffing scatter and rail damage...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Scatter: 0.85 total -> 1.3 total (shotgun should reward close range risk)
lc = lc.replace(
    "const perPellet = Math.round(laserDmg * 0.85 / pellets);",
    "const perPellet = Math.round(laserDmg * 1.3 / pellets);"
)
print("  -> Frontend scatter: 0.85x -> 1.3x total damage")

# Rail: 0.9 total -> 1.15 total (burst is harder to land all 3)
lc = lc.replace(
    "const perBurst = Math.round(laserDmg * 0.9 / 3);",
    "const perBurst = Math.round(laserDmg * 1.15 / 3);"
)
print("  -> Frontend rail: 0.9x -> 1.15x total damage")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

# Same on server side
with open('backend/src/game/engine.ts', 'r') as f:
    ec = f.read()

ec = ec.replace(
    "const perPellet = Math.round(laserDmg * 0.85 / pellets);",
    "const perPellet = Math.round(laserDmg * 1.3 / pellets);"
)
ec = ec.replace(
    "const perBurst = Math.round(laserDmg * 0.9 / 3);",
    "const perBurst = Math.round(laserDmg * 1.15 / 3);"
)
print("  -> Server scatter/rail damage buffed to match")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ec)

# ── FIX 3: Bump base damage stats on scatter/rail weapons ──
print("\nFIX 3: Increasing scatter/rail base weapon damage...")
with open('frontend/src/game/types.ts', 'r') as f:
    tc = f.read()

import re

# Scatter weapons - increase base damage
replacements = {
    # Scatter line
    ('"wp-scatter-0"', 'damage: 5'): 'damage: 7',
    ('"wp-scatter"', 'damage: 9'): 'damage: 12',
    ('"wp-scatter-2"', 'damage: 16'): 'damage: 20',
    ('"wp-scatter-3"', 'damage: 24'): 'damage: 30',
    # Rail line
    ('"wp-rail-0"', 'damage: 5'): 'damage: 7',
    ('"wp-rail-1"', 'damage: 10'): 'damage: 13',
    ('"wp-rail-2"', 'damage: 16'): 'damage: 20',
    ('"wp-rail-3"', 'damage: 28'): 'damage: 34',
}

for (weapon_id, old_dmg), new_dmg in replacements.items():
    # Find the line containing this weapon and replace damage
    idx = tc.find(weapon_id)
    if idx >= 0:
        # Find the damage value on the same line
        line_end = tc.find('\n', idx)
        line = tc[idx:line_end]
        if old_dmg in line:
            new_line = line.replace(old_dmg, new_dmg)
            tc = tc[:idx] + new_line + tc[line_end:]

print("  -> Scatter base damage: 5->7, 9->12, 16->20, 24->30")
print("  -> Rail base damage: 5->7, 10->13, 16->20, 28->34")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(tc)

print("\nAll fixes applied!")
