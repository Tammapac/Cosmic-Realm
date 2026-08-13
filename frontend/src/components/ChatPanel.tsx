// Ported 1:1 from the Cosmic Kit design export (Cosmic Kit.dc.html, W-04 ·
// CHAT WINDOW section + its renderVals() logic). Every color, gradient,
// clip-path and animation below is copied verbatim from that source — the
// octagon-chamfered console shell, the 4-tab edge-glow bar, the recessed
// log well and the composer/SEND button all match line for line.
//
// Unlike Inventory/Skills/Cargo, the Kit's chat window has no print-portal
// open/close animation and no close button — it's a permanently-docked HUD
// console (W- series = "window", not the I- series popup panels), so this
// stays mounted at all times, matching the live game's chat behavior.
//
// Data plumbing: the Kit's 4 CHAN entries (GLOBAL/FACTION/CLAN/SYSTEM,
// static demo log) are replaced by the real player.chat store — channel
// keys map 1:1 onto ChatMessage["channel"] (local/party/clan/system), see
// game/types.ts and pushChat()/sendChat() in game/store.ts + net/socket.ts.
//
// SYSTEM tab has no composer of its own — it's a read-only broadcast feed.
// Only the admin (playerId===3, matching the existing /admin convention)
// gets a composer there, and it sends via the server's dedicated
// "broadcast" pseudo-channel (backend/src/socket/handler.ts) which fans
// the message out into all four channels for every connected client —
// the server enforces the admin check independently, this is UI-only.
import { useEffect, useRef, useState } from "react";
import { useGame, state as gameState, pushChat, bump } from "../game/store";
import { sendChat } from "../net/socket";
import { FACTIONS, type FactionId } from "../game/types";
import { usePressable } from "./hud/usePressable";

const metalRim = "linear-gradient(150deg,rgba(255,255,255,.08),rgba(0,0,0,.35)),url(/assets/ui/atlas/brushed-metal.png)";
const metalRimStyle = { backgroundSize: "cover, 400% 400%", backgroundPosition: "center, 100% 0%" } as const;

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
};

type ChannelKey = "local" | "party" | "clan" | "system";
const CHAN: { key: ChannelKey; n: string; hex: string; text: string; prompt: string }[] = [
  { key: "local", n: "GLOBAL", hex: "#4ee2ff", text: "#dff6ff", prompt: "Say something to the sector…" },
  { key: "party", n: "FACTION", hex: "#b866ff", text: "#ecd6ff", prompt: "Address the Concord…" },
  { key: "clan", n: "CLAN", hex: "#5cff8a", text: "#cdf6d9", prompt: "Talk to your clan…" },
  { key: "system", n: "SYSTEM", hex: "#e8b94d", text: "#f5dda6", prompt: "" },
];

// Faction tag -> icon file, same mapping the world-space name tags use
// (pixi-renderer-v2-integrated.ts shipLabelHtml). One shared icon set, no
// second asset.
const FACTION_ICON_FILE: Record<string, string> = { EIC: "eic", MMO: "mmo", VRU: "vru" };

function TabButton({ c, on, onClick }: { c: typeof CHAN[number]; on: boolean; onClick: () => void }) {
  const { hover, active, handlers } = usePressable();
  const transform = active ? "translateY(1px) scale(.98)" : hover ? "translateY(-2px)" : "none";
  return (
    <button onClick={onClick} {...handlers} style={{
      flex: 1, position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
      padding: "11px 2px", border: "none", borderLeft: "1px solid rgba(150,195,235,.12)",
      background: on ? `linear-gradient(180deg,${rgba(c.hex, 0.18)},${rgba(c.hex, 0.04)} 55%,transparent)` : hover ? "rgba(184,102,255,.14)" : "transparent",
      color: on ? c.text : "rgba(206,220,238,.6)",
      fontFamily: "var(--font-display)", fontSize: 10.6, letterSpacing: "0.1em", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      boxShadow: "inset 0 3px 6px rgba(0,0,0,.35)", transition: "background .22s ease,color .22s ease,transform .14s ease",
      transform,
    }}>
      <i style={{ width: 6, height: 6, flex: "0 0 auto", background: c.hex, boxShadow: `0 0 7px ${c.hex}`, transform: "rotate(45deg)", opacity: on ? 1 : 0.35 }} />
      {c.n}
    </button>
  );
}

