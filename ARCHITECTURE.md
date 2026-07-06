# Architecture — Cosmic Realm

*Last updated: 2026-07-06 (post-Phase 2.8)*

## High-Level System Diagram

```
Browser
├── React UI (components/)
│   ├── TopBar, Hotbar, MiniMap, QuestTracker, etc.
│   └── Modals: Hangar, SocialPanel, SettingsMenu, AdminPanel
│
├── Game Canvas Stack (z-index order, bottom to top)
│   ├── [z=0] PixiJS <div> — 2D world renderer (bgLayer → stationSprite → worldLayer → uiLayer)
│   ├── [z=1] Three.js <canvas> — 3D ship models (transparent, overlaid)
│   └── [z=2] Label overlay <div> — player name tags, HTML labels
│
├── Game Loop — loop.ts (requestAnimationFrame — tickWorld runs each frame)
│   ├── Physics tick (move projectiles, move enemies locally)
│   ├── Weapon firing (local player only, with muzzle-pair cursor)
│   ├── Remote drone formation update (per-remote, mirrors local math)
│   ├── Projectile per-frame steering (local → attackTargetId, remote → remoteTargetId)
│   ├── Input sending (sendInput → socket)
│   └── State mutations → store.ts
│
├── Socket Client — net/socket.ts
│   └── Socket.IO connection to backend:3000
│
└── Store — game/store.ts
    └── useSyncExternalStore → React re-renders on state.bump()
```

```
Server (Node.js, PM2 running via tsx watch)
├── Express HTTP — routes: auth, player, clan, leaderboard
├── Socket.IO — handler.ts
│   ├── Auth middleware (JWT)
│   ├── Per-connection event handlers
│   └── 30Hz tick via setInterval → engine.tick() → build delta / snapshot
│
├── Game Engine — engine.ts
│   ├── Zone state (enemies, projectiles, asteroids, NPCs)
│   ├── Player physics (movement, friction)
│   ├── Enemy AI (firing, movement)
│   ├── Collision detection (spatial hash)
│   ├── Projectile fire: emits hardpointIndex/Ring/shipClass/targetId per shot (Phase 2/2.1/2.7)
│   └── Event queue → broadcast to clients
│
├── Instance Manager — instance.ts (dungeons)
│
├── Socket State — socket/state.ts
│   └── OnlinePlayer map (includes nextMuzzlePair cursor + drones), zone membership
│
└── Database
    ├── PostgreSQL (Drizzle ORM) — player data, inventory, clans
    └── Redis — sessions
```

---

## Canvas Layer Stack (z-index)

The game renders using **three overlapping fullscreen layers**:

| Layer | Tech | z-index | Content |
|---|---|---|---|
| PixiJS div | PixiJS WebGL | 0 | Background, world entities, UI |
| Three.js canvas | Three.js WebGL | 1 | 3D ship models (transparent bg) |
| Label overlay div | HTML | 2 | Player name tags |

### PixiJS Internal Layer Order (app.stage children)

1. `bgLayer` — stars, nebula, planet parallax sprites
2. `stationSprite` — Three.js station offscreen canvas blit (PIXI.Sprite wrapping station canvas)
3. `worldLayer` — everything in world space (camera-transformed)
   - `trailLayer` — thruster trails (Phase 2.8: from tilt-corrected `getShipMuzzleWorldPositionsAt(...).thrusters`)
   - `effectsBehindLayer` — behind-ship effects
   - `asteroidLayer`
   - `stationLayer` — portal sprites (world space, not the 3D station)
   - `enemyLayer`
   - `projectileBehindLayer`
   - `playerLayer` — local + remote players + drones (drones keyed by `"player:i"` / `"<id>:i"`, Phase 3)
   - `projectileLayer`
   - `effectsLayer`
   - `effectsFrontLayer`
   - `floaterLayer`
   - `debugMuzzleGfx` + `debugMuzzleLabels` — Phase 2.6 debug overlay
4. `uiLayer` — screen-space HUD elements

---

## State Flow

