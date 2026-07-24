import { useState } from "react";
import "../styles/hud/hud-tokens.css";
import "../styles/hud/hud-animations.css";
import "../styles/hud/hud-theme.css";
import "../styles/hud/hud-materials.css";
import { Hotbar, type HotbarSlotData } from "../components/hud/Hotbar/Hotbar";
import { Minimap, type MinimapBlipData } from "../components/hud/Minimap/Minimap";
import { TopPanel } from "../components/hud/TopPanel/TopPanel";
import { ChatPanel, type ChatMessage } from "../components/hud/ChatPanel/ChatPanel";
import { MenuPanel } from "../components/hud/MenuPanel/MenuPanel";

/**
 * Isolated showcase screen for building/testing the new HUD in isolation
 * from the running game. Mounted at a dedicated route (see App wiring).
 * Uses local mock state (NOT the real game store) so it can be driven with
 * test sliders independent of an actual play session.
 */
export default function HudShowcase() {
  const [hull, setHull] = useState(720);
  const [hullMax] = useState(1000);
  const [shield, setShield] = useState(240);
  const [shieldMax] = useState(500);

  const demoSlots: HotbarSlotData[] = [
    { keyLabel: "1", icon: "⚔", state: "normal", title: "Laser — normal" },
    { keyLabel: "2", icon: "☄", state: "normal", title: "Rockets — hover me" },
    { keyLabel: "3", icon: "◈", state: "selected", title: "Afterburner — active/selected" },
    { keyLabel: "4", icon: "⬡", state: "normal", count: 3, title: "Repair Bot — pressed me / click+hold" },
    { keyLabel: "5", icon: "✦", state: "normal", cooldownFraction: 0.62, cooldownSeconds: 7.4, title: "Shield Charge — cooldown" },
    { keyLabel: "6", icon: "▲", state: "disabled", title: "Disabled — no target" },
    { keyLabel: "7", state: "locked", title: "Locked — requires level 30" },
    { keyLabel: "8", state: "empty", title: "Empty slot" },
    { keyLabel: "9", state: "empty", title: "Empty slot" },
    { keyLabel: "0", state: "empty", title: "Empty slot" },
  ];

  const demoBlips: MinimapBlipData[] = [
    { x: 50, y: 50, kind: "ally", title: "You" },
    { x: 62, y: 38, kind: "ally", title: "Squadmate" },
    { x: 30, y: 68, kind: "hostile", title: "Hostile raider" },
    { x: 74, y: 70, kind: "hostile", title: "Hostile raider" },
    { x: 40, y: 30, kind: "neutral", title: "Trade convoy" },
    { x: 66, y: 58, kind: "objective", title: "Objective: Salvage beacon" },
  ];

  const demoMessages: ChatMessage[] = [
    { channel: "local", sender: "Nova_Reyes", text: "anyone up for a run to Nebula Reach?", time: "18:02" },
    { channel: "local", sender: "System", text: "Commander_Alex has entered Alpha Sector", time: "18:03", system: true },
    { channel: "local", sender: "Kestrel", text: "careful out there, raiders spotted near the gate", time: "18:04" },
    { channel: "clan", sender: "Nova_Reyes", text: "forming up at the outpost", time: "18:05" },
    { channel: "clan", sender: "Vex", text: "on my way, 2 min", time: "18:06" },
    { channel: "party", sender: "Orin", text: "WTS Astrite x400, offer up", time: "17:58" },
    { channel: "party", sender: "Lyra", text: "buying salvage scrap, good rates", time: "18:00" },
    { channel: "system", sender: "", text: "You destroyed Raider Scout (Kestrel)", time: "18:04", logType: "kill" },
    { channel: "system", sender: "", text: "+500 Credits, +2 Honor awarded", time: "18:04", logType: "reward" },
    { channel: "system", sender: "", text: "You destroyed Raider Interceptor", time: "18:07", logType: "kill" },
    { channel: "system", sender: "", text: "+1,200 Credits, Rare Salvage Crate awarded", time: "18:07", logType: "reward" },
    { channel: "system", sender: "", text: "Level up! You are now Level 43", time: "18:09", logType: "info" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--hud-bg-void)",
        overflow: "auto",
      }}
    >
      <div className="hud-iso-grid" />

      <div
        style={{
          position: "fixed",
          left: 24,
          top: 48,
          transform: "scale(0.9)",
          transformOrigin: "top left",
        }}
      >
        <TopPanel
          playerName="Commander_Alex"
          clanName="Starfall Initiative"
          rank={5}
          rankName="Veteran"
          rankColor="var(--hud-gold)"
          level={42}
          exp={28450}
          expToNext={58000}
          credits={1245780}
          honor={1809}
          mcoins={0}
          factionTag="EIC"
          cargo={340}
          cargoMax={500}
        />
      </div>

      <div
        style={{
          position: "fixed",
          right: 24,
          top: 48,
          transform: "scale(0.9)",
          transformOrigin: "top right",
        }}
      >
        <MenuPanel />
      </div>

      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 24,
          transform: "translateX(-50%) scale(0.9)",
          transformOrigin: "bottom center",
        }}
      >
        <Hotbar slots={demoSlots} hull={hull} hullMax={hullMax} shield={shield} shieldMax={shieldMax} />
      </div>

      <div
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          transform: "scale(0.9)",
          transformOrigin: "bottom right",
        }}
      >
        <Minimap zoneName="Alpha Sector" coords="X:4302 Y:-118" blips={demoBlips} />
      </div>

      <div
        style={{
          position: "fixed",
          left: 24,
          bottom: 24,
          transform: "scale(0.9)",
          transformOrigin: "bottom left",
        }}
      >
        <ChatPanel messages={demoMessages} onSend={(ch, text) => console.log("send", ch, text)} />
      </div>

      {/* Dev-only test sliders, not part of the HUD itself */}
      <div
        style={{
          position: "fixed",
          top: 200,
          left: 16,
          background: "rgba(0,0,0,0.8)",
          border: "1px solid #333",
          padding: 12,
          fontFamily: "monospace",
          fontSize: 11,
          color: "#9cf",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 100,
        }}
      >
        <label>
          Hull {hull}/{hullMax}
          <input type="range" min={0} max={hullMax} value={hull} onChange={(e) => setHull(Number(e.target.value))} style={{ width: 200, marginLeft: 8 }} />
        </label>
        <label>
          Shield {shield}/{shieldMax}
          <input type="range" min={0} max={shieldMax} value={shield} onChange={(e) => setShield(Number(e.target.value))} style={{ width: 200, marginLeft: 8 }} />
        </label>
      </div>
    </div>
  );
}
