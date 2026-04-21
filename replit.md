# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

- **stellar-frontier** (web, `/`) — 2D 16-bit space MMORPG. Canvas-based ship combat, click-to-fly controls, 4 zones connected by portals, 4 stations (dock to access hangar with quests/equipment/ships/cargo), NPC pilot AI, party invites, clan system (founding + joining), live chat. Game state is in-browser only and persisted to localStorage under `stellar-frontier-save-v1`. Multiplayer is simulated via NPC pilots — wire to a real server later via the api-server artifact if desired.

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
