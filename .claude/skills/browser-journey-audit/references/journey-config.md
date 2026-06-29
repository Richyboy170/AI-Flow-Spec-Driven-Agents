# Journey Config

`scripts/playwright_journey_probe.mjs` accepts a JSON file with a `baseURL` and a `journeys` array. The script is intentionally small and portable: it uses the project's existing `playwright` or `@playwright/test` dependency and writes `report.md`, `report.json`, and screenshots to the output folder.

## Minimal Example

```json
{
  "baseURL": "http://localhost:3000",
  "journeys": [
    {
      "name": "visitor can navigate to pricing",
      "priority": "P0",
      "steps": [
        { "goto": "/" },
        { "click": { "role": "link", "name": "Pricing" } },
        { "expectURL": "**/pricing" },
        { "expectVisible": { "role": "heading", "name": "Pricing" } }
      ]
    }
  ]
}
```

## Recommended Release Example

```json
{
  "baseURL": "http://localhost:3000",
  "ignoreURLPatterns": ["/favicon.ico", "\\.map$", "/_next/", "/@vite"],
  "journeys": [
    {
      "name": "settings save persists after reload",
      "priority": "P0",
      "steps": [
        { "goto": "/settings" },
        { "fill": { "label": "Display name", "value": "QA Probe" } },
        { "click": { "role": "button", "name": "Save" } },
        { "expectText": "Saved" },
        { "reload": true },
        { "expectValue": { "label": "Display name", "value": "QA Probe" } }
      ]
    },
    {
      "name": "mobile navigation opens product page",
      "priority": "P1",
      "viewport": "mobile",
      "steps": [
        { "goto": "/" },
        { "click": { "role": "button", "name": "Menu" } },
        { "click": { "role": "link", "name": "Products" } },
        { "expectURL": "**/products" },
        { "expectVisible": { "role": "heading", "name": "Products" } }
      ]
    }
  ]
}
```

## Locator Targets

Use semantic locators first:

```json
{ "role": "button", "name": "Save" }
{ "role": "link", "name": "Dashboard" }
{ "label": "Email" }
{ "placeholder": "Search" }
{ "text": "Order confirmed" }
{ "testId": "checkout-total" }
{ "css": "[data-qa='fallback']" }
```

`name`, `label`, `placeholder`, and `text` can use regular expressions by adding `"regex": true`.

```json
{ "role": "heading", "name": "welcome|dashboard", "regex": true, "flags": "i" }
```

## Supported Steps

```json
{ "goto": "/path" }
{ "click": { "role": "button", "name": "Save" } }
{ "fill": { "label": "Email", "value": "qa@example.com" } }
{ "select": { "label": "Country", "value": "TH" } }
{ "check": { "label": "Accept terms" } }
{ "press": { "key": "Enter" } }
{ "press": { "label": "Search", "key": "Enter" } }
{ "expectVisible": { "text": "Saved" } }
{ "expectHidden": { "text": "Loading" } }
{ "expectText": "Saved" }
{ "expectURL": "**/dashboard" }
{ "expectValue": { "label": "Display name", "value": "QA Probe" } }
{ "reload": true }
{ "back": true }
{ "forward": true }
{ "screenshot": "after-save" }
{ "wait": 500 }
```

Use `wait` sparingly. Prefer a visible assertion after the action.

## Failure Signals The Script Treats As Release Risks

- Uncaught page errors.
- Console errors.
- First-party request failures.
- First-party HTTP 4xx/5xx responses unless ignored by `ignoreURLPatterns`.
- Visible framework/runtime error text such as hydration failures, application errors, or internal server errors.
- Failed step assertions.

## When The Script Is Not Enough

The probe does not invent credentials, complete real payment authorization, bypass CAPTCHAs, or solve out-of-band MFA. For those flows, combine:

- Config review for redirect/callback URLs.
- Stubbed/sandbox payment or test identity provider.
- Manual handoff note for the human-only step.
- A Playwright journey that resumes immediately before or after the human-only boundary.
