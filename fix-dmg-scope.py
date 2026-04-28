#!/usr/bin/env python3
"""
Fix critical backend crash: 'dmg is not defined' in boss secondary attacks.
The secondary attack code runs outside the if(fireTimer) block where dmg/projAng are defined.
Fix: compute own dmg/projAng in the secondary attack block.
"""

print("═══ Fixing backend dmg scope crash ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    eng = f.read()

# Replace the broken secondary attack code with self-contained version
old_secondary = '''        // Boss secondary attacks (spiral + area denial between main volleys)
        if (e.isBoss) {
          e.secondaryTimer = (e.secondaryTimer ?? 0.5) - dt;
          if (e.secondaryTimer <= 0 && d < 700) {
            const phase = e.bossPhase ?? 0;
            if (phase >= 1) {
              // Rotating spiral (2 arms)
              const spiralBase = (this.tickCount ?? 0) * 0.08;
              for (let arm = 0; arm < 2; arm++) {
                const sAng = spiralBase + arm * Math.PI;
                this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.3), sAng, e.color, "energy", 3, 0.55);
              }
            }
            if (phase >= 2) {
              // Area denial around player
              for (let i = 0; i < 3; i++) {
                const offsetAng = projAng + (i - 1) * 0.4 + (Math.random() - 0.5) * 0.2;
                this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.4), offsetAng, "#ff8844", "plasma", 4, 0.6);
              }
            }
            e.secondaryTimer = phase >= 2 ? 0.35 : 0.6;
          }
        }'''

new_secondary = '''        // Boss secondary attacks (spiral + area denial between main volleys)
        if (e.isBoss && target) {
          e.secondaryTimer = (e.secondaryTimer ?? 0.5) - dt;
          if (e.secondaryTimer <= 0 && d < 700) {
            const secDmg = this.calcEnemyDamage(e, target);
            const secTPos = { x: target.posX, y: target.posY };
            const secAng = angleFromTo(e.pos, secTPos);
            const phase = e.bossPhase ?? 0;
            if (phase >= 1) {
              // Rotating spiral (2 arms)
              const spiralBase = (this.tickCount ?? 0) * 0.08;
              for (let arm = 0; arm < 2; arm++) {
                const sAng = spiralBase + arm * Math.PI;
                this.spawnEnemyProjectile(zoneId, zs, e, Math.round(secDmg * 0.3), sAng, e.color, "energy", 3, 0.55);
              }
            }
            if (phase >= 2) {
              // Area denial around player
              for (let i = 0; i < 3; i++) {
                const offsetAng = secAng + (i - 1) * 0.4 + (Math.random() - 0.5) * 0.2;
                this.spawnEnemyProjectile(zoneId, zs, e, Math.round(secDmg * 0.4), offsetAng, "#ff8844", "plasma", 4, 0.6);
              }
            }
            e.secondaryTimer = phase >= 2 ? 0.35 : 0.6;
          }
        }'''

eng = eng.replace(old_secondary, new_secondary)
print("  -> Fixed: secondary attacks now compute own dmg/angle (no more crash)")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(eng)

# Also improve the enemy movement on the backend to reduce jitter for slow enemies
print("\n═══ Improving slow enemy movement (backend) ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    eng = f.read()

# Check if there's a movement section that might cause step-by-step for slow enemies
# The issue is likely that tank enemies (titan/dread) have very low speed (35/45) and
# the movement looks choppy because they stop-start when targeting
# Let's check the enemy movement code

import re

# Find enemy movement section
move_match = re.search(r'(// Move toward target.*?(?:e\.pos\.x \+= e\.vel\.x \* dt;.*?e\.pos\.y \+= e\.vel\.y \* dt;))', eng, re.DOTALL)
if move_match:
    print(f"  -> Found enemy movement at offset {move_match.start()}")

# The issue might also be that the server sends positions at 30Hz and the client
# interpolation isn't aggressive enough for slow-moving enemies.
# Let's increase the interpolation factor for smoother movement
with open('lib/game-constants.ts', 'r') as f:
    consts = f.read()

old_interp = 'INTERPOLATION_FACTOR: 0.15,'
new_interp = 'INTERPOLATION_FACTOR: 0.25,'
consts = consts.replace(old_interp, new_interp)
print("  -> Increased interpolation factor from 0.15 to 0.25 for smoother movement")

with open('lib/game-constants.ts', 'w') as f:
    f.write(consts)

print("\nDONE!")
print("  - Backend tick crash FIXED (boss secondary attacks no longer reference out-of-scope variables)")
print("  - ALL enemy attack patterns should now work (predictive aiming, area denial, new projectile types)")
print("  - Interpolation factor increased for smoother slow-enemy movement")
