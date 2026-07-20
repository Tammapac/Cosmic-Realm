import { useState } from "react";
import { Hotbar, type HotbarSlotData } from "../../components/hud/Hotbar/Hotbar";
import { PlayerStatus } from "../../components/hud/PlayerStatus/PlayerStatus";
import { HealthBar } from "../../components/hud/PlayerStatus/HealthBar";
import { ShieldBar } from "../../components/hud/PlayerStatus/ShieldBar";
import type { ElementKind } from "../types";

const DEMO_SLOTS: HotbarSlotData[] = [
  { keyLabel: "1", icon: "⚔", state: "normal" },
  { keyLabel: "2", icon: "☄", state: "normal" },
  { keyLabel: "3", icon: "◈", state: "selected" },
  { keyLabel: "4", icon: "⬡", state: "normal", count: 3 },
  { keyLabel: "5", icon: "✦", state: "normal", cooldownFraction: 0.62, cooldownSeconds: 7.4 },
  { keyLabel: "6", icon: "▲", state: "disabled" },
  { keyLabel: "7", state: "locked" },
  { keyLabel: "8", state: "empty" },
  { keyLabel: "9", state: "empty" },
  { keyLabel: "0", state: "empty" },
];

/** Same native size the store hands out as the default box for each real
 * HUD component -- used here to compute the scale() factor when the
 * editor box has been resized away from that native size. Keep in sync
 * with defaultSizeFor() in ../store.ts. */
export const HUD_COMPONENT_NATIVE_SIZE: Partial<Record<ElementKind, { width: number; height: number }>> = {
  "hud-hotbar": { width: 720, height: 150 },
  "hud-player-status": { width: 340, height: 110 },
  "hud-health-bar": { width: 260, height: 48 },
  "hud-shield-bar": { width: 260, height: 48 },
};

type HudComponentPreviewProps = {
  kind: ElementKind;
  boxWidth: number;
  boxHeight: number;
};

/** Renders one of the project's real, already-shipped HUD components
 * (Hotbar, PlayerStatus) with representative mock data, scaled via CSS
 * transform from its native pixel size up/down to whatever box size the
 * editor's resize handles are set to. This keeps the component's own
 * clip-path/gradient math (which is written in fixed px, not %) intact --
 * only the box's outer x/y/width/height/rotation are editable here, per
 * the MVP scope; internal props (slot count, HP value, colors) are not
 * yet wired to the inspector. */
export function HudComponentPreview({ kind, boxWidth, boxHeight }: HudComponentPreviewProps) {
  const [hull] = useState(720);
  const [hullMax] = useState(1000);
  const [shield] = useState(240);
  const [shieldMax] = useState(500);

  const native = HUD_COMPONENT_NATIVE_SIZE[kind];
  if (!native) return null;

  const scaleX = boxWidth / native.width;
  const scaleY = boxHeight / native.height;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: native.width,
          height: native.height,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: "top left",
        }}
      >
        {kind === "hud-hotbar" && (
          <Hotbar slots={DEMO_SLOTS} hull={hull} hullMax={hullMax} shield={shield} shieldMax={shieldMax} />
        )}
        {kind === "hud-player-status" && (
          <PlayerStatus credits={44963} honor={1809} level={28} exp={3200} expToNext={100 * 28 * 28} zoneName="Alpha Sector" />
        )}
        {kind === "hud-health-bar" && <HealthBar hull={hull} hullMax={hullMax} />}
        {kind === "hud-shield-bar" && <ShieldBar shield={shield} shieldMax={shieldMax} />}
      </div>
    </div>
  );
}
