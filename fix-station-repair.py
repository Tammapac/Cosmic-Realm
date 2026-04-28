#!/usr/bin/env python3
"""Fix station repair: hull/shield repair must sync to server."""

# ── FIX: handler.ts - Add dock:repair socket event ──
print("FIX: handler.ts - add dock:repair event...")
with open('backend/src/socket/handler.ts', 'r') as f:
    content = f.read()

# Find stats:update handler and add dock:repair right after the block
old_stats = '''    socket.on("stats:update", (data: {
      hull: number; shield: number; level: number;
      shipClass: string; honor: number;
      inventory?: any[]; equipped?: any; skills?: any;
      drones?: any[]; faction?: string;
    }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      // hull/shield are server-authoritative - don't accept client values
      p.level = data.level;
      p.shipClass = data.shipClass;
      p.honor = data.honor;'''

new_stats = '''    socket.on("dock:repair", (data: { hull: number; shield: number }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      if (data.hull > 0) p.hull = Math.min(data.hull, p.hullMax);
      if (data.shield >= 0) p.shield = Math.min(data.shield, p.shieldMax);
    });

    socket.on("stats:update", (data: {
      hull: number; shield: number; level: number;
      shipClass: string; honor: number;
      inventory?: any[]; equipped?: any; skills?: any;
      drones?: any[]; faction?: string;
    }) => {
      const p = getPlayer(user.playerId);
      if (!p) return;
      // hull/shield are server-authoritative - don't accept client values
      p.level = data.level;
      p.shipClass = data.shipClass;
      p.honor = data.honor;'''

if old_stats in content:
    content = content.replace(old_stats, new_stats)
    print("  -> Added dock:repair event handler")
else:
    print("  -> WARNING: Could not find stats:update handler")

with open('backend/src/socket/handler.ts', 'w') as f:
    f.write(content)

# ── FIX: socket.ts - Add sendDockRepair function ──
print("FIX: socket.ts - add sendDockRepair function...")
with open('frontend/src/net/socket.ts', 'r') as f:
    content = f.read()

old_sock = '''export function isConnected(): boolean {'''

new_sock = '''export function sendDockRepair(hull: number, shield: number) {
  socket?.emit("dock:repair", { hull, shield });
}

export function isConnected(): boolean {'''

if old_sock in content:
    content = content.replace(old_sock, new_sock)
    print("  -> Added sendDockRepair function")
else:
    print("  -> WARNING: Could not find isConnected in socket.ts")

with open('frontend/src/net/socket.ts', 'w') as f:
    f.write(content)

# ── FIX: Hangar.tsx - Send dock:repair when repairing ──
print("FIX: Hangar.tsx - sync repair to server...")
with open('frontend/src/components/Hangar.tsx', 'r') as f:
    content = f.read()

# Check if sendDockRepair is already imported
if 'sendDockRepair' not in content:
    # Find the import from socket.ts
    import_match = content.find("from \"../net/socket\"")
    if import_match == -1:
        # Add import at top
        old_import = content.split('\n')[0]
        content = 'import { sendDockRepair } from "../net/socket";\n' + content
        print("  -> Added sendDockRepair import")
    else:
        # Add to existing import
        line_start = content.rfind('\n', 0, import_match) + 1
        line_end = content.find('\n', import_match)
        old_line = content[line_start:line_end]
        if 'import' in old_line:
            new_line = old_line.replace(' } from "../net/socket"', ', sendDockRepair } from "../net/socket"')
            content = content.replace(old_line, new_line)
            print("  -> Added sendDockRepair to existing socket import")
        else:
            content = 'import { sendDockRepair } from "../net/socket";\n' + content
            print("  -> Added sendDockRepair import at top")

# Add sendDockRepair call after hull repair
old_repair = '''    player.credits -= repairCost;
    player.hull = stats.hullMax;
    pushNotification(`Hull repaired · -${repairCost}cr`, "good");
    save(); bump();'''

new_repair = '''    player.credits -= repairCost;
    player.hull = stats.hullMax;
    sendDockRepair(stats.hullMax, player.shield);
    pushNotification(`Hull repaired · -${repairCost}cr`, "good");
    save(); bump();'''

if old_repair in content:
    content = content.replace(old_repair, new_repair)
    print("  -> Added sendDockRepair call after hull repair")
else:
    print("  -> WARNING: Could not find repair code in Hangar.tsx")

# Add sendDockRepair call after shield recharge
old_shield = '''    player.shield = stats.shieldMax;
    pushNotification("Shields recharged", "good");
    save(); bump();'''

new_shield = '''    player.shield = stats.shieldMax;
    sendDockRepair(player.hull, stats.shieldMax);
    pushNotification("Shields recharged", "good");
    save(); bump();'''

if old_shield in content:
    content = content.replace(old_shield, new_shield)
    print("  -> Added sendDockRepair call after shield recharge")
else:
    print("  -> WARNING: Could not find shield recharge code")

with open('frontend/src/components/Hangar.tsx', 'w') as f:
    f.write(content)

# ── FIX: store.ts - Also sync autoRepair/autoShield dock services to server ──
print("FIX: store.ts - sync auto-repair to server...")
with open('frontend/src/game/store.ts', 'r') as f:
    content = f.read()

# Check if sendDockRepair is imported
if 'sendDockRepair' not in content:
    old_import = 'import { sendStatsUpdate } from "../net/socket";'
    new_import = 'import { sendStatsUpdate, sendDockRepair } from "../net/socket";'
    if old_import in content:
        content = content.replace(old_import, new_import)
        print("  -> Added sendDockRepair to socket import")
    else:
        # Try alternative import patterns
        import re
        m = re.search(r'(import \{[^}]*\} from ["\']\.\.\/net\/socket["\'];)', content)
        if m:
            old_imp = m.group(1)
            new_imp = old_imp.replace(' } from', ', sendDockRepair } from')
            content = content.replace(old_imp, new_imp)
            print("  -> Added sendDockRepair to socket import (pattern 2)")
        else:
            print("  -> WARNING: Could not find socket import in store.ts")

# Add sendDockRepair after autoRepairIfEnabled sets hull
old_auto = '''  p.credits -= cost;
  p.hull = hullMax;
  bumpMission("spend-credits", cost);'''

new_auto = '''  p.credits -= cost;
  p.hull = hullMax;
  sendDockRepair(hullMax, p.shield);
  bumpMission("spend-credits", cost);'''

if old_auto in content:
    content = content.replace(old_auto, new_auto)
    print("  -> Added sendDockRepair to autoRepairIfEnabled")
else:
    print("  -> WARNING: Could not find autoRepair hull set")

# Add sendDockRepair after autoShieldIfEnabled sets shield
old_auto_shield = '''  if (p.shield >= shieldMax) return;
  p.shield = shieldMax;'''

new_auto_shield = '''  if (p.shield >= shieldMax) return;
  p.shield = shieldMax;
  sendDockRepair(p.hull, shieldMax);'''

if old_auto_shield in content:
    content = content.replace(old_auto_shield, new_auto_shield)
    print("  -> Added sendDockRepair to autoShieldIfEnabled")
else:
    print("  -> WARNING: Could not find autoShield set")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(content)

print("\nStation repair fix complete!")
