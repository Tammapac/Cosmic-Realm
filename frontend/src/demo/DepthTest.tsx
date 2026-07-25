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
  __setBypassPostFX, __getPostFX,
} from "../game/three-ship-layer";
import {
  initStation3DLayer, setStationCameraZoom, beginStationFrame,
  updateStationOnly, endStationFrame, removeStation3D, getStationDoorWorldOffset,
} from "../game/three-station-layer";
import { setShipLiftFactor, getWorldLayer, normalizeSharedDepth } from "../game/three-world-layer";

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

    // Mean luminance of the OPAQUE pixels in a screen box (ignores empty space,
    // so a station shoved into a corner is measured on its own hull, not on the
    // black around it).
    function probeMean(cx: number, cy: number, half: number): number {
      if (!gl || !world) return 0;
      const dpr = world.renderer.getPixelRatio();
      const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
      const px = Math.round(cx * dpr), py = Math.round(cy * dpr);
      const s = Math.max(1, Math.round(half * dpr));
      const x0 = Math.max(0, px - s), y0 = Math.max(0, bh - py - s);
      const ww = Math.min(bw - x0, s * 2), hh = Math.min(bh - y0, s * 2);
      if (ww <= 0 || hh <= 0) return 0;
      const buf = new Uint8Array(ww * hh * 4);
      gl.readPixels(x0, y0, ww, hh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let sum = 0, n = 0;
      for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] < 8) continue;
        sum += Math.max(buf[i], buf[i + 1], buf[i + 2]);
        n++;
      }
      return n ? +(sum / n).toFixed(1) : 0;
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

    // Lighting inspection: render the STATION alone at a given zoom and leave it
    // on screen. Low zoom = station small = the "over-lit at distance" case.
    // Also reports the brightest pixel + how many pixels are near-white (a proxy
    // for "hull plates crossing the bloom threshold and shimmering").
    function lookStation(zoom: number): unknown {
      if (!gl || !world) return "no gl";
      clearActors();
      frame([], true, zoom, 1);
      const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
      const buf = new Uint8Array(bw * bh * 4);
      gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let maxL = 0, hot = 0, lit = 0, n = 0;
      for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] < 8) continue;
        n++;
        const l = Math.max(buf[i], buf[i + 1], buf[i + 2]);
        if (l > maxL) maxL = l;
        if (l >= 250) hot++;   // near-clipped white — over-lit
        if (l >= 210) lit++;   // bright, heading toward bloom
      }
      // Mean luminance of the drawn hull — the honest "how bright is it"
      // number, independent of how many pixels the model happens to cover.
      let sum = 0;
      for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] < 8) continue;
        sum += Math.max(buf[i], buf[i + 1], buf[i + 2]);
      }
      return {
        zoom, drawn: n, maxLum: maxL,
        meanLum: n ? +(sum / n).toFixed(1) : 0,
        hotPct: n ? +(100 * hot / n).toFixed(1) : 0,   // % clipped white
        litPct: n ? +(100 * lit / n).toFixed(1) : 0,   // % very bright
        exposure: +world.renderer.toneMappingExposure.toFixed(3),
        envI: +((world.scene as any).environmentIntensity ?? -1),
      };
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
      lookStation,
      // A/B: is the postFX chain (GTAO/Bloom/FXAA/Vignette/OutputPass) what makes
      // the merged station read wrong? Returns before/after mean+clip metrics
      // with the chain on vs bypassed, at a far zoom.
      abPost: (zoom = 0.5) => {
        __setBypassPostFX(false);
        const withFX = lookStation(zoom);
        __setBypassPostFX(true);
        const noFX = lookStation(zoom);
        __setBypassPostFX(false);
        return { withFX, noFX };
      },
      bypass: (v: boolean) => { __setBypassPostFX(v); return "bypass=" + v; },
      // Set the live renderer exposure and re-grab over the checkerboard so the
      // brightness can be dialled in visually. Returns the resulting mean hull
      // luminance too.
      setExposure: (e: number) => {
        const w2 = getWorldLayer();
        if (!w2) return "no world";
        w2.renderer.toneMappingExposure = e;
        const m = lookStation(1.0) as any;
        return { exposure: e, meanLum: m.meanLum, hot: m.hotPct };
      },
      // Live-tune the light rig to see whether ambient/fill (not exposure) is
      // what lifts a dark model's body without clipping its bright bits.
      // Live material boost on the enemy hull: lower metalness + lift the base
      // colour so a near-black metallic body picks up diffuse light in the dark.
      // Then re-grab so the effect is visible. metal/mul are the two knobs.
      boostEnemy: (metal: number, mul: number, exposure = 1.15) => {
        const grp = getWorldLayer()?.scene.getObjectByName("enemyShipsGroup");
        if (!grp) return "no enemy";
        grp.traverse((c: any) => {
          const m = c.material;
          if (!m) return;
          for (const mm of (Array.isArray(m) ? m : [m])) {
            if (!mm.isMeshStandardMaterial) continue;
            // only the hull (grey), not the emissive lava cracks
            const em = mm.emissive;
            const isEmissive = (em.r + em.g + em.b) > 0.3 && (mm.emissiveIntensity ?? 0) > 0.1;
            if (isEmissive) continue;
            if (!mm.userData._origColor) mm.userData._origColor = mm.color.clone();
            mm.metalness = metal;
            mm.color.copy(mm.userData._origColor).multiplyScalar(mul);
            mm.needsUpdate = true;
          }
        });
        const url = (api as any).grabModel("enemy", exposure, 3.5);
        let el = document.getElementById("__ab") as HTMLImageElement | null;
        if (!el) {
          el = document.createElement("img"); el.id = "__ab";
          el.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:contain;z-index:99999;background:#0a0e18";
          document.body.appendChild(el);
        }
        el.src = url;
        return { metal, mul };
      },
      setEnvI: (v: number) => {
        const s = getWorldLayer()?.scene as any;
        if (!s) return "no scene";
        s.environmentIntensity = v;
        return "envI=" + v;
      },
      // Swap in a BRIGHT neutral environment (a light-grey gradient sphere) as
      // the IBL source, the way an editor "viewport" is lit. Tests whether the
      // real fix is the ENVIRONMENT MAP being dark, not its intensity. col is the
      // sky grey 0..1. Non-destructive to shipped code (harness scene only).
      brightEnv: (col = 0.8, kind: "player" | "enemy" | "station" = "enemy", zoom?: number) => {
        const w2 = getWorldLayer();
        if (!w2 || !gl) return "no world";
        const THREE2 = THREE;
        // build an equirect gradient: bright top, mid sides, darker bottom
        const cv = document.createElement("canvas");
        cv.width = 512; cv.height = 256;
        const c2 = cv.getContext("2d")!;
        const g = c2.createLinearGradient(0, 0, 0, 256);
        const hi = Math.round(col * 255), mid = Math.round(col * 200), lo = Math.round(col * 120);
        g.addColorStop(0, `rgb(${hi},${hi},${Math.min(255, hi + 10)})`);
        g.addColorStop(0.5, `rgb(${mid},${mid},${mid})`);
        g.addColorStop(1, `rgb(${lo},${lo},${lo})`);
        c2.fillStyle = g; c2.fillRect(0, 0, 512, 256);
        const tex = new THREE2.CanvasTexture(cv);
        tex.mapping = THREE2.EquirectangularReflectionMapping;
        tex.colorSpace = THREE2.SRGBColorSpace;
        const pmrem = new THREE2.PMREMGenerator(w2.renderer);
        const env = pmrem.fromEquirectangular(tex).texture;
        w2.scene.environment = env;
        (w2.scene as any).environmentIntensity = 1.0;
        tex.dispose(); pmrem.dispose();
        const url = (api as any).grabModel(kind, w2.renderer.toneMappingExposure,
          zoom ?? (kind === "station" ? 0.85 : 3.2));
        let el = document.getElementById("__ab") as HTMLImageElement | null;
        if (!el) { el = document.createElement("img"); el.id = "__ab";
          el.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:contain;z-index:99999;background:#0a0e18";
          document.body.appendChild(el); }
        el.src = url;
        return "bright env " + col;
      },
      // Install a bright neutral env at brightness `col` and return the grab URL,
      // WITHOUT drawing it — used by the grid below.
      _brightEnvUrl: (col: number, kind: "player" | "enemy" | "station", zoom: number): string => {
        const w2 = getWorldLayer();
        if (!w2 || !gl) return "";
        const cv = document.createElement("canvas");
        cv.width = 512; cv.height = 256;
        const c2 = cv.getContext("2d")!;
        const g = c2.createLinearGradient(0, 0, 0, 256);
        const hi = Math.round(col * 255), mid = Math.round(col * 200), lo = Math.round(col * 120);
        g.addColorStop(0, `rgb(${hi},${hi},${Math.min(255, hi + 10)})`);
        g.addColorStop(0.5, `rgb(${mid},${mid},${mid})`);
        g.addColorStop(1, `rgb(${lo},${lo},${lo})`);
        c2.fillStyle = g; c2.fillRect(0, 0, 512, 256);
        const tex = new THREE.CanvasTexture(cv);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        const pmrem = new THREE.PMREMGenerator(w2.renderer);
        w2.scene.environment = pmrem.fromEquirectangular(tex).texture;
        (w2.scene as any).environmentIntensity = 1.0;
        tex.dispose(); pmrem.dispose();
        return (api as any).grabModel(kind, 1.15, zoom);
      },
      // Grid: rows = env brightness (0.6/0.8/1.0), cols = enemy/station/player.
      envGrid: (): void => {
        const brights = [0.6, 0.8, 1.0];
        const kinds: Array<["player" | "enemy" | "station", number]> =
          [["enemy", 3.4], ["station", 0.85], ["player", 3.0]];
        const cells: { url: string; label: string; r: number; c: number }[] = [];
        brights.forEach((b, r) => kinds.forEach(([k, z], c) => {
          cells.push({ url: (api as any)._brightEnvUrl(b, k, z), label: `${k} ${b}`, r, c });
        }));
        const imgs = cells.map((cell) => { const i = new Image(); i.src = cell.url; return i; });
        let loaded = 0;
        imgs.forEach((im) => im.onload = () => {
          if (++loaded < imgs.length) return;
          const W = 250, H = imgs[0].height * (W / imgs[0].width);
          const cv = document.createElement("canvas");
          cv.width = W * 3; cv.height = (H + 22) * 3;
          const ctx = cv.getContext("2d")!;
          ctx.fillStyle = "#0a0e18"; ctx.fillRect(0, 0, cv.width, cv.height);
          cells.forEach((cell, i) => {
            ctx.drawImage(imgs[i], cell.c * W, cell.r * (H + 22) + 22, W, H);
            ctx.fillStyle = "#0ff"; ctx.font = "13px monospace";
            ctx.fillText(cell.label, cell.c * W + 4, cell.r * (H + 22) + 15);
          });
          let el = document.getElementById("__ab") as HTMLImageElement | null;
          if (!el) { el = document.createElement("img"); el.id = "__ab";
            el.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:contain;z-index:99999;background:#0a0e18";
            document.body.appendChild(el); }
          el.src = cv.toDataURL("image/png");
        });
      },
      // A/B/C lighting comparison. Renders ONE model under four rigs side by side
      // so the "which lighting system" decision can be made by eye, WITHOUT
      // changing any shipped code. Variants:
      //   A now      — current: envI 0.55, ambient 0.12, hard directionals
      //   B high-GI  — envI 2.6, directionals halved: even all-around IBL light
      //   C amb+fill — envI 0.55 but ambient 0.6 + strong fill
      //   D GI+lift  — high-GI AND the exposure at 1.4
      // kind: "player" | "enemy" | "station".
      lightingAB: (kind: "player" | "enemy" | "station", zoom?: number): void => {
        const w2 = getWorldLayer();
        if (!w2 || !gl) return;
        const z = zoom ?? (kind === "station" ? 0.85 : 3.2);

        const apply = (envI: number, amb: number, sun: number, fill: number, rim: number, exp: number) => {
          w2.renderer.toneMappingExposure = exp;
          (w2.scene as any).environmentIntensity = envI;
          let di = 0;
          w2.scene.traverse((o: any) => {
            if (o.isAmbientLight) o.intensity = amb;
            if (o.isDirectionalLight) { di++;
              if (di === 1) o.intensity = sun;
              if (di === 2) o.intensity = fill;
              if (di === 3) o.intensity = rim;
            }
          });
        };
        const grab = (): string => (api as any).grabModel(kind, w2.renderer.toneMappingExposure, z);

        // capture the shipped defaults so we can restore them afterwards
        apply(0.55, 0.12, 2.2, 0.4, 0.55, 1.15); const a = grab();
        apply(2.6, 0.12, 1.1, 0.2, 0.3, 1.1);   const b = grab();
        apply(0.55, 0.6, 2.2, 1.1, 0.55, 1.15); const c = grab();
        apply(2.6, 0.2, 1.1, 0.3, 0.3, 1.4);    const d = grab();
        apply(0.55, 0.12, 2.2, 0.4, 0.55, 1.15); // restore A

        const labels = ["A now", "B high-GI", "C amb+fill", "D GI+bright"];
        const urls = [a, b, c, d];
        const imgs = urls.map((u) => { const i = new Image(); i.src = u; return i; });
        let loaded = 0;
        imgs.forEach((im, idx) => {
          im.onload = () => {
            if (++loaded < imgs.length) return;
            const W = 370, H = imgs[0].height * (W / imgs[0].width);
            const cv = document.createElement("canvas");
            cv.width = W * 2; cv.height = (H + 26) * 2;
            const ctx = cv.getContext("2d")!;
            ctx.fillStyle = "#0a0e18"; ctx.fillRect(0, 0, cv.width, cv.height);
            imgs.forEach((im2, i) => {
              const col = i % 2, row = Math.floor(i / 2);
              ctx.drawImage(im2, col * W, row * (H + 26) + 26, W, H);
              ctx.fillStyle = "#0ff"; ctx.font = "16px monospace";
              ctx.fillText(labels[i], col * W + 6, row * (H + 26) + 18);
            });
            let el = document.getElementById("__ab") as HTMLImageElement | null;
            if (!el) { el = document.createElement("img"); el.id = "__ab";
              el.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:contain;z-index:99999;background:#0a0e18";
              document.body.appendChild(el); }
            el.src = cv.toDataURL("image/png");
          };
          void idx;
        });
      },
      // Re-run normalizeSharedDepth on the live enemy group to test liftDarkHull
      // without needing a fresh model instance, then re-grab.
      relift: () => {
        const grp = getWorldLayer()?.scene.getObjectByName("enemyShipsGroup");
        if (!grp) return "no enemy group";
        (window as any).__LIFT_DEBUG = true;
        normalizeSharedDepth(grp, "enemy:relift");
        const after = (api as any).enemyMat().sample[0];
        const url = (api as any).grabModel("enemy", 1.15, 3.5);
        let el = document.getElementById("__ab") as HTMLImageElement | null;
        if (!el) { el = document.createElement("img"); el.id = "__ab";
          el.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:contain;z-index:99999;background:#0a0e18";
          document.body.appendChild(el); }
        el.src = url;
        return after;
      },
      setLights: (ambient?: number, sun?: number, fill?: number, rim?: number) => {
        const s = getWorldLayer()?.scene;
        if (!s) return "no scene";
        let ai = 0, di = 0;
        s.traverse((o: any) => {
          if (o.isAmbientLight && ambient != null) o.intensity = ambient;
          if (o.isDirectionalLight) {
            // sun is the strongest; fill/rim weaker. Order of add: sun, fill, rim.
            di++;
            if (di === 1 && sun != null) o.intensity = sun;
            if (di === 2 && fill != null) o.intensity = fill;
            if (di === 3 && rim != null) o.intensity = rim;
          }
          void ai;
        });
        return "lights set";
      },
      // Mean luminance of ONE model rendered alone (no station), lifted, at
      // screen centre — measures a ship or enemy's own brightness. kind:
      // "player" | "enemy".
      modelLum: (kind: "player" | "enemy", zoom = 1) => {
        if (!gl || !world) return 0;
        const id = kind === "enemy" ? "enemy:1" : "player";
        const cls = kind === "enemy" ? ENEMY_CLASS : PLAYER_CLASS;
        clearActors();
        setCameraZoom(zoom);
        beginFrame();
        updateShip3D(id, cls, 0, 0, -Math.PI / 2, kind === "enemy" ? 1.4 : 1, 0, 0, 0, 0);
        markActive(id);
        endFrame();
        setShipLiftFactor(0); // sit on plane so it's at screen centre
        render3DLayer();
        const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
        const buf = new Uint8Array(bw * bh * 4);
        gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let sum = 0, n = 0;
        for (let i = 0; i < buf.length; i += 4) {
          if (buf[i + 3] < 30) continue;
          sum += Math.max(buf[i], buf[i + 1], buf[i + 2]);
          n++;
        }
        removeShip3D(id);
        setShipLiftFactor(1);
        return n ? +(sum / n).toFixed(1) : 0;
      },
      // Render one model alone at a given exposure and return it as a PNG so the
      // brightness can be judged by eye (metrics proved too noisy).
      grabModel: (kind: "player" | "enemy" | "station", exposure: number, zoom = 1): string => {
        if (!gl || !world) return "";
        world.renderer.toneMappingExposure = exposure;
        clearActors();
        if (kind === "station") {
          setStationCameraZoom(zoom);
          beginFrame(); beginStationFrame();
          updateStationOnly(STATION_ID, 0, 0, 0, 0);
          endFrame(); endStationFrame();
        } else {
          const id = kind === "enemy" ? "enemy:1" : "player";
          const cls = kind === "enemy" ? ENEMY_CLASS : PLAYER_CLASS;
          setCameraZoom(zoom);
          setShipLiftFactor(0);
          beginFrame();
          updateShip3D(id, cls, 0, 0, -Math.PI / 2, kind === "enemy" ? 1.4 : 1, 0, 0, 0, 0);
          markActive(id);
          endFrame();
        }
        render3DLayer();
        const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
        const buf = new Uint8Array(bw * bh * 4);
        gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const cv = document.createElement("canvas");
        cv.width = bw; cv.height = bh;
        const ctx = cv.getContext("2d")!;
        const img = ctx.createImageData(bw, bh);
        for (let y = 0; y < bh; y++) {
          const src = (bh - 1 - y) * bw * 4, dst = y * bw * 4;
          for (let x = 0; x < bw * 4; x += 4) {
            const a = buf[src + x + 3] / 255;
            img.data[dst + x] = buf[src + x] * a + 10 * (1 - a);
            img.data[dst + x + 1] = buf[src + x + 1] * a + 14 * (1 - a);
            img.data[dst + x + 2] = buf[src + x + 2] * a + 24 * (1 - a);
            img.data[dst + x + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
        setShipLiftFactor(1);
        return cv.toDataURL("image/png");
      },
      // Sweep exposure and report the mean brightness of station / player /
      // enemy at each, so a single value can be chosen for all three.
      exposureSweep: (values: number[]) => {
        const w2 = getWorldLayer();
        if (!w2) return "no world";
        const rows = values.map((e) => {
          w2.renderer.toneMappingExposure = e;
          return {
            exp: e,
            station: (lookStation(1) as any).meanLum,
            player: (api as any).modelLum("player", 1),
            enemy: (api as any).modelLum("enemy", 1),
          };
        });
        return rows;
      },
      // Is the hull TRANSPARENT? Render the station, then over the solid hull
      // measure the alpha distribution. A solid hull must be alpha 255; anything
      // lower lets Pixi bleed the background through = the "milky transparent"
      // look. Compares postFX on vs off, since the composer can lower alpha.
      alphaProbe: (zoom = 1.0) => {
        if (!gl || !world) return "no gl";
        const sampleAlpha = (): { meanA: number; minA: number; solidPct: number; n: number } => {
          const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
          const buf = new Uint8Array(bw * bh * 4);
          gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          let sa = 0, minA = 255, n = 0, solid = 0;
          // only consider pixels that are clearly PART of the hull (some colour),
          // ignoring the fully-empty background (alpha ~0).
          for (let i = 0; i < buf.length; i += 4) {
            const a = buf[i + 3];
            const lum = Math.max(buf[i], buf[i + 1], buf[i + 2]);
            if (a < 20 && lum < 12) continue; // empty space
            n++; sa += a; if (a < minA) minA = a; if (a >= 250) solid++;
          }
          return { meanA: n ? +(sa / n).toFixed(1) : 0, minA, solidPct: n ? +(100 * solid / n).toFixed(1) : 0, n };
        };
        const sampleByPass = () => {
          const fx: any = __getPostFX();
          const passes = ["gtao", "bloom", "fxaa", "vignette"] as const;
          const setAll = (on: boolean) => passes.forEach((p) => { if (fx?.[p]) fx[p].enabled = on; });
          const out: Record<string, number> = {};
          clearActors();
          setStationCameraZoom(zoom);
          beginFrame(); beginStationFrame();
          updateStationOnly(STATION_ID, 0, 0, 0, 0);
          endFrame(); endStationFrame();
          __setBypassPostFX(true); render3DLayer(); out.raw_minA = sampleAlpha().minA;
          if (fx) {
            setAll(true); __setBypassPostFX(false); render3DLayer(); out.allOn_minA = sampleAlpha().minA;
            for (const p of passes) {
              if (!fx[p]) { out[`no_${p}_minA`] = -1; continue; }
              setAll(true); fx[p].enabled = false; render3DLayer();
              out[`no_${p}_minA`] = sampleAlpha().minA;
            }
            setAll(true);
          }
          return out;
        };
        clearActors();
        setStationCameraZoom(zoom);
        beginFrame(); beginStationFrame();
        updateStationOnly(STATION_ID, 0, 0, 0, 0);
        endFrame(); endStationFrame();
        __setBypassPostFX(false); render3DLayer();
        const withFX = sampleAlpha();
        __setBypassPostFX(true); render3DLayer();
        const raw = sampleAlpha();
        __setBypassPostFX(false);
        return { withFX, raw, byPass: sampleByPass() };
      },
      // Render the station shifted so its hull sits at screen CENTRE vs far in a
      // CORNER, and measure the mean hull brightness in each, with postFX on and
      // off. If a corner reads much brighter/milkier than centre only when
      // postFX is on, the culprit is a radial pass (vignette / lens effect),
      // not the lighting.
      radial: () => {
        if (!gl || !world) return "no gl";
        const measure = (camOffX: number, camOffY: number): number => {
          // Move the CAMERA so the station (at world 0,0) lands off-centre. The
          // layer maps screen = (world - cam) * zoom, so a cam offset shoves the
          // station by -offset*zoom pixels.
          setStationCameraZoom(1);
          beginStationFrame();
          updateStationOnly(STATION_ID, 0, 0, camOffX, camOffY);
          endStationFrame();
          render3DLayer();
          // sample a fixed box around where the station centre now sits
          const cx = w / 2 - camOffX; // screen px of world origin
          const cy = h / 2 - camOffY;
          const p = probeMean(cx, cy, 40);
          return p;
        };
        const gap = () => measure(-320, -360) - measure(0, 0); // corner − centre
        const out: Record<string, number> = {};
        __setBypassPostFX(true);  out.raw_gap = gap();
        __setBypassPostFX(false); out.allOn_gap = gap();
        const fx: any = __getPostFX();
        if (fx) {
          const passes = ["gtao", "bloom", "fxaa", "vignette"] as const;
          const setAll = (on: boolean) => passes.forEach((p) => { if (fx[p]) fx[p].enabled = on; });
          for (const p of passes) {
            if (!fx[p]) { out[`no_${p}_gap`] = -999; continue; }
            setAll(true); fx[p].enabled = false;
            out[`no_${p}_gap`] = gap();
          }
          setAll(true);
        }
        return out;
      },
      // Toggle individual composer passes and measure, to find which one veils
      // the station. Disables each in turn (others on), then restores all.
      isolatePasses: (zoom = 0.5) => {
        const fx: any = __getPostFX();
        if (!fx) return "no postFX";
        const passes = ["gtao", "bloom", "fxaa", "vignette"] as const;
        const setAll = (on: boolean) => passes.forEach((p) => { if (fx[p]) fx[p].enabled = on; });
        const out: Record<string, number> = {};
        setAll(true);
        out.allOn = (lookStation(zoom) as any).meanLum;
        for (const p of passes) {
          if (!fx[p]) { out[`no_${p}`] = -1; continue; }
          setAll(true);
          fx[p].enabled = false;
          out[`no_${p}`] = (lookStation(zoom) as any).meanLum;
        }
        setAll(true);
        __setBypassPostFX(true);
        out.bypassAll = (lookStation(zoom) as any).meanLum;
        __setBypassPostFX(false);
        return out;
      },
      // Grab the current drawing buffer as a data: URL so it can be inspected
      // even when the browser pane itself is not compositing frames. Renders the
      // station alone at `zoom` first. Flips vertically (GL is bottom-up).
      grab: (zoom = 0.6, camOffX = 0, camOffY = 0, bg = "dark"): string => {
        if (!gl || !world) return "";
        clearActors();
        // camOff shoves the station off screen-centre (worst case for radial
        // artefacts: pass e.g. (-320,-360) to push it into the top-left corner).
        setStationCameraZoom(zoom);
        beginFrame(); beginStationFrame();
        updateStationOnly(STATION_ID, 0, 0, camOffX, camOffY);
        endFrame(); endStationFrame();
        render3DLayer();
        const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
        const buf = new Uint8Array(bw * bh * 4);
        gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const cv = document.createElement("canvas");
        cv.width = bw; cv.height = bh;
        const ctx = cv.getContext("2d")!;
        const img = ctx.createImageData(bw, bh);
        // Composite the layer over a chosen background so its ALPHA is visible.
        // bg="check": a bright magenta/cyan checkerboard — anything showing
        // through the hull means the hull alpha is < 1 (the "see-through" bug).
        // bg="dark": the normal dark app bg.
        const bgAt = (x: number, y: number): [number, number, number] => {
          if (bg === "check") {
            const c = (((x >> 5) ^ (y >> 5)) & 1) === 1;
            return c ? [255, 0, 200] : [0, 220, 255];
          }
          return [7, 11, 20];
        };
        for (let y = 0; y < bh; y++) {
          const src = (bh - 1 - y) * bw * 4;
          const dst = y * bw * 4;
          for (let xp = 0; xp < bw; xp++) {
            const a = buf[src + xp * 4 + 3] / 255;
            const [br, bgc, bb] = bgAt(xp, y);
            img.data[dst + xp * 4] = buf[src + xp * 4] * a + br * (1 - a);
            img.data[dst + xp * 4 + 1] = buf[src + xp * 4 + 1] * a + bgc * (1 - a);
            img.data[dst + xp * 4 + 2] = buf[src + xp * 4 + 2] * a + bb * (1 - a);
            img.data[dst + xp * 4 + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
        return cv.toDataURL("image/png");
      },
      // EXPERIMENT: mutate the station hull materials live, then re-measure, to
      // find the values that kill the distant specular clipping before writing
      // anything into the render code. dRough/dEnv are deltas applied on top of
      // the authored values (clamped to [0,1] / [0,∞)).
      tweak: (setRough?: number, setEnv?: number) => {
        const grp = getWorldLayer()?.scene.getObjectByName("stationsGroup");
        if (!grp) return "no stationsGroup";
        let touched = 0;
        grp.traverse((c: THREE.Object3D) => {
          const m = (c as THREE.Mesh).material;
          if (!m) return;
          for (const mm of (Array.isArray(m) ? m : [m])) {
            const sm = mm as THREE.MeshStandardMaterial;
            if (!sm.isMeshStandardMaterial || sm.transparent) continue;
            if (setRough != null) sm.roughness = Math.max(0, Math.min(1, setRough));
            if (setEnv != null) sm.envMapIntensity = Math.max(0, setEnv);
            sm.needsUpdate = true;
            touched++;
          }
        });
        const far = lookStation(0.4), near = lookStation(1.0);
        return { touched, far, near };
      },
      // Dump the roughness/metalness/envMapIntensity distribution of the station
      // hull materials — the drivers of specular-highlight sharpness that clips
      // to hard white when the model is small on screen.
      // Dump the enemy hull material color/emissive/roughness — is the model
      // itself near-black, or is it the lighting?
      enemyMat: () => {
        const grp = getWorldLayer()?.scene.getObjectByName("enemyShipsGroup");
        if (!grp) return "no enemyShipsGroup";
        const rows: any[] = [];
        grp.traverse((c: any) => {
          const m = c.material;
          if (!m) return;
          for (const mm of (Array.isArray(m) ? m : [m])) {
            if (!mm.isMeshStandardMaterial) continue;
            const col = mm.color, em = mm.emissive;
            rows.push({
              name: c.name || "(unnamed)",
              color: [Math.round(col.r*255), Math.round(col.g*255), Math.round(col.b*255)],
              emissiveI: +(mm.emissiveIntensity ?? 0).toFixed(2),
              emissive: [Math.round(em.r*255), Math.round(em.g*255), Math.round(em.b*255)],
              rough: +mm.roughness.toFixed(2), metal: +mm.metalness.toFixed(2),
              env: +(mm.envMapIntensity ?? 1).toFixed(2),
            });
          }
        });
        return { count: rows.length, sample: rows.slice(0, 12) };
      },
      mats: () => {
        const grp = getWorldLayer()?.scene.getObjectByName("stationsGroup");
        if (!grp) return "no stationsGroup";
        const rows: { name: string; rough: number; metal: number; env: number; luma: number; color: number[]; ts: boolean }[] = [];
        grp.traverse((c: THREE.Object3D) => {
          const m = (c as THREE.Mesh).material;
          if (!m) return;
          const arr = Array.isArray(m) ? m : [m];
          for (const mm of arr) {
            const sm = mm as THREE.MeshStandardMaterial;
            if (sm.isMeshStandardMaterial) {
              const cl = sm.color;
              rows.push({
                name: c.name || "(unnamed)",
                rough: +sm.roughness.toFixed(2),
                metal: +sm.metalness.toFixed(2),
                env: +(sm.envMapIntensity ?? 1).toFixed(2),
                luma: 0.2126 * cl.r + 0.7152 * cl.g + 0.0722 * cl.b,
                color: [Math.round(cl.r * 255), Math.round(cl.g * 255), Math.round(cl.b * 255)],
                ts: sm.transparent,
              });
            }
          }
        });
        const n = rows.length;
        const avg = (k: "rough" | "metal" | "env" | "luma") => +(rows.reduce((s, r) => s + (r as any)[k], 0) / n).toFixed(3);
        return {
          count: n,
          avgRough: avg("rough"), avgMetal: avg("metal"), avgEnv: avg("env"),
          avgLuma: avg("luma"),
          minLuma: +Math.min(...rows.map((r: any) => r.luma)).toFixed(3),
          maxLuma: +Math.max(...rows.map((r: any) => r.luma)).toFixed(3),
          sample: rows.slice(0, 6),
        };
      },
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
