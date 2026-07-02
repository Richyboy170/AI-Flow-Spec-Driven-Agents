/**
 * Offline regression test for auto-resume attempt state.
 *
 * A rate-limited attempt may have already spent its in-memory delegation budget
 * before the 429 bubbles up. Auto-resume must build a fresh attempt context,
 * reload the same run cache from disk, and replay to the failed frontier. If it
 * reuses the old context, stale counters can block the retry even after the
 * external rate limit has reset.
 *
 * Run:  node .claude/scripts/orchestrate.auto-resume.test.cjs
 */
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

process.env.ORCH_BACKEND = "anthropic";
process.env.ANTHROPIC_API_KEY = "test-key-not-used";
process.env.ANTHROPIC_BASE_URL = "https://example.invalid";

const orch = require("./orchestrate.cjs");

const A = "cs-market-researcher";
const B = "cs-tech-researcher";

const delegate = (agent, id) => ({
  model: "stub",
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name: "delegate", input: { agent, task: "do " + agent } }],
});
const leaf = (text) => ({ model: "stub", stop_reason: "end_turn", content: [{ type: "text", text }] });
const ok = (resp) => ({ ok: true, status: 200, text: async () => JSON.stringify(resp) });
const rateLimit = () => ({
  ok: false,
  status: 429,
  headers: { get: (h) => (String(h).toLowerCase() === "retry-after" ? "1" : null) },
  text: async () => "rate limit: reset soon",
});

let bCalls = 0;
global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  const first = body.messages[0].content;
  const task = typeof first === "string" ? first : "";

  if (task === "root task") {
    if (body.messages.length === 1) return ok(delegate(A, "d1"));
    if (body.messages.length === 3) return ok(delegate(B, "d2"));
    if (body.messages.length === 5) return ok(leaf("root final"));
  }
  if (task === "do " + A) return ok(leaf("A done"));
  if (task === "do " + B) {
    bCalls += 1;
    return bCalls === 1 ? rateLimit() : ok(leaf("B done"));
  }
  throw new Error("stub fetch: unexpected task " + JSON.stringify(task));
};

const agents = orch.loadAgents();
const root = agents.get("cs-engineering-lead");
if (!root) throw new Error("cs-engineering-lead not loadable - cannot run test");
for (const n of [A, B]) {
  const p = agents.get(n);
  if (!p || !p.forkSafe) throw new Error(`target ${n} missing or not fork-safe - test invalid`);
}

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "orch-auto-resume-test-"));
const runId = "auto-resume-test";
const opts = {
  agents,
  skills: new Map(),
  runId,
  projectDir,
  noEffects: true,
  fileMaxChars: 24000,
  cmdTimeout: 60,
  interactive: false,
  maxDelegations: 2,
  maxAsks: 4,
  maxDepth: 4,
  maxTurns: 8,
  maxTokens: 1000,
  maxRetries: 0,
  maxParallel: 1,
  skillMaxChars: 12000,
  traceTextChars: 2000,
  askTimeout: 60,
  autoResume: true,
  resumeDelay: 1,
  quiet: true,
};

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};

(async () => {
  const first = orch.makeAttemptContext(opts);
  let caught;
  try {
    await orch.runAgent(root, "root task", 0, [], first);
  } catch (e) {
    caught = e;
  }
  check("first attempt: propagated a recoverable rate-limit error", !!caught && caught.rateLimited === true);
  check("first attempt: spent live budget before the 429", first.budget.used === 2);

  const retry = orch.makeAttemptContext(opts);
  const product = await orch.runAgent(root, "root task", 0, [], retry);
  check("retry: reloaded cached responses from disk", retry.cache.restored >= 3);
  check("retry: replayed cached work and completed past the rate limit", product === "root final");
  check("retry: stale first-attempt budget did not carry over", retry.limitHit === undefined);
  check("retry-after: numeric header parsed as seconds", orch.retryAfterSeconds("90", 0) === 90);
  check("retry-after: HTTP-date header parsed as reset delay",
    orch.retryAfterSeconds("Thu, 01 Jan 1970 00:02:00 GMT", 0) === 120);

  try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}

  console.log(failures ? `\n${failures} assertion(s) FAILED` : "\nALL ASSERTIONS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("test crashed:", e);
  process.exit(2);
});