```
User input (keyboard/mouse)
  → loop.ts (fire projectile locally, send input to server)
  → socket.ts sendInput()
  → server handler.ts input:move / input:attack
  → engine.ts tick() — authoritative physics
     - if firing: emit projectile:spawn with hardpointIndex/Ring/shipClass/targetId
                  (server advances p.nextMuzzlePair for standard pattern)
  → delta/snapshot payload (server-side change detection also fires on visual diffs)
  → client onDelta() / onSnapshot() in loop.ts
     - applyEntityUpdate() updates state.others, calls syncRemoteDronesFromWire()
  → applyServerSmoothing() lerps positions/angle
  → tickWorld() runs projectile steering + remote drone formations
  → pixiRender() reads state each frame
     - updateShip3D() → ship.lastYRot lerps, wrapper.position set
     - syncOtherPlayers → thruster trails via analytic hardpoint
     - syncProjectiles → spawn muzzle flash at pr.pos
     - syncDrones → local + remote drones
```

---

## Key Files

### Frontend

| File | Role |
|---|---|
| `src/App.tsx` | React root. Mounts canvas layers, wires all socket listeners, registers `onPlayerJoin` (initialises `drones` and `shieldMax` on `OtherPlayer`). |
| `src/game/loop.ts` | Core game loop. Local physics, firing logic with muzzle-pair cursor, enemy AI (client-side), remote drone formation math, projectile per-frame steering with `remoteTargetId`, socket event handlers (`onDelta`, `onSnapshot`, `onProjectileSpawnFromServer`). Also owns `recordDebugSpawn()` ring buffer. |
| `src/game/store.ts` | Global mutable game state (`state` object). React sync via `useSyncExternalStore`. |
| `src/game/types.ts` | All TypeScript types: `Player`, `OtherPlayer` (with `drones`, `shieldMax`), `Projectile` (with `remoteTargetId`), `Enemy`, `NpcShip`, `ModuleDef`, all game constants. |
| `src/game/pixi-renderer-v2-integrated.ts` | PixiJS renderer. Sprite pools, layer management, per-frame draw. `syncDebugMuzzleMarkers()` for Phase 2.6 overlay. Thruster trails via `getShipMuzzleWorldPositionsAt`, muzzle flashes at `pr.pos`. ~3800 lines. |
| `src/game/three-ship-layer.ts` | Three.js ship 3D layer. Loads GLBs, snapshots model-local hardpoints at template load, manages `activeShips` map with `worldUnitsPerModelUnit`. Exports: `getShipMuzzleWorldPositionsAt` (analytic, tilt-corrected), `getShipMuzzleWorldPositions` / `getShipHardpointPositions` (legacy, live transform), `debugEnumerateAllMuzzles`, `SHIP_WRAPPER_TILT_X`. |
| `src/game/three-station-layer.ts` | Three.js renderer for station. Renders to offscreen canvas, blit into PixiJS as `stationSprite`. |
| `src/game/pixi-effect-manager.ts` | Pooled sprite manager: `spawnThrusterTrail`, `spawnMuzzleFlash`, `spawnRocketLaunch`, `spawnPlasmaWake`. |
| `src/game/render.ts` | Canvas2D fallback renderer (used for texture baking). |
| `src/net/socket.ts` | Socket.IO client. Type definitions for `ProjectileSpawnEvent` (with `hardpointIndex/Ring/shipClass/targetId`), `DeltaEntity`, `WireDrone`. `setSocketListeners()`, `sendInput()`, etc. |

### Backend

| File | Role |
|---|---|
| `src/index.ts` | Express + Socket.IO server entry point. |
| `src/socket/handler.ts` | All socket event handling. `setupSocket()` function. Runs engine tick via `setInterval`. Owns `toClientPlayer()` (sends `drones` + `shieldMax`), delta builder with `visualChanged` diff, projectile broadcast forwarding `hardpointIndex/Ring/shipClass/targetId`. |
| `src/socket/state.ts` | `OnlinePlayer` type (with `drones: WireDrone[]` + `nextMuzzlePair` cursor), zone membership maps, player add/remove. |
| `src/game/engine.ts` | `GameEngine` class. `tick()` runs all physics, AI, collision. `computeStats()` mirrors frontend `effectiveStats()`. Projectile fire emits `hardpointIndex` per shot; standard pattern advances `p.nextMuzzlePair`. |
| `src/game/data.ts` | All game data: `ZONES`, `SHIP_CLASSES`, `ENEMY_DEFS`, `MODULE_DEFS`, `FACTIONS`, `ROCKET_AMMO_TYPE_DEFS`, etc. |
| `src/game/instance.ts` | Dungeon instance lifecycle. |
| `src/core/SpatialHashGrid.ts` | Spatial partitioning for entity proximity checks. |
| `src/db/schema.ts` | Drizzle ORM schema (players, clans, sessions). |

