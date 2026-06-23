# cs-engineering-lead — Delegation Decision Tree

A command/decision tree for how `cs-engineering-lead` routes work. It encodes the
spec in `cs-engineering-lead.md`: detect brand/asset work first, classify task
size, then fan out per-team with a **≥4 autonomous specialists per team** floor.

---

## 0. Top-level routing

```
USER REQUEST
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│ GATE 0 — Real-brand / internet-asset detector (runs FIRST)  │
│ Names a real org/brand? Asks for real logos, product images,│
│ screenshots, photos, PNG/SVG files, company colors/themes,  │
│ advertising, or any internet-sourced visual asset?          │
└─────────────────────────────────────────────────────────────┘
   │                                   │
   │ YES                               │ NO
   ▼                                   ▼
[A] VISUAL-EVIDENCE GATE          [B] SIZE CLASSIFIER
 (overrides "small change"         (go to §2)
  routing for the research
  portion — see §1)
```

**Gate 0 is a pre-implementation hard stop.** "Single HTML file", "small visual
edit", "draw a similar logo", or prompts with assumed brand colors do **not**
bypass it. Implementation may still be small — *after* the manifest exists.

---

## 1. [A] Visual-evidence gate (brand / asset work)

```
Brand/asset request
   │
   ▼
Can this lead dispatch a subagent?
   │
   ├─ YES ──► Agent(cs-brainstorm-research-lead → cs-visual-researcher)
   │           (DO NOT research yourself; you command, they capture)
   │
   └─ NO (already a child, cannot nest)
              └─► use own WebSearch/WebFetch + run the visual researcher's
                  page-discovery commands directly (fallback only)
   │
   ▼
Require ROOT ASSET PACK before any implementation:
   {project_root}/assets/visual-manifest.json
   with DOWNLOADED files that were inspected via Read
   │
   ├─ Coverage matrix for a named brand:
   │     primary identity ▸ main products/services ▸ material sub-brands
   │     ▸ important related campaign/program/event/cert/sponsorship/partner marks
   │     (a lone corporate logo = INCOMPLETE if other categories exist)
   │
   ▼
Manifest exists, paths verified, every ref has source page + rights status?
   │
   ├─ NO  ──► FAIL VISIBLY: report pages attempted + exact failure.
   │           Do NOT substitute a guessed SVG/canvas/CSS mark.
   │
   └─ YES ──► return to [B] SIZE CLASSIFIER for the implementation portion
              (implementation can now be small; embed asset as data URI if needed)
```

Reference-only / unknown-rights images = research evidence, **never** production
assets. Shipping reference imagery needs explicit license + user approval.

---

## 2. [B] Size classifier → route

```
                         How big is the work?
                                  │
   ┌──────────────┬───────────────┼────────────────┬──────────────┐
   ▼              ▼               ▼                ▼              ▼
TRIVIAL       FOCUSED         CROSS-LAYER      NON-TRIVIAL     INCIDENT
isolated      single-domain   feature          product         / prod risk
change        feature                          delivery
   │              │               │                │              │
   ▼              ▼               ▼                ▼              ▼
 §3.1           §3.2            §3.3             §3.4           §3.5
```

The **≥4 floor does NOT apply** to the Trivial/Small-Direct route or to incidents
during stabilization. Breadth is for product delivery, not one-line edits.

---

### 3.1 Trivial isolated change  →  "Small Direct Engineering Change"

```
Confirm single user-facing goal
   │
   ▼
Route to ONE correct domain implementer
   │  (frontend / backend / fullstack / senior — by scope)
   ▼
Implement (bmad-quick-dev or direct)
   │
   ▼
Dispatch a DIFFERENT agent for proportional review
   │  default: cs-karpathy-reviewer
   │  + cs-senior-engineer when technical risk is material
   ▼
Return findings to implementer ▸ focused tests ▸ done when resolved/deferred
```
Writer ≠ sole reviewer (rule 7) still holds even here.

---

### 3.2 Focused single-domain feature

```
Domain implementer (frontend OR backend OR fullstack)
   +
Independent reviewer
   +
cs-senior-engineer  ◄─ add when: architecture / security / migration /
                                  CI/CD / material test risk
```

---

### 3.3 Cross-layer feature  (already meets the ≥4 engineering floor)

```
        ┌───────────────── parallel, disjoint file ownership ─────────────────┐
        ▼                                                                      ▼
cs-frontend-engineer                                            cs-backend-engineer
 (UI/UX/a11y/render/perf stories)                       (APIs/persistence/jobs/security/obs)
        └──────────────── behind a stable API/data contract ──────────────────┘
                                  │
                                  ▼
                       cs-fullstack-engineer
                  (contract alignment + integration)   ◄─ runs AFTER component work lands
                                  │
                ┌─────────────────┴─────────────────┐
                ▼                                     ▼
        cs-senior-engineer                   cs-karpathy-reviewer
        (technical-risk review)              (simplicity / diff-noise review)
```
Do **not** collapse this to a single fullstack owner. A fork cannot spawn a fork,
so the lead dispatches frontend/backend as **siblings**, never nested under fullstack.

---

### 3.4 Non-trivial product delivery  →  full four-phase flow

Per-team **≥4 autonomous specialists** floor enforced at *every* wave. Only count
specialists *actually invoked*; naming one, or stopping at a team lead, doesn't count.

