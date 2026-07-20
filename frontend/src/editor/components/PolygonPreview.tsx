import type { Vec2 } from "../types";

type PolygonPreviewProps = {
  points: Vec2[];
  style: React.CSSProperties;
};

/** Renders a polygon element's fill using the exact same clip-path syntax
 * the real HUD components use (e.g. Hotbar.module.css's angled console
 * cut) -- so a shape built here is visually identical to, and directly
 * portable into, real component CSS. Points are 0..1 fractions, converted
 * to percentages for clip-path. */
export function PolygonPreview({ points, style }: PolygonPreviewProps) {
  const clipPath = `polygon(${points.map((p) => `${p.x * 100}% ${p.y * 100}%`).join(", ")})`;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        clipPath,
        ...style,
      }}
    />
  );
}
