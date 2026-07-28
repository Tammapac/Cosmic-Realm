// ─────────────────────────────────────────────────────────────────────────────
// SYSTEMS (utility) — 23 skills across 5 clusters.
//
//   CORE         ut-cargo (root)
//   COMMERCE     trade → broker → contraband → MAGNATE
//   PROSPECTING  scan → survey → refinery → assay → PROSPECTOR
//   MOBILITY     thrust → warp / vector → slipstream → evasion → PHASERUNNER
//   SALVAGE      salvage → droneops                      (original spur)
//   DRONES       drone2 → swarm → repairbay → HIVEMIND
// ─────────────────────────────────────────────────────────────────────────────
import type { SkillTreeLayout } from "../types/skill-tree.types";

export const utilityTreeLayout: SkillTreeLayout = {
  categoryId: "utility",
  title: "Systems",
  width: 13,
  height: 11,
  nodes: [
    // ── CORE ────────────────────────────────────────────────────────────
    { skillId: "ut-cargo",      x: 4.6, y: 0.0,  visualTier: 0, nodeVariant: "major",    branchId: "core" },
    // hold hangs directly off the root as the cargo-capacity feeder
    { skillId: "ut-hold",       x: 3.4, y: 0.4,  visualTier: 1, nodeVariant: "standard", branchId: "core" },

    // ── COMMERCE (left lobe) ────────────────────────────────────────────
    { skillId: "ut-trade",      x: 2.8, y: 1.5,  visualTier: 1, nodeVariant: "standard", branchId: "commerce" },
    { skillId: "ut-broker",     x: 1.7, y: 2.9,  visualTier: 2, nodeVariant: "standard", branchId: "commerce" },
    { skillId: "ut-contraband", x: 2.3, y: 4.4,  visualTier: 3, nodeVariant: "minor",    branchId: "commerce" },
    { skillId: "ut-magnate",    x: 1.4, y: 6.0,  visualTier: 4, nodeVariant: "ultimate", branchId: "commerce" },

    // ── PROSPECTING (far-left lobe) ─────────────────────────────────────
    { skillId: "ut-scan",       x: 0.6, y: 4.0,  visualTier: 3, nodeVariant: "standard", branchId: "prospecting" },
    { skillId: "ut-survey",     x: 0.2, y: 5.6,  visualTier: 4, nodeVariant: "standard", branchId: "prospecting" },
    { skillId: "ut-refinery",   x: 0.8, y: 7.1,  visualTier: 5, nodeVariant: "standard", branchId: "prospecting" },
    { skillId: "ut-assay",      x: 0.2, y: 8.5,  visualTier: 6, nodeVariant: "minor",    branchId: "prospecting" },
    { skillId: "ut-prospector", x: 1.1, y: 9.8,  visualTier: 7, nodeVariant: "keystone", branchId: "prospecting" },

    // ── MOBILITY (centre) ───────────────────────────────────────────────
    { skillId: "ut-thrust",     x: 5.4, y: 1.6,  visualTier: 1, nodeVariant: "standard", branchId: "mobility" },
    { skillId: "ut-warp",       x: 4.3, y: 2.8,  visualTier: 2, nodeVariant: "minor",    branchId: "mobility" },
    { skillId: "ut-vector",     x: 6.2, y: 3.1,  visualTier: 2, nodeVariant: "standard", branchId: "mobility" },
    { skillId: "ut-slipstream", x: 5.6, y: 4.6,  visualTier: 3, nodeVariant: "standard", branchId: "mobility" },
    { skillId: "ut-evasion",    x: 6.4, y: 6.0,  visualTier: 4, nodeVariant: "major",    branchId: "mobility" },
    { skillId: "ut-phaserunner",x: 5.7, y: 7.7,  visualTier: 5, nodeVariant: "ultimate", branchId: "mobility" },

    // ── SALVAGE (right) ─────────────────────────────────────────────────
    { skillId: "ut-salvage",    x: 8.0, y: 2.6,  visualTier: 2, nodeVariant: "major",    branchId: "salvage" },
    { skillId: "ut-droneops",   x: 7.6, y: 4.2,  visualTier: 3, nodeVariant: "keystone", branchId: "salvage" },

    // ── DRONES (far-right lobe) ─────────────────────────────────────────
    { skillId: "ut-drone2",     x: 9.5, y: 4.1,  visualTier: 3, nodeVariant: "standard", branchId: "drones" },
    { skillId: "ut-swarm",      x: 10.4, y: 5.6, visualTier: 4, nodeVariant: "standard", branchId: "drones" },
    { skillId: "ut-repairbay",  x: 9.8, y: 7.1,  visualTier: 5, nodeVariant: "minor",    branchId: "drones" },
    { skillId: "ut-hivemind",   x: 10.7, y: 8.6, visualTier: 6, nodeVariant: "ultimate", branchId: "drones" },
  ],
  decorativeElements: [
    { kind: "branch-label", x: 1.7, y: 7.2,   label: "COMMERCE",      color: "#9dffbe" },
    { kind: "branch-label", x: 0.6, y: 10.8,  label: "PROSPECTING",   color: "#9dffbe" },
    { kind: "branch-label", x: 5.9, y: 8.8,   label: "MOBILITY",      color: "#9dffbe" },
    { kind: "branch-label", x: 7.8, y: 5.4,   label: "SALVAGE",       color: "#9dffbe" },
    { kind: "branch-label", x: 10.9, y: 9.7,  label: "DRONE COMMAND", color: "#9dffbe" },
  ],
};
