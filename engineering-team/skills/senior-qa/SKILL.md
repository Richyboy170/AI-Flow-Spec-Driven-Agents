---
name: "senior-qa"
description: Generates unit tests, integration tests, E2E tests, and Playwright-backed browser journey audits for React/Next.js applications. Scans components to create Jest + React Testing Library test stubs, analyzes Istanbul/LCOV coverage reports, scaffolds Playwright test files from routes, runs pre-publish user journey verification for navigation/forms/saves/auth/checkout, captures console/network failures, and configures test runners. Use when the user asks to "generate tests", "write unit tests", "analyze test coverage", "scaffold E2E tests", "set up Playwright", "run browser QA", "audit user journeys", "pre-publish QA", "verify navigation", "detect website failures", "configure Jest", "implement testing patterns", or "improve test quality".
---

# Senior QA Engineer

Test automation, coverage analysis, and quality assurance patterns for React and Next.js applications.

---

## Quick Start

```bash
# Generate Jest test stubs for React components
python scripts/test_suite_generator.py src/components/ --output __tests__/

# Analyze test coverage from Jest/Istanbul reports
python scripts/coverage_analyzer.py coverage/coverage-final.json --threshold 80

# Scaffold Playwright E2E tests for Next.js routes
python scripts/e2e_test_scaffolder.py src/app/ --output e2e/

# Run a runtime browser journey audit from the project root
node .claude/skills/browser-journey-audit/scripts/playwright_journey_probe.mjs \
  --url http://localhost:3000 \
  --journeys qa/journeys.json \
  --out qa-artifacts/browser-journey-audit \
  --require-journeys
```

---

## Tools Overview

### 1. Test Suite Generator

Scans React/TypeScript components and generates Jest + React Testing Library test stubs with proper structure.

**Input:** Source directory containing React components
**Output:** Test files with describe blocks, render tests, interaction tests

**Usage:**
```bash
# Basic usage - scan components and generate tests
python scripts/test_suite_generator.py src/components/ --output __tests__/

# Include accessibility tests
python scripts/test_suite_generator.py src/ --output __tests__/ --include-a11y

# Generate with custom template
python scripts/test_suite_generator.py src/ --template custom-template.tsx
```

**Supported Patterns:**
- Functional components with hooks
- Components with Context providers
- Components with data fetching
- Form components with validation

---

### 2. Coverage Analyzer

Parses Jest/Istanbul coverage reports and identifies gaps, uncovered branches, and provides actionable recommendations.

**Input:** Coverage report (JSON or LCOV format)
**Output:** Coverage analysis with recommendations

**Usage:**
```bash
# Analyze coverage report
python scripts/coverage_analyzer.py coverage/coverage-final.json

# Enforce threshold (exit 1 if below)
python scripts/coverage_analyzer.py coverage/ --threshold 80 --strict

# Generate HTML report
python scripts/coverage_analyzer.py coverage/ --format html --output report.html
```

---

### 3. E2E Test Scaffolder

Scans Next.js pages/app directory and generates Playwright test files with common interactions.

**Input:** Next.js pages or app directory
**Output:** Playwright test files organized by route

**Usage:**
```bash
# Scaffold E2E tests for Next.js App Router
python scripts/e2e_test_scaffolder.py src/app/ --output e2e/

# Include Page Object Model classes
python scripts/e2e_test_scaffolder.py src/app/ --output e2e/ --include-pom

# Generate for specific routes
python scripts/e2e_test_scaffolder.py src/app/ --routes "/login,/dashboard,/checkout"
```

---

### 4. Browser Journey Audit

Runs the real app through Playwright-backed journey checks before release. Use this when a website or application needs final QA, when navigation/user-flow failures are suspected, or when unit/integration tests are not enough to prove the product works.

**Input:** Base URL plus optional `qa/journeys.json`
**Output:** `qa-artifacts/browser-journey-audit/report.md`, `report.json`, and screenshots

**Usage:**
```bash
# Explicit P0/P1 journeys - required for final QA of apps with forms/saves/auth/checkout
node .claude/skills/browser-journey-audit/scripts/playwright_journey_probe.mjs \
  --url http://localhost:3000 \
  --journeys qa/journeys.json \
  --out qa-artifacts/browser-journey-audit \
  --require-journeys

# Weaker fallback: same-origin route smoke crawl
node .claude/skills/browser-journey-audit/scripts/playwright_journey_probe.mjs \
  --url http://localhost:3000 \
  --out qa-artifacts/browser-journey-audit \
  --max-pages 25
```

**Required release evidence:**
- P0/P1 journey inventory
- Console errors and first-party 4xx/5xx counts
- Screenshots or traces for failed and final states
- Persistence reload result for save/update flows
- Verdict: `PASS`, `FAIL`, or `BLOCKED`

---

## QA Workflows

### Runtime Journey Audit Workflow

Use when preparing a browser app for release or investigating failures in a complicated site.

**Step 1: Start the app**
```bash
npm run dev
# or use the preview/staging URL supplied by the workflow
```

**Step 2: Create or update journey config**

Create `qa/journeys.json` from the P0/P1 user journeys. Include semantic locators and reload persistence checks where relevant. See `.claude/skills/browser-journey-audit/references/journey-config.md`.

