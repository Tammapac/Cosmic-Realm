#!/usr/bin/env python3
"""Reduce enemy density further - less swarming around players."""

with open('backend/src/game/engine.ts', 'r') as f:
    code = f.read()

# Max enemies: 60+tier*8 -> 40+tier*5
code = code.replace(
    "const maxEnemies = 60 + zoneDef.enemyTier * 8;",
    "const maxEnemies = 40 + zoneDef.enemyTier * 5;"
)
print("Max: 60+tier*8 -> 40+tier*5 (tier1: 45)")

# Spawn timer: 0.15-0.4 -> 0.4-1.0 (slower spawning)
code = code.replace(
    "zs.spawnTimer = randRange(0.15, 0.4);",
    "zs.spawnTimer = randRange(0.4, 1.0);"
)
print("Timer: 0.15-0.4s -> 0.4-1.0s (~1-2.5/sec)")

# Initial: 35+tier*6 -> 25+tier*4
code = code.replace(
    "const initialCount = 35 + zoneDef.enemyTier * 6;",
    "const initialCount = 25 + zoneDef.enemyTier * 4;"
)
print("Initial: 35+tier*6 -> 25+tier*4 (tier1: 29)")

# Near-player chance: 65% -> 50%, distance: 600-1400 -> 800-1800
code = code.replace(
    "if (players.length > 0 && Math.random() < 0.65) {",
    "if (players.length > 0 && Math.random() < 0.50) {"
)
code = code.replace(
    "const d = 600 + Math.random() * 800;",
    "const d = 800 + Math.random() * 1000;"
)
print("Near-player: 65%->50%, distance: 800-1800 (further out)")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(code)

print("DONE!")
