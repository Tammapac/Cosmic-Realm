// ─────────────────────────────────────────────────────────────────────────────
// GameSceneManager — the single authoritative scene state machine for the
// isolated docking flow.
//
// This is Milestone 1: the machine itself + transition plumbing. It does NOT
// touch the renderer, the sim loop, movement, networking or the HUD yet.
// Nothing here runs unless ENABLE_NEW_DOCKING_FLOW is true.
//
// Design constraints (from the audited architecture):
//   - There is ONE master render loop (App.tsx → pixiRender). This manager MUST
//     NOT start its own requestAnimationFrame. Its update() is meant to be
//     pumped from an existing loop, or left unpumped until a milestone needs it.
//   - "docked" today is the scattered boolean state.dockedAt. This machine is
//     the future consolidation point, but during early milestones it only mirrors
//     / observes — it does not yet own dockedAt.
// ─────────────────────────────────────────────────────────────────────────────

export enum GameState {
  BOOT = "BOOT",
  LOGIN = "LOGIN",
  SPACE = "SPACE",
  DOCKING = "DOCKING",
  HANGAR_LOADING = "HANGAR_LOADING",
  HANGAR = "HANGAR",
  UNDOCKING = "UNDOCKING",
}

/** Context passed into a transition (station id, entry point, etc.). */
export interface SceneContext {
  stationId?: string | null;
  reason?: string;
  [key: string]: unknown;
}

/** A scene state's lifecycle hooks. All optional. */
export interface SceneHandler {
  enter?(ctx: SceneContext, prev: GameState): void | Promise<void>;
  update?(dt: number): void;
  exit?(next: GameState): void | Promise<void>;
  dispose?(): void;
}

/** Which transitions are allowed. Anything not listed is rejected + logged. */
const ALLOWED: Record<GameState, GameState[]> = {
  [GameState.BOOT]: [GameState.LOGIN, GameState.SPACE, GameState.HANGAR],
  [GameState.LOGIN]: [GameState.SPACE, GameState.HANGAR],
  [GameState.SPACE]: [GameState.DOCKING, GameState.LOGIN],
  [GameState.DOCKING]: [GameState.HANGAR_LOADING, GameState.SPACE /* cancel */],
  [GameState.HANGAR_LOADING]: [GameState.HANGAR, GameState.SPACE /* failure */],
  [GameState.HANGAR]: [GameState.UNDOCKING, GameState.LOGIN],
  [GameState.UNDOCKING]: [GameState.SPACE, GameState.HANGAR /* cancel */],
};

export class GameSceneManager {
  private current: GameState = GameState.BOOT;
  private handlers = new Map<GameState, SceneHandler>();
  private transitioning = false;
  private listeners = new Set<(s: GameState, ctx: SceneContext) => void>();

  get state(): GameState {
    return this.current;
  }

  get isTransitioning(): boolean {
    return this.transitioning;
  }

  register(state: GameState, handler: SceneHandler): void {
    this.handlers.set(state, handler);
  }

  onChange(fn: (s: GameState, ctx: SceneContext) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Request a transition. Returns true if it started, false if rejected.
   * Rejections (illegal transition, already transitioning) are logged, never thrown —
   * a rejected docking request must never crash the game.
   */
  async transitionTo(next: GameState, ctx: SceneContext = {}): Promise<boolean> {
    if (this.transitioning) {
      console.warn(`[SceneManager] transition to ${next} rejected: already transitioning (from ${this.current})`);
      return false;
    }
    if (next === this.current) {
      console.warn(`[SceneManager] transition to ${next} ignored: already in that state`);
      return false;
    }
    const allowed = ALLOWED[this.current] ?? [];
    if (!allowed.includes(next)) {
      console.error(`[SceneManager] ILLEGAL transition ${this.current} → ${next} rejected. Allowed: [${allowed.join(", ")}]`);
      return false;
    }

    this.transitioning = true;
    const prev = this.current;
    try {
      await this.handlers.get(prev)?.exit?.(next);
      this.current = next;
      await this.handlers.get(next)?.enter?.(ctx, prev);
      for (const fn of this.listeners) {
        try { fn(next, ctx); } catch (e) { console.error("[SceneManager] listener error", e); }
      }
      console.log(`[SceneManager] ${prev} → ${next}`, ctx);
      return true;
    } catch (e) {
      // A transition threw. Roll back to a safe state (SPACE) rather than leaving
      // the machine wedged mid-transition with a black screen.
      console.error(`[SceneManager] transition ${prev} → ${next} FAILED, recovering to SPACE`, e);
      this.current = GameState.SPACE;
      return false;
    } finally {
      this.transitioning = false;
    }
  }

  /** Force the machine into a state without running exit/enter — boot-time only. */
  forceState(state: GameState): void {
    this.current = state;
  }

  update(dt: number): void {
    if (this.transitioning) return;
    this.handlers.get(this.current)?.update?.(dt);
  }

  dispose(): void {
    for (const h of this.handlers.values()) h.dispose?.();
    this.handlers.clear();
    this.listeners.clear();
  }
}

// Single shared instance. Import this where the flag-gated wiring lives.
export const sceneManager = new GameSceneManager();
