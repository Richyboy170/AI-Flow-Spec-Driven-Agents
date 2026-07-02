/**
 * Offline, zero-spend regression test for Agent Teams-style parallel delegation
 * and the use_skill tool.
 *
 * Stubs global fetch (no network) and drives the REAL exported runAgent to lock in:
 *
 *   1. WAVE PARALLELISM — two `delegate` calls in ONE turn run CONCURRENTLY when
 *      ctx.maxParallel >= 2 (observed via an in-flight counter in the fetch stub),
 *      and strictly one-at-a-time when ctx.maxParallel is 1/unset (the pre-existing
 *      sequential behavior, which the budget test also depends on).
 *   2. RESULT ORDER — tool_results return to the parent in tool_use order, whatever
 *      order the teammates finished in.
 *   3. SKILL VISIBILITY — a `use_skill` call returns the real SKILL.md body as its
 *      tool_result and logs a `skill` trace event, so skill usage is auditable.
 *
 * Run:  node .claude/scripts/orchestrate.parallel.test.cjs
 */
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

// Credential-free backend BEFORE requiring the module (fetch is stubbed anyway).
process.env.ORCH_BACKEND = "anthropic";
process.env.ANTHROPIC_API_KEY = "test-key-not-used";
process.env.ANTHROPIC_BASE_URL = "https://example.invalid";

const orch = require("./orchestrate.cjs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const A = "cs-market-researcher";
const B = "cs-tech-researcher";

// --- body-keyed stub fetch (parallel starts are not strictly ordered) --------
let inFlight = 0;
let maxInFlight = 0;
let capturedWrapRequest = null; // root's post-wave request, for order assertions
let capturedSkillResult = null; // tool_result the model sees after use_skill
let skillName = null; // set in the harness once skills are loaded

global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  const first = body.messages[0].content;
  const task = typeof first === "string" ? first : "";

  const respond = (resp) => ({ ok: true, status: 200, text: async () => JSON.stringify(resp) });
  const leaf = (text) => ({ model: "stub", stop_reason: "end_turn", content: [{ type: "text", text }] });

  if (task === "root task") {
    if (body.messages.length === 1) {
      // Root turn 0: fan out A and B in ONE turn — this is the wave.
      return respond({
        model: "stub",
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "d1", name: "delegate", input: { agent: A, task: "do A" } },
          { type: "tool_use", id: "d2", name: "delegate", input: { agent: B, task: "do B" } },
        ],
      });
    }
    capturedWrapRequest = body; // messages: [user, assistant(tool_use), user(tool_results)]
    return respond(leaf("root wrap"));
  }

  if (task === "do A" || task === "do B") {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await sleep(60); // hold the slot so overlap is observable
    inFlight -= 1;
    return respond(leaf(task + " done"));
  }

  if (task === "skill task") {
    if (body.messages.length === 1) {
      return respond({
        model: "stub",
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "s1", name: "use_skill", input: { skill: skillName } }],
      });
    }
    capturedSkillResult = body.messages[2].content[0];
    return respond(leaf("skill wrap"));
  }

  throw new Error("stub fetch: unexpected request task: " + JSON.stringify(task).slice(0, 120));
};

// --- harness -----------------------------------------------------------------
const agents = orch.loadAgents();
const skills = orch.loadSkills();
const root = agents.get("cs-engineering-lead");
if (!root) throw new Error("cs-engineering-lead not loadable — cannot run test");
for (const n of [A, B]) {
  const p = agents.get(n);
  if (!p || !p.forkSafe) throw new Error(`target ${n} missing or not fork-safe — test invalid`);
}
if (!skills.size) throw new Error("no skills found under .claude/skills — test invalid");
skillName = skills.keys().next().value;

function makeCtx(projectDir, maxParallel) {
  return {
    agents,
    skills,
    tracer: orch.makeTracer("parallel-test", projectDir),
    cache: orch.makeCache(projectDir, "parallel-test"),
    interactive: false,
    quiet: true,
    budget: { used: 0, max: 10 },
    askBudget: { used: 0, max: 4 },
    maxDepth: 4,
    maxTurns: 8,
    maxTokens: 1000,
    maxRetries: 0,
    maxParallel,
    skillMaxChars: 12000,
  };
}

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};

(async () => {
  const tmp = (tag) => fs.mkdtempSync(path.join(os.tmpdir(), `orch-parallel-test-${tag}-`));
  const dirs = [];

  // ---- Scenario 1: maxParallel=2 — the wave overlaps -------------------------
  let dir = tmp("wave2");
  dirs.push(dir);
  const par = makeCtx(dir, 2);
  const parProduct = await orch.runAgent(root, "root task", 0, [], par);
  check("parallel: two teammates ran CONCURRENTLY (maxInFlight=2)", maxInFlight === 2);
  check("parallel: root synthesized after the wave", parProduct === "root wrap");
  check("parallel: budget charged exactly 2", par.budget.used === 2);
  check("parallel: team_wave trace event with both teammates",
    par.tracer.events.some((e) => e.event === "team_wave" && e.size === 2 &&
      e.teammates.includes(A) && e.teammates.includes(B)));
  const toolResults = capturedWrapRequest && capturedWrapRequest.messages[2].content;
  check("parallel: tool_results returned in tool_use order (d1, d2)",
    Array.isArray(toolResults) && toolResults.length === 2 &&
      toolResults[0].tool_use_id === "d1" && toolResults[0].content === "do A done" &&
      toolResults[1].tool_use_id === "d2" && toolResults[1].content === "do B done");

  // ---- Scenario 2: maxParallel unset — strictly sequential --------------------
  inFlight = 0;
  maxInFlight = 0;
  capturedWrapRequest = null;
  dir = tmp("seq");
  dirs.push(dir);
  const seq = makeCtx(dir, undefined); // ctx without maxParallel (budget-test shape)
  const seqProduct = await orch.runAgent(root, "root task", 0, [], seq);
  check("sequential: unset maxParallel means one teammate at a time (maxInFlight=1)", maxInFlight === 1);
  check("sequential: same final product", seqProduct === "root wrap");

  // ---- Scenario 3: use_skill returns the real SKILL.md and is traced ----------
  dir = tmp("skill");
  dirs.push(dir);
  const sk = makeCtx(dir, 2);
  const skProduct = await orch.runAgent(root, "skill task", 0, [], sk);
  const skillBody = fs.readFileSync(skills.get(skillName), "utf8").slice(0, 200);
  check("skill: run completed after loading the skill", skProduct === "skill wrap");
  check("skill: tool_result carries the real SKILL.md content",
    !!capturedSkillResult && capturedSkillResult.tool_use_id === "s1" &&
      String(capturedSkillResult.content).startsWith(skillBody));
  check("skill: `skill` trace event logged with the skill name",
    sk.tracer.events.some((e) => e.event === "skill" && e.skill === skillName && e.agent === root.name));

  for (const d of dirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  }

  console.log(failures ? `\n${failures} assertion(s) FAILED` : "\nALL ASSERTIONS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("test crashed:", e);
  process.exit(2);
});
