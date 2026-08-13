// Per-category presentation metadata: label, accent colour, icon glyph. ONE
// source of truth so the panel and the tab can never diverge again (the old two
// UIs had contradictory branch colours). Colours pull from the HUD token palette
// where possible; these hexes match the existing --accent-* tokens.
import type { SkillBranch } from "../../../game/types";

export interface BranchMeta {
  id: SkillBranch;
  title: string;
  glyph: string;
  accent: string;      // primary energy colour for nodes/edges
  accentSoft: string;  // dim variant for locked/idle
}

export const BRANCH_META: Record<SkillBranch, BranchMeta> = {
  offense: {
    id: "offense",
    title: "Combat",
    glyph: "⚔",
    accent: "#ff5c6c",
    accentSoft: "#5a2830",
  },
  defense: {
    id: "defense",
    title: "Defense",
    glyph: "⛨",
    accent: "#4ee2ff",
    accentSoft: "#1f4655",
  },
  utility: {
    id: "utility",
    title: "Systems",
    glyph: "❖",
    accent: "#5cff8a",
    accentSoft: "#204a2e",
  },
  engineering: {
    id: "engineering",
    title: "Engineering",
    glyph: "⚙",
    accent: "#ffd24a",
    accentSoft: "#5a4a1a",
  },
};

/** Tab display order. */
export const BRANCH_ORDER: SkillBranch[] = ["offense", "defense", "utility", "engineering"];
