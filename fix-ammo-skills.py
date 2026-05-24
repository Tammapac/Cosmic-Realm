#!/usr/bin/env python3
"""
Fix 3 issues:
1. Backend doesn't check ammo before firing (invisible projectiles at 0 ammo)
2. Skills use % multipliers that compound into OP territory - switch to flat bonuses
3. Sync backend skill formulas
"""

import re

# ═══════════════════════════════════════════════════════════════════════════════
# 1. BACKEND ENGINE - Add ammo check before firing
# ═══════════════════════════════════════════════════════════════════════════════
print("═══ Fixing backend ammo check ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    eng = f.read()

# Find the laser firing section and add ammo check
old_laser_fire = '''      // Fire laser
      if (p.isLaserFiring && p.laserFireCd <= 0) {'''

new_laser_fire = '''      // Fire laser (only if player has ammo)
      const pLaserAmmo = pData?.ammo?.[p.laserAmmoType as string] ?? 0;
      if (p.isLaserFiring && p.laserFireCd <= 0 && pLaserAmmo >= 1) {'''

if 'pLaserAmmo' not in eng:
    eng = eng.replace(old_laser_fire, new_laser_fire)
    print("  -> Added laser ammo check to backend firing")

# Find rocket firing and add ammo check
old_rocket_fire = re.search(r'// Fire rocket.*?\n\s+if \(p\.isRocketFiring && p\.rocketFireCd <= 0\)', eng, re.DOTALL)
if old_rocket_fire:
    old_text = old_rocket_fire.group(0)
    if 'rocketAmmo' not in old_text:
        new_text = old_text.replace(
            'if (p.isRocketFiring && p.rocketFireCd <= 0)',
            'const pRocketAmmo = pData?.rocketAmmo?.[p.rocketAmmoType as string] ?? 0;\n        if (p.isRocketFiring && p.rocketFireCd <= 0 && pRocketAmmo >= 1)'
        )
        eng = eng.replace(old_text, new_text)
        print("  -> Added rocket ammo check to backend firing")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. BACKEND ENGINE - Change skills from % to flat numbers
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Changing backend skills to flat bonuses ═══")

# Find the computePlayerStats section
# Replace percentage multipliers with flat additions

# off-power: was 1 + rank*0.10 = up to +50% at rank 5
# New: +3 damage per rank = +15 at rank 5
old_dmg = 'let damage = (cls.baseDamage + (mod.damage ?? 0)) * (1 + sk("off-power") * 0.10);'
new_dmg = 'let damage = (cls.baseDamage + (mod.damage ?? 0)) + sk("off-power") * 3;'
eng = eng.replace(old_dmg, new_dmg)

# def-armor: was *1 + rank*0.15 = +75% hull at rank 5
# New: +20 hull per rank = +100 at rank 5
old_hull = re.search(r'let hullMax = \(cls\.hullMax.*?\* \(1 \+ sk\("def-armor"\) \* [\d.]+\);', eng)
if old_hull:
    eng = eng.replace(old_hull.group(0), 'let hullMax = (cls.hullMax + (mod.hullMax ?? 0)) + sk("def-armor") * 20;')

# def-shield + def-barrier: was *(1 + rank*0.15 + rank*0.20) = massive shield boost
# New: +15 shield per rank (shield) + +25 per rank (barrier)
old_shield = re.search(r'let shieldMax = \(cls\.shieldMax.*?\* \(1 \+ sk\("def-shield"\) \* [\d.]+ \+ sk\("def-barrier"\) \* [\d.]+\);', eng)
if old_shield:
    eng = eng.replace(old_shield.group(0), 'let shieldMax = (cls.shieldMax + (mod.shieldMax ?? 0)) + sk("def-shield") * 15 + sk("def-barrier") * 25;')

# speed: was *(1 + rank*0.10) = +50% at rank 5
# New: +5 speed per rank = +25 at rank 5
old_speed = re.search(r'let speed = \(cls\.baseSpeed.*?\* \(1 \+ sk\("ut-thrust"\) \* [\d.]+\);', eng)
if old_speed:
    eng = eng.replace(old_speed.group(0), 'let speed = (cls.baseSpeed + (mod.speed ?? 0)) + sk("ut-thrust") * 5;')

# damageReduction: was rank*0.08 = 24% at rank 3
# New: rank*0.03 = 9% at rank 3
eng = eng.replace('sk("def-bulwark") * 0.08', 'sk("def-bulwark") * 0.03')

# aoeRadius: was rank*6 = 18px at rank 3
# Keep this flat, it's fine
# eng already has this as flat

# critChance: was 0.03 + rank*0.05 = 28% at rank 5
# New: 0.02 + rank*0.02 = 12% at rank 5
eng = eng.replace("0.03 + sk(\"off-crit\") * 0.05", "0.02 + sk(\"off-crit\") * 0.02")

# fireRate: was *(1 + rank*0.15) = +75% at rank 5
# New: +0.05 per rank = +0.25 at rank 5 (additive, not multiplicative)
old_firerate = re.search(r'let fireRate = \(1 \+ sk\("off-rapid"\) \* [\d.]+\) \* \(mod\.fireRate \?\? 1\);', eng)
if old_firerate:
    eng = eng.replace(old_firerate.group(0), 'let fireRate = (mod.fireRate ?? 1) + sk("off-rapid") * 0.05;')

# lootBonus: was rank*0.08 = 24% at rank 3
# New: rank*0.04 = 12% at rank 3
eng = eng.replace('sk("ut-scan") * 0.08', 'sk("ut-scan") * 0.04')

# off-snipe: was *(1 + rank*0.08) = +40% and +rank*0.04 crit
# New: +2 damage per rank, +0.01 crit per rank
eng = eng.replace('damage *= (1 + sk("off-snipe") * 0.08);', 'damage += sk("off-snipe") * 2;')
eng = eng.replace('critChance += sk("off-snipe") * 0.04;', 'critChance += sk("off-snipe") * 0.01;')

# eng-coolant: was *(1 + rank*0.15) fire rate
# New: +0.04 fire rate per rank
eng = eng.replace('fireRate *= (1 + sk("eng-coolant") * 0.15);', 'fireRate += sk("eng-coolant") * 0.04;')

# eng-capacitor: was *(1 + rank*0.10) damage and shield regen
# New: +2 damage per rank, +1 shield regen per rank
eng = eng.replace('damage *= (1 + sk("eng-capacitor") * 0.10);', 'damage += sk("eng-capacitor") * 2;')
# Shield regen capacitor
eng = eng.replace('shieldRegen *= (1 + sk("eng-capacitor") * 0.10);', 'shieldRegen += sk("eng-capacitor") * 1;')

# eng-targeting: was +rank*0.08 crit = 24% at rank 3
# New: +0.02 crit per rank = 6% at rank 3
eng = eng.replace('critChance += sk("eng-targeting") * 0.08;', 'critChance += sk("eng-targeting") * 0.02;')

# eng-warp-core: was *(1 + rank*0.15) speed
# New: +4 speed per rank
eng = eng.replace('speed *= (1 + sk("eng-warp-core") * 0.15);', 'speed += sk("eng-warp-core") * 4;')

# eng-overdrive: was *(1 + rank*0.18) damage/shield/speed
# New: +4 damage, +20 shield, +3 speed per rank
old_od = '''  const od = sk("eng-overdrive");
  if (od > 0) {
    damage *= (1 + od * 0.18);
    shieldMax *= (1 + od * 0.18);
    speed *= (1 + od * 0.18);
  }'''
new_od = '''  const od = sk("eng-overdrive");
  if (od > 0) {
    damage += od * 4;
    shieldMax += od * 20;
    speed += od * 3;
  }'''
eng = eng.replace(old_od, new_od)

# eng-singularity: was *1.30 damage, *1.25 fire rate, *1.15 speed
# New: +8 damage, +0.1 fire rate, +6 speed
old_sing = '''  if (sk("eng-singularity") > 0) {
    damage *= 1.30;
    fireRate *= 1.25;
    speed *= 1.15;
  }'''
new_sing = '''  if (sk("eng-singularity") > 0) {
    damage += 8;
    fireRate += 0.1;
    speed += 6;
  }'''
eng = eng.replace(old_sing, new_sing)

# def-nano: was *(1 + rank*0.15) shield regen & *(1 + rank*0.10) hull
# New: +2 shield regen per rank, +15 hull per rank
eng = eng.replace('shieldRegen *= (1 + sk("def-nano") * 0.15);', 'shieldRegen += sk("def-nano") * 2;')
eng = eng.replace('hullMax *= (1 + sk("def-nano") * 0.10);', 'hullMax += sk("def-nano") * 15;')

# off-volley: was *(1 + rank*0.20) fire rate
# New: +0.06 fire rate per rank
eng = eng.replace('fireRate *= (1 + sk("off-volley") * 0.20);', 'fireRate += sk("off-volley") * 0.06;')

# def-regen: was *(1 + rank*0.20) shield regen
# New: +2 shield regen per rank
eng = eng.replace('shieldRegen *= (1 + sk("def-regen") * 0.20);', 'shieldRegen += sk("def-regen") * 2;')

print("  -> Changed all backend skill formulas to flat additions")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(eng)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. FRONTEND LOOP - Mirror skill changes
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Changing frontend skills to flat bonuses ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    floop = f.read()

# Same replacements as backend
floop = floop.replace(
    '(cls.baseDamage + mod.damage) * (1 + sk("off-power") * 0.10)',
    '(cls.baseDamage + mod.damage) + sk("off-power") * 3'
)
floop = floop.replace(
    '(cls.hullMax + (mod.hullMax ?? 0)) * (1 + sk("def-armor") * 0.15)',
    '(cls.hullMax + (mod.hullMax ?? 0)) + sk("def-armor") * 20'
)
floop = floop.replace(
    '(cls.shieldMax + (mod.shieldMax ?? 0)) * (1 + sk("def-shield") * 0.15 + sk("def-barrier") * 0.20)',
    '(cls.shieldMax + (mod.shieldMax ?? 0)) + sk("def-shield") * 15 + sk("def-barrier") * 25'
)
floop = floop.replace(
    '(cls.baseSpeed + (mod.speed ?? 0)) * (1 + sk("ut-thrust") * 0.10)',
    '(cls.baseSpeed + (mod.speed ?? 0)) + sk("ut-thrust") * 5'
)
floop = floop.replace('sk("def-bulwark") * 0.08', 'sk("def-bulwark") * 0.03')
floop = floop.replace('0.03 + sk("off-crit") * 0.05', '0.02 + sk("off-crit") * 0.02')

old_fr = '(1 + sk("off-rapid") * 0.15) * (mod.fireRate ?? 1)'
new_fr = '(mod.fireRate ?? 1) + sk("off-rapid") * 0.05'
floop = floop.replace(old_fr, new_fr)

floop = floop.replace('sk("ut-scan") * 0.08', 'sk("ut-scan") * 0.04')
floop = floop.replace('damage *= (1 + sk("off-snipe") * 0.08);', 'damage += sk("off-snipe") * 2;')
floop = floop.replace('critChance += sk("off-snipe") * 0.04;', 'critChance += sk("off-snipe") * 0.01;')
floop = floop.replace('fireRate *= (1 + sk("eng-coolant") * 0.15);', 'fireRate += sk("eng-coolant") * 0.04;')
floop = floop.replace('damage *= (1 + sk("eng-capacitor") * 0.10);', 'damage += sk("eng-capacitor") * 2;')
floop = floop.replace('shieldRegen *= (1 + sk("eng-capacitor") * 0.10);', 'shieldRegen += sk("eng-capacitor") * 1;')
floop = floop.replace('critChance += sk("eng-targeting") * 0.08;', 'critChance += sk("eng-targeting") * 0.02;')
floop = floop.replace('speed *= (1 + sk("eng-warp-core") * 0.15);', 'speed += sk("eng-warp-core") * 4;')

# Overdrive
old_od_f = '''  const od = sk("eng-overdrive");
  if (od > 0) {
    damage *= (1 + od * 0.18);
    shieldMax *= (1 + od * 0.18);
    speed *= (1 + od * 0.18);
  }'''
new_od_f = '''  const od = sk("eng-overdrive");
  if (od > 0) {
    damage += od * 4;
    shieldMax += od * 20;
    speed += od * 3;
  }'''
floop = floop.replace(old_od_f, new_od_f)

# Singularity
old_sing_f = '''  if (sk("eng-singularity") > 0) {
    damage *= 1.30;
    fireRate *= 1.25;
    speed *= 1.15;
  }'''
new_sing_f = '''  if (sk("eng-singularity") > 0) {
    damage += 8;
    fireRate += 0.1;
    speed += 6;
  }'''
floop = floop.replace(old_sing_f, new_sing_f)

floop = floop.replace('shieldRegen *= (1 + sk("def-nano") * 0.15);', 'shieldRegen += sk("def-nano") * 2;')
floop = floop.replace('hullMax *= (1 + sk("def-nano") * 0.10);', 'hullMax += sk("def-nano") * 15;')
floop = floop.replace('fireRate *= (1 + sk("off-volley") * 0.20);', 'fireRate += sk("off-volley") * 0.06;')
floop = floop.replace('shieldRegen *= (1 + sk("def-regen") * 0.20);', 'shieldRegen += sk("def-regen") * 2;')

print("  -> Changed all frontend skill formulas to flat additions")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(floop)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. FRONTEND TYPES - Update skill descriptions to show flat numbers
# ═══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating skill descriptions ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    ftypes = f.read()

desc_replacements = {
    # Offense
    '+10% laser damage per rank.': '+3 laser damage per rank.',
    '+8% damage & +4% crit per rank.': '+2 damage & +1% crit per rank.',
    '+15% fire rate per rank.': '+0.05 fire rate per rank.',
    'Fire rate burst: +20% fire rate per rank.': '+0.06 fire rate per rank.',
    '+5% crit chance per rank.': '+2% crit chance per rank.',
    '+20% damage vs enemies below 25% HP per rank.': '+20% damage vs enemies below 25% HP per rank.',
    'Shots gain splash radius (rank×6 px).': 'Shots gain splash radius (rank x 6 px).',
    # Defense
    '+15% max shield per rank.': '+15 max shield per rank.',
    '+20% max shield per rank.': '+25 max shield per rank.',
    '-15% damage taken when shield > 50%, per rank.': '-15% damage taken when shield > 50%, per rank.',
    '+20% shield regen per rank.': '+2 shield regen per rank.',
    '+15% shield regen & +10% hull per rank.': '+2 shield regen & +15 hull per rank.',
    '+15% max hull per rank.': '+20 max hull per rank.',
    'Reduce all damage taken by 8% per rank.': 'Reduce all damage taken by 3% per rank.',
    # Utility
    '+10% top speed per rank.': '+5 top speed per rank.',
    '+8% loot bonus per rank.': '+4% loot bonus per rank.',
    # Engineering
    '+10% fire rate & -heat buildup per rank.': '+0.04 fire rate per rank.',
    '+6% damage & +5% shield regen per rank.': '+2 damage & +1 shield regen per rank.',
    '+5% crit chance & rockets track better.': '+2% crit chance & rockets track better.',
    '+8% speed per rank from generator overclock.': '+4 speed per rank.',
    '+12% all stats (damage, shield, speed) per rank.': '+4 damage, +20 shield, +3 speed per rank.',
    'Endgame: +20% damage, +15% fire rate, +10% speed.': '+8 damage, +0.1 fire rate, +6 speed.',
}

for old_desc, new_desc in desc_replacements.items():
    if old_desc in ftypes:
        ftypes = ftypes.replace(old_desc, new_desc)

print("  -> Updated all skill descriptions to flat numbers")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(ftypes)

print("\nDONE!")
print("  - Backend now checks ammo before firing (no more invisible projectiles)")
print("  - All skills changed from % multipliers to flat additions")
print("  - Descriptions updated to reflect flat values")
