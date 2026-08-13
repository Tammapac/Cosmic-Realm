// Isolated visual test harness for the M4/M5 docking approach. Open with ?dock-test.
//
// This drives the REAL modules — sceneManager, installDockingScene/requestDock
// from DockingController, dockingCamera from DockingCameraController, and
// buildDockingApproach from DockingPath — against the real store. Only the
// world around them is faked, so what you see is the code path the game runs.
//
// Two views:
//   • Overview  — top-down map. Planned path vs. actually flown path, plus the
//                 camera pivot's own track.
//   • Camera    — the same scene through the real camera transform
//                 (pivot = ship + state.cameraOffset, scale = state.cameraZoom),
//                 which is exactly what pixi-renderer applies to worldLayer.
//                 This is where the M5 camera move is actually visible.
//
// It also reproduces the tick ORDERING question M4 turns on: a decoy "server
// smoothing" step drags the ship toward a bogus server position every frame,
// exactly like applyServerSmoothing(). With the cinematic pumped last (as in
// loop.ts) the flown path must still match the plan.
//
// Completely separate from the game — no login, no backend, no Pixi, no Three.

import { useEffect, useRef, useState } from "react";
import { state } from "../game/store";
import { STATIONS } from "../game/types";
import { sceneManager, GameState } from "../game/scene/GameSceneManager";
import { installDockingScene, requestDock, requestUndock, forceUndock, dockingProgress, bootIntoStoredLocation } from "../game/scene/DockingController";
import { buildDockingApproach, buildUndockDeparture } from "../game/scene/DockingPath";
import { sceneFade } from "../game/scene/SceneFade";
import { loadLocation } from "../game/scene/DockingPersistence";

/** World units across the overview canvas. */
const VIEW_SPAN = 900;
/** The dock prompt in App.tsx appears inside this radius. */
const DOCK_PROMPT_RANGE = 300;

const OVER_W = 520, OVER_H = 520;
const CAM_W = 520, CAM_H = 300;

interface Pt { x: number; y: number }

