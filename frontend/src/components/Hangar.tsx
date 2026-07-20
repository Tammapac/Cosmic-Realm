import { sendDockRepair, sendDockLeave } from "../net/socket";
import { state, bump, useGame, pushNotification, pushFloater, save, stationPrice, priceDirection, addCargo, removeCargo, cargoUsed, cargoCapacity, maxDroneSlots, claimMission, rerollDaily, rerollMissionBoard, bumpMission, equipModule, unequipSlot, sellInventoryItem, addInventoryItem, enterDungeon, reconcileShipSlots, buyConsumable, rocketAmmoMax, getAmmoWeaponIds, ensureAmmoInitialized, setAutoRestock, setAutoRepairHull, setAutoShieldRecharge, getActiveAmmoType, switchAmmoType, purchaseAmmoAmount, getAmmoCount, ROCKET_AMMO_COST_PER, rocketMissileMax, getActiveRocketAmmoType, switchRocketAmmoType, purchaseRocketAmmo, getRocketAmmoCount, startRefineJob, collectRefineJob, upgradeFactory } from "../game/store";
import {
  ActiveQuest, CONSUMABLE_DEFS, ConsumableId, DAILY_DUNGEON_BONUS, DRONE_DEFS, DroneKind, DroneMode, DUNGEONS, DungeonId, FACTIONS, MODULE_DEFS, ModuleDef, ModuleSlot, ModuleStats, RARITY_COLOR,
  Quest, QUEST_POOL, MISSION_BOARD_POOL, MissionCategory, RESOURCES, ResourceId, ROCKET_AMMO_TYPE_DEFS, RocketAmmoType, ROCKET_MISSILE_TYPE_DEFS, RocketMissileType, ROCKET_MISSILE_TYPE_ORDER, SHIP_CLASSES, SKILL_NODES, SkillNode, STATIONS, ShipClassId, SkillBranch,
  SkillId, ZONES, getDailyFeaturedDungeon, REFINE_RECIPES, FACTORY_SPEED_BONUS, FACTORY_UPGRADE_COSTS,
} from "../game/types";
import type { HangarTab } from "../game/store";
import { useDraggable } from "./useDraggable";
import { effectiveStats } from "../game/loop";
import { isRolledItem, lootItemColor, lootItemName, lootSellPrice, lootTipText } from "../game/loot-ui";
import { affixLine, resolveAffixStats } from "../../../lib/loot/loot";
import { buySkillRank, resetSkills } from "../game/store";
import { useState, useMemo, useEffect, useRef } from "react";
import { GameButton } from "./GameButton";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SHIP_PREVIEW_MODELS: Record<string, string> = {
  apex: "/models/Apex_Destroyer.glb",
  colossus: "/models/Colossus_MK_X.glb",
  eclipse: "/models/Eclipse_Destroyer.glb",
  harbinger: "/models/Harbinger_Class.glb",
  leviathan: "/models/Leviathan_Dreadnought.glb",
  marauder: "/models/Marauder.glb",
  obsidian: "/models/Obsidian_Reaver.glb",
  phalanx: "/models/Phallanx_Cruiser.glb",
  reaver: "/models/reaver_mk2.glb",
  skimmer: "/models/Skimmer_MK_1.glb",
  sovereign: "/models/Sovereign_Flagship.glb",
  specter: "/models/Specter_Phasefreame.glb",
  titan: "/models/Titan_Bulwark.glb",
  vanguard: "/models/Vanguard.glb",
  wasp: "/models/Wasp_Interceptor.glb",
};

function ShipPreview({ shipId, color, size = 96 }: { shipId: string; color: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const modelPath = SHIP_PREVIEW_MODELS[shipId];
    if (!modelPath) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 3.5, 4.5);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 2.0);
    dir.position.set(2, 4, 2);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x8888ff, 0.6);
    fill.position.set(-2, 1, -2);
    scene.add(fill);

    let animId: number;
    let modelGroup: THREE.Group | null = null;

    const loader = new GLTFLoader();
    loader.load(modelPath, (gltf) => {
      modelGroup = gltf.scene;
      // Center and scale the model to fit the view
      const box = new THREE.Box3().setFromObject(modelGroup);
      const center = box.getCenter(new THREE.Vector3());
      const sizeVec = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
      const scale = 3.5 / maxDim;
      modelGroup.scale.setScalar(scale);
      modelGroup.position.sub(center.multiplyScalar(scale));
      scene.add(modelGroup);
    });

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (modelGroup) modelGroup.rotation.y += 0.004;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [shipId, size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ display: "block" }} />;
}

let _pendingRiftConfirm: string | null = null;
let _riftConfirmBump: (() => void) | null = null;

const TABS: { id: HangarTab; label: string; glyph: string }[] = [
  { id: "bounties", label: "Bounties", glyph: "★" },
  { id: "missions", label: "Missions", glyph: "▣" },
  { id: "skills",   label: "Skills",   glyph: "✦" },
  { id: "ships",    label: "Shipyard", glyph: "▲" },
  { id: "loadout",  label: "Loadout",  glyph: "⚙" },
  { id: "drones",   label: "Drones",   glyph: "✦" },
  { id: "market",   label: "Market",   glyph: "$" },
  { id: "repair",   label: "Services", glyph: "✚" },
];

const FACTORY_TABS: { id: HangarTab; label: string; glyph: string }[] = [
  { id: "refinery", label: "Refinery", glyph: "⚒" },
  { id: "market",   label: "Market",   glyph: "$" },
  { id: "missions", label: "Missions", glyph: "▣" },
  { id: "repair",   label: "Services", glyph: "✚" },
];

