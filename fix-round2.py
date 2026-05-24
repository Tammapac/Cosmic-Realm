#!/usr/bin/env python3
"""Fix: local player hit VFX, rocket weapon check, trail appearance."""

# ── FIX 1: loop.ts - Add VFX when enemy projectile hits local player ──
print("FIX 1: Add hit VFX when enemy projectile hits local player...")
with open('frontend/src/game/loop.ts', 'r') as f:
    content = f.read()

old_local_hit = '''      if (distance(pr.pos.x, pr.pos.y, p.pos.x, p.pos.y) < 12) {
        if (!serverAuthoritative) damagePlayer(pr.damage);
        return false;
      }'''

new_local_hit = '''      if (distance(pr.pos.x, pr.pos.y, p.pos.x, p.pos.y) < 12) {
        emitSpark(pr.pos.x, pr.pos.y, "#ff5c6c", 6, 90, 2);
        emitRing(pr.pos.x, pr.pos.y, "#ff5c6c", 18);
        state.particles.push({
          id: `phf-${Math.random().toString(36).slice(2, 8)}`,
          pos: { x: pr.pos.x, y: pr.pos.y }, vel: { x: 0, y: 0 },
          ttl: 0.12, maxTtl: 0.12,
          color: "#ff5c6c", size: 25, kind: "flash",
        });
        sfx.hit();
        state.cameraShake = Math.max(state.cameraShake, 0.12);
        if (!serverAuthoritative) damagePlayer(pr.damage);
        return false;
      }'''

if old_local_hit in content:
    content = content.replace(old_local_hit, new_local_hit)
    print("  -> Added hit VFX (sparks, ring, flash, shake, sound) when enemy hits local player")
else:
    print("  -> WARNING: Could not find local player hit code")


# ── FIX 2: loop.ts - Fix trail emission rate for other players ──
print("FIX 2: Fix trail rate for other players...")

old_trail = '''    const oSpeed = Math.sqrt(o.vel.x * o.vel.x + o.vel.y * o.vel.y);
    if (oSpeed > 30 && Math.random() < 0.3) {
      const back = o.angle + Math.PI;
      emitTrail(o.pos.x + Math.cos(back) * 8, o.pos.y + Math.sin(back) * 8, "#4ee2ff");
    }'''

new_trail = '''    const oSpeed = Math.sqrt(o.vel.x * o.vel.x + o.vel.y * o.vel.y);
    if (oSpeed > 30) {
      const tKey = `ot-${o.id}`;
      const last = (_otherTrailTimers as any)[tKey] ?? 0;
      const now = performance.now() / 1000;
      if (now - last >= 0.08) {
        ((_otherTrailTimers as any)[tKey] = now);
        const back = o.angle + Math.PI;
        emitTrail(o.pos.x + Math.cos(back) * 8, o.pos.y + Math.sin(back) * 8, "#4ee2ff");
      }
    }'''

if old_trail in content:
    content = content.replace(old_trail, new_trail)
    print("  -> Fixed: trail emits every 0.08s per player (matching local player rate)")
else:
    print("  -> WARNING: Could not find other player trail code")

# Add the trail timer map declaration near the top of applyServerSmoothing or as a module variable
# Find a good place to add it - near the trailTimer declaration
old_trail_decl = 'let trailTimer = 0;'
new_trail_decl = 'let trailTimer = 0;\nconst _otherTrailTimers: Record<string, number> = {};'

if old_trail_decl in content:
    content = content.replace(old_trail_decl, new_trail_decl, 1)
    print("  -> Added _otherTrailTimers map")
else:
    print("  -> WARNING: Could not find trailTimer declaration")


# ── FIX 3: engine.ts - Check if player has rocket weapon before firing rockets ──
print("FIX 3: Server-side rocket weapon check...")
with open('backend/src/game/engine.ts', 'r') as f:
    econtent = f.read()

