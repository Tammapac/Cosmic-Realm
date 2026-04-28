#!/bin/bash
set -e
cd /root/Cosmic-Realm

# ── FIX 1: types.ts - Add faction and honor to OtherPlayer ──
python3 << 'PYEOF'
with open('frontend/src/game/types.ts', 'r') as f:
    content = f.read()

old = '''export type OtherPlayer = {
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
};'''

new = '''export type OtherPlayer = {
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
};'''

content = content.replace(old, new)

with open('frontend/src/game/types.ts', 'w') as f:
    f.write(content)

print("FIX 1 done: OtherPlayer type updated with faction + honor")
PYEOF

# ── FIX 2: handler.ts - Add honor to nearbyPlayers entity data ──
python3 << 'PYEOF'
with open('backend/src/socket/handler.ts', 'r') as f:
    content = f.read()

old = '''              hp: o.hp, shield: o.sp, version: tickCounter,
              name: o.name, shipClass: o.shipClass, level: o.level, faction: o.faction,'''

new = '''              hp: o.hp, shield: o.sp, version: tickCounter,
              name: o.name, shipClass: o.shipClass, level: o.level, faction: o.faction, honor: o.honor,'''

content = content.replace(old, new)

# Also add honor to the nearbyPlayers push
old2 = '''              nearbyPlayers.push({
                id: other.playerId,
                name: other.name,
                shipClass: other.shipClass,
                level: other.level,
                faction: other.faction,
                x: other.posX, y: other.posY,
                vx: other.velX, vy: other.velY,
                a: other.angle,
                hp: other.hull, sp: other.shield,
              });'''

