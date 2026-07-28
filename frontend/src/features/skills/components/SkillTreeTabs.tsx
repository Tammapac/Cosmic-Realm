// Category rail. Each entry is its own tree, with a live investment readout and
// an energy bar that charges as the branch is filled.
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

function SkillTreeTabsImpl({ active, progress, onChange }: Props) {
  return (
    <nav className="skt-tabs" role="tablist" aria-label="Skill categories">
      {BRANCH_ORDER.map((id) => {
        const meta = BRANCH_META[id];
        const p = progress[id] ?? { spent: 0, total: 0 };
        const pct = p.total > 0 ? Math.round((p.spent / p.total) * 100) : 0;
        const on = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            className={`skt-tab ${on ? "skt-tab--on" : ""}`}
            style={{ ["--tab-accent" as string]: meta.accent }}
            onClick={() => onChange(id)}
          >
            <span className="skt-tab-glyph" aria-hidden="true">{meta.glyph}</span>
            <span className="skt-tab-body">
              <span className="skt-tab-name">{meta.title}</span>
              <span className="skt-tab-meta">{p.spent} / {p.total} pts</span>
              <span className="skt-tab-bar" aria-hidden="true">
                <span className="skt-tab-bar-fill" style={{ width: `${pct}%` }} />
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export const SkillTreeTabs = memo(SkillTreeTabsImpl);
