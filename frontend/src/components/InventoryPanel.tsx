// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-01 ·
// INVENTORY section + its renderVals() logic) onto the real game store.
// Every color, gradient, clip-path and animation below is copied verbatim
// from that source — R[] (rarity table), RECESS[], rareFx(), shadeHex()/
// rgba() and the slot/tab/chip/tooltip markup all match line for line.
// Only the data plumbing (INV_TABS -> player.inventory) is new.
import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "./useDraggable";
import { useGame, state, bump, equipModule, unequipInstance, sellInventoryItem } from "../game/store";
import { MODULE_DEFS, weaponSpriteUrl, type ModuleSlot } from "../game/types";
import { isRolledItem } from "../game/loot-ui";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { KitDialog, KitDialogActions } from "./hud/KitDialog";
import { KitPillButton } from "./hud/KitPillButton";
import { usePressable } from "./hud/usePressable";
import { sendInventoryBuyPage } from "../net/socket";
import { type Rarity } from "../../../lib/loot/loot";

const HEX = "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)";
const INV_PAGE = 24;
const INV_RAR = ["ALL", "RARE+", "EPIC+", "LEGENDARY+"];
const RANKOF: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, relic: 5, celestial: 6 };
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

// [hex, tint, glowRadius, glowColor, label] — verbatim from the Kit source.
const R: Record<string, [string, string, string, string, string]> = {
  common: ["#8aa0c0", "rgba(138,160,192,.12)", "12px", "rgba(138,160,192,.25)", "COMMON"],
  uncommon: ["#5cff8a", "rgba(92,255,138,.14)", "14px", "rgba(92,255,138,.3)", "UNCOMMON"],
  rare: ["#4ee2ff", "rgba(78,226,255,.14)", "16px", "rgba(78,226,255,.32)", "RARE"],
  epic: ["#b866ff", "rgba(184,102,255,.16)", "20px", "rgba(184,102,255,.35)", "EPIC"],
  legendary: ["#e8b94d", "rgba(232,185,77,.16)", "24px", "rgba(232,185,77,.4)", "LEGENDARY"],
  relic: ["#ff4fa8", "rgba(255,79,168,.16)", "28px", "rgba(255,79,168,.4)", "RELIC"],
  celestial: ["#9df2ff", "rgba(157,242,255,.18)", "32px", "rgba(157,242,255,.45)", "CELESTIAL"],
};
const RECESS: Record<string, string> = { common: "#0b0e16", uncommon: "#07120d", rare: "#06111c", epic: "#0f0819", legendary: "#120f05", relic: "#120f05", celestial: "#06111c" };

const shadeHex = (hex: string, amt: number): string => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255) + Math.round(255 * amt), g = (n >> 8 & 255) + Math.round(255 * amt), b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};
const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};

function rareFx(key: string | undefined) {
  if (key === "celestial") return {
    show: "block", sheen: "block",
    bg: "conic-gradient(from 0deg,rgba(196,255,255,.6),rgba(150,214,255,.2) 14%,rgba(255,214,255,.55) 30%,rgba(180,190,255,.18) 46%,rgba(214,255,246,.55) 62%,rgba(160,220,255,.2) 78%,rgba(196,255,255,.6))",
    anim: "cCelDrift 11s linear infinite,cCelBreath 5s ease-in-out infinite", blur: "7px",
  };
  if (key === "relic") return {
    show: "block", sheen: "none",
    bg: "radial-gradient(closest-side,rgba(255,150,246,.6),rgba(255,92,240,.22) 54%,transparent 78%),conic-gradient(from 90deg,rgba(255,92,240,.1),rgba(255,170,250,.55) 22%,rgba(255,92,240,.12) 44%,rgba(255,140,246,.5) 68%,rgba(255,92,240,.1))",
    anim: "cRelicSwirl 8s linear infinite,cRelicFlare 3.6s ease-in-out infinite", blur: "8px",
  };
  if (key === "legendary") return {
    show: "block", sheen: "none",
    bg: "radial-gradient(closest-side,rgba(255,236,180,.62),rgba(232,185,77,.2) 58%,transparent 80%)",
    anim: "cLegBreath 4.2s ease-in-out infinite", blur: "6px",
  };
  return { show: "none", sheen: "none", bg: "none", anim: "none", blur: "0px" };
}

// The rarity glow keyframes referenced by rareFx() above — not in hud-animations.css, kept local.
const RARE_FX_KEYFRAMES = `
@keyframes cCelDrift{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes cCelBreath{0%,100%{opacity:.72}50%{opacity:1}}
@keyframes cCelSheen{from{transform:translateX(-160%) skewX(-20deg)}to{transform:translateX(420%) skewX(-20deg)}}
@keyframes cRelicSwirl{0%{transform:rotate(0deg)}100%{transform:rotate(-360deg)}}
@keyframes cRelicFlare{0%,100%{opacity:.34}50%{opacity:.95}}
@keyframes cLegBreath{0%,100%{opacity:.2}50%{opacity:.62}}
@keyframes cInvRow{0%{opacity:0;transform:translateX(-14px)}100%{opacity:1;transform:none}}
@keyframes cPulse{0%,100%{opacity:.45}50%{opacity:1}}
@keyframes cSkTip{0%{opacity:0;transform:translateY(6px) scale(.96)}100%{opacity:1;transform:none}}
@keyframes cGoldGlow{0%,100%{filter:drop-shadow(0 3px 0 rgba(3,5,10,.92)) drop-shadow(0 5px 6px rgba(0,0,0,.7)) drop-shadow(0 11px 14px rgba(0,0,0,.5)) drop-shadow(0 0 6px rgba(232,185,77,.35))}50%{filter:drop-shadow(0 3px 0 rgba(3,5,10,.92)) drop-shadow(0 5px 6px rgba(0,0,0,.7)) drop-shadow(0 11px 14px rgba(0,0,0,.5)) drop-shadow(0 0 14px rgba(232,185,77,.75)) drop-shadow(0 0 26px rgba(232,185,77,.4))}}
@keyframes cSweep{0%{transform:skewX(-18deg) translateX(-120%)}100%{transform:skewX(-18deg) translateX(760%)}}
@keyframes cTopUp{0%,100%{transform:scale(1);text-shadow:0 0 6px rgba(232,185,77,.6),0 0 14px rgba(232,185,77,.35),0 1px 1px rgba(0,0,0,.7)}50%{transform:scale(1.16);text-shadow:0 0 12px rgba(255,214,120,1),0 0 26px rgba(232,185,77,.8),0 0 44px rgba(232,185,77,.45),0 1px 1px rgba(0,0,0,.7)}}
`;

