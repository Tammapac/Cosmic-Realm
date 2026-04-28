#!/usr/bin/env python3
"""Make enemy/NPC engine trails 50% transparent."""

# ══════════════════════════════════════════════════════════════════════════════
# 1. Add optional alpha field to Particle type
# ══════════════════════════════════════════════════════════════════════════════
print("═══ Adding alpha to Particle type ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    tc = f.read()

old_particle = """  kind?: "trail" | "spark" | "ring" | "engine" | "flash" | "debris" | "fireball" | "smoke" | "ember";
};"""

new_particle = """  kind?: "trail" | "spark" | "ring" | "engine" | "flash" | "debris" | "fireball" | "smoke" | "ember";
  alpha?: number;
};"""

if old_particle in tc:
    tc = tc.replace(old_particle, new_particle)
    print("  -> Added optional alpha field to Particle type")
else:
    print("  -> WARNING: Could not find Particle type")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(tc)

# ══════════════════════════════════════════════════════════════════════════════
# 2. Update drawParticle to use pa.alpha for trail kind
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating trail rendering to use alpha ═══")

with open('frontend/src/game/render.ts', 'r') as f:
    rc = f.read()

old_trail_draw = """  if (pa.kind === "trail") {
    const r = pa.size * a;
    ctx.save();
    ctx.globalAlpha = a * a * 0.5;
    ctx.shadowColor = pa.color;
    ctx.shadowBlur = 6 * a;
    ctx.fillStyle = pa.color;
    ctx.beginPath();
    ctx.arc(pa.pos.x, pa.pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a * a * 0.8;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(pa.pos.x, pa.pos.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }"""

new_trail_draw = """  if (pa.kind === "trail") {
    const r = pa.size * a;
    const baseAlpha = pa.alpha ?? 1;
    ctx.save();
    ctx.globalAlpha = a * a * 0.5 * baseAlpha;
    ctx.shadowColor = pa.color;
    ctx.shadowBlur = 6 * a;
    ctx.fillStyle = pa.color;
    ctx.beginPath();
    ctx.arc(pa.pos.x, pa.pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a * a * 0.8 * baseAlpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(pa.pos.x, pa.pos.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }"""

if old_trail_draw in rc:
    rc = rc.replace(old_trail_draw, new_trail_draw)
    print("  -> Trail rendering now uses pa.alpha multiplier")
else:
    print("  -> WARNING: Could not find trail draw code")

with open('frontend/src/game/render.ts', 'w') as f:
    f.write(rc)

# ══════════════════════════════════════════════════════════════════════════════
# 3. Add alpha: 0.5 to all enemy/NPC emitTrail calls (but NOT player trails)
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Adding alpha: 0.5 to enemy/NPC trail emissions ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

changes = 0

# --- NPC trails (non-server mode, ~line 198) ---
old_npc_trail1 = """        emitTrail(npc.pos.x + Math.cos(nBack) * 7, npc.pos.y + Math.sin(nBack) * 7, npc.color);"""
# There might be multiple occurrences, we need to be careful - let's target specific surrounding context

# NPC trail in the non-serverAuthoritative section (near top of file)
old_npc_section1 = """          emitTrail(npc.pos.x + Math.cos(nBack) * 7, npc.pos.y + Math.sin(nBack) * 7, npc.color);
        }
      }
      // NPC AI - only in local mode"""

if old_npc_section1 in lc:
    new_npc_section1 = old_npc_section1.replace(
        "emitTrail(npc.pos.x + Math.cos(nBack) * 7, npc.pos.y + Math.sin(nBack) * 7, npc.color);",
        "emitTrail(npc.pos.x + Math.cos(nBack) * 7, npc.pos.y + Math.sin(nBack) * 7, npc.color, 0.5);"
    )
    lc = lc.replace(old_npc_section1, new_npc_section1)
    changes += 1
    print("  -> NPC trail (local mode) set to 50% alpha")

# NPC trail in server mode (line ~1089)
old_npc_server = """            emitTrail(npc.pos.x + Math.cos(nb) * 7, npc.pos.y + Math.sin(nb) * 7, npc.color);"""
new_npc_server = """            emitTrail(npc.pos.x + Math.cos(nb) * 7, npc.pos.y + Math.sin(nb) * 7, npc.color, 0.5);"""

if old_npc_server in lc:
    lc = lc.replace(old_npc_server, new_npc_server)
    changes += 1
    print("  -> NPC trail (server mode) set to 50% alpha")

# Enemy trail in server mode (line ~1128)
old_enemy_server = """          emitTrail(e.pos.x + Math.cos(eBack2) * (e.size * 0.6), e.pos.y + Math.sin(eBack2) * (e.size * 0.6), e.color);"""
new_enemy_server = """          emitTrail(e.pos.x + Math.cos(eBack2) * (e.size * 0.6), e.pos.y + Math.sin(eBack2) * (e.size * 0.6), e.color, 0.5);"""

if old_enemy_server in lc:
    lc = lc.replace(old_enemy_server, new_enemy_server)
    changes += 1
    print("  -> Enemy trail (server mode) set to 50% alpha")

# Enemy trail in local mode (line ~1248)
old_enemy_local = """        emitTrail(e.pos.x + Math.cos(eBack) * (e.size * 0.6), e.pos.y + Math.sin(eBack) * (e.size * 0.6), e.color);"""
new_enemy_local = """        emitTrail(e.pos.x + Math.cos(eBack) * (e.size * 0.6), e.pos.y + Math.sin(eBack) * (e.size * 0.6), e.color, 0.5);"""

if old_enemy_local in lc:
    lc = lc.replace(old_enemy_local, new_enemy_local)
    changes += 1
    print("  -> Enemy trail (local mode) set to 50% alpha")

print(f"  -> {changes} trail emissions updated")

# ══════════════════════════════════════════════════════════════════════════════
# 4. Update emitTrail function to accept optional alpha parameter
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ Updating emitTrail function signature ═══")

old_emit = """function emitTrail(x: number, y: number, color: string): void {
  state.particles.push({
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: 2.0, maxTtl: 2.0,
    color, size: 5, kind: "trail",
  });
}"""

new_emit = """function emitTrail(x: number, y: number, color: string, alpha?: number): void {
  state.particles.push({
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: 2.0, maxTtl: 2.0,
    color, size: 5, kind: "trail",
    ...(alpha !== undefined ? { alpha } : {}),
  });
}"""

if old_emit in lc:
    lc = lc.replace(old_emit, new_emit)
    print("  -> emitTrail now accepts optional alpha parameter")
else:
    print("  -> WARNING: Could not find emitTrail function")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

print("\n" + "=" * 50)
print("DONE! Enemy/NPC trails are now 50% transparent, player trails unchanged.")
