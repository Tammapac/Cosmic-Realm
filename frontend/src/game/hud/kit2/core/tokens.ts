// Design-Tokens — die Zahlen und Farben aus Cosmic Kit, unverändert.
//
// Eine Farbe pro Bedeutung (CLAUDE.md). Keine freien Farben im Modulcode:
// alles, was gefärbt wird, kommt aus dieser Datei oder ist eine Ableitung
// über shade().

/** Akzent je Bedeutung. */
export const ACCENT = {
  /** Aktion, Standardpanels, Skills, Clan. */
  action: 0xb866ff,
  /** System, Karten, Schild, Information. */
  system: 0x4ee2ff,
  /** Währung, Fracht, Ranglisten, Premium. */
  currency: 0xe8b94d,
  /** Zerstörung, Gegner, Settings, Abbruch. */
  destruction: 0xff4d5e,
  /** Bestätigung, Hülle, Party, online. */
  confirm: 0x5cff8a,
  /** Relikt, Honor, Void-Portale. */
  relic: 0xff5cf0,
  /** Stahl, neutrale Flächen, gesperrt. */
  steel: 0x8e9aab,
  /** Rim-Korridor, Warnung. */
  ember: 0xff8c4d,
} as const;

export type AccentKey = keyof typeof ACCENT;

/** Raritätsleiter. Reihenfolge ist die Rangfolge. */
export const RARITY_ORDER = [
  "common", "uncommon", "rare", "epic", "legendary", "relic", "celestial",
] as const;

export type RarityKey = typeof RARITY_ORDER[number];

export const RARITY: Record<RarityKey, number> = {
  common: 0x8aa0c0,
  uncommon: 0x5cff8a,
  rare: 0x4ee2ff,
  epic: 0xb866ff,
  legendary: 0xe8b94d,
  relic: 0xff5cf0,
  celestial: 0x9df2ff,
};

/** Welche Raritäten animiert werden. */
export const RARITY_ANIMATED: Record<RarityKey, boolean> = {
  common: false, uncommon: false, rare: false,
  epic: true, legendary: true, relic: true, celestial: true,
};

/** Fraktionsfarben. */
export const FACTION: Record<string, number> = {
  EIC: 0x4ee2ff,
  MMO: 0xff8c4d,
  VRU: 0x5cff8a,
  RIM: 0xb866ff,
};

/** Fasenmaße. Panels schneiden oben rechts und unten links, Karten TL + BR. */
export const CHAMFER = {
  /** Große Panels. */
  panel: 34,
  /** Kleine Panels und HUD-Rahmen. */
  panelSmall: 22,
  /** Tooltip. */
  tooltip: 20,
  /** Dialog. */
  dialog: 22,
  /** Karte im Panel. */
  card: 12,
  /** Knopf. */
  button: 8,
  /** Chip, Reiter. */
  chip: 6,
} as const;

/** Rahmenaufbau: fünf Bänder, je 2 px enger, Helligkeit fällt. */
export const BAND = {
  count: 5,
  step: 2,
  /** shade()-Werte von Rim nach innen. */
  ladder: [0.55, -0.06, -0.42, -0.68, -0.86],
} as const;

/** Hexagon-Sockel: sieben Rimlagen, Rim bei 6,25 % der Sockelbreite. */
export const SOCKET = {
  rimFraction: 0.0625,
  ladder: [
    [0, 0.5], [0.5, 0.12], [1, -0.24], [1.5, -0.5],
    [2, -0.68], [2.5, -0.8], [3, -0.88],
  ] as [number, number][],
} as const;

/** Schattenstapel: harter Sitz, Kontakt, Mitte, Wurf. */
export const SHADOW = [
  { dy: 3, blur: 0, alpha: 0.95 },
  { dy: 6, blur: 7, alpha: 0.7 },
  { dy: 14, blur: 18, alpha: 0.55 },
  { dy: 26, blur: 40, alpha: 0.4 },
] as const;

/** Bewegungszeiten in Sekunden. */
export const MOTION = {
  /** Hover-Hub. */
  hover: 0.14,
  /** Press-Senkung. */
  press: 0.12,
  /** Klickblitz. */
  flash: 0.28,
  /** Balken-Nachlauf. */
  barEase: 0.45,
  /** Tooltip-Auffahren. */
  tooltip: 0.18,
  /** Dialog-Auffahren. */
  dialog: 0.18,
  /** Portal-Öffnung. */
  portal: 1.3,
  /** Portal-Schlussschnappen. */
  portalSnap: 0.38,
  /** Reiterwechsel-Farbüberblendung. */
  tabFade: 0.3,
  /** Edge-Glow-Versatz der drei Ebenen. */
  smear: [0.26, 0.38, 0.48] as const,
} as const;

/** Hub- und Senkwege in Pixeln. */
export const LIFT = { hover: 2, hoverStrong: 3, press: 2 } as const;

/** Schriftfamilien. Kenney Future ist die Anzeigeschrift des Spiels. */
export const FONT = {
  display: "Kenney Future, Orbitron, sans-serif",
  displayNarrow: "Kenney Future Narrow, Orbitron, sans-serif",
  label: "Orbitron, Kenney Future Narrow, sans-serif",
  mono: "JetBrains Mono, ui-monospace, monospace",
  body: "Inter, system-ui, sans-serif",
} as const;

/** Schriftgrößen. Nichts unter 5 px bei 1× (CLAUDE.md: nichts unter 8 px im Spiel-Maßstab). */
export const SIZE = {
  micro: 5.5, tiny: 6.5, small: 8, label: 9, body: 11, lead: 12.5,
  title: 14, big: 16, huge: 21, hero: 30,
} as const;

/** Zeilenabstände für Text. */
export const LEADING = 1.5;
