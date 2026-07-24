import { useState } from "react";
import { TopPanel } from "./TopPanel/TopPanel";
import { Hotbar, type HotbarSlotData } from "./Hotbar/Hotbar";
import { SlotDropdown, SlotDropdownRow } from "./Hotbar/AbilitySlot";
import { Minimap, type MinimapBlipData } from "./Minimap/Minimap";
import { ChatPanel, type ChatMessage } from "./ChatPanel/ChatPanel";
import { MenuPanel } from "./MenuPanel/MenuPanel";
import {
  useGame,
  useGameSlow,
  state,
  bump,
  cargoCapacity,
  useConsumable,
  setHotbarSlot,
  pushChat,
  getActiveAmmoType,
  getAmmoCount,
  switchAmmoType,
  getActiveRocketAmmoType,
  getRocketAmmoCount,
  switchRocketAmmoType,
} from "../../game/store";
import { sendChat } from "../../net/socket";
import { effectiveStats, serverPlayerId } from "../../game/loop";
import {
  EXP_FOR_LEVEL,
  FACTIONS,
  rankFor,
  CONSUMABLE_DEFS,
  ROCKET_AMMO_TYPE_DEFS,
  LASER_AMMO_TYPE_ORDER,
  ROCKET_MISSILE_TYPE_DEFS,
  ROCKET_MISSILE_TYPE_ORDER,
  ZONES,
  RESOURCES,
  type ConsumableId,
  type RocketAmmoType,
  type RocketMissileType,
} from "../../game/types";

const MINIMAP_RANGE = 1800;

/**
 * GameHud — wires the new HUD component set (TopPanel, Hotbar, Minimap,
 * ChatPanel, MenuPanel) to the real game state, replacing the old
 * TopBar/MiniMap/Hotbar. This is the single integration point between
 * the redesigned HUD and `src/game/store.ts` — every prop below maps a
 * real state field, not demo data.
 */
