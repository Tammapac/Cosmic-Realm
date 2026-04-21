import { state, bump, useGame, pushNotification, save } from "../game/store";
import { ActiveQuest, Quest, SHIP_CLASSES, ShipClassId, UPGRADE_COST } from "../game/types";

export function Hangar({ stationId }: { stationId: string }) {
  const tab = useGame((s) => s.hangarTab);
  const player = useGame((s) => s.player);

  const stationName = {
    helix: "Helix Station",
    veiled: "Veiled Outpost",
    ember: "Ember Citadel",
    echo: "Echo Anchorage",
  }[stationId] || "Station";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(2, 4, 12, 0.85)" }}>
      <div className="scanline" style={{ height: 8 }} />
      <div className="panel" style={{ width: "min(960px, 95vw)", height: "min(640px, 90vh)" }}>
        <div className="scanline" />
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border-soft)" }}>
          <div>
            <div className="text-mute text-[10px] tracking-widest">DOCKED AT</div>
            <div className="text-cyan glow-cyan text-2xl font-bold tracking-widest">{stationName.toUpperCase()}</div>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => {
              state.dockedAt = null;
              // push player away from station so they don't immediately re-dock
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
        <div className="flex border-b" style={{ borderColor: "var(--border-soft)" }}>
          {(["quests", "equip", "ships", "cargo"] as const).map((t) => (
            <button
              key={t}
              className="px-6 py-3 text-xs tracking-widest uppercase transition-colors"
              style={{
                background: tab === t ? "rgba(78, 226, 255, 0.1)" : "transparent",
                color: tab === t ? "var(--accent-cyan)" : "var(--text-dim)",
                borderBottom: tab === t ? "2px solid var(--accent-cyan)" : "2px solid transparent",
              }}
              onClick={() => {
                state.hangarTab = t;
                bump();
              }}
            >
              {t === "quests" ? "★ Quests" : t === "equip" ? "⚙ Equipment" : t === "ships" ? "▲ Ships" : "▼ Cargo"}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto" style={{ height: "calc(100% - 130px)" }}>
          {tab === "quests" && <QuestsTab />}
          {tab === "equip" && <EquipTab />}
          {tab === "ships" && <ShipsTab />}
          {tab === "cargo" && <CargoTab />}
        </div>
      </div>
    </div>
  );
}

function QuestsTab() {
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
    save();
    bump();
  };

  const turnIn = (q: ActiveQuest) => {
    if (!q.completed) return;
    player.credits += q.rewardCredits;
    player.exp += q.rewardExp;
    player.honor += q.rewardHonor;
    player.completedQuests.push(q.id);
    player.activeQuests = player.activeQuests.filter((x) => x.id !== q.id);
    pushNotification(`+${q.rewardCredits}cr +${q.rewardExp}xp +${q.rewardHonor} honor`, "good");
    save();
    bump();
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
                    <div className="flex gap-3 text-[10px]">
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
                <div
                  className="bar-fill"
                  style={{
                    width: `${(q.progress / q.killCount) * 100}%`,
                    background: "linear-gradient(90deg, #ff5cf066, #ff5cf0)",
                    boxShadow: "0 0 6px #ff5cf0",
                  }}
                />
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

function EquipTab() {
  const player = useGame((s) => s.player);

  const upgrade = (which: "laserTier" | "thrusterTier" | "shieldTier") => {
    const cost = UPGRADE_COST(player.equipment[which]);
    if (player.credits < cost) {
      pushNotification("Not enough credits", "bad");
      return;
    }
    if (player.equipment[which] >= 8) {
      pushNotification("Already maxed", "bad");
      return;
    }
    player.credits -= cost;
    player.equipment[which]++;
    pushNotification(`Upgraded: ${which.replace("Tier", "")} now T${player.equipment[which]}`, "good");
    save();
    bump();
  };

  const items: { key: "laserTier" | "thrusterTier" | "shieldTier"; name: string; effect: string; color: string }[] = [
    { key: "laserTier", name: "Laser Array", effect: "+6 damage / tier · faster fire rate", color: "#4ee2ff" },
    { key: "thrusterTier", name: "Ion Thrusters", effect: "+30 max speed / tier", color: "#5cff8a" },
    { key: "shieldTier", name: "Shield Generator", effect: "+25 shield max / tier · faster regen", color: "#ff5cf0" },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="text-cyan tracking-widest text-xs mb-2">▶ SHIP SYSTEMS · {SHIP_CLASSES[player.shipClass].name.toUpperCase()}</div>
      {items.map((it) => {
        const tier = player.equipment[it.key];
        const cost = UPGRADE_COST(tier);
        const maxed = tier >= 8;
        return (
          <div key={it.key} className="panel p-4 flex items-center gap-4">
            <div
              className="flex items-center justify-center text-2xl font-bold"
              style={{ width: 56, height: 56, background: `${it.color}22`, border: `1px solid ${it.color}`, color: it.color }}
            >
              T{tier}
            </div>
            <div className="flex-1">
              <div className="font-bold tracking-widest" style={{ color: it.color }}>
                {it.name.toUpperCase()}
              </div>
              <div className="text-dim text-[11px]">{it.effect}</div>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-2 flex-1"
                    style={{
                      background: i < tier ? it.color : "#1a2348",
                      boxShadow: i < tier ? `0 0 4px ${it.color}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={maxed || player.credits < cost}
              onClick={() => upgrade(it.key)}
            >
              {maxed ? "MAXED" : `Upgrade · ${cost}cr`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ShipsTab() {
  const player = useGame((s) => s.player);

  const buy = (id: ShipClassId) => {
    const cls = SHIP_CLASSES[id];
    if (player.ownedShips.includes(id)) {
      // switch
      player.shipClass = id;
      player.hull = cls.hullMax;
      player.shield = cls.shieldMax;
      pushNotification(`Boarded ${cls.name}`, "good");
      save();
      bump();
      return;
    }
    if (player.credits < cls.price) {
      pushNotification("Not enough credits", "bad");
      return;
    }
    player.credits -= cls.price;
    player.ownedShips.push(id);
    player.shipClass = id;
    player.hull = cls.hullMax;
    player.shield = cls.shieldMax;
    pushNotification(`Acquired ${cls.name}!`, "good");
    save();
    bump();
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {(Object.values(SHIP_CLASSES) as typeof SHIP_CLASSES[ShipClassId][]).map((cls) => {
        const owned = player.ownedShips.includes(cls.id);
        const active = player.shipClass === cls.id;
        return (
          <div
            key={cls.id}
            className="panel p-4"
            style={{ borderColor: active ? cls.color : "var(--border-glow)" }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 flex items-center justify-center text-xl"
                style={{ background: `${cls.color}22`, border: `1px solid ${cls.color}`, color: cls.color }}
              >
                ▲
              </div>
              <div className="flex-1">
                <div className="font-bold tracking-widest" style={{ color: cls.color }}>
                  {cls.name.toUpperCase()}
                </div>
                <div className="text-dim text-[11px]">{cls.description}</div>
              </div>
              {active && <div className="text-cyan text-[10px] tracking-widest">[ACTIVE]</div>}
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10px] mb-3">
              <Stat label="HULL" v={cls.hullMax} />
              <Stat label="SHIELD" v={cls.shieldMax} />
              <Stat label="SPEED" v={cls.baseSpeed} />
              <Stat label="DMG" v={cls.baseDamage} />
            </div>
            <button
              className="btn btn-primary w-full"
              disabled={active || (!owned && player.credits < cls.price)}
              onClick={() => buy(cls.id)}
            >
              {active ? "Currently flying" : owned ? "Switch to ship" : `Purchase · ${cls.price.toLocaleString()}cr`}
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

function CargoTab() {
  const player = useGame((s) => s.player);
  const total = player.cargo.reduce((a, c) => a + c.qty, 0);
  const value = player.cargo.reduce((a, c) => a + c.qty * c.pricePerUnit, 0);

  const sellAll = () => {
    if (!player.cargo.length) return;
    player.credits += value;
    pushNotification(`Sold ${total} units for ${value}cr`, "good");
    player.cargo = [];
    save();
    bump();
  };

  const sell = (id: string) => {
    const item = player.cargo.find((c) => c.id === id);
    if (!item) return;
    player.credits += item.qty * item.pricePerUnit;
    pushNotification(`Sold ${item.qty}× ${item.name}`, "good");
    player.cargo = player.cargo.filter((c) => c.id !== id);
    save();
    bump();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-cyan tracking-widest text-xs">▶ CARGO BAY</div>
          <div className="text-mute text-[11px]">
            Refining {total} units worth {value.toLocaleString()}cr
          </div>
        </div>
        <button className="btn btn-amber" disabled={!player.cargo.length} onClick={sellAll}>
          Refine All · +{value.toLocaleString()}cr
        </button>
      </div>
      {player.cargo.length === 0 && (
        <div className="text-mute text-xs italic">Cargo bay is empty. Defeat enemies to gather salvage.</div>
      )}
      <div className="space-y-2">
        {player.cargo.map((c) => (
          <div key={c.id} className="panel p-3 flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{ background: "#1a2860", border: "1px solid var(--accent-cyan)", color: "var(--accent-cyan)" }}
            >
              ◆
            </div>
            <div className="flex-1">
              <div className="text-cyan font-bold">{c.name}</div>
              <div className="text-mute text-[10px]">×{c.qty} · {c.pricePerUnit}cr per unit</div>
            </div>
            <div className="text-amber font-bold">{(c.qty * c.pricePerUnit).toLocaleString()}cr</div>
            <button className="btn" onClick={() => sell(c.id)}>
              Sell
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
