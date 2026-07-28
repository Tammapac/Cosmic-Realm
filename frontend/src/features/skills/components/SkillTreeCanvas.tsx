// The React-Flow viewport. React Flow is used ONLY as the positioning / zoom /
// pan engine — every visible pixel comes from our own node + edge components,
// and every editor affordance (dragging nodes, creating connections, the
// attribution badge, selection boxes) is switched off.
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow, ReactFlowProvider, useReactFlow,
  type Node, type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { SkillId } from "../../../game/types";
import type { SkillTreeLayout } from "../types/skill-tree.types";
import { SkillTreeNode } from "./SkillTreeNode";
import { ClusterLabelNode } from "./ClusterLabelNode";
import { SkillEnergyEdge } from "./SkillEnergyEdge";
import { SkillTreeBackground } from "./SkillTreeBackground";
import {
  buildSkillNodes, buildSkillEdges, buildDecorationNodes, layoutPixelBounds,
} from "../utils/buildSkillGraph";
import type { PlayerSkillView } from "../utils/calculateSkillState";

// Defined OUTSIDE the component (brief §16) so React Flow never re-registers them.
const nodeTypes = { skill: SkillTreeNode, clusterLabel: ClusterLabelNode };
const edgeTypes = { energy: SkillEnergyEdge };

interface Props {
  layout: SkillTreeLayout;
  player: PlayerSkillView;
  accent: string;
  selectedId: SkillId | null;
  onSelect: (id: SkillId) => void;
}

function CanvasInner({ layout, player, accent, selectedId, onSelect }: Props) {
  const { fitView } = useReactFlow();
  const lastCategory = useRef(layout.categoryId);

  const nodes = useMemo(
    () => [
      ...buildDecorationNodes(layout),           // captions paint under the skills
      ...buildSkillNodes(layout, player, accent, selectedId),
    ],
    [layout, player, accent, selectedId],
  );
  const edges = useMemo(
    () => buildSkillEdges(layout, player, accent),
    [layout, player, accent],
  );

  // On tab change, frame the new tree from its root.
  useEffect(() => {
    if (lastCategory.current !== layout.categoryId) {
      lastCategory.current = layout.categoryId;
    }
    const t = window.setTimeout(() => {
      // A cluster map is deliberately LARGER than the viewport, so fitting the
      // whole thing would zoom far out and shrink every node's click target.
      // Instead: frame the ROOT area at ~1:1 and let the player pan outward —
      // "you start here, the tree extends beyond". minZoom clamps the fit so a
      // small tree still can't be scaled down into unreadability.
      // Frame the opening BRANCH (root + its first two tiers), not just the
      // root: focusing the single root node showed almost nothing of the map.
      // This opens on a readable chunk of tree while still starting the player
      // at the bottom of the cluster they grow from.
      const opening = layout.nodes.filter((n) => n.visualTier <= 2);
      if (opening.length) {
        fitView({
          nodes: opening.map((n) => ({ id: n.skillId })),
          padding: 0.22,
          duration: 420,
          minZoom: 0.62,
          maxZoom: 0.95,
        });
      } else {
        fitView({ padding: 0.16, duration: 420, minZoom: 0.62, maxZoom: 0.95 });
      }
    }, 30);
    return () => window.clearTimeout(t);
  }, [layout, fitView]);

  const handleNodeClick: NodeMouseHandler = useCallback((_e, node: Node) => {
    if (node.type !== "skill") return; // cluster captions are not selectable
    onSelect(node.id as SkillId);
  }, [onSelect]);

  const bounds = useMemo(() => layoutPixelBounds(layout), [layout]);

  return (
    <div className="skt-canvas-wrap">
      <SkillTreeBackground accent={accent} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        // ── lock down every editor behaviour ──
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        edgesFocusable={false}
        nodesFocusable
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        connectOnClick={false}
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        selectionKeyCode={null}
        proOptions={{ hideAttribution: true }}
        // The floor must match the fit clamp below: React Flow applies the
        // instance minZoom AFTER a fitView, so a lower global floor silently
        // let big trees scale down to ~0.38 and made every node tiny again.
        minZoom={0.5}
        maxZoom={1.6}
        fitView
        fitViewOptions={{ padding: 0.22, minZoom: 0.62, maxZoom: 0.95 }}
        translateExtent={[
          [-bounds.width, -bounds.height],
          [bounds.width * 2, bounds.height * 2],
        ]}
      />
    </div>
  );
}

export function SkillTreeCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
