#!/usr/bin/env python3
"""
Fix:
1. Enemy names - remove random name pools, use single canonical name per type
2. Stuttery enemy movement - add velocity extrapolation for smoother interpolation
"""

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Fix ENEMY_NAMES - single canonical name per type (frontend)
# ═══════════════════════════════════════════════════════════════════════════════
print("═══ Fixing enemy names (frontend) ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    types = f.read()

old_names = '''export const ENEMY_NAMES: Record<EnemyType, string[]> = {
  scout:     ["Scout", "Dart", "Interceptor", "Stinger", "Wasp"],
  raider:    ["Raider", "Marauder", "Bandit", "Outlaw", "Pirate"],
  destroyer: ["Destroyer", "Enforcer", "Warhammer", "Ravager", "Crusher"],
  voidling:  ["Voidling", "Anomaly", "Shifter", "Phaser", "Glitch"],
  dread:     ["Dread", "Leviathan", "Warship", "Juggernaut", "Capital"],
  sentinel:  ["Sentinel", "Warden", "Guardian", "Seraph", "Enforcer"],
  wraith:    ["Wraith", "Phantom", "Specter", "Shade", "Banshee"],
  titan:     ["Titan", "Colossus", "Goliath", "Monolith", "Fortress"],
  overlord:  ["Overlord", "Sovereign", "Emperor", "Archon", "Supreme"],
};'''

new_names = '''export const ENEMY_NAMES: Record<EnemyType, string[]> = {
  scout:     ["Scout"],
  raider:    ["Raider"],
  destroyer: ["Destroyer"],
  voidling:  ["Voidling"],
  dread:     ["Dread"],
  sentinel:  ["Sentinel"],
  wraith:    ["Wraith"],
  titan:     ["Titan"],
  overlord:  ["Overlord"],
};'''

types = types.replace(old_names, new_names)
print("  -> Set single canonical name per enemy type (frontend)")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(types)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Fix ENEMY_NAMES - single canonical name per type (backend)
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Fixing enemy names (backend) ═══")

with open('backend/src/game/data.ts', 'r') as f:
    data = f.read()

old_backend_names = '''export const ENEMY_NAMES: Record<EnemyType, string[]> = {
  scout:     ["Scout"],
  raider:    ["Raider"],
  destroyer: ["Destroyer"],
  voidling:  ["Voidling"],
  dread:     ["Dread"],
  sentinel: ["Sentinel", "Warden", "Guardian", "Seraph", "Enforcer", "Protector"],
  wraith: ["Wraith", "Phantom", "Specter", "Shade", "Banshee", "Ghost"],
  titan: ["Titan", "Colossus", "Goliath", "Juggernaut", "Monolith", "Fortress"],
  overlord: ["Overlord", "Sovereign", "Emperor", "Archon", "Supreme", "Dominator"],
};'''

new_backend_names = '''export const ENEMY_NAMES: Record<EnemyType, string[]> = {
  scout:     ["Scout"],
  raider:    ["Raider"],
  destroyer: ["Destroyer"],
  voidling:  ["Voidling"],
  dread:     ["Dread"],
  sentinel:  ["Sentinel"],
  wraith:    ["Wraith"],
  titan:     ["Titan"],
  overlord:  ["Overlord"],
};'''

data = data.replace(old_backend_names, new_backend_names)
print("  -> Set single canonical name per enemy type (backend)")

with open('backend/src/game/data.ts', 'w') as f:
    f.write(data)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Fix stuttery enemy movement - add velocity extrapolation
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Fixing enemy movement smoothing ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    loop = f.read()

# Replace the enemy lerp in applyServerSmoothing with velocity extrapolation + correction
old_enemy_lerp = '''  for (const e of state.enemies) {
    const tgt = _entityTargets.get(e.id);
    if (!tgt) continue;
    e.pos.x += (tgt.x - e.pos.x) * lerp;
    e.pos.y += (tgt.y - e.pos.y) * lerp;
    e.vel.x = tgt.vx;
    e.vel.y = tgt.vy;
  }'''

new_enemy_lerp = '''  for (const e of state.enemies) {
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

loop = loop.replace(old_enemy_lerp, new_enemy_lerp)
print("  -> Added velocity extrapolation + correction for smooth enemy movement")

# Also improve NPC smoothing with same approach
old_npc_lerp = '''  for (const n of state.npcShips) {
    const tgt = _entityTargets.get(n.id);
    if (!tgt) continue;
    n.pos.x += (tgt.x - n.pos.x) * lerp;
    n.pos.y += (tgt.y - n.pos.y) * lerp;
    n.vel.x = tgt.vx;
    n.vel.y = tgt.vy;
  }'''

new_npc_lerp = '''  for (const n of state.npcShips) {
    const tgt = _entityTargets.get(n.id);
    if (!tgt) continue;
    n.pos.x += tgt.vx * dt;
    n.pos.y += tgt.vy * dt;
    const nCorrLerp = Math.min(lerp * 1.5, 0.4);
    n.pos.x += (tgt.x - n.pos.x) * nCorrLerp;
    n.pos.y += (tgt.y - n.pos.y) * nCorrLerp;
    const ndx = tgt.x - n.pos.x;
    const ndy = tgt.y - n.pos.y;
    if (ndx * ndx + ndy * ndy > 200 * 200) {
      n.pos.x = tgt.x;
      n.pos.y = tgt.y;
    }
    n.vel.x = tgt.vx;
    n.vel.y = tgt.vy;
  }'''

loop = loop.replace(old_npc_lerp, new_npc_lerp)
print("  -> Applied same smoothing improvement to NPC ships")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(loop)

print("\nDONE!")
print("  - All enemies now have single canonical names (Scout, Sentinel, Wraith, etc.)")
print("  - Enemy/NPC movement uses velocity extrapolation for smooth motion")
