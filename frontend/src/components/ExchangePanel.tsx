// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, E-01 ·
// FINANCIAL EXCHANGE section — HTML template ~line 943, FIN_STOCKS/
// finHistory ~line 5083, financeVals() state builder ~line 6824). 34 faction
// stocks, hourly seeded price walk, live line chart, buy/sell order ticket,
// portfolio P&L, and a credit line with escalating weekly interest.
//
// All data is real: GET /api/exchange (backend/src/routes/exchange.ts,
// backend/src/game/exchangeData.ts) computes the exact same deterministic
// seeded walk server-side and is the sole source of truth for prices,
// holdings, and debt — trade/loan/repay all hit server-authoritative
// endpoints, never client-side balance math. Credit line runs 1:1 on the
// player's real credits balance (no separate exchange currency).
import { useEffect, useMemo, useState } from "react";
import { useGame, state as gameState, bump, save } from "../game/store";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";
import { getExchange, tradeExchange, takeExchangeLoan, repayExchangeLoan, toggleExchangePremium } from "../net/api";

const ACCENT = "#e8b94d";

function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16 & 255) + Math.round(255 * amt);
  let g = (n >> 8 & 255) + Math.round(255 * amt);
  let b = (n & 255) + Math.round(255 * amt);
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function rgbaHex(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
function fmt2(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

type Stock = {
  ticker: string; name: string; faction: string; factionName: string; factionHex: string;
  price: string; change: number; spark: number[]; history: number[]; heldQty: number;
};

// Kit's finSvgLine(pts,w,h) — normalizes a price-history array into an SVG
// polyline "x,y x,y..." string spanning the given viewBox.
function svgLine(pts: number[], w: number, h: number): string {
  const lo = Math.min(...pts), hi = Math.max(...pts), span = (hi - lo) || 1;
  return pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - ((p - lo) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}
type PortfolioRow = {
  ticker: string; name: string; faction: string; factionHex: string;
  qty: number; avg: string; price: string; value: number; pl: number; plPct: number;
};
type ExchangeSnapshot = {
  netWorth: number; credits: number; negative: boolean;
  debt: number; limit: number; rate: number; premium: boolean;
  loanCount: number; autoRepayPct: number;
  stocks: Stock[]; portfolio: PortfolioRow[];
};

type FinTab = "market" | "portfolio" | "credit";
const FIN_TABS: { key: FinTab; label: string }[] = [
  { key: "market", label: "MARKET" },
  { key: "portfolio", label: "PORTFOLIO" },
  { key: "credit", label: "CREDIT LINE" },
];

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        padding: "10px 6px", border: "none", borderLeft: "1px solid rgba(150,195,235,.12)", cursor: "pointer",
        background: active ? "linear-gradient(180deg,rgba(232,185,77,.22),rgba(232,185,77,.05) 55%,transparent)" : hover ? "rgba(232,185,77,.14)" : "transparent",
        color: active ? "#f2f7ff" : "rgba(206,220,238,.6)",
        fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.16em", fontWeight: 700,
        boxShadow: "inset 0 3px 6px rgba(0,0,0,.35)",
        transform: pressed ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .14s cubic-bezier(.2,.9,.25,1)",
      }}
    >
      <i style={{ width: 6, height: 6, flex: "0 0 auto", background: ACCENT, boxShadow: `0 0 7px ${ACCENT}`, transform: "rotate(45deg)", opacity: active ? 1 : 0.35 }} />
      {label}
    </button>
  );
}

