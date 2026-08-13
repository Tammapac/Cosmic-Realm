# Current Issues — Cosmic Realm

*Last updated: 2026-07-22*

---

## Status Legend

- 🔴 **Open** — not fixed, root cause known
- 🟡 **Partial** — partially fixed, still investigating
- 🟢 **Fixed** — resolved and deployed
- ⚪ **Intentional gap** — known missing feature, not a bug

---

## 2026-07-22 session status (newest)

**Fixed & deployed this session** (worktree `explosion-hit-effects`):
- 🟢 **Mission Journal** — black-on-dark list text (stale `.j-row{color:#2a2214}` in
  `index.css`); all `.j-row` states re-themed in `hud-skin.css`; title/description/
  category fallbacks; progress-division guards; selection reconciliation on
  complete/delete/invalid/reload. See `HUD_UI_SYSTEM.md`.
- 🟢 **"Billige Ränder" through popup text** — the `.panel` inner ring drew two thin
  horizontal lines across popup bodies. Inner ring → corner brackets; nested cards →
  new `.panel-inset`. Migrated all small Hangar cards.
- 🟢 **Orange / off-theme sweep** — `.gtip`, `.q-ticks`, BossBar name, Hangar ammo
  accents → gold; off-theme blue/grey buttons → `.gbtn`; greys → tokens.
- 🟢 **Ship/station "flat, no material depth"** — `space-material.ts` map tiling
  (`.repeat`) + broken-white-emissive kill. See `RENDERING_PIPELINE.md`.
- 🟢 **PvP** — mutual faction attack, player click-targeting, `player:die` + death VFX.

**Open / to revisit:**
- 🟡 **Red selection rim faint** — the post-process rim (`SELECT_FRAG`, `SELECT_LAYER=2`
  in `three-ship-layer.ts`) may be too subtle. Enable `window.__DEBUG_SEL` and check the
  falloff if asked to continue.
- 🔵 **HUD/popup consolidation (not a bug — remaining work)** — hand-rolled popups
  (App `RiftConfirmDialog`/notifications, `InventoryPanel` cells, `ZoneMapOverlay`,
  `TopBar` logout, `EventBanners`, shadcn `components/ui/*`) not yet on the shared kit;
  small nested `.panel` cards outside Hangar still need `.panel-inset`. Checklist in
  `HUD_UI_SYSTEM.md` §8.

---

## Issue 1 — Projectile spawn position doesn't match GLB muzzle hardpoints

**Status:** 🟢 Fixed (Phases 2.2 → 2.8)

**Original symptoms:** Laser projectiles visually originated from near the ship center or a fixed offset, not from the `hp_muzzle_*` hardpoint objects embedded in the GLB model. Offset changed with ship rotation.

**Root cause chain (fixed across multiple phases):**

1. **Phase 2 (early)** — the classifier only matched `hp_muzzle_*` / `hp_weapon_*` / `hp_thruster_*` exactly with trailing underscore. Widened to accept reverse convention (`muzzle_hp`, `weapon_hp`, etc.) — even though the current 15 GLBs all use the original convention.

2. **Phase 2.2** — the analytic formula that avoided render-loop lerp was still tied to the passed-in authoritative angle, one lerp-layer ahead of the visible ship.

3. **Phase 2.4** — switched to `ship.lastYRot` / `lastWorldX` / `lastWorldY` (the exact state Three.js last drew).

4. **Phase 2.6 (the tilt bug fix — the real root cause)** — the analytic formula ignored `wrapper.rotation.x = -0.85`. It treated the ship as a flat top-down billboard. This over-scaled `mz` contribution to screen-Y by `1/cos(0.85) ≈ 1.52×` and dropped the `my` contribution entirely. Every hardpoint with non-zero model-Y was off; rotation modulated the visible offset. Fixed by applying two-step Y-then-X rotation:
    ```
    x1 =  mx·cos(θ) + mz·sin(θ)
    y1 =  my
    z1 = -mx·sin(θ) + mz·cos(θ)
    z2 = y1·SIN_TILT + z1·COS_TILT
    worldMuzzleX = shipWorldX + x1 · worldUnitsPerModelUnit
    worldMuzzleY = shipWorldY + z2 · worldUnitsPerModelUnit
    ```

**Function used:** `getShipMuzzleWorldPositionsAt(entityId, worldX, worldY, angle)` in `frontend/src/game/three-ship-layer.ts`. Passed `(worldX, worldY, angle)` args are ignored — the function reads `ship.lastYRot / lastWorldX / lastWorldY` internally. Returns `{ muzzles, weapons, thrusters }`.

