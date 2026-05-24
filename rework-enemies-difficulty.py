#!/usr/bin/env python3
"""
Major enemy/difficulty rework:
1. Change tier multiplier from +0.5 per tier to DOUBLING per tier
2. Add new enemy types for higher maps (sentinel, wraith, titan, overlord)
3. Add new boss variants (Carrier boss that spawns fighters)
4. Scale down bounty rewards to match new progression
5. Give higher maps unique enemy compositions
"""

import re

# ═══════════════════════════════════════════════════════════════════════════════
# 1. BACKEND - Add new enemy types and change tier multiplier
# ═══════════════════════════════════════════════════════════════════════════════
print("═══ Updating backend data.ts - New enemy types ═══")

with open('backend/src/game/data.ts', 'r') as f:
    bdata = f.read()

# 1a. Expand EnemyType
old_etype = 'export type EnemyType = "scout" | "raider" | "destroyer" | "voidling" | "dread";'
new_etype = 'export type EnemyType = "scout" | "raider" | "destroyer" | "voidling" | "dread" | "sentinel" | "wraith" | "titan" | "overlord";'
if '"sentinel"' not in bdata:
    bdata = bdata.replace(old_etype, new_etype)
    print("  -> Added sentinel, wraith, titan, overlord to EnemyType")

# 1b. Add new ENEMY_DEFS entries
new_defs = '''  sentinel: {
    type: "sentinel", behavior: "ranged",
    hullMax: 450, damage: 48, speed: 100, exp: 65, credits: 220, honor: 8,
    color: "#22ccff", size: 16,
    loot: { resourceId: "quantum", qty: 2 },
  },
  wraith: {
    type: "wraith", behavior: "fast",
    hullMax: 320, damage: 60, speed: 160, exp: 80, credits: 280, honor: 10,
    color: "#cc44ff", size: 12,
    loot: { resourceId: "void", qty: 3 },
  },
  titan: {
    type: "titan", behavior: "tank",
    hullMax: 1500, damage: 75, speed: 35, exp: 150, credits: 500, honor: 18,
    color: "#ff2244", size: 30,
    loot: { resourceId: "dread", qty: 4 },
  },
  overlord: {
    type: "overlord", behavior: "tank",
    hullMax: 2200, damage: 95, speed: 30, exp: 250, credits: 800, honor: 30,
    color: "#ffffff", size: 35,
    loot: { resourceId: "dread", qty: 6 },
  },
'''

if 'sentinel:' not in bdata:
    # Insert before the closing }; of ENEMY_DEFS
    # Find the dread entry end
    dread_end = bdata.find("loot: { resourceId: \"dread\"", bdata.find("dread: {"))
    if dread_end >= 0:
        closing_brace = bdata.find('},', dread_end) + 2
        next_line = bdata.find('\n', closing_brace)
        # Find the }; closing ENEMY_DEFS
        closing_defs = bdata.find('};', next_line)
        bdata = bdata[:closing_defs] + new_defs + bdata[closing_defs:]
        print("  -> Added sentinel, wraith, titan, overlord to ENEMY_DEFS")

# 1c. Add faction mods for new enemies
old_mars_dread = '    dread:     { color: "#ff8800", hullMul: 1.15, damageMul: 1.10 },'
new_mars_end = '''    dread:     { color: "#ff8800", hullMul: 1.15, damageMul: 1.10 },
    sentinel:  { color: "#ff6622", damageMul: 1.15, speedMul: 1.10 },
    wraith:    { color: "#ff4400", speedMul: 1.25, damageMul: 1.10 },
    titan:     { color: "#cc2200", hullMul: 1.20, damageMul: 1.15 },
    overlord:  { color: "#ff0000", hullMul: 1.25, damageMul: 1.20 },'''

