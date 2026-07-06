# Deployment — Cosmic Realm

*Last updated: 2026-07-06*

> **Do not deploy, restart PM2, change nginx, or modify production unless explicitly asked by the user.**

---

## Infrastructure

| Component | Details |
|---|---|
| Provider | Hetzner VPS |
| Domain | `cosmicrealm.net` |
| Production path | `/root/Cosmic-Realm` |
| Backend port | `3000` (internal) |
| Reverse proxy | nginx (site: `cosmicrealm`) |
| Process manager | PM2 (process: `cosmic-realm-backend`) |
| Database | PostgreSQL (local) |
| Redis | `127.0.0.1:6379` |
| SSH | `root@46.224.121.242`, key: `~/.ssh/id_ed25519` |

---

## Frontend Build & Deploy (production pattern used through Phase 2.8)

Build from Windows dev machine, deploy only the changed code files to avoid overwriting 370 MB of static assets on each push:

```bash
# Build
cd "E:/Program Files/Claude Code/Cosmic-Realm/frontend"
npm run build

# Package ONLY assets/ + index.html (excludes models/, sprites/, audio/, stations/, bg/, ships/)
# This is much smaller (~1.9 MB) and doesn't touch static assets on the VPS.
cd dist
tar -czf ../dist-code.tar.gz assets/ index.html
cd ..

# Upload
scp -i ~/.ssh/id_ed25519 dist-code.tar.gz root@46.224.121.242:/root/Cosmic-Realm/frontend/dist-code.tar.gz

# Extract on VPS (SSH)
ssh -i ~/.ssh/id_ed25519 root@46.224.121.242 \
  "cd /root/Cosmic-Realm/frontend/dist && tar -xzf ../dist-code.tar.gz && rm ../dist-code.tar.gz"
```

nginx serves the static `dist/` folder directly — no PM2 restart needed for frontend-only changes.

**After deploy:** Hard-refresh browser (`Ctrl+Shift+R`) — Vite hashes bundle filenames so old cache is bypassed automatically for JS, but `index.html` may be cached.

**Verify:**
```bash
ssh -i ~/.ssh/id_ed25519 root@46.224.121.242 \
  "cat /root/Cosmic-Realm/frontend/dist/index.html | grep -oE 'index-[^\"]+\.(js|css)'"
```
Should print the two new hashed filenames.

---

## Backend Deploy

**Important:** the VPS runs the backend via `tsx watch` (from `pnpm run dev`), not the compiled `dist/`. PM2 shows:
```
script args: -c pnpm run dev
```
This means uploading a `.ts` file triggers `tsx` to auto-reload the server within ~1 second. **No `npm run build` on the VPS is needed. No `pm2 restart` is needed.**

Standard backend deploy pattern (used through Phase 2.8):

```bash
# Backup the current file on the VPS (timestamped) — belt-and-suspenders rollback
ssh -i ~/.ssh/id_ed25519 root@46.224.121.242 \
  "cp /root/Cosmic-Realm/backend/src/socket/handler.ts /root/Cosmic-Realm/backend/src/socket/handler.ts.bak-$(date +%s)"

# scp the changed .ts file up
scp -i ~/.ssh/id_ed25519 \
  "E:/Program Files/Claude Code/Cosmic-Realm/backend/src/socket/handler.ts" \
  root@46.224.121.242:/root/Cosmic-Realm/backend/src/socket/handler.ts

# Verify tsx auto-reloaded (should see a `[tsx] change in ...` line, no error)
ssh -i ~/.ssh/id_ed25519 root@46.224.121.242 \
  "pm2 logs cosmic-realm-backend --lines 10 --nostream 2>&1 | tail -15"

# Also check the error log is empty
ssh -i ~/.ssh/id_ed25519 root@46.224.121.242 \
  "pm2 logs cosmic-realm-backend --lines 5 --nostream --err 2>&1 | tail -8"
```

If a scp'd file throws at import, tsx auto-reload will fail and PM2 shows the error in the error log. Roll back by copying the `.bak-*` file back over the source and tsx auto-reloads again. PM2 uptime persists across successful reloads.

**Backups accumulate on disk** at `/root/Cosmic-Realm/backend/src/*/*.bak-<epoch>` — safe to delete when you're confident a phase is stable. Multiple exist from Phases 2, 2.1, 2.7 — leave them for rollback safety.

---

## PM2

```bash
pm2 list                          # show all processes
pm2 restart cosmic-realm-backend  # restart backend
pm2 logs cosmic-realm-backend     # tail logs
pm2 status                        # process status
```

PM2 config is at `/root/Cosmic-Realm/ecosystem.config.js` (or similar).

---

## nginx

Config file: `/etc/nginx/sites-available/cosmicrealm` (symlinked to `sites-enabled`).

```bash
nginx -t                    # test config
systemctl reload nginx      # apply changes without downtime
```

nginx proxies `/api` and WebSocket (`/socket.io`) to `localhost:3000`. Serves `dist/` for everything else.

**Do not modify nginx config unless explicitly asked.**

---

## Database

PostgreSQL. Drizzle ORM manages schema.

```bash
# From backend directory
npm run db:push       # push schema changes (dev)
npm run db:migrate    # run migrations (production)
npm run db:generate   # generate migration files
```

**Do not run schema migrations on production without explicit instruction.**

---

## Redis

Used for session caching. Running locally on VPS at `127.0.0.1:6379`. No manual management normally needed.

---

## GitHub

```
Repository: https://github.com/Tammapac/Cosmic-Realm
Default branch: main
```

Deployment is **manual** — git push does not auto-deploy. After pushing to GitHub, the VPS must be updated separately (pull + rebuild or scp dist).

Standard commit flow:

```bash
# From E:\Program Files\Claude Code\Cosmic-Realm
git add <specific files>
git commit -m "descriptive message"
git pull origin main --rebase   # if remote has new commits
git push origin main
```

**Do not commit, push, or deploy unless the user explicitly asks.**

### Built dist snapshot (commit `c547ea8`)

`frontend/dist/` (all 714 files, ~370 MB) was force-added to git as a safety snapshot of the currently deployed build. The `.gitignore` still excludes `dist`, so future builds are not auto-tracked. To refresh the snapshot manually:

```bash
git add -f frontend/dist/
git commit -m "Refresh frontend/dist snapshot"
git push
```

Rollback strategy: `git checkout c547ea8 -- frontend/dist/`, then rsync/scp back to VPS.

---

## Verifying a Deploy

After deploying frontend:

```bash
ssh -i ~/.ssh/id_ed25519 root@46.224.121.242 "ls -lt /root/Cosmic-Realm/frontend/dist/assets/index-*.js | head -3"
```

The newest `index-*.js` filename should match what Vite just built locally (check `frontend/dist/assets/`).

After deploying backend:

```bash
ssh -i ~/.ssh/id_ed25519 root@46.224.121.242 "pm2 list"
```

Status should show `online` and uptime should be recent.
