import sys

path = '/root/Cosmic-Realm/frontend/src/game/pixi-renderer-v2-integrated.ts'
content = open(path).read()

# Add DIRECTIONS_32 import from hardpointTypes
old_import = 'import { initHardpointEditor, toggleHardpointEditor, isEditorActive } from "./debug/HardpointEditor";'
new_import = '''import { initHardpointEditor, toggleHardpointEditor, isEditorActive } from "./debug/HardpointEditor";
import { DIRECTIONS_32 } from "./debug/hardpointTypes";'''

if old_import in content:
    content = content.replace(old_import, new_import)
    print("OK: added DIRECTIONS_32 import")
else:
    print("ERROR: could not find editor import")
    sys.exit(1)

# Add live hardpoint lookup functions after the localToWorldHardpoint function
old_track = '// Track weapon mount alternation per entity\nconst weaponMountIndex = new Map<string, number>();'

live_hp_code = '''// ── Live hardpoint data from editor (localStorage) ──
interface EditorHardpoint {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  layer: string;
}
interface EditorDirectionData {
  hardpoints: EditorHardpoint[];
}
interface EditorShipData {
  shipId: string;
  directions: Record<string, EditorDirectionData>;
}

const editorHpCache = new Map<string, EditorShipData | null>();
let editorHpCacheTime = 0;

function loadEditorHardpoints(ship: string): EditorShipData | null {
  const now = Date.now();
  if (now - editorHpCacheTime < 5000 && editorHpCache.has(ship)) {
    return editorHpCache.get(ship) || null;
  }
  try {
    const raw = localStorage.getItem(`hardpoint-editor:${ship}`);
    if (!raw) { editorHpCache.set(ship, null); return null; }
    const parsed = JSON.parse(raw) as EditorShipData;
    editorHpCache.set(ship, parsed);
    editorHpCacheTime = now;
    return parsed;
  } catch { editorHpCache.set(ship, null); return null; }
}

function getEditorHardpointsByType(ship: string, frameIdx: number, type: string): { x: number; y: number }[] {
  const data = loadEditorHardpoints(ship);
  if (!data) return [];
  const dirKey = DIRECTIONS_32[frameIdx];
  if (!dirKey) return [];
  const dir = data.directions[dirKey];
  if (!dir || !dir.hardpoints) return [];
  return dir.hardpoints
    .filter(hp => hp.type === type)
    .map(hp => ({ x: hp.x, y: hp.y }));
}

function getPlayerFrameIndex(shipClass: string, angle: number): number {
  const cfg = ROTATION_SPRITES[shipClass];
  if (!cfg) return 0;
  const frames = rotationFrameTextures.get(shipClass);
  const totalFrames = frames ? frames.length : 32;
  return angleToDirectionFrame(angle, totalFrames, cfg.frame0DirectionDeg, cfg.clockwise, "player-hp");
}

// Track weapon mount alternation per entity
const weaponMountIndex = new Map<string, number>();'''

if old_track in content:
    content = content.replace(old_track, live_hp_code)
    print("OK: added live hardpoint functions")
else:
    print("ERROR: could not find weapon mount tracking")
    sys.exit(1)

# Replace the thruster trail rendering for the player to use editor data
old_thruster = '''  // EffectManager thruster trail particles from hardpoints
  if (speed > 0.5 && effectManager) {
    const cls = SHIP_CLASSES[p.shipClass];
    const trailScale = cls ? Math.max(0.5, Math.min(1.2, cls.hullMax / 200)) : 1;
    const hp = SHIP_HARDPOINTS[p.shipClass];
    if (hp && hp.thrusters.length > 0) {
      for (const t of hp.thrusters) {
        const wp = localToWorldHardpoint(p.pos.x, p.pos.y, t.x, t.y, p.angle);
        effectManager.spawnThrusterTrail(wp.x, wp.y, p.angle, speed, 0x4ee2ff, 1, trailScale);
      }
    } else {
      effectManager.spawnThrusterTrail(p.pos.x, p.pos.y, p.angle, speed, 0x4ee2ff, 1, trailScale);
    }
  }'''

