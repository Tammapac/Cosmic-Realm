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

  const showClan = useGame((s) => s.showClan);
  if (!showClan) return null;

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

import { ZONES as ZONES_LOCAL, ZoneId as ZoneIdType } from "../game/types";
import { travelToZone } from "../game/store";

type MapNode = { id: ZoneIdType; cx: number; cy: number; faction: string; color: string };

const MAP_NODES: MapNode[] = [
  // Earth (top-left cluster)
  { id: "alpha",    cx: 70,  cy: 100, faction: "earth", color: "#4ee2ff" },
  { id: "nebula",   cx: 175, cy: 100, faction: "earth", color: "#4ee2ff" },
  { id: "crimson",  cx: 70,  cy: 215, faction: "earth", color: "#4ee2ff" },
  { id: "void",     cx: 175, cy: 215, faction: "earth", color: "#4ee2ff" },
  { id: "forge",    cx: 265, cy: 315, faction: "earth", color: "#4ee2ff" },
  // Mars (top-right cluster)
  { id: "corona",    cx: 690, cy: 100, faction: "mars", color: "#ff8a4e" },
  { id: "fracture",  cx: 585, cy: 100, faction: "mars", color: "#ff8a4e" },
  { id: "abyss",     cx: 690, cy: 215, faction: "mars", color: "#ff8a4e" },
  { id: "marsdepth", cx: 585, cy: 215, faction: "mars", color: "#ff8a4e" },
  { id: "maelstrom", cx: 495, cy: 315, faction: "mars", color: "#ff8a4e" },
  // Venus (bottom cluster)
  { id: "venus1",  cx: 230, cy: 475, faction: "venus", color: "#c86cff" },
  { id: "venus2",  cx: 380, cy: 475, faction: "venus", color: "#c86cff" },
  { id: "venus3",  cx: 530, cy: 475, faction: "venus", color: "#c86cff" },
  { id: "venus4",  cx: 310, cy: 395, faction: "venus", color: "#c86cff" },
  { id: "venus5",  cx: 450, cy: 395, faction: "venus", color: "#c86cff" },
  // Danger Zones (center, red — PvP)
  { id: "danger1", cx: 380, cy: 300, faction: "danger", color: "#ff3b3b" },
  { id: "danger2", cx: 335, cy: 345, faction: "danger", color: "#ff3b3b" },
  { id: "danger3", cx: 425, cy: 345, faction: "danger", color: "#ff3b3b" },
  { id: "danger4", cx: 355, cy: 260, faction: "danger", color: "#ff3b3b" },
  { id: "danger5", cx: 405, cy: 260, faction: "danger", color: "#ff3b3b" },
];

const MAP_LINKS: [ZoneIdType, ZoneIdType][] = [
  // Earth internal
  ["alpha", "nebula"], ["alpha", "crimson"], ["nebula", "void"], ["crimson", "void"], ["void", "forge"],
  // Mars internal
  ["corona", "fracture"], ["corona", "abyss"], ["fracture", "marsdepth"], ["abyss", "marsdepth"], ["marsdepth", "maelstrom"],
  // Venus internal
  ["venus1", "venus4"], ["venus2", "venus4"], ["venus2", "venus5"], ["venus3", "venus5"], ["venus4", "venus5"],
  // Cross-faction bridges to danger zones
  ["forge", "danger1"], ["maelstrom", "danger1"], ["venus5", "danger1"],
  // Danger zone internal
  ["danger1", "danger2"], ["danger1", "danger3"], ["danger2", "danger3"],
  ["danger1", "danger4"], ["danger1", "danger5"], ["danger4", "danger5"],
];

const FACTION_LABELS: { text: string; x: number; y: number; color: string }[] = [
  { text: "EARTH [EIC]", x: 122, y: 50, color: "#4ee2ff" },
  { text: "MARS [MMO]", x: 638, y: 50, color: "#ff8a4e" },
  { text: "VENUS [VRU]", x: 380, y: 530, color: "#c86cff" },
  { text: "DANGER ZONES", x: 380, y: 225, color: "#ff3b3b" },
];

