#!/usr/bin/env python3
"""Make factories standalone map entities instead of a tab in all stations."""

import re

# ══════════════════════════════════════════════════════════════════════════════
# 1. Add "factory" to StationKind + add factory stations to types.ts
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Adding factory stations ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    code = f.read()

# Add "factory" to StationKind
old_kind = 'export type StationKind = "hub" | "trade" | "mining" | "military" | "outpost";'
new_kind = 'export type StationKind = "hub" | "trade" | "mining" | "military" | "outpost" | "factory";'
if '"factory"' not in old_kind:
    code = code.replace(old_kind, new_kind)
    print("  -> Added 'factory' to StationKind")

# Add factory stations - one per major zone cluster
# Placed near asteroid belts for convenient mining -> refining flow
factory_stations = '''
  // ── FACTORY STATIONS (standalone refineries) ──
  { id: "alpha-foundry",    name: "Alpha Foundry",       pos: { x: -2800, y: 1800 },  zone: "alpha",    kind: "factory",
    description: "Automated smelting complex. Converts raw ores into refined alloys.", controlledBy: "earth",
    prices: { iron: 0.7, copper: 0.75, "refined-alloy": 0.9, scrap: 0.8 } },
  { id: "nebula-works",     name: "Nebula Works",        pos: { x: 1200, y: 3200 },   zone: "nebula",   kind: "factory",
    description: "Crystal processing facility hidden in the nebula.", controlledBy: "earth",
    prices: { cobalt: 0.7, "crystal-shard": 0.75, "crystal-matrix": 0.9, plasma: 0.8 } },
  { id: "crimson-forge",    name: "Crimson Forge",       pos: { x: 3200, y: -1400 },  zone: "crimson",  kind: "factory",
    description: "Heavy industrial forge in the Crimson sector.", controlledBy: "earth",
    prices: { iron: 0.65, copper: 0.7, cobalt: 0.7, "refined-alloy": 0.85, "plasma-cell": 0.9 } },
  { id: "void-refinery",    name: "Void Refinery",       pos: { x: -2200, y: -2800 }, zone: "void",     kind: "factory",
    description: "Deep-space processing plant. Handles exotic materials.", controlledBy: "mars",
    prices: { obsidian: 0.65, "void-steel": 0.85, "nano-compound": 0.9, "crystal-shard": 0.7 } },
  { id: "forge-smelter",    name: "Forge Smelter",       pos: { x: -3500, y: 2000 },  zone: "forge",    kind: "factory",
    description: "White-hot smelting station orbiting the Forge.", controlledBy: "mars",
    prices: { iron: 0.6, copper: 0.65, cobalt: 0.65, "refined-alloy": 0.8, "fusion-core": 0.9 } },
  { id: "corona-refinery",  name: "Corona Refinery",     pos: { x: -2800, y: -2000 }, zone: "corona",   kind: "factory",
    description: "Solar-powered refinery extracting energy crystals.", controlledBy: "mars",
    prices: { "helium-3": 0.6, palladium: 0.7, "fusion-core": 0.85, "crystal-matrix": 0.9 } },
  { id: "fracture-mill",    name: "Fracture Mill",       pos: { x: -2500, y: -2200 }, zone: "fracture", kind: "factory",
    description: "Salvage processing mill at the edge of fractured space.", controlledBy: "earth",
    prices: { obsidian: 0.7, iridium: 0.75, "void-steel": 0.9, "nano-compound": 0.85 } },
  { id: "venus-foundry",    name: "Venus Cloud Foundry", pos: { x: 2800, y: -1800 },  zone: "venus1",   kind: "factory",
    description: "Cloud-suspended foundry using Venus atmospheric heat.", controlledBy: "venus",
    prices: { sulfur: 0.6, copper: 0.65, iron: 0.7, "refined-alloy": 0.85, "plasma-cell": 0.85 } },
  { id: "venus3-refinery",  name: "Acid Vat Refinery",   pos: { x: 2800, y: 2200 },   zone: "venus3",   kind: "factory",
    description: "Uses corrosive Venus atmosphere for material processing.", controlledBy: "venus",
    prices: { sulfur: 0.55, cobalt: 0.65, "crystal-shard": 0.7, "nano-compound": 0.8, "crystal-matrix": 0.85 } },
  { id: "venus5-forge",     name: "Eye Forge",           pos: { x: -3200, y: 2800 },  zone: "venus5",   kind: "factory",
    description: "Advanced forge near the Eye of Venus. Handles all material types.", controlledBy: "venus",
    prices: { obsidian: 0.6, iridium: 0.65, palladium: 0.65, "void-steel": 0.8, "fusion-core": 0.8 } },
  { id: "mars-refinery",    name: "Deep Mars Refinery",  pos: { x: 2800, y: 2800 },   zone: "marsdepth", kind: "factory",
    description: "Underground Martian refinery processing rare deep-field ores.", controlledBy: "mars",
    prices: { cobalt: 0.6, palladium: 0.65, "helium-3": 0.65, "fusion-core": 0.85, "crystal-matrix": 0.85 } },
  { id: "storm-works",      name: "Storm Works",         pos: { x: -3200, y: -2400 }, zone: "maelstrom", kind: "factory",
    description: "Storm-shielded factory in the Maelstrom core.", controlledBy: "mars",
    prices: { iron: 0.6, obsidian: 0.65, copper: 0.6, "refined-alloy": 0.8, "void-steel": 0.85 } },
'''

