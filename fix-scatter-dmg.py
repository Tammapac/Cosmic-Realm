#!/usr/bin/env python3
"""Fix scatter damage: fewer pellets, each hits harder."""

# The core problem: laserDmg = stats.damage * 0.4 (base scaling)
# Then scatter divides by 5 pellets, making each one tiny (2-3 damage)
# Fix: 3 pellets with 2.5x multiplier = each pellet hits like a truck

# ── Frontend ──
print("Fixing frontend scatter...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Change scatter from 5 pellets to 3, multiplier from 1.6 to 2.5
lc = lc.replace(
    '''        } else if (pattern === "scatter") {
          // Shotgun: 5 pellets in a cone
          const pellets = 5;
          const perPellet = Math.round(laserDmg * 1.6 / pellets);
          const spread = 0.13;
          for (let si = 0; si < pellets; si++) {
            const spreadAng = ang + (si - (pellets - 1) / 2) * (spread * 2 / (pellets - 1));
            const ox = p.pos.x + Math.cos(perpAng) * (si % 2 === 0 ? -8 : 8);
            const oy = p.pos.y + Math.sin(perpAng) * (si % 2 === 0 ? -8 : 8);
            fireProjectile("player", ox, oy, spreadAng, perPellet, laserColor, 3, {
              weaponKind: "laser", speedMul: 1.7,
            });
          }''',
    '''        } else if (pattern === "scatter") {
          // Shotgun: 3 heavy pellets in a tight cone
          const pellets = 3;
          const perPellet = Math.round(laserDmg * 2.5 / pellets);
          const spread = 0.1;
          for (let si = 0; si < pellets; si++) {
            const spreadAng = ang + (si - 1) * spread;
            const side = si === 0 ? -1 : si === 2 ? 1 : 0;
            const ox = p.pos.x + Math.cos(perpAng) * 10 * side;
            const oy = p.pos.y + Math.sin(perpAng) * 10 * side;
            fireProjectile("player", ox, oy, spreadAng, perPellet, laserColor, 4, {
              weaponKind: "laser", speedMul: 1.8,
            });
          }'''
)
print("  -> 5 pellets -> 3 pellets, multiplier 1.6x -> 2.5x")
print("  -> Each pellet now deals ~83% of a standard shot (was ~32%)")
print("  -> Total volley = 2.5x standard damage (was 1.6x)")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

# ── Backend ──
print("Fixing backend scatter...")
with open('backend/src/game/engine.ts', 'r') as f:
    ec = f.read()

ec = ec.replace(
    '''        } else if (firingPattern === "scatter") {
          const pellets = 5;
          const perPellet = Math.round(laserDmg * 1.6 / pellets);
          const spread = 0.13;
          for (let si = 0; si < pellets; si++) {
            const spreadAng = ang + (si - (pellets - 1) / 2) * (spread * 2 / (pellets - 1));
            const ox = p.posX + Math.cos(perpAng) * (si % 2 === 0 ? -8 : 8);
            const oy = p.posY + Math.sin(perpAng) * (si % 2 === 0 ? -8 : 8);
            fireProj(ox, oy, spreadAng, perPellet, 3, 480);
          }''',
    '''        } else if (firingPattern === "scatter") {
          const pellets = 3;
          const perPellet = Math.round(laserDmg * 2.5 / pellets);
          const spread = 0.1;
          for (let si = 0; si < pellets; si++) {
            const spreadAng = ang + (si - 1) * spread;
            const side = si === 0 ? -1 : si === 2 ? 1 : 0;
            const ox = p.posX + Math.cos(perpAng) * 10 * side;
            const oy = p.posY + Math.sin(perpAng) * 10 * side;
            fireProj(ox, oy, spreadAng, perPellet, 4, 500);
          }'''
)
print("  -> Server scatter matched: 3 pellets, 2.5x multiplier")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ec)

# Quick math example for the client:
# stats.damage = 25 (starter ship + 1 scatter weapon)
# laserDmg = 25 * 0.4 = 10
# OLD: 5 pellets at 10*1.6/5 = 3.2 -> 3 each, 15 total
# NEW: 3 pellets at 10*2.5/3 = 8.3 -> 8 each, 24 total
# Standard (pulse): 2 shots at 10/2 = 5 each, 10 total
# Scatter now clearly beats standard per-pellet AND total

print("\nExample with stats.damage=25:")
print("  Standard: 2 shots x 5 dmg = 10 total")
print("  OLD scatter: 5 pellets x 3 dmg = 15 total")
print("  NEW scatter: 3 pellets x 8 dmg = 24 total")
print("\nDone!")
