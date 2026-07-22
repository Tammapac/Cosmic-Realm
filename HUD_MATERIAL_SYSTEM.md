# HUD Material System — AAA Sci-Fi Pass

> Goal: make the HUD look like it is milled from **titanium + tech glass** and bolted into
> a spaceship cockpit — like Star Citizen / Elite Dangerous / Homeworld 3. **The layout,
> shapes and colours do NOT change.** This is a material/depth/light pass only.
>
> References: Star Citizen · Elite Dangerous · EVE Online · Homeworld 3 · Destiny 2 menus ·
> Mass Effect LE · Dead Space Remake. **NOT** mobile/browser/cartoon/neon-cyberpunk/
> glassmorphism/Windows UI.
>
> *Phase 1 completed 2026-07-22.*

---

## Phase 1 — Analysis result

Two full material audits (window/popup/button primitives + active showcase components)
established the current state. Key finding:

**There is a de-facto "canon" — `glowRim` and `crispEdge` are byte-identical across every
component — but 7 material layers drift per component.** Plus, three separate material
*classes* coexist instead of one:

- **A — real metal** (bright `#5a749e→#12192c` gradient, top-specular, multi-layer): only
  on `.gbtn::before` and the AbilitySlot `.border/.bracket/.inner` stack.
- **B — frosted glass** (transparent navy, blur, PCB veins, gradient rim): the `.panel`
  family.
- **C — flat fills** (1px border or single-layer, no rim, no bevel pair): `.sw-tooltip`/
  `.gtip`, `.sw-slot`, `.slotDropdown`, and legacy `.btn`/`.card`/`.cell`.

Windows (B) never carry the bright metal face (A); tooltips/slots/dropdown (C) carry
neither the chamfer rim (B) nor the metal layers (A).

### Inconsistencies (prioritised)

**P0 — structural / missing core layers**
1. `innerFrame` (double contour) only on Minimap + Chat; missing on Hotbar/MenuPanel/TopPanel.
2. `innerBevel` completely missing on the TopPanel `mainStrip` (the biggest panel → flattest).
3. Noise grain missing on TopPanel.
4. Outer seating glow (`0 0 22px`) missing on TopPanel.
5. `.sw-tooltip`/`.gtip` uses a real 1px border instead of the clip-path chamfer → reads 2D.
6. `.sw-slot` bevel is inverted (highlight sits at the bottom) + has no contact shadow.
7. `.gbtn-gold` has no own `::before` → wears the blue-grey metal frame under gold.
8. `--panel-glow` declared but never used; `.panel-framed` promises heavier glow, sets none.

**P1 — value drift on nominally-identical material**
9. console box-shadow depth: Minimap/Hotbar/Chat `-14px 22px`, TopPanel/Menu `-10px 16px`.
10. Sheen/fill overlay: Hotbar radial, everyone else linear.
11. Fill-overlay alpha: Minimap `0.16`, others `0.14`.
12. Veins opacity 0.5–0.8 with no system; mirroring inconsistent (L/R vs top/bottom vs none).
13. Two noise scales (`0.045/0.85/140px` console vs `0.06/0.9/80px` slots).

**P2 — missing AAA depth (everywhere)**
14. No directional bevel light — everything is symmetric top-light/bottom-dark, no left-lit/
    right-shaded.
15. Edge/corner specular highlights almost absent (only ResourceBar `.fill::after` + Minimap
    `scanRimLight` have real hot highlights).
16. AO/contact shadows uneven — real ones only in AbilitySlot `.inner` and `.fill`.
17. Micro-detail density wildly uneven (TopPanel portrait over-detailed; mainStrip + MenuPanel
    have no screws/engravings/seams/corner-marks).

---

## The canonical material system (`hud-tokens.css`)

One shared set of custom properties, so all shells reference the same values instead of
each keeping a drifting copy. **No new colours** — every value is an existing one promoted
to a token.

