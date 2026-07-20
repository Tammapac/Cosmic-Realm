import { ResourceBar } from "./ResourceBar";

export type HealthBarProps = {
  hull: number;
  hullMax: number;
  regenerating?: boolean;
  compact?: boolean;
};

export function HealthBar({ hull, hullMax, regenerating, compact }: HealthBarProps) {
  return (
    <ResourceBar
      label="Hull"
      value={hull}
      max={hullMax}
      color="var(--hud-hp)"
      lowColor="var(--hud-hp-low)"
      criticalThreshold={0.25}
      regenerating={regenerating}
      compact={compact}
    />
  );
}
