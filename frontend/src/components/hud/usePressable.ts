// Reproduces the Kit source's style-hover/style-active runtime directive
// (support.js applies a hover/active style override per element) as plain
// React state + inline-style merging, since that directive doesn't exist
// outside the Design preview runtime.
import { useState } from "react";

export function usePressable() {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => { setHover(false); setActive(false); },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
  };
  return { hover, active, handlers };
}
