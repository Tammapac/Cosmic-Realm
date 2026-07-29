// Shared SVG filter definitions for the tree's light model.
//
// One <svg> holding every filter, mounted once per canvas — edges and nodes
// reference these by id instead of each declaring their own, so the browser
// builds each blur kernel a single time no matter how many conduits are lit.
import { memo } from "react";

function SkillTreeDefsImpl() {
  return (
    <svg
      className="skt-defs"
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
    >
      <defs>
        {/* Conduit bloom — a wide gaussian spread. The source graphic is the
            blurred copy itself (drawn under the core), so this is pure light
            spill with no hard edge of its own. */}
        <filter id="ske-bloom-accent" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4.5" result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b2" />
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="b1" />
          </feMerge>
        </filter>

        {/* Mastered branches bloom a touch tighter and hotter. */}
        <filter id="ske-bloom-gold" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b2" />
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="b1" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

export const SkillTreeDefs = memo(SkillTreeDefsImpl);
