#!/usr/bin/env python3
"""Fix: Add bonus resource cargo box + update chat log for bonus loot."""

with open('frontend/src/game/loop.ts', 'r') as f:
    fcode = f.read()

# Add bonus resource box after ammo box, before kill log
old_ammo_to_chat = """  } as any);

  // Kill log in chat
  const eName = e?.name ?? "Enemy";
  const eType = e?.type ?? "unknown";
  pushChat("system", "COMBAT", `Destroyed ${eName} (+${loot.credits} CR, +${loot.exp} XP${loot.resource ? `, +${loot.resource.qty} ${loot.resource.resourceId}` : ""})`);"""

new_ammo_to_chat = """  } as any);

  // Bonus resource box (orange) - extra trade goods
  if ((loot as any).bonusResource && (loot as any).bonusResource.qty > 0) {
    const br = (loot as any).bonusResource;
    state.cargoBoxes.push({
      id: `cb-bonus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      pos: { x: pos.x + (Math.random() - 0.5) * spread, y: pos.y + (Math.random() - 0.5) * spread },
      resourceId: br.resourceId as any,
      qty: br.qty,
      credits: 0, exp: 0, honor: 0,
      ttl: 35,
      color: "#ffaa33",
    } as any);
  }

  // Kill log in chat
  const eName = e?.name ?? "Enemy";
  const eType = e?.type ?? "unknown";
  const bonusStr = (loot as any).bonusResource ? `, +${(loot as any).bonusResource.qty} ${(loot as any).bonusResource.resourceId}` : "";
  pushChat("system", "COMBAT", `Destroyed ${eName} (+${loot.credits} CR, +${loot.exp} XP${loot.resource ? `, +${loot.resource.qty} ${loot.resource.resourceId}` : ""}${bonusStr})`);"""

if old_ammo_to_chat in fcode:
    fcode = fcode.replace(old_ammo_to_chat, new_ammo_to_chat)
    print("-> Added bonus resource orange cargo box + updated chat log")
else:
    print("-> WARNING: Could not find ammo-to-chat section")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(fcode)

print("DONE!")
