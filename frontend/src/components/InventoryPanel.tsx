import { useMemo, useState } from "react";
import { useGame, state, bump, equipModule, unequipInstance, sellInventoryItem } from "../game/store";
import { MODULE_DEFS, type ModuleItem } from "../game/types";
import { isRolledItem, lootItemColor, lootTipText } from "../game/loot-ui";
import { RARITY_ORDER } from "../../../lib/loot/loot";

const COLS = 5;

function rarityRank(it: ModuleItem): number {
  return it.rarity ? RARITY_ORDER.indexOf(it.rarity as any) : -1;
}

// Type sections, rendered in this order — clear separation instead of one
// mixed grid (Waffen / Generatoren / Module).
const SECTIONS: { slot: "weapon" | "generator" | "module"; label: string }[] = [
  { slot: "weapon", label: "Waffen" },
  { slot: "generator", label: "Generatoren" },
  { slot: "module", label: "Module" },
];

export function InventoryPanel() {
  const show = useGame((s) => s.showInventory);
  const player = useGame((s) => s.player);
  const tick = useGame((s) => s.tick);
  const [selected, setSelected] = useState<string | null>(null);

  const items = useMemo(() => {
    const list = [...player.inventory].filter((it) => MODULE_DEFS[it.defId]);
    // best stuff first: rarity desc → ilvl desc → tier desc
    list.sort((a, b) => {
      const r = rarityRank(b) - rarityRank(a);
      if (r !== 0) return r;
      const l = (b.ilvl ?? 0) - (a.ilvl ?? 0);
      if (l !== 0) return l;
      return (MODULE_DEFS[b.defId]?.tier ?? 0) - (MODULE_DEFS[a.defId]?.tier ?? 0);
    });
    return list;
  }, [player.inventory, tick]);

  if (!show) return null;

  const isEquipped = (id: string) =>
    player.equipped.weapon.includes(id) ||
    player.equipped.generator.includes(id) ||
    player.equipped.module.includes(id);

  const close = () => { state.showInventory = false; bump(); };

  const onEquipToggle = (it: ModuleItem) => {
    const def = MODULE_DEFS[it.defId];
    if (!def) return;
    if (isEquipped(it.instanceId)) {
      unequipInstance(it.instanceId);
      bump();
      return;
    }
    const arr = state.player.equipped[def.slot];
    let idx = arr.findIndex((x) => x === null);
    if (idx < 0) idx = 0;
    equipModule(it.instanceId, def.slot, idx);
  };

  const renderCell = (it: ModuleItem) => {
    const def = MODULE_DEFS[it.defId];
    const color = lootItemColor(it, def);
    const equipped = isEquipped(it.instanceId);
    const sel = selected === it.instanceId;
    const rolled = isRolledItem(it);
    const canSell = !!state.dockedAt;
    const action = equipped
      ? "DBL-CLICK TO UNEQUIP"
      : `DBL-CLICK TO EQUIP${canSell ? " · RIGHT-CLICK TO SELL" : ""}`;
    return (
      <div
        key={it.instanceId}
        className="sw-slot"
        title={lootTipText(it, { action })}
        onClick={() => { setSelected(sel ? null : it.instanceId); }}
        onDoubleClick={() => onEquipToggle(it)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (canSell) sellInventoryItem(it.instanceId);
        }}
        style={{
          position: "relative",
          aspectRatio: "1",
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          background: `radial-gradient(ellipse at center, ${color}1c 0%, transparent 72%)`,
          boxShadow: sel
            ? `inset 0 0 0 2px ${color}, inset 0 0 14px ${color}55`
            : equipped
              ? "inset 0 0 0 1px #5cff8a88"
              : undefined,
          transition: "box-shadow 0.08s",
        }}
      >
        <span style={{ fontSize: 21, color, textShadow: `0 0 8px ${color}66`, lineHeight: 1 }}>
          {def.glyph}
        </span>
        {rolled && (
          <span style={{
            position: "absolute", right: "7%", bottom: "4%",
            fontSize: 9, fontWeight: 700, color: "#9fe0ff", letterSpacing: "0.05em",
            textShadow: "0 1px 2px #000",
          }}>
            {it.ilvl ?? 1}
          </span>
        )}
        {equipped && (
          <span style={{
            position: "absolute", left: "7%", top: "3%",
            fontSize: 9, fontWeight: 800, color: "#5cff8a", textShadow: "0 1px 2px #000",
          }}>
            E
          </span>
        )}
        {rolled && it.legendaryId && (
          <span style={{
            position: "absolute", right: "6%", top: "3%",
            fontSize: 10, color: "#ffd24a", textShadow: "0 0 6px #ffd24a88",
          }}>
            ✦
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed z-50" style={{ top: 64, right: 14, width: 400, pointerEvents: "auto" }}>
      <div className="hud-plate" style={{ display: "flex", flexDirection: "column", maxHeight: "72vh" }} onContextMenu={(e) => e.preventDefault()}>
        <div className="hud-titleband" style={{ letterSpacing: "0.3em" }}>
          <span style={{ flex: 1 }}>Inventory · {items.length}</span>
          <button className="gbtn gbtn-red" style={{ padding: "1px 8px", fontSize: 10 }} onClick={close} title={"Close inventory (I)"}>✕</button>
        </div>
        <div style={{ overflowY: "auto", minHeight: 0, padding: "6px 10px 10px" }}>
          {SECTIONS.map(({ slot, label }) => {
            const group = items.filter((it) => MODULE_DEFS[it.defId]?.slot === slot);
            if (group.length === 0) return null;
            const equippedCount = group.filter((it) => isEquipped(it.instanceId)).length;
            return (
              <div key={slot}>
                <div
                  className="hud-titleband"
                  style={{ margin: "8px -2px 6px", padding: "3px 8px", fontSize: 10, letterSpacing: "0.24em", borderTop: "1px solid var(--hud-border-dim)" }}
                >
                  <span style={{ flex: 1 }}>{label}</span>
                  <span style={{ color: "var(--hud-text-dim)", letterSpacing: "0.08em" }}>
                    {equippedCount > 0 ? `${equippedCount} aktiv · ` : ""}{group.length}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                    gap: 6,
                  }}
                >
                  {group.map(renderCell)}
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div style={{ color: "var(--hud-text-dim)", fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.1em", padding: "18px 8px", textAlign: "center" }}>
              CARGO BAY EMPTY — DEFEAT ENEMIES TO COLLECT GEAR
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
