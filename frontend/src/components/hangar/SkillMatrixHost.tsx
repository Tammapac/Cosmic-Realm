// Mounts the migrated I-03 Skill Matrix.
//
// DELIBERATELY NOT WIRED TO THE GAME'S SKILL SYSTEM — the user's call, after
// the two models were compared:
//
//   export : 60 nodes, 3 trees (OFFENSIVE/DEFENCE/UTILITY), coordinate layout
//            with beam links, own node names ("Focused Barrel", "Nexus
//            Protocol"), 136 total ranks
//   game   : 92 nodes, 4 branches (offense/defense/utility/ENGINEERING), grid
//            layout with `requires` chains, own names ("Overcharge", "Sniper
//            Focus"), 308 total ranks
//
// There is no node-for-node correspondence, so filling the export's tree with
// real skills would mean re-laying-out every node and dropping the entire
// engineering branch. The decision was to keep the panel visually 1:1 with the
// export and leave it non-functional for now.
//
// What IS real: the player's skill-point balance and the docked state, because
// both exist in the export's own header (`{{ skPoints }} PTS`, DOCKED / IN
// FLIGHT) and map exactly. Investing and respeccing intentionally do nothing
// but tell the player so — they must NOT call buySkillRank()/resetSkills(),
// which operate on a different node set and would spend real points on ids this
// panel does not show.
import { useGame, state as gameState, bump, pushNotification } from "../../game/store";
import { SkillMatrix } from "./SkillMatrix";

export function SkillMatrixHost() {
  const player = useGame((s) => s.player);
  const dockedAt = useGame((s) => s.dockedAt);

  const preview = () =>
    pushNotification(
      "Skill Matrix is a design preview — use the existing Skills tab to spend points",
      "info",
    );

  return (
    <SkillMatrix
      // The PTS readout is real: total - spent, where `total` is the player's
      // own point budget. The TREE stays the export's (its 60 nodes and their
      // start ranks), so `spent` deliberately keeps the panel's own default —
      // mixing a real spend count into an unrelated tree would show a number
      // that matches neither system.
      total={player.skillPoints}
      docked={!!dockedAt}
      onInvest={preview}
      onRespec={preview}
      onClose={() => { gameState.hangarTab = null; bump(); }}
    />
  );
}

export default SkillMatrixHost;