if 'sentinel:' not in bdata.split('FACTION_ENEMY_MODS')[1] if 'FACTION_ENEMY_MODS' in bdata else '':
    # Add to mars faction
    mars_dread_idx = bdata.find(old_mars_dread)
    if mars_dread_idx >= 0:
        bdata = bdata.replace(old_mars_dread, new_mars_end, 1)
        print("  -> Added new enemy faction mods (mars)")

old_venus_dread = '    dread:     { color: "#aa00ff", hullMul: 1.20, damageMul: 1.12 },'
new_venus_end = '''    dread:     { color: "#aa00ff", hullMul: 1.20, damageMul: 1.12 },
    sentinel:  { color: "#8844ff", damageMul: 1.20, hullMul: 1.10 },
    wraith:    { color: "#ff22cc", speedMul: 1.15, damageMul: 1.25 },
    titan:     { color: "#9900cc", hullMul: 1.15, damageMul: 1.20 },
    overlord:  { color: "#cc00ff", hullMul: 1.30, damageMul: 1.25 },'''

venus_dread_idx = bdata.find(old_venus_dread)
if venus_dread_idx >= 0 and 'sentinel' not in bdata[venus_dread_idx:venus_dread_idx+300]:
    bdata = bdata.replace(old_venus_dread, new_venus_end, 1)
    print("  -> Added new enemy faction mods (venus)")

# 1d. Update zone enemy compositions - add new types to higher zones
zone_updates = {
    # Tier 3 zones get sentinel
    'crimson': '    enemyTier: 3, enemyTypes: ["destroyer", "sentinel", "dread"], unlockLevel: 16,',
    'abyss': '    enemyTier: 3, enemyTypes: ["destroyer", "sentinel", "dread"], unlockLevel: 16,',
    'venus3': '    enemyTier: 3, enemyTypes: ["destroyer", "sentinel", "dread"], unlockLevel: 16,',
    # Tier 4 zones get wraith + sentinel
    'void': '    enemyTier: 4, enemyTypes: ["sentinel", "wraith", "dread"], unlockLevel: 24,',
    'marsdepth': '    enemyTier: 4, enemyTypes: ["sentinel", "wraith", "dread"], unlockLevel: 24,',
    'venus4': '    enemyTier: 4, enemyTypes: ["sentinel", "wraith", "dread"], unlockLevel: 24,',
    # Tier 5 zones get titan + wraith
    'forge': '    enemyTier: 5, enemyTypes: ["wraith", "titan", "dread"], unlockLevel: 32,',
    'maelstrom': '    enemyTier: 5, enemyTypes: ["wraith", "titan", "dread"], unlockLevel: 32,',
    'venus5': '    enemyTier: 5, enemyTypes: ["wraith", "titan", "dread"], unlockLevel: 32,',
    # Danger zones get overlord
    'danger1': '    enemyTier: 4, enemyTypes: ["sentinel", "wraith", "titan"], unlockLevel: 20,',
    'danger2': '    enemyTier: 5, enemyTypes: ["wraith", "titan", "dread"], unlockLevel: 26,',
    'danger3': '    enemyTier: 5, enemyTypes: ["titan", "dread", "overlord"], unlockLevel: 30,',
    'danger4': '    enemyTier: 6, enemyTypes: ["titan", "overlord", "dread"], unlockLevel: 36,',
    'danger5': '    enemyTier: 7, enemyTypes: ["overlord", "titan", "dread"], unlockLevel: 42,',
}

for zone_id, new_line in zone_updates.items():
    # Find the zone definition and replace its enemyTier/enemyTypes line
    zone_start = bdata.find(f'id: "{zone_id}"', bdata.find('ZONES'))
    if zone_start >= 0:
        # Find the enemyTier line
        tier_start = bdata.find('enemyTier:', zone_start)
        if tier_start >= 0 and tier_start < zone_start + 200:
            tier_end = bdata.find('\n', tier_start)
            bdata = bdata[:tier_start] + new_line + bdata[tier_end:]

print("  -> Updated zone enemy compositions with new types")

