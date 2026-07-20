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
    if (!lt || !app) return { error: 'not exposed' };
    const gl = app.renderer.gl;

    // JS-side index buffer (what we THINK is uploaded)
    const jsIndices = lt.mesh.geometry.indexBuffer.data;
    const jsFirst24 = Array.from(jsIndices.slice(0, 24));

    // GPU-side: bind the actual index buffer and read it back via getBufferSubData (WebGL2 only)
    // Check WebGL version first
    const isWebGL2 = gl instanceof WebGL2RenderingContext;

    let gpuFirst24 = null;
    if (isWebGL2) {
      const CONTEXT_UID = app.renderer.CONTEXT_UID;
      const glBufferInfo = lt.mesh.geometry.indexBuffer._glBuffers[CONTEXT_UID];
      if (glBufferInfo) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glBufferInfo.buffer);
        const readback = new Uint16Array(24);
        gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, readback);
        gpuFirst24 = Array.from(readback);
      }
    }

    return { isWebGL2, jsFirst24, gpuFirst24, jsIndicesLength: jsIndices.length, jsIndicesType: jsIndices.constructor.name };
  });
  console.log('INDEX BUFFER CHECK:', JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
