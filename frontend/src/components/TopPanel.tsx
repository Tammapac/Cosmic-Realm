import React from "react";

interface TopPanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function TopPanel({ children, style, className = "" }: TopPanelProps) {
  return (
    <div
      className={"pointer-events-auto " + className}
      style={{
        position: "relative",
        background: "transparent",
        border: "none",
        boxShadow: "none",
        ...style,
      }}
    >
      <img
        src="/assets/ui/panels/toolbar-small.png?v=2"
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1, height: "100%" }}>{children}</div>
    </div>
  );
}
