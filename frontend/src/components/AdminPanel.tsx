import { useState, useEffect, useCallback } from "react";
import { state, bump, useGame, pushChat, save as saveGame } from "../game/store";
import { serverPlayerId } from "../game/loop";
import { adminListPlayers, adminGetPlayer, adminUpdatePlayer } from "../net/socket";

const ADMIN_ID = 3;
const SHIP_CLASSES = [
  "skimmer","wasp","vanguard","reaver","obsidian","marauder",
  "phalanx","titan","leviathan","specter","colossus","harbinger",
  "eclipse","sovereign","apex"
];

type PlayerRow = { id: number; name: string; level: number; credits: number; shipClass: string; honor: number };
type PlayerDetail = Record<string, any>;

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"players" | "quick">("players");

  const isAdmin = serverPlayerId === ADMIN_ID;

  const refresh = useCallback(() => {
    adminListPlayers((data) => {
      if (data?.players) setPlayers(data.players);
      else setStatus("Failed to load players");
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const loadPlayer = (id: number) => {
    setSelected(id);
    setEdits({});
    setStatus("");
    adminGetPlayer(id, (data) => {
      if (data?.player) setDetail(data.player);
      else setStatus("Failed to load player");
    });
  };

  const setEdit = (key: string, value: any) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const saveChanges = () => {
    if (!selected || Object.keys(edits).length === 0) return;
    setStatus("Saving...");
    adminUpdatePlayer(selected, edits, (data) => {
      if (data?.ok) {
        setStatus("Saved!");
        // Update local game state if editing own player
        if (selected === serverPlayerId) {
          const p = state.player as any;
          for (const [k, v] of Object.entries(edits)) {
            if (k in p) p[k] = v;
          }
          bump();
          saveGame();
        }
        setEdits({});
        if (detail) setDetail({ ...detail, ...edits });
        refresh();
      } else {
        setStatus("Error: " + (data?.error || "unknown"));
      }
    });
  };

  if (!isAdmin) {
    return null;
  }

  const val = (key: string) => edits[key] !== undefined ? edits[key] : detail?.[key] ?? "";
  const changed = Object.keys(edits).length > 0;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.7)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "linear-gradient(135deg, #0a0e1a 0%, #121830 100%)",
        border: "1px solid #2a3a5c",
        borderRadius: 8,
        width: 700, maxHeight: "80vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 0 40px rgba(78,226,255,0.1)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #1a2a4c",
          background: "rgba(78,226,255,0.03)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#4ee2ff", fontSize: 14, fontWeight: "bold", letterSpacing: "0.1em" }}>
              ADMIN PANEL
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["players", "quick"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: tab === t ? "rgba(78,226,255,0.15)" : "transparent",
                  border: tab === t ? "1px solid #4ee2ff44" : "1px solid transparent",
                  color: tab === t ? "#4ee2ff" : "#667",
                  fontSize: 10, padding: "3px 10px", borderRadius: 3, cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,60,80,0.1)", border: "1px solid #ff3b4d33",
            color: "#ff8a9a", fontSize: 11, padding: "3px 10px", borderRadius: 3, cursor: "pointer",
          }}>ESC</button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Player list sidebar */}
          <div style={{
            width: 200, borderRight: "1px solid #1a2a4c",
            overflowY: "auto", padding: 8,
          }}>
            <div style={{ fontSize: 9, color: "#556", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Players ({players.length})
            </div>
            {players.map((p) => (
              <div key={p.id} onClick={() => loadPlayer(p.id)} style={{
                padding: "6px 8px", marginBottom: 2, borderRadius: 4, cursor: "pointer",
                background: selected === p.id ? "rgba(78,226,255,0.1)" : "transparent",
                border: selected === p.id ? "1px solid #4ee2ff33" : "1px solid transparent",
                fontSize: 11, color: selected === p.id ? "#4ee2ff" : "#aab",
                display: "flex", justifyContent: "space-between",
              }}>
                <span>{p.name}</span>
                <span style={{ color: "#556", fontSize: 9 }}>Lv{p.level}</span>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {tab === "quick" && (
              <QuickActions onStatus={setStatus} refresh={refresh} players={players} />
            )}
            {tab === "players" && !detail && (
              <div style={{ color: "#556", fontSize: 12, textAlign: "center", paddingTop: 60 }}>
                Select a player from the list
              </div>
            )}
            {tab === "players" && detail && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#4ee2ff", fontWeight: "bold" }}>
                  {detail.name} <span style={{ color: "#556", fontSize: 10 }}>(ID: {detail.id})</span>
                </div>

                <Section title="Resources">
                  <Field label="Credits" value={val("credits")} onChange={(v) => setEdit("credits", Number(v))} type="number" />
                  <Field label="Honor" value={val("honor")} onChange={(v) => setEdit("honor", Number(v))} type="number" />
                  <Field label="EXP" value={val("exp")} onChange={(v) => setEdit("exp", Number(v))} type="number" />
                  <Field label="Level" value={val("level")} onChange={(v) => setEdit("level", Number(v))} type="number" />
                  <Field label="Skill Points" value={val("skillPoints")} onChange={(v) => setEdit("skillPoints", Number(v))} type="number" />
                </Section>

                <Section title="Combat">
                  <Field label="Hull" value={val("hull")} onChange={(v) => setEdit("hull", Number(v))} type="number" />
                  <Field label="Shield" value={val("shield")} onChange={(v) => setEdit("shield", Number(v))} type="number" />
                </Section>

                <Section title="Ship">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "#889", fontSize: 10, width: 80 }}>Active Ship</span>
                    <select value={val("shipClass")} onChange={(e) => setEdit("shipClass", e.target.value)} style={{
                      background: "#0a0e1a", border: "1px solid #2a3a5c", color: "#dde",
                      fontSize: 11, padding: "3px 6px", borderRadius: 3,
                    }}>
                      {SHIP_CLASSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ fontSize: 10, color: "#889", marginBottom: 4 }}>Owned Ships</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {SHIP_CLASSES.map((s) => {
                      const owned = (val("ownedShips") || []).includes(s);
                      return (
                        <button key={s} onClick={() => {
                          const current = [...(val("ownedShips") || [])];
                          if (owned) setEdit("ownedShips", current.filter((x: string) => x !== s));
                          else setEdit("ownedShips", [...current, s]);
                        }} style={{
                          background: owned ? "rgba(78,226,255,0.12)" : "rgba(0,0,0,0.3)",
                          border: owned ? "1px solid #4ee2ff44" : "1px solid #1a2a4c",
                          color: owned ? "#4ee2ff" : "#445",
                          fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                        }}>{s}</button>
                      );
                    })}
                  </div>
                </Section>

                <Section title="Location">
                  <Field label="Zone" value={val("zone")} onChange={(v) => setEdit("zone", v)} />
                  <Field label="Faction" value={val("faction") || "none"} onChange={(v) => setEdit("faction", v === "none" ? null : v)} />
                </Section>

                {changed && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={saveChanges} style={{
                      background: "rgba(78,226,255,0.15)", border: "1px solid #4ee2ff66",
                      color: "#4ee2ff", fontSize: 11, padding: "6px 16px", borderRadius: 4, cursor: "pointer",
                      fontWeight: "bold",
                    }}>Save Changes</button>
                    <button onClick={() => { setEdits({}); setStatus(""); }} style={{
                      background: "transparent", border: "1px solid #333",
                      color: "#888", fontSize: 11, padding: "6px 12px", borderRadius: 4, cursor: "pointer",
                    }}>Reset</button>
                    <span style={{ color: "#556", fontSize: 10 }}>
                      {Object.keys(edits).length} field(s) changed
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        {status && (
          <div style={{
            padding: "6px 16px", borderTop: "1px solid #1a2a4c",
            fontSize: 10, color: status.startsWith("Error") ? "#ff6b6b" : "#4ee2ff",
          }}>{status}</div>
        )}
      </div>
    </div>
  );
}

function QuickActions({ onStatus, refresh, players }: {
  onStatus: (s: string) => void;
  refresh: () => void;
  players: PlayerRow[];
}) {
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState(10000);

  const findId = () => {
    const p = players.find((p) => p.name.toLowerCase() === target.toLowerCase());
    return p?.id;
  };

  const give = (field: string) => {
    const id = findId();
    if (!id) { onStatus("Player not found: " + target); return; }
    adminGetPlayer(id, (data) => {
      if (!data?.player) { onStatus("Failed to load player"); return; }
      const current = data.player[field] || 0;
      adminUpdatePlayer(id, { [field]: current + amount }, (res) => {
        if (res?.ok) {
          onStatus(`Gave ${amount} ${field} to ${target} (now ${current + amount})`);
          // Update local state if giving to self
          if (id === serverPlayerId) {
            (state.player as any)[field] = current + amount;
            bump();
            saveGame();
          }
          refresh();
        } else {
          onStatus("Error: " + (res?.error || "unknown"));
        }
      });
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 12, color: "#4ee2ff", fontWeight: "bold" }}>Quick Actions</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: "#889", fontSize: 10, width: 55 }}>Player</span>
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Name..."
          style={{ background: "#0a0e1a", border: "1px solid #2a3a5c", color: "#dde", fontSize: 11, padding: "4px 8px", borderRadius: 3, width: 140 }} />
        <span style={{ color: "#889", fontSize: 10, width: 55 }}>Amount</span>
        <input value={amount} onChange={(e) => setAmount(Number(e.target.value))} type="number"
          style={{ background: "#0a0e1a", border: "1px solid #2a3a5c", color: "#dde", fontSize: 11, padding: "4px 8px", borderRadius: 3, width: 100 }} />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { label: "Give Credits", field: "credits" },
          { label: "Give Honor", field: "honor" },
          { label: "Give EXP", field: "exp" },
          { label: "Give Skill Pts", field: "skillPoints" },
        ].map((a) => (
          <button key={a.field} onClick={() => give(a.field)} style={{
            background: "rgba(78,226,255,0.08)", border: "1px solid #2a3a5c",
            color: "#8ac", fontSize: 10, padding: "5px 12px", borderRadius: 3, cursor: "pointer",
          }}>{a.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 9, color: "#445", marginTop: 8 }}>
        Quick actions add the amount to the player's current value.
        Use the Players tab for precise edits.
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#556", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, borderBottom: "1px solid #1a2a4c", paddingBottom: 4 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: any; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#889", fontSize: 10, width: 80 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} style={{
        background: "#0a0e1a", border: "1px solid #2a3a5c", color: "#dde",
        fontSize: 11, padding: "3px 8px", borderRadius: 3, width: 160,
      }} />
    </div>
  );
}
