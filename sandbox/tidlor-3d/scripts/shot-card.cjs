// Capture one open learning card over the 3D scene for the delivery digest.
const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://127.0.0.1:4180/tidlor-3d/';
const OUT = path.resolve(__dirname, '..', 'verify-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1280,800'] });
  const page = await b.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__tidlor3d && document.querySelector('#app canvas'), { timeout: 15000 }).catch(()=>{});
  await sleep(2500);
  await page.evaluate(() => window.__tidlor3d.freeze());
  await sleep(300);
  const pos = await page.evaluate(() => window.__tidlor3d.getHotspotScreenPositions());
  const brand = pos.find((p) => p.key === 'brand');
  await page.mouse.click(brand.x, brand.y);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'card-open.png') });
  await b.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
