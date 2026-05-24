#!/usr/bin/env python3
"""Fix cargo HUD (J key popup) + improve BEST SELL + remove cargo tab from station."""

import re

# ══════════════════════════════════════════════════════════════════════════════
# 1. Add showCargo state to store.ts
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Adding showCargo state ═══")

with open('frontend/src/game/store.ts', 'r') as f:
    code = f.read()

# Add showCargo to GameState type
old_state_type = '  showMissions: boolean;'
new_state_type = '  showMissions: boolean;\n  showCargo: boolean;'
if old_state_type in code and 'showCargo' not in code:
    code = code.replace(old_state_type, new_state_type)
    print("  -> Added showCargo to GameState type")

# Add showCargo initial value
old_state_init = '  showMap: false,'
new_state_init = '  showMap: false,\n  showCargo: false,'
if 'showCargo: false' not in code:
    code = code.replace(old_state_init, new_state_init)
    print("  -> Added showCargo initial value")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(code)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Add J keybinding in App.tsx + CargoOverlay component
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding J keybinding + CargoOverlay ═══")

with open('frontend/src/App.tsx', 'r') as f:
    acode = f.read()

# Add stationPrice import
if 'stationPrice' not in acode:
    acode = acode.replace(
        'from "./game/store";',
        'stationPrice, } from "./game/store";'.replace('stationPrice, }', 'stationPrice,').rstrip(),
        1
    )
    # Better approach - add to the existing import
    old_store_import = 'collectCargoBox, enterDungeon'
    if old_store_import in acode:
        acode = acode.replace(old_store_import, old_store_import + ', stationPrice')
        print("  -> Added stationPrice import to App.tsx")

# Add J key handler
old_h_key = '''      } else if (e.key === "h" || e.key === "H") {
        state.showSocial = !state.showSocial; bump();'''

new_h_key = '''      } else if (e.key === "h" || e.key === "H") {
        state.showSocial = !state.showSocial; bump();
      } else if (e.key === "j" || e.key === "J") {
        state.showCargo = !state.showCargo; bump();'''

if old_h_key in acode:
    acode = acode.replace(old_h_key, new_h_key)
    print("  -> Added J keybinding for cargo")
else:
    print("  -> WARNING: Could not find H key handler")

# Also close cargo on Escape
old_escape = '''        state.showFullZoneMap = false;
        bump();'''
new_escape = '''        state.showFullZoneMap = false;
        state.showCargo = false;
        bump();'''
if old_escape in acode and 'showCargo = false' not in acode.split('Escape')[1][:200]:
    acode = acode.replace(old_escape, new_escape, 1)
    print("  -> Added cargo close on Escape")

# Add CargoOverlay component + render it
cargo_overlay = '''
function CargoOverlay() {
  const showCargo = useGame((s) => s.showCargo);
  const player = useGame((s) => s.player);
  if (!showCargo) return null;

  const used = player.cargo.reduce((a: number, c: any) => a + c.qty, 0);
  const cls = SHIP_CLASSES[player.shipClass];
  const maxCargo = cls.cargoMax;
  const nearStation = STATIONS.find(s => s.zone === player.zone);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) { state.showCargo = false; bump(); } }}
    >
      <div className="panel" style={{ width: 420, maxHeight: "70vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border-soft)" }}>
          <div>
            <div className="text-cyan tracking-widest text-sm font-bold">CARGO HOLD</div>
            <div className="text-mute text-[13px]">{used}/{maxCargo} units · Total value: {player.cargo.reduce((s: number, c: any) => s + ((RESOURCES as any)[c.resourceId]?.basePrice ?? 0) * c.qty, 0).toLocaleString()}cr</div>
          </div>
          <button
            className="text-mute hover:text-bright text-xl px-2"
            onClick={() => { state.showCargo = false; bump(); }}
          >x</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {player.cargo.length === 0 && (
            <div className="text-mute text-sm italic text-center py-8">
              Cargo bay empty. Mine asteroids or buy goods at a station.
            </div>
          )}
          {player.cargo.map((c: any) => {
            const r = (RESOURCES as any)[c.resourceId];
            if (!r) return null;
            return (
              <div key={c.resourceId} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: "var(--border-soft)" }}>
                <div
                  className="flex items-center justify-center"
                  style={{ width: 32, height: 32, background: r.color + "22", border: "1px solid " + r.color, color: r.color, fontSize: 16 }}
                >{r.glyph}</div>
                <div className="flex-1">
                  <div className="text-bright text-[13px] font-bold">{r.name}</div>
                  <div className="text-mute text-[12px]">{r.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-cyan font-bold tabular-nums">x{c.qty}</div>
                  <div className="text-amber text-[12px] tabular-nums">{(c.qty * r.basePrice).toLocaleString()}cr</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t text-center text-mute text-[12px]" style={{ borderColor: "var(--border-soft)" }}>
          Press J to close · Dock at a station to sell
        </div>
      </div>
    </div>
  );
}
'''

# Insert CargoOverlay before the GameApp function or at the end before export
# Find a good insertion point - before function GameApp or similar
if 'function CargoOverlay' not in acode:
    # Insert before the last component definition area
    insert_point = acode.rfind('\nfunction GameApp')
    if insert_point == -1:
        insert_point = acode.rfind('\nexport default')
    if insert_point > 0:
        acode = acode[:insert_point] + cargo_overlay + acode[insert_point:]
        print("  -> Added CargoOverlay component")
    else:
        print("  -> WARNING: Could not find insertion point for CargoOverlay")

