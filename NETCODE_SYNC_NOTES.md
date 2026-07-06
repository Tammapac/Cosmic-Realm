# Netcode & Sync Notes — Cosmic Realm

*Last updated: 2026-07-06 (post-Phase 2.8)*

## Overview

The server runs a fixed-rate game loop at **30Hz** (`MOVEMENT.SERVER_TICK_RATE`). Each tick:
1. Processes player inputs (movement, attacking, mining)
2. Steps enemy AI and physics
3. Steps projectile physics and collision
4. Builds a delta payload of changed entities
5. Broadcasts delta to nearby clients (within `CULL_RADIUS = 2000` units)

Full snapshot every 30 ticks (~1s).

---

## Socket Events

### Server → Client

| Event | Payload | When |
|---|---|---|
| `welcome` | `{ playerId, tickRate, friction, frictionRefFps }` | On connect |
| `delta` | `DeltaPayload` | Every server tick (changed entities only) |
| `snapshot` | `SnapshotPayload` | Every 30 ticks, full state resync |
| `player:join` | `RemotePlayer` (includes `drones`, `shieldMax`, `equipped`) | Another player enters the zone |
| `player:leave` | `{ id }` | Another player leaves |
| `projectile:spawn` | `ProjectileSpawnEvent` (see below) | A projectile is created server-side |
| `enemy:spawn` | enemy data | New enemy appears |
| `enemy:die` | `{ id }` | Enemy killed |
| `enemy:hit` | `EnemyHitEvent` | Enemy took damage |
| `enemy:attack` | `EnemyAttackEvent` | Enemy fired at player |
| `player:hit` | hit data | Local player took damage |
| `zone:enemies` / `zone:asteroids` / `zone:npcs` | full arrays | On zone enter |
| `asteroid:mine` / `asteroid:destroy` / `asteroid:respawn` | | Mining events |
| `boss:warn` | warn data | Boss spawn imminent |
| `npc:spawn` / `npc:die` | npc data | NPC appears/disappears |
| `instance:*` | various | Dungeon instance events |
| `chat:message` | message | Zone chat |
| `online:count` | number | Total online players |
| `admin:sync` | update patch | Admin panel force-sync |

### Client → Server

| Event | Payload | When |
|---|---|---|
| `input:move` | `{ dx, dy, angle }` | Every frame (throttled) |
| `input:attack` | `{ enemyId, laser, rocket, laserAmmo, rocketAmmo }` | When firing |
| `input:mine` | `{ targetId }` | When mining |
| `warp` | `{ zone }` | Zone travel |
| `dock:enter` / `dock:leave` | station data | Docking |
| `stats:update` | `{ hull, shield, level, shipClass, honor, inventory, equipped, skills, drones, faction }` | After hangar changes |
| `instance:enter` / `instance:leave` | dungeon id | Entering/leaving dungeon |
| `instance:enemy-hit` | hit data | Client reports dungeon hit |

---

## Delta / Snapshot System

### DeltaEntity type (`frontend/src/net/socket.ts`)

```typescript
type DeltaEntity = {
  id: string;                   // "p-<playerId>" for players; enemyId / npcId / astId otherwise
  entityType: "player" | "enemy" | "npc" | "asteroid";
  x: number; y: number;
  vx?: number; vy?: number;
  angle?: number;
  hp?: number; hpMax?: number;
  shield?: number; shieldMax?: number;   // shieldMax added in Phase 5
  version: number;
  // Player-specific visual state
  name?: string;
  shipClass?: string;
  level?: number;
  faction?: string | null;
  honor?: number;
  activeAmmoType?: string;
  activeRocketAmmoType?: string;
  equipped?: { weapon?, generator?, module?: (string|null)[] };
  drones?: WireDrone[];         // { id, kind, hp } — client recomputes formation locally
  // Enemy-specific
  type?: string;
  behavior?: string;
  damage?: number;
  speed?: number;
  color?: string;
  size?: number;
  isBoss?: boolean;
  bossPhase?: number;
  // NPC-specific
  state?: string;
  // Asteroid-specific
  yields?: string;
  // Mining state
  miningTargetId?: string | null;
};
```

### Server change-detection (`backend/src/socket/handler.ts` ~line 692)

