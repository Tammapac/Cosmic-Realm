// Derive a node's visual state from the player's learned skills + the skill's
// prerequisite. Pure — no store access, so it's trivially memoizable and testable.
import { SKILL_NODES, type SkillId } from "../../../game/types";
import type { SkillNodeState, SkillEdgeState } from "../types/skill-tree.types";

const NODE_BY_ID = new Map(SKILL_NODES.map((n) => [n.id, n]));

export interface PlayerSkillView {
  skills: Partial<Record<SkillId, number>>;
  skillPoints: number;
}

export function rankOf(p: PlayerSkillView, id: SkillId): number {
  return p.skills[id] ?? 0;
}

/** True if every prerequisite of `id` has ≥1 rank. */
export function prereqMet(p: PlayerSkillView, id: SkillId): boolean {
  const node = NODE_BY_ID.get(id);
  if (!node?.requires) return true;
  return rankOf(p, node.requires) > 0;
}

/** Can the player buy the next rank right now (prereq + points + not maxed)? */
export function canBuy(p: PlayerSkillView, id: SkillId): boolean {
  const node = NODE_BY_ID.get(id);
  if (!node) return false;
  const rank = rankOf(p, id);
  if (rank >= node.maxRank) return false;
  if (!prereqMet(p, id)) return false;
  return p.skillPoints >= node.cost;
}

export function calculateNodeState(p: PlayerSkillView, id: SkillId): SkillNodeState {
  const node = NODE_BY_ID.get(id);
  if (!node) return "locked";
  const rank = rankOf(p, id);
  if (rank >= node.maxRank) return "maxed";
  if (rank > 0) return "unlocked";
  if (prereqMet(p, id)) return "available";
  return "locked";
}

/** Edge state between a parent and its child (child.requires === parent). */
export function calculateEdgeState(
  p: PlayerSkillView,
  parentId: SkillId,
  childId: SkillId,
): SkillEdgeState {
  const parent = NODE_BY_ID.get(parentId);
  const child = NODE_BY_ID.get(childId);
  if (!parent || !child) return "locked";
  const pr = rankOf(p, parentId);
  const cr = rankOf(p, childId);
  if (pr <= 0) return "locked";
  if (pr >= parent.maxRank && cr >= child.maxRank) return "maxed-branch";
  if (cr > 0) return "active";
  return "available"; // parent learned, child purchasable-ish
}
