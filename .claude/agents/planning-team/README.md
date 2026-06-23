# Planning Team

The Planning Team turns app and website ideas into implementation-ready planning artifacts. It is designed to sit between the existing `brainstorm-research-team` and `engineering` / `engineering-team` agents.

## Roster

- `cs-planning-lead` - routes raw ideas, validated concepts, briefs, PRFAQs, existing PRDs, and engineering requests into the right planning workflow.
- `cs-concept-to-prd-planner` - converts brainstorm-research outputs into a product brief, PRFAQ, or PRD-ready concept packet.
- `cs-prd-work-planner` - creates, updates, and validates detailed PRDs through `bmad-prd`.
- `cs-requirements-architect` - shapes concepts into stable journeys, glossary terms, FRs, NFRs, assumptions, and success metrics.
- `cs-evaluation-architect` - senior full-stack engineer who authors the evaluation/verification spine (verification matrix, per-layer Definition of Done, quality gates, and a known-failure-modes catalog) keyed to the requirements-architect's FR/NFR/UJ IDs so engineering and QA know what to test and which mistakes to avoid.
- `cs-prd-quality-reviewer` - reviews PRDs for decision-readiness, downstream usability, and implementation readiness.
- `cs-epic-story-planner` - decomposes final PRDs into epics, stories, and engineering handoff plans.

## Primary Flow

1. Phase 1 research/discovery enters through `../brainstorm-research-team/cs-brainstorm-research-lead.md` and returns to `../engineering-team/cs-engineering-lead.md`.
2. `cs-engineering-lead` sends the research packet to `cs-planning-lead`.
3. Phase 2: `cs-concept-to-prd-planner` packages the idea as a brief or PRFAQ when the concept needs more pressure-testing.
4. Phase 2: `cs-requirements-architect` builds the requirements map when the product needs stable glossary, journeys, FRs, NFRs, assumptions, or scope boundaries.
5. Phase 2: `cs-prd-work-planner` creates or updates the PRD with `bmad-prd`.
6. Phase 2/3: `cs-evaluation-architect` authors the evaluation/verification spine once FRs/NFRs/UJs are stable, keyed to those IDs, so engineering and QA inherit a testable Definition of Done, quality gates, and a known-mistakes catalog.
7. Phase 3: `cs-planning-lead` routes architecture through `bmad-create-architecture` and, when useful, `bmad-agent-architect`.
8. Phase 3: `cs-prd-quality-reviewer` validates the PRD and runs implementation-readiness checks across PRD, UX if present, architecture, epics, and stories.
9. Phase 3: `cs-epic-story-planner` creates epics, stories, and sprint handoff artifacts for engineering, pulling acceptance criteria and test notes from the evaluation spine.
10. The completed phase 2/3 package returns to `cs-engineering-lead`, which owns phase 4 story-by-story engineering execution.

## Phase 2/3 Return Package

When called by `cs-engineering-lead`, return:

- PRD workspace path, `prd.md`, `addendum.md` if present, and `.decision-log.md`
- architecture artifact paths and ADR/design-decision paths
- validation and implementation-readiness report paths
- evaluation spine path (`evaluation-spec.md` or PRD addendum section) with ID-coverage status
- epics path, story paths, and sprint-status path if present
- FR/NFR coverage summary
- blockers, risks, and recommended phase 4 routing

## BMAD PRD Skill Policy

Use `bmad-prd` for new PRD work. `bmad-create-prd`, `bmad-edit-prd`, and `bmad-validate-prd` are compatibility shims that forward to `bmad-prd` create, update, and validate intents.
