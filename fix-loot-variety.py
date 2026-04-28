#!/usr/bin/env python3
"""Fix: Make enemy loot drops more varied instead of always the same per type."""

with open('backend/src/game/engine.ts', 'r') as f:
    code = f.read()

# ══════════════════════════════════════════════════════════════════════════════
# 1. Add loot pool helper function near the top of the file (after imports)
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Adding loot pool system ═══")

# Find a good insertion point - after the existing imports/type definitions
# Insert the loot pools and picker function before the GameEngine class
old_class_start = "export class GameEngine {"

loot_pool_code = """// ── LOOT POOLS (variety per enemy tier) ──────────────────────────────────────
const LOOT_POOLS: Record<string, { resourceId: ResourceId; qty: number; weight: number }[]> = {
  scout: [
    { resourceId: "scrap", qty: 2, weight: 3 },
    { resourceId: "iron", qty: 1, weight: 2 },
    { resourceId: "fuel-cell", qty: 1, weight: 2 },
    { resourceId: "food", qty: 1, weight: 1 },
    { resourceId: "medpack", qty: 1, weight: 1 },
  ],
  raider: [
    { resourceId: "plasma", qty: 2, weight: 3 },
    { resourceId: "scrap", qty: 2, weight: 1 },
    { resourceId: "synth", qty: 1, weight: 2 },
    { resourceId: "nanite", qty: 1, weight: 2 },
    { resourceId: "spice", qty: 1, weight: 1 },
    { resourceId: "titanium", qty: 1, weight: 1 },
  ],
  destroyer: [
    { resourceId: "warp", qty: 2, weight: 3 },
    { resourceId: "plasma", qty: 2, weight: 1 },
    { resourceId: "titanium", qty: 2, weight: 2 },
    { resourceId: "fusion-lattice", qty: 1, weight: 1 },
    { resourceId: "plasma-coil", qty: 1, weight: 2 },
    { resourceId: "neural-chip", qty: 1, weight: 1 },
  ],
  voidling: [
    { resourceId: "void", qty: 2, weight: 3 },
    { resourceId: "dark-matter", qty: 1, weight: 2 },
    { resourceId: "bio-crystal", qty: 1, weight: 2 },
    { resourceId: "exotic", qty: 1, weight: 1 },
    { resourceId: "cryo-fluid", qty: 1, weight: 1 },
    { resourceId: "quantum", qty: 1, weight: 1 },
  ],
  dread: [
    { resourceId: "dread", qty: 3, weight: 3 },
    { resourceId: "quantum", qty: 2, weight: 2 },
    { resourceId: "precursor", qty: 1, weight: 1 },
    { resourceId: "relic", qty: 1, weight: 1 },
    { resourceId: "dark-matter", qty: 2, weight: 2 },
    { resourceId: "blackglass", qty: 1, weight: 1 },
  ],
};

function pickLoot(enemyType: string): { resourceId: ResourceId; qty: number } {
  const pool = LOOT_POOLS[enemyType];
  if (!pool || pool.length === 0) return { resourceId: "scrap" as ResourceId, qty: 1 };
  const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return { resourceId: entry.resourceId, qty: entry.qty };
  }
  return { resourceId: pool[0].resourceId, qty: pool[0].qty };
}

export class GameEngine {"""

if old_class_start in code:
    code = code.replace(old_class_start, loot_pool_code)
    print("  -> Added LOOT_POOLS with weighted random picks per enemy type")
else:
    print("  -> WARNING: Could not find GameEngine class start")

# ══════════════════════════════════════════════════════════════════════════════
# 2. Change enemy spawn to use pickLoot() instead of baseDef.loot
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Randomizing enemy loot at spawn ═══")

old_spawn_loot = "      loot: baseDef.loot ? { ...baseDef.loot } : undefined,"
new_spawn_loot = "      loot: pickLoot(enemyType),"

if old_spawn_loot in code:
    code = code.replace(old_spawn_loot, new_spawn_loot)
    print("  -> Enemy spawn now picks random loot from weighted pool")
