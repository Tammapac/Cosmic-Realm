import { state, bump, useGame, pushNotification, save, stationPrice, addCargo, removeCargo, cargoUsed, cargoCapacity, maxDroneSlots, claimMission, rerollDaily } from "../game/store";
import {
  ActiveQuest, DRONE_DEFS, DroneKind, DroneMode, FACTIONS, LASER_TIER_COLOR, LASER_TIER_NAME,
  Quest, RESOURCES, ResourceId, SHIP_CLASSES, SKILL_NODES, STATIONS, ShipClassId, SkillBranch,
  SkillId, UPGRADE_COST,
} from "../game/types";
import type { HangarTab } from "../game/store";
import { effectiveStats } from "../game/loop";
import { buySkillRank, resetSkills } from "../game/store";

const TABS: { id: HangarTab; label: string; glyph: string }[] = [
  { id: "bounties", label: "Bounties", glyph: "★" },
  { id: "missions", label: "Missions", glyph: "▣" },
  { id: "skills",   label: "Skills",   glyph: "✦" },
  { id: "ships",    label: "Shipyard", glyph: "▲" },
  { id: "equip",    label: "Outfit",   glyph: "⚙" },
  { id: "drones",   label: "Drones",   glyph: "✦" },
  { id: "market",   label: "Market",   glyph: "$" },
  { id: "cargo",    label: "Cargo",    glyph: "▼" },
  { id: "repair",   label: "Services", glyph: "✚" },
];

export function Hangar({ stationId }: { stationId: string }) {
  const tab = useGame((s) => s.hangarTab);
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(2, 4, 12, 0.85)" }}>
      <div className="panel relative" style={{ width: "min(1080px, 96vw)", height: "min(680px, 92vh)" }}>
        <div className="scanline" />
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: "var(--border-soft)" }}>
          <div>
            <div className="text-mute text-[10px] tracking-widest">DOCKED AT · {station.kind.toUpperCase()}</div>
            <div className="text-cyan glow-cyan text-xl font-bold tracking-widest">{station.name.toUpperCase()}</div>
            <div className="text-dim text-[11px] mt-0.5">{station.description}</div>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => {
              state.dockedAt = null;
              state.player.pos.y += 200;
              state.cameraTarget = { ...state.player.pos };
              save();
              bump();
            }}
          >
            ✕ Undock
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto" style={{ borderColor: "var(--border-soft)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className="px-4 py-2.5 text-[11px] tracking-widest uppercase whitespace-nowrap transition-colors"
              style={{
                background: tab === t.id ? "rgba(78, 226, 255, 0.1)" : "transparent",
                color: tab === t.id ? "var(--accent-cyan)" : "var(--text-dim)",
                borderBottom: tab === t.id ? "2px solid var(--accent-cyan)" : "2px solid transparent",
              }}
              onClick={() => { state.hangarTab = t.id; bump(); }}
            >
              {t.glyph} {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto" style={{ height: "calc(100% - 130px)" }}>
          {tab === "bounties" && <BountiesTab />}
          {tab === "missions" && <MissionsTab />}
          {tab === "skills" && <SkillsTab />}
          {tab === "equip" && <EquipTab />}
          {tab === "ships" && <ShipsTab />}
          {tab === "drones" && <DronesTab />}
          {tab === "market" && <MarketTab stationId={stationId} />}
          {tab === "cargo" && <CargoTab />}
          {tab === "repair" && <RepairTab stationId={stationId} />}
        </div>
      </div>
    </div>
  );
}

