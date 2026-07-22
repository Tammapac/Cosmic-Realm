# Asset Structure — Cosmic Realm

*Last updated: 2026-07-06 (post-Phase 2.5 GLB audit) — hardpoint audit still current as of 2026-07-22. GLB **materials** are now retextured at load by `space-material.ts`; see `RENDERING_PIPELINE.md`.*

## 3D Ship Models

**Location:** `frontend/public/models/`

All ships use GLB format loaded via Three.js `GLTFLoader`. No Draco / Meshopt / quantization — plain GLTF 2.0 binary.

| File | Ship class key | Muzzles | Weapons | Thrusters | Size |
|---|---|---:|---:|---:|---:|
| `Apex_Destroyer.glb` | `apex` | **9** | **9** | 2 | 12.5 MB |
| `Colossus_MK_X.glb` | `colossus` | 6 | 6 | 5 | 14.6 MB |
| `Eclipse_Destroyer.glb` | `eclipse` | 2 | 2 | 3 | 9.8 MB |
| `Harbinger_Class.glb` | `harbinger` | 2 | 2 | 2 | 13.0 MB |
| `Leviathan_Dreadnought.glb` | `leviathan` | 4 | 4 | 4 | 11.2 MB |
| `Marauder.glb` | `marauder` | 4 | 4 | 5 | 12.7 MB |
| `Obsidian_Reaver.glb` | `obsidian` | 2 | 2 | 4 | 11.9 MB |
| `Phallanx_Cruiser.glb` | `phalanx` | 2 | 2 | 4 | 10.0 MB |
| `reaver_mk2.glb` | `reaver` | 2 | 2 | 2 | 18.5 MB |
| `Skimmer_MK_1.glb` | `skimmer` | 2 | 2 | 4 | 10.7 MB |
| `Sovereign_Flagship.glb` | `sovereign` | **8** | **8** | 6 | 14.3 MB |
| `Specter_Phasefreame.glb` | `specter` | 2 | 2 | 2 | 12.0 MB |
| `Station.glb` | (space station) | — | — | — | 12.0 MB |
| `Titan_Bulwark.glb` | `titan` | 4 | 4 | **3** | 11.2 MB |
| `Vanguard.glb` | `vanguard` | 2 | 2 | 4 | 12.1 MB |
| `Wasp_Interceptor.glb` | `wasp` | 2 | 2 | 4 | 11.3 MB |

**Fleet totals:** 47 muzzles, 47 weapons, 54 thrusters across 15 combat ships.

Mapping defined in `SHIP_3D_MODELS` in `frontend/src/game/three-ship-layer.ts` (line ~16).

Titan has one Blender-duplicated node (`hp_thruster_02.001`) — the classifier's `.replace(/\.\d+$/, "")` normalization handles this transparently.

---

## GLB Hardpoint Naming Convention

Every hardpoint node in every current GLB uses the **original convention** with a two-digit padded suffix:

| Prefix | Category | Purpose | Example names |
|---|---|---|---|
| `hp_muzzle_NN` | `muzzles[]` | Laser projectile spawn points | `hp_muzzle_01`, `hp_muzzle_09` |
| `hp_thruster_NN` | `thrusters[]` | Engine glow positions, thruster trail origins | `hp_thruster_01`, `hp_thruster_02.001` |
| `hp_weapon_NN` | `weapons[]` | Rocket / heavy weapon spawn points | `hp_weapon_01`, `hp_weapon_08` |

The classifier `classifyHardpointName(raw)` in `three-ship-layer.ts` also accepts (for future flexibility):
- Reversed convention: `muzzle_hp`, `weapon_hp`, `thruster_hp`
- No trailing token: `hp_muzzle`, `muzzle_hp`
- Dot-separated: `hp.muzzle.left`, `muzzle.hp.left`
- Blender duplicates: `foo.001`, `foo.002` (stripped before classification)
- Alt keyword: `engine` matches as thruster

Rule: name must contain `hp` as a standalone token (`(^|_)hp(_|$)` after normalization). Bare mesh names like `Weapon` won't be misclassified.

**Collection logic:** `collectHardpoints()` in `three-ship-layer.ts` (line ~170).
**Canonical ordering:** alphabetic by `hp.name`, so `hardpointIndex` maps stably across all clients.
**Access at runtime:** `getShipMuzzleWorldPositionsAt(entityId, ...)` returns `{ muzzles, weapons, thrusters }` in world coordinates. See `RENDERING_PIPELINE.md` for the math.

Hardpoints are re-collected from the **cloned** model on first ship spawn — the template's hardpoint refs aren't reused, but the canonical `localHardpoints` snapshot from the template is.

---

## Model-Local Coordinates

At GLB template load, each hardpoint's `(x, y, z)` in model-local space is snapshotted via `hp.getWorldPosition()` on the untransformed template. Stored as `{ x, y, z }` in `model.userData.localHardpoints.<muzzles|weapons|thrusters>`. Node names stored in parallel `.<muzzle|weapon|thruster>Names[]` arrays.