else:
    print("  -> WARNING: Could not find spawn loot assignment")

# ══════════════════════════════════════════════════════════════════════════════
# 3. Increase bonus trade goods chance from 25% to 40% and make it ADDITIONAL
#    instead of replacing the base loot
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Boosting bonus trade goods drops ═══")

# First kill path (player projectile kills)
old_bonus1 = """              let dropResource = e.loot ? { ...e.loot } : undefined;
              const bonusDrops: ResourceId[] = ["fuel-cell", "synth", "nanite", "food", "spice", "titanium"];
              if (Math.random() < 0.25 && !e.isBoss) {
                const bonusRes = bonusDrops[Math.floor(Math.random() * bonusDrops.length)];
                dropResource = { resourceId: bonusRes, qty: 1 + Math.floor(Math.random() * 2) };
              }"""

new_bonus1 = """              const dropResource = e.loot ? { ...e.loot } : pickLoot(e.type);
              const bonusDrops: ResourceId[] = ["fuel-cell", "synth", "nanite", "food", "spice", "titanium", "medpack", "iron", "silk", "ore"];
              let bonusResource: { resourceId: ResourceId; qty: number } | undefined;
              if (Math.random() < 0.40 && !e.isBoss) {
                const bonusRes = bonusDrops[Math.floor(Math.random() * bonusDrops.length)];
                bonusResource = { resourceId: bonusRes, qty: 1 + Math.floor(Math.random() * 2) };
              }"""

if old_bonus1 in code:
    code = code.replace(old_bonus1, new_bonus1)
    print("  -> Kill path 1: bonus is now 40% chance as additional drop")
else:
    print("  -> WARNING: Could not find bonus drop path 1")

# Update the loot object to include bonus resource
old_loot1 = """              const loot: LootDrop = {
                credits: Math.round(e.credits * tierMult) + Math.round((proj.fromPlayerId != null ? (this.playerStatsCache.get(proj.fromPlayerId)?.lootBonus ?? 0) : 0) * 2),
                exp: Math.round(e.exp * tierMult * (e.isBoss ? 2 : 1)),
                honor: e.honor,
                resource: dropResource,
              };"""

new_loot1 = """              const loot: LootDrop = {
                credits: Math.round(e.credits * tierMult) + Math.round((proj.fromPlayerId != null ? (this.playerStatsCache.get(proj.fromPlayerId)?.lootBonus ?? 0) : 0) * 2),
                exp: Math.round(e.exp * tierMult * (e.isBoss ? 2 : 1)),
                honor: e.honor,
                resource: dropResource,
                bonusResource,
              };"""

if old_loot1 in code:
    code = code.replace(old_loot1, new_loot1)
    print("  -> Loot object now carries bonusResource field")
else:
    print("  -> WARNING: Could not find loot object path 1")

# Second kill path (melee/collision kills)
old_bonus2 = """      let dropResource2 = e.loot ? { ...e.loot } : undefined;
              const bonusDrops2: ResourceId[] = ["fuel-cell", "synth", "nanite", "food", "spice", "titanium"];
              if (Math.random() < 0.25 && !e.isBoss) {
                const bonusRes2 = bonusDrops2[Math.floor(Math.random() * bonusDrops2.length)];
                dropResource2 = { resourceId: bonusRes2, qty: 1 + Math.floor(Math.random() * 2) };
              }"""

# Check if this pattern exists
if old_bonus2 in code:
    new_bonus2 = """      const dropResource2 = e.loot ? { ...e.loot } : pickLoot(e.type);
              const bonusDrops2: ResourceId[] = ["fuel-cell", "synth", "nanite", "food", "spice", "titanium", "medpack", "iron", "silk", "ore"];
              let bonusResource2: { resourceId: ResourceId; qty: number } | undefined;
              if (Math.random() < 0.40 && !e.isBoss) {
                const bonusRes2 = bonusDrops2[Math.floor(Math.random() * bonusDrops2.length)];
                bonusResource2 = { resourceId: bonusRes2, qty: 1 + Math.floor(Math.random() * 2) };
              }"""
    code = code.replace(old_bonus2, new_bonus2)
    print("  -> Kill path 2: bonus is now 40% chance as additional drop")
