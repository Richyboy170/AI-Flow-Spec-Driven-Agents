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

To analyze how agents delegated in a session, use
`node .claude/scripts/agent-trace.cjs trace --session latest`. See
`.claude/scripts/AGENT-OBSERVABILITY.md` for the full reference.