Delta emits an entity if ANY of:
- **Physical:** moved > √0.5 world units, angle Δ > 0.02 rad, hp/shield/hpMax/shieldMax changed.
- **Visual (players only — Phase 5):** `name / shipClass / faction / level / honor / miningTargetId / activeAmmoType / activeRocketAmmoType / equipped / drones` changed by reference equality.

Reference-equality is safe because server-side code paths that update these always REASSIGN (`p.drones = data.drones.map(...)`; `cached.equipped = data.equipped`; etc.) rather than mutating in place. Empty-drones entries are emitted as `undefined`, not `[]`, to avoid false positives.

### Handler in `loop.ts` (client)

`onDelta(payload)` → calls `applyEntityUpdate(entity)` for each changed entity:
- `entityType === "player"` → id is `"p-<numId>"`, stripped to `numId`, matched against `state.others[i].id`. Updates pos/vel/angle via `setEntityTarget`, health/shield/shieldMax directly, faction/honor/name/shipClass/level/ammo/equipped directly. `entity.drones !== undefined` triggers `syncRemoteDronesFromWire()`.
- `entityType === "enemy"` → `state.enemies`, updates pos/vel/angle/hull.
- `entityType === "npc"` → `state.npcShips`.
- `entityType === "asteroid"` → `state.asteroids`.

Interpolation (`applyServerSmoothing`) then lerps `o.pos` toward the delta target at `NETCODE.INTERPOLATION_FACTOR` and `o.angle` at rate 8.0.

---

## Projectile Pipeline (post-Phase 2.7)

### Local Player (client-predicted)

```
loop.ts firing block (loop.ts:1600-1780):
  - reads state.attackTargetId → atkTarget
  - computes ang = atan2(atkTarget - p.pos)   [initial guide angle]
  - resolves muzzle world positions via getShipMuzzleWorldPositionsAt("player", p.pos.x, p.pos.y, p.angle)
      returns { muzzles, weapons, thrusters } — all tilt-corrected analytic (Phase 2.6)
  - for each pattern:
      sniper:   1 shot,  muzzle 0
      scatter:  3 shots, muzzles 0,1,2 (with spread)
      rail:     3 shots, muzzles 0,1,2 (burst jitter)
      standard: 2 shots, muzzles (pair·2, pair·2+1) where pair = localNextMuzzlePair
                localNextMuzzlePair = (localNextMuzzlePair + 1) % LASER_PAIR_COUNT
                LASER_PAIR_COUNT = 8   [supports up to 16 muzzles cleanly]
  - per shot:
      shotAng = atan2(atkTarget - muzzle)  [muzzle→target, not ship-center→target]
      fireProjectile("player", muzzleX, muzzleY, shotAng, ...)   [pushes to state.projectiles with renderOnly=false]
  - server fires same shots on same tick via input:attack state
  - server broadcasts projectile:spawn to nearby clients
  - onProjectileSpawnFromServer(): isLocalPlayer === true → returns early (dedup)
```

### Remote Player / Enemy

