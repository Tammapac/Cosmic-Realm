# HUD / UI System — Cosmic Realm

> The main HUD is the **single source of truth** for the whole UI. Every popup, window,
> dialog and card must speak its visual language. **No new colors, frames, corner shapes,
> materials, or orange accents.** Reuse the tokens and components below; do not invent a
> parallel design system.
>
> *Last updated: 2026-07-22*

---

## 1. Where the design lives

| File | Role |
|---|---|
| `frontend/src/styles/hud/hud-tokens.css` | **Design tokens** — the palette, spacing, geometry, type. `--hud-*` are canonical; `--ui-*` are semantic aliases onto them. |
| `frontend/src/styles/hud/hud-skin.css` | **The skin** — reproduces the Hotbar/Minimap console material for `.panel` / `.hud-plate` and themes every legacy class (`.gbtn`, `.j-row`, `.gtip`, `.sw-*`, `.dob-hdr`, …). **Loaded AFTER `index.css`** so identical selectors win by order. |
| `frontend/src/styles/hud/hud-theme.css`, `hud-materials.css`, `hud-animations.css` | Base theme, material helpers, animations for the newer HUD components. |
| `frontend/src/index.css` | Legacy/global CSS (old DarkOrbit amber skin). Many amber/orange literals here are **dead** — overridden by `hud-skin.css`. Do not "fix" them in place; override in `hud-skin.css`. |
| `frontend/src/components/hud-ui.tsx` | **Shared React components** — `HudWindow`, `HudDialog`, `HudButton`, `HudDivider`. Wrap the skin classes so no popup is hand-rolled. |

Load order (from `main.tsx`): `index.css` → `hud-skin.css`. The skin always wins.

---

## 2. Tokens

Defined in `hud-tokens.css`. **Never hardcode a single color in a component** — reference a token.

### Palette (canonical `--hud-*`)
| Token | Value | Use |
|---|---|---|
| `--hud-cyan` | `#4ee2ff` | primary accent / energy / interactive |
| `--hud-gold` | `#e8b94d` | currency / rewards / confirm / featured |
| `--hud-hp` | `#ff4d5e` | danger / HP |
| `--hud-green` | `#5cff8a` | success / completed |
| `--hud-energy` | `#ffcc4d` | caution/warning (NOT orange) |
| `--hud-text-bright` | `#eaf4ff` | primary text |
| `--hud-text-dim` | `#7a92b8` | secondary / labels / off-states |
| `--hud-text-mute` | `#4a5d80` | disabled / locked |
| `--hud-bg-panel` | `rgba(8,14,26,0.82)` | panel fill |
| `--hud-bg-panel-solid` | `#0a1120` | opaque floor |
| `--hud-border` / `-dim` / `-bright` | navy border tints | frames / dividers |

### Semantic aliases (`--ui-*`) — pure aliases, no new values
`--ui-bg-primary` `--ui-bg-solid` `--ui-bg-raised` · `--ui-border` `--ui-border-bright`
`--ui-border-dim` · `--ui-cyan` `--ui-gold` `--ui-danger` `--ui-success` `--ui-warning`
· `--ui-text-primary` `--ui-text-secondary` `--ui-text-muted` · `--ui-radius`(=0)
`--ui-cut` `--ui-cut-sm`. Prefer `--ui-*` in new popup code for intent; both resolve to
the same colors.

### Geometry / type
- Corners: **radius 0 everywhere** (`--hud-radius: 0`). Depth comes from clip-path bevels,
  never rounded corners.
- Font: `var(--font-display)` (Kenney Future Narrow) for all window chrome; tracked
  uppercase labels; `tabular-nums` for numbers.

---

## 3. The console material (`.panel` / `.hud-plate`)

`.panel` and `.hud-plate` share one definition in `hud-skin.css` — the exact
Hotbar/Minimap console:

- **Fill:** opaque 4-layer stack (sheen fade + brushed grain + `#283a58→#060a14` metal
  gradient + `#070c16` floor). Fully opaque — nothing behind the window shows through.
  No `backdrop-filter`.
- **Silhouette:** 8-point chamfered `clip-path` (`--panel-cut: 16px`; `22px` on
  `.panel-framed`).
- **`::before`:** crisp cyan edge ring + faint PCB energy-vein traces, masked to fade
  from the top.
