#!/usr/bin/env python3
"""Fix backend data.ts - factory stations were inserted in wrong place."""

with open('backend/src/game/data.ts', 'r') as f:
    code = f.read()

# Step 1: Remove the misplaced factory stations from the type definition
# They got inserted between }[ breaking the type syntax
marker_start = '  // Factory stations\n  { id: "alpha-foundry"'
marker_end = 'prices: { iron: 0.6, obsidian: 0.65, copper: 0.6, "refined-alloy": 0.8, "void-steel": 0.85 } },'

# Find the first occurrence of the factory block (the misplaced one)
idx_start = code.find(marker_start)
if idx_start >= 0:
    idx_end = code.find(marker_end, idx_start)
    if idx_end >= 0:
        idx_end = code.index('\n', idx_end) + 1
        removed_block = code[idx_start:idx_end]
        code = code[:idx_start] + code[idx_end:]
        print(f"  -> Removed {removed_block.count(chr(10))} lines of misplaced factory stations")

# Step 2: Fix the type definition syntax
# After removal, }[ should become }[] = [
# The original was: }[] = [ but the script replaced }[] = [ with }[ by inserting at ]
if '}[\n' in code:
    # Check context
    idx = code.find('}[\n')
    before = code[max(0,idx-100):idx]
    if 'controlledBy' in before or 'prices' in before:
        code = code[:idx] + '}[] = [\n' + code[idx+3:]
        print("  -> Fixed type definition syntax (}[ -> }[] = [)")

# Step 3: Check if factory stations already exist in correct place (after abyss-gate)
if 'alpha-foundry' not in code:
    # Add them before the ]; that closes STATIONS array
    # Find the last station entry (abyss-gate)
    abyss_idx = code.find('"abyss-gate"')
    if abyss_idx >= 0:
        # Find the next ]; after abyss-gate
        closing_idx = code.index('];', abyss_idx)
        factory_block = '''
  // Factory stations
  { id: "alpha-foundry",    name: "Alpha Foundry",       pos: { x: -2800, y: 1800 },  zone: "alpha",    kind: "factory",
    controlledBy: "earth",
    prices: { iron: 0.7, copper: 0.75, "refined-alloy": 0.9, scrap: 0.8 } },
  { id: "nebula-works",     name: "Nebula Works",        pos: { x: 1200, y: 3200 },   zone: "nebula",   kind: "factory",
    controlledBy: "earth",
    prices: { cobalt: 0.7, "crystal-shard": 0.75, "crystal-matrix": 0.9, plasma: 0.8 } },
  { id: "crimson-forge",    name: "Crimson Forge",       pos: { x: 3200, y: -1400 },  zone: "crimson",  kind: "factory",
    controlledBy: "earth",
    prices: { iron: 0.65, copper: 0.7, cobalt: 0.7, "refined-alloy": 0.85, "plasma-cell": 0.9 } },
  { id: "void-refinery",    name: "Void Refinery",       pos: { x: -2200, y: -2800 }, zone: "void",     kind: "factory",
    controlledBy: "mars",
    prices: { obsidian: 0.65, "void-steel": 0.85, "nano-compound": 0.9, "crystal-shard": 0.7 } },
  { id: "forge-smelter",    name: "Forge Smelter",       pos: { x: -3500, y: 2000 },  zone: "forge",    kind: "factory",
    controlledBy: "mars",
    prices: { iron: 0.6, copper: 0.65, cobalt: 0.65, "refined-alloy": 0.8, "fusion-core": 0.9 } },
  { id: "corona-refinery",  name: "Corona Refinery",     pos: { x: -2800, y: -2000 }, zone: "corona",   kind: "factory",
    controlledBy: "mars",
    prices: { "helium-3": 0.6, palladium: 0.7, "fusion-core": 0.85, "crystal-matrix": 0.9 } },
  { id: "fracture-mill",    name: "Fracture Mill",       pos: { x: -2500, y: -2200 }, zone: "fracture", kind: "factory",
    controlledBy: "earth",
    prices: { obsidian: 0.7, iridium: 0.75, "void-steel": 0.9, "nano-compound": 0.85 } },
  { id: "venus-foundry",    name: "Venus Cloud Foundry", pos: { x: 2800, y: -1800 },  zone: "venus1",   kind: "factory",
    controlledBy: "venus",
    prices: { sulfur: 0.6, copper: 0.65, iron: 0.7, "refined-alloy": 0.85, "plasma-cell": 0.85 } },
  { id: "venus3-refinery",  name: "Acid Vat Refinery",   pos: { x: 2800, y: 2200 },   zone: "venus3",   kind: "factory",
    controlledBy: "venus",
    prices: { sulfur: 0.55, cobalt: 0.65, "crystal-shard": 0.7, "nano-compound": 0.8, "crystal-matrix": 0.85 } },
  { id: "venus5-forge",     name: "Eye Forge",           pos: { x: -3200, y: 2800 },  zone: "venus5",   kind: "factory",
    controlledBy: "venus",
    prices: { obsidian: 0.6, iridium: 0.65, palladium: 0.65, "void-steel": 0.8, "fusion-core": 0.8 } },
  { id: "mars-refinery",    name: "Deep Mars Refinery",  pos: { x: 2800, y: 2800 },   zone: "marsdepth", kind: "factory",
    controlledBy: "mars",
    prices: { cobalt: 0.6, palladium: 0.65, "helium-3": 0.65, "fusion-core": 0.85, "crystal-matrix": 0.85 } },
  { id: "storm-works",      name: "Storm Works",         pos: { x: -3200, y: -2400 }, zone: "maelstrom", kind: "factory",
    controlledBy: "mars",
    prices: { iron: 0.6, obsidian: 0.65, copper: 0.6, "refined-alloy": 0.8, "void-steel": 0.85 } },
'''
        code = code[:closing_idx] + factory_block + code[closing_idx:]
        print("  -> Added factory stations before STATIONS ];")

with open('backend/src/game/data.ts', 'w') as f:
    f.write(code)

print("DONE!")
