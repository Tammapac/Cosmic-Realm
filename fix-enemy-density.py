#!/usr/bin/env python3
"""Drastically increase enemy density so players can fight nonstop."""

with open('backend/src/game/engine.ts', 'r') as f:
    code = f.read()

# ══════════════════════════════════════════════════════════════════════════════
# 1. Increase max enemies per zone from 28+tier*5 to 80+tier*10
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Increasing max enemies per zone ═══")

old_max = "    const maxEnemies = 28 + zoneDef.enemyTier * 5;"
new_max = "    const maxEnemies = 80 + zoneDef.enemyTier * 10;"

if old_max in code:
    code = code.replace(old_max, new_max)
    print("  -> Max enemies: 28+tier*5 -> 80+tier*10 (tier1: 90, tier5: 130)")
else:
    print("  -> WARNING: Could not find maxEnemies")

# ══════════════════════════════════════════════════════════════════════════════
# 2. Faster spawn timer: 0.3-0.8s -> 0.1-0.3s, and spawn 2-3 at a time
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Faster spawn rate + batch spawning ═══")

old_timer = "    zs.spawnTimer = randRange(0.3, 0.8);"
new_timer = "    zs.spawnTimer = randRange(0.08, 0.2);"

if old_timer in code:
    code = code.replace(old_timer, new_timer)
    print("  -> Spawn timer: 0.3-0.8s -> 0.08-0.2s")
else:
    print("  -> WARNING: Could not find spawnTimer")

# ══════════════════════════════════════════════════════════════════════════════
# 3. More spawns near players: 40% -> 75%, closer distance: 500-1000 -> 300-700
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ More enemies spawn near players ═══")

old_spawn_pos = """    // Spawn position: 40% near a random player, 60% random on map
    let spawnPos: Vec2;
    if (players.length > 0 && Math.random() < 0.4) {
      const rp = players[Math.floor(Math.random() * players.length)];
      const ang = Math.random() * Math.PI * 2;
      const d = 500 + Math.random() * 500;"""

new_spawn_pos = """    // Spawn position: 75% near a random player, 25% random on map
    let spawnPos: Vec2;
    if (players.length > 0 && Math.random() < 0.75) {
      const rp = players[Math.floor(Math.random() * players.length)];
      const ang = Math.random() * Math.PI * 2;
      const d = 300 + Math.random() * 400;"""

if old_spawn_pos in code:
    code = code.replace(old_spawn_pos, new_spawn_pos)
    print("  -> Near-player spawn: 40% -> 75%, distance: 300-700 (was 500-1000)")
else:
    print("  -> WARNING: Could not find spawn position block")

# ══════════════════════════════════════════════════════════════════════════════
# 4. Increase initial spawn count: 14+tier*3 -> 50+tier*8
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Increasing initial enemy count ═══")

old_initial = "    const initialCount = 14 + zoneDef.enemyTier * 3;"
new_initial = "    const initialCount = 50 + zoneDef.enemyTier * 8;"

if old_initial in code:
    code = code.replace(old_initial, new_initial)
    print("  -> Initial enemies: 14+tier*3 -> 50+tier*8 (tier1: 58, tier5: 90)")
else:
    print("  -> WARNING: Could not find initialCount")

# ══════════════════════════════════════════════════════════════════════════════
# 5. Also increase initial spawn timer to fill faster
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Faster initial zone fill ═══")

old_init_timer = "        spawnTimer: randRange(0.5, 1.5),"
new_init_timer = "        spawnTimer: randRange(0.05, 0.15),"

if old_init_timer in code:
    code = code.replace(old_init_timer, new_init_timer)
    print("  -> Initial zone spawn timer: 0.5-1.5s -> 0.05-0.15s")
else:
    print("  -> WARNING: Could not find initial spawnTimer")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(code)

print("\n" + "=" * 50)
print("DONE! Enemy density massively increased:")
print("  - Max per zone: ~90-130 (was ~33-53)")
print("  - Initial spawn: ~58-90 (was ~17-29)")
print("  - Spawn rate: ~5-12x/sec (was ~1-3x/sec)")
print("  - 75% spawn near players within 300-700 range")
