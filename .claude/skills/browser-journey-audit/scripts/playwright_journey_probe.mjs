#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const DEFAULT_IGNORES = [
  '/favicon.ico',
  '\\.map$',
  '/_next/',
  '/@vite',
  '/node_modules/.vite',
  '/sockjs-node',
  'webpack-hmr',
  '/__vite_ping'
];

const BAD_TEXT_PATTERNS = [
  /Application error/i,
  /Unhandled Runtime Error/i,
  /Hydration failed/i,
  /Internal Server Error/i,
  /Cannot read properties of/i,
  /Could not save/i,
  /Please try again/i
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 }
};

function usage() {
  console.log(`Usage:
  node scripts/playwright_journey_probe.mjs --url http://localhost:3000 [options]

Options:
  --journeys <file>        JSON journey config
  --out <dir>              Output directory (default: qa-artifacts/browser-journey-audit)
  --max-pages <n>          Same-origin route smoke crawl limit (default: 20)
  --viewport <name>        desktop, mobile, tablet (default: desktop)
  --headed                 Run headed Chromium
  --timeout <ms>           Step timeout (default: 10000)
  --storage-state <file>   Playwright storageState file for authenticated checks
  --require-journeys       Fail when no explicit journeys are supplied
  --help                   Show this help
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--headed') args.headed = true;
    else if (token === '--require-journeys') args.requireJourneys = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) throw new Error(`Missing value for ${token}`);
      args[key] = next;
      i += 1;
    } else {
      throw new Error(`Unexpected argument: ${token}`);
    }
  }
  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeName(value) {
  return String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

function toAbsoluteUrl(baseURL, target) {
  if (!target) return baseURL;
  return new URL(target, baseURL).href;
}

function stripHash(url) {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.href;
}

function patternMatches(text, pattern) {
  try {
    return new RegExp(pattern).test(text);
  } catch {
    return text.includes(pattern);
  }
}

function shouldIgnoreUrl(url, options) {
  return options.ignoreURLPatterns.some((pattern) => patternMatches(url, pattern));
}

function isFirstParty(url, options) {
  try {
    const parsed = new URL(url);
    return options.firstPartyHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}

function makeMatcher(value, target = {}) {
  if (target.regex) return new RegExp(value, target.flags || 'i');
  return value;
}

function locatorFromTarget(page, target) {
  if (typeof target === 'string') return page.getByText(target);
  if (!target || typeof target !== 'object') throw new Error(`Invalid locator target: ${JSON.stringify(target)}`);
  const exact = Boolean(target.exact);
  if (target.css) return page.locator(target.css);
  if (target.testId) return page.getByTestId(target.testId);
  if (target.role) return page.getByRole(target.role, { name: target.name ? makeMatcher(target.name, target) : undefined, exact });
  if (target.label) return page.getByLabel(makeMatcher(target.label, target), { exact });
  if (target.placeholder) return page.getByPlaceholder(makeMatcher(target.placeholder, target), { exact });
  if (target.text) return page.getByText(makeMatcher(target.text, target), { exact });
  throw new Error(`Unsupported locator target: ${JSON.stringify(target)}`);
}

function targetWithoutKeys(source, keys) {
  const result = { ...source };
  for (const key of keys) delete result[key];
  return result;
}

async function loadPlaywright(cwd) {
  const requireFromProject = createRequire(path.join(cwd, 'package.json'));
  for (const pkg of ['playwright', '@playwright/test']) {
    try {
      const loaded = requireFromProject(pkg);
      if (loaded.chromium) return loaded;
    } catch {
      // Try the next package.
    }
  }
  throw new Error(
    'Playwright is not installed for this project. Install playwright or @playwright/test, or use browser-testing-with-devtools as a manual fallback.'
  );
}

async function settle(page, timeout) {
  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: Math.min(timeout, 3000) }).catch(() => {});
}

async function inspectRuntimeText(page) {
  const bodyText = await page.locator('body').innerText({ timeout: 1500 }).catch(() => '');
  const matched = BAD_TEXT_PATTERNS.find((pattern) => pattern.test(bodyText));
  return {
    bodyTextChars: bodyText.length,
    badText: matched ? String(matched) : null
  };
}

async function collectLinks(page, baseURL, options) {
  const raw = await page.$$eval('a[href]', (anchors) =>
    anchors.map((anchor) => ({
      href: anchor.href,
      text: (anchor.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100)
    }))
  );
  const base = new URL(baseURL);
  const links = [];
  const seen = new Set();
  for (const link of raw) {
    let parsed;
    try {
      parsed = new URL(link.href);
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) continue;
    if (parsed.origin !== base.origin) continue;
    if (shouldIgnoreUrl(parsed.href, options)) continue;
    parsed.hash = '';
    const href = parsed.href;
    if (!seen.has(href)) {
      seen.add(href);
      links.push({ href, text: link.text });
    }
  }
  return links;
}

async function createObservedPage(context, scope, options) {
  const page = await context.newPage();
  const events = [];

  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error') {
      events.push({ severity: 'fail', source: 'console', scope, type, text: message.text() });
    } else if (type === 'warning' || type === 'warn') {
      events.push({ severity: 'warn', source: 'console', scope, type, text: message.text() });
    }
  });

  page.on('pageerror', (error) => {
    events.push({ severity: 'fail', source: 'pageerror', scope, text: error.message });
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!isFirstParty(url, options) || shouldIgnoreUrl(url, options)) return;
    events.push({
      severity: 'fail',
      source: 'requestfailed',
      scope,
      method: request.method(),
      url,
      text: request.failure()?.errorText || 'request failed'
    });
  });

  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    if (status < 400) return;
    if (!isFirstParty(url, options) || shouldIgnoreUrl(url, options)) return;
    events.push({
      severity: 'fail',
      source: 'response',
      scope,
      method: response.request().method(),
      status,
      url,
      text: `HTTP ${status}`
    });
  });

  return { page, events };
}

async function scanPage(context, url, index, report, options) {
  const { page, events } = await createObservedPage(context, `route:${url}`, options);
  const pageReport = { url, ok: true, title: '', status: null, links: 0, events: [], screenshot: null };
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeout });
    await settle(page, options.timeout);
    pageReport.status = response ? response.status() : null;
    pageReport.title = await page.title();
    const runtime = await inspectRuntimeText(page);
    pageReport.bodyTextChars = runtime.bodyTextChars;
    if (runtime.badText) {
      events.push({ severity: 'fail', source: 'page-text', scope: `route:${url}`, text: `Matched ${runtime.badText}` });
    }
    const screenshot = path.join(options.outDir, 'screenshots', `${String(index).padStart(2, '0')}-${sanitizeName(new URL(url).pathname || 'home')}.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    pageReport.screenshot = path.relative(options.outDir, screenshot);
    const links = await collectLinks(page, options.baseURL, options);
    pageReport.links = links.length;
    pageReport.discoveredLinks = links;
  } catch (error) {
    events.push({ severity: 'fail', source: 'route', scope: `route:${url}`, text: error.message });
  } finally {
    pageReport.events = events;
    pageReport.ok = !events.some((event) => event.severity === 'fail');
    await page.close().catch(() => {});
  }
  report.pages.push(pageReport);
  return pageReport;
}