function StockRow({ s, selected, onPick }: { s: Stock; selected: boolean; onPick: () => void }) {
  const { hover, handlers } = usePressable();
  const up = s.change >= 0;
  const hex = up ? "#5cff8a" : "#ff4d5e";
  const lo = Math.min(...s.spark), hi = Math.max(...s.spark), span = (hi - lo) || 1;
  return (
    <button
      onClick={onPick} {...handlers}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", border: "none",
        textAlign: "left", cursor: "pointer",
        background: selected ? `linear-gradient(100deg,${rgbaHex(s.factionHex, 0.18)},rgba(6,10,17,.9) 65%)` : hover ? "rgba(150,190,235,.06)" : "linear-gradient(180deg,rgba(150,190,235,.04),rgba(6,9,15,.82))",
        transition: "background .18s ease",
      }}
    >
      <i style={{ position: "absolute", left: 0, top: 2, bottom: 2, width: 2, background: s.factionHex, boxShadow: `0 0 8px ${s.factionHex}`, opacity: selected ? 1 : 0.4 }} />
      <span style={{ position: "relative", display: "grid", placeItems: "center", width: 26, height: 26, flex: "0 0 auto", background: "linear-gradient(150deg,#e6eefa,#6d7a8c 44%,#1a212c)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }}>
        <i style={{ position: "absolute", inset: 2, background: `linear-gradient(165deg,${rgbaHex(s.factionHex, 0.2)},rgba(5,7,13,.96))`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", boxShadow: "inset 0 2px 5px rgba(0,0,0,.8)" }} />
        <b style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 6.5, fontWeight: 800, color: s.factionHex }}>{s.factionName.split(" ")[0]}</b>
      </span>
      <div style={{ display: "grid", gap: 1, width: 100, flex: "0 0 auto", minWidth: 0 }}>
        <b style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, color: "#f4edff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.ticker}</b>
        <small style={{ fontSize: 10.5, color: "rgba(190,214,236,.75)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</small>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 20, width: 48, flex: "0 0 auto" }}>
        {s.spark.map((v, i) => (
          <i key={i} style={{ flex: 1, height: `${Math.max(3, Math.round(((v - lo) / span) * 18))}px`, background: hex, opacity: 0.85 }} />
        ))}
      </div>
      <span style={{ flex: 1 }} />
      <small style={{ flex: "0 0 auto", fontSize: 10, color: "rgba(190,214,236,.7)", width: 62, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.heldQty > 0 ? fmt(s.heldQty) + " SH" : ""}</small>
      <b style={{ flex: "0 0 auto", width: 66, textAlign: "right", fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, color: "#f4edff", fontVariantNumeric: "tabular-nums" }}>{s.price}</b>
      <b style={{ flex: "0 0 auto", width: 50, textAlign: "right", fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, color: hex }}>{up ? "▲" : "▼"} {pct(s.change)}</b>
    </button>
  );
}

function QtyButton({ glyph, onClick }: { glyph: string; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      aria-label={glyph === "+" ? "Increase quantity" : "Decrease quantity"} onClick={onClick} {...handlers}
      style={{
        position: "relative", flex: "0 0 auto", width: 26, height: 26, padding: 0, border: "none", cursor: "pointer",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
        filter: active ? "brightness(1.32)" : hover ? "brightness(1.15)" : "none",
        transform: active ? "translateY(3px)" : hover ? "translateY(-2px)" : "none",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 45%,#2a3038)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#5c6878,#161b22)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)" }} />
      <span style={{ position: "absolute", inset: 3, display: "grid", placeItems: "center", overflow: "hidden", background: "linear-gradient(180deg,rgba(232,185,77,.16),rgba(8,10,16,.96))", boxShadow: "inset 0 2px 4px rgba(0,0,0,.6)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)" }}>
        <b style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 800, color: "#ffe6a8" }}>{glyph}</b>
      </span>
    </button>
  );
}

function TradeButton({ side, active, onClick }: { side: "buy" | "sell"; active: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  const isBuy = side === "buy";
  const grad = isBuy ? "linear-gradient(135deg,#ddffe9,#4f9c68 45%,#183226)" : "linear-gradient(135deg,#ffdfe3,#a8505c 45%,#3a151b)";
  const inner = isBuy ? "linear-gradient(135deg,#3d7a52,#0d1c14)" : "linear-gradient(135deg,#7c3540,#1c0b0f)";
  const fill = isBuy ? "rgba(92,255,138,.24)" : "rgba(255,77,94,.24)";
  const glow = isBuy ? "#5cff8a" : "#ff4d5e";
  const text = isBuy ? "#dfffe9" : "#ffdfe3";
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        position: "relative", flex: 1, padding: 0, border: "none", background: "none", cursor: "pointer",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
        filter: active ? "none" : "saturate(.3) brightness(.68)",
        transform: pressed ? "translateY(2px)" : hover ? "translateY(-1px)" : "none",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: grad, clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: inner, clipPath: "polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)" }} />
      <span style={{ position: "relative", display: "block", margin: 3, overflow: "hidden", background: `linear-gradient(180deg,${fill},rgba(7,12,9,.96))`, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)" }}>
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${glow},transparent)`, opacity: active ? 0.85 : 0 }} />
        <b style={{ position: "relative", display: "block", padding: "8px 10px", textAlign: "center", fontFamily: "var(--font-display)", fontSize: 10.5, letterSpacing: "0.16em", fontWeight: 800, color: text }}>{side.toUpperCase()}</b>
      </span>
    </button>
  );
}

function ConfirmButton({ label, hex, disabled, onClick }: { label: string; hex: string; disabled: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      onClick={onClick} disabled={disabled} {...(disabled ? {} : handlers)}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: disabled ? "default" : "pointer",
        filter: disabled ? "grayscale(.5) brightness(.6)" : active ? "brightness(1.32)" : hover ? "brightness(1.12)" : "none",
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 45%,#2a3038)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#5c6878,#161b22)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }} />
      <span style={{ position: "relative", display: "block", margin: 3, overflow: "hidden", background: `linear-gradient(180deg,${rgbaHex(hex, 0.3)},rgba(8,10,16,.96))`, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)" }}>
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${hex},transparent)`, opacity: 0.75 }} />
        <b style={{ position: "relative", display: "block", padding: "8px 10px", textAlign: "center", fontFamily: "var(--font-display)", fontSize: 10.5, letterSpacing: "0.16em", fontWeight: 800, color: "#eaf4ff" }}>{label}</b>
      </span>
    </button>
  );
}

