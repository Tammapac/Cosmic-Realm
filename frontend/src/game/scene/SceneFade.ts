// ─────────────────────────────────────────────────────────────────────────────
// SceneFade — the blackout that hides the world swap between space and hangar
// (M6).
//
// Deliberately NOT driven by a tick. The sim loop is gated on
// `!state.paused && !state.dockedAt` (loop.ts:994), so the moment the dock is
// committed tickWorld stops — and with it sceneManager.update(). A fade driven
// from there would freeze halfway through the blackout, on a black screen. So
// this uses a CSS opacity transition instead: the browser's compositor runs it
// whether or not the game is ticking, and it adds no second RAF loop.
//
// One <div>, created lazily on first use. Nothing exists in the DOM while
// ENABLE_NEW_DOCKING_FLOW is off, because nothing imports this module then.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * If the screen is still black this long after a fade-out, something in the
 * loading sequence died without ever calling toClear(). A stuck black screen is
 * an unrecoverable, game-over-looking failure, so clear it unconditionally and
 * shout about it — a visible glitch beats a bricked session.
 */
const BLACKOUT_WATCHDOG_MS = 8000;

/** Above everything. The HUD tops out far below this. */
const Z_INDEX = 9_999_999;

export class SceneFade {
  private el: HTMLDivElement | null = null;
  private host: HTMLElement | null = null;
  private target = 0;
  private pending: Promise<void> | null = null;
  private run = 0;
  private watchdog = 0;

  /**
   * Render the overlay inside `host` instead of covering the whole window.
   * Only used by the ?dock-test harness, so the blackout can be watched in a
   * box next to the diagnostics instead of blanking them. The host needs a
   * non-static position.
   */
  attachTo(host: HTMLElement | null): void {
    this.host = host;
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  private ensure(): HTMLDivElement {
    if (this.el?.isConnected) return this.el;
    const host = this.host ?? document.body;
    const el = document.createElement("div");
    el.dataset.sceneFade = "";
    el.style.cssText = [
      `position:${host === document.body ? "fixed" : "absolute"}`,
      "inset:0",
      "background:#000",
      "opacity:0",
      // Controls are already locked via isControlLocked(); swallowing pointer
      // events here would only break HUD hover states behind a clear overlay.
      "pointer-events:none",
      `z-index:${Z_INDEX}`,
    ].join(";");
    host.appendChild(el);
    this.el = el;
    return el;
  }

  private to(opacity: number, ms: number): Promise<void> {
    const el = this.ensure();
    // Already heading there — hand back the same promise rather than
    // restarting the transition and stuttering the fade.
    if (this.target === opacity) return this.pending ?? Promise.resolve();

    this.target = opacity;
    el.style.transition = `opacity ${ms}ms linear`;
    // Force a style flush, or setting opacity in the same frame the element was
    // created jumps straight to the target with no transition at all.
    void el.offsetHeight;
    el.style.opacity = String(opacity);

    const my = ++this.run;
    // transitionend is unreliable when the element is in a hidden tab or the
    // transition is interrupted, and a fade that never resolves would wedge the
    // docking sequence. A timer is the honest primitive here.
    this.pending = new Promise<void>((resolve) => {
      window.setTimeout(() => {
        if (this.run === my) this.pending = null;
        resolve();
      }, ms + 30);
    });
    return this.pending;
  }

  /** Fade to black. Resolves when the screen is fully covered. */
  toBlack(ms: number): Promise<void> {
    window.clearTimeout(this.watchdog);
    this.watchdog = window.setTimeout(() => {
      if (this.target !== 1) return;
      console.error("[SceneFade] still black after", BLACKOUT_WATCHDOG_MS, "ms — force-clearing");
      this.clearNow();
    }, BLACKOUT_WATCHDOG_MS);
    return this.to(1, ms);
  }

  /** Fade back to the world. */
  toClear(ms: number): Promise<void> {
    window.clearTimeout(this.watchdog);
    this.watchdog = 0;
    return this.to(0, ms);
  }

  /** Drop the blackout instantly — cancels, errors, and hard resets. */
  clearNow(): void {
    window.clearTimeout(this.watchdog);
    this.watchdog = 0;
    this.run++;
    this.pending = null;
    this.target = 0;
    if (!this.el) return;
    this.el.style.transition = "none";
    this.el.style.opacity = "0";
  }

  /** Current blackout coverage, 0..1 — for diagnostics/HUD debug only. */
  get opacity(): number {
    if (!this.el) return 0;
    const v = Number(getComputedStyle(this.el).opacity);
    return Number.isFinite(v) ? v : this.target;
  }

  /** True once a fade-out has been requested and not yet cleared. */
  get isBlack(): boolean {
    return this.target === 1;
  }
}

/** Shared instance — there is only ever one screen to black out. */
export const sceneFade = new SceneFade();
