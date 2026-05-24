#!/usr/bin/env python3
"""
Migrate Cosmic Realm from Canvas 2D to PixiJS WebGL renderer.
- Modifies App.tsx to use PixiJS renderer
- pixi-renderer.ts is already in place
"""

import re

print("═══ Migrating to PixiJS WebGL ═══")

# ═══════════════════════════════════════════════════════════════════════════
# 1. Modify App.tsx - Replace Canvas 2D with PixiJS
# ═══════════════════════════════════════════════════════════════════════════
with open('frontend/src/App.tsx', 'r') as f:
    app = f.read()

# Add PixiJS renderer import
old_render_import = 'import { render } from "./game/render";'
new_render_import = '''import { initPixi, pixiRender, destroyPixi } from "./game/pixi-renderer";
// import { render } from "./game/render"; // Legacy Canvas 2D renderer'''

app = app.replace(old_render_import, new_render_import)
print("  -> Updated imports to use pixi-renderer")

# Replace the GameCanvas component
old_canvas_component = '''function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    startLoop();
    return () => stopLoop();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      render(ctx, w, h);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);'''

new_canvas_component = '''function GameCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    startLoop();
    return () => stopLoop();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    initPixi(container);

    let raf = 0;
    const draw = () => {
      pixiRender();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      destroyPixi();
    };
  }, []);'''

app = app.replace(old_canvas_component, new_canvas_component)
print("  -> Replaced Canvas 2D setup with PixiJS initialization")

# Replace the canvas element with a div container
# Find the canvas JSX element and replace it
old_canvas_jsx = '<canvas\n        ref={canvasRef}'
new_canvas_jsx = '<div\n        ref={containerRef}'

if old_canvas_jsx in app:
    app = app.replace(old_canvas_jsx, new_canvas_jsx)
    print("  -> Replaced <canvas> with <div> container for PixiJS")
else:
    # Try alternate formatting
    old_canvas_jsx2 = 'ref={canvasRef}'
    new_canvas_jsx2 = 'ref={containerRef}'
    app = app.replace(old_canvas_jsx2, new_canvas_jsx2)
    # Also change canvas to div
    # Find the canvas tag around the ref
    app = re.sub(r'<canvas(\s)', r'<div\1', app)
    app = re.sub(r'/canvas>', r'/div>', app)
    print("  -> Replaced <canvas> with <div> container for PixiJS")

with open('frontend/src/App.tsx', 'w') as f:
    f.write(app)

print("\nDONE!")
print("  - App.tsx now uses PixiJS renderer instead of Canvas 2D")
print("  - pixi-renderer.ts handles all WebGL rendering")
print("  - Canvas 2D render.ts is kept as reference (import commented out)")
