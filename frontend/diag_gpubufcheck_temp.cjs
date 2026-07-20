const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', () => {});
  await page.goto('https://cosmicrealm.net', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);
  const uname = 'vfxdiag_' + Math.random().toString(36).slice(2, 8);
  const regResult = await page.evaluate(async (username) => {
    const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email: username + '@example.com', password: 'TempTest12345!', pilotName: username }) });
    const data = await res.json();
    if (!res.ok) return { ok: false };
    localStorage.setItem('cosmic-token', data.token);
    return { ok: true };
  }, uname);
  if (!regResult.ok) { await browser.close(); process.exit(1); }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await page.getByText('EARTH IMPERIAL', { exact: false }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    const lt = window.__starblastLaserticles;
    const app = window.__pixiApp;
    const wl = window.__worldLayer;
    if (!lt || !app || !wl) return { error: 'not exposed' };
    const gl = app.renderer.gl;
    const CONTEXT_UID = app.renderer.CONTEXT_UID;

    const camX = wl.pivot.x, camY = wl.pivot.y;
    lt.addLaser({ x: camX, y: camY, z: 0, vx: 0, vy: 0, angle: 0,
      spawnTime: lt.mesh.shader.uniforms.uNow, speed: 0, damage: 80, type: 0,
      lifetimeFrames: 6000, colorHex: 0xffffff }, { coreIndex: 0, trailIndex: 0 });
    lt.tick(lt.mesh.shader.uniforms.uNow);

    // Read back aPosition buffer directly from GPU (buffers[0] per geometry.buffers ordering)
    const posBufferObj = lt.mesh.geometry.buffers[0];
    const glBufferInfo = posBufferObj._glBuffers[CONTEXT_UID];
    let gpuPositions = null;
    if (glBufferInfo) {
      gl.bindBuffer(gl.ARRAY_BUFFER, glBufferInfo.buffer);
      const readback = new Float32Array(12); // first 4 vertices x,y,z
      gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readback);
      gpuPositions = Array.from(readback);
    }

    // Also check aSize buffer
    const sizeBufferObj = lt.mesh.geometry.getBuffer('aSize');
    const sizeGlInfo = sizeBufferObj._glBuffers[CONTEXT_UID];
    let gpuSizes = null;
    if (sizeGlInfo) {
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeGlInfo.buffer);
      const readback = new Float32Array(4);
      gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readback);
      gpuSizes = Array.from(readback);
    }

    return {
      jsPositions: [lt.positions[0], lt.positions[1], lt.positions[2], lt.positions[3], lt.positions[4], lt.positions[5]],
      gpuPositions,
      jsSizes: [lt.sizes[0], lt.sizes[1], lt.sizes[2], lt.sizes[3]],
      gpuSizes,
    };
  });
  console.log('GPU BUFFER VERIFY:', JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
