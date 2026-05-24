#!/usr/bin/env python3
"""
Fix enemy projectiles and boss variety:
1. Add new projectile render styles (energy ball, plasma bolt)
2. Different enemy types fire different projectile visuals
3. Enemies fire more projectiles, more dangerously
4. Different boss behaviors per enemy type (not just scaled dreadnought)
5. Dreadnought bosses fire WAY more projectiles
"""

import re

# ═══════════════════════════════════════════════════════════════════════════════
# 1. TYPES - Add new WeaponKind values
# ═══════════════════════════════════════════════════════════════════════════════
print("═══ Adding new projectile types ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    types_code = f.read()

old_wk = 'export type WeaponKind = "laser" | "rocket";'
new_wk = 'export type WeaponKind = "laser" | "rocket" | "energy" | "plasma";'
types_code = types_code.replace(old_wk, new_wk)
print("  -> Added 'energy' and 'plasma' to WeaponKind")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(types_code)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. RENDER - Add new projectile visual styles
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding new projectile renders ═══")

with open('frontend/src/game/render.ts', 'r') as f:
    render_code = f.read()

# Insert new render styles before the default laser case
old_else_laser = '''  } else {
    // ── Laser: solid glowing beam ──
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 20;
    // Soft outer glow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Solid colored beam
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pr.color;
    ctx.fillRect(-10, -1.3, 20, 2.6);
    // Hot white core
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-8, -0.6, 16, 1.2);
  }'''

new_renders = '''  } else if (pr.weaponKind === "energy") {
    // ── Energy Ball: pulsing glowing sphere ──
    const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.015);
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 28 * pulse;
    // Outer glow ring
    ctx.globalAlpha = 0.3 * pulse;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(0, 0, pr.size * 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Main sphere
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(0, 0, pr.size * 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Bright white core
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, pr.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Crackling sparks
    ctx.strokeStyle = pr.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7 * pulse;
    for (let s = 0; s < 3; s++) {
      const sa = (Date.now() * 0.003 + s * 2.1) % (Math.PI * 2);
      const sr = pr.size * 1.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * pr.size * 0.8, Math.sin(sa) * pr.size * 0.8);
      ctx.lineTo(Math.cos(sa + 0.3) * sr, Math.sin(sa + 0.3) * sr);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (pr.weaponKind === "plasma") {
    // ── Plasma Bolt: elongated fiery bolt with trail ──
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 22;
    // Trail particles (fading behind)
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.ellipse(-14, 0, 12, pr.size * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(-8, 0, 8, pr.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main plasma body (elongated oval)
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, pr.size * 2, pr.size * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hot core
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(2, 0, pr.size * 0.8, pr.size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Leading edge flare
    const flare = 0.7 + 0.3 * Math.sin(Date.now() * 0.02);
    ctx.globalAlpha = 0.6 * flare;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(pr.size * 1.8, 0, pr.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // ── Laser: solid glowing beam ──
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 20;
    // Soft outer glow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Solid colored beam
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pr.color;
    ctx.fillRect(-10, -1.3, 20, 2.6);
    // Hot white core
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-8, -0.6, 16, 1.2);
  }'''

if 'weaponKind === "energy"' not in render_code:
    render_code = render_code.replace(old_else_laser, new_renders)
    print("  -> Added energy ball and plasma bolt renders")

with open('frontend/src/game/render.ts', 'w') as f:
    f.write(render_code)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. FRONTEND LOOP - Make enemies fire different projectile types + more shots
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Upgrading enemy firing patterns (frontend) ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    loop_code = f.read()

# Replace the entire enemy firing section with type-aware firing
old_enemy_fire = '''    } else if (e.behavior === "ranged") {
      if (e.fireCd <= 0 && ed < 480) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color);
        e.fireCd = 0.6 + Math.random() * 0.4;
      }
    } else if (e.behavior === "tank") {
      if (e.fireCd <= 0 && ed < 440) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle - 0.04, e.damage * 0.9, e.color);
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + 0.04, e.damage * 0.9, e.color);
        e.fireCd = 1.4 + Math.random() * 0.6;
      }
    } else if (e.behavior === "fast") {
      if (e.fireCd <= 0 && ed < 280) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color, 2);
        e.fireCd = 0.5 + Math.random() * 0.4;
      }
    } else {
      if (e.fireCd <= 0 && ed < 500) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color);
        e.fireCd = 1.0 + Math.random() * 0.8;
      }
    }'''

new_enemy_fire = '''    } else if (e.type === "sentinel") {
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
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.06, e.damage, e.color, 5, { weaponKind: "plasma", speedMul: 0.9 });
        }
        e.fireCd = 1.0 + Math.random() * 0.4;
      }
    } else if (e.type === "voidling") {
      // Voidling: pulsing energy shots
      if (e.fireCd <= 0 && ed < 480) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color, 4, { weaponKind: "energy" });
        e.fireCd = 0.6 + Math.random() * 0.3;
      }
    } else if (e.type === "destroyer") {
      // Destroyer: triple plasma spread
      if (e.fireCd <= 0 && ed < 440) {
        for (let i = -1; i <= 1; i++) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.06, e.damage * 0.8, e.color, 4, { weaponKind: "plasma" });
        }
        e.fireCd = 1.2 + Math.random() * 0.5;
      }
    } else if (e.behavior === "fast") {
      // Scout: rapid small lasers
      if (e.fireCd <= 0 && ed < 300) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage, e.color, 2);
        e.fireCd = 0.45 + Math.random() * 0.3;
      }
    } else {
      // Raider/default: dual laser
      if (e.fireCd <= 0 && ed < 500) {
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle - 0.03, e.damage * 0.9, e.color);
        fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + 0.03, e.damage * 0.9, e.color);
        e.fireCd = 0.8 + Math.random() * 0.5;
      }
    }'''

if 'e.type === "sentinel"' not in loop_code:
    loop_code = loop_code.replace(old_enemy_fire, new_enemy_fire)
    print("  -> Replaced enemy firing with type-specific patterns")

# Now replace the boss firing to be type-aware with way more projectiles
old_boss_fire = '''      const phase = e.bossPhase ?? 0;
      if (e.fireCd <= 0 && ed < 600) {
        if (phase === 0) {
          for (let i = -2; i <= 2; i++) {
            fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.1, e.damage, e.color, 4, { speedMul: 0.95 });
          }
          e.fireCd = 1.4;
        } else if (phase === 1) {
          for (let i = -3; i <= 3; i++) {
            fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.12, e.damage * 1.2, "#ff5c6c", 4, { speedMul: 1.05 });
          }
          e.fireCd = 1.0;
        } else {
          for (let i = 0; i < 12; i++) {
            const ra = (Math.PI * 2 / 12) * i + state.tick * 0.5;
            fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.8, "#ff3b4d", 3, { speedMul: 0.7 });
          }
          for (let i = -2; i <= 2; i++) {
            fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.08, e.damage * 1.5, "#ffffff", 5, { speedMul: 1.1 });
          }
          e.fireCd = 1.2;
        }
        e.burstShots = phase >= 1 ? 5 : 3;
        e.burstCd = 0.12;
      }
      if ((e.burstShots ?? 0) > 0) {
        e.burstCd = (e.burstCd ?? 0) - dt;
        if ((e.burstCd ?? 0) <= 0) {
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle, e.damage * 0.7, e.color, 3);
          e.burstShots = (e.burstShots ?? 0) - 1;
          e.burstCd = 0.12;
        }
      }
      if (phase >= 2) { e.speed = 55; }'''

new_boss_fire = '''      const phase = e.bossPhase ?? 0;
      if (e.fireCd <= 0 && ed < 700) {
        if (e.type === "titan" || e.type === "overlord") {
          // TITAN/OVERLORD BOSS: Heavy plasma barrage + energy ring
          if (phase === 0) {
            for (let i = -3; i <= 3; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.09, e.damage, e.color, 6, { weaponKind: "plasma", speedMul: 0.8, aoeRadius: 25 });
            }
            e.fireCd = 1.3;
          } else if (phase === 1) {
            for (let i = -4; i <= 4; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.1, e.damage * 1.2, "#ff4466", 6, { weaponKind: "plasma", speedMul: 0.9, aoeRadius: 30 });
            }
            for (let i = 0; i < 8; i++) {
              const ra = (Math.PI * 2 / 8) * i + state.tick * 0.3;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.6, e.color, 5, { weaponKind: "energy", speedMul: 0.6 });
            }
            e.fireCd = 1.0;
          } else {
            for (let i = 0; i < 16; i++) {
              const ra = (Math.PI * 2 / 16) * i + state.tick * 0.4;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.9, "#ff2244", 5, { weaponKind: "energy", speedMul: 0.65 });
            }
            for (let i = -3; i <= 3; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.07, e.damage * 1.5, "#ffffff", 7, { weaponKind: "plasma", speedMul: 1.0, aoeRadius: 35 });
            }
            e.fireCd = 0.9;
          }
        } else if (e.type === "wraith" || e.type === "sentinel") {
          // WRAITH/SENTINEL BOSS: Rapid energy storm
          if (phase === 0) {
            for (let i = -3; i <= 3; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.12, e.damage * 0.8, e.color, 4, { weaponKind: "energy", speedMul: 1.2 });
            }
            e.fireCd = 0.8;
          } else if (phase === 1) {
            for (let i = -4; i <= 4; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.1, e.damage * 0.9, "#cc44ff", 4, { weaponKind: "energy", speedMul: 1.4 });
            }
            e.fireCd = 0.5;
          } else {
            for (let i = 0; i < 20; i++) {
              const ra = (Math.PI * 2 / 20) * i + state.tick * 0.7;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.6, "#cc44ff", 3, { weaponKind: "energy", speedMul: 1.1 });
            }
            for (let i = -3; i <= 3; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.06, e.damage * 1.3, "#ffffff", 5, { weaponKind: "energy", speedMul: 1.5 });
            }
            e.fireCd = 0.4;
          }
        } else {
          // DREAD BOSS (default): Massive plasma barrage - WAY more projectiles
          if (phase === 0) {
            for (let i = -4; i <= 4; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.08, e.damage, e.color, 5, { weaponKind: "plasma", speedMul: 0.95 });
            }
            e.fireCd = 1.1;
          } else if (phase === 1) {
            for (let i = -5; i <= 5; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.09, e.damage * 1.2, "#ff5c6c", 5, { weaponKind: "plasma", speedMul: 1.1 });
            }
            for (let i = 0; i < 6; i++) {
              const ra = (Math.PI * 2 / 6) * i + state.tick * 0.4;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.7, "#ffaa22", 4, { weaponKind: "energy", speedMul: 0.7 });
            }
            e.fireCd = 0.7;
          } else {
            for (let i = 0; i < 24; i++) {
              const ra = (Math.PI * 2 / 24) * i + state.tick * 0.5;
              fireProjectile("enemy", e.pos.x, e.pos.y, ra, e.damage * 0.7, "#ff3b4d", 4, { weaponKind: "plasma", speedMul: 0.75 });
            }
            for (let i = -4; i <= 4; i++) {
              fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + i * 0.06, e.damage * 1.5, "#ffffff", 6, { weaponKind: "plasma", speedMul: 1.2 });
            }
            e.fireCd = 0.6;
          }
        }
        e.burstShots = phase >= 1 ? 6 : 4;
        e.burstCd = 0.1;
      }
      if ((e.burstShots ?? 0) > 0) {
        e.burstCd = (e.burstCd ?? 0) - dt;
        if ((e.burstCd ?? 0) <= 0) {
          const bWk = (e.type === "wraith" || e.type === "sentinel") ? "energy" : "plasma";
          fireProjectile("enemy", e.pos.x, e.pos.y, e.angle + (Math.random() - 0.5) * 0.2, e.damage * 0.6, e.color, 3, { weaponKind: bWk as any });
          e.burstShots = (e.burstShots ?? 0) - 1;
          e.burstCd = 0.1;
        }
      }
      if (phase >= 2) { e.speed = 55; }'''

if 'e.type === "titan" || e.type === "overlord"' not in loop_code:
    loop_code = loop_code.replace(old_boss_fire, new_boss_fire)
    print("  -> Replaced boss firing with type-specific patterns (way more projectiles)")

# Update boss phase messages to be type-aware
old_phase_msg = '''        pushNotification(newPhase === 1 ? "BOSS ENRAGED — Phase 2!" : "BOSS BERSERK — Phase 3!", "bad");
        pushChat("system", "SYSTEM", newPhase === 1 ? "The dreadnought powers up its secondary weapons!" : "The dreadnought enters berserk mode!");'''

new_phase_msg = '''        pushNotification(newPhase === 1 ? "BOSS ENRAGED — Phase 2!" : "BOSS BERSERK — Phase 3!", "bad");
        const bossName = e.type === "titan" ? "Titan" : e.type === "overlord" ? "Overlord" : e.type === "wraith" ? "Wraith" : e.type === "sentinel" ? "Sentinel" : "Dreadnought";
        pushChat("system", "SYSTEM", newPhase === 1 ? `The ${bossName} powers up its secondary weapons!` : `The ${bossName} enters berserk mode!`);'''

loop_code = loop_code.replace(old_phase_msg, new_phase_msg)
print("  -> Updated boss phase messages to show correct boss name")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(loop_code)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. BACKEND ENGINE - Add weaponKind support to spawnEnemyProjectile + type-aware firing
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Upgrading backend enemy firing ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    eng_code = f.read()

# Update spawnEnemyProjectile to accept weaponKind and size params
old_spawn_sig = '  private spawnEnemyProjectile(zoneId: string, zs: ZoneState, e: ServerEnemy, damage: number, angle: number, color: string): void {'
new_spawn_sig = '  private spawnEnemyProjectile(zoneId: string, zs: ZoneState, e: ServerEnemy, damage: number, angle: number, color: string, weaponKind: string = "laser", size: number = 3, speedMul: number = 1): void {'

eng_code = eng_code.replace(old_spawn_sig, new_spawn_sig)

old_spawn_body = '''    const projSpeed = 600;
    const proj: ServerProjectile = {
      id: eid("ep"),
      zone: zoneId,
      fromPlayerId: null,
      fromEnemyId: e.id,
      fromNpcId: null,
      pos: { x: e.pos.x, y: e.pos.y },
      vel: { x: Math.cos(angle) * projSpeed, y: Math.sin(angle) * projSpeed },
      damage,
      ttl: 2.5,
      color,
      size: 3,
      crit: false,
      weaponKind: "laser",
      homing: false,
      homingTargetId: null,
      aoeRadius: 0,
      empStun: 0,
      armorPiercing: false,
    };'''

new_spawn_body = '''    const projSpeed = 600 * speedMul;
    const proj: ServerProjectile = {
      id: eid("ep"),
      zone: zoneId,
      fromPlayerId: null,
      fromEnemyId: e.id,
      fromNpcId: null,
      pos: { x: e.pos.x, y: e.pos.y },
      vel: { x: Math.cos(angle) * projSpeed, y: Math.sin(angle) * projSpeed },
      damage,
      ttl: 2.5,
      color,
      size,
      crit: false,
      weaponKind: weaponKind as any,
      homing: false,
      homingTargetId: null,
      aoeRadius: 0,
      empStun: 0,
      armorPiercing: false,
    };'''

eng_code = eng_code.replace(old_spawn_body, new_spawn_body)
print("  -> Updated spawnEnemyProjectile with weaponKind/size/speedMul params")

# Replace the backend boss firing with type-specific patterns
old_backend_boss = '''          if (e.isBoss) {
            const shotCount = e.bossPhase === 0 ? 5 : e.bossPhase === 1 ? 7 : 12;
            const spread = e.bossPhase === 2 ? Math.PI * 2 : (shotCount * 0.1);
            for (let i = 0; i < shotCount; i++) {
              const shotAng = e.bossPhase === 2
                ? (Math.PI * 2 / shotCount) * i
                : projAng + (i - (shotCount - 1) / 2) * 0.1;
              this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg / shotCount), shotAng, e.color);
            }'''

new_backend_boss = '''          if (e.isBoss) {
            const phase = e.bossPhase ?? 0;
            if (e.type === "titan" || e.type === "overlord") {
              // TITAN/OVERLORD: Heavy plasma + energy ring
              const shotCount = phase === 0 ? 7 : phase === 1 ? 9 : 16;
              if (phase < 2) {
                for (let i = 0; i < shotCount; i++) {
                  const shotAng = projAng + (i - (shotCount - 1) / 2) * 0.09;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg / shotCount), shotAng, e.color, "plasma", 6, 0.8);
                }
              } else {
                for (let i = 0; i < 16; i++) {
                  const ra = (Math.PI * 2 / 16) * i;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.6 / 16), ra, "#ff2244", "energy", 5, 0.65);
                }
                for (let i = -3; i <= 3; i++) {
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.2 / 7), projAng + i * 0.07, "#ffffff", "plasma", 7, 1.0);
                }
              }
            } else if (e.type === "wraith" || e.type === "sentinel") {
              // WRAITH/SENTINEL: Rapid energy storm
              const shotCount = phase === 0 ? 7 : phase === 1 ? 9 : 20;
              const spd = phase === 0 ? 1.2 : phase === 1 ? 1.4 : 1.1;
              if (phase < 2) {
                for (let i = 0; i < shotCount; i++) {
                  const shotAng = projAng + (i - (shotCount - 1) / 2) * 0.12;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg / shotCount), shotAng, e.color, "energy", 4, spd);
                }
              } else {
                for (let i = 0; i < 20; i++) {
                  const ra = (Math.PI * 2 / 20) * i;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.5 / 20), ra, "#cc44ff", "energy", 3, 1.1);
                }
                for (let i = -3; i <= 3; i++) {
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.0 / 7), projAng + i * 0.06, "#ffffff", "energy", 5, 1.5);
                }
              }
            } else {
              // DREAD (default): Massive plasma barrage
              const shotCount = phase === 0 ? 9 : phase === 1 ? 11 : 24;
              if (phase < 2) {
                for (let i = 0; i < shotCount; i++) {
                  const shotAng = projAng + (i - (shotCount - 1) / 2) * 0.08;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg / shotCount), shotAng, e.color, "plasma", 5, phase === 1 ? 1.1 : 0.95);
                }
                if (phase === 1) {
                  for (let i = 0; i < 6; i++) {
                    const ra = (Math.PI * 2 / 6) * i;
                    this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.5 / 6), ra, "#ffaa22", "energy", 4, 0.7);
                  }
                }
              } else {
                for (let i = 0; i < 24; i++) {
                  const ra = (Math.PI * 2 / 24) * i;
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.6 / 24), ra, "#ff3b4d", "plasma", 4, 0.75);
                }
                for (let i = -4; i <= 4; i++) {
                  this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 1.2 / 9), projAng + i * 0.06, "#ffffff", "plasma", 6, 1.2);
                }
              }
            }'''

eng_code = eng_code.replace(old_backend_boss, new_backend_boss)
print("  -> Replaced backend boss firing with type-specific patterns")

# Replace non-boss enemy firing to be type-aware
old_backend_nonboss = '''          } else if (e.behavior === "tank") {
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.9), projAng - 0.04, e.color);
            this.spawnEnemyProjectile(zoneId, zs, e, Math.round(dmg * 0.9), projAng + 0.04, e.color);
          } else {
            this.spawnEnemyProjectile(zoneId, zs, e, dmg, projAng, e.color);
          }'''

new_backend_nonboss = '''          } else if (e.type === "sentinel") {
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

eng_code = eng_code.replace(old_backend_nonboss, new_backend_nonboss)
print("  -> Replaced backend non-boss firing with type-specific patterns")

# Update backend fire rate for non-boss enemies to be faster
old_fire_timer = "e.fireTimer = e.isBoss ? this.bossFireCd(e) : (e.behavior === \"fast\" ? randRange(0.6, 1.0) : randRange(0.8, 1.5));"
new_fire_timer = """e.fireTimer = e.isBoss ? this.bossFireCd(e) : (e.type === "wraith" ? randRange(0.4, 0.7) : e.type === "sentinel" ? randRange(0.5, 0.8) : e.type === "overlord" ? randRange(0.7, 1.0) : e.behavior === "fast" ? randRange(0.5, 0.8) : randRange(0.7, 1.2));"""
eng_code = eng_code.replace(old_fire_timer, new_fire_timer)
print("  -> Updated enemy fire rates (faster for dangerous types)")

# Update boss fire cooldowns to be faster
old_bossFireCd = '''  private bossFireCd(e: ServerEnemy): number {
    if (e.bossPhase === 0) return 1.4;
    if (e.bossPhase === 1) return 1.0;
    return 1.2;
  }'''

new_bossFireCd = '''  private bossFireCd(e: ServerEnemy): number {
    if (e.type === "wraith" || e.type === "sentinel") {
      if (e.bossPhase === 0) return 0.8;
      if (e.bossPhase === 1) return 0.5;
      return 0.4;
    }
    if (e.type === "titan" || e.type === "overlord") {
      if (e.bossPhase === 0) return 1.3;
      if (e.bossPhase === 1) return 1.0;
      return 0.9;
    }
    // Dread default - slightly faster than before
    if (e.bossPhase === 0) return 1.1;
    if (e.bossPhase === 1) return 0.7;
    return 0.6;
  }'''

eng_code = eng_code.replace(old_bossFireCd, new_bossFireCd)
print("  -> Updated boss fire cooldowns by type (dread much faster)")

# Also update backend WeaponKind type
old_backend_wk = eng_code
if '"laser" | "rocket"' in eng_code and '"energy"' not in eng_code[:500]:
    eng_code = eng_code.replace('"laser" | "rocket"', '"laser" | "rocket" | "energy" | "plasma"', 1)
    print("  -> Updated backend WeaponKind type")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(eng_code)

# Also update backend data.ts WeaponKind if it exists there
with open('backend/src/game/data.ts', 'r') as f:
    data_code = f.read()

if 'WeaponKind' in data_code and '"energy"' not in data_code:
    data_code = data_code.replace('export type WeaponKind = "laser" | "rocket";', 'export type WeaponKind = "laser" | "rocket" | "energy" | "plasma";')
    print("  -> Updated backend data.ts WeaponKind type")
    with open('backend/src/game/data.ts', 'w') as f:
        f.write(data_code)

print("\nDONE!")
print("  - 2 new projectile visuals: energy balls (pulsing spheres) + plasma bolts (elongated fiery)")
print("  - Each enemy type now fires unique projectile style")
print("  - Bosses have completely different attack patterns per type")
print("  - Dread boss fires 9/11+6/24+9 projectiles (was 5/7/12)")
print("  - Titan/Overlord boss fires heavy plasma + energy rings")
print("  - Wraith/Sentinel boss fires rapid energy storms")
print("  - All enemies fire faster and more aggressively")
