// ─────────────────────────────────────────────────────────────────────────────
// New skill-tree UI — presentation types ONLY.
//
// The gameplay contract (skill IDs, branch, maxRank, cost, requires) lives in
// frontend/src/game/types.ts (SKILL_NODES) and is mirrored server-side. This
// module never redefines those numbers — it references skill IDs and layers a
// hand-authored VISUAL layout on top. Keeping layout separate from skill data is
// deliberate (see the brief §13): a re-balance of a skill must not disturb its
// on-screen position, and vice-versa.
// ─────────────────────────────────────────────────────────────────────────────
import type { SkillId, SkillBranch } from "../../../game/types";

/** Visual weight of a node — drives its frame silhouette + size, NOT its power. */
export type SkillNodeVariant =
  | "minor"      // small support skill
  | "standard"   // normal active/passive
  | "major"      // bigger node, stronger frame
  | "keystone"   // decision node, distinct mechanical frame
  | "ultimate";  // unique capstone, own silhouette

/** Runtime state of a node, derived from player.skills + prerequisites. */
export type SkillNodeState =
  | "locked"           // prerequisites not met
  | "available"        // can be purchased now
  | "unlocked"         // has ≥1 rank, not maxed
  | "maxed"            // at maxRank
  | "blocked-by-choice"; // a mutually-exclusive alternative was taken

/** Visual state of an edge between two nodes. */
export type SkillEdgeState =
  | "locked"        // parent not learned
  | "available"     // parent learned, child purchasable
  | "active"        // both ends learned
  | "maxed-branch"  // both ends maxed (gold accent)
  | "blocked";      // severed by a mutually-exclusive choice

/**
 * One node's hand-authored placement in a tree. x/y are in ABSTRACT layout
 * units (see buildSkillNodes → React Flow positions); the canvas scales them.
 * branchId groups a visual sub-tree (a "path"/build direction) so edges + the
 * background haze can tint per branch.
 */
export interface SkillTreeLayoutNode {
  skillId: SkillId;
  x: number;
  y: number;
  visualTier: number;      // 0 = root … higher = deeper toward the capstone
  nodeVariant: SkillNodeVariant;
  branchId: string;
}

/** A decorative, non-interactive element drawn behind/around the tree. */
export interface SkillTreeDecoration {
  kind: "haze" | "hexplate" | "branch-label";
  x: number;
  y: number;
  w?: number;
  h?: number;
  label?: string;
  color?: string;
}

/** The full hand-authored layout for one category/branch. */
export interface SkillTreeLayout {
  categoryId: SkillBranch;
  /** Human label shown on the tab (localised copy lives in the tab config). */
  title: string;
  width: number;
  height: number;
  nodes: SkillTreeLayoutNode[];
  /** Extra visual-only edges (e.g. a cross-link the requires-graph doesn't have). */
  extraEdges?: { from: SkillId; to: SkillId }[];
  decorativeElements?: SkillTreeDecoration[];
}

/** Data passed into a custom React-Flow node. */
export interface SkillNodeData {
  skillId: SkillId;
  variant: SkillNodeVariant;
  branchId: string;
  state: SkillNodeState;
  rank: number;
  maxRank: number;
  name: string;
  icon: string;
  selected: boolean;
  /** Accent colour for this branch (from BRANCH_META). */
  accent: string;
  [key: string]: unknown; // React Flow's Record<string, unknown> constraint
}

/** Data passed into a custom React-Flow edge. */
export interface SkillEdgeData {
  state: SkillEdgeState;
  accent: string;
  [key: string]: unknown;
}
