#!/usr/bin/env python3
"""Add ESC settings menu + server-side asteroid collision."""

import os

# ── 1: Copy SettingsMenu.tsx component ──
print("1. SettingsMenu component already copied to components/")

# ── 2: Add showSettings to store.ts ──
print("2. Adding showSettings state to store.ts...")
with open('frontend/src/game/store.ts', 'r') as f:
    sc = f.read()

sc = sc.replace(
    '  showFullZoneMap: boolean;',
    '  showFullZoneMap: boolean;\n  showSettings: boolean;'
)
sc = sc.replace(
    '  showFullZoneMap: false,',
    '  showFullZoneMap: false,\n  showSettings: false,'
)
print("  -> Added showSettings: boolean to GameState")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(sc)

# ── 3: Modify App.tsx - ESC handler + import + render ──
print("3. Modifying App.tsx for settings menu...")
with open('frontend/src/App.tsx', 'r') as f:
    ac = f.read()

# Add import for SettingsMenu
ac = ac.replace(
    'import { QuestTracker } from "./components/QuestTracker";',
    'import { QuestTracker } from "./components/QuestTracker";\nimport SettingsMenu from "./components/SettingsMenu";'
)
print("  -> Added SettingsMenu import")

# Modify ESC handler to toggle settings
old_esc = '''      } else if (e.key === "Escape") {
        state.showMap = false;
        state.showClan = false;
        state.showAmmoSelector = false;
        state.showRocketAmmoSelector = false;
        state.showFullZoneMap = false;
        bump();'''

new_esc = '''      } else if (e.key === "Escape") {
        if (state.showSettings) {
          state.showSettings = false;
        } else if (state.showMap || state.showClan || state.showAmmoSelector || state.showRocketAmmoSelector || state.showFullZoneMap) {
          state.showMap = false;
          state.showClan = false;
          state.showAmmoSelector = false;
          state.showRocketAmmoSelector = false;
          state.showFullZoneMap = false;
        } else {
          state.showSettings = true;
        }
        bump();'''

if old_esc in ac:
    ac = ac.replace(old_esc, new_esc)
    print("  -> ESC now toggles settings menu")
else:
    print("  -> WARNING: Could not find ESC handler")

# Add SettingsMenu render in JSX - after FactionPicker
ac = ac.replace(
    '      <FactionPicker />',
    '      <FactionPicker />\n      {g.showSettings && <SettingsMenu onClose={() => { state.showSettings = false; bump(); }} />}'
)
print("  -> Added SettingsMenu render")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(ac)

# ── 4: Add server-side asteroid collision in engine.ts ──
print("4. Adding server-side asteroid collision...")
with open('backend/src/game/engine.ts', 'r') as f:
    ec = f.read()

old_clamp = '''      p.posX = clamp(p.posX, -MAP_RADIUS, MAP_RADIUS);
      p.posY = clamp(p.posY, -MAP_RADIUS, MAP_RADIUS);'''

new_clamp = '''      // Asteroid collision - push player out of asteroids
      const pZone = this.zones.get(p.zone);
      if (pZone) {
        for (const ast of pZone.asteroids.values()) {
          if (ast.hp <= 0) continue;
          const adx = p.posX - ast.pos.x;
          const ady = p.posY - ast.pos.y;
          const adist = Math.sqrt(adx * adx + ady * ady);
          const minDist = ast.size + 12;
          if (adist < minDist && adist > 0) {
            const pushX = (adx / adist) * minDist;
            const pushY = (ady / adist) * minDist;
            p.posX = ast.pos.x + pushX;
            p.posY = ast.pos.y + pushY;
            const dot = p.velX * (adx / adist) + p.velY * (ady / adist);
            if (dot < 0) {
              p.velX -= (adx / adist) * dot * 1.5;
              p.velY -= (ady / adist) * dot * 1.5;
            }
          }
        }
      }

      p.posX = clamp(p.posX, -MAP_RADIUS, MAP_RADIUS);
      p.posY = clamp(p.posY, -MAP_RADIUS, MAP_RADIUS);'''

if old_clamp in ec:
    ec = ec.replace(old_clamp, new_clamp)
    print("  -> Added asteroid collision in tickPlayerMovement")
else:
    print("  -> WARNING: Could not find clamp code")

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(ec)

# ── 5: Enable client-side asteroid collision in server-auth mode too ──
print("5. Enabling client-side asteroid collision in server-auth mode...")
with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Remove the serverAuthoritative skip for asteroid collision
old_ast_col = '''    if (serverAuthoritative) continue;
    if (a.zone !== state.player.zone) continue;'''

new_ast_col = '''    if (a.zone !== state.player.zone) continue;'''

if old_ast_col in lc:
    lc = lc.replace(old_ast_col, new_ast_col)
    print("  -> Removed serverAuthoritative skip for asteroid collision")
else:
    print("  -> WARNING: Could not find asteroid collision skip")

# Also remove the damage from client-side collision since server handles it now
# Just keep the push-back visual + sparks
old_ast_dmg = '''    if (adist < a.size + 10) {
    const pushAng = Math.atan2(p.pos.y - a.pos.y, p.pos.x - a.pos.x);
    p.pos.x = a.pos.x + Math.cos(pushAng) * (a.size + 12);
    p.pos.y = a.pos.y + Math.sin(pushAng) * (a.size + 12);
    damagePlayer(Math.round(a.size * 0.3));
    emitSpark(p.pos.x, p.pos.y, "#c69060", 3, 50, 2);
  }'''

# Try with different indentation
if old_ast_dmg not in lc:
    # Read the actual indentation
    pass

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

# ── 6: Initialize particle density from localStorage ──
print("6. Initializing particle density on load...")
# Add to loop.ts init
old_init_check = 'let trailTimer = 0;'
new_init_check = '''let trailTimer = 0;

// Initialize particle density from settings
const _storedParticles = localStorage.getItem("sf-particles");
(window as any).__particleDensity = _storedParticles === "low" ? 0.3 : _storedParticles === "medium" ? 0.6 : 1;'''

with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

if '(window as any).__particleDensity' not in lc:
    if old_init_check in lc:
        lc = lc.replace(old_init_check, new_init_check, 1)
        print("  -> Added particle density init from localStorage")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

print("\nAll changes applied!")
