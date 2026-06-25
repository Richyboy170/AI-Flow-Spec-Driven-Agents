---
name: browser-journey-audit
description: Runs Playwright-backed runtime audits of web application navigation and user journeys before release. Use when validating complex apps, websites, pre-publish QA, final acceptance, broken navigation, failing forms, save/persistence bugs, auth redirects, checkout flows, or when a QA agent must prove real browser behavior instead of only reviewing code or unit tests.
---

# Browser Journey Audit

Run the product in a real browser, exercise user journeys, and produce evidence that the app works from the user's point of view. This skill is the QA gate for complicated websites and applications where static review, unit tests, and "page loads" checks miss broken navigation, silent button failures, failed saves, bad redirects, console errors, and first-party 4xx/5xx responses.

## Resolution Rules

- Bare paths and `{skill-root}` resolve from this skill directory.
- `{project-root}` resolves from the project working directory.
- Use `scripts/playwright_journey_probe.mjs` for repeatable browser evidence when the project has Playwright or `@playwright/test` installed.
- If Playwright is unavailable and installing packages is out of scope, use `browser-testing-with-devtools` for a manual browser pass and report that the repeatable Playwright gate could not run.

## Audit Workflow

### Discover The Runtime Surface

- Find the app root, package manager, dev/preview command, and existing Playwright config.
- Identify the base URL from the user, preview deployment, dev server, or `playwright.config.*` `baseURL`.
- Read PRD/story/spec/route files when present and list P0/P1 journeys. Do not rely on route names alone.
- Include desktop and mobile viewport coverage for responsive navigation or mobile-first apps.

### Build The Journey Inventory

Every browser app needs explicit coverage for any present P0/P1 flow:

| Flow type | Required checks |
|---|---|
| Navigation shell | landing page, main nav, deep links, back/forward, mobile menu |
| Auth | sign-up, sign-in, sign-out, protected-route redirect, OAuth/callback config review |
| Forms | validation, submit, loading state, success state, error state |
| CRUD/save | create/update/delete, reload persistence, duplicate-click/race behavior |
| Search/filter | query, empty state, sorting/filter reset, pagination |
| Checkout/payment | cart, totals, payment handoff/stub, order confirmation |
| Settings/preferences | save, reload persistence, cross-session if supported |
| Role/permission paths | authorized path works, unauthorized path denies safely |

Name each journey by the user outcome, not the implementation route. Example: `settings save persists after reload`.

### Run The Playwright Gate

Prefer explicit journey files. Put temporary or durable config in `qa/journeys.json`, `tests/e2e/journeys.json`, or a story-specific artifact path.

```bash
node .claude/skills/browser-journey-audit/scripts/playwright_journey_probe.mjs \
  --url http://localhost:3000 \
  --journeys qa/journeys.json \
  --out qa-artifacts/browser-journey-audit \
  --require-journeys
```

If no journey file exists yet, run route smoke discovery as a weaker baseline:

```bash
node .claude/skills/browser-journey-audit/scripts/playwright_journey_probe.mjs \
  --url http://localhost:3000 \
  --out qa-artifacts/browser-journey-audit \
  --max-pages 25
```

Treat route smoke as incomplete for final approval unless the application is static/read-only and has no business actions.

### Verify Runtime Evidence

For each journey, require:

- The expected success state renders, not merely "no crash".
- First-party network requests triggered by actions return expected non-error status codes.
- The console has no uncaught errors.
- Save/update flows survive reload.
- Navigation state, URL, and back/forward behavior match the spec.
- Screenshots or traces exist for failed states and final successful states.

### Triage Findings

Classify failures by user impact:

| Severity | Criteria |
|---|---|
| Blocker | P0 journey cannot complete, app blank screen, auth cannot return, checkout/save fails |
| Critical | Data loss, wrong-user or wrong-origin redirect, first-party 5xx on core action |
| High | Broken primary navigation, validation blocks valid input, reload loses committed state |
| Medium | Secondary route/action broken, non-blocking console error, degraded empty/error state |
| Low | Copy, cosmetic, or non-critical accessibility gap discovered during journey |

Do not downgrade a runtime failure because the code "looks right". The browser result is the product.

## Journey Config Reference

Read `references/journey-config.md` when authoring a journey file or extending the supported steps.

## Output Contract

Return a report with:

- Base URL, app command or deployment URL, viewport(s), and command run.
- Journey inventory with P0/P1 coverage and any skipped flows with concrete reasons.
- Artifact paths: `report.md`, `report.json`, screenshots, traces when present.
- Runtime findings ordered by severity with URL, step, console/network evidence, and reproduction notes.
- Approval verdict: `PASS`, `BLOCKED`, or `FAIL`.

## Approval Rules

- For complex/user-facing web apps, final QA cannot approve without a successful browser journey audit or an explicit `BLOCKED` report explaining why the app could not be run.
- A route smoke crawl is not enough for apps with auth, forms, saves, checkout, or multi-step workflows.
- A passing unit/integration suite does not replace this gate.
- If the app cannot be run locally, try the preview/staging URL. If neither exists, block release with the missing runtime dependency.
