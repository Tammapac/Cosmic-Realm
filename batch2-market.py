#!/usr/bin/env python3
"""Batch 2 Part 2: Dynamic market prices, cargo HUD, trade profit indicators."""

import re

# ══════════════════════════════════════════════════════════════════════════════
# 1. Dynamic market prices — time-based fluctuations in stationPrice()
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Adding dynamic market price fluctuations ═══")

with open('frontend/src/game/store.ts', 'r') as f:
    code = f.read()

old_price_fn = '''export function stationPrice(stationId: string, resourceId: ResourceId): number {
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station) return RESOURCES[resourceId].basePrice;
  const mod = station.prices[resourceId];
  let price = RESOURCES[resourceId].basePrice * (mod ?? 1.0);
  // Faction discounts disabled
  return Math.max(1, Math.round(price));
}'''

new_price_fn = '''function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function stationPrice(stationId: string, resourceId: ResourceId): number {
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station) return RESOURCES[resourceId].basePrice;
  const mod = station.prices[resourceId];
  let price = RESOURCES[resourceId].basePrice * (mod ?? 1.0);

  // Dynamic price fluctuation (±15%, 8-minute cycles, unique per station+resource)
  const seed = hashCode(stationId + resourceId);
  const period = 480000 + (seed % 5) * 60000; // 8-13 min cycles
  const phase = (seed % 1000) / 1000 * Math.PI * 2;
  const now = Date.now();
  const wave = Math.sin(now / period * Math.PI * 2 + phase);
  const amplitude = 0.15;
  price *= (1 + wave * amplitude);

  return Math.max(1, Math.round(price));
}

export function priceDirection(stationId: string, resourceId: ResourceId): "up" | "down" | "stable" {
  const seed = hashCode(stationId + resourceId);
  const period = 480000 + (seed % 5) * 60000;
  const phase = (seed % 1000) / 1000 * Math.PI * 2;
  const now = Date.now();
  const wave = Math.cos(now / period * Math.PI * 2 + phase);
  if (wave > 0.3) return "up";
  if (wave < -0.3) return "down";
  return "stable";
}'''

if old_price_fn in code:
    code = code.replace(old_price_fn, new_price_fn)
    print("  -> Added dynamic price fluctuation to stationPrice()")
    print("  -> Added priceDirection() helper")
else:
    print("  -> WARNING: Could not find stationPrice function")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(code)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Update MarketTab with trade profit indicators + best sell station
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating MarketTab with profit indicators ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# Add priceDirection import
if 'priceDirection' not in hcode:
    old_himport = 'stationPrice,'
    if old_himport in hcode:
        hcode = hcode.replace('stationPrice,', 'stationPrice, priceDirection,', 1)
        print("  -> Added priceDirection import")

# Update the market grid from 7 cols to 8 cols (add BEST SELL column)
old_grid_header = '''          <div className="grid grid-cols-7 gap-2 px-2 py-1 text-[12px] tracking-widest text-mute border-b" style={{ borderColor: "var(--border-soft)" }}>
            <div className="col-span-2">RESOURCE</div>
            <div className="text-right">BASE</div>
            <div className="text-right">HERE</div>
            <div className="text-right">±</div>
            <div className="text-right">CARGO</div>
            <div className="text-center">TRADE</div>'''

new_grid_header = '''          <div className="grid gap-2 px-2 py-1 text-[12px] tracking-widest text-mute border-b" style={{ borderColor: "var(--border-soft)", gridTemplateColumns: "2fr 50px 55px 45px 40px 90px 160px" }}>
            <div>RESOURCE</div>
            <div className="text-right">BASE</div>
            <div className="text-right">HERE</div>
            <div className="text-right">±</div>
            <div className="text-right">QTY</div>
            <div className="text-center">BEST SELL</div>
            <div className="text-center">TRADE</div>'''

if old_grid_header in hcode:
    hcode = hcode.replace(old_grid_header, new_grid_header)
    print("  -> Updated grid header (added BEST SELL)")
