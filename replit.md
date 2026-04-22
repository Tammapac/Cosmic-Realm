# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

- **stellar-frontier** (web, `/`) — 2D 16-bit space MMORPG. Canvas-based ship combat, click-to-fly controls, 4 zones connected by portals, 4 stations (dock to access hangar with bounties/missions/skills/loadout/dungeons/ships/drones/market/cargo/services), NPC pilot AI, party/clan/chat. **Modular loadout** — each ship has weapon/generator/module slots; modules (5 rarities) are obtained from the in-station Module Market or as guaranteed drops from **instanced dungeons** (4 rifts: Alpha/Nebula/Crimson/Void, wave-based, scaled enemies). Save key `stellar-frontier-save-v4` (auto-migrates older saves and seeds starter modules). Compact bottom-anchored popups for faction picker, idle reward, event banners and notifications. Multiplayer is simulated via NPC pilots.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
