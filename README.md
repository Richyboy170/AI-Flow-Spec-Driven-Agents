# Tidlor Reborn

Tidlor Reborn is an AI workflow automation workspace for **spec-driven deep agents**: a layered system of Claude Code agents, skills, commands, and BMAD workflows that turns vague product ideas into researched concepts, PRDs, evaluation plans, implementation-ready stories, code, and review reports.

The repo is not primarily a website or app. Generated apps, `app/`, and `sandbox/` are working surfaces and experiments. The core project is the agent workflow system.

## What This Repo Is

This workspace packages a repeatable product-delivery pipeline for AI agents:

1. **Research and discovery**: turn fuzzy ideas into validated concepts with market, technical, visual, and problem framing.
2. **Spec and PRD planning**: create source-of-truth requirements, assumptions, decisions, FR/NFR IDs, acceptance criteria, architecture notes, and implementation-readiness reports.
3. **Evaluation design**: build an evaluation and verification spine before engineering starts, so every requirement has a way to prove it works.
4. **Story execution**: hand implementation-ready stories to specialized engineering agents.
5. **Independent review**: run code, security, test, and web-performance review through separate QA personas.
6. **Workflow automation**: design deterministic multi-agent `.js` workflows for Claude Code's Workflow tool when a task should be repeatable and resumable.

The important principle is traceability: agents do not just chat toward code. They create artifacts, hand them off, verify them, and keep work tied to specs and acceptance criteria.

## Core Ideas

| Concept | Meaning in this repo |
| --- | --- |
| **Skill** | A workflow, method, script set, or quality gate. It defines the "how". |
| **Persona / Agent** | A focused role with a perspective and output contract. It defines the "who". |
| **Command** | A user-facing entry point for a repeatable workflow. It defines the "when". |
| **Deep agent** | A long-running delegated agent that works from artifacts, invokes specialist workflows, returns receipts, and preserves traceability. |
| **Spec-driven workflow** | A gated path where specs, PRDs, acceptance criteria, and evaluation plans precede implementation. |
| **Workflow automation** | Deterministic Claude Code workflow scripts that fan out to fresh-context agents under explicit topology and validation rules. |

## System Flow

The default top-level coordinator is `cs-engineering-lead`. It does not act as a solo builder; it routes work through specialist teams, requires artifact handoffs, and keeps independent work running in parallel when safe.

