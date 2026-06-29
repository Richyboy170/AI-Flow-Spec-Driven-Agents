# Brainstorm-Research Team — "The Big Brain"

The ideation-and-research counterpart to the engineering team. It takes a fuzzy spark — *"I want to build an app/website that does X"* — and drives it through structured divergence, human-centered framing, disruption analysis, systematic problem-solving, and grounded research until it is either a **sharp, testable concept** or a **clearly-killed idea**.

It wraps the BMad brainstorming / design-thinking / innovation-strategy / problem-solving / research / packaging skills rather than reimplementing them. The lead runs a 7-question idea forcing-grill, then routes each concern to the specialist that owns it.

## Roster

| Agent | Persona | Mode | Wraps (BMad skills) |
|---|---|---|---|
| [`cs-brainstorm-research-lead`](cs-brainstorm-research-lead.md) | The Big Brain (orchestrator) | interactive | routes all; runs the 7-question grill |
| [`cs-ideation-strategist`](cs-ideation-strategist.md) | Carson | interactive | `bmad-brainstorming`, `bmad-cis-agent-brainstorming-coach`, `bmad-advanced-elicitation` |
| [`cs-wildcard-ideator`](cs-wildcard-ideator.md) | Nova | fork -> idea digest | `bmad-brainstorming` methodology; supplies 6/10 unconventional idea-board slots |
| [`cs-design-thinker`](cs-design-thinker.md) | Maya | interactive | `bmad-cis-design-thinking`, `bmad-cis-agent-design-thinking-coach` |
| [`cs-innovation-strategist`](cs-innovation-strategist.md) | Victor | interactive | `bmad-cis-innovation-strategy`, `bmad-cis-agent-innovation-strategist` |
| [`cs-problem-solver`](cs-problem-solver.md) | Dr. Quinn | interactive | `bmad-cis-problem-solving`, `bmad-cis-agent-creative-problem-solver` |
| [`cs-market-researcher`](cs-market-researcher.md) | Mary | fork → digest | `bmad-market-research`, `bmad-domain-research`, `bmad-agent-analyst` |
| [`cs-tech-researcher`](cs-tech-researcher.md) | (feasibility scout) | fork → digest | `bmad-technical-research`, `bmad-agent-analyst` |
| [`cs-visual-researcher`](cs-visual-researcher.md) | (visual evidence scout) | fork → visual pack | live visual research + `bmad-ux` evidence contract |
| [`cs-ux-structure-researcher`](cs-ux-structure-researcher.md) | (UX benchmark scout) | fork -> Markdown benchmark | top-tier IA, user journey, UX/UI, and visualization research + planning connector |
| [`cs-concept-synthesizer`](cs-concept-synthesizer.md) | (concept packager) | fork → digest | `bmad-prfaq`, `bmad-product-brief`, `bmad-cis-storytelling` |

## Two modes — and why it matters

The defining design decision of this team: **facilitation is interactive, research is autonomous.**

- **Interactive (main-thread) specialists** — `cs-ideation-strategist`, `cs-design-thinker`, `cs-innovation-strategist`, `cs-problem-solver`. They facilitate turn-by-turn (100+ ideas, empathy maps, business-model canvases, root-cause sessions) and **need the user's answers at each checkpoint**. They run in the main thread and invoke their BMad skill via the `Skill` tool.
- **Autonomous (`context: fork`) specialists** — `cs-wildcard-ideator`, `cs-market-researcher`, `cs-tech-researcher`, `cs-visual-researcher`, `cs-ux-structure-researcher`, `cs-concept-synthesizer`. They run to completion with no user channel. The wildcard ideator produces six unconventional idea cards for pre-implementation choice boards. The visual researcher uses WebSearch/WebFetch plus the constrained project downloader to map brand portfolios and preserve local brand, product, sub-brand, and related visual files with provenance, dimensions, and dominant colors. The UX structure researcher benchmarks top-tier products and writes a Markdown report with connector IDs for planning. Each specialist returns a compact routing digest; full output goes to files.

> ⚠️ **Never spawn a facilitation specialist as a `context: fork` agent.** It will hang waiting for the user, or fabricate the user's answers. Hand off in the main thread. (Conversely, the lead forks the research/synthesis agents — they're built for it.)

## The 7-question routing map

The lead walks these one per turn before any ideation or research is locked, then routes:

