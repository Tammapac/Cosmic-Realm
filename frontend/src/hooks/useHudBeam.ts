// Boot-scan "beam" for every HUD window (design handoff §1).
//
// The handoff's plan was to wire useHudPanel() into ~12 components by hand so
// each panel root would carry `.hud-open`, whose ::after draws the beam. Only
// the inventory ever got it, which is exactly why the inventory was the only
// window with the effect.
//
// Doing it in CSS alone is not possible on this codebase:
//   - `.panel::before`  is already the PCB vein layer   (hud-skin.css)
//   - `.panel::after`   is already the corner-bracket / edge layer
//   - `.panel-rim`      is rendered by only a handful of the 64 `.panel` call
//                       sites — none of the 21 in Hangar.tsx (ammo picker!)
//   - an extra background layer loses to hud-skin.css's `background`
//     shorthand, which is loaded later
// (All four were measured in the running app, not assumed.)
//
// So the beam gets a real element, injected once per panel instead of edited
// into every call site. A MutationObserver catches panels whenever they mount
// — including popups, hotbar item pickers and Hangar tab switches, which is
// where the effect was still missing.

// ONLY the outer window gets the beam.
//
// `.panel-inset` is by definition a nested card, and `.console-sq` is the
// inner plate the Hangar tabs are built from — beaming those made every tab
// switch and every little card flash on its own, which is not the effect.
// The beam should read as "this WINDOW just powered up", once, across the
// whole frame.
const PANEL_SELECTOR = ".panel";

/** A panel inside another panel is a sub-surface, not a window. */
const NESTED_WITHIN = ".panel, .panel-inset, .console-sq";

/** Windows below this size are chips/plates, not pop-ups worth announcing. */
const MIN_BEAM_WIDTH = 220;
const MIN_BEAM_HEIGHT = 120;

/** Marks panels we've already handled so re-renders don't stack beams. */
const DONE = "hudBeamDone";

function addBeam(el: HTMLElement): void {
  if (el.dataset[DONE]) return;
  el.dataset[DONE] = "1";

  // Skip nested panels: only the outermost frame announces itself.
  if (el.parentElement?.closest(NESTED_WITHIN)) return;

  // Skip small always-on plates (hotbar shell, minimap, chips). They are not
  // windows that open, so a boot scan on them is just noise.
  const r = el.getBoundingClientRect();
  if (r.width < MIN_BEAM_WIDTH || r.height < MIN_BEAM_HEIGHT) return;

  // The beam is absolutely positioned, so the panel must be a containing
  // block. Every primitive already sets position:relative, but a stray
  // inline style could override it — cheap to guarantee.
  if (getComputedStyle(el).position === "static") el.style.position = "relative";

  const beam = document.createElement("span");
  beam.className = "hud-beam";
  beam.setAttribute("aria-hidden", "true");
  // Self-removing: the sweep plays once on open. Leaving the node behind
  // would replay it on any future animation change and cost a paint layer.
  beam.addEventListener("animationend", () => beam.remove(), { once: true });
  el.appendChild(beam);
}

let observer: MutationObserver | null = null;

/**
 * Starts injecting beams. Idempotent — safe to call more than once.
 * Returns a teardown for symmetry; the app never unmounts the HUD, so it is
 * mainly there for tests.
 */
export function installHudBeam(): () => void {
  if (observer) return () => {};

  document.querySelectorAll<HTMLElement>(PANEL_SELECTOR).forEach(addBeam);

  observer = new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(PANEL_SELECTOR)) addBeam(node);
        // A panel is usually nested inside the subtree that got added
        // (a popup wrapper, a remounted tab), not the added node itself.
        node.querySelectorAll<HTMLElement>(PANEL_SELECTOR).forEach(addBeam);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer?.disconnect();
    observer = null;
  };
}
