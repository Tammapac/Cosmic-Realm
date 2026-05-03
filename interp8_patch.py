import sys

path = '/root/Cosmic-Realm/frontend/src/game/debug/HardpointEditor.ts'
content = open(path).read()

# Find and replace the entire interpolateAllDirections function
old_start = 'function interpolateAllDirections(): void {\n  if (!data) return;\n  // Keyframes: N=0, E=8, S=16, W=24'
old_end = '  save();\n}'

# Find the function boundaries
start_idx = content.find('function interpolateAllDirections(): void {')
if start_idx == -1:
    print("ERROR: could not find interpolateAllDirections")
    sys.exit(1)

# Find the closing of this function (save(); followed by })
# Look for the next function definition after this one
next_func = content.find('\nfunction addHardpoint', start_idx)
if next_func == -1:
    print("ERROR: could not find end boundary")
    sys.exit(1)

old_func = content[start_idx:next_func]

new_func = '''function interpolateAllDirections(): void {
  if (!data) return;
  // 8 keyframes: N, NE, E, SE, S, SW, W, NW (every 4th frame)
  const keyFrames = [0, 4, 8, 12, 16, 20, 24, 28];
  const keyDirs = keyFrames.map(i => DIRECTIONS_32[i]);
  
  // Find which keyframes have data
  const filledKeys: number[] = [];
  for (let k = 0; k < keyFrames.length; k++) {
    const d = data.directions[keyDirs[k]];
    if (d && d.hardpoints.length > 0) filledKeys.push(k);
  }
  
  if (filledKeys.length < 2) {
    alert("Place hardpoints in at least 2 of the 8 key directions:\\nN(1), NE(5), E(9), SE(13), S(17), SW(21), W(25), NW(29)");
    return;
  }
  
  const hpCount = data.directions[keyDirs[filledKeys[0]]].hardpoints.length;
  for (const k of filledKeys) {
    if (data.directions[keyDirs[k]].hardpoints.length !== hpCount) {
      alert("All key directions must have the same number of hardpoints!");
      return;
    }
  }
  
  // Linear interpolation between consecutive filled keyframes (wrapping around)
  for (let ki = 0; ki < filledKeys.length; ki++) {
    const startKey = filledKeys[ki];
    const endKey = filledKeys[(ki + 1) % filledKeys.length];
    const startFrame = keyFrames[startKey];
    const endFrame = keyFrames[endKey];
    const startHps = data.directions[keyDirs[startKey]].hardpoints;
    const endHps = data.directions[keyDirs[endKey]].hardpoints;
    
    // How many frames between these two keyframes (wrapping)
    const gap = endFrame > startFrame ? endFrame - startFrame : (32 - startFrame + endFrame);
    
    for (let i = 1; i < gap; i++) {
      const frameIdx = (startFrame + i) % 32;
      const dir = DIRECTIONS_32[frameIdx];
      const t = i / gap;
      
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

content = content[:start_idx] + new_func + content[next_func:]
print("OK: replaced interpolation with 8-keyframe linear version")

# Update the help text
old_help = '"I           Interpolate (set N,E,S,W only)",'
new_help = '"I           Interpolate (set 8 dirs: N,NE,E,SE,S,SW,W,NW)",'
if old_help in content:
    content = content.replace(old_help, new_help)
    print("OK: updated help text")

open(path, 'w').write(content)
print("DONE")
