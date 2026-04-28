#!/usr/bin/env python3
"""Fix skill reset to grant correct total points based on player level."""

with open('frontend/src/game/store.ts', 'r') as f:
    code = f.read()

old_reset = """export function resetSkills(): void {
  const p = state.player;
  if (p.credits < 2000) { pushNotification("Respec costs 2000cr", "bad"); return; }
  let totalSpent = 0;
  for (const node of SKILL_NODES) {
    const r = p.skills[node.id] ?? 0;
    totalSpent += r * node.cost;
  }
  p.credits -= 2000;
  p.skills = {};
  p.skillPoints += totalSpent;
  pushNotification(`Skills reset · refunded ${totalSpent} pts`, "good");
  save(); bump();
}"""

new_reset = """export function resetSkills(): void {
  const p = state.player;
  if (p.credits < 2000) { pushNotification("Respec costs 2000cr", "bad"); return; }
  p.credits -= 2000;
  p.skills = {};
  p.skillPoints = Math.max(0, p.level - 1);
  pushNotification(`Skills reset · ${p.skillPoints} pts available`, "good");
  save(); bump();
}"""

if old_reset in code:
    code = code.replace(old_reset, new_reset)
    print("-> resetSkills now grants (level - 1) total points regardless of previous state")
    print("   Level 7 player will get 6 skill points on reset")
else:
    print("-> WARNING: Could not find resetSkills function")

with open('frontend/src/game/store.ts', 'w') as f:
    f.write(code)

print("DONE!")
