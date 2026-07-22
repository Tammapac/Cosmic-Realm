# CLAUDE.md — Cosmic Realm

> **Read this first.** This is the single entry point for any AI agent working on this
> repo. It contains everything needed to orient: what the game is, where it lives, how
> to reach the server, how to deploy, and the hard rules. Deep dives are in the other
> `*.md` files (linked at the bottom).
>
> *Last updated: 2026-07-22*

---

## 1. What this is

**Cosmic Realm** is a browser-based multiplayer space MMO (DarkOrbit-inspired). Players
fly ships in real-time 2D zones, fight enemies and each other (PvP), mine, run dungeons
("rifts"), and progress. Live at **https://cosmicrealm.net**.

- **Frontend:** React + Vite + TypeScript. PixiJS 7 renders the 2D world; three separate
  Three.js `WebGLRenderer` instances draw 3D ship / enemy / station models on canvas
  overlays. HUD is DOM/React on top.
- **Backend:** Node.js + Express + Socket.IO, server-authoritative game loop (~30 Hz).
- **Data:** PostgreSQL via Drizzle ORM, Redis for sessions.
- **Infra:** VPS + nginx + PM2. Backend runs under `tsx watch` (live TS, no build step
  on the server).

---

## 2. Where it lives

| | |
|---|---|
| **Local dev (Windows)** | `E:\Program Files\Claude Code\Cosmic-Realm` |
| **GitHub** | `https://github.com/Tammapac/Cosmic-Realm` (default branch `main`) |
| **Production VPS** | `/root/Cosmic-Realm` |
| **Live URL** | `https://cosmicrealm.net` |

### Git worktrees
Background agents work in isolated worktrees under `.claude/worktrees/<name>`. Run all
commands from your worktree directory — **do not `cd` to the main checkout**. The git
stash stack is shared across worktrees; never use bare `git stash` (use a WIP commit or
`git stash push -u -m "<unique-tag>"`).

---

## 3. Server access (SSH / VPS)

```
Host:  46.224.121.242
User:  root
Key:   ~/.ssh/id_ed25519
```

```bash
# Connect
ssh -i ~/.ssh/id_ed25519 root@46.224.121.242

# One-off command
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@46.224.121.242 "pm2 list"
```

| Component | Detail |
|---|---|
| Production path | `/root/Cosmic-Realm` |
| Frontend served from | `/root/Cosmic-Realm/frontend/dist/` (nginx static) |
| Backend | PM2 process running `pnpm run dev` = `tsx watch src/index.ts`, port `3000` |
| Reverse proxy | nginx, site `cosmicrealm` — proxies `/api` + `/socket.io` → `localhost:3000`, serves `dist/` for the rest |
| Database | PostgreSQL (local), Drizzle ORM |
| Redis | `127.0.0.1:6379` (sessions) |
| CDN | Cloudflare — `index.html` is no-cache, hashed JS/CSS assets are cached |

---

## 4. Build & run

### Local dev
```bash
# Frontend (Vite dev server, hot reload)
cd frontend && npm run dev          # http://localhost:5173

# Backend
cd backend && npm run dev           # tsx watch, port 3000
```

### Frontend scripts (`frontend/package.json`)
`dev` · `build` (`vite build`) · `preview` · `typecheck` (`tsc --noEmit`)

### Backend scripts (`backend/package.json`)
`dev` (`tsx watch`) · `build` (`tsc`) · `start` · `db:push` · `db:migrate` · `db:generate`

> **Note:** `esbuild`/Vite tolerate unused vars; `tsc --noEmit` (`npm run typecheck`) is
> stricter. The build succeeding does **not** guarantee typecheck passes.

### Dev-only preview routes (append to any URL)
| URL | What |
|---|---|
| `/?hud-editor` | **Live HUD editor** — adjust HUD elements interactively (`src/editor/HudEditor.tsx`) |
| `/?ui-preview` | Unified popup/window system harness — `.panel` vs `.panel-inset`, journal rows, buttons, tooltip, modal (`src/demo/UiPreview.tsx`) |
| `/?hud-showcase` | Isolated new-HUD components with test sliders (`src/demo/HudShowcase.tsx`) |

These work locally **and** on the live site (e.g. `https://cosmicrealm.net/?hud-editor`).

---

## 5. Deploy (summary — full detail in `DEPLOYMENT.md`)

Deployment is **manual**. `git push` does NOT auto-deploy.

**Frontend** — build locally, ship only the web bundle (NOT the ~370 MB of static
models/textures/audio, which already live on the VPS and rarely change):

```bash
cd frontend && npm run build
# package just html + hashed js/css + fonts (~0.7 MB)
cd dist && tar -czf ../webbundle.tar.gz index.html assets/*.js assets/*.css assets/fonts && cd ..
scp -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no webbundle.tar.gz root@46.224.121.242:/tmp/webbundle.tar.gz
ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@46.224.121.242 \
  "cd /root/Cosmic-Realm/frontend/dist && tar -xzf /tmp/webbundle.tar.gz"
rm -f webbundle.tar.gz
# verify: index.html should reference the hash you just built
curl -s "https://cosmicrealm.net/?_cb=$(date +%s)" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1
```