function SendButton({ onClick, hex, tint, ambient, glow }: { onClick: () => void; hex: string; tint: string; ambient: string; glow: string }) {
  const { hover, active, handlers } = usePressable();
  const filter = active
    ? `drop-shadow(0 1px 1px rgba(0,0,0,.6)) drop-shadow(0 0 16px ${glow}) brightness(1.22)`
    : hover
    ? `drop-shadow(0 7px 3px rgba(0,0,0,.55)) drop-shadow(0 0 22px ${glow}) brightness(1.12)`
    : `drop-shadow(0 4px 2px rgba(0,0,0,.55)) drop-shadow(0 0 12px ${ambient})`;
  return (
    <button onClick={onClick} {...handlers} style={{
      position: "relative", flex: "0 0 auto", padding: 0, border: "none", background: "none", cursor: "pointer",
      transform: active ? "translateY(2px) scale(.95)" : hover ? "translateY(-2px)" : "none",
      filter, transition: "transform .12s cubic-bezier(.2,.9,.25,1),filter .14s ease",
    }}>
      <i style={{ position: "absolute", inset: 0, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 45%,#2a3038)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)" }} />
      <i style={{ position: "absolute", inset: 1.5, display: "block", background: "linear-gradient(135deg,#5c6878,#161b22)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%)" }} />
      <span style={{ position: "relative", display: "block", margin: 3, overflow: "hidden", background: `linear-gradient(180deg,${tint},rgba(8,10,16,.96))`, boxShadow: "inset 0 3px 5px rgba(0,0,0,.6),inset 0 -1px 0 rgba(220,238,255,.14)", clipPath: "polygon(0 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)" }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg,rgba(200,235,255,.05) 0 1px,transparent 1px 4px)" }} />
        <i style={{ position: "absolute", left: 6, right: 6, top: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(230,246,255,.8),transparent)" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${hex},transparent)`, opacity: 0.7, animation: "cPulse 3s ease-in-out infinite" }} />
        <i style={{ position: "absolute", top: 0, left: "-40%", width: "24%", height: "100%", background: "linear-gradient(100deg,transparent,rgba(255,255,255,.26),transparent)", transform: "skewX(-18deg)", animation: "cSweep 3.4s ease-in-out infinite" }} />
        <b style={{ position: "relative", display: "block", padding: "6px 13px", fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.16em", fontWeight: 800, color: "#eaf4ff" }}>SEND</b>
      </span>
    </button>
  );
}

export function ChatPanel() {
  const chat = useGame((s) => s.chat);
  const player = useGame((s) => s.player);
  const others = useGame((s) => s.others);
  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const c = CHAN[tab];
  const log = chat.filter((m) => m.channel === c.key).slice(-40);
  // Staff flag from the server (players.is_admin), not a hardcoded player id.
  const isAdmin = useGame((st) => st.isAdmin);
  const isSystem = c.key === "system";

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length, tab]);

  const chTint = rgba(c.hex, 0.18);
  const chBorder = rgba(c.hex, 0.45);
  const chGlow = rgba(c.hex, 0.6);
  const chAmbient = rgba(c.hex, 0.22);

  // Sender's faction, for the small icon next to their name — self is read
  // straight off the local player, everyone else is looked up by name in
  // the proximity-synced `others` roster. A sender outside that roster
  // (out of zone, or a stale log entry) simply gets no icon rather than a
  // guessed one.
  const factionOf = (from: string): FactionId | null => {
    if (from === player.name) return player.faction;
    const o = others.find((p) => p.name === from);
    return (o?.faction as FactionId | null) ?? null;
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    if (text.toLowerCase() === "/admin") {
      if (isAdmin) {
        gameState.showAdmin = !gameState.showAdmin;
        bump();
        pushChat("system", "SYSTEM", gameState.showAdmin ? "Admin console opened." : "Admin console closed.");
      } else {
        pushChat("system", "SYSTEM", "Access denied.");
      }
    } else if (isSystem && isAdmin) {
      sendChat("broadcast", text);
    } else if (!isSystem) {
      sendChat(c.key, text);
    }
    setDraft("");
  };

  return (
    <div style={{ position: "relative", width: 400, padding: 8, boxSizing: "border-box", filter: `drop-shadow(0 5px 0 rgba(3,5,10,.95)) drop-shadow(0 10px 9px rgba(0,0,0,.8)) drop-shadow(0 22px 26px rgba(0,0,0,.7)) drop-shadow(0 0 22px ${chAmbient})` }}>
      <i style={{ position: "absolute", inset: 0, display: "block", background: metalRim, ...metalRimStyle, boxShadow: "inset 1px 1px 0 rgba(255,255,255,.42),inset -1px -1px 2px rgba(0,0,0,.7)", clipPath: "polygon(18px 0,calc(100% - 18px) 0,100% 18px,100% calc(100% - 18px),calc(100% - 18px) 100%,18px 100%,0 calc(100% - 18px),0 18px)" }} />
      <i style={{ position: "absolute", inset: 3, display: "block", background: "linear-gradient(135deg,#e6eefa,#8e9aab 40%,#3f4854 74%,#232932)", clipPath: "polygon(15px 0,calc(100% - 15px) 0,100% 15px,100% calc(100% - 15px),calc(100% - 15px) 100%,15px 100%,0 calc(100% - 15px),0 15px)" }} />
      <i style={{ position: "absolute", inset: 5, display: "block", background: "linear-gradient(135deg,#6f7b8c,#2b323d 52%,#0e1218)", clipPath: "polygon(13px 0,calc(100% - 13px) 0,100% 13px,100% calc(100% - 13px),calc(100% - 13px) 100%,13px 100%,0 calc(100% - 13px),0 13px)" }} />
      <i style={{ position: "absolute", inset: 6.5, display: "block", background: "linear-gradient(135deg,#241533,#0a0512)", clipPath: "polygon(11.5px 0,calc(100% - 11.5px) 0,100% 11.5px,100% calc(100% - 11.5px),calc(100% - 11.5px) 100%,11.5px 100%,0 calc(100% - 11.5px),0 11.5px)" }} />

      <div style={{
        position: "relative", display: "grid", overflow: "hidden",
        // Same fixed purple energy-flow wash as the Combat Console (H-02) —
        // not the per-channel tint, so the console/chat/minimap all share
        // one consistent atmosphere regardless of active channel/accent.
        background: "repeating-linear-gradient(90deg,rgba(140,190,220,.03) 0 1px,transparent 1px 3px),radial-gradient(620px 240px at 50% -22%,rgba(150,96,225,.32),rgba(96,44,168,.12) 48%,transparent 72%),linear-gradient(180deg,#2a1c3f,#120c1e 58%,#08050f)",
        boxShadow: "inset 0 3px 9px rgba(0,0,0,.7),inset 0 -1px 0 rgba(220,200,250,.2)",
        clipPath: "polygon(10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px),0 10px)",
      }}>
        <i style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(74deg,transparent 0 26px,rgba(255,255,255,.03) 26px 27px,transparent 27px 61px),repeating-linear-gradient(-58deg,transparent 0 43px,rgba(255,255,255,.02) 43px 44px,transparent 44px 97px)", pointerEvents: "none" }} />
        <i style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg,transparent,${c.hex},transparent)`, boxShadow: `0 0 12px ${c.hex}`, opacity: 0.55, transition: "background .4s ease", pointerEvents: "none" }} />

        {/* tabs */}
        <div style={{ position: "relative", display: "flex", alignItems: "stretch", gap: 1, overflow: "hidden", margin: "0 14px", background: "rgba(4,8,16,.55)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.45),inset 0 2px 6px rgba(0,0,0,.5)" }}>
          {CHAN.map((t, i) => (
            <TabButton key={t.key} c={t} on={tab === i} onClick={() => setTab(i)} />
          ))}
          {(["top", "bottom"] as const).map((side) => (
            <div key={side}>
              <i style={{ position: "absolute", zIndex: 4, [side]: 0, left: `${tab * 25}%`, width: "25%", height: 5, pointerEvents: "none", opacity: 0.28, filter: "blur(4px)", background: `linear-gradient(90deg,transparent,${c.hex},transparent)`, transition: "left 480ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
              <i style={{ position: "absolute", zIndex: 4, [side]: 0, left: `${tab * 25}%`, width: "25%", height: 3, pointerEvents: "none", opacity: 0.55, filter: "blur(2px)", background: `linear-gradient(90deg,transparent,${c.hex},transparent)`, transition: "left 380ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
              <i style={{ position: "absolute", zIndex: 5, [side]: 0, left: `${tab * 25}%`, width: "25%", height: 2, pointerEvents: "none", background: `linear-gradient(90deg,transparent,${c.hex} 22%,${c.hex} 78%,transparent)`, boxShadow: `0 0 10px ${c.hex},0 0 24px ${c.hex}`, transition: "left 260ms cubic-bezier(.22,.9,.25,1),background .3s ease" }} />
            </div>
          ))}
        </div>

        {/* log */}
        <div ref={logRef} style={{ position: "relative", margin: "12px 14px 0", padding: "11px 13px", height: 158, overflowY: "auto", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.6)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06),inset 0 6px 14px rgba(0,0,0,.55)" }}>
          <div style={{ position: "relative", display: "grid", gap: 6 }}>
            {log.length === 0 ? (
              <small style={{ fontSize: 12.4, color: "rgba(190,214,236,.4)", fontStyle: "italic" }}>No messages yet.</small>
            ) : log.map((m, i) => {
              const rowIsSystem = m.channel === "system";
              // Broadcasts land with from:"ADMIN" (see the server's
              // "broadcast" pseudo-channel) — that sender name IS shown,
              // even on the SYSTEM tab, so a broadcast reads as "ADMIN:
              // <text>" rather than an anonymous system line. Any other
              // system-channel message (the old kill/reward/info style)
              // still has no sender.
              const isAdminName = m.from === "ADMIN";
              const who = rowIsSystem && !isAdminName ? "" : m.from;
              // A regular admin-sent message on a normal channel is
              // recognized by name match against the local admin session,
              // since the server doesn't tag every message with sender
              // privilege.
              const isAdminMsg = isAdminName || (isAdmin && who === player.name);
              const showAdminTag = isAdminMsg && !isAdminName;
              const faction = who ? factionOf(who) : null;
              const iconFile = faction ? FACTION_ICON_FILE[FACTIONS[faction].tag] : undefined;
              // Only the literal "ADMIN" sender name (the broadcast
              // identity) reads gold. When the admin player posts under
              // their own name on a normal channel, the NAME stays that
              // channel's color like anyone else's — only the [ADMIN] tag
              // next to it is gold, so it doesn't look like "Tammapac" is
              // somehow a different, gold-colored player.
              const nameColor = isAdminName ? "#e8b94d" : c.hex;
              const nameGlow = isAdminName ? "rgba(232,185,77,.7)" : chGlow;
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13.6, lineHeight: 1.5, animation: `cRowIn .32s cubic-bezier(.2,.9,.25,1) ${(Math.min(i, 10) * 55)}ms both` }}>
                  <small style={{ flex: "0 0 auto", fontFamily: "var(--font-mono)", fontSize: 10.6, color: "rgba(122,146,184,.65)" }}>
                    {new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </small>
                  {who && (
                    <span style={{ flex: "0 0 auto", display: "flex", alignItems: "baseline", gap: 4 }}>
                      {iconFile && (
                        <img src={`/assets/ui/factions/${iconFile}.png`} title={FACTIONS[faction!].tag} style={{ width: 11, height: 11, objectFit: "contain", verticalAlign: "middle", filter: `drop-shadow(0 0 2px ${FACTIONS[faction!].color})` }} />
                      )}
                      <b style={{ fontWeight: 700, color: nameColor, textShadow: `0 0 9px ${nameGlow}` }}>{who}</b>
                      {showAdminTag && (
                        <small style={{ fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#e8b94d", textShadow: "0 0 6px rgba(232,185,77,.7)" }}>[ADMIN]</small>
                      )}
                    </span>
                  )}
                  <span style={{ flex: 1, minWidth: 0, color: isAdminMsg ? "#f5dda6" : rowIsSystem ? "rgba(226,210,248,.62)" : "rgba(214,224,240,.86)", fontStyle: rowIsSystem ? "italic" : "normal" }}>{m.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* composer — SYSTEM has none for regular players; it's a read-only
            broadcast feed. Only the admin gets a composer there, and it
            sends via the server's "broadcast" pseudo-channel. */}
        {(!isSystem || isAdmin) && (
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, margin: "10px 14px 14px", minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto", padding: "7px 10px", background: `linear-gradient(180deg,${chTint},rgba(6,5,12,.9))`, boxShadow: `inset 0 1px 0 rgba(220,238,255,.18),inset 0 0 0 1px ${chBorder}`, clipPath: "polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)" }}>
              <i style={{ width: 6, height: 6, background: c.hex, boxShadow: `0 0 8px ${c.hex}`, transform: "rotate(45deg)" }} />
              <b style={{ fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.2em", fontWeight: 700, color: c.hex, transition: "color .3s ease", whiteSpace: "nowrap" }}>{isSystem ? "BROADCAST" : c.n}</b>
            </span>
            <span style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center", padding: "8px 11px", background: "radial-gradient(ellipse at 50% 0%,rgba(0,0,0,0),rgba(0,0,0,.5)),rgba(4,5,11,.65)", boxShadow: "inset 2px 2px 0 rgba(0,0,0,.5),inset -1px -1px 0 rgba(143,176,208,.06)" }}>
              <input
                value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder={isSystem ? "Message every channel, every player…" : c.prompt}
                style={{
                  flex: 1, minWidth: 0, background: "none", border: "none", outline: "none",
                  fontSize: 13, fontFamily: "var(--font-body)", color: "#eef2ff",
                }}
              />
            </span>
            <SendButton onClick={send} hex={c.hex} tint={chTint} ambient={chAmbient} glow={chGlow} />
          </div>
        )}
      </div>
    </div>
  );
}