```
server engine.ts fireProj() (line ~709):
  - server tracks p.nextMuzzlePair on OnlinePlayer (Phase 2.7)
  - standard pattern: pair = p.nextMuzzlePair % 8; hpBase = pair * 2
  - per shot: emits events.push({
      type: "projectile:spawn",
      x, y, vx, vy,                     [synthetic offset around ship center — visual-only anchor]
      damage, color, size, crit, weaponKind, homing,
      ammoType: p.laserAmmoType,
      ttl: 1.5 (laser) / 4.0 (rocket),
      hardpointIndex: hpBase + si,      [Phase 2.2 — canonical muzzle slot]
      hardpointRing: "muzzle",           [or "weapon" for rockets]
      shipClass: p.shipClass,
      targetId: target.id,               [Phase 2.1 — remote convergence]
    })
  - p.nextMuzzlePair = (p.nextMuzzlePair + 1) % LASER_PAIR_COUNT
  handler.ts case "projectile:spawn": forwards ALL fields including hardpointIndex/Ring/shipClass/targetId

onProjectileSpawnFromServer() in loop.ts (~line 2900):
  1. Resolves color from ammoType via ROCKET_AMMO_TYPE_DEFS / ROCKET_MISSILE_TYPE_DEFS
  2. Looks up remote in state.others; calls getShipMuzzleWorldPositionsAt(entityId, other.pos.x, other.pos.y, other.angle)
     [args ignored — function reads ship.lastYRot / lastWorldX / lastWorldY internally]
  3. Ring = data.hardpointRing === "weapon" ? weapons : muzzles
  4. If ring.length > 0 and data.hardpointIndex !== undefined:
       idx = ((data.hardpointIndex % ring.length) + ring.length) % ring.length
       spawn = ring[idx]                 [pixel-perfect visible weapon]
     Else: fallback to server's (data.x, data.y)   [only during GLB load window]
  5. If !isRocket and data.targetId and enemy exists:
       re-aim initial (vx, vy) from spawn toward target's live position, preserving server speed magnitude
       tag projectile with remoteTargetId = data.targetId
  6. state.projectiles.push({ pos, vel, ..., renderOnly: true, remoteTargetId? })

Per-frame steering (loop.ts projectile filter, ~line 1886):
  - Local laser (fromPlayer, !renderOnly, !homing, ttl > 1.2, state.attackTargetId):
      re-aim vel from pr.pos toward state.enemies[attackTargetId]  [muzzle→target convergence]
  - Remote laser (fromPlayer, renderOnly, !homing, ttl > 1.2, remoteTargetId):
      re-aim vel from pr.pos toward state.enemies[remoteTargetId]  [same math]
  - Remote rocket / enemy projectile: no redirect (server-authoritative curve)
```

### Projectile Speeds (px/s) — must match between client and server

| Pattern | Client speedMul | Effective speed (230 × mul) | Server hardcoded |
|---|---|---|---|
| standard | 2.14 | 492.2 | 492 |
| sniper | 3.2 | 736 | 736 |
| scatter | 1.8 | 414 | 414 |
| rail | 2.5 | 575 | 575 |
| rocket | 1.18 | 271.4 | 272 |

Skills do NOT modify projectile speed on either client or server. `effectiveStats().speed` is ship movement speed only.

### Projectile TTL

- Client non-homing laser: **1.5s** (matches server `ttl: 1.5` in `engine.ts` line ~715)
- Client homing (rockets): **4.0s**
- Server sends `ttl` in `projectile:spawn` — client uses `data.ttl ?? (data.homing ? 4.0 : 1.5)`
- `renderOnly: true` projectiles skip the damage check in the projectile tick loop

### renderOnly Guard

In `loop.ts` projectile tick, remote projectiles (renderOnly) are excluded from:
- Redirect toward local `state.attackTargetId` (they use `pr.remoteTargetId` instead)
- Homing toward local `state.enemies` (rockets use server-authoritative curve)

This prevents local targeting state from hijacking remote projectile trajectories.

---

## Player Visual State Sync

### On `player:join`

`toClientPlayer(p, equipped)` in `handler.ts` sends:
```
{ id, name, shipClass, level, faction, clan, zone,
  x, y, vx, vy, angle,
  hull, hullMax, shield, shieldMax,
  honor,
  activeAmmoType, activeRocketAmmoType,
  equipped,           // ← Phase 3 / 5
  drones,             // ← Phase 3
}
```

`App.tsx` `onPlayerJoin` handler pushes to `state.others` with all fields, initialising drones as `{ id, kind, hp, orbitPhase: 0 }` (no anchor yet; formation math seeds it on first tick).

### On delta tick

Delta entity for remote players includes:
- **Position:** `x, y, vx, vy, angle`
- **Health:** `hp, hpMax, shield, shieldMax` ← `shieldMax` added Phase 5
- **Identity:** `name, shipClass, level, faction, honor, miningTargetId`
- **Equipment:** `activeAmmoType, activeRocketAmmoType, equipped, drones` ← Phases 3 + 5

