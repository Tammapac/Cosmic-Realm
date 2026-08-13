// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, I-10 ·
// SOCIAL section — HTML template ~line 4113, SO_FR/SO_REQ/SO_BLK ~line
// 7900, state builder ~line 5580). Three lists behind one tab strip
// (Friends/Pending/Blocked), search + add-by-name, and a direct-message
// thread on the right for whichever pilot is selected.
//
// All data is real: GET /api/social (backend/src/routes/social.ts) reads
// friendships from the friendships table and online/zone from the live
// socket registry (socket/state.ts) — never a client-trusted "online" flag.
// Requests/accepts/blocks/removes and the DM thread all hit real
// server-authoritative endpoints; blocking actually prevents new messages
// server-side, not just in the UI.
import { useEffect, useRef, useState } from "react";
import { useGame, state as gameState, bump } from "../game/store";
import { PrintPortal } from "./hud/PrintPortal";
import { CloseButton } from "./hud/CloseButton";
import { usePressable } from "./hud/usePressable";
import {
  getSocial, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  removeFriend, blockPilot, unblockPilot, getDirectMessages, sendDirectMessage,
} from "../net/api";

const ACCENT = "#b866ff";

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
// Deterministic per-pilot accent so the same name always gets the same
// crest color across sessions — same hashing approach as other panels that
// derive a color from an id when the Kit's own source is a fixed palette pick.
const PILOT_PALETTE = ["#4ee2ff", "#ff4d5e", "#5cff8a", "#b866ff", "#e8b94d", "#ff8c4d", "#9fb6d4", "#ff5cf0"];
function hexForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PILOT_PALETTE[h % PILOT_PALETTE.length];
}

type Presence = { status: "on" | "away" | "off"; zone: string | null };
type Pilot = Presence & { id: number; name: string; level: number; faction: string | null };
type SocialSnapshot = { friends: Pilot[]; incoming: Pilot[]; outgoing: Pilot[]; blocked: Pilot[] };
type DmMessage = { id: number; mine: boolean; text: string; createdAt: string };

type SoTab = "friends" | "pending" | "blocked";
const SO_TABS: { key: SoTab; label: string }[] = [
  { key: "friends", label: "FRIENDS" },
  { key: "pending", label: "PENDING" },
  { key: "blocked", label: "BLOCKED" },
];

