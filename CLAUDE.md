# Project Agent Invariants

## Real-brand and internet-image work

When a request names a real company/brand or asks for actual logos, product logos, screenshots, photographs, PNG/SVG/image files, company colors/themes, advertising decoration, or other internet-sourced visual assets:

1. Research and capture the visual evidence before editing implementation files. Do not rewrite the request into "draw a similar logo" or infer a brand from prose alone.
2. Route through `cs-brainstorm-research-lead` / `cs-visual-researcher` when possible. If agent nesting is unavailable, use `WebSearch`/`WebFetch` and run the same capture workflow directly.
3. Resolve the generated project's root before capture. Store all researched images, adjacent provenance sidecars, and the authoritative `visual-manifest.json` in `{project_root}/assets/`. Do not use `research/visuals`, `/tmp`, or remote-only references as the final asset location.
4. For a named brand, build a coverage matrix from official portfolio/product/media-kit sources before downloading. Cover the primary identity and useful variants, main products/services or product families, material in-scope sub-brands, and important related campaign, program, event, certification, sponsorship, or partner marks shown by authoritative sources. A single corporate logo is not sufficient when those categories exist.
5. Start from official source-page URLs. The standard capture command is:

   ```powershell
   node --use-system-ca .claude/scripts/collect-visual-reference.cjs --source-page "<official-page-url>" --title "<category>-<asset-name>" --usage-rights "<reference-only|permissive|licensed|owned|unknown>" --attribution "<owner/license note>" --discover-count "4" --output-directory "<project-root>/assets"
   ```

6. Analyze every returned raster `localPath`:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/analyze-visual-reference.ps1 -ImagePath "<returned-localPath>"
   ```

7. Inspect each downloaded file with `Read`, confirm it matches the intended coverage item, and reject irrelevant auto-discovered images. Before implementation, require a non-empty `{project_root}/assets/visual-manifest.json` containing local image paths, source pages, final image URLs, hashes, rights status, dimensions/colors, and completed inspection notes.
8. Search results, remote URLs, prose descriptions, emoji, CSS shapes, invented inline SVGs, and canvas-drawn approximations do not count as actual downloaded company assets.
9. A single-file requirement does not bypass capture. Download and record the real asset first, then embed it as a data URI if that format is genuinely required.
10. If official pages expose no downloadable image or access is blocked, report the attempted pages, uncovered brand-coverage items, and exact failure. Do not fabricate a replacement and call it official.

This invariant is a pre-implementation gate. It does not require visual research for unrelated code-only work.

## Multilingual brand and product research

When the user explicitly says they want the work to be multi-language and the task involves researching products, services, sub-brands, campaigns, screenshots, assets, or UX from real brands:

1. Discover the brand's official native-language names and official localized product/service names from authoritative sources before searching deeply.
2. Search using the official native script and localized names for each requested or relevant language/market. Do not translate, romanize, abbreviate, or "localize" names from your own sense.
3. Preserve exact official names, language/locale, source URL, and any official English/global name in the research artifact.
4. If an official native/localized name cannot be verified, mark it `unknown` or `unverified`; do not invent a translation to fill the gap.
5. Downstream planning may translate explanatory prose, but product and brand names must remain traceable to the official source names used during research.

## UX/UI structure benchmark handoff

For user-facing apps, websites, dashboards, portals, onboarding flows, or data visualization surfaces, research should produce a planning-ready benchmark before PRD/UX planning when the structure or journey is not already decided:

1. Route through `cs-brainstorm-research-lead` / `cs-ux-structure-researcher` when possible.
2. Write the benchmark as `{project_root}/research/ux-structure-benchmark-<date>.md`, or `design-artifacts/<concept-slug>/research/ux-structure-benchmark-<date>.md` when no project root exists.
3. The benchmark must include top-tier app/site references, source-quality notes, IA and navigation findings, journey findings, UX/UI pattern cards, visualization/data-display findings when relevant, state coverage, use/avoid guidance, and a `Planning Connector` table.
4. Planning agents must preserve `IA-#`, `JNY-#`, `PAT-#`, `VIZ-#`, and `DEC-#` connector IDs until they are mapped into final PRD `UJ-#`, `FR-#`, `NFR-#`, UX decisions, or explicit non-use decisions.
5. If no UX benchmark is available for UI-bearing work, planning should record `UX benchmark: not available` with the reason rather than silently proceeding as if the research exists.

