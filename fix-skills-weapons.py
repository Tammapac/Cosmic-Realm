#!/usr/bin/env python3
"""Fix: skill points on level-up + different weapon firing patterns."""

# ── FIX 1: Skill points on level-up ──
print("FIX 1: Fix skill points on level-up...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Fix applyKill leveling (missing skillPoints)
old_kill_level = '''    while (p2.exp >= EXP_FOR_LEVEL(p2.level)) {
      p2.exp -= EXP_FOR_LEVEL(p2.level);
      p2.level++;
      state.levelUpFlash = 1.6;
    }'''

new_kill_level = '''    while (p2.exp >= EXP_FOR_LEVEL(p2.level)) {
      p2.exp -= EXP_FOR_LEVEL(p2.level);
      p2.level++;
      p2.skillPoints += 1;
      state.levelUpFlash = 1.6;
    }'''

if old_kill_level in lc:
    lc = lc.replace(old_kill_level, new_kill_level)
    print("  -> Added skillPoints += 1 in applyKill leveling")
else:
    print("  -> WARNING: Could not find applyKill leveling")

# Fix server loot leveling (missing skillPoints) - find the second occurrence
# This one is in onEnemyDie or loot processing
import re
pattern = r'(while \(p\.exp >= EXP_FOR_LEVEL\(p\.level\)\) \{\n\s+p\.exp -= EXP_FOR_LEVEL\(p\.level\);\n\s+p\.level\+\+;\n\s+state\.levelUpFlash = 1\.6;\n\s+\})'
matches = list(re.finditer(pattern, lc))
if matches:
    for m in matches:
        old_text = m.group(0)
        new_text = old_text.replace('p.level++;', 'p.level++;\n      p.skillPoints += 1;')
        lc = lc.replace(old_text, new_text, 1)
    print(f"  -> Fixed {len(matches)} more leveling locations missing skillPoints")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

# ── FIX 2: Add firingPattern to weapon type ──
print("\nFIX 2: Adding firing patterns to weapons...")
with open('frontend/src/game/types.ts', 'r') as f:
    tc = f.read()

# Add firingPattern to ModuleDef type
tc = tc.replace(
    '  weaponKind?: "laser" | "rocket";',
    '  weaponKind?: "laser" | "rocket";\n  firingPattern?: "standard" | "sniper" | "scatter" | "rail";'
)
print("  -> Added firingPattern to ModuleDef type")

# Tag existing weapons with their patterns
tc = tc.replace(
    '"wp-sniper":    { id: "wp-sniper",    slot: "weapon", weaponKind: "laser",',
    '"wp-sniper":    { id: "wp-sniper",    slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",'
)
tc = tc.replace(
    '"wp-ion":       { id: "wp-ion",       slot: "weapon", weaponKind: "laser",',
    '"wp-ion":       { id: "wp-ion",       slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",'
)
tc = tc.replace(
    '"wp-scatter":   { id: "wp-scatter",   slot: "weapon", weaponKind: "laser",',
    '"wp-scatter":   { id: "wp-scatter",   slot: "weapon", weaponKind: "laser",  firingPattern: "scatter",'
)
tc = tc.replace(
    '"wp-phase":     { id: "wp-phase",     slot: "weapon", weaponKind: "laser",',
    '"wp-phase":     { id: "wp-phase",     slot: "weapon", weaponKind: "laser",  firingPattern: "rail",'
)
tc = tc.replace(
    '"wp-arc":       { id: "wp-arc",       slot: "weapon", weaponKind: "laser",',
    '"wp-arc":       { id: "wp-arc",       slot: "weapon", weaponKind: "laser",  firingPattern: "rail",'
)
print("  -> Tagged existing weapons: sniper, ion=sniper, scatter, phase=rail, arc=rail")

# Add new tiered weapons for each pattern
new_weapons = '''
  // ── SNIPER WEAPONS (beam) ───────────────────────────────────────────────
  "wp-sniper-1":  { id: "wp-sniper-1",  slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  name: "Marksman Beam Mk-I",   description: "Focused beam. High damage, slow fire.",                   rarity: "uncommon",  color: "#aaddff", glyph: "—", tier: 2, price: 32000,  stats: { damage: 18, fireRate: 0.55, critChance: 0.08 } },
  "wp-sniper-2":  { id: "wp-sniper-2",  slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  name: "Marksman Beam Mk-II",  description: "Enhanced beam. Devastating single-shot power.",            rarity: "rare",      color: "#88ccff", glyph: "—", tier: 3, price: 95000,  stats: { damage: 32, fireRate: 0.5, critChance: 0.12 } },

  // ── SCATTER WEAPONS (shotgun) ───────────────────────────────────────────
  "wp-scatter-2": { id: "wp-scatter-2", slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", name: "Spread Cannon Mk-II",  description: "Wide cone of pellets. Devastating at close range.",        rarity: "rare",      color: "#88eeff", glyph: "\\u22d9", tier: 3, price: 82000,  stats: { damage: 16, fireRate: 1.2, aoeRadius: 10 } },
  "wp-scatter-3": { id: "wp-scatter-3", slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", name: "Storm Blaster",        description: "Military-grade shotgun array. Shreds close targets.",      rarity: "epic",      color: "#55ddff", glyph: "\\u22d9", tier: 4, price: 200000, stats: { damage: 24, fireRate: 1.1, aoeRadius: 14, critChance: 0.06 } },

  // ── RAIL WEAPONS (burst/salvo) ──────────────────────────────────────────
  "wp-rail-1":    { id: "wp-rail-1",    slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    name: "Burst Cannon Mk-I",    description: "Fires 3 rapid shots per burst. Good sustained damage.",    rarity: "uncommon",  color: "#ffaa44", glyph: "\\u2261", tier: 2, price: 35000,  stats: { damage: 10, fireRate: 0.9 } },
  "wp-rail-2":    { id: "wp-rail-2",    slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    name: "Burst Cannon Mk-II",   description: "Triple-shot rail system. Fast and lethal.",                rarity: "rare",      color: "#ff8844", glyph: "\\u2261", tier: 3, price: 88000,  stats: { damage: 16, fireRate: 0.85, critChance: 0.04 } },
  "wp-rail-3":    { id: "wp-rail-3",    slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    name: "Railstorm Driver",     description: "Endgame burst weapon. Rapid triple-shot devastation.",     rarity: "epic",      color: "#ff6622", glyph: "\\u2261", tier: 4, price: 220000, stats: { damage: 28, fireRate: 0.8, critChance: 0.08 } },
'''

# Insert new weapons before rocket weapons
tc = tc.replace(
    '  // ── ROCKET WEAPONS',
    new_weapons + '\n  // ── ROCKET WEAPONS'
)
print("  -> Added 7 new tiered weapons (sniper x2, scatter x2, rail x3)")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(tc)

# ── FIX 3: Frontend firing patterns ──
print("\nFIX 3: Implementing frontend firing patterns...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Replace the laser firing block with pattern-aware logic
old_laser_fire = '''      const laserAmmo = p.ammo[laserAmmoType] ?? 0;
      if (state.isLaserFiring && playerFireCd.value <= 0 && laserIds.length > 0 && laserAmmo >= 1) {
        p.ammo[laserAmmoType] = laserAmmo - 1;
        const laserDmg = stats.damage * laserDmgMul;
        const perShot = Math.round(laserDmg / 2);
        for (let si = 0; si < 2; si++) {
          const side = si === 0 ? -1 : 1;
          const ox = p.pos.x + Math.cos(perpAng) * 14 * side;
          const oy = p.pos.y + Math.sin(perpAng) * 14 * side;
          fireProjectile("player", ox, oy, ang - side * 0.03, perShot, laserColor, 4, {
            weaponKind: "laser",
            speedMul: 2.14,
          });
          // Muzzle flash at gun port — large and visible when zoomed out
          state.particles.push({
            id: `mf-${Math.random().toString(36).slice(2, 8)}`,
            pos: { x: ox, y: oy }, vel: { x: 0, y: 0 },
            ttl: 0.18, maxTtl: 0.18,
            color: laserColor, size: 70, kind: "flash",
          });
          state.particles.push({
            id: `mf2-${Math.random().toString(36).slice(2, 8)}`,
            pos: { x: ox, y: oy }, vel: { x: 0, y: 0 },
            ttl: 0.1, maxTtl: 0.1,
            color: "#ffffff", size: 45, kind: "flash",
          });
          emitSpark(ox, oy, laserColor, 6, 120, 3);
          emitSpark(ox, oy, "#ffffff", 3, 70, 2);
        }
        sfx.laserShoot();'''

new_laser_fire = '''      const laserAmmo = p.ammo[laserAmmoType] ?? 0;
      if (state.isLaserFiring && playerFireCd.value <= 0 && laserIds.length > 0 && laserAmmo >= 1) {
        p.ammo[laserAmmoType] = laserAmmo - 1;
        const laserDmg = stats.damage * laserDmgMul;

        // Determine firing pattern from first equipped laser weapon
        const firstLaser = p.inventory.find(m => m.instanceId === laserIds[0]);
        const firstDef = firstLaser ? MODULE_DEFS[firstLaser.defId] : null;
        const pattern = firstDef?.firingPattern || "standard";

        if (pattern === "sniper") {
          // Single powerful beam from center
          const dmg = Math.round(laserDmg);
          const ox = p.pos.x + Math.cos(ang) * 10;
          const oy = p.pos.y + Math.sin(ang) * 10;
          fireProjectile("player", ox, oy, ang, dmg, laserColor, 6, {
            weaponKind: "laser", speedMul: 3.2,
          });
          state.particles.push({ id: `mf-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.25, maxTtl: 0.25, color: "#ffffff", size: 90, kind: "flash" });
          state.particles.push({ id: `mf2-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.15, maxTtl: 0.15, color: laserColor, size: 60, kind: "flash" });
          emitSpark(ox, oy, "#ffffff", 8, 160, 3);
          emitSpark(ox, oy, laserColor, 4, 100, 2);
        } else if (pattern === "scatter") {
          // Shotgun: 5 pellets in a cone
          const pellets = 5;
          const perPellet = Math.round(laserDmg * 0.85 / pellets);
          const spread = 0.22;
          for (let si = 0; si < pellets; si++) {
            const spreadAng = ang + (si - (pellets - 1) / 2) * (spread * 2 / (pellets - 1));
            const ox = p.pos.x + Math.cos(perpAng) * (si % 2 === 0 ? -8 : 8);
            const oy = p.pos.y + Math.sin(perpAng) * (si % 2 === 0 ? -8 : 8);
            fireProjectile("player", ox, oy, spreadAng, perPellet, laserColor, 3, {
              weaponKind: "laser", speedMul: 1.7,
            });
          }
          const cx = p.pos.x + Math.cos(ang) * 8;
          const cy = p.pos.y + Math.sin(ang) * 8;
          state.particles.push({ id: `mf-${Math.random().toString(36).slice(2, 8)}`, pos: { x: cx, y: cy }, vel: { x: 0, y: 0 }, ttl: 0.15, maxTtl: 0.15, color: laserColor, size: 80, kind: "flash" });
          emitSpark(cx, cy, laserColor, 8, 100, 2);
          emitSpark(cx, cy, "#ffffff", 4, 70, 2);
        } else if (pattern === "rail") {
          // Burst: 3 rapid shots
          const perBurst = Math.round(laserDmg * 0.9 / 3);
          for (let bi = 0; bi < 3; bi++) {
            const side = bi === 0 ? -1 : bi === 1 ? 1 : 0;
            const ox = p.pos.x + Math.cos(perpAng) * 10 * side;
            const oy = p.pos.y + Math.sin(perpAng) * 10 * side;
            const burstAng = ang + (Math.random() - 0.5) * 0.04;
            fireProjectile("player", ox, oy, burstAng, perBurst, laserColor, 4, {
              weaponKind: "laser", speedMul: 2.5,
            });
            state.particles.push({ id: `mf-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.12, maxTtl: 0.12, color: laserColor, size: 55, kind: "flash" });
            emitSpark(ox, oy, laserColor, 4, 90, 2);
          }
          emitSpark(p.pos.x, p.pos.y, "#ffffff", 3, 60, 2);
        } else {
          // Standard dual-fire
          const perShot = Math.round(laserDmg / 2);
          for (let si = 0; si < 2; si++) {
            const side = si === 0 ? -1 : 1;
            const ox = p.pos.x + Math.cos(perpAng) * 14 * side;
            const oy = p.pos.y + Math.sin(perpAng) * 14 * side;
            fireProjectile("player", ox, oy, ang - side * 0.03, perShot, laserColor, 4, {
              weaponKind: "laser", speedMul: 2.14,
            });
            state.particles.push({ id: `mf-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.18, maxTtl: 0.18, color: laserColor, size: 70, kind: "flash" });
            state.particles.push({ id: `mf2-${Math.random().toString(36).slice(2, 8)}`, pos: { x: ox, y: oy }, vel: { x: 0, y: 0 }, ttl: 0.1, maxTtl: 0.1, color: "#ffffff", size: 45, kind: "flash" });
            emitSpark(ox, oy, laserColor, 6, 120, 3);
            emitSpark(ox, oy, "#ffffff", 3, 70, 2);
          }
        }
        sfx.laserShoot();'''

if old_laser_fire in lc:
    lc = lc.replace(old_laser_fire, new_laser_fire)
    print("  -> Frontend firing patterns implemented (standard/sniper/scatter/rail)")
else:
    print("  -> WARNING: Could not find laser fire block")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

# ── FIX 4: Server-side firing patterns ──
print("\nFIX 4: Server-side firing patterns...")
with open('backend/src/game/engine.ts', 'r') as f:
    ec = f.read()

old_server_fire = '''// Fire laser
      if (p.isLaserFiring && p.laserFireCd <= 0) {
        const ammoDef = ROCKET_AMMO_TYPE_DEFS[p.laserAmmoType as RocketAmmoType];
        const mul = ammoDef ? ammoDef.damageMul : 1;
        const laserDmg = stats.damage * mul * 0.4;
        const perShot = Math.round(laserDmg / 2);
        const perpAng = ang + Math.PI / 2;
        const crit = Math.random() < stats.critChance;
        const laserColor = "#4ee2ff";

        for (let si = 0; si < 2; si++) {
          const side = si === 0 ? -1 : 1;
          const ox = p.posX + Math.cos(perpAng) * 14 * side;
          const oy = p.posY + Math.sin(perpAng) * 14 * side;
          const projSpeed = 600;
          const proj: ServerProjectile = {
            id: eid("proj"),
            zone: zoneId,
            fromPlayerId: p.playerId,
            fromEnemyId: null,
            fromNpcId: null,
            pos: { x: ox, y: oy },
            vel: { x: Math.cos(ang - side * 0.03) * projSpeed, y: Math.sin(ang - side * 0.03) * projSpeed },
            damage: perShot,
            ttl: 1.5,
            color: laserColor,
            size: 4,
            crit,
            weaponKind: "laser",
            homing: false,
            homingTargetId: null,
            aoeRadius: stats.aoeRadius,
            empStun: 0,
            armorPiercing: false,
          };
          zs.projectiles.set(proj.id, proj);
          events.push({
            type: "projectile:spawn", zone: zoneId, fromPlayerId: p.playerId,
            x: proj.pos.x, y: proj.pos.y, vx: proj.vel.x, vy: proj.vel.y,
            damage: proj.damage, color: proj.color, size: proj.size,
            crit: proj.crit, weaponKind: proj.weaponKind, homing: proj.homing,
          });
        }

        const cd = Math.max(0.2, 0.85 / stats.fireRate);
        p.laserFireCd = cd;
      }'''

new_server_fire = '''// Fire laser
      if (p.isLaserFiring && p.laserFireCd <= 0) {
        const ammoDef = ROCKET_AMMO_TYPE_DEFS[p.laserAmmoType as RocketAmmoType];
        const mul = ammoDef ? ammoDef.damageMul : 1;
        const laserDmg = stats.damage * mul * 0.4;
        const perpAng = ang + Math.PI / 2;
        const crit = Math.random() < stats.critChance;
        const laserColor = "#4ee2ff";

        // Determine firing pattern from equipped weapon
        const pCache = this.playerDataCache.get(p.playerId);
        let firingPattern = "standard";
        if (pCache?.equipped?.weapon) {
          for (const wid of pCache.equipped.weapon) {
            if (!wid) continue;
            const wi = pCache.inventory?.find((m: any) => m.instanceId === wid);
            if (wi && MODULE_DEFS[wi.defId]?.weaponKind === "laser") {
              firingPattern = (MODULE_DEFS[wi.defId] as any).firingPattern || "standard";
              break;
            }
          }
        }

        const fireProj = (ox: number, oy: number, fireAng: number, dmg: number, sz: number, spd: number) => {
          const proj: ServerProjectile = {
            id: eid("proj"), zone: zoneId, fromPlayerId: p.playerId,
            fromEnemyId: null, fromNpcId: null,
            pos: { x: ox, y: oy },
            vel: { x: Math.cos(fireAng) * spd, y: Math.sin(fireAng) * spd },
            damage: dmg, ttl: 1.5, color: laserColor, size: sz, crit,
            weaponKind: "laser", homing: false, homingTargetId: null,
            aoeRadius: stats.aoeRadius, empStun: 0, armorPiercing: false,
          };
          zs.projectiles.set(proj.id, proj);
          events.push({
            type: "projectile:spawn", zone: zoneId, fromPlayerId: p.playerId,
            x: proj.pos.x, y: proj.pos.y, vx: proj.vel.x, vy: proj.vel.y,
            damage: proj.damage, color: proj.color, size: proj.size,
            crit: proj.crit, weaponKind: proj.weaponKind, homing: proj.homing,
          });
        };

        if (firingPattern === "sniper") {
          const dmg = Math.round(laserDmg);
          const ox = p.posX + Math.cos(ang) * 10;
          const oy = p.posY + Math.sin(ang) * 10;
          fireProj(ox, oy, ang, dmg, 6, 900);
        } else if (firingPattern === "scatter") {
          const pellets = 5;
          const perPellet = Math.round(laserDmg * 0.85 / pellets);
          const spread = 0.22;
          for (let si = 0; si < pellets; si++) {
            const spreadAng = ang + (si - (pellets - 1) / 2) * (spread * 2 / (pellets - 1));
            const ox = p.posX + Math.cos(perpAng) * (si % 2 === 0 ? -8 : 8);
            const oy = p.posY + Math.sin(perpAng) * (si % 2 === 0 ? -8 : 8);
            fireProj(ox, oy, spreadAng, perPellet, 3, 480);
          }
        } else if (firingPattern === "rail") {
          const perBurst = Math.round(laserDmg * 0.9 / 3);
          for (let bi = 0; bi < 3; bi++) {
            const side = bi === 0 ? -1 : bi === 1 ? 1 : 0;
            const ox = p.posX + Math.cos(perpAng) * 10 * side;
            const oy = p.posY + Math.sin(perpAng) * 10 * side;
            const burstAng = ang + (Math.random() - 0.5) * 0.04;
            fireProj(ox, oy, burstAng, perBurst, 4, 700);
          }
        } else {
          const perShot = Math.round(laserDmg / 2);
          for (let si = 0; si < 2; si++) {
            const side = si === 0 ? -1 : 1;
            const ox = p.posX + Math.cos(perpAng) * 14 * side;
            const oy = p.posY + Math.sin(perpAng) * 14 * side;
            fireProj(ox, oy, ang - side * 0.03, perShot, 4, 600);
          }
        }

        const cd = Math.max(0.2, 0.85 / stats.fireRate);
        p.laserFireCd = cd;
      }'''

if old_server_fire in ec:
    ec = ec.replace(old_server_fire, new_server_fire)
    print("  -> Server firing patterns implemented")
else:
    print("  -> WARNING: Could not find server fire block")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ec)

print("\nAll fixes applied!")
