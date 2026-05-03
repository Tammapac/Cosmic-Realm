import re, sys

path = '/root/Cosmic-Realm/frontend/src/game/debug/HardpointEditor.ts'
content = open(path).read()

# 1. Add drag state variables after the existing state variables
old_state = '''let dirty = true;
let pulseInterval: ReturnType<typeof setInterval> | null = null;'''

new_state = '''let dirty = true;
let pulseInterval: ReturnType<typeof setInterval> | null = null;
let dragging = false;
let dragIndex = -1;'''

if old_state in content:
    content = content.replace(old_state, new_state)
    print("OK: added drag state vars")
else:
    print("ERROR: could not find state vars block")
    sys.exit(1)

# 2. Add drag handler functions before the "public API" section
drag_funcs = '''
/* --- mouse/pointer drag handlers --- */
function screenToHardpoint(mx: number, my: number, hz: number): { x: number; y: number } {
  if (!app) return { x: 0, y: 0 };
  const cx = app.screen.width / 2;
  const cy = app.screen.height / 2;
  const x = Math.round((mx - cx) / zoom);
  const y = Math.round((my - cy) / zoom + hz);
  return { x, y };
}

function findDotAt(mx: number, my: number): number {
  if (!app) return -1;
  const cx = app.screen.width / 2;
  const cy = app.screen.height / 2;
  const hps = currentHardpoints();
  let closest = -1;
  let closestDist = 12; // max pick radius in pixels
  for (let i = 0; i < hps.length; i++) {
    const hp = hps[i];
    const sx = cx + hp.x * zoom;
    const sy = cy + (hp.y - hp.z) * zoom;
    const dist = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  }
  return closest;
}

function onPointerDown(e: PointerEvent): void {
  if (!active) return;
  const idx = findDotAt(e.clientX, e.clientY);
  if (idx >= 0) {
    selectedIndex = idx;
    dragging = true;
    dragIndex = idx;
    scheduleRender();
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!active || !dragging || dragIndex < 0) return;
  const hps = currentHardpoints();
  if (!hps[dragIndex]) return;
  const hp = hps[dragIndex];
  const pos = screenToHardpoint(e.clientX, e.clientY, hp.z);
  hp.x = pos.x;
  hp.y = pos.y;
  scheduleRender();
}

function onPointerUp(_e: PointerEvent): void {
  if (dragging) {
    dragging = false;
    dragIndex = -1;
    save();
  }
}

function onDblClick(e: MouseEvent): void {
  if (!active || !app) return;
  // Double-click adds a new hardpoint at that position
  if (!data) return;
  const hps = currentHardpoints();
  const cx = app.screen.width / 2;
  const cy = app.screen.height / 2;
  const x = Math.round((e.clientX - cx) / zoom);
  const y = Math.round((e.clientY - cy) / zoom);
  const newHp: Hardpoint = {
    id: `${shipId}_${hps.length + 1}`,
    type: "laser",
    x,
    y,
    z: 0,
    layer: "shipLevel",
  };
  hps.push(newHp);
  selectedIndex = hps.length - 1;
  save();
  scheduleRender();
}

'''

old_public = '/* --- public API --- */'
if old_public in content:
    content = content.replace(old_public, drag_funcs + old_public)
    print("OK: added drag handler functions")
else:
    print("ERROR: could not find public API marker")
    sys.exit(1)

# 3. Add event listeners in initHardpointEditor (after the keydown listener)
old_init_end = '''  window.addEventListener("keydown", onKeyDown, true);
}'''

new_init_end = '''  window.addEventListener("keydown", onKeyDown, true);

  domBlocker.addEventListener("pointerdown", onPointerDown);
  domBlocker.addEventListener("pointermove", onPointerMove);
  domBlocker.addEventListener("pointerup", onPointerUp);
  domBlocker.addEventListener("dblclick", onDblClick);
}'''

if old_init_end in content:
    content = content.replace(old_init_end, new_init_end, 1)
    print("OK: added event listeners in init")
else:
    print("ERROR: could not find init end block")
    sys.exit(1)

# 4. Remove event listeners in destroyHardpointEditor
old_destroy = '''  if (domBlocker) { domBlocker.remove(); domBlocker = null; }
  window.removeEventListener("keydown", onKeyDown, true);'''

new_destroy = '''  if (domBlocker) {
    domBlocker.removeEventListener("pointerdown", onPointerDown);
    domBlocker.removeEventListener("pointermove", onPointerMove);
    domBlocker.removeEventListener("pointerup", onPointerUp);
    domBlocker.removeEventListener("dblclick", onDblClick);
    domBlocker.remove();
    domBlocker = null;
  }
  window.removeEventListener("keydown", onKeyDown, true);'''

if old_destroy in content:
    content = content.replace(old_destroy, new_destroy)
    print("OK: updated destroy cleanup")
else:
    print("ERROR: could not find destroy block")
    sys.exit(1)

# 5. Update help text to mention drag
old_help = '"Insert/S+A  Add point",'
new_help = '"Insert/S+A  Add point (or dblclick)",'

if old_help in content:
    content = content.replace(old_help, new_help)
    print("OK: updated help text")
else:
    print("WARN: could not update help text (non-critical)")

# Add drag hint to help
old_help2 = '"W/A/S/D     Move (Shift=5, Alt=0.25)",'
new_help2 = '"W/A/S/D     Move (Shift=5, Alt=0.25)",\n      "Drag        Move dot with mouse",'

if old_help2 in content:
    content = content.replace(old_help2, new_help2)
    print("OK: added drag hint to help")
else:
    print("WARN: could not add drag hint (non-critical)")

# Also increase the render interval to be more responsive for dragging (60ms instead of 150ms)
old_interval = 'pulseInterval = setInterval(tick, 150);'
new_interval = 'pulseInterval = setInterval(tick, 33);'

if old_interval in content:
    content = content.replace(old_interval, new_interval)
    print("OK: increased render rate to 30fps for smooth dragging")
else:
    print("WARN: could not update interval (non-critical)")

open(path, 'w').write(content)
print("DONE - drag support added")