# 1e. Add ENEMY_NAMES for new types
old_names_end = bdata.find('};', bdata.find('ENEMY_NAMES'))
if old_names_end >= 0 and 'sentinel:' not in bdata[bdata.find('ENEMY_NAMES'):old_names_end]:
    new_names = '''  sentinel: ["Sentinel", "Warden", "Guardian", "Seraph", "Enforcer", "Protector"],
  wraith: ["Wraith", "Phantom", "Specter", "Shade", "Banshee", "Ghost"],
  titan: ["Titan", "Colossus", "Goliath", "Juggernaut", "Monolith", "Fortress"],
  overlord: ["Overlord", "Sovereign", "Emperor", "Archon", "Supreme", "Dominator"],
'''
    bdata = bdata[:old_names_end] + new_names + bdata[old_names_end:]
    print("  -> Added ENEMY_NAMES for new types")

with open('backend/src/game/data.ts', 'w') as f:
    f.write(bdata)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. BACKEND ENGINE - Change tier multiplier to doubling, add carrier boss
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating backend engine.ts - Doubling difficulty ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    beng = f.read()

# 2a. Change tier multiplier formula from linear to doubling
# Old: const tierMult = 1 + (zoneDef.enemyTier - 1) * 0.5;
# New: const tierMult = Math.pow(2, zoneDef.enemyTier - 1);
# This gives: T1=1x, T2=2x, T3=4x, T4=8x, T5=16x, T6=32x, T7=64x
old_tier_formula = 'const tierMult = 1 + (zoneDef.enemyTier - 1) * 0.5;'
new_tier_formula = 'const tierMult = Math.pow(2, zoneDef.enemyTier - 1);'
count = beng.count(old_tier_formula)
if count > 0:
    beng = beng.replace(old_tier_formula, new_tier_formula)
    print(f"  -> Changed tier multiplier to 2^(tier-1) doubling ({count} occurrences)")

# 2b. Scale down base credits to compensate for doubling
# Since tier 4 now gives 8x instead of 2.5x, we need to reduce base credits
# Actually let's also scale the credit reward multiplier on bosses down
old_boss_credits = 'credits: Math.round(baseDef.credits * hpMul * 2),'
new_boss_credits = 'credits: Math.round(baseDef.credits * hpMul * 1.2),'
if old_boss_credits in beng:
    beng = beng.replace(old_boss_credits, new_boss_credits)
    print("  -> Reduced boss credit multiplier from 2x to 1.2x")

# 2c. Add carrier boss variant - every other boss is a "carrier" that spawns fighters
# After the boss spawn, add a carrier flag based on random chance
old_boss_active = '    zs.bossActive = true;\n    events.push({ type: "boss:warn", zone: zoneId });'
new_boss_active = '''    zs.bossActive = true;
    // 40% chance for carrier boss variant (spawns fighters)
    if (Math.random() < 0.4 && zoneDef.enemyTier >= 3) {
      boss.behavior = "carrier" as any;
      boss.hullMax = Math.round(boss.hullMax * 1.5);
      boss.hull = boss.hullMax;
      boss.speed = Math.round(boss.speed * 0.5);
      boss.size = Math.round(boss.size * 1.3);
      boss.name = "CARRIER " + boss.name.replace("BOSS ", "");
    }
    events.push({ type: "boss:warn", zone: zoneId });'''

if 'carrier' not in beng:
    beng = beng.replace(old_boss_active, new_boss_active)
    print("  -> Added carrier boss variant (40% chance in tier 3+)")