**Debug tool:** `window.__DEBUG_MUZZLE_MARKERS = true` in DevTools shows cyan rings at every analytic hardpoint plus magenta dots at recent spawns, with white delta lines. Also `window.__DEBUG_HARDPOINTS = true` for per-call console logs.

---

## Issue 2 — Remote player projectile spawn / convergence

**Status:** 🟢 Fixed (Phases 2.1, 2.2, 2.7)

**What was wrong:**
- Server emitted synthetic `x, y` offsets around ship center (`Math.cos(perpAng) * ±4/5px`), and `vx, vy` computed relative to those offsets. Remote clients rendered projectiles at those offsets, not at GLB muzzles.
- Client "nearest muzzle" heuristic collapsed all pellets from a scatter/rail spread onto a single muzzle.
- Even when the muzzle was resolved correctly, the remote projectile flew along the server's (offset-relative) velocity vector — visually missing the enemy.

**Fix:**
- Server now emits `hardpointIndex`, `hardpointRing` (`"muzzle" | "weapon"`), `shipClass`, `targetId` per shot.
- Client resolves `hardpointIndex` against the canonical alphabetically-sorted GLB muzzle list — deterministic across clients.
- Client re-computes initial vx/vy from the (correct) muzzle toward `targetId`'s live position, preserving server speed magnitude.
- Per-frame redirect during `ttl > 1.2` window continues to steer toward `remoteTargetId` — same math the local player uses with `state.attackTargetId`.

**Muzzle cycling (Phase 2.7):** Server `OnlinePlayer.nextMuzzlePair` advances by 1 each standard-pattern fire; two shots per fire use indices `pair*2` and `pair*2+1`. `LASER_PAIR_COUNT = 8` on both server (`backend/src/game/engine.ts`) and client (`frontend/src/game/loop.ts`). Ships with only 2 muzzles collapse to `(0,1)` every fire (unchanged behavior). Apex/Sovereign cycle through all their muzzles.

---

## Issue 3 — Projectile speed mismatch

**Status:** 🟢 Fixed (long-since)

Client TTL was 1.6s, server was 1.5s → corrected. Speeds calibrated to `230 * speedMul` per pattern, matching server hardcoded speeds. Skills do NOT affect projectile speed on either side.

---

## Issue 4 — Remote player drones not visible

**Status:** 🟢 Fixed (Phase 3)

Server now emits `drones: WireDrone[]` in delta / `player:join`. Client-side `syncRemoteDronesFromWire` reconciles per-drone by id; `updateRemoteDroneFormations(dt)` runs the same formation math as local; `syncDrones()` renders keyed by `"<owner>:<idx>"` so local and remote drones don't share sprite slots.

**Not fixed:** remote drones don't visually shoot — server has no drone-projectile broadcast for other players. Out of scope so far.

---

## Issue 5 — Thruster trail color inconsistency

**Status:** 🟢 Fixed (Phase 4)

Local player thruster color now sourced from `FACTIONS[p.faction].color` (same as remote), falling back to `#4ee2ff` if factionless. Same-faction pair sees identical colors on both sides.

---

## Issue 6 — Remote player visual state incomplete on join

**Status:** 🟢 Fixed (Phases 3 + 5)

`toClientPlayer(p, equipped)` in `backend/src/socket/handler.ts` includes: `hull, hullMax, shield, shieldMax, activeAmmoType, activeRocketAmmoType, equipped, drones`. Delta entity for players carries `shieldMax` plus the visual-diff push (see Issue 8).

---

## Issue 7 — Duplicate projectile rendering

**Status:** 🟢 Fixed (long-since)

`laser:fire` / `rocket:fire` handlers removed. `projectile:spawn` is the only path for remote projectile rendering.

---

## Issue 8 — Delta missing player visual-only fields

**Status:** 🟢 Fixed (Phase 5)

Server change-detection previously only fired on position/health/angle. If a stationary remote player changed faction, ship, name, ammo, equipped loadout, or drone count, the client had to wait up to 1s for the next snapshot. Fixed by adding `visualChanged` diff on `name / shipClass / faction / level / honor / miningTargetId / activeAmmoType / activeRocketAmmoType / equipped / drones` reference-equality checks. Server code paths that update these always reassign (fresh reference), so reference-equality catches every real change.

Also: delta `drones` field is emitted as `oOnline?.drones` (stable ref), not `?? []` (fresh empty array each tick), to prevent false-positive diffs on players with no drones.

