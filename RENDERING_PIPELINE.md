# Rendering Pipeline — Cosmic Realm

*Last updated: 2026-07-06 (post-Phase 2.8)*

## Overview

Three rendering systems stack on top of each other in the browser:

```
z=2  Label overlay div          — HTML player name tags (absolute positioned)
z=1  Three.js <canvas>          — 3D ship models, transparent background
z=0  PixiJS <div> (WebGL)       — 2D world: background, entities, UI
```

All three are fullscreen and positioned with CSS `position: absolute`.

---

## PixiJS Renderer

**File:** `frontend/src/game/pixi-renderer-v2-integrated.ts` (~3800 lines)

Entry points:
- `initPixiRenderer(container, labelOverlay?)` — called once on mount
- `pixiRender()` — called every animation frame (RAF loop in `App.tsx`)
- `destroyPixiRenderer()` — cleanup on unmount

### Layer Stack (app.stage children, draw order bottom→top)

```
app.stage
├── [0] bgLayer (Container)
│       ├── TilingSprite: stars (parallax 0.05x)
│       ├── TilingSprite: nebula (parallax 0.12x)
│       ├── TilingSprite: nebula top layer (parallax 0.08x)
│       └── planet/background sprites (parallax 0.3x)
│
├── [1] stationSprite (PIXI.Sprite)
│       └── Wraps the Three.js station offscreen canvas as a texture
│           Updated each frame via stationBaseTexture.update()
│
├── [2] worldLayer (Container) — camera-transformed each frame
│       ├── pivot = (cam.x, cam.y)
│       ├── position = (screenW/2 + shakeX, screenH/2 + shakeY)
│       ├── scale = (cameraZoom, cameraZoom)
│       │
│       ├── trailLayer — thruster trail sprites
│       ├── effectsBehindLayer — behind-ship effects
│       ├── asteroidLayer
│       ├── stationLayer — portal sprites (world space, NOT 3D station)
│       ├── enemyLayer
│       ├── projectileBehindLayer — projectiles rendered under ships
│       ├── playerLayer — local + remote player sprites + drones
│       ├── projectileLayer — projectiles rendered over ships
│       ├── effectsLayer — general effects
│       ├── effectsFrontLayer — front-most VFX
│       ├── floaterLayer — damage numbers / floaters
│       ├── debugMuzzleGfx — Phase 2.6 muzzle marker overlay (empty unless __DEBUG_MUZZLE_MARKERS)
│       └── debugMuzzleLabels — text labels for the marker overlay
│
└── [3] uiLayer (Container) — screen space
        ├── minimap
        ├── zone name text
        └── other HUD elements
```

### Sprite Pools

Sprites are created once per entity and reused:
- Enemy sprites: keyed by `enemy.id`
- Other player sprites: keyed by `other.id` (numeric string, matches Three.js `activeShips` key)
- Projectile sprites: pooled, recycled by TTL
- Particle sprites: pooled
- Drone sprites: keyed by `"player:<idx>"` or `"<remoteId>:<idx>"` (Phase 3)

### Per-Frame Render Flow (`pixiRender()`)

1. Compute camera position (lerp toward `state.cameraTarget`)
2. Update `worldLayer` transform (pivot, position, scale)
3. Sync `stationSprite` size if window resized
4. Call `beginStationFrame()` → `updateStationOnly()` per station → `endStationFrame()` → `renderStation3DLayer()` → `stationBaseTexture.update()`
5. Sync background tile positions (parallax)
6. `renderBackground(w, h, cam)`
7. `syncAsteroids`, `syncStations`, `syncPortals`
8. `syncEnemies` — update / cull
9. `syncOtherPlayers` — update / cull remote ships. Calls `updateShip3D(o.id, ...)` for 3D ships; spawns thruster trails from `getShipMuzzleWorldPositionsAt(o.id, ...).thrusters` (Phase 2.8); always calls `updateEngineGlow(o.id, spd)` (Phase 4).
10. `syncNpcs`
11. `syncProjectiles` — pool management, muzzle-flash spawn at `pr.pos.x, pr.pos.y` (Phase 2.8) for fresh (`ttl > 1.2`) projectiles.
12. `syncDebugMuzzleMarkers` — Phase 2.6 overlay; clears + returns early when the flag is off.
13. `syncPlayer` — Local player: `updateShip3D("player", ...)`; thruster trails from `getShipMuzzleWorldPositionsAt("player", ...).thrusters`; engine glow via `updateEngineGlow("player", speed)` (Phase 4).
14. `syncMapBoundary`, `syncCargoBoxes`, `syncDungeonRifts`, `syncMiningLaser`, `syncMoveTarget`
15. `syncDrones` — Local + remote drones (Phase 3)
16. `syncFloaters`
17. `renderOverlays(w, h)` — screen-space UI
18. `endFrame()` on Three.js layer (removes inactive ships)
19. `endStationFrame()`
20. `renderStation3DLayer()` (blits station offscreen canvas into `stationSprite`)
21. `render3DLayer()` — Three.js renders ships to its canvas
22. PixiJS auto-renders (via `app.ticker` or implicit render)

