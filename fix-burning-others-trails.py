#!/usr/bin/env python3
"""Fix: 1) Other players burning visible, 2) Thinner enemy/NPC trails."""

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1: ADD hullMax TO OTHER PLAYER SNAPSHOTS (SERVER)
# ══════════════════════════════════════════════════════════════════════════════
print("═══ FIX 1a: Server sends hullMax for other players ═══")

with open('backend/src/socket/handler.ts', 'r') as f:
    hc = f.read()

old_nearby = """              nearbyPlayers.push({
                id: other.playerId,
                name: other.name,
                shipClass: other.shipClass,
                level: other.level,
                faction: other.faction,
                honor: other.honor,
                miningTargetId: other.miningTargetId,
                x: other.posX, y: other.posY,
                vx: other.velX, vy: other.velY,
                a: other.angle,
                hp: other.hull, sp: other.shield,
              });"""

new_nearby = """              nearbyPlayers.push({
                id: other.playerId,
                name: other.name,
                shipClass: other.shipClass,
                level: other.level,
                faction: other.faction,
                honor: other.honor,
                miningTargetId: other.miningTargetId,
                x: other.posX, y: other.posY,
                vx: other.velX, vy: other.velY,
                a: other.angle,
                hp: other.hull, hpMax: other.hullMax, sp: other.shield,
              });"""

if old_nearby in hc:
    hc = hc.replace(old_nearby, new_nearby)
    print("  -> Added hpMax to nearby player snapshot")
else:
    print("  -> WARNING: Could not find nearby player push")

# Also add hpMax to the entity push
old_entity_push = """          for (const o of nearbyPlayers) {
            entities.push({
              id: `p-${o.id}`, entityType: "player",
              x: o.x, y: o.y, vx: o.vx, vy: o.vy, angle: o.a,
              hp: o.hp, shield: o.sp, version: tickCounter,
              name: o.name, shipClass: o.shipClass, level: o.level, faction: o.faction, honor: o.honor, miningTargetId: o.miningTargetId,
            });"""

new_entity_push = """          for (const o of nearbyPlayers) {
            entities.push({
              id: `p-${o.id}`, entityType: "player",
              x: o.x, y: o.y, vx: o.vx, vy: o.vy, angle: o.a,
              hp: o.hp, hpMax: o.hpMax, shield: o.sp, version: tickCounter,
              name: o.name, shipClass: o.shipClass, level: o.level, faction: o.faction, honor: o.honor, miningTargetId: o.miningTargetId,
            });"""

if old_entity_push in hc:
    hc = hc.replace(old_entity_push, new_entity_push)
    print("  -> Added hpMax to player entity snapshot")
else:
    print("  -> WARNING: Could not find player entity push")

with open('backend/src/socket/handler.ts', 'w') as f:
    f.write(hc)

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1b: ADD hull/hullMax FIELDS TO OtherPlayer TYPE
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ FIX 1b: Add hull/hullMax to OtherPlayer type ═══")

with open('frontend/src/game/types.ts', 'r') as f:
    tc = f.read()

old_other_type = """export type OtherPlayer = {
  id: string;
  name: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  level: number;
  shipClass: ShipClassId;
  zone: ZoneId;
  inParty: boolean;
  clan: string | null;
  faction: string | null;
  honor: number;
  miningTargetId: string | null;
};"""

new_other_type = """export type OtherPlayer = {
  id: string;
  name: string;
  pos: Vec2;
  vel: Vec2;
  angle: number;
  level: number;
  shipClass: ShipClassId;
  zone: ZoneId;
  inParty: boolean;
  clan: string | null;
  faction: string | null;
  honor: number;
  miningTargetId: string | null;
  hull: number;
  hullMax: number;
  shield: number;
};"""

if old_other_type in tc:
    tc = tc.replace(old_other_type, new_other_type)
    print("  -> Added hull, hullMax, shield to OtherPlayer type")
else:
    print("  -> WARNING: Could not find OtherPlayer type")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(tc)

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1c: UPDATE CLIENT ENTITY SYNC FOR OTHER PLAYERS
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ FIX 1c: Update client entity sync ═══")

with open('frontend/src/game/loop.ts', 'r') as f:
    lc = f.read()