**Model orientation** (verified from Apex hardpoint dump, Phase 2.5):
- Model `-X` = ship nose (forward)
- Model `+X` = ship stern (thrusters live here, e.g. Apex `hp_thruster_01` at `x=+0.921`)
- Model `+Z / -Z` = starboard/port sides
- Model `+Y / -Y` = up/down (small, but non-zero — this is why the Phase 2.6 tilt correction was needed)

Example — Apex `hp_muzzle_01` at model-local `(0.362, -0.110, -0.635)`:
- Slightly aft of ship mid-plane (+X)
- Slightly below deck (`-Y`)
- Port-side gun (`-Z`)

Its mirror `hp_muzzle_02` at `(0.362, -0.110, +0.635)` is the same gun on starboard.

Ship visual "east-facing" (game `angle = 0`) is achieved by `ship.model.rotation.y = -angle + π = π`, which rotates model `-X` (nose) to wrapper `+X` (screen right). Consistent with what `updateShip3D` does; the analytic hardpoint transform mirrors it.

---

## Station Model

**File:** `frontend/public/models/Station.glb` (12 MB)

Single shared station model. Rendered by `three-station-layer.ts` to an offscreen canvas. Materials are forced fully opaque on load (the GLB may have transparent materials). No hardpoints are used on the station.

---

## Public Asset Folders

**Location:** `frontend/public/assets/`

Most subfolders contain `.gitkeep` placeholders — assets are served from the VPS but not committed to the repo. The exceptions (`assets/ui/buttons/button-ui.png`, `assets/ui/hud/*`, `assets/ui/panels/toolbar-small.png`) are tracked.

```
assets/
├── effects/
│   ├── explosions/     — explosion sprite sheets
│   ├── hits/           — hit effect sprites
│   ├── portals/        — portal animation
│   ├── projectiles/    — projectile sprites
│   └── thrusters/      — thruster effect sprites
├── ships/
│   ├── enemies/        — enemy ship sprites (2D fallback)
│   └── player/         — player ship sprites (2D fallback)
├── ui/
│   ├── bars/           — HP/shield bar textures
│   ├── buttons/        — button-ui.png (tracked)
│   ├── frames/         — UI frame borders
│   ├── hud/            — HUD element images (tracked)
│   ├── icons/          — faction icons, ammo icons, module icons
│   ├── panels/         — toolbar-small.png (tracked)
│   ├── slots/          — equipment slot UI
│   └── tooltips/       — tooltip UI
└── world/
    ├── asteroids/      — asteroid sprites
    ├── backgrounds/    — zone background images
    ├── parallax/       — parallax layer images
    ├── planets/        — planet sprites
    └── stations/       — 2D station sprites (legacy)
```

Other public dirs:
- `frontend/public/audio/` — sound effects (sfx.ts loads these). 16 files.
- `frontend/public/sprites/portal_spritesheet.png` — portal animation (20 MB, committed).
- `frontend/public/stations/station_000.png` .. `station_127.png` — station rotation atlas (128 files, 1 MB each).

---

## Sound

**File:** `frontend/src/game/sound.ts`
`sfx` object with methods: `laserShoot()`, `rocketShoot()`, `explosion()`, `hit()`, `mine()`, `miningLaserStop()`, etc.
Audio files in `frontend/public/audio/`.

---

## Sprite Sheets

- `frontend/public/sprites/portal_spritesheet.png` — 512×512 frames, animated portal sprite sheet used for zone portals

---

## GitHub Backup Snapshot

As of commit `c547ea8`, `frontend/dist/` is force-added to the repo despite being in `.gitignore`:
- 714 files, ~370 MB total
- Contains the deployed Vite bundle (`assets/index-Bi3RwiMY.js`) plus every static asset Vite copies from `public/`
- Byte-identical to what nginx serves at cosmicrealm.net
- Rollback strategy: `git checkout c547ea8 -- frontend/dist/` then `scp` back to VPS

Future builds are NOT auto-tracked (gitignore still active). To refresh the snapshot: `git add -f frontend/dist/`.

---

## Notes for Adding New Ships

1. Add GLB to `frontend/public/models/YourShip.glb`
2. Add entry to `SHIP_3D_MODELS` in `three-ship-layer.ts`
3. Add ship class definition to `SHIP_CLASSES` in `frontend/src/game/types.ts` AND `backend/src/game/data.ts`
4. Name hardpoints in the GLB following the `hp_muzzle_NN`, `hp_thruster_NN`, `hp_weapon_NN` convention (two-digit padded)
5. Add ship class key to `ShipClassId` union type
6. Add `sizeScale` entry to `SHIP_SIZE_SCALE` in `types.ts`
7. **Verify at load:** open browser console, look for `[Three.js] <shipClass> - Hardpoints found:` and confirm counts are non-zero for muzzles/weapons/thrusters. Absence triggers the `NO muzzle/weapon hardpoints found! Projectiles will use center-of-ship fallback` warning.
8. **Enable `window.__DEBUG_MUZZLE_MARKERS = true`** and fly the ship briefly — cyan rings should sit on visible weapons/nozzles at every rotation angle.
