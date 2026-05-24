#!/usr/bin/env python3
"""Fix: Add missing RESOURCES entries to frontend + fix backend import."""

# ═══ Fix 1: Add new ore RESOURCES entries to frontend types.ts ═══
print("═══ Fixing frontend RESOURCES entries ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    code = f.read()

# The bio-crystal line has no space before colon
old_res = '  "bio-crystal":{ id: "bio-crystal", name: "Bio Crystal",     basePrice: 195, glyph: "◇", color: "#44ff88", description: "Living crystalline organisms. Medical and research value." },\n};'

new_res = '''  "bio-crystal":{ id: "bio-crystal", name: "Bio Crystal",     basePrice: 195, glyph: "◇", color: "#44ff88", description: "Living crystalline organisms. Medical and research value." },
  // mineable ores
  copper:          { id: "copper",          name: "Copper Ore",       basePrice: 22,  glyph: "▰", color: "#e8a050", description: "Common conductive ore. Used in wiring and circuitry." },
  cobalt:          { id: "cobalt",          name: "Cobalt Ore",       basePrice: 48,  glyph: "▰", color: "#4466cc", description: "Dense blue ore. Essential for high-strength alloys." },
  "crystal-shard": { id: "crystal-shard",   name: "Crystal Shard",    basePrice: 135, glyph: "◆", color: "#cc88ff", description: "Prismatic energy crystal. Powers advanced shield tech." },
  palladium:       { id: "palladium",       name: "Palladium",        basePrice: 210, glyph: "◈", color: "#d4e4f0", description: "Precious catalytic metal. Rare and highly sought." },
  "helium-3":      { id: "helium-3",        name: "Helium-3",         basePrice: 95,  glyph: "◎", color: "#88ddaa", description: "Fusion fuel isotope. Harvested from gas-rich nebulae." },
  iridium:         { id: "iridium",         name: "Iridium Ore",      basePrice: 380, glyph: "▣", color: "#f0e068", description: "Ultra-dense precious metal. Only found in danger zones." },
  sulfur:          { id: "sulfur",          name: "Sulfur Deposit",   basePrice: 30,  glyph: "▰", color: "#cccc44", description: "Volcanic mineral. Common near Venus cloud layers." },
  obsidian:        { id: "obsidian",        name: "Void Obsidian",    basePrice: 165, glyph: "▣", color: "#6644aa", description: "Dark glass forged in the void. Valued for hull reinforcement." },
};'''

if old_res in code:
    code = code.replace(old_res, new_res)
    print("  -> Added 8 new RESOURCES entries to frontend")
else:
    print("  -> WARNING: Could not find bio-crystal RESOURCES end")
    # Try with the closing brace on next line
    alt = '  "bio-crystal":{ id: "bio-crystal", name: "Bio Crystal",     basePrice: 195, glyph: "◇", color: "#44ff88", description: "Living crystalline organisms. Medical and research value." },'
    if alt in code:
        # Find the }; after this line
        idx = code.index(alt) + len(alt)
        rest = code[idx:]
        brace_idx = rest.index('};')
        code = code[:idx] + '''
  // mineable ores
  copper:          { id: "copper",          name: "Copper Ore",       basePrice: 22,  glyph: "▰", color: "#e8a050", description: "Common conductive ore. Used in wiring and circuitry." },
  cobalt:          { id: "cobalt",          name: "Cobalt Ore",       basePrice: 48,  glyph: "▰", color: "#4466cc", description: "Dense blue ore. Essential for high-strength alloys." },
  "crystal-shard": { id: "crystal-shard",   name: "Crystal Shard",    basePrice: 135, glyph: "◆", color: "#cc88ff", description: "Prismatic energy crystal. Powers advanced shield tech." },
  palladium:       { id: "palladium",       name: "Palladium",        basePrice: 210, glyph: "◈", color: "#d4e4f0", description: "Precious catalytic metal. Rare and highly sought." },
  "helium-3":      { id: "helium-3",        name: "Helium-3",         basePrice: 95,  glyph: "◎", color: "#88ddaa", description: "Fusion fuel isotope. Harvested from gas-rich nebulae." },
  iridium:         { id: "iridium",         name: "Iridium Ore",      basePrice: 380, glyph: "▣", color: "#f0e068", description: "Ultra-dense precious metal. Only found in danger zones." },
  sulfur:          { id: "sulfur",          name: "Sulfur Deposit",   basePrice: 30,  glyph: "▰", color: "#cccc44", description: "Volcanic mineral. Common near Venus cloud layers." },
  obsidian:        { id: "obsidian",        name: "Void Obsidian",    basePrice: 165, glyph: "▣", color: "#6644aa", description: "Dark glass forged in the void. Valued for hull reinforcement." },''' + rest[brace_idx:]
        print("  -> Added 8 new RESOURCES entries (alt pattern)")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(code)

# ═══ Fix 2: Add pickAsteroidYield to backend engine.ts import ═══
print("\n═══ Fixing backend engine.ts import ═══")

with open('backend/src/game/engine.ts', 'r') as f:
    ecode = f.read()

old_import = '''  MINING_RANGE, MINING_DPS_FACTOR,
} from "./data.js";'''

new_import = '''  MINING_RANGE, MINING_DPS_FACTOR,
  pickAsteroidYield,
} from "./data.js";'''

if old_import in ecode:
    ecode = ecode.replace(old_import, new_import)
    print("  -> Added pickAsteroidYield to backend imports")
else:
    print("  -> WARNING: Could not find import end")
    # Fallback: just check if it has pickAsteroidYield
    if 'pickAsteroidYield' not in ecode:
        ecode = ecode.replace('} from "./data.js";', 'pickAsteroidYield, } from "./data.js";')
        print("  -> Added pickAsteroidYield (fallback)")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ecode)

# Also check that pickAsteroidYield receives zoneId in engine.ts
# The asteroid creation uses zoneId which should be available in the loop
print("\n═══ Verifying engine.ts asteroid code ═══")
with open('backend/src/game/engine.ts', 'r') as f:
    check = f.read()

if 'pickAsteroidYield(zoneId)' in check:
    print("  -> asteroid creation uses pickAsteroidYield(zoneId) ✓")
else:
    print("  -> WARNING: pickAsteroidYield(zoneId) not found in engine.ts")

# Also verify the store.ts import worked
print("\n═══ Verifying store.ts import ═══")
with open('frontend/src/game/store.ts', 'r') as f:
    scheck = f.read()

if 'pickAsteroidYield' in scheck:
    print("  -> store.ts has pickAsteroidYield ✓")
else:
    print("  -> WARNING: store.ts missing pickAsteroidYield import")
    # Add it
    if 'from "./types"' in scheck:
        import_end = scheck.index('from "./types"')
        line_start = scheck.rfind('\n', 0, import_end) + 1
        import_line = scheck[line_start:scheck.index('\n', import_end)]
        if 'pickAsteroidYield' not in import_line:
            scheck = scheck.replace('} from "./types"', 'pickAsteroidYield, } from "./types"', 1)
            with open('frontend/src/game/store.ts', 'w') as f:
                f.write(scheck)
            print("  -> Fixed: added pickAsteroidYield to store.ts import")

print("\nDONE!")
