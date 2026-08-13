# Project Context — Cosmic Realm

*Last updated: 2026-07-22*

> For AI-agent orientation (VPS/SSH, deploy, rules, key files) start with `CLAUDE.md`.
> PvP, the ship material system, and the unified HUD were added in the 2026-07 session —
> see `ARCHITECTURE.md`, `RENDERING_PIPELINE.md`, `HUD_UI_SYSTEM.md`.

## Game Overview

Cosmic Realm is a browser-based multiplayer Space MMO. Players pick a faction, fly a ship through space zones, fight enemies (raiders, scouts, destroyers, bosses), mine asteroids, upgrade modules, complete daily missions, enter dungeons, and interact with other online players in real time.

Gameplay is broadly inspired by DarkOrbit: top-down 2D action, ship classes, ammo types, PvP, faction rivalry.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend rendering | PixiJS 7 (2D WebGL), Three.js (3D ship/station models) |
| Frontend framework | React 18, TypeScript, Vite |
| Backend | Node.js, Express, Socket.IO |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Sessions | Redis |
| Process manager | PM2 |
| Reverse proxy | nginx |
| Hosting | Hetzner VPS |
| Domain | cosmicrealm.net |

---

## Ship Classes (15 total)

Ordered roughly by size/tier: `skimmer`, `wasp`, `reaver`, `vanguard`, `obsidian`, `marauder`, `phalanx`, `eclipse`, `specter`, `harbinger`, `titan`, `colossus`, `leviathan`, `sovereign`, `apex`

Each ship has:
- `baseSpeed`, `baseDamage`, `hullMax`, `shieldMax`, `cargoMax` in `SHIP_CLASSES` (shared between frontend/backend via `lib/`)
- A 3D GLB model in `frontend/public/models/` (e.g. `Apex_Destroyer.glb`)
- `hp_muzzle_NN`, `hp_thruster_NN`, `hp_weapon_NN` named empty objects inside the GLB for hardpoints (two-digit padded)
- Per-ship hardpoint counts vary — see `ASSET_STRUCTURE.md`. Apex has 9/9/2 (muzzles/weapons/thrusters), Sovereign 8/8/6, small ships 2/2/2-4.

---

## Zones (20+)

Defined in `backend/src/game/data.ts` as `ZONES`. Key zones:
- `alpha` — starter zone, weak enemies
- `nebula`, `crimson`, `void`, `forge`, `corona`, `fracture`, `abyss` — progression zones
- `marsdepth`, `maelstrom` — high-level
- `venus1`–`venus5`, `danger1`–`danger5` — faction/PvP zones
- `debug` — dev testing

---

## Factions

Four factions in `FACTIONS`: each gives a stat bonus (damage, speed, shield regen, or loot). Players pick a faction post-tutorial. Enemies in zones may belong to factions and deal modified damage/speed via `FACTION_ENEMY_MODS`.

---

## Combat System

- **Laser weapons:** ammo-based (laser ammo types in `ROCKET_AMMO_TYPE_DEFS`), fire patterns: `standard`, `sniper`, `scatter`, `rail`
  - `standard` fires 2 shots per pull; muzzle-pair cursor advances every fire (`LASER_PAIR_COUNT = 8` on both server + client). Ships with more than 2 muzzles cycle through all of them (Phase 2.7).
  - Server sends `hardpointIndex` + `hardpointRing` per shot; client resolves against canonical alphabetically-sorted GLB muzzle list (Phase 2.2).
- **Rocket weapons:** uses `ROCKET_MISSILE_TYPE_DEFS`, homing projectiles. Uses `hp_weapon_*` ring.
- **Convergence:** all lasers re-aim toward the target's live position for the first ~0.3s after spawn (`ttl > 1.2` window). Local uses `state.attackTargetId`; remote uses `remoteTargetId` from the server's `targetId` payload field (Phase 2.1).
- **Modules:** weapon / generator / module slots in `equipped`. Stats computed by `effectiveStats()` (frontend: `loop.ts`) and `computeStats()` (backend: `engine.ts`) — must stay in sync
- **Skills:** `SKILL_NODES` tree — `off-*`, `def-*`, `eng-*`, `ut-*` prefixes. Skills affect damage, fireRate, speed, hull, shield, crit. Skills do NOT affect projectile travel speed.
- **Drones:** deployed with ship, give passive stat bonuses (`DRONE_DEFS`). Remote drones sync via `WireDrone { id, kind, hp }` in delta (Phase 3); positions computed client-side via shared formation math.

---

## Key Constants Location

Shared between frontend and backend via `lib/game-constants.ts`:
- `MOVEMENT.SERVER_TICK_RATE` (30)
- `MOVEMENT.CLIENT_TICK_RATE`
- `NETCODE.*` — interpolation settings

Frontend-only game defs: `frontend/src/game/types.ts`  
Backend-only defs: `backend/src/game/data.ts`  
Both import from `lib/` for movement/netcode constants.

---

## Dungeons

Instanced combat zones. `InstanceManager` in `backend/src/game/instance.ts` manages them. Players enter via portals. Socket events: `instance:enter`, `instance:joined`, `instance:state`, `instance:event`, `instance:complete`, `instance:leave`.

---

## Social Systems

- **Clans:** managed via `backend/src/routes/clan.ts`
- **Chat:** zone-scoped chat via `chat:message` socket event
- **Leaderboard:** `backend/src/routes/leaderboard.ts`
- **Party system:** `party` array on Player state (frontend only, WIP)
