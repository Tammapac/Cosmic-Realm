// Layered depth backdrop behind the tree (brief §5). Pure CSS layers — no
// canvas, no per-frame JS — so it costs nothing while the game runs behind it.
import { memo } from "react";

function SkillTreeBackgroundImpl({ accent }: { accent: string }) {
  return (
    <div className="skt-bg" aria-hidden="true" style={{ ["--tree-accent" as string]: accent }}>
      <div className="skt-bg-plate" />
      <div className="skt-bg-grid" />
      <div className="skt-bg-holo" />
      <div className="skt-bg-haze" />
      <div className="skt-bg-scan" />
      <div className="skt-bg-vignette" />
    </div>
  );
}

export const SkillTreeBackground = memo(SkillTreeBackgroundImpl);
