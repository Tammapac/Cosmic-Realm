#!/usr/bin/env python3
"""Reduce enemy count slightly and spawn them further from players so they're
in the area but not permanently surrounding the player."""

with open('backend/src/game/engine.ts', 'r') as f:
    code = f.read()

# 1. Reduce max enemies: 80+tier*10 -> 60+tier*8
print("═══ Tuning enemy cap ═══")
old = "    const maxEnemies = 80 + zoneDef.enemyTier * 10;"
new = "    const maxEnemies = 60 + zoneDef.enemyTier * 8;"
if old in code:
    code = code.replace(old, new)
    print("  -> Max: 80+tier*10 -> 60+tier*8 (tier1: 68)")

# 2. Slow spawn timer slightly: 0.08-0.2 -> 0.15-0.4
print("\n═══ Tuning spawn rate ═══")
old = "    zs.spawnTimer = randRange(0.08, 0.2);"
new = "    zs.spawnTimer = randRange(0.15, 0.4);"
if old in code:
    code = code.replace(old, new)
    print("  -> Timer: 0.08-0.2s -> 0.15-0.4s (~3-7/sec)")

# 3. Reduce initial count: 50+tier*8 -> 35+tier*6
print("\n═══ Tuning initial spawn ═══")
old = "    const initialCount = 50 + zoneDef.enemyTier * 8;"
new = "    const initialCount = 35 + zoneDef.enemyTier * 6;"
if old in code:
    code = code.replace(old, new)
    print("  -> Initial: 50+tier*8 -> 35+tier*6 (tier1: 41)")

# 4. Spawn further from players: 300-700 -> 600-1400
#    And reduce near-player chance: 75% -> 65%
#    This means enemies populate the area around players but don't swarm them
print("\n═══ Spawning enemies further from players ═══")
old = """    // Spawn position: 75% near a random player, 25% random on map
    let spawnPos: Vec2;
    if (players.length > 0 && Math.random() < 0.75) {
      const rp = players[Math.floor(Math.random() * players.length)];
      const ang = Math.random() * Math.PI * 2;
      const d = 300 + Math.random() * 400;"""

new = """    // Spawn position: 65% near a player (but at distance), 35% random on map
    let spawnPos: Vec2;
    if (players.length > 0 && Math.random() < 0.65) {
      const rp = players[Math.floor(Math.random() * players.length)];
      const ang = Math.random() * Math.PI * 2;
      const d = 600 + Math.random() * 800;"""

if old in code:
    code = code.replace(old, new)
    print("  -> Near-player: 75% -> 65%, distance: 600-1400 (was 300-700)")
    print("  -> Enemies populate the area ahead/around, not on top of players")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(code)

print("\n" + "=" * 50)
print("DONE! Enemies spawn in the surrounding area, not on the player.")
