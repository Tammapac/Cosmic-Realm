import React from "react";
import styles from "./HangarDockOverlay.module.css";
import { HeroFrame, PanelHeader, TabIndicator } from "./HeroFrame";
import { CtaButton } from "./CtaButton";
import { RARITY } from "./rarity";
import {
  MARKET_ITEMS, MARKET_CATEGORIES, CAT_GLYPH, SELL_RATIO, LOW_STOCK,
  QTY_PRESETS, MARKET_PANEL_W, MARKET_TAB_PCT,
  type MarketItem, type MarketCatTab,
} from "./Market.constants";

/**
 * S-07 · Market
 *
 * MIGRATED from the design export, not rebuilt:
 *   Downloads/Cosmic Realm UI Upgrade (6).zip
 *     -> design_handoff_hangar_panels_strict_export/Cosmic Components.dc.html
 *        (section "S-07 · MARKET")
 *
 * Two-column terminal, verbatim: `1fr 380px` — a sortable/searchable/filterable
 * commodity list on the left, the per-item detail terminal on the right.
 *
 * Derived values follow the export exactly:
 *   sell price = round(price * 0.88)   (SELL_RATIO — the dealer spread)
 *   P&L        = price - base
 *   sparkline  = each sample as a % of that row's own max, not a global max
 *
 * Sorting is by the raw numbers (price / stock / P&L), not the formatted
 * strings, so "1,180" does not sort next to "112".
 */

// The export writes "font-family:Orbitron,sans-serif" literally on 154 rules.
// NOT var(--font-display): that token is the project's Kenney Future Narrow,
// whose U+2039/U+203A chevrons are round — the carousel arrows then read as
// circles instead of the design's sharp angular arrows. Orbitron is loaded in
// index.html for exactly this reason.
const display: React.CSSProperties = { fontFamily: "Orbitron,sans-serif" };
// The export writes "font-family:'JetBrains Mono',monospace" on 86 rules.
// --font-mono was never defined anywhere in this project, so this resolved
// to nothing and every figure fell back to the browser default.
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono',monospace" };

type SortKey = "price" | "stock" | "profit";

/** The export's commodity-table grid (s07.html), shared by head and rows:
 *  glyph · name · BUY · SELL · TREND · STOCK · P/L. */
const MARKET_GRID = "28px 1fr 62px 62px 108px 60px 66px";

export interface MarketPanelProps {
  items?: MarketItem[];
  /** Station identity — the export's header is "{{ marketStation.name }} ·
   *  TRADE HUB · SECTOR {{ … }}", i.e. the station you are docked at, not a
   *  generic board title. */
  stationName?: string;
  stationSector?: string;
  /** Station cargo fill, shown in the header bar. */
  cargoUsed?: number;
  cargoCap?: number;
  credits?: number;
  onBuy?: (item: MarketItem, qty: number) => void;
  onSell?: (item: MarketItem, qty: number) => void;
  onSellAll?: () => void;
  onClose?: () => void;
}

/** 10-cycle price history. Bars are scaled to the row's own peak. */
function Sparkline({ spark, color, width = 54, height = 16 }: { spark: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...spark);
  return (
    <span style={{ display: "flex", alignItems: "flex-end", gap: 1, width, height }}>
      {spark.map((v, i) => (
        <i
          key={i}
          style={{
            flex: 1, height: `${Math.round((v / max) * 100)}%`,
            background: color, opacity: 0.35 + (i / spark.length) * 0.65,
          }}
        />
      ))}
    </span>
  );
}