export function GalaxyMap() {
  const player = useGame((s) => s.player);
  const [hovered, setHovered] = useState<ZoneIdType | null>(null);
  const showMap = useGame((s) => s.showMap);

  if (!showMap) return null;

  const nodeMap = new Map(MAP_NODES.map((n) => [n.id, n]));

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(2,4,12,0.92)" }}>
      <div className="panel" style={{ width: "min(96vw, 820px)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: "var(--border-soft)", flexShrink: 0 }}>
          <div className="text-cyan glow-cyan tracking-widest font-bold">★ GALAXY MAP</div>
          <button className="btn btn-danger" onClick={() => { state.showMap = false; bump(); }}>✕</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "12px" }}>
          <div style={{ position: "relative" }}>
          <svg viewBox="0 0 760 530" style={{ width: "100%", height: "auto" }}>
            {/* Faction territory backgrounds */}
            <polygon points="10,40 300,40 310,350 180,350 10,260" fill="#4ee2ff06" stroke="#4ee2ff15" strokeWidth={1} />
            <polygon points="460,40 750,40 750,260 580,350 450,350" fill="#ff8a4e06" stroke="#ff8a4e15" strokeWidth={1} />
            <polygon points="180,360 580,360 580,530 180,530" fill="#c86cff06" stroke="#c86cff15" strokeWidth={1} />
            <polygon points="320,235 440,235 440,370 320,370" fill="#ff3b3b0a" stroke="#ff3b3b22" strokeWidth={1} strokeDasharray="4 3" />

            {/* Faction labels */}
            {FACTION_LABELS.map((f) => (
              <text key={f.text} x={f.x} y={f.y} textAnchor="middle"
                fill={f.color} fontSize={11} fontWeight="bold" fontFamily="'Courier New', monospace"
                letterSpacing={2} opacity={0.8}
              >{f.text}</text>
            ))}

            {/* Connection lines */}
            {MAP_LINKS.map(([a, b], i) => {
              const na = nodeMap.get(a)!;
              const nb = nodeMap.get(b)!;
              const isCross = na.faction !== nb.faction;
              const mx = (na.cx + nb.cx) / 2;
              const my = (na.cy + nb.cy) / 2;
              return (
                <g key={i}>
                  <line x1={na.cx} y1={na.cy} x2={nb.cx} y2={nb.cy}
                    stroke={isCross ? "#ff5cf088" : na.color + "44"}
                    strokeWidth={isCross ? 1.5 : 1.5}
                    strokeDasharray={isCross ? "6 4" : "none"}
                  />
                  {/* Junction dot at midpoint */}
                  <circle cx={mx} cy={my} r={2.5}
                    fill={isCross ? "#ff5cf0" : na.color}
                    opacity={isCross ? 0.6 : 0.3}
                  />
                </g>
              );
            })}

            {/* Zone nodes */}
            {MAP_NODES.map((n) => {
              const z = ZONES_LOCAL[n.id];
              const locked = player.level < z.unlockLevel;
              const current = player.zone === n.id;
              const isHov = hovered === n.id;
              const w = current ? 68 : isHov ? 64 : 58;
              const h = current ? 42 : isHov ? 40 : 36;

              return (
                <g key={n.id}
                  style={{ cursor: locked ? "not-allowed" : "pointer" }}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (!locked && !current) {
                      travelToZone(n.id);
                      state.showMap = false;
                      bump();
                    }
                  }}
                >
                  {/* Outer glow for current */}
                  {current && (
                    <rect x={n.cx - w/2 - 4} y={n.cy - h/2 - 4} width={w + 8} height={h + 8} rx={4}
                      fill="none" stroke={n.color} strokeWidth={1.5} opacity={0.5}
                      strokeDasharray="4 3"
                    />
                  )}
                  {/* Background fill */}
                  <rect x={n.cx - w/2} y={n.cy - h/2} width={w} height={h} rx={3}
                    fill={locked ? "#0a0f24" : current ? n.color + "22" : isHov ? n.color + "15" : "#0c1228"}
                    stroke={locked ? "#1a2348" : n.color}
                    strokeWidth={current ? 2 : 1.2}
                  />
                  {/* Label top-left */}
                  <text x={n.cx - w/2 + 5} y={n.cy - 4} textAnchor="start"
                    fill={locked ? "#5a6a98" : "#e8f0ff"}
                    fontSize={12} fontWeight="bold" fontFamily="'Courier New', monospace"
                  >
                    {z.label}
                  </text>
                  {/* Tier badge */}
                  <text x={n.cx + w/2 - 5} y={n.cy - 4} textAnchor="end"
                    fill={locked ? "#3a4a68" : n.color}
                    fontSize={7} fontFamily="'Courier New', monospace"
                  >
                    T{z.enemyTier}
                  </text>
                  {/* Zone name */}
                  <text x={n.cx} y={n.cy + 12} textAnchor="middle"
                    fill={locked ? "#3a4a68" : isHov ? "#e8f0ff" : "#7a8ab8"}
                    fontSize={7} fontFamily="'Courier New', monospace"
                  >
                    {z.name.toUpperCase()}
                  </text>
                  {/* Lock indicator */}
                  {locked && (
                    <text x={n.cx} y={n.cy + h/2 + 12} textAnchor="middle"
                      fill="#ff5c6c" fontSize={7} fontFamily="'Courier New', monospace"
                    >
                      🔒 LV {z.unlockLevel}
                    </text>
                  )}
                  {/* Current marker */}
                  {current && (
                    <text x={n.cx} y={n.cy + h/2 + 12} textAnchor="middle"
                      fill={n.color} fontSize={7} fontWeight="bold" fontFamily="'Courier New', monospace"
                    >
                      ▸ HERE
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Hovered zone detail — absolute overlay */}
          {hovered && (() => {
            const z = ZONES_LOCAL[hovered];
            const n = nodeMap.get(hovered)!;
            return (
              <div className="panel p-2" style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderColor: n.color + "66", background: "rgba(6,10,28,0.95)", zIndex: 10 }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: n.color, fontWeight: "bold", fontSize: 12 }}>{z.label}</span>
                  <span style={{ color: "#e8f0ff", fontWeight: "bold", fontSize: 12 }}>{z.name.toUpperCase()}</span>
                  <span style={{ color: "#5a6a98", fontSize: 10 }}>Tier {z.enemyTier} · Lv {z.unlockLevel}+</span>
                </div>
                <div style={{ color: "#8a9ac8", fontSize: 10, marginTop: 2 }}>{z.description}</div>
              </div>
            );
          })()}
          </div>

          <div className="text-mute text-[9px] italic mt-2 text-center">
            Click a zone to warp. Dashed lines = cross-faction portals. Faction zones on borders, high-tier zones bridge the center.
          </div>
        </div>
      </div>
    </div>
  );
}