async function runRouteSmoke(context, report, options) {
  const queue = [stripHash(options.baseURL)];
  const seen = new Set();
  let index = 0;

  while (queue.length && seen.size < options.maxPages) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    index += 1;
    const pageReport = await scanPage(context, url, index, report, options);
    for (const link of pageReport.discoveredLinks || []) {
      const href = stripHash(link.href);
      if (!seen.has(href) && queue.length + seen.size < options.maxPages) queue.push(href);
    }
  }
}

async function expectValue(locator, expected, timeout) {
  const deadline = Date.now() + timeout;
  let actual = '';
  while (Date.now() < deadline) {
    actual = await locator.inputValue().catch(() => '');
    if (actual === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Expected input value ${JSON.stringify(expected)} but saw ${JSON.stringify(actual)}`);
}

async function executeStep(page, step, options) {
  if (step.goto) {
    await page.goto(toAbsoluteUrl(options.baseURL, step.goto), { waitUntil: 'domcontentloaded', timeout: options.timeout });
  } else if (step.click) {
    await locatorFromTarget(page, step.click).click({ timeout: options.timeout });
  } else if (step.fill) {
    const locator = locatorFromTarget(page, targetWithoutKeys(step.fill, ['value']));
    await locator.fill(String(step.fill.value ?? ''), { timeout: options.timeout });
  } else if (step.select) {
    const locator = locatorFromTarget(page, targetWithoutKeys(step.select, ['value']));
    await locator.selectOption(String(step.select.value), { timeout: options.timeout });
  } else if (step.check) {
    await locatorFromTarget(page, step.check).check({ timeout: options.timeout });
  } else if (step.press) {
    const key = step.press.key;
    if (!key) throw new Error('press step requires key');
    const target = targetWithoutKeys(step.press, ['key']);
    if (Object.keys(target).length) await locatorFromTarget(page, target).press(key, { timeout: options.timeout });
    else await page.keyboard.press(key);
  } else if (step.expectVisible) {
    await locatorFromTarget(page, step.expectVisible).waitFor({ state: 'visible', timeout: options.timeout });
  } else if (step.expectHidden) {
    await locatorFromTarget(page, step.expectHidden).waitFor({ state: 'hidden', timeout: options.timeout });
  } else if (step.expectText) {
    const target = typeof step.expectText === 'string' ? { text: step.expectText } : step.expectText;
    await locatorFromTarget(page, target).waitFor({ state: 'visible', timeout: options.timeout });
  } else if (step.expectURL) {
    const expected = typeof step.expectURL === 'object' && step.expectURL.regex
      ? new RegExp(step.expectURL.value, step.expectURL.flags || '')
      : step.expectURL;
    await page.waitForURL(expected, { timeout: options.timeout });
  } else if (step.expectValue) {
    const locator = locatorFromTarget(page, targetWithoutKeys(step.expectValue, ['value']));
    await expectValue(locator, String(step.expectValue.value ?? ''), options.timeout);
  } else if (step.reload) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: options.timeout });
  } else if (step.back) {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: options.timeout });
  } else if (step.forward) {
    await page.goForward({ waitUntil: 'domcontentloaded', timeout: options.timeout });
  } else if (step.screenshot) {
    const screenshot = path.join(options.outDir, 'screenshots', `${sanitizeName(step.screenshot)}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
  } else if (step.wait) {
    await new Promise((resolve) => setTimeout(resolve, Number(step.wait)));
  } else {
    throw new Error(`Unsupported step: ${JSON.stringify(step)}`);
  }
}

function describeStep(step) {
  const key = Object.keys(step)[0] || 'unknown';
  return `${key}: ${JSON.stringify(step[key])}`;
}

async function runJourney(context, journey, index, report, options) {
  const viewport = VIEWPORTS[journey.viewport] || options.viewport;
  const journeyOptions = { ...options, viewport };
  const journeyReport = {
    name: journey.name || `journey ${index}`,
    priority: journey.priority || 'P1',
    viewport: journey.viewport || options.viewportName,
    ok: true,
    steps: [],
    events: [],
    screenshot: null
  };

  const pageContext = viewport === options.viewport
    ? context
    : await context.browser().newContext({ baseURL: options.baseURL, viewport, storageState: options.storageState });
  const { page, events } = await createObservedPage(pageContext, `journey:${journeyReport.name}`, journeyOptions);

  try {
    for (let i = 0; i < (journey.steps || []).length; i += 1) {
      const step = journey.steps[i];
      const stepReport = { index: i + 1, action: describeStep(step), ok: true };
      try {
        await executeStep(page, step, journeyOptions);
        await settle(page, journeyOptions.timeout);
        const runtime = await inspectRuntimeText(page);
        if (runtime.badText) throw new Error(`Visible runtime failure text matched ${runtime.badText}`);
      } catch (error) {
        stepReport.ok = false;
        stepReport.error = error.message;
        events.push({
          severity: 'fail',
          source: 'step',
          scope: `journey:${journeyReport.name}`,
          step: i + 1,
          text: error.message
        });
        journeyReport.steps.push(stepReport);
        break;
      }
      journeyReport.steps.push(stepReport);
    }

    const screenshot = path.join(options.outDir, 'screenshots', `${String(index).padStart(2, '0')}-${sanitizeName(journeyReport.name)}.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    journeyReport.screenshot = path.relative(options.outDir, screenshot);
  } finally {
    journeyReport.events = events;
    journeyReport.ok = !events.some((event) => event.severity === 'fail') &&
      journeyReport.steps.length === (journey.steps || []).length;
    await page.close().catch(() => {});
    if (pageContext !== context) await pageContext.close().catch(() => {});
  }

  report.journeys.push(journeyReport);
}

function summarize(report) {
  const failures = [];
  const warnings = [];
  for (const page of report.pages) {
    for (const event of page.events || []) {
      if (event.severity === 'fail') failures.push({ area: 'route', url: page.url, ...event });
      if (event.severity === 'warn') warnings.push({ area: 'route', url: page.url, ...event });
    }
  }
  for (const journey of report.journeys) {
    for (const event of journey.events || []) {
      if (event.severity === 'fail') failures.push({ area: 'journey', journey: journey.name, ...event });
      if (event.severity === 'warn') warnings.push({ area: 'journey', journey: journey.name, ...event });
    }
  }
  report.failures = failures;
  report.warnings = warnings;
  report.summary = {
    pagesScanned: report.pages.length,
    journeysRun: report.journeys.length,
    failedPages: report.pages.filter((page) => !page.ok).length,
    failedJourneys: report.journeys.filter((journey) => !journey.ok).length,
    failures: failures.length,
    warnings: warnings.length,
    verdict: failures.length ? 'FAIL' : 'PASS'
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Browser Journey Audit');
  lines.push('');
  lines.push(`- Base URL: ${report.baseURL}`);
  lines.push(`- Started: ${report.startedAt}`);
  lines.push(`- Verdict: ${report.summary.verdict}`);
  lines.push(`- Pages scanned: ${report.summary.pagesScanned}`);
  lines.push(`- Journeys run: ${report.summary.journeysRun}`);
  lines.push(`- Failures: ${report.summary.failures}`);
  lines.push(`- Warnings: ${report.summary.warnings}`);
  lines.push('');

  if (report.failures.length) {
    lines.push('## Failures');
    for (const failure of report.failures) {
      const where = failure.journey || failure.url || failure.scope || 'unknown';
      const detail = failure.status ? `${failure.text} ${failure.url || ''}` : failure.text;
      lines.push(`- [${failure.source}] ${where}: ${detail}`);
    }
    lines.push('');
  }

  if (report.journeys.length) {
    lines.push('## Journeys');
    lines.push('| Journey | Priority | Viewport | Result | Screenshot |');
    lines.push('|---|---:|---|---|---|');
    for (const journey of report.journeys) {
      lines.push(`| ${journey.name} | ${journey.priority} | ${journey.viewport} | ${journey.ok ? 'PASS' : 'FAIL'} | ${journey.screenshot || ''} |`);
    }
    lines.push('');
  }

  if (report.pages.length) {
    lines.push('## Route Smoke');
    lines.push('| URL | Status | Result | Screenshot |');
    lines.push('|---|---:|---|---|');
    for (const page of report.pages) {
      lines.push(`| ${page.url} | ${page.status ?? ''} | ${page.ok ? 'PASS' : 'FAIL'} | ${page.screenshot || ''} |`);
    }
    lines.push('');
  }

  if (report.warnings.length) {
    lines.push('## Warnings');
    for (const warning of report.warnings) {
      const where = warning.journey || warning.url || warning.scope || 'unknown';
      lines.push(`- [${warning.source}] ${where}: ${warning.text}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return 0;
  }

  const config = args.journeys ? readJson(args.journeys) : {};
  const baseURL = args.url || config.baseURL;
  if (!baseURL) throw new Error('Missing --url or config.baseURL');

  const outDir = path.resolve(args.out || 'qa-artifacts/browser-journey-audit');
  ensureDir(outDir);
  ensureDir(path.join(outDir, 'screenshots'));

  const journeys = Array.isArray(config.journeys) ? config.journeys : [];
  const report = {
    startedAt: new Date().toISOString(),
    baseURL,
    journeyFile: args.journeys ? path.resolve(args.journeys) : null,
    pages: [],
    journeys: [],
    warnings: [],
    failures: []
  };

  if (args.requireJourneys && journeys.length === 0) {
    report.failures.push({
      area: 'setup',
      source: 'journey-config',
      text: 'Explicit journeys are required but no journeys were supplied.'
    });
    report.summary = {
      pagesScanned: 0,
      journeysRun: 0,
      failedPages: 0,
      failedJourneys: 0,
      failures: 1,
      warnings: 0,
      verdict: 'FAIL'
    };
    fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    const markdown = renderMarkdown(report);
    fs.writeFileSync(path.join(outDir, 'report.md'), markdown);
    console.log(markdown);
    return 1;
  }

  const parsedBase = new URL(baseURL);
  const options = {
    baseURL,
    outDir,
    maxPages: Number(args.maxPages || config.maxPages || 20),
    timeout: Number(args.timeout || config.timeout || 10000),
    viewportName: args.viewport || config.viewport || 'desktop',
    viewport: VIEWPORTS[args.viewport || config.viewport || 'desktop'] || VIEWPORTS.desktop,
    storageState: args.storageState || config.storageState,
    ignoreURLPatterns: [...DEFAULT_IGNORES, ...(config.ignoreURLPatterns || [])],
    firstPartyHosts: new Set(config.firstPartyHosts || [parsedBase.hostname])
  };

  const playwright = await loadPlaywright(process.cwd());
  const browser = await playwright.chromium.launch({ headless: !args.headed });
  const context = await browser.newContext({
    baseURL,
    viewport: options.viewport,
    storageState: options.storageState
  });

  try {
    for (let i = 0; i < journeys.length; i += 1) {
      await runJourney(context, journeys[i], i + 1, report, options);
    }
    if (!journeys.length || config.runRouteSmoke) {
      await runRouteSmoke(context, report, options);
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  summarize(report);
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(report));
  console.log(renderMarkdown(report));
  return report.summary.verdict === 'PASS' ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`browser-journey-audit failed: ${error.message}`);
    process.exit(2);
  });