# Update existing player sync to also handle hullMax
old_player_sync = """        if (entity.hp != null) o.hull = entity.hp;
        if (entity.shield != null) o.shield = entity.shield;"""

new_player_sync = """        if (entity.hp != null) o.hull = entity.hp;
        if (entity.hpMax != null) o.hullMax = entity.hpMax;
        if (entity.shield != null) o.shield = entity.shield;"""

if old_player_sync in lc:
    lc = lc.replace(old_player_sync, new_player_sync)
    print("  -> Updated existing player sync with hullMax")
else:
    print("  -> WARNING: Could not find player sync update")

# Update new player creation to include hull/hullMax/shield
old_player_create = """        state.others.push({
          id: numId,
          name: entity.name || "Pilot",
          shipClass: (entity.shipClass || "skimmer") as any,
          level: entity.level || 1,
          clan: null,
          zone: state.player.zone as any,
          pos: { x: entity.x, y: entity.y },
          vel: { x: entity.vx || 0, y: entity.vy || 0 },
          angle: entity.angle || 0,
          inParty: false,
          faction: entity.faction ?? null,
          honor: entity.honor ?? 0,
          miningTargetId: entity.miningTargetId ?? null,
        });"""

new_player_create = """        state.others.push({
          id: numId,
          name: entity.name || "Pilot",
          shipClass: (entity.shipClass || "skimmer") as any,
          level: entity.level || 1,
          clan: null,
          zone: state.player.zone as any,
          pos: { x: entity.x, y: entity.y },
          vel: { x: entity.vx || 0, y: entity.vy || 0 },
          angle: entity.angle || 0,
          inParty: false,
          faction: entity.faction ?? null,
          honor: entity.honor ?? 0,
          miningTargetId: entity.miningTargetId ?? null,
          hull: entity.hp ?? 100,
          hullMax: entity.hpMax ?? 100,
          shield: entity.shield ?? 0,
        });"""

if old_player_create in lc:
    lc = lc.replace(old_player_create, new_player_create)
    print("  -> Updated new player creation with hull/hullMax/shield")
else:
    print("  -> WARNING: Could not find player creation push")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1d: ADD BURNING EFFECTS FOR OTHER PLAYERS IN THE SMOOTHING LOOP
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ FIX 1d: Add burning effects for other players ═══")

# Find the other players loop in the smoothing section and add burning after the trail
old_other_trail = """        const back = o.angle + Math.PI;
        emitTrail(o.pos.x + Math.cos(back) * 8, o.pos.y + Math.sin(back) * 8, "#4ee2ff");
      }
    }
  }
  for (const e of state.enemies) {"""

new_other_trail = """        const back = o.angle + Math.PI;
        emitTrail(o.pos.x + Math.cos(back) * 8, o.pos.y + Math.sin(back) * 8, "#4ee2ff");
      }
    }
    // Burning smoke/fire for other players below 30% HP
    if (o.hullMax > 0 && o.hull / o.hullMax < 0.3 && Math.random() < 0.4) {
      const pox = (Math.random() - 0.5) * 14;
      const poy = (Math.random() - 0.5) * 14;
      if (Math.random() < 0.6) {
        state.particles.push({
          id: `ofire-${Math.random().toString(36).slice(2, 6)}`,
          pos: { x: o.pos.x + pox, y: o.pos.y + poy },
          vel: { x: (Math.random() - 0.5) * 20 + o.vel.x * 0.15, y: (Math.random() - 0.5) * 20 + o.vel.y * 0.15 },
          ttl: 0.3 + Math.random() * 0.3, maxTtl: 0.6,
          color: Math.random() > 0.4 ? "#ff8c00" : "#ff4500",
          size: 2.5 + Math.random() * 3, kind: "ember",
        });
      } else {
        state.particles.push({
          id: `osmk-${Math.random().toString(36).slice(2, 6)}`,
          pos: { x: o.pos.x + pox, y: o.pos.y + poy },
          vel: { x: (Math.random() - 0.5) * 10, y: (Math.random() - 0.5) * 10 - 6 },
          ttl: 0.4 + Math.random() * 0.4, maxTtl: 0.8,
          color: "#444",
          size: 3 + Math.random() * 4, kind: "smoke",
        });
      }
    }
  }
  for (const e of state.enemies) {"""