else:
    print("  -> WARNING: Could not find grid header")

# Update each resource row
old_row = '''              return (
                <div key={r.id} className="grid grid-cols-7 gap-2 items-center px-2 py-1.5 hover:bg-white/5 border-b" style={{ borderColor: "var(--border-soft)" }}>
                  <div className="col-span-2 flex items-center gap-2">
                    <div
                      className="flex items-center justify-center"
                      style={{ width: 22, height: 22, background: `${r.color}22`, border: `1px solid ${r.color}`, color: r.color, fontSize: 12 }}
                    >
                      {r.glyph}
                    </div>
                    <div>
                      <div className="text-bright text-[13px]">{r.name}</div>
                      <div className="text-mute text-[13px]">{r.description}</div>
                    </div>
                  </div>
                  <div className="text-right text-mute text-[13px] tabular-nums">{r.basePrice}</div>
                  <div className="text-right font-bold tabular-nums" style={{ color: diff < 0 ? "#5cff8a" : diff > 0 ? "#ff5c6c" : "var(--text-dim)" }}>
                    {price}
                  </div>
                  <div className="text-right text-[13px] tabular-nums" style={{ color: diff < 0 ? "#5cff8a" : "#ff5c6c" }}>
                    {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
                  </div>
                  <div className="text-right text-cyan text-[13px] tabular-nums">{have}</div>
                  <div className="flex gap-1 justify-center">
                    <button className="btn" style={{ padding: "2px 6px", fontSize: 13 }} onClick={() => buy(r.id, 1)}>+1</button>
                    <button className="btn" style={{ padding: "2px 6px", fontSize: 13 }} onClick={() => buy(r.id, 10)}>+10</button>
                    <button className="btn btn-amber" style={{ padding: "2px 6px", fontSize: 13 }} disabled={have <= 0} onClick={() => sell(r.id, 1)}>-1</button>
                    <button className="btn btn-amber" style={{ padding: "2px 6px", fontSize: 13 }} disabled={have < 10} onClick={() => sell(r.id, 10)}>-10</button>
                    <button className="btn btn-amber" style={{ padding: "2px 6px", fontSize: 13 }} disabled={have <= 0} onClick={() => sell(r.id, have)}>All</button>
                  </div>
                </div>
              );'''