**Step 3: Run browser journey audit**
```bash
node .claude/skills/browser-journey-audit/scripts/playwright_journey_probe.mjs \
  --url http://localhost:3000 \
  --journeys qa/journeys.json \
  --out qa-artifacts/browser-journey-audit \
  --require-journeys
```

**Step 4: Triage failures**

- Blocker: P0 journey cannot complete, app blank screen, auth/callback broken, checkout/save fails.
- Critical: data loss, wrong-origin redirect, first-party 5xx on core action.
- High: primary navigation broken, valid input blocked, reload loses saved state.
- Medium: secondary route/action broken, non-blocking console error.

**Step 5: Re-run after fixes**

Re-run the exact same command after every fix that could affect the result. Do not approve until the P0/P1 report is clean or remaining gaps are explicitly accepted as non-release-blocking.

---

### Unit Test Generation Workflow

Use when setting up tests for new or existing React components.

**Step 1: Scan project for untested components**
```bash
python scripts/test_suite_generator.py src/components/ --scan-only
```

**Step 2: Generate test stubs**
```bash
python scripts/test_suite_generator.py src/components/ --output __tests__/
```

**Step 3: Review and customize generated tests**
```typescript
// __tests__/Button.test.tsx (generated)
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../src/components/Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // TODO: Add your specific test cases
});
```

**Step 4: Run tests and check coverage**
```bash
npm test -- --coverage
python scripts/coverage_analyzer.py coverage/coverage-final.json
```

---

### Coverage Analysis Workflow

Use when improving test coverage or preparing for release.

**Step 1: Generate coverage report**
```bash
npm test -- --coverage --coverageReporters=json
```

**Step 2: Analyze coverage gaps**
```bash
python scripts/coverage_analyzer.py coverage/coverage-final.json --threshold 80
```

**Step 3: Identify critical paths**
```bash
python scripts/coverage_analyzer.py coverage/ --critical-paths
```

**Step 4: Generate missing test stubs**
```bash
python scripts/test_suite_generator.py src/ --uncovered-only --output __tests__/
```

**Step 5: Verify improvement**
```bash
npm test -- --coverage
python scripts/coverage_analyzer.py coverage/ --compare previous-coverage.json
```

---

### E2E Test Setup Workflow

Use when setting up Playwright for a Next.js project.

**Step 1: Initialize Playwright (if not installed)**
```bash
npm init playwright@latest
```

**Step 2: Scaffold E2E tests from routes**
```bash
python scripts/e2e_test_scaffolder.py src/app/ --output e2e/
```

**Step 3: Configure authentication fixtures**
```typescript
// e2e/fixtures/auth.ts (generated)
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await use(page);
  },
});
```

**Step 4: Run E2E tests**
```bash
npx playwright test
npx playwright show-report
```

**Step 5: Add to CI pipeline**
```yaml
# .github/workflows/e2e.yml
- name: "run-e2e-tests"
  run: npx playwright test
- name: "upload-report"
  uses: actions/upload-artifact@v3
  with:
    name: "playwright-report"
    path: playwright-report/
```

---

## Reference Documentation

| File | Contains | Use When |
|------|----------|----------|
| `references/testing_strategies.md` | Test pyramid, testing types, coverage targets, CI/CD integration | Designing test strategy |
| `references/test_automation_patterns.md` | Page Object Model, mocking (MSW), fixtures, async patterns | Writing test code |
| `references/qa_best_practices.md` | Testable code, flaky tests, debugging, quality metrics | Improving test quality |
| `.claude/skills/browser-journey-audit/references/journey-config.md` | Playwright journey JSON format and supported runtime checks | Running pre-publish browser QA |

---

## Common Patterns Quick Reference

### React Testing Library Queries

```typescript
// Preferred (accessible)
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email/i)
screen.getByPlaceholderText(/search/i)

// Fallback
screen.getByTestId('custom-element')
```

### Async Testing

```typescript
// Wait for element
await screen.findByText(/loaded/i);

// Wait for removal
await waitForElementToBeRemoved(() => screen.queryByText(/loading/i));

// Wait for condition
await waitFor(() => {
  expect(mockFn).toHaveBeenCalled();
});
```

### Mocking with MSW

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json([{ id: 1, name: "john" }]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Playwright Locators

```typescript
// Preferred
page.getByRole('button', { name: "submit" })
page.getByLabel('Email')
page.getByText('Welcome')

// Chaining
page.getByRole('listitem').filter({ hasText: 'Product' })
```

### Coverage Thresholds (jest.config.js)

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

---

## Common Commands

```bash
# Jest
npm test                           # Run all tests
npm test -- --watch                # Watch mode
npm test -- --coverage             # With coverage
npm test -- Button.test.tsx        # Single file

# Playwright
npx playwright test                # Run all E2E tests
npx playwright test --ui           # UI mode
npx playwright test --debug        # Debug mode
npx playwright codegen             # Generate tests
node .claude/skills/browser-journey-audit/scripts/playwright_journey_probe.mjs --url http://localhost:3000 --journeys qa/journeys.json --out qa-artifacts/browser-journey-audit --require-journeys

# Coverage
npm test -- --coverage --coverageReporters=lcov,json
python scripts/coverage_analyzer.py coverage/coverage-final.json
```
