#!/usr/bin/env python3
"""
Add more attack variety to bosses and higher-tier enemies:
1. Predictive aiming (leading shots based on player velocity)
2. Area denial shots (fire around the player, not just at them)
3. Spiral patterns for bosses
4. Homing energy orbs (slow tracking shots)
5. More aggressive regular enemies on higher maps
"""

# ═══════════════════════════════════════════════════════════════════════════════
# FRONTEND LOOP - Add attack variety
# ═══════════════════════════════════════════════════════════════════════════════
print("═══ Adding attack variety to frontend ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    loop = f.read()

# 1. Replace non-boss enemy firing with more variety + predictive aiming
old_nonboss = '''    } else if (e.type === "sentinel") {
      // Sentinel: rapid energy double-tap
      if (e.fireCd <= 0 && ed < 520) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle - 0.03, e.damage, e.color, 4, { weaponKind: "energy" });
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + 0.03, e.damage, e.color, 4, { weaponKind: "energy" });
        e.fireCd = 0.7 + Math.random() * 0.3;
      }
    } else if (e.type === "wraith") {
      // Wraith: fast triple-shot energy bolts
      if (e.fireCd <= 0 && ed < 350) {
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.15, e.damage * 0.8, e.color, 3, { weaponKind: "energy", speedMul: 1.3 });
        }
        e.fireCd = 0.4 + Math.random() * 0.3;
      }
    } else if (e.type === "titan") {
      // Titan: slow heavy plasma with splash
      if (e.fireCd <= 0 && ed < 500) {
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.08, e.damage * 1.3, e.color, 6, { weaponKind: "plasma", speedMul: 0.7, aoeRadius: 30 });
        }
        e.fireCd = 1.2 + Math.random() * 0.4;
      }
    } else if (e.type === "overlord") {
      // Overlord: mixed energy barrage + plasma
      if (e.fireCd <= 0 && ed < 550) {
        for (let i = -2; i <= 2; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.1, e.damage * 0.7, e.color, 4, { weaponKind: "energy", speedMul: 1.1 });
        }
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage * 1.5, "#ff4466", 7, { weaponKind: "plasma", speedMul: 0.8, aoeRadius: 40 });
        e.fireCd = 0.9 + Math.random() * 0.3;
      }
    } else if (e.type === "dread") {
      // Dread: heavy plasma spread
      if (e.fireCd <= 0 && ed < 480) {
        for (let i = -1; i <= 1; i++) {'''

new_nonboss = '''    } else if (e.type === "sentinel") {
      // Sentinel: predictive double-tap + area denial bursts
      if (e.fireCd <= 0 && ed < 520) {
        const p = state.player;
        // Predictive aim: lead the target based on player velocity
        const projSpd = 220 * 1.2;
        const tHit = ed / projSpd;
        const predX = p.pos.x + p.vel.x * tHit * 0.6;
        const predY = p.pos.y + p.vel.y * tHit * 0.6;
        const predAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
        // Main shots aimed at predicted position
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng - 0.04, e.damage, e.color, 4, { weaponKind: "energy", speedMul: 1.2 });
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng + 0.04, e.damage, e.color, 4, { weaponKind: "energy", speedMul: 1.2 });
        // Area denial: shots offset to sides of player
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng + 0.3, e.damage * 0.5, e.color, 3, { weaponKind: "energy", speedMul: 0.9 });
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng - 0.3, e.damage * 0.5, e.color, 3, { weaponKind: "energy", speedMul: 0.9 });
        e.fireCd = 0.6 + Math.random() * 0.3;
      }
    } else if (e.type === "wraith") {
      // Wraith: fast predictive burst + flanking shots
      if (e.fireCd <= 0 && ed < 400) {
        const p = state.player;
        const projSpd = 220 * 1.4;
        const tHit = ed / projSpd;
        const predX = p.pos.x + p.vel.x * tHit * 0.7;
        const predY = p.pos.y + p.vel.y * tHit * 0.7;
        const predAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
        // Fast triple burst at predicted position
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, predAng + i * 0.12, e.damage * 0.7, e.color, 3, { weaponKind: "energy", speedMul: 1.4 });
        }
        // Two flanking shots aimed where player might dodge
        const dodgeAng1 = predAng + Math.PI * 0.4;
        const dodgeAng2 = predAng - Math.PI * 0.4;
        fireProjectile("enemy", e.pos.x, e.pos.y, dodgeAng1, e.damage * 0.4, e.color, 2, { weaponKind: "energy", speedMul: 1.6 });
        fireProjectile("enemy", e.pos.x, e.pos.y, dodgeAng2, e.damage * 0.4, e.color, 2, { weaponKind: "energy", speedMul: 1.6 });
        e.fireCd = 0.35 + Math.random() * 0.25;
      }
    } else if (e.type === "titan") {
      // Titan: heavy plasma spread + slow homing orb + ground denial
      if (e.fireCd <= 0 && ed < 520) {
        const p = state.player;
        // Main heavy spread
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.08, e.damage * 1.2, e.color, 6, { weaponKind: "plasma", speedMul: 0.7, aoeRadius: 30 });
        }
        // Area denial: shots aimed around the player (not at them)
        const pAng = Math.atan2(p.pos.y - e.pos.y, p.pos.x - e.pos.x);
        for (let i = 0; i < 4; i++) {
          const offsetAng = pAng + (i - 1.5) * 0.25;
          fireProjectile("enemy", e.pos.x, e.pos.y, offsetAng, e.damage * 0.6, "#ff6644", 5, { weaponKind: "plasma", speedMul: 0.5, aoeRadius: 40 });
        }
        e.fireCd = 1.0 + Math.random() * 0.3;
      }
    } else if (e.type === "overlord") {
      // Overlord: predictive barrage + 360 pulse + homing
      if (e.fireCd <= 0 && ed < 600) {
        const p = state.player;
        const projSpd = 220 * 1.1;
        const tHit = ed / projSpd;
        const predX = p.pos.x + p.vel.x * tHit * 0.5;
        const predY = p.pos.y + p.vel.y * tHit * 0.5;
        const predAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
        // Main barrage at predicted position
        for (let i = -2; i <= 2; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, predAng + i * 0.09, e.damage * 0.7, e.color, 4, { weaponKind: "energy", speedMul: 1.1 });
        }
        // Heavy center shot
        fireProjectile("enemy", e.pos.x, e.pos.y, predAng, e.damage * 1.5, "#ff4466", 7, { weaponKind: "plasma", speedMul: 0.8, aoeRadius: 40 });
        // Area denial ring (4 shots around player area)
        for (let i = 0; i < 4; i++) {
          const ringAng = predAng + (Math.PI / 3) * (i - 1.5);
          fireProjectile("enemy", e.pos.x, e.pos.y, ringAng, e.damage * 0.4, e.color, 3, { weaponKind: "energy", speedMul: 0.7 });
        }
        e.fireCd = 0.7 + Math.random() * 0.3;
      }
    } else if (e.type === "dread") {
      // Dread: heavy plasma spread + predictive shots
      if (e.fireCd <= 0 && ed < 500) {
        const p = state.player;
        const projSpd = 220 * 0.9;
        const tHit = ed / projSpd;
        const predX = p.pos.x + p.vel.x * tHit * 0.4;
        const predY = p.pos.y + p.vel.y * tHit * 0.4;
        const predAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
        for (let i = -1; i <= 1; i++) {'''

loop = loop.replace(old_nonboss, new_nonboss)
print("  -> Enhanced non-boss enemy attacks with predictive aiming + area denial")

# 2. Add secondary attack timer to bosses (spiral/mortar between main volleys)
# We'll add this after the burst shots section
old_burst_end = '''      if ((e.burstShots ?? 0) > 0) {
        e.burstCd = (e.burstCd ?? 0) - dt;
        if ((e.burstCd ?? 0) <= 0) {
          const bWk = (e.type === "wraith" || e.type === "sentinel") ? "energy" : "plasma";
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + (Math.random() - 0.5) * 0.2, e.damage * 0.6, e.color, 3, { weaponKind: bWk as any });
          e.burstShots = (e.burstShots ?? 0) - 1;
          e.burstCd = 0.1;
        }
      }
      if (phase >= 2) { e.speed = 55; }'''

new_burst_end = '''      if ((e.burstShots ?? 0) > 0) {
        e.burstCd = (e.burstCd ?? 0) - dt;
        if ((e.burstCd ?? 0) <= 0) {
          const bWk = (e.type === "wraith" || e.type === "sentinel") ? "energy" : "plasma";
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + (Math.random() - 0.5) * 0.2, e.damage * 0.6, e.color, 3, { weaponKind: bWk as any });
          e.burstShots = (e.burstShots ?? 0) - 1;
          e.burstCd = 0.1;
        }
      }
      // Boss secondary attacks: spiral + area denial (runs between main volleys)
      e.secondaryCd = (e.secondaryCd ?? 0.5) - dt;
      if (e.secondaryCd <= 0 && ed < 700) {
        const p = state.player;
        const pAng = Math.atan2(p.pos.y - e.pos.y, p.pos.x - e.pos.x);
        if (phase >= 1) {
          // Rotating spiral pattern (2 arms)
          const spiralBase = state.tick * 2.5;
          for (let arm = 0; arm < 2; arm++) {
            const sAng = spiralBase + arm * Math.PI;
            fireProjectile("enemy", e.pos.x, e.pos.y, sAng, e.damage * 0.4, e.color, 3, { weaponKind: "energy", speedMul: 0.55 });
          }
        }
        if (phase >= 2) {
          // Area denial: fire at positions around the player
          const pDist = ed * 0.8;
          for (let i = 0; i < 3; i++) {
            const offsetAng = pAng + (i - 1) * 0.4 + (Math.random() - 0.5) * 0.2;
            fireProjectile("enemy", e.pos.x, e.pos.y, offsetAng, e.damage * 0.5, "#ff8844", 4, { weaponKind: "plasma", speedMul: 0.6, aoeRadius: 35 });
          }
          // Slow homing orb (aims at player predicted position)
          const projSpd = 220 * 0.4;
          const tHit = ed / projSpd;
          const predX = p.pos.x + p.vel.x * tHit * 0.5;
          const predY = p.pos.y + p.vel.y * tHit * 0.5;
          const homingAng = Math.atan2(predY - e.pos.y, predX - e.pos.x);
          fireProjectile("enemy", e.pos.x, e.pos.y, homingAng, e.damage * 0.8, "#ffcc00", 5, { weaponKind: "energy", speedMul: 0.4, homing: true });
        }
        e.secondaryCd = phase >= 2 ? 0.35 : 0.6;
      }
      if (phase >= 2) { e.speed = 55; }'''

loop = loop.replace(old_burst_end, new_burst_end)
print("  -> Added boss secondary attacks (spiral pattern + area denial + homing orbs)")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(loop)

# ═══════════════════════════════════════════════════════════════════════════════
# BACKEND ENGINE - Same improvements for server-authoritative combat
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding attack variety to backend ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    eng = f.read()

# Replace the non-boss enemy firing with predictive aiming
old_backend_nonboss = '''          } else if (e.type === "sentinel") {
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.9), projAng - 0.03, e.color, "energy", 4);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.9), projAng + 0.03, e.color, "energy", 4);
          } else if (e.type === "wraith") {
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.7), projAng + i * 0.15, e.color, "energy", 3, 1.3);
            }
          } else if (e.type === "titan") {
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.1), projAng + i * 0.08, e.color, "plasma", 6, 0.7);
            }
          } else if (e.type === "overlord") {
            for (let i = -2; i <= 2; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.6), projAng + i * 0.1, e.color, "energy", 4, 1.1);
            }
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.3), projAng, "#ff4466", "plasma", 7, 0.8);
          } else if (e.type === "dread") {
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.9), projAng + i * 0.06, e.color, "plasma", 5, 0.9);
            }
          } else if (e.type === "destroyer") {
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.8), projAng + i * 0.06, e.color, "plasma", 4);
            }
          } else if (e.type === "voidling") {
            this.spawnEnemyProjectile(zoneId, zs, e, dmg, projAng, e.color, "energy", 4);
          } else {
            this.spawnEnemyProjectile(zoneId, zs, e, dmg, projAng, e.color);
          }'''

new_backend_nonboss = '''          } else if (e.type === "sentinel") {
            // Predictive aim + area denial
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 1.2);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 80, y: tPos.y + pVelY * predTime * 80 });
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.9), predAng - 0.04, e.color, "energy", 4, 1.2);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.9), predAng + 0.04, e.color, "energy", 4, 1.2);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.4), predAng + 0.3, e.color, "energy", 3, 0.9);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.4), predAng - 0.3, e.color, "energy", 3, 0.9);
          } else if (e.type === "wraith") {
            // Fast predictive burst + flanking
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 1.4);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 90, y: tPos.y + pVelY * predTime * 90 });
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.6), predAng + i * 0.12, e.color, "energy", 3, 1.4);
            }
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.3), predAng + Math.PI * 0.4, e.color, "energy", 2, 1.6);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.3), predAng - Math.PI * 0.4, e.color, "energy", 2, 1.6);
          } else if (e.type === "titan") {
            // Heavy spread + area denial around player
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.0), projAng + i * 0.08, e.color, "plasma", 6, 0.7);
            }
            for (let i = 0; i < 4; i++) {
              const offsetAng = projAng + (i - 1.5) * 0.25;
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.5), offsetAng, "#ff6644", "plasma", 5, 0.5);
            }
          } else if (e.type === "overlord") {
            // Predictive barrage + area denial ring
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 1.1);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 70, y: tPos.y + pVelY * predTime * 70 });
            for (let i = -2; i <= 2; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.5), predAng + i * 0.09, e.color, "energy", 4, 1.1);
            }
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.2), predAng, "#ff4466", "plasma", 7, 0.8);
            for (let i = 0; i < 4; i++) {
              const ringAng = predAng + (Math.PI / 3) * (i - 1.5);
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.3), ringAng, e.color, "energy", 3, 0.7);
            }
          } else if (e.type === "dread") {
            // Predictive plasma spread
            const pVelX = target.targetX !== null ? (target.targetX - target.posX) * 0.3 : 0;
            const pVelY = target.targetY !== null ? (target.targetY - target.posY) * 0.3 : 0;
            const predTime = d / (600 * 0.9);
            const predAng = angleFromTo(e.pos, { x: tPos.x + pVelX * predTime * 60, y: tPos.y + pVelY * predTime * 60 });
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.8), predAng + i * 0.06, e.color, "plasma", 5, 0.9);
            }
          } else if (e.type === "destroyer") {
            for (let i = -1; i <= 1; i++) {
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.7), projAng + i * 0.06, e.color, "plasma", 4);
            }
          } else if (e.type === "voidling") {
            this.spawnEnemyProjectile(zoneId, zs, e, dmg, projAng, e.color, "energy", 4);
          } else {
            this.spawnEnemyProjectile(zoneId, zs, e, dmg, projAng, e.color);
          }'''

eng = eng.replace(old_backend_nonboss, new_backend_nonboss)
print("  -> Enhanced backend non-boss enemies with predictive aiming + area denial")

# Add boss secondary attack timer to the backend boss AI
# Find the boss phase cycling section and add secondary attack logic
old_boss_phase = '''        // Boss phase cycling
        if (e.isBoss) {
          e.phaseTimer -= dt;'''

new_boss_phase = '''        // Boss secondary attacks (spiral + area denial between main volleys)
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
        }

        // Boss phase cycling
        if (e.isBoss) {
          e.phaseTimer -= dt;'''

eng = eng.replace(old_boss_phase, new_boss_phase)
print("  -> Added backend boss secondary attacks (spiral + area denial)")

# Add tickCount to the engine class for spiral timing
if 'this.tickCount' not in eng:
    # Add tickCount increment at the start of tick
    old_tick_start = 'tick(dt: number, getPlayersInZone: (zone: string) => OnlinePlayer[]): GameEvent[] {'
    new_tick_start = 'tick(dt: number, getPlayersInZone: (zone: string) => OnlinePlayer[]): GameEvent[] {\n    this.tickCount = (this.tickCount ?? 0) + 1;'
    eng = eng.replace(old_tick_start, new_tick_start, 1)
    print("  -> Added tickCount for spiral timing")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(eng)

print("\nDONE!")
print("  - Sentinel/Wraith/Overlord now use PREDICTIVE aiming (lead shots toward where player is moving)")
print("  - Titan/Overlord fire AREA DENIAL shots around the player (not just at them)")
print("  - Wraith fires FLANKING shots to cut off dodge paths")
print("  - Bosses have SECONDARY attacks between main volleys:")
print("    - Phase 2+: Rotating spiral pattern (2 arms)")
print("    - Phase 3+: Area denial plasma around player + homing energy orbs")
print("  - Higher enemies fire MORE projectiles total per volley")
