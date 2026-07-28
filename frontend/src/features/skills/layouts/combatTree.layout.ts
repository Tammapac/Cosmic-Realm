// ─────────────────────────────────────────────────────────────────────────────
// COMBAT (offense) — 24 skills across 5 clusters on a wide map.
//
// The root sits lower-LEFT; the map extends up and to the right so the player
// reads it as "I start here, the arsenal opens outward". Each cluster is a
// visually separated lobe with its own caption, and cluster ends carry the
// keystones/ultimates.
//
//   CORE        off-power (root)
//   PRECISION   caliber → steady → weakpoint → firstblood → coldbore → HEADHUNTER
//   MARKSMAN    snipe → void                       (the original precision pair)
//   SUPPRESSION rapid → volley / sustain → cadence → attrition → BARRAGE
//   LETHALITY   crit → execute → render → APEX
//   ORDNANCE    pierce → splash → shrapnel → chain → SATURATION
//
// x grows right, y grows UP (the canvas inverts y so tier 0 is at the bottom).
// ─────────────────────────────────────────────────────────────────────────────
import type { SkillTreeLayout } from "../types/skill-tree.types";

export const combatTreeLayout: SkillTreeLayout = {
  categoryId: "offense",
  title: "Combat",
  width: 13,
  height: 11,
  nodes: [
    // ── CORE ────────────────────────────────────────────────────────────
    { skillId: "off-power",     x: 4.6, y: 0.0,  visualTier: 0, nodeVariant: "major",    branchId: "core" },

    // ── PRECISION (up-left lobe) ────────────────────────────────────────
    { skillId: "off-caliber",   x: 2.9, y: 1.5,  visualTier: 1, nodeVariant: "standard", branchId: "precision" },
    { skillId: "off-steady",    x: 1.8, y: 2.9,  visualTier: 2, nodeVariant: "standard", branchId: "precision" },
    { skillId: "off-weakpoint", x: 2.3, y: 4.4,  visualTier: 3, nodeVariant: "standard", branchId: "precision" },
    { skillId: "off-firstblood",x: 1.2, y: 5.7,  visualTier: 4, nodeVariant: "minor",    branchId: "precision" },
    { skillId: "off-coldbore",  x: 2.5, y: 6.9,  visualTier: 5, nodeVariant: "major",    branchId: "precision" },
    { skillId: "off-headhunter",x: 1.6, y: 8.5,  visualTier: 6, nodeVariant: "ultimate", branchId: "precision" },

    // ── MARKSMAN (far-left spur off the root) ───────────────────────────
    { skillId: "off-snipe",     x: 0.6, y: 1.3,  visualTier: 1, nodeVariant: "standard", branchId: "marksman" },
    { skillId: "off-void",      x: 0.2, y: 2.8,  visualTier: 2, nodeVariant: "keystone", branchId: "marksman" },

    // ── SUPPRESSION (centre column) ─────────────────────────────────────
    { skillId: "off-rapid",     x: 5.4, y: 1.6,  visualTier: 1, nodeVariant: "standard", branchId: "suppression" },
    { skillId: "off-volley",    x: 4.3, y: 2.8,  visualTier: 2, nodeVariant: "minor",    branchId: "suppression" },
    { skillId: "off-sustain",   x: 6.2, y: 3.1,  visualTier: 2, nodeVariant: "standard", branchId: "suppression" },
    { skillId: "off-cadence",   x: 5.6, y: 4.6,  visualTier: 3, nodeVariant: "standard", branchId: "suppression" },
    { skillId: "off-attrition", x: 6.4, y: 6.0,  visualTier: 4, nodeVariant: "major",    branchId: "suppression" },
    { skillId: "off-barrage",   x: 5.7, y: 7.7,  visualTier: 5, nodeVariant: "ultimate", branchId: "suppression" },

    // ── LETHALITY (right lobe) ──────────────────────────────────────────
    { skillId: "off-crit",      x: 8.0, y: 2.6,  visualTier: 2, nodeVariant: "major",    branchId: "lethality" },
    { skillId: "off-execute",   x: 9.3, y: 4.0,  visualTier: 3, nodeVariant: "keystone", branchId: "lethality" },
    { skillId: "off-render",    x: 10.1, y: 5.6, visualTier: 4, nodeVariant: "standard", branchId: "lethality" },
    { skillId: "off-apex",      x: 9.5, y: 7.2,  visualTier: 5, nodeVariant: "ultimate", branchId: "lethality" },

    // ── ORDNANCE (far-right lobe) ───────────────────────────────────────
    { skillId: "off-pierce",    x: 7.6, y: 4.3,  visualTier: 3, nodeVariant: "standard", branchId: "ordnance" },
    { skillId: "off-splash",    x: 11.6, y: 3.4, visualTier: 4, nodeVariant: "standard", branchId: "ordnance" },
    { skillId: "off-shrapnel",  x: 12.3, y: 5.0, visualTier: 5, nodeVariant: "minor",    branchId: "ordnance" },
    { skillId: "off-chain",     x: 11.7, y: 6.5, visualTier: 6, nodeVariant: "major",    branchId: "ordnance" },
    { skillId: "off-saturation",x: 12.5, y: 8.1, visualTier: 7, nodeVariant: "ultimate", branchId: "ordnance" },
  ],
  decorativeElements: [
    { kind: "branch-label", x: 1.9, y: 9.6,  label: "PRECISION",   color: "#ff8a94" },
    { kind: "branch-label", x: 0.4, y: 3.9,  label: "MARKSMAN",    color: "#ff8a94" },
    { kind: "branch-label", x: 5.9, y: 8.8,  label: "SUPPRESSION", color: "#ff8a94" },
    { kind: "branch-label", x: 9.7, y: 8.3,  label: "LETHALITY",   color: "#ff8a94" },
    { kind: "branch-label", x: 12.4, y: 9.2, label: "ORDNANCE",    color: "#ff8a94" },
  ],
};
