// Base class for every native PixiJS UI component. Owns the container, the
// shared state machine, and the per-frame update hook. Components extend this
// and implement redraw() for their own geometry.
//
// The state set is the one the brief requires; not every component uses all of
// them, but they share the vocabulary so transitions look consistent.
import * as PIXI from "pixi.js";

export type UiState =
  | "idle" | "hover" | "pressed" | "active"
  | "selected" | "disabled" | "warning" | "opening" | "closing";

export abstract class UiComponent {
  readonly container: PIXI.Container;
  protected state: UiState = "idle";
  /** 0..1 eased value tracking the current transition (opening/closing/hover). */
  protected anim = 0;
  /** wall-clock seconds since mount, for ambient shader time. */
  protected clock = 0;
  private destroyed = false;

  constructor(name: string) {
    this.container = new PIXI.Container();
    this.container.name = name;
  }

  /** Move to a new state. redraw() is called so the change is immediate. */
  setState(next: UiState): void {
    if (this.state === next || this.destroyed) return;
    this.state = next;
    this.onStateChange(next);
    this.redraw();
  }

  getState(): UiState {
    return this.state;
  }

  /** Per-frame; advances the clock + eases the transition, then redraws. */
  update(dt: number): void {
    if (this.destroyed) return;
    this.clock += dt;
    // ease `anim` toward 1 while opening/hover/active, toward 0 otherwise
    const target =
      this.state === "opening" || this.state === "hover" ||
      this.state === "active" || this.state === "selected" || this.state === "pressed"
        ? 1 : 0;
    const speed = this.state === "closing" ? 6 : 8;
    this.anim += (target - this.anim) * Math.min(1, dt * speed);
    this.tick(dt);
    this.redraw();
  }

  /** Subclasses draw their geometry from state/anim/clock. */
  protected abstract redraw(): void;

  /** Optional per-frame logic beyond the shared easing (e.g. shader uniforms). */
  protected tick(_dt: number): void {}

  /** Optional hook when the state changes (e.g. swap a filter). */
  protected onStateChange(_next: UiState): void {}

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.container.destroy({ children: true });
  }
}
