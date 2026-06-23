---
title: 'Christmas เงินติดล้อ Sandbox Website'
type: 'feature'
created: '2026-06-17'
status: 'done'
route: 'one-shot'
---

# Christmas เงินติดล้อ Sandbox Website

## Intent

**Problem:** The user wanted a complete เงินติดล้อ website built inside `sandbox/`, later clarifying that the whole site should use a Christmas style.

**Approach:** Built an isolated vanilla static website that presents a festive loan pathfinder concept, uses public Tidlor facts cautiously, avoids data capture, and keeps official-channel and prototype disclaimers visible.

## Suggested Review Order

**Experience Entry**

- Start with the first-viewport Christmas pathfinder and brand boundary.
  [`index.html:43`](../../sandbox/index.html#L43)

- Check public trust counters and keep them current if this becomes production.
  [`index.html:55`](../../sandbox/index.html#L55)

**Pathfinder Interaction**

- Review route buttons and keyboard/a11y state setup.
  [`index.html:84`](../../sandbox/index.html#L84)

- Review data-driven recommendation copy and compliance-safe CTA targets.
  [`main.js:1`](../../sandbox/assets/js/main.js#L1)

- Review route state updates and `aria-pressed` behavior.
  [`main.js:63`](../../sandbox/assets/js/main.js#L63)

**Christmas Visual System**

- Review seasonal layout, lights, and responsive hero composition.
  [`styles.css:155`](../../sandbox/assets/css/styles.css#L155)

- Review selector styling, selected state, and mobile-safe dimensions.
  [`styles.css:348`](../../sandbox/assets/css/styles.css#L348)

- Review the original local route illustration.
  [`pathfinder-map.svg:2`](../../sandbox/assets/img/pathfinder-map.svg#L2)

**Compliance Boundary**

- Confirm no-form channel handoff and official-link behavior.
  [`index.html:198`](../../sandbox/index.html#L198)

- Confirm prototype disclaimer is explicit and visible.
  [`index.html:227`](../../sandbox/index.html#L227)