```text
User goal / raw idea / existing artifact paths
        |
        v
cs-engineering-lead
        |
        |-- Phase 1: Research and discovery
        |     lead: cs-brainstorm-research-lead
        |     specialists:
        |       - cs-market-researcher
        |       - cs-tech-researcher
        |       - cs-problem-solver
        |       - cs-innovation-strategist
        |       - cs-visual-researcher
        |       - cs-concept-synthesizer
        |       - cs-design-thinker / cs-ideation-strategist when interactive facilitation is needed
        |     skills:
        |       - bmad-brainstorming
        |       - bmad-market-research
        |       - bmad-domain-research
        |       - bmad-technical-research
        |       - bmad-prfaq
        |       - bmad-product-brief
        |     output:
        |       - locked problem and ICP
        |       - status quo and alternatives
        |       - market / technical / visual evidence
        |       - wedge, risks, assumptions, riskiest validation test
        |       - visual report and assets/visual-manifest.json when visual evidence is in scope
        |
        |-- Phase 2: PRD and requirements planning
        |     lead: cs-planning-lead
        |     specialists:
        |       - cs-concept-to-prd-planner
        |       - cs-requirements-architect
        |       - cs-prd-work-planner
        |       - cs-evaluation-architect
        |       - cs-prd-quality-reviewer
        |       - cs-epic-story-planner
        |     skills:
        |       - bmad-prd
        |       - bmad-ux
        |       - bmad-testarch-test-design
        |       - bmad-testarch-nfr
        |       - bmad-review-edge-case-hunter
        |     output:
        |       - prd.md, addendum.md, .decision-log.md
        |       - requirements map with FR/NFR/UJ IDs
        |       - evaluation and verification spine
        |       - measurable success criteria and open questions
        |
        |-- Phase 3: Architecture, epics, stories, readiness
        |     lead: cs-planning-lead
        |     skills:
        |       - bmad-create-architecture
        |       - bmad-agent-architect
        |       - bmad-create-epics-and-stories
        |       - bmad-create-story
        |       - bmad-story-automator-review
        |       - bmad-check-implementation-readiness
        |       - bmad-sprint-planning
        |       - bmad-sprint-status
        |     output:
        |       - architecture and ADR/design-decision artifacts
        |       - epics and ready-for-dev story files
        |       - sprint-status.yaml
        |       - implementation-readiness verdict
        |
        |-- Phase 4: Story implementation
        |     lead: cs-engineering-lead
        |     implementers:
        |       - cs-frontend-engineer
        |       - cs-backend-engineer
        |       - cs-fullstack-engineer
        |       - cs-senior-engineer
        |       - cs-karpathy-reviewer
        |     skills:
        |       - bmad-dev-story
        |       - bmad-code-review
        |       - bmad-quick-dev
        |       - bmad-testarch-atdd
        |       - bmad-testarch-trace
        |       - bmad-testarch-test-review
        |       - bmad-checkpoint-preview
        |     output:
        |       - changed files
        |       - story status moved to review
        |       - tests/checks run
        |       - implementation notes, file list, risks
        |
        |-- Phase 5: Independent QA review
        |     reviewers:
        |       - code-reviewer
        |       - security-auditor
        |       - test-engineer
        |       - web-performance-auditor
        |     skills:
        |       - code-review-and-quality
        |       - security-and-hardening
        |       - test-driven-development
        |       - performance-optimization
        |       - browser-testing-with-devtools
        |     output:
        |       - findings by severity
        |       - test coverage gaps
        |       - security risks
        |       - web performance risks
        |       - approve / request-changes verdicts
        |
        v
Final delivery digest:
  - artifact paths
  - agents and skills invoked
  - review results
  - unresolved risks or deferrals
  - next recommended handoff
```

Repeatable automation uses a separate workflow-builder path:

```text
/cs:workflow-build <repeatable multi-agent task>
        |
        v
cs-workflow-architect
        |
        |-- workflow_intake.py      -> topology recommendation
        |-- scaffold_workflow.py    -> .claude/workflows/<name>.js starter
        |-- validate_workflow.py    -> deterministic workflow validation
        v
Claude Code Workflow tool
  - fan-out
  - pipeline
  - loop
  - barrier
  - judge-panel
```

## Repository Map

