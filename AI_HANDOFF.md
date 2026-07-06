# AI Handoff — Cosmic Realm

*Last updated: 2026-07-06 (post-Phase 2.8)*

> **READ THIS FIRST before touching any code.**

## What This Project Is

Cosmic Realm is a browser-based multiplayer Space MMO inspired by DarkOrbit. Players fly ships in real-time 2D zones, fight enemies, mine asteroids, do dungeons, and interact with other players. The game uses:

- **Frontend:** React + PixiJS (2D world rendering) + Three.js (3D ship/station models on canvas overlays)
- **Backend:** Node.js + Express + Socket.IO, game loop ticking at 30Hz
- **Database:** PostgreSQL via Drizzle ORM, Redis for sessions
- **Infra:** PM2, nginx, Hetzner VPS. Live at **cosmicrealm.net**.

---

## Rules For AI Models

1. **Do not rewrite the renderer.** The PixiJS renderer (`pixi-renderer-v2-integrated.ts`, ~3800 lines) is large and complex. Do not refactor it unless explicitly asked. Make targeted edits only.
2. **Do not change combat balance.** Damage values, fire rates, speeds, cooldowns — leave them alone unless the user explicitly says to change them.
3. **Do not touch the database schema, auth, nginx, PM2, or deployment** unless explicitly requested.
4. **Fix one subsystem at a time.** The project has interconnected systems. Changing one thing can break another. Keep changes focused and minimal.
5. **Prefer shared constants over duplicated hardcoded values.** The shared lib is at `lib/game-constants.ts`. Frontend types/defs live in `frontend/src/game/types.ts` and `backend/src/game/data.ts` (mirrored). See also `SHIP_WRAPPER_TILT_X` shared constant in `three-ship-layer.ts`.
6. **Keep the server authoritative.** The server owns: positions, damage, collision, projectile physics. The client owns: visual effects, local prediction, rendering.
7. **Always list changed files and test steps** at the end of your response.
8. **Do not commit, push, deploy, or restart services** unless the user explicitly says to. The deploy process is described in `DEPLOYMENT.md`.
9. **VPS uses `tsx watch`** — backend TypeScript source runs live (no compile step needed on VPS). `scp` a `.ts` file up and tsx auto-reloads within a second. PM2 uptime persists across reloads unless the code throws at import.
10. **Debug flags exist for every recent phase** — see `CURRENT_ISSUES.md` for the full list. Prefer enabling `window.__DEBUG_MUZZLE_MARKERS` / `__DEBUG_HARDPOINTS` / `__DEBUG_PROJ` before guessing at coordinate math.

---

## Repo

- **GitHub:** `https://github.com/Tammapac/Cosmic-Realm`
- **Default branch:** `main`
- **Local dev path (Windows):** `E:\Program Files\Claude Code\Cosmic-Realm`
- **VPS path:** `/root/Cosmic-Realm`
- **Latest commit as of this doc:** `c547ea8` (adds `frontend/dist/` snapshot as safety backup)

---

## Quick File Map

| What you want | File |
|---|---|
| Game tick, firing logic, enemy AI, projectile spawn recording | `frontend/src/game/loop.ts` |
| Socket event types + client socket | `frontend/src/net/socket.ts` |
| PixiJS 2D world renderer (~3800 lines) | `frontend/src/game/pixi-renderer-v2-integrated.ts` |
| Three.js ship 3D layer, hardpoint math, debug enumeration | `frontend/src/game/three-ship-layer.ts` |
| Three.js station 3D layer | `frontend/src/game/three-station-layer.ts` |
| React app + socket listener wiring | `frontend/src/App.tsx` |
| Shared game state (store) | `frontend/src/game/store.ts` |
| All type definitions (Projectile, OtherPlayer, Drone, ...) | `frontend/src/game/types.ts` |
| Effect manager (thruster trails, muzzle flash, rocket launch) | `frontend/src/game/pixi-effect-manager.ts` |
| Server socket event handler | `backend/src/socket/handler.ts` |
| Server game engine + tick + projectile fire | `backend/src/game/engine.ts` |
| Online player state (`OnlinePlayer` type) | `backend/src/socket/state.ts` |
| Game constants (zones, ships, modules) | `backend/src/game/data.ts` |
| Shared movement/netcode constants | `lib/game-constants.ts` |
| DB schema | `backend/src/db/schema.ts` |

---

## Recent Work (Phases 2 → 2.8)

The whole remote-visual-desync class of issues was resolved between 2026-07-05 and 2026-07-06. See `CURRENT_ISSUES.md` for full status — every phase is 🟢 fixed. Highlights:

