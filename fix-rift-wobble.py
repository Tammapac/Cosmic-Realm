#!/usr/bin/env python3
"""Fix: rift enemy damage + ship wobble when stopped."""

print("Loading loop.ts...")
with open('frontend/src/game/loop.ts', 'r') as f:
    content = f.read()

# ── FIX 1: Rift/dungeon enemies should take local damage ──
# serverEnemiesReceived blocks local damage, but dungeon enemies are local-only
print("FIX 1: Allow local damage to dungeon/rift enemies...")

# Main hit damage
content = content.replace(
    '''          if (!serverEnemiesReceived) {
            e.hull -= dmg;
          }''',
    '''          if (!serverEnemiesReceived || state.dungeon) {
            e.hull -= dmg;
          }'''
)
print("  -> Main projectile damage: allow in dungeon")

# Splash/AOE damage
content = content.replace(
    'if (!serverEnemiesReceived) e2.hull -= dmg * 0.4;',
    'if (!serverEnemiesReceived || state.dungeon) e2.hull -= dmg * 0.4;'
)
print("  -> AOE splash damage: allow in dungeon")

# Kill check
content = content.replace(
    'if (!serverEnemiesReceived && e.hull <= 0) applyKill(e, !!pr.crit);',
    'if ((!serverEnemiesReceived || state.dungeon) && e.hull <= 0) applyKill(e, !!pr.crit);'
)
print("  -> Kill check: allow in dungeon")

# Mining damage to asteroids in dungeon
content = content.replace(
    'if (!serverEnemiesReceived && mAst.hp <= 0)',
    'if ((!serverEnemiesReceived || state.dungeon) && mAst.hp <= 0)'
)
print("  -> Asteroid mining kill: allow in dungeon")

# ── FIX 2: Stop ship wobble when standing still ──
# Client-side: add velocity snap-to-zero like server has
print("FIX 2: Fix ship wobble when stopped...")

old_movement = '''    const friction = Math.pow(MOVEMENT.FRICTION_PER_60FPS_FRAME, dt * 60);
    p.vel.x *= friction;
    p.vel.y *= friction;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;'''

new_movement = '''    const friction = Math.pow(MOVEMENT.FRICTION_PER_60FPS_FRAME, dt * 60);
    p.vel.x *= friction;
    p.vel.y *= friction;
    const spd = p.vel.x * p.vel.x + p.vel.y * p.vel.y;
    if (spd < MOVEMENT.IDLE_SPEED * MOVEMENT.IDLE_SPEED) {
      p.vel.x = 0;
      p.vel.y = 0;
    }
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;'''

if old_movement in content:
    content = content.replace(old_movement, new_movement)
    print("  -> Added velocity snap-to-zero when speed < IDLE_SPEED (matches server)")
else:
    print("  -> WARNING: Could not find friction/movement code")

# Also fix the server-authoritative branch: snap angle update threshold higher
# to prevent angle jitter from near-zero interpolated velocities
old_sa_angle = '''    // Server owns position; interpolation handles movement in applyServerSmoothing()
    // Do NOT extrapolate with velocity - causes double-speed movement
    // Just update angle based on velocity direction
    if (Math.abs(p.vel.x) > 1 || Math.abs(p.vel.y) > 1) {
      p.angle = Math.atan2(p.vel.y, p.vel.x);
    }'''

new_sa_angle = '''    // Server owns position; interpolation handles movement in applyServerSmoothing()
    // Do NOT extrapolate with velocity - causes double-speed movement
    // Just update angle based on velocity direction
    if (p.vel.x * p.vel.x + p.vel.y * p.vel.y > 9) {
      p.angle = Math.atan2(p.vel.y, p.vel.x);
    }'''

if old_sa_angle in content:
    content = content.replace(old_sa_angle, new_sa_angle)
    print("  -> Raised server-auth angle update threshold (speed > 3 instead of > 1)")
else:
    print("  -> WARNING: Could not find server-auth angle code")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(content)

print("\nAll fixes applied!")