new_row = '''              // Find best station to sell this resource
              const bestStation = STATIONS.reduce<{ name: string; price: number; zone: string } | null>((best, s) => {
                if (s.id === stationId) return best;
                const sp = stationPrice(s.id, r.id);
                if (!best || sp > best.price) return { name: s.name, price: sp, zone: s.zone };
                return best;
              }, null);
              const dir = priceDirection(stationId, r.id);
              const dirIcon = dir === "up" ? "▲" : dir === "down" ? "▼" : "●";
              const dirColor = dir === "up" ? "#ff5c6c" : dir === "down" ? "#5cff8a" : "#666";
              const profitVsHere = bestStation ? bestStation.price - price : 0;
              return (
                <div key={r.id} className="grid gap-2 items-center px-2 py-1.5 hover:bg-white/5 border-b" style={{ borderColor: "var(--border-soft)", gridTemplateColumns: "2fr 50px 55px 45px 40px 90px 160px" }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex items-center justify-center"
                      style={{ width: 22, height: 22, background: `${r.color}22`, border: `1px solid ${r.color}`, color: r.color, fontSize: 12 }}
                    >
                      {r.glyph}
                    </div>
                    <div>
                      <div className="text-bright text-[13px]">{r.name}</div>
                      <div className="text-mute text-[11px] truncate" style={{ maxWidth: 160 }}>{r.description}</div>
                    </div>
                  </div>
                  <div className="text-right text-mute text-[13px] tabular-nums">{r.basePrice}</div>
                  <div className="text-right font-bold tabular-nums flex items-center justify-end gap-1" style={{ color: diff < 0 ? "#5cff8a" : diff > 0 ? "#ff5c6c" : "var(--text-dim)" }}>
                    <span style={{ color: dirColor, fontSize: 8 }}>{dirIcon}</span>
                    {price}
                  </div>
                  <div className="text-right text-[12px] tabular-nums" style={{ color: diff < 0 ? "#5cff8a" : "#ff5c6c" }}>
                    {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
                  </div>
                  <div className="text-right text-cyan text-[13px] tabular-nums">{have}</div>
                  <div className="text-center text-[11px] tabular-nums" title={bestStation ? `Sell at ${bestStation.name} for ${bestStation.price}cr` : ""}>
                    {bestStation && profitVsHere > 0 ? (
                      <span style={{ color: "#5cff8a" }}>+{profitVsHere}cr</span>
                    ) : (
                      <span className="text-mute">best here</span>
                    )}
                  </div>
                  <div className="flex gap-1 justify-center">
                    <button className="btn" style={{ padding: "2px 5px", fontSize: 12 }} onClick={() => buy(r.id, 1)}>+1</button>
                    <button className="btn" style={{ padding: "2px 5px", fontSize: 12 }} onClick={() => buy(r.id, 10)}>+10</button>
                    <button className="btn btn-amber" style={{ padding: "2px 5px", fontSize: 12 }} disabled={have <= 0} onClick={() => sell(r.id, 1)}>-1</button>
                    <button className="btn btn-amber" style={{ padding: "2px 5px", fontSize: 12 }} disabled={have < 10} onClick={() => sell(r.id, 10)}>-10</button>
                    <button className="btn btn-amber" style={{ padding: "2px 5px", fontSize: 12 }} disabled={have <= 0} onClick={() => sell(r.id, have)}>All</button>
                  </div>
                </div>
              );'''

if old_row in hcode:
    hcode = hcode.replace(old_row, new_row)
    print("  -> Updated market row with BEST SELL + trend arrows")
else:
    print("  -> WARNING: Could not find market row")

# Update the tip text
old_tip = '''          <div className="mt-3 text-mute text-[13px] italic">
            Tip: visit Iron Belt Refinery for cheap iron and lumenite. Resell quantum chips at Crimson stations for premium.
          </div>'''

new_tip = '''          <div className="mt-3 text-mute text-[13px] italic">
            Prices fluctuate over time — watch the arrows for trends. Buy when low (green arrow down), sell when high.
            The BEST SELL column shows potential profit if you sell at a different station.
          </div>'''

if old_tip in hcode:
    hcode = hcode.replace(old_tip, new_tip)
    print("  -> Updated trading tip text")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

# ══════════════════════════════════════════════════════════════════════════════
# 3. Add cargo mini-display to game HUD (TopBar or overlay)
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding cargo HUD overlay ═══")

with open('frontend/src/components/TopBar.tsx', 'r') as f:
    tcode = f.read()

# Add RESOURCES import
if 'RESOURCES' not in tcode:
    old_timport = 'rankFor, HONOR_RANKS, DRONE_DEFS'
    new_timport = 'rankFor, HONOR_RANKS, DRONE_DEFS, RESOURCES'
    if old_timport in tcode:
        tcode = tcode.replace(old_timport, new_timport)
        print("  -> Added RESOURCES import to TopBar.tsx")

# Make the CARGO stat clickable to expand a cargo popup
old_cargo_stat = '''        <Stat label="CARGO" value={`${cargoUsed}/${cargoCapacity()}`} color="#4ee2ff" />'''

new_cargo_stat = '''        <CargoStat used={cargoUsed} max={cargoCapacity()} cargo={player.cargo} />'''

if old_cargo_stat in tcode:
    tcode = tcode.replace(old_cargo_stat, new_cargo_stat)
    print("  -> Replaced CARGO stat with expandable CargoStat")

# Add CargoStat component before the Stat component (find function Stat)
old_stat_fn = '''function Stat({ label, value, color }: { label: string; value: string; color: string }) {'''

