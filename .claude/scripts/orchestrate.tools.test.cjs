/**
 * Offline, zero-spend regression test for the full local toolset:
 * edit_file / search_files / find_files / run_command / web_fetch.
 *
 * Locks in:
 *   1. edit_file applies an exact, unique replacement to a real project file.
 *   2. search_files finds the edited line (path:line: text), find_files globs it.
 *   3. run_command executes in the project dir and returns exit/stdout.
 *   4. web_fetch returns HTML stripped to text AND caches the result in the run
 *      cache ("web:" key) so a replay re-uses it without refetching.
 *
 * Run:  node .claude/scripts/orchestrate.tools.test.cjs
 */
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

process.env.ORCH_BACKEND = "anthropic";
process.env.ANTHROPIC_API_KEY = "test-key-not-used";
process.env.ANTHROPIC_BASE_URL = "https://example.invalid";

const orch = require("./orchestrate.cjs");

let webHits = 0;
let capturedResults = null; // tool_results after the tools turn

global.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes("stub.example")) {
    webHits += 1;
    return {
      ok: true,
      status: 200,
      headers: { get: (h) => (h === "content-type" ? "text/html" : null) },
      text: async () => "<html><body><h1>Stub Page</h1><script>ignored()</script></body></html>",
    };
  }
  // model call
  const body = JSON.parse(opts.body);
  const respond = (resp) => ({ ok: true, status: 200, text: async () => JSON.stringify(resp) });
  const uses = (blocks) => ({ model: "stub", stop_reason: "tool_use", content: blocks });
  if (body.messages.length === 1) {
    return respond(uses([
      { type: "tool_use", id: "w1", name: "write_file", input: { path: "note.txt", content: "alpha beta alpha" } },
    ]));
  }
  if (body.messages.length === 3) {
    return respond(uses([
      { type: "tool_use", id: "e1", name: "edit_file", input: { path: "note.txt", old_string: "beta", new_string: "gamma" } },
      { type: "tool_use", id: "s1", name: "search_files", input: { pattern: "gamma" } },
      { type: "tool_use", id: "f1", name: "find_files", input: { pattern: "*.txt" } },
      { type: "tool_use", id: "c1", name: "run_command", input: { command: "echo hello-orch" } },
      { type: "tool_use", id: "wf1", name: "web_fetch", input: { url: "https://stub.example/page" } },
    ]));
  }
  capturedResults = body.messages[4].content;
  return respond({ model: "stub", stop_reason: "end_turn", content: [{ type: "text", text: "tools wrap" }] });
};

const agents = orch.loadAgents();
// cs-wiki-linter declares Read, Write, Edit, Bash, Grep, Glob — full local set.
const root = agents.get("cs-wiki-linter") || agents.get("cs-engineering-lead");
if (!root) throw new Error("no suitable root agent — cannot run test");
for (const t of ["Edit", "Bash", "Grep", "Glob"]) {
  if (!root.tools.includes(t)) throw new Error(`${root.name} lacks ${t} — test invalid`);
}
// web_fetch needs WebFetch — cs-wiki-linter doesn't declare it, so patch the loaded
// persona copy (frontmatter gate is what's under test, not the file on disk).
if (!root.tools.includes("WebFetch")) root.tools.push("WebFetch");

const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "orch-tools-test-"));

function makeCtx() {
  return {
    agents,
    skills: new Map(),
    projectDir,
    fileMaxChars: 24000,
    cmdTimeout: 60,
    tracer: orch.makeTracer("tools-test", projectDir),
    cache: orch.makeCache(projectDir, "tools-test"),
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
const byId = (id) => (capturedResults || []).find((r) => r.tool_use_id === id);

(async () => {
  const live = makeCtx();
  const product = await orch.runAgent(root, "tools task", 0, [], live);

  check("run completed", product === "tools wrap");
  check("edit_file: file content updated on disk",
    fs.readFileSync(path.join(projectDir, "note.txt"), "utf8") === "alpha gamma alpha");
  check("edit_file: success result", String((byId("e1") || {}).content || "").startsWith("edited note.txt"));
  check("search_files: found the edited line as path:line",
    String((byId("s1") || {}).content || "").includes("note.txt:1:"));
  check("find_files: glob matched the file",
    String((byId("f1") || {}).content || "").split("\n").includes("note.txt"));
  const cmd = String((byId("c1") || {}).content || "");
  check("run_command: executed with exit 0 and stdout", cmd.includes("exit: 0") && cmd.includes("hello-orch"));
  const web = String((byId("wf1") || {}).content || "");
  check("web_fetch: HTML stripped to text", web.includes("Stub Page") && !web.includes("<script>") && !web.includes("ignored()"));
  check("web_fetch: hit the network exactly once", webHits === 1);
  check("trace: edit + search + glob + command + web_fetch events logged",
    ["edit", "search", "glob", "command", "web_fetch"].every((ev) => live.tracer.events.some((e) => e.event === ev)));

  // ---- replay: model turns AND the web result come from the run cache --------
  capturedResults = null;
  const replay = makeCtx();
  const replayProduct = await orch.runAgent(root, "tools task", 0, [], replay);
  check("replay: completed from cache", replayProduct === "tools wrap");
  check("replay: web result served from cache (no refetch)", webHits === 1);
  check("replay: edit re-applied idempotently or skipped without crashing",
    fs.readFileSync(path.join(projectDir, "note.txt"), "utf8") === "alpha gamma alpha");

  try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}

  console.log(failures ? `\n${failures} assertion(s) FAILED` : "\nALL ASSERTIONS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error("test crashed:", e);
  process.exit(2);
});