export function Hangar({ stationId }: { stationId: string }) {
  const tab = useGame((s) => s.hangarTab);
  const drag = useDraggable("hangar");
  const station = STATIONS.find((s) => s.id === stationId);
  if (!station) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(2, 4, 12, 0.88)" }}
    >
      <div
        className="panel panel-framed panel-gold relative flex flex-col"
        style={{
          width: "min(1280px, 96vw)",
          height: "min(820px, 94vh)",
          ...drag.style,
        }}
      >
        <div className="scanline" />
        {/* Header — drag handle */}
        <div className="sw-window-header" onPointerDown={drag.handleProps.onPointerDown} style={drag.handleProps.style}>
          <div className="min-w-0 flex items-center gap-4">
            {/* Station icon */}
            <div style={{
              width: 42, height: 42, flexShrink: 0,
              border: "1px solid rgba(247,168,50,0.3)",
              background: "rgba(247,168,50,0.07)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, color: "var(--accent-cyan)",
              boxShadow: "0 0 12px rgba(247,168,50,0.15)",
            }}>⬡</div>
            <div className="min-w-0">
              <div className="hud-label">DOCKED AT · {station.kind.toUpperCase()}</div>
              <div
                className="font-bold tracking-widest glow-cyan truncate"
                style={{ color: "var(--accent-cyan)", fontSize: 16, lineHeight: 1.2, fontFamily: "var(--font-display)" }}
              >
                {station.name.toUpperCase()}
              </div>
              <div className="truncate mt-0.5" style={{ color: "var(--text-mute)", fontSize: 11 }}>
                {station.description}
              </div>
            </div>
          </div>
          <button
            className="gbtn gbtn-red shrink-0"
            style={{ padding: "6px 16px", fontSize: 11 }}
            onClick={() => {
              state.dockedAt = null; sendDockLeave();
              state.player.pos.y += 200;
              state.cameraTarget = { ...state.player.pos };
              save();
              bump();
            }}
          >
            ✕ UNDOCK
          </button>
        </div>

        {/* Station body: left nav · content · info rail */}
        <div className="flex flex-1 min-h-0">
          {/* left navigation */}
          <div className="sw-nav">
            <div className="dob-hdr" style={{ margin: "0 0 8px" }}>
              <span>STATION SERVICES</span>
            </div>
            {(station.kind === "factory" ? FACTORY_TABS : TABS).map((t) => (
              <button
                key={t.id}
                className={`sw-nav-item ${tab === t.id ? "sw-nav-item--selected" : ""}`}
                onClick={() => { state.hangarTab = t.id; bump(); }}
              >
                <span style={{ width: 16, textAlign: "center", opacity: 0.8, flexShrink: 0 }}>{t.glyph}</span>
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>

          {/* content */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {tab === "bounties" && <BountiesTab />}
            {tab === "missions" && <MissionsTab />}
            {tab === "skills" && <SkillsTab />}
            {tab === "loadout" && <LoadoutTab stationId={stationId} />}
            {tab === "dungeons" && <DungeonsTab />}
            {tab === "ships" && <ShipsTab />}
            {tab === "drones" && <DronesTab />}
            {tab === "market" && <MarketTab stationId={stationId} />}
            {tab === "ammo" && <AmmoTab />}  {/* kept for loadout inline popup */}
            {tab === "cargo" && <CargoTab />}
            {tab === "refinery" && <RefineryTab stationId={stationId} />}
            {tab === "repair" && <RepairTab stationId={stationId} />}
          </div>

          {/* info rail: pilot + resources summary */}
          <StationInfoRail station={station} />
        </div>
      </div>

    </div>
  );
}

function StationInfoRail({ station }: { station: (typeof STATIONS)[number] }) {
  const player = useGame((s) => s.player);
  const cls = SHIP_CLASSES[player.shipClass];
  const cargoUsed = player.cargo.reduce((a, c) => a + c.qty, 0);
  const rows: { label: string; value: string; color: string }[] = [
    { label: "CREDITS", value: player.credits.toLocaleString(), color: "var(--accent-amber)" },
    { label: "HONOR", value: player.honor.toLocaleString(), color: "#c9a8ff" },
    { label: "CARGO", value: `${cargoUsed}/${cargoCapacity()}`, color: "var(--accent-cyan)" },
    { label: "SHIP", value: cls.name, color: "var(--text-dim)" },
    { label: "HULL", value: `${Math.round(player.hull)}`, color: "#5cff8a" },
    { label: "LEVEL", value: `${player.level}`, color: "var(--accent-amber)" },
    { label: "SKILL PTS", value: `${player.skillPoints}`, color: "#ff5cf0" },
  ];
  return (
    <div className="sw-rail">
      <div className="dob-hdr" style={{ margin: "0 0 8px" }}><span>PILOT CONSOLE</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2" style={{ fontSize: 11 }}>
            <span className="hud-label" style={{ fontSize: 10 }}>{r.label}</span>
            <span className="tabular-nums font-bold truncate" style={{ color: r.color, maxWidth: 120 }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div className="sw-hr" style={{ margin: "10px 0" }} />
      <div className="dob-hdr" style={{ margin: "0 0 6px" }}><span>STATION</span></div>
      <div style={{ fontSize: 10, lineHeight: 1.5, color: "var(--text-mute)" }}>
        <span style={{ color: "var(--accent-cyan)" }}>{station.name}</span>
        {" — "}
        {station.kind.toUpperCase()} facility. Services and prices vary by station type and controlling faction.
      </div>
    </div>
  );
}

// ── BOUNTIES ──────────────────────────────────────────────────────────────
const ZONE_FACTION_META: Record<string, { label: string; color: string; glyph: string }> = {
  earth: { label: "Earth Concord",  color: "#4ee2ff", glyph: "⊕" },
  mars:  { label: "Mars Coalition", color: "#ff7733", glyph: "⊗" },
  venus: { label: "Venus Enclave",  color: "#c96fff", glyph: "⊛" },
};

function BountiesTab() {
  const player = useGame((s) => s.player);
  const [tierFilter, setTierFilter] = useState<number>(0);

  const allBounties = QUEST_POOL;
  const tiers = [...new Set(allBounties.map(q => q.tier ?? 1))].sort((a, b) => a - b);
  const filtered = tierFilter === 0 ? allBounties : allBounties.filter(q => (q.tier ?? 1) === tierFilter);

  const accept = (q: any) => {
    if (player.activeQuests.find((x: any) => x.id === q.id)) return;
    if (player.activeQuests.length >= 5) {
      pushNotification("Quest log full (5 max)", "bad");
      return;
    }
    player.activeQuests.push({ ...q, progress: 0, completed: false });
    pushNotification(`Accepted: ${q.title}`, "good");
    save(); bump();
  };

  const turnIn = (q: any) => {
    if (!q.completed) return;
    player.credits += q.rewardCredits;
    player.exp += q.rewardExp;
    player.honor += q.rewardHonor;
    player.activeQuests = player.activeQuests.filter((x: any) => x.id !== q.id);
    player.milestones.totalKills += 0;
    pushNotification(`+${q.rewardCredits}cr +${q.rewardExp}xp +${q.rewardHonor} honor`, "good");
    pushFloater({ text: `+${q.rewardCredits} CR`, color: "#ffd24a", x: state.player.pos.x, y: state.player.pos.y - 30, scale: 1.5, bold: true, ttl: 2.5 });
    pushFloater({ text: `+${q.rewardExp} XP`, color: "#ff5cf0", x: state.player.pos.x, y: state.player.pos.y - 30, scale: 1.5, bold: true, ttl: 2.5 });
    if (q.rewardHonor > 0) pushFloater({ text: `+${q.rewardHonor} HONOR`, color: "#c8a0ff", x: state.player.pos.x, y: state.player.pos.y - 30, scale: 1.5, bold: true, ttl: 2.5 });
    save(); bump();
  };

  const tierColors: Record<number, string> = { 1: "#5cff8a", 2: "#4ee2ff", 3: "#ffcc44", 4: "#ff8a4e", 5: "#ff5c6c", 6: "#ff5cf0", 7: "#aa44ff", 8: "#ff4466", 9: "#ffffff" };

  return (
    <div className="p-4 space-y-3 flex flex-col" style={{ height: "100%", minHeight: 0 }}>
      <div className="dob-hdr shrink-0">
        <span>★ BOUNTY BOARD</span>
        <span style={{ color: "#8f96a6" }}>KILL CONTRACTS · REPEATABLE</span>
      </div>

      {/* Tier filter */}
      <div className="flex gap-1.5 flex-wrap shrink-0">
        <button className={`gbtn ${tierFilter === 0 ? "gbtn-gold" : ""}`} style={{ padding: "4px 14px", fontSize: 11 }} onClick={() => setTierFilter(0)}>ALL</button>
        {tiers.map(t => (
          <button
            key={t}
            className={`gbtn ${tierFilter === t ? "gbtn-gold" : ""}`}
            style={{ padding: "4px 12px", fontSize: 11, color: tierColors[t] ?? "#888", opacity: tierFilter === 0 || tierFilter === t ? 1 : 0.6 }}
            onClick={() => setTierFilter(t)}
          >
            T{t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {/* Available bounties */}
        <div className="flex flex-col min-h-0">
          <div className="dob-hdr shrink-0" style={{ marginBottom: 8 }}>
            <span>AVAILABLE</span>
            <span style={{ color: "#8f96a6" }}>{filtered.length}</span>
          </div>
          <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
            {filtered.map((q) => {
              const has = player.activeQuests.find((x: any) => x.id === q.id);
              const tierColor = tierColors[q.tier ?? 1] ?? "#888";
              return (
                <div key={q.id} className="panel p-3 flex items-center gap-3" style={{ borderLeft: `3px solid ${tierColor}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold px-1 shrink-0" style={{ background: tierColor + "22", color: tierColor, border: `1px solid ${tierColor}55` }}>T{q.tier ?? 1}</span>
                      <span className="text-amber text-[13px] font-bold tracking-wide truncate">{q.title}</span>
                    </div>
                    <div className="text-cyan text-[12px] mt-1 flex items-center gap-1.5">
                      <span>{q.killCount}× {q.killType}</span>
                      <span
                        className="font-bold tabular-nums px-1 shrink-0"
                        style={{ color: "#ffd24a", background: "#ffd24a18", border: "1px solid #ffd24a66", fontSize: 11, fontFamily: "var(--font-display)" }}
                      >
                        {ZONES[q.zone as keyof typeof ZONES]?.label ?? "?"}
                      </span>
                      <span className="truncate">{ZONES[q.zone as keyof typeof ZONES]?.name ?? q.zone}</span>
                    </div>
                    <div className="flex gap-3 text-[12px] mt-0.5">
                      <span className="text-amber">+{q.rewardCredits.toLocaleString()}cr</span>
                      <span style={{ color: "#ff5cf0" }}>+{q.rewardExp.toLocaleString()}xp</span>
                      <span style={{ color: "#c8a0ff" }}>+{q.rewardHonor} honor</span>
                    </div>
                  </div>
                  <button className="gbtn gbtn-gold shrink-0" style={{ padding: "6px 14px", fontSize: 11 }} disabled={!!has} onClick={() => accept(q)}>
                    {has ? "ACTIVE" : "ACCEPT"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active quests */}
        <div className="flex flex-col min-h-0">
          <div className="dob-hdr shrink-0" style={{ marginBottom: 8 }}>
            <span>ACTIVE CONTRACTS</span>
            <span style={{ color: "#8f96a6" }}>{player.activeQuests.length}/5</span>
          </div>
          <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
            {player.activeQuests.length === 0 && (
              <div className="text-mute text-sm italic">No active contracts. Take one from the board.</div>
            )}
            {player.activeQuests.map((q: any) => (
              <div key={q.id} className="panel p-3">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-amber text-[13px] font-bold tracking-wide truncate">{q.title}</span>
                  <span className="text-[12px] tabular-nums shrink-0" style={{ color: q.completed ? "#5cff8a" : "#8f96a6" }}>
                    {q.progress}/{q.killCount}
                  </span>
                </div>
                <div className="text-dim text-[12px] mt-1 mb-2 flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0">{q.killType}s in</span>
                  <span
                    className="font-bold tabular-nums px-1 shrink-0"
                    style={{ color: "#ffd24a", background: "#ffd24a18", border: "1px solid #ffd24a66", fontSize: 11, fontFamily: "var(--font-display)" }}
                  >
                    {ZONES[q.zone as keyof typeof ZONES]?.label ?? "?"}
                  </span>
                  <span className="truncate">{ZONES[q.zone as keyof typeof ZONES]?.name ?? q.zone}</span>
                </div>
                <div className="bar mb-2">
                  <div className="bar-fill" style={{
                    width: `${(q.progress / q.killCount) * 100}%`,
                    background: "linear-gradient(90deg, #ff5cf066, #ff5cf0)",
                    boxShadow: "0 0 6px #ff5cf0",
                  }} />
                </div>
                <button className={`gbtn w-full ${q.completed ? "gbtn-gold" : ""}`} style={{ padding: "5px 0", fontSize: 11 }} disabled={!q.completed} onClick={() => turnIn(q)}>
                  {q.completed ? "✓ TURN IN" : "IN PROGRESS"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LOADOUT (modular ship gear) ───────────────────────────────────────────
function statChip(label: string, value: string, color: string) {
  return (
    <span className="text-[12px] tracking-widest px-1" style={{ color, border: `1px solid ${color}55` }}>
      {label}:{value}
    </span>
  );
}

type StatDiffEntry = { label: string; delta: number; formatted: string; isPercent?: boolean };

function computeStatDiff(equipped: ModuleStats, shop: ModuleStats): StatDiffEntry[] {
  const diffs: StatDiffEntry[] = [];
  const num = (a?: number, b?: number) => (b ?? 0) - (a ?? 0);

  const dmg = num(equipped.damage, shop.damage);
  if (dmg !== 0) diffs.push({ label: "DMG", delta: dmg, formatted: `${dmg > 0 ? "+" : ""}${dmg}` });

  if ((equipped.fireRate ?? 1) !== 1 || (shop.fireRate ?? 1) !== 1) {
    const rDelta = (shop.fireRate ?? 1) - (equipped.fireRate ?? 1);
    if (Math.abs(rDelta) > 0.001) diffs.push({ label: "RATE", delta: rDelta, formatted: `${rDelta > 0 ? "+" : ""}${rDelta.toFixed(2)}×` });
  }

  const crit = num(equipped.critChance, shop.critChance);
  if (Math.abs(crit) > 0.0001) diffs.push({ label: "CRIT", delta: crit, formatted: `${crit > 0 ? "+" : ""}${Math.round(crit * 100)}%` });

  const shd = num(equipped.shieldMax, shop.shieldMax);
  if (shd !== 0) diffs.push({ label: "SHD", delta: shd, formatted: `${shd > 0 ? "+" : ""}${shd}` });

  const reg = num(equipped.shieldRegen, shop.shieldRegen);
  if (reg !== 0) diffs.push({ label: "REG", delta: reg, formatted: `${reg > 0 ? "+" : ""}${reg.toFixed(1)}` });

  const hul = num(equipped.hullMax, shop.hullMax);
  if (hul !== 0) diffs.push({ label: "HUL", delta: hul, formatted: `${hul > 0 ? "+" : ""}${hul}` });

  const spd = num(equipped.speed, shop.speed);
  if (spd !== 0) diffs.push({ label: "SPD", delta: spd, formatted: `${spd > 0 ? "+" : ""}${spd}` });

  const dr = num(equipped.damageReduction, shop.damageReduction);
  if (Math.abs(dr) > 0.0001) diffs.push({ label: "DR", delta: dr, formatted: `${dr > 0 ? "+" : ""}${Math.round(dr * 100)}%` });

  const aoe = num(equipped.aoeRadius, shop.aoeRadius);
  if (aoe !== 0) diffs.push({ label: "AOE", delta: aoe, formatted: `${aoe > 0 ? "+" : ""}${aoe}` });

  const ammo = num(equipped.ammoCapacity, shop.ammoCapacity);
  if (ammo !== 0) diffs.push({ label: "AMMO", delta: ammo, formatted: `${ammo > 0 ? "+" : ""}${ammo}` });

  const loot = num(equipped.lootBonus, shop.lootBonus);
  if (loot !== 0) diffs.push({ label: "LOOT", delta: loot, formatted: `${loot > 0 ? "+" : ""}${loot}` });

  return diffs;
}

function normalizedUpgradeScore(equipped: ModuleStats, shop: ModuleStats): number {
  // `base` is the neutral value when the stat is absent (additive stats default 0, multiplicative to 1)
  const n = (a: number | undefined, b: number | undefined, w: number, base = 0) =>
    ((b ?? base) - (a ?? base)) * w;
  return (
    n(equipped.damage,          shop.damage,          0.5)       +
    n(equipped.fireRate,        shop.fireRate,        50,  1)    + // neutral fireRate = 1×
    n(equipped.critChance,      shop.critChance,      200)       +
    n(equipped.shieldMax,       shop.shieldMax,       0.5)       +
    n(equipped.shieldRegen,     shop.shieldRegen,     5)         +
    n(equipped.hullMax,         shop.hullMax,         0.5)       +
    n(equipped.speed,           shop.speed,           1)         +
    n(equipped.damageReduction, shop.damageReduction, 200)       +
    n(equipped.aoeRadius,       shop.aoeRadius,       1)         +
    n(equipped.ammoCapacity,    shop.ammoCapacity,    1)         +
    n(equipped.lootBonus,       shop.lootBonus,       1)
  );
}

function modStatPills(stats: typeof MODULE_DEFS[string]["stats"]) {
  const pills: { k: string; v: string; c: string }[] = [];
  if (stats.damage)          pills.push({ k: "DMG", v: `+${stats.damage}`, c: "#ff5c6c" });
  if (stats.fireRate && stats.fireRate !== 1) pills.push({ k: "RATE", v: `×${stats.fireRate.toFixed(2)}`, c: "#ffd24a" });
  if (stats.critChance)      pills.push({ k: "CRIT", v: `+${Math.round(stats.critChance * 100)}%`, c: "#ff5cf0" });
  if (stats.aoeRadius)       pills.push({ k: "AOE", v: `${stats.aoeRadius}`, c: "#ff8a4e" });
  if (stats.shieldMax)       pills.push({ k: "SHD", v: `+${stats.shieldMax}`, c: "#4ee2ff" });
  if (stats.shieldRegen)     pills.push({ k: "REG", v: `+${stats.shieldRegen}`, c: "#4ee2ff" });
  if (stats.hullMax)         pills.push({ k: "HUL", v: `+${stats.hullMax}`, c: "#5cff8a" });
  if (stats.speed)           pills.push({ k: "SPD", v: `+${stats.speed}`, c: "#aaff5c" });
  if (stats.damageReduction) pills.push({ k: "DR",  v: `${Math.round(stats.damageReduction * 100)}%`, c: "#ff8a4e" });
  if (stats.cargoBonus)      pills.push({ k: "CRG", v: `+${Math.round(stats.cargoBonus * 100)}%`, c: "#c69060" });
  if (stats.lootBonus)       pills.push({ k: "LOOT", v: `+${stats.lootBonus}`, c: "#ffd24a" });
  if (stats.ammoCapacity)    pills.push({ k: "AMMO", v: `+${stats.ammoCapacity}`, c: "#ff8a4e" });
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {pills.map((p, i) => statChip(p.k, p.v, p.c))}
    </div>
  );
}

function RocketAmmoBadge() {
  const [showTip, setShowTip] = useState(false);
  const maxAmmo = rocketAmmoMax();
  return (
    <div className="relative inline-block mt-1">
      <span
        className="text-[12px] tracking-widest cursor-help inline-flex items-center gap-1"
        style={{ color: "#ff8a4e", border: "1px solid #ff8a4e55", padding: "1px 5px" }}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTip((v) => !v); }}
      >
        ⟁ Ammo: {ROCKET_AMMO_COST_PER}cr/round · max {maxAmmo}
      </span>
      {showTip && (
        <div
          className="absolute z-50 bottom-full left-0 mb-1.5 panel p-2 text-[12px] leading-relaxed"
          style={{ width: 200, pointerEvents: "none", color: "var(--text-dim)" }}
        >
          <div className="text-[12px] font-bold tracking-widest mb-1" style={{ color: "#ff8a4e" }}>AMMO SYSTEM</div>
          Rocket weapons fire limited rounds. Restock at any station for <span style={{ color: "#ffd24a" }}>{ROCKET_AMMO_COST_PER}cr per round</span>.
          Current max capacity: <span style={{ color: "#4ee2ff" }}>{maxAmmo} rounds</span>.
          Equip a <span style={{ color: "#ff5cf0" }}>Munitions Bay</span> module to increase capacity.
        </div>
      )}
    </div>
  );
}


// Multi-line stat tooltip for a module (rendered by the global GameTooltip)
function moduleTipText(def: ModuleDef, opts?: { action?: string }): string {
  const st = def.stats;
  const parts: string[] = [];
  if (st.damage != null) parts.push(`DMG +${st.damage}`);
  if (st.fireRate != null && st.fireRate !== 1) parts.push(`ROF ×${st.fireRate}`);
  if (st.critChance) parts.push(`CRIT +${Math.round(st.critChance * 100)}%`);
  if (st.aoeRadius) parts.push(`AOE ${st.aoeRadius}`);
  if (st.shieldMax) parts.push(`SHD +${st.shieldMax}`);
  if (st.shieldRegen) parts.push(`REG +${st.shieldRegen}/s`);
  if (st.shieldAbsorb) parts.push(`ABS +${Math.round(st.shieldAbsorb * 100)}%`);
  if (st.hullMax) parts.push(`HUL +${st.hullMax}`);
  if (st.speed) parts.push(`SPD +${st.speed}`);
  if (st.damageReduction) parts.push(`DR ${Math.round(st.damageReduction * 100)}%`);
  if (st.ammoCapacity) parts.push(`AMMO +${st.ammoCapacity}`);
  if (st.cargoBonus) parts.push(`CARGO +${st.cargoBonus}`);
  if (st.lootBonus) parts.push(`LOOT +${st.lootBonus}`);
  if (st.miningBonus) parts.push(`MINING +${st.miningBonus}`);
  const lines = [
    `${def.name} · T${def.tier} ${def.rarity.toUpperCase()}`,
    def.description,
    parts.join(" · ") || "no stat bonuses",
    `VALUE ${def.price.toLocaleString()} CR · SELLS ${Math.floor(def.price * 0.4).toLocaleString()} CR`,
  ];
  if (opts?.action) lines.push(opts.action);
  return lines.join("\n");
}

function SlotCell({
  slot, index, instanceId, compareWithDef, onHover,
}: {
  slot: ModuleSlot; index: number; instanceId: string | null; compareWithDef?: ModuleDef | null;
  onHover?: (info: { slot: ModuleSlot; index: number; def: ModuleDef | null } | null) => void;
}) {
  const player = useGame((s) => s.player);
  const item = instanceId ? player.inventory.find((m) => m.instanceId === instanceId) : null;
  const def = item ? MODULE_DEFS[item.defId] : null;
  const color = item && def ? (isRolledItem(item) ? lootItemColor(item, def) : RARITY_COLOR[def.rarity]) : "#3a3c46";
  // amber highlight: hovered shop/inventory module fits this slot
  const fits = !!compareWithDef;
  return (
    <div
      className="sw-slot equip-cell"
      title={item && def ? lootTipText(item, { action: "CLICK TO UNEQUIP" }) : "Empty slot\nEquip a module from the inventory list"}
      style={{
        boxShadow: def
          ? `inset 0 0 0 1px ${color}88${fits ? ", 0 0 8px rgba(255,210,74,0.5)" : ""}`
          : fits ? "inset 0 0 0 1px rgba(255,210,74,0.7), 0 0 8px rgba(255,210,74,0.35)" : "none",
        cursor: def ? "pointer" : "default",
        opacity: def || fits ? 1 : 0.72,
      }}
      onMouseEnter={() => onHover?.({ slot, index, def })}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => { if (def) unequipSlot(slot, index); }}
    >
      <span className="equip-num">{index + 1}</span>
      {def ? (
        <>
          <span style={{ color: def.color, fontSize: 20, lineHeight: 1, textShadow: `0 0 8px ${def.color}` }}>{def.glyph}</span>
          <span className="equip-tier" style={{ color }}>{"\u25aa".repeat(Math.min(5, def.tier))}</span>
        </>
      ) : (
        <span style={{ color: fits ? "#ffd24a" : "#4a4c58", fontSize: 16, lineHeight: 1 }}>+</span>
      )}
    </div>
  );
}

function LoadoutTab({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const station = STATIONS.find((s) => s.id === stationId)!;
  const cls = SHIP_CLASSES[player.shipClass];
  const stats = effectiveStats();
  const [filter, setFilter] = useState<ModuleSlot | "all">("all");
  const [showShop, setShowShop] = useState(false);
  const [showAmmoPopup, setShowAmmoPopup] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [sellMode, setSellMode] = useState(false);
  const [sellAllArmed, setSellAllArmed] = useState(false);
  // rich comparison card anchored next to the hovered inventory/shop cell
  const [cardHover, setCardHover] = useState<{ kind: "inv" | "shop"; id: string; x: number; y: number } | null>(null);
  const [hoverEquip, setHoverEquip] = useState<{ slot: ModuleSlot; index: number; def: ModuleDef | null } | null>(null);
  const [hoveredShopDefId, setHoveredShopDefId] = useState<string | null>(null);
  const hoveredShopDef = hoveredShopDefId ? MODULE_DEFS[hoveredShopDefId] ?? null : null;
  const [hoveredInvInstanceId, setHoveredInvInstanceId] = useState<string | null>(null);
  const hoveredInvDef = (() => {
    if (!hoveredInvInstanceId) return null;
    const it = player.inventory.find((m) => m.instanceId === hoveredInvInstanceId);
    return it ? MODULE_DEFS[it.defId] ?? null : null;
  })();

  // Shop offer: 4 random buyable modules, capped to ones unlocked by ship tier-ish
  const tierCap2 = Math.min(5, Math.max(1, Math.ceil(player.level / 4)));
  const shopPool = Object.values(MODULE_DEFS).filter((d) => d.tier <= tierCap2);
  // Show all available weapons + generators + modules (no arbitrary limit)
  const shopOffer = shopPool;

  // Determine which shop module is the single best upgrade for the player's current build
  const bestUpgradeDefId = useMemo(() => {
    if (!showShop) return null;
    let bestId: string | null = null;
    let bestScore = 0; // must beat 0 to be considered a net upgrade
    for (const def of shopOffer) {
      const equippedIds = player.equipped[def.slot];
      // Score against each equipped slot; keep the best slot comparison
      let slotBestScore = equippedIds.length === 0
        ? normalizedUpgradeScore({}, def.stats)
        : -Infinity;
      for (const instanceId of equippedIds) {
        let equippedStats: ModuleStats = {};
        if (instanceId !== null) {
          const item = player.inventory.find((m) => m.instanceId === instanceId);
          if (item) {
            const equippedDef = MODULE_DEFS[item.defId];
            if (equippedDef) equippedStats = equippedDef.stats;
          }
        }
        slotBestScore = Math.max(slotBestScore, normalizedUpgradeScore(equippedStats, def.stats));
      }
      if (slotBestScore > bestScore) {
        bestScore = slotBestScore;
        bestId = def.id;
      }
    }
    return bestId;
  }, [showShop, shopOffer, player.equipped, player.inventory]);

  const SLOT_ORDER: Record<ModuleSlot, number> = { weapon: 0, generator: 1, module: 2 };
  const visibleInv = player.inventory
    .filter((it) => {
      if (filter === "all") return true;
      return MODULE_DEFS[it.defId]?.slot === filter;
    })
    .slice()
    .sort((a, b) => {
      const da = MODULE_DEFS[a.defId], db = MODULE_DEFS[b.defId];
      if (!da || !db) return 0;
      if (da.slot !== db.slot) return SLOT_ORDER[da.slot] - SLOT_ORDER[db.slot];
      return db.tier - da.tier;
    });

  // DarkOrbit-style collapsible equipment category (dark header strip + slot cells)
  const renderSlotSection = (slot: ModuleSlot, label: string, color: string) => {
    const compareDef =
      showShop && hoveredShopDef?.slot === slot ? hoveredShopDef
      : !showShop && hoveredInvDef?.slot === slot ? hoveredInvDef
      : null;
    const filled = player.equipped[slot].filter(Boolean).length;
    const isCollapsed = !!collapsed[slot];
    return (
      <div>
        <button
          type="button"
          className="dob-hdr"
          style={{ width: "100%", cursor: "pointer" }}
          onClick={() => setCollapsed((c) => ({ ...c, [slot]: !c[slot] }))}
        >
          <span style={{ color }}>{isCollapsed ? "▶" : "▼"} {label}</span>
          <span style={{ color: "#8f96a6" }}>{filled}/{player.equipped[slot].length}</span>
        </button>
        {!isCollapsed && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 54px)", gap: 6, padding: "8px 2px 6px" }}>
            {player.equipped[slot].map((id, i) => (
              <SlotCell key={`${slot}-${i}`} slot={slot} index={i} instanceId={id} compareWithDef={compareDef} onHover={setHoverEquip} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="grid gap-3 p-4"
      style={{ gridTemplateColumns: "200px minmax(0, 1fr) 288px", height: "100%", minHeight: 0 }}
    >
      {/* LEFT — hex ship dock + active stats + inspect pane (DarkOrbit ship panel) */}
      <div className="flex flex-col gap-3 min-h-0">
        <div
          className="shrink-0 flex flex-col items-center"
          style={{
            background: "url(/assets/ui/atlas/hex-plate.png)",
            backgroundSize: "100% 100%",
            padding: "22px 6px 14px",
          }}
        >
          <ShipPreview shipId={player.shipClass} color={cls.color} size={156} />
          <div
            className="text-[12px] font-bold tracking-widest truncate"
            style={{ color: cls.color, fontFamily: "var(--font-display)", maxWidth: "92%", textShadow: `0 0 8px ${cls.color}66` }}
          >
            {cls.name.toUpperCase()}
          </div>
          <div className="tabular-nums font-bold" style={{ color: "var(--accent-amber)", fontSize: 12 }}>
            {player.credits.toLocaleString()} CR
          </div>
        </div>

        <div className="console-sq shrink-0" style={{ padding: 10 }}>
          <div className="console-corner tl" /><div className="console-corner tr" />
          <div className="console-corner bl" /><div className="console-corner br" />
          <div className="dob-hdr" style={{ margin: "-10px -10px 10px" }}>
            <span>▼ ACTIVE STATS</span>
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
            <Stat label="DMG"  v={Math.round(stats.damage)} />
            <Stat label="RATE" v={+stats.fireRate.toFixed(2)} />
            <Stat label="CRIT" v={`${Math.round(stats.critChance * 100)}%`} />
            <Stat label="HUL"  v={Math.round(stats.hullMax)} />
            <Stat label="SHD"  v={Math.round(stats.shieldMax)} />
            <Stat label="REG"  v={`${stats.shieldRegen.toFixed(1)}/s`} />
            <Stat label="SPD"  v={Math.round(stats.speed)} />
            <Stat label="DR"   v={`${Math.round(stats.damageReduction * 100)}%`} />
            <Stat label="ABS"  v={`${Math.round(Math.min(0.95, 0.5 + (stats.shieldAbsorb ?? 0)) * 100)}%`} />
          </div>
        </div>

        {/* hovered equipped-module inspect pane */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ background: "linear-gradient(180deg, rgba(22,22,28,0.92), rgba(13,13,17,0.92))", border: "1px solid #33353e", padding: "8px 10px", minHeight: 76 }}
        >
          {hoverEquip?.def ? (
            <>
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <div className="shrink-0 flex items-center justify-center"
                  style={{ width: 24, height: 24, background: `${hoverEquip.def.color}22`, border: `1px solid ${hoverEquip.def.color}`, color: hoverEquip.def.color, fontSize: 13 }}>
                  {hoverEquip.def.glyph}
                </div>
                <span className="text-[12px] font-bold tracking-widest truncate" style={{ color: RARITY_COLOR[hoverEquip.def.rarity] }}>{hoverEquip.def.name}</span>
              </div>
              <div className="text-[10px] uppercase mb-1" style={{ color: "#8f96a6" }}>{hoverEquip.slot} #{hoverEquip.index + 1} · {hoverEquip.def.rarity}</div>
              {modStatPills(hoverEquip.def.stats)}
              <div className="text-[9px] mt-1.5 tracking-widest" style={{ color: "#8f96a6" }}>CLICK SLOT TO UNEQUIP</div>
            </>
          ) : hoverEquip ? (
            <div className="text-[11px] italic" style={{ color: "#8f96a6" }}>Empty {hoverEquip.slot} slot · click a module in the inventory grid to equip it</div>
          ) : (
            <div className="text-[11px] italic" style={{ color: "#8f96a6" }}>Hover an equipped slot to inspect it · click a slot to unequip</div>
          )}
        </div>
      </div>

      {/* MIDDLE — equipped categories under DarkOrbit header strips */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0 min-w-0">
          <div className="section-header truncate">LOADOUT · {cls.name.toUpperCase()}</div>
          <span className="text-[10px] tracking-widest shrink-0" style={{ color: "#ffd24a88" }}>HOVER TO COMPARE</span>
        </div>
        <div className="overflow-y-auto min-h-0 flex-1 space-y-2 pr-1">
          {renderSlotSection("weapon",    "LASERS / WEAPONS",     "#ff5c6c")}
          {renderSlotSection("generator", "GENERATORS / SHIELDS", "#4ee2ff")}
          {renderSlotSection("module",    "EXTRAS / MODULES",     "#ff5cf0")}
        </div>
      </div>

      {/* RIGHT — dense inventory / shop icon grid + console action plate */}
      <div className="flex flex-col min-h-0">
        <div
          className="dob-hdr shrink-0"
          style={sellMode && !showShop ? { borderLeftColor: "#ff5c6c" } : undefined}
        >
          <span style={sellMode && !showShop ? { color: "#ff8a93" } : undefined}>
            {showShop ? "▼ SHOP" : sellMode ? "▼ SELL MODE" : `▼ INVENTORY (${player.inventory.length})`}
          </span>
          <span className="tabular-nums" style={{ color: "var(--accent-amber)" }}>{player.credits.toLocaleString()} CR</span>
        </div>
        <div className="flex gap-1 my-2 shrink-0">
          {(["all", "weapon", "generator", "module"] as const).map((f) => (
            <button
              key={f}
              className={`gbtn ${filter === f ? "gbtn-gold" : ""}`}
              style={{ padding: "3px 0", fontSize: 10, flex: 1, letterSpacing: "0.08em", opacity: filter === f ? 1 : 0.75 }}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "ALL" : f === "weapon" ? "WPN" : f === "generator" ? "GEN" : "MOD"}
            </button>
          ))}
        </div>
        {!showShop && (() => {
          // SELL ALL: every inventory item that is NOT currently equipped.
          // Two-step confirm so a misclick can't liquidate the cargo bay.
          const equippedIds = new Set(
            [...player.equipped.weapon, ...player.equipped.generator, ...player.equipped.module].filter(Boolean)
          );
          const unused = player.inventory.filter((it) => !equippedIds.has(it.instanceId) && MODULE_DEFS[it.defId]);
          const total = unused.reduce((s, it) => s + lootSellPrice(it, MODULE_DEFS[it.defId]), 0);
          if (unused.length === 0) return null;
          return (
            <button
              className="gbtn gbtn-red shrink-0"
              style={{ padding: "4px 0", fontSize: 10, letterSpacing: "0.1em", marginBottom: 8 }}
              title={`Sells every item that is not equipped (${unused.length} items)`}
              onClick={() => {
                if (!sellAllArmed) {
                  setSellAllArmed(true);
                  setTimeout(() => setSellAllArmed(false), 3500);
                  return;
                }
                setSellAllArmed(false);
                for (const it of unused) sellInventoryItem(it.instanceId);
                pushNotification(`Sold ${unused.length} unused items for ${total.toLocaleString()} CR`, "good");
              }}
            >
              {sellAllArmed
                ? `CONFIRM — SELL ${unused.length} FOR ${total.toLocaleString()} CR?`
                : `SELL ALL UNUSED (${unused.length}) · ${total.toLocaleString()} CR`}
            </button>
          );
        })()}

        <div
          className="console-sq overflow-y-auto min-h-0 flex-1"
          style={{ padding: 8 }}
          onMouseLeave={() => { setHoveredShopDefId(null); setHoveredInvInstanceId(null); setCardHover(null); }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 48px)", gap: 5, justifyContent: "center", alignContent: "start" }}>
            {showShop ? (
              shopOffer.filter((d) => filter === "all" || d.slot === filter).map((def) => {
                const canAfford = player.credits >= def.price;
                const isBestUpgrade = bestUpgradeDefId === def.id;
                return (
                  <div
                    key={def.id}
                    className="sw-slot equip-cell"
                    style={{
                      width: 48, height: 48,
                      boxShadow: `inset 0 0 0 1px ${RARITY_COLOR[def.rarity]}88${isBestUpgrade ? ", 0 0 8px rgba(255,210,74,0.55)" : ""}`,
                      cursor: canAfford ? "pointer" : "not-allowed",
                      opacity: canAfford ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => {
                      const rc = e.currentTarget.getBoundingClientRect();
                      setHoveredShopDefId(def.id);
                      setCardHover({ kind: "shop", id: def.id, x: rc.left, y: rc.top });
                    }}
                    onMouseLeave={() => setCardHover(null)}
                    onClick={() => {
                      if (!canAfford) return;
                      state.player.credits -= def.price;
                      addInventoryItem(def.id);
                      pushNotification(`Bought ${def.name}`, "good");
                      save(); bump();
                    }}
                  >
                    <span style={{ color: def.color, fontSize: 17, lineHeight: 1, textShadow: `0 0 8px ${def.color}` }}>{def.glyph}</span>
                    <span className="equip-tier" style={{ color: RARITY_COLOR[def.rarity] }}>{"▪".repeat(Math.min(5, def.tier))}</span>
                    {isBestUpgrade && (
                      <span style={{ position: "absolute", top: 0, right: 3, fontSize: 10, color: "#ffd24a", textShadow: "0 0 6px #ffd24a" }}>★</span>
                    )}
                    {def.weaponKind === "rocket" && (
                      <span style={{ position: "absolute", top: 0, left: 4, fontSize: 8, color: "#ff8a4e" }}>⟁</span>
                    )}
                  </div>
                );
              })
            ) : (
              visibleInv.map((it) => {
                const def = MODULE_DEFS[it.defId];
                if (!def) return null;
                const isEquipped =
                  player.equipped.weapon.includes(it.instanceId) ||
                  player.equipped.generator.includes(it.instanceId) ||
                  player.equipped.module.includes(it.instanceId);
                const color = isRolledItem(it) ? lootItemColor(it, def) : RARITY_COLOR[def.rarity];
                const targetIdx = player.equipped[def.slot].findIndex((x) => x === null);
                const action = sellMode
                  ? `CLICK TO SELL — ${lootSellPrice(it, def).toLocaleString()} CR${isEquipped ? " (UNEQUIPS FIRST)" : ""}`
                  : isEquipped ? "CURRENTLY EQUIPPED"
                  : targetIdx >= 0 ? `CLICK TO EQUIP → ${def.slot.toUpperCase()} #${targetIdx + 1}`
                  : `CLICK TO EQUIP — REPLACES ${def.slot.toUpperCase()} #1`;
                return (
                  <div
                    key={it.instanceId}
                    className="sw-slot equip-cell"
                    style={{
                      width: 48, height: 48,
                      boxShadow: `inset 0 0 0 1px ${color}88${sellMode ? ", inset 0 0 10px rgba(255,60,80,0.35)" : ""}`,
                      cursor: sellMode || !isEquipped ? "pointer" : "default",
                      opacity: isEquipped && !sellMode ? 0.55 : 1,
                    }}
                    onMouseEnter={(e) => {
                      const rc = e.currentTarget.getBoundingClientRect();
                      setHoveredInvInstanceId(!isEquipped && !sellMode ? it.instanceId : null);
                      setCardHover({ kind: "inv", id: it.instanceId, x: rc.left, y: rc.top });
                    }}
                    onMouseLeave={() => setCardHover(null)}
                    onClick={() => {
                      if (sellMode) { sellInventoryItem(it.instanceId); return; }
                      if (isEquipped) return;
                      let idx = state.player.equipped[def.slot].findIndex((x) => x === null);
                      if (idx < 0) idx = 0; // overwrite first slot if all full
                      equipModule(it.instanceId, def.slot, idx);
                    }}
                  >
                    <span style={{ color: def.color, fontSize: 17, lineHeight: 1, textShadow: `0 0 8px ${def.color}` }}>{def.glyph}</span>
                    <span className="equip-tier" style={{ color }}>{"▪".repeat(Math.min(5, def.tier))}</span>
                    {isEquipped && (
                      <span style={{ position: "absolute", top: 1, right: 4, fontSize: 8, fontWeight: 700, color: "#5cff8a", textShadow: "0 0 5px #5cff8a" }}>E</span>
                    )}
                    {def.weaponKind === "rocket" && (
                      <span style={{ position: "absolute", top: 0, left: 4, fontSize: 8, color: "#ff8a4e" }}>⟁</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {!showShop && visibleInv.length === 0 && (
            <div className="text-mute text-[11px] italic p-2">No modules. Open the shop below or run a dungeon.</div>
          )}
        </div>

        {/* console action plate (DarkOrbit: VERKAUFEN / SCHNELLKAUF / REPAIR) */}
        <div className="console-sq shrink-0" style={{ marginTop: 8, padding: "9px 10px" }}>
          <div className="console-corner tl" /><div className="console-corner tr" />
          <div className="console-corner bl" /><div className="console-corner br" />
          <div className="flex flex-col gap-1.5">
            <button
              className={`gbtn ${sellMode ? "gbtn-red" : ""}`}
              style={{ padding: "4px 0", fontSize: 11, width: "100%", letterSpacing: "0.14em" }}
              disabled={showShop}
              title={showShop ? "Switch to inventory to sell modules" : "Toggle sell mode — click inventory modules to sell them"}
              onClick={() => setSellMode((v) => !v)}
            >
              {sellMode ? "✕ EXIT SELL MODE" : "SELL"}
            </button>
            <button
              className="gbtn gbtn-gold"
              style={{ padding: "4px 0", fontSize: 11, width: "100%", letterSpacing: "0.14em" }}
              title={showShop ? "Back to your inventory" : `Buy modules at ${station.name}`}
              onClick={() => { setShowShop((v) => !v); setSellMode(false); setHoveredShopDefId(null); setHoveredInvInstanceId(null); }}
            >
              {showShop ? "INVENTORY" : "SHOP"}
            </button>
            <button
              className="gbtn"
              style={{ padding: "4px 0", fontSize: 11, width: "100%", letterSpacing: "0.14em" }}
              onClick={() => setShowAmmoPopup((v) => !v)}
            >
              ⟁ AMMO
            </button>
          </div>
        </div>
      </div>
      {/* rich item comparison card — MMORPG style, anchored beside the cell */}
      {cardHover && (() => {
        let def: ModuleDef | undefined;
        let item: (typeof player.inventory)[number] | null = null;
        if (cardHover.kind === "shop") {
          def = MODULE_DEFS[cardHover.id];
        } else {
          item = player.inventory.find((m) => m.instanceId === cardHover.id) ?? null;
          def = item ? MODULE_DEFS[item.defId] : undefined;
        }
        if (!def) return null;
        const nameColor = item && isRolledItem(item) ? lootItemColor(item, def) : RARITY_COLOR[def.rarity];
        const displayName = item && isRolledItem(item) ? lootItemName(item, def) : def.name;
        // candidate stats = base def stats + rolled affix bonuses
        const combined = (it2: typeof item, d2: ModuleDef): ModuleStats => {
          const s: any = { ...d2.stats };
          if (it2 && isRolledItem(it2)) {
            for (const [k, v] of Object.entries(resolveAffixStats(it2 as any))) {
              if (k === "fireRate") s.fireRate = (s.fireRate ?? 1) * (v as number);
              else s[k] = (s[k] ?? 0) + (v as number);
            }
          }
          return s;
        };
        const cand = combined(item, def);
        // comparison target: the item this would replace (first free slot →
        // empty comparison, else equipped #1)
        const slotArr = player.equipped[def.slot];
        const freeIdx = slotArr.findIndex((x) => x === null);
        const eqId = freeIdx >= 0 ? null : slotArr[0];
        const eqItem = eqId ? player.inventory.find((m) => m.instanceId === eqId) ?? null : null;
        const eqDef = eqItem ? MODULE_DEFS[eqItem.defId] : null;
        const eqStats: ModuleStats = eqItem && eqDef ? combined(eqItem, eqDef) : {};
        const isSame = item != null && eqId === item.instanceId;
        const diffs = computeStatDiff(eqStats, cand);
        const CARD_W = 288;
        const left = Math.max(8, cardHover.x - CARD_W - 14 > 8 ? cardHover.x - CARD_W - 14 : cardHover.x + 62);
        const top = Math.max(8, Math.min(cardHover.y - 20, window.innerHeight - 380));
        const isEquippedNow = item != null && (
          player.equipped.weapon.includes(item.instanceId) ||
          player.equipped.generator.includes(item.instanceId) ||
          player.equipped.module.includes(item.instanceId));
        return (
          <div
            className="console-sq"
            style={{ position: "fixed", left, top, width: CARD_W, zIndex: 90, pointerEvents: "none", padding: "10px 12px" }}
          >
            <div className="console-corner tl" /><div className="console-corner tr" />
            <div className="console-corner bl" /><div className="console-corner br" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="shrink-0 flex items-center justify-center"
                style={{ width: 30, height: 30, background: `${def.color}22`, border: `1px solid ${def.color}`, color: def.color, fontSize: 15 }}>
                {def.glyph}
              </div>
              <div className="min-w-0">
                <div className="font-bold tracking-wide text-[13px] truncate" style={{ color: nameColor, fontFamily: "var(--font-display)" }}>
                  {displayName}
                </div>
                <div className="text-[10px] uppercase" style={{ color: "#8f96a6" }}>
                  T{def.tier} {def.rarity} · {def.slot}
                  {item && isRolledItem(item) && <span> · i{(item as any).ilvl ?? 1}</span>}
                  {isEquippedNow && <span style={{ color: "#5cff8a" }}> · equipped</span>}
                </div>
              </div>
            </div>
            <div className="text-[11px] leading-tight mt-1.5" style={{ color: "#b8bdca" }}>{def.description}</div>
            <div className="mt-1.5">{modStatPills(cand)}</div>
            {item && isRolledItem(item) && ((item as any).affixes?.length ?? 0) > 0 && (
              <div className="text-[10.5px] leading-snug mt-1" style={{ color: nameColor }}>
                {((item as any).affixes ?? []).map((rr: any) => affixLine(rr)).join("  ·  ")}
              </div>
            )}
            {/* comparison block: green gains, red losses */}
            {!isSame && (
              <div className="mt-2 pt-1.5" style={{ borderTop: "1px solid #33353e" }}>
                <div className="text-[10px] tracking-widest mb-1" style={{ color: "#8f96a6" }}>
                  {eqDef ? `VS EQUIPPED · ${eqItem && isRolledItem(eqItem) ? lootItemName(eqItem, eqDef) : eqDef.name}` : "VS EMPTY SLOT"}
                </div>
                {diffs.length === 0 ? (
                  <div className="text-[11px] italic" style={{ color: "#8f96a6" }}>identical stats</div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {diffs.map((d2) => (
                      <div key={d2.label} className="flex items-center justify-between text-[11.5px] tabular-nums">
                        <span style={{ color: "#8f96a6" }}>{d2.label}</span>
                        <span className="font-bold" style={{ color: d2.delta > 0 ? "#5cff8a" : "#ff5c6c" }}>
                          {d2.delta > 0 ? "▲" : "▼"} {d2.formatted}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between mt-2 pt-1.5 text-[11px]" style={{ borderTop: "1px solid #33353e" }}>
              {cardHover.kind === "shop" ? (
                <>
                  <span style={{ color: player.credits >= def.price ? "var(--accent-amber)" : "#ff5c6c" }} className="font-bold tabular-nums">
                    {def.price.toLocaleString()} CR
                  </span>
                  <span style={{ color: "#8f96a6" }}>{player.credits >= def.price ? "CLICK TO BUY" : "NOT ENOUGH CREDITS"}</span>
                </>
              ) : (
                <>
                  <span style={{ color: "var(--accent-amber)" }} className="tabular-nums">
                    SELLS {item ? lootSellPrice(item, def).toLocaleString() : 0} CR
                  </span>
                  <span style={{ color: sellMode ? "#ff8a93" : "#8f96a6" }}>
                    {sellMode ? "CLICK TO SELL" : isEquippedNow ? "EQUIPPED" : "CLICK TO EQUIP"}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })()}
      {showAmmoPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
            pointerEvents: "auto",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAmmoPopup(false); }}}
        >
          <div className="panel" style={{ maxWidth: 640, width: "90vw", maxHeight: "80vh", overflowY: "auto", padding: 0 }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b" style={{ borderColor: "var(--border-soft)" }}>
              <div className="text-cyan tracking-widest text-sm font-bold">AMMO MANAGEMENT</div>
              <button className="gbtn gbtn-red" style={{ padding: "2px 8px", fontSize: 13 }} onClick={() => setShowAmmoPopup(false)}>✕ Close</button>
            </div>
            <AmmoTab />
          </div>
        </div>
      )}
    </div>
  );
}

// ── DUNGEONS ──────────────────────────────────────────────────────────────
function fmtClearTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function DungeonsTab() {
  const player = useGame((s) => s.player);
  const dungeon = useGame((s) => s.dungeon);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const featuredId = getDailyFeaturedDungeon();
  // Featured dungeon first, rest in original order
  const allDungeons = Object.values(DUNGEONS);
  const list = [
    ...allDungeons.filter((d) => d.id === featuredId),
    ...allDungeons.filter((d) => d.id !== featuredId),
  ];
  // Display the UTC date to match the canonical featured dungeon rotation (resets at UTC midnight)
  const now = new Date();
  const utcDateStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
  const dateLabel = utcDateStr;
  return (
    <div className="p-4 space-y-3">
      <div className="text-cyan tracking-widest text-sm">▶ INSTANCED DUNGEONS</div>
      <div className="text-dim text-[13px]">
        Each dungeon is a wave-based instance. Clear all waves for credits, materials and a guaranteed module drop.
      </div>
      {/* Daily featured banner */}
      <div className="panel p-2.5" style={{ borderColor: "#ffd24a", background: "rgba(255,210,74,0.06)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[14px]">⭐</span>
          <div>
            <div className="text-[13px] font-bold tracking-widest text-amber">DAILY FEATURED RIFT — {dateLabel.toUpperCase()}</div>
            <div className="text-[13px] text-dim mt-0.5">
              <span className="font-bold" style={{ color: DUNGEONS[featuredId].color }}>{DUNGEONS[featuredId].name}</span>
              <span className="text-mute"> · </span>
              <span className="text-amber">{DAILY_DUNGEON_BONUS.label}</span>
            </div>
          </div>
        </div>
      </div>
      {dungeon && (
        <div className="panel p-2" style={{ borderColor: "#ffd24a" }}>
          <div className="text-amber text-[13px] font-bold tracking-widest">⚠ DUNGEON IN PROGRESS — {DUNGEONS[dungeon.id].name.toUpperCase()}</div>
          <div className="text-mute text-[13px]">Wave {dungeon.wave}/{dungeon.totalWaves}. Undock to fight.</div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {list.map((d) => {
          const locked = player.level < d.unlockLevel;
          const clears = player.dungeonClears?.[d.id] ?? 0;
          const bestMs = player.dungeonBestTimes?.[d.id];
          const isFeatured = d.id === featuredId;
          const featuredCredits = Math.round(d.rewardCredits * DAILY_DUNGEON_BONUS.creditsMul);
          return (
            <div
              key={d.id}
              className="panel p-2.5"
              style={{
                borderColor: isFeatured ? "#ffd24a" : d.color,
                background: isFeatured ? "rgba(255,210,74,0.05)" : undefined,
              }}
            >
              {isFeatured && (
                <div className="flex items-center gap-1 mb-1.5 -mt-0.5">
                  <span className="text-[13px]">⭐</span>
                  <span className="text-[12px] font-bold tracking-widest text-amber">DAILY FEATURED</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold tracking-widest" style={{ color: isFeatured ? "#ffd24a" : d.color }}>{d.name.toUpperCase()}</div>
                <div className="text-[12px] tracking-widest text-mute">{d.zone.toUpperCase()}</div>
              </div>
              <div className="text-dim text-[13px] mt-0.5">{d.description}</div>
              <div className="grid grid-cols-3 gap-1 text-[12px] mt-2">
                <Stat label="WAVES" v={d.waves} />
                <Stat label="ENEMIES" v={`${d.enemiesPerWave}×`} />
                <Stat label="REQ" v={`Lv ${d.unlockLevel}`} />
              </div>
              {isFeatured ? (
                <div className="mt-1 space-y-0.5">
                  <div className="text-[12px] text-amber line-through opacity-50">+{d.rewardCredits.toLocaleString()}cr · +{d.rewardExp}xp · 1 module</div>
                  <div className="text-[12px] font-bold text-amber">⭐ +{featuredCredits.toLocaleString()}cr · +{d.rewardExp}xp · 2 modules</div>
                </div>
              ) : (
                <div className="text-[12px] text-amber mt-1">+{d.rewardCredits.toLocaleString()}cr · +{d.rewardExp}xp · 1 module</div>
              )}
              <div className="text-[12px] text-mute mt-0.5">
                Materials: {d.rewardMaterials.map((m) => `${m.qty}× ${RESOURCES[m.resourceId].name}`).join(" · ")}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="text-[12px]" style={{ color: clears > 0 ? "#5cff8a" : "#555" }}>
                  ✓ {clears === 0 ? "Never cleared" : `${clears}× cleared`}
                </div>
                {bestMs !== undefined && (
                  <div className="text-[12px] text-amber">⏱ {fmtClearTime(bestMs)}</div>
                )}
              </div>
              {confirmId === d.id ? (
                <div className="mt-2" style={{ display: "flex", gap: 6 }}>
                  <button className="gbtn w-full" style={{ padding: "4px 8px", fontSize: 12, background: "#333", color: "#ccc", border: "1px solid #555" }} onClick={() => setConfirmId(null)}>Cancel</button>
                  <button className="gbtn gbtn-gold w-full" style={{ padding: "4px 8px", fontSize: 12, background: "#4a6cf7" }} onClick={() => { setConfirmId(null); state.dockedAt = null; sendDockLeave(); enterDungeon(d.id as DungeonId); }}>Confirm Entry</button>
                </div>
              ) : (
                <button
                  className="gbtn gbtn-gold w-full mt-2"
                  style={{ padding: "3px 6px", fontSize: 13, ...(isFeatured && !locked && !dungeon ? { background: "#ffd24a", color: "#000" } : {}) }}
                  disabled={locked || !!dungeon}
                  onClick={() => setConfirmId(d.id)}
                >
                  {locked ? `Locked \u00b7 Lv ${d.unlockLevel}` : dungeon ? "In a dungeon" : isFeatured ? "\u2b50 Launch Featured Run" : "Launch run"}
                </button>
              )}
            </div>
          );
        })}
      </div>
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
      reconcileShipSlots();
      ensureAmmoInitialized();
      const stats = effectiveStats();
      player.hull = stats.hullMax; player.shield = stats.shieldMax;
      pushNotification(`Boarded ${cls.name}`, "good");
      save(); bump();
      return;
    }
    if (player.credits < cls.price) { pushNotification("Not enough credits", "bad"); return; }
    player.credits -= cls.price;
    player.ownedShips.push(id);
    player.shipClass = id;
    reconcileShipSlots();
    ensureAmmoInitialized();
    const stats = effectiveStats();
    player.hull = stats.hullMax; player.shield = stats.shieldMax;
    pushNotification(`Acquired ${cls.name}!`, "good");
    save(); bump();
  };

  return (
    <div className="p-4 space-y-2">
      <div className="hud-label" style={{ fontSize: 10, paddingBottom: 2 }}>SHIPYARD — AVAILABLE HULLS</div>
      {(Object.values(SHIP_CLASSES) as { id: ShipClassId; [k: string]: any }[]).map((cls) => {
        const owned = player.ownedShips.includes(cls.id);
        const active = player.shipClass === cls.id;
        const stats: [string, number | string][] = [
          ["HULL", cls.hullMax], ["SHD", cls.shieldMax], ["SPD", cls.baseSpeed], ["DMG", cls.baseDamage],
          ["DRN", cls.droneSlots], ["WPN", cls.slots.weapon], ["GEN", cls.slots.generator], ["MOD", cls.slots.module],
        ];
        return (
          <div
            key={cls.id}
            className="sw-card"
            style={{ borderColor: active ? `${cls.color}aa` : undefined, background: active ? `${cls.color}0d` : undefined }}
          >
            <div
              className="shrink-0 overflow-hidden"
              style={{ width: 56, height: 56, border: `1px solid ${cls.color}66` }}
            >
              <ShipPreview shipId={cls.id} color={cls.color} size={56} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold tracking-widest truncate" style={{ color: cls.color, fontSize: 12, fontFamily: "var(--font-display)" }}>
                  {cls.name.toUpperCase()}
                </span>
                {active && (
                  <span className="shrink-0" style={{ color: "var(--accent-cyan)", fontSize: 10, letterSpacing: "0.14em", border: "1px solid rgba(56,214,245,0.4)", padding: "0 4px" }}>
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="text-dim clamp2" style={{ fontSize: 10, lineHeight: 1.4, marginTop: 1 }}>{cls.description}</div>
              <div className="flex flex-wrap" style={{ gap: "2px 10px", marginTop: 3 }}>
                {stats.map(([l, v]) => (
                  <span key={l} className="tabular-nums whitespace-nowrap" style={{ fontSize: 10 }}>
                    <span style={{ color: "var(--text-mute)" }}>{l} </span>
                    <span style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>{v}</span>
                  </span>
                ))}
              </div>
            </div>
            <button
              className="gbtn gbtn-gold shrink-0"
              style={{ padding: "4px 10px", fontSize: 11, minWidth: 128 }}
              disabled={active || (!owned && player.credits < cls.price)}
              onClick={() => buy(cls.id)}
            >
              {active ? "FLYING" : owned ? "⬡ BOARD" : `BUY · ${cls.price.toLocaleString()}cr`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="min-w-0">
      <div
        className="truncate"
        style={{ color: "var(--text-mute)", fontSize: 11, letterSpacing: "0.14em" }}
      >
        {label}
      </div>
      <div
        className="font-bold tabular-nums truncate"
        style={{ color: "var(--accent-cyan)", fontSize: 15 }}
      >
        {v}
      </div>
    </div>
  );
}

// ── DRONES ────────────────────────────────────────────────────────────────
function DronesTab() {
  const player = useGame((s) => s.player);
  const cls = SHIP_CLASSES[player.shipClass];
  const totalSlots = maxDroneSlots();
  const slotsLeft = totalSlots - player.drones.length;

  const dronePrice = (kind: DroneKind) => {
    const def = DRONE_DEFS[kind];
    const owned = player.drones.filter((d) => d.kind === kind).length;
    return def.price * Math.pow(2, owned);
  };

  const buy = (kind: DroneKind) => {
    const def = DRONE_DEFS[kind];
    const price = dronePrice(kind);
    if (player.credits < price) { pushNotification("Not enough credits", "bad"); return; }
    if (slotsLeft <= 0) { pushNotification("No drone slots free", "bad"); return; }
    player.credits -= price;
    player.drones.push({
      id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      kind,
      mode: "orbit",
      hp: 300 + def.shieldBonus * 2 + def.hullBonus * 2,
      hpMax: 300 + def.shieldBonus * 2 + def.hullBonus * 2,
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
    <div className="p-4 grid grid-cols-2 gap-3" style={{ height: "100%", minHeight: 0 }}>
      <div className="flex flex-col min-h-0">
        <div className="dob-hdr shrink-0" style={{ marginBottom: 8 }}>
          <span>✦ DRONE BAY</span>
          <span style={{ color: "#8f96a6" }}>{player.drones.length}/{totalSlots} SLOTS</span>
        </div>
        <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
          {player.drones.length === 0 && (
            <div className="text-mute italic text-sm">No drones deployed.</div>
          )}
          {player.drones.map((d) => {
            const def = DRONE_DEFS[d.kind];
            return (
              <div key={d.id} className="panel p-3 flex items-center gap-3">
                <div
                  className="flex items-center justify-center text-xl shrink-0"
                  style={{ width: 44, height: 44, background: `${def.color}22`, border: `1px solid ${def.color}`, color: def.color }}
                >
                  ✦
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold tracking-widest truncate" style={{ color: def.color, fontSize: 13 }}>{def.name}</div>
                  <div className="text-dim text-[12px] flex gap-2.5 flex-wrap">
                    {def.damageBonus > 0 && <span style={{ color: "#ff5c6c" }}>+{def.damageBonus} dmg</span>}
                    {def.shieldBonus > 0 && <span style={{ color: "#4ee2ff" }}>+{def.shieldBonus} shd</span>}
                    {def.hullBonus > 0 && <span style={{ color: "#5cff8a" }}>+{def.hullBonus} hp</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 items-stretch shrink-0" style={{ width: 138 }}>
                  <div className="flex gap-1">
                    {(["orbit", "forward", "defensive"] as DroneMode[]).map((m) => (
                      <button
                        key={m}
                        className={`gbtn ${d.mode === m ? "gbtn-gold" : ""}`}
                        style={{ fontSize: 10, padding: "3px 0", flex: 1, opacity: d.mode === m ? 1 : 0.7 }}
                        title={m === "orbit" ? "Orbit: circle the ship" : m === "forward" ? "Forward: advance toward the target" : "Defensive: hold close, short range"}
                        onClick={() => setMode(d.id, m)}
                      >
                        {m === "orbit" ? "ORB" : m === "forward" ? "FWD" : "DEF"}
                      </button>
                    ))}
                  </div>
                  <button className="gbtn gbtn-red" style={{ fontSize: 10, padding: "3px 0" }} onClick={() => scrap(d.id)}>
                    ✕ SCRAP · +{Math.floor(DRONE_DEFS[d.kind].price * 0.5).toLocaleString()}cr
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-mute text-[11px] mt-2 italic shrink-0">
          ORB circles the ship · FWD advances to mid-target · DEF holds close at short range.
        </div>
      </div>

      <div className="flex flex-col min-h-0">
        <div className="dob-hdr shrink-0" style={{ marginBottom: 8 }}>
          <span>✦ DRONE CATALOG</span>
          <span style={{ color: "var(--accent-amber)" }} className="tabular-nums">{player.credits.toLocaleString()} CR</span>
        </div>
        <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
          {Object.values(DRONE_DEFS).map((def) => {
            const price = dronePrice(def.id);
            const owned = player.drones.filter((d) => d.kind === def.id).length;
            return (
              <div key={def.id} className="panel p-3">
                <div className="flex items-center justify-between gap-2 mb-1 min-w-0">
                  <div className="font-bold text-[13px] tracking-wide truncate" style={{ color: def.color }}>
                    {def.name}
                    {owned > 0 && <span className="text-mute font-normal text-[11px]"> · ×{owned} owned</span>}
                  </div>
                  <div className="text-amber text-[13px] font-bold tabular-nums shrink-0">{price.toLocaleString()}cr</div>
                </div>
                <div className="text-dim text-[12px] mb-1.5">{def.description}</div>
                <div className="flex gap-3 text-[12px] mb-2 flex-wrap">
                  {def.damageBonus > 0 && <span style={{ color: "#ff5c6c" }}>+{def.damageBonus} dmg</span>}
                  {def.shieldBonus > 0 && <span style={{ color: "#4ee2ff" }}>+{def.shieldBonus} shield</span>}
                  {def.hullBonus > 0 && <span style={{ color: "#5cff8a" }}>+{def.hullBonus} hull</span>}
                  {def.fireRate > 0 && <span className="text-amber">{def.fireRate.toFixed(1)} shots/s</span>}
                </div>
                <button
                  className="gbtn gbtn-gold w-full"
                  style={{ padding: "5px 0", fontSize: 11 }}
                  disabled={player.credits < price || slotsLeft <= 0}
                  onClick={() => buy(def.id)}
                >
                  {slotsLeft <= 0 ? "NO SLOTS FREE" : `DEPLOY · ${price.toLocaleString()}cr`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── MARKET ────────────────────────────────────────────────────────────────
function MarketTab({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(iv);
  }, []);
  const station = STATIONS.find((s) => s.id === stationId)!;
  const cls = SHIP_CLASSES[player.shipClass];
  const tierCap = Math.min(5, Math.max(1, Math.ceil(player.level / 4)));
  const marketWeaponModules = Object.values(MODULE_DEFS).filter((d) => d.slot === "weapon" && d.tier <= tierCap);

  const buy = (rid: ResourceId, qty: number) => {
    const price = stationPrice(stationId, rid);
    const cost = price * qty;
    if (player.credits < cost) { pushNotification("Not enough credits", "bad"); return; }
    if (cargoUsed() + qty > cargoCapacity()) { pushNotification("Cargo bay full", "bad"); return; }
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
        bumpMission("transport", take, undefined, { resourceId: rid });
    bumpMission("deliver", take, undefined, { resourceId: rid, stationId });
    bumpMission("earn-credits", earn);
save(); bump();
  };

  // Show resources this station trades + any the player is carrying
  const stationResIds = new Set(Object.keys(station.prices));
  const cargoResIds = new Set(player.cargo.map(c => c.resourceId));
  const allRes = Object.values(RESOURCES).filter(
    r => stationResIds.has(r.id) || cargoResIds.has(r.id)
  );
  const isTrade = true;

  const sellAll = () => {
    let totalEarn = 0;
    for (const c of [...player.cargo]) {
      const price = stationPrice(stationId, c.resourceId);
      const earn = price * c.qty;
      totalEarn += earn;
      removeCargo(c.resourceId, c.qty);
    }
    if (totalEarn > 0) {
      player.credits += totalEarn;
      pushNotification(`Sold all cargo · +${totalEarn.toLocaleString()}cr`, "good");
            bumpMission("transport", 1, undefined, {});
      bumpMission("earn-credits", totalEarn);
      save(); bump();
    } else {
      pushNotification("Nothing to sell", "bad");
    }
  };

  const MARKET_COLS = "minmax(150px, 2fr) 88px 55px 105px 104px 148px";

  return (
    <div className="p-4">
      {isTrade && (
        <>
          <div className="dob-hdr mb-2">
            <span>◆ COMMODITY EXCHANGE</span>
            <span className="flex items-center gap-2">
              <button className="gbtn gbtn-gold" style={{ padding: "3px 12px", fontSize: 10 }} onClick={sellAll}>
                SELL ALL CARGO
              </button>
              <span className="tabular-nums font-bold" style={{ color: "var(--accent-amber)" }}>
                {player.credits.toLocaleString()} CR
              </span>
            </span>
          </div>
          <div className="text-mute text-[12px] mb-2">
            Buy low here, sell high elsewhere — stations specialize in different resources. ▼ green price = cheap, ▲ red = expensive.
          </div>

          <div className="grid gap-2 px-2 py-1.5 text-[11px] tracking-widest text-mute" style={{ background: "linear-gradient(180deg, #24252d 0%, #15161b 100%)", border: "1px solid #33353e", gridTemplateColumns: MARKET_COLS }}>
            <div>RESOURCE</div>
            <div className="text-right">PRICE HERE</div>
            <div className="text-right">OWNED</div>
            <div className="text-center">BEST SELL AT</div>
            <div className="text-center">BUY</div>
            <div className="text-center">SELL</div>
          </div>

          <div className="mt-1">
            {allRes.map((r, rowIdx) => {
              const price = stationPrice(stationId, r.id);
              const diff = ((price - r.basePrice) / r.basePrice) * 100;
              const have = player.cargo.find((c) => c.resourceId === r.id)?.qty ?? 0;
              // Find best station to sell this resource
              const bestStation = STATIONS.reduce<{ name: string; price: number; zone: string } | null>((best, s) => {
                if (s.id === stationId) return best;
                const sp = stationPrice(s.id, r.id);
                if (!best || sp > best.price) return { name: s.name, price: sp, zone: s.zone };
                return best;
              }, null);
              const dir = priceDirection(stationId, r.id);
              const dirIcon = dir === "up" ? "▲" : dir === "down" ? "▼" : "●";
              const dirColor = dir === "up" ? "#ff5c6c" : dir === "down" ? "#5cff8a" : "#666";
              const profitVsHere = bestStation ? bestStation.price - price : 0;
              return (
                <div
                  key={r.id}
                  className="grid gap-2 items-center px-2 py-2 hover:bg-white/5 border-b"
                  style={{ borderColor: "var(--border-soft)", gridTemplateColumns: MARKET_COLS, background: rowIdx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{ width: 26, height: 26, background: `${r.color}22`, border: `1px solid ${r.color}`, color: r.color, fontSize: 13 }}
                    >
                      {r.glyph}
                    </div>
                    <div className="min-w-0">
                      <div className="text-bright text-[13px] truncate">{r.name}</div>
                      <div className="text-mute text-[11px] truncate">base {r.basePrice}cr</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums text-[14px] flex items-center justify-end gap-1" style={{ color: diff < 0 ? "#5cff8a" : diff > 0 ? "#ff5c6c" : "var(--text-dim)" }}>
                      <span style={{ color: dirColor, fontSize: 9 }}>{dirIcon}</span>
                      {price}
                    </div>
                    <div className="text-[10px] tabular-nums" style={{ color: diff < 0 ? "#5cff8a" : "#ff5c6c" }}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(0)}% vs base
                    </div>
                  </div>
                  <div className="text-right text-cyan text-[14px] font-bold tabular-nums">{have}</div>
                  <div className="text-center text-[11px]" title={bestStation ? `${bestStation.name} (${(ZONES as any)[bestStation.zone]?.label ?? bestStation.zone}) pays ${bestStation.price}cr` : ""}>
                    {bestStation && profitVsHere > 0 ? (
                      <div>
                        <div style={{ color: "#5cff8a", fontWeight: "bold" }}>+{profitVsHere}cr/u</div>
                        <div className="text-mute truncate" style={{ maxWidth: 100, fontSize: 10, margin: "0 auto" }}>
                          {bestStation.name} [{(ZONES as any)[bestStation.zone]?.label ?? "?"}]
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "#ffd24a", fontWeight: "bold" }}>BEST HERE</span>
                    )}
                  </div>
                  <div className="flex gap-1 justify-center">
                    <button className="gbtn gbtn-gold" style={{ padding: "5px 0", fontSize: 11, flex: 1 }} disabled={player.credits < price} onClick={() => buy(r.id, 1)}>+1</button>
                    <button className="gbtn gbtn-gold" style={{ padding: "5px 0", fontSize: 11, flex: 1 }} disabled={player.credits < price * 10} onClick={() => buy(r.id, 10)}>+10</button>
                  </div>
                  <div className="flex gap-1 justify-center">
                    <button className="gbtn" style={{ padding: "5px 0", fontSize: 11, flex: 1 }} disabled={have <= 0} onClick={() => sell(r.id, 1)}>−1</button>
                    <button className="gbtn" style={{ padding: "5px 0", fontSize: 11, flex: 1 }} disabled={have < 10} onClick={() => sell(r.id, 10)}>−10</button>
                    <button className="gbtn" style={{ padding: "5px 0", fontSize: 11, flex: 1 }} disabled={have <= 0} onClick={() => sell(r.id, have)}>ALL</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!isTrade && (
        <div className="mb-4 p-3 text-center" style={{ background: "rgba(247, 168, 50, 0.05)", border: "1px solid var(--border-soft)" }}>
          <div className="text-mute text-[13px]">This station does not have a commodity exchange.</div>
          <div className="text-dim text-[12px] mt-1">Visit a Trade station to buy and sell resources.</div>
        </div>
      )}

      {/* Consumables Shop */}
      <div className="mt-4">
        <div className="dob-hdr mb-2"><span>◆ CONSUMABLES SHOP</span></div>
        <div className="grid grid-cols-1 gap-1">
          {(Object.keys(CONSUMABLE_DEFS) as ConsumableId[]).map((cid) => {
            const def = CONSUMABLE_DEFS[cid];
            const have = player.consumables[cid] ?? 0;
            return (
              <div
                key={cid}
                className="flex items-center gap-3 px-3 py-2 border-b"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <div
                  style={{
                    width: 30, height: 30, fontSize: 18,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${def.color}22`, border: `1px solid ${def.color}`,
                    color: def.color, flexShrink: 0,
                  }}
                >
                  {def.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-bright text-[13px] font-bold">{def.name}</div>
                  <div className="text-mute text-[12px]">{def.description}</div>
                </div>
                <div className="text-cyan text-[13px] tabular-nums whitespace-nowrap">×{have}</div>
                <div className="text-amber text-[13px] tabular-nums whitespace-nowrap">{def.price}cr</div>
                <div className="flex gap-1">
                  <button
                    className="gbtn gbtn-gold"
                    style={{ padding: "2px 8px", fontSize: 13 }}
                    disabled={player.credits < def.price}
                    onClick={() => buyConsumable(cid, 1)}
                  >
                    ×1
                  </button>
                  <button
                    className="gbtn gbtn-gold"
                    style={{ padding: "2px 8px", fontSize: 13 }}
                    disabled={player.credits < def.price * 5}
                    onClick={() => buyConsumable(cid, 5)}
                  >
                    ×5
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
          <div className="text-cyan tracking-widest text-sm">▶ CARGO BAY</div>
          <div className="text-mute text-[13px]">Carrying {total}/{cargoCapacity()} units</div>
        </div>
      </div>
      {player.cargo.length === 0 && (
        <div className="text-mute text-sm italic">Empty. Mine asteroids, defeat enemies, or trade at the market.</div>
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
                <div className="text-mute text-[13px]">×{c.qty} · base {r.basePrice}cr/u</div>
              </div>
              <div className="text-amber font-bold tabular-nums">{(c.qty * r.basePrice).toLocaleString()}cr</div>
            </div>
          );
        })}
      </div>
      <div className="text-mute text-[13px] italic mt-3">
        Use the Market tab to sell cargo at the current station's prices.
      </div>
    </div>
  );
}

// ── REPAIR / SERVICES ─────────────────────────────────────────────────────

// ── REFINERY ──────────────────────────────────────────────────────────────
function RefineryTab({ stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const jobs = useGame((s) => s.refiningJobs);
  const factoryLevel = useGame((s) => s.factoryLevel);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const maxSlots = factoryLevel + 1;
  const speedMul = FACTORY_SPEED_BONUS[factoryLevel] ?? 1.0;
  const nextCost = factoryLevel < 5 ? FACTORY_UPGRADE_COSTS[factoryLevel] : null;

  function hasInputs(recipe: typeof REFINE_RECIPES[0]): boolean {
    return recipe.inputs.every(inp => {
      const c = player.cargo.find(ci => ci.resourceId === inp.resourceId);
      return c && c.qty >= inp.qty;
    });
  }

  function fmtTime(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  return (
    <div className="p-4">
      {/* Factory Level Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-cyan tracking-widest text-sm font-bold">REFINERY — LEVEL {factoryLevel}</div>
          <div className="text-mute text-[12px]">
            {jobs.length}/{maxSlots} slots used · Processing speed: {Math.round((1 - speedMul) * 100)}% faster
          </div>
        </div>
        {nextCost !== null && (
          <button
            className="gbtn gbtn-gold text-[12px] px-3 py-1.5"
            style={{ opacity: player.credits >= nextCost ? 1 : 0.4 }}
            onClick={() => { if (player.credits >= nextCost) upgradeFactory(); }}
          >
            UPGRADE LV{factoryLevel + 1} — {nextCost.toLocaleString()}cr
          </button>
        )}
        {nextCost === null && (
          <div className="text-amber text-[12px] tracking-widest">MAX LEVEL</div>
        )}
      </div>

      {/* Active Jobs */}
      {jobs.length > 0 && (
        <div className="mb-4">
          <div className="text-mute text-[11px] tracking-widest mb-2">ACTIVE JOBS</div>
          {jobs.map((job, i) => {
            const recipe = REFINE_RECIPES.find(r => r.id === job.recipeId);
            if (!recipe) return null;
            const outRes = (RESOURCES as any)[recipe.output.resourceId];
            const done = now >= job.completesAt;
            const elapsed = now - job.startedAt;
            const total = job.completesAt - job.startedAt;
            const pct = Math.min(100, (elapsed / total) * 100);
            return (
              <div key={i} className="flex items-center gap-3 p-3 mb-2 border" style={{ borderColor: done ? "#5cff8a44" : "var(--border-soft)", background: done ? "#5cff8a08" : "transparent" }}>
                <div style={{ width: 32, height: 32, background: (outRes?.color ?? "#aaa") + "22", border: "1px solid " + (outRes?.color ?? "#aaa"), color: outRes?.color ?? "#aaa", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {outRes?.glyph ?? "?"}
                </div>
                <div className="flex-1">
                  <div className="text-bright text-[13px] font-bold">{recipe.name}</div>
                  <div className="text-mute text-[11px]">
                    {done ? "READY TO COLLECT" : fmtTime(job.completesAt - now) + " remaining"}
                  </div>
                  {!done && (
                    <div style={{ height: 3, background: "#1a2348", marginTop: 4, borderRadius: 2 }}>
                      <div style={{ height: 3, background: "#4ee2ff", width: pct + "%", borderRadius: 2, transition: "width 1s linear" }} />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[12px]" style={{ color: outRes?.color ?? "#aaa" }}>{recipe.output.qty}x {outRes?.name ?? recipe.output.resourceId}</div>
                  {done && (
                    <button
                      className="gbtn gbtn-gold text-[11px] px-2 py-1 mt-1"
                      onClick={() => collectRefineJob(i)}
                    >COLLECT</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recipes */}
      <div className="text-mute text-[11px] tracking-widest mb-2">RECIPES</div>
      <div className="grid gap-2">
        {REFINE_RECIPES.map((recipe) => {
          const outRes = (RESOURCES as any)[recipe.output.resourceId];
          const locked = factoryLevel < recipe.minFactoryLevel;
          const canStart = !locked && hasInputs(recipe) && jobs.length < maxSlots;
          const timeSec = Math.round(recipe.timeSeconds * speedMul);

          return (
            <div key={recipe.id} className="p-3 border" style={{ borderColor: locked ? "#333" : "var(--border-soft)", opacity: locked ? 0.5 : 1 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div style={{ width: 28, height: 28, background: (outRes?.color ?? "#aaa") + "22", border: "1px solid " + (outRes?.color ?? "#aaa"), color: outRes?.color ?? "#aaa", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {outRes?.glyph ?? "?"}
                  </div>
                  <div>
                    <div className="text-bright text-[13px] font-bold">{recipe.name}</div>
                    <div className="text-mute text-[11px]">
                      {locked ? `Requires Factory Lv${recipe.minFactoryLevel}` : `${Math.floor(timeSec / 60)}m ${timeSec % 60}s`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[12px]" style={{ color: outRes?.color ?? "#aaa" }}>{recipe.output.qty}x {outRes?.name ?? "?"}</div>
                    <div className="text-amber text-[11px]">~{(recipe.output.qty * (outRes?.basePrice ?? 0)).toLocaleString()}cr base</div>
                  </div>
                  <button
                    className="gbtn gbtn-gold text-[11px] px-3 py-1.5"
                    style={{ opacity: canStart ? 1 : 0.3 }}
                    onClick={() => { if (canStart) startRefineJob(recipe.id); }}
                    disabled={!canStart}
                  >
                    {locked ? "LOCKED" : "START"}
                  </button>
                </div>
              </div>
              {/* Inputs */}
              <div className="flex flex-wrap gap-2">
                {recipe.inputs.map((inp, j) => {
                  const inRes = (RESOURCES as any)[inp.resourceId];
                  const have = player.cargo.find(c => c.resourceId === inp.resourceId)?.qty ?? 0;
                  const enough = have >= inp.qty;
                  return (
                    <div key={j} className="flex items-center gap-1 px-2 py-1" style={{ background: enough ? "#5cff8a11" : "#ff5c6c11", border: "1px solid " + (enough ? "#5cff8a33" : "#ff5c6c33"), fontSize: 11 }}>
                      <span style={{ color: inRes?.color ?? "#aaa" }}>{inRes?.glyph ?? "?"}</span>
                      <span className="text-bright">{inp.qty}x {inRes?.name ?? inp.resourceId}</span>
                      <span style={{ color: enough ? "#5cff8a" : "#ff5c6c" }}>({have})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RepairTab({ stationId: _stationId }: { stationId: string }) {
  const player = useGame((s) => s.player);
  const stats = effectiveStats();
  const hullDamage = stats.hullMax - player.hull;
  const shieldMissing = stats.shieldMax - player.shield;
  const repairCost = Math.ceil(hullDamage * 2);
  const refillShield = () => {
    player.shield = stats.shieldMax;
    sendDockRepair(player.hull, stats.shieldMax);
    pushNotification("Shields recharged", "good");
    save(); bump();
  };
  const repair = () => {
    if (hullDamage <= 0) { pushNotification("Hull is already pristine", "info"); return; }
    if (player.credits < repairCost) { pushNotification("Not enough credits", "bad"); return; }
    player.credits -= repairCost;
    player.hull = stats.hullMax;
    sendDockRepair(stats.hullMax, player.shield);
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
      <div className="dob-hdr mb-2"><span>✚ STATION SERVICES</span></div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-green">✚</div>
        <div className="flex-1">
          <div className="text-green font-bold tracking-widest">HULL REPAIR</div>
          <div className="text-dim text-[13px]">Restore {hullDamage} hull points to full integrity.</div>
        </div>
        <button className="gbtn gbtn-gold" disabled={hullDamage <= 0 || player.credits < repairCost} onClick={repair}>
          {hullDamage <= 0 ? "PRISTINE" : `Repair · ${repairCost}cr`}
        </button>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-cyan">⟁</div>
        <div className="flex-1">
          <div className="text-cyan font-bold tracking-widest">SHIELD RECHARGE</div>
          <div className="text-dim text-[13px]">Free at any docked station. Restores {Math.round(shieldMissing)} SP.</div>
        </div>
        <button className="gbtn gbtn-gold" disabled={shieldMissing <= 0} onClick={refillShield}>
          {shieldMissing <= 0 ? "FULL" : "Recharge · FREE"}
        </button>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-amber">✦</div>
        <div className="flex-1">
          <div className="text-amber font-bold tracking-widest">DRONE OVERHAUL</div>
          <div className="text-dim text-[13px]">
            Restore all {player.drones.length} drone(s) to full HP.
          </div>
        </div>
        <button className="gbtn" disabled={droneRepairCost <= 0 || player.credits < droneRepairCost} onClick={repairDrones}>
          {droneRepairCost <= 0 ? "ALL OK" : `Repair · ${droneRepairCost}cr`}
        </button>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl" style={{ color: "#ff8a4e" }}>⟳</div>
        <div className="flex-1">
          <div className="font-bold tracking-widest" style={{ color: "#ff8a4e" }}>AUTO-RESTOCK AMMO</div>
          <div className="text-dim text-[13px]">
            Automatically top up rocket ammo when docking, if you have enough credits.
          </div>
        </div>
        <GameButton style={{ color: player.autoRestock ? "#ff8a4e" : "#888", minWidth: 64 }} onClick={() => setAutoRestock(!player.autoRestock)}>
          {player.autoRestock ? "ON" : "OFF"}
        </GameButton>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-green">⚙</div>
        <div className="flex-1">
          <div className="text-green font-bold tracking-widest">AUTO-REPAIR HULL</div>
          <div className="text-dim text-[13px]">
            Automatically repair hull damage when docking, if you have enough credits (2cr/HP).
          </div>
        </div>
        <GameButton style={{ color: player.autoRepairHull ? "#5cff8a" : "#888", minWidth: 64 }} onClick={() => setAutoRepairHull(!player.autoRepairHull)}>
          {player.autoRepairHull ? "ON" : "OFF"}
        </GameButton>
      </div>

      <div className="panel p-4 flex items-center gap-4">
        <div className="text-3xl text-cyan">↺</div>
        <div className="flex-1">
          <div className="text-cyan font-bold tracking-widest">AUTO-SHIELD RECHARGE</div>
          <div className="text-dim text-[13px]">
            Automatically recharge shields to full when docking. Always free.
          </div>
        </div>
        <GameButton style={{ color: player.autoShieldRecharge ? "#4ee2ff" : "#888", minWidth: 64 }} onClick={() => setAutoShieldRecharge(!player.autoShieldRecharge)}>
          {player.autoShieldRecharge ? "ON" : "OFF"}
        </GameButton>
      </div>

      <div className="panel p-4">
        <div className="text-cyan tracking-widest text-sm mb-2">▶ INSURANCE & RESPAWN</div>
        <div className="text-dim text-[13px]">
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
  const [hover, setHover] = useState<{ id: SkillId; x: number; y: number } | null>(null);
  const hoverNode = hover ? SKILL_NODES.find((n) => n.id === hover.id) ?? null : null;
  const branches: { id: SkillBranch; name: string; color: string }[] = [
    { id: "offense",     name: "OFFENSE",     color: "#ff5c6c" },
    { id: "defense",     name: "DEFENSE",     color: "#4ee2ff" },
    { id: "utility",     name: "UTILITY",     color: "#5cff8a" },
    { id: "engineering", name: "ENGINEERING", color: "#ffd24a" },
  ];
  const branchNodes: Record<SkillBranch, SkillNode[]> = {
    offense: SKILL_NODES.filter((n) => n.branch === "offense"),
    defense: SKILL_NODES.filter((n) => n.branch === "defense"),
    utility: SKILL_NODES.filter((n) => n.branch === "utility"),
    engineering: SKILL_NODES.filter((n) => n.branch === "engineering"),
  };

  return (
    <div className="p-4 space-y-3">
      {/* Skill tree header — DarkOrbit pilot-sheet style strip */}
      <div className="dob-hdr">
        <span>✦ PILOT SKILL TREE</span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums" style={{ color: "var(--accent-amber)" }}>
            {player.skillPoints} POINTS
          </span>
          <button
            className="gbtn gbtn-red"
            style={{ padding: "3px 10px", fontSize: 10 }}
            onClick={() => { if (confirm("Reset skills for 2000cr?")) resetSkills(); }}
          >
            RESPEC · 2000cr
          </button>
        </span>
      </div>
      <div className="text-mute" style={{ fontSize: 11 }}>
        1 skill point per level. Click a node to invest — higher nodes unlock when the one before is skilled.
      </div>

      {/* Skill trees — one node graph per branch, connectors light up along researched paths */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))" }}>
        {branches.map((b) => {
          const nodes = branchNodes[b.id];
          const maxRow = Math.max(...nodes.map((n) => n.pos.row));
          const H = PAD_Y + (maxRow + 1) * ROW_H;
          const center = (n: SkillNode) => ({
            cx: PAD_X + n.pos.col * COL_W + NODE_S / 2,
            cy: PAD_Y + n.pos.row * ROW_H + NODE_S / 2,
          });
          const spent = nodes.reduce((a, n) => a + (player.skills[n.id] ?? 0), 0);
          const total = nodes.reduce((a, n) => a + n.maxRank, 0);
          return (
            <div key={b.id} className="console-sq" style={{ padding: 10 }}>
              <div className="console-corner tl" /><div className="console-corner tr" />
              <div className="console-corner bl" /><div className="console-corner br" />
              <div className="dob-hdr" style={{ margin: "-10px -10px 4px", borderLeftColor: b.color }}>
                <span style={{ color: b.color }}>{b.name} SYSTEMS</span>
                <span className="tabular-nums" style={{ color: "#8f96a6" }}>{spent}/{total}</span>
              </div>
              <div style={{ position: "relative", height: H }}>
                {/* dependency connectors */}
                <svg width="100%" height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {nodes.filter((n) => n.requires).map((n) => {
                    const p = SKILL_NODES.find((x) => x.id === n.requires);
                    if (!p || p.branch !== b.id) return null;
                    const a = center(p);
                    const c = center(n);
                    const lit = (player.skills[p.id] ?? 0) > 0;
                    return (
                      <g key={n.id}>
                        {lit && (
                          <line x1={a.cx} y1={a.cy} x2={c.cx} y2={c.cy}
                            stroke={b.color} strokeWidth={5} opacity={0.22} />
                        )}
                        <line
                          x1={a.cx} y1={a.cy} x2={c.cx} y2={c.cy}
                          stroke={lit ? b.color : "rgba(135,152,178,0.3)"}
                          strokeWidth={lit ? 2.5 : 2}
                          strokeDasharray={lit ? undefined : "4 4"}
                          opacity={lit ? 0.9 : 1}
                        />
                      </g>
                    );
                  })}
                </svg>
                {/* nodes — circular, with a rank ring that fills like an MMORPG talent */}
                {nodes.map((n) => {
                  const cur = player.skills[n.id] ?? 0;
                  const reqMet = !n.requires || (player.skills[n.requires] ?? 0) > 0;
                  const canBuy = cur < n.maxRank && reqMet && player.skillPoints >= n.cost;
                  const maxed = cur >= n.maxRank;
                  const rim = maxed ? "var(--accent-gold)" : cur > 0 ? b.color : reqMet ? "#7d8ea8" : "#39445a";
                  const pct = cur / n.maxRank;
                  const ringColor = maxed ? "#ffd24a" : b.color;
                  const ring = pct > 0
                    ? `conic-gradient(${ringColor} ${pct * 360}deg, rgba(52,62,84,0.85) ${pct * 360}deg)`
                    : "conic-gradient(rgba(52,62,84,0.85) 360deg, rgba(52,62,84,0.85) 0)";
                  return (
                    <button
                      key={n.id}
                      className="skill-node"
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setHover({ id: n.id, x: r.right, y: r.top });
                      }}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => { if (canBuy) buySkillRank(n.id as SkillId); }}
                      style={{
                        position: "absolute",
                        left: PAD_X + n.pos.col * COL_W,
                        top: PAD_Y + n.pos.row * ROW_H,
                        width: NODE_S,
                        height: NODE_S,
                        borderRadius: "50%",
                        padding: 3,
                        background: ring,
                        border: `1px solid ${rim}`,
                        boxShadow: cur > 0
                          ? `0 0 12px ${b.color}55, 0 0 0 1px rgba(0,0,0,0.7)`
                          : "0 0 0 1px rgba(0,0,0,0.7)",
                        cursor: canBuy ? "pointer" : "default",
                        opacity: reqMet ? 1 : 0.5,
                      }}
                    >
                      <span
                        style={{
                          width: "100%", height: "100%",
                          borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 20, lineHeight: 1,
                          color: cur > 0 ? b.color : reqMet ? "var(--text-dim)" : "#55617a",
                          background: cur > 0
                            ? `radial-gradient(circle at 50% 32%, ${b.color}2e 0%, rgba(9,14,26,0.98) 72%)`
                            : "radial-gradient(circle at 50% 32%, rgba(60,80,120,0.32) 0%, rgba(9,14,26,0.98) 78%)",
                        }}
                      >
                        {reqMet ? n.icon : "🔒"}
                      </span>
                      {/* rank badge */}
                      <span
                        className="tabular-nums"
                        style={{
                          position: "absolute",
                          bottom: -16,
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          fontFamily: "var(--font-display)",
                          color: maxed ? "var(--accent-gold)" : cur > 0 ? b.color : "var(--text-mute)",
                          textShadow: "0 1px 2px #000",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {maxed ? "MAX" : `${cur}/${n.maxRank}`}
                      </span>
                      {canBuy && (
                        <span
                          style={{
                            position: "absolute",
                            top: -3, right: -3,
                            width: 9, height: 9,
                            background: "var(--accent-green)",
                            boxShadow: "0 0 6px var(--accent-green)",
                            borderRadius: "50%",
                            animation: "blink 1.6s ease-in-out infinite",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* hover popup */}
      {hoverNode && (() => {
        const n = hoverNode;
        const b = branches.find((x) => x.id === n.branch)!;
        const cur = player.skills[n.id] ?? 0;
        const reqMet = !n.requires || (player.skills[n.requires] ?? 0) > 0;
        const canBuy = cur < n.maxRank && reqMet && player.skillPoints >= n.cost;
        const maxed = cur >= n.maxRank;
        const now = rankBonus(n.description, cur);
        const next = rankBonus(n.description, cur + 1);
        const left = Math.min(hover!.x + 12, window.innerWidth - 292);
        const top = Math.max(8, Math.min(hover!.y - 8, window.innerHeight - 210));
        return (
          <div
            className="sw-tooltip"
            style={{ position: "fixed", left, top, width: 276, zIndex: 70, pointerEvents: "none", padding: "10px 12px" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold truncate" style={{ color: b.color, fontSize: 12, fontFamily: "var(--font-display)", letterSpacing: "0.08em" }}>
                {n.icon} {n.name.toUpperCase()}
              </span>
              <span className="tabular-nums shrink-0" style={{ color: maxed ? "var(--accent-gold)" : "var(--text-dim)", fontSize: 10 }}>
                RANK {cur}/{n.maxRank}
              </span>
            </div>
            <div className="text-dim" style={{ fontSize: 10.5, lineHeight: 1.45, margin: "6px 0" }}>{n.description}</div>
            <div className="sw-hr" />
            <div style={{ fontSize: 10, lineHeight: 1.6 }}>
              <div>
                <span className="hud-label" style={{ fontSize: 10 }}>CURRENT </span>
                <span className="tabular-nums" style={{ color: cur > 0 ? b.color : "var(--text-mute)" }}>{cur > 0 ? (now ?? `rank ${cur} active`) : "not researched"}</span>
              </div>
              {!maxed && (
                <div>
                  <span className="hud-label" style={{ fontSize: 10 }}>NEXT RANK </span>
                  <span className="tabular-nums" style={{ color: "var(--text-bright)" }}>{next ?? `rank ${cur + 1}`}</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, letterSpacing: "0.1em", color: !reqMet ? "var(--accent-red)" : maxed ? "var(--accent-gold)" : canBuy ? "var(--accent-green)" : "var(--text-mute)" }}>
              {!reqMet
                ? `⚠ REQUIRES ${SKILL_NODES.find((x) => x.id === n.requires)?.name.toUpperCase() ?? ""}`
                : maxed ? "✓ FULLY RESEARCHED"
                : canBuy ? `▶ CLICK NODE TO RESEARCH · ${n.cost} PT${n.cost > 1 ? "S" : ""}`
                : `NEEDS ${n.cost} RESEARCH POINT${n.cost > 1 ? "S" : ""}`}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// tree layout metrics
const NODE_S = 50;
const COL_W = 100;
const ROW_H = 88;
const PAD_X = 16;
const PAD_Y = 18;

// Best-effort "what it changes" line: multiply the leading +N[%] of a
// "... per rank" description by the rank count.
function rankBonus(desc: string, rank: number): string | null {
  if (rank <= 0) return null;
  const m = desc.match(/^([+-])(\d+(?:\.\d+)?)(%?)\s*(.*)/);
  if (!m) return null;
  const v = parseFloat(m[2]) * rank;
  const vs = Number.isInteger(v) ? String(v) : v.toFixed(2);
  const rest = m[4].replace(/\s*per rank\.?/i, "").replace(/\.$/, "");
  return `${m[1]}${vs}${m[3]} ${rest}`;
}

// ── MISSIONS ──────────────────────────────────────────────────────────────
function MissionsTab() {
  const player = useGame((s) => s.player);
  const missionBoard = useGame((s) => s.missionBoard);
  useGame((s) => s.tick);
  const [activeTab, setActiveTab] = useState<"daily" | "combat" | "transport" | "gathering" | "delivery" | "exploration">("daily");

  const next = new Date(player.lastDailyReset + 24 * 3600 * 1000);
  const hrs = Math.max(0, Math.floor((next.getTime() - Date.now()) / 3600000));
  const mins = Math.max(0, Math.floor(((next.getTime() - Date.now()) % 3600000) / 60000));

  const tabs = [
    { id: "daily" as const, label: "Daily", icon: "\u2605" },
    { id: "transport" as const, label: "Transport", icon: "\u25B6" },
    { id: "gathering" as const, label: "Gathering", icon: "\u25B0" },
    { id: "delivery" as const, label: "Delivery", icon: "\u25C6" },
    { id: "exploration" as const, label: "Exploration", icon: "\u2726" },
  ];

  const boardByCategory = (cat: string) => (missionBoard ?? []).filter((m: any) => m.category === cat);

  const renderMission = (m: any) => {
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
        <div className="font-bold text-[13px] text-cyan mb-1">{m.title}</div>
        <div className="text-dim text-[13px] mb-2">{m.description}</div>
        {m.targetStationId && (
          <div className="text-[12px] text-magenta mb-1">Target: {STATIONS.find((s: any) => s.id === m.targetStationId)?.name ?? m.targetStationId}</div>
        )}
        <div className="text-mute text-[13px] tabular-nums mb-1">
          {m.progress}/{m.target}
        </div>
        <div
          className="w-full mb-2 overflow-hidden"
          style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct * 100}%`,
              background: ready ? "#5cff8a" : "var(--accent-cyan)",
              borderRadius: 2,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div
          className="mb-2 flex flex-wrap gap-2"
          style={{ fontSize: 13 }}
        >
          <span style={{ color: "var(--accent-amber)" }}>+{m.rewardCredits.toLocaleString()}cr</span>
          <span style={{ color: "#ff5cf0" }}>+{m.rewardExp.toLocaleString()}xp</span>
          <span style={{ color: "#5cff8a" }}>+{m.rewardHonor} honor</span>
        </div>
        <GameButton
          className="w-full"
          style={{ fontSize: 13, width: "100%", color: ready ? "#5cff8a" : "var(--text-mute)" }}
          disabled={!ready}
          onClick={() => claimMission(m.id)}
        >
          {claimed ? "CLAIMED" : ready ? "CLAIM" : "IN PROGRESS"}
        </GameButton>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-3">
      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap border-b pb-3" style={{ borderColor: "var(--border-soft)" }}>
        {tabs.map(t => (
          <GameButton
            key={t.id}
            style={{ fontSize: 13, opacity: activeTab === t.id ? 1 : 0.6 }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon} {t.label}
          </GameButton>
        ))}
      </div>

      {/* Daily tab */}
      {activeTab === "daily" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-cyan tracking-widest text-sm">DAILY MISSIONS</div>
              <div className="text-mute text-[13px] mt-1">Resets in {hrs}h {mins}m</div>
            </div>
            <button
              className="gbtn"
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={rerollDaily}
              disabled={player.credits < 500}
            >
              REROLL 500cr
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {player.dailyMissions.map((m: any) => renderMission(m))}
          </div>
          {/* Milestones */}
          <div className="text-cyan tracking-widest text-sm mt-4 mb-2">LIFETIME MILESTONES</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(player.milestones).map(([k, v]) => (
              <div key={k} className="panel p-2 min-w-0">
                <div
                  className="uppercase truncate"
                  style={{ color: "var(--text-mute)", fontSize: 10, letterSpacing: "0.15em" }}
                >
                  {k}
                </div>
                <div
                  className="font-bold tabular-nums truncate"
                  style={{ color: "var(--accent-amber)", fontSize: 13 }}
                >
                  {(v as number).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Category tabs */}
      {activeTab !== "daily" && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-cyan tracking-widest text-sm">{activeTab.toUpperCase()} MISSIONS</div>
              <div className="text-mute text-[13px] mt-1">Complete missions to earn credits, XP, and honor.</div>
            </div>
            <button
              className="gbtn"
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={rerollMissionBoard}
              disabled={player.credits < 2000}
            >
              REFRESH 2,000cr
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {boardByCategory(activeTab).map((m: any) => renderMission(m))}
            {boardByCategory(activeTab).length === 0 && (
              <div className="text-mute text-sm italic col-span-3">No missions available. Try refreshing the board.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AmmoTab() {
  const player = useGame((s) => s.player);
  useGame((s) => s.tick);
  const ammoMax = rocketAmmoMax();
  const rocketMax = rocketMissileMax();
  const ammoTypes = ["x1", "x2", "x3", "x4"] as RocketAmmoType[];
  const rocketTypes = ROCKET_MISSILE_TYPE_ORDER;
  const activeType = getActiveAmmoType();
  const activeRocketType = getActiveRocketAmmoType();
  const [buyAmounts, setBuyAmounts] = useState<Record<string, number>>({ x1: 100, x2: 100, x3: 100, x4: 100, cl1: 20, cl2: 20, bm3: 20, drock: 20 });
  const presets = [10, 50, 100, 500, 1000];
  const rocketPresets = [5, 10, 20, 50, 100];

  return (
    <div className="p-5 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-cyan tracking-widest text-sm">AMMO</div>
          <div className="text-dim text-[13px] mt-1">
            All weapons share one ammo pool. Select your active type and buy rounds.
          </div>
        </div>
        <div className="panel px-3 py-2 text-right">
          <div className="text-mute text-[12px] tracking-widest">MAX CAPACITY</div>
          <div className="text-amber font-bold tabular-nums">{ammoMax} rounds</div>
        </div>
      </div>

      <div className="space-y-2">
        {ammoTypes.map((type) => {
          const tDef = ROCKET_AMMO_TYPE_DEFS[type];
          const cur = getAmmoCount(type);
          const missing = Math.max(0, ammoMax - cur);
          const isActive = activeType === type;
          const qty = Math.min(buyAmounts[type] ?? 100, missing);
          const cost = qty * tDef.costPerRound;
          return (
            <div
              key={type}
              className="flex items-center gap-3 rounded p-3"
              style={{
                border: `1px solid ${isActive ? tDef.color + "99" : tDef.color + "33"}`,
                background: isActive ? `${tDef.color}15` : "rgba(255,255,255,0.02)",
              }}
            >
              <div className="text-lg font-bold" style={{ color: tDef.color, minWidth: 20, textAlign: "center" }}>
                {tDef.glyph}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold" style={{ color: tDef.color }}>{tDef.name}</span>
                  {isActive && (
                    <span className="text-[13px] tracking-widest px-1 rounded" style={{ background: tDef.color + "33", color: tDef.color }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-mute text-[12px]">{tDef.description} · {tDef.costPerRound}cr/round</div>
                <div className="text-dim text-[12px] tabular-nums">{cur} / {ammoMax} rounds</div>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {presets.map((n) => (
                    <button
                      key={n}
                      className="text-[13px] px-1.5 py-0.5 tracking-widest"
                      style={{
                        background: (buyAmounts[type] ?? 100) === n ? tDef.color + "30" : "transparent",
                        color: (buyAmounts[type] ?? 100) === n ? tDef.color : "#666",
                        border: `1px solid ${(buyAmounts[type] ?? 100) === n ? tDef.color + "99" : "#444"}`,
                        cursor: "pointer",
                      }}
                      onClick={() => setBuyAmounts((prev) => ({ ...prev, [type]: n }))}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    className="text-[13px] px-1.5 py-0.5 tracking-widest"
                    style={{
                      background: (buyAmounts[type] ?? 100) === missing ? tDef.color + "30" : "transparent",
                      color: (buyAmounts[type] ?? 100) === missing ? tDef.color : "#666",
                      border: `1px solid ${(buyAmounts[type] ?? 100) === missing ? tDef.color + "99" : "#444"}`,
                      cursor: "pointer",
                    }}
                    onClick={() => setBuyAmounts((prev) => ({ ...prev, [type]: missing }))}
                  >
                    MAX
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <button
                  className="gbtn"
                  style={{ padding: "3px 10px", fontSize: 13, minWidth: 90 }}
                  disabled={qty === 0 || player.credits < cost}
                  onClick={() => purchaseAmmoAmount(type, qty)}
                >
                  {missing === 0 ? "FULL" : `BUY ${qty} · ${cost}cr`}
                </button>
                <button
                  className="gbtn"
                  style={{
                    fontSize: 13, minWidth: 90,
                    color: isActive ? tDef.color : "var(--text-dim)",
                    opacity: isActive ? 1 : 0.6,
                  }}
                  onClick={() => switchAmmoType(type)}
                >
                  {isActive ? "ACTIVE" : "USE THIS"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid #334", paddingTop: 16 }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="tracking-widest text-sm" style={{ color: "#ff8a4e" }}>ROCKET AMMO</div>
            <div className="text-dim text-[13px] mt-1">
              Rocket launchers use separate ammo. Select type with key 2.
            </div>
          </div>
          <div className="panel px-3 py-2 text-right">
            <div className="text-mute text-[12px] tracking-widest">MAX CAPACITY</div>
            <div className="font-bold tabular-nums" style={{ color: "#ff8a4e" }}>{rocketMax} rounds</div>
          </div>
        </div>

        <div className="space-y-2 mt-3">
          {rocketTypes.map((type) => {
            const tDef = ROCKET_MISSILE_TYPE_DEFS[type];
            const cur = getRocketAmmoCount(type);
            const missing = Math.max(0, rocketMax - cur);
            const isActive = activeRocketType === type;
            const qty = Math.min(buyAmounts[type] ?? 20, missing);
            const cost = qty * tDef.costPerRound;
            return (
              <div
                key={type}
                className="flex items-center gap-3 rounded p-3"
                style={{
                  border: `1px solid ${isActive ? tDef.color + "99" : tDef.color + "33"}`,
                  background: isActive ? `${tDef.color}15` : "rgba(255,255,255,0.02)",
                }}
              >
                <div className="text-lg font-bold" style={{ color: tDef.color, minWidth: 20, textAlign: "center" }}>
                  {tDef.glyph}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold" style={{ color: tDef.color }}>{tDef.name}</span>
                    {isActive && (
                      <span className="text-[13px] tracking-widest px-1 rounded" style={{ background: tDef.color + "33", color: tDef.color }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-mute text-[12px]">{tDef.description} · {tDef.costPerRound}cr/round · x{tDef.damageMul} damage</div>
                  <div className="text-dim text-[12px] tabular-nums">{cur} / {rocketMax} rounds</div>
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {rocketPresets.map((n) => (
                      <button
                        key={n}
                        className="text-[13px] px-1.5 py-0.5 tracking-widest"
                        style={{
                          background: (buyAmounts[type] ?? 20) === n ? tDef.color + "30" : "transparent",
                          color: (buyAmounts[type] ?? 20) === n ? tDef.color : "#666",
                          border: `1px solid ${(buyAmounts[type] ?? 20) === n ? tDef.color + "99" : "#444"}`,
                          cursor: "pointer",
                        }}
                        onClick={() => setBuyAmounts((prev) => ({ ...prev, [type]: n }))}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      className="text-[13px] px-1.5 py-0.5 tracking-widest"
                      style={{
                        background: (buyAmounts[type] ?? 20) === missing ? tDef.color + "30" : "transparent",
                        color: (buyAmounts[type] ?? 20) === missing ? tDef.color : "#666",
                        border: `1px solid ${(buyAmounts[type] ?? 20) === missing ? tDef.color + "99" : "#444"}`,
                        cursor: "pointer",
                      }}
                      onClick={() => setBuyAmounts((prev) => ({ ...prev, [type]: missing }))}
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <button
                    className="gbtn"
                    style={{ padding: "3px 10px", fontSize: 13, minWidth: 90 }}
                    disabled={qty === 0 || player.credits < cost}
                    onClick={() => purchaseRocketAmmo(type, qty)}
                  >
                    {missing === 0 ? "FULL" : `BUY ${qty} · ${cost}cr`}
                  </button>
                  <GameButton
                    style={{ fontSize: 13, minWidth: 90, color: isActive ? tDef.color : "var(--text-dim)", opacity: isActive ? 1 : 0.6 }}
                    onClick={() => switchRocketAmmoType(type)}
                  >
                    {isActive ? "ACTIVE" : "USE THIS"}
                  </GameButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
