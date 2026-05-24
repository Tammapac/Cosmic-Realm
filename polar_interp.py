import sys

path = '/root/Cosmic-Realm/frontend/src/game/debug/HardpointEditor.ts'
content = open(path).read()

old_interp = '''function interpolateAllDirections(): void {
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
}'''

new_interp = '''function interpolateAllDirections(): void {
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
  
  // Polar interpolation: rotate hardpoints around ship center
  function toPolar(x: number, y: number): { r: number; a: number } {
    return { r: Math.sqrt(x * x + y * y), a: Math.atan2(y, x) };
  }
  
  function lerpAngle(a1: number, a2: number, t: number): number {
    let diff = a2 - a1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return a1 + diff * t;
  }
  
  // Interpolate between each pair of keyframes
  for (let seg = 0; seg < 4; seg++) {
    const startFrame = keyFrames[seg];
    const startDir = DIRECTIONS_32[startFrame];
    const endDir = DIRECTIONS_32[keyFrames[(seg + 1) % 4]];
    const startHps = data.directions[startDir].hardpoints;
    const endHps = data.directions[endDir].hardpoints;
    
    for (let i = 1; i < 8; i++) {
      const frameIdx = (startFrame + i) % 32;
      const dir = DIRECTIONS_32[frameIdx];
      const t = i / 8;
      
      const interpolated: Hardpoint[] = [];
      for (let h = 0; h < hpCount; h++) {
        const sp = toPolar(startHps[h].x, startHps[h].y);
        const ep = toPolar(endHps[h].x, endHps[h].y);
        const r = sp.r + (ep.r - sp.r) * t;
        const a = lerpAngle(sp.a, ep.a, t);
        interpolated.push({
          id: startHps[h].id,
          type: startHps[h].type,
          layer: startHps[h].layer,
          x: Math.round(r * Math.cos(a)),
          y: Math.round(r * Math.sin(a)),
          z: Math.round(startHps[h].z + (endHps[h].z - startHps[h].z) * t),
        });
      }
      data.directions[dir] = { hardpoints: interpolated };
    }
  }
  
  save();
}'''

if old_interp in content:
    content = content.replace(old_interp, new_interp)
    print("OK: replaced with polar interpolation")
else:
    print("ERROR: could not find old interpolation function")
    sys.exit(1)

open(path, 'w').write(content)
print("DONE")