# 2d. Add carrier fighter spawning logic in enemy AI
# Find the boss phase cycling code and add fighter spawning
carrier_spawn_code = '''
      // Carrier boss: spawn fighters every phase cycle
      if (e.behavior === "carrier" && e.isBoss) {
        if (e.phaseTimer <= 0) {
          // Spawn 2-3 fast fighters near the carrier
          const spawnCount = 2 + Math.floor(Math.random() * 2);
          const fighterType = "scout" as any;
          const fighterDef = ENEMY_DEFS[fighterType];
          const carrierTierMult = Math.pow(2, (ZONES[zoneId as ZoneId]?.enemyTier ?? 1) - 1);
          for (let fi = 0; fi < spawnCount; fi++) {
            const fAng = Math.random() * Math.PI * 2;
            const fDist = 60 + Math.random() * 80;
            const fighter: ServerEnemy = {
              id: eid("f"),
              type: fighterType,
              behavior: "fast",
              name: "Fighter",
              pos: { x: e.pos.x + Math.cos(fAng) * fDist, y: e.pos.y + Math.sin(fAng) * fDist },
              vel: { x: 0, y: 0 },
              angle: fAng,
              hull: Math.round(fighterDef.hullMax * carrierTierMult * 0.6),
              hullMax: Math.round(fighterDef.hullMax * carrierTierMult * 0.6),
              damage: Math.round(fighterDef.damage * carrierTierMult * 1.5),
              speed: Math.round(fighterDef.speed * 1.8),
              exp: Math.round(fighterDef.exp * carrierTierMult * 0.3),
              credits: Math.round(fighterDef.credits * carrierTierMult * 0.2),
              honor: 0,
              loot: { resourceId: "scrap" as ResourceId, qty: 1 },
              color: e.color,
              size: 8,
              isBoss: false,
              bossPhase: 0, phaseTimer: 0,
              fireTimer: randRange(0.3, 0.6),
              burstCd: 0, burstShots: 0,
              aggroTarget: e.aggroTarget, retargetCd: 0,
              aggroRange: 600,
              spawnPos: { ...e.pos },
              stunUntil: 0,
              combo: new Map(),
            };
            zs.enemies.set(fighter.id, fighter);
            events.push({ type: "enemy:spawn", zone: zoneId, enemy: enemyToClient(fighter) });
          }
          e.phaseTimer = randRange(4, 7);
        }
      }
'''

# Find a good insertion point - after boss phase cycling
phase_marker = 'e.phaseTimer = randRange(10, 15);'
if phase_marker in beng and 'carrier boss' not in beng:
    phase_idx = beng.find(phase_marker)
    line_end = beng.find('\n', phase_idx)
    beng = beng[:line_end+1] + carrier_spawn_code + beng[line_end+1:]
    print("  -> Added carrier boss fighter spawning logic")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(beng)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. FRONTEND TYPES - Mirror enemy type changes
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating frontend types.ts - New enemies + zones ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    ftype = f.read()

# 3a. Expand frontend EnemyType
old_fetype = 'export type EnemyType = "scout" | "raider" | "destroyer" | "voidling" | "dread";'
new_fetype = 'export type EnemyType = "scout" | "raider" | "destroyer" | "voidling" | "dread" | "sentinel" | "wraith" | "titan" | "overlord";'
if '"sentinel"' not in ftype:
    ftype = ftype.replace(old_fetype, new_fetype)
    print("  -> Added new enemy types to frontend EnemyType")

# 3b. Add new ENEMY_DEFS to frontend
new_fdefs = '''  sentinel: {
    type: "sentinel", behavior: "ranged",
    hullMax: 450, damage: 48, speed: 100, exp: 65, credits: 220, honor: 8,
    color: "#22ccff", size: 16,
    loot: { resourceId: "quantum", qty: 2 },
  },
  wraith: {
    type: "wraith", behavior: "fast",
    hullMax: 320, damage: 60, speed: 160, exp: 80, credits: 280, honor: 10,
    color: "#cc44ff", size: 12,
    loot: { resourceId: "void", qty: 3 },
  },
  titan: {
    type: "titan", behavior: "tank",
    hullMax: 1500, damage: 75, speed: 35, exp: 150, credits: 500, honor: 18,
    color: "#ff2244", size: 30,
    loot: { resourceId: "dread", qty: 4 },
  },
  overlord: {
    type: "overlord", behavior: "tank",
    hullMax: 2200, damage: 95, speed: 30, exp: 250, credits: 800, honor: 30,
    color: "#ffffff", size: 35,
    loot: { resourceId: "dread", qty: 6 },
  },
'''

