import type { SkillBranch } from "../../../game/types";
import type { SkillTreeLayout } from "../types/skill-tree.types";
import { combatTreeLayout } from "./combatTree.layout";
import { defenseTreeLayout } from "./defenseTree.layout";
import { utilityTreeLayout } from "./utilityTree.layout";
import { engineeringTreeLayout } from "./engineeringTree.layout";

export const SKILL_TREE_LAYOUTS: Record<SkillBranch, SkillTreeLayout> = {
  offense: combatTreeLayout,
  defense: defenseTreeLayout,
  utility: utilityTreeLayout,
  engineering: engineeringTreeLayout,
};
