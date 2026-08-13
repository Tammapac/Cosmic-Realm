// Category rail, styled as a stack of angled command bays rather than a plain
// list. Each bay carries a ring gauge (invested / investable), a glyph housing,
// and a spine that lights up when the bay is live. The active bay slides out of
// the rail and grows a connector toward the canvas, so the eye reads
// "this bay feeds the tree on the right".
import { memo } from "react";
import type { SkillBranch } from "../../../game/types";
import { BRANCH_META, BRANCH_ORDER } from "../layouts/branch-meta";

export interface BranchProgress {
  spent: number;
  total: number;
}

interface Props {
  active: SkillBranch;
  progress: Record<SkillBranch, BranchProgress>;
  onChange: (b: SkillBranch) => void;
}

/** Circumference of the r=15 gauge ring. */
const RING_C = 2 * Math.PI * 15;

function SkillTreeTabsImpl({ active, progress, onChange }: Props) {
  return (
    <nav className="skt-tabs" role="tablist" aria-label="Skill categories">
      <div className="skt-tabs-spine" aria-hidden="true" />
      {BRANCH_ORDER.map((id, i) => {
        const meta = BRANCH_META[id];
        const p = progress[id] ?? { spent: 0, total: 0 };
        const pct = p.total > 0 ? Math.min(1, p.spent / p.total) : 0;
        const on = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={`${meta.title}, ${p.spent} of ${p.total} points invested`}
            className={`skt-bay ${on ? "skt-bay--on" : ""}`}
            style={{
              ["--tab-accent" as string]: meta.accent,
              ["--bay-i" as string]: String(i),
            }}
            onClick={() => onChange(id)}
          >
            {/* index tick — a machined bay number down the rail */}
            <span className="skt-bay-idx" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>

            {/* ring gauge + glyph housing */}
            <span className="skt-bay-gauge" aria-hidden="true">
              <svg viewBox="0 0 36 36" className="skt-bay-ring">
                <circle className="skt-bay-ring-bg" cx="18" cy="18" r="15" />
                <circle
                  className="skt-bay-ring-fg"
                  cx="18" cy="18" r="15"
                  strokeDasharray={`${pct * RING_C} ${RING_C}`}
                />
              </svg>
              <span className="skt-bay-glyph">{meta.glyph}</span>
            </span>

            <span className="skt-bay-text">
              <span className="skt-bay-name">{meta.title}</span>
              <span className="skt-bay-meta">
                <b>{p.spent}</b>
                <span className="skt-bay-slash">/</span>
                {p.total}
              </span>
            </span>

            {/* connector that reaches toward the canvas on the active bay */}
            <span className="skt-bay-link" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}

export const SkillTreeTabs = memo(SkillTreeTabsImpl);
