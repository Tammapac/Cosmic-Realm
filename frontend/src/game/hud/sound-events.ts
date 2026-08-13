// sound-events.ts — Sound-Event-Vertrag (Vorbereitung, keine Audiodateien).
//
// Emittiert nur benannte Events; Wiring an echte Audiodateien folgt später
// (z.B. SoundBus.on("hover", () => audio.play("ui-hover.wav"))).

export type SoundEventName = "hover" | "press" | "select" | "equip" | "error";

type Listener = (name: SoundEventName) => void;
const listeners = new Set<Listener>();

export const SoundBus = {
  emit(name: SoundEventName): void {
    listeners.forEach((l) => l(name));
  },
  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const PREFERS_REDUCED_MOTION =
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
