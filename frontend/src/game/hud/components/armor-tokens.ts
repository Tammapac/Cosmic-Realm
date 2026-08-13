// armor-tokens.ts — zentrales Design-Token-System für die neue PixiJS-UI.
//
// EINZIGE Quelle der Wahrheit für Farben, Material, Maße, Motion und Effekt-
// Qualität. Reine Daten, KEINE Imports → kann den Build nicht brechen und wird
// später von jeder Pixi-Sektion (loadoutSection etc.) konsumiert. In diesem
// Schritt werden noch KEINE Komponenten umgestellt.
//
// Werte sind aus 1C VOIDFORGE + styles/hud/hud-tokens.css abgeleitet.
// Pixi braucht numerische Farben (0xRRGGBB); für Debug/CSS gibt es css().
//
// FARBVERTEILUNG (Designbudget der Fläche):
//   70 %  dunkles Navy / Gunmetal        → surface.*, metal dark
//   15 %  Metallhelligkeiten             → metal.mid/light, bevel
//   10 %  Cyan + Violett (Energie)       → energy.cyan, faction.violet
//    5 %  Gold / Grün / Orange / Rot     → accent.* (nur Status/Elite/Warnung)

/** Numerische Pixi-Farbe → CSS-Hex (Debug/DOM-Interop). */
export const css = (n: number): string => "#" + n.toString(16).padStart(6, "0");
/** RGBA-CSS-String aus Pixi-Farbe + Alpha. */
export const rgba = (n: number, a: number): string =>
  `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

// ── FARBEN ──────────────────────────────────────────────────────────────────
export const color = {
  // Oberflächenfarben (70 % — Navy/Gunmetal, dunkel → tief)
  surface: {
    base: 0x08060f,   // Panel-Grund, tiefste Ebene
    panel: 0x0d0916,  // Standard-Panelfläche
    raised: 0x141020, // erhabene Platte
    rail: 0x120b1e,   // Seitenrail
    header: 0x17233c, // Kopf-/Streifenverlauf oben
    inset: 0x060a14,  // Vertiefungsboden (dunkler als base)
  },
  // Vertiefungsfarben (Recess/AO — für inset-Schatten)
  recess: {
    soft: 0x0a0712,
    deep: 0x04060d,
    ao: 0x000000,     // reiner AO-Multiply
  },
  // Metalltöne (15 % — Kanten, Bevel, gebürstete Flächen)
  metal: {
    dark: 0x1a2030,   // Rahmen gedämpft
    mid: 0x2a3350,    // Standard-Rahmen
    light: 0x3a4864,  // Bevel-Highlight-Kante
    sheen: 0xbcd6ff,  // spekularer Streiflichtstich (niedrige Deckung)
    brushed: 0x8cb6dc,// Bürsteneinschlag (sehr niedrige Deckung)
  },
  // Energie (Cyan — 10 % zusammen mit Violett)
  energy: {
    cyan: 0x4ee2ff,       // interaktiv/Energie
    cyanSoft: 0x9df2ff,   // helle Kante/Glanz
    cyanDeep: 0x1856a0,   // tiefe Energieader
  },
  // Fraktionsviolett (10 % mit Cyan)
  faction: {
    violet: 0xb866ff,     // Signaturfarbe
    violetDim: 0x9d6fd9,  // gedämpft/Sekundär
    violetDeep: 0x602ca8, // Nebel/Tiefe
  },
  // Akzente (≤ 5 % gesamt — nur Status, Elite, Warnung)
  accent: {
    gold: 0xe8b94d,   // Elite / Währung / Bestätigung
    green: 0x5cff8a,  // ok / equipped / nominal
    orange: 0xf3a94f, // Hinweis
    red: 0xff4d5e,    // Gefahr / destruktiv
    hp: 0xff4d5e,     // Hüllen-/Schadensanzeige
  },
  // Text
  text: {
    bright: 0xfbf6ff,
    normal: 0xe9e2f5,
    dim: 0x9db0c6,
    mute: 0x6a748a,
  },
} as const;

// Slot-/Kategorie-Akzente (bewusst getrennt, damit Rarity-Farben sie nicht überschreiben)
export const slotColor = {
  weapon: 0xff5c6c,
  generator: 0x4ee2ff,
  module: 0xff5cf0,
  drone: 0xb866ff,
} as const;

// Rarity-Skala (aus loot.js RARITY_ORDER — common → celestial)
export const rarityColor = {
  common: 0x9fb0c6,
  uncommon: 0x63d69a,
  rare: 0x4fb8ff,
  epic: 0xb866ff,
  legendary: 0xe8b94d,
  relic: 0xff8a3c,
  celestial: 0x9df2ff,
} as const;

// ── SCHATTENSTÄRKEN (Alpha/Blur der Depth-Schichten) ─────────────────────────
export const shadow = {
  ambient: { color: color.recess.ao, alpha: 0.55, blur: 26 }, // große weiche Grundierung
  drop:    { color: color.recess.ao, alpha: 0.6,  blur: 14, offsetY: 8 }, // Panel-Abwurf
  inset:   { color: color.recess.ao, alpha: 0.5,  blur: 12 }, // Innen-AO
  glowSoft:{ alpha: 0.28, blur: 22 }, // Farb-Aura schwach
} as const;

// ── EXTRUSIONSTIEFEN (px, wie weit ein Element „heraussteht") ────────────────
export const extrude = {
  flat: 0,
  chip: 2,   // Button/Slot-Sockel
  plate: 4,  // Platte
  panel: 8,  // Hauptpanel
  hero: 14,  // Hero-Element
} as const;

// ── BEVELBREITEN (px, Fase der Lichtkante) ───────────────────────────────────
export const bevel = {
  hairline: 1,
  thin: 2,
  standard: 3,
  bold: 4,
} as const;

// ── ECKABSCHNITTE (px, gefaste Ecken / Notch-Länge) ──────────────────────────
export const corner = {
  slot: 8,    // Item-/Sockelzelle
  button: 12, // Buttons
  plate: 16,  // Platten
  window: 26, // Fenster/Modale
  panel: 46,  // Hauptpanel-Silhouette
} as const;

// ── GLOW-INTENSITÄTEN (Alpha der Farb-Aura) ──────────────────────────────────
export const glow = {
  none: 0,
  faint: 0.2,
  soft: 0.35,
  medium: 0.5,
  strong: 0.7,
} as const;

// ── ANIMATIONSZEITEN (ms) ────────────────────────────────────────────────────
export const timing = {
  hover: 140,
  press: 120,
  tabSwitch: 160,
  bootScan: 900,
  stagger: 280,
  staggerStep: 60,
  impactFlash: 260,
  panelExit: 240, // deckt sich mit useHudPanel
  spinSlow: 44000,
  spinFast: 26000,
} as const;

// ── ABSTÄNDE (px, in HUD-Referenz 1366×768) ──────────────────────────────────
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  section: 30,
} as const;

// ── SLOTGRÖSSEN (px) ─────────────────────────────────────────────────────────
export const slotSize = {
  socket: 40,      // Sockel in den Bänken
  armoryCell: 62,  // Armory-Zelle
  armoryHero: 80,  // große Armory-Zelle (1C-Grid)
  railButton: 50,  // Diamant-Rail
  gap: 6,          // Standard-Rasterabstand
  gapWide: 10,     // Armory-Rasterabstand
} as const;

// ── SCHRIFTGRÖSSEN (px) ──────────────────────────────────────────────────────
export const font = {
  micro: 9,
  small: 10,
  label: 11,
  body: 12.5,
  value: 14,
  h3: 16,
  h2: 22,
  h1: 32,
  family: {
    display: "Orbitron, sans-serif",  // Zahlen/Headlines
    body: "Chakra Petch, sans-serif", // Fließtext/Labels
  },
  tracking: { tight: 1, normal: 2, wide: 3, ultra: 4 }, // letterSpacing px
} as const;

// ── QUALITÄTSSTUFEN FÜR EFFEKTE ──────────────────────────────────────────────
// Steuert, wie teuer Shader/Glow/Motion laufen (Low = mobil/schwache GPU).
export type EffectQuality = "low" | "medium" | "high";
export const quality: Record<EffectQuality, {
  shaderBackground: boolean;  // WebGL-FBM-Nebel hinter dem Panel
  glowFilters: boolean;       // echte Blur-Glow-Filter statt Ring-Fallback
  bootScan: boolean;
  stagger: boolean;
  impactFlash: boolean;
  spriteResolution: number;   // Textur-Auflösungs-Faktor
  maxAnimatedSprites: number;
}> = {
  low:    { shaderBackground: false, glowFilters: false, bootScan: false, stagger: false, impactFlash: true,  spriteResolution: 1,   maxAnimatedSprites: 0 },
  medium: { shaderBackground: true,  glowFilters: false, bootScan: true,  stagger: true,  impactFlash: true,  spriteResolution: 1,   maxAnimatedSprites: 24 },
  high:   { shaderBackground: true,  glowFilters: true,  bootScan: true,  stagger: true,  impactFlash: true,  spriteResolution: 1.5, maxAnimatedSprites: 64 },
};

// Sammelexport als ein Theme-Objekt (für kompakte Imports)
export const ArmorTokens = {
  css, rgba, color, slotColor, rarityColor,
  shadow, extrude, bevel, corner, glow,
  timing, space, slotSize, font, quality,
} as const;

export type ArmorTokensType = typeof ArmorTokens;
export default ArmorTokens;
