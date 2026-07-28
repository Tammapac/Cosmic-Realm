// ─────────────────────────────────────────────────────────────────────────────
// ENGINEERING — 22 skills across 5 clusters.
//
// Formerly a single linear spine; the new skills branch it into real choices.
//
//   CORE     eng-coolant (root)
//   THERMAL  radiator → cryoflow → heatsink → RUNAWAY
//   SPINE    capacitor → targeting → warp-core → overdrive → singularity
//            → { recursion, eventhorizon → ZEROPOINT }
//   REACTOR  plasma → fusion → surge → MELTDOWN
//   FIELD    regulator → harmonics → transfer → resonance → EQUILIBRIUM
// ─────────────────────────────────────────────────────────────────────────────
import type { SkillTreeLayout } from "../types/skill-tree.types";

export const engineeringTreeLayout: SkillTreeLayout = {
  categoryId: "engineering",
  title: "Engineering",
  width: 13,
  height: 12,
  nodes: [
    // ── CORE ────────────────────────────────────────────────────────────
    { skillId: "eng-coolant",     x: 4.4, y: 0.0,  visualTier: 0, nodeVariant: "major",    branchId: "core" },

    // ── THERMAL (left lobe) ─────────────────────────────────────────────
    { skillId: "eng-radiator",    x: 2.4, y: 1.4,  visualTier: 1, nodeVariant: "standard", branchId: "thermal" },
    { skillId: "eng-cryoflow",    x: 1.3, y: 2.8,  visualTier: 2, nodeVariant: "standard", branchId: "thermal" },
    { skillId: "eng-heatsink",    x: 1.9, y: 4.3,  visualTier: 3, nodeVariant: "minor",    branchId: "thermal" },
    { skillId: "eng-runaway",     x: 1.0, y: 5.8,  visualTier: 4, nodeVariant: "ultimate", branchId: "thermal" },

    // ── SPINE (centre, the original chain) ──────────────────────────────
    { skillId: "eng-capacitor",   x: 5.6, y: 1.6,  visualTier: 1, nodeVariant: "major",    branchId: "spine" },
    { skillId: "eng-targeting",   x: 5.0, y: 3.2,  visualTier: 2, nodeVariant: "standard", branchId: "spine" },
    { skillId: "eng-warp-core",   x: 5.8, y: 4.7,  visualTier: 3, nodeVariant: "standard", branchId: "spine" },
    { skillId: "eng-overdrive",   x: 5.1, y: 6.2,  visualTier: 4, nodeVariant: "keystone", branchId: "spine" },
    { skillId: "eng-recursion",   x: 3.7, y: 7.4,  visualTier: 5, nodeVariant: "minor",    branchId: "spine" },
    { skillId: "eng-singularity", x: 5.9, y: 7.8,  visualTier: 5, nodeVariant: "ultimate", branchId: "spine" },
    { skillId: "eng-eventhorizon",x: 5.3, y: 9.5,  visualTier: 6, nodeVariant: "ultimate", branchId: "spine" },
    { skillId: "eng-zeropoint",   x: 6.1, y: 11.0, visualTier: 7, nodeVariant: "ultimate", branchId: "spine" },

    // ── REACTOR (right lobe) ────────────────────────────────────────────
    { skillId: "eng-plasma",      x: 7.6, y: 3.0,  visualTier: 2, nodeVariant: "standard", branchId: "reactor" },
    { skillId: "eng-fusion",      x: 8.6, y: 4.5,  visualTier: 3, nodeVariant: "standard", branchId: "reactor" },
    { skillId: "eng-surge",       x: 8.0, y: 6.0,  visualTier: 4, nodeVariant: "major",    branchId: "reactor" },
    { skillId: "eng-meltdown",    x: 8.8, y: 7.6,  visualTier: 5, nodeVariant: "ultimate", branchId: "reactor" },

    // ── FIELD (far-right lobe) ──────────────────────────────────────────
    { skillId: "eng-regulator",   x: 10.3, y: 3.2, visualTier: 2, nodeVariant: "standard", branchId: "field" },
    { skillId: "eng-harmonics",   x: 11.3, y: 4.7, visualTier: 3, nodeVariant: "standard", branchId: "field" },
    { skillId: "eng-transfer",    x: 10.7, y: 6.2, visualTier: 4, nodeVariant: "minor",    branchId: "field" },
    { skillId: "eng-resonance",   x: 11.6, y: 7.7, visualTier: 5, nodeVariant: "major",    branchId: "field" },
    { skillId: "eng-equilibrium", x: 11.0, y: 9.3, visualTier: 6, nodeVariant: "ultimate", branchId: "field" },
  ],
  decorativeElements: [
    { kind: "branch-label", x: 1.2, y: 7.0,   label: "THERMAL",      color: "#ffe08a" },
    { kind: "branch-label", x: 6.0, y: 12.2,  label: "SINGULARITY",  color: "#ffe08a" },
    { kind: "branch-label", x: 8.9, y: 8.8,   label: "REACTOR",      color: "#ffe08a" },
    { kind: "branch-label", x: 11.2, y: 10.5, label: "FIELD SYSTEMS",color: "#ffe08a" },
  ],
};