- **`::after`:** inner accent — **corner brackets only** (four L-shaped marks), NOT a
  full inner rectangle. (History: the old full inner ring floated two thin horizontal
  lines across popup bodies where text didn't fill it — the "billige Ränder die durch
  die Schrift ragen". Fixed 2026-07-22.)
- **Shadow:** inner machined bevel + outer depth drop + soft cyan glow rim.

### Variants
| Class | Use |
|---|---|
| `.panel` | standard top-level window |
| `.panel-framed` | bigger modals (larger corner cut, heavier glow) |
| `.panel-gold` | featured/currency windows — recolors accent + PCB veins to gold |
| **`.panel-inset`** | **nested cards / chips / tooltips / rows INSIDE a window** — same material, ONE crisp cyan hairline, small 6px cut, NO second ring, NO PCB veins. Reads as machined into the window, not a floating mini-window. |
| `.panel-inset--gold` | gold-accented inset (featured cards, currency rows) |

**Rule of thumb:** top-level window → `.panel`. Anything nested inside it → `.panel-inset`.
Never put the full `.panel` frame on a small card.

`.panel-inset` supports a `--edge` custom property for a data-colored left accent bar
(e.g. quest tier color) without a real border fighting the frame:
```jsx
<div className="panel-inset p-3" style={{ ["--edge" as any]: tierColor }}>
```

---

## 4. Building blocks

### Title band
`.hud-titleband` — cyan tick + tracked uppercase title on a recessed dark wash, 1px dim
divider below. Sits flush on the top edge as a machined header strip.

### Buttons — `.gbtn` family ONLY
| Class | Variant |
|---|---|
| `.gbtn` | secondary (default) |
| `.gbtn.gbtn-gold` | primary / confirm |
| `.gbtn.gbtn-red` | danger / close |

Never style a button with raw inline `background`/`border` — that breaks the theme. Use
the class (or `HudButton` variant).

### Journal / mission list rows — `.j-row`
Full HUD re-theme in `hud-skin.css` (the old light-skin `color:#2a2214` in `index.css`
was the black-on-dark bug):
| Class | State |
|---|---|
| `.j-row` | normal — light text on navy fill |
| `.j-row:hover` | cyan brighten |
| `.j-row--sel` | selected — cyan ring + glow |
| `.j-row--done` | completed — green, not glaring |
| `.j-row--locked` | dimmed but readable |

### Tooltip — `.gtip`
Cyan-themed in `hud-skin.css` (`::first-line` = item-name header, also cyan). No orange.

### Divider — `.sci-divider` / `<HudDivider />`

---

## 5. React components (`components/hud-ui.tsx`)

```jsx
<HudWindow title="…" onClose={fn} footer={…} width={280} gold={false}>…</HudWindow>
<HudDialog title="…" onClose={fn} footer={…} width={420} gold={false}>…</HudDialog>
<HudButton variant="primary|secondary|danger">…</HudButton>
<HudDivider />
```

`HudWindow` = `.panel`(+`panel-gold`) + `.hud-titleband` + red close `.gbtn`.
`HudDialog` = dimmed backdrop + centered `HudWindow`, backdrop-click closes.
Prefer these over hand-rolling any popup.

---

## 6. Verify visually

Open **`/?ui-preview`** (local or live) — renders every primitive on the real skin:
token swatches, `.panel` vs `.panel-inset` at scale, windows (standard + gold), all
button variants, `.j-row` in every state, reward card, `.gtip`, and a modal. Use it to
confirm a change still matches the main HUD before deploying.

Also: **`/?hud-editor`** (live HUD editor) and **`/?hud-showcase`** (isolated HUD
components with sliders).

---

## 7. Prohibitions (from the user's spec)

- ❌ No new design language, colors, frame types, corner shapes, or materials.
- ❌ No orange accents (only `--hud-energy` as a *defined* warning color, sparingly).
- ❌ No random gradients, no generic grey browser panels.
- ❌ No raw hardcoded single colors in popup components — use tokens.
- ❌ No inline `background`/`border` on buttons — use `.gbtn` / `HudButton`.
- ❌ No CSS filters as a substitute for proper component styling.
- ❌ No new UI library; consolidate duplicates onto the shared components.

---

## 8. Status & remaining work

**Done (2026-07-22):**
- `--ui-*` alias tokens added.
- Mission Journal repaired: black-on-dark fixed, all `.j-row` states themed, title/
  description/category fallbacks ("Unbenannte Mission" / neutral / "Allgemein"),
  progress-division guards, selection reconciliation (auto-pick first valid mission on
  complete/delete/invalid/reload).
- Orange sweep: `.gtip` header, `.q-ticks`, BossBar name, all Hangar `#ff8a4e`
  ammo/rocket accents → gold; Hangar off-theme blue/grey buttons → `.gbtn`; grey panels/
  borders/off-text → tokens; AdminPanel reset button → tokens.
- `.panel-inset` introduced; inner ring → corner brackets; all small Hangar cards
  migrated off the heavy frame.
- `/?ui-preview` harness created.

**Remaining (next agent):**
1. **Consolidate hand-rolled popups** onto `HudWindow`/`HudDialog`/`.panel-inset`:
   App `RiftConfirmDialog` + notifications, `InventoryPanel` (uses `.hud-plate` shell but
   check inner cells), `ZoneMapOverlay` custom header, `TopBar` logout, `EventBanners`,
   and the shadcn `components/ui/*` (generic grey — restyle or replace).
2. **Migrate remaining small nested `.panel` usages** in other components to
   `.panel-inset` (audit: `grep -rn 'className="[^"]*panel p-' frontend/src`).
3. **Dead-code cleanup** (optional): the overridden amber/orange literals in `index.css`
   (`.dob-hdr`, `.sw-card`, `.j-row`, `.gtip`, scrollbar) can be removed since
   `hud-skin.css` fully overrides them — low value, low risk, do only if asked.
4. Extend the component kit if needed (`UiTab`, `UiBadge`, `UiEmptyState`, `UiRewardCard`)
   — but only as thin wrappers over existing skin classes.
