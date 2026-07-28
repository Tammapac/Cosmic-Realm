// Top-level skill window. Owns tab + selection state and wires the existing,
// unchanged store mutations (buySkillRank / resetSkills). It deliberately adds
// NO new gameplay logic: purchase rules stay where they already live.
import { useCallback, useMemo, useState } from "react";
import { useGame, state, buySkillRank, resetSkills } from "../../../game/store";
import { SKILL_NODES, type SkillBranch, type SkillId } from "../../../game/types";
import { BRANCH_META, BRANCH_ORDER } from "../layouts/branch-meta";
import { SKILL_TREE_LAYOUTS } from "../layouts";
import { SkillTreeTabs, type BranchProgress } from "./SkillTreeTabs";
import { SkillTreeCanvas } from "./SkillTreeCanvas";
import { SkillDetailPanel } from "./SkillDetailPanel";
import type { PlayerSkillView } from "../utils/calculateSkillState";

import "../styles/skill-tree.css";
import "../styles/skill-node.css";
import "../styles/skill-edge.css";

/** Max investable points per branch = Σ(maxRank × cost). */
const BRANCH_TOTALS: Record<SkillBranch, number> = SKILL_NODES.reduce((acc, n) => {
  acc[n.branch] = (acc[n.branch] ?? 0) + n.maxRank * n.cost;
  return acc;
}, {} as Record<SkillBranch, number>);

/**
 * Visibility gate — mirrors the old SkillTreePanel's contract so App.tsx can
 * render it unconditionally. Hooks live in the inner component, so mounting /
 * unmounting never changes a hook count.
 */
export function SkillTreeWindowGate() {
  const show = useGame((s) => s.showSkillTree);
  if (!show) return null;
  return <SkillTreeWindow />;
}

export function SkillTreeWindow() {
  const player = useGame((s) => s.player);
  const [branch, setBranch] = useState<SkillBranch>("offense");
  const [selected, setSelected] = useState<SkillId | null>(null);

  const view: PlayerSkillView = useMemo(
    () => ({ skills: player.skills ?? {}, skillPoints: player.skillPoints ?? 0 }),
    [player.skills, player.skillPoints],
  );

  const progress = useMemo(() => {
    const out = {} as Record<SkillBranch, BranchProgress>;
    for (const b of BRANCH_ORDER) out[b] = { spent: 0, total: BRANCH_TOTALS[b] ?? 0 };
    for (const n of SKILL_NODES) {
      const r = view.skills[n.id] ?? 0;
      if (r > 0) out[n.branch].spent += r * n.cost;
    }
    return out;
  }, [view.skills]);

  const layout = SKILL_TREE_LAYOUTS[branch];
  const meta = BRANCH_META[branch];

  const selectedVariant = useMemo(
    () => layout.nodes.find((n) => n.skillId === selected)?.nodeVariant,
    [layout, selected],
  );

  const close = useCallback(() => { state.showSkillTree = false; }, []);

  const handleBranch = useCallback((b: SkillBranch) => {
    setBranch(b);
    setSelected(null); // reset selection; the new tree frames from its root
  }, []);

  const handleLearn = useCallback((id: SkillId) => {
    // buySkillRank owns ALL validation + persistence; we only reflect the result.
    buySkillRank(id);
  }, []);

  return (
    <div className="skt-root" role="dialog" aria-modal="true" aria-label="Skill tree">
      {/* .panel + .hud-titleband are the game's canonical window chrome (cut
          corners, frosted glass body, titanium bevel) — the skill window uses
          them like every other HUD window instead of inventing its own frame. */}
      <div className="skt-window panel panel-framed">
        <div className="scanline" />
        <header className="skt-title hud-titleband">
          <div>
            <div className="skt-title-name">Neural Augmentation</div>
            <div className="skt-title-sub">{meta.title} matrix</div>
          </div>
          <div className="skt-title-actions">
            <div className={`skt-points ${view.skillPoints <= 0 ? "skt-points--empty" : ""}`}>
              <span className="skt-points-val">{view.skillPoints}</span>
              <span className="skt-points-lbl">Skill points</span>
            </div>
            <button type="button" className="gbtn" onClick={() => resetSkills()}>
              Respec · 2000cr
            </button>
            <button type="button" className="gbtn gbtn-red" onClick={close}>✕</button>
          </div>
        </header>

        <div className="skt-body">
          <SkillTreeTabs active={branch} progress={progress} onChange={handleBranch} />
          <div className="skt-main">
            <SkillTreeCanvas
              key={branch}                 /* remount per tab → clean fit + no stale viewport */
              layout={layout}
              player={view}
              accent={meta.accent}
              selectedId={selected}
              onSelect={setSelected}
            />
            <SkillDetailPanel
              skillId={selected}
              player={view}
              accent={meta.accent}
              variant={selectedVariant}
              onLearn={handleLearn}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
