#!/usr/bin/env python3
"""
Fix:
1. Titan attack pattern - add predictive aiming like other higher enemies
2. Stuttery movement for slow enemies (titan/dread) - add orbiting when in range
   instead of just decelerating to zero velocity
"""

import re

print("═══ Fixing titan attacks + slow enemy movement ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    eng = f.read()

# 1. Fix titan attack pattern - add predictive aiming
old_titan_attack = '''          } else if (e.type === "titan") {
            // Heavy spread + area denial around player
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.0), projAng + i * 0.08, e.color, "plasma", 6, 0.7);
            }
            for (let i = 0; i < 4; i++) {
              const offsetAng = projAng + (i - 1.5) * 0.25;
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.5), offsetAng, "#ff6644", "plasma", 5, 0.5);
            }'''

new_titan_attack = '''          } else if (e.type === "titan") {
            // Predictive heavy spread + area denial
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 0.7);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 50, y: tPos.y + pVelY * predTime * 50 });
            // Heavy predictive plasma volley
            for (let i = -2; i <= 2; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.7), predAng + i * 0.07, e.color, "plasma", 6, 0.75);
            }
            // Area denial around predicted position
            for (let i = 0; i < 5; i++) {
              const offsetAng = predAng + (i - 2) * 0.3 + (Math.random() - 0.5) * 0.15;
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.4), offsetAng, "#ff6644", "plasma", 5, 0.5);
            }'''

eng = eng.replace(old_titan_attack, new_titan_attack)
print("  -> Titan now has predictive aiming + heavier spread pattern")

# 2. Fix enemy movement - make enemies orbit/strafe when in range instead of stopping
# Current code when in range just does: e.vel.x *= 0.9; e.vel.y *= 0.9;
# This causes vel to drop to near-zero very fast, making slow enemies appear frozen

old_movement = '''        if (d > fireRange * 0.8) {
          const ang = angleFromTo(e.pos, tPos);
          e.angle = ang;
          const spd = e.speed * dt;
          e.vel.x = Math.cos(ang) * e.speed;
          e.vel.y = Math.sin(ang) * e.speed;
          e.pos.x += Math.cos(ang) * spd;
          e.pos.y += Math.sin(ang) * spd;
        } else {
          e.vel.x *= 0.9;
          e.vel.y *= 0.9;
          e.angle = angleFromTo(e.pos, tPos);
        }'''

new_movement = '''        if (d > fireRange * 0.8) {
          const ang = angleFromTo(e.pos, tPos);
          e.angle = ang;
          const spd = e.speed * dt;
          e.vel.x = Math.cos(ang) * e.speed;
          e.vel.y = Math.sin(ang) * e.speed;
          e.pos.x += Math.cos(ang) * spd;
          e.pos.y += Math.sin(ang) * spd;
        } else {
          // Orbit/strafe when in range instead of stopping
          const ang = angleFromTo(e.pos, tPos);
          e.angle = ang;
          // Perpendicular orbit direction (alternates based on enemy id hash)
          const orbitDir = (e.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
          const orbitAng = ang + (Math.PI / 2) * orbitDir;
          const orbitSpeed = e.speed * 0.4;
          e.vel.x = Math.cos(orbitAng) * orbitSpeed;
          e.vel.y = Math.sin(orbitAng) * orbitSpeed;
          e.pos.x += e.vel.x * dt;
          e.pos.y += e.vel.y * dt;
          // Gently push back to optimal range if too close
          if (d < fireRange * 0.4) {
            const pushAng = ang + Math.PI;
            e.pos.x += Math.cos(pushAng) * e.speed * 0.3 * dt;
            e.pos.y += Math.sin(pushAng) * e.speed * 0.3 * dt;
          }
        }'''

eng = eng.replace(old_movement, new_movement)
print("  -> Enemies now orbit/strafe when in firing range (no more freezing in place)")

# 3. Also do the same for pirate movement (if it has separate movement code)
# Check if there's pirate-specific movement
if 'pirate' in eng and 'tickPirateSpawns' in eng:
    # Pirates use the same enemy AI tick, so they'll get the orbit behavior too
    print("  -> Pirates will also orbit (same AI tick)")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(eng)

# 4. Increase titan/dread base speed slightly so orbiting is visible
with open('backend/src/game/data.ts', 'r') as f:
    data = f.read()

# Titan: 35 -> 50, Dread: 45 -> 55
data = data.replace(
    "hullMax: 1500, damage: 75, speed: 35, exp: 150",
    "hullMax: 1500, damage: 75, speed: 50, exp: 150"
)
print("  -> Titan speed: 35 -> 50 (orbit will be visible)")

data = data.replace(
    "hullMax: 850, damage: 55, speed: 45, exp: 100",
    "hullMax: 850, damage: 55, speed: 55, exp: 100"
)
print("  -> Dread speed: 45 -> 55 (orbit will be visible)")

with open('backend/src/game/data.ts', 'w') as f:
    f.write(data)

# 5. Improve frontend interpolation for slow enemies - increase correction strength
with open('frontend/src/game/loop.ts', 'r') as f:
    loop = f.read()

# The current corrLerp = Math.min(lerp * 1.5, 0.4) with INTERPOLATION_FACTOR 0.25
# means corrLerp = 0.375. This is okay but let's ensure the snap threshold is more forgiving
# and that the velocity from server is always used for extrapolation

# Replace the enemy smoothing with a version that better handles orbiting
old_enemy_smooth = '''  for (const e of state.enemies) {
    const tgt = _entityTargets.get(e.id);
    if (!tgt) continue;
    // Velocity extrapolation: move with current velocity for smooth motion
    e.pos.x += tgt.vx * dt;
    e.pos.y += tgt.vy * dt;
    // Correction: smoothly nudge toward server position to prevent drift
    const corrLerp = Math.min(lerp * 1.5, 0.4);
    e.pos.x += (tgt.x - e.pos.x) * corrLerp;
    e.pos.y += (tgt.y - e.pos.y) * corrLerp;
    // Snap if too far off (teleport/respawn)
    const edx = tgt.x - e.pos.x;
    const edy = tgt.y - e.pos.y;
    if (edx * edx + edy * edy > 200 * 200) {
      e.pos.x = tgt.x;
      e.pos.y = tgt.y;
    }
    e.vel.x = tgt.vx;
    e.vel.y = tgt.vy;
  }'''

new_enemy_smooth = '''  for (const e of state.enemies) {
    const tgt = _entityTargets.get(e.id);
    if (!tgt) continue;
    // Velocity extrapolation: always move with server velocity for smooth motion
    const evx = tgt.vx || e.vel.x;
    const evy = tgt.vy || e.vel.y;
    e.pos.x += evx * dt;
    e.pos.y += evy * dt;
    // Correction: nudge toward server position (stronger for slower entities)
    const spd = Math.sqrt(evx * evx + evy * evy);
    const corrStr = spd < 60 ? 0.5 : 0.35;
    const corrLerp = Math.min(lerp * 2.0, corrStr);
    e.pos.x += (tgt.x - e.pos.x) * corrLerp;
    e.pos.y += (tgt.y - e.pos.y) * corrLerp;
    // Snap if too far off (teleport/respawn)
    const edx = tgt.x - e.pos.x;
    const edy = tgt.y - e.pos.y;
    if (edx * edx + edy * edy > 150 * 150) {
      e.pos.x = tgt.x;
      e.pos.y = tgt.y;
    }
    e.vel.x = tgt.vx;
    e.vel.y = tgt.vy;
  }'''

loop = loop.replace(old_enemy_smooth, new_enemy_smooth)
print("  -> Improved frontend interpolation (uses last known velocity, stronger correction for slow enemies)")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(loop)

print("\nDONE!")
print("  - Titan has predictive aiming + heavier spread pattern")
print("  - ALL enemies orbit/strafe when in firing range (no more stopping dead)")
print("  - Titan/Dread base speed increased slightly for visible orbiting")
print("  - Frontend interpolation improved for slow-moving entities")