export default function DockTest() {
  const overRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<HTMLCanvasElement>(null);
  const fadeHostRef = useRef<HTMLDivElement>(null);

  const [startDist, setStartDist] = useState(260);
  const [fightSmoothing, setFightSmoothing] = useState(true);
  const [loop, setLoop] = useState(true);
  const [ui, setUi] = useState({
    scene: "—", progress: 0, speed: 0, elapsed: 0,
    zoom: 1, ox: 0, oy: 0, pOff: 0, pZoom: 0, docked: "null", fade: 0,
    commitFade: null as number | null,
  });
  const [pathLen, setPathLen] = useState(0);
  /** Result of the last simulated reload (M8). */
  const [reload, setReload] = useState<{ stored: string; restored: boolean; scene: string } | null>(null);

  const cfg = useRef({ startDist, fightSmoothing, loop });
  cfg.current = { startDist, fightSmoothing, loop };

  const trail = useRef<Pt[]>([]);
  const camTrail = useRef<Pt[]>([]);
  const peak = useRef({ off: 0, zoom: 0 });
  /**
   * The M6 claim, measured rather than asserted: how black the screen was at
   * the exact frame dockedAt flipped. If the world swap is properly hidden this
   * reads 1.00 — anything lower means the player saw the switch happen.
   */
  const commitFade = useRef<number | null>(null);
  const wasDocked = useRef<string | null>(null);
  const runStart = useRef(0);
  const plan = useRef<Pt[]>([]);
  const planOut = useRef<Pt[]>([]);
  const relaunchAt = useRef(0);

  const station = STATIONS[0];

  /** Park the ship at its start position, drifting sideways, camera released. */
  function reset() {
    const d = cfg.current.startDist;
    state.dockedAt = null;
    state.player.pos.x = station.pos.x - d;
    state.player.pos.y = station.pos.y;
    state.player.vel.x = 40;
    state.player.vel.y = 90; // drifting "down" — the curve should sweep that way
    state.player.angle = 0;
    state.cameraTarget.x = state.player.pos.x;
    state.cameraTarget.y = state.player.pos.y;
    trail.current = [];
    camTrail.current = [];
    peak.current = { off: 0, zoom: 0 };
    commitFade.current = null;
    wasDocked.current = null;
    runStart.current = 0;
    // The hard reset, not the animated one — a reset must not fly a departure.
    forceUndock("harness reset");
    sceneManager.forceState(GameState.SPACE);

    // Preview the curve the controller is about to build, same builder.
    const p = buildDockingApproach(state.player.pos, state.player.vel, station.pos);
    setPathLen(p.length);
    const pts: Pt[] = [];
    for (let i = 0; i <= 120; i++) pts.push(p.pointAt(i / 120));
    plan.current = pts;

    // The departure (M7) is deterministic from the station alone, so it can be
    // previewed up front rather than only once the player leaves.
    const out = buildUndockDeparture(station.pos);
    const outPts: Pt[] = [];
    for (let i = 0; i <= 80; i++) outPts.push(out.pointAt(i / 80));
    planOut.current = outPts;
  }

  /**
   * M8: what a page reload does, without actually reloading (which would take
   * the harness with it).
   *
   * A real reload re-imports store.ts — so `dockedAt` starts null and the scene
   * manager starts in BOOT — and the server hands the position back from the DB,
   * which is the station itself because commitDock() saved it there. This
   * reproduces exactly that starting point and then lets the real
   * bootIntoStoredLocation() make the call, so what is being tested is the
   * shipping code path, not a harness imitation of it.
   */
  function simulateReload() {
    setLoop(false);
    const stored = loadLocation();
    state.dockedAt = null;
    state.cameraOffset.x = 0;
    state.cameraOffset.y = 0;
    sceneFade.clearNow();
    sceneManager.forceState(GameState.BOOT);
    if (stored?.type === "STATION") {
      const st = STATIONS.find((s) => s.id === stored.stationId);
      if (st) { state.player.pos.x = st.pos.x; state.player.pos.y = st.pos.y; }
    }
    trail.current = [];
    camTrail.current = [];
    const restored = bootIntoStoredLocation();
    setReload({ stored: stored ? `${stored.type}${stored.stationId ? ":" + stored.stationId : ""}` : "—", restored, scene: sceneManager.state });
  }

  useEffect(() => {
    installDockingScene();
    // Keep the M6 blackout inside its own box. Left on document.body it would
    // black out the whole harness — including the readouts that prove it works.
    sceneFade.attachTo(fadeHostRef.current);
    sceneManager.forceState(GameState.SPACE);
    reset();

    // Console handle onto the REAL module instances. Importing them again from
    // the console gets you a second copy under Vite's HMR, which silently
    // measures nothing — this is the only reliable way in.
    (window as any).__dockTest = {
      state, sceneManager, GameState, sceneFade, requestDock, requestUndock, forceUndock, reset, station,
      // M8
      loadLocation, bootIntoStoredLocation, simulateReload,
    };

    const over = overRef.current!.getContext("2d")!;
    const camx = camRef.current!.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const docking = sceneManager.state === GameState.DOCKING;
      // Both cinematics own the ship and both should be recorded.
      const flying = docking || sceneManager.state === GameState.UNDOCKING;

      // ── Tick, in loop.ts order ───────────────────────────────────────────
      // 1) Decoy server smoothing — drags the ship toward a position that is
      //    NOT on the path, the way applyServerSmoothing() does every frame.
      //    Only while docking, or it would pull the parked ship away between runs.
      if (cfg.current.fightSmoothing && docking) {
        const tx = station.pos.x + 400, ty = station.pos.y - 400;
        const k = 1 - Math.exp(-6 * dt);
        state.player.pos.x += (tx - state.player.pos.x) * k;
        state.player.pos.y += (ty - state.player.pos.y) * k;
      }
      // 2) The cinematic, pumped LAST — it has to win.
      sceneManager.update(dt);

      // ── Record ───────────────────────────────────────────────────────────
      // Catch the dock commit the frame it happens, before the fade-in starts.
      if (state.dockedAt && !wasDocked.current) commitFade.current = sceneFade.opacity;
      wasDocked.current = state.dockedAt;

      if (flying) {
        if (!runStart.current) runStart.current = now;
        trail.current.push({ x: state.player.pos.x, y: state.player.pos.y });
        camTrail.current.push({
          x: state.player.pos.x + state.cameraOffset.x,
          y: state.player.pos.y + state.cameraOffset.y,
        });
        peak.current.off = Math.max(peak.current.off, Math.hypot(state.cameraOffset.x, state.cameraOffset.y));
        peak.current.zoom = Math.max(peak.current.zoom, state.cameraZoom);
      }

      // Auto-repeat the FULL round trip — dock, sit in the hangar, undock, fly
      // back out — so both cinematics can be watched without clicking.
      if (cfg.current.loop) {
        const s = sceneManager.state;
        if (relaunchAt.current && now >= relaunchAt.current) {
          relaunchAt.current = 0;
          if (s === GameState.HANGAR) {
            requestUndock();
          } else {
            reset();
            void requestDock(station.id);
          }
        } else if (!relaunchAt.current) {
          // Arm at rest. SPACE only re-arms once something has actually flown,
          // so the harness does not start docking on its own at load.
          if (s === GameState.HANGAR) relaunchAt.current = now + 1000;
          else if (s === GameState.SPACE && trail.current.length) relaunchAt.current = now + 1200;
        }
      } else {
        relaunchAt.current = 0;
      }

      // ── Overview ─────────────────────────────────────────────────────────
      {
        const w = OVER_W, h = OVER_H;
        const s = Math.min(w, h) / VIEW_SPAN;
        const X = (x: number) => w / 2 + (x - station.pos.x) * s;
        const Y = (y: number) => h / 2 + (y - station.pos.y) * s;

        over.fillStyle = "#080b14";
        over.fillRect(0, 0, w, h);

        over.strokeStyle = "rgba(78,226,255,0.18)";
        over.setLineDash([6, 6]);
        over.beginPath();
        over.arc(X(station.pos.x), Y(station.pos.y), DOCK_PROMPT_RANGE * s, 0, Math.PI * 2);
        over.stroke();
        over.setLineDash([]);

        poly(over, plan.current, X, Y, "rgba(255,196,74,0.6)", 2);
        poly(over, planOut.current, X, Y, "rgba(255,122,89,0.55)", 2);
        poly(over, camTrail.current, X, Y, "#78ffaa", 2, [4, 4]);
        poly(over, trail.current, X, Y, "#4ee2ff", 3);

        over.fillStyle = "#8fa3c8";
        dot(over, X(station.pos.x), Y(station.pos.y), 8);
        ship(over, X(state.player.pos.x), Y(state.player.pos.y), state.player.angle, 11, "#ffd166");
      }

      // ── Camera view: the real transform ──────────────────────────────────
      {
        const w = CAM_W, h = CAM_H;
        const zoom = state.cameraZoom;
        const cx = state.player.pos.x + state.cameraOffset.x;
        const cy = state.player.pos.y + state.cameraOffset.y;
        // Identical to worldLayer: position = centre, pivot = cam, scale = zoom.
        const X = (x: number) => (x - cx) * zoom + w / 2;
        const Y = (y: number) => (y - cy) * zoom + h / 2;

        camx.fillStyle = "#05070d";
        camx.fillRect(0, 0, w, h);

        camx.strokeStyle = "rgba(78,226,255,0.15)";
        camx.setLineDash([6, 6]);
        camx.beginPath();
        camx.arc(X(station.pos.x), Y(station.pos.y), DOCK_PROMPT_RANGE * zoom, 0, Math.PI * 2);
        camx.stroke();
        camx.setLineDash([]);

        poly(camx, plan.current, X, Y, "rgba(255,196,74,0.35)", 2);
        poly(camx, planOut.current, X, Y, "rgba(255,122,89,0.3)", 2);
        poly(camx, trail.current, X, Y, "rgba(78,226,255,0.8)", 3);

        camx.fillStyle = "#8fa3c8";
        dot(camx, X(station.pos.x), Y(station.pos.y), 16 * zoom);
        camx.fillStyle = "#cfe0f5";
        camx.font = "11px monospace";
        camx.fillText(station.name, X(station.pos.x) + 20 * zoom, Y(station.pos.y) + 4);
        ship(camx, X(state.player.pos.x), Y(state.player.pos.y), state.player.angle, 16 * zoom, "#ffd166");

        // Screen centre crosshair — makes the pivot lead visible: the ship
        // drifts off centre exactly as far as cameraOffset displaces it.
        camx.strokeStyle = "rgba(120,255,170,0.35)";
        camx.beginPath();
        camx.moveTo(w / 2 - 8, h / 2); camx.lineTo(w / 2 + 8, h / 2);
        camx.moveTo(w / 2, h / 2 - 8); camx.lineTo(w / 2, h / 2 + 8);
        camx.stroke();
      }

      setUi({
        scene: sceneManager.state,
        progress: dockingProgress(),
        speed: Math.hypot(state.player.vel.x, state.player.vel.y),
        elapsed: runStart.current ? (now - runStart.current) / 1000 : 0,
        zoom: state.cameraZoom,
        ox: state.cameraOffset.x,
        oy: state.cameraOffset.y,
        pOff: peak.current.off,
        pZoom: peak.current.zoom,
        docked: String(state.dockedAt),
        fade: sceneFade.opacity,
        commitFade: commitFade.current,
      });

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      // index.css locks the page down for the game canvas: html, body and #root
      // all get `overflow: hidden` and a fixed 100% height. A harness taller
      // than the viewport is therefore simply cut off — the page itself can
      // never scroll. So this container has to own its own scrolling.
      height: "100vh", overflowY: "auto",
      background: "#05070d", color: "#cfe0f5",
      fontFamily: "monospace", fontSize: 13, padding: 12,
      display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start",
    }}>
      <div style={{ flex: "1 1 420px", minWidth: 300, maxWidth: 560 }}>
        <h2 style={{ margin: "0 0 8px", color: "#4ee2ff", fontSize: 15 }}>M4/M5 · Docking</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={reset} style={btn}>Reset</button>
          <button onClick={() => { setLoop(false); reset(); void requestDock(station.id); }}
                  style={{ ...btn, borderColor: "#4ee2ff", color: "#4ee2ff" }}>
            Einmal andocken
          </button>
          <button onClick={() => { setLoop(false); requestUndock(); }}
                  style={{ ...btn, borderColor: "#ff7a59", color: "#ff7a59" }}>
            Abdocken
          </button>
          <button onClick={simulateReload}
                  style={{ ...btn, borderColor: "#c08cff", color: "#c08cff" }}>
            Reload simulieren
          </button>
        </div>

        {/* M8 — where the flow says the player is, and where a fresh boot puts them. */}
        <div style={{ color: "#7f8ea8", marginBottom: 10, lineHeight: 1.6 }}>
          gespeicherter Ort: <span style={{ color: "#c08cff" }}>
            {(() => { const l = loadLocation(); return l ? `${l.type}${l.stationId ? " · " + l.stationId : ""}` : "—"; })()}
          </span>
          {reload && (
            <> · nach Reload: <span style={{ color: reload.restored ? "#78ffaa" : "#ffd166" }}>
              {reload.scene}{reload.restored ? " (wiederhergestellt)" : ""}
            </span></>
          )}
        </div>

        <label style={{ display: "block", color: "#7f8ea8", marginBottom: 6 }}>Kamera-Sicht (das sieht der Spieler)</label>
        {/* The blackout overlays THIS box, not the page — see sceneFade.attachTo. */}
        <div ref={fadeHostRef} style={{ position: "relative" }}>
          <canvas ref={camRef} width={CAM_W} height={CAM_H}
                  style={{ width: "100%", border: "1px solid #1b2740", display: "block" }} />
        </div>
      </div>

      <div style={{ flex: "0 1 280px", minWidth: 240 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <span style={{ width: 88, color: "#7f8ea8" }}>Startdistanz</span>
          <input type="range" min={40} max={300} step={10} value={startDist}
                 onChange={(e) => setStartDist(Number(e.target.value))} style={{ flex: 1, minWidth: 60 }} />
          <span style={{ width: 30, textAlign: "right" }}>{startDist}</span>
        </div>
        <Check id="loop" checked={loop} onChange={setLoop} label="Endlos wiederholen" />
        <Check id="fs" checked={fightSmoothing} onChange={setFightSmoothing} label="Server-Smoothing gegenhalten" />

        <hr style={{ borderColor: "#1b2740", margin: "10px 0" }} />
        <F k="Station" v={station.name} />
        <F k="Scene-State" v={ui.scene} />
        <F k="Progress" v={ui.progress.toFixed(3)} />
        <F k="Laufzeit" v={`${ui.elapsed.toFixed(2)} s`} />
        <F k="Pfadlänge" v={`${pathLen.toFixed(0)} u`} />
        <F k="Speed" v={`${ui.speed.toFixed(0)} u/s`} />
        <F k="dockedAt" v={ui.docked} />
        <F k="Blende" v={ui.fade.toFixed(2)} />
        <F k="Blende b. Andocken" v={ui.commitFade == null ? "—" : ui.commitFade.toFixed(2)} />
        <hr style={{ borderColor: "#1b2740", margin: "10px 0" }} />
        <F k="cameraZoom" v={ui.zoom.toFixed(3)} />
        <F k="cameraOffset" v={`${ui.ox.toFixed(0)} / ${ui.oy.toFixed(0)}`} />
        <F k="Peak-Offset" v={`${ui.pOff.toFixed(0)} u`} />
        <F k="Peak-Zoom" v={ui.pZoom.toFixed(3)} />

        <p style={{ color: "#7f8ea8", lineHeight: 1.5, marginTop: 14 }}>
          <b style={{ color: "#78ffaa" }}>Kamera-Sicht:</b> die Station wandert ins Bild
          und das Bild zieht sich zu — das ist M5. Das kleine grüne Kreuz ist die
          Bildmitte; dass das Schiff kurzzeitig daneben liegt, <i>ist</i> der Vorlauf.
        </p>
        <p style={{ color: "#7f8ea8", lineHeight: 1.5 }}>
          <b style={{ color: "#cfe0f5" }}>Blende (M6):</b> kurz vor Ankunft wird das
          Bild schwarz, dahinter wird angedockt (<code>dockedAt</code> springt um),
          dann kommt es zurück. Im Spiel deckt sie den ganzen Bildschirm ab, hier nur
          die Kamera-Box.
        </p>
        <p style={{ color: "#7f8ea8", lineHeight: 1.5 }}>
          <b style={{ color: "#ffc44a" }}>Übersicht:</b> Gelb = Anflug,
          <span style={{ color: "#ff7a59" }}> Orange = Abflug (M7)</span>,
          Blau = tatsächlich geflogen, Grün gestrichelt = Kamera-Pivot. Blau muss
          die Planbahnen decken, auch bei aktivem Gegenhalten — das prüft die
          Pump-Position in <code>loop.ts</code>.
        </p>
      </div>

      {/* Own flex item, so when the layout wraps on a narrow window the
          readouts land directly under the camera view instead of a screen
          and a half further down. */}
      <div style={{ flex: "1 1 420px", minWidth: 300, maxWidth: 560 }}>
        <label style={{ display: "block", color: "#7f8ea8", marginBottom: 6 }}>Übersicht von oben</label>
        <canvas ref={overRef} width={OVER_W} height={OVER_H}
                style={{ width: "100%", border: "1px solid #1b2740", display: "block" }} />
      </div>
    </div>
  );
}

// ── tiny draw helpers ────────────────────────────────────────────────────────

function poly(
  c: CanvasRenderingContext2D, pts: Pt[],
  X: (n: number) => number, Y: (n: number) => number,
  color: string, width: number, dash?: number[],
) {
  if (pts.length < 2) return;
  c.strokeStyle = color;
  c.lineWidth = width;
  if (dash) c.setLineDash(dash);
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y))));
  c.stroke();
  if (dash) c.setLineDash([]);
}

function dot(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, Math.max(2, r), 0, Math.PI * 2);
  c.fill();
}

function ship(c: CanvasRenderingContext2D, x: number, y: number, a: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  c.lineTo(x + Math.cos(a + 2.5) * r * 0.7, y + Math.sin(a + 2.5) * r * 0.7);
  c.lineTo(x + Math.cos(a - 2.5) * r * 0.7, y + Math.sin(a - 2.5) * r * 0.7);
  c.closePath();
  c.fill();
}

// ── tiny UI bits ─────────────────────────────────────────────────────────────

const btn: React.CSSProperties = {
  flex: 1, padding: "7px 10px", background: "transparent",
  border: "1px solid #33507a", color: "#cfe0f5", cursor: "pointer",
  fontFamily: "monospace", fontSize: 13,
};

function Check({ id, checked, onChange, label }: {
  id: string; checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

function F({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "2px 0" }}>
      <span style={{ color: "#7f8ea8" }}>{k}</span>
      <span style={{ textAlign: "right", wordBreak: "break-all" }}>{v}</span>
    </div>
  );
}
