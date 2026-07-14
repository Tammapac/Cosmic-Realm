# Cosmic Realm — Game Overview

Cosmic Realm is a browser-based 2.5D space MMO in the spirit of classic
browser space shooters (DarkOrbit-style movement and combat), rendered as
pixel-art over layered parallax space, with server-authoritative combat,
persistent progression, a data-driven ARPG loot system and a living,
hand-composed galaxy of 20 maps.

Play happens directly in the browser — no install. One account = one pilot.

## The Core Loop

1. **Fly** — click-to-move across large open maps, warp between sectors
   through jump gates.
2. **Fight** — lock enemy NPCs (or get ambushed by pirates) and battle with
   lasers and rockets fired from your ship's actual gun hardpoints. Combat is
   resolved on the server against pixel-accurate ship silhouettes.
3. **Loot** — enemies drop credits, XP, honor, resources and rolled equipment
   (rarities, affixes, legendaries — see `LOOT_SYSTEM.md`).
4. **Dock** — at any of 71 stations: trade commodities, buy modules and
   drones, take bounties and missions, refine ore at factories, repair.
5. **Grow** — level up, spend skill points in the pilot skill tree, spend
   attribute points in the pilot dossier, climb 13 honor ranks, level three
   passive career paths, buy bigger hulls (15 ship classes), run rift
   dungeons for legendary drops, and climb the galactic leaderboard.

## Setting & Factions

Three powers control the inner sectors; a lawless frontier lies beyond:

| Faction | Space | Character |
|---|---|---|
| **Earth Concord** | sectors 1-1 … 1-5 | the blue home systems — trade lanes, crystal nebulae, iron forges |
| **Mars Coalition** | sectors 2-1 … 2-5 | volcanic frontier — dust expanses, blood nebulae, the Maelstrom |
| **Venus Enclave** | sectors 3-1 … 3-5 | toxic cloud worlds — acid deeps, pressure cores, the Eye |
| **Danger zones** | sectors 4-1 … 4-5 | contested dead space — war rifts, pirate havens, the Abyss Gate |

Players pick a faction (bonuses differ) and can join clans. Every map
belongs to one of these powers and its whole environment art direction —
colors, nebulae, landmarks, decoration stories — reflects it.

## What Makes It Feel Alive

- **Unique biomes** — every map has its own palette and composition:
  multi-patch nebulae, star clusters, milky bands, dust with glow regions,
  drifting pixel-art asteroids, and a per-zone energy effect (light veins,
  auroras, energy streams, plasma clouds, supernova filaments).
- **Painted landmarks** — every map anchors on a large 2D pixel-art
  structure: ancient gates, ring stations, monoliths, crystal formations,
  capital-ship wrecks, mining rigs, biomech masses, citadels, beacons,
  temple ruins.
- **Story decoration** — 50–90 decor props per map arranged into themed
  clusters (mining outposts, ancient battlefields, ruins, crystal fields,
  bio nests, anomalies, comm posts, industrial graveyards, pylon farms),
  with subtle ambient animation: tumbling scrap, blinking nav beacons,
  pulsing crystals, drifting gas.
- **3D ships in a pixel world** — player ships, enemies and stations are
  real GLB models rendered through a pixelation + black-outline + emissive
  bloom pass so they read as crisp pixel art with depth.

## Controls (default)

| Input | Action |
|---|---|
| Left click | move / select target |
| Double click enemy | attack |
| `1` / `2` | toggle laser fire / rocket fire |
| `Tab` | target nearest enemy |
| `i` | inventory |
| `j` | cargo hold |
| `m` | galaxy map |
| `c` | clan panel |
| `h` | social/chat |
| Mouse wheel | camera zoom (0.7–2.5×) |
| `Esc` | close panel / settings |
| Click rank (top-left) | pilot dossier (attributes, career paths, rankings) |

## Documentation Index

| File | Contents |
|---|---|
| `GAME_OVERVIEW.md` | this file |
| `WORLD_ATLAS.md` | all 20 maps, biomes, landmarks, stations, rifts |
| `SHIPS_AND_ENEMIES.md` | 15 player hulls, 15 enemy classes, pirates, bosses, AI |
| `COMBAT_GUIDE.md` | combat model, weapons, ammo, drones, death |
| `PROGRESSION_AND_ECONOMY.md` | levels, honor, skills, attributes, careers, quests, trading |
| `LOOT_SYSTEM.md` | rarities, affixes, legendaries, anti-forge audit |
| `ARCHITECTURE.md` / `RENDERING_PIPELINE.md` / `NETCODE_SYNC_NOTES.md` | technical docs |
| `DEPLOYMENT.md` | build & VPS deployment |
| `ASSET_LICENSES.md` | provenance of every third-party asset |
