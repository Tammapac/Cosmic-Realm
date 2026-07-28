// Custom React-Flow edge drawn as a multi-layer technical conduit.
//
// Geometry: an orthogonal "elbow" route (vertical → rounded corner → horizontal
// → rounded corner → vertical) rather than a straight diagonal, so the tree
// reads as wiring on a machined panel. Corners are quadratic arcs so nothing is
// a hard 90° pixel step. Nodes are anchored bottom→top, so paths leave the child
// downward and enter the parent upward — they never cut through a node body.
import { memo } from "react";
import { type EdgeProps } from "@xyflow/react";
import type { SkillEdgeData } from "../types/skill-tree.types";

/** Build a rounded orthogonal path from (sx,sy) up to (tx,ty). */
function conduitPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const r = Math.min(18, Math.abs(dx) / 2, Math.abs(ty - sy) / 2.2);

  // Straight run when the two nodes are (near) vertically aligned.
  if (Math.abs(dx) < 6) return `M ${sx},${sy} L ${tx},${ty}`;

  // Mid-height where the horizontal jog happens.
  const my = sy + (ty - sy) * 0.48;
  const dir = Math.sign(dx);

  return [
    `M ${sx},${sy}`,
    `L ${sx},${my + r}`,                              // rise to the jog
    `Q ${sx},${my} ${sx + dir * r},${my}`,            // corner into the jog
    `L ${tx - dir * r},${my}`,                        // horizontal run
    `Q ${tx},${my} ${tx},${my - r}`,                  // corner out of the jog
    `L ${tx},${ty}`,                                  // rise into the parent
  ].join(" ");
}

function SkillEnergyEdgeImpl({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps) {
  const d = (data ?? {}) as unknown as SkillEdgeData;
  const state = d.state ?? "locked";
  const accent = d.accent ?? "#4ee2ff";

  const path = conduitPath(sourceX, sourceY, targetX, targetY);
  const animated = state === "active" || state === "maxed-branch";

  // Junction dot sits where the conduit turns — a small technical distributor.
  const jx = targetX;
  const jy = sourceY + (targetY - sourceY) * 0.48;

  return (
    <g
      className={`ske ske--${state}`}
      style={{ ["--ske-accent" as string]: accent }}
    >
      <path className="skt-edge-trench" d={path} />
      <path className="skt-edge-casing" d={path} />
      <path className="skt-edge-core" d={path} id={`${id}-core`} />

      {state !== "locked" && (
        <circle className="skt-edge-junction" cx={jx} cy={jy} r={3.5} />
      )}

      {state === "blocked" && (
        <line
          className="skt-edge-sever"
          x1={jx - 7} y1={jy - 7} x2={jx + 7} y2={jy + 7}
        />
      )}

      {/* Travelling impulse — a short dash animated along the conduit. Uses SMIL
          so it costs no React state per frame (the brief forbids per-frame
          re-renders); the browser drives it on the compositor. */}
      {animated && (
        <path
          className="skt-edge-pulse"
          d={path}
          strokeDasharray="14 260"
          pathLength={274}
        >
          <animate
            attributeName="stroke-dashoffset"
            from={274}
            to={0}
            dur="2.6s"
            repeatCount="indefinite"
          />
        </path>
      )}
    </g>
  );
}

export const SkillEnergyEdge = memo(SkillEnergyEdgeImpl);
