// Custom React-Flow node. Nothing of React Flow's default node styling is used —
// the visible chrome is entirely ours (see skill-node.css). The Handles exist
// only so edges have anchor points; they are visually hidden by CSS.
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { SkillNodeData } from "../types/skill-tree.types";

function SkillTreeNodeImpl({ data }: NodeProps) {
  const d = data as unknown as SkillNodeData;
  const {
    variant, state, rank, maxRank, name, icon, selected, accent,
  } = d;

  // Pips read well up to 5; beyond that a numeric badge stays legible.
  const usePips = maxRank <= 5;

  const stateLabel =
    state === "maxed" ? "mastered"
    : state === "unlocked" ? `rank ${rank} of ${maxRank}`
    : state === "available" ? "available to learn"
    : state === "blocked-by-choice" ? "blocked by another specialisation"
    : "locked";

  return (
    <div
      className={[
        "skn",
        `skn--${variant}`,
        `skn--${state}`,
        selected ? "skn--selected" : "",
      ].filter(Boolean).join(" ")}
      style={{ ["--skn-accent" as string]: accent }}
      role="button"
      tabIndex={0}
      aria-label={`${name}, ${stateLabel}`}
      aria-pressed={selected}
      data-skill-id={d.skillId}
    >
      {/* Edge anchor points — invisible, non-interactive (CSS hides them).
          IDs are explicit: a node carries two handles, so React Flow needs the
          sourceHandle/targetHandle pair on each edge to resolve the endpoints. */}
      <Handle id="in" type="target" position={Position.Bottom} isConnectable={false} />
      <Handle id="out" type="source" position={Position.Top} isConnectable={false} />

      <div className="skn-collar" aria-hidden="true" />
      <div className="skn-frame" aria-hidden="true" />
      {variant === "keystone" && (
        <>
          <span className="skn-seg skn-seg-a" aria-hidden="true" />
          <span className="skn-seg skn-seg-b" aria-hidden="true" />
          <span className="skn-seg skn-seg-c" aria-hidden="true" />
        </>
      )}
      <div className="skn-ring" aria-hidden="true" />
      <div className="skn-well" aria-hidden="true">
        <span className="skn-icon">{icon}</span>
      </div>

      {(state === "locked" || state === "blocked-by-choice") && (
        <span className="skn-lock" aria-hidden="true">
          {state === "blocked-by-choice" ? "✕" : "🔒"}
        </span>
      )}

      <div className="skn-rank" aria-hidden="true">
        {usePips ? (
          Array.from({ length: maxRank }, (_, i) => (
            <span key={i} className={`skn-pip ${i < rank ? "skn-pip--on" : ""}`} />
          ))
        ) : (
          <span className="skn-rank-num">{rank}/{maxRank}</span>
        )}
      </div>
    </div>
  );
}

export const SkillTreeNode = memo(SkillTreeNodeImpl);
