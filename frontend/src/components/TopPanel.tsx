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
