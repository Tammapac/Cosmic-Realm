// Rich item tooltip (design handoff §3.6).
//
// The old path flattened everything into a native `title=""` string, so a
// legendary and a grey drop looked identical: same font, same colour, no
// comparison. This renders the SAME data as structure — rarity-framed icon,
// rarity header, stat rows, and a ▲/▼ delta against whatever is equipped in
// that slot, so "is this an upgrade?" is answerable at a glance.
//
// It reads the item through the existing loot-ui helpers; no new game logic.
import { useMemo } from "react";
import { MODULE_DEFS, type ModuleItem, type ModuleDef } from "../game/types";
import { isRolledItem, lootItemColor, lootSellPrice } from "../game/loot-ui";
import { LEGENDARIES, itemDisplayName } from "../../../lib/loot/loot";

/** One comparable stat, already formatted for display. */
interface StatRow {
  key: string;
  label: string;
  value: number;
  /** How to print the number (percent stats read as %, rate as ×). */
  kind: "flat" | "pct" | "mul";
  /** Difference against the equipped item, if there is one. */
  delta?: number;
}

const STAT_LABELS: Record<string, { label: string; kind: StatRow["kind"] }> = {
  damage: { label: "Damage", kind: "flat" },
  fireRate: { label: "Fire rate", kind: "mul" },
  critChance: { label: "Crit", kind: "pct" },
  aoeRadius: { label: "Splash", kind: "flat" },
  shieldMax: { label: "Shield", kind: "flat" },
  shieldRegen: { label: "Regen", kind: "flat" },
  shieldAbsorb: { label: "Absorb", kind: "pct" },
  hullMax: { label: "Hull", kind: "flat" },
  speed: { label: "Speed", kind: "flat" },
  damageReduction: { label: "Damage red.", kind: "pct" },
  ammoCapacity: { label: "Ammo", kind: "flat" },
  cargoBonus: { label: "Cargo", kind: "pct" },
  lootBonus: { label: "Loot", kind: "flat" },
  miningBonus: { label: "Mining", kind: "flat" },
};

function fmt(v: number, kind: StatRow["kind"]): string {
  if (kind === "pct") return `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
  if (kind === "mul") return `×${v.toFixed(2)}`;
  const r = Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v).toString();
  return `${v > 0 ? "+" : ""}${r}`;
}

/** Sum a def's base stats with any rolled affixes into one flat map. */
function totalStats(it: ModuleItem, def?: ModuleDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(def?.stats ?? {})) {
    if (typeof v === "number") out[k] = v;
  }
  for (const roll of (it.affixes ?? []) as { stat?: string; value?: number }[]) {
    if (roll?.stat && typeof roll.value === "number") {
      out[roll.stat] = (out[roll.stat] ?? 0) + roll.value;
    }
  }
  if (it.legendaryId && LEGENDARIES[it.legendaryId]) {
    for (const [k, v] of Object.entries(LEGENDARIES[it.legendaryId].stats)) {
      if (typeof v === "number") out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

export interface ItemTooltipProps {
  item: ModuleItem;
  /** The item currently equipped in the same slot, for the ▲/▼ comparison. */
  equipped?: ModuleItem | null;
  /** Hint line at the bottom (e.g. "DBL-CLICK TO EQUIP"). */
  action?: string;
}

export function ItemTooltip({ item, equipped, action }: ItemTooltipProps) {
  const def = MODULE_DEFS[item.defId];
  const rarity = item.rarity ?? def?.rarity ?? "common";
  const color = lootItemColor(item, def);
  const rolled = isRolledItem(item);

  const rows = useMemo<StatRow[]>(() => {
    const mine = totalStats(item, def);
    const theirs = equipped ? totalStats(equipped, MODULE_DEFS[equipped.defId]) : null;
    return Object.entries(mine)
      .filter(([k, v]) => STAT_LABELS[k] && v !== 0 && !(k === "fireRate" && v === 1))
      .map(([k, v]) => {
        const meta = STAT_LABELS[k];
        const other = theirs?.[k];
        return {
          key: k,
          label: meta.label,
          value: v,
          kind: meta.kind,
          delta: other != null ? v - other : undefined,
        };
      });
  }, [item, def, equipped]);

  const legendary = item.legendaryId ? LEGENDARIES[item.legendaryId] : null;

  return (
    <div className={`itip rarity--${rarity}`} style={{ ["--itip-accent" as string]: color }}>
      <header className="itip-head">
        <div className={`itip-icon rarity--${rarity}`}>
          <span>{def?.slot === "weapon" ? "⚔" : def?.slot === "generator" ? "◈" : "⬡"}</span>
        </div>
        <div className="itip-id">
          <div className="itip-name">{itemDisplayName(item as never, def?.name ?? item.defId)}</div>
          <div className="itip-sub">
            <span className="itip-rarity">{String(rarity).toUpperCase()}</span>
            {def && (
              <>
                <span className="itip-dot">·</span>
                T{def.tier} {def.slot.toUpperCase()}
                {rolled && item.ilvl ? <> <span className="itip-dot">·</span> ILVL {item.ilvl}</> : null}
              </>
            )}
          </div>
        </div>
      </header>

      {rows.length > 0 && (
        <div className="itip-stats">
          {rows.map((r) => (
            <div key={r.key} className="itip-stat">
              <span className="itip-stat-label">{r.label}</span>
              <span className="itip-stat-value">{fmt(r.value, r.kind)}</span>
              {r.delta != null && r.delta !== 0 && (
                <span className={`itip-delta ${r.delta > 0 ? "itip-delta--up" : "itip-delta--down"}`}>
                  {r.delta > 0 ? "▲" : "▼"} {fmt(Math.abs(r.delta), r.kind).replace("+", "")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {legendary && <div className="itip-flavor">{legendary.blurb}</div>}
      {!rolled && def?.description && <div className="itip-flavor">{def.description}</div>}

      <footer className="itip-foot">
        <span className="itip-sell">Sells {lootSellPrice(item, def).toLocaleString()} CR</span>
        {action && <span className="itip-action">{action}</span>}
      </footer>
    </div>
  );
}
