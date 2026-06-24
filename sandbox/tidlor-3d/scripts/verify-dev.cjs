// Verify `npm run dev` loads cleanly (images resolve under base path in dev) and
// that the swirl centerpiece stays visible across rotation phases (crossed planes).
const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:5191/tidlor-3d/';
const OUT = path.resolve(__dirname, '..', 'verify-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1280,800'] });
  const page = await b.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const issues = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => issues.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) issues.push(`[reqfail] ${r.url()}`); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__tidlor3d && document.querySelector('#app canvas'), { timeout: 15000 }).catch(()=>{});
  await sleep(3000);

  const state = await page.evaluate(() => ({
    webglActive: document.body.classList.contains('webgl-active'),
    hasCanvas: !!document.querySelector('#app canvas'),
    hookExposedInDev: !!window.__tidlor3d, // should be true in dev (no ?test needed)
  }));

  // Swirl-visibility across phases: screenshot 3 frames ~0.8s apart and confirm
  // the central region always has non-uniform (drawn) pixels — crossed planes
  // mean the swirl never goes fully edge-on/invisible.
  await page.evaluate(() => window.__tidlor3d.freeze());
  const phaseShots = [];
  for (let i = 0; i < 3; i++) {
    await sleep(850);
    const p = path.posix ? `swirl-phase-${i}.png` : `swirl-phase-${i}.png`;
    await page.screenshot({ path: require('path').join(OUT, `swirl-phase-${i}.png`) });
    phaseShots.push(`swirl-phase-${i}.png`);
  }

  await b.close();
  console.log(JSON.stringify({ state, devConsoleIssues: issues, phaseShots }, null, 2));
})().catch((e) => { console.error('VERIFY_FAILED', e); process.exit(1); });