**Backend** — `scp` the changed `.ts` up; `tsx watch` auto-reloads in ~1 s, no PM2
restart, no build on the server:

```bash
scp -i ~/.ssh/id_ed25519 backend/src/socket/handler.ts \
  root@46.224.121.242:/root/Cosmic-Realm/backend/src/socket/handler.ts
ssh -i ~/.ssh/id_ed25519 root@46.224.121.242 "pm2 logs cosmic-realm-backend --lines 10 --nostream"
```

> `dist/assets/*` is gitignored; only `dist/index.html` is tracked (a stale leftover).
> Do NOT commit rebuilt `dist/` artifacts — revert them before committing source.

---

## 6. Hard rules

1. **Server stays authoritative.** Server owns positions, damage, collision, projectile
   physics, rewards, mission logic. Client owns visuals, local prediction, rendering.
   Do **not** move authority to the client.
2. **Don't change combat/economy balance** (damage, fire rates, speeds, cooldowns,
   rewards, drop rates) unless explicitly asked.
3. **Don't rewrite the renderer.** `pixi-renderer-v2-integrated.ts` (~3800 lines) and the
   Three.js layers are large and interconnected — targeted edits only, no refactors
   unless asked.
4. **Don't touch DB schema, auth, nginx, PM2, or production** unless explicitly asked.
5. **Don't commit / push / deploy / restart services** unless the user asks — EXCEPT
   background agents in a worktree, which should commit + push + open a draft PR when
   done (never to `main`, never force-push). `gh` may not be installed; then just push
   and give the PR link.
6. **One subsystem at a time.** Keep changes focused; systems are interdependent.
7. **No new UI design language.** The main HUD is the single source of truth. Use the
   existing tokens/components — see `HUD_UI_SYSTEM.md`. No new colors, frames, corner
   shapes, materials, or orange accents.
8. **The user tests on the live site.** After frontend changes, deploy to the VPS and
   verify the live bundle hash — don't assume a local build is enough.

---

## 7. Key files

| What | File |
|---|---|
| Game tick, firing, enemy AI, projectile spawn | `frontend/src/game/loop.ts` |
| PixiJS 2D world renderer (~3800 lines) | `frontend/src/game/pixi-renderer-v2-integrated.ts` |
| Three.js ship 3D layer + hardpoint math | `frontend/src/game/three-ship-layer.ts` |
| Three.js station 3D layer | `frontend/src/game/three-station-layer.ts` |
| Ship/station material system (presets, aging, glow) | `frontend/src/game/space-material.ts` |
| Effect manager (trails, muzzle flash, launch) | `frontend/src/game/pixi-effect-manager.ts` |
| Client socket + event types | `frontend/src/net/socket.ts` |
| Shared client store | `frontend/src/game/store.ts` |
| All client type defs | `frontend/src/game/types.ts` |
| React app + socket wiring | `frontend/src/App.tsx` |
| HUD design tokens | `frontend/src/styles/hud/hud-tokens.css` |
| HUD skin (`.panel`, `.gbtn`, `.j-row`, tooltip…) | `frontend/src/styles/hud/hud-skin.css` |
| Shared popup components | `frontend/src/components/hud-ui.tsx` |
| Server socket handler | `backend/src/socket/handler.ts` |
| Server game engine + tick + fire | `backend/src/game/engine.ts` |
| Server game data (zones, ships, modules) | `backend/src/game/data.ts` |
| DB schema | `backend/src/db/schema.ts` |
| Shared constants (movement/netcode) | `lib/game-constants.ts` |

---

## 8. Documentation map

| Doc | Covers |
|---|---|
| **`CLAUDE.md`** (this file) | Orientation, VPS/SSH, deploy summary, rules |
| `AI_HANDOFF.md` | Detailed handoff, recent-work history, debug flags |
| `DEPLOYMENT.md` | Full deploy/PM2/nginx/DB/Redis/GitHub procedures |
| `HUD_UI_SYSTEM.md` | The unified HUD/popup design system, tokens, components, migration status |
| `ARCHITECTURE.md` | System architecture, layer stack, data flow |
| `RENDERING_PIPELINE.md` | PixiJS layers, Three.js overlays, hardpoint math |
| `NETCODE_SYNC_NOTES.md` | Delta/snapshot netcode, projectile pipeline, coordinate systems |
| `SHIPS_AND_ENEMIES.md` | Ship classes, enemy defs |
| `WORLD_ATLAS.md` / `GAME_OVERVIEW.md` / `PROGRESSION_AND_ECONOMY.md` | Zones, gameplay, economy |
| `COMBAT_GUIDE.md` / `LOOT_SYSTEM.md` | Combat + loot detail |
| `ASSET_STRUCTURE.md` / `ASSET_LICENSES.md` / `PARALLAX_ASSET_CATALOG.md` | Assets, licensing |
| `CURRENT_ISSUES.md` | Known bugs, root causes, status |
