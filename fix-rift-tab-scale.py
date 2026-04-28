#!/usr/bin/env python3
"""Fix: rift infinite loot, TAB auto-aim, UI scale."""

# ── FIX 1: Rift enemies - dead enemies not removed + infinite kills ──
print("FIX 1: Fix rift enemy infinite loot/respawn...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Dead enemies never removed when serverEnemiesReceived is true
# Add dungeon exception to the removal filter
old_filter = '''  if (!serverEnemiesReceived) {
    state.enemies = state.enemies.filter((e) => e.hull > 0);
  }'''

new_filter = '''  if (!serverEnemiesReceived || state.dungeon) {
    state.enemies = state.enemies.filter((e) => e.hull > 0);
  }'''

if old_filter in lc:
    lc = lc.replace(old_filter, new_filter)
    print("  -> Dead enemies now removed in dungeon mode")
else:
    print("  -> WARNING: Could not find enemy removal filter")

# Also fix updateDungeon to only count alive enemies
old_alive = '''  const aliveCount = state.enemies.length;'''
new_alive = '''  const aliveCount = state.enemies.filter(e => e.hull > 0).length;'''

# Only replace the one inside updateDungeon (first occurrence after the function)
if old_alive in lc:
    # Find the updateDungeon function position
    idx = lc.find('function updateDungeon(dt: number)')
    if idx >= 0:
        next_alive = lc.find(old_alive, idx)
        if next_alive >= 0:
            lc = lc[:next_alive] + new_alive + lc[next_alive + len(old_alive):]
            print("  -> updateDungeon now counts only alive enemies")
else:
    print("  -> WARNING: Could not find aliveCount in updateDungeon")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

# ── FIX 2: TAB auto-aim targeting ──
print("FIX 2: Adding TAB auto-aim...")
with open('frontend/src/App.tsx', 'r') as f:
    ac = f.read()

# Add TAB handler in the keydown handler, after the ESC block
old_tab_spot = '''        }
        bump();
      } else if (e.key === "1") {'''

new_tab_spot = '''        }
        bump();
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (!state.dockedAt) {
          const p = state.player;
          const enemies = state.enemies.filter(en => en.hull > 0 && en.zone === p.zone);
          if (enemies.length > 0) {
            enemies.sort((a, b) => {
              const da = Math.hypot(a.pos.x - p.pos.x, a.pos.y - p.pos.y);
              const db = Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
              return da - db;
            });
            const currentIdx = state.attackTargetId
              ? enemies.findIndex(en => en.id === state.attackTargetId)
              : -1;
            const nextIdx = (currentIdx + 1) % enemies.length;
            const target = enemies[nextIdx];
            state.attackTargetId = target.id;
            state.selectedWorldTarget = {
              kind: "enemy",
              id: target.id,
              name: target.type.toUpperCase() + (target.isBoss ? " (BOSS)" : ""),
              detail: `HP ${Math.round(target.hull)}/${Math.round(target.hullMax)}`,
            };
            state.isLaserFiring = true;
            state.isAttacking = true;
            state.miningTargetId = null;
          }
        }
        bump();
      } else if (e.key === "1") {'''

if old_tab_spot in ac:
    ac = ac.replace(old_tab_spot, new_tab_spot)
    print("  -> Added TAB key handler for auto-aim cycling")
else:
    print("  -> WARNING: Could not find spot for TAB handler")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(ac)

# ── FIX 3: Fix UI scale to actually work ──
print("FIX 3: Fixing UI scale...")

# The SettingsMenu sets --ui-scale CSS var but nothing uses it
# Fix: Apply transform scale to the HUD overlay container in App.tsx
# Read the current App.tsx (already modified above)
with open('frontend/src/App.tsx', 'r') as f:
    ac = f.read()

# Find the main game return div and add a UI scale wrapper around HUD elements
# The return block starts with a relative div containing GameCanvas and all HUD
old_return = '''  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#02040c" }}>
      <GameCanvas />
      <TopBar />'''

new_return = '''  const currentUiScale = useGame((s) => s.uiScale ?? 1);

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#02040c" }}>
      <GameCanvas />
      <div style={{ transform: `scale(${currentUiScale})`, transformOrigin: "top left", width: `${100 / (currentUiScale || 1)}%`, height: `${100 / (currentUiScale || 1)}%`, position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto" }}>
      <TopBar />'''

if old_return in ac:
    ac = ac.replace(old_return, new_return)
    print("  -> Added UI scale wrapper div")
else:
    print("  -> WARNING: Could not find return block")

# Close the wrapper divs before the settings menu (settings should NOT be scaled)
old_faction = '      <FactionPicker />'
new_faction = '      <FactionPicker />\n      </div>\n      </div>'

if old_faction in ac:
    ac = ac.replace(old_faction, new_faction, 1)
    print("  -> Closed UI scale wrapper before settings")
else:
    print("  -> WARNING: Could not find FactionPicker")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(ac)

# Add uiScale to store.ts
print("  -> Adding uiScale to store...")
with open('frontend/src/game/store.ts', 'r') as f:
    sc = f.read()

if 'uiScale' not in sc:
    sc = sc.replace(
        '  showSettings: boolean;',
        '  showSettings: boolean;\n  uiScale: number;'
    )
    # Set default from localStorage
    sc = sc.replace(
        '  showSettings: false,',
        '  showSettings: false,\n  uiScale: parseFloat(localStorage.getItem("sf-ui-scale") || "1"),'
    )
    print("  -> Added uiScale to GameState")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(sc)

# Update SettingsMenu to also update the store's uiScale
with open('frontend/src/components/SettingsMenu.tsx', 'r') as f:
    sm = f.read()

# Add store import
sm = sm.replace(
    'import { getVolume, getMuted, setVolume, setMuted } from "../game/sound";',
    'import { getVolume, getMuted, setVolume, setMuted } from "../game/sound";\nimport { state, bump } from "../game/store";'
)

# Update onScale to also set store value
sm = sm.replace(
    '''  const onScale = (v: number) => {
    setUiScale(v);
    localStorage.setItem("sf-ui-scale", String(v));
    document.documentElement.style.setProperty("--ui-scale", String(v));
  };''',
    '''  const onScale = (v: number) => {
    setUiScale(v);
    localStorage.setItem("sf-ui-scale", String(v));
    state.uiScale = v;
    bump();
  };'''
)

with open('frontend/src/components/SettingsMenu.tsx', 'w') as f:
    f.write(sm)

print("\nAll fixes applied!")
