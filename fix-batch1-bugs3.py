#!/usr/bin/env python3
"""Fix floater stacking + add burning trails for damaged ships."""

with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# ══════════════════════════════════════════════════════════════════════════════
# FIX 4: FLOATER FONTS STACKING ON TOP OF EACH OTHER
# The loot box drop creates multiple floaters at the same Y position.
# Offset the kill floaters vertically so they spread out.
# ══════════════════════════════════════════════════════════════════════════════
print("═══ FIX 4: Floater text stacking ═══")

# The kill floaters in onEnemyDie all spawn at similar Y positions
old_floaters = """  pushFloater({ text: `+${loot.exp} XP`, color: "#ff5cf0", x: pos.x, y: pos.y - 20, scale: 0.9 });
  pushFloater({ text: `+${loot.credits} CR`, color: "#ffd24a", x: pos.x + 20, y: pos.y - 8, scale: 0.9 });
  if (loot.honor > 0) pushFloater({ text: `+${loot.honor} H`, color: "#c8a0ff", x: pos.x - 20, y: pos.y - 8, scale: 0.8 });"""

new_floaters = """  pushFloater({ text: `+${loot.exp} XP`, color: "#ff5cf0", x: pos.x - 15, y: pos.y - 30, scale: 0.9 });
  pushFloater({ text: `+${loot.credits} CR`, color: "#ffd24a", x: pos.x + 15, y: pos.y - 16, scale: 0.9 });
  if (loot.honor > 0) pushFloater({ text: `+${loot.honor} H`, color: "#c8a0ff", x: pos.x, y: pos.y - 2, scale: 0.8 });"""

if old_floaters in lc:
    lc = lc.replace(old_floaters, new_floaters)
    print("  -> Kill floaters now spread vertically (XP top, CR middle, Honor bottom)")
else:
    print("  -> WARNING: Could not find floater section")


# ══════════════════════════════════════════════════════════════════════════════
# FIX 5: BURNING TRAILS FOR DAMAGED SHIPS (<30% HP)
# Enemies, NPCs, and player ships emit fire/smoke particles when below 30% HP.
# This runs in the main game loop for all visible entities.
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ FIX 5: Burning trails for damaged ships ═══")

# Add damage smoke/fire emission in the enemy serverAuthoritative block
# (where we already added trail emission)
old_enemy_trail_server = """      // Enemy engine trail even in server mode
      const eSpd2 = Math.sqrt(e.vel.x * e.vel.x + e.vel.y * e.vel.y);
      if (eSpd2 > 15) {
        const eBack2 = e.angle + Math.PI;
        if (Math.random() < Math.min(0.7, eSpd2 / 100)) {
          emitTrail(e.pos.x + Math.cos(eBack2) * (e.size * 0.6), e.pos.y + Math.sin(eBack2) * (e.size * 0.6), e.color);
        }
      }
      continue;"""

new_enemy_trail_server = """      // Enemy engine trail even in server mode
      const eSpd2 = Math.sqrt(e.vel.x * e.vel.x + e.vel.y * e.vel.y);
      if (eSpd2 > 15) {
        const eBack2 = e.angle + Math.PI;
        if (Math.random() < Math.min(0.7, eSpd2 / 100)) {
          emitTrail(e.pos.x + Math.cos(eBack2) * (e.size * 0.6), e.pos.y + Math.sin(eBack2) * (e.size * 0.6), e.color);
        }
      }
      // Burning smoke/fire when damaged (<30% HP)
      if (e.hullMax > 0 && e.hull / e.hullMax < 0.3) {
        const dmgRate = 1 - (e.hull / e.hullMax) / 0.3;
        if (Math.random() < 0.3 + dmgRate * 0.4) {
          const ox = (Math.random() - 0.5) * e.size;
          const oy = (Math.random() - 0.5) * e.size;
          if (Math.random() < 0.6) {
            state.particles.push({
              id: `efire-${Math.random().toString(36).slice(2, 6)}`,
              pos: { x: e.pos.x + ox, y: e.pos.y + oy },
              vel: { x: (Math.random() - 0.5) * 20 + e.vel.x * 0.2, y: (Math.random() - 0.5) * 20 + e.vel.y * 0.2 },
              ttl: 0.25 + Math.random() * 0.3, maxTtl: 0.55,
              color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
              size: 2.5 + Math.random() * 3, kind: "ember",
            });
          } else {
            state.particles.push({
              id: `esmk-${Math.random().toString(36).slice(2, 6)}`,
              pos: { x: e.pos.x + ox, y: e.pos.y + oy },
              vel: { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 - 8 },
              ttl: 0.4 + Math.random() * 0.4, maxTtl: 0.8,
              color: "#444",
              size: 3 + Math.random() * 4, kind: "smoke",
            });
          }
        }
      }
      continue;"""

