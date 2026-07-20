import { ResourceBar } from "./ResourceBar";

export type ShieldBarProps = {
  shield: number;
  shieldMax: number;
  regenerating?: boolean;
  boosted?: boolean;
  compact?: boolean;
  mirrored?: boolean;
};

export function ShieldBar({ shield, shieldMax, regenerating, boosted, compact, mirrored }: ShieldBarProps) {
  return (
    <ResourceBar
      label="Shield"
      value={shield}
      max={shieldMax}
      color="var(--hud-shield)"
      criticalThreshold={0.2}
      regenerating={regenerating}
      boosted={boosted}
      compact={compact}
      mirrored={mirrored}
    />
  );
}