function SmallActionButton({ label, hex, onClick }: { label: string; hex: string; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const fill = rgbaHex(hex, 0.24);
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer",
        filter: active ? "brightness(1.32)" : hover ? "brightness(1.12)" : "none",
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: `linear-gradient(135deg,${shadeHex(hex, 0.35)},${shadeHex(hex, -0.3)} 45%,${shadeHex(hex, -0.6)})`, clipPath: "polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: `linear-gradient(135deg,${shadeHex(hex, -0.2)},${shadeHex(hex, -0.6)})`, clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }} />
      <span style={{ position: "relative", display: "block", margin: 3, overflow: "hidden", background: `linear-gradient(180deg,${fill},rgba(10,8,4,.96))`, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)" }}>
        <b style={{ position: "relative", display: "block", padding: "8px 10px", textAlign: "center", fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.14em", fontWeight: 800, color: "#f7e3b2" }}>{label}</b>
      </span>
    </button>
  );
}

export function ExchangePanel() {
  const showExchange = useGame((s) => s.showExchange);

  const [playToken] = useState(0);
  const [mounted, setMounted] = useState(showExchange);
  const [closing, setClosing] = useState(false);
  const [data, setData] = useState<ExchangeSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<FinTab>("market");
  const [selTicker, setSelTicker] = useState<string | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [borrowAmount, setBorrowAmount] = useState(5000);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    if (showExchange) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExchange]);

  const refresh = () => {
    getExchange()
      .then((snap: ExchangeSnapshot) => { setData(snap); setLoadError(null); })
      .catch((err: any) => setLoadError(err.message || "Failed to load exchange"));
  };

  useEffect(() => {
    if (!showExchange) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExchange]);

  if (!mounted) return null;

  const close = () => { gameState.showExchange = false; bump(); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); };

  const stocks = data?.stocks ?? [];
  const selected = stocks.find((s) => s.ticker === selTicker) ?? stocks[0] ?? null;
  const held = data?.portfolio.find((p) => p.ticker === selected?.ticker);
  const price = selected ? parseFloat(selected.price.replace(/,/g, "")) : 0;
  const total = price * qty;

  const doTrade = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const res = await tradeExchange(selected.ticker, side, qty);
      gameState.player.credits = res.credits;
      save();
      setQty(1);
      setToast({ text: `${side === "buy" ? "Bought" : "Sold"} ${res.qty} ${selected.ticker} · ${side === "buy" ? "-" : "+"}${fmt(res.total)} CR` });
      refresh();
      bump();
    } catch (err: any) {
      setToast({ text: err.message || "Trade failed.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  const doLoan = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await takeExchangeLoan(borrowAmount);
      gameState.player.credits = res.credits;
      save();
      setToast({ text: `Loan issued · +${fmt(borrowAmount)} CR` });
      refresh();
      bump();
    } catch (err: any) {
      setToast({ text: err.message || "Loan failed.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  const doRepay = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await repayExchangeLoan();
      gameState.player.credits = res.credits;
      save();
      setToast({ text: `Repaid ${fmt(res.paid)} CR` });
      refresh();
      bump();
    } catch (err: any) {
      setToast({ text: err.message || "Repay failed.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  const doTogglePremium = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await toggleExchangePremium();
      setToast({ text: res.premium ? "Premium active — interest waived" : "Premium cancelled" });
      refresh();
    } catch (err: any) {
      setToast({ text: err.message || "Toggle failed.", bad: true });
    } finally {
      setBusy(false);
    }
  };

  const util = data ? Math.min(100, Math.round((data.debt / data.limit) * 100)) : 0;
  const utilHex = util > 80 ? "#ff4d5e" : util > 50 ? "#e8b94d" : "#5cff8a";

  return (
    // justifyContent centers the panel horizontally same as before, but a
    // fixed paddingTop (not placeItems:"center") anchors its top edge — the
    // three tabs render very different content heights (Market's ~460px
    // scroll list vs. Credit Line's two short cards), and centering by
    // content height made the whole frame — including the PrintPortal rail
    // and beam — visibly jump every tab switch. A fixed top keeps the frame
    // planted; only the bottom edge grows/shrinks with the shorter content.
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 64, paddingBottom: 32, overflowY: "auto", background: "rgba(2,4,12,.7)" }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <PrintPortal playToken={playToken} closing={closing} onClosed={onPortalClosed} accent={ACCENT} duration={1300} chamfer={34} style={{ width: 1040, flexShrink: 0 }}>
        {/* chamfered metal bezel — E-01's own METAL_RIM texture isn't
            available locally, substituted with an equivalent brushed-metal
            gradient stack (5 layers, same insets/clip-paths as the source). */}
        <div style={{ position: "relative", padding: 10, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(232,185,77,.18))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,rgba(255,255,255,.14),rgba(0,0,0,.4)),linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", boxShadow: "inset 1px 1px 0 rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "linear-gradient(135deg,#e8f0fa,#9aa7b8 38%,#4a5462 72%,#2a3038)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "linear-gradient(135deg,#8b97a8,#3d4652 45%,#161b22)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "linear-gradient(135deg,#3a4350,#10141a 60%,#05070b)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "linear-gradient(135deg,#1b222c,#03050a)", clipPath: "polygon(0 0,calc(100% - 29.31px) 0,100% 29.31px,100% 100%,29.31px 100%,0 calc(100% - 29.31px))" }} />
          <i style={{ position: "absolute", left: 22, right: 44, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
          <i style={{ position: "absolute", left: 44, right: 22, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(232,185,77,.3),transparent)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 10, padding: "13px 15px 14px", overflow: "hidden", background: "radial-gradient(130% 100% at 50% -12%,rgba(232,185,77,.22),transparent 74%),linear-gradient(180deg,#2a2416,#15110a 62%,#0a0704)", boxShadow: "inset 0 6px 12px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -2px 0 rgba(255,236,190,.16)", clipPath: "polygon(0 0,calc(100% - 28.14px) 0,100% 28.14px,100% 100%,28.14px 100%,0 calc(100% - 28.14px))", fontWeight: 500 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0 2px", marginRight: 34 }}>
            <b style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: "0.2em", color: "#ffe6a8" }}>EXCHANGE</b>
            <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(196,218,240,.8)" }}>SECTOR-WIDE · LIVE</small>
            <span style={{ flex: 1 }} />
            {data && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", border: "1px solid rgba(184,102,255,.32)", background: "linear-gradient(150deg,rgba(184,102,255,.1),rgba(6,5,12,.92))" }}>
                  <small style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>NET WORTH</small>
                  <b style={{ fontFamily: "var(--font-display)", fontSize: 11.5, fontWeight: 700, color: "#e2d2ff", fontVariantNumeric: "tabular-nums" }}>{fmt(data.netWorth)} CR</b>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", border: "1px solid rgba(232,185,77,.32)", background: "linear-gradient(150deg,rgba(232,185,77,.1),rgba(6,5,12,.92))" }}>
                  <small style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>CREDITS</small>
                  <b style={{ fontFamily: "var(--font-display)", fontSize: 11.5, fontWeight: 700, color: data.negative ? "#ff4d5e" : "#e8b94d", fontVariantNumeric: "tabular-nums" }}>{fmt(data.credits)} CR</b>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", border: "1px solid rgba(255,77,94,.32)", background: "linear-gradient(150deg,rgba(255,77,94,.1),rgba(6,5,12,.92))" }}>
                  <small style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>DEBT</small>
                  <b style={{ fontFamily: "var(--font-display)", fontSize: 11.5, fontWeight: 700, color: "#ff9aa4", fontVariantNumeric: "tabular-nums" }}>{fmt(data.debt)} CR</b>
                </div>
              </>
            )}
            <CloseButton onClick={close} title="Close" size={26} fontSize={11} />
          </div>

          {data?.negative && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", border: "1px solid rgba(255,77,94,.45)", background: "rgba(58,10,16,.55)", boxShadow: "0 0 14px rgba(255,77,94,.25)" }}>
              <i style={{ width: 6, height: 6, flex: "0 0 auto", background: "#ff4d5e", boxShadow: "0 0 8px #ff4d5e", transform: "rotate(45deg)" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.16em", color: "#ffd0d5" }}>ACCOUNT NEGATIVE — PURCHASES LOCKED UNTIL THE DEBT IS REPAID</b>
            </div>
          )}

          <i style={{ position: "relative", height: 1, background: "linear-gradient(90deg,transparent,rgba(232,185,77,.28) 8%,rgba(232,185,77,.28) 92%,transparent)" }} />

          <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 1, overflow: "hidden", background: "rgba(4,8,16,.55)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)" }}>
            {FIN_TABS.map((t) => (
              <TabButton key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />
            ))}
            {(() => {
              const ind = `${(FIN_TABS.findIndex((t) => t.key === tab) * 100) / 3}%`;
              const bar: React.CSSProperties = {
                position: "absolute", zIndex: 4, left: ind, width: "33.34%", height: 2, pointerEvents: "none",
                background: `linear-gradient(90deg,transparent,${ACCENT} 22%,${ACCENT} 78%,transparent)`,
                boxShadow: `0 0 10px ${ACCENT},0 0 24px ${ACCENT}`, transition: "left 280ms cubic-bezier(.22,.9,.25,1)",
              };
              return (<>
                <i style={{ ...bar, top: 0 }} />
                <i style={{ ...bar, bottom: 0 }} />
              </>);
            })()}
          </div>

          {loadError && <small style={{ padding: 20, textAlign: "center", color: "#ff8a94" }}>{loadError}</small>}
          {!data && !loadError && <small style={{ padding: 20, textAlign: "center", color: "rgba(190,214,236,.7)" }}>Loading…</small>}

          {data && tab === "market" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 10, alignItems: "start" }}>
              <div style={{ position: "relative", display: "grid", gap: 1, maxHeight: 460, overflowY: "auto", padding: 2, background: "rgba(4,5,11,.62)" }}>
                {stocks.map((s) => (
                  <StockRow key={s.ticker} s={s} selected={selected?.ticker === s.ticker} onPick={() => { setSelTicker(s.ticker); setQty(1); }} />
                ))}
              </div>

              {selected && (
                <div style={{ display: "grid", gap: 8, padding: "11px 12px", background: "rgba(4,5,11,.62)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ position: "relative", display: "grid", placeItems: "center", width: 34, height: 34, flex: "0 0 auto", background: "linear-gradient(150deg,#e6eefa,#6d7a8c 44%,#1a212c)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)", filter: `drop-shadow(0 2px 0 rgba(3,5,10,.9)) drop-shadow(0 0 10px ${rgbaHex(selected.factionHex, 0.33)})` }}>
                      <i style={{ position: "absolute", inset: 2, background: `linear-gradient(165deg,${rgbaHex(selected.factionHex, 0.2)},rgba(5,7,13,.96))`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                      <b style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 800, color: selected.factionHex }}>{selected.ticker}</b>
                    </span>
                    <div style={{ display: "grid", gap: 1, minWidth: 0 }}>
                      <b style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 800, color: "#fbf6ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</b>
                      <small style={{ fontSize: 10, letterSpacing: "0.1em", color: selected.factionHex }}>{selected.factionName}</small>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <b style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{selected.price}</b>
                    <b style={{ fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 700, color: selected.change >= 0 ? "#5cff8a" : "#ff4d5e" }}>{pct(selected.change)}</b>
                    <span style={{ flex: 1 }} />
                    <small style={{ fontSize: 10.5, color: "rgba(190,214,236,.75)", textAlign: "right" }}>{held?.qty ? `${fmt(held.qty)} SH · AVG ${held.avg}` : "NONE HELD"}</small>
                  </div>

                  <div style={{ position: "relative", height: 56, padding: "0 2px" }}>
                    <svg viewBox="0 0 300 56" width="100%" height="56" style={{ display: "block", overflow: "visible" }}>
                      <polyline points={svgLine(selected.history, 300, 56)} fill="none" stroke={selected.change >= 0 ? "#5cff8a" : "#ff4d5e"} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
                    {["-24H", "-18H", "-12H", "-6H", "NOW"].map((a) => (
                      <small key={a} style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.05em", color: "rgba(255,255,255,.4)" }}>{a}</small>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    <TradeButton side="buy" active={side === "buy"} onClick={() => setSide("buy")} />
                    <TradeButton side="sell" active={side === "sell"} onClick={() => setSide("sell")} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <QtyButton glyph="−" onClick={() => setQty((q) => Math.max(1, q - 1))} />
                    <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: "#f4edff", fontVariantNumeric: "tabular-nums" }}>{qty}</div>
                    <QtyButton glyph="+" onClick={() => setQty((q) => q + 1)} />
                    <button
                      onClick={() => setQty(side === "sell" ? Math.max(1, held?.qty || 1) : Math.max(1, Math.floor(data.credits / price)))}
                      style={{ padding: "6px 10px", height: 26, boxSizing: "border-box", flex: "0 0 auto", border: "1px solid rgba(232,185,77,.28)", background: "rgba(24,18,8,.7)", color: "rgba(248,232,206,.85)", fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}
                    >MAX</button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <small style={{ fontSize: 10, letterSpacing: "0.14em", color: "rgba(206,226,246,.85)", fontWeight: 700 }}>ORDER TOTAL</small>
                    <b style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800, color: "#ffe6a8", fontVariantNumeric: "tabular-nums" }}>{fmt(total)} CR</b>
                  </div>

                  <ConfirmButton
                    label={busy ? "…" : `${side.toUpperCase()} ${qty} ${selected.ticker}`}
                    hex={side === "buy" ? "#5cff8a" : "#ff4d5e"}
                    disabled={busy || (side === "buy" && data.negative)}
                    onClick={doTrade}
                  />
                </div>
              )}
            </div>
          )}

          {data && tab === "portfolio" && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 12px", background: "rgba(4,5,11,.62)" }}>
                <small style={{ fontSize: 10, letterSpacing: "0.16em", color: "rgba(206,226,246,.85)", fontWeight: 700 }}>PORTFOLIO VALUE</small>
                <b style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: "#f4edff", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(data.portfolio.reduce((a, p) => a + p.value, 0))} CR
                </b>
                <span style={{ flex: 1 }} />
                <small style={{ fontSize: 10, letterSpacing: "0.16em", color: "rgba(206,226,246,.85)", fontWeight: 700 }}>TOTAL P/L</small>
                {(() => {
                  const totalPl = data.portfolio.reduce((a, p) => a + p.pl, 0);
                  return <b style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: totalPl >= 0 ? "#5cff8a" : "#ff4d5e", fontVariantNumeric: "tabular-nums" }}>{totalPl >= 0 ? "+" : ""}{fmt(totalPl)} CR</b>;
                })()}
              </div>
              <div style={{ display: "grid", gap: 1, maxHeight: 320, overflowY: "auto", background: "rgba(4,5,11,.62)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px" }}>
                  <small style={{ width: 70, fontSize: 10, letterSpacing: "0.12em", color: "rgba(180,205,230,.68)", fontWeight: 700 }}>TICKER</small>
                  <small style={{ flex: 1, fontSize: 10, letterSpacing: "0.12em", color: "rgba(180,205,230,.68)", fontWeight: 700, textAlign: "right" }}>QTY</small>
                  <small style={{ width: 78, fontSize: 10, letterSpacing: "0.12em", color: "rgba(180,205,230,.68)", fontWeight: 700, textAlign: "right" }}>AVG</small>
                  <small style={{ width: 78, fontSize: 10, letterSpacing: "0.12em", color: "rgba(180,205,230,.68)", fontWeight: 700, textAlign: "right" }}>PRICE</small>
                  <small style={{ width: 90, fontSize: 10, letterSpacing: "0.12em", color: "rgba(180,205,230,.68)", fontWeight: 700, textAlign: "right" }}>VALUE</small>
                  <small style={{ width: 120, fontSize: 10, letterSpacing: "0.12em", color: "rgba(180,205,230,.68)", fontWeight: 700, textAlign: "right" }}>P/L</small>
                </div>
                {data.portfolio.map((p) => (
                  <div key={p.ticker} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "linear-gradient(180deg,rgba(150,190,235,.04),rgba(6,9,15,.7))" }}>
                    <b style={{ width: 70, fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, color: p.factionHex }}>{p.ticker}</b>
                    <small style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(226,238,252,.85)", textAlign: "right" }}>{fmt(p.qty)}</small>
                    <small style={{ width: 78, fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(226,238,252,.8)", textAlign: "right" }}>{p.avg}</small>
                    <small style={{ width: 78, fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(226,238,252,.85)", textAlign: "right" }}>{p.price}</small>
                    <b style={{ width: 90, fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, color: "#f4edff", textAlign: "right" }}>{fmt(p.value)}</b>
                    <div style={{ width: 120, textAlign: "right" }}>
                      <b style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, color: p.pl >= 0 ? "#5cff8a" : "#ff4d5e" }}>{p.pl >= 0 ? "+" : ""}{fmt(p.pl)} CR</b>
                      <small style={{ fontSize: 10, color: p.pl >= 0 ? "#5cff8a" : "#ff4d5e" }}> {pct(p.plPct)}</small>
                    </div>
                  </div>
                ))}
                {data.portfolio.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 9.5, color: "rgba(190,214,236,.5)" }}>No positions held — buy something on the MARKET tab.</div>
                )}
              </div>
            </div>
          )}

          {data && tab === "credit" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ display: "grid", gap: 7, padding: "11px 12px", background: "rgba(4,5,11,.62)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i style={{ width: 6, height: 6, background: "#ff5cf0", boxShadow: "0 0 8px #ff5cf0", transform: "rotate(45deg)" }} />
                  <small style={{ fontSize: 10.5, letterSpacing: "0.2em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>CREDIT LINE</small>
                  <i style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(255,92,240,.35),transparent)" }} />
                  <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(226,238,252,.8)" }}>LIMIT {fmt(data.limit)}</small>
                </div>
                <div style={{ position: "relative", height: 11, overflow: "hidden", background: "rgba(3,6,13,.9)", boxShadow: "inset 0 0 0 1px rgba(255,92,240,.28)" }}>
                  <i style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${util}%`, background: `linear-gradient(90deg,${rgbaHex(utilHex, 0.53)},${utilHex})`, filter: `drop-shadow(0 0 5px ${utilHex})` }} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <small style={{ fontSize: 10.5, color: "rgba(190,214,236,.78)" }}>OWED</small>
                  <b style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "#ff9aa4", fontVariantNumeric: "tabular-nums" }}>{fmt(data.debt)} CR</b>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <QtyButton glyph="−" onClick={() => setBorrowAmount((a) => Math.max(1000, a - 1000))} />
                  <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 800, color: "#f4edff" }}>{fmt(borrowAmount)}</div>
                  <QtyButton glyph="+" onClick={() => setBorrowAmount((a) => Math.min(data.limit - data.debt, a + 1000))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  <SmallActionButton label="TAKE LOAN" hex="#e8b94d" onClick={doLoan} />
                  <SmallActionButton label="REPAY NOW" hex="#5cff8a" onClick={doRepay} />
                </div>
                <small style={{ fontSize: 10.5, lineHeight: 1.5, color: "rgba(190,214,236,.75)" }}>
                  {Math.round(data.autoRepayPct * 100)}% of every payout is withheld automatically until the balance clears.{" "}
                  {data.loanCount > 0
                    ? `${data.loanCount} loan${data.loanCount > 1 ? "s" : ""} taken this week — rate climbs ${(data.loanCount * 1.5).toFixed(1)}pt, resets next week`
                    : "rate resets to standard next week"}.
                </small>
              </div>

              <div style={{ display: "grid", gap: 7, padding: "11px 12px", background: "rgba(4,5,11,.62)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i style={{ width: 6, height: 6, background: "#e8b94d", boxShadow: "0 0 8px #e8b94d", transform: "rotate(45deg)" }} />
                  <small style={{ fontSize: 10.5, letterSpacing: "0.2em", color: "rgba(206,226,246,.9)", fontWeight: 700 }}>INTEREST</small>
                  <i style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(232,185,77,.35),transparent)" }} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <b style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 900, color: data.premium ? "#5cff8a" : "#e8b94d" }}>{data.premium ? "0.0%" : data.rate.toFixed(1) + "%"}</b>
                  <small style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "rgba(190,214,236,.75)" }}>PER DAY</small>
                  {(data.premium || data.rate > 4.5) && <small style={{ fontSize: 10, color: "rgba(190,214,236,.8)", textDecoration: "line-through" }}>4.5%</small>}
                </div>
                <small style={{ fontSize: 10.5, lineHeight: 1.5, color: "rgba(190,214,236,.75)" }}>
                  {data.premium
                    ? "Premium waives the daily charge entirely."
                    : `Charged automatically once a day on whatever's still owed — it compounds, so paying down the balance sooner keeps the daily deduction smaller.`}
                </small>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: "1px solid rgba(232,185,77,.3)", background: "rgba(6,5,12,.5)" }}>
                  <div style={{ display: "grid", gap: 2, flex: 1 }}>
                    <b style={{ fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.1em", color: "#ffe6a8" }}>PREMIUM</b>
                    <small style={{ fontSize: 10, color: "rgba(190,214,236,.75)" }}>waives interest on the credit line entirely</small>
                  </div>
                  <button
                    onClick={doTogglePremium}
                    style={{ position: "relative", width: 38, height: 20, flex: "0 0 auto", border: "1px solid rgba(150,195,235,.3)", background: "rgba(4,8,16,.7)", cursor: "pointer" }}
                  >
                    <i style={{ position: "absolute", top: 2, left: data.premium ? 20 : 2, width: 14, height: 14, background: data.premium ? "#5cff8a" : "#e8b94d", boxShadow: `0 0 8px ${data.premium ? "#5cff8a" : "#e8b94d"}`, transition: "left .18s ease" }} />
                  </button>
                </div>
                <small style={{ fontSize: 10.5, lineHeight: 1.5, color: "rgba(190,214,236,.75)" }}>Standard accounts accrue interest on any owed balance each cycle. Premium members trade and borrow interest-free.</small>
              </div>
            </div>
          )}

          {toast && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px", border: `1px solid ${toast.bad ? "#ff4d5e" : "#5cff8a"}55`, background: "rgba(6,5,12,.7)" }}>
              <i style={{ width: 5, height: 5, flex: "0 0 auto", background: toast.bad ? "#ff4d5e" : "#5cff8a", boxShadow: `0 0 8px ${toast.bad ? "#ff4d5e" : "#5cff8a"}`, transform: "rotate(45deg)" }} />
              <small style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.1em", color: toast.bad ? "#ff4d5e" : "#5cff8a" }}>{toast.text}</small>
              <button onClick={() => setToast(null)} style={{ border: "none", background: "none", color: "rgba(206,226,246,.5)", fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>
          )}
        </div>
        </div>
      </PrintPortal>
    </div>
  );
}
