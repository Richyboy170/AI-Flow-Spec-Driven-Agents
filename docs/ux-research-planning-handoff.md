# UX Research to Planning Handoff

This contract lets the brainstorm-research team send UX/UI benchmark data to planning as a durable Markdown artifact instead of a loose summary.

## Producer

`cs-ux-structure-researcher` writes:

```text
{project_root}/research/ux-structure-benchmark-<date>.md
```

If no project root exists yet, it writes under:

```text
design-artifacts/<concept-slug>/research/ux-structure-benchmark-<date>.md
```

## Consumers

- `cs-planning-lead` reads the benchmark before PRD or UX planning for UI-bearing work.
- `cs-concept-to-prd-planner` carries benchmark conclusions into the concept packet.
- `cs-requirements-architect` maps journey and pattern findings into UJ, FR, NFR, and scope decisions.
- `bmad-ux` uses the benchmark as source evidence for `DESIGN.md` and `EXPERIENCE.md`.
- `cs-epic-story-planner` uses mapped IDs when writing UX-sensitive acceptance criteria.

## Multilingual Name Fidelity

When the user explicitly asks for multi-language work and the benchmark researches real brand products, services, sub-brands, screenshots, apps, or websites, the producer must include a native/localized name ledger:

```markdown
| Language/locale | Exact official name | Official global/English name | Source URL | Confidence | Status |
|---|---|---|---|---|---|
```

Use official native-script or localized names for searches. Do not translate, romanize, abbreviate, or invent product names from context. If a localized name cannot be verified, mark it `unknown` or `unverified`.

## Stable IDs

The benchmark report uses research IDs, not final requirement IDs:

| Prefix | Meaning | Planning mapping |
|---|---|---|
| `UXR-#` | Source or benchmarked product | Cited source path or URL |
| `IA-#` | Information architecture or structure insight | PRD structure, navigation, UX spec |
| `JNY-#` | Observed journey pattern | PRD `UJ-#` candidate |
| `PAT-#` | Reusable UX/UI interaction pattern | FR, UX behavior, story AC |
| `VIZ-#` | Visualization or data-display pattern | Dashboard/reporting FR or UX spec |
| `DEC-#` | Adaptation recommendation | PRD decision, UX decision, or open question |

Planning agents create final PRD IDs. They should preserve the research IDs in notes or traceability tables so downstream agents can find the evidence.

## Required Planning Connector

Every benchmark report must include this table:

```markdown
| Research ID | Evidence source IDs | Planning consumer | Suggested planning ID | Requirement or UX implication | Confidence | Status |
|---|---|---|---|---|---|---|
```

Accepted `Status` values:

- `ready` - planning can use it now.
- `needs user approval` - planning should ask before committing.
- `needs validation` - requires prototype, user test, analytics, or domain review.
- `blocked` - source access or evidence quality is insufficient.

## Planning Intake Rule

For any UI-bearing app, website, dashboard, marketplace, portal, public site, onboarding flow, or data visualization surface, planning should look for:

```markdown
### UX/UI structure benchmark
- Status:
- Report path:
- Benchmarked products:
- Native/localized name ledger:
- Planning connector IDs:
- IA and navigation implications:
- Journey implications:
- UX/UI pattern implications:
- Visualization implications:
- Accessibility and responsive implications:
- Open approvals or validation needs:
```

If the section is missing, `cs-planning-lead` should either request `cs-ux-structure-researcher` output or explicitly record `UX benchmark: not available` with the reason.
