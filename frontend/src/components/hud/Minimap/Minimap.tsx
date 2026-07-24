import { useEffect, useRef } from "react";
import styles from "./Minimap.module.css";

export type MinimapBlipKind = "ally" | "hostile" | "neutral" | "objective" | "resource" | "loot";

export type MinimapBlipData = {
  /** Position within the scan circle, 0-100 on both axes (50/50 = center). */
  x: number;
  y: number;
  kind: MinimapBlipKind;
  title?: string;
};

export type MinimapProps = {
  zoneName: string;
  coords?: string;
  blips?: MinimapBlipData[];
};

const SWEEP_PERIOD_S = 4.5;

/** Angle (0deg = 12 o'clock, clockwise) from the scan circle's center to a
 *  blip at (x, y) percent -- matches .scanSweep's own conic-gradient,
 *  which starts "from 0deg" at 12 o'clock and sweeps clockwise. Used to
 *  time each blip's scan-flash so it lights up exactly when the rotating
 *  beam passes over it. */
function angleOf(x: number, y: number): number {
  const dx = x - 50;
  const dy = y - 50;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

// Blip colors come from the HUD tokens so the canvas stays in sync with the
// design system (same vars the old DOM blips used).
const BLIP_COLOR_VARS: Record<MinimapBlipKind, string> = {
  ally: "--hud-green",
  hostile: "--hud-hp",
  neutral: "--hud-energy",
  objective: "--hud-magenta",
  resource: "--hud-gold",
  loot: "--hud-violet",
};

/**
 * Blips as ONE canvas instead of one DOM div per entity.
 *
 * Perf: with 100-200 NPCs the old per-blip divs (each with an ::after blur,
 * a box-shadow glow and 1-2 infinite CSS animations) dominated the whole
 * game's frame time — measured 17.4ms/frame at 200 NPCs, dropping to
 * 5.1ms with the DOM blips hidden. A single small canvas draws the same
 * visuals (dot + glow, hostile pulse, sweep-synced scan flash) for a few
 * hundred microseconds.
 */
function BlipCanvas({ blips }: { blips: MinimapBlipData[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blipsRef = useRef(blips);
  blipsRef.current = blips;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colors: Partial<Record<MinimapBlipKind, string>> = {};
    const cs = getComputedStyle(canvas);
    (Object.keys(BLIP_COLOR_VARS) as MinimapBlipKind[]).forEach((k) => {
      colors[k] = cs.getPropertyValue(BLIP_COLOR_VARS[k]).trim() || "#4ee2ff";
    });

    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(rect.width * dpr);
      const H = Math.round(rect.height * dpr);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.clearRect(0, 0, W, H);

      const t = now / 1000;
      const sweepDeg = ((t % SWEEP_PERIOD_S) / SWEEP_PERIOD_S) * 360;
      // matches the old .blipHostile mm-pulse-critical keyframes (1 -> 0.45)
      const hostilePulse = reducedMotion ? 1 : 0.725 + 0.275 * Math.cos((2 * Math.PI * t) / 1.4);

      for (const b of blipsRef.current) {
        const x = (b.x / 100) * W;
        const y = (b.y / 100) * H;
        const c = colors[b.kind] ?? "#4ee2ff";
        const r = (b.kind === "resource" ? 2 : 3) * dpr;

        ctx.globalAlpha = b.kind === "hostile" ? hostilePulse : b.kind === "resource" ? 0.85 : 1;
        ctx.shadowColor = c;
        ctx.shadowBlur = 5 * dpr;
        ctx.fillStyle = c;
        if (b.kind === "objective" || b.kind === "loot") {
          // 45deg-rotated square (old .blipObjective/.blipLoot look)
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-r, -r, r * 2, r * 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // "Being scanned" flash exactly when the rotating beam passes over
        // this blip (old .blipScanFlash), fading out behind the beam.
        if (!reducedMotion) {
          const diff = (sweepDeg - angleOf(b.x, b.y) + 360) % 360;
          if (diff < 25) {
            const k = 1 - diff / 25;
            const fr = 10 * dpr;
            ctx.globalAlpha = 0.9 * k;
            ctx.shadowBlur = 0;
            const g = ctx.createRadialGradient(x, y, 0, x, y, fr);
            g.addColorStop(0, "rgba(255,255,255,0.9)");
            g.addColorStop(0.7, "rgba(255,255,255,0)");
            g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, fr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className={styles.blipCanvas} />;
}

/**
 * Minimap — Formfamily E (radar console). Same octagonal chamfered shell,
 * glow rim, PCB veins and noise grain as the Hotbar, housing a recessed
 * circular scan window with a rotating sweep and position blips.
 */
export function Minimap({ zoneName, coords, blips = [] }: MinimapProps) {
  return (
    <div className={`${styles.consoleWrap} hud-interactive`}>
      <div className={`${styles.console} panel`}>
        <span className="panel-rim" />

        <div className={styles.zoneDisplayCollar}>
          <div className={styles.zoneDisplay}>
            <span className={styles.zoneDisplayText}>{zoneName}</span>
          </div>
        </div>

        <div className={styles.header}>{coords && <span className={styles.coords}>{coords}</span>}</div>

        <div className={styles.scanCollarWrap}>
          <div className={styles.scanWindow}>
            <div className={styles.scanGrid} />
            <div className={styles.scanRing} />
            <div className={styles.scanSweep} />
            <BlipCanvas blips={blips} />
            <div className={styles.scanCenter} />
            <div className={styles.scanVignette} />
          </div>
          <div className={styles.scanRimLight} />
        </div>

        <div className={styles.footer}>
          <span className={styles.footerTick} />
          <span className={styles.footerLabel}>Sensor Range 1.2km</span>
          <span className={styles.footerTick} />
        </div>
      </div>
    </div>
  );
}