export function MarketPanel({
  items = MARKET_ITEMS,
  stationName = "NOVA REACH STATION",
  stationSector = "SYS-04A",
  cargoUsed = 61,
  cargoCap = 525,
  credits = 197035160,
  onBuy, onSell, onSellAll, onClose,
}: MarketPanelProps) {
  const [cat, setCat] = React.useState<MarketCatTab>("ALL");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [selIdx, setSelIdx] = React.useState(0);
  const [qty, setQty] = React.useState(1);

  const rows = React.useMemo(() => {
    const q = query.toLowerCase();
    let list = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => item.name.toLowerCase().includes(q) && (cat === "ALL" || item.cat === cat));
    if (sort) {
      list = list.slice().sort((a, b) => {
        const val = (x: MarketItem) =>
          sort.key === "price" ? x.price : sort.key === "stock" ? x.stock : x.price - x.base;
        return (val(a.item) - val(b.item)) * sort.dir;
      });
    }
    return list;
  }, [items, query, cat, sort]);

  const sel = items[Math.min(selIdx, items.length - 1)];
  const selR = RARITY[sel.rarity];
  const sellPrice = Math.round(sel.price * SELL_RATIO);
  const pctVsBase = Math.round(((sel.price - sel.base) / sel.base) * 100);
  const canSell = sel.held > 0;
  const clampedQty = Math.max(1, Math.min(sel.stock, qty));
  const catIdx = MARKET_CATEGORIES.indexOf(cat);
  const cargoPct = Math.round((cargoUsed / cargoCap) * 100);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }));

  // Column-head styles, the export's own values (s07.html). Note font-family is
  // `inherit` there, NOT Orbitron — the heads pick up the panel body face.
  const thLabel: React.CSSProperties = {
    fontSize: 8, letterSpacing: ".16em", fontWeight: 700,
    color: "rgba(210,190,175,.55)",
  };
  const th: React.CSSProperties = {
    fontSize: 8, letterSpacing: ".14em", fontWeight: 700,
    color: "rgba(210,190,175,.55)", background: "none", border: "none",
    cursor: "pointer", padding: 0, textAlign: "right", fontFamily: "inherit",
    transition: "color .15s ease",
  };

  return (
    <div
      style={{
        position: "relative", padding: "40px 24px", display: "grid", placeItems: "center",
        background: "radial-gradient(600px 360px at 50% 26%,rgba(255,138,61,.1),transparent 70%),#05040a",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,.6)",
      }}
    >
      <HeroFrame width={MARKET_PANEL_W} chamfer={22}>
        <PanelHeader glyph="$" title="MARKET" onClose={onClose} closeLabel="Close market" />

        {/* title row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px 8px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <b style={{ ...display, fontSize: 14, letterSpacing: ".06em", color: "#ffb673", textShadow: "0 0 10px rgba(255,138,61,.6)" }}>
              {stationName}
            </b>
            <span style={{ padding: "2px 7px", ...display, fontSize: 8, fontWeight: 700, letterSpacing: ".08em", color: "#ffd9b8", border: "1px solid rgba(255,138,61,.4)", background: "rgba(255,138,61,.14)" }}>
              TRADE HUB
            </span>
            <small style={{ fontSize: 8.5, letterSpacing: ".06em", color: "rgba(210,190,175,.6)" }}>SECTOR · {stationSector}</small>
          </div>
          <span style={{ padding: "6px 10px", border: "1px solid rgba(255,138,61,.35)", background: "rgba(255,138,61,.08)", ...mono, fontSize: 9.5, fontWeight: 700, color: "#e8b94d" }}>
            CREDITS {credits.toLocaleString("en-US")}
          </span>
        </div>

        {/* cargo bar + sell all */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 20px 10px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <small style={{ fontSize: 8.5, letterSpacing: ".2em", color: "rgba(210,190,175,.6)", fontWeight: 700 }}>CARGO</small>
            <i style={{ position: "relative", flex: 1, height: 6, background: "rgba(0,0,0,.5)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.7)" }}>
              <i style={{ position: "absolute", inset: 0, width: `${cargoPct}%`, background: "linear-gradient(90deg,#c9701f,#ff8a3d)", boxShadow: "0 0 8px rgba(255,138,61,.6)" }} />
            </i>
            <small style={{ ...mono, fontSize: 9, color: "rgba(226,212,198,.7)", whiteSpace: "nowrap" }}>
              {cargoUsed} / {cargoCap} t
            </small>
          </div>
          <CtaButton hex="#ff4d5e" label="SELL ALL CARGO" textColor="#ffe2e5" onClick={onSellAll} />
        </div>

        {/* two-column body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, padding: "0 20px 20px", alignItems: "start" }}>
          {/* commodity list */}
          <div
            style={{
              border: "1px solid rgba(255,138,61,.3)",
              background: "linear-gradient(180deg,#0b0710,#050308)",
              boxShadow: "inset 0 3px 8px rgba(0,0,0,.7)",
              clipPath: "polygon(14px 0,100% 0,100% 100%,0 100%,0 14px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,138,61,.16)" }}>
              <div
                style={{
                  position: "relative", flex: 1, display: "flex", alignItems: "stretch", gap: 1, overflow: "hidden",
                  background: "rgba(4,8,16,.55)",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)",
                }}
              >
                {MARKET_CATEGORIES.map((c) => {
                  const on = cat === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCat(c)}
                      className={styles.tabBtn}
                      style={{
                        position: "relative", zIndex: 2, flex: 1, padding: "8px 4px", border: "none",
                        background: on ? "rgba(255,138,61,.14)" : "none",
                        color: on ? "#ffd9b8" : "rgba(226,210,196,.72)",
                        ...display, fontSize: 8.5, letterSpacing: ".1em", fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
                {catIdx >= 0 && (
                  <>
                    <TabIndicator leftPct={catIdx * MARKET_TAB_PCT} widthPct={MARKET_TAB_PCT} edge="top" />
                    <TabIndicator leftPct={catIdx * MARKET_TAB_PCT} widthPct={MARKET_TAB_PCT} edge="bottom" />
                  </>
                )}
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commodities…"
                aria-label="Search commodities"
                style={{
                  width: 170, boxSizing: "border-box", padding: "8px 10px",
                  border: "1px solid rgba(255,138,61,.25)",
                  background: "rgba(4,8,16,.6)", color: "#f2ece0",
                  ...mono, fontSize: 9.5, outline: "none",
                }}
              />
            </div>

            {/* column heads — the export's own 7-column grid (s07.html):
                28px glyph · 1fr name · 62px BUY · 62px SELL · 108px TREND ·
                60px STOCK · 66px P/L. BUY/STOCK/P/L are sort buttons, SELL and
                TREND are plain labels. */}
            <div style={{ display: "grid", gridTemplateColumns: MARKET_GRID, gap: 8, alignItems: "center", padding: "8px 14px", borderBottom: "1px solid rgba(255,138,61,.16)" }}>
              <span />
              <small style={{ fontSize: 8, letterSpacing: ".16em", fontWeight: 700, color: "rgba(210,190,175,.55)" }}>COMMODITY</small>
              <button style={th} className={styles.textBtn} onClick={() => toggleSort("price")}>BUY {sort?.key === "price" ? (sort.dir === 1 ? "▲" : "▼") : ""}</button>
              <small style={{ ...thLabel, textAlign: "right" }}>SELL</small>
              <small style={thLabel}>TREND</small>
              <button style={th} className={styles.textBtn} onClick={() => toggleSort("stock")}>STOCK {sort?.key === "stock" ? (sort.dir === 1 ? "▲" : "▼") : ""}</button>
              <button style={th} className={styles.textBtn} onClick={() => toggleSort("profit")}>P/L {sort?.key === "profit" ? (sort.dir === 1 ? "▲" : "▼") : ""}</button>
            </div>

            <div style={{ maxHeight: 430, overflowY: "auto" }}>
              {rows.map(({ item, i }) => {
                const r = RARITY[item.rarity];
                const on = i === selIdx;
                const profit = item.price - item.base;
                const low = item.stock / item.stockMax < LOW_STOCK;
                return (
                  <div
                    key={item.name}
                    onClick={() => { setSelIdx(i); setQty(1); }}
                    className={styles.rowBtn}
                    style={{
                      display: "grid", gridTemplateColumns: MARKET_GRID, gap: 8,
                      alignItems: "center", padding: "8px 14px", cursor: "pointer",
                      borderLeft: `2px solid ${on ? "#ffd9b8" : r.hex}`,
                      background: on ? "rgba(255,138,61,.1)" : "transparent",
                      borderBottom: "1px solid rgba(255,255,255,.04)",
                      transition: "background .15s ease",
                    }}
                  >
                    {/* hex glyph cell — its own column in the export, not inline
                        with the name */}
                    <i
                      style={{
                        display: "grid", placeItems: "center", width: 26, height: 26,
                        fontStyle: "normal", fontSize: 11, fontWeight: 800, color: r.hex,
                        background: "#05070d", border: `1px solid ${r.hex}88`,
                        clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)",
                        textShadow: `0 0 6px ${r.hex}`,
                      }}
                    >
                      {CAT_GLYPH[item.cat]}
                    </i>
                    <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 11, color: "#f2ece0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</b>
                      <small style={{ fontSize: 7.5, letterSpacing: ".1em", color: r.hex }}>{item.cat}</small>
                    </span>
                    <b style={{ ...mono, fontSize: 9.5, color: "#e8b94d", textAlign: "right" }}>{item.price.toLocaleString("en-US")}</b>
                    {/* SELL price — the export shows what the station pays, at
                        SELL_RATIO of the buy price. This column was missing. */}
                    <b style={{ ...mono, fontSize: 9.5, color: "#5cff8a", textAlign: "right" }}>
                      {Math.round(item.price * SELL_RATIO).toLocaleString("en-US")}
                    </b>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Sparkline spark={item.spark} color={item.trend > 0 ? "#5cff8a" : "#ff4d5e"} width={86} height={14} />
                      <i style={{ fontStyle: "normal", fontSize: 8, color: item.trend > 0 ? "#5cff8a" : "#ff4d5e" }}>{item.trend > 0 ? "▲" : "▼"}</i>
                    </span>
                    <small style={{ ...mono, fontSize: 8.5, textAlign: "right", color: low ? "#ff8a94" : "rgba(226,212,198,.7)" }}>
                      {item.stock.toLocaleString("en-US")}
                    </small>
                    <small style={{ ...mono, fontSize: 8.5, textAlign: "right", color: profit >= 0 ? "#5cff8a" : "#ff4d5e" }}>
                      {profit >= 0 ? "+" : ""}{profit.toLocaleString("en-US")}
                    </small>
                  </div>
                );
              })}
            </div>
          </div>

          {/* detail terminal */}
          <div
            style={{
              border: "1px solid rgba(255,138,61,.3)",
              background: "linear-gradient(180deg,#0b0710,#050308)",
              boxShadow: "inset 0 3px 8px rgba(0,0,0,.7)",
              clipPath: "polygon(14px 0,100% 0,100% 100%,0 100%,0 14px)",
              display: "grid", gap: 12, padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <i
                style={{
                  display: "grid", placeItems: "center", width: 34, height: 34,
                  fontStyle: "normal", fontSize: 15, fontWeight: 800, color: selR.hex,
                  background: "#05070d", border: `1px solid ${selR.hex}88`,
                  clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)",
                  textShadow: `0 0 8px ${selR.hex}`,
                }}
              >
                {CAT_GLYPH[sel.cat]}
              </i>
              <span style={{ display: "grid", gap: 2 }}>
                <b style={{ ...display, fontSize: 14, color: "#fbe9d8" }}>{sel.name}</b>
                <small style={{ fontSize: 8.5, letterSpacing: ".14em", fontWeight: 700, color: selR.hex }}>{sel.cat}</small>
              </span>
            </div>

            {/* BUY AT / SELL AT — the export's big 24px figures side by side with
                the delta pushed right, not two boxed ASK/BID wells. */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
              <span style={{ display: "grid", gap: 1 }}>
                <small style={{ fontSize: 8, letterSpacing: ".14em", fontWeight: 700, color: "rgba(210,190,175,.55)" }}>BUY AT</small>
                <b style={{ ...mono, fontSize: 24, color: "#fff2e2" }}>{sel.price.toLocaleString("en-US")}</b>
              </span>
              <span style={{ display: "grid", gap: 1 }}>
                <small style={{ fontSize: 8, letterSpacing: ".14em", fontWeight: 700, color: "rgba(210,190,175,.55)" }}>SELL AT</small>
                <b style={{ ...mono, fontSize: 24, color: "#5cff8a" }}>{sellPrice.toLocaleString("en-US")}</b>
              </span>
              <small style={{ ...mono, fontSize: 10, marginLeft: "auto", color: pctVsBase >= 0 ? "#5cff8a" : "#ff4d5e" }}>
                {pctVsBase >= 0 ? "+" : ""}{pctVsBase}% vs base
              </small>
            </div>

            <div style={{ display: "grid", gap: 5 }}>
              <small style={{ fontSize: 7.5, letterSpacing: ".14em", fontWeight: 700, color: "rgba(210,190,175,.55)" }}>PRICE · LAST 10 CYCLES</small>
              <Sparkline spark={sel.spark} color={sel.trend > 0 ? "#5cff8a" : "#ff4d5e"} width={348} height={44} />
            </div>

            <div style={{ display: "grid", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <small style={{ fontSize: 8, letterSpacing: ".1em", fontWeight: 700, color: "rgba(210,190,175,.55)" }}>AT STATION</small>
                <small style={{ ...mono, fontSize: 9, textAlign: "right", color: "rgba(226,212,198,.7)" }}>
                  {sel.stock.toLocaleString("en-US")} units · you hold {sel.held.toLocaleString("en-US")}
                </small>
              </div>
              <i style={{ display: "block", position: "relative", height: 6, background: "rgba(0,0,0,.5)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.7)" }}>
                <i style={{ display: "block", height: "100%", width: `${Math.round((sel.stock / sel.stockMax) * 100)}%`, background: "linear-gradient(90deg,#1c8fb0,#4ee2ff)", boxShadow: "0 0 8px rgba(78,226,255,.6)" }} />
              </i>
            </div>

            {/* quantity stepper */}
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" className={styles.chipBtn}
                  style={{ width: 26, height: 26, border: "1px solid rgba(255,138,61,.35)", background: "rgba(255,138,61,.08)", color: "#ffd9b8", ...mono, fontSize: 12, cursor: "pointer" }}>−</button>
                <b style={{ flex: 1, textAlign: "center", ...mono, fontSize: 12, color: "#fff6ea" }}>{clampedQty.toLocaleString("en-US")}</b>
                <button onClick={() => setQty((q) => Math.min(sel.stock, q + 1))} aria-label="Increase quantity" className={styles.chipBtn}
                  style={{ width: 26, height: 26, border: "1px solid rgba(255,138,61,.35)", background: "rgba(255,138,61,.08)", color: "#ffd9b8", ...mono, fontSize: 12, cursor: "pointer" }}>+</button>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {QTY_PRESETS.map((p) => (
                  <button key={p} onClick={() => setQty(p)} className={styles.chipBtn}
                    style={{ flex: 1, padding: "5px 0", border: "1px solid rgba(255,138,61,.25)", background: "rgba(255,138,61,.06)", color: "rgba(226,212,198,.8)", ...mono, fontSize: 8.5, cursor: "pointer" }}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setQty(sel.stock)} className={styles.chipBtn}
                  style={{ flex: 1, padding: "5px 0", border: "1px solid rgba(255,138,61,.25)", background: "rgba(255,138,61,.06)", color: "rgba(226,212,198,.8)", ...mono, fontSize: 8.5, cursor: "pointer" }}>
                  MAX
                </button>
              </div>
            </div>

            {/* The export carries the total INSIDE each button — "BUY 1" plus
                "11 CR" — rather than a TOTAL label stacked above it. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <CtaButton
                hex="#5cff8a"
                label={`BUY ${clampedQty.toLocaleString("en-US")}`}
                suffix={`${(sel.price * clampedQty).toLocaleString("en-US")} CR`}
                textColor="#eaffef" selected
                onClick={() => onBuy?.(sel, clampedQty)}
                style={{ width: "100%" }}
              />
              <CtaButton
                hex="#ff4d5e"
                label={`SELL ${clampedQty.toLocaleString("en-US")}`}
                suffix={`${(sellPrice * clampedQty).toLocaleString("en-US")} CR`}
                textColor={canSell ? "#ffe2e5" : "rgba(200,190,220,.5)"}
                dim={!canSell}
                onClick={() => onSell?.(sel, clampedQty)}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      </HeroFrame>
    </div>
  );
}
