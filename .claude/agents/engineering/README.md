# Engineering Agents

The Engineering agents execute phase 4 of the delivery flow owned by `../engineering-team/cs-engineering-lead.md`.

## Phase 4 Contract

1. `cs-engineering-lead` receives the phase 2/3 package from `../planning-team/cs-planning-lead.md`.
2. The lead assigns exactly one ready story at a time to the right engineering agent.
3. The assigned agent reads the story, PRD, architecture, readiness verdict, and sprint-status paths.
4. Implementation uses `bmad-dev-story` when a story file exists.
5. Review uses `bmad-code-review` and/or `cs-karpathy-reviewer` before the story is marked done.
6. Review follow-ups go back to the implementing agent until resolved or explicitly deferred.
7. The engineering agent returns a compact digest to `cs-engineering-lead`.

## Roster

- `cs-fullstack-engineer` - cross-layer stories spanning frontend, backend, data, API, and deployment.
- `cs-frontend-engineer` - UI, UX behavior, accessibility, rendering, browser tests, and web performance.
- `cs-backend-engineer` - APIs, persistence, jobs, auth/session boundaries, integrations, observability, and migrations.
- `cs-senior-engineer` - architecture-sensitive work, CI/CD, security, technical repair, and senior review.
- `cs-karpathy-reviewer` - simplicity, diff-noise, and goal-driven execution review.

## BMAD Skills

- `bmad-agent-dev` - developer agent persona when an explicit Amelia session is needed.
- `bmad-dev-story` - context-filled story implementation.
- `bmad-code-review` - adversarial review before done.
- `bmad-quick-dev` - small direct changes outside the full planning pipeline.
- `bmad-story-automator-review` - review generated or automated story work.
- `bmad-checkpoint-preview` - guided human checkpoint review.
- `bmad-testarch-test-design`, `bmad-testarch-atdd`, `bmad-testarch-trace`, `bmad-testarch-nfr`, `bmad-testarch-test-review` - test architecture and quality gates.

## UI/UX Pro Max Skills

- `ui-ux-pro-max` - UI/UX design intelligence, design-system generation, accessibility, layout, typography, and style guidance.
- `ckm:ui-styling` - shadcn/ui, Tailwind, theme, dark-mode, and responsive UI implementation.
- `ckm:design-system` - token architecture, component specifications, and systematic UI standards.
- `ckm:design`, `ckm:brand`, `ckm:banner-design`, `ckm:slides` - broader design, brand, visual asset, and presentation workflows when engineering stories include those outputs.

## Return Digest

Every phase 4 agent returns:

- story path and status
- changed files
- tests or checks run
- review result and report path if available
- unresolved risks or deferrals
- next recommended story or handoff