- **Phase 2** — server sends `hardpointIndex` + `hardpointRing` + `shipClass` per projectile spawn; client resolves canonical alphabetically-sorted GLB muzzle list. Fixed remote lasers all firing from one muzzle.
- **Phase 2.1** — server sends `targetId`; client recomputes remote projectile vel from muzzle→target and runs per-frame redirect loop. Fixed remote lasers grazing past the enemy.
- **Phase 2.2 / 2.4** — analytic muzzle world position from `ship.lastYRot / lastWorldX / lastWorldY`, not from live wrapper transform or authoritative angle. Fixed one-frame-lag drift.
- **Phase 2.6 (the real root cause)** — analytic formula ignored `wrapper.rotation.x = -0.85`. Added two-step Y-then-X rotation. Fixed the "offset rotates with the ship" symptom.
- **Phase 2.7** — server + client per-player `nextMuzzlePair` cursor. Standard pattern cycles muzzles `(0,1) → (2,3) → (4,5) → ...` up to `LASER_PAIR_COUNT = 8`. Apex/Sovereign/Colossus now use all their muzzles.
- **Phase 2.8** — muzzle flashes fire at projectile's own `pr.pos` (already anchored via Phase 2.2/2.6/2.7); thruster trails use tilt-corrected `getShipMuzzleWorldPositionsAt(...).thrusters`. All `hp_thruster_*` nodes emit trails. Deleted legacy `weaponMountIndex` cycling and `getShipHardpointPositions` calls from the primary paths.
- **Phase 3** — remote drones. `WireDrone { id, kind, hp }` in delta + `player:join`. Client runs formation math per remote player.
- **Phase 4** — local thruster color from faction. Engine glow floor removed; updated every frame.
- **Phase 5** — server change-detection also fires on visual state (name/ship/faction/level/honor/miningTargetId/ammo/equipped/drones by reference equality). `shieldMax` added to delta.

---

## Live Debug Flags

Set these in browser DevTools console (F12) — no refresh needed:

| Flag | What it does |
|---|---|
| `window.__DEBUG_MUZZLE_MARKERS = true` | **Visual overlay**: cyan rings at every analytic muzzle/weapon/thruster on every active 3D ship. Magenta dots at recent projectile spawns. White delta lines. Yellow labels with GLB node name + Δ + yaw. |
| `window.__DEBUG_HARDPOINTS = true` | Per-call console line: `[HP:analytic] entityId=... muzzle[i] name=hp_muzzle_XX modelLocal=(mx,my,mz) lastYRot=... scale=... shipWorld=(...) muzzleWorld=(...)`. |
| `window.__DEBUG_PROJ = true` | Remote projectile spawn + per-frame steering diagnostic. `[RemoteAim]`, `[ProjRedirect]`. |
| `window.__DEBUG_PROJ_SYNC = true` | All `projectile:spawn` events (local + remote) with speed comparison. |

---

## Key Concepts To Understand

### Hardpoint pipeline (as of Phase 2.8)

Every GLB ship has `hp_muzzle_NN` / `hp_weapon_NN` / `hp_thruster_NN` empty-object nodes (verified in Phase 2.5 across all 15 ships). At GLB template load, we snapshot each node's model-local `(x, y, z)` and name into `model.userData.localHardpoints`. At fire/render time, we run the analytic transform:

```
theta = ship.lastYRot                    // lerped visual rotation
worldMuzzleX = ship.lastWorldX + (mx·cos(θ) + mz·sin(θ)) · s
worldMuzzleY = ship.lastWorldY + (my·SIN_TILT + (-mx·sin(θ) + mz·cos(θ))·COS_TILT) · s
```

Where `s = worldUnitsPerModelUnit = (85 · sizeScale · 1.1) / maxDim`. Yields pixel-perfect alignment with the visible tilted 3D ship, regardless of interpolation lag or camera motion.

### Muzzle-pair cycling (Phase 2.7)

Standard laser pattern fires 2 shots per pull, cycling pairs:
- Server: `p.nextMuzzlePair` on `OnlinePlayer`, advance by 1 each fire, emit `hardpointIndex = pair·2` and `pair·2+1`.
- Client mirror: `localNextMuzzlePair` in `loop.ts`, same advance rule.
- `LASER_PAIR_COUNT = 8`. Client resolves each `hardpointIndex % ring.length`, so ships with fewer muzzles wrap naturally.

### Remote projectile convergence (Phase 2.1)

Remote `projectile:spawn` carries `targetId`. Client re-aims initial vel from spawn→target (preserving server speed magnitude), tags projectile with `remoteTargetId`. Per-frame filter re-steers `renderOnly && fromPlayer && !homing && ttl > 1.2` projectiles toward `state.enemies[remoteTargetId]` — same math local player uses with `state.attackTargetId`.

### Backend hot-reload

The VPS runs the backend as `pnpm run dev` (= `tsx watch src/index.ts`). Uploading a `.ts` file triggers auto-reload within ~1 second. **PM2 uptime shows 14+ hours despite dozens of reloads**. Backend backups exist on disk as `<file>.ts.bak-<epoch>` — leave them for rollback safety.

---

## Current Priority Issues (as of 2026-07-06)

**None.** All open issues resolved through Phase 2.8. See `CURRENT_ISSUES.md` for the full list of what was fixed.

Watch for new issues by monitoring:
- Cyan rings drifting off visible weapons → `getShipMuzzleWorldPositionsAt` math bug
- Any ship showing "NO muzzle/weapon hardpoints found" warning on GLB load → classifier missed a naming pattern (unlikely — Phase 2.5 verified all 15 ships)
- `[HP:analytic]` log showing `Δ` values > ~5 world units → alignment regression

---

## See Also

- `PROJECT_CONTEXT.md` — game overview, zones, ship classes
- `ARCHITECTURE.md` — system architecture, layer stack, data flow
- `NETCODE_SYNC_NOTES.md` — delta/snapshot system, projectile pipeline (post-Phase 2.7), coordinate systems
- `RENDERING_PIPELINE.md` — PixiJS layers, Three.js overlays, hardpoint math (post-Phase 2.6)
- `ASSET_STRUCTURE.md` — GLB models, public assets, hardpoint naming, per-ship muzzle/weapon/thruster counts
- `CURRENT_ISSUES.md` — verified bugs and root causes (Phases 2 → 2.8 all 🟢)
- `DEPLOYMENT.md` — how to build and deploy