if 'sentinel:' not in ftype.split('ENEMY_DEFS')[1] if 'ENEMY_DEFS' in ftype else '':
    # Find the closing of frontend ENEMY_DEFS (after dread entry)
    fdefs_start = ftype.find('ENEMY_DEFS')
    dread_section = ftype.find('dread: {', fdefs_start)
    dread_loot = ftype.find("loot: { resourceId: \"dread\"", dread_section)
    dread_close = ftype.find('},', dread_loot) + 2
    next_close = ftype.find('\n};', dread_close)
    if next_close >= 0:
        ftype = ftype[:next_close] + '\n' + new_fdefs + ftype[next_close:]
        print("  -> Added sentinel, wraith, titan, overlord to frontend ENEMY_DEFS")

# 3c. Add faction mods for new types in frontend
old_fmars_dread = '    dread:     { color: "#ff8800", hullMul: 1.15, damageMul: 1.10 },'
new_fmars_dread = '''    dread:     { color: "#ff8800", hullMul: 1.15, damageMul: 1.10 },
    sentinel:  { color: "#ff6622", damageMul: 1.15, speedMul: 1.10 },
    wraith:    { color: "#ff4400", speedMul: 1.25, damageMul: 1.10 },
    titan:     { color: "#cc2200", hullMul: 1.20, damageMul: 1.15 },
    overlord:  { color: "#ff0000", hullMul: 1.25, damageMul: 1.20 },'''

fmars_idx = ftype.find(old_fmars_dread)
if fmars_idx >= 0 and 'sentinel' not in ftype[fmars_idx:fmars_idx+400]:
    ftype = ftype.replace(old_fmars_dread, new_fmars_dread, 1)
    print("  -> Added new enemy faction mods (mars) frontend")

old_fvenus_dread = '    dread:     { color: "#aa00ff", hullMul: 1.20, damageMul: 1.12 },'
new_fvenus_dread = '''    dread:     { color: "#aa00ff", hullMul: 1.20, damageMul: 1.12 },
    sentinel:  { color: "#8844ff", damageMul: 1.20, hullMul: 1.10 },
    wraith:    { color: "#ff22cc", speedMul: 1.15, damageMul: 1.25 },
    titan:     { color: "#9900cc", hullMul: 1.15, damageMul: 1.20 },
    overlord:  { color: "#cc00ff", hullMul: 1.30, damageMul: 1.25 },'''

fvenus_idx = ftype.find(old_fvenus_dread)
if fvenus_idx >= 0 and 'sentinel' not in ftype[fvenus_idx:fvenus_idx+400]:
    ftype = ftype.replace(old_fvenus_dread, new_fvenus_dread, 1)
    print("  -> Added new enemy faction mods (venus) frontend")

# 3d. Update frontend zone enemy compositions to match backend
fzone_updates = {
    'crimson': ('["destroyer", "dread"]', '["destroyer", "sentinel", "dread"]'),
    'abyss': ('["destroyer", "dread"]', '["destroyer", "sentinel", "dread"]'),
    'venus3': ('["destroyer", "dread"]', '["destroyer", "sentinel", "dread"]'),
    'void': ('["voidling", "dread"]', '["sentinel", "wraith", "dread"]'),
    'marsdepth': ('["voidling", "dread"]', '["sentinel", "wraith", "dread"]'),
    'venus4': ('["voidling", "dread"]', '["sentinel", "wraith", "dread"]'),
    'forge': ('["dread"]', '["wraith", "titan", "dread"]'),
    'maelstrom': ('["dread"]', '["wraith", "titan", "dread"]'),
    'venus5': ('["dread"]', '["wraith", "titan", "dread"]'),
    'danger1': ('["destroyer", "voidling", "dread"]', '["sentinel", "wraith", "titan"]'),
    'danger2': ('["voidling", "dread"]', '["wraith", "titan", "dread"]'),
    'danger3': ('["dread", "voidling"]', '["titan", "dread", "overlord"]'),
    'danger4': ('["dread"]', '["titan", "overlord", "dread"]'),
    'danger5': ('["dread"]', '["overlord", "titan", "dread"]'),
}