// ── BOUNTIES ──────────────────────────────────────────────────────────────
function BountiesTab() {
  const player = useGame((s) => s.player);
  const available = useGame((s) => s.availableQuests);

  const accept = (q: Quest) => {
    if (player.activeQuests.find((x) => x.id === q.id)) return;
    if (player.activeQuests.length >= 5) {
      pushNotification("Quest log full (5 max)", "bad");
      return;
    }
    player.activeQuests.push({ ...q, progress: 0, completed: false });
    pushNotification(`Accepted: ${q.title}`, "good");
    save(); bump();
  };

  const turnIn = (q: ActiveQuest) => {
    if (!q.completed) return;
    player.credits += q.rewardCredits;
    player.exp += q.rewardExp;
    player.honor += q.rewardHonor;
    player.completedQuests.push(q.id);
    player.activeQuests = player.activeQuests.filter((x) => x.id !== q.id);
    pushNotification(`+${q.rewardCredits}cr +${q.rewardExp}xp +${q.rewardHonor} honor`, "good");
    save(); bump();
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div>
        <div className="text-cyan tracking-widest text-xs mb-3">▶ AVAILABLE BOUNTIES</div>
        <div className="space-y-2">
          {available.map((q) => {
            const has = player.activeQuests.find((x) => x.id === q.id);
            const done = player.completedQuests.includes(q.id);
            return (
              <div key={q.id} className="panel p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-amber glow-amber text-sm font-bold">{q.title}</div>
                    <div className="text-dim text-[11px] mt-1 mb-2">{q.description}</div>
                    <div className="flex gap-3 text-[10px] flex-wrap">
                      <span className="text-cyan">⚔ {q.killCount}× {q.killType}</span>
                      <span className="text-amber">+{q.rewardCredits}cr</span>
                      <span className="text-magenta">+{q.rewardExp}xp</span>
                      <span className="text-green">+{q.rewardHonor} honor</span>
                    </div>
                  </div>
                  <button className="btn btn-primary" disabled={!!has || done} onClick={() => accept(q)}>
                    {done ? "Done" : has ? "Active" : "Accept"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <div className="text-cyan tracking-widest text-xs mb-3">▶ ACTIVE QUESTS ({player.activeQuests.length}/5)</div>
        <div className="space-y-2">
          {player.activeQuests.length === 0 && (
            <div className="text-mute text-xs italic">No active quests. Take a contract from the board.</div>
          )}
          {player.activeQuests.map((q) => (
            <div key={q.id} className="panel p-3">
              <div className="text-amber glow-amber text-sm font-bold">{q.title}</div>
              <div className="text-dim text-[11px] mt-1 mb-2">
                {q.progress}/{q.killCount} {q.killType}s eliminated
              </div>
              <div className="bar mb-2">
                <div className="bar-fill" style={{
                  width: `${(q.progress / q.killCount) * 100}%`,
                  background: "linear-gradient(90deg, #ff5cf066, #ff5cf0)",
                  boxShadow: "0 0 6px #ff5cf0",
                }} />
              </div>
              <button className="btn btn-amber w-full" disabled={!q.completed} onClick={() => turnIn(q)}>
                {q.completed ? "Turn In" : "In Progress"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── EQUIP ─────────────────────────────────────────────────────────────────
function EquipTab() {
  const player = useGame((s) => s.player);

  const upgrade = (which: "laserTier" | "thrusterTier" | "shieldTier") => {
    const cost = UPGRADE_COST(player.equipment[which]);
    if (player.credits < cost) { pushNotification("Not enough credits", "bad"); return; }
    if (player.equipment[which] >= 8) { pushNotification("Already maxed", "bad"); return; }
    player.credits -= cost;
    player.equipment[which]++;
    pushNotification(`Upgraded ${which.replace("Tier", "")} → T${player.equipment[which]}`, "good");
    save(); bump();
  };

  const items: { key: "laserTier" | "thrusterTier" | "shieldTier"; name: string; effect: string; getColor: (t: number) => string; nameTier?: (t: number) => string }[] = [
    { key: "laserTier",    name: "Laser Array",       effect: "+6 damage / tier · faster fire rate · color shifts at elite tiers", getColor: (t) => LASER_TIER_COLOR(t), nameTier: (t) => LASER_TIER_NAME(t) },
    { key: "thrusterTier", name: "Ion Thrusters",     effect: "+30 max speed / tier",                                                getColor: () => "#5cff8a" },
    { key: "shieldTier",   name: "Shield Generator",  effect: "+25 shield max / tier · faster regen",                                getColor: () => "#ff5cf0" },
  ];

  return (
    <div className="p-5 space-y-4">
      <div className="text-cyan tracking-widest text-xs mb-2">
        ▶ SHIP SYSTEMS · {SHIP_CLASSES[player.shipClass].name.toUpperCase()}
      </div>
      {items.map((it) => {
        const tier = player.equipment[it.key];
        const cost = UPGRADE_COST(tier);
        const maxed = tier >= 8;
        const color = it.getColor(tier);
        return (
          <div key={it.key} className="panel p-4 flex items-center gap-4">
            <div
              className="flex flex-col items-center justify-center"
              style={{ width: 56, height: 56, background: `${color}22`, border: `1px solid ${color}`, color }}
            >
              <div className="text-xl font-bold leading-none">T{tier}</div>
              {it.nameTier && <div className="text-[8px] tracking-widest mt-0.5">{it.nameTier(tier).toUpperCase()}</div>}
            </div>
            <div className="flex-1">
              <div className="font-bold tracking-widest" style={{ color }}>
                {it.name.toUpperCase()}
              </div>
              <div className="text-dim text-[11px]">{it.effect}</div>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-2 flex-1" style={{
                    background: i < tier ? color : "#1a2348",
                    boxShadow: i < tier ? `0 0 4px ${color}` : "none",
                  }} />
                ))}
              </div>
            </div>
            <button className="btn btn-primary" disabled={maxed || player.credits < cost} onClick={() => upgrade(it.key)}>
              {maxed ? "MAXED" : `Upgrade · ${cost}cr`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── SHIPS ─────────────────────────────────────────────────────────────────
function ShipsTab() {
  const player = useGame((s) => s.player);

  const buy = (id: ShipClassId) => {
    const cls = SHIP_CLASSES[id];
    if (player.ownedShips.includes(id)) {
      player.shipClass = id;
      const stats = effectiveStats();
      player.hull = stats.hullMax; player.shield = stats.shieldMax;
      // drone slots may shrink — drop overflow
      player.drones = player.drones.slice(0, cls.droneSlots);
      pushNotification(`Boarded ${cls.name}`, "good");
      save(); bump();
      return;
    }
    if (player.credits < cls.price) { pushNotification("Not enough credits", "bad"); return; }
    player.credits -= cls.price;
    player.ownedShips.push(id);
    player.shipClass = id;
    const stats = effectiveStats();
    player.hull = stats.hullMax; player.shield = stats.shieldMax;
    player.drones = player.drones.slice(0, cls.droneSlots);
    pushNotification(`Acquired ${cls.name}!`, "good");
    save(); bump();
  };

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {(Object.values(SHIP_CLASSES) as { id: ShipClassId; [k: string]: any }[]).map((cls) => {
        const owned = player.ownedShips.includes(cls.id);
        const active = player.shipClass === cls.id;
        return (
          <div key={cls.id} className="panel p-3" style={{ borderColor: active ? cls.color : "var(--border-glow)" }}>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="flex items-center justify-center text-xl font-bold"
                style={{ width: 44, height: 44, background: `${cls.color}22`, border: `1px solid ${cls.color}`, color: cls.color }}
              >
                ▲
              </div>
              <div className="flex-1">
                <div className="font-bold tracking-widest text-sm" style={{ color: cls.color }}>
                  {cls.name.toUpperCase()}
                </div>
                <div className="text-dim text-[10px]">{cls.description}</div>
              </div>
              {active && <div className="text-cyan text-[9px] tracking-widest">[ACTIVE]</div>}
            </div>
            <div className="grid grid-cols-5 gap-1 text-[10px] mb-2">
              <Stat label="HUL" v={cls.hullMax} />
              <Stat label="SHD" v={cls.shieldMax} />
              <Stat label="SPD" v={cls.baseSpeed} />
              <Stat label="DMG" v={cls.baseDamage} />
              <Stat label="DRN" v={cls.droneSlots} />
            </div>
            <button className="btn btn-primary w-full" disabled={active || (!owned && player.credits < cls.price)} onClick={() => buy(cls.id)}>
              {active ? "Currently flying" : owned ? "Switch" : `Buy · ${cls.price.toLocaleString()}cr`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="text-mute">{label}</div>
      <div className="text-cyan font-bold">{v}</div>
    </div>
  );
}

// ── DRONES ────────────────────────────────────────────────────────────────
function DronesTab() {
  const player = useGame((s) => s.player);
  const cls = SHIP_CLASSES[player.shipClass];
  const totalSlots = maxDroneSlots();
  const slotsLeft = totalSlots - player.drones.length;

  const buy = (kind: DroneKind) => {
    const def = DRONE_DEFS[kind];
    if (player.credits < def.price) { pushNotification("Not enough credits", "bad"); return; }
    if (slotsLeft <= 0) { pushNotification("No drone slots free", "bad"); return; }
    player.credits -= def.price;
    player.drones.push({
      id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      kind,
      mode: "orbit",
      hp: 60 + def.shieldBonus * 0.5,
      hpMax: 60 + def.shieldBonus * 0.5,
      orbitPhase: Math.random() * Math.PI * 2,
      fireCd: 0,
    });
    pushNotification(`Deployed ${def.name}`, "good");
    save(); bump();
  };

  const setMode = (id: string, mode: DroneMode) => {
    const d = player.drones.find((x) => x.id === id);
    if (!d) return;
    d.mode = mode;
    pushNotification(`Drone set to ${mode.toUpperCase()}`, "info");
    save(); bump();
  };

  const scrap = (id: string) => {
    const d = player.drones.find((x) => x.id === id);
    if (!d) return;
    const def = DRONE_DEFS[d.kind];
    const refund = Math.floor(def.price * 0.5);
    player.credits += refund;
    player.drones = player.drones.filter((x) => x.id !== id);
    pushNotification(`Scrapped drone +${refund}cr`, "good");
    save(); bump();
  };

  return (
    <div className="p-4 grid grid-cols-2 gap-4">
      <div>
        <div className="text-cyan tracking-widest text-xs mb-3">
          ▶ DRONE BAY — {player.drones.length}/{totalSlots} SLOTS
        </div>
        <div className="space-y-2">
          {player.drones.length === 0 && (
            <div className="text-mute italic text-xs">No drones deployed.</div>
          )}
          {player.drones.map((d) => {
            const def = DRONE_DEFS[d.kind];
            return (
              <div key={d.id} className="panel p-3 flex items-center gap-3">
                <div
                  className="flex items-center justify-center text-lg"
                  style={{ width: 40, height: 40, background: `${def.color}22`, border: `1px solid ${def.color}`, color: def.color }}
                >
                  ✦
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs" style={{ color: def.color }}>{def.name}</div>
                  <div className="text-dim text-[10px]">
                    {def.damageBonus > 0 && `+${def.damageBonus} dmg `}
                    {def.shieldBonus > 0 && `+${def.shieldBonus} shd `}
                    {def.hullBonus > 0 && `+${def.hullBonus} hp`}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    {(["orbit", "forward", "defensive"] as DroneMode[]).map((m) => (
                      <button
                        key={m}
                        className="btn"
                        style={{
                          padding: "2px 6px", fontSize: 8,
                          background: d.mode === m ? `${def.color}33` : "transparent",
                          borderColor: d.mode === m ? def.color : "var(--border-glow)",
                          color: d.mode === m ? def.color : "var(--text-dim)",
                        }}
                        onClick={() => setMode(d.id, m)}
                      >
                        {m === "orbit" ? "ORB" : m === "forward" ? "FWD" : "DEF"}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-danger" style={{ padding: "2px 6px", fontSize: 9 }} onClick={() => scrap(d.id)}>
                    Scrap
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-mute text-[9px] mt-2 italic">
          Modes: ORBIT (default circle), FORWARD (advance to mid-target), DEFENSIVE (hold close, short range).
        </div>
      </div>

      <div>
        <div className="text-cyan tracking-widest text-xs mb-3">▶ DRONE CATALOG</div>
        <div className="space-y-2">
          {Object.values(DRONE_DEFS).map((def) => (
            <div key={def.id} className="panel p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-xs" style={{ color: def.color }}>{def.name}</div>
                <div className="text-amber text-xs font-bold">{def.price.toLocaleString()}cr</div>
              </div>
              <div className="text-dim text-[10px] mb-2">{def.description}</div>
              <div className="flex gap-3 text-[10px] mb-2">
                {def.damageBonus > 0 && <span className="text-red">+{def.damageBonus} dmg</span>}
                {def.shieldBonus > 0 && <span className="text-cyan">+{def.shieldBonus} shield</span>}
                {def.hullBonus > 0 && <span className="text-green">+{def.hullBonus} hull</span>}
                {def.fireRate > 0 && <span className="text-amber">{def.fireRate.toFixed(1)} shots/s</span>}
              </div>
              <button
                className="btn btn-primary w-full"
                disabled={player.credits < def.price || slotsLeft <= 0}
                onClick={() => buy(def.id)}
              >
                {slotsLeft <= 0 ? "No slots" : `Deploy · ${def.price.toLocaleString()}cr`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MARKET ────────────────────────────────────────────────────────────────
function MarketTab({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const station = STATIONS.find((s) => s.id === stationId)!;
  const cls = SHIP_CLASSES[player.shipClass];

  const buy = (rid: ResourceId, qty: number) => {
    const price = stationPrice(stationId, rid);
    const cost = price * qty;
    if (player.credits < cost) { pushNotification("Not enough credits", "bad"); return; }
    if (cargoUsed() + qty > cls.cargoMax) { pushNotification("Cargo bay full", "bad"); return; }
    player.credits -= cost;
    addCargo(rid, qty);
    pushNotification(`Bought ${qty}× ${RESOURCES[rid].name} · -${cost.toLocaleString()}cr`, "good");
    save(); bump();
  };

  const sell = (rid: ResourceId, qty: number) => {
    const have = player.cargo.find((c) => c.resourceId === rid);
    if (!have) return;
    const take = Math.min(have.qty, qty);
    if (take <= 0) return;
    const price = stationPrice(stationId, rid);
    const earn = price * take;
    removeCargo(rid, take);
    player.credits += earn;
    pushNotification(`Sold ${take}× ${RESOURCES[rid].name} · +${earn.toLocaleString()}cr`, "good");
    save(); bump();
  };

  const allRes = Object.values(RESOURCES);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-cyan tracking-widest text-xs">▶ COMMODITY EXCHANGE</div>
          <div className="text-mute text-[10px]">
            Buy low at one station, sell high at another. Different stations specialize in different resources.
          </div>
        </div>
        <div className="text-right">
          <div className="text-mute text-[10px]">CREDITS</div>
          <div className="text-amber font-bold">{player.credits.toLocaleString()}cr</div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 px-2 py-1 text-[9px] tracking-widest text-mute border-b" style={{ borderColor: "var(--border-soft)" }}>
        <div className="col-span-2">RESOURCE</div>
        <div className="text-right">BASE</div>
        <div className="text-right">HERE</div>
        <div className="text-right">±</div>
        <div className="text-right">CARGO</div>
        <div className="text-center">TRADE</div>
      </div>

      <div className="space-y-1 mt-1">
        {allRes.map((r) => {
          const price = stationPrice(stationId, r.id);
          const diff = ((price - r.basePrice) / r.basePrice) * 100;
          const have = player.cargo.find((c) => c.resourceId === r.id)?.qty ?? 0;
          return (
            <div key={r.id} className="grid grid-cols-7 gap-2 items-center px-2 py-1.5 hover:bg-white/5 border-b" style={{ borderColor: "var(--border-soft)" }}>
              <div className="col-span-2 flex items-center gap-2">
                <div
                  className="flex items-center justify-center"
                  style={{ width: 22, height: 22, background: `${r.color}22`, border: `1px solid ${r.color}`, color: r.color, fontSize: 12 }}
                >
                  {r.glyph}
                </div>
                <div>
                  <div className="text-bright text-[11px]">{r.name}</div>
                  <div className="text-mute text-[8px]">{r.description}</div>
                </div>
              </div>
              <div className="text-right text-mute text-[11px] tabular-nums">{r.basePrice}</div>
              <div className="text-right font-bold tabular-nums" style={{ color: diff < 0 ? "#5cff8a" : diff > 0 ? "#ff5c6c" : "var(--text-dim)" }}>
                {price}
              </div>
              <div className="text-right text-[10px] tabular-nums" style={{ color: diff < 0 ? "#5cff8a" : "#ff5c6c" }}>
                {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
              </div>
              <div className="text-right text-cyan text-[11px] tabular-nums">{have}</div>
              <div className="flex gap-1 justify-center">
                <button className="btn" style={{ padding: "2px 6px", fontSize: 9 }} onClick={() => buy(r.id, 1)}>+1</button>
                <button className="btn" style={{ padding: "2px 6px", fontSize: 9 }} onClick={() => buy(r.id, 10)}>+10</button>
                <button className="btn btn-amber" style={{ padding: "2px 6px", fontSize: 9 }} disabled={have <= 0} onClick={() => sell(r.id, 1)}>-1</button>
                <button className="btn btn-amber" style={{ padding: "2px 6px", fontSize: 9 }} disabled={have < 10} onClick={() => sell(r.id, 10)}>-10</button>
                <button className="btn btn-amber" style={{ padding: "2px 6px", fontSize: 9 }} disabled={have <= 0} onClick={() => sell(r.id, have)}>All</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-mute text-[10px] italic">
        Tip: visit Iron Belt Refinery for cheap iron and lumenite. Resell quantum chips at Crimson stations for premium.
      </div>
    </div>
  );
}

// ── CARGO ─────────────────────────────────────────────────────────────────
function CargoTab() {
  const player = useGame((s) => s.player);
  const cls = SHIP_CLASSES[player.shipClass];
  const total = cargoUsed();

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-cyan tracking-widest text-xs">▶ CARGO BAY</div>
          <div className="text-mute text-[11px]">Carrying {total}/{cls.cargoMax} units</div>
        </div>
      </div>
      {player.cargo.length === 0 && (
        <div className="text-mute text-xs italic">Empty. Mine asteroids, defeat enemies, or trade at the market.</div>
      )}
      <div className="space-y-2">
        {player.cargo.map((c) => {
          const r = RESOURCES[c.resourceId];
          return (
            <div key={c.resourceId} className="panel p-3 flex items-center gap-3">
              <div
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, background: `${r.color}22`, border: `1px solid ${r.color}`, color: r.color, fontSize: 16 }}
              >
                {r.glyph}
              </div>
              <div className="flex-1">
                <div style={{ color: r.color }} className="font-bold text-sm">{r.name}</div>
                <div className="text-mute text-[10px]">×{c.qty} · base {r.basePrice}cr/u</div>
              </div>
              <div className="text-amber font-bold tabular-nums">{(c.qty * r.basePrice).toLocaleString()}cr</div>
            </div>
          );
        })}
      </div>
      <div className="text-mute text-[10px] italic mt-3">
        Use the Market tab to sell cargo at the current station's prices.
      </div>
    </div>
  );
}

// ── REPAIR / SERVICES ─────────────────────────────────────────────────────
function RepairTab({ stationId: _stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const stats = effectiveStats();
  const hullDamage = stats.hullMax - player.hull;
  const shieldMissing = stats.shieldMax - player.shield;
  const repairCost = Math.ceil(hullDamage * 2);
  const refillShield = () => {
    player.shield = stats.shieldMax;
    pushNotification("Shields recharged", "good");
    save(); bump();
  };
  const repair = () => {
    if (hullDamage <= 0) { pushNotification("Hull is already pristine", "info"); return; }
    if (player.credits < repairCost) { pushNotification("Not enough credits", "bad"); return; }
    player.credits -= repairCost;
    player.hull = stats.hullMax;
    pushNotification(`Hull repaired · -${repairCost}cr`, "good");
    save(); bump();
  };
  const repairDrones = () => {
    let total = 0;
    for (const d of player.drones) {
      const cost = Math.ceil((d.hpMax - d.hp) * 1.5);
      total += cost;
    }
    if (player.credits < total) { pushNotification("Not enough credits", "bad"); return; }
    player.credits -= total;
    for (const d of player.drones) d.hp = d.hpMax;
    pushNotification(`Drones repaired · -${total}cr`, "good");
    save(); bump();
  };

  const droneRepairCost = player.drones.reduce((a, d) => a + Math.ceil((d.hpMax - d.hp) * 1.5), 0);

  return (
    <div className="p-5 space-y-4 max-w-2xl">
      <div className="text-cyan tracking-widest text-xs mb-2">▶ STATION SERVICES</div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-green">✚</div>
        <div className="flex-1">
          <div className="text-green font-bold tracking-widest">HULL REPAIR</div>
          <div className="text-dim text-[11px]">Restore {hullDamage} hull points to full integrity.</div>
        </div>
        <button className="btn btn-primary" disabled={hullDamage <= 0 || player.credits < repairCost} onClick={repair}>
          {hullDamage <= 0 ? "PRISTINE" : `Repair · ${repairCost}cr`}
        </button>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-cyan">⟁</div>
        <div className="flex-1">
          <div className="text-cyan font-bold tracking-widest">SHIELD RECHARGE</div>
          <div className="text-dim text-[11px]">Free at any docked station. Restores {Math.round(shieldMissing)} SP.</div>
        </div>
        <button className="btn btn-primary" disabled={shieldMissing <= 0} onClick={refillShield}>
          {shieldMissing <= 0 ? "FULL" : "Recharge · FREE"}
        </button>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-amber">✦</div>
        <div className="flex-1">
          <div className="text-amber font-bold tracking-widest">DRONE OVERHAUL</div>
          <div className="text-dim text-[11px]">
            Restore all {player.drones.length} drone(s) to full HP.
          </div>
        </div>
        <button className="btn btn-amber" disabled={droneRepairCost <= 0 || player.credits < droneRepairCost} onClick={repairDrones}>
          {droneRepairCost <= 0 ? "ALL OK" : `Repair · ${droneRepairCost}cr`}
        </button>
      </div>

      <div className="panel p-4">
        <div className="text-cyan tracking-widest text-xs mb-2">▶ INSURANCE & RESPAWN</div>
        <div className="text-dim text-[11px]">
          Death penalty: <span className="text-red font-bold">10% credit loss</span> · Hull and shield refilled · Respawn at last station.
          Carry less cash and bank earnings between bounty runs.
        </div>
      </div>
    </div>
  );
}

// ── SKILLS ────────────────────────────────────────────────────────────────
function SkillsTab() {
  const player = useGame((s) => s.player);
  const branches: { id: SkillBranch; name: string; color: string }[] = [
    { id: "offense",  name: "OFFENSE",  color: "#ff5c6c" },
    { id: "defense",  name: "DEFENSE",  color: "#4ee2ff" },
    { id: "utility",  name: "UTILITY",  color: "#5cff8a" },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-cyan tracking-widest text-xs">▶ SKILL TREE</div>
          <div className="text-mute text-[10px] mt-1">Earn 1 skill point per level. Spend below.</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="panel px-3 py-2">
            <div className="text-mute text-[9px] tracking-widest">UNSPENT</div>
            <div className="text-amber font-bold text-lg tabular-nums">{player.skillPoints}</div>
          </div>
          <button
            className="btn btn-danger"
            style={{ padding: "6px 12px", fontSize: 10 }}
            onClick={() => { if (confirm("Reset skills for 2000cr?")) resetSkills(); }}
          >
            RESPEC · 2000cr
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {branches.map((b) => (
          <div key={b.id} className="panel p-3">
            <div className="font-bold tracking-widest text-xs mb-2" style={{ color: b.color }}>
              ◆ {b.name}
            </div>
            <div className="space-y-2">
              {SKILL_NODES.filter((n) => n.branch === b.id).map((n) => {
                const cur = player.skills[n.id] ?? 0;
                const reqMet = !n.requires || (player.skills[n.requires] ?? 0) > 0;
                const canBuy = cur < n.maxRank && reqMet && player.skillPoints >= n.cost;
                return (
                  <div
                    key={n.id}
                    className="p-2"
                    style={{
                      background: cur > 0 ? `${b.color}11` : "rgba(255,255,255,0.02)",
                      border: `1px solid ${cur > 0 ? b.color + "66" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-[11px]" style={{ color: cur > 0 ? b.color : "var(--text-dim)" }}>
                        {n.name}
                      </div>
                      <div className="text-[10px] tabular-nums" style={{ color: b.color }}>
                        {cur}/{n.maxRank}
                      </div>
                    </div>
                    <div className="text-dim text-[10px] mb-1">{n.description}</div>
                    {n.requires && (
                      <div className="text-mute text-[9px] mb-1">
                        Requires: {SKILL_NODES.find((x) => x.id === n.requires)?.name}
                      </div>
                    )}
                    <button
                      className="btn"
                      style={{
                        padding: "3px 8px", fontSize: 9, width: "100%",
                        borderColor: canBuy ? b.color : "var(--border-glow)",
                        color: canBuy ? b.color : "var(--text-mute)",
                        background: canBuy ? `${b.color}15` : "transparent",
                      }}
                      disabled={!canBuy}
                      onClick={() => buySkillRank(n.id as SkillId)}
                    >
                      {cur >= n.maxRank ? "MAX" : !reqMet ? "LOCKED" : `Buy · ${n.cost} pt${n.cost > 1 ? "s" : ""}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MISSIONS ──────────────────────────────────────────────────────────────
function MissionsTab() {
  const player = useGame((s) => s.player);
  const next = new Date(player.lastDailyReset + 24 * 3600 * 1000);
  const hrs = Math.max(0, Math.floor((next.getTime() - Date.now()) / 3600000));
  const mins = Math.max(0, Math.floor(((next.getTime() - Date.now()) % 3600000) / 60000));

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-cyan tracking-widest text-xs">▶ DAILY MISSIONS</div>
          <div className="text-mute text-[10px] mt-1">Resets in {hrs}h {mins}m</div>
        </div>
        <button
          className="btn btn-amber"
          style={{ padding: "6px 12px", fontSize: 10 }}
          onClick={rerollDaily}
          disabled={player.credits < 500}
        >
          REROLL · 500cr
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {player.dailyMissions.map((m) => {
          const pct = Math.min(1, m.progress / m.target);
          const claimed = m.claimed;
          const ready = m.completed && !claimed;
          return (
            <div
              key={m.id}
              className="panel p-3"
              style={{
                opacity: claimed ? 0.5 : 1,
                borderColor: ready ? "#5cff8a" : "var(--border-soft)",
              }}
            >
              <div className="font-bold text-[11px] text-cyan mb-1">{m.title}</div>
              <div className="text-dim text-[10px] mb-2">{m.description}</div>
              <div className="text-mute text-[10px] tabular-nums mb-1">
                {m.progress}/{m.target}
              </div>
              <div className="w-full h-1 mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${pct * 100}%`,
                    background: ready ? "#5cff8a" : "var(--accent-cyan)",
                  }}
                />
              </div>
              <div className="text-amber text-[10px] mb-2">
                +{m.rewardCredits}cr · +{m.rewardExp}xp · +{m.rewardHonor}✪
              </div>
              <button
                className="btn btn-primary w-full"
                style={{ padding: "4px 8px", fontSize: 10 }}
                disabled={!ready}
                onClick={() => claimMission(m.id)}
              >
                {claimed ? "CLAIMED" : ready ? "CLAIM" : "IN PROGRESS"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Milestones */}
      <div className="text-cyan tracking-widest text-xs mt-4 mb-2">▶ LIFETIME MILESTONES</div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(player.milestones).map(([k, v]) => (
          <div key={k} className="panel p-2">
            <div className="text-mute text-[9px] tracking-widest uppercase">{k}</div>
            <div className="text-amber font-bold text-sm tabular-nums">{(v as number).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
