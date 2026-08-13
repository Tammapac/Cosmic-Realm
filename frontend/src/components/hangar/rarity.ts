/**
 * Shared rarity palette, MIGRATED verbatim from the design export:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (`const R` and `const RECESS` in the data-dc-script block)
 *
 * The export packs each rarity as a positional array
 *   [hex, tintBg, glowSize, glowRgba, label]
 * and keys them by name. Unpacked into named fields here — the VALUES are
 * untouched, only the shape is readable.
 *
 * Used by S-02 Bounty (contract tiers), S-06 Drones (inventory items) and
 * S-07 Market (commodity tiers), so it lives in its own module rather than
 * being duplicated per panel.
 */

export type RarityKey =
  | "common" | "uncommon" | "rare" | "epic" | "legendary" | "relic" | "celestial";

export interface Rarity {
  /** Accent colour for text, pips and borders. */
  hex: string;
  /** Translucent fill behind the item. */
  tint: string;
  /** Outer glow radius, e.g. "16px". */
  glowSize: string;
  /** Glow colour at that radius. */
  glow: string;
  label: string;
  /** Recessed well colour behind the item art. */
  recess: string;
}

export const RARITY: Record<RarityKey, Rarity> = {
  common:    { hex: "#8aa0c0", tint: "rgba(138,160,192,.12)", glowSize: "12px", glow: "rgba(138,160,192,.25)", label: "COMMON",    recess: "#0b0e16" },
  uncommon:  { hex: "#5cff8a", tint: "rgba(92,255,138,.14)",  glowSize: "14px", glow: "rgba(92,255,138,.3)",   label: "UNCOMMON",  recess: "#07120d" },
  rare:      { hex: "#4ee2ff", tint: "rgba(78,226,255,.14)",  glowSize: "16px", glow: "rgba(78,226,255,.32)",  label: "RARE",      recess: "#06111c" },
  epic:      { hex: "#b866ff", tint: "rgba(184,102,255,.16)", glowSize: "20px", glow: "rgba(184,102,255,.35)", label: "EPIC",      recess: "#0f0819" },
  legendary: { hex: "#e8b94d", tint: "rgba(232,185,77,.16)",  glowSize: "24px", glow: "rgba(232,185,77,.4)",   label: "LEGENDARY", recess: "#120f05" },
  relic:     { hex: "#ff4fa8", tint: "rgba(255,79,168,.16)",  glowSize: "28px", glow: "rgba(255,79,168,.4)",   label: "RELIC",     recess: "#120f05" },
  celestial: { hex: "#9df2ff", tint: "rgba(157,242,255,.18)", glowSize: "32px", glow: "rgba(157,242,255,.45)", label: "CELESTIAL", recess: "#06111c" },
};

/** Progression order. Bounty tiers use the first five; the item panels use all. */
export const RARITY_ORDER: RarityKey[] = [
  "common", "uncommon", "rare", "epic", "legendary", "relic", "celestial",
];

/** Bounty contract tiers stop at legendary (TIER_ORDER in the export). */
export const TIER_ORDER: RarityKey[] = ["common", "uncommon", "rare", "epic", "legendary"];