new2 = '''              nearbyPlayers.push({
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

content = content.replace(old2, new2)

with open('backend/src/socket/handler.ts', 'w') as f:
    f.write(content)

print("FIX 2 done: handler.ts sends honor in delta entities")
PYEOF

# ── FIX 3: loop.ts - Pass faction/honor in applyEntityUpdate ──
python3 << 'PYEOF'
with open('frontend/src/game/loop.ts', 'r') as f:
    content = f.read()

# Fix existing player update - sync faction/honor when they change
old_update = '''      if (o) {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        if (entity.angle != null) o.angle = entity.angle;
        if (entity.hp != null) o.hull = entity.hp;
        if (entity.shield != null) o.shield = entity.shield;
      } else {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        state.others.push({
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
        });
      }'''

new_update = '''      if (o) {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        if (entity.angle != null) o.angle = entity.angle;
        if (entity.hp != null) o.hull = entity.hp;
        if (entity.shield != null) o.shield = entity.shield;
        if (entity.faction !== undefined) o.faction = entity.faction ?? null;
        if (entity.honor != null) o.honor = entity.honor;
        if (entity.name) o.name = entity.name;
        if (entity.shipClass) o.shipClass = entity.shipClass as any;
        if (entity.level) o.level = entity.level;
      } else {
        setEntityTarget(entity.id, entity.x, entity.y, entity.vx ?? 0, entity.vy ?? 0);
        state.others.push({
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
        });
      }'''

content = content.replace(old_update, new_update)

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(content)

print("FIX 3 done: loop.ts passes faction/honor in applyEntityUpdate")
PYEOF

# ── FIX 4: App.tsx - Pass faction/honor in player:join ──
python3 << 'PYEOF'
with open('frontend/src/App.tsx', 'r') as f:
    content = f.read()

old_join = '''      onPlayerJoin: (p) => {
        const sid = String(p.id);
        if (state.others.find((o) => o.id === sid)) return;
        state.others.push({
          id: sid, name: p.name, shipClass: p.shipClass as any,
          level: p.level, clan: null, zone: p.zone as any,
          pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, angle: 0,
          inParty: false,
        });'''

new_join = '''      onPlayerJoin: (p) => {
        const sid = String(p.id);
        if (state.others.find((o) => o.id === sid)) return;
        state.others.push({
          id: sid, name: p.name, shipClass: p.shipClass as any,
          level: p.level, clan: null, zone: p.zone as any,
          pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, angle: 0,
          inParty: false,
          faction: (p as any).faction ?? null,
          honor: (p as any).honor ?? 0,
        });'''

content = content.replace(old_join, new_join)

with open('frontend/src/App.tsx', 'w') as f:
    f.write(content)

print("FIX 4 done: App.tsx passes faction/honor in player:join")
PYEOF

# ── FIX 5: render.ts - Draw faction diamond + rank symbol for other players ──
python3 << 'PYEOF'
with open('frontend/src/game/render.ts', 'r') as f:
    content = f.read()

old_draw = '''function drawOtherPlayer(ctx: CanvasRenderingContext2D, o: OtherPlayer): void {
  drawShip(ctx, o.pos.x, o.pos.y, o.angle, o.shipClass, 0.85);
  ctx.fillStyle = o.inParty ? "#5cff8a" : "#8a9ac8";
  ctx.font = "18px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 3;
  ctx.fillText(`${o.name} [${o.level}]`, o.pos.x, o.pos.y - 26);
  if (o.clan) {
    ctx.fillStyle = "#4ee2ff";
    ctx.font = "16px 'Courier New', monospace";
    ctx.fillText(`<${o.clan}>`, o.pos.x, o.pos.y - 42);
  }
  ctx.shadowBlur = 0;
}'''

new_draw = '''function drawOtherPlayer(ctx: CanvasRenderingContext2D, o: OtherPlayer): void {
  drawShip(ctx, o.pos.x, o.pos.y, o.angle, o.shipClass, 0.85);
  if ((o as any).hull != null && (o as any).hullMax != null && (o as any).hull < (o as any).hullMax) {
    const hpRatio = (o as any).hullMax > 0 ? (o as any).hull / (o as any).hullMax : 1;
    const spRatio = (o as any).shieldMax > 0 ? ((o as any).shield ?? 0) / (o as any).shieldMax : 0;
    drawHullShieldBars(ctx, o.pos.x, o.pos.y - 26, Math.max(0, hpRatio), Math.max(0, spRatio));
  }
  const rank = rankFor(o.honor ?? 0);
  const factionColor = o.faction ? FACTIONS[o.faction as keyof typeof FACTIONS]?.color ?? "#7a8ad8" : "#7a8ad8";
  ctx.font = "bold 18px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = o.inParty ? "#5cff8a" : "#e8f0ff";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 3;
  const nameY = o.pos.y + 36;
  ctx.fillText(o.name, o.pos.x, nameY);
  const nameWidth = ctx.measureText(o.name).width;
  ctx.fillStyle = rank.color;
  ctx.shadowColor = rank.color;
  ctx.shadowBlur = 4;
  ctx.fillText(rank.symbol, o.pos.x + nameWidth / 2 + 8, nameY);
  if (o.faction) {
    ctx.fillStyle = factionColor;
    ctx.shadowColor = factionColor;
    ctx.fillText("\\u25c6", o.pos.x - nameWidth / 2 - 8, nameY);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#7a8ad8";
  ctx.font = "14px 'Courier New', monospace";
  ctx.fillText(`Lv.${o.level}`, o.pos.x, nameY + 16);
  if (o.clan) {
    ctx.fillStyle = "#4ee2ff";
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(`<${o.clan}>`, o.pos.x, nameY + 30);
  }
}'''

content = content.replace(old_draw, new_draw)

with open('frontend/src/game/render.ts', 'w') as f:
    f.write(content)

print("FIX 5 done: render.ts draws faction diamond + rank symbol for other players")
PYEOF

# ── FIX 6: socket.ts - Add faction/honor to player:join event type ──
python3 << 'PYEOF'
with open('frontend/src/net/socket.ts', 'r') as f:
    content = f.read()

old_type = '''  onPlayerJoin: (player: { id: number; name: string; shipClass: string; level: number; faction: string | null; zone: string }) => void;'''

new_type = '''  onPlayerJoin: (player: { id: number; name: string; shipClass: string; level: number; faction: string | null; honor: number; zone: string }) => void;'''

content = content.replace(old_type, new_type)

with open('frontend/src/net/socket.ts', 'w') as f:
    f.write(content)

print("FIX 6 done: socket.ts player:join type includes honor")
PYEOF

# ── FIX 7: handler.ts - Add honor to player:join broadcast ──
python3 << 'PYEOF'
with open('backend/src/socket/handler.ts', 'r') as f:
    content = f.read()

# Find the player:join broadcast and add honor
import re
# Look for the io.emit("player:join" pattern
pattern = r'io\.emit\("player:join",\s*\{[^}]*\}\)'
matches = list(re.finditer(pattern, content, re.DOTALL))
for m in matches:
    old_emit = m.group(0)
    if 'honor' not in old_emit:
        new_emit = old_emit.replace('faction: online.faction,', 'faction: online.faction, honor: online.honor,')
        content = content.replace(old_emit, new_emit)
        print(f"Updated player:join broadcast to include honor")

with open('backend/src/socket/handler.ts', 'w') as f:
    f.write(content)

print("FIX 7 done: handler.ts player:join broadcast includes honor")
PYEOF

echo "All faction/rank fixes applied!"
