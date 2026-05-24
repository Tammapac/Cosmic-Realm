#!/usr/bin/env python3
"""Factory stations only show: Refinery, Market, Services, Missions."""

with open('frontend/src/components/Hangar.tsx', 'r') as f:
    code = f.read()

# Add a separate FACTORY_TABS array
old_tabs = '''const TABS: { id: HangarTab; label: string; glyph: string }[] = [
  { id: "bounties", label: "Bounties", glyph: "★" },
  { id: "missions", label: "Missions", glyph: "▣" },
  { id: "skills",   label: "Skills",   glyph: "✦" },
  { id: "ships",    label: "Shipyard", glyph: "▲" },
  { id: "loadout",  label: "Loadout",  glyph: "⚙" },
  { id: "drones",   label: "Drones",   glyph: "✦" },
  { id: "market",   label: "Market",   glyph: "$" },
  { id: "repair",   label: "Services", glyph: "✚" },
];'''

new_tabs = '''const TABS: { id: HangarTab; label: string; glyph: string }[] = [
  { id: "bounties", label: "Bounties", glyph: "★" },
  { id: "missions", label: "Missions", glyph: "▣" },
  { id: "skills",   label: "Skills",   glyph: "✦" },
  { id: "ships",    label: "Shipyard", glyph: "▲" },
  { id: "loadout",  label: "Loadout",  glyph: "⚙" },
  { id: "drones",   label: "Drones",   glyph: "✦" },
  { id: "market",   label: "Market",   glyph: "$" },
  { id: "repair",   label: "Services", glyph: "✚" },
];

const FACTORY_TABS: { id: HangarTab; label: string; glyph: string }[] = [
  { id: "refinery", label: "Refinery", glyph: "⚒" },
  { id: "market",   label: "Market",   glyph: "$" },
  { id: "missions", label: "Missions", glyph: "▣" },
  { id: "repair",   label: "Services", glyph: "✚" },
];'''

if 'FACTORY_TABS' not in code:
    code = code.replace(old_tabs, new_tabs)
    print("  -> Added FACTORY_TABS array")

# Replace the tab rendering to use the right array based on station kind
old_render = '''          {[...TABS, ...(station.kind === "factory" ? [{ id: "refinery" as HangarTab, label: "Refinery", glyph: "⚒" }] : [])].map((t) => ('''
new_render = '''          {(station.kind === "factory" ? FACTORY_TABS : TABS).map((t) => ('''

if old_render in code:
    code = code.replace(old_render, new_render)
    print("  -> Switched to FACTORY_TABS for factory stations")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(code)

print("DONE!")
