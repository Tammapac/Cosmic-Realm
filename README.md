# Cosmic Realm

A browser-based 2.5D space MMO: pixel-art galaxy, real 3D ships rendered
through a pixelation/outline pipeline, server-authoritative combat, ARPG
loot, and a persistent multiplayer world of 20 hand-composed maps.

**Start here:** [`GAME_OVERVIEW.md`](GAME_OVERVIEW.md)
**AI agents start here:** [`CLAUDE.md`](CLAUDE.md) — orientation, VPS/SSH, deploy, rules

## Feature snapshot

- 20 open maps across 3 factions + a lawless frontier, each with a unique
  biome, painted landmark, ambient energy effect and story decoration
- 15 player hulls (Skimmer → Apex Destroyer), 15 enemy classes + pirates
  and multi-phase bosses, all as outlined pixel-3D models
- DarkOrbit-style combat: click-to-move, target lock, hardpoint lasers &
  homing rockets, silhouette-accurate hitboxes, ammo types, drones
- Progression: levels, 13 honor ranks, 4-branch skill tree, spendable
  attribute points, 3 passive career paths, milestones, leaderboard
- Economy: fluctuating commodity market across 71 stations, mining,
  factory refining, module shops, consumables
- ARPG loot: 7 rarities, affix rolls, legendaries — server-minted with an
  anti-forge audit trail
- Rift dungeons: 7 instanced wave dungeons with escalating drops
- Social: clans, chat, persistent rankings

## Tech stack

| Layer | Stack |
|---|---|
| Client | React + Vite, PixiJS (world/UI), Three.js (ships/stations), TypeScript |
| Server | Node + Express + Socket.io, authoritative game engine (tsx) |
| Data | PostgreSQL via drizzle-orm |
| Shared | `lib/` — hitboxes, loot rules, constants used by both sides |
| Ops | VPS, nginx, pm2 (see `DEPLOYMENT.md`) |

## Development

```bash
# backend (Express + Socket.io, tsx watch)
cd backend && npm install && npm run dev

# frontend (Vite dev server)
cd frontend && npm install && npm run dev
```

Production build: `cd frontend && npm run build` → deploy `dist/` (see
`DEPLOYMENT.md` for the VPS procedure).

## Documentation

**Game**
- [`GAME_OVERVIEW.md`](GAME_OVERVIEW.md) — what the game is, core loop, controls
- [`WORLD_ATLAS.md`](WORLD_ATLAS.md) — every map, biome, landmark, station, rift
- [`SHIPS_AND_ENEMIES.md`](SHIPS_AND_ENEMIES.md) — hulls, enemy roster, AI, spawning
- [`COMBAT_GUIDE.md`](COMBAT_GUIDE.md) — combat model, weapons, drones, defenses
- [`PROGRESSION_AND_ECONOMY.md`](PROGRESSION_AND_ECONOMY.md) — ranks, skills, careers, trading
- [`LOOT_SYSTEM.md`](LOOT_SYSTEM.md) — rarities, affixes, legendaries, item audit

**Technical**
- [`CLAUDE.md`](CLAUDE.md) — AI agent entry point (VPS/SSH, deploy, hard rules, key files)
- [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`RENDERING_PIPELINE.md`](RENDERING_PIPELINE.md) ·
  [`NETCODE_SYNC_NOTES.md`](NETCODE_SYNC_NOTES.md) · [`ASSET_STRUCTURE.md`](ASSET_STRUCTURE.md)
- [`HUD_UI_SYSTEM.md`](HUD_UI_SYSTEM.md) — unified HUD/popup design system, tokens, components
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — build & VPS deployment
- [`ASSET_LICENSES.md`](ASSET_LICENSES.md) — license/provenance of every third-party asset
- [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) · [`AI_HANDOFF.md`](AI_HANDOFF.md) · [`CURRENT_ISSUES.md`](CURRENT_ISSUES.md)
