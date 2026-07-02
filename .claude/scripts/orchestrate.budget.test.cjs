/**
 * Offline, zero-spend regression test for the delegation-budget / resume fix.
 *
 * Stubs global fetch (no network, no API key used) and drives the REAL exported
 * runAgent through a scripted delegation sequence to lock in two behaviours:
 *
 *   1. HONEST HALT — when a live run hits the delegation budget, the run records
 *      ctx.limitHit ({kind:"budget"}) so it is saved as `blocked`, not a false
 *      `done`. (This is the bug the eat-food run hit: it stopped mid-plan but was
 *      labelled done.)
 *   2. RESUME ACTUALLY ADVANCES — on re-run against the same cache, the completed
 *      delegations replay from cache WITHOUT re-charging the budget, so the run
 *      gets past the cap and completes. Before the fix, replays re-paid the budget
 *      and every resume stalled at the same wall — the run could never finish.
 *
 * Run:  node .claude/scripts/orchestrate.budget.test.cjs
 */
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

// Force a credential-free backend BEFORE requiring the module. The fetch stub
// means the key is never sent; this only stops resolveBackend() from reading the
// real Claude Code OAuth token file.
process.env.ORCH_BACKEND = "anthropic";
process.env.ANTHROPIC_API_KEY = "test-key-not-used";
process.env.ANTHROPIC_BASE_URL = "https://example.invalid";

const orch = require("./orchestrate.cjs");

// --- scripted model responses (served only on cache MISS) --------------------
const delegate = (agent, id) => ({
  model: "stub",
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name: "delegate", input: { agent, task: "do " + agent } }],
});
const leaf = (text) => ({ model: "stub", stop_reason: "end_turn", content: [{ type: "text", text }] });

const A = "cs-market-researcher";
const B = "cs-tech-researcher";
const C = "cs-ux-structure-researcher";

// Cold run produces responses 1-6; the C delegation is refused (budget=2) so C is
// never fetched. Resume replays 1-6 from cache and needs only C + a fresh wrap.
const queue = [
  delegate(A, "d1"), //  1  root turn0
  leaf("A done"), //     2  A turn0
  delegate(B, "d2"), //  3  root turn1
  leaf("B done"), //     4  B turn0
  delegate(C, "d3"), //  5  root turn2 (cold: C refused here -> budget)
  leaf("root wrap cold"), // 6 root turn3
  leaf("C done"), //     7  resume: C runs live for the first time
  leaf("root wrap resume"), // 8 resume: root's new turn after C returns
];
let fetchCalls = 0;
global.fetch = async () => {
  fetchCalls += 1;
  if (!queue.length) throw new Error("stub fetch: response queue exhausted (unexpected live call)");
  const body = JSON.stringify(queue.shift());
  return { ok: true, status: 200, text: async () => body };
};

// --- harness -----------------------------------------------------------------
const agents = orch.loadAgents();
const root = agents.get("cs-engineering-lead");
if (!root) throw new Error("cs-engineering-lead not loadable — cannot run test");
if (!root.canDelegate) throw new Error("cs-engineering-lead lacks delegate capability — test invalid");
for (const n of [A, B, C]) {
  const p = agents.get(n);
  if (!p || !p.forkSafe) throw new Error(`target ${n} missing or not fork-safe — test invalid`);
}

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "orch-budget-test-"));
const runId = "budget-test";

function makeCtx() {
  return {
    agents,
    tracer: orch.makeTracer(runId, projectDir),
    cache: orch.makeCache(projectDir, runId),
    interactive: false,
    quiet: true,
    budget: { used: 0, max: 2 },
    askBudget: { used: 0, max: 4 },
    maxDepth: 4,
    maxTurns: 8,
    maxTokens: 1000,
    maxRetries: 0,
  };
}

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};

(async () => {
  // ---- Scenario 1: cold run hits the budget and halts honestly --------------
  const cold = makeCtx();
  const coldProduct = await orch.runAgent(root, "root task", 0, [], cold);
  check("cold: budget counted exactly 2 live delegations", cold.budget.used === 2);
  check("cold: run recorded a budget limit-hit (would save as `blocked`)",
    !!cold.limitHit && cold.limitHit.kind === "budget");
  check("cold: root still returned a product", coldProduct === "root wrap cold");

  // ---- Scenario 2: resume replays for free and gets PAST the cap ------------
  const resume = makeCtx(); // fresh ctx + budget, SAME cache file on disk
  const resumeProduct = await orch.runAgent(root, "root task", 0, [], resume);
  check("resume: NO limit-hit — the run got past the cap and completed",
    resume.limitHit === undefined);
  check("resume: completed with the post-cap work product", resumeProduct === "root wrap resume");
  check("resume: replayed cached delegations were NOT re-charged to the budget",
    resume.budget.used <= 1); // only genuinely-new (post-frontier) work can count

  // cleanup
  try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}

  console.log(failures ? `\n${failures} assertion(s) FAILED` : "\nALL ASSERTIONS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("test crashed:", e);
  process.exit(2);
});