function TabButton({ label, count, active, hasDot, onClick }: { label: string; count: number; active: boolean; hasDot: boolean; onClick: () => void }) {
  const { hover, active: pressed, handlers } = usePressable();
  const rail = active ? ACCENT : "rgba(184,102,255,.3)";
  return (
    <button
      onClick={onClick} {...handlers}
      style={{
        flex: 1, position: "relative", padding: "7px 0", border: "none", cursor: "pointer",
        fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.16em", fontWeight: 700,
        color: active ? "#f4ecff" : "rgba(206,222,246,.6)",
        background: active ? "linear-gradient(180deg,rgba(184,102,255,.3),rgba(6,5,12,.92))" : "linear-gradient(180deg,#1a1626,#0a0812)",
        boxShadow: active ? "inset 0 1px 0 rgba(226,200,255,.4),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 0 16px rgba(184,102,255,.2)" : "inset 0 1px 0 rgba(220,238,255,.07),inset 0 -1px 0 rgba(0,0,0,.7),inset 0 3px 6px rgba(0,0,0,.5)",
        transform: pressed ? "translateY(1px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .13s cubic-bezier(.2,.9,.25,1),filter .16s ease,background .2s ease",
        clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)",
      }}
    >
      <i style={{ position: "absolute", left: 6, right: 6, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${rail},transparent)`, boxShadow: `0 0 ${active ? 10 : 3}px ${rail}` }} />
      <span style={{ position: "relative" }}>{label} {count}</span>
      {hasDot && <i style={{ position: "absolute", right: 7, top: 6, width: 5, height: 5, background: "#ff4d5e", boxShadow: "0 0 8px #ff4d5e", transform: "rotate(45deg)" }} />}
    </button>
  );
}

const ST_LABEL: Record<Presence["status"], [string, string]> = {
  on: ["ONLINE", "#5cff8a"], away: ["AWAY", "#e8b94d"], off: ["OFFLINE", "#9fb6d4"],
};

function PilotRow({ p, selected, chip, onPick }: { p: Pilot; selected: boolean; chip?: { label: string; hex: string }; onPick: () => void }) {
  const { hover, handlers } = usePressable();
  const hex = hexForName(p.name);
  const [dot, dotHex] = ST_LABEL[p.status];
  return (
    <div
      role="button" tabIndex={0} onClick={onPick} {...handlers}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", cursor: "pointer", overflow: "hidden",
        background: selected ? `radial-gradient(120% 100% at 0% 50%,${rgbaHex(hex, 0.22)},transparent 70%),linear-gradient(180deg,#161122,#07060d)` : hover ? "rgba(150,190,235,.05)" : "linear-gradient(180deg,#12101c,#06050c)",
        boxShadow: selected ? `inset 0 2px 5px rgba(0,0,0,.7),inset 0 0 0 1px ${rgbaHex(hex, 0.5)},inset 0 -2px 0 ${rgbaHex(hex, 0.4)}` : "inset 0 2px 5px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(170,205,245,.09)",
        transform: hover ? "translateX(3px)" : "none",
        transition: "transform .13s cubic-bezier(.2,.9,.25,1),background .2s ease",
        clipPath: "polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)",
      }}
    >
      <div style={{ position: "relative", width: 30, height: 30, flex: "0 0 auto", filter: `drop-shadow(0 2px 0 rgba(3,5,10,.9)) drop-shadow(0 0 ${selected ? 10 : 5}px ${rgbaHex(hex, selected ? 0.7 : 0.4)})` }}>
        <i style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,${shadeHex(hex, 0.35)},${shadeHex(hex, -0.34)} 52%,${shadeHex(hex, -0.66)})`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
        <i style={{ position: "absolute", inset: 2, background: `radial-gradient(circle at 50% 34%,${rgbaHex(hex, selected ? 0.5 : 0.24)},#05080f 76%)`, boxShadow: "inset 0 2px 4px rgba(0,0,0,.7)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
        <b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 9, color: hex, textShadow: `0 0 7px ${rgbaHex(hex, 0.55)}` }}>{p.name.slice(0, 1)}</b>
      </div>
      <div style={{ position: "relative", display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <b style={{ fontSize: 10.5, fontWeight: 700, color: selected ? "#ffffff" : "rgba(226,236,250,.86)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</b>
          <small style={{ flex: "0 0 auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(190,214,236,.6)" }}>LV {p.level}</small>
          <i style={{ width: 5, height: 5, flex: "0 0 auto", borderRadius: "50%", background: dotHex, boxShadow: `0 0 7px ${dotHex}`, opacity: p.status === "off" ? 0.5 : 1 }} />
        </div>
        <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.04em", color: p.status === "off" ? "rgba(190,214,236,.5)" : "rgba(196,214,238,.78)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {p.zone ?? dot}
        </small>
      </div>
      {chip && <small style={{ position: "relative", padding: "2px 7px", flex: "0 0 auto", fontFamily: "var(--font-display)", fontSize: 7, letterSpacing: "0.14em", color: chip.hex, background: rgbaHex(chip.hex, 0.16), boxShadow: `inset 0 0 0 1px ${rgbaHex(chip.hex, 0.45)}` }}>{chip.label}</small>}
    </div>
  );
}

// Matches the Kit's I-10 button exactly: rim gradient + inset content plate
// + a top spec-highlight line — the previous version dropped that line and
// derived its plate color from shadeHex() instead of the Kit's own flat
// dark plate + text-color pair, which is why it read as a thin flat pill.
function ActionButton({ label, rim, plate, text, line, disabled, onClick }: { label: string; rim: [string, string, string]; plate: [string, string]; text: string; line: string; disabled?: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const [top, mid, bot] = rim;
  const [plateTop, plateBot] = plate;
  return (
    <button
      onClick={onClick} disabled={disabled} {...(disabled ? {} : handlers)}
      style={{
        position: "relative", padding: 0, border: "none", background: "none", cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        filter: active ? "brightness(1.3)" : hover ? "brightness(1.16)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: `linear-gradient(150deg,${top},${mid} 46%,${bot})`, clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", margin: 2, padding: "6px 8px", overflow: "hidden", background: `linear-gradient(180deg,${plateTop},${plateBot})`, color: text, fontFamily: "var(--font-display)", fontSize: 7, letterSpacing: "0.16em", fontWeight: 700, boxShadow: `inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 ${rgbaHex(line, 0.25)}`, clipPath: "polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)" }}>
        <i style={{ position: "absolute", left: 5, right: 5, top: 0, height: 1, background: `linear-gradient(90deg,transparent,${rgbaHex(line, 0.6)},transparent)` }} />
        <span style={{ position: "relative" }}>{label}</span>
      </span>
    </button>
  );
}

// The Kit's SEND button is its own richer variant: a double rim (outer
// gradient + a darker inset rim ring) plus both a top spec-highlight line
// AND a bottom accent rail-glow line on the content plate.
function SendButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  return (
    <button
      onClick={onClick} disabled={disabled} {...(disabled ? {} : handlers)}
      style={{
        position: "relative", padding: 0, border: "none", background: "none",
        cursor: disabled ? "default" : "pointer", filter: disabled ? "grayscale(.6) brightness(.7)" : active ? "brightness(1.32)" : hover ? "brightness(1.14)" : "none",
        transform: active ? "translateY(2px)" : hover ? "translateY(-2px)" : "none",
        transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .16s ease",
      }}
    >
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(150deg,#f0e2ff,#a274d6 44%,#3a2450)", clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(150deg,#8e5cc8,#2c1a42 58%,#0d0714)", clipPath: "polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)" }} />
      <span style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: 3, padding: "8px 6px", overflow: "hidden", background: "linear-gradient(180deg,#3b2358,#150c22)", color: "#f4ecff", fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.16em", fontWeight: 700, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(226,200,255,.25)", clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}>
        <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(243,232,255,.7),transparent)" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(184,102,255,.85),transparent)", opacity: 0.8 }} />
        <span style={{ position: "relative" }}>{label}</span>
      </span>
    </button>
  );
}