| Token | Purpose |
|---|---|
| `--mat-fill` | base titanium/gunmetal body `#283a58→#060a14` |
| `--mat-sheen` | anodised-aluminium light wash off the top |
| `--mat-brushed` | brushed-metal micro-grain |
| `--mat-bevel` | **directional** bevel: top+left lifted, right+bottom shaded |
| `--mat-ao` | contact shadow where a surface meets its frame |
| `--mat-specular` | concentrated hot highlight for milled edges / screws (`rgba(216,240,255,.85)`) |
| `--mat-rim` | few-px cold-cyan rim light (material light, not neon) |
| `--mat-drop` | outer seating shadow |
| `--mat-glow-soft` | restrained energy glow (metal does not glow) |
| `--mat-noise-opacity` | single canonical grain scale `0.045` |

### Rules (from the brief)
- **No new colours / shapes / design language.**
- **Metal does not glow.** Glow only from energy / active buttons / hover / shields /
  scanners / holograms. Reduce glow drastically elsewhere.
- **Tech glass, not glassmorphism**: our windows stay transparent+blur (user decision), and
  the material/bevel/fresnel-edge is layered *on top* without removing the see-through.
- Material variation must stay subtle: some areas rougher, some satin, some lightly polished
  — never identical, never loud.
- Performance: reuse materials, share instances, no fullscreen shaders, no heavy blur stacks,
  GPU-friendly animation only.

---

## Phase roadmap (status)

| Phase | What | Status |
|---|---|---|
| 1 | Analyse materials, build shared system | ✅ done (this doc + tokens) |
| 2 | Titanium/carbon metal surfaces | ✅ carbon `.panel-inset` vs titanium `.panel` |
| 3 | Tech glass (tinted, faint fresnel) | ✅ fresnel glass edge on `.panel`, sensor-glass reflection |
| 4 | Specular highlights (edges/screws only) | ✅ button metal top glint, collar sheen arc |
| 5 | Directional bevel lighting | ✅ top+left lit / right+bottom shaded on panels, buttons, TopPanel |
| 6 | Ambient occlusion / contact shadows | ✅ slot/inset contact AO, recess shadows |
| 7 | Multiple material layers per element | ✅ (kept the layered shells; slots 3-layer) |
| 8 | Rim lighting (fine cold cyan) | ✅ 2px cold rim on `.panel` |
| 9 | Micro-details (screws, engravings, vents) | ✅ corner screws on Hotbar/Chat + Minimap collar bolts |
| 10 | Slow light travel (15–30 s, few %) | ✅ ~24s screen-blend sweep on every console (staggered) |
| 11 | Reduce glow (energy-only) | ✅ glowRim 0.8→0.34, outer glow 0.18→0.08 |
| 12 | Per-material light response | ✅ titanium vs carbon-insert vs glass |
| 13 | Buttons = mechanical keys | ✅ press sinks the face (AbilitySlot + .gbtn) |
| 14 | Windows = thicker material depth | ✅ TopPanel bevel/AO added (was flattest) |
| 15 | Minimap = military radar | ✅ metal collar + bolts + sensor-glass reflection + fresnel |
| 16 | Performance pass | ✅ transform/opacity-only anims, no fullscreen shaders, shared values |

## Implementation summary (2026-07-22)

**Materials added:** shared `--mat-*` token set (fill, sheen, brushed, directional bevel,
contact AO, specular, rim, drop, glow) in `hud-tokens.css`; carbon-insert treatment for
`.panel-inset`; sensor-glass reflection + fresnel on the Minimap dome.

**Shaders/CSS changed:** `.panel` box-shadow → directional bevel + fresnel edge + reduced
rim; `.gbtn` face bevel + gold-frame fix + mechanical press; `.sw-slot` un-inverted bevel +
contact AO; `.gtip` chamfer instead of 1px border; TopPanel `mainBody` bevel/AO; every
console `glowRim` opacity 0.8→0.34 and outer glow 0.18→0.08.

**New effects:** slow light-travel sweep (~24s, screen blend, few %, staggered per console);
corner micro-screws (Hotbar/Chat); Minimap collar bolts + specular arc.

**Performance:** animations use only `transform`+`opacity` (GPU compositor), `will-change`
set, `prefers-reduced-motion` honored, no fullscreen filters, no new blur stacks; all
material values shared via tokens. Negligible impact.

**Before/after:** captured via headless screenshots of `?hud-showcase` (glow visibly
reduced, material depth, radar-style minimap).

Rollback point (pre-pass): commit `7045abb`.
