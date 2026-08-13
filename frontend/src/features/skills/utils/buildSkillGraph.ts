// Turn a hand-authored layout + the player's learned skills into React-Flow
// nodes/edges. Pure functions so the canvas can memoize on (layout, skills).
import { SKILL_NODES, type SkillId } from "../../../game/types";
import type { Node, Edge } from "@xyflow/react";
import type {
  SkillTreeLayout, SkillNodeData, SkillEdgeData, SkillNodeVariant,
} from "../types/skill-tree.types";
import { calculateNodeState, calculateEdgeState, type PlayerSkillView } from "./calculateSkillState";

const NODE_BY_ID = new Map(SKILL_NODES.map((n) => [n.id, n]));

/** Layout units → pixels. y is INVERTED so tier 0 sits at the bottom.
 *  Kept tight on purpose: a 6×6 layout at the old 168/148 spacing spanned
 *  ~1176×1036 px, which fitView had to shrink to ~0.66 zoom inside the ~680 px
 *  canvas — that both "looked zoomed out" and shrank every node's hit target to
 *  ~52 px. Tighter units let the tree fit near 1:1. */
export const UNIT_X = 128;
export const UNIT_Y = 96;

/** Rendered node box per variant (must track skill-node.css sizes). */
const VARIANT_SIZE: Record<SkillNodeVariant, number> = {
  minor: 52,
  standard: 66,
  major: 82,
  keystone: 94,
  ultimate: 110,
};

export function layoutToPixels(layout: SkillTreeLayout, x: number, y: number) {
  return {
    x: x * UNIT_X,
    // invert: taller y = further up the screen
    y: (layout.height - y) * UNIT_Y,
  };
}

export function buildSkillNodes(
  layout: SkillTreeLayout,
  player: PlayerSkillView,
  accent: string,
  selectedId: SkillId | null,
): Node[] {
  return layout.nodes.map((ln) => {
    const def = NODE_BY_ID.get(ln.skillId);
    const size = VARIANT_SIZE[ln.nodeVariant];
    const p = layoutToPixels(layout, ln.x, ln.y);
    const data: SkillNodeData = {
      skillId: ln.skillId,
      variant: ln.nodeVariant,
      branchId: ln.branchId,
      state: calculateNodeState(player, ln.skillId),
      rank: player.skills[ln.skillId] ?? 0,
      maxRank: def?.maxRank ?? 1,
      name: def?.name ?? ln.skillId,
      icon: def?.icon ?? "?",
      selected: selectedId === ln.skillId,
      accent,
    };
    return {
      id: ln.skillId,
      type: "skill",
      // React Flow positions by top-left; centre the box on the layout point.
      position: { x: p.x - size / 2, y: p.y - size / 2 },
      data: data as unknown as Record<string, unknown>,
      // Declare the box explicitly. Our node's size comes from a CSS custom
      // property on an inner element, which React Flow cannot measure — without
      // these it leaves `measured` undefined and then refuses to draw ANY edge.
      // `measured` is supplied too: every rank purchase rebuilds these node
      // objects, and a fresh object without it drops back to unmeasured, which
      // made all conduits vanish the moment a skill was learned.
      width: size,
      height: size,
      initialWidth: size,
      initialHeight: size,
      measured: { width: size, height: size },
      draggable: false,
      selectable: true,
      connectable: false,
      deletable: false,
    };
  });
}

/**
 * Decorative cluster captions as non-interactive nodes, so they pan/zoom with
 * the tree instead of floating in screen space. Only "branch-label" decorations
 * become nodes; hazes/plates are drawn by the CSS background layers.
 */
export function buildDecorationNodes(layout: SkillTreeLayout): Node[] {
  return (layout.decorativeElements ?? [])
    .filter((d) => d.kind === "branch-label" && d.label)
    .map((d, i) => {
      const p = layoutToPixels(layout, d.x, d.y);
      return {
        id: `label:${i}:${d.label}`,
        type: "clusterLabel",
        position: { x: p.x - 90, y: p.y - 12 },
        data: { label: d.label!, color: d.color } as Record<string, unknown>,
        width: 180,
        height: 24,
        measured: { width: 180, height: 24 },
        draggable: false,
        selectable: false,
        connectable: false,
        deletable: false,
        focusable: false,
      };
    });
}

export function buildSkillEdges(
  layout: SkillTreeLayout,
  player: PlayerSkillView,
  accent: string,
): Edge[] {
  const present = new Set(layout.nodes.map((n) => n.skillId));
  const edges: Edge[] = [];

  for (const ln of layout.nodes) {
    const def = NODE_BY_ID.get(ln.skillId);
    const parent = def?.requires;
    if (!parent || !present.has(parent)) continue;
    const data: SkillEdgeData = {
      state: calculateEdgeState(player, parent, ln.skillId),
      accent,
    };
    edges.push({
      id: `${parent}->${ln.skillId}`,
      source: parent,
      target: ln.skillId,
      // The tree grows upward: leave the parent's TOP, enter the child's BOTTOM.
      sourceHandle: "out",
      targetHandle: "in",
      type: "energy",
      data: data as unknown as Record<string, unknown>,
      selectable: false,
      deletable: false,
      focusable: false,
    });
  }

  // Purely visual cross-links declared by the layout (no gameplay meaning).
  for (const ex of layout.extraEdges ?? []) {
    if (!present.has(ex.from) || !present.has(ex.to)) continue;
    const data: SkillEdgeData = { state: calculateEdgeState(player, ex.from, ex.to), accent };
    edges.push({
      id: `x:${ex.from}->${ex.to}`,
      source: ex.from,
      target: ex.to,
      sourceHandle: "out",
      targetHandle: "in",
      type: "energy",
      data: data as unknown as Record<string, unknown>,
      selectable: false, deletable: false, focusable: false,
    });
  }

  return edges;
}

/** Total layout size in px — used to fit the viewport. */
export function layoutPixelBounds(layout: SkillTreeLayout) {
  return { width: (layout.width + 1) * UNIT_X, height: (layout.height + 1) * UNIT_Y };
}