```text
.
|-- .claude/
|   |-- agents/                 Deep-agent personas used by Claude Code
|   |-- skills/                 BMAD, WDS, spec, development, test, and design skills
|   |-- scripts/                Helper scripts for visual capture and local automation
|   `-- settings.json           Claude Code workspace settings
|-- .claude-plugin/             Marketplace metadata for packaged skill/plugin distribution
|-- _bmad/                      BMAD configuration, modules, scripts, and workflow foundations
|-- _bmad-output/               Generated planning, implementation, and test artifacts
|-- engineering/
|   |-- workflow-builder/       Claude Code Workflow authoring skill, command, scripts, references
|   |-- skills/                 Advanced engineering skills, including spec-driven workflow
|   `-- */                      Additional focused skills, agents, and commands
|-- engineering-team/           Engineering-team skill packages and role guidance
|-- agents.md                   Root persona/orchestration rules
|-- CLAUDE.md                   Project invariants and agent behavior rules
|-- app/                        Generated/sample implementation surface, not the repo's purpose
|-- design-artifacts/           Design workflow scaffolding and outputs
|-- docs/                       Reserved project documentation area
`-- sandbox/                    Scratch/testing area for agent workflow experiments
```

## Main Agent Teams

| Team | Location | Purpose |
| --- | --- | --- |
| Brainstorm research | `.claude/agents/brainstorm-research-team/` | Idea validation, research, concept synthesis, visual evidence capture. |
| Planning | `.claude/agents/planning-team/` | PRD creation, requirements architecture, evaluation spine, epics, stories, readiness. |
| Engineering lead | `.claude/agents/engineering-team/` | Delegation-first coordinator for delivery across research, planning, implementation, and review. |
| Engineering implementers | `.claude/agents/engineering/` | Frontend, backend, fullstack, senior engineer, and simplicity review agents. |
| QA reviewers | `.claude/agents/qa-engineers/` | Code review, security audit, test review, and web performance review. |

## Spec-Driven Workflow

The spec-first discipline appears in two places:

- `.claude/skills/spec-driven-development/` defines the lightweight gated flow: specify, plan, tasks, implement.
- `engineering/skills/spec-driven-workflow/` defines the stronger production workflow: requirements, complete spec, validation, test extraction, implementation, and self-review.

The expected contract is:

- No non-trivial implementation begins without a spec, PRD, or story artifact.
- Requirements are numbered and traceable.
- Acceptance criteria are testable.
- NFRs have measurable thresholds where possible.
- Implementation stays inside the approved scope.
- If the agent discovers missing requirements, the spec is updated before the code expands.

## Workflow Automation

`engineering/workflow-builder/` is the system for authoring Claude Code Workflow tool scripts.

It provides:

- `workflow_intake.py`: turns a vague automation request into a recommended topology.
- `scaffold_workflow.py`: emits starter workflow scripts.
- `validate_workflow.py`: checks deterministic workflow rules before execution.
- `cs-workflow-build`: slash command contract for intake, scaffold, validate, and run.
- `cs-workflow-architect`: persona for designing workflow topology before writing files.

The workflow-builder targets `.claude/workflows/*.js`. This repo does not currently contain a `.claude/workflows/` directory, so workflow files are authored when needed.

## Common Entry Points

Use these when running in a Claude Code environment with the agents and skills loaded.

```js
// Full product delivery from idea to implementation
Agent({
  subagent_type: "cs-engineering-lead",
  prompt: "Take this idea through research, planning, implementation, and review: <idea>"
})

// Planning only: PRD, requirements, evaluation, architecture, stories
Agent({
  subagent_type: "cs-planning-lead",
  prompt: "Create an implementation-ready planning package for: <concept or artifact paths>"
})

// Research only: validate a fuzzy idea before planning
Agent({
  subagent_type: "cs-brainstorm-research-lead",
  prompt: "Validate this app idea and produce a concept packet: <idea>"
})
```

For deterministic workflow authoring:

```text
/cs:workflow-build <repeatable multi-agent task>
```

For direct spec-first work, invoke the spec-driven skills when a feature needs requirements before code.

## Quality Gates

Non-trivial delivery is expected to pass through these gates:

- Research packet accepted, with evidence and unresolved risks surfaced.
- PRD or spec created and reviewed.
- Requirements and acceptance criteria are traceable.
- Evaluation spine exists before engineering starts.
- Architecture and implementation-readiness checks are complete when architecture matters.
- Stories are `ready-for-dev` before implementation.
- Engineering work is reviewed by a different agent than the one that wrote it.
- QA coverage includes code review, security, test strategy, and web-performance review when applicable.

## What To Ignore

- `sandbox/` is a scratch area for testing AI-agent workflows and should not define the project identity.
- `app/` is a generated or sample implementation surface. It may be useful as an output target, but it is not the core product.
- Large bundled skill directories under `engineering/` and `engineering-team/` are part of the agent capability library; read the specific skill or agent you are invoking rather than trying to load everything.

## Working On This Repo

- Update `agents.md` when changing persona composition rules.
- Update `.claude/agents/**` when changing agent behavior or handoff contracts.
- Update `.claude/skills/**` or `engineering/**/skills/**` when changing reusable workflows.
- Update `engineering/workflow-builder/` when changing deterministic workflow automation.
- Preserve artifact paths and handoff receipts; downstream agents depend on them.
- Keep sandbox experiments isolated unless intentionally promoting them into the main workflow system.

## Status

This workspace currently contains the agent, skill, command, and BMAD infrastructure for spec-driven AI workflow automation. Generated artifacts and sample app work exist, but the primary project value is the orchestration system that creates, validates, implements, and reviews software from structured specs.
