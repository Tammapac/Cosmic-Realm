// ⚠ THIS IS NOT THE GAME'S TOP PANEL.
//
// Despite the name, this is a small generic console-plate wrapper (amber
// `.console-sq` corners) used only by SocialPanel.tsx. The HUD bar the player
// actually sees at the top of the screen is:
//
//     components/hud/TopPanel/TopPanel.tsx   (+ TopPanel.module.css)
//
// rendered via components/hud/GameHud.tsx. Read that one when working on the
// real top panel. Kept under this name because SocialPanel imports it; it is
// misnamed, not dead. See the duplicate-names box in CLAUDE.md §7.
import React from "react";

interface TopPanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

// Square command console plate with amber corner accents (.console-sq).
export function TopPanel({ children, style, className = "" }: TopPanelProps) {
  return (
    <div className={"pointer-events-auto console-sq " + className} style={style}>
      <span className="console-corner tl" aria-hidden />
      <span className="console-corner tr" aria-hidden />
      <span className="console-corner bl" aria-hidden />
      <span className="console-corner br" aria-hidden />
      <div style={{ position: "relative", zIndex: 1, height: "100%" }}>{children}</div>
    </div>
  );
}
