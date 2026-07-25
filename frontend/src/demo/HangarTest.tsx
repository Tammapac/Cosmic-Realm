// ─────────────────────────────────────────────────────────────────────────────
// HangarTest — isolated harness for HangarScene (the 3D docking payoff).
// Open with ?hangar-test.
//
// Builds a real HangarScene (own perspective camera, cloned station interior +
// door, a parked player ship) with no login and no docking flow, and exposes
// buttons to drive preload / intro / parked / outro. Proves the interior renders,
// the ship parks on the pad, the door animates, and the fly-in is correctly
// occluded by the station roof — all before wiring it into the state machine.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { HangarScene } from "../game/scene/HangarScene";

const SHIP_CLASSES = ["skimmer", "apex", "leviathan", "vanguard"];

export default function HangarTest() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HangarScene | null>(null);
  const [status, setStatus] = useState("booting…");
  const [shipClass, setShipClass] = useState("skimmer");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let dead = false;

    setStatus("loading GLBs…");
    HangarScene.preload(shipClass)
      .then((hs) => {
        if (dead) { hs.dispose(); return; }
        sceneRef.current = hs;
        hs.show(mount);
        hs.showParked();
        setStatus("ready — parked");
        // Expose for console poking.
        (window as never as Record<string, unknown>).__hangar = hs;
      })
      .catch((e) => setStatus("preload failed: " + String(e)));

    return () => {
      dead = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      delete (window as never as Record<string, unknown>).__hangar;
    };
  }, [shipClass]);

  const run = (label: string, fn: () => Promise<void> | void) => {
    if (busy) return;
    setBusy(true);
    setStatus(label + "…");
    void Promise.resolve(fn()).then(() => {
      setStatus(label + " done");
      setBusy(false);
    });
  };

  const hs = () => sceneRef.current;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#05070d", color: "#cfe3ff", fontFamily: "monospace" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: "0 0 64px 0" }} />
      <div style={{ position: "absolute", top: 10, left: 14, fontSize: 12, textShadow: "0 1px 2px #000" }}>
        <strong>Hangar Scene Test</strong> · {status}
      </div>
      <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", gap: 8, alignItems: "center" }}>
        <button disabled={busy} onClick={() => run("intro", () => hs()?.playIntro())} style={{ fontWeight: "bold" }}>▶ FLY IN</button>
        <button disabled={busy} onClick={() => run("parked", () => hs()?.showParked())}>PARKED</button>
        <button disabled={busy} onClick={() => run("outro", () => hs()?.playOutro())}>◀ FLY OUT</button>
        <select value={shipClass} onChange={(e) => setShipClass(e.target.value)} style={{ marginLeft: 12 }}>
          {SHIP_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  );
}