---

## Issue 9 — Engine glow permanently visible / stale for remotes

**Status:** 🟢 Fixed (Phase 4)

`three-ship-layer.ts` `updateEngineGlow()` had a `Math.max(0.15, ...)` opacity floor — glow stuck at 15% even at speed 0. Changed to `speed < 1 ? 0 : Math.min(1, speed / 80)`.

`pixi-renderer-v2-integrated.ts` remote block: `updateEngineGlow(o.id, spd)` was inside the `spd > 0.5` trail-spawn gate. Moved outside so glow opacity is updated every frame regardless of trail state.

---

## Issue 10 — Muzzle flashes offset from projectile spawn

**Status:** 🟢 Fixed (Phase 2.8)

`effectManager.spawnMuzzleFlash` in `pixi-renderer-v2-integrated.ts` used the legacy `getShipHardpointPositions` (untilted, one-frame-lag) and had its own `weaponMountIndex` cycling that fought with the server's `hardpointIndex`. Simplified: flash fires at `pr.pos.x, pr.pos.y` — the projectile itself is already at the correct hardpoint via Phase 2.2/2.6/2.7. Deleted `weaponMountIndex` cycling and the `SHIP_HARDPOINTS` / `localToWorldHardpoint` / editor-fallback branches (dead code).

---

## Issue 11 — Thruster trails offset from visible engine nozzle

**Status:** 🟢 Fixed (Phase 2.8)

Same root cause as Issue 10 for muzzle flashes: local and remote thruster trail paths used legacy `getShipHardpointPositions`. Extended `ModelLocalHardpoints` to store thrusters, extended `getShipMuzzleWorldPositionsAt` return type to include `thrusters: {x,y}[]`. Both local (`if (speed > 0.5 && effectManager)`) and remote (`if (spd > 0.5)`) blocks in `pixi-renderer-v2-integrated.ts` now use the tilt-corrected function. **Every** `hp_thruster_*` node emits one trail per frame — Apex 2, Colossus/Marauder 5, Sovereign 6.

---

## Deprecated / Not on Roadmap

- **Rocket muzzle→target convergence** — rockets are already homing on server via `homingTargetId`. The Phase 2.1 initial re-aim and per-frame redirect explicitly skip `homing === true`.
- **`skinKey` / `thrusterTrailKey`** features (per-ship or per-player custom particle geometry) — don't exist in the codebase, not fabricated.
- **Server-side authoritative hardpoint positions** — server has no GLB data; it broadcasts a `hardpointIndex` and lets the client resolve. This is the right layering.
- **Camera shake decoupling Pixi from Three.js** — cosmetic, not in scope.

---

## Debug Flags (still active)

Set these in browser console (F12):

| Flag | What it logs / shows |
|---|---|
| `window.__DEBUG_MUZZLE_MARKERS = true` | **Visual overlay**: cyan rings at every analytic muzzle/weapon/thruster hardpoint per ship, magenta dots at recent projectile spawns (1.5s fade), white delta lines, yellow monospace labels with `<entityId> <ring>[<index>] <nodeName> Δ=<world-units> yaw=<deg>°`. |
| `window.__DEBUG_HARDPOINTS = true` | `[HP:analytic]` console line per call: entityId, ring, index, GLB node name, model-local coords, lastYRot, tilt, scale, ship world pos, muzzle world pos, delta vector. |
| `window.__DEBUG_PROJ = true` | Remote projectile spawn diagnostic: server pos, visual pos, speed, TTL, entityId, hardpointIndex/ring. Also `[RemoteAim]` initial re-aim and `[ProjRedirect] REMOTE laser redirected` per-frame steering. |
| `window.__DEBUG_PROJ_SYNC = true` | All `projectile:spawn` events (local + remote) with speed comparison. |

---

## Recommended Fix Order (all fixed as of Phase 2.8)

1. ✅ Projectile hardpoint sync (Issues 1, 2) — Phases 2 → 2.8
2. ✅ Remote drones + thruster sync (Issues 4, 5) — Phases 3 + 4
3. ✅ Name/faction/icon + shield sync (Issue 8) — Phase 5
4. ✅ Muzzle flash + thruster trail alignment (Issues 10, 11) — Phase 2.8
5. ✅ Muzzle pair cycling on multi-muzzle ships (Issue 2 extended) — Phase 2.7

Nothing on the priority list is open right now. New issues should be added at the top with today's date.