**Still not in delta:** faction icon changes (implicit via `entity.faction`), skin/thruster keys (features don't exist).

---

## Local Player Prediction

- Client fires projectiles immediately (before server confirms). Local projectiles `renderOnly: false`, participate in damage logic (client-side prediction).
- Client moves ship immediately on input; server delta corrects if drift occurs via `applyServerSmoothing()`.
- Remote/enemy projectiles: `renderOnly: true`, visuals only. Server owns damage.

---

## Hardpoint Coordinate System (post-Phase 2.6/2.8)

Two systems coexist:

### Primary: analytic (`getShipMuzzleWorldPositionsAt`)

**Purpose:** projectile spawn positions, muzzle flashes, thruster trails — anything that must align with the visible ship model.

**Math:**
1. Y-axis heading rotation from `ship.lastYRot`:
   ```
   x1 =  mx·cos(θ) + mz·sin(θ)
   y1 =  my
   z1 = -mx·sin(θ) + mz·cos(θ)
   ```
2. X-axis wrapper tilt (SHIP_WRAPPER_TILT_X = -0.85):
   ```
   z2 = y1·SIN_TILT + z1·COS_TILT
   ```
3. Scale + translate:
   ```
   worldMuzzleX = ship.lastWorldX + x1 · worldUnitsPerModelUnit
   worldMuzzleY = ship.lastWorldY + z2 · worldUnitsPerModelUnit
   ```

`worldUnitsPerModelUnit = targetPixels / maxDim = (85 · sizeScale · 1.1) / model.userData.maxDim`. Cached on each `updateShip3D()` call.

Model-local hardpoint coords `(mx, my, mz)` are snapshotted **at template GLB load** by calling `hp.getWorldPosition()` on the untransformed template. Stored in `model.userData.localHardpoints`. See `three-ship-layer.ts:296-320`.

Node names captured in parallel arrays: `muzzleNames[]`, `weaponNames[]`, `thrusterNames[]` — for debug tooling.

### Legacy: `getShipMuzzleWorldPositions` / `getShipHardpointPositions`

**Purpose:** callers that specifically want the visible on-screen position at last render (subject to the wrapper transform's lerp), currently only 2D-fallback code paths that don't run for GLB-equipped ships.

Uses `hp.getWorldPosition()` on the tilted wrapper, then `wrapper.worldToLocal()` to undo the wrapper transform, then re-projects on the top-down plane. Correct but tied to render-loop transform state.

---

## `projectile:spawn` Payload Fields (post-Phase 2.7)

```typescript
type ProjectileSpawnEvent = {
  fromPlayerId?: number;
  fromPlayer?: boolean;        // true = player or NPC, false = enemy
  x: number; y: number;         // server-computed spawn — visual fallback only when GLB not loaded
  vx: number; vy: number;       // server velocity (authoritative for enemies/rockets; overridden for remote lasers via targetId re-aim)
  damage: number;
  color: string;
  size: number;
  crit?: boolean;
  weaponKind?: "laser" | "rocket" | "energy" | "plasma";   // Phase 2 widened union
  homing?: boolean;
  ammoType?: string;            // laser ammo key for color resolution
  ttl?: number;
  // Phase 2.2 — authoritative hardpoint selector
  hardpointIndex?: number;      // 0-based into canonical alphabetically-sorted GLB muzzle/weapon list
  hardpointRing?: "muzzle" | "weapon";
  shipClass?: string;
  // Phase 2.1 — for remote convergence
  targetId?: string;            // enemy the shooter is aiming at
};
```

**Client fallback ordering:**
1. If `hardpointIndex` provided AND GLB ring non-empty → use `ring[hardpointIndex % ring.length]`.
2. Else fall back to server-provided `(x, y)` — only during GLB-load window.

Enemy/NPC projectiles don't send `hardpointIndex` — they use server `(x, y)` verbatim.

---

## Remote Drones (Phase 3)

- Server stores `p.drones: WireDrone[]` on `OnlinePlayer`. Populated from `dbPlayer.drones` at connect; refreshed on `stats:update`.
- Delta and `player:join` payloads include `drones: WireDrone[]` where `WireDrone = { id, kind, hp }`.
- Positions never cross the wire — client recomputes formation locally per remote player using the same math as the local player (`updateRemoteDroneFormations(dt)` in `loop.ts` ~line 3120).
- `syncRemoteDronesFromWire(o, wire)` matches by drone `id` so anchor and orbitPhase persist across ticks (no teleport on delta).
- Renderer's `syncDrones()` uses composite string keys `"player:<idx>"` / `"<remoteId>:<idx>"` so local + remote drones don't share sprite slots.

**Not visible:** remote drone firing — server has no drone-projectile broadcast for other players.
