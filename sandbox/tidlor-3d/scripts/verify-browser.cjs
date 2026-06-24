/* Headless browser verification of the running preview build.
 * Drives system Chrome via puppeteer-core. Tests:
 *  A) 3D scene renders without console errors (WebGL via SwiftShader)
 *  B) each of 4 hotspots opens the correct learning card (clicks projected positions)
 *  C) static fallback shows all four areas when WebGL is forced off
 */
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:4185/tidlor-3d/';
const OUT = path.resolve(__dirname, '..', 'verify-shots');
require('fs').mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXPECT = { brand: '01', products: '02', story: '03', apply: '04' };

function attachConsole(page, sink) {
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') sink.push(`[${t}] ${m.text()}`);
  });
  page.on('pageerror', (e) => sink.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.includes('fonts.g')) return;
    sink.push(`[reqfail] ${u} ${r.failure() && r.failure().errorText}`);
  });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1280,800'],
  });
  const results = {};

  // ---------- A + B ----------
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    const logs = [];
    attachConsole(page, logs);
    await page.goto(BASE + '?test', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // wait until the scene hook is exposed (3D mounted)
    await page.waitForFunction(() => window.__tidlor3d && document.querySelector('#app canvas'), { timeout: 15000 }).catch(() => {});
    await sleep(2500);

    results.A = {
      webglActive: await page.evaluate(() => document.body.classList.contains('webgl-active')),
      hasCanvas: await page.evaluate(() => !!document.querySelector('#app canvas')),
      fallbackHidden: await page.evaluate(() => getComputedStyle(document.getElementById('fallback')).display === 'none'),
      hasSceneHook: await page.evaluate(() => !!window.__tidlor3d),
      consoleIssues: logs.slice(),
    };
    await page.screenshot({ path: path.join(OUT, '3d-scene.png') });

    // B: freeze auto-rotate, project hotspot positions, click each, read card num
    await page.evaluate(() => window.__tidlor3d.freeze());
    await sleep(300);
    const positions = await page.evaluate(() => window.__tidlor3d.getHotspotScreenPositions());
    const opened = [];
    for (const p of positions) {
      // click directly on the projected crystal pixel
      await page.mouse.move(p.x, p.y);
      await sleep(80);
      await page.mouse.click(p.x, p.y);
      await sleep(220);
      const card = await page.evaluate(() => {
        const s = document.querySelector('.ui-card-scrim.open');
        if (!s) return null;
        return { num: s.querySelector('.ui-card-num')?.textContent || '', title: s.querySelector('h2')?.textContent || '' };
      });
      opened.push({ key: p.key, expectedNum: EXPECT[p.key], got: card });
      await page.keyboard.press('Escape');
      await sleep(180);
    }
    const allCorrect = opened.every((o) => o.got && o.got.num === o.expectedNum);
    results.B = { positions, opened, allCorrect };
    await page.close();
  }

  // ---------- C ----------
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    const logs = [];
    attachConsole(page, logs);
    await page.goto(BASE + '?nowebgl=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1200);
    const data = await page.evaluate(() => ({
      visible: getComputedStyle(document.getElementById('fallback')).display !== 'none',
      headings: [...document.querySelectorAll('.fb-card h2')].map((h) => h.textContent.trim()),
      webglActive: document.body.classList.contains('webgl-active'),
      logoSrc: document.querySelector('.fb-logo')?.getAttribute('src') || '',
      status: document.getElementById('fb-status')?.textContent.trim() || '',
    }));
    await page.screenshot({ path: path.join(OUT, 'fallback.png'), fullPage: true });
    results.C = { ...data, consoleIssues: logs.slice() };
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => { console.error('VERIFY_FAILED', e); process.exit(1); });