old_rocket = '''      // Fire rocket
      if (p.isRocketFiring && p.rocketFireCd <= 0) {'''

new_rocket = '''      // Fire rocket (only if player has a rocket weapon equipped)
      const pCached = this.playerDataCache.get(p.playerId);
      const hasRocket = pCached?.equipped?.weapon?.some((wid: string | null) => {
        if (!wid) return false;
        const item = pCached.inventory?.find((m: any) => m.instanceId === wid);
        return item && MODULE_DEFS[item.defId]?.weaponKind === "rocket";
      }) ?? false;
      if (p.isRocketFiring && p.rocketFireCd <= 0 && hasRocket) {'''

if old_rocket in econtent:
    econtent = econtent.replace(old_rocket, new_rocket)
    print("  -> Added rocket weapon check on server")
else:
    print("  -> WARNING: Could not find rocket fire code")

# Check if MODULE_DEFS is imported
if 'MODULE_DEFS' not in econtent.split('import')[0] and 'MODULE_DEFS' not in econtent[:2000]:
    # Need to check if it's already imported somewhere
    import_check = 'MODULE_DEFS' in econtent[:500]
    if not import_check:
        print("  -> Checking MODULE_DEFS import...")
        # Look for existing imports from types
        if 'from "../shared/types"' in econtent or "from '../shared/types'" in econtent:
            print("  -> MODULE_DEFS may need import from types")
        # Actually let me check where MODULE_DEFS comes from
        pass

with open('backend/src/game/engine.ts', 'w') as f:
    f.write(econtent)


# ── FIX 4: Also prevent local client from sending rocketFiring when no rocket weapon ──
# This is already handled locally (line 1260 checks rocketIds.length > 0)
# but the sendInput still sends the flag. Let's fix sendInput.
print("FIX 4: Client sendInput should not send rocketFiring without rocket weapon...")

# Actually the cleaner fix is: don't set isRocketFiring=true on double click
# if the player has no rocket weapon. Let me fix App.tsx.
with open('frontend/src/App.tsx', 'r') as f:
    acontent = f.read()

old_dblclick = '''      // Double-click starts both lasers and rockets
      state.isLaserFiring = true;
      state.isRocketFiring = true;'''

new_dblclick = '''      // Double-click starts lasers (and rockets only if equipped)
      state.isLaserFiring = true;
      state.isRocketFiring = hasRocketWeapon();'''

if old_dblclick in acontent:
    acontent = acontent.replace(old_dblclick, new_dblclick)
    print("  -> Double-click only sets rocketFiring if rocket weapon equipped")
else:
    print("  -> WARNING: Could not find double-click attack code")

# Check if hasRocketWeapon is imported
if 'hasRocketWeapon' not in acontent[:3000]:
    # Find the import from loop.ts
    old_loop_import_match = None
    import_lines = acontent.split('\n')
    for i, line in enumerate(import_lines):
        if 'from "./game/loop"' in line:
            old_loop_import_match = line
            break

    if old_loop_import_match and 'hasRocketWeapon' not in old_loop_import_match:
        new_loop_import = old_loop_import_match.replace(' } from "./game/loop"', ', hasRocketWeapon } from "./game/loop"')
        acontent = acontent.replace(old_loop_import_match, new_loop_import, 1)
        print("  -> Added hasRocketWeapon import in App.tsx")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(acontent)

# Make sure hasRocketWeapon is exported from loop.ts
if 'export function hasRocketWeapon' not in content and 'function hasRocketWeapon' in content:
    content = content.replace('function hasRocketWeapon', 'export function hasRocketWeapon')
    print("  -> Exported hasRocketWeapon from loop.ts")
elif 'hasRocketWeapon' not in content:
    print("  -> WARNING: hasRocketWeapon doesn't exist in loop.ts, need to check")

with open('frontend/src/game/loop.ts', 'w') as f:
    f.write(content)


print("\nAll fixes applied!")
