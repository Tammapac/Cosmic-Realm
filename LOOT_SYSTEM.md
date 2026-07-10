# Loot System (ARPG-style, data-driven)

## Overview
Enemies can drop **rolled equipment items** on top of the existing credit/resource
loot. Items have an item level (ilvl), one of 7 rarities, randomized affixes with
tiered value ranges, and (legendary+) named legendary effects. All generation is
**server-authoritative**; the client only displays what the server minted.

## Architecture
- `lib/loot/loot.ts` — shared core (compiled to `loot.js` like `game-constants`):
  types, RNG (`mulberry32`, seed persisted per item), rarity/affix/base tables,
  legendary table, `rollDrop`, `resolveAffixStats`, `validateItem`, display helpers.
  **Recompile after editing:** `cd backend && npx tsc ../lib/loot/loot.ts --target es2020 --module esnext --sourceMap --skipLibCheck`
- `backend/src/game/lootService.ts` — kill-time drop rolls (server-minted
  instanceIds), `item_audit` registry (memory + Postgres), `sanitizeInventory`
  save guard.
- `backend/src/game/engine.ts` — `LootDrop.item` on `enemy:die` (4 player-kill
  branches); `sumEquippedStats` folds `resolveAffixStats`.
- `backend/src/routes/player.ts` — `/save` strips forged/duped/mutated rolled
  items + cleans equipped refs before persisting.
- `backend/src/socket/handler.ts` — `stats:update` async-sanitizes the combat cache.
- `frontend/src/game/loop.ts` — auto-pickup of `loot.item` in `onEnemyDie`;
  client `sumEquippedStats` folds the same `resolveAffixStats`.
- `frontend/src/components/InventoryPanel.tsx` — inventory window built on
  `PNG GUI/Inventory/inventory.png` (hotkey **I**, 5×6 grid pages, dbl-click
  equip/unequip, right-click sell while docked).
- `frontend/src/game/loot-ui.ts` — shared display helpers (name, color, tooltip,
  sell price) used by InventoryPanel + Hangar.

## Rules
- **ilvl** = enemy level ±(−1..+2), pirate +2, boss +4 (floored at enemy level),
  tier-6 zones +6; capped at 60. Enemy level = zone unlock level + roster rank×2 (+4 boss).
- **Affix tiers**: 6 brackets (ilvl 1-10/…/51-60). An item's affixes always roll
  at the bracket tier — low zones can never drop endgame stat ranges.
- **Rarities**: common(0 affixes) → uncommon(1-2) → rare(2-3, ilvl≥5) →
  epic(3-4, ilvl≥12) → legendary(2-3 + effect, ilvl≥20) → relic(4-5, ilvl≥34) →
  celestial(5-6, ilvl≥45). Higher rarity also rolls higher inside the tier range.
- **Drop profiles**: trash 4% → standard 5.5% → veteran 7% → pirate 8.5% →
  heavy 11% → world elite 16% → boss 100% with guaranteed rare+.
  `lootBonus` stat (luck) scales chance and rare+ weights.
- **Legendary effects** are pure stat bundles (`LEGENDARIES`) resolved by
  `resolveAffixStats` on both sides — no combat-code special cases.
- **fireRate is multiplicative**, all other affix stats additive.

## Anti-cheat
Every minted item is fingerprinted (defId/ilvl/rarity/seed/affixes) into
`item_audit` (+ in-memory cache). On `/save` and `stats:update`, rolled items
must exist in the registry, match the fingerprint, belong to the player, and be
unique in the inventory — otherwise they're stripped and logged (`[LOOT]`).
Plain `{instanceId, defId}` shop items are untouched (legacy path).

## Tests & simulation
- `cd backend && npx tsx ../scripts/loot-tests.ts` — 381 assertions: pool ids,
  ilvl bounds, affix counts/tiers/ranges/groups, boss guarantees, determinism,
  legendary rules, validator matrix, stat-resolution contract.
- `cd backend && npx tsx ../scripts/loot-sim.ts` — 50k kills × 9 scenarios →
  drop-rate/rarity/ilvl/affix distribution report.

## Deployment note
`item_audit` table requires a drizzle push on the VPS:
`cd /root/Cosmic-Realm/backend && npm run db:push`