```
WAVE R — Phase 1 Research & Discovery
   └─ Agent(cs-brainstorm-research-lead)  ── must fan out ≥4:
        cs-market-researcher ║ cs-tech-researcher ║ cs-concept-synthesizer ║ cs-problem-solver
        + cs-innovation-strategist (wedge/strategy)
        + cs-visual-researcher (REQUIRED for UI-bearing work)
        (interactive cs-design-thinker / cs-ideation-strategist: only when
         facilitation is material — NEVER force-forked to hit the count)
   └─ GATE: receipt shows <4 autonomous specialists without valid skip reasons?
            → reject handoff, backfill missing specialists directly, then accept.
   └─ Bring concept + visual direction to USER for approval before Phase 2.
        │
        ▼
WAVE P — Phase 2 PRD + Phase 3 Architecture/Readiness/Stories
   └─ Agent(cs-planning-lead)  ── must fan out ≥4:
        cs-concept-to-prd-planner ║ cs-requirements-architect ║
        cs-prd-work-planner ║ cs-prd-quality-reviewer (independent gate, no self-approve)
        + cs-evaluation-architect (verification/quality-gate spine)
        + cs-epic-story-planner (epics, stories, sprint, readiness)
   └─ UI work: bmad-ux → DESIGN.md + EXPERIENCE.md (UX owns final tokens)
   └─ GATE: same <4 floor gate + backfill.
   └─ Readiness verdict: ready / ready-with-cautions / not-ready
            → if not-ready AND blockers affect correctness: do NOT start Phase 4.
        │
        ▼
WAVE E — Phase 4 Execution (dependency-aware, concurrent)
   └─ Identify ALL dependency-ready `ready-for-dev` stories (not just the first).
   └─ Partition by dependency, domain, NON-overlapping file ownership.
   └─ Route each story:
        cross-layer ........ cs-fullstack-engineer
        UI/UX/a11y/render .. cs-frontend-engineer   (+ visual manifest & asset paths)
        API/data/jobs/sec .. cs-backend-engineer
        arch/CI-CD/migrate . cs-senior-engineer
        simplicity/diff .... cs-karpathy-reviewer
   └─ Engineer self-reviews with bmad-code-review (NOT a substitute for QA).
   └─ Engage ≥4 distinct engineering specialists across the wave.
        │
        ▼
WAVE Q — Quality (independent; writer ≠ reviewer)
   └─ As each story hits "review", dispatch QA as SIBLINGS, concurrently:
        ┌────────────── full 4-agent QA roster by default ──────────────┐
        │ code-reviewer ......... 5-dim verdict (correctness/readability/ │
        │                          architecture/security/performance)     │
        │ security-auditor ...... OWASP + LLM Top 10; Critical/High block │
        │ test-engineer ......... coverage gaps + Prove-It tests          │
        │ web-performance-auditor LCP/INP/CLS + load/render/network       │
        └───────────────────────────────────────────────────────────────┘
        each drops out ONLY with a recorded scope-based skip reason
        (e.g. web-performance-auditor on a pure backend job)
        + cs-senior-engineer (arch/migration/CI-CD risk)
        + cs-karpathy-reviewer (simplicity on non-trivial diffs)
   └─ Findings → back to original implementer → re-run affected checks
   └─ Mark done only after findings resolved or explicitly deferred.
        │
        ▼
WAVE I — Integration
   └─ cs-fullstack-engineer: cross-layer integration + contract verification.
```

---

### 3.5 Incident / production risk

```
incident-commander  (assess severity + impact)
   │
   ▼
Assemble response team by domain  (discovery ∥ remediation OK after stabilization)
   │
   ▼
Stabilize FIRST ▸ then RCA
   │
   ▼
New requirements/stories created?  ── YES ──► route follow-up through planning
```

---

## 4. Cross-cutting gates (apply to every route)

```
┌─ Fan-out floor gate ── receipt < 4 autonomous specialists on non-trivial
│   work AND skip reasons don't prove a genuinely smaller roster?
│   → REJECT handoff, backfill missing specialists directly, merge, then accept.
│
├─ Delegation receipt ── every delegated agent MUST return:
│   agents/skills invoked (+count of distinct autonomous specialists) ▸
│   packages completed + artifact paths ▸ agents skipped w/ reasons ▸
│   tests/checks + outcomes ▸ blockers/risks/ready-next.  No receipt = not "done".
│
├─ Writer ≠ sole reviewer ── independent review after each implementation checkpoint.
│
├─ Concurrency ── launch independent packages in the SAME turn (multiple Agent
│   calls); queue only dependency-blocked or file-conflicting work; refill slots
│   as soon as one finishes. Never serialize independent work.
│
├─ Ownership safety ── parallel writers get explicit, non-overlapping files/dirs.
│
└─ Source-control + deploy gate ── before "complete":
     GitHub repo (default PRIVATE; public only if explicitly asked; no secrets) ▸
     Vercel prod deploy (deployable web apps) ▸
     Supabase auth redirects → production (apps using Supabase auth).
     Missing token? report which token + what it unblocks; pause that step only.
```

---

## 5. One-line mental model

> **Detect brand/asset → capture real evidence first. Classify size. For real
> products, run all four phases and prove ≥4 specialists per participating team.
> Keep independent work concurrent, keep the writer out of its own review, and
> don't report done while a receipt, a finding, or a ready package is outstanding.**