cargo_stat_component = '''function CargoStat({ used, max, cargo }: { used: number; max: number; cargo: { resourceId: string; qty: number }[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="relative">
      <div
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        title="Click to expand cargo"
      >
        <div className="text-[11px] text-mute tracking-widest">CARGO</div>
        <div className="font-bold tabular-nums" style={{ color: used >= max ? "#ff5c6c" : "#4ee2ff" }}>
          {used}/{max} {expanded ? "▲" : "▼"}
        </div>
      </div>
      {expanded && cargo.length > 0 && (
        <div
          className="absolute top-full left-0 mt-1 panel p-2 z-50"
          style={{ minWidth: 180, maxHeight: 280, overflowY: "auto" }}
        >
          <div className="text-[11px] text-mute tracking-widest mb-1">CARGO HOLD</div>
          {cargo.map((c) => {
            const r = (RESOURCES as any)[c.resourceId];
            if (!r) return null;
            return (
              <div key={c.resourceId} className="flex items-center gap-2 py-0.5">
                <span style={{ color: r.color, fontSize: 12, width: 16, textAlign: "center" }}>{r.glyph}</span>
                <span className="text-bright text-[12px] flex-1">{r.name}</span>
                <span className="text-cyan text-[12px] tabular-nums">x{c.qty}</span>
              </div>
            );
          })}
          <div className="text-mute text-[11px] mt-1 border-t pt-1" style={{ borderColor: "var(--border-soft)" }}>
            Total value: {cargo.reduce((s, c) => s + ((RESOURCES as any)[c.resourceId]?.basePrice ?? 0) * c.qty, 0).toLocaleString()}cr
          </div>
        </div>
      )}
      {expanded && cargo.length === 0 && (
        <div className="absolute top-full left-0 mt-1 panel p-2 z-50" style={{ minWidth: 120 }}>
          <div className="text-mute text-[12px] italic">Empty</div>
        </div>
      )}
    </div>
  );
}

''' + old_stat_fn

if old_stat_fn in tcode:
    tcode = tcode.replace(old_stat_fn, cargo_stat_component)
    print("  -> Added CargoStat expandable component")

# Ensure useState import
if 'useState' not in tcode.split('\n')[0] and 'useState' not in tcode[:200]:
    tcode = tcode.replace('import { useGame,', 'import { useState } from "react";\nimport { useGame,')
    print("  -> Added useState import")

with open('frontend/src/components/TopBar.tsx', 'w') as f:
    f.write(tcode)

# ══════════════════════════════════════════════════════════════════════════════
# 4. Add auto-refresh to market prices (re-render every few seconds)
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding market price auto-refresh ═══")

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    hcode = f.read()

# Add useEffect/useState if not imported
if 'useEffect' not in hcode:
    old_react = 'import { useState } from "react";'
    if old_react in hcode:
        hcode = hcode.replace(old_react, 'import { useState, useEffect } from "react";')
        print("  -> Added useEffect import to Hangar.tsx")

# Add a price refresh timer to MarketTab
old_market_start = '''function MarketTab({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);'''

new_market_start = '''function MarketTab({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);'''

if old_market_start in hcode:
    hcode = hcode.replace(old_market_start, new_market_start)
    print("  -> Added 10s price refresh timer to MarketTab")
else:
    print("  -> WARNING: Could not find MarketTab start")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(hcode)

print("\n" + "=" * 60)
print("DONE! Batch 2 Part 2: Dynamic Market + Cargo HUD + Profit Indicators")
print("=" * 60)
print("\nChanges:")
print("  1. Prices now fluctuate ±15% on 8-13 min cycles (unique per station+resource)")
print("  2. Trend arrows show if price is rising or falling")
print("  3. BEST SELL column shows profit if sold at a different station")
print("  4. Cargo in top bar is now expandable (click to see items)")
print("  5. Market auto-refreshes every 10s to show price changes")
