#!/usr/bin/env python3
"""Fix particle effects for renderOnly hits and enemy projectile vs other players."""

print("Loading loop.ts...")
with open('frontend/src/game/loop.ts', 'r') as f:
    content = f.read()

# ── FIX 1: Enhance renderOnly projectile hit effects on enemies ──
print("FIX 1: Enhance renderOnly projectile hit VFX on enemies...")

old_renderonly = '''          if (pr.renderOnly) {
            // Visual-only projectile from another player: show VFX but skip damage
            e.hitFlash = 1;
            sfx.enemyHit();
            emitSpark(pr.pos.x, pr.pos.y, e.color, pr.crit ? 8 : 4, pr.crit ? 180 : 120, pr.crit ? 4 : 3);
            return false; // remove projectile
          }'''

new_renderonly = '''          if (pr.renderOnly) {
            e.hitFlash = 1;
            sfx.enemyHit();
            emitSpark(pr.pos.x, pr.pos.y, e.color, pr.crit ? 8 : 4, pr.crit ? 180 : 120, pr.crit ? 4 : 3);
            emitSpark(pr.pos.x, pr.pos.y, "#ffffff", pr.crit ? 4 : 2, pr.crit ? 140 : 90, 2);
            emitRing(pr.pos.x, pr.pos.y, pr.color, pr.crit ? 35 : 22);
            state.particles.push({
              id: `hf-${Math.random().toString(36).slice(2, 8)}`,
              pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 },
              ttl: 0.14, maxTtl: 0.14,
              color: pr.crit ? "#ffd24a" : "#ffffff",
              size: pr.crit ? 40 : 25, kind: "flash",
            });
            const emberCount = pr.crit ? 4 : 2;
            for (let ei = 0; ei < emberCount; ei++) {
              const ea = Math.random() * Math.PI * 2;
              const es = 80 + Math.random() * 120;
              const eColors = ["#ff8c00", "#ff4500", "#ffd700", e.color];
              state.particles.push({
                id: `em-${Math.random().toString(36).slice(2, 8)}`,
                pos: { x: pr.pos.x, y: pr.pos.y },
                vel: { x: Math.cos(ea) * es, y: Math.sin(ea) * es },
                ttl: 0.3 + Math.random() * 0.25, maxTtl: 0.55,
                color: eColors[Math.floor(Math.random() * eColors.length)],
                size: 1.5 + Math.random() * 1.5, kind: "ember",
              });
            }
            if (pr.weaponKind === "rocket") {
              for (let fi = 0; fi < 4; fi++) {
                const fa = Math.random() * Math.PI * 2;
                const fs = 40 + Math.random() * 80;
                state.particles.push({
                  id: `rfb-${Math.random().toString(36).slice(2, 8)}`,
                  pos: { x: pr.pos.x, y: pr.pos.y },
                  vel: { x: Math.cos(fa) * fs, y: Math.sin(fa) * fs },
                  ttl: 0.25 + Math.random() * 0.25, maxTtl: 0.5,
                  color: Math.random() > 0.5 ? "#ff8a4e" : "#ffd24a", size: 5 + Math.random() * 6, kind: "fireball",
                });
              }
              for (let si = 0; si < 4; si++) {
                const sa = Math.random() * Math.PI * 2;
                const ss = 25 + Math.random() * 40;
                state.particles.push({
                  id: `rsmk-${Math.random().toString(36).slice(2, 8)}`,
                  pos: { x: pr.pos.x, y: pr.pos.y },
                  vel: { x: Math.cos(sa) * ss, y: Math.sin(sa) * ss },
                  ttl: 0.4 + Math.random() * 0.3, maxTtl: 0.7,
                  color: "#999999", size: 5 + Math.random() * 5, kind: "smoke",
                });
              }
              sfx.explosion();
            }
            const hitDist = Math.hypot(pr.pos.x - state.player.pos.x, pr.pos.y - state.player.pos.y);
            const hitShake = pr.weaponKind === "rocket" ? 0.2 : (pr.crit ? 0.1 : 0.05);
            state.cameraShake = Math.max(state.cameraShake, hitShake * Math.max(0, 1 - hitDist / 500));
            return false;
          }'''

if old_renderonly in content:
    content = content.replace(old_renderonly, new_renderonly)
    print("  -> Enhanced renderOnly hit VFX (ring, flash, embers, rocket explosion, camera shake)")
else:
    print("  -> WARNING: Could not find renderOnly hit code")


# ── FIX 2: Add enemy projectile collision against other players ──
print("FIX 2: Enemy projectiles visually collide with other players...")

old_player_hit = '''      if (distance(pr.pos.x, pr.pos.y, p.pos.x, p.pos.y) < 12) {
        if (!serverAuthoritative) damagePlayer(pr.damage);
        return false;
      }'''

new_player_hit = '''      for (const o of state.others) {
        if (distance(pr.pos.x, pr.pos.y, o.pos.x, o.pos.y) < 14) {
          emitSpark(pr.pos.x, pr.pos.y, "#ff5c6c", 5, 80, 2);
          emitRing(pr.pos.x, pr.pos.y, "#ff5c6c", 18);
          state.particles.push({
            id: `ohf-${Math.random().toString(36).slice(2, 8)}`,
            pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 },
            ttl: 0.1, maxTtl: 0.1,
            color: "#ff5c6c", size: 20, kind: "flash",
          });
          return false;
        }
      }
      if (distance(pr.pos.x, pr.pos.y, p.pos.x, p.pos.y) < 12) {
        if (!serverAuthoritative) damagePlayer(pr.damage);
        return false;
      }'''

if old_player_hit in content:
    content = content.replace(old_player_hit, new_player_hit)
    print("  -> Added enemy projectile vs other players visual collision")
else:
    print("  -> WARNING: Could not find player hit collision code")


# ── FIX 3: Make onEnemyAttack projectiles renderOnly for non-target players ──
print("FIX 3: Enemy attack projectiles renderOnly for non-target players...")

old_attack = '''export function onEnemyAttack(data: EnemyAttackEvent): void {
  fireProjectile("enemy", data.pos.x, data.pos.y,
    Math.atan2(data.targetPos.y - data.pos.y, data.targetPos.x - data.pos.x),
    data.damage, "#ff5c6c", 3);
  if (!serverAuthoritative) {
    damagePlayer(data.damage);
  }
}'''

new_attack = '''export function onEnemyAttack(data: EnemyAttackEvent): void {
  const isTargetingMe = data.targetId === serverPlayerId;
  fireProjectile("enemy", data.pos.x, data.pos.y,
    Math.atan2(data.targetPos.y - data.pos.y, data.targetPos.x - data.pos.x),
    data.damage, "#ff5c6c", 3, { renderOnly: !isTargetingMe });
  if (!serverAuthoritative && isTargetingMe) {
    damagePlayer(data.damage);
  }
}'''

if old_attack in content:
    content = content.replace(old_attack, new_attack)
    print("  -> Enemy attack projectiles are renderOnly for non-target players")
else:
    print("  -> WARNING: Could not find onEnemyAttack")


with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(content)

print("\nAll particle/collision fixes applied!")
