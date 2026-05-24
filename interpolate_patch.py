import sys

path = '/root/Cosmic-Realm/frontend/src/game/debug/HardpointEditor.ts'
content = open(path).read()

# Add the interpolation function before the addHardpoint function
interp_func = '''
function interpolateAllDirections(): void {
  if (!data) return;
  // Keyframes: N=0, E=8, S=16, W=24
  const keyFrames = [0, 8, 16, 24];
  const keyDirs = keyFrames.map(i => DIRECTIONS_32[i]);
  
  // Check all keyframes have hardpoints
  for (const dir of keyDirs) {
    const d = data.directions[dir];
    if (!d || d.hardpoints.length === 0) {
      alert("Place hardpoints in all 4 cardinal directions first (N, E, S, W = frames 1, 9, 17, 25)");
      return;
    }
  }
  
  const hpCount = data.directions[keyDirs[0]].hardpoints.length;
  for (const dir of keyDirs) {
    if (data.directions[dir].hardpoints.length !== hpCount) {
      alert("All 4 cardinal directions must have the same number of hardpoints!");
      return;
    }
  }
  
  // Interpolate between each pair of keyframes
  for (let seg = 0; seg < 4; seg++) {
    const startFrame = keyFrames[seg];
    const endFrame = keyFrames[(seg + 1) % 4];
    const startDir = DIRECTIONS_32[startFrame];
    const endDir = DIRECTIONS_32[endFrame];
    const startHps = data.directions[startDir].hardpoints;
    const endHps = data.directions[endDir].hardpoints;
    
    const segLength = seg < 3 ? 8 : 8; // always 8 frames between keyframes
    
    for (let i = 1; i < segLength; i++) {
      const frameIdx = (startFrame + i) % 32;
      const dir = DIRECTIONS_32[frameIdx];
      const t = i / segLength;
      
      const interpolated: Hardpoint[] = [];
      for (let h = 0; h < hpCount; h++) {
        interpolated.push({
          id: startHps[h].id,
          type: startHps[h].type,
          layer: startHps[h].layer,
          x: Math.round(startHps[h].x + (endHps[h].x - startHps[h].x) * t),
          y: Math.round(startHps[h].y + (endHps[h].y - startHps[h].y) * t),
          z: Math.round(startHps[h].z + (endHps[h].z - startHps[h].z) * t),
        });
      }
      data.directions[dir] = { hardpoints: interpolated };
    }
  }
  
  save();
}

'''

old_add = 'function addHardpoint(): void {'
if old_add in content:
    content = content.replace(old_add, interp_func + old_add)
    print("OK: added interpolation function")
else:
    print("ERROR: could not find addHardpoint function")
    sys.exit(1)

# Add the I key binding in the switch statement (after the "f" case)
old_f_case = '''    case "f":
    case "F": {
      if (data && confirm("Fill ALL 32 directions with current hardpoints?")) {
        for (const d of DIRECTIONS_32) {
          data.directions[d] = { hardpoints: JSON.parse(JSON.stringify(hps)) };
        }
        save();
      }
      break;
    }'''

new_f_case = '''    case "f":
    case "F": {
      if (data && confirm("Fill ALL 32 directions with current hardpoints?")) {
        for (const d of DIRECTIONS_32) {
          data.directions[d] = { hardpoints: JSON.parse(JSON.stringify(hps)) };
        }
        save();
      }
      break;
    }
    case "i":
    case "I": {
      interpolateAllDirections();
      break;
    }'''

if old_f_case in content:
    content = content.replace(old_f_case, new_f_case)
    print("OK: added I key binding")
else:
    print("ERROR: could not find F case block")
    sys.exit(1)

# Update help text to mention interpolation
old_help_f = '"F           Fill ALL 32 dirs from current",'
new_help_f = '"F           Fill ALL 32 dirs from current",\n      "I           Interpolate (set N,E,S,W only)",'

if old_help_f in content:
    content = content.replace(old_help_f, new_help_f)
    print("OK: updated help text")
else:
    print("WARN: could not update help")

open(path, 'w').write(content)
print("DONE")