if old_enemy_trail_server in lc:
    lc = lc.replace(old_enemy_trail_server, new_enemy_trail_server)
    print("  -> Enemies emit fire + smoke when below 30% HP (server mode)")
else:
    print("  -> WARNING: Could not find enemy trail server block")

# Also add for the local (non-server) enemy path
old_enemy_trail_local = """    // Enemy engine trail (like player trails but in enemy color)
    const eSpd = Math.sqrt(e.vel.x * e.vel.x + e.vel.y * e.vel.y);
    if (eSpd > 20) {
      const eBack = e.angle + Math.PI;
      const trailChance = Math.min(1, eSpd / 120);
      if (Math.random() < trailChance * 0.6) {
        emitTrail(e.pos.x + Math.cos(eBack) * (e.size * 0.6), e.pos.y + Math.sin(eBack) * (e.size * 0.6), e.color);
      }
    }

    // Firing: only when aggroed"""

new_enemy_trail_local = """    // Enemy engine trail (like player trails but in enemy color)
    const eSpd = Math.sqrt(e.vel.x * e.vel.x + e.vel.y * e.vel.y);
    if (eSpd > 20) {
      const eBack = e.angle + Math.PI;
      const trailChance = Math.min(1, eSpd / 120);
      if (Math.random() < trailChance * 0.6) {
        emitTrail(e.pos.x + Math.cos(eBack) * (e.size * 0.6), e.pos.y + Math.sin(eBack) * (e.size * 0.6), e.color);
      }
    }
    // Burning smoke/fire when damaged (<30% HP) - local mode
    if (e.hullMax > 0 && e.hull / e.hullMax < 0.3) {
      const dmgRate = 1 - (e.hull / e.hullMax) / 0.3;
      if (Math.random() < 0.3 + dmgRate * 0.4) {
        const ox = (Math.random() - 0.5) * e.size;
        const oy = (Math.random() - 0.5) * e.size;
        if (Math.random() < 0.6) {
          state.particles.push({
            id: `efire-${Math.random().toString(36).slice(2, 6)}`,
            pos: { x: e.pos.x + ox, y: e.pos.y + oy },
            vel: { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 },
            ttl: 0.25 + Math.random() * 0.3, maxTtl: 0.55,
            color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
            size: 2.5 + Math.random() * 3, kind: "ember",
          });
        } else {
          state.particles.push({
            id: `esmk-${Math.random().toString(36).slice(2, 6)}`,
            pos: { x: e.pos.x + ox, y: e.pos.y + oy },
            vel: { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 12 - 8 },
            ttl: 0.4 + Math.random() * 0.4, maxTtl: 0.8,
            color: "#444",
            size: 3 + Math.random() * 4, kind: "smoke",
          });
        }
      }
    }

    // Firing: only when aggroed"""

if old_enemy_trail_local in lc:
    lc = lc.replace(old_enemy_trail_local, new_enemy_trail_local)
    print("  -> Enemies emit fire + smoke when below 30% HP (local mode)")
else:
    print("  -> WARNING: Could not find enemy trail local block")

# Add burning trails for NPC ships (in the server-mode NPC trail block)
old_npc_trail_server = """    } else {
      // NPC trails in server mode (positions come from server ticks)
      for (const npc of state.npcShips) {
        const ns = Math.sqrt(npc.vel.x * npc.vel.x + npc.vel.y * npc.vel.y);
        if (ns > 15) {
          if (Math.abs(npc.vel.x) > 1 || Math.abs(npc.vel.y) > 1) {
            npc.angle = Math.atan2(npc.vel.y, npc.vel.x);
          }
          const nb = npc.angle + Math.PI;
          if (Math.random() < 0.5) {
            emitTrail(npc.pos.x + Math.cos(nb) * 7, npc.pos.y + Math.sin(nb) * 7, npc.color);
          }
        }
      }
    }
  }"""

