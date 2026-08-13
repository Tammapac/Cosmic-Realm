// Wires the migrated S-02 Bounty Board panel to real game state.
//
// The contracts are THIS PROJECT's QUEST_POOL, not the export's BOUNTIES demo
// array, and ACCEPT pushes into player.activeQuests using the exact rules the
// existing BountiesTab uses (5-quest cap, no duplicates, same notification) so
// the two paths cannot drift.
import { useGame, state as gameState, bump, save, pushNotification } from "../../game/store";
import { QUEST_POOL, ZONES, type Quest } from "../../game/types";
import { BountyBoard } from "./BountyBoard";
import { DANGER_LABELS, type BountyContract } from "./Bounty.constants";
import type { RarityKey } from "./rarity";

/** Quest tier (1-5) -> the panel's rarity band. */
const TIER_RARITY: RarityKey[] = ["common", "uncommon", "rare", "epic", "legendary"];

/** Map a real Quest onto the export's card shape. */
function toContract(q: Quest): BountyContract {
  const tier = Math.max(1, Math.min(5, q.tier ?? 1));
  const zone = ZONES[q.targetZone ?? q.zone];
  // EnemyType is a plain string union — there is no name catalog. The existing
  // BountiesTab renders it raw ("5× scout"), so this capitalises it and does
  // nothing more.
  const enemyName = q.killType.charAt(0).toUpperCase() + q.killType.slice(1);
  return {
    tier: TIER_RARITY[tier - 1],
    kind: "npc",
    name: q.title,
    // The export's subtitle is the squad composition, e.g. "4x Scout".
    subtitle: `${q.killCount}x ${enemyName}`,
    sector: zone?.label ?? "—",
    zone: zone?.name ?? String(q.targetZone ?? q.zone),
    credits: q.rewardCredits,
    honor: q.rewardHonor,
    danger: Math.max(1, Math.min(DANGER_LABELS.length, tier)),
    level: null,
    ship: null,
  };
}

export function BountyHost() {
  const player = useGame((s) => s.player);

  const contracts = QUEST_POOL.map(toContract);

  // Accept — the BountiesTab rules verbatim. Index maps back to QUEST_POOL
  // because `contracts` is built from it 1:1 and in order.
  const accept = (_c: BountyContract, index: number) => {
    const q = QUEST_POOL[index];
    if (!q) return;
    if (player.activeQuests.find((x: any) => x.id === q.id)) {
      pushNotification("Contract already accepted", "info");
      return;
    }
    if (player.activeQuests.length >= 5) {
      pushNotification("Quest log full (5 max)", "bad");
      return;
    }
    player.activeQuests.push({ ...q, progress: 0, completed: false } as any);
    pushNotification(`Accepted: ${q.title}`, "good");
    save(); bump();
  };

  return (
    <BountyBoard
      contracts={contracts}
      // Five danger bands over the level range, so the board opens up as the
      // player progresses instead of showing everything at level 1.
      unlockedTier={Math.max(1, Math.min(5, Math.ceil(player.level / 6)))}
      activeCount={player.activeQuests.length}
      activeCap={5}
      // Real accepted contracts, so the state survives a tab switch.
      acceptedNames={player.activeQuests.map((q: any) => q.title)}
      onAccept={accept}
      onClose={() => { gameState.hangarTab = null; bump(); }}
    />
  );
}

export default BountyHost;
