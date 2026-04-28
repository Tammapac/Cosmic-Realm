#!/usr/bin/env python3
"""Fix cargo popup crash + spread stations across map."""

import re, json

# ══════════════════════════════════════════════════════════════════════════════
# 1. Fix CargoOverlay crash (missing SHIP_CLASSES import) + restyle as popup
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Fixing CargoOverlay ═══")

with open('frontend/src/App.tsx', 'r') as f:
    acode = f.read()

# Fix import - add SHIP_CLASSES
old_types_import = 'import { DUNGEONS, STATIONS, PORTALS, ZONES, MODULE_DEFS, RESOURCES } from "./game/types";'
new_types_import = 'import { DUNGEONS, STATIONS, PORTALS, ZONES, MODULE_DEFS, RESOURCES, SHIP_CLASSES } from "./game/types";'
if old_types_import in acode:
    acode = acode.replace(old_types_import, new_types_import)
    print("  -> Added SHIP_CLASSES import")

# Replace the entire CargoOverlay with a proper popup window style
# Find and replace the whole component
start_marker = '\nfunction CargoOverlay()'
end_marker = '\nfunction GameApp'  # or whatever comes after

if start_marker in acode and end_marker in acode:
    before = acode[:acode.index(start_marker)]
    after_idx = acode.index(end_marker)
    after = acode[after_idx:]

    new_overlay = '''
function CargoOverlay() {
  const showCargo = useGame((s) => s.showCargo);
  const player = useGame((s) => s.player);
  if (!showCargo) return null;

  const used = player.cargo.reduce((a: number, c: any) => a + c.qty, 0);
  const cls = SHIP_CLASSES[player.shipClass];
  const maxCargo = cls.cargoMax;

  return (
    <div
      className="fixed z-50"
      style={{ top: 80, right: 16, width: 340, pointerEvents: "auto" }}
    >
      <div className="panel" style={{ maxHeight: "calc(100vh - 160px)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 0 30px rgba(78,226,255,0.15)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
          <div>
            <div className="text-cyan tracking-widest text-sm font-bold">CARGO HOLD</div>
            <div className="text-mute text-[12px]">{used}/{maxCargo} units</div>
          </div>
          <div className="text-right">
            <div className="text-amber font-bold text-[14px]">{player.cargo.reduce((s: number, c: any) => s + ((RESOURCES as any)[c.resourceId]?.basePrice ?? 0) * c.qty, 0).toLocaleString()}cr</div>
            <button
              className="text-mute hover:text-bright text-[11px] tracking-widest"
              onClick={() => { state.showCargo = false; bump(); }}
            >[J] CLOSE</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {player.cargo.length === 0 ? (
            <div className="text-mute text-sm italic text-center py-6">
              Cargo bay empty
            </div>
          ) : player.cargo.map((c: any) => {
            const r = (RESOURCES as any)[c.resourceId];
            if (!r) return null;
            return (
              <div key={c.resourceId} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 border-b" style={{ borderColor: "var(--border-soft)" }}>
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 28, height: 28, background: r.color + "22", border: "1px solid " + r.color, color: r.color, fontSize: 14 }}
                >{r.glyph}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-bright text-[12px] font-bold truncate">{r.name}</div>
                </div>
                <div className="text-cyan text-[13px] font-bold tabular-nums">x{c.qty}</div>
                <div className="text-amber text-[12px] tabular-nums" style={{ minWidth: 50, textAlign: "right" }}>{(c.qty * r.basePrice).toLocaleString()}cr</div>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t text-mute text-[11px] tracking-widest" style={{ borderColor: "var(--border-soft)" }}>
          {used > 0 ? "DOCK TO SELL" : "MINE OR TRADE"}
        </div>
      </div>
    </div>
  );
}
'''
    acode = before + new_overlay + after
    print("  -> Replaced CargoOverlay with side-panel popup style")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(acode)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Spread stations across the map
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Spreading stations across the map ═══")

# MAP_RADIUS is 8000, so stations can go from -7000 to 7000
# Currently most stations are within -2800 to 2800
# Let's spread them further out, keeping hubs near center but pushing
# trade/mining/outpost stations to 3000-6000 range

with open('frontend/src/game/types.ts', 'r') as f:
    tcode = f.read()

