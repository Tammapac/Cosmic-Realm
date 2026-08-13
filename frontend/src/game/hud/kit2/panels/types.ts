// Gemeinsame Formen für alle Fenster und HUD-Teile.

import type { Container } from "pixi.js";
import type { RarityKey } from "../core/tokens";

/** Jedes Fenster liefert dasselbe Handle. */
export type WindowHandle = {
  /** In die Bühne oder den PanelHost hängen. */
  root: Container;
  /** Pro Frame rufen, dt in Sekunden. */
  update: (dt: number) => void;
  /** Schließen mit rückwärts laufender Portal-Animation. */
  close: () => void;
  /** Außenmaße für die Zentrierung. */
  size: { w: number; h: number };
  destroy: () => void;
};

export type WindowOpts = {
  /** Sofort öffnen. Standard true. */
  autoplay?: boolean;
  /** Wird gerufen, wenn die Schließanimation durch ist. */
  onClosed?: () => void;
};

/** HUD-Teile bleiben offen und brauchen kein close(). */
export type HudHandle = {
  root: Container;
  update: (dt: number) => void;
  destroy: () => void;
};

/** Ein Gegenstand, wie ihn Sockel, Tooltip und Listen erwarten. */
export type Item = {
  id: string;
  name: string;
  kind: "weapon" | "shield" | "engine" | "module" | "consumable" | "ore" | string;
  rarity: RarityKey;
  /** Icon-Kürzel aus assets/ui/items. */
  icon: string;
  qty?: number;
  ilvl?: number;
  equipped?: boolean;
  locked?: boolean;
  slot?: string;
  desc?: string;
  stats?: [string, string][];
};

/** Zonenkontakt für Minimap und Zonenkarte. */
export type Contact = {
  id: string;
  kind: "station" | "portal" | "void" | "factory" | "enemy" | "party" | "belt";
  name: string;
  x: number;
  y: number;
  tag?: string;
  brief?: string;
  level?: number;
};

/** Pilotenstand, den mehrere Fenster lesen. */
export type Pilot = {
  name: string;
  faction: string;
  clanTag?: string;
  rank: number;
  rankName?: string;
  level: number;
  xp: number;
  xpMax: number;
  honor: number;
  honorNext?: number;
  credits: number;
  mcoins: number;
  premium?: boolean;
  docked?: boolean;
};
