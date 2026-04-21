import { useState } from "react";
import { state, bump, useGame, pushChat, pushNotification, save } from "../game/store";
import { FAKE_CLANS } from "../game/types";

export function SocialPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"players" | "chat">("players");
  const others = useGame((s) => s.others);
  const player = useGame((s) => s.player);
  const chat = useGame((s) => s.chat);

  return (
    <div className="panel" style={{ position: "absolute", right: 12, bottom: 12, width: collapsed ? 40 : 320, height: collapsed ? 40 : 360 }}>
      <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: "var(--border-soft)" }}>
        {!collapsed && (
          <div className="flex gap-1">
            <button
              className="px-3 py-1 text-[10px] tracking-widest uppercase"
              style={{
                color: tab === "players" ? "var(--accent-cyan)" : "var(--text-dim)",
                borderBottom: tab === "players" ? "1px solid var(--accent-cyan)" : "1px solid transparent",
              }}
              onClick={() => setTab("players")}
            >
              ◉ Pilots ({others.length})
            </button>
            <button
              className="px-3 py-1 text-[10px] tracking-widest uppercase"
              style={{
                color: tab === "chat" ? "var(--accent-cyan)" : "var(--text-dim)",
                borderBottom: tab === "chat" ? "1px solid var(--accent-cyan)" : "1px solid transparent",
              }}
              onClick={() => setTab("chat")}
            >
              ✉ Comms
            </button>
          </div>
        )}
        <button
          className="text-cyan text-xs px-2"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "◀" : "▶"}
        </button>
      </div>

      {!collapsed && tab === "players" && (
        <div className="overflow-y-auto" style={{ height: "calc(100% - 40px)" }}>
          {others.map((o) => (
            <div key={o.id} className="px-3 py-2 border-b flex items-center gap-2 hover:bg-white/5" style={{ borderColor: "var(--border-soft)" }}>
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: o.inParty ? "#5cff8a" : "#4ee2ff", boxShadow: `0 0 4px ${o.inParty ? "#5cff8a" : "#4ee2ff"}` }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-cyan text-xs font-bold truncate">{o.name}</div>
                <div className="text-mute text-[9px] truncate">
                  Lv {o.level} · {o.shipClass}
                  {o.clan && ` · <${o.clan}>`}
                </div>
              </div>
              {!o.inParty ? (
                <button
                  className="btn"
                  style={{ padding: "2px 8px", fontSize: 9 }}
                  onClick={() => {
                    if (player.party.length >= 4) {
                      pushNotification("Party is full (5 max)", "bad");
                      return;
                    }
                    o.inParty = true;
                    player.party.push(o.id);
                    pushChat("party", o.name, "thx for the invite!");
                    pushNotification(`${o.name} joined your party`, "good");
                    bump();
                  }}
                >
                  Invite
                </button>
              ) : (
                <button
                  className="btn btn-danger"
                  style={{ padding: "2px 8px", fontSize: 9 }}
                  onClick={() => {
                    o.inParty = false;
                    player.party = player.party.filter((p) => p !== o.id);
                    bump();
                  }}
                >
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!collapsed && tab === "chat" && <ChatBox chat={chat} />}
    </div>
  );
}

function ChatBox({ chat }: { chat: ReturnType<typeof useGame<typeof state.chat>> }) {
  const [input, setInput] = useState("");
  const [channel, setChannel] = useState<"local" | "party" | "clan">("local");
  const player = state.player;

  const send = () => {
    if (!input.trim()) return;
    pushChat(channel, player.name, input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100% - 40px)" }}>
      <div className="overflow-y-auto flex-1 p-2 text-[10px] space-y-1">
        {chat.map((c) => (
          <div key={c.id}>
            <span
              style={{
                color:
                  c.channel === "system"
                    ? "var(--accent-amber)"
                    : c.channel === "party"
                    ? "var(--accent-green)"
                    : c.channel === "clan"
                    ? "var(--accent-magenta)"
                    : "var(--text-dim)",
              }}
            >
              [{c.channel.toUpperCase()}]
            </span>{" "}
            <span className="text-cyan font-bold">{c.from}:</span>{" "}
            <span className="text-bright">{c.text}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1 p-2 border-t" style={{ borderColor: "var(--border-soft)" }}>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as any)}
          className="bg-black/40 border text-[10px] px-1"
          style={{ borderColor: "var(--border-glow)", color: "var(--accent-cyan)" }}
        >
          <option value="local">Local</option>
          <option value="party">Party</option>
          <option value="clan">Clan</option>
        </select>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Hail the comms..."
          className="flex-1 bg-black/40 border text-[10px] px-2"
          style={{ borderColor: "var(--border-glow)", color: "var(--text-bright)" }}
        />
        <button className="btn" style={{ padding: "2px 8px", fontSize: 9 }} onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}

export function ClanPanel() {
  const player = useGame((s) => s.player);
  const [name, setName] = useState("");

  if (!useGame((s) => s.showClan)) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(2,4,12,0.85)" }}>
      <div className="panel" style={{ width: 480 }}>
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
          <div className="text-cyan glow-cyan tracking-widest font-bold">⚑ CLAN COMMAND</div>
          <button
            className="btn btn-danger"
            onClick={() => {
              state.showClan = false;
              bump();
            }}
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          {player.clan ? (
            <div>
              <div className="text-mute text-[10px] tracking-widest mb-1">YOUR CLAN</div>
              <div className="text-magenta glow-cyan text-2xl font-bold mb-3">&lt;{player.clan}&gt;</div>
              <div className="text-dim text-xs mb-4">
                Your clan controls outposts across known space. Coordinate with allies in clan chat to stage raids,
                hunt dreads, and contest portal sectors.
              </div>
              <div className="text-mute text-[10px] tracking-widest mb-1">CLAN MEMBERS ONLINE</div>
              <div className="space-y-1 mb-4">
                {state.others
                  .filter((o) => o.clan === player.clan)
                  .map((o) => (
                    <div key={o.id} className="flex justify-between text-xs">
                      <span className="text-cyan">{o.name}</span>
                      <span className="text-mute">Lv {o.level}</span>
                    </div>
                  ))}
                {state.others.filter((o) => o.clan === player.clan).length === 0 && (
                  <div className="text-mute italic text-xs">No clanmates in this sector.</div>
                )}
              </div>
              <button
                className="btn btn-danger w-full"
                onClick={() => {
                  player.clan = null;
                  pushNotification("You left the clan", "info");
                  save();
                  bump();
                }}
              >
                Leave Clan
              </button>
            </div>
          ) : (
            <div>
              <div className="text-mute text-[10px] tracking-widest mb-2">JOIN AN EXISTING CLAN</div>
              <div className="space-y-2 mb-4">
                {FAKE_CLANS.map((c) => (
                  <div key={c} className="panel p-3 flex items-center justify-between">
                    <div>
                      <div className="text-magenta font-bold">&lt;{c}&gt;</div>
                      <div className="text-mute text-[10px]">
                        {state.others.filter((o) => o.clan === c).length} pilots in this sector
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        player.clan = c;
                        pushChat("clan", "RECRUITER", `Welcome to ${c}, ${player.name}.`);
                        pushNotification(`Joined ${c}`, "good");
                        save();
                        bump();
                      }}
                    >
                      Enlist
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-mute text-[10px] tracking-widest mb-2">FOUND YOUR OWN</div>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Clan name"
                  maxLength={18}
                  className="flex-1 bg-black/40 border text-xs px-2 py-2"
                  style={{ borderColor: "var(--border-glow)", color: "var(--text-bright)" }}
                />
                <button
                  className="btn btn-amber"
                  disabled={!name.trim() || player.credits < 5000}
                  onClick={() => {
                    if (player.credits < 5000) {
                      pushNotification("Founding fee: 5000cr", "bad");
                      return;
                    }
                    player.credits -= 5000;
                    player.clan = name.trim();
                    pushNotification(`Founded clan ${name.trim()}`, "good");
                    save();
                    bump();
                  }}
                >
                  Found · 5000cr
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GalaxyMap() {
  const player = useGame((s) => s.player);

  if (!useGame((s) => s.showMap)) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(2,4,12,0.9)" }}>
      <div className="panel" style={{ width: 640 }}>
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
          <div className="text-cyan glow-cyan tracking-widest font-bold">★ GALAXY MAP</div>
          <button
            className="btn btn-danger"
            onClick={() => {
              state.showMap = false;
              bump();
            }}
          >
            ✕
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          {(["alpha", "nebula", "crimson", "void"] as const).map((zid) => {
            const z = ZONES_LOCAL[zid];
            const locked = player.level < z.unlockLevel;
            const current = player.zone === zid;
            return (
              <div
                key={zid}
                className="panel p-3"
                style={{ borderColor: current ? "var(--accent-cyan)" : "var(--border-glow)" }}
              >
                <div
                  className="h-20 mb-2 relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${z.bgHueA}, ${z.bgHueB})`,
                    border: "1px solid var(--border-soft)",
                  }}
                >
                  <div className="absolute inset-0" style={{
                    background: `radial-gradient(circle at 30% 40%, ${z.bgHueA}88, transparent 60%), radial-gradient(circle at 70% 60%, ${z.bgHueB}88, transparent 60%)`
                  }} />
                </div>
                <div className="font-bold tracking-widest text-cyan">{z.name.toUpperCase()}</div>
                <div className="text-dim text-[11px] mb-2">{z.description}</div>
                <div className="text-mute text-[10px] mb-2">
                  Tier {z.enemyTier} · Min Lv {z.unlockLevel}
                </div>
                <div className="text-mute text-[10px] mb-2">Threats: {z.enemyTypes.join(", ")}</div>
                {current ? (
                  <button className="btn w-full" disabled>You are here</button>
                ) : (
                  <button
                    className="btn btn-primary w-full"
                    disabled={locked}
                    onClick={() => {
                      travelToZone(zid);
                      state.showMap = false;
                      bump();
                    }}
                  >
                    {locked ? `Requires Lv ${z.unlockLevel}` : "Warp Here"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-4 pb-3 text-mute text-[10px] italic">
          Tip: You can also travel by flying through magenta portals scattered across each sector.
        </div>
      </div>
    </div>
  );
}

import { ZONES as ZONES_LOCAL } from "../game/types";
import { travelToZone } from "../game/store";
