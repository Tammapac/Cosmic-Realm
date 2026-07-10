import { useMemo, useState } from "react";
import { useGame, state, bump, equipModule, unequipInstance, sellInventoryItem } from "../game/store";
import { MODULE_DEFS, type ModuleItem } from "../game/types";
import { isRolledItem, lootItemColor, lootItemName, lootSellPrice, lootTipText } from "../game/loot-ui";
import { RARITY_ORDER } from "../../../lib/loot/loot";

const COLS = 5;
const ROWS = 6;
const PAGE = COLS * ROWS;

// Percentage geometry of the baked-in frame art (635×793 source PNG):
// slot grid, banner, close button and pager arrows all live in the artwork.
const GRID = { left: "18.4%", top: "26.8%", width: "61.8%", height: "60.3%" };

function rarityRank(it: ModuleItem): number {
  return it.rarity ? RARITY_ORDER.indexOf(it.rarity as any) : -1;
}

export function InventoryPanel() {
  const show = useGame((s) => s.showInventory);
  const player = useGame((s) => s.player);
  const tick = useGame((s) => s.tick);
  const [page, setPage] = useState(0);
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

  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const curPage = Math.min(page, pages - 1);
  const pageItems = items.slice(curPage * PAGE, curPage * PAGE + PAGE);
  const cells: (ModuleItem | null)[] = [
    ...pageItems,
    ...Array(Math.max(0, PAGE - pageItems.length)).fill(null),
  ];

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

  return (
    <div className="fixed z-50" style={{ top: 64, right: 14, width: 400, pointerEvents: "auto" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "635 / 793",
          backgroundImage: "url(/assets/ui/inventory-frame.png)",
          backgroundSize: "100% 100%",
          imageRendering: "auto",
          filter: "drop-shadow(0 6px 24px rgba(0,0,0,0.6))",
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* banner title */}
        <div
          style={{
            position: "absolute", left: "16%", right: "16%", top: "4.6%", height: "6.6%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#3a2000", fontWeight: 800, letterSpacing: "0.3em",
            fontSize: 15, textShadow: "0 1px 0 rgba(255,255,255,0.25)",
            userSelect: "none",
          }}
        >
          INVENTORY · {items.length}
        </div>

        {/* close button zone (baked ⊘ icon top-right) */}
        <button
          onClick={close}
          title={"Close inventory\nHotkey: I"}
          style={{
            position: "absolute", left: "79.5%", top: "12.6%", width: "9.5%", height: "7%",
            background: "transparent", border: "none", cursor: "pointer",
          }}
        />

        {/* slot grid, aligned over the baked orange frames */}
        <div
          style={{
            position: "absolute", ...GRID,
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            columnGap: "2.2%", rowGap: "2.2%",
          }}
        >
          {cells.map((it, i) => {
            if (!it) {
              return <div key={`empty-${i}`} title="Empty slot" style={{ width: "100%", height: "100%" }} />;
            }
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
                title={lootTipText(it, { action })}
                onClick={() => { setSelected(sel ? null : it.instanceId); }}
                onDoubleClick={() => onEquipToggle(it)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (canSell) sellInventoryItem(it.instanceId);
                }}
                style={{
                  position: "relative",
                  width: "100%", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  background: `radial-gradient(ellipse at center, ${color}1c 0%, transparent 72%)`,
                  boxShadow: sel
                    ? `inset 0 0 0 2px ${color}, inset 0 0 14px ${color}55`
                    : equipped
                      ? "inset 0 0 0 1px #5cff8a88"
                      : "none",
                  transition: "box-shadow 0.08s",
                }}
              >
                <span style={{ fontSize: 21, color, textShadow: `0 0 8px ${color}66`, lineHeight: 1 }}>
                  {def.glyph}
                </span>
                {rolled && (
                  <span style={{
                    position: "absolute", right: "7%", bottom: "4%",
                    fontSize: 9, fontWeight: 700, color: "#ffb14a", letterSpacing: "0.05em",
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
          })}
        </div>

        {/* pager: click zones over the baked arrows */}
        <button
          onClick={() => setPage(Math.max(0, curPage - 1))}
          disabled={curPage === 0}
          title="Previous page"
          style={{
            position: "absolute", left: "27%", top: "88%", width: "12%", height: "5%",
            background: "transparent", border: "none",
            cursor: curPage === 0 ? "default" : "pointer",
            opacity: curPage === 0 ? 0.3 : 1,
          }}
        />
        <button
          onClick={() => setPage(Math.min(pages - 1, curPage + 1))}
          disabled={curPage >= pages - 1}
          title="Next page"
          style={{
            position: "absolute", left: "61%", top: "88%", width: "12%", height: "5%",
            background: "transparent", border: "none",
            cursor: curPage >= pages - 1 ? "default" : "pointer",
            opacity: curPage >= pages - 1 ? 0.3 : 1,
          }}
        />
        <div
          style={{
            position: "absolute", left: "42%", width: "16%", top: "88.2%", height: "4.5%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ff9a2e", fontSize: 11, fontWeight: 700, letterSpacing: "0.2em",
            userSelect: "none", pointerEvents: "none",
          }}
        >
          {curPage + 1}/{pages}
        </div>
      </div>
    </div>
  );
}