| # | Question | Routes to |
|---|----------|-----------|
| Q1 | Problem & pain (painkiller vs vitamin?) | `cs-design-thinker`, `cs-problem-solver` |
| Q2 | ICP (narrowest nameable segment) | `cs-design-thinker` |
| Q3 | Existing alternatives (incl. nothing/Excel) | `cs-market-researcher` (fork) |
| Q4 | Unique insight / unfair wedge | `cs-innovation-strategist`, `cs-tech-researcher` (fork) |
| Q5 | Market & timing — "why now?" | `cs-market-researcher` (fork) |
| Q6 | Value capture — who pays? | `cs-innovation-strategist` |
| Q7 | Riskiest assumption + cheap test → output | `cs-design-thinker`, `cs-tech-researcher`, `cs-concept-synthesizer` (fork) |
| UI-bearing concept | Visual category, references, color, imagery, theme, differentiation | `cs-visual-researcher` (fork after problem + ICP are locked) |
| UI-bearing concept | Site/app structure, IA, user journeys, UX/UI patterns, visualization, state coverage | `cs-ux-structure-researcher` (fork after problem + ICP + initial competitor/category set are locked) |
| (all) | Wide divergence before converging | `cs-ideation-strategist` |
| User wants brainstormed choices before implementation | Weird, wonderful, out-of-the-box idea cards | `cs-wildcard-ideator` (fork after problem + ICP are locked; contributes 6/10 idea-board slots) |

Each question carries a **kill criterion**; tripping one stops the loop until the gap is closed.

## Research source quality threshold

All web research follows [`SOURCE-QUALITY.md`](SOURCE-QUALITY.md). Sources are scored for authority, evidence transparency, claim proximity, currency/applicability, and independence/corroboration. A decision-critical claim requires a strong source (8/10 or better), plus a second independent strong source for disputed, promotional, predictive, regulated, market-size, or performance claims. Every research report includes a source-quality audit; below-threshold evidence remains a discovery lead or is labeled `unverified`, never presented as a grounded conclusion.

## How to invoke

```js
// Full loop: raw spark → validated concept
Agent({ subagent_type: "cs-brainstorm-research-lead",
        prompt: "Help me brainstorm and validate an app idea: <one-liner>" })

// Fast triage: "is this idea any good?"
Agent({ subagent_type: "cs-brainstorm-research-lead",
        prompt: "Is this idea any good? <one-liner>" })
```

Or just talk to `cs-brainstorm-research-lead` directly for any "brainstorm / validate / research an app or website idea" task. It returns a compact decision packet: locked problem + ICP, chosen direction, de-risking findings, riskiest assumption + test, artifact paths, and, for UI-bearing products, the visual report/manifest, reference-rights status, evidence-backed theme, candidate palette, and UX structure benchmark report.

## Output locations

- Idea grill notes: `/tmp/idea-grill-<date>.md`
- Brainstorming sessions: `{output_folder}/brainstorming/brainstorming-session-<date>.md`
- Wildcard idea boards: `{output_folder}/brainstorming/wildcard-idea-board-<date>.md`
- Design-thinking / innovation-strategy artifacts: `{output_folder}/design-thinking-<date>.md`, `{output_folder}/innovation-strategy-<date>.md`
- Research reports: `{output_folder}/research/market-research-<date>.md`, `{output_folder}/research/tech-research-<date>.md`
- Visual research report: `{project_root}/research/visual-research-<date>.md`
- UX structure benchmark: `{project_root}/research/ux-structure-benchmark-<date>.md`
- Project asset pack: `{project_root}/assets/visual-manifest.json`, plus all downloaded brand/product/sub-brand/reference images and adjacent provenance sidecars. Named-brand packs also include a coverage matrix in the visual report; a lone corporate logo is not complete research.
- Concept package: `{output_folder}/concepts/prfaq-<date>.md`, `{output_folder}/concepts/product-brief-<date>.md`

## Dependencies

- **BMad skills** (under `../../skills/`): `bmad-brainstorming`, `bmad-cis-agent-brainstorming-coach`, `bmad-advanced-elicitation`, `bmad-cis-design-thinking`, `bmad-cis-agent-design-thinking-coach`, `bmad-cis-innovation-strategy`, `bmad-cis-agent-innovation-strategist`, `bmad-cis-problem-solving`, `bmad-cis-agent-creative-problem-solver`, `bmad-market-research`, `bmad-domain-research`, `bmad-technical-research`, `bmad-agent-analyst`, `bmad-ux`, `bmad-prfaq`, `bmad-product-brief`, `bmad-cis-storytelling`.
- **BMad activation chain** (must be present for the skills to activate): `_bmad/scripts/resolve_customization.py`, `_bmad/cis/config.yaml`, `_bmad/core/config.yaml`, and `_bmad/bmm/config.yaml` (for market/tech research).
- **Visual capture runtime:** Node with `--use-system-ca` support, Windows PowerShell/System.Drawing for raster palette extraction, `.claude/scripts/collect-visual-reference.cjs`, `.claude/scripts/analyze-visual-reference.ps1`, and their narrowly scoped `Bash(...)` allow rules in `.claude/settings.local.json`. The collector accepts an official page URL without a direct image URL and discovers `og:image`, `twitter:image`, `<img>`, `srcset`, structured-data images, and CSS backgrounds.

## Boundaries

This team does **not** write production code, finalize a design system, or choose a tech stack. Visual research and UX structure benchmarks are evidence for a later user-approved `bmad-ux`/`DESIGN.md`/`EXPERIENCE.md` process. Reference-only or unknown-rights images are never production assets. Once an idea is validated, the team hands off the concept, research artifacts, visual pack, UX benchmark, and riskiest-assumption test to planning/engineering.
