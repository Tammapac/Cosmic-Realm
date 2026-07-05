import React from "react";

interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function GameButton({ children, style, className = "", ...props }: GameButtonProps) {
  return (
    <button
      {...props}
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        cursor: props.disabled ? "not-allowed" : "pointer",
        padding: "6px 14px",
        fontSize: 12,
        color: "var(--text-bright)",
        letterSpacing: "1px",
        textTransform: "uppercase",
        textShadow: "0 0 6px rgba(78,226,255,0.35)",
        whiteSpace: "nowrap",
        transition: "filter 0.15s, transform 0.1s",
        opacity: props.disabled ? 0.4 : 1,
        ...style,
      }}
    >
      <img
        src="/assets/ui/buttons/button-ui.png?v=2"
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
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </button>
  );
}