new_thruster = '''  // EffectManager thruster trail particles from hardpoints (editor data or fallback)
  if (speed > 0.5 && effectManager) {
    const cls = SHIP_CLASSES[p.shipClass];
    const trailScale = cls ? Math.max(0.5, Math.min(1.2, cls.hullMax / 200)) : 1;
    const frameIdx = getPlayerFrameIndex(p.shipClass, p.angle);
    const editorThrusters = getEditorHardpointsByType(p.shipClass, frameIdx, "thruster");
    const editorEngines = getEditorHardpointsByType(p.shipClass, frameIdx, "engineGlow");
    const allThrusters = [...editorThrusters, ...editorEngines];
    if (allThrusters.length > 0) {
      for (const t of allThrusters) {
        effectManager.spawnThrusterTrail(p.pos.x + t.x, p.pos.y + t.y, p.angle, speed, 0x4ee2ff, 1, trailScale);
      }
    } else {
      const hp = SHIP_HARDPOINTS[p.shipClass];
      if (hp && hp.thrusters.length > 0) {
        for (const t of hp.thrusters) {
          const wp = localToWorldHardpoint(p.pos.x, p.pos.y, t.x, t.y, p.angle);
          effectManager.spawnThrusterTrail(wp.x, wp.y, p.angle, speed, 0x4ee2ff, 1, trailScale);
        }
      } else {
        effectManager.spawnThrusterTrail(p.pos.x, p.pos.y, p.angle, speed, 0x4ee2ff, 1, trailScale);
      }
    }
  }'''

if old_thruster in content:
    content = content.replace(old_thruster, new_thruster)
    print("OK: updated player thruster rendering")
else:
    print("ERROR: could not find player thruster block")
    sys.exit(1)

# Replace the muzzle flash weapon hardpoint section
old_muzzle = '''        const hp = shooterClass ? SHIP_HARDPOINTS[shooterClass] : undefined;
        let mx = pr.pos.x;
        let my = pr.pos.y;
        if (hp && hp.weapons.length > 0 && pr.fromPlayer) {
          const idx = weaponMountIndex.get(shooterId) ?? 0;
          const w = hp.weapons[idx % hp.weapons.length];
          const wp = localToWorldHardpoint(state.player.pos.x, state.player.pos.y, w.x, w.y, state.player.angle);
          mx = wp.x;
          my = wp.y;
          weaponMountIndex.set(shooterId, idx + 1);
        }'''

new_muzzle = '''        const hp = shooterClass ? SHIP_HARDPOINTS[shooterClass] : undefined;
        let mx = pr.pos.x;
        let my = pr.pos.y;
        if (pr.fromPlayer && shooterClass) {
          const frameIdx = getPlayerFrameIndex(shooterClass, state.player.angle);
          const editorWeapons = [
            ...getEditorHardpointsByType(shooterClass, frameIdx, "laser"),
            ...getEditorHardpointsByType(shooterClass, frameIdx, "rocket"),
            ...getEditorHardpointsByType(shooterClass, frameIdx, "muzzle"),
          ];
          if (editorWeapons.length > 0) {
            const idx = weaponMountIndex.get(shooterId) ?? 0;
            const w = editorWeapons[idx % editorWeapons.length];
            mx = state.player.pos.x + w.x;
            my = state.player.pos.y + w.y;
            weaponMountIndex.set(shooterId, idx + 1);
          } else if (hp && hp.weapons.length > 0) {
            const idx = weaponMountIndex.get(shooterId) ?? 0;
            const w = hp.weapons[idx % hp.weapons.length];
            const wp = localToWorldHardpoint(state.player.pos.x, state.player.pos.y, w.x, w.y, state.player.angle);
            mx = wp.x;
            my = wp.y;
            weaponMountIndex.set(shooterId, idx + 1);
          }
        } else if (hp && hp.weapons.length > 0 && pr.fromPlayer) {
          const idx = weaponMountIndex.get(shooterId) ?? 0;
          const w = hp.weapons[idx % hp.weapons.length];
          const wp = localToWorldHardpoint(state.player.pos.x, state.player.pos.y, w.x, w.y, state.player.angle);
          mx = wp.x;
          my = wp.y;
          weaponMountIndex.set(shooterId, idx + 1);
        }'''

if old_muzzle in content:
    content = content.replace(old_muzzle, new_muzzle)
    print("OK: updated muzzle flash rendering")
else:
    print("ERROR: could not find muzzle flash block")
    sys.exit(1)

open(path, 'w').write(content)
print("DONE - live hardpoint rendering patched")