---

## Three.js Ship Layer

**File:** `frontend/src/game/three-ship-layer.ts`

- Separate `<canvas>` element at z=1, transparent background (`alpha: true, premultipliedAlpha: false`)
- Orthographic camera at `(0, 500, 0)` looking straight down, `up = (0, 0, -1)`. Frustum: `(-w/2, w/2, -h/2, h/2)`.
- Wrapper tilt: `wrapper.rotation.x = SHIP_WRAPPER_TILT_X = -0.85` for depth feel. Constant shared with the analytic hardpoint transform.
- Ships positioned in screen space: `wrapper.position = ((worldX - camX) * zoom, 0, (worldY - camY) * zoom)`
- Each ship is a cloned GLB model in `activeShips: Map<string, Ship3D>` (key: `"player"` or `String(playerId)`)
- Hardpoints (`hp_muzzle_*`, `hp_thruster_*`, `hp_weapon_*`) are named empty objects inside GLB, traversed at load time.

### Ship3D interface

```typescript
interface Ship3D {
  lastYRot: number;            // lerped visual rotation (rate 4.5 toward -angle + π)
  wrapper: THREE.Group;         // tilted wrapper
  model: THREE.Group;           // cloned GLB scene
  hardpoints: ShipHardpoints;   // { thrusters, muzzles, weapons } — Object3D refs on the clone
  engineGlows: THREE.Sprite[];  // sprite per hp_thruster_* node
  lastCamX: number;
  lastCamY: number;
  lastWorldX: number;
  lastWorldY: number;
  worldUnitsPerModelUnit: number; // Phase 2.2 — cached for analytic hardpoint transform
}
```

### Hardpoint Classifier

`classifyHardpointName(raw)` at module scope. Normalization: lowercase, strip Blender `.NNN` suffix, replace `.`/`-` with `_`. Requires `(^|_)hp(_|$)` token. Categorizes as `"muzzle" | "weapon" | "thruster"` via anchored keyword regexes. Also accepts `engine` as a thruster alias.

Both `collectHardpoints()` (template load) and per-instance clone traversal in `updateShip3D()` use the classifier — canonical ordering is alphabetic by `hp.name`, so `hardpointIndex` maps stably across all clients.

### Canonical Model-Local Snapshot

At template GLB load (`three-ship-layer.ts:296-320`):
```
model.updateMatrixWorld(true);
for each muzzle/weapon/thruster hardpoint:
  hp.getWorldPosition(v);        // template has no wrapper/tilt/scale, so v = model-local
  localHardpoints.<ring>.push({ x: v.x, y: v.y, z: v.z });
  localHardpoints.<ring>Names.push(hp.name);
model.userData.localHardpoints = localHardpoints;
```

These are the canonical coordinates used by the analytic transform.

### Hardpoint Coordinate System (post-Phase 2.6)

**Primary function:** `getShipMuzzleWorldPositionsAt(entityId, _worldX, _worldY, _angle)` in `three-ship-layer.ts:432-490`.

Passed `(worldX, worldY, angle)` args are ignored — kept for API stability but the function reads `ship.lastYRot`, `ship.lastWorldX`, `ship.lastWorldY` internally so the result coincides exactly with the visible ship on the last render frame.

Returns `{ muzzles: {x,y}[], weapons: {x,y}[], thrusters: {x,y}[] }` in world space.

**Math (two-step Y-then-X rotation):**
```
theta = ship.lastYRot
ca = cos(theta), sa = sin(theta)
For each hardpoint (mx, my, mz):
  // Step 1: Y-axis heading rotation
  x1 =  mx·ca + mz·sa
  y1 =  my
  z1 = -mx·sa + mz·ca
  // Step 2: X-axis wrapper tilt (SHIP_WRAPPER_TILT_X = -0.85)
  z2 = y1·SIN_TILT + z1·COS_TILT
  // Step 3: scale + translate
  worldX = ship.lastWorldX + x1 · ship.worldUnitsPerModelUnit
  worldY = ship.lastWorldY + z2 · ship.worldUnitsPerModelUnit
```

**Why both rotations matter:** Ignoring the X tilt over-scaled `mz`'s contribution to screen-Y by `1/cos(0.85) ≈ 1.52×` and dropped `my`'s contribution entirely. Hardpoints with non-zero model-Y produced rotation-dependent visible offset — the "spawn drifts with ship rotation" bug that Phase 2.6 fixed.