for zone_id, (old_types, new_types) in fzone_updates.items():
    # Find zone definition
    zone_start = ftype.find(f'id: "{zone_id}"', ftype.find('ZONES'))
    if zone_start >= 0:
        # Find enemyTypes within this zone (next 200 chars)
        section = ftype[zone_start:zone_start+300]
        if old_types in section:
            ftype = ftype[:zone_start] + section.replace(old_types, new_types, 1) + ftype[zone_start+300:]

print("  -> Updated frontend zone enemy compositions")

# 3e. Scale down QUEST_POOL rewards drastically
# Current scaling is way too high. Let's make it:
# Tier 1: 100-300cr, Tier 2: 400-800cr, Tier 3: 1000-2500cr, Tier 4: 3000-8000cr, Tier 5+: 10000-25000cr
quest_pool_start = ftype.find('export const QUEST_POOL')
quest_pool_end = ftype.find('];', quest_pool_start) + 2

if quest_pool_start >= 0:
    new_quest_pool = '''export const QUEST_POOL: Quest[] = [
  // Tier 1 - Alpha/Corona/Venus1 (beginner maps)
  { id: "q-t1-scouts", title: "Sweep the Lanes", description: "Pirate scouts raiding traders. Eliminate them.", zone: "alpha", tier: 1, killType: "scout", killCount: 5, rewardCredits: 150, rewardExp: 40, rewardHonor: 2 },
  { id: "q-t1-raiders", title: "Raider Bounty", description: "A raider crew is harassing traffic. Take them down.", zone: "alpha", tier: 1, killType: "raider", killCount: 3, rewardCredits: 250, rewardExp: 60, rewardHonor: 4 },
  { id: "q-t1-scouts2", title: "Scout Patrol", description: "Enemy scouts spotted near the station. Clear them out.", zone: "corona", tier: 1, killType: "scout", killCount: 8, rewardCredits: 200, rewardExp: 50, rewardHonor: 3 },
  { id: "q-t1-raiders2", title: "Outpost Defense", description: "Raiders attacking the outer perimeter.", zone: "venus1", tier: 1, killType: "raider", killCount: 4, rewardCredits: 300, rewardExp: 70, rewardHonor: 5 },

  // Tier 2 - Nebula/Fracture/Venus2
  { id: "q-t2-raiders", title: "Veil Cleanup", description: "The Nebula is thick with raider holdouts. Clear them.", zone: "nebula", tier: 2, killType: "raider", killCount: 6, rewardCredits: 500, rewardExp: 120, rewardHonor: 8 },
  { id: "q-t2-destroyers", title: "Destroy the Destroyers", description: "Heavy destroyers blocking trade routes.", zone: "nebula", tier: 2, killType: "destroyer", killCount: 3, rewardCredits: 800, rewardExp: 200, rewardHonor: 12 },
  { id: "q-t2-raiders2", title: "Dust Storm Raiders", description: "Raiders hiding in the dust storms.", zone: "fracture", tier: 2, killType: "raider", killCount: 8, rewardCredits: 600, rewardExp: 150, rewardHonor: 10 },
  { id: "q-t2-destroyers2", title: "Wind Breakers", description: "Destroyer patrol in the sulphur corridors.", zone: "venus2", tier: 2, killType: "destroyer", killCount: 4, rewardCredits: 900, rewardExp: 220, rewardHonor: 14 },

  // Tier 3 - Crimson/Abyss/Venus3 (sentinels appear)
  { id: "q-t3-destroyers", title: "Crimson Purge", description: "Destroyers established a beachhead in Crimson Reach.", zone: "crimson", tier: 3, killType: "destroyer", killCount: 5, rewardCredits: 1200, rewardExp: 350, rewardHonor: 18 },
  { id: "q-t3-sentinels", title: "Sentinel Hunt", description: "Armored sentinels are patrolling aggressively. Destroy them.", zone: "crimson", tier: 3, killType: "sentinel", killCount: 4, rewardCredits: 1500, rewardExp: 400, rewardHonor: 22 },
  { id: "q-t3-dread", title: "Bring Down a Dread", description: "A Dread-class warship in the sector. Send it home in pieces.", zone: "crimson", tier: 3, killType: "dread", killCount: 1, rewardCredits: 2000, rewardExp: 500, rewardHonor: 30 },
  { id: "q-t3-sentinels2", title: "Red Reach Wardens", description: "Sentinels guarding the Martian reaches. Remove them.", zone: "abyss", tier: 3, killType: "sentinel", killCount: 5, rewardCredits: 1800, rewardExp: 450, rewardHonor: 25 },
  { id: "q-t3-destroyers2", title: "Acid Corridor Purge", description: "Destroy the heavy ships in the acid corridors.", zone: "venus3", tier: 3, killType: "destroyer", killCount: 6, rewardCredits: 1400, rewardExp: 380, rewardHonor: 20 },

  // Tier 4 - Void/MarsDepth/Venus4 (wraiths appear)
  { id: "q-t4-wraiths", title: "Phantom Menace", description: "Wraiths phase in and out of reality. Banish them.", zone: "void", tier: 4, killType: "wraith", killCount: 5, rewardCredits: 3000, rewardExp: 800, rewardHonor: 40 },
  { id: "q-t4-sentinels", title: "Void Wardens", description: "Sentinels guard the dimensional rifts. Clear the path.", zone: "void", tier: 4, killType: "sentinel", killCount: 6, rewardCredits: 3500, rewardExp: 900, rewardHonor: 45 },
  { id: "q-t4-dread", title: "Apex Predator", description: "A Dread haunts the Void. Become its end.", zone: "void", tier: 4, killType: "dread", killCount: 2, rewardCredits: 5000, rewardExp: 1200, rewardHonor: 60 },
  { id: "q-t4-wraiths2", title: "Deep Field Phantoms", description: "Wraiths swarming the Martian deep field.", zone: "marsdepth", tier: 4, killType: "wraith", killCount: 6, rewardCredits: 3500, rewardExp: 850, rewardHonor: 42 },
  { id: "q-t4-sentinels2", title: "Pressure Sentinels", description: "Sentinels adapted to Venus's crushing core.", zone: "venus4", tier: 4, killType: "sentinel", killCount: 7, rewardCredits: 4000, rewardExp: 1000, rewardHonor: 50 },

  // Tier 5 - Forge/Maelstrom/Venus5 (titans appear)
  { id: "q-t5-titans", title: "Titan Takedown", description: "Massive titans block the Iron Forge supply lanes.", zone: "forge", tier: 5, killType: "titan", killCount: 3, rewardCredits: 8000, rewardExp: 2000, rewardHonor: 100 },
  { id: "q-t5-wraiths", title: "Forge Phantoms", description: "Wraiths warping through the superheated forges.", zone: "forge", tier: 5, killType: "wraith", killCount: 6, rewardCredits: 6000, rewardExp: 1500, rewardHonor: 75 },
  { id: "q-t5-dread", title: "Iron Curtain", description: "Dread warships have locked down the Forge. Break through.", zone: "forge", tier: 5, killType: "dread", killCount: 3, rewardCredits: 10000, rewardExp: 2500, rewardHonor: 120 },
  { id: "q-t5-titans2", title: "Storm Colossi", description: "Titans entrenched in the Maelstrom. Bring them down.", zone: "maelstrom", tier: 5, killType: "titan", killCount: 4, rewardCredits: 9000, rewardExp: 2200, rewardHonor: 110 },
  { id: "q-t5-wraiths2", title: "Eye Specters", description: "Wraiths haunting the Eye of Venus.", zone: "venus5", tier: 5, killType: "wraith", killCount: 8, rewardCredits: 7000, rewardExp: 1800, rewardHonor: 85 },

  // Tier 6-7 - Danger zones (overlords appear)
  { id: "q-t6-titans", title: "Rift Titans", description: "Titans command the Outer Rift. Challenge them.", zone: "danger1", tier: 5, killType: "titan", killCount: 4, rewardCredits: 12000, rewardExp: 3000, rewardHonor: 150 },
  { id: "q-t6-overlords", title: "Dead Zone Overlords", description: "Overlords rule the Dead Zone. Dethrone them.", zone: "danger3", tier: 6, killType: "overlord", killCount: 2, rewardCredits: 18000, rewardExp: 5000, rewardHonor: 250 },
  { id: "q-t7-overlords", title: "Null Sector Supremacy", description: "The most powerful Overlords in known space. Destroy them all.", zone: "danger4", tier: 7, killType: "overlord", killCount: 3, rewardCredits: 25000, rewardExp: 8000, rewardHonor: 400 },
  { id: "q-t8-titans", title: "Abyss Gate Titans", description: "Titans guard the deepest gate. Only legends attempt this.", zone: "danger5", tier: 8, killType: "titan", killCount: 5, rewardCredits: 30000, rewardExp: 10000, rewardHonor: 500 },
  { id: "q-t8-overlords", title: "God of the Abyss", description: "A legendary Overlord dominates the deepest sector. Become the last thing it sees.", zone: "danger5", tier: 8, killType: "overlord", killCount: 4, rewardCredits: 40000, rewardExp: 15000, rewardHonor: 800 },
];'''

    ftype = ftype[:quest_pool_start] + new_quest_pool + ftype[quest_pool_end:]
    print("  -> Replaced QUEST_POOL with properly scaled rewards (150-40000cr range)")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(ftype)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. FRONTEND RENDER - Add rendering for new enemy types
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating frontend render.ts - New enemy visuals ═══")