# Station position updates - spread them out significantly
# Format: station_id -> new position
station_positions = {
    # ALPHA
    "helix":           (0, 0),           # hub stays center
    "iron-belt":       (-4500, -2800),   # was -1800, -400
    "alpha-bazaar":    (5200, -3800),    # was 2800, -1600
    # NEBULA
    "veiled":          (3200, -4800),    # was 400, -1600
    "azure-port":      (-4200, -5200),   # was -1200, -2400
    "nebula-exchange": (5400, 4200),     # was 2600, 1800
    # CRIMSON
    "ember":           (-3800, 2400),    # was -1200, 800
    "scarlet-yard":    (4800, 3600),     # was 2200, 1600
    "crimson-market":  (-5400, 5000),    # was -2800, 2200
    # VOID
    "echo":            (800, -3200),     # was 0, -600
    "obsidian-port":   (4600, 3800),     # was 1800, 1200
    "void-trade":      (-5200, -4800),   # was -2400, -2000
    # FORGE
    "ironclad":        (0, 0),           # hub stays
    "forge-gate":      (-4200, 4400),    # was -1600, 1800
    "forge-market":    (5400, -3800),    # was 2800, -1200
    # CORONA
    "solar-haven":     (3200, -4200),    # was 800, -1200
    "corona-mkt":      (5000, 3800),     # was 2000, 1200
    "corona-exchange": (-5000, -4600),   # was -2200, -2000
    # FRACTURE
    "rift-base":       (-3800, 3200),    # was -1000, 800
    "null-post":       (4200, -4800),    # was 1400, -1800
    "fracture-bazaar": (5200, 3800),     # was 2600, 1400
    # ABYSS
    "void-heart":      (0, 0),           # hub stays
    "abyss-anchor":    (-5200, 4200),    # was -2200, 1600
    "abyss-exchange":  (5400, -4600),    # was 2800, -1800
    # MARSDEPTH
    "deep-haven":      (0, 0),           # outpost stays
    "iron-depth":      (4600, -4200),    # was 1800, -1400
    "mars-trade":      (-5400, -4200),   # was -2600, -1600
    # MAELSTROM
    "storm-eye":       (0, 0),           # military stays
    "wreck-point":     (-4800, 4200),    # was -1800, 1600
    "storm-bazaar":    (5600, -3200),    # was 2800, -800
    # VENUS 1
    "cloud-gate":      (0, 0),           # hub stays
    "mist-dock":       (-4400, -2800),   # was -1600, -600
    "halo-walk":       (4200, 3400),     # was 1640, 1080
    # VENUS 2
    "sulphur-port":    (2800, -4800),    # was 400, -1400
    "wind-market":     (-4600, -5200),   # was -1400, -2200
    "brass-spire":     (5400, -2000),    # was 2400, -400
    "venus2-trade":    (5400, 4200),     # was 2800, 1600
    # VENUS 3
    "acid-citadel":    (-3800, 3200),    # was -1000, 800
    "pressure-yard":   (4800, 3800),     # was 2000, 1400
    "acid-exchange":   (-5400, -4200),   # was -2500, -1300
    "venus3-trade":    (-5600, -5200),   # was -2800, -2400
    # VENUS 4
    "core-refuge":     (800, -3200),     # was 0, -600
    "pressure-port":   (4600, 3800),     # was 1800, 1200
    "cradle":          (-5200, 2400),    # was -2200, 500
    "venus4-trade":    (-5400, -4000),   # was -2600, -1200
    # VENUS 5
    "venus-bastion":   (0, 0),           # military stays
    "eye-bazaar":      (-4600, 4400),    # was -1600, 1800
    "singularity-dock":(5400, -3600),    # was 2500, -900
    "venus5-trade":    (5600, 3800),     # was 2800, 1200
    # DANGER ZONES
    "rift-outpost":    (0, 0),           # stays center
    "danger1-trade":   (5200, -4600),    # was 2400, -1800
    "dead-market":     (-3600, 4200),    # was -800, 1200
    "danger2-trade":   (5400, 3800),     # was 2600, 1400
    "pirate-dock":     (2800, -3200),    # was 600, -600
    "danger3-trade":   (-5200, 4200),    # was -2400, 1600
    "null-station":    (800, 3600),      # was 0, 800
    "danger4-trade":   (5000, -4200),    # was 2200, -1400
    "abyss-gate":      (-2400, -2800),   # was -400, -400
    "danger5-trade":   (4800, 4400),     # was 2000, 1800
}

count = 0
for sid, (nx, ny) in station_positions.items():
    # Find the station and update its position
    pattern = f'id: "{sid}",'
    if pattern in tcode:
        idx = tcode.index(pattern)
        # Find pos: { x: ..., y: ... }
        pos_match = re.search(r'pos:\s*\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+)\s*\}', tcode[idx:idx+300])
        if pos_match:
            old_pos = pos_match.group(0)
            new_pos = f'pos: {{ x: {nx}, y: {ny} }}'
            # Only replace in the context of this station
            station_block = tcode[idx:idx+300]
            station_block = station_block.replace(old_pos, new_pos, 1)
            tcode = tcode[:idx] + station_block + tcode[idx+300:]
            count += 1

print(f"  -> Updated {count} station positions")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(tcode)

# Also update backend station positions to match
print("\n═══ Spreading backend stations ═══")

with open('backend/src/game/data.ts', 'r') as f:
    bcode = f.read()

bcount = 0
for sid, (nx, ny) in station_positions.items():
    pattern = f'id: "{sid}",'
    if pattern in bcode:
        idx = bcode.index(pattern)
        pos_match = re.search(r'pos:\s*\{\s*x:\s*(-?\d+),\s*y:\s*(-?\d+)\s*\}', bcode[idx:idx+300])
        if pos_match:
            old_pos = pos_match.group(0)
            new_pos = f'pos: {{ x: {nx}, y: {ny} }}'
            station_block = bcode[idx:idx+300]
            station_block = station_block.replace(old_pos, new_pos, 1)
            bcode = bcode[:idx] + station_block + bcode[idx+300:]
            bcount += 1

print(f"  -> Updated {bcount} backend station positions")

with open('backend/src/game/data.ts', 'w') as f:
    f.write(bcode)

print("\n" + "=" * 60)
print("DONE!")
print("=" * 60)
print(f"\n1. Fixed CargoOverlay crash (added SHIP_CLASSES import)")
print(f"2. Cargo popup is now a side-panel (top-right, non-blocking)")
print(f"3. Spread {count} stations across the map (3000-5600 unit range)")
print(f"   Hub/military stations stay at center, trade/mining pushed out")