export function SocialPanel() {
  const showSocial = useGame((s) => s.showSocial);
  const player = useGame((s) => s.player);

  const [playToken] = useState(0);
  const [mounted, setMounted] = useState(showSocial);
  const [closing, setClosing] = useState(false);
  const [data, setData] = useState<SocialSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<SoTab>("friends");
  const [query, setQuery] = useState("");
  const [addName, setAddName] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [thread, setThread] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSocial) { setMounted(true); setClosing(false); }
    else if (mounted) { setClosing(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSocial]);

  const refresh = () => {
    getSocial()
      .then((snap: SocialSnapshot) => { setData(snap); setLoadError(null); })
      .catch((err: any) => setLoadError(err.message || "Failed to load social"));
  };

  useEffect(() => {
    if (!showSocial) return;
    refresh();
    const t = setInterval(refresh, 15000); // keeps online/zone status live without a socket round-trip here
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSocial]);

  const allByTab: Record<SoTab, Pilot[]> = {
    friends: data?.friends ?? [],
    pending: [...(data?.incoming ?? []), ...(data?.outgoing ?? [])],
    blocked: data?.blocked ?? [],
  };
  const isIncoming = (id: number) => !!data?.incoming.some((p) => p.id === id);
  const isBlocked = tab === "blocked";
  const isPending = tab === "pending";

  const q = query.trim().toLowerCase();
  const shown = q ? allByTab[tab].filter((p) => p.name.toLowerCase().includes(q)) : allByTab[tab];
  const selected = shown.find((p) => p.id === selectedId) ?? allByTab[tab].find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected || isBlocked) { setThread([]); return; }
    getDirectMessages(selected.id)
      .then((res: { messages: DmMessage[] }) => setThread(res.messages))
      .catch(() => setThread([]));
  }, [selected?.id, isBlocked]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [thread]);

  if (!mounted) return null;

  const close = () => { gameState.showSocial = false; bump(); };
  const onPortalClosed = () => { setMounted(false); setClosing(false); };

  const doAdd = async () => {
    const name = addName.trim();
    if (name.length < 2) { setToast({ text: "Type the pilot's exact name first", bad: true }); return; }
    setBusy(true);
    try {
      const res = await sendFriendRequest(name);
      setAddName("");
      setToast({ text: `Friend request sent to ${res.name}` });
      refresh();
    } catch (err: any) {
      setToast({ text: err.message || "Failed to send request.", bad: true });
    } finally { setBusy(false); }
  };

  const doInvite = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      if (isPending && isIncoming(selected.id)) {
        await acceptFriendRequest(selected.id);
        setTab("friends"); setToast({ text: `${selected.name} is on your friends list now` });
      } else if (isPending) {
        await sendFriendRequest(selected.name);
        setToast({ text: `Request to ${selected.name} sent again` });
      } else if (isBlocked) {
        await unblockPilot(selected.id);
        setToast({ text: `${selected.name} unblocked` });
      } else {
        setToast({ text: "Party invites aren't wired up yet." });
      }
      refresh();
    } catch (err: any) {
      setToast({ text: err.message || "Action failed.", bad: true });
    } finally { setBusy(false); }
  };

  const doBlock = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      if (isBlocked) {
        await unblockPilot(selected.id);
        setToast({ text: `${selected.name} cleared from the block list` });
      } else {
        await blockPilot(selected.id);
        setSelectedId(null);
        setToast({ text: `${selected.name} blocked — they can no longer message you`, bad: true });
      }
      refresh();
    } catch (err: any) {
      setToast({ text: err.message || "Action failed.", bad: true });
    } finally { setBusy(false); }
  };

  const doRemove = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      if (isPending) {
        await declineFriendRequest(selected.id);
        setToast({ text: `${isIncoming(selected.id) ? "Request from " : "Request to "}${selected.name} dropped`, bad: true });
      } else if (isBlocked) {
        setToast({ text: "Use CLEAR to lift a block" });
      } else {
        await removeFriend(selected.id);
        setToast({ text: `${selected.name} removed from your list`, bad: true });
      }
      setSelectedId(null);
      refresh();
    } catch (err: any) {
      setToast({ text: err.message || "Action failed.", bad: true });
    } finally { setBusy(false); }
  };

  const doSend = async () => {
    const text = draft.trim();
    if (!text || !selected || isBlocked || busy) return;
    setBusy(true);
    try {
      const res = await sendDirectMessage(selected.id, text);
      setThread((t) => [...t, res.message]);
      setDraft("");
    } catch (err: any) {
      setToast({ text: err.message || "Failed to send.", bad: true });
    } finally { setBusy(false); }
  };

  const incomingCount = data?.incoming.length ?? 0;
  const inviteLabel = isPending ? (selected && isIncoming(selected.id) ? "ACCEPT" : "RESEND") : isBlocked ? "UNBLOCK" : "PARTY";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: 64, paddingBottom: 32, overflowY: "auto", background: "rgba(2,4,12,.7)" }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <PrintPortal playToken={playToken} closing={closing} onClosed={onPortalClosed} accent={ACCENT} duration={1300} chamfer={34} style={{ width: "min(96vw, 960px)", flexShrink: 0 }}>
        <div style={{ position: "relative", padding: 18, boxSizing: "border-box", filter: "drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 19px 24px rgba(0,0,0,.7)) drop-shadow(0 30px 40px rgba(0,0,0,.5)) drop-shadow(0 0 34px rgba(184,102,255,.18))" }}>
          <i style={{ position: "absolute", inset: 0, display: "block", background: "#05070d", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 0, display: "block", background: "rgba(184,102,255,.5)", clipPath: "polygon(0 0,calc(100% - 34px) 0,100% 34px,100% 100%,34px 100%,0 calc(100% - 34px))" }} />
          <i style={{ position: "absolute", inset: 2, display: "block", background: "rgba(243,232,255,.65)", clipPath: "polygon(0 0,calc(100% - 32.83px) 0,100% 32.83px,100% 100%,32.83px 100%,0 calc(100% - 32.83px))" }} />
          <i style={{ position: "absolute", inset: 4, display: "block", background: "rgba(5,3,10,.7)", clipPath: "polygon(0 0,calc(100% - 31.66px) 0,100% 31.66px,100% 100%,31.66px 100%,0 calc(100% - 31.66px))" }} />
          <i style={{ position: "absolute", inset: 6, display: "block", background: "rgba(201,168,255,.45)", clipPath: "polygon(0 0,calc(100% - 30.49px) 0,100% 30.49px,100% 100%,30.49px 100%,0 calc(100% - 30.49px))" }} />
          <i style={{ position: "absolute", inset: 8, display: "block", background: "rgba(5,3,10,.65)", clipPath: "polygon(0 0,calc(100% - 29.32px) 0,100% 29.32px,100% 100%,29.32px 100%,0 calc(100% - 29.32px))" }} />
          <i style={{ position: "absolute", left: 26, right: 48, top: 2, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent)", pointerEvents: "none" }} />
          <i style={{ position: "absolute", left: 48, right: 26, bottom: 2.5, height: 1, display: "block", zIndex: 2, background: "linear-gradient(90deg,transparent,rgba(201,168,255,.45),transparent)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 12, padding: "14px 15px 15px", overflow: "hidden", background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 5px 12px rgba(0,0,0,.6),inset 0 0 0 1px rgba(5,3,10,.6),inset 0 -2px 0 rgba(201,168,255,.2)", clipPath: "polygon(0 0,calc(100% - 23.47px) 0,100% 23.47px,100% 100%,23.47px 100%,0 calc(100% - 23.47px))" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "0 1px 10px", borderBottom: "1px solid rgba(0,0,0,.55)" }}>
            <i style={{ width: 7, height: 7, flex: "0 0 auto", background: "#5cff8a", boxShadow: "0 0 10px #5cff8a", transform: "rotate(45deg)" }} />
            <b style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.24em", color: "#eddcff" }}>SOCIAL</b>
            <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.1em", color: "rgba(214,200,242,.8)" }}>
              {data ? `${data.friends.filter((f) => f.status !== "off").length} ONLINE · ${data.friends.length} FRIENDS` : "…"}
            </small>
            <span style={{ flex: 1 }} />
            {incomingCount > 0 && <small style={{ padding: "3px 8px", fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.16em", color: "#ffd0d5", background: "rgba(255,77,94,.16)", boxShadow: "inset 0 0 0 1px rgba(255,77,94,.45)" }}>{incomingCount} REQUESTS</small>}
            <CloseButton onClick={close} title="Close" size={24} fontSize={10} />
          </div>

          {loadError && <small style={{ padding: 20, textAlign: "center", color: "#ff8a94" }}>{loadError}</small>}
          {!data && !loadError && <small style={{ padding: 20, textAlign: "center", color: "rgba(214,200,242,.6)" }}>Loading…</small>}

          {data && (
            <div style={{ display: "grid", gridTemplateColumns: "344px 1fr", gap: 12, alignItems: "stretch" }}>
              <div style={{ display: "grid", gridTemplateRows: "auto auto auto 1fr", gap: 9, padding: "20px 18px", border: "2px solid rgba(184,102,255,.5)", background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 0 0 2px rgba(243,232,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(201,168,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(126,72,176,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(62,32,86,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {SO_TABS.map((t) => (
                    <TabButton key={t.key} label={t.label} count={allByTab[t.key].length} active={tab === t.key} hasDot={t.key === "pending" && incomingCount > 0} onClick={() => { setTab(t.key); setSelectedId(null); setToast(null); }} />
                  ))}
                </div>

                <div style={{ display: "grid", gap: 6, padding: "10px 11px 11px", background: "linear-gradient(180deg,#141020,#06050c)", boxShadow: "inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 rgba(201,168,255,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                  <input
                    value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a pilot by name" aria-label="Search pilots"
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "none", outline: "none", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", color: "#f2f7ff", background: "linear-gradient(180deg,#0a0810,#040309)", boxShadow: "inset 0 3px 6px rgba(0,0,0,.8),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -1px 0 rgba(201,168,255,.16)" }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 92px", gap: 6 }}>
                    <input
                      value={addName} onChange={(e) => setAddName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doAdd(); }} placeholder="Add by exact name" aria-label="Add a friend by name"
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "none", outline: "none", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em", color: "#f2f7ff", background: "linear-gradient(180deg,#0a0810,#040309)", boxShadow: "inset 0 3px 6px rgba(0,0,0,.8),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -1px 0 rgba(201,168,255,.16)" }}
                    />
                    <ActionButton label="ADD" rim={["#f0e2ff", "#a274d6", "#3a2450"]} plate={["#3b2358", "#150c22"]} text="#f4ecff" line="#f3e8ff" disabled={busy} onClick={doAdd} />
                  </div>
                </div>

                <small style={{ position: "relative", fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.26em", color: "rgba(206,222,246,.7)" }}>
                  {isPending ? "REQUESTS" : isBlocked ? "BLOCKED PILOTS" : "FRIENDS · SORTED BY STATUS"}
                </small>

                <div style={{ position: "relative", display: "grid", gap: 5, alignContent: "start", overflowY: "auto" }}>
                  {shown.map((p) => (
                    <PilotRow
                      key={p.id} p={p} selected={selectedId === p.id}
                      chip={isPending ? { label: isIncoming(p.id) ? "INCOMING" : "SENT", hex: isIncoming(p.id) ? "#5cff8a" : "#9fb6d4" } : isBlocked ? { label: "BLOCKED", hex: "#ff4d5e" } : undefined}
                      onPick={() => { setSelectedId(p.id); setToast(null); }}
                    />
                  ))}
                  {shown.length === 0 && (
                    <small style={{ padding: "14px 4px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(214,200,242,.55)" }}>
                      {isPending ? "No open requests." : isBlocked ? "Nobody blocked." : q ? "No pilot matches that name." : "Your list is empty."}
                    </small>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 9, padding: "20px 18px", border: "2px solid rgba(184,102,255,.5)", background: "linear-gradient(150deg,#2a2440,#0a0812)", boxShadow: "inset 0 0 0 2px rgba(243,232,255,.65),inset 0 0 0 4px rgba(5,3,10,.7),inset 0 0 0 6px rgba(201,168,255,.45),inset 0 0 0 8px rgba(5,3,10,.65),inset 0 0 0 10px rgba(126,72,176,.3),inset 0 0 0 12px rgba(5,3,10,.6),inset 0 0 0 14px rgba(62,32,86,.25),inset 0 0 0 16px rgba(5,3,10,.55)" }}>
                {selected ? (
                  <>
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "11px 12px 12px", overflow: "hidden", background: `radial-gradient(130% 100% at 0% 0%,${rgbaHex(hexForName(selected.name), 0.15)},transparent 74%),linear-gradient(180deg,#141020,#06050c)`, boxShadow: `inset 0 3px 7px rgba(0,0,0,.7),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -2px 0 ${rgbaHex(hexForName(selected.name), 0.42)}`, clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                      <div style={{ position: "relative", width: 44, height: 44, flex: "0 0 auto", filter: `drop-shadow(0 2px 0 rgba(3,5,10,.9)) drop-shadow(0 0 14px ${rgbaHex(hexForName(selected.name), 0.6)})` }}>
                        <i style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,${shadeHex(hexForName(selected.name), 0.4)},${shadeHex(hexForName(selected.name), -0.3)} 52%,${shadeHex(hexForName(selected.name), -0.66)})`, clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                        <i style={{ position: "absolute", inset: 2.5, background: `radial-gradient(circle at 50% 32%,${rgbaHex(hexForName(selected.name), 0.45)},#07050d 76%)`, boxShadow: "inset 0 2px 5px rgba(0,0,0,.7)", clipPath: "polygon(50% 0,100% 26%,100% 74%,50% 100%,0 74%,0 26%)" }} />
                        <b style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 13, color: hexForName(selected.name), textShadow: `0 0 9px ${rgbaHex(hexForName(selected.name), 0.6)}` }}>{selected.name.slice(0, 1)}</b>
                      </div>
                      <div style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <b style={{ fontSize: 13, fontWeight: 700, color: "#f2f7ff" }}>{selected.name}</b>
                          <small style={{ padding: "2px 7px", fontFamily: "var(--font-display)", fontSize: 7.5, letterSpacing: "0.16em", color: isBlocked ? "#ff4d5e" : isPending ? "#5cff8a" : ST_LABEL[selected.status][1], background: rgbaHex(isBlocked ? "#ff4d5e" : isPending ? "#5cff8a" : ST_LABEL[selected.status][1], 0.16), boxShadow: `inset 0 0 0 1px ${rgbaHex(isBlocked ? "#ff4d5e" : isPending ? "#5cff8a" : ST_LABEL[selected.status][1], 0.45)}` }}>
                            {isBlocked ? "BLOCKED" : isPending ? (isIncoming(selected.id) ? "INCOMING" : "SENT") : ST_LABEL[selected.status][0]}
                          </small>
                        </div>
                        <small style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", color: "rgba(196,214,238,.8)" }}>LV {selected.level} · {selected.zone ?? ST_LABEL[selected.status][0]}</small>
                      </div>
                      <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                        <ActionButton label={inviteLabel} rim={["#d8ffe6", "#3fb264", "#12401f"]} plate={["#10331c", "#05130a"]} text="#c8ffd8" line="#d8ffe6" disabled={busy} onClick={doInvite} />
                        {!isBlocked && <ActionButton label="BLOCK" rim={["#ffd7db", "#c8303f", "#5c0d16"]} plate={["#3a1016", "#160508"]} text="#ffd0d5" line="#ffe4e8" disabled={busy} onClick={doBlock} />}
                        {!isBlocked && <ActionButton label="REMOVE" rim={["#dbe6f5", "#7d8a9c", "#2a323d"]} plate={["#1b232e", "#080c12"]} text="#dbe9fb" line="#ebf5ff" disabled={busy} onClick={doRemove} />}
                        {isBlocked && <ActionButton label="CLEAR" rim={["#dbe6f5", "#7d8a9c", "#2a323d"]} plate={["#1b232e", "#080c12"]} text="#dbe9fb" line="#ebf5ff" disabled={busy} onClick={doBlock} />}
                      </div>
                    </div>

                    <div style={{ position: "relative", display: "grid", gap: 6, alignContent: "start", padding: "12px 13px 13px", minHeight: 268, maxHeight: 268, overflowY: "auto", background: "linear-gradient(180deg,#0c0a14,#050409)", boxShadow: "inset 0 4px 9px rgba(0,0,0,.8),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -1px 0 rgba(201,168,255,.14)", clipPath: "polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))" }}>
                      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, paddingBottom: 7, borderBottom: "1px solid rgba(0,0,0,.55)" }}>
                        <i style={{ width: 5, height: 5, background: hexForName(selected.name), boxShadow: `0 0 8px ${hexForName(selected.name)}`, transform: "rotate(45deg)" }} />
                        <small style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 8, letterSpacing: "0.26em", color: "rgba(206,222,246,.75)" }}>DIRECT · {selected.name}</small>
                        <small style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "rgba(190,214,236,.6)" }}>{thread.length} MESSAGES</small>
                      </div>
                      {thread.map((m) => (
                        <div key={m.id} style={{ position: "relative", display: "flex", gap: 8, justifyContent: m.mine ? "flex-end" : "flex-start" }}>
                          <div style={{ maxWidth: "74%", display: "grid", gap: 2, padding: "7px 10px", background: m.mine ? "linear-gradient(180deg,#2b1c44,#140d22)" : "linear-gradient(180deg,#141a26,#080c14)", boxShadow: m.mine ? "inset 0 2px 5px rgba(0,0,0,.6),inset 0 0 0 1px rgba(184,102,255,.35),inset 0 -1px 0 rgba(226,200,255,.2)" : `inset 0 2px 5px rgba(0,0,0,.6),inset 0 0 0 1px rgba(0,0,0,.6),inset 0 -1px 0 ${rgbaHex(hexForName(selected.name), 0.3)}`, clipPath: m.mine ? "polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px))" : "polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px)" }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                              <small style={{ fontFamily: "var(--font-display)", fontSize: 7, letterSpacing: "0.16em", color: m.mine ? "rgba(226,200,255,.9)" : rgbaHex(hexForName(selected.name), 0.9) }}>{m.mine ? "YOU" : selected.name}</small>
                              <small style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(190,214,236,.5)" }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
                            </div>
                            <span style={{ fontSize: 11.5, lineHeight: 1.5, color: m.mine ? "#f4ecff" : "rgba(222,234,250,.9)" }}>{m.text}</span>
                          </div>
                        </div>
                      ))}
                      {thread.length === 0 && (
                        <small style={{ padding: "26px 4px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "rgba(214,200,242,.55)" }}>
                          {isBlocked ? "Blocked — no messages can be exchanged." : "No messages yet — say something."}
                        </small>
                      )}
                      <div ref={threadEndRef} />
                    </div>

                    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 96px", gap: 7 }}>
                      <input
                        value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } }}
                        placeholder={isBlocked ? "Unblock this pilot to write again" : `Message ${selected.name}…`} aria-label="Message"
                        disabled={isBlocked}
                        style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "none", outline: "none", fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.04em", color: "#f2f7ff", background: "linear-gradient(180deg,#0a0810,#040309)", boxShadow: "inset 0 3px 6px rgba(0,0,0,.8),inset 0 0 0 1px rgba(0,0,0,.65),inset 0 -1px 0 rgba(201,168,255,.16)" }}
                      />
                      <SendButton label="SEND" disabled={busy || isBlocked} onClick={doSend} />
                      {toast && (
                        <small style={{ gridColumn: "1 / -1", fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.04em", color: toast.bad ? "#ff8a94" : "#7cffb0" }}>{toast.text}</small>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ display: "grid", placeItems: "center", padding: "40px 10px", gridRow: "1 / -1" }}>
                    <small style={{ fontSize: 11, color: "rgba(214,200,242,.5)", textAlign: "center" }}>Select a pilot to open a direct thread.</small>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </PrintPortal>
    </div>
  );
}
