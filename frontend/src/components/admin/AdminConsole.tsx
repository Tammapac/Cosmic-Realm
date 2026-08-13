// Full admin console: edit EVERY column of the players table.
//
// The field list is not written here. It is fetched from the server
// (admin:fields), which derives it from the Drizzle schema — so this editor
// covers all 55 columns today and covers any column added later without a
// code change on either side. A hand-maintained list is exactly what the old
// panel had, and it silently omitted two thirds of the table.
//
// Each field renders by its declared kind: numbers as number inputs, booleans
// as toggles, JSON as a textarea holding pretty-printed text, protected
// fields as read-only with the server's reason shown.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminListPlayers, adminGetPlayer, adminUpdatePlayer, adminFields, adminSetAdmin,
} from "../../net/socket";
import { state, bump, save as saveGame } from "../../game/store";
import { serverPlayerId } from "../../game/loop";
import { rankFor, rankIcon, rankIconSrcSet, HONOR_RANKS, OUTLAW_HONOR, ADMIN_INDEX } from "../../game/types";

type FieldKind = "number" | "integer" | "string" | "boolean" | "json" | "date";

interface FieldMeta {
  key: string;
  column: string;
  kind: FieldKind;
  notNull: boolean;
  maxLength?: number;
  protected: boolean;
  protectedReason?: string;
}

type PlayerRow = { id: number; name: string; level: number; credits: number; shipClass: string; honor: number };

// Grouping is purely presentational — the server sends a flat list. Fields
// whose key matches a group's prefixes land in that group; anything left over
// falls into "Other", so a new column always shows up somewhere rather than
// being silently dropped.
const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Identity", keys: ["id", "accountId", "name", "isAdmin", "faction", "level", "exp"] },
  { title: "Currency", keys: ["credits", "mcoins", "honor"] },
  { title: "Ship & Combat", keys: ["shipClass", "hull", "shield", "ownedShips", "equipped", "weapon", "generator", "module"] },
  { title: "Position", keys: ["zone", "posX", "posY", "instanceId"] },
  { title: "Ammo & Consumables", keys: ["ammo", "rocketAmmoType", "ammoByType", "droneAmmo", "droneAmmoMax", "autoRestock", "autoRepairHull", "autoShieldRecharge", "consumables", "hotbar"] },
  { title: "Inventory & Cargo", keys: ["inventory", "cargo", "inventoryExtraPage", "bebcell"] },
  { title: "Drones", keys: ["drones", "petDrone"] },
  { title: "Skills", keys: ["skillPoints", "skills"] },
  { title: "Clan", keys: ["clanId", "clanRole", "clanContribution"] },
  { title: "Quests & Milestones", keys: ["activeQuests", "completedQuests", "dailyMissions", "lastDailyReset", "milestones", "totalKills", "totalMined", "totalCreditsEarned", "totalWarps", "totalDeaths", "bossKills", "totalContracts", "totalSalvaged", "dungeonClears", "dungeonBestTimes"] },
  { title: "Exchange", keys: ["exchangeHoldings", "exchangeDebt", "exchangeLoanCount", "exchangeLoanWeek", "exchangePremium", "exchangeLastInterestDay"] },
  { title: "Session", keys: ["lastSeen", "totalPlaytime", "leaderboardAllTimeBuff"] },
];

const inputStyle: React.CSSProperties = {
  background: "#0a0e1a", border: "1px solid #2a3a5c", color: "#dde",
  fontSize: 12.5, padding: "3px 6px", borderRadius: 3, width: "100%",
  fontFamily: "var(--font-mono)", boxSizing: "border-box",
};

function FieldRow({
  f, value, dirty, onChange,
}: {
  f: FieldMeta;
  value: unknown;
  dirty: boolean;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <span
      title={`${f.column} · ${f.kind}${f.notNull ? " · NOT NULL" : ""}`}
      style={{
        color: f.protected ? "#667" : dirty ? "#ffd24a" : "#889",
        fontSize: 11.4, width: 168, flex: "0 0 auto",
        fontFamily: "var(--font-mono)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}
    >
      {dirty ? "● " : ""}{f.key}
    </span>
  );

  if (f.protected) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, opacity: 0.65 }}>
        {label}
        <span style={{ ...inputStyle, color: "#778", background: "#080b14" }}>
          {String(value ?? "")}
        </span>
        <span title={f.protectedReason} style={{ color: "#a86", fontSize: 14, flex: "0 0 auto", cursor: "help" }}>🔒</span>
      </div>
    );
  }

  let control: React.ReactNode;
  if (f.kind === "boolean") {
    control = (
      <label style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <span style={{ color: value ? "#5cff8a" : "#667" }}>{String(Boolean(value))}</span>
      </label>
    );
  } else if (f.kind === "json") {
    control = (
      <textarea
        value={typeof value === "string" ? value : JSON.stringify(value ?? null, null, 1)}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        rows={3}
        style={{ ...inputStyle, resize: "vertical", minHeight: 46, lineHeight: 1.35 }}
      />
    );
  } else if (f.kind === "number" || f.kind === "integer") {
    control = (
      <input
        type="number" value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        style={inputStyle}
      />
    );
  } else {
    control = (
      <input
        type="text" value={value === null || value === undefined ? "" : String(value)}
        maxLength={f.maxLength}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
      {label}
      <div style={{ flex: 1, minWidth: 0 }}>{control}</div>
    </div>
  );
}