**Legacy variant:** `getShipMuzzleWorldPositions(entityId)` reads the actual Three.js wrapper transform via `hp.getWorldPosition()` + `wrapper.worldToLocal()`. Only used by 2D-fallback code paths for ships that don't have GLB models. All GLB-equipped ships use the analytic function.

### Engine Glows

`THREE.Sprite` objects attached as children of each `hp_thruster_*` node. Opacity driven by ship speed via `updateEngineGlow(entityId, speed)`. Formula (Phase 4):
```
intensity = speed < 1 ? 0 : min(1, speed / 80)
```
No opacity floor — glow fully turns off at rest. Called every frame regardless of speed so opacity doesn't stick.

### Debug Marker Overlay (Phase 2.6)

`window.__DEBUG_MUZZLE_MARKERS = true` in DevTools enables:
- Cyan hollow circle + tiny cross at each analytic muzzle / weapon / thruster world position, for every active 3D ship.
- Magenta filled dot at each recent projectile spawn (buffered in `loop.ts` ring, 1.5s fade).
- White line connecting each spawn to its corresponding analytic hardpoint if `(entityId, ring, index)` matches. Line length = visible offset in world units.
- Yellow monospace label under each spawn: `<entityId> <ring>[<index>] <hp_muzzle_XX_nodeName> Δ=<world-units> yaw=<deg>°`.

Zero cost when flag is off. Uses `debugEnumerateAllMuzzles(): DebugMuzzleRecord[]` exported from `three-ship-layer.ts` and `getDebugSpawnBuffer(): DebugSpawnRecord[]` from `loop.ts`.

---

## Three.js Station Layer

**File:** `frontend/src/game/three-station-layer.ts`

- Renders to an **offscreen** `HTMLCanvasElement` (not in DOM)
- `initStation3DLayer(w, h)` — called from `initPixiRenderer()`, returns the canvas
- Canvas wrapped as `PIXI.BaseTexture` + `PIXI.Texture` + `PIXI.Sprite` — inserted at stage index 1
- `stationBaseTexture.update()` called each frame after `renderStation3DLayer()` to push new pixels to GPU
- Clear color is transparent (`0x000000, 0`) — only station pixels are visible; bgLayer shows through
- Station GLB: `/models/Station.glb` — materials forced fully opaque on load

---

## Canvas2D Fallback

**File:** `frontend/src/game/render.ts`

Used as a fallback renderer and for baking entity textures (used by PixiJS to create sprites from canvas draws). Not the primary render path.

---

## Label Overlay

HTML `<div>` at z=2, `pointer-events: none`. The PixiJS renderer manages name tag `<div>` elements inside this overlay, positioned by converting world coordinates to screen coordinates each frame.

---

## Effect Manager

**File:** `frontend/src/game/pixi-effect-manager.ts`

Pooled sprite recycler for particles:
- `spawnThrusterTrail(x, y, angle, speed, color, alphaMul, sizeMul)` — one call per `hp_thruster_*` hardpoint per frame while `speed > 0.5` (Phase 2.8: called with tilt-corrected world positions).
- `spawnMuzzleFlash(x, y, angle, weaponType, color)` — called at `pr.pos.x, pr.pos.y` for freshly spawned projectiles (Phase 2.8: uses projectile's own hardpoint-aligned position).
- `spawnRocketLaunch(x, y, angle)` — rocket ignition ring + smoke.
- `spawnPlasmaWake(x, y, angle, speed, width, color)` — used for `PLASMA_WAKE_SHIPS` (fallback for ships without GLB).

Pools sprites in `effectsBehindLayer` / `effectsFrontLayer` inside `worldLayer` so effects follow camera transform.

---

## Performance Notes

- Sprite pools avoid per-frame allocation
- Viewport culling: entities outside `halfW + margin` / `halfH + margin` are skipped
- `stationBaseTexture.update()` is one GPU texture upload per frame — acceptable cost
- Three.js `render3DLayer()` renders all ships in one draw call per material
- The renderer file is ~3800 lines — be careful making changes; test visually after any edit
- Debug marker overlay has zero cost when `window.__DEBUG_MUZZLE_MARKERS` is falsy (early return + clear)

---

## Frontend Wrapper Tilt Constant

`SHIP_WRAPPER_TILT_X = -0.85` is exported from `three-ship-layer.ts` and used in TWO places:
1. `wrapper.rotation.x = SHIP_WRAPPER_TILT_X` (visual tilt of the ship model)
2. `SIN_TILT = sin(SHIP_WRAPPER_TILT_X)`, `COS_TILT = cos(SHIP_WRAPPER_TILT_X)` in the analytic hardpoint transform

**If you tune this constant, both places update automatically.** No other code should hardcode `-0.85`.
