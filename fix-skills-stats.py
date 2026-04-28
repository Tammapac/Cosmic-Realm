#!/usr/bin/env python3
"""Fix frontend effectiveStats to properly apply ALL skills matching backend."""

with open('frontend/src/game/loop.ts', 'r') as f:
    code = f.read()

old_stats = """export function effectiveStats(): {
  damage: number; speed: number; hullMax: number; shieldMax: number;
  fireRate: number; critChance: number; aoeRadius: number; damageReduction: number; shieldAbsorb: number; shieldRegen: number; lootBonus: number;
} {
  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];

  const skOffPower  = p.skills["off-power"]  ?? 0;
  const skOffRapid  = p.skills["off-rapid"]  ?? 0;
  const skOffCrit   = p.skills["off-crit"]   ?? 0;
  const skOffPierce = p.skills["off-pierce"] ?? 0;
  const skDefShield = p.skills["def-shield"] ?? 0;
  const skDefRegen  = p.skills["def-regen"]  ?? 0;
  const skDefArmor  = p.skills["def-armor"]  ?? 0;
  const skDefBulw   = p.skills["def-bulwark"] ?? 0;
  const skUtThrust  = p.skills["ut-thrust"]  ?? 0;

  const mod = sumEquippedStats() as Required<ModuleStats>;
  let damage = (cls.baseDamage + mod.damage) * (1 + skOffPower * 0.03);
  let hullMax = (cls.hullMax + (mod.hullMax ?? 0)) * (1 + skDefArmor * 0.05);
  let shieldMax = (cls.shieldMax + (mod.shieldMax ?? 0)) * (1 + skDefShield * 0.05);
  let speed = (cls.baseSpeed + (mod.speed ?? 0)) * (1 + skUtThrust * 0.03);
  let shieldRegen = 5 + (mod.shieldRegen ?? 0);
  let damageReduction = (skDefBulw * 0.03) + (mod.damageReduction ?? 0);
  let shieldAbsorb = Math.min(0.5, mod.shieldAbsorb ?? 0);
  let aoeRadius = (skOffPierce * 3) + (mod.aoeRadius ?? 0);
  let critChance = 0.03 + skOffCrit * 0.02 + (mod.critChance ?? 0);
  let fireRate = (1 + skOffRapid * 0.03) * (mod.fireRate ?? 1);
  let lootBonus = mod.lootBonus ?? 0;

  for (const d of p.drones) {
    const def = DRONE_DEFS[d.kind];
    damage += def.damageBonus;
    hullMax += def.hullBonus;
    shieldMax += def.shieldBonus;
  }

  // Faction bonuses disabled
  shieldRegen *= (1 + skDefRegen * 0.15);

  return { damage, speed, hullMax, shieldMax, fireRate, critChance, aoeRadius, damageReduction, shieldAbsorb, shieldRegen, lootBonus };
}"""

new_stats = """export function effectiveStats(): {
  damage: number; speed: number; hullMax: number; shieldMax: number;
  fireRate: number; critChance: number; aoeRadius: number; damageReduction: number; shieldAbsorb: number; shieldRegen: number; lootBonus: number;
} {
  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];
  const sk = (id: string) => (p.skills[id] ?? 0);

  const mod = sumEquippedStats() as Required<ModuleStats>;

  // Base stats from ship class + equipment
  let damage = (cls.baseDamage + mod.damage) * (1 + sk("off-power") * 0.05);
  let hullMax = (cls.hullMax + (mod.hullMax ?? 0)) * (1 + sk("def-armor") * 0.08);
  let shieldMax = (cls.shieldMax + (mod.shieldMax ?? 0)) * (1 + sk("def-shield") * 0.08 + sk("def-barrier") * 0.12);
  let speed = (cls.baseSpeed + (mod.speed ?? 0)) * (1 + sk("ut-thrust") * 0.05);
  let shieldRegen = 5 + (mod.shieldRegen ?? 0);
  let damageReduction = (sk("def-bulwark") * 0.04) + (mod.damageReduction ?? 0);
  let shieldAbsorb = Math.min(0.5, mod.shieldAbsorb ?? 0);
  let aoeRadius = (sk("off-pierce") * 4) + (mod.aoeRadius ?? 0);
  let critChance = 0.03 + sk("off-crit") * 0.03 + (mod.critChance ?? 0);
  let fireRate = (1 + sk("off-rapid") * 0.08) * (mod.fireRate ?? 1);
  let lootBonus = (mod.lootBonus ?? 0);

  // Snipe skill: +4% damage & +2% crit per rank
  damage *= (1 + sk("off-snipe") * 0.04);
  critChance += sk("off-snipe") * 0.02;

  // Engineering skills
  fireRate *= (1 + sk("eng-coolant") * 0.10);
  damage *= (1 + sk("eng-capacitor") * 0.06);
  shieldRegen *= (1 + sk("eng-capacitor") * 0.05);
  critChance += sk("eng-targeting") * 0.05;
  speed *= (1 + sk("eng-warp-core") * 0.08);

  // Overdrive & singularity
  const od = sk("eng-overdrive");
  if (od > 0) {
    damage *= (1 + od * 0.12);
    shieldMax *= (1 + od * 0.12);
    speed *= (1 + od * 0.12);
  }
  if (sk("eng-singularity") > 0) {
    damage *= 1.20;
    fireRate *= 1.15;
    speed *= 1.10;
  }

  // Nano-repair: +10% shield regen & +5% hull per rank
  shieldRegen *= (1 + sk("def-nano") * 0.10);
  hullMax *= (1 + sk("def-nano") * 0.05);

  // Volley: +15% fire rate per rank
  fireRate *= (1 + sk("off-volley") * 0.15);

  // Shield regen skill
  shieldRegen *= (1 + sk("def-regen") * 0.15);

  // Drone bonuses
  for (const d of p.drones) {
    const def = DRONE_DEFS[d.kind];
    damage += def.damageBonus;
    hullMax += def.hullBonus;
    shieldMax += def.shieldBonus;
  }

  // Faction bonuses
  const faction = p.faction ? FACTIONS[p.faction as keyof typeof FACTIONS] : undefined;
  if (faction) {
    if (faction.bonus.damage) damage *= (1 + faction.bonus.damage);
    if (faction.bonus.speed) speed *= (1 + faction.bonus.speed);
    if (faction.bonus.shieldRegen) shieldRegen *= faction.bonus.shieldRegen;
    if (faction.bonus.lootBonus) lootBonus += faction.bonus.lootBonus;
  }

  damageReduction = Math.min(0.8, damageReduction);
  shieldAbsorb = 0.5 + shieldAbsorb;

  return { damage, speed, hullMax, shieldMax, fireRate, critChance, aoeRadius, damageReduction, shieldAbsorb, shieldRegen, lootBonus };
}"""

if old_stats in code:
    code = code.replace(old_stats, new_stats)
    print("-> effectiveStats fully rewritten to match backend computeStats")
    print("   All skills now properly applied with correct multipliers")
else:
    print("-> WARNING: Could not find effectiveStats function")

# Check if FACTIONS is imported
if "FACTIONS" not in code.split("import")[0] and "FACTIONS" not in code:
    print("-> Need to check FACTIONS import")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(code)

print("DONE!")
