// ─────────────────────────────────────────────────────────────────────────────
// DEFENSE — 23 skills across 5 clusters.
//
//   CORE        def-shield (root)
//   BARRIER     lattice → diffuse → overshield → AEGIS      (shield capacity)
//   BULWARK     barrier → fortress                          (original shield pair)
//   RECOVERY    regen → nano / coolant → triage → secondwind → PHOENIX
//   ARMOUR      armor → ablative → hardened → lastditch → IMMOVABLE (+ bulwark spur)
//   RETALIATION reflect → spines → backlash → NEMESIS
// ─────────────────────────────────────────────────────────────────────────────
import type { SkillTreeLayout } from "../types/skill-tree.types";

export const defenseTreeLayout: SkillTreeLayout = {
  categoryId: "defense",
  title: "Defense",
  width: 13,
  height: 11,
  nodes: [
    // ── CORE ────────────────────────────────────────────────────────────
    { skillId: "def-shield",    x: 4.6, y: 0.0,  visualTier: 0, nodeVariant: "major",    branchId: "core" },

    // ── BARRIER (left lobe) ─────────────────────────────────────────────
    { skillId: "def-lattice",   x: 2.8, y: 1.5,  visualTier: 1, nodeVariant: "standard", branchId: "barrier" },
    { skillId: "def-diffuse",   x: 1.7, y: 2.9,  visualTier: 2, nodeVariant: "standard", branchId: "barrier" },
    { skillId: "def-overshield",x: 2.3, y: 4.4,  visualTier: 3, nodeVariant: "major",    branchId: "barrier" },
    { skillId: "def-aegis",     x: 1.4, y: 6.0,  visualTier: 4, nodeVariant: "ultimate", branchId: "barrier" },

    // ── BULWARK (far-left spur) ─────────────────────────────────────────
    { skillId: "def-barrier",   x: 0.6, y: 1.3,  visualTier: 1, nodeVariant: "standard", branchId: "bulwark" },
    { skillId: "def-fortress",  x: 0.2, y: 2.8,  visualTier: 2, nodeVariant: "keystone", branchId: "bulwark" },

    // ── RECOVERY (centre) ───────────────────────────────────────────────
    { skillId: "def-regen",     x: 5.4, y: 1.6,  visualTier: 1, nodeVariant: "standard", branchId: "recovery" },
    { skillId: "def-nano",      x: 4.3, y: 2.8,  visualTier: 2, nodeVariant: "minor",    branchId: "recovery" },
    { skillId: "def-coolant",   x: 6.2, y: 3.1,  visualTier: 2, nodeVariant: "standard", branchId: "recovery" },
    { skillId: "def-triage",    x: 5.6, y: 4.6,  visualTier: 3, nodeVariant: "standard", branchId: "recovery" },
    { skillId: "def-secondwind",x: 6.4, y: 6.0,  visualTier: 4, nodeVariant: "major",    branchId: "recovery" },
    { skillId: "def-phoenix",   x: 5.7, y: 7.7,  visualTier: 5, nodeVariant: "ultimate", branchId: "recovery" },

    // ── ARMOUR (right lobe) ─────────────────────────────────────────────
    { skillId: "def-armor",     x: 8.0, y: 2.6,  visualTier: 2, nodeVariant: "major",    branchId: "armour" },
    { skillId: "def-bulwark",   x: 7.5, y: 4.2,  visualTier: 3, nodeVariant: "keystone", branchId: "armour" },
    { skillId: "def-ablative",  x: 9.4, y: 4.0,  visualTier: 3, nodeVariant: "standard", branchId: "armour" },
    { skillId: "def-hardened",  x: 10.2, y: 5.5, visualTier: 4, nodeVariant: "standard", branchId: "armour" },
    { skillId: "def-lastditch", x: 9.6, y: 7.0,  visualTier: 5, nodeVariant: "minor",    branchId: "armour" },
    { skillId: "def-immovable", x: 10.4, y: 8.5, visualTier: 6, nodeVariant: "ultimate", branchId: "armour" },

    // ── RETALIATION (far-right lobe) ────────────────────────────────────
    { skillId: "def-reflect",   x: 11.6, y: 3.4, visualTier: 3, nodeVariant: "standard", branchId: "retaliation" },
    { skillId: "def-spines",    x: 12.4, y: 4.9, visualTier: 4, nodeVariant: "standard", branchId: "retaliation" },
    { skillId: "def-backlash",  x: 11.9, y: 6.4, visualTier: 5, nodeVariant: "major",    branchId: "retaliation" },
    { skillId: "def-nemesis",   x: 12.6, y: 8.0, visualTier: 6, nodeVariant: "ultimate", branchId: "retaliation" },
  ],
  decorativeElements: [
    { kind: "branch-label", x: 1.7, y: 7.2,  label: "BARRIER",     color: "#8fdcff" },
    { kind: "branch-label", x: 0.4, y: 3.9,  label: "BULWARK",     color: "#8fdcff" },
    { kind: "branch-label", x: 5.9, y: 8.8,  label: "RECOVERY",    color: "#8fdcff" },
    { kind: "branch-label", x: 10.6, y: 9.6, label: "ARMOUR",      color: "#8fdcff" },
    { kind: "branch-label", x: 12.5, y: 9.1, label: "RETALIATION", color: "#8fdcff" },
  ],
};
