#!/usr/bin/env python3
"""Add debug logging to verify skills are applied, and add skill scan to loot bonus."""

with open('frontend/src/game/loop.ts', 'r') as f:
    code = f.read()

# Add console.log at start of effectiveStats to debug
old_start = """  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];
  const sk = (id: string) => (p.skills[id] ?? 0);

  const mod = sumEquippedStats() as Required<ModuleStats>;

  // Base stats from ship class + equipment
  let damage = (cls.baseDamage + mod.damage) * (1 + sk("off-power") * 0.05);"""

new_start = """  const p = state.player;
  const cls = SHIP_CLASSES[p.shipClass];
  const sk = (id: string) => (p.skills[id] ?? 0);

  const mod = sumEquippedStats() as Required<ModuleStats>;

  // Log skills once every 5 seconds for debugging
  if (!((window as any).__lastSkillLog) || Date.now() - (window as any).__lastSkillLog > 5000) {
    (window as any).__lastSkillLog = Date.now();
    const allocated = Object.entries(p.skills).filter(([_, v]) => (v as number) > 0);
    if (allocated.length > 0) {
      console.log("[SKILLS]", JSON.stringify(p.skills), "pts:", p.skillPoints, "base spd:", cls.baseSpeed, "base dmg:", cls.baseDamage);
    }
  }

  // Base stats from ship class + equipment
  let damage = (cls.baseDamage + mod.damage) * (1 + sk("off-power") * 0.05);"""

if old_start in code:
    code = code.replace(old_start, new_start)
    print("-> Added debug logging to effectiveStats")
else:
    print("-> WARNING: Could not find effectiveStats start")

# Also add ut-scan loot bonus skill
old_loot = "  let lootBonus = (mod.lootBonus ?? 0);"
new_loot = "  let lootBonus = (mod.lootBonus ?? 0) + sk(\"ut-scan\") * 0.08;"
if old_loot in code:
    code = code.replace(old_loot, new_loot)
    print("-> Added ut-scan loot bonus skill")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(code)

# Also add debug to backend computeStats
with open('backend/src/game/engine.ts', 'r') as f:
    bcode = f.read()

old_bstart = """  const mod = sumEquippedStats(playerData.inventory, playerData.equipped);
  const sk = (id: SkillId) => (playerData.skills?.[id] ?? 0) as number;

  let damage = (cls.baseDamage + (mod.damage ?? 0)) * (1 + sk("off-power") * 0.05);"""

new_bstart = """  const mod = sumEquippedStats(playerData.inventory, playerData.equipped);
  const sk = (id: SkillId) => (playerData.skills?.[id] ?? 0) as number;

  // Debug: log when skills are non-empty
  const skillEntries = Object.entries(playerData.skills || {}).filter(([_, v]) => (v as number) > 0);
  if (skillEntries.length > 0) {
    console.log("[SERVER SKILLS]", JSON.stringify(playerData.skills));
  }

  let damage = (cls.baseDamage + (mod.damage ?? 0)) * (1 + sk("off-power") * 0.05);"""

if old_bstart in bcode:
    bcode = bcode.replace(old_bstart, new_bstart)
    print("-> Added debug logging to backend computeStats")
else:
    print("-> WARNING: Could not find backend computeStats start")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(bcode)

print("DONE!")
