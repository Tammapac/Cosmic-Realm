#!/usr/bin/env python3
"""Fix mining beam visibility for other players."""

# ── FIX 1: handler.ts - Add miningTargetId to nearbyPlayers + entity data ──
print("FIX 1: handler.ts - include miningTargetId in player entities...")
with open('backend/src/socket/handler.ts', 'r') as f:
    content = f.read()

old_nearby = '''              nearbyPlayers.push({
                id: other.playerId,
                name: other.name,
                shipClass: other.shipClass,
                level: other.level,
                faction: other.faction,
                honor: other.honor,
                x: other.posX, y: other.posY,
                vx: other.velX, vy: other.velY,
                a: other.angle,
                hp: other.hull, sp: other.shield,
              });'''

new_nearby = '''              nearbyPlayers.push({
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
              });'''

if old_nearby in content:
    content = content.replace(old_nearby, new_nearby)
    print("  -> Added miningTargetId to nearbyPlayers")
else:
    print("  -> WARNING: Could not find nearbyPlayers push")

old_entity = '''              name: o.name, shipClass: o.shipClass, level: o.level, faction: o.faction, honor: o.honor,'''

new_entity = '''              name: o.name, shipClass: o.shipClass, level: o.level, faction: o.faction, honor: o.honor, miningTargetId: o.miningTargetId,'''

if old_entity in content:
    content = content.replace(old_entity, new_entity)
    print("  -> Added miningTargetId to entity data")
else:
    print("  -> WARNING: Could not find entity data")

with open('backend/src/socket/handler.ts', 'w') as f:
    f.write(content)


# ── FIX 2: socket.ts - Add miningTargetId to DeltaEntity type ──
print("FIX 2: socket.ts - add miningTargetId to DeltaEntity...")
with open('frontend/src/net/socket.ts', 'r') as f:
    content = f.read()

old_delta = '''  // Asteroid-specific
  yields?: string;'''

new_delta = '''  // Asteroid-specific
  yields?: string;
  // Mining state
  miningTargetId?: string | null;'''

if old_delta in content:
    content = content.replace(old_delta, new_delta)
    print("  -> Added miningTargetId to DeltaEntity")
else:
    print("  -> WARNING: Could not find DeltaEntity yields field")

with open('frontend/src/net/socket.ts', 'w') as f:
    f.write(content)


# ── FIX 3: types.ts - Add miningTargetId to OtherPlayer type ──
print("FIX 3: types.ts - add miningTargetId to OtherPlayer...")
with open('frontend/src/game/types.ts', 'r') as f:
    content = f.read()

old_other = '''  faction: string | null;
  honor: number;
};

export type ChatMessage = {'''

new_other = '''  faction: string | null;
  honor: number;
  miningTargetId: string | null;
};

export type ChatMessage = {'''

if old_other in content:
    content = content.replace(old_other, new_other)
    print("  -> Added miningTargetId to OtherPlayer")
else:
    print("  -> WARNING: Could not find OtherPlayer type end")

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(content)


# ── FIX 4: loop.ts - Pass miningTargetId in applyEntityUpdate + player:join ──
print("FIX 4: loop.ts - pass miningTargetId through entity updates...")
with open('frontend/src/game/loop.ts', 'r') as f:
    content = f.read()

# In the existing player update case
old_update = '''        if (entity.name) o.name = entity.name;
        if (entity.shipClass) o.shipClass = entity.shipClass as any;
        if (entity.level) o.level = entity.level;'''

new_update = '''        if (entity.name) o.name = entity.name;
        if (entity.shipClass) o.shipClass = entity.shipClass as any;
        if (entity.level) o.level = entity.level;
        if (entity.miningTargetId !== undefined) o.miningTargetId = entity.miningTargetId ?? null;'''

if old_update in content:
    content = content.replace(old_update, new_update)
    print("  -> Added miningTargetId to entity update")
else:
    print("  -> WARNING: Could not find entity update code")

# In the new player creation
old_new_player = '''          faction: entity.faction ?? null,
          honor: entity.honor ?? 0,
        });'''

new_new_player = '''          faction: entity.faction ?? null,
          honor: entity.honor ?? 0,
          miningTargetId: entity.miningTargetId ?? null,
        });'''

if old_new_player in content:
    content = content.replace(old_new_player, new_new_player)
    print("  -> Added miningTargetId to new player creation")
else:
    print("  -> WARNING: Could not find new player push")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(content)


# ── FIX 5: App.tsx - Pass miningTargetId in player:join ──
print("FIX 5: App.tsx - pass miningTargetId in player:join...")
with open('frontend/src/App.tsx', 'r') as f:
    content = f.read()

old_join = '''          faction: (p as any).faction ?? null,
          honor: (p as any).honor ?? 0,
        });'''

new_join = '''          faction: (p as any).faction ?? null,
          honor: (p as any).honor ?? 0,
          miningTargetId: null,
        });'''

if old_join in content:
    content = content.replace(old_join, new_join)
    print("  -> Added miningTargetId to player:join")
else:
    print("  -> WARNING: Could not find player:join push")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(content)


# ── FIX 6: render.ts - Draw mining beam for other players ──
print("FIX 6: render.ts - draw mining beam for other players...")
with open('frontend/src/game/render.ts', 'r') as f:
    content = f.read()

# Find drawOtherPlayer and add mining beam rendering
old_draw = '''  if (o.clan) {
    ctx.fillStyle = "#4ee2ff";
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(`<${o.clan}>`, o.pos.x, nameY + 30);
  }
}

function drawNpcShip'''

new_draw = '''  if (o.clan) {
    ctx.fillStyle = "#4ee2ff";
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(`<${o.clan}>`, o.pos.x, nameY + 30);
  }
  if (o.miningTargetId) {
    const ta = state.asteroids.find((a: any) => a.id === o.miningTargetId);
    if (ta) {
      const t = state.tick;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 18));
      ctx.save();
      ctx.lineCap = "round";
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 16;
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 12);
      ctx.strokeStyle = "#44ffcc";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(o.pos.x, o.pos.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2 + pulse;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(o.pos.x, o.pos.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.strokeStyle = "#44ffcc";
      ctx.lineWidth = 1 + pulse * 0.4;
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(o.pos.x, o.pos.y);
      ctx.lineTo(ta.pos.x, ta.pos.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#44ffcc";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ta.pos.x, ta.pos.y, 2 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawNpcShip'''

if old_draw in content:
    content = content.replace(old_draw, new_draw)
    print("  -> Added mining beam rendering for other players")
else:
    print("  -> WARNING: Could not find drawOtherPlayer end")

with open('frontend/src/game/render.ts', 'w') as f:
    f.write(content)


print("\nMining beam fix complete!")