export function AdminConsole({ onClose }: { onClose: () => void }) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState("");
  const [fieldFilter, setFieldFilter] = useState("");
  const [denied, setDenied] = useState(false);

  const refresh = useCallback(() => {
    adminListPlayers((d) => {
      if (d?.players) setPlayers(d.players);
      else if (d?.error) { setDenied(true); setStatus(d.error); }
    });
  }, []);

  useEffect(() => {
    refresh();
    adminFields((d) => {
      if (d?.fields) setFields(d.fields);
      else if (d?.error) { setDenied(true); setStatus(d.error); }
    });
  }, [refresh]);

  const load = (id: number) => {
    setSelected(id); setEdits({}); setStatus("");
    adminGetPlayer(id, (d) => {
      if (d?.player) setDetail(d.player);
      else setStatus(d?.error ?? "Load failed");
    });
  };

  const val = (k: string) => (k in edits ? edits[k] : detail?.[k]);
  const setEdit = (k: string, v: unknown) => setEdits((p) => ({ ...p, [k]: v }));
  const dirtyKeys = Object.keys(edits);

  const save = () => {
    if (!selected || dirtyKeys.length === 0) return;
    setStatus("Saving…");
    adminUpdatePlayer(selected, edits, (d) => {
      if (d?.ok) {
        setStatus(`Saved: ${(d.applied ?? dirtyKeys).join(", ")}`);
        // Mirror into local state when editing yourself, so the HUD updates
        // without a relog — same reason the server pushes admin:sync.
        if (selected === serverPlayerId) {
          for (const [k, v] of Object.entries(edits)) {
            if (k in (state.player as any)) (state.player as any)[k] = v;
          }
          bump(); saveGame();
        }
        setDetail((p) => (p ? { ...p, ...edits } : p));
        setEdits({});
        refresh();
      } else {
        setStatus("Error: " + (d?.error ?? "unknown"));
      }
    });
  };

  const grouped = useMemo(() => {
    const q = fieldFilter.trim().toLowerCase();
    const visible = q ? fields.filter((f) => f.key.toLowerCase().includes(q)) : fields;
    const claimed = new Set<string>();
    const out: { title: string; items: FieldMeta[] }[] = [];
    for (const g of GROUPS) {
      const items = visible.filter((f) => g.keys.includes(f.key));
      items.forEach((f) => claimed.add(f.key));
      if (items.length) out.push({ title: g.title, items });
    }
    // Anything the groups do not name still gets shown — a new column must
    // never be invisible just because GROUPS was not updated.
    const rest = visible.filter((f) => !claimed.has(f.key));
    if (rest.length) out.push({ title: "Other", items: rest });
    return out;
  }, [fields, fieldFilter]);

  const shown = players.filter((p) =>
    !filter.trim() || p.name.toLowerCase().includes(filter.trim().toLowerCase()));

  const targetIsAdmin = Boolean(val("isAdmin"));
  const honorNow = Number(val("honor")) || 0;

  if (denied) {
    return (
      <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="panel" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ color: "#ff5c6c", fontWeight: "bold", marginBottom: 8 }}>Unauthorized</div>
          <div style={{ color: "#889", fontSize: 12.5, marginBottom: 14 }}>
            This account does not have the staff flag.
          </div>
          <button onClick={onClose} className="gbtn" style={{ padding: "4px 14px" }}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 1080, maxWidth: "96vw", height: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="hud-titleband" style={{ justifyContent: "space-between" }}>
          <span>ADMIN CONSOLE</span>
          <button onClick={onClose} className="gbtn gbtn-red gbtn--quiet" style={{ padding: "2px 10px", fontSize: 11.8 }}>ESC</button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Player list */}
          <div style={{ width: 210, borderRight: "1px solid #1a2a4c", display: "flex", flexDirection: "column" }}>
            <input
              value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter players…"
              style={{ ...inputStyle, margin: 8, width: "calc(100% - 16px)" }}
            />
            <div style={{ overflowY: "auto", padding: "0 8px 8px" }}>
              {shown.map((p) => (
                <div key={p.id} onClick={() => load(p.id)} style={{
                  padding: "6px 8px", marginBottom: 2, borderRadius: 4, cursor: "pointer",
                  background: selected === p.id ? "rgba(78,226,255,0.1)" : "transparent",
                  border: selected === p.id ? "1px solid #4ee2ff33" : "1px solid transparent",
                  fontSize: 12.8, color: selected === p.id ? "#4ee2ff" : "#aab",
                  display: "flex", justifyContent: "space-between", gap: 6,
                }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span style={{ color: "#556", fontSize: 10.6, flex: "0 0 auto" }}>Lv{p.level}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!detail ? (
              <div style={{ color: "#556", fontSize: 14, textAlign: "center", paddingTop: 80 }}>
                Select a player
              </div>
            ) : (
              <>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #1a2a4c", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <img
                    src={rankIcon(rankFor(honorNow))}
                    srcSet={rankIconSrcSet(rankFor(honorNow))}
                    alt="" style={{ height: 30, width: "auto", maxWidth: 44, objectFit: "contain" }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#4ee2ff", fontWeight: "bold", fontSize: 15 }}>
                      {detail.name} <span style={{ color: "#556", fontSize: 11.4 }}>#{detail.id}</span>
                    </div>
                    <div style={{ color: "#889", fontSize: 11.4 }}>
                      {rankFor(honorNow).name}
                      {targetIsAdmin && <span style={{ color: "#e8b94d" }}> · STAFF</span>}
                    </div>
                  </div>

                  <span style={{ flex: 1 }} />

                  {/* Rank shortcut — sets honor, since rank is derived from it */}
                  <select
                    value={rankFor(honorNow).index}
                    onChange={(e) => {
                      const r = HONOR_RANKS.find((x) => x.index === Number(e.target.value));
                      if (r) setEdit("honor", r.index === 0 ? OUTLAW_HONOR : r.minHonor);
                    }}
                    style={{ ...inputStyle, width: 210 }}
                  >
                    {HONOR_RANKS.map((r) => (
                      <option key={r.index} value={r.index}>
                        {r.index === 0 ? "OUTLAW" : r.index === ADMIN_INDEX ? "★ ADMINISTRATOR" : `${String(r.index).padStart(2, "0")} · ${r.name}`}
                      </option>
                    ))}
                  </select>

                  {/* Staff grant — deliberately not part of the field grid */}
                  <button
                    onClick={() => {
                      const next = !targetIsAdmin;
                      if (!confirm(`${next ? "Grant" : "Revoke"} admin for ${detail.name}?`)) return;
                      adminSetAdmin(detail.id, next, (d) => {
                        if (d?.ok) { setStatus(`${next ? "Granted" : "Revoked"} admin for ${d.player.name}`); setDetail((p) => (p ? { ...p, isAdmin: next } : p)); }
                        else setStatus("Error: " + (d?.error ?? "unknown"));
                      });
                    }}
                    className="gbtn"
                    style={{ padding: "4px 12px", fontSize: 11.8, color: targetIsAdmin ? "#ff8a94" : "#e8b94d" }}
                  >
                    {targetIsAdmin ? "Revoke admin" : "Grant admin"}
                  </button>
                </div>

                <div style={{ padding: "6px 14px", borderBottom: "1px solid #12203c" }}>
                  <input
                    value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}
                    placeholder={`Filter ${fields.length} fields…`}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
                  {grouped.map((g) => (
                    <div key={g.title} style={{ marginBottom: 14 }}>
                      <div style={{ color: "#4ee2ff", fontSize: 10.6, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, borderBottom: "1px solid #12203c", paddingBottom: 3 }}>
                        {g.title}
                      </div>
                      {g.items.map((f) => (
                        <FieldRow
                          key={f.key} f={f} value={val(f.key)} dirty={f.key in edits}
                          onChange={(v) => setEdit(f.key, v)}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                <div style={{ padding: "8px 14px", borderTop: "1px solid #1a2a4c", display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={save} disabled={dirtyKeys.length === 0} className="gbtn"
                    style={{ padding: "4px 16px", fontSize: 12.5, opacity: dirtyKeys.length ? 1 : 0.45 }}>
                    Save {dirtyKeys.length > 0 ? `(${dirtyKeys.length})` : ""}
                  </button>
                  <button onClick={() => setEdits({})} disabled={dirtyKeys.length === 0} className="gbtn gbtn--quiet"
                    style={{ padding: "4px 12px", fontSize: 12.5, opacity: dirtyKeys.length ? 1 : 0.45 }}>
                    Discard
                  </button>
                  <span style={{ color: status.startsWith("Error") ? "#ff5c6c" : "#5cff8a", fontSize: 11.8, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {status}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200,
  display: "flex", alignItems: "center", justifyContent: "center",
};

export default AdminConsole;
