import { useEffect } from "react";

// Global styled tooltip: upgrades every native `title` attribute in the app
// into the game's black/orange corner-tick container. On hover the title is
// captured and suppressed (so the browser tooltip never shows) and a fixed
// positioned styled box follows the cursor instead. The title attribute is
// restored on mouse-out, so React keeps owning its value.
export function GameTooltip() {
  useEffect(() => {
    const tip = document.createElement("div");
    tip.className = "gtip";
    tip.style.display = "none";
    document.body.appendChild(tip);

    let curEl: HTMLElement | null = null;

    const hide = () => {
      tip.style.display = "none";
    };

    const restore = () => {
      if (curEl) {
        const saved = curEl.dataset.gtipSaved;
        if (saved !== undefined) {
          curEl.setAttribute("title", saved);
          delete curEl.dataset.gtipSaved;
        }
        curEl = null;
      }
    };

    const position = (x: number, y: number) => {
      const pad = 14;
      const r = tip.getBoundingClientRect();
      let px = x + pad;
      let py = y + pad;
      if (px + r.width > window.innerWidth - 6) px = x - r.width - pad;
      if (py + r.height > window.innerHeight - 6) py = y - r.height - pad;
      tip.style.left = Math.max(4, px) + "px";
      tip.style.top = Math.max(4, py) + "px";
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest) return;
      const el = target.closest("[title]") as HTMLElement | null;
      const text = el?.getAttribute("title");
      if (el && text) {
        if (curEl && curEl !== el) restore();
        curEl = el;
        el.dataset.gtipSaved = text;
        el.setAttribute("title", "");
        tip.textContent = text;
        tip.style.display = "block";
        position(e.clientX, e.clientY);
      }
    };

    const onMove = (e: MouseEvent) => {
      if (tip.style.display !== "none") position(e.clientX, e.clientY);
    };

    const onOut = (e: MouseEvent) => {
      if (curEl && !(e.relatedTarget instanceof Node && curEl.contains(e.relatedTarget))) {
        restore();
        hide();
      }
    };

    const onDown = () => {
      // clicking usually changes state — drop the tooltip to avoid stale text
      restore();
      hide();
    };

    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseout", onOut, true);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseout", onOut, true);
      document.removeEventListener("mousedown", onDown, true);
      tip.remove();
    };
  }, []);

  return null;
}