export function GameHud() {
  const player = useGame((s) => s.player);
  const chat = useGame((s) => s.chat);
  const showAmmoSelector = useGame((s) => s.showAmmoSelector);
  const showRocketAmmoSelector = useGame((s) => s.showRocketAmmoSelector);
  const isLaserFiring = useGame((s) => s.isLaserFiring);
  const isRocketFiring = useGame((s) => s.isRocketFiring);
  const cooldowns = useGame((s) => s.hotbarCooldowns);
  const afterburnUntil = useGame((s) => s.afterburnUntil);
  const repairBotUntil = useGame((s) => s.repairBotUntil);
  const tick = useGame((s) => s.tick);
  const docked = useGame((s) => s.dockedAt);

  // Heavy per-entity lists redraw at 5Hz instead of every game tick —
  // same "slow tick" split the old MiniMap used, since the Minimap's
  // blip list is the only consumer here.
  const enemies = useGameSlow((s) => s.enemies);
  const others = useGameSlow((s) => s.others);
  const asteroids = useGameSlow((s) => s.asteroids);
  const cargoBoxes = useGameSlow((s) => s.cargoBoxes);

  const [assignSlot, setAssignSlot] = useState<number | null>(null);

  if (docked) return null;

  const es = effectiveStats();
  const rank = rankFor(player.honor);
  const faction = player.faction ? FACTIONS[player.faction] : null;
  const zoneDef = ZONES[player.zone];
  const cargoUsed = player.cargo.reduce((a, c) => a + c.qty, 0);

  // ── TopPanel ─────────────────────────────────────────────────────
  const topPanel = (
    <TopPanel
      playerName={player.name}
      clanName={player.clan ?? ""}
      rank={rank.index}
      rankName={rank.name}
      rankColor={rank.color}
      level={player.level}
      exp={player.exp}
      expToNext={EXP_FOR_LEVEL(player.level)}
      credits={player.credits}
      honor={player.honor}
      mcoins={player.mcoins}
      factionTag={faction?.tag}
      cargo={cargoUsed}
      cargoMax={cargoCapacity()}
      onOpenPilotDossier={() => {
        state.showPlayerStats = true;
        bump();
      }}
    />
  );

  // ── MenuPanel ────────────────────────────────────────────────────
  const openFlag = (flag: "showInventory" | "showSkillTree" | "showMap" | "showSocial" | "showSettings" | "showCargo" | "showClan") => () => {
    state[flag] = !state[flag];
    bump();
  };
  const menuPanel = (
    <MenuPanel
      onOpenInventory={openFlag("showInventory")}
      onOpenSkills={openFlag("showSkillTree")}
      onOpenMap={openFlag("showMap")}
      onOpenFriends={openFlag("showSocial")}
      onOpenSettings={openFlag("showSettings")}
      onOpenCargo={openFlag("showCargo")}
      onOpenClan={openFlag("showClan")}
      // No dedicated "missions" flag exists in game state yet — the
      // button is wired to the quest tracker toggle as the closest
      // existing equivalent until a real missions panel exists.
      onOpenMissions={() => {
        state.showQuestTracker = !state.showQuestTracker;
        localStorage.setItem("sf-quest-tracker", state.showQuestTracker ? "on" : "off");
        bump();
      }}
      onLogout={() => { state.showLogoutConfirm = true; bump(); }}
    />
  );

  // ── Hotbar ───────────────────────────────────────────────────────
  const activeAmmoType = getActiveAmmoType();
  const ammoDef = ROCKET_AMMO_TYPE_DEFS[activeAmmoType];
  const ammoCount = getAmmoCount(activeAmmoType);

  const activeRocketType = getActiveRocketAmmoType();
  const rocketDef = ROCKET_MISSILE_TYPE_DEFS[activeRocketType];
  const rocketCount = getRocketAmmoCount(activeRocketType);

  const toggleAmmoSelector = () => {
    state.showAmmoSelector = !state.showAmmoSelector;
    state.showRocketAmmoSelector = false;
    setAssignSlot(null);
    bump();
  };
  const selectAmmo = (t: RocketAmmoType) => {
    switchAmmoType(t);
    state.showAmmoSelector = false;
    bump();
  };
  const toggleRocketAmmoSelector = () => {
    state.showRocketAmmoSelector = !state.showRocketAmmoSelector;
    state.showAmmoSelector = false;
    setAssignSlot(null);
    bump();
  };
  const selectRocketAmmo = (t: RocketMissileType) => {
    switchRocketAmmoType(t);
    state.showRocketAmmoSelector = false;
    bump();
  };
  const toggleAssign = (i: number) => {
    setAssignSlot(assignSlot === i ? null : i);
    state.showAmmoSelector = false;
    state.showRocketAmmoSelector = false;
    bump();
  };
  const assignConsumable = (i: number, id: ConsumableId | null) => {
    setHotbarSlot(i, id);
    setAssignSlot(null);
  };

  const consumableSlots: (HotbarSlotData & { onUse: () => void })[] = player.hotbar.slice(0, 6).map((id, i) => {
    const def = id ? CONSUMABLE_DEFS[id] : null;
    const count = id ? (player.consumables[id] ?? 0) : 0;
    const cd = cooldowns[i] ?? 0;
    const usable = !!def && count > 0;
    let selected = false;
    if (id === "afterburn-fuel" && afterburnUntil > tick) selected = true;
    if (id === "repair-bot" && repairBotUntil > tick) selected = true;

    return {
      keyLabel: String(i + 3),
      icon: def ? def.icon : undefined,
      count: def ? count : null,
      state: !def ? "empty" : selected ? "selected" : "normal",
      cooldownFraction: def && cd > 0 ? cd / def.cooldown : 0,
      cooldownSeconds: cd > 0 ? Math.ceil(cd) : 0,
      title: def
        ? `${def.name} — ${def.description} — owned ×${count} — click to use, right-click to reassign`
        : "Empty slot — click to assign a consumable",
      dropdown:
        assignSlot === i ? (
          <SlotDropdown header={`Assign slot ${i + 3}`}>
            {(Object.keys(CONSUMABLE_DEFS) as ConsumableId[]).map((cid) => {
              const cdef = CONSUMABLE_DEFS[cid];
              return (
                <SlotDropdownRow
                  key={cid}
                  icon={cdef.icon}
                  color={cdef.color}
                  name={cdef.name}
                  desc={cdef.description}
                  count={player.consumables[cid] ?? 0}
                  isActive={id === cid}
                  onClick={() => assignConsumable(i, cid)}
                />
              );
            })}
            <SlotDropdownRow icon="∅" color="var(--hud-text-mute)" name="Empty" desc="Clear this slot" isActive={id === null} onClick={() => assignConsumable(i, null)} />
          </SlotDropdown>
        ) : undefined,
      onUse: () => (usable ? useConsumable(i) : toggleAssign(i)),
    };
  });

  const hotbarSlots: HotbarSlotData[] = [
    {
      keyLabel: "1",
      icon: ammoDef.glyph,
      count: ammoCount,
      state: isLaserFiring || showAmmoSelector ? "selected" : "normal",
      title: `${ammoDef.name} — ${ammoDef.description} — in stock ${ammoCount} — click to change ammo, key 1 toggles fire`,
      dropdown: showAmmoSelector ? (
        <SlotDropdown header="Select ammo type">
          {LASER_AMMO_TYPE_ORDER.map((t) => {
            const def = ROCKET_AMMO_TYPE_DEFS[t];
            return (
              <SlotDropdownRow
                key={t}
                icon={def.glyph}
                color={def.color}
                name={def.shortName}
                desc={def.description}
                count={getAmmoCount(t)}
                isActive={t === activeAmmoType}
                onClick={() => selectAmmo(t)}
              />
            );
          })}
        </SlotDropdown>
      ) : undefined,
    },
    {
      keyLabel: "2",
      icon: rocketDef.glyph,
      count: rocketCount,
      state: isRocketFiring || showRocketAmmoSelector ? "selected" : "normal",
      title: `${rocketDef.name} — ${rocketDef.description} — in stock ${rocketCount} — click to change rocket type, key 2 toggles fire`,
      dropdown: showRocketAmmoSelector ? (
        <SlotDropdown header="Select rocket type">
          {ROCKET_MISSILE_TYPE_ORDER.map((t) => {
            const def = ROCKET_MISSILE_TYPE_DEFS[t];
            return (
              <SlotDropdownRow
                key={t}
                icon={def.glyph}
                color={def.color}
                name={def.shortName}
                desc={def.description}
                count={getRocketAmmoCount(t)}
                isActive={t === activeRocketType}
                onClick={() => selectRocketAmmo(t)}
              />
            );
          })}
        </SlotDropdown>
      ) : undefined,
    },
    ...consumableSlots.map(({ onUse: _onUse, ...rest }) => rest),
    { keyLabel: "9", state: "empty" },
    { keyLabel: "0", state: "empty" },
  ];

  // Index-dispatch table, since Hotbar's API is one onSlotClick(index)
  // callback for the whole bar rather than a per-slot handler: 0=ammo
  // selector, 1=rocket selector, 2-7=consumables (use if stocked,
  // otherwise open the assign dropdown), 8-9=empty/no-op.
  const slotClickHandlers: (() => void)[] = [
    toggleAmmoSelector,
    toggleRocketAmmoSelector,
    ...consumableSlots.map((s) => s.onUse),
    () => {},
    () => {},
  ];

  const hotbar = (
    <Hotbar
      slots={hotbarSlots}
      hull={player.hull}
      hullMax={es.hullMax}
      shield={player.shield}
      shieldMax={es.shieldMax}
      onSlotClick={(i) => slotClickHandlers[i]?.()}
      onSlotContextMenu={(i) => {
        // Only the 6 consumable slots (indices 2-7) support reassignment.
        if (i >= 2 && i <= 7) toggleAssign(i - 2);
      }}
    />
  );

  // ── Minimap ──────────────────────────────────────────────────────
  // Old MiniMap used world-space coordinates scaled to a fixed-radius
  // radar (BASE_RANGE=1800). The new Minimap expects 0-100
  // percent-of-scan-circle blips (50/50 = center), so every entity is
  // reprojected relative to the player and dropped if outside range.
  const toBlip = (dx: number, dy: number): { x: number; y: number } | null => {
    const x = 50 + (dx / MINIMAP_RANGE) * 50;
    const y = 50 + (dy / MINIMAP_RANGE) * 50;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x, y };
  };

  const blips: MinimapBlipData[] = [];
  for (const e of enemies) {
    const p = toBlip(e.pos.x - player.pos.x, e.pos.y - player.pos.y);
    if (p) blips.push({ ...p, kind: "hostile", title: e.name ?? e.type });
  }
  for (const o of others) {
    const p = toBlip(o.pos.x - player.pos.x, o.pos.y - player.pos.y);
    if (p) blips.push({ ...p, kind: "ally", title: o.name });
  }
  for (const a of asteroids) {
    if (a.zone !== player.zone) continue;
    const p = toBlip(a.pos.x - player.pos.x, a.pos.y - player.pos.y);
    if (p) blips.push({ ...p, kind: "resource", title: RESOURCES[a.yields]?.name ?? "Asteroid" });
  }
  for (const cb of cargoBoxes) {
    const p = toBlip(cb.pos.x - player.pos.x, cb.pos.y - player.pos.y);
    if (p) blips.push({ ...p, kind: "loot", title: "Cargo" });
  }

  // ── ChatPanel ────────────────────────────────────────────────────
  const chatMessages: ChatMessage[] = chat.map((m) => ({
    channel: m.channel,
    sender: m.from,
    text: m.text,
    time: new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));

  // ── Layout ───────────────────────────────────────────────────────
  // Same anchor points as the HudShowcase demo page: TopPanel top-left,
  // MenuPanel top-right, Hotbar bottom-center, ChatPanel bottom-left,
  // Minimap bottom-right. pointerEvents:auto per-wrapper (not on the
  // outer container) so empty space between HUD elements still lets
  // clicks reach the game canvas underneath.
  return (
    <>
      <div style={{ position: "fixed", left: 24, top: 48, pointerEvents: "auto" }}>{topPanel}</div>
      <div style={{ position: "fixed", right: 24, top: 48, pointerEvents: "auto" }}>{menuPanel}</div>
      <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", pointerEvents: "auto" }}>{hotbar}</div>
      <div style={{ position: "fixed", left: 24, bottom: 24, pointerEvents: "auto" }}>
        <ChatPanel
          messages={chatMessages}
          onSend={(channel, text) => {
            if (text.trim().toLowerCase() === "/admin") {
              if (serverPlayerId === 3) {
                state.showAdmin = !state.showAdmin;
                bump();
                pushChat("system", "SYSTEM", state.showAdmin ? "Admin panel opened." : "Admin panel closed.");
              } else {
                pushChat("system", "SYSTEM", "Access denied.");
              }
              return;
            }
            sendChat(channel, text);
          }}
        />
      </div>
      <div style={{ position: "fixed", right: 24, bottom: 24, pointerEvents: "auto" }}>
        <Minimap
          zoneName={zoneDef ? `${zoneDef.name.toUpperCase()} · ${zoneDef.label}` : player.zone.toUpperCase()}
          coords={`X:${Math.round(player.pos.x)} Y:${Math.round(player.pos.y)}`}
          blips={blips}
        />
      </div>
    </>
  );
}
