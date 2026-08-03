// Pixi-native port of the HUD design tokens (styles/hud/hud-tokens.css +
// hud-skin.css). The native PixiJS HUD must read as the SAME console as the
// React/CSS HUD, so every colour, chamfer and depth value lives here once and
// is derived from the existing CSS variables — not re-invented.
//
// Colours are 0xRRGGBB ints (Pixi's format). The CSS hex equivalents are noted
// so the two systems can be kept in sync by eye.

/** Core palette — the navy-titanium + cyan-energy + gold-elite language.
 *  Typed as plain numbers (not `as const` literals) so colours pass freely to
 *  component `accent: number` params without narrow-literal type clashes. */
export const COLOR: Record<string, number> = {
  // energy / interactive
  cyan: 0x4ee2ff,          // --hud-cyan
  cyanBright: 0x8af1ff,    // hover/active core
  cyanDeep: 0x1f6f92,      // conduit shadow end
  // elite / currency
  gold: 0xe8b94d,          // --hud-gold
  goldBright: 0xfff4d6,
  // danger / warning
  red: 0xff4d5e,           // --hud-red (danger)
  amber: 0xffb03a,         // warning pulse
  // titanium plate ramp (bright top → deep base), from .panel-rim
  steel0: 0xf2f8ff,
  steel1: 0xc3d5ea,
  steel2: 0x8098b5,
  steel3: 0x44607f,
  // navy glass body
  navyHi: 0x1d2b44,        // plate top
  navyMid: 0x22344f,
  navy: 0x0d1626,          // plate mid
  navyDeep: 0x060a14,      // --hud-bg-void, plate base
  // text
  textBright: 0xdcecff,
  textDim: 0x8aa0c0,
  textMute: 0x5a6a82,
};

/** Rarity accents — the game's own 7 tiers (lib/loot/loot.ts), reused so a
 *  native slot bands identically to the CSS one. */
export const RARITY = {
  common: 0x8aa0c0,
  uncommon: 0x5cff8a,
  rare: 0x4ee2ff,
  epic: 0xff5cf0,
  legendary: 0xffd24a,
  relic: 0xff6a3c,
  celestial: 0x9df2ff,
} as const;
export type RarityKey = keyof typeof RARITY;

/** Geometry constants, in DESIGN-space px (1366×768 reference, hudLayout.ts).
 *  Sections multiply by the frame transform's `scale`, so authoring stays in
 *  these fixed units. */
export const GEO = {
  /** 8-point window chamfer (matches --panel-cut / the CSS clip-path). */
  windowCut: 14,
  /** button/slot corner shear (matches the 4px CSS cut, in design px). */
  slotCut: 4,
  /** titanium rim thickness. */
  rim: 3,
  /** inner glass inset from the rim. */
  inset: 6,
  /** corner-bracket arm length. */
  bracket: 16,
} as const;

/** Glass fill opacities — the frosted-panel look, ported from --glass-fill-*. */
export const ALPHA = {
  glassBody: 0.30,
  glassInset: 0.22,
  rim: 0.9,
  conduit: 0.92,
  vein: 0.5,
  scrim: 0.72,           // modal backdrop
} as const;

/** Motion timings in ms — matched to hud-motion.css so native and CSS windows
 *  open at the same cadence. */
export const MOTION = {
  panelIn: 420,
  panelOut: 240,
  beam: 620,
  hover: 140,
  press: 110,
  sheen: 2600,
  barPulse: 2200,
} as const;

/** The typeface the HUD uses everywhere (Kenney Future Narrow → var(--font-display)).
 *  Loaded as a web font already; Pixi Text can name it directly. */
export const FONT = {
  display: "Kenney Future Narrow, Kenney Future, monospace",
  mono: "Kenney Future, monospace",
} as const;

/** Convenience: linear-interpolate two 0xRRGGBB ints (for ramps / state blends). */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
