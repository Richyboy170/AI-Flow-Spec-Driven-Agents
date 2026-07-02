/**
 * Offline, zero-spend regression test for the sandboxed file tools
 * (write_file / read_file / list_files).
 *
 * Locks in:
 *   1. REAL OUTPUT — an agent's write_file produces an actual file inside the
 *      project directory (this is what makes orchestrated runs emit app code).
 *   2. SANDBOX — paths escaping the project dir and writes into .agent-state
 *      are refused with is_error tool_results (and fs_refused trace events).
 *   3. READ/LIST — read_file returns the real content; list_files sees the tree.
 *   4. REPLAY REBUILDS — re-running from cache (zero live calls) re-executes the
 *      writes, so a resumed run reconstructs its files deterministically.
 *
 * Run:  node .claude/scripts/orchestrate.effects.test.cjs
 */
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

process.env.ORCH_BACKEND = "anthropic";
process.env.ANTHROPIC_API_KEY = "test-key-not-used";
process.env.ANTHROPIC_BASE_URL = "https://example.invalid";

const orch = require("./orchestrate.cjs");

const HTML = "<h1>eat food</h1>";
let fetchCalls = 0;
let capturedWriteResults = null; // tool_results after the write turn
let capturedReadResults = null; // tool_results after the read/list turn

global.fetch = async (url, opts) => {
  fetchCalls += 1;
  const body = JSON.parse(opts.body);
  const respond = (resp) => ({ ok: true, status: 200, text: async () => JSON.stringify(resp) });
  const leaf = (text) => ({ model: "stub", stop_reason: "end_turn", content: [{ type: "text", text }] });
  const uses = (blocks) => ({ model: "stub", stop_reason: "tool_use", content: blocks });

  if (body.messages.length === 1) {
    // Turn 0: one good write, one escape attempt, one reserved-dir attempt.
    return respond(uses([
      { type: "tool_use", id: "w1", name: "write_file", input: { path: "src/app/index.html", content: HTML } },
      { type: "tool_use", id: "w2", name: "write_file", input: { path: "../evil.txt", content: "nope" } },
      { type: "tool_use", id: "w3", name: "write_file", input: { path: ".agent-state/hack.txt", content: "nope" } },
    ]));
  }
  if (body.messages.length === 3) {
    capturedWriteResults = body.messages[2].content;
    return respond(uses([
      { type: "tool_use", id: "r1", name: "read_file", input: { path: "src/app/index.html" } },
      { type: "tool_use", id: "l1", name: "list_files", input: {} },
    ]));
  }
  capturedReadResults = body.messages[4].content;
  return respond(leaf("fx wrap"));
};

// --- harness -----------------------------------------------------------------
const agents = orch.loadAgents();
const root = agents.get("cs-engineering-lead");
if (!root) throw new Error("cs-engineering-lead not loadable — cannot run test");
if (!root.tools.includes("Write") || !root.tools.includes("Read"))
  throw new Error("cs-engineering-lead lacks Write/Read frontmatter tools — test invalid");

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "orch-fx-test-"));

function makeCtx() {
  return {
    agents,
    skills: new Map(), // no use_skill tool — keep request bodies minimal
    projectDir,
    fileMaxChars: 24000,
    tracer: orch.makeTracer("fx-test", projectDir),
    cache: orch.makeCache(projectDir, "fx-test"),
    interactive: false,
    quiet: true,
    budget: { used: 0, max: 10 },
    askBudget: { used: 0, max: 4 },
    maxDepth: 4,
    maxTurns: 8,
    maxTokens: 1000,
    maxRetries: 0,
    maxParallel: 2,
  };
}

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};
const byId = (results, id) => (results || []).find((r) => r.tool_use_id === id);

(async () => {
  // ---- Scenario 1: live run writes real files, sandbox holds ----------------
  const live = makeCtx();
  const product = await orch.runAgent(root, "fx task", 0, [], live);
  const outFile = path.join(projectDir, "src", "app", "index.html");

  check("write: agent produced a REAL file in the project dir",
    fs.existsSync(outFile) && fs.readFileSync(outFile, "utf8") === HTML);
  check("write: success tool_result reported bytes",
    String((byId(capturedWriteResults, "w1") || {}).content || "").startsWith("wrote "));
  check("sandbox: ../ escape refused with is_error",
    (byId(capturedWriteResults, "w2") || {}).is_error === true &&
      !fs.existsSync(path.join(projectDir, "..", "evil.txt")));
  check("sandbox: .agent-state write refused with is_error",
    (byId(capturedWriteResults, "w3") || {}).is_error === true &&
      !fs.existsSync(path.join(projectDir, ".agent-state", "hack.txt")));
  check("read: read_file returned the real content",
    (byId(capturedReadResults, "r1") || {}).content === HTML);
  check("list: list_files sees the written tree",
    String((byId(capturedReadResults, "l1") || {}).content || "").includes("src/app/index.html"));
  check("trace: write + read + list + fs_refused events logged",
    ["write", "read", "list", "fs_refused"].every((ev) => live.tracer.events.some((e) => e.event === ev)));
  check("run completed with the wrap product", product === "fx wrap");

  // ---- Scenario 2: replay from cache REBUILDS the files (zero live calls) ----
  fs.rmSync(path.join(projectDir, "src"), { recursive: true, force: true });
  const callsBefore = fetchCalls;
  const replay = makeCtx(); // same projectDir -> same cache file
  const replayProduct = await orch.runAgent(root, "fx task", 0, [], replay);
  check("replay: zero live model calls (all from cache)", fetchCalls === callsBefore);
  check("replay: the deleted file was REBUILT from cached responses",
    fs.existsSync(outFile) && fs.readFileSync(outFile, "utf8") === HTML);
  check("replay: same product", replayProduct === "fx wrap");

  try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}

  console.log(failures ? `\n${failures} assertion(s) FAILED` : "\nALL ASSERTIONS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("test crashed:", e);
  process.exit(2);
});
