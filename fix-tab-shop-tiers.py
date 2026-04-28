#!/usr/bin/env python3
"""Fix: TAB targeting, low-tier weapons, shop display."""

# ── FIX 1: TAB targeting - Enemy type has no 'zone' property ──
print("FIX 1: Fix TAB targeting...")
with open('frontend/src/App.tsx', 'r') as f:
    ac = f.read()

# Remove the zone filter that doesn't work (enemies don't have a zone property)
ac = ac.replace(
    "const enemies = state.enemies.filter(en => en.hull > 0 && en.zone === p.zone);",
    "const enemies = state.enemies.filter(en => en.hull > 0);"
)
print("  -> Removed invalid zone filter from TAB targeting")

# Also add asteroid targeting with TAB - if no enemies, target nearest asteroid
old_tab_end = '''          }
        }
        bump();
      } else if (e.key === "1") {'''

new_tab_end = '''          } else {
            // No enemies - try targeting nearest asteroid
            const asteroids = state.asteroids.filter((a: any) => a.zone === p.zone && a.hp > 0);
            if (asteroids.length > 0) {
              asteroids.sort((a: any, b: any) => {
                const da = Math.hypot(a.pos.x - p.pos.x, a.pos.y - p.pos.y);
                const db = Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
                return da - db;
              });
              const ast = asteroids[0];
              state.miningTargetId = ast.id;
              state.selectedWorldTarget = {
                kind: "asteroid",
                id: ast.id,
                name: ast.yields === "lumenite" ? "LUMENITE ROCK" : "ORE ROCK",
                detail: ast.yields.toUpperCase() + " · " + Math.round(ast.hp) + "/" + Math.round(ast.hpMax) + " HP",
              };
              state.isLaserFiring = false;
              state.isAttacking = false;
            }
          }
        }
        bump();
      } else if (e.key === "1") {'''

if old_tab_end in ac:
    ac = ac.replace(old_tab_end, new_tab_end)
    print("  -> Added asteroid fallback for TAB when no enemies nearby")
else:
    print("  -> WARNING: Could not find TAB end block")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(ac)

# ── FIX 2: Add Tier 1 weapons for all patterns ──
print("\nFIX 2: Adding Tier 1 weapons...")
with open('frontend/src/game/types.ts', 'r') as f:
    tc = f.read()

tier1_weapons = '''
  // ── TIER 1 STARTER VARIANTS ─────────────────────────────────────────────
  "wp-sniper-0":  { id: "wp-sniper-0",  slot: "weapon", weaponKind: "laser",  firingPattern: "sniper",  name: "Focus Beam",           description: "Entry-level beam weapon. One shot, big hit.",             rarity: "common",    color: "#aaddff", glyph: "\\u2014", tier: 1, price: 4000,   stats: { damage: 8,  fireRate: 0.6 } },
  "wp-scatter-0": { id: "wp-scatter-0", slot: "weapon", weaponKind: "laser",  firingPattern: "scatter", name: "Pellet Blaster",        description: "Basic shotgun laser. Short range, wide spread.",          rarity: "common",    color: "#7ad8ff", glyph: "\\u22d9", tier: 1, price: 4500,   stats: { damage: 5,  fireRate: 1.1, aoeRadius: 6 } },
  "wp-rail-0":    { id: "wp-rail-0",    slot: "weapon", weaponKind: "laser",  firingPattern: "rail",    name: "Tri-Shot",              description: "Entry burst cannon. 3 quick shots per trigger.",          rarity: "common",    color: "#ffaa44", glyph: "\\u2261", tier: 1, price: 4200,   stats: { damage: 5,  fireRate: 0.95 } },

'''

# Insert before the existing pulse laser definitions
tc = tc.replace(
    '  "wp-pulse-1":',
    tier1_weapons + '  "wp-pulse-1":'
)
print("  -> Added 3 Tier 1 weapons: Focus Beam (sniper), Pellet Blaster (scatter), Tri-Shot (rail)")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(tc)

# ── FIX 3: Improve shop to show more items including all weapon types ──
print("\nFIX 3: Improving station shop display...")
with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hc = f.read()

# The shop only shows first 8 items. Change to show more and ensure variety
old_shop = '''  const shopPool = Object.values(MODULE_DEFS).filter((d) => d.tier <= Math.min(5, Math.max(1, Math.ceil(player.level / 4))));
  const shopOffer = shopPool.slice(0, 8); // simple: show first 8 affordable ones'''

new_shop = '''  const tierCap2 = Math.min(5, Math.max(1, Math.ceil(player.level / 4)));
  const shopPool = Object.values(MODULE_DEFS).filter((d) => d.tier <= tierCap2);
  // Show all available weapons + generators + modules (no arbitrary limit)
  const shopOffer = shopPool;'''

if old_shop in hc:
    hc = hc.replace(old_shop, new_shop)
    print("  -> Shop now shows ALL available items for player's tier (was limited to 8)")
else:
    print("  -> WARNING: Could not find shop pool code")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hc)

print("\nAll fixes applied!")
