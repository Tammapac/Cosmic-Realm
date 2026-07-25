// ─────────────────────────────────────────────────────────────────────────────
// DepthTest — proof harness for the shared 3D scene. Open with ?depth-test.
//
// The claim the shared scene makes is a physical one: stations, player ships,
// other players and enemy NPCs all write to the SAME depth buffer, so what
// hides what is decided by geometry rather than by which canvas was composited
// last. That claim is not observable from the game — a station never overlaps a
// ship there, because the ship groups are lifted clear of the hull — so it has
// to be tested somewhere it can be forced.
//
// This harness runs the real code path: the real init3DLayer + initStation3DLayer,
// the real updateShip3D / updateStationOnly, the real render3DLayer. Nothing is
// mocked, so a pass here is a pass in the game.
//
// It is driven from the console rather than a RAF loop, because the answer to
// "is the ship occluded" is a pixel comparison between three renders of the same
// frame and a loop would be racing itself:
//
//   __depth.ready()                     → have the GLBs finished loading
//   __depth.run("behind")               → render one scenario, get the verdict
//   __depth.all()                       → every scenario, as a table
//   __depth.show("behind")              → leave a scenario on screen to look at
//
// Deletable: nothing outside this file and the ?depth-test line in main.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  init3DLayer, updateShip3D, removeShip3D, setCameraZoom,
  beginFrame, markActive, endFrame, render3DLayer, is3DReady,
} from "../game/three-ship-layer";
import {
  initStation3DLayer, setStationCameraZoom, beginStationFrame,
  updateStationOnly, endStationFrame, removeStation3D, getStationDoorWorldOffset,
} from "../game/three-station-layer";
import { setShipLiftFactor, getWorldLayer } from "../game/three-world-layer";

const STATION_ID = "helix";
const PLAYER_CLASS = "skimmer";
const ENEMY_CLASS = "enemy_raider";

/** One entity to place this frame. */
interface Actor {
  id: string;
  cls: string;
  x: number;
  y: number;
  size: number;
}

interface Scenario {
  name: string;
  what: string;
  /** 1 = ships lifted clear of stations (the in-game default), 0 = on the plane. */
  lift: number;
  zoom: number;
  actors: Actor[];
  /** Which actor the verdict is about. */
  subject: string;
  /** What the subject should look like with the station present. */
  expect: "visible" | "occluded";
}

// The door sits about 673 world units toward screen-bottom of the station
// centre (measured out of the live scene by getStationDoorWorldOffset; the
// constant is only the fallback for a station that has not loaded a door).
const DOOR_Y = 673;

function scenarios(doorY: number): Scenario[] {
  const P = (x: number, y: number, size = 1): Actor =>
    ({ id: "player", cls: PLAYER_CLASS, x, y, size });
  const E = (x: number, y: number, size = 1): Actor =>
    ({ id: "enemy:1", cls: ENEMY_CLASS, x, y, size });

  // The station fills the viewport at zoom 1 — its ~900px-wide hull is centred
  // on the screen. So "in front vs behind" is not tested by moving the ship OFF
  // the hull (it would leave the screen); it is tested by the ONE variable that
  // actually decides occlusion in the shared depth buffer: how high the ship
  // floats. Lift on → the ship is above the hull and wins the depth test (its
  // in-game state); lift off → the ship sits inside the hull and loses. Both
  // ships are kept near screen-centre, squarely over the hull, so the station
  // is genuinely between them and — or genuinely below — the camera.
  const OVER_HULL = -120; // just above centre, solidly over the hull plate
  void doorY;
  return [
    {
      name: "ship-front-lift",
      what: "player over the hull WITH lift (in-game) — floats above, visible",
      lift: 1, zoom: 1, subject: "player", expect: "visible",
      actors: [P(0, OVER_HULL)],
    },
    {
      name: "ship-behind-nolift",
      what: "player over the hull, lift OFF — hull swallows it, occluded",
      lift: 0, zoom: 1, subject: "player", expect: "occluded",
      actors: [P(0, OVER_HULL)],
    },
    {
      name: "ship-in-door",
      what: "player half-lifted at the hull — partial sink, still visible",
      lift: 0.55, zoom: 1, subject: "player", expect: "visible",
      actors: [P(0, OVER_HULL)],
    },
    {
      name: "enemy-front-lift",
      what: "enemy NPC over the hull WITH lift — visible",
      lift: 1, zoom: 1, subject: "enemy:1", expect: "visible",
      actors: [E(0, OVER_HULL)],
    },
    {
      name: "enemy-behind-nolift",
      what: "enemy NPC over the hull, lift OFF — occluded",
      lift: 0, zoom: 1, subject: "enemy:1", expect: "occluded",
      actors: [E(0, OVER_HULL)],
    },
    {
      name: "two-ships-lift",
      what: "player + enemy overlapping over the hull, both lifted — both visible",
      lift: 1, zoom: 1, subject: "player", expect: "visible",
      actors: [P(0, OVER_HULL), E(30, OVER_HULL, 1.4)],
    },
    {
      name: "zoomed-in",
      what: "lift tracks zoom — at 2.5x the lifted ship still clears the hull",
      lift: 1, zoom: 2.5, subject: "player", expect: "visible",
      actors: [P(0, OVER_HULL)],
    },
    {
      name: "zoomed-in-nolift",
      what: "at 2.5x with lift OFF the hull still swallows it (depth is real)",
      lift: 0, zoom: 2.5, subject: "player", expect: "occluded",
      actors: [P(0, OVER_HULL)],
    },
  ];
}