# Add SHIP_CLASSES import if not present
if 'SHIP_CLASSES' not in acode.split('from "./game/types"')[0]:
    # SHIP_CLASSES might not be imported
    pass  # It's likely already there from other code

# Render CargoOverlay in the JSX
old_idle = '      <IdleRewardModal />'
new_idle = '      <CargoOverlay />\n      <IdleRewardModal />'
if 'CargoOverlay' not in acode.split('return')[1] if 'return' in acode else '':
    if old_idle in acode:
        acode = acode.replace(old_idle, new_idle, 1)
        print("  -> Added CargoOverlay to render tree")

# Add SHIP_CLASSES to types import if needed
if 'SHIP_CLASSES' not in acode:
    old_types_import = 'DUNGEONS, STATIONS, PORTALS, ZONES, MODULE_DEFS, RESOURCES'
    new_types_import = 'DUNGEONS, STATIONS, PORTALS, ZONES, MODULE_DEFS, RESOURCES, SHIP_CLASSES'
    if old_types_import in acode:
        acode = acode.replace(old_types_import, new_types_import)
        print("  -> Added SHIP_CLASSES import")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(acode)

# ══════════════════════════════════════════════════════════════════════════════
# 3. Revert TopBar CargoStat back to simple stat (remove expandable)
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Reverting TopBar cargo to simple stat ═══")

with open('frontend/src/components/TopBar.tsx', 'r') as f:
    tcode = f.read()

# Replace CargoStat usage with simple Stat
old_cargo_use = '        <CargoStat used={cargoUsed} max={cargoCapacity()} cargo={player.cargo} />'
new_cargo_use = '        <Stat label="CARGO [J]" value={`${cargoUsed}/${cargoCapacity()}`} color="#4ee2ff" />'

if old_cargo_use in tcode:
    tcode = tcode.replace(old_cargo_use, new_cargo_use)
    print("  -> Reverted to simple cargo stat with [J] hint")

# Remove the CargoStat component definition (everything from "function CargoStat" to "function Stat")
if 'function CargoStat' in tcode:
    start = tcode.index('function CargoStat')
    end = tcode.index('\nfunction Stat')
    tcode = tcode[:start] + tcode[end+1:]
    print("  -> Removed CargoStat component")

# Remove unused useState import if only CargoStat used it
# Actually keep it in case other components use it
# Remove the useState import line if it's standalone
if 'useState' in tcode:
    # Check if useState is actually used elsewhere
    uses = tcode.count('useState')
    if uses == 1:  # Only the import
        tcode = tcode.replace('import { useState } from "react";\n', '')
        print("  -> Removed unused useState import")

with open('frontend/src/components/TopBar.tsx', 'w') as f:
    f.write(tcode)

# ══════════════════════════════════════════════════════════════════════════════
# 4. Remove cargo tab from Hangar station tabs
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Removing cargo tab from station ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# Remove cargo tab from TABS array
old_tabs = '''  { id: "cargo",    label: "Cargo",    glyph: "▤" },
  { id: "repair",   label: "Services", glyph: "✚" },'''

new_tabs = '''  { id: "repair",   label: "Services", glyph: "✚" },'''

if old_tabs in hcode:
    hcode = hcode.replace(old_tabs, new_tabs)
    print("  -> Removed cargo tab from station tabs")
else:
    print("  -> WARNING: Could not find cargo tab entry")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

# ══════════════════════════════════════════════════════════════════════════════
# 5. Improve BEST SELL column to show station name + zone
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Improving BEST SELL column ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# Add ZONES import if not present
if 'ZONES' not in hcode.split('from "../game/types"')[0]:
    old_zones = 'STATIONS, ShipClassId'
    if old_zones in hcode:
        hcode = hcode.replace(old_zones, 'STATIONS, ShipClassId, ZONES')

# Update the BEST SELL display to show station name
old_best_sell = '''                  <div className="text-center text-[11px] tabular-nums" title={bestStation ? `Sell at ${bestStation.name} for ${bestStation.price}cr` : ""}>
                    {bestStation && profitVsHere > 0 ? (
                      <span style={{ color: "#5cff8a" }}>+{profitVsHere}cr</span>
                    ) : (
                      <span className="text-mute">best here</span>
                    )}
                  </div>'''

new_best_sell = '''                  <div className="text-center text-[11px]" title={bestStation ? `${bestStation.name} (${(ZONES as any)[bestStation.zone]?.name ?? bestStation.zone}) pays ${bestStation.price}cr` : ""}>
                    {bestStation && profitVsHere > 0 ? (
                      <div>
                        <div style={{ color: "#5cff8a", fontWeight: "bold" }}>+{profitVsHere}cr</div>
                        <div className="text-mute truncate" style={{ maxWidth: 85, fontSize: 10 }}>{bestStation.name}</div>
                      </div>
                    ) : (
                      <span style={{ color: "#ffd24a" }}>BEST</span>
                    )}
                  </div>'''

if old_best_sell in hcode:
    hcode = hcode.replace(old_best_sell, new_best_sell)
    print("  -> Updated BEST SELL to show station name + profit amount")
else:
    print("  -> WARNING: Could not find BEST SELL column")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

print("\n" + "=" * 60)
print("DONE! Cargo HUD + BEST SELL improvements")
print("=" * 60)
print("\nChanges:")
print("  1. Press J to open cargo popup (works while flying)")
print("  2. Cargo popup shows all items with icons, quantities, values")
print("  3. Escape also closes cargo popup")
print("  4. Cargo tab removed from station (use J instead)")
print("  5. BEST SELL now shows station name + exact profit difference")
print("  6. TopBar shows 'CARGO [J]' as hint for the keybinding")
