// Isolated native-PixiJS UI harness — open with ?pixi-ui-test.
//
// The real HUD only mounts after login inside the full renderer. This harness
// spins up a bare PixiJS Application with just the UI layer tree + components,
// so the native UI can be built and verified WITHOUT a login or the game world.
// It mirrors the in-game mount path (createUiLayers → sections) against fake
// state, so what looks right here looks right in-game.
import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { createUiLayers, destroyUiLayers } from "../game/hud/layers";
import { COLOR } from "../game/hud/theme";
import { HealthShieldBar } from "../game/hud/primitives/HealthShieldBar";
import { CosmicWindow } from "../game/hud/primitives/CosmicWindow";

export default function PixiUiTest() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new PIXI.Application({
      resizeTo: host,
      backgroundColor: 0x05070d,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    PIXI.settings.ROUND_PIXELS = true;
    host.appendChild(app.view as HTMLCanvasElement);

    // Same layer tree the game mounts into uiLayer.
    const layers = createUiLayers(app.stage);

    const label = (txt: string, x: number, y: number, col = COLOR.textDim) => {
      const t = new PIXI.Text(txt, { fontFamily: "monospace", fontSize: 11, fill: col, letterSpacing: 2 });
      t.position.set(x, y);
      layers.hud.addChild(t);
      return t;
    };

    // ── Procedural atlas frame (base metal + tintable emissive), NineSlice ──
    // A large window (cyan), a wide combat panel with the bar inside (cyan),
    // and a small elite panel (gold) — proving the SAME frame scales + retints.
    label("PROCEDURAL ATLAS · CosmicWindow", 60, 60, COLOR.textBright);

    const winL = new CosmicWindow({ w: 300, h: 380, accent: COLOR.cyan });
    winL.container.position.set(60, 84);
    layers.window.addChild(winL.container);
    label("WINDOW · cyan", 60, 472);

    const combat = new CosmicWindow({ w: 400, h: 150, accent: COLOR.cyan });
    combat.container.position.set(400, 84);
    layers.window.addChild(combat.container);
    label("COMBAT PANEL", 400, 60, COLOR.textBright);
    const bar = new HealthShieldBar();
    bar.container.position.set(48, 40);      // inside the frame's recess
    combat.content.addChild(bar.container);

    const elite = new CosmicWindow({ w: 260, h: 110, accent: COLOR.gold });
    elite.container.position.set(400, 260);
    layers.window.addChild(elite.container);
    label("ELITE · gold accent", 400, 380);

    let t = 0;
    const tick = (delta: number) => {
      const dt = delta / 60;
      t += dt;
      winL.update(dt); combat.update(dt); elite.update(dt);
      const fire = (t % 2) / 2;
      bar.set({ hull: 82, hullMax: 100, shield: 68, shieldMax: 80, fireReady: fire });
      bar.update(dt);
    };
    app.ticker.add(tick);

    return () => {
      app.ticker.remove(tick);
      winL.destroy(); combat.destroy(); elite.destroy(); bar.destroy();
      destroyUiLayers();
      app.destroy(true, { children: true });
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#05070d" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      <div style={{
        position: "absolute", top: 10, left: 12, font: "11px monospace",
        color: "#8aa0c0", letterSpacing: "0.12em", pointerEvents: "none",
      }}>
        ?pixi-ui-test — native PixiJS UI harness (no login)
      </div>
    </div>
  );
}
