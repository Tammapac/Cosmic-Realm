import { useEffect, useRef, useState } from "react";

/**
 * Open/close choreography for HUD windows (see styles/hud/hud-motion.css).
 *
 * Keeps a panel mounted for the length of its exit animation, so closing a
 * window plays out instead of vanishing. Returns the class the panel root
 * should carry plus whether it should render at all:
 *
 *   const { mounted, className } = useHudPanel(isOpen);
 *   if (!mounted) return null;
 *   return <div className={`panel ${className}`}> … </div>;
 *
 * The panel root needs `position: relative` and `overflow: hidden`, or the
 * boot-scan sweep runs past its edge.
 *
 * Note on the deps: the handoff's template listed `mounted` as a dependency,
 * which re-fires the effect the moment the close timer clears it and can
 * restart the exit. The mounted state is read through a ref here instead, so
 * the effect depends only on what actually drives it (`open`).
 */
export function useHudPanel(open: boolean, exitMs = 240) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const mountedRef = useRef(open);
  mountedRef.current = mounted;

  useEffect(() => {
    if (open) {
      setClosing(false);
      setMounted(true);
      return;
    }
    if (!mountedRef.current) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted, className: closing ? "hud-close" : "hud-open" };
}