## Idea choice-board selection gate (HARD GATE — user must choose in the terminal)

This is a blocking pre-implementation gate. It exists because the brainstorm-research
and engineering subagents run as **forks** and have **no `AskUserQuestion` tool** — only
the main thread can show an interactive choice in the terminal. If the choice board is
not bubbled up to the main thread, the user never sees the options and selection is
silently skipped. That must never happen.

Trigger it whenever a brainstorm/research/engineering subagent produces a set of idea or
concept options intended for the user to pick from — i.e. any wildcard/idea choice board,
a "selection still required" payload, or a returned block marked
`=== USER IDEA SELECTION REQUIRED ===`.

When triggered, the **main thread** must:

1. Stop before PRD, architecture, design, or implementation. Do not let a subagent pick
   the concept on the user's behalf, and do not auto-advance to Phase 2.
2. Show the **full board first as numbered Markdown text** — every card (e.g. all 6
   wildcard + 4 conventional), each with its name and a one-line twist/wedge. Do not drop
   or pre-rank cards away. Then call `AskUserQuestion` to capture the pick. Note
   `AskUserQuestion` allows at most 4 options, so it cannot list 10 cards — use the chips
   for the top recommendations plus a "show me the full list again / none of these" choice,
   and rely on its always-present free-text "Other" so the user can type the number or name
   of any card on the printed board. The point is that the whole board is visible in the
   terminal and the user's choice is captured.
3. **Block** until the user selects, or explicitly says to skip the board and build a named
   concept anyway. Then continue with the chosen direction — if the work was being run by a
   subagent (e.g. `cs-engineering-lead` returned the board and stopped), re-invoke that
   subagent (`SendMessage` to continue it, or a fresh spawn) carrying the user's selection,
   so Phase 2 resumes from the chosen concept.
4. If a subagent returns having "decided" for the user, or hands off to synthesis/planning
   without a recorded user selection, reject that handoff and run step 2 yourself before
   proceeding.

Subagents cannot satisfy this gate by themselves; they must **return** the board upward
(see the `=== USER IDEA SELECTION REQUIRED ===` marker convention) and stop. Enforcement
lives here, in the main thread.

## Pause / resume milestones

When the user says to pause, stop for now, or continue later — or whenever a multi-step
project is left unfinished — save a durable milestone INSIDE the project before stopping:

```
node .claude/scripts/milestone.cjs save --project <project-dir> --stdin
```

Pipe a JSON object with: `title`, `status` (`paused`/`in-progress`/`blocked`/`done`),
`goal`, `branch`, `completed[]`, `next[]` (the exact ordered steps to continue),
`blockers[]`, `filesInFlight[]`, `contextToLoad[]` (files to read first), `delegation`
(which agent/team should resume and how), and `notes`. Write `next[]` so a fresh session
can act on it without re-deriving context. This writes `<project>/MILESTONE.md` +
`<project>/.agent-state/milestone.json` and logs the event to the activity log.

On a new session, the `SessionStart` hook surfaces the latest open milestone automatically.
If you see a `=== RESUME MILESTONE ===` block, read the referenced `MILESTONE.md` and
continue from its `next` steps. Mark `status: "done"` when the work is finished so it stops
being surfaced.

Per-project rule: milestone and delegation data belong INSIDE the project. When work
targets a `sandbox/<name>` project (or any project dir), always pass `--project <dir>` so
`MILESTONE.md`, `.agent-state/milestone.json`, and `.agent-state/activity.jsonl` are written
there. After a meaningful chunk of delegated work on a project — and when you pause it —
also write that project's delegation trace into it:

```
node .claude/scripts/agent-trace.cjs trace --session latest --project <project-dir>
```

This filters the session's delegations to that project and writes
`<project-dir>/.agent-state/delegation-trace.{jsonl,md}`. To analyze a whole session
repo-wide instead, run `agent-trace.cjs trace --session latest` without `--project`. See
`.claude/scripts/AGENT-OBSERVABILITY.md` for the full reference.
