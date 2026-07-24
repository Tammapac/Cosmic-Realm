// ── Shared display helpers for rolled ARPG loot ────────────────────────────
// Used by InventoryPanel, Hangar and anywhere else that renders ItemInstances.
import { MODULE_DEFS, type ModuleDef, type ModuleItem } from "./types";
import {
  LEGENDARIES, RARITIES, affixLine, itemDisplayName, rarityColor, sellValue,
} from "../../../lib/loot/loot";
import { fmtStat } from "./fmt";

/** True if this item carries server-rolled loot data (vs a plain shop item). */
export function isRolledItem(it: ModuleItem | null | undefined): boolean {
  return !!it && (it.rarity !== undefined || it.affixes !== undefined || it.legendaryId !== undefined || it.ilvl !== undefined);
}

/** Display name: legendary name > affix prefix/suffix name > base def name. */
export function lootItemName(it: ModuleItem, def?: ModuleDef): string {
  const d = def ?? MODULE_DEFS[it.defId];
  return itemDisplayName(it as any, d?.name ?? it.defId);
}

/** Rarity color for a rolled item, falling back to the def's own color. */
export function lootItemColor(it: ModuleItem, def?: ModuleDef): string {
  const d = def ?? MODULE_DEFS[it.defId];
  return rarityColor(it.rarity as any, d?.color ?? "#8aa0c0");
}

/** Sell price: rolled items use the loot formula, clean items the flat 40%. */
export function lootSellPrice(it: ModuleItem, def?: ModuleDef): number {
  const d = def ?? MODULE_DEFS[it.defId];
  if (!d) return 0;
  return isRolledItem(it) ? sellValue(it as any, d.price) : Math.floor(d.price * 0.4);
}

function baseStatLine(def: ModuleDef): string {
  const st = def.stats;
  const parts: string[] = [];
  if (st.damage != null) parts.push(`DMG +${fmtStat(st.damage)}`);
  if (st.fireRate != null && st.fireRate !== 1) parts.push(`ROF ×${fmtStat(st.fireRate)}`);
  if (st.critChance) parts.push(`CRIT +${Math.round(st.critChance * 100)}%`);
  if (st.aoeRadius) parts.push(`AOE ${fmtStat(st.aoeRadius)}`);
  if (st.shieldMax) parts.push(`SHD +${fmtStat(st.shieldMax)}`);
  if (st.shieldRegen) parts.push(`REG +${fmtStat(st.shieldRegen)}/s`);
  if (st.shieldAbsorb) parts.push(`ABS +${Math.round(st.shieldAbsorb * 100)}%`);
  if (st.hullMax) parts.push(`HUL +${fmtStat(st.hullMax)}`);
  if (st.speed) parts.push(`SPD +${fmtStat(st.speed)}`);
  if (st.damageReduction) parts.push(`DR ${Math.round(st.damageReduction * 100)}%`);
  if (st.ammoCapacity) parts.push(`AMMO +${fmtStat(st.ammoCapacity)}`);
  if (st.cargoBonus) parts.push(`CARGO +${Math.round(st.cargoBonus * 100)}%`);
  if (st.lootBonus) parts.push(`LOOT +${fmtStat(st.lootBonus)}`);
  if (st.miningBonus) parts.push(`MINING +${fmtStat(st.miningBonus)}`);
  return parts.join(" · ");
}

/** Full multi-line tooltip for any inventory item (rolled or plain). */
export function lootTipText(it: ModuleItem, opts?: { action?: string }): string {
  const def = MODULE_DEFS[it.defId];
  if (!def) return it.defId;
  const lines: string[] = [];
  if (isRolledItem(it)) {
    const rar = (it.rarity ?? "common").toUpperCase();
    lines.push(`${lootItemName(it, def).toUpperCase()} · ${rar}`);
    lines.push(`${def.name} · T${def.tier} ${def.slot.toUpperCase()} · ITEM LEVEL ${it.ilvl ?? 1}`);
    const base = baseStatLine(def);
    if (base) lines.push(base);
    for (const roll of it.affixes ?? []) {
      const line = affixLine(roll as any);
      if (line) lines.push(line);
    }
    if (it.legendaryId && LEGENDARIES[it.legendaryId]) {
      const leg = LEGENDARIES[it.legendaryId];
      const legStats = Object.entries(leg.stats)
        .map(([k, v]) => {
          // fractional stats (crit/absorb/DR) show as %, the rest as capped numbers
          if (k === "fireRate") return `ROF ×${fmtStat(v as number)}`;
          if (k === "critChance" || k === "shieldAbsorb" || k === "damageReduction")
            return `${k.replace(/([A-Z])/g, " $1").toUpperCase()} +${Math.round((v as number) * 100)}%`;
          return `${k.replace(/([A-Z])/g, " $1").toUpperCase()} +${fmtStat(v as number)}`;
        })
        .join(" · ");
      lines.push(`✦ ${leg.blurb}`);
      if (legStats) lines.push(`✦ ${legStats}`);
    }
    lines.push(`SELLS ${lootSellPrice(it, def).toLocaleString()} CR`);
  } else {
    lines.push(`${def.name} · T${def.tier} ${def.rarity.toUpperCase()}`);
    lines.push(def.description);
    const base = baseStatLine(def);
    lines.push(base || "no stat bonuses");
    lines.push(`VALUE ${def.price.toLocaleString()} CR · SELLS ${lootSellPrice(it, def).toLocaleString()} CR`);
  }
  if (opts?.action) lines.push(opts.action);
  return lines.join("\n");
}

export { RARITIES as LOOT_RARITIES };
