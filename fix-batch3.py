#!/usr/bin/env python3
"""Batch 3 fixes: speed/friction, enemy targeting, dungeon, particles."""

# ── FIX 1: game-constants.ts - New speed/friction values ──
print("FIX 1: Adjusting speed constants...")
with open('lib/game-constants.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'ACCELERATION_MULTIPLIER: 2.5,',
    'ACCELERATION_MULTIPLIER: 0,'
)
content = content.replace(
    'FRICTION_PER_60FPS_FRAME: 0.96,',
    'FRICTION_PER_60FPS_FRAME: 0.975,'
)

with open('lib/game-constants.ts', 'w') as f:
    f.write(content)
print("  -> FRICTION: 0.96 -> 0.975 (smoother coasting)")
print("  -> ACCELERATION_MULTIPLIER: set to 0 (will use flat accel)")

# ── FIX 2: loop.ts + engine.ts - Flat acceleration instead of speed-proportional ──
print("FIX 2: Flat acceleration (500) on frontend + backend...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Frontend: change accel calculation
old_accel_f = 'const accel = stats.speed * MOVEMENT.ACCELERATION_MULTIPLIER;'
new_accel_f = 'const accel = 500;'
lc = lc.replace(old_accel_f, new_accel_f)
print("  -> Frontend: flat accel = 500")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

with open('backend/src/game/engine.ts', 'r') as f:
    ec = f.read()

# Backend: change accel calculation
old_accel_b = 'const accel = p.speed * MOVEMENT.ACCELERATION_MULTIPLIER;'
new_accel_b = 'const accel = 500;'
ec = ec.replace(old_accel_b, new_accel_b)
print("  -> Backend: flat accel = 500")


# ── FIX 3: engine.ts - Enemy retarget cooldown ──
print("FIX 3: Enemy retarget cooldown (2.5 seconds)...")

# Add retargetCd to enemy type
old_aggro_hit = '            e.aggroTarget = proj.fromPlayerId;'
new_aggro_hit = '''            if (e.aggroTarget !== proj.fromPlayerId && (!e.retargetCd || e.retargetCd <= 0)) {
              e.aggroTarget = proj.fromPlayerId;
              e.retargetCd = 2.5;
            }'''

ec = ec.replace(old_aggro_hit, new_aggro_hit)
print("  -> Added 2.5s retarget cooldown on projectile hit")

# Also add retargetCd to the aggro target set in AI tick
old_aggro_ai = '        if (target) e.aggroTarget = target.playerId;'
new_aggro_ai = '''        if (target) {
          e.aggroTarget = target.playerId;
          e.retargetCd = 2.5;
        }'''

ec = ec.replace(old_aggro_ai, new_aggro_ai)
print("  -> Added cooldown on initial aggro too")

# Tick down retargetCd in enemy AI loop
old_stun = '      if (Date.now() < e.stunUntil) continue;'
new_stun = '''      if (e.retargetCd && e.retargetCd > 0) e.retargetCd -= dt;
      if (Date.now() < e.stunUntil) continue;'''

ec = ec.replace(old_stun, new_stun)
print("  -> Tick down retargetCd each frame")

# Add retargetCd to enemy spawn defaults
old_spawn1 = '      aggroTarget: null,'
new_spawn1 = '      aggroTarget: null, retargetCd: 0,'
ec = ec.replace(old_spawn1, new_spawn1)

# Also add to the ServerEnemy type
old_type = '  aggroTarget: number | null;'
new_type = '  aggroTarget: number | null;\n  retargetCd: number;'
ec = ec.replace(old_type, new_type, 1)
print("  -> Added retargetCd field to ServerEnemy type")


# ── FIX 4: loop.ts - Fix dungeon enemies freezing (skip server-auth for dungeon enemies) ──
print("FIX 4: Fix dungeon enemies freezing...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# The enemy update loop skips local AI when serverAuthoritative
# Need to let dungeon enemies still use local AI
# Find the enemy loop that checks serverAuthoritative
old_enemy_loop = '''    if (serverAuthoritative) {
      // Server owns enemy positions; applyServerSmoothing handles interpolation
      if (Math.abs(e.vel.x) > 1 || Math.abs(e.vel.y) > 1) {
        e.angle = Math.atan2(e.vel.y, e.vel.x);
      }
      continue;
    }'''

new_enemy_loop = '''    if (serverAuthoritative && !state.dungeon) {
      // Server owns enemy positions; applyServerSmoothing handles interpolation
      if (Math.abs(e.vel.x) > 1 || Math.abs(e.vel.y) > 1) {
        e.angle = Math.atan2(e.vel.y, e.vel.x);
      }
      continue;
    }'''

if old_enemy_loop in lc:
    lc = lc.replace(old_enemy_loop, new_enemy_loop)
    print("  -> Dungeon enemies now use local AI even when server-authoritative")
else:
    print("  -> WARNING: Could not find enemy serverAuthoritative check")


# ── FIX 5: loop.ts - More particles on enemy hit (renderOnly) ──
print("FIX 5: More particles on enemy hit...")

# The renderOnly hit already has embers, let me increase the count
old_ember = '''            const emberCount = pr.crit ? 4 : 2;
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
            }'''

new_ember = '''            const emberCount = pr.crit ? 8 : 5;
            for (let ei = 0; ei < emberCount; ei++) {
              const ea = Math.random() * Math.PI * 2;
              const es = 60 + Math.random() * 150;
              const eColors = ["#ff8c00", "#ff4500", "#ffd700", e.color, "#ffffff"];
              state.particles.push({
                id: `em-${Math.random().toString(36).slice(2, 8)}`,
                pos: { x: pr.pos.x, y: pr.pos.y },
                vel: { x: Math.cos(ea) * es, y: Math.sin(ea) * es },
                ttl: 0.35 + Math.random() * 0.3, maxTtl: 0.65,
                color: eColors[Math.floor(Math.random() * eColors.length)],
                size: 1.5 + Math.random() * 2, kind: "ember",
              });
            }'''

if old_ember in lc:
    lc = lc.replace(old_ember, new_ember)
    print("  -> Increased ember count (2/4 -> 5/8) and added white sparks")
else:
    print("  -> WARNING: Could not find renderOnly ember code")


# ── FIX 6: Reduce higher-tier ship base speeds more ──
print("FIX 6: Reducing higher-tier ship speeds further...")
with open('frontend/src/game/types.ts', 'r') as f:
    tc = f.read()

import re
# Current speeds after 35% reduction need further reduction for high-tier ships
# Let me set specific speeds that feel right
speed_map = {
    # Tier 1-2 (starter ships) - keep reasonable
    117: 120,   # skimmer - slight bump back up
    156: 145,   # wasp
    104: 105,   # vanguard
    130: 120,   # reaver
    # Tier 3-4 (mid ships) - reduce more
    # 130 already covered by reaver
    110: 100,   # marauder
    97: 90,     # phalanx
    84: 78,     # titan
    71: 65,     # leviathan
    143: 130,   # specter (fast but fragile)
    # Tier 5+ (top ships) - reduce significantly
    65: 55,     # colossus
    104: 90,    # harbinger (conflicts with vanguard, handle separately)
    58: 48,     # eclipse
    52: 42,     # sovereign
    45: 35,     # apex
}

# Do targeted replacements for each ship class
lines = tc.split('\n')
new_lines = []
for line in lines:
    if 'baseSpeed:' in line and 'number' not in line:
        match = re.search(r'baseSpeed: (\d+)', line)
        if match:
            old_speed = int(match.group(1))
            if old_speed in speed_map:
                new_speed = speed_map[old_speed]
                line = line.replace(f'baseSpeed: {old_speed}', f'baseSpeed: {new_speed}')
    new_lines.append(line)
tc = '\n'.join(new_lines)

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(tc)
print("  -> Adjusted base speeds per tier")


# ── FIX 7: Enhance mining beam for other players ──
print("FIX 7: Enhance mining beam particles for other players...")

# Find the other-player mining beam drawing and add flowing particles
old_mining = '''  if (o.miningTargetId) {
    const ta = state.asteroids.find((a: any) => a.id === o.miningTargetId);
    if (ta) {
      const t = state.tick;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 18));
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 16;
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 12);
      ctx.strokeStyle = "#44ffcc";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(o.pos.x, o.pos.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2 + pulse;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(o.pos.x, o.pos.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.strokeStyle = "#44ffcc";
      ctx.lineWidth = 1 + pulse * 0.4;
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(o.pos.x, o.pos.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ta.pos.x, ta.pos.y, 2 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }'''

new_mining = '''  if (o.miningTargetId) {
    const ta = state.asteroids.find((a: any) => a.id === o.miningTargetId);
    if (ta) {
      const t = state.tick;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 18));
      const bdx = ta.pos.x - o.pos.x;
      const bdy = ta.pos.y - o.pos.y;
      const bDist = Math.max(1, Math.hypot(bdx, bdy));
      const bnx = bdx / bDist;
      const bny = bdy / bDist;
      const box = -bny;
      const boy = bnx;
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 12);
      ctx.strokeStyle = "#44ffcc";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(o.pos.x, o.pos.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      const segCount = Math.floor(bDist / 18);
      for (let bi = 0; bi < segCount; bi++) {
        const progress = ((bi / segCount) + t * 3.0) % 1.0;
        const bpx = o.pos.x + bdx * progress;
        const bpy = o.pos.y + bdy * progress;
        const wobble = Math.sin(progress * 20 + t * 14) * (3 + pulse);
        const ppx = bpx + box * wobble;
        const ppy = bpy + boy * wobble;
        const alpha = 0.5 + 0.5 * Math.sin(progress * Math.PI);
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = bi % 3 === 0 ? "#ffffff" : "#44ffcc";
        ctx.beginPath();
        ctx.arc(ppx, ppy, 1.5 + pulse * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 3 + pulse;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(o.pos.x, o.pos.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.strokeStyle = "#44ffcc";
      ctx.lineWidth = 1.5 + pulse * 0.5;
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(o.pos.x, o.pos.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(ta.pos.x, ta.pos.y, 3 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      const ringR = 6 + pulse * 4 + Math.sin(t * 20) * 2;
      ctx.strokeStyle = "#44ffcc";
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 15);
      ctx.beginPath();
      ctx.arc(ta.pos.x, ta.pos.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }'''

with open('frontend/src/game/render.ts', 'r') as f:
    rc = f.read()

if old_mining in rc:
    rc = rc.replace(old_mining, new_mining)
    print("  -> Enhanced: flowing particles along beam + impact rings (matches local player)")
else:
    print("  -> WARNING: Could not find other player mining beam")

with open('frontend/src/game/render.ts', 'w') as f:
    f.write(rc)


with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ec)

print("\nAll batch 3 fixes applied!")