if old_other_trail in lc:
    lc = lc.replace(old_other_trail, new_other_trail)
    print("  -> Added burning fire/smoke for other players below 30% HP")
else:
    print("  -> WARNING: Could not find other player trail section")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 2: MAKE ENEMY/NPC TRAILS THINNER AND SMALLER
# ══════════════════════════════════════════════════════════════════════════════
print("\n═══ FIX 2: Thinner enemy/NPC trails ═══")

# The emitTrail function uses size: 5 for all trails.
# We need to make enemy/NPC trails smaller. Add a size parameter to emitTrail.

old_emit = """function emitTrail(x: number, y: number, color: string, alpha?: number): void {
  state.particles.push({
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: 2.0, maxTtl: 2.0,
    color, size: 5, kind: "trail",
    ...(alpha !== undefined ? { alpha } : {}),
  });
}"""

new_emit = """function emitTrail(x: number, y: number, color: string, alpha?: number, size?: number): void {
  state.particles.push({
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    pos: { x, y }, vel: { x: 0, y: 0 },
    ttl: 2.0, maxTtl: 2.0,
    color, size: size ?? 5, kind: "trail",
    ...(alpha !== undefined ? { alpha } : {}),
  });
}"""

if old_emit in lc:
    lc = lc.replace(old_emit, new_emit)
    print("  -> emitTrail now accepts optional size parameter")
else:
    print("  -> WARNING: Could not find emitTrail function")

# Now update all enemy/NPC trail calls to use size 2.5 (half of default 5)

# Enemy server mode trail
old_e_server = "emitTrail(e.pos.x + Math.cos(eBack2) * (e.size * 0.6), e.pos.y + Math.sin(eBack2) * (e.size * 0.6), e.color, 0.5);"
new_e_server = "emitTrail(e.pos.x + Math.cos(eBack2) * (e.size * 0.6), e.pos.y + Math.sin(eBack2) * (e.size * 0.6), e.color, 0.5, 2.5);"
if old_e_server in lc:
    lc = lc.replace(old_e_server, new_e_server)
    changes = 1
    print("  -> Enemy trail (server) size: 5 -> 2.5")

# Enemy local mode trail
old_e_local = "emitTrail(e.pos.x + Math.cos(eBack) * (e.size * 0.6), e.pos.y + Math.sin(eBack) * (e.size * 0.6), e.color, 0.5);"
new_e_local = "emitTrail(e.pos.x + Math.cos(eBack) * (e.size * 0.6), e.pos.y + Math.sin(eBack) * (e.size * 0.6), e.color, 0.5, 2.5);"
if old_e_local in lc:
    lc = lc.replace(old_e_local, new_e_local)
    print("  -> Enemy trail (local) size: 5 -> 2.5")

# NPC server mode trail
old_n_server = "emitTrail(npc.pos.x + Math.cos(nb) * 7, npc.pos.y + Math.sin(nb) * 7, npc.color, 0.5);"
new_n_server = "emitTrail(npc.pos.x + Math.cos(nb) * 7, npc.pos.y + Math.sin(nb) * 7, npc.color, 0.5, 2.5);"
if old_n_server in lc:
    lc = lc.replace(old_n_server, new_n_server)
    print("  -> NPC trail (server) size: 5 -> 2.5")

# NPC local mode trail
old_n_local = "emitTrail(npc.pos.x + Math.cos(nBack) * 7, npc.pos.y + Math.sin(nBack) * 7, npc.color, 0.5);"
new_n_local = "emitTrail(npc.pos.x + Math.cos(nBack) * 7, npc.pos.y + Math.sin(nBack) * 7, npc.color, 0.5, 2.5);"
if old_n_local in lc:
    lc = lc.replace(old_n_local, new_n_local)
    print("  -> NPC trail (local) size: 5 -> 2.5")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(lc)

print("\n" + "=" * 50)
print("DONE!")
print("  1) Other players' burning effects now visible (fire+smoke below 30% HP)")
print("  2) Enemy/NPC trails are now half the size (2.5 instead of 5)")