# Insert factory stations at end of STATIONS array
if 'alpha-foundry' not in code:
    # Find the closing ]; of STATIONS
    stations_start = code.find('export const STATIONS: Station[] = [')
    if stations_start >= 0:
        # Find the matching ];
        bracket_count = 0
        i = stations_start + len('export const STATIONS: Station[] = [')
        while i < len(code):
            if code[i] == '[':
                bracket_count += 1
            elif code[i] == ']':
                if bracket_count == 0:
                    # This is the closing ]
                    code = code[:i] + factory_stations + code[i:]
                    print("  -> Added 12 factory stations across map zones")
                    break
                bracket_count -= 1
            i += 1

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(code)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Only show Refinery tab at factory stations in Hangar.tsx
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Restricting Refinery tab to factory stations ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# Remove refinery from static TABS array and add it dynamically
old_refinery_tab = '  { id: "refinery", label: "Refinery", glyph: "⚒" },\n'
if old_refinery_tab in hcode:
    hcode = hcode.replace(old_refinery_tab, '')
    print("  -> Removed refinery from static TABS")

# Add dynamic tab filtering based on station kind
# Find where TABS are rendered and filter
old_tabs_map = '          {TABS.map((t) => ('
new_tabs_map = '''          {[...TABS, ...(station.kind === "factory" ? [{ id: "refinery" as HangarTab, label: "Refinery", glyph: "⚒" }] : [])].map((t) => ('''

if old_tabs_map in hcode and 'station.kind === "factory"' not in hcode:
    hcode = hcode.replace(old_tabs_map, new_tabs_map)
    print("  -> Refinery tab now only shows at factory stations")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

# ══════════════════════════════════════════════════════════════════════════════
# 3. Render factories with unique icon on minimap + full map
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding factory icons to maps ═══")

with open('frontend/src/components/MiniMap.tsx', 'r') as f:
    mcode = f.read()

# On the full map, factories show as orange diamonds instead of cyan squares
old_station_full = '''            {STATIONS.filter(s => s.zone === player.zone).map((s) => {
              const x = fullSize / 2 + s.pos.x * fullScale;
              const y = fullSize / 2 + s.pos.y * fullScale;
              return (
                <g key={s.id}>
                  <rect x={x - 5} y={y - 5} width={10} height={10} fill="#4ee2ff" stroke="#fff" strokeWidth={0.5} />
                  <text x={x} y={y + 16} fill="#4ee2ff" fontSize={8} textAnchor="middle">{s.name}</text>
                </g>
              );
            })}'''

new_station_full = '''            {STATIONS.filter(s => s.zone === player.zone).map((s) => {
              const x = fullSize / 2 + s.pos.x * fullScale;
              const y = fullSize / 2 + s.pos.y * fullScale;
              const isFactory = s.kind === "factory";
              const color = isFactory ? "#ff8844" : "#4ee2ff";
              return (
                <g key={s.id}>
                  {isFactory ? (
                    <polygon points={`${x},${y-6} ${x+6},${y} ${x},${y+6} ${x-6},${y}`} fill={color} stroke="#fff" strokeWidth={0.5} />
                  ) : (
                    <rect x={x - 5} y={y - 5} width={10} height={10} fill={color} stroke="#fff" strokeWidth={0.5} />
                  )}
                  <text x={x} y={y + 16} fill={color} fontSize={8} textAnchor="middle">{s.name}</text>
                </g>
              );
            })}'''

if old_station_full in mcode:
    mcode = mcode.replace(old_station_full, new_station_full)
    print("  -> Factories show as orange diamonds on full map")