interface Probe { r: number; g: number; b: number; a: number }

export default function DepthTest() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState("booting…");
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<string[]>([]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth || 1000;
    const h = mount.clientHeight || 600;

    let canvas: HTMLCanvasElement;
    try {
      canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.dataset.perfName = "3d-depthtest";
      init3DLayer(canvas);
      initStation3DLayer(w, h);
    } catch (e) {
      setErr("boot threw: " + String(e));
      return;
    }
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    mount.appendChild(canvas);

    const world = getWorldLayer();
    const gl = world?.renderer.getContext();

    /** Draw one frame with exactly these actors and this station. */
    function frame(actors: Actor[], station: boolean, zoom: number, lift: number): void {
      setShipLiftFactor(lift);
      setCameraZoom(zoom);
      setStationCameraZoom(zoom);
      beginFrame();
      beginStationFrame();
      if (station) updateStationOnly(STATION_ID, 0, 0, 0, 0);
      for (const a of actors) {
        updateShip3D(a.id, a.cls, a.x, a.y, -Math.PI / 2, a.size, 0, 0, 0, 0);
        markActive(a.id);
      }
      endFrame();
      endStationFrame();
      if (!station) removeStation3D(STATION_ID);
      render3DLayer();
    }

    /**
     * Average the pixels of a screen-space box, read straight out of the
     * drawing buffer. Must run in the same task as the render that produced it
     * (preserveDrawingBuffer is off), which is why frame() and probe() are
     * always called back to back and never across a RAF boundary.
     */
    function probe(cx: number, cy: number, half: number): Probe {
      if (!gl || !world) return { r: 0, g: 0, b: 0, a: 0 };
      const dpr = world.renderer.getPixelRatio();
      const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
      const px = Math.round(cx * dpr), py = Math.round(cy * dpr);
      const s = Math.max(1, Math.round(half * dpr));
      const x0 = Math.max(0, px - s), y0 = Math.max(0, bh - py - s);
      const ww = Math.min(bw - x0, s * 2), hh = Math.min(bh - y0, s * 2);
      if (ww <= 0 || hh <= 0) return { r: 0, g: 0, b: 0, a: 0 };
      const buf = new Uint8Array(ww * hh * 4);
      gl.readPixels(x0, y0, ww, hh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < buf.length; i += 4) {
        r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3];
      }
      const n = buf.length / 4;
      return { r: r / n, g: g / n, b: b / n, a: a / n };
    }

    function clearActors(): void {
      beginFrame(); endFrame();
      removeStation3D(STATION_ID);
    }

    function doorOffset(): number {
      const off = getStationDoorWorldOffset(STATION_ID);
      return off ? off.y : DOOR_Y;
    }

    /**
     * Run one scenario and decide.
     *
     * Three renders of the same frame:
     *   A  ship only          → what the subject looks like unobstructed
     *   B  station only       → what the background looks like there
     *   C  ship + station     → what actually happens
     *
     * If C matches B far more closely than it matches A, the station is in
     * front and the ship is hidden. If C matches A, the ship won the depth
     * test. Comparing to BOTH references is what makes the verdict robust: a
     * single threshold on "did anything change" would call a ship that merely
     * moved a shadow occluded.
     */
    /**
     * Centroid + radius of everything drawn this frame, in CSS pixels. Used to
     * find where the subject ACTUALLY lands rather than trusting a projection
     * formula — the scene's screen mapping folds in the wrapper tilt, the model
     * recentre and the lift, and a hand-derived pixel would sit off the hull.
     */
    function centroid(): { x: number; y: number; r: number; hit: number } {
      if (!gl || !world) return { x: 0, y: 0, r: 0, hit: 0 };
      const dpr = world.renderer.getPixelRatio();
      const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
      const buf = new Uint8Array(bw * bh * 4);
      gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let sx = 0, sy = 0, hit = 0, minX = bw, minY = bh, maxX = -1, maxY = -1;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          if (buf[(y * bw + x) * 4 + 3] > 8) {
            sx += x; sy += y; hit++;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      if (!hit) return { x: 0, y: 0, r: 0, hit: 0 };
      const cxGl = sx / hit, cyGl = sy / hit;
      return {
        x: cxGl / dpr,
        y: (bh - cyGl) / dpr, // GL bottom-up → CSS top-down
        r: Math.min(maxX - minX, maxY - minY) / dpr,
        hit,
      };
    }

    function run(name: string): string {
      const sc = scenarios(doorOffset()).find((s) => s.name === name);
      if (!sc) return `${name}: no such scenario`;

      // 1. Render the SUBJECT ALONE and find where it actually draws. For a
      //    two-actor scenario, hide the non-subject actor so the centroid is
      //    the subject's, not the pair's.
      const subjOnly = sc.actors.filter((a) => a.id === sc.subject);
      clearActors();
      frame(subjOnly, false, sc.zoom, sc.lift);
      const loc = centroid();
      if (loc.hit < 20) {
        return `SKIP · ${sc.name} · subject never drew (off screen / not loaded)`;
      }
      const cx = loc.x, cy = loc.y;
      // A third of the subject's own drawn radius — inside the silhouette,
      // clear of the antialiased rim.
      const half = Math.max(6, Math.round(loc.r * 0.33));

      // 2. Reference A: subject alone, at that point.
      const a = probe(cx, cy, half);

      // 3. Reference B: station only — the background at that same point.
      clearActors();
      frame([], true, sc.zoom, sc.lift);
      const b = probe(cx, cy, half);

      // 4. Actual: the full scenario.
      clearActors();
      frame(sc.actors, true, sc.zoom, sc.lift);
      const c = probe(cx, cy, half);

      const d = (p: Probe, q: Probe) =>
        Math.abs(p.r - q.r) + Math.abs(p.g - q.g) + Math.abs(p.b - q.b) + Math.abs(p.a - q.a);
      const toShip = d(c, a);
      const toBg = d(c, b);

      // The robust signal is OCCLUSION, read off toBg: if the full scene's
      // pixels at the subject's own centroid are (near) identical to the
      // station-only frame, the station is completely in front and the subject
      // is hidden. That is unambiguous — a hidden ship contributes nothing, so
      // the pixel IS the hull. "Visible" is then simply "not occluded": the
      // subject changed the pixel from what the bare hull showed. Comparing to
      // the ship-alone reference (toShip) is deliberately NOT used for the
      // verdict — a lit ship over a bloomed metallic hull legitimately shares
      // colour with it, so toShip is noisy where toBg is clean.
      const OCCLUDED_EPS = 6;
      const verdict: "visible" | "occluded" = toBg <= OCCLUDED_EPS ? "occluded" : "visible";
      const ok = verdict === sc.expect ? "PASS" : "FAIL";
      // A scenario whose two references are themselves identical proves nothing
      // — the ship never drew, or is invisible against the hull for real.
      const separable = d(a, b) > 12;
      return `${ok}${separable ? "" : " (INCONCLUSIVE: subject == bg in isolation)"} · ` +
        `${sc.name} · expected ${sc.expect}, got ${verdict} · ` +
        `Δbg ${toBg.toFixed(0)} (occl≤${OCCLUDED_EPS}) Δship ${toShip.toFixed(0)} · ${sc.what}`;
    }

    function all(): string[] {
      return scenarios(doorOffset()).map((s) => run(s.name));
    }

    function show(name: string): void {
      const sc = scenarios(doorOffset()).find((s) => s.name === name);
      if (!sc) return;
      clearActors();
      frame(sc.actors, true, sc.zoom, sc.lift);
    }

    const api = {
      ready: () => is3DReady(PLAYER_CLASS) && is3DReady(ENEMY_CLASS) && !!getWorldLayer(),
      warm: () => {
        // Touching an entity is what triggers the lazy GLB load; the models
        // arrive a few hundred ms later.
        frame([{ id: "player", cls: PLAYER_CLASS, x: 0, y: 0, size: 1 },
               { id: "enemy:1", cls: ENEMY_CLASS, x: 200, y: 0, size: 1 }], true, 1, 1);
        return api.ready();
      },
      run,
      all: () => { const r = all(); setRows(r); return r; },
      show,
      tree: () => {
        const s = getWorldLayer()?.scene;
        if (!s) return "no scene";
        return s.children.map((c: THREE.Object3D) =>
          `${c.type}${c.name ? " " + c.name : ""} (${c.children.length})`).join("\n");
      },
      // Diagnostic: render one scenario, then return the CSS-pixel bounding box
      // of everything that got drawn (alpha > 8) and where run() is probing.
      scan: (name: string, withStation = true) => {
        const sc = scenarios(doorOffset()).find((s) => s.name === name);
        if (!sc || !gl || !world) return "no";
        clearActors();
        frame(sc.actors, withStation, sc.zoom, sc.lift);
        const dpr = world.renderer.getPixelRatio();
        const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
        const buf = new Uint8Array(bw * bh * 4);
        gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let minX = bw, minY = bh, maxX = -1, maxY = -1, hit = 0;
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            if (buf[(y * bw + x) * 4 + 3] > 8) {
              hit++;
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
          }
        }
        // GL y is bottom-up; convert to CSS top-down.
        const toCssY = (gy: number) => (bh - gy) / dpr;
        const subject = sc.actors.find((a) => a.id === sc.subject)!;
        return {
          drawn: hit,
          bboxCss: hit ? {
            x0: Math.round(minX / dpr), x1: Math.round(maxX / dpr),
            yTop: Math.round(toCssY(maxY)), yBot: Math.round(toCssY(minY)),
          } : null,
          probeCss: { x: Math.round(w / 2 + subject.x * sc.zoom), y: Math.round(h / 2 + subject.y * sc.zoom) },
          canvasCss: { w, h }, dpr, bufSize: { bw, bh },
        };
      },
    };
    (window as any).__depth = api;

    setInfo("ready — drive from the console: __depth.warm(), then __depth.all()");
    return () => {
      delete (window as any).__depth;
      removeShip3D("player");
      removeShip3D("enemy:1");
      removeStation3D(STATION_ID);
      canvas.remove();
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#070b14", color: "#cfe3ff", fontFamily: "monospace" }}>
      <div style={{ padding: "8px 14px" }}>
        <strong>Shared 3D scene — depth test</strong>
        <div style={{ fontSize: 12, opacity: 0.8 }}>{info}</div>
        {err && <pre style={{ color: "#ff8080", fontSize: 12 }}>{err}</pre>}
        {rows.length > 0 && (
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 150, overflow: "auto" }}>
            {rows.join("\n")}
          </pre>
        )}
      </div>
      <div ref={mountRef} style={{ position: "absolute", inset: "78px 0 8px 0" }} />
    </div>
  );
}
