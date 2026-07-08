import React from "react";

interface TopPanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// Shared HUD chip: pixel-art 9-slice frame (Buch CC0, see ASSET_LICENSES.md).
// The frame is drawn by the .hud-chip CSS class as a layout-safe overlay.
export function TopPanel({ children, style, className = "" }: TopPanelProps) {
  return (
    <div className={"pointer-events-auto hud-chip " + className} style={style}>
      <div style={{ position: "relative", zIndex: 1, height: "100%" }}>{children}</div>
    </div>
  );
}
