// Recessed technical console showing the selected skill: identity, rank,
// current vs next-rank values, cost, prerequisites, and the learn action.
import { memo, useMemo } from "react";
import { SKILL_NODES, type SkillId } from "../../../game/types";
import type { SkillNodeVariant } from "../types/skill-tree.types";
import { canBuy, prereqMet, rankOf, type PlayerSkillView } from "../utils/calculateSkillState";

const NODE_BY_ID = new Map(SKILL_NODES.map((n) => [n.id, n]));

/**
 * Scale the "+N per rank" phrasing in a description to a concrete total.
 * Mirrors the existing Hangar rankBonus() so numbers read identically to the
 * current UI — this is presentation only, never a gameplay calculation.
 */
function scaledBonus(desc: string, rank: number): string | null {
  if (rank <= 0) return null;
  const m = desc.match(/^([+-])(\d+(?:\.\d+)?)(%?)\s*(.*)/);
  if (!m) return null;
  const v = parseFloat(m[2]) * rank;
  const vs = Number.isInteger(v) ? String(v) : v.toFixed(2);
  const rest = m[4].replace(/\s*per rank\.?/i, "").replace(/\.$/, "");
  return `${m[1]}${vs}${m[3]} ${rest}`;
}

const VARIANT_LABEL: Record<SkillNodeVariant, string> = {
  minor: "Support Module",
  standard: "Standard Module",
  major: "Major Module",
  keystone: "Keystone",
  ultimate: "Mastery Core",
};

interface Props {
  skillId: SkillId | null;
  player: PlayerSkillView;
  accent: string;
  variant?: SkillNodeVariant;
  busy?: boolean;
  onLearn: (id: SkillId) => void;
}

function SkillDetailPanelImpl({ skillId, player, accent, variant, busy, onLearn }: Props) {
  const def = skillId ? NODE_BY_ID.get(skillId) : undefined;

  const view = useMemo(() => {
    if (!def) return null;
    const rank = rankOf(player, def.id);
    const maxed = rank >= def.maxRank;
    return {
      rank,
      maxed,
      current: scaledBonus(def.description, rank),
      next: maxed ? null : scaledBonus(def.description, rank + 1),
      step: maxed ? null : scaledBonus(def.description, 1),
      buyable: canBuy(player, def.id),
      gated: !prereqMet(player, def.id),
      affordable: player.skillPoints >= def.cost,
    };
  }, [def, player]);

  if (!def || !view) {
    return (
      <aside className="skd skd--empty" aria-live="polite">
        <div className="skd-empty-inner">
          <span className="skd-empty-glyph">◈</span>
          <p>Select a module to inspect its specification.</p>
        </div>
      </aside>
    );
  }

  const reqDef = def.requires ? NODE_BY_ID.get(def.requires) : undefined;

  return (
    <aside className="skd" style={{ ["--skd-accent" as string]: accent }} aria-live="polite">
      <header className="skd-head">
        <div className="skd-icon" aria-hidden="true">{def.icon}</div>
        <div className="skd-head-text">
          <h3 className="skd-name">{def.name}</h3>
          <div className="skd-kind">
            {variant ? VARIANT_LABEL[variant] : "Module"}
            <span className="skd-dot">·</span>
            Passive
          </div>
        </div>
      </header>

      <div className="skd-rankrow">
        <span className="skd-rank-lbl">Rank</span>
        <span className="skd-rank-val">{view.rank}<span className="skd-rank-max"> / {def.maxRank}</span></span>
        <div className="skd-rank-pips" aria-hidden="true">
          {Array.from({ length: def.maxRank }, (_, i) => (
            <span key={i} className={`skd-pip ${i < view.rank ? "skd-pip--on" : ""}`} />
          ))}
        </div>
      </div>

      <p className="skd-desc">{def.description}</p>

      <div className="skd-values">
        <div className="skd-val">
          <span className="skd-val-lbl">Current</span>
          <span className="skd-val-num">{view.current ?? "—"}</span>
        </div>
        <div className="skd-val-arrow" aria-hidden="true">▸</div>
        <div className="skd-val">
          <span className="skd-val-lbl">Next rank</span>
          <span className="skd-val-num skd-val-num--next">
            {view.maxed ? "Mastered" : (view.next ?? "—")}
          </span>
        </div>
      </div>

      {!view.maxed && view.step && (
        <div className="skd-gain">
          <span className="skd-gain-lbl">Improvement</span>
          <span className="skd-gain-val">{view.step}</span>
        </div>
      )}

      {reqDef && (
        <div className={`skd-req ${view.gated ? "skd-req--unmet" : "skd-req--met"}`}>
          <span className="skd-req-lbl">Requires</span>
          <span className="skd-req-val">
            {reqDef.name}{view.gated ? " — not yet learned" : " ✓"}
          </span>
        </div>
      )}

      <footer className="skd-foot">
        <div className="skd-cost">
          <span className="skd-cost-lbl">Cost</span>
          <span className={`skd-cost-val ${!view.affordable && !view.maxed ? "skd-cost-val--short" : ""}`}>
            {def.cost} SP
          </span>
        </div>
        <button
          type="button"
          className="skd-learn"
          disabled={!view.buyable || !!busy}
          onClick={() => onLearn(def.id)}
        >
          {view.maxed ? "Mastered"
            : view.gated ? "Locked"
            : !view.affordable ? "Not enough points"
            : busy ? "…"
            : view.rank > 0 ? "Upgrade" : "Learn"}
        </button>
      </footer>
    </aside>
  );
}

export const SkillDetailPanel = memo(SkillDetailPanelImpl);