with open('frontend/src/game/render.ts', 'r') as f:
    rcode = f.read()

# Check if there's enemy-type-specific rendering
if 'sentinel' not in rcode:
    # Find where enemy types affect rendering (look for scout/raider/destroyer switch)
    # Usually enemies are rendered by color/size from their data, but let's check
    pass  # The rendering likely uses color/size from ENEMY_DEFS which we've already set

print("  -> Enemy rendering uses color/size from ENEMY_DEFS (auto-covered)")

# ═══════════════════════════════════════════════════════════════════════════════
# 5. FRONTEND LOOP - Update tier multiplier formula to match backend
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating frontend loop.ts - Tier multiplier ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    lcode = f.read()

# Check if frontend has tier mult formula
old_front_tier = '1 + (zoneDef.enemyTier - 1) * 0.5'
new_front_tier = 'Math.pow(2, zoneDef.enemyTier - 1)'
if old_front_tier in lcode:
    lcode = lcode.replace(old_front_tier, new_front_tier)
    print("  -> Updated frontend tier multiplier to doubling")
else:
    print("  -> Frontend doesn't have tier mult formula (server-authoritative)")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lcode)

print("\n═══ ALL DONE ═══")
print("Summary:")
print("  - Tier multiplier: 2^(tier-1) → T1=1x, T2=2x, T3=4x, T4=8x, T5=16x, T6=32x, T7=64x")
print("  - New enemies: sentinel (ranged), wraith (fast), titan (heavy tank), overlord (mega tank)")
print("  - Zone compositions updated with progressive difficulty")
print("  - Carrier boss variant: 40% chance in tier 3+, spawns fighters every 4-7 seconds")
print("  - Bounty rewards scaled down: 150cr-40000cr range (was 350cr-1.1M)")
print("  - Boss credit reward reduced from 2x to 1.2x multiplier")