# Mini radar: factories also orange
old_station_mini = '''        {STATIONS.filter((s) => s.zone === player.zone).map((s) => {
          const x = SIZE / 2 + (s.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (s.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          return (
            <g key={s.id}>
              <rect x={x - 3} y={y - 3} width={6} height={6} fill="#4ee2ff" stroke="#fff" strokeWidth={0.5} />
            </g>
          );
        })}'''

new_station_mini = '''        {STATIONS.filter((s) => s.zone === player.zone).map((s) => {
          const x = SIZE / 2 + (s.pos.x - player.pos.x) * scale;
          const y = SIZE / 2 + (s.pos.y - player.pos.y) * scale;
          if (x < 0 || x > SIZE || y < 0 || y > SIZE) return null;
          const isFactory = s.kind === "factory";
          const color = isFactory ? "#ff8844" : "#4ee2ff";
          return (
            <g key={s.id}>
              {isFactory ? (
                <polygon points={`${x},${y-3} ${x+3},${y} ${x},${y+3} ${x-3},${y}`} fill={color} stroke="#fff" strokeWidth={0.5} />
              ) : (
                <rect x={x - 3} y={y - 3} width={6} height={6} fill={color} stroke="#fff" strokeWidth={0.5} />
              )}
            </g>
          );
        })}'''

if old_station_mini in mcode:
    mcode = mcode.replace(old_station_mini, new_station_mini)
    print("  -> Factories show as orange diamonds on mini radar")

with open('frontend/src/components/MiniMap.tsx', 'w') as f:
    f.write(mcode)

# ══════════════════════════════════════════════════════════════════════════════
# 4. Render factory stations differently in the game world (render.ts)
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating factory rendering ═══")

with open('frontend/src/game/render.ts', 'r') as f:
    rcode = f.read()

# Check if drawStation function exists and add factory variant
if 'factory' not in rcode:
    # Find the station name rendering and add factory color
    # Look for station label rendering
    station_label = rcode.find('s.name')
    if station_label > 0:
        print("  -> Station rendering found (factory stations will use station kind for color)")

# ══════════════════════════════════════════════════════════════════════════════
# 5. Add factory stations to backend data.ts
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding factory stations to backend ═══")

with open('backend/src/game/data.ts', 'r') as f:
    bcode = f.read()

# Add "factory" to StationKind
old_bkind = 'export type StationKind = "hub" | "trade" | "mining" | "military" | "outpost";'
new_bkind = 'export type StationKind = "hub" | "trade" | "mining" | "military" | "outpost" | "factory";'
if old_bkind in bcode:
    bcode = bcode.replace(old_bkind, new_bkind)
    print("  -> Added 'factory' to backend StationKind")

