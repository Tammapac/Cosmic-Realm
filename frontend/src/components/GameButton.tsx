import React from "react";

interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** gold-trimmed variant for featured/confirm actions */
  gold?: boolean;
}

// Hex-capped pixel button (Buch CC0 sheet, see ASSET_LICENSES.md).
// Hover/active/disabled states are handled by the .gbtn CSS class via
// border-image swaps — no layout shift between states.
export function GameButton({ children, style, className = "", gold, ...props }: GameButtonProps) {
  return (
    <button
      {...props}
      className={`gbtn ${gold ? "gbtn-gold" : ""} ${className}`}
      style={style}
    >
      {children}
    </button>
  );
}
