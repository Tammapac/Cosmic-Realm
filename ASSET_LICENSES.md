# Third-Party Asset Licenses

This file documents the license and origin of every imported third-party asset.
Add an entry here whenever external art, audio, or fonts are brought into the repo.

## Background maps `frontend/public/bg/1-2/` through `bg/4-5/` (5-layer parallax sets, 19 maps)

- `Layer1/Layer2/Layer3/Layer5_*.png` (star fields, nebulae, dust/haze) are **original
  procedural art** generated for this project (seeded noise; generator script kept in
  project history). No third-party rights involved.
- `Layer2_*.png` on some maps includes tinted cloud textures from a CC0 pack by
  **Luis Zuno (ansimuz)** (https://ansimuz.com).
- `ast1..3_*.png` (rotating foreground asteroids) are procedural original art;
  `ast4_*.png` is an ansimuz CC0 asteroid sprite.
- `Layer4_*.png` planets are from Wisedawn's CC0 "20 Planet Sprites" (see below);
  the tiny moons in `Layer1_*.png` are from Master484's CC0 "Pixel Planets".

### Source pack 1: "Space Background"
- **Author:** Luis Zuno (ansimuz)
- **Source URL:** https://opengameart.org/content/space-background-3
- **License:** CC0 1.0 Universal (Public Domain) — https://creativecommons.org/publicdomain/zero/1.0/
- **Commercial use:** allowed. **Attribution:** not required (given here as courtesy).
- Currently not used in shipped maps (was the planet source in an earlier iteration);
  entry kept because the pack remains in project tooling for future use.

### Source: "20 CC0 Planet Sprites"
- **Author:** Wisedawn
- **Source URL:** https://opengameart.org/content/20-cc0-planet-sprites
- **License:** CC0 (Public Domain)
- **Commercial use:** allowed. **Attribution:** not required (given here as courtesy).
- Used in: `Layer4_*.png` — one unique planet per map (1024px originals pixelated to
  ~100–155 art px, palette-quantized and darkened to match the game's pixel style)

### Source: "Pixel Planets" sheet
- **Author:** Master484 — http://m484games.ucoz.com/
- **Source URL:** https://opengameart.org/content/pixel-planets
- **License:** CC0 1.0 Universal (Public Domain)
- **Commercial use:** allowed. **Attribution:** not required (given here as courtesy).
- Used in: `Layer1_*.png` — tiny distant moons composited into the star layers

### Source pack: "Space Ship Shooter Pixel Art Assets"
- **Author:** Luis Zuno (ansimuz)
- **Source URL:** https://opengameart.org/content/space-ship-shooter-pixel-art-assets
- **License:** CC0 1.0 Universal (Public Domain)
- **Commercial use:** allowed. **Attribution:** not required (given here as courtesy).
- Used in: `Layer2_*.png` on several maps — semi-transparent clouds, tinted to faction
  colors and composited into the nebula layer

### Source pack 2: "Warped Space Shooter"
- **Author:** Luis Zuno (ansimuz)
- **Source URL:** https://opengameart.org/content/warped-space-shooter
- **License:** CC0 1.0 Universal (Public Domain) — https://creativecommons.org/publicdomain/zero/1.0/
- **Commercial use:** allowed. **Attribution:** not required (given here as courtesy).
- Used in: `Layer6_*.png` (asteroid sprites recomposited into sparse seamless debris tiles) — all maps

The original `license.txt` shipped inside the "Space Background" pack states:
> Artwork created by Luis Zuno (@ansimuz)
> License (CC0) You can copy, modify, distribute and perform the work, even for
> commercial purposes, all without asking permission.

## Approved but not yet imported

Kept on file from the asset research (2026-07-07); usable for future maps:
- **Pixel Space Background Generator** — Deep-Fold, MIT,
  https://deep-fold.itch.io/space-background-generator (source: https://github.com/Deep-Fold/PixelSpace).
  Desktop/browser tool; generated output can seed future zone maps.
- **Void – Environment Pack** — Foozle, CC0, https://foozlecc.itch.io/void-environment-pack.
  Requires manual download from itch.io (blocks automated fetching).

## Not covered by this file

- `frontend/public/bg/1-1/` (existing map art) and other pre-existing art/assets
  predate this file and are not documented here.
