// inventoryData.ts — echte Store-Items für export/windows/I-05-inventory.ts.
// Baut die Kit-eigene Entry-Tupelform aus state.player.inventory; das Kit
// nimmt einen reinen spriteKey (hängt selbst "/assets/ui/items/" + ".png" an).
import { state, bump } from "../../../store";
import { MODULE_DEFS, type ModuleSlot } from "../../../types";
import { sendInventoryBuyPage } from "../../../../net/socket";

type Entry = [string, string, string, string, string, number, number, boolean, string, string, [string, string][]];

const KIND_BY_SLOT: Record<ModuleSlot, string> = {
  weapon: "weapon",
  generator: "shield",
  module: "module",
};

const SLOT_LABEL: Record<ModuleSlot, string> = {
  weapon: "WEAPON",
  generator: "GENERATOR",
  module: "MODULE",
};

function isEquipped(instanceId: string): boolean {
  const eq = state.player.equipped;
  for (const slot of Object.keys(eq) as ModuleSlot[]) {
    if ((eq[slot] ?? []).includes(instanceId)) return true;
  }
  const pet = state.player.petDrone?.equipped as Record<string, string | null> | undefined;
  if (pet && Object.values(pet).includes(instanceId)) return true;
  return false;
}

export function buildInventoryOpts(): {
  items: Entry[]; extraPageUnlocked: boolean; extraPageCost: number;
  onBuyExtraPage: () => Promise<{ ok: boolean; error?: string; unlocked?: boolean }>;
} {
  const items: Entry[] = state.player.inventory
    .map((it): Entry | null => {
      const def = MODULE_DEFS[it.defId];
      if (!def) return null;
      const rarity = (it as any).rarity ?? def.rarity ?? "common";
      const ilvl = (it as any).ilvl ?? def.tier ?? 1;
      const stats: [string, string][] = Object.entries(def.stats ?? {})
        .filter(([, v]) => typeof v === "number" && v !== 0)
        .slice(0, 3)
        .map(([k, v]) => [k.toUpperCase(), String(v)]);
      return [
        it.instanceId, def.name, KIND_BY_SLOT[def.slot], rarity,
        def.spriteKey ?? "", 1, ilvl, isEquipped(it.instanceId), SLOT_LABEL[def.slot],
        def.description ?? "", stats,
      ];
    })
    .filter((e): e is Entry => e !== null);
  return {
    items,
    extraPageUnlocked: !!state.player.inventoryExtraPage,
    extraPageCost: 750,
    onBuyExtraPage: async () => {
      const res = await sendInventoryBuyPage();
      if (res.ok && res.unlocked) {
        state.player.inventoryExtraPage = true;
        if (typeof res.mcoins === "number") state.player.mcoins = res.mcoins;
        bump();
      }
      return res;
    },
  };
}
