// ─────────────────────────────────────────────────────────────────────────────
// StationTest — isolated harness for the station 3D layer + its door (M9).
//
// Reproduces exactly what the game does to draw a station, without needing a
// login: init the layer, then run the real beginStationFrame → updateStationOnly
// → endStationFrame → renderStation3DLayer cycle against a single station id.
//
// Built because "Helix Station is invisible" cannot be diagnosed from the login
// screen. Anything thrown by the layer is caught and shown on the page rather
// than only reaching the console, since a throw inside updateStationOnly is the
// prime suspect: it would skip renderStation3DLayer() and leave the station's
// canvas empty while the rest of the game carries on as normal.
//
// Open with ?station-test.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import {
  initStation3DLayer,
  setStationCameraZoom,
  beginStationFrame,
  updateStationOnly,
  endStationFrame,
  renderStation3DLayer,
  getStationDoor,
  getStationDoorWorldOffset,
} from "../game/three-station-layer";

const STATION_ID = "helix";

export default function StationTest() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState("booting…");
  const zoomRef = useRef(1);
  const framesRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth || 900;
    const h = mount.clientHeight || 600;

    let canvas: HTMLCanvasElement;
    try {
      canvas = initStation3DLayer(w, h);
    } catch (e) {
      setErr("initStation3DLayer threw: " + String(e));
      return;
    }
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    mount.appendChild(canvas);

    let raf = 0;
    let dead = false;
    let lastInfo = 0;

    const tick = () => {
      if (dead) return;
      try {
        setStationCameraZoom(zoomRef.current);
        beginStationFrame();
        // Camera sits exactly on the station, as it does when the player is
        // docked at Helix (which is at 0,0 in zone alpha).
        updateStationOnly(STATION_ID, 0, 0, 0, 0);
        endStationFrame();
        renderStation3DLayer();
        framesRef.current++;
        // Throttled by TIME, not frame count: the in-app browser pane throttles
        // RAF to ~1 fps, where "every 30 frames" would mean a 30-second wait
        // before the readout says anything at all.
        const now = performance.now();
        if (now - lastInfo > 400) {
          lastInfo = now;
          const door = getStationDoor(STATION_ID);
          // The docking approach aims at this offset, so it has to be non-null
          // and roughly constant — a value that drifts frame to frame means the
          // station is still spinning and the path has nothing to lock onto.
          const off = getStationDoorWorldOffset(STATION_ID);
          setInfo(
            `frames ${framesRef.current} · zoom ${zoomRef.current.toFixed(2)} · ` +
            `door ${door ? door.doorMode : "—"} · ` +
            `mouth ${off ? `x ${off.x.toFixed(0)} y ${off.y.toFixed(0)}` : "unknown"}`,
          );
        }
      } catch (e) {
        dead = true;
        // This is the interesting failure: it means the real renderer would
        // never reach renderStation3DLayer() either.
        setErr(
          "THREW on frame " + framesRef.current + ":\n" +
          (e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ""}` : String(e)),
        );
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      canvas.remove();
    };
  }, []);

  const door = () => getStationDoor(STATION_ID);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#070b14", color: "#cfe3ff", fontFamily: "monospace" }}>
      <div style={{ padding: "10px 14px" }}>
        <strong>Station Layer Test (M9)</strong>
        <div style={{ fontSize: 12, opacity: 0.8 }}>station: {STATION_ID} · {info}</div>
        {err && (
          <pre style={{ color: "#ff8080", fontSize: 12, whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>
            {err}
          </pre>
        )}
      </div>
      <div ref={mountRef} style={{ position: "absolute", inset: "70px 0 60px 0" }} />
      <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", gap: 8 }}>
        <button style={{ fontWeight: "bold" }} onClick={() => void door()?.open()}>OPEN</button>
        <button onClick={() => void door()?.close()}>CLOSE</button>
        <button onClick={() => { zoomRef.current = Math.max(0.35, zoomRef.current - 0.25); }}>zoom −</button>
        <button onClick={() => { zoomRef.current = Math.min(2.5, zoomRef.current + 0.25); }}>zoom +</button>
      </div>
    </div>
  );
}
