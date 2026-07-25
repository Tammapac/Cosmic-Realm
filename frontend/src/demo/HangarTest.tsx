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
import * as THREE from "three";
import { HangarScene, type HangarDebugInfo } from "../game/scene/HangarScene";

const SHIP_CLASSES = ["skimmer", "apex", "leviathan", "vanguard"];

// Tone-mapping A/B (Phase D). Blender 4.x Material Preview uses AgX; ACESFilmic
// is the old default; Neutral (Khronos) is the third candidate. Each carries a
// starting exposure — AgX renders darker so it wants a hair more.
const TONE_MODES: { label: string; mode: THREE.ToneMapping; exposure: number }[] = [
  { label: "AgX", mode: THREE.AgXToneMapping, exposure: 1.35 },
  { label: "ACES", mode: THREE.ACESFilmicToneMapping, exposure: 1.0 },
  { label: "Neutral", mode: THREE.NeutralToneMapping, exposure: 1.0 },
];

export default function HangarTest() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HangarScene | null>(null);
  const [status, setStatus] = useState("booting…");
  const [shipClass, setShipClass] = useState("skimmer");
  const [envKind, setEnvKind] = useState<"studio" | "hdr">("studio");
  const [tone, setTone] = useState("AgX");
  const [exposure, setExposure] = useState(1.35);
  const [busy, setBusy] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [dbg, setDbg] = useState<HangarDebugInfo | null>(null);
  const [combatDemo, setCombatDemo] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let dead = false;

    // Env A/B (Phase B): set before preload so the scene builds with this IBL.
    HangarScene.envKind = envKind;

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
  }, [shipClass, envKind]);

  // Live tone-mapping A/B — apply on change without rebuilding the scene.
  useEffect(() => {
    const hs = sceneRef.current;
    if (!hs) return;
    const t = TONE_MODES.find((m) => m.label === tone) ?? TONE_MODES[0];
    hs.setToneMapping(t.mode, exposure);
  }, [tone, exposure, status]);

  // Poll the renderer debug info ~2×/s while the panel is open (Phase F).
  useEffect(() => {
    if (!showDebug) return;
    const id = window.setInterval(() => {
      const hs = sceneRef.current;
      if (hs) setDbg(hs.getDebugInfo());
    }, 500);
    return () => window.clearInterval(id);
  }, [showDebug]);

  // Combat-light demo toggle (Phase G).
  useEffect(() => {
    const hs = sceneRef.current;
    if (!hs) return;
    hs.toggleCombatDemo(combatDemo);
    return () => hs.toggleCombatDemo(false);
  }, [combatDemo, status]);

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
      <div style={{ position: "fixed", top: 10, left: 14, fontSize: 12, textShadow: "0 1px 2px #000", zIndex: 10 }}>
        <strong>Hangar Scene Test</strong> · {status}
        <button onClick={() => setShowDebug((v) => !v)} style={{ marginLeft: 12, fontSize: 11 }}>
          {showDebug ? "hide" : "show"} debug
        </button>
      </div>

      {showDebug && dbg && (
        <div
          style={{
            position: "fixed", top: 40, right: 12, width: 320, maxHeight: "calc(100% - 90px)",
            overflowY: "auto", background: "rgba(6,10,20,0.86)", border: "1px solid #234",
            borderRadius: 6, padding: "10px 12px", fontSize: 11, lineHeight: 1.5,
            color: "#bfe0ff", pointerEvents: "auto", zIndex: 10,
          }}
        >
          <div style={{ fontWeight: "bold", color: "#7fd0ff", marginBottom: 4 }}>RENDERER</div>
          <div>draw calls: <b>{dbg.renderer.drawCalls}</b> · tris: <b>{dbg.renderer.triangles.toLocaleString()}</b></div>
          <div>textures: <b>{dbg.renderer.textures}</b> · geoms: <b>{dbg.renderer.geometries}</b> · programs: <b>{dbg.renderer.programs}</b></div>

          <div style={{ fontWeight: "bold", color: "#7fd0ff", margin: "8px 0 4px" }}>ENV / IBL</div>
          <div>PMREM: <b style={{ color: dbg.env.pmremActive ? "#7fff9f" : "#ff7f7f" }}>{dbg.env.pmremActive ? "active" : "off"}</b> · scene.environment: <b style={{ color: dbg.env.environmentInstalled ? "#7fff9f" : "#ff7f7f" }}>{dbg.env.environmentInstalled ? "set" : "none"}</b></div>
          <div>kind: <b>{dbg.env.envKind}</b> · intensity: <b>{dbg.env.envIntensity}</b></div>

          <div style={{ fontWeight: "bold", color: "#7fd0ff", margin: "8px 0 4px" }}>TONE MAPPING</div>
          <div>mode: <b>{dbg.tone.mode}</b> · exposure: <b>{dbg.tone.exposure}</b></div>
          <div>output: <b>{dbg.tone.outputColorSpace}</b></div>

          <div style={{ fontWeight: "bold", color: "#7fd0ff", margin: "8px 0 4px" }}>LIGHTS</div>
          <div>dir <b>{dbg.lights.directional}</b> · point <b>{dbg.lights.point}</b> · spot <b>{dbg.lights.spot}</b> · hemi <b>{dbg.lights.hemisphere}</b> · amb <b>{dbg.lights.ambient}</b></div>
          <div>combat lights lit: <b style={{ color: dbg.combatLightsActive ? "#ff9060" : "#8ab" }}>{dbg.combatLightsActive}</b></div>

          <div style={{ fontWeight: "bold", color: "#7fd0ff", margin: "8px 0 4px" }}>MATERIALS ({dbg.materials.length})</div>
          {dbg.materials.map((m, i) => (
            <div key={i} style={{ borderTop: "1px solid #1a2838", paddingTop: 3, marginTop: 3 }}>
              <div style={{ color: "#dfe" }}>{m.name} <span style={{ opacity: 0.6 }}>({m.type})</span></div>
              <div style={{ opacity: 0.85 }}>metal {m.metalness} · rough {m.roughness} · envI {m.envMapIntensity}</div>
              <div style={{ opacity: 0.7 }}>maps: {m.maps.length ? m.maps.join(", ") : "—"}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: "fixed", bottom: 12, left: 14, display: "flex", gap: 8, alignItems: "center", zIndex: 10, flexWrap: "wrap", maxWidth: "calc(100% - 28px)" }}>
        <button disabled={busy} onClick={() => run("intro", () => hs()?.playIntro())} style={{ fontWeight: "bold" }}>▶ FLY IN</button>
        <button disabled={busy} onClick={() => run("parked", () => hs()?.showParked())}>PARKED</button>
        <button disabled={busy} onClick={() => run("outro", () => hs()?.playOutro())}>◀ FLY OUT</button>
        <button
          onClick={() => setCombatDemo((v) => !v)}
          style={{ marginLeft: 8, color: combatDemo ? "#ff9060" : undefined, fontWeight: combatDemo ? "bold" : undefined }}
        >
          {combatDemo ? "⏹ STOP FX" : "⚡ COMBAT FX"}
        </button>
        <select value={shipClass} onChange={(e) => setShipClass(e.target.value)} style={{ marginLeft: 12 }}>
          {SHIP_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ marginLeft: 12 }}>env:</label>
        <select value={envKind} onChange={(e) => setEnvKind(e.target.value as "studio" | "hdr")}>
          <option value="studio">studio (procedural)</option>
          <option value="hdr">space HDRI</option>
        </select>
        <label style={{ marginLeft: 12 }}>tone:</label>
        <select
          value={tone}
          onChange={(e) => {
            const t = TONE_MODES.find((m) => m.label === e.target.value)!;
            setTone(t.label);
            setExposure(t.exposure); // reset to that mode's calibrated default
          }}
        >
          {TONE_MODES.map((m) => <option key={m.label} value={m.label}>{m.label}</option>)}
        </select>
        <label style={{ marginLeft: 8 }}>exp {exposure.toFixed(2)}</label>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={exposure}
          onChange={(e) => setExposure(parseFloat(e.target.value))}
          style={{ width: 120 }}
        />
      </div>
    </div>
  );
}
