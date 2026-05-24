#!/usr/bin/env python3
"""Make skills have much stronger impact + fix stat display to show changes clearly."""

# ══════════════════════════════════════════════════════════════════════════════
# 1. DOUBLE the skill multipliers in BOTH frontend and backend
# ══════════════════════════════════════════════════════════════════════════════

# --- FRONTEND effectiveStats ---
print("═══ Boosting frontend skill multipliers ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    code = f.read()

# off-power: 5% -> 10% per rank
code = code.replace(
    'let damage = (cls.baseDamage + mod.damage) * (1 + sk("off-power") * 0.05);',
    'let damage = (cls.baseDamage + mod.damage) * (1 + sk("off-power") * 0.10);'
)
# def-armor: 8% -> 15% per rank
code = code.replace(
    'let hullMax = (cls.hullMax + (mod.hullMax ?? 0)) * (1 + sk("def-armor") * 0.08);',
    'let hullMax = (cls.hullMax + (mod.hullMax ?? 0)) * (1 + sk("def-armor") * 0.15);'
)
# def-shield: 8% -> 15%, def-barrier: 12% -> 20%
code = code.replace(
    'let shieldMax = (cls.shieldMax + (mod.shieldMax ?? 0)) * (1 + sk("def-shield") * 0.08 + sk("def-barrier") * 0.12);',
    'let shieldMax = (cls.shieldMax + (mod.shieldMax ?? 0)) * (1 + sk("def-shield") * 0.15 + sk("def-barrier") * 0.20);'
)
# ut-thrust: 5% -> 10% per rank
code = code.replace(
    'let speed = (cls.baseSpeed + (mod.speed ?? 0)) * (1 + sk("ut-thrust") * 0.05);',
    'let speed = (cls.baseSpeed + (mod.speed ?? 0)) * (1 + sk("ut-thrust") * 0.10);'
)
# def-bulwark: 4% -> 8%
code = code.replace(
    'let damageReduction = (sk("def-bulwark") * 0.04)',
    'let damageReduction = (sk("def-bulwark") * 0.08)'
)
# off-pierce: 4 -> 6 per rank
code = code.replace(
    'let aoeRadius = (sk("off-pierce") * 4)',
    'let aoeRadius = (sk("off-pierce") * 6)'
)
# off-crit: 3% -> 5%
code = code.replace(
    'let critChance = 0.03 + sk("off-crit") * 0.03',
    'let critChance = 0.03 + sk("off-crit") * 0.05'
)
# off-rapid: 8% -> 15%
code = code.replace(
    'let fireRate = (1 + sk("off-rapid") * 0.08)',
    'let fireRate = (1 + sk("off-rapid") * 0.15)'
)
# off-snipe: 4% dmg -> 8%, 2% crit -> 4%
code = code.replace(
    'damage *= (1 + sk("off-snipe") * 0.04);\n  critChance += sk("off-snipe") * 0.02;',
    'damage *= (1 + sk("off-snipe") * 0.08);\n  critChance += sk("off-snipe") * 0.04;'
)
# eng-coolant: 10% -> 15%
code = code.replace(
    'fireRate *= (1 + sk("eng-coolant") * 0.10);',
    'fireRate *= (1 + sk("eng-coolant") * 0.15);'
)
# eng-capacitor: 6% dmg -> 10%, 5% regen -> 10%
code = code.replace(
    'damage *= (1 + sk("eng-capacitor") * 0.06);\n  shieldRegen *= (1 + sk("eng-capacitor") * 0.05);',
    'damage *= (1 + sk("eng-capacitor") * 0.10);\n  shieldRegen *= (1 + sk("eng-capacitor") * 0.10);'
)
# eng-targeting: 5% -> 8%
code = code.replace(
    'critChance += sk("eng-targeting") * 0.05;',
    'critChance += sk("eng-targeting") * 0.08;'
)
# eng-warp-core: 8% -> 15%
code = code.replace(
    'speed *= (1 + sk("eng-warp-core") * 0.08);',
    'speed *= (1 + sk("eng-warp-core") * 0.15);'
)
# eng-overdrive: 12% -> 18%
code = code.replace(
    'damage *= (1 + od * 0.12);\n    shieldMax *= (1 + od * 0.12);\n    speed *= (1 + od * 0.12);',
    'damage *= (1 + od * 0.18);\n    shieldMax *= (1 + od * 0.18);\n    speed *= (1 + od * 0.18);'
)
# eng-singularity: 20/15/10% -> 30/25/15%
code = code.replace(
    'damage *= 1.20;\n    fireRate *= 1.15;\n    speed *= 1.10;',
    'damage *= 1.30;\n    fireRate *= 1.25;\n    speed *= 1.15;'
)
# def-nano: 10% regen -> 15%, 5% hull -> 10%
code = code.replace(
    'shieldRegen *= (1 + sk("def-nano") * 0.10);\n  hullMax *= (1 + sk("def-nano") * 0.05);',
    'shieldRegen *= (1 + sk("def-nano") * 0.15);\n  hullMax *= (1 + sk("def-nano") * 0.10);'
)
# off-volley: 15% -> 20%
code = code.replace(
    'fireRate *= (1 + sk("off-volley") * 0.15);',
    'fireRate *= (1 + sk("off-volley") * 0.20);'
)
# def-regen: 15% -> 20%
code = code.replace(
    'shieldRegen *= (1 + sk("def-regen") * 0.15);',
    'shieldRegen *= (1 + sk("def-regen") * 0.20);'
)

print("  -> All frontend multipliers boosted")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(code)

# --- BACKEND computeStats ---
print("\n═══ Boosting backend skill multipliers ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    bcode = f.read()

bcode = bcode.replace('(1 + sk("off-power") * 0.05)', '(1 + sk("off-power") * 0.10)')
bcode = bcode.replace('(1 + sk("def-armor") * 0.08)', '(1 + sk("def-armor") * 0.15)')
bcode = bcode.replace('sk("def-shield") * 0.08 + sk("def-barrier") * 0.12', 'sk("def-shield") * 0.15 + sk("def-barrier") * 0.20')
bcode = bcode.replace('(1 + sk("ut-thrust") * 0.05)', '(1 + sk("ut-thrust") * 0.10)')
bcode = bcode.replace('sk("def-bulwark") * 0.04', 'sk("def-bulwark") * 0.08')
bcode = bcode.replace('sk("off-pierce") * 4', 'sk("off-pierce") * 6')
bcode = bcode.replace('sk("off-crit") * 0.03 +', 'sk("off-crit") * 0.05 +')
bcode = bcode.replace('(1 + sk("off-rapid") * 0.08)', '(1 + sk("off-rapid") * 0.15)')
bcode = bcode.replace('(1 + sk("off-snipe") * 0.04)', '(1 + sk("off-snipe") * 0.08)')
bcode = bcode.replace('sk("off-snipe") * 0.02', 'sk("off-snipe") * 0.04')
bcode = bcode.replace('(1 + sk("eng-coolant") * 0.10)', '(1 + sk("eng-coolant") * 0.15)')
bcode = bcode.replace('(1 + sk("eng-capacitor") * 0.06)', '(1 + sk("eng-capacitor") * 0.10)')
bcode = bcode.replace('(1 + sk("eng-capacitor") * 0.05)', '(1 + sk("eng-capacitor") * 0.10)')
bcode = bcode.replace('sk("eng-targeting") * 0.05', 'sk("eng-targeting") * 0.08')
bcode = bcode.replace('(1 + sk("eng-warp-core") * 0.08)', '(1 + sk("eng-warp-core") * 0.15)')
# overdrive
bcode = bcode.replace('(1 + od * 0.12)', '(1 + od * 0.18)')
# singularity
bcode = bcode.replace('damage *= 1.20;', 'damage *= 1.30;')
bcode = bcode.replace('fireRate *= 1.15;', 'fireRate *= 1.25;')
bcode = bcode.replace('speed *= 1.10;', 'speed *= 1.15;')
# nano
bcode = bcode.replace('(1 + sk("def-nano") * 0.10)', '(1 + sk("def-nano") * 0.15)')
bcode = bcode.replace('(1 + sk("def-nano") * 0.05)', '(1 + sk("def-nano") * 0.10)')
# volley
bcode = bcode.replace('(1 + sk("off-volley") * 0.15)', '(1 + sk("off-volley") * 0.20)')
# regen
bcode = bcode.replace('(1 + sk("def-regen") * 0.15)', '(1 + sk("def-regen") * 0.20)')

print("  -> All backend multipliers boosted (matching frontend)")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(bcode)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Update skill DESCRIPTIONS to match new values
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating skill descriptions ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    tc = f.read()

desc_replacements = {
    '"+5% laser damage per rank."': '"+10% laser damage per rank."',
    '"+4% damage & +2% crit per rank."': '"+8% damage & +4% crit per rank."',
    '"+8% fire rate per rank."': '"+15% fire rate per rank."',
    '"Fire rate burst: +15% fire rate per rank."': '"Fire rate burst: +20% fire rate per rank."',
    '"+3% crit chance per rank."': '"+5% crit chance per rank."',
    '"Shots gain splash radius (rank×4 px)."': '"Shots gain splash radius (rank×6 px)."',
    '"+8% max shield per rank."': '"+15% max shield per rank."',
    '"+12% max shield per rank."': '"+20% max shield per rank."',
    '"-10% damage taken when shield > 50%, per rank."': '"-15% damage taken when shield > 50%, per rank."',
    '"+15% shield regen per rank."': '"+20% shield regen per rank."',
    '"+10% shield regen & +5% hull per rank."': '"+15% shield regen & +10% hull per rank."',
    '"+8% max hull per rank."': '"+15% max hull per rank."',
    '"Reduce all damage taken by 4% per rank."': '"Reduce all damage taken by 8% per rank."',
    '"+5% top speed per rank."': '"+10% top speed per rank."',
    '"+10% fire rate & -heat buildup per rank."': '"+15% fire rate & -heat buildup per rank."',
    '"+6% damage & +5% shield regen per rank."': '"+10% damage & +10% shield regen per rank."',
    '"+5% crit chance & rockets track better."': '"+8% crit chance & rockets track better."',
    '"+8% speed per rank from generator overclock."': '"+15% speed per rank from generator overclock."',
    '"+12% all stats (damage, shield, speed) per rank."': '"+18% all stats (damage, shield, speed) per rank."',
    '"Endgame: +20% damage, +15% fire rate, +10% speed."': '"Endgame: +30% damage, +25% fire rate, +15% speed."',
}

for old_desc, new_desc in desc_replacements.items():
    if old_desc in tc:
        tc = tc.replace(old_desc, new_desc)

print("  -> Updated all skill descriptions")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(tc)

# ══════════════════════════════════════════════════════════════════════════════
# 3. Add stat comparison notification when allocating a skill
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding stat notification on skill allocate ═══")

with open('frontend/src/game/store.ts', 'r') as f:
    sc = f.read()

old_notify = '  pushNotification(`${node.name} → rank ${cur + 1}`, "good");'
new_notify = '  pushNotification(`${node.name} → rank ${cur + 1} (check ACTIVE STATS in Loadout)`, "good");'

if old_notify in sc:
    sc = sc.replace(old_notify, new_notify)
    print("  -> Added hint to check stats panel after allocating")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(sc)

print("\n" + "=" * 50)
print("DONE! All skill multipliers roughly DOUBLED.")
print("Examples at rank 5:")
print("  - Overcharge: +50% damage (was +25%)")
print("  - Thruster Tuning: +50% speed (was +25%)")
print("  - Rapid Fire: +75% fire rate (was +40%)")
print("  - Shield Capacitors: +75% shield (was +40%)")
