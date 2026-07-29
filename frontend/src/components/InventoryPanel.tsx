import { useMemo, useState } from "react";
import { useDraggable } from "./useDraggable";
import { useGame, state, bump, equipModule, unequipInstance, sellInventoryItem } from "../game/store";
import { MODULE_DEFS, type ModuleItem } from "../game/types";
import { isRolledItem, lootItemColor } from "../game/loot-ui";
import { ItemTooltip } from "./ItemTooltip";
import { WeaponIcon } from "./hud-ui";
import { useHudPanel } from "../hooks/useHudPanel";
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
  // Rich tooltip: which slot is hovered and where to float the card.
  const [hover, setHover] = useState<{ it: ModuleItem; x: number; y: number } | null>(null);
  const [tab, setTab] = useState<"all" | "weapon" | "generator" | "module">("all");
  const drag = useDraggable("inventory", { resetOnMount: true });
  // Keeps the window mounted through its exit animation (hud-motion.css).
  const panelAnim = useHudPanel(show);

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

  // Stay mounted while the close animation plays, not just while `show` is on.
  if (!panelAnim.mounted) return null;

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

  const hintFor = (it: ModuleItem) =>
    isEquipped(it.instanceId)
      ? "DBL-CLICK TO UNEQUIP"
      : `DBL-CLICK TO EQUIP${state.dockedAt ? " · RIGHT-CLICK TO SELL" : ""}`;

  /** The item worn in the same slot, so the tooltip can show ▲/▼ deltas. */
  const equippedRival = (it: ModuleItem): ModuleItem | null => {
    const slot = MODULE_DEFS[it.defId]?.slot;
    if (!slot || isEquipped(it.instanceId)) return null;
    const id = player.equipped[slot].find((x): x is string => !!x);
    if (!id) return null;
    return player.inventory.find((x) => x.instanceId === id) ?? null;
  };

  const renderCell = (it: ModuleItem) => {
    const def = MODULE_DEFS[it.defId];
    const color = lootItemColor(it, def);
    const equipped = isEquipped(it.instanceId);
    const sel = selected === it.instanceId;
    const rolled = isRolledItem(it);
    const canSell = !!state.dockedAt;
    return (
      <div
        key={it.instanceId}
        /* rarity--* bands the slot itself (inset ring + aura on epic and up),
           so tier is readable across the grid without opening a tooltip. */
        className={`sw-slot${it.rarity ? ` rarity--${it.rarity}` : ""}`}
        onPointerEnter={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setHover({ it, x: r.right + 10, y: r.top });
        }}
        onPointerLeave={() => setHover((h) => (h?.it.instanceId === it.instanceId ? null : h))}
        onClick={() => { setSelected(sel ? null : it.instanceId); setHover(null); }}
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
        <WeaponIcon def={def} size={40} color={color} />

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
    <>
    {/* Rich tooltip floats in viewport space so the panel's overflow:hidden
        (needed for the scroll area) can't clip it. */}
    {hover && (
      <div
        className="fixed"
        style={{
          left: Math.min(hover.x, window.innerWidth - 300),
          top: Math.min(hover.y, window.innerHeight - 320),
          zIndex: 90,
          pointerEvents: "none",
        }}
      >
        <ItemTooltip item={hover.it} equipped={equippedRival(hover.it)} action={hintFor(hover.it)} />
      </div>
    )}
    <div className="fixed z-50" style={{ top: 44, left: "calc(50% + 20px)", width: 400, pointerEvents: "auto", ...drag.style }}>
      <div
        className={`panel ${panelAnim.className}`}
        style={{ display: "flex", flexDirection: "column", maxHeight: "72vh", position: "relative", overflow: "hidden" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="panel-rim" aria-hidden="true" />
        <div className="hud-titleband" onPointerDown={drag.handleProps.onPointerDown} style={{ letterSpacing: "0.3em", ...drag.handleProps.style }}>
          <span style={{ flex: 1 }}>Inventory · {items.length}</span>
          <button className="gbtn gbtn-red" style={{ padding: "1px 8px", fontSize: 10 }} onClick={close} title={"Close inventory (I)"}>✕</button>
        </div>
        {/* category tabs on the top edge */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--hud-border-dim)", flexShrink: 0 }}>
          {([
            { key: "all", label: "Alle" },
            { key: "weapon", label: "Waffen" },
            { key: "generator", label: "Generatoren" },
            { key: "module", label: "Module" },
          ] as const).map(({ key, label }) => {
            const count = key === "all" ? items.length : items.filter((it) => MODULE_DEFS[it.defId]?.slot === key).length;
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  flex: 1,
                  padding: "6px 2px",
                  cursor: "pointer",
                  background: active ? "rgba(78,226,255,0.1)" : "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid var(--hud-cyan)" : "2px solid transparent",
                  fontFamily: "var(--font-display)",
                  fontSize: 9.5,
                  fontWeight: active ? 700 : 400,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: active ? "var(--hud-cyan)" : "var(--hud-text-dim)",
                  textShadow: active ? "0 0 8px rgba(78,226,255,0.45)" : "none",
                  transition: "color 0.12s, background 0.12s",
                  whiteSpace: "nowrap",
                }}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
        <div style={{ overflowY: "auto", minHeight: 0, padding: "6px 10px 10px" }}>
          {SECTIONS.filter(({ slot }) => tab === "all" || tab === slot).map(({ slot, label }) => {
            const group = items.filter((it) => MODULE_DEFS[it.defId]?.slot === slot);
            if (group.length === 0) return null;
            const equippedCount = group.filter((it) => isEquipped(it.instanceId)).length;
            return (
              <div key={slot}>
                {tab === "all" && (
                  <div
                    className="hud-titleband"
                    style={{ margin: "8px -2px 6px", padding: "3px 8px", fontSize: 10, letterSpacing: "0.24em", borderTop: "1px solid var(--hud-border-dim)" }}
                  >
                    <span style={{ flex: 1 }}>{label}</span>
                    <span style={{ color: "var(--hud-text-dim)", letterSpacing: "0.08em" }}>
                      {equippedCount > 0 ? `${equippedCount} aktiv · ` : ""}{group.length}
                    </span>
                  </div>
                )}
                {tab !== "all" && <div style={{ height: 8 }} />}
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
    </>
  );
}
