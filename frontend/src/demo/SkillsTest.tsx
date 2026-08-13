// Isolated skill-tree harness — open with ?skills-test.
//
// Renders the redesigned tree against the REAL store (same buySkillRank path),
// with dev controls to grant points / clear ranks so every node state can be
// inspected without a login or a levelled character.
import { useEffect } from "react";
import { state, bump, useGame } from "../game/store";
import { SkillTreeWindow } from "../features/skills/components/SkillTreeWindow";
import "../styles/hud/hud-skin.css";

export default function SkillsTest() {
  const player = useGame((s) => s.player);

  useEffect(() => {
    state.showSkillTree = true;
    if ((state.player.skillPoints ?? 0) < 20) state.player.skillPoints = 40;
    bump();
  }, []);

  const grant = () => { state.player.skillPoints = (state.player.skillPoints ?? 0) + 20; bump(); };
  const clear = () => {
    const kept: Record<string, number> = {};
    for (const [k, v] of Object.entries(state.player.skills ?? {})) {
      if (k.startsWith("attr-") && typeof v === "number") kept[k] = v;
    }
    state.player.skills = kept as never;
    state.player.skillPoints = 40;
    bump();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#02040c" }}>
      <SkillTreeWindow />
      <div
        style={{
          position: "fixed", left: 12, bottom: 12, zIndex: 200,
          display: "flex", gap: 8, alignItems: "center",
          padding: "8px 12px", background: "rgba(6,10,20,0.9)",
          border: "1px solid rgba(90,130,180,0.35)", fontSize: 12, color: "#9fb0c8",
        }}
      >
        <span>SP: <b style={{ color: "#e8b94d" }}>{player.skillPoints ?? 0}</b></span>
        <button className="gbtn" onClick={grant}>+20 SP</button>
        <button className="gbtn" onClick={clear}>Clear ranks</button>
      </div>
    </div>
  );
}
