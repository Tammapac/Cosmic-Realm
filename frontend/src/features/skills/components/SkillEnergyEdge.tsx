// Custom React-Flow edge drawn as a powered conduit.
//
// Light model: the channel is a machined trench cut into the plate; when the
// link carries charge, light comes from INSIDE it. That means a wide blurred
// bloom pass under a thin bright core, not a coloured stroke with a CSS shadow —
// the blur is what makes it read as emitted rather than painted.
//
// Geometry: a rounded orthogonal elbow (vertical → arc → horizontal → arc →
// vertical), so the tree reads as wiring on a panel. Nodes anchor bottom→top, so
// paths leave the child downward and enter the parent upward, never crossing a
// node body.
import { memo } from "react";
import { type EdgeProps } from "@xyflow/react";
import type { SkillEdgeData } from "../types/skill-tree.types";

/** Build a rounded orthogonal path from (sx,sy) up to (tx,ty). */
function conduitPath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const r = Math.min(18, Math.abs(dx) / 2, Math.abs(ty - sy) / 2.2);

  if (Math.abs(dx) < 6) return `M ${sx},${sy} L ${tx},${ty}`;

  const my = sy + (ty - sy) * 0.48;
  const dir = Math.sign(dx);

  return [
    `M ${sx},${sy}`,
    `L ${sx},${my + r}`,
    `Q ${sx},${my} ${sx + dir * r},${my}`,
    `L ${tx - dir * r},${my}`,
    `Q ${tx},${my} ${tx},${my - r}`,
    `L ${tx},${ty}`,
  ].join(" ");
}

function SkillEnergyEdgeImpl({
  id, sourceX, sourceY, targetX, targetY, data,
}: EdgeProps) {
  const d = (data ?? {}) as unknown as SkillEdgeData;
  const state = d.state ?? "locked";
  const accent = d.accent ?? "#4ee2ff";

  const path = conduitPath(sourceX, sourceY, targetX, targetY);
  const powered = state === "active" || state === "maxed-branch";
  const charged = powered || state === "available";

  const jx = targetX;
  const jy = sourceY + (targetY - sourceY) * 0.48;

  return (
    <g
      className={`ske ske--${state}`}
      style={{ ["--ske-accent" as string]: accent }}
    >
      {/* recessed trench + machined casing — present in every state, this is
          the physical channel the light later fills */}
      <path className="skt-edge-trench" d={path} />
      <path className="skt-edge-casing" d={path} />

      {/* BLOOM: a wide, heavily blurred copy of the path. This is the layer that
          makes the conduit look lit from within rather than outlined. Only drawn
          when the link carries charge, so unpowered wiring stays dead metal. */}
      {charged && (
        <path
          className="skt-edge-bloom"
          d={path}
          filter={`url(#ske-bloom-${state === "maxed-branch" ? "gold" : "accent"})`}
        />
      )}

      {/* the bright filament itself */}
      <path className="skt-edge-core" d={path} id={`${id}-core`} />

      {/* specular sheen — a hairline highlight riding the top of the casing so
          the channel reads as a rounded metal groove, not a flat line */}
      <path className="skt-edge-sheen" d={path} />

      {state !== "locked" && (
        <>
          <circle className="skt-edge-junction-glow" cx={jx} cy={jy} r={7} />
          <circle className="skt-edge-junction" cx={jx} cy={jy} r={3.5} />
        </>
      )}

      {state === "blocked" && (
        <line
          className="skt-edge-sever"
          x1={jx - 7} y1={jy - 7} x2={jx + 7} y2={jy + 7}
        />
      )}

      {/* Travelling charge. Two dashes at different speeds/lengths so the flow
          reads as current rather than a single marching dot. SMIL keeps it on
          the compositor — no React state per frame. */}
      {powered && (
        <>
          <path
            className="skt-edge-pulse"
            d={path}
            strokeDasharray="18 300"
            pathLength={318}
          >
            <animate attributeName="stroke-dashoffset" from={318} to={0}
                     dur="2.4s" repeatCount="indefinite" />
          </path>
          <path
            className="skt-edge-pulse skt-edge-pulse--trail"
            d={path}
            strokeDasharray="44 274"
            pathLength={318}
          >
            <animate attributeName="stroke-dashoffset" from={318} to={0}
                     dur="2.4s" repeatCount="indefinite" />
          </path>
        </>
      )}
    </g>
  );
}

export const SkillEnergyEdge = memo(SkillEnergyEdgeImpl);
