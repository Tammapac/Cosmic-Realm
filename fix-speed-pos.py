#!/usr/bin/env python3
"""Fix position desync for stopped players."""

with open('frontend/src/game/loop.ts', 'r') as f:
    content = f.read()

old = '''  for (const o of state.others) {
    const tgt = _entityTargets.get(`p-${o.id}`);
    if (!tgt) continue;
    o.pos.x += (tgt.x - o.pos.x) * lerp;
    o.pos.y += (tgt.y - o.pos.y) * lerp;
    o.vel.x = tgt.vx;
    o.vel.y = tgt.vy;'''

new = '''  for (const o of state.others) {
    const tgt = _entityTargets.get(`p-${o.id}`);
    if (!tgt) continue;
    const odx = tgt.x - o.pos.x;
    const ody = tgt.y - o.pos.y;
    const oDist = odx * odx + ody * ody;
    const oStopped = tgt.vx * tgt.vx + tgt.vy * tgt.vy < 9;
    if (oStopped && oDist < 900) {
      o.pos.x = tgt.x;
      o.pos.y = tgt.y;
    } else {
      o.pos.x += odx * lerp;
      o.pos.y += ody * lerp;
    }
    o.vel.x = tgt.vx;
    o.vel.y = tgt.vy;'''

if old in content:
    content = content.replace(old, new)
    print("Fixed: other players snap to position when stopped and within 30px")
else:
    print("WARNING: could not find other player interpolation")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(content)