new_npc_trail_server = """    } else {
      // NPC trails + damage effects in server mode
      for (const npc of state.npcShips) {
        const ns = Math.sqrt(npc.vel.x * npc.vel.x + npc.vel.y * npc.vel.y);
        if (ns > 15) {
          if (Math.abs(npc.vel.x) > 1 || Math.abs(npc.vel.y) > 1) {
            npc.angle = Math.atan2(npc.vel.y, npc.vel.x);
          }
          const nb = npc.angle + Math.PI;
          if (Math.random() < 0.5) {
            emitTrail(npc.pos.x + Math.cos(nb) * 7, npc.pos.y + Math.sin(nb) * 7, npc.color);
          }
        }
        // NPC burning when damaged
        if (npc.hullMax > 0 && npc.hull / npc.hullMax < 0.3 && Math.random() < 0.35) {
          const ox = (Math.random() - 0.5) * npc.size;
          const oy = (Math.random() - 0.5) * npc.size;
          state.particles.push({
            id: `nfire-${Math.random().toString(36).slice(2, 6)}`,
            pos: { x: npc.pos.x + ox, y: npc.pos.y + oy },
            vel: { x: (Math.random() - 0.5) * 15, y: (Math.random() - 0.5) * 15 },
            ttl: 0.25 + Math.random() * 0.25, maxTtl: 0.5,
            color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
            size: 2 + Math.random() * 2.5, kind: "ember",
          });
        }
      }
    }
  }"""

if old_npc_trail_server in lc:
    lc = lc.replace(old_npc_trail_server, new_npc_trail_server)
    print("  -> NPCs emit fire when below 30% HP")
else:
    print("  -> WARNING: Could not find NPC trail server block")

# Add burning trails for the PLAYER ship when below 30% HP
# Find the player engine trail section
old_player_trail = """  // ── Engine particles + 16-bit trail + thruster sound
  const cls = SHIP_CLASSES[p.shipClass];
  const shipSpeed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
  if (shipSpeed > 30) {
    sfx.thrusterStart();
    sfx.thrusterUpdate(Math.min(1, shipSpeed / stats.speed));
    trailTimer -= dt;
    if (trailTimer <= 0) {
      const back = p.angle + Math.PI;
      emitTrail(p.pos.x + Math.cos(back) * 8, p.pos.y + Math.sin(back) * 8, "#4ee2ff");
      trailTimer = 0.08;
    }
  } else {
    sfx.thrusterUpdate(0);
  }"""

new_player_trail = """  // ── Engine particles + 16-bit trail + thruster sound
  const cls = SHIP_CLASSES[p.shipClass];
  const shipSpeed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
  if (shipSpeed > 30) {
    sfx.thrusterStart();
    sfx.thrusterUpdate(Math.min(1, shipSpeed / stats.speed));
    trailTimer -= dt;
    if (trailTimer <= 0) {
      const back = p.angle + Math.PI;
      emitTrail(p.pos.x + Math.cos(back) * 8, p.pos.y + Math.sin(back) * 8, "#4ee2ff");
      trailTimer = 0.08;
    }
  } else {
    sfx.thrusterUpdate(0);
  }
  // Player ship burning when damaged (<30% HP)
  if (stats.hullMax > 0 && p.hull / stats.hullMax < 0.3 && Math.random() < 0.4) {
    const pox = (Math.random() - 0.5) * 14;
    const poy = (Math.random() - 0.5) * 14;
    if (Math.random() < 0.6) {
      state.particles.push({
        id: `pfire-${Math.random().toString(36).slice(2, 6)}`,
        pos: { x: p.pos.x + pox, y: p.pos.y + poy },
        vel: { x: (Math.random() - 0.5) * 20 + p.vel.x * 0.15, y: (Math.random() - 0.5) * 20 + p.vel.y * 0.15 },
        ttl: 0.3 + Math.random() * 0.3, maxTtl: 0.6,
        color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
        size: 2.5 + Math.random() * 3, kind: "ember",
      });
    } else {
      state.particles.push({
        id: `psmk-${Math.random().toString(36).slice(2, 6)}`,
        pos: { x: p.pos.x + pox, y: p.pos.y + poy },
        vel: { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 - 6 },
        ttl: 0.4 + Math.random() * 0.4, maxTtl: 0.8,
        color: "#444",
        size: 3 + Math.random() * 4, kind: "smoke",
      });
    }
  }"""

if old_player_trail in lc:
    lc = lc.replace(old_player_trail, new_player_trail)
    print("  -> Player ship emits fire + smoke when below 30% HP")
else:
    print("  -> WARNING: Could not find player trail block")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

print("\n" + "=" * 50)
print("DONE! Floater stacking fixed + damage smoke/fire on all ships.")