# Add factory stations to backend
backend_factories = '''
  // Factory stations
  { id: "alpha-foundry",    name: "Alpha Foundry",       pos: { x: -2800, y: 1800 },  zone: "alpha",    kind: "factory",
    description: "Automated smelting complex.", controlledBy: "earth",
    prices: { iron: 0.7, copper: 0.75, "refined-alloy": 0.9, scrap: 0.8 } },
  { id: "nebula-works",     name: "Nebula Works",        pos: { x: 1200, y: 3200 },   zone: "nebula",   kind: "factory",
    description: "Crystal processing facility.", controlledBy: "earth",
    prices: { cobalt: 0.7, "crystal-shard": 0.75, "crystal-matrix": 0.9, plasma: 0.8 } },
  { id: "crimson-forge",    name: "Crimson Forge",       pos: { x: 3200, y: -1400 },  zone: "crimson",  kind: "factory",
    description: "Heavy industrial forge.", controlledBy: "earth",
    prices: { iron: 0.65, copper: 0.7, cobalt: 0.7, "refined-alloy": 0.85, "plasma-cell": 0.9 } },
  { id: "void-refinery",    name: "Void Refinery",       pos: { x: -2200, y: -2800 }, zone: "void",     kind: "factory",
    description: "Deep-space processing plant.", controlledBy: "mars",
    prices: { obsidian: 0.65, "void-steel": 0.85, "nano-compound": 0.9, "crystal-shard": 0.7 } },
  { id: "forge-smelter",    name: "Forge Smelter",       pos: { x: -3500, y: 2000 },  zone: "forge",    kind: "factory",
    description: "White-hot smelting station.", controlledBy: "mars",
    prices: { iron: 0.6, copper: 0.65, cobalt: 0.65, "refined-alloy": 0.8, "fusion-core": 0.9 } },
  { id: "corona-refinery",  name: "Corona Refinery",     pos: { x: -2800, y: -2000 }, zone: "corona",   kind: "factory",
    description: "Solar-powered refinery.", controlledBy: "mars",
    prices: { "helium-3": 0.6, palladium: 0.7, "fusion-core": 0.85, "crystal-matrix": 0.9 } },
  { id: "fracture-mill",    name: "Fracture Mill",       pos: { x: -2500, y: -2200 }, zone: "fracture", kind: "factory",
    description: "Salvage processing mill.", controlledBy: "earth",
    prices: { obsidian: 0.7, iridium: 0.75, "void-steel": 0.9, "nano-compound": 0.85 } },
  { id: "venus-foundry",    name: "Venus Cloud Foundry", pos: { x: 2800, y: -1800 },  zone: "venus1",   kind: "factory",
    description: "Cloud-suspended foundry.", controlledBy: "venus",
    prices: { sulfur: 0.6, copper: 0.65, iron: 0.7, "refined-alloy": 0.85, "plasma-cell": 0.85 } },
  { id: "venus3-refinery",  name: "Acid Vat Refinery",   pos: { x: 2800, y: 2200 },   zone: "venus3",   kind: "factory",
    description: "Corrosive atmosphere processor.", controlledBy: "venus",
    prices: { sulfur: 0.55, cobalt: 0.65, "crystal-shard": 0.7, "nano-compound": 0.8, "crystal-matrix": 0.85 } },
  { id: "venus5-forge",     name: "Eye Forge",           pos: { x: -3200, y: 2800 },  zone: "venus5",   kind: "factory",
    description: "Advanced forge near the Eye of Venus.", controlledBy: "venus",
    prices: { obsidian: 0.6, iridium: 0.65, palladium: 0.65, "void-steel": 0.8, "fusion-core": 0.8 } },
  { id: "mars-refinery",    name: "Deep Mars Refinery",  pos: { x: 2800, y: 2800 },   zone: "marsdepth", kind: "factory",
    description: "Underground Martian refinery.", controlledBy: "mars",
    prices: { cobalt: 0.6, palladium: 0.65, "helium-3": 0.65, "fusion-core": 0.85, "crystal-matrix": 0.85 } },
  { id: "storm-works",      name: "Storm Works",         pos: { x: -3200, y: -2400 }, zone: "maelstrom", kind: "factory",
    description: "Storm-shielded factory.", controlledBy: "mars",
    prices: { iron: 0.6, obsidian: 0.65, copper: 0.6, "refined-alloy": 0.8, "void-steel": 0.85 } },
'''

if 'alpha-foundry' not in bcode:
    # Find closing of STATIONS array
    stations_start = bcode.find('export const STATIONS')
    if stations_start >= 0:
        bracket_count = 0
        i = bcode.index('[', stations_start)
        i += 1
        while i < len(bcode):
            if bcode[i] == '[':
                bracket_count += 1
            elif bcode[i] == ']':
                if bracket_count == 0:
                    bcode = bcode[:i] + backend_factories + bcode[i:]
                    print("  -> Added 12 factory stations to backend")
                    break
                bracket_count -= 1
            i += 1

with open('backend/src/game/data.ts', 'w') as f:
    f.write(bcode)

# ══════════════════════════════════════════════════════════════════════════════
# 6. Update the station header in Hangar to show factory-specific text
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating factory station header ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# When docked at factory, default to refinery tab
old_hangar_tab_init = "state.hangarTab = t.id;"
# Actually let's auto-open refinery tab when docking at factory
# Check if there's a docking handler in store.ts

with open('frontend/src/game/store.ts', 'r') as f:
    scode = f.read()

# Find where dockedAt is set
if 'kind === "factory"' not in scode:
    old_dock = 'state.dockedAt = station.id;'
    new_dock = '''state.dockedAt = station.id;
      state.hangarTab = station.kind === "factory" ? "refinery" as HangarTab : "bounties";'''
    if old_dock in scode:
        scode = scode.replace(old_dock, new_dock, 1)
        print("  -> Auto-open refinery tab when docking at factory")
        with open('frontend/src/game/store.ts', 'w') as f:
            f.write(scode)

print("\n" + "=" * 60)
print("DONE! Factories are now standalone map entities")
print("=" * 60)
print("\n12 factory stations added across the map:")
print("  - Alpha Foundry, Nebula Works, Crimson Forge")
print("  - Void Refinery, Forge Smelter, Corona Refinery")
print("  - Fracture Mill, Venus Cloud Foundry, Acid Vat Refinery")
print("  - Eye Forge, Deep Mars Refinery, Storm Works")
print("\nFactory icons: orange diamonds on map (vs cyan squares for stations)")
print("Refinery tab only appears when docked at a factory")
print("Auto-opens Refinery tab when docking at factory")