// player.inventory only ever holds weapon/generator/module items — the Kit's
// EXTRAS category (consumables, key items) has no backing data yet. Kept as
// a disabled placeholder tab so a future item type has a slot ready.
const TABS: { key: ModuleSlot | "extras"; label: string; hex: string; glyph: string; disabled?: boolean }[] = [
  { key: "weapon", label: "WEAPONS", hex: "#ff5c6c", glyph: "≡" },
  { key: "generator", label: "GENERATORS", hex: "#ffd24a", glyph: "⌬" },
  { key: "module", label: "MODULES", hex: "#b866ff", glyph: "◈" },
  { key: "extras", label: "EXTRAS", hex: "#5cff8a", glyph: "✚", disabled: true },
];
const ALL_HEX = "#4ee2ff";

type InvItem = { key: string; rarity: Rarity; name: string; icon: string; ilvl?: number; qty?: string; instanceId: string };

export function InventoryPanel() {
  const show = useGame((s) => s.showInventory);
  const player = useGame((s) => s.player);
  const tick = useGame((s) => s.tick);
  const [tabKey, setTabKey] = useState<ModuleSlot | "extras" | "all">("all");
  const [rarIdx, setRarIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [invSel, setInvSel] = useState<number | null>(null);
  const [invConfirm, setInvConfirm] = useState(false);
  const [buyPageOpen, setBuyPageOpen] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [playToken, setPlayToken] = useState(0);
  // Mirrors the Kit's own lifecycle: closeInv() calls the portal's close()
  // directly and waits for its "portal-closed" callback before the window
  // actually unmounts — no separate exit-animation timer racing it.
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const drag = useDraggable("inventory", { resetOnMount: true });

  useEffect(() => {
    if (show) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const isEquipped = (id: string) =>
    player.equipped.weapon.includes(id) ||
    player.equipped.generator.includes(id) ||
    player.equipped.module.includes(id);

  // Build per-tab item arrays shaped like the Kit's INV_TABS, from the live
  // inventory. Equipped gear lives on the ship, not the cargo bay.
  const bySlot = useMemo(() => {
    const worn = new Set<string>([
      ...player.equipped.weapon, ...player.equipped.generator, ...player.equipped.module,
    ].filter((x): x is string => !!x));
    const groups: Record<ModuleSlot, InvItem[]> = { weapon: [], generator: [], module: [] };
    for (const it of player.inventory) {
      const def = MODULE_DEFS[it.defId];
      if (!def || worn.has(it.instanceId)) continue;
      // Rolled loot carries its own rarity (real affix roll); everything
      // else — base catalog items like a plain T10 laser — falls back to
      // the def's tier-derived rarity instead of always reading as common.
      const rarity = (it.rarity ?? def.rarity ?? "common") as Rarity;
      groups[def.slot].push({
        key: it.instanceId, rarity, name: def.name,
        icon: weaponSpriteUrl(it.defId) ?? BLANK,
        ilvl: it.ilvl, qty: isRolledItem(it) ? undefined : "×1",
        instanceId: it.instanceId,
      });
    }
    for (const slot of Object.keys(groups) as ModuleSlot[]) {
      groups[slot].sort((a, b) => RANKOF[b.rarity] - RANKOF[a.rarity] || (b.ilvl ?? 0) - (a.ilvl ?? 0));
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.inventory, player.equipped, tick]);

  const activeItems: InvItem[] = tabKey === "all"
    ? [...bySlot.weapon, ...bySlot.generator, ...bySlot.module]
    : tabKey === "extras" ? [] : bySlot[tabKey];

  const activeHex = tabKey === "all" ? ALL_HEX : (TABS.find((t) => t.key === tabKey)?.hex ?? ALL_HEX);
  const activeLabel = tabKey === "all" ? "ALL" : (TABS.find((t) => t.key === tabKey)?.label ?? "ALL");

  if (!mounted) return null;

  // Fires the portal's reverse (print-out) animation; the panel only
  // actually unmounts once PrintPortal's onClosed reports it finished.
  const requestClose = () => { setClosing(true); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); state.showInventory = false; bump(); };
  const changeTab = (key: typeof tabKey) => { setTabKey(key); setPage(0); setInvSel(null); };
  const changeRarity = (i: number) => setRarIdx(i);

  const buyPage = async () => {
    if (buying) return;
    setBuying(true);
    setBuyError(null);
    const res = await sendInventoryBuyPage();
    setBuying(false);
    if (res.ok && res.unlocked) {
      state.player.inventoryExtraPage = true;
      if (typeof res.mcoins === "number") state.player.mcoins = res.mcoins;
      bump();
      setBuyPageOpen(false);
    } else {
      setBuyError(res.error ?? "Purchase failed");
    }
  };

  // 24-slot page, min-rarity filtered — mirrors invSlots() verbatim.
  const min = [0, 2, 3, 4][rarIdx];
  const pageRaw = activeItems.slice(page * INV_PAGE, page * INV_PAGE + INV_PAGE);
  const slots = Array.from({ length: INV_PAGE }, (_, i) => {
    const raw = pageRaw[i] ?? null;
    return raw && RANKOF[raw.rarity] >= min ? raw : null;
  });
  const pageCount = Math.max(1, Math.ceil(activeItems.length / INV_PAGE));
  const pageAccessible = player.inventoryExtraPage ? 3 : 2;

  const selected = invSel !== null ? slots[invSel - page * INV_PAGE] ?? null : null;

  const onEquipToggle = (it: InvItem) => {
    const item = player.inventory.find((m) => m.instanceId === it.instanceId);
    const def = item && MODULE_DEFS[item.defId];
    if (!item || !def) return;
    if (isEquipped(item.instanceId)) { unequipInstance(item.instanceId); bump(); return; }
    const arr = state.player.equipped[def.slot];
    let idx = arr.findIndex((x) => x === null);
    if (idx < 0) idx = 0;
    equipModule(item.instanceId, def.slot, idx);
  };

  const askThrow = () => { if (selected) setInvConfirm(true); };
  const doThrow = () => {
    if (selected && state.dockedAt) sellInventoryItem(selected.instanceId);
    setInvConfirm(false); setInvSel(null);
  };

  // Real brushed-metal atlas tile (not CSS) — the top-left tile of a 2x2
  // texture sheet, matching the Kit source's METAL_RIM constant verbatim.
  const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
  const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

  return (
    <div className="fixed z-50" style={{ top: 40, left: "calc(50% - 340px)", width: 720, pointerEvents: "auto", ...drag.style }}>
      <style>{RARE_FX_KEYFRAMES}</style>
      <PrintPortal
        playToken={playToken}
        accent="#4ee2ff"
        duration={1350}
        chamfer={34}
        closing={closing}
        onClosed={closing ? onPortalClosed : undefined}
      >
        {/* outer chamfered metal frame — 5 nested bevel bands, verbatim from the Kit's print-portal wrapper markup */}
        <div style={{ position: "relative", padding: 10, boxSizing: "border-box", filter: `drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px ${rgba(activeHex, 0.2)})` }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 29.31px) 0,100% 29.31px,100% 100%,29.31px 100%,0 calc(100% - 29.31px))" }} />
          <i style={{ position: "absolute", left: 22, right: 44, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
          <i style={{ position: "absolute", left: 44, right: 22, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(150,190,235,.3),transparent)", pointerEvents: "none" }} />

          <div
            style={{
              position: "relative", zIndex: 1, display: "grid", gap: 11, padding: "13px 15px 14px", overflow: "hidden",
              background: "radial-gradient(130% 100% at 50% -12%,rgba(180,140,245,.26),transparent 74%),linear-gradient(180deg,#2a2038,#12101c 62%,#08070f)",
              boxShadow: "inset 0 6px 12px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)",
              clipPath: "polygon(0 0,calc(100% - 28.14px) 0,100% 28.14px,100% 100%,28.14px 100%,0 calc(100% - 28.14px))",
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <i style={{ position: "absolute", inset: 0, clipPath: "polygon(0 0,calc(100% - 28.14px) 0,100% 28.14px,100% 100%,28.14px 100%,0 calc(100% - 28.14px))", background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
            <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${activeHex},transparent)`, boxShadow: `0 0 12px ${activeHex}`, opacity: 0.55, transition: "background .4s ease", pointerEvents: "none" }} />

            {/* destroy-item confirm overlay */}
            {invConfirm && (
              <KitDialog accent="red" title="DESTROY ITEM" onDismiss={() => setInvConfirm(false)}>
                <p style={{ margin: "0 0 6px", fontSize: 14.8, lineHeight: 1.55, color: "rgba(240,224,232,.9)" }}>Are you sure you want to throw this out?</p>
                <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5, color: "rgba(226,196,206,.6)" }}>The item will never be retrieved.</p>
                <KitDialogActions left={{ label: "YES", onClick: doThrow }} right={{ label: "NO", onClick: () => setInvConfirm(false) }} />
              </KitDialog>
            )}

            {/* header */}
            <div
              className="hud-drag-handle"
              onPointerDown={drag.handleProps.onPointerDown}
              style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "0 2px", cursor: "grab", ...drag.handleProps.style }}
            >
              <b style={{ fontFamily: "var(--font-display)", fontSize: 15.3, letterSpacing: "0.2em", color: "#ecd6ff" }}>INVENTORY</b>
              <small style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.2, color: "rgba(196,218,240,.75)" }}>
                {activeLabel} · {activeItems.length} / {INV_PAGE * pageCount}
              </small>
              <span style={{ flex: 1 }} />
              <CloseButton onClick={requestClose} title="Close inventory (I)" size={26} fontSize={11} />
            </div>

            {/* tabs — ALL + weapon/generator/module + disabled EXTRAS */}
            <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 1, overflow: "hidden", background: "rgba(4,8,16,.55)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)" }}>
              {[{ key: "all" as const, label: "ALL", hex: ALL_HEX, glyph: "◈", disabled: false }, ...TABS].map(({ key, label, hex, glyph, disabled }) => {
                const count = key === "all" ? bySlot.weapon.length + bySlot.generator.length + bySlot.module.length : key === "extras" ? 0 : bySlot[key].length;
                const on = tabKey === key;
                return (
                  <TabButton
                    key={key} disabled={disabled} onClick={() => changeTab(key)}
                    title={disabled ? "No items of this kind yet" : undefined}
                    on={on} hex={hex}
                  >
                    <i style={{ fontStyle: "normal", fontSize: 14.2, color: hex, opacity: on ? 1 : 0.35, textShadow: `0 0 8px ${hex}` }}>{glyph}</i>
                    {label}
                    <em style={{ fontStyle: "normal", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(180,205,230,.5)" }}>{String(count).padStart(2, "0")}</em>
                  </TabButton>
                );
              })}
              {(() => {
                const idx = ["all", "weapon", "generator", "module", "extras"].indexOf(tabKey);
                const ind = `${idx * 20}%`;
                return (
                  <>
                    <i style={{ position: "absolute", zIndex: 4, top: 0, left: ind, width: "20%", height: 5, pointerEvents: "none", opacity: 0.28, filter: "blur(4px)", background: `linear-gradient(90deg,transparent,${activeHex},transparent)`, transition: "left 480ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
                    <i style={{ position: "absolute", zIndex: 4, top: 0, left: ind, width: "20%", height: 3, pointerEvents: "none", opacity: 0.55, filter: "blur(2px)", background: `linear-gradient(90deg,transparent,${activeHex},transparent)`, transition: "left 380ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
                    <i style={{ position: "absolute", zIndex: 5, top: 0, left: ind, width: "20%", height: 2, pointerEvents: "none", background: `linear-gradient(90deg,transparent,${activeHex} 22%,${activeHex} 78%,transparent)`, boxShadow: `0 0 10px ${activeHex},0 0 24px ${activeHex}`, transition: "left 260ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
                    <i style={{ position: "absolute", zIndex: 4, bottom: 0, left: ind, width: "20%", height: 5, pointerEvents: "none", opacity: 0.28, filter: "blur(4px)", background: `linear-gradient(90deg,transparent,${activeHex},transparent)`, transition: "left 480ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
                    <i style={{ position: "absolute", zIndex: 4, bottom: 0, left: ind, width: "20%", height: 3, pointerEvents: "none", opacity: 0.55, filter: "blur(2px)", background: `linear-gradient(90deg,transparent,${activeHex},transparent)`, transition: "left 380ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
                    <i style={{ position: "absolute", zIndex: 5, bottom: 0, left: ind, width: "20%", height: 2, pointerEvents: "none", background: `linear-gradient(90deg,transparent,${activeHex} 22%,${activeHex} 78%,transparent)`, boxShadow: `0 0 10px ${activeHex},0 0 24px ${activeHex}`, transition: "left 260ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
                  </>
                );
              })()}
            </div>

            {/* rarity filter chips + search + sort */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
              <small style={{ flex: "0 0 auto", fontSize: 8.9, letterSpacing: "0.24em", color: "rgba(206,226,246,.85)", fontWeight: 700 }}>FILTER</small>
              <div style={{ display: "flex", gap: 5 }}>
                {INV_RAR.map((label, i) => {
                  const on = rarIdx === i;
                  return (
                    <ChipButton key={label} onClick={() => changeRarity(i)} on={on} accent={activeHex}>
                      {label}
                    </ChipButton>
                  );
                })}
              </div>
              <span style={{ flex: 1 }} />
              <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 9px", background: "rgba(3,5,11,.8)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.55),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
                <i style={{ fontStyle: "normal", fontSize: 11.8, color: "rgba(160,190,215,.5)" }}>⌕</i>
                <small style={{ fontSize: 11.2, color: "rgba(160,190,215,.45)" }}>Search name…</small>
              </span>
              <SortButton />
            </div>

            {/* 24-socket grid (8 cols x 3 rows) — every socket always renders its full frame, empty or not */}
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 8, padding: 11, background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.6)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06),inset 0 6px 14px rgba(0,0,0,.5)" }}>
              {slots.map((it, i) => {
                const sel = invSel === page * INV_PAGE + i;
                if (!it) {
                  return <EmptySlot key={`empty-${i}`} onClick={() => setInvSel(null)} />;
                }
                const gi = page * INV_PAGE + i;
                return (
                  <ItemSlot
                    key={it.key} it={it} sel={sel}
                    onClick={() => setInvSel(sel ? null : gi)}
                    onDoubleClick={() => onEquipToggle(it)}
                    onContextMenu={(e) => { e.preventDefault(); if (state.dockedAt) sellInventoryItem(it.instanceId); }}
                  />
                );
              })}

              {/* item tooltip, anchored to the clicked socket */}
              {selected && (() => {
                const d = R[selected.rarity];
                const fx = rareFx(selected.rarity);
                const i = invSel! - page * INV_PAGE, col = i % 8, row = Math.floor(i / 8);
                const CW = 654, CELL = (CW - 22 - 7 * 8) / 8, x = 11 + col * (CELL + 8) + CELL / 2, y = 11 + row * (CELL + 8) + CELL / 2;
                const GH = 22 + 3 * CELL + 2 * 8, TIPH = 214;
                const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
                const left = clamp(col < 4 ? x + 46 : x - 46 - 276, 4, CW - 280);
                const top = clamp(y - 52, 4, Math.max(4, GH - TIPH));
                const wash = rgba(d[0], 0.16), glow = rgba(d[0], 0.6);
                return (
                  <div style={{ position: "absolute", left, top, width: 276, zIndex: 30, padding: 7.5, boxSizing: "border-box", filter: `drop-shadow(0 4px 0 rgba(3,5,10,.92)) drop-shadow(0 9px 9px rgba(0,0,0,.75)) drop-shadow(0 18px 24px rgba(0,0,0,.6)) drop-shadow(0 0 22px ${glow})`, animation: "cSkTip .18s cubic-bezier(.2,.9,.25,1) both" }}>
                    <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))" }} />
                    <i style={{ position: "absolute", inset: 1.5, display: "block", background: `linear-gradient(135deg,${shadeHex(d[0], 0.55)},${shadeHex(d[0], -0.1)} 38%,${shadeHex(d[0], -0.5)} 72%,${shadeHex(d[0], -0.68)})`, clipPath: "polygon(0 0,calc(100% - 19.12px) 0,100% 19.12px,100% 100%,19.12px 100%,0 calc(100% - 19.12px))" }} />
                    <i style={{ position: "absolute", inset: 3, display: "block", background: `linear-gradient(135deg,${shadeHex(d[0], -0.2)},${shadeHex(d[0], -0.62)} 45%,${shadeHex(d[0], -0.82)})`, clipPath: "polygon(0 0,calc(100% - 18.24px) 0,100% 18.24px,100% 100%,18.24px 100%,0 calc(100% - 18.24px))" }} />
                    <i style={{ position: "absolute", inset: 4.5, display: "block", background: `linear-gradient(135deg,${shadeHex(d[0], -0.62)},${shadeHex(d[0], -0.88)} 60%,#05070b)`, clipPath: "polygon(0 0,calc(100% - 17.36px) 0,100% 17.36px,100% 100%,17.36px 100%,0 calc(100% - 17.36px))" }} />
                    <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 16.48px) 0,100% 16.48px,100% 100%,16.48px 100%,0 calc(100% - 16.48px))" }} />
                    <div style={{ position: "relative", zIndex: 1, overflow: "hidden", background: `radial-gradient(130% 100% at 50% -14%,${wash},transparent 74%),linear-gradient(180deg,#1e2632,#0c1119 62%,#05080d)`, boxShadow: "inset 0 5px 10px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(170,205,245,.16)", clipPath: "polygon(0 0,calc(100% - 15.6px) 0,100% 15.6px,100% 100%,15.6px 100%,0 calc(100% - 15.6px))" }}>
                      <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(76deg,transparent 0 11px,rgba(255,255,255,.045) 11px 12px,transparent 12px 23px),repeating-linear-gradient(-64deg,transparent 0 17px,rgba(255,255,255,.03) 17px 18px,transparent 18px 31px)", pointerEvents: "none" }} />
                      {fx.show === "block" && <i style={{ position: "absolute", inset: "-40%", background: fx.bg, filter: `blur(${fx.blur})`, animation: fx.anim, mixBlendMode: "screen", pointerEvents: "none" }} />}
                      {fx.sheen === "block" && (
                        <i style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                          <i style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "22%", background: "linear-gradient(100deg,transparent,rgba(236,255,255,.5),rgba(255,222,255,.34),transparent)", filter: "blur(4px)", animation: "cCelSheen 6.5s linear infinite" }} />
                        </i>
                      )}
                      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "10px 34px 10px 12px", borderBottom: "1px solid rgba(0,0,0,.55)", boxShadow: "0 1px 0 rgba(170,205,245,.1)", background: `linear-gradient(100deg,${wash},transparent 74%)` }}>
                        <i style={{ display: "block", width: 26, height: 23, flex: "0 0 auto", backgroundImage: `url(${selected.icon})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 7px ${glow})` }} />
                        <span style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
                          <b style={{ fontSize: 13.6, fontWeight: 700, color: "#f2f7ff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</b>
                          <small style={{ fontFamily: "var(--font-display)", fontSize: 8.3, letterSpacing: "0.18em", color: d[0] }}>{d[4]}</small>
                        </span>
                        <div style={{ position: "absolute", right: 11, top: 11 }}>
                          <CloseButton onClick={() => setInvSel(null)} size={22} fontSize={9} />
                        </div>
                      </div>
                      <div style={{ position: "relative", display: "grid", gap: 8, padding: "11px 12px 12px" }}>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(206,222,242,.78)" }}>
                          {selected.icon.includes("laser") ? "Emitter assembly — bolts onto any primary weapon mount and draws straight from the capacitor."
                            : selected.icon.includes("genshield") ? "Deflector core. Raises the shield ceiling and shortens the recharge window."
                            : selected.icon.includes("genspeed") ? "Drive tuning block. Trades hull mass for acceleration and warp spool."
                            : "Ship module. Slots into any free utility bay and runs off the auxiliary bus."}
                        </p>
                        <div style={{ display: "grid", gap: 4 }}>
                          {[
                            ["CATEGORY", activeLabel],
                            ["ITEM LEVEL", selected.ilvl ? String(selected.ilvl) : "—"],
                            [selected.qty ? "STACK" : "MARKET VALUE", selected.qty ? selected.qty.replace(/^×/, "") : selected.ilvl ? (selected.ilvl * 820).toLocaleString("en-US") + " MC" : "—"],
                          ].map(([k, v]) => (
                            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: "linear-gradient(180deg,#080d14,#04070c)", boxShadow: "inset 0 3px 5px rgba(0,0,0,.75),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.14)" }}>
                              <i style={{ width: 5, height: 5, background: d[0], boxShadow: `0 0 7px ${d[0]}`, transform: "rotate(45deg)" }} />
                              <small style={{ flex: 1, fontFamily: "'JetBrains Mono',monospace", fontSize: 10.6, letterSpacing: "0.06em", color: "rgba(186,210,236,.7)" }}>{k}</small>
                              <small style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.2, fontVariantNumeric: "tabular-nums", color: "#dbe9fb" }}>{v}</small>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* footer: selected readout · throw out · page switcher · gold buy-more-pages */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0, padding: "7px 11px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.62)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
                {selected ? (
                  <>
                    <i style={{ display: "block", width: 26, height: 22, flex: "0 0 auto", backgroundImage: `url(${selected.icon})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 7px ${R[selected.rarity][3]})` }} />
                    <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 14.2, fontWeight: 700, color: "#f4edff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</b>
                      <small style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.06em", color: R[selected.rarity][0] }}>
                        {R[selected.rarity][4]} · {activeLabel}{selected.ilvl ? ` · ILVL ${selected.ilvl}` : ""}
                      </small>
                    </span>
                  </>
                ) : (
                  <small style={{ fontSize: 14.2, color: "rgba(160,190,215,.45)" }}>Pick a slot to inspect it</small>
                )}
              </span>
              <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                <ThrowOutButton onClick={askThrow} enabled={!!selected} />
                {Array.from({ length: pageAccessible }, (_, p) => (
                  <PageButton key={p} label={`PAGE ${p + 1}`} on={page === p} accent={activeHex} onClick={() => { setPage(p); setInvSel(null); }} />
                ))}
                {!player.inventoryExtraPage && (
                  <BuyPageButton onClick={() => setBuyPageOpen(true)} />
                )}
              </div>
            </div>
          </div>
        </div>
      </PrintPortal>

      {buyPageOpen && (
        <BuyPageModal
          cost={750}
          mcoins={player.mcoins}
          buying={buying}
          error={buyError}
          onBuy={buyPage}
          onClose={() => { setBuyPageOpen(false); setBuyError(null); }}
        />
      )}
    </div>
  );
}

// ── Sockets: verbatim from the Kit's invSlots markup —
// style-hover="transform:translateY(-3px) scale(1.06);filter:brightness(1.22)"
// style-active="transform:translateY(2px) scale(.96)" — ported via usePressable
// since a plain onClick div carries no hover/press state of its own. ──

function EmptySlot({ onClick }: { onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const transform = active ? "translateY(2px) scale(.96)" : hover ? "translateY(-3px) scale(1.06)" : "none";
  const filter = active ? "brightness(1.32)" : hover ? "brightness(1.22)" : "brightness(1)";
  return (
    // The entrance animation (cInvRow) and the hover/active transform both
    // want to drive `transform` on the same element — a keyframe with
    // animation-fill-mode "both" keeps governing the property after it
    // finishes, permanently overriding any inline transform set afterward.
    // Splitting them onto two nested elements (outer plays the one-shot
    // entrance, inner carries the live hover/active transform) avoids the
    // conflict entirely.
    <div style={{ "--sk": "74px", width: "100%", aspectRatio: "1", animation: "cInvRow .34s cubic-bezier(.2,.9,.25,1) both" } as React.CSSProperties}>
      <div
        role="button" aria-label="Empty slot" onClick={onClick} {...handlers}
        style={{
          position: "relative", width: "100%", height: "100%", padding: "calc(var(--sk)*0.0625)", boxSizing: "border-box",
          background: "linear-gradient(150deg,rgba(255,255,255,.5),rgba(255,255,255,.2) 45%,rgba(0,0,0,.5))",
          clipPath: HEX, cursor: "pointer",
          boxShadow: "inset 0 4px 6px rgba(0,0,0,.6),inset 0 -1px 0 rgba(143,176,208,.22)",
          transition: "transform .16s ease,filter .16s ease", transform, filter,
        } as React.CSSProperties}
      >
        <div style={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center", background: "radial-gradient(130% 100% at 50% -12%,rgba(170,205,245,.22),transparent 70%),linear-gradient(180deg,#222a36,#0b0e16)", clipPath: HEX }}>
          <b style={{ position: "relative", display: "grid", fontFamily: "var(--font-display)", fontSize: "calc(var(--sk, 74px)*0.22)", fontWeight: 800, color: "rgba(170,200,230,.45)" }}>+</b>
        </div>
      </div>
    </div>
  );
}

function ItemSlot({
  it, sel, onClick, onDoubleClick, onContextMenu,
}: {
  it: InvItem; sel: boolean; onClick: () => void; onDoubleClick: () => void; onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { hover, active, handlers } = usePressable();
  const d = R[it.rarity];
  const fx = rareFx(it.rarity);
  const transform = active ? "translateY(2px) scale(.96)" : hover ? "translateY(-3px) scale(1.06)" : "none";
  const brightness = active ? 1.32 : hover ? 1.22 : sel ? 1.18 : 1;
  return (
    // See EmptySlot's comment: the entrance animation and hover/active
    // transform can't share one element without the fill-mode "both"
    // keyframe end-state (transform:none) permanently winning over the
    // inline hover/active transform.
    <div style={{ "--sk": "74px", width: "100%", aspectRatio: "1", animation: "cInvRow .34s cubic-bezier(.2,.9,.25,1) both" } as React.CSSProperties}>
    <div
      role="button" aria-label={`${it.name} · ${d[4]}`}
      onClick={onClick} onDoubleClick={onDoubleClick} onContextMenu={onContextMenu} {...handlers}
      style={{
        position: "relative", width: "100%", height: "100%", padding: "calc(var(--sk)*0.0625)", boxSizing: "border-box",
        background: `linear-gradient(150deg,${shadeHex(d[0], 0.45)},${d[0]} 45%,${shadeHex(d[0], -0.55)})`,
        clipPath: HEX, cursor: "pointer",
        boxShadow: sel
          ? "0 0 " + (parseInt(d[2], 10) + 14) + "px rgba(77,227,255,.75),inset 0 4px 6px rgba(0,0,0,.6),inset 0 -1px 0 rgba(143,176,208,.25)"
          : `0 0 ${d[2]} ${d[3]},inset 0 4px 6px rgba(0,0,0,.6),inset 0 -1px 0 rgba(143,176,208,.25)`,
        transition: "transform .16s ease,filter .16s ease",
        transform, filter: `brightness(${brightness})`,
      } as React.CSSProperties}
    >
      <div
        style={{
          position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center", overflow: "hidden",
          background: `radial-gradient(130% 100% at 50% -12%,${rgba(d[0], 0.24)},transparent 72%),linear-gradient(180deg,#2b3442,${RECESS[it.rarity]})`,
          clipPath: HEX,
        }}
      >
        <i style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#ffffff,#8592a8)", opacity: 0.9, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: "2%", background: "linear-gradient(135deg,#c3cedd,#414c5e)", opacity: 0.8, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: "3.75%", background: "linear-gradient(135deg,#5b6678,#1a1e26)", opacity: 0.85, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: "5.5%", background: "linear-gradient(135deg,#242a34,#000000)", opacity: 0.9, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: "7.5%", background: "linear-gradient(135deg,#0c0e12,#000000)", opacity: 0.8, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: "9.25%", background: "linear-gradient(135deg,#2a303c,#0d0f14)", opacity: 0.6, clipPath: HEX }} />
        {/* recess punch-through — hollows the facet stack back out to the dark
            recess color before the icon draws, so the bevel reads as machined
            into the socket instead of a flat gradient all the way to center */}
        <i style={{ position: "absolute", inset: "7.25%", background: `radial-gradient(130% 100% at 50% -12%,${rgba(d[0], 0.24)},transparent 72%),linear-gradient(180deg,#2b3442,${RECESS[it.rarity]})`, clipPath: HEX }} />
        <i style={{ position: "absolute", inset: 0, margin: "auto", width: "56%", height: "56%", background: d[0], opacity: 0.28, boxShadow: `0 0 10px ${d[0]}`, clipPath: HEX }} />
        {sel && (
          <>
            <i style={{ position: "absolute", inset: "5.5%", background: "radial-gradient(closest-side,rgba(77,227,255,.42),rgba(77,227,255,.18) 58%,rgba(77,227,255,.05) 82%,transparent)", animation: "cPulse 1.6s ease-in-out infinite", clipPath: HEX, pointerEvents: "none", zIndex: 4, mixBlendMode: "screen" }} />
            <i style={{ position: "absolute", inset: "5.5%", background: "linear-gradient(180deg,rgba(182,240,255,.3),transparent 42%,rgba(77,227,255,.22))", animation: "cPulse 2.4s ease-in-out infinite", clipPath: HEX, pointerEvents: "none", zIndex: 4, mixBlendMode: "screen" }} />
          </>
        )}
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(200,235,255,.05) 0 1px,transparent 1px 3px)", clipPath: HEX, pointerEvents: "none" }} />
        {fx.show === "block" && (
          <i style={{ position: "absolute", inset: "7.25%", background: fx.bg, filter: `blur(${fx.blur})`, animation: fx.anim, clipPath: HEX, mixBlendMode: "screen", pointerEvents: "none", zIndex: 5 }} />
        )}
        {fx.sheen === "block" && (
          <i style={{ position: "absolute", inset: "7.25%", overflow: "hidden", clipPath: HEX, pointerEvents: "none", zIndex: 6 }}>
            <i style={{ position: "absolute", top: "-20%", bottom: "-20%", left: 0, width: "26%", background: "linear-gradient(100deg,transparent,rgba(240,255,255,.85),rgba(255,226,255,.6),transparent)", filter: "blur(2px)", animation: "cCelSheen 5s linear infinite" }} />
          </i>
        )}
        <i style={{ position: "relative", display: "block", width: "78%", height: "66%", backgroundImage: `url(${it.icon})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center", filter: `drop-shadow(0 0 8px ${d[3]}) drop-shadow(0 2px 3px rgba(0,0,0,.75))`, zIndex: 3 }} />
        {it.qty && (
          <small style={{ position: "absolute", left: 0, right: 0, bottom: "14.5%", textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "calc(var(--sk, 74px)*0.115)", fontWeight: 700, color: "rgba(232,244,255,.62)", textShadow: "0 1px 2px rgba(0,0,0,.85)", zIndex: 6, pointerEvents: "none" }}>
            {it.qty.replace(/^×/, "")}
          </small>
        )}
      </div>
    </div>
    </div>
  );
}

// ── Buttons: hover/press states reproduce the Kit's style-hover/style-active
// runtime directive (support.js), which only exists in the Design preview. ──

function TabButton({ children, on, hex, disabled, onClick, title }: { children: React.ReactNode; on: boolean; hex: string; disabled?: boolean; onClick: () => void; title?: string }) {
  const { hover, active, handlers } = usePressable();
  const bg = disabled ? "transparent" : hover ? "rgba(184,102,255,.14)" : on ? `linear-gradient(180deg,${rgba(hex, 0.2)},${rgba(hex, 0.05)} 55%,transparent)` : "transparent";
  const brightness = !disabled && active ? 1.35 : !disabled && hover ? 1.1 : 1;
  return (
    <button
      disabled={disabled} onClick={onClick} title={title} {...handlers}
      style={{
        flex: 1, position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: "10px 4px", border: "none", borderLeft: "1px solid rgba(150,195,235,.12)",
        background: bg, color: on ? "#f2f7ff" : "rgba(206,220,238,.6)",
        fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.14em", fontWeight: 700,
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
        transform: !disabled && active ? "translateY(1px) scale(.98)" : !disabled && hover ? "translateY(-2px)" : "none",
        filter: `brightness(${brightness})`,
        boxShadow: "inset 0 3px 6px rgba(0,0,0,.35)", transition: "background .22s ease,color .22s ease,transform .14s ease,filter .14s ease",
      }}
    >
      {children}
    </button>
  );
}

function ChipButton({ children, on, accent, onClick }: { children: React.ReactNode; on: boolean; accent: string; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const glow = active
    ? `drop-shadow(0 1px 0 rgba(3,5,10,.9)) brightness(1.4)`
    : hover
    ? `drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 0 10px ${rgba(accent, 0.55)}) brightness(1.2)`
    : "none";
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        padding: "4px 9px", border: `1px solid ${on ? rgba(accent, 0.5) : "rgba(255,255,255,.09)"}`,
        background: on ? rgba(accent, 0.2) : "transparent",
        color: on ? "#f2f7ff" : "rgba(206,220,238,.6)",
        fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.14em", fontWeight: 700, cursor: "pointer",
        transform: active ? "translateY(1px) scale(.97)" : hover ? "translateY(-1px)" : "none",
        filter: glow,
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      {children}
    </button>
  );
}

function SortButton() {
  const { hover, active, handlers } = usePressable();
  const glow = active
    ? "drop-shadow(0 1px 0 rgba(3,5,10,.9)) brightness(1.4)"
    : hover
    ? "drop-shadow(0 3px 0 rgba(3,5,10,.9)) drop-shadow(0 0 12px rgba(184,102,255,.5)) brightness(1.15)"
    : "none";
  return (
    <button
      {...handlers}
      style={{
        flex: "0 0 auto", padding: "5px 10px", border: `1px solid ${hover ? "rgba(184,102,255,.6)" : "rgba(255,255,255,.12)"}`,
        background: "rgba(14,10,24,.7)", color: hover ? "#ecd6ff" : "rgba(206,226,246,.8)",
        fontFamily: "var(--font-display)", fontSize: 9.4, letterSpacing: "0.16em", fontWeight: 700, cursor: "pointer",
        transform: active ? "translateY(1px) scale(.97)" : hover ? "translateY(-1px)" : "none", filter: glow,
        transition: "all .15s ease",
      }}
    >
      SORT ▾
    </button>
  );
}

function ThrowOutButton({ onClick, enabled }: { onClick: () => void; enabled: boolean }) {
  return (
    <KitPillButton
      onClick={onClick}
      disabled={!enabled}
      tone={{
        rim: enabled ? "linear-gradient(150deg,#ffdfe3,#a8505c 45%,#2c1015)" : "linear-gradient(150deg,#4a3238,#1a0e10)",
        mid: enabled ? "linear-gradient(150deg,#7c3540,#1a0a0e)" : "linear-gradient(150deg,#2a1c1e,#0e0708)",
        bg: enabled ? "linear-gradient(180deg,rgba(255,77,94,.2),rgba(12,6,10,.94))" : "rgba(12,10,18,.6)",
        color: enabled ? "#ffd0d5" : "rgba(200,180,200,.35)",
        spec: "rgba(255,214,220,.7)",
        under: enabled ? "#ff4d5e" : "transparent",
      }}
      icon={<i style={{ position: "relative", fontStyle: "normal", fontSize: 13 }}>⌫</i>}
    >
      THROW OUT
    </KitPillButton>
  );
}

function PageButton({ label, on, accent, onClick }: { label: string; on: boolean; accent: string; onClick: () => void }) {
  return (
    <KitPillButton
      onClick={onClick}
      tone={{
        rim: on ? `linear-gradient(150deg,${shadeHex(accent, 0.55)},${accent} 46%,${shadeHex(accent, -0.6)})` : "linear-gradient(150deg,#dfe6ef,#8b95a5 45%,#2a323d)",
        mid: on ? `linear-gradient(150deg,${shadeHex(accent, -0.25)},${shadeHex(accent, -0.75)})` : "linear-gradient(150deg,#4f5a6b,#161b22)",
        bg: on ? `linear-gradient(180deg,${rgba(accent, 0.3)},rgba(8,10,16,.96))` : "linear-gradient(180deg,rgba(150,190,235,.07),rgba(9,8,15,.96))",
        color: on ? "#f2f7ff" : "rgba(206,220,238,.6)",
        spec: on ? shadeHex(accent, 0.6) : "rgba(210,226,246,.55)",
        under: on ? accent : "transparent",
      }}
    >
      {label}
    </KitPillButton>
  );
}

function BuyPageButton({ onClick }: { onClick: () => void }) {
  return (
    <KitPillButton
      onClick={onClick}
      title="Unlock a 3rd inventory page"
      animation="cGoldGlow 2.6s ease-in-out infinite"
      tone={{
        rim: "linear-gradient(150deg,#fff4d2,#e8b94d 46%,#6b4d0c)",
        mid: "linear-gradient(150deg,#c99a2e,#3a2a06)",
        bg: "linear-gradient(180deg,rgba(232,185,77,.22),rgba(12,8,4,.95))",
        color: "#f5dda6",
        spec: "rgba(255,244,214,.8)",
        under: "#e8b94d",
      }}
      icon={<i style={{ position: "relative", fontStyle: "normal", fontSize: 13, color: "#4ee2ff", textShadow: "0 0 8px rgba(78,226,255,.7)" }}>◆</i>}
    >
      PAGE 3 · 750 MC
      <i style={{ position: "absolute", top: 0, left: "-45%", width: "30%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(255,244,214,.4),transparent)", transform: "skewX(-18deg)", animation: "cSweep 3.2s ease-in-out infinite" }} />
      <i style={{ position: "relative", fontStyle: "normal", fontSize: 15.3, fontWeight: 900, background: "linear-gradient(168deg,#fff4d2,#ffe08a 26%,#e8b94d 52%,#a97c1c 74%,#ffe6a8 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "cTopUp 2.2s ease-in-out infinite" }}>+</i>
    </KitPillButton>
  );
}

// Gold-themed confirm/insufficient-funds popup for the Page 3 purchase.
// Built from the same KitDialog chrome as the destroy-item confirm — same
// frame, same header, same button grid — just the gold accent.
function BuyPageModal({ cost, mcoins, buying, error, onBuy, onClose }: { cost: number; mcoins: number; buying: boolean; error: string | null; onBuy: () => void; onClose: () => void }) {
  const canAfford = mcoins >= cost;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "auto" }}>
      <KitDialog accent="gold" title="UNLOCK CARGO PAGE 3" onDismiss={onClose}>
        {canAfford ? (
          <>
            <p style={{ margin: "0 0 6px", fontSize: 14.8, lineHeight: 1.55, color: "rgba(240,232,224,.9)" }}>
              Unlock a permanent 3rd inventory page for <b style={{ color: "#ffe08a" }}>{cost} MC</b>.
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5, color: "rgba(226,214,196,.6)" }}>You have {mcoins.toLocaleString("en-US")} MC.</p>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 6px", fontSize: 14.8, lineHeight: 1.55, color: "rgba(240,232,224,.9)" }}>
              Not enough MCoins — you need <b style={{ color: "#ffe08a" }}>{cost} MC</b>, you have {mcoins.toLocaleString("en-US")}.
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5, color: "rgba(226,214,196,.6)" }}>Top up your MCoins balance to continue.</p>
          </>
        )}
        {error && <p style={{ margin: "0 0 10px", fontSize: 13, color: "#ff9fa8" }}>{error}</p>}
        {canAfford ? (
          <KitDialogActions left={{ label: buying ? "…" : "BUY", onClick: onBuy, disabled: buying, tone: "gold" }} right={{ label: "CANCEL", onClick: onClose }} />
        ) : (
          <KitDialogActions left={{ label: "TOP UP", onClick: () => {}, disabled: true, tone: "gold" }} right={{ label: "CANCEL", onClick: onClose }} />
        )}
      </KitDialog>
    </div>
  );
}
