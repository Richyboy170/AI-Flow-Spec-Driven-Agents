# Research Source Quality Standard

This standard applies to every web source used by the Brainstorm-Research team. A source is not acceptable merely because it ranks highly in search results, looks professional, or repeats a plausible claim.

## Non-negotiable acceptance gate

For every decision-critical claim, record the exact claim, source URL, publisher/author, publication or last-updated date when available, retrieval date, source type, quality score, and any caveat. The cited page must directly support the claim; a homepage, search-result snippet, or citation to a different claim does not count.

Score each source from 0 to 2 on five dimensions:

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Authority | Unknown or no relevant expertise | Relevant but unclear credentials | Accountable first party, regulator, standards body, original researcher, or recognized expert |
| Evidence transparency | Unsupported assertion | Some method/data disclosed | Inspectable method, data, documentation, or primary records |
| Claim proximity | Repeats another source | Mixed original and secondary material | Direct documentation, dataset, filing, study, observation, or statement |
| Currency and applicability | Undated/stale or wrong market/context | Date/context limitations | Current and directly applicable to the claim |
| Independence or corroboration | Promotional/conflicted and unverified | Conflict disclosed or partial corroboration | Independent evidence, or a direct factual primary source corroborated where needed |

Classify the total:

- **8-10, strong:** accepted for substantive claims.
- **6-7, supporting:** may add context but cannot be the sole basis for a decision-critical claim.
- **0-5, lead only:** useful only for discovery; do not cite it as evidence for a conclusion.

A decision-critical claim must have at least one strong, directly relevant source. Also require a second independent strong source when the claim is disputed, promotional, predictive, safety/legal/financial in nature, a market-size estimate, or a vendor performance claim. If no qualifying source exists, label the claim `unverified`, lower confidence, and make the evidence gap explicit. Never fill the gap with multiple low-quality sources that repeat the same original claim.

## Source selection hierarchy

Prefer the closest accountable source for the claim:

1. Laws, regulations, and public statistics: current regulator, government, court, or official statistical source.
2. Technical capability, limits, pricing, licensing, and terms: current official documentation, specification, repository/release, status page, or terms; independently corroborate real-world performance claims.
3. Academic or scientific claims: original peer-reviewed paper or authoritative systematic review; note study design, sample, and limitations.
4. Company facts: filings, official product/pricing pages, and direct announcements; treat self-reported market leadership, outcomes, and benchmarks as promotional until independently corroborated.
5. Market and customer claims: transparent original datasets/reports, reputable research with methodology, and direct customer evidence. Forums/reviews can demonstrate that a pain exists, but not its prevalence without representative data.
6. Visual and brand facts: official brand/product pages, design systems, media kits, or clearly licensed repositories with provenance.

## Reject or restrict

- Do not use search snippets, AI-generated summaries, content farms, scraped aggregators, affiliate/SEO listicles, anonymous reposts, or unsourced infographics as evidence.
- Wikipedia and general reference pages are discovery aids; follow their citations to the original source.
- News and expert analysis may supply context when reputable and attributable, but use the underlying document for factual claims when available.
- A source that cannot be opened and checked is not verified.
- Recency is claim-dependent. Verify volatile facts such as price, availability, personnel, policies, software limits, and regulation against a current primary source. Explain why an older source remains applicable.
- Independence means independent origin, not merely a different URL. Syndication and circular citations count as one source.

## Required report audit

Every market, technical, or visual research report must include a `Source Quality Audit` table:

| Claim or evidence ID | Source | Type | Score / 10 | Rating | Corroboration | Date fit | Decision use |
|---|---|---|---:|---|---|---|---|

Before handoff, confirm:

- 100% of decision-critical claims pass the acceptance gate.
- Each citation opens to the cited material and supports the exact nearby claim.
- Conflicts between credible sources are shown rather than silently resolved.
- Assumptions, estimates, observations, and sourced facts are labeled separately.
- Unsupported or below-threshold claims are excluded from conclusions or explicitly marked `unverified`.
