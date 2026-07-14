# Cosmic Realm — Ships & Enemies

## Player Ships — 15 hulls

Bought at station shipyards; owned hulls can be swapped freely when docked.
Every hull is a real 3D model (GLB) rendered in the pixel-art pipeline, with
authored weapon/thruster hardpoints — lasers visibly fire from the guns.

| Ship | Price (cr) | Hull | Shield | Speed | Dmg | Slots W/G/M | Drones | Cargo | Role |
|---|---|---|---|---|---|---|---|---|---|
| Skimmer Mk-I | free | 100 | 50 | 120 | 8 | 1/2/1 | 1 | 20 | starter |
| Wasp Interceptor | 15k | 90 | 70 | 145 | 10 | 2/2/1 | 1 | 14 | glass cannon, fastest hull |
| Vanguard | 50k | 180 | 120 | 90 | 14 | 2/3/2 | 2 | 40 | all-rounder |
| Obsidian Reaver | 65k | 220 | 180 | 120 | 22 | 3/4/3 | 3 | 30 | deep-lane predator |
| Reaver Mk-II | 120k | 160 | 140 | 120 | 18 | 3/3/2 | 2 | 30 | swift raider |
| Marauder | 500k | 280 | 200 | 100 | 26 | 4/4/3 | 4 | 60 | heavy gunship |
| Phalanx Cruiser | 900k | 340 | 280 | 90 | 24 | 4/5/4 | 5 | 70 | drone carrier |
| Specter Phaseframe | ~1.1M | — | — | — | — | mid-high | — | — | phase skirmisher |
| Titan Bulwark | 1.5M | 400 | 300 | 78 | 30 | 6/7/5 | 5 | 80 | walking fortress |
| Harbinger Class | ~3.2M | — | — | — | — | high | — | — | strike cruiser |
| Leviathan Dreadnought | ~5M | — | — | — | — | high | — | — | dreadnought |
| Colossus MK X | ~8M | — | — | — | — | high | — | — | super-heavy |
| Eclipse Destroyer | ~12M | — | — | — | — | very high | — | — | destroyer |
| Sovereign Flagship | ~20M | — | — | — | — | very high | — | — | flagship |
| Apex Destroyer | ~35M | — | — | — | — | top (2.0× size) | — | — | endgame apex |

(Exact upper-tier stats: `frontend/src/game/types.ts` → `SHIP_CLASSES`.)

## Enemy NPCs — 15 classes

Every enemy type has its own unique 3D model, sized small → big with power.
What you see is exactly what you hit: hitboxes are the ships' actual
silhouettes. Names render red above every enemy; bosses get amber diamonds
and a top-of-screen boss health bar when you're near.

| Enemy | Behavior | Hull | Dmg | Speed | XP | Credits | Honor | Signature loot |
|---|---|---|---|---|---|---|---|---|
| Scout | fast | 70 | 12 | 130 | 5 | 10 | 0 | scrap |
| Interceptor | fast | 130 | 28 | 150 | 22 | 60 | 2 | scrap ×3 |
| Raider | chaser | 170 | 22 | 75 | 12 | 25 | 1 | plasma |
| Corvette | chaser | 340 | 38 | 95 | 50 | 140 | 5 | iron ×3 |
| Destroyer | tank | 500 | 40 | 50 | 30 | 75 | 3 | warp coil |
| Sentinel | ranged | 450 | 48 | 100 | 65 | 220 | 8 | quantum ×2 |
| Specter | fast | 260 | 52 | 145 | 70 | 240 | 9 | void ×2 |
| Voidling | ranged | 280 | 35 | 90 | 40 | 100 | 5 | void crystal |
| Phantom | ranged | 380 | 65 | 110 | 90 | 300 | 11 | quantum ×3 |
| Wraith | fast | 320 | 60 | 160 | 80 | 280 | 10 | void ×3 |
| Dread | tank | 850 | 55 | 45 | 75 | 200 | 10 | dread core |
| Titan | tank | 1500 | 75 | 35 | 150 | 500 | 18 | dread ×4 |
| Juggernaut | tank | 1800 | 85 | 55 | 180 | 620 | 22 | dread ×5 |
| Overlord | tank | 2200 | 95 | 30 | 250 | 800 | 30 | dread ×6 |
| Leviathan | tank | 3500 | 120 | 45 | 400 | 1200 | 45 | dread ×8 |

Faction variants: Mars and Venus zones re-stat and re-tint the roster
(e.g. faster Mars scouts, tougher hulls) so each row of space fights
differently. Higher-tier zones field the bigger classes.

### Pirates

Pirates fly stolen **player** hulls — Skimmers, Wasps, Vanguards and
Reavers, with pirate bounty bosses in Marauders. Unlike regular NPCs they
are aggressive: fly too close and they attack on sight.

### Bosses

Zone bosses are oversized versions of the roster with boss auras, phase
behavior (multi-phase bullet patterns: aimed fans, rotating orb rings,
homing seekers), and the cinematic top-center boss HP bar. Bounty bosses
spawn from the bounty board's elite contracts.

## Enemy AI (DarkOrbit-inspired)

- **No auto-aggro** — regular NPCs only retaliate when attacked; pirates
  are the exception (proximity aggro).
- **Flank & hold** — attackers fly fast to a point beside/behind you and
  hold ~220–340 units off (ranged classes further), never ramming into
  your ship; a keep-out radius pushes them back if you close in.
- **Chase** — if you run, they pursue at up to 1.45–1.9× speed and keep
  shooting while chasing (effective fire range extends while closing).
- **Unpredictable volleys** — fire cadence jitters (18% quick follow-up
  shots), projectile speed and angle carry per-shot randomization, and each
  class has a distinct bullet pattern (fans, spirals, orb rings, seekers —
  see `COMBAT_GUIDE.md`).

## Spawning

Population is server-side and MMO-dense: ~200+ NPCs per map scattered
map-wide as singles (pirates keep their packs), with deficit-based
rebatching (70% random / 30% near players) so space never feels empty.
Empty zones don't tick — populations resume when a player warps in.
