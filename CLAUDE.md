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
