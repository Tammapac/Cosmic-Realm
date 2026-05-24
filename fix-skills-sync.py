#!/usr/bin/env python3
"""Ensure skills sync to server immediately and log confirmation."""

with open('backend/src/socket/handler.ts', 'r') as f:
    code = f.read()

# Add visible logging when stats:update is received with skills
old_handler = """      const newStats = engine.refreshPlayerStats(user.playerId) ?? computeStats(cached || data);
      p.speed = newStats.speed;
      p.hullMax = newStats.hullMax;
      p.shieldMax = newStats.shieldMax;
      p.shieldRegen = newStats.shieldRegen;
    });"""

new_handler = """      const newStats = engine.refreshPlayerStats(user.playerId) ?? computeStats(cached || data);
      const oldSpeed = p.speed;
      p.speed = newStats.speed;
      p.hullMax = newStats.hullMax;
      p.shieldMax = newStats.shieldMax;
      p.shieldRegen = newStats.shieldRegen;
      if (data.skills && Object.keys(data.skills).length > 0) {
        console.log(`[STATS] ${user.username} skills updated: SPD ${Math.round(oldSpeed)}->${Math.round(p.speed)}, DMG ${Math.round(newStats.damage)}, RATE ${newStats.fireRate.toFixed(2)}, HUL ${Math.round(p.hullMax)}, SHD ${Math.round(p.shieldMax)}`);
      }
    });"""

if old_handler in code:
    code = code.replace(old_handler, new_handler)
    print("-> Added server-side stats update logging")
else:
    print("-> WARNING: Could not find stats:update handler end")

with open('backend/src/socket/handler.ts', 'w') as f:
    f.write(code)

print("DONE!")
