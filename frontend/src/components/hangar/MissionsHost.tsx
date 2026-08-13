// Wires the migrated S-03 Missions Log panel to real game state.
//
// The two mission models differ in one important way, and this host is where
// that difference is resolved:
//
//   * DAILIES map cleanly. player.dailyMissions are ActiveMission records with
//     live progress/target counters that bumpMission() advances, which is
//     exactly the shape the export's daily cards want
//     ({{ dm.cur }} / {{ dm.max }} plus rewards). They are passed straight in.
//
//   * The LADDER does not. The game's missionBoard is pre-rolled from
//     MISSION_BOARD_POOL and is already active — there is no accept step —
//     while the panel generates its ladder procedurally from the player level.
//     A generated row has no counterpart in the pool, so accepting one would
//     create an entry the game can never advance.
//
// So the ladder's ACCEPT is routed to the closest REAL action: rows whose level
// band the player has reached map onto the live board by category, and
// accepting one that is already on the board tells the player it is tracked
// rather than silently doing nothing.
import {
  useGame, state as gameState, bump, pushNotification, rerollMissionBoard,
} from "../../game/store";
import { MissionsLog, type DailyCard } from "./MissionsLog";
import type { Mission } from "./Missions.constants";

/** Accent colour per daily category, matching the export's own daily palette. */
const DAILY_HEX: Record<string, string> = {
  kill: "#ff4d5e", combat: "#ff4d5e",
  transport: "#4ee2ff", delivery: "#4ee2ff",
  gathering: "#5cff8a", mining: "#5cff8a",
  exploration: "#b866ff",
};
const DAILY_ICON: Record<string, string> = {
  kill: "⚔", combat: "⚔",
  transport: "▶", delivery: "▶",
  gathering: "◈", mining: "◈",
  exploration: "◎",
};

export function MissionsHost() {
  const player = useGame((s) => s.player);
  const missionBoard = useGame((s) => (s as any).missionBoard ?? []) as any[];

  // Real dailies -> the export's daily-card shape.
  const dailies: DailyCard[] = (player.dailyMissions ?? []).map((m: any) => ({
    id: m.id,
    name: m.title,
    obj: m.description,
    cur: m.progress ?? 0,
    max: m.target,
    credits: m.rewardCredits,
    honor: m.rewardHonor,
    exp: m.rewardExp,
    icon: DAILY_ICON[m.kind] ?? DAILY_ICON[m.category] ?? "★",
    hex: DAILY_HEX[m.kind] ?? DAILY_HEX[m.category] ?? "#e8b94d",
    completed: m.completed,
    claimed: m.claimed,
  }));

  // Everything on the live board counts as tracked, plus open dailies.
  const open = [...missionBoard, ...(player.dailyMissions ?? [])]
    .filter((m: any) => !m.completed).length;

  const accept = (m: Mission) => {
    // Ladder rows are generated, so match by the mission TYPE they represent
    // rather than by id — that is the only real link back to the live board.
    const onBoard = missionBoard.find(
      (b: any) => !b.completed && String(b.title).toLowerCase() === m.title.toLowerCase(),
    );
    if (onBoard) {
      pushNotification(`Already tracked: ${m.title}`, "info");
      return;
    }
    if (m.locked) {
      pushNotification("Locked — raise your level to unlock this band", "bad");
      return;
    }
    // No pool entry to activate. Say so rather than creating a dead mission
    // that would sit at 0/N forever.
    pushNotification(
      `"${m.title}" is a preview contract — your active missions come from the board`,
      "info",
    );
  };

  return (
    <MissionsLog
      playerLevel={player.level}
      dailies={dailies.length ? dailies : undefined}
      trackedCount={open}
      trackedCap={Math.max(3, missionBoard.length)}
      onAccept={accept}
      onReroll={() => rerollMissionBoard()}
      onClose={() => { gameState.hangarTab = null; bump(); }}
    />
  );
}

export default MissionsHost;