### Shared

| File | Role |
|---|---|
| `lib/game-constants.ts` | `MOVEMENT`, `NETCODE` constants shared between frontend and backend. |

---

## Camera System

- Camera center tracks `state.cameraTarget` (lerps toward player position)
- Zoom stored in `state.cameraZoom`
- PixiJS: `worldLayer.pivot.set(cam.x, cam.y)`, `worldLayer.position.set(screenW/2 + shakeX, screenH/2 + shakeY)`, `worldLayer.scale.set(zoom)`
- Three.js ships: positioned at `wrapper.position = ((worldX - camX) * zoom, 0, (worldY - camY) * zoom)`
- Three.js hardpoints: `getShipMuzzleWorldPositionsAt(entityId, ...)` reads `ship.lastYRot`, `lastWorldX`, `lastWorldY` internally (not the passed args), applies two-step Y-then-X rotation to model-local coords.

**Known cosmetic limitation:** camera shake (`shakeX`, `shakeY`) is applied to `worldLayer.position` but NOT to Three.js `wrapper.position`. During shake, the Pixi projectile sprite rides with the shake while the Three.js ship stays still. Not addressed.

---

## Wrapper Tilt Constant

`SHIP_WRAPPER_TILT_X = -0.85` in `three-ship-layer.ts` is used in two places:
1. `wrapper.rotation.x = SHIP_WRAPPER_TILT_X` — visual tilt of the 3D ship model
2. `SIN_TILT = sin(...)`, `COS_TILT = cos(...)` — analytic hardpoint transform (Phase 2.6)

**If this constant changes, both places update automatically.** Never hardcode `-0.85` elsewhere.

---

## Muzzle-Pair Cycle Constant

`LASER_PAIR_COUNT = 8` in both:
- `backend/src/game/engine.ts` (standard pattern block, line ~761)
- `frontend/src/game/loop.ts` (constant near `localNextMuzzlePair` declaration)

Server + client mirror the cursor: both start at 0 on connect / page load, both advance identically per fire. Server restart resyncs both to 0. Supports ships up to 16 muzzles cleanly.

---

## Hardpoint Data Flow (Phase 2.8 final)

```
GLB template load (three-ship-layer.ts:loadModel())
  ↓
collectHardpoints() — classifier finds hp_muzzle_NN / hp_weapon_NN / hp_thruster_NN
  ↓
Alphabetic sort by name (canonical order for hardpointIndex resolution)
  ↓
Snapshot model-local (x, y, z) via hp.getWorldPosition() on untransformed template
  ↓
Store in model.userData.localHardpoints = { muzzles, weapons, thrusters, ...Names[] }
  ↓
─────────────────────────────────────────────────────────────
At fire time:
  Server: p.nextMuzzlePair → hardpointIndex (0..7 for standard)
          emits projectile:spawn with hardpointIndex + hardpointRing
  Client: onProjectileSpawnFromServer or local fire block
          calls getShipMuzzleWorldPositionsAt(entityId, ...)
          reads ship.lastYRot + lastWorldX + lastWorldY internally
          applies two-step Y-then-X rotation to (mx, my, mz)
          returns { muzzles, weapons, thrusters } world coords
  Projectile spawns at ring[hardpointIndex % ring.length]
  Muzzle flash spawns at pr.pos (same location)
  Thruster trails spawn at each thruster hardpoint (per frame, all of them)
  Engine glow sprites (Three.js children of hp_thruster_*) update opacity via updateEngineGlow
```

Every step is tilt-corrected. Every step uses the last-rendered ship state. Every step matches what the user sees on screen.