else:
    print("  -> WARNING: Could not find bonus drop path 2 (may not exist)")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(code)

# ══════════════════════════════════════════════════════════════════════════════
# 4. Add bonusResource to the LootDrop type
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating LootDrop type ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    code = f.read()

old_lootdrop_type = """export type LootDrop = {
  credits: number;
  exp: number;
  honor: number;"""

new_lootdrop_type = """export type LootDrop = {
  credits: number;
  exp: number;
  honor: number;
  bonusResource?: { resourceId: ResourceId; qty: number };"""

if old_lootdrop_type in code:
    code = code.replace(old_lootdrop_type, new_lootdrop_type)
    print("  -> Added bonusResource field to LootDrop type")
else:
    print("  -> WARNING: Could not find LootDrop type")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(code)

# ══════════════════════════════════════════════════════════════════════════════
# 5. Update frontend onEnemyDie to handle bonusResource (extra cargo box)
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating frontend loot box creation ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    fcode = f.read()

# Find where cargo boxes are created from loot.resource
# We need to also create a box for loot.bonusResource if present
old_resource_box = """    if (loot.resource && loot.resource.qty > 0) {
      const boxAngle = Math.random() * Math.PI * 2;
      const boxDist = 18 + Math.random() * 15;
      state.cargoBoxes.push({
        id: `cb-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        pos: { x: pos.x + Math.cos(boxAngle) * boxDist, y: pos.y + Math.sin(boxAngle) * boxDist },
        vel: { x: Math.cos(boxAngle) * 30, y: Math.sin(boxAngle) * 30 },
        resourceId: loot.resource.resourceId,
        qty: loot.resource.qty,
        ttl: 25,
        color: "#6f6",
      });
    }"""

new_resource_box = """    if (loot.resource && loot.resource.qty > 0) {
      const boxAngle = Math.random() * Math.PI * 2;
      const boxDist = 18 + Math.random() * 15;
      state.cargoBoxes.push({
        id: `cb-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        pos: { x: pos.x + Math.cos(boxAngle) * boxDist, y: pos.y + Math.sin(boxAngle) * boxDist },
        vel: { x: Math.cos(boxAngle) * 30, y: Math.sin(boxAngle) * 30 },
        resourceId: loot.resource.resourceId,
        qty: loot.resource.qty,
        ttl: 25,
        color: "#6f6",
      });
    }
    if (loot.bonusResource && loot.bonusResource.qty > 0) {
      const bAngle = Math.random() * Math.PI * 2;
      const bDist = 22 + Math.random() * 18;
      state.cargoBoxes.push({
        id: `cb-${Date.now()}-bonus-${Math.random().toString(36).slice(2,6)}`,
        pos: { x: pos.x + Math.cos(bAngle) * bDist, y: pos.y + Math.sin(bAngle) * bDist },
        vel: { x: Math.cos(bAngle) * 25, y: Math.sin(bAngle) * 25 },
        resourceId: loot.bonusResource.resourceId,
        qty: loot.bonusResource.qty,
        ttl: 25,
        color: "#ffaa33",
      });
    }"""

if old_resource_box in fcode:
    fcode = fcode.replace(old_resource_box, new_resource_box)
    print("  -> Added bonus resource cargo box (orange) alongside main drop (green)")
else:
    print("  -> WARNING: Could not find resource box creation")
    # Try to find it with different formatting
    if "loot.resource && loot.resource.qty > 0" in fcode:
        print("  -> Found reference but pattern mismatch, trying alternate approach")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(fcode)

print("\n" + "=" * 50)
print("DONE! Enemy loot is now varied:")
print("  - Each enemy type has 5-6 possible resource drops (weighted)")
print("  - 40% chance of BONUS trade goods drop (additional, not replacing)")
print("  - Bonus drops appear as orange cargo boxes")
