#!/usr/bin/env node
"use strict";

/*
 * agent-trace.cjs — reconstruct and analyze how agents delegate to each other.
 *
 * Source of truth: Claude Code session transcripts on disk. Every time an agent
 * spawns another agent (the `Agent`/`Task` tool), Claude Code writes:
 *   <projects>/<slug>/<session>.jsonl            (the main/root session)
 *   <projects>/<slug>/<session>/subagents/agent-<hash>.jsonl       (each subagent)
 *   <projects>/<slug>/<session>/subagents/agent-<hash>.meta.json   ({agentType, description, toolUseId})
 *
 * Each subagent's meta.toolUseId points back to the exact `Agent` tool_use block
 * in its PARENT transcript — so we can rebuild the full who-delegated-to-whom tree,
 * including nested agent->agent->agent chains, for any past or current session.
 *
 * Usage:
 *   node .claude/scripts/agent-trace.cjs sessions [--limit 20]
 *   node .claude/scripts/agent-trace.cjs trace [--session latest|<id>] [--project <dir>]
 *        [--json] [--out <file>] [--full-prompts]
 *   node .claude/scripts/agent-trace.cjs watch  [--session latest|<id>] [--project <dir>] [--interval 5]
 *
 * --project <dir> attributes/filters the session's delegations to one project
 * (a delegation belongs to a project when the subagent's cwd is inside it OR the
 * project path appears in the spawn prompt) and writes that project's trace into
 *   <dir>/.agent-state/delegation-trace.jsonl   (structured events)
 *   <dir>/.agent-state/delegation-trace.md      (rendered tree + timeline)
 * It also reads <dir>/.agent-state/activity.jsonl for milestone markers.
 *
 * Options:
 *   --projects-dir <path>  Override the Claude Code projects directory.
 *   --cwd <path>           Resolve the project slug / repo base from this path.
 *   --json                 Emit a structured JSONL event log (default when --project).
 *   --out <file>           Where to write --json output.
 *   --full-prompts         Do not truncate spawn prompts in the rendered tree.
 *
 * Never throws on bad data — best-effort parse, degrade gracefully.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROMPT_PREVIEW = 160;
const MAIN = "__main__";

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(a);
    }
  }
  return { command: positional[0], positional, flags };
}

function projectSlug(cwd) {
  // C:\Users\me\Desktop\Projects\foo -> C--Users-me-Desktop-Projects-foo
  return cwd.replace(/[:\\/]/g, "-");
}

function projectsDir(flags) {
  if (flags["projects-dir"]) return flags["projects-dir"];
  return path.join(os.homedir(), ".claude", "projects");
}

function repoBase(flags) {
  return flags.cwd || process.cwd();
}

function sessionDir(flags) {
  return path.join(projectsDir(flags), projectSlug(repoBase(flags)));
}

function readLinesSafe(file) {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function parseJsonSafe(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function normPath(s) {
  return String(s || "").replace(/\\/g, "/").toLowerCase();
}

function listSessions(flags) {
  const dir = sessionDir(flags);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { dir, sessions: [] };
  }
  const sessions = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
    const id = e.name.slice(0, -".jsonl".length);
    const full = path.join(dir, e.name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    const subDir = path.join(dir, id, "subagents");
    let subCount = 0;
    try {
      subCount = fs.readdirSync(subDir).filter((f) => f.endsWith(".meta.json")).length;
    } catch {
      /* no subagents */
    }
    sessions.push({ id, file: full, mtime: stat.mtime, size: stat.size, subCount });
  }
  sessions.sort((a, b) => b.mtime - a.mtime);
  return { dir, sessions };
}

function firstUserText(file) {
  for (const line of readLinesSafe(file)) {
    const o = parseJsonSafe(line);
    if (!o || o.type !== "user" || !o.message) continue;
    const content = o.message.content;
    let text = "";
    if (typeof content === "string") text = content;
    else if (Array.isArray(content)) {
      const t = content.find((c) => c && c.type === "text");
      if (t) text = t.text;
      else if (content[0] && typeof content[0] === "string") text = content[0];
    }
    text = (text || "").replace(/\s+/g, " ").trim();
    if (text && !text.startsWith("<")) return text.slice(0, 90);
  }
  return "";
}

function resolveSessionId(flags) {
  const want = flags.session || "latest";
  const { sessions } = listSessions(flags);
  if (sessions.length === 0) return null;
  if (want === "latest") return sessions[0].id;
  const exact = sessions.find((s) => s.id === want);
  if (exact) return exact.id;
  const pref = sessions.find((s) => s.id.startsWith(want));
  return pref ? pref.id : want;
}

/*
 * Build the full delegation model for one session: index every Agent/Task
 * tool_use block across the main + all subagent transcripts, map each subagent
 * (via meta.toolUseId) to the spawn block that created it, resolve each spawn's
 * host transcript to an actor, and assemble parent->child edges + timing + cwd.
 */
function buildModel(flags, sessionId) {
  const dir = sessionDir(flags);
  const mainFile = path.join(dir, `${sessionId}.jsonl`);
  const subDir = path.join(dir, sessionId, "subagents");

  if (!fs.existsSync(mainFile)) {
    return { error: `Main transcript not found: ${mainFile}` };
  }

  const fileActor = new Map();
  fileActor.set(mainFile, MAIN);
  const spawnById = new Map(); // toolUseId -> spawn info
  const timing = new Map(); // file -> {firstTs, lastTs, cwd}

  function scanTranscript(file) {
    const lines = readLinesSafe(file);
    let firstTs = null;
    let lastTs = null;
    let cwd = null;
    for (const line of lines) {
      const o = parseJsonSafe(line);
      if (!o) continue;
      if (o.cwd && !cwd) cwd = o.cwd;
      if (o.timestamp) {
        if (!firstTs) firstTs = o.timestamp;
        lastTs = o.timestamp;
      }
      const msg = o.message;
      if (!msg || !Array.isArray(msg.content)) continue;
      for (const c of msg.content) {
        if (c && c.type === "tool_use" && (c.name === "Agent" || c.name === "Task")) {
          const input = c.input || {};
          spawnById.set(c.id, {
            id: c.id,
            hostFile: file,
            subagentType: input.subagent_type || input.subagentType || "(unknown)",
            description: input.description || "",
            prompt: input.prompt || "",
            ts: o.timestamp || null,
          });
        }
      }
    }
    timing.set(file, { firstTs, lastTs, cwd });
  }

  scanTranscript(mainFile);

  const subagents = [];
  let metaFiles = [];
  try {
    metaFiles = fs.readdirSync(subDir).filter((f) => f.endsWith(".meta.json"));
  } catch {
    /* none */
  }
  for (const mf of metaFiles) {
    const meta = parseJsonSafe(fs.readFileSync(path.join(subDir, mf), "utf8")) || {};
    const agentId = mf.replace(/\.meta\.json$/, "");
    subagents.push({
      file: path.join(subDir, `${agentId}.jsonl`),
      agentId,
      agentType: meta.agentType || "(unknown)",
      description: meta.description || "",
      toolUseId: meta.toolUseId || null,
    });
  }

  const agentTypeByFile = new Map();
  for (const s of subagents) {
    scanTranscript(s.file);
    fileActor.set(s.file, s.agentId);
    agentTypeByFile.set(s.file, s.agentType);
    const t = timing.get(s.file) || {};
    s.firstTs = t.firstTs;
    s.lastTs = t.lastTs;
    s.cwd = t.cwd;
  }

  function actorLabel(file) {
    if (file === mainFile) return { id: MAIN, type: "main", label: "main session (you / user-driven)" };
    const type = agentTypeByFile.get(file) || "(unknown)";
    return { id: fileActor.get(file) || file, type, label: type };
  }

  const nodes = new Map();
  nodes.set(MAIN, { id: MAIN, type: "main", label: "main session (you / user-driven)", children: [], depth: 0, spawn: null, cwd: null });

  const orphans = [];
  for (const s of subagents) {
    const spawn = s.toolUseId ? spawnById.get(s.toolUseId) : null;
    let parentId = MAIN;
    if (spawn) {
      const pa = actorLabel(spawn.hostFile);
      parentId = pa.id;
      if (!nodes.has(parentId)) {
        nodes.set(parentId, { id: parentId, type: pa.type, label: pa.label, children: [], depth: 0, spawn: null, cwd: null });
      }
    } else {
      orphans.push(s.agentId);
    }
    nodes.set(s.agentId, {
      id: s.agentId,
      type: s.agentType,
      label: s.agentType,
      children: [],
      depth: 0,
      cwd: s.cwd,
      spawn: spawn
        ? { description: spawn.description, prompt: spawn.prompt, ts: spawn.ts, parentId }
        : { description: s.description, prompt: "", ts: s.firstTs, parentId: MAIN },
      firstTs: s.firstTs,
      lastTs: s.lastTs,
    });
  }

  for (const node of nodes.values()) {
    if (node.id === MAIN) continue;
    const parent = nodes.get(node.spawn ? node.spawn.parentId : MAIN) || nodes.get(MAIN);
    parent.children.push(node);
  }

  function assignDepth(node, depth) {
    node.depth = depth;
    node.children.sort((a, b) => String(a.spawn?.ts || "").localeCompare(String(b.spawn?.ts || "")));
    for (const ch of node.children) assignDepth(ch, depth + 1);
  }
  assignDepth(nodes.get(MAIN), 0);

  const events = [];
  for (const node of nodes.values()) {
    if (node.id === MAIN || !node.spawn) continue;
    const parent = nodes.get(node.spawn.parentId) || nodes.get(MAIN);
    events.push({
      ts: node.spawn.ts,
      from: parent.label,
      fromId: parent.id,
      to: node.type,
      toId: node.id,
      description: node.spawn.description,
      prompt: node.spawn.prompt,
      depth: node.depth,
      durationMs: durationMs(node.firstTs, node.lastTs),
    });
  }
  events.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));

  const mainTiming = timing.get(mainFile) || {};
  return {
    sessionId,
    mainFile,
    root: nodes.get(MAIN),
    nodes,
    events,
    orphans,
    sessionStart: mainTiming.firstTs,
    sessionEnd: mainTiming.lastTs,
  };
}

function durationMs(a, b) {
  if (!a || !b) return null;
  const d = new Date(b) - new Date(a);
  return Number.isFinite(d) && d >= 0 ? d : null;
}

function fmtDuration(ms) {
  if (ms == null) return "?";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m${r ? `${r}s` : ""}`;
}

function fmtTime(ts) {
  if (!ts) return "??:??:??";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function truncate(s, n) {
  s = (s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/*
 * Attribute the session's delegations to one project. A node "directly belongs"
 * to project P when its cwd is inside P or the project path appears in its spawn
 * prompt/description. The in-scope set keeps each directly-matching node plus its
 * ancestors (to show the chain) and its descendants (sub-work under P).
 */
function computeScope(model, projectDir, base) {
  const pabs = normPath(path.resolve(projectDir));
  const targets = [pabs];
  const rel = normPath(path.relative(base, path.resolve(projectDir)));
  if (rel && !rel.startsWith("..")) targets.push(rel);

  const direct = new Map();
  for (const node of model.nodes.values()) {
    if (node.id === MAIN) {
      direct.set(node.id, false);
      continue;
    }
    const text = normPath([node.spawn && node.spawn.prompt, node.spawn && node.spawn.description, node.cwd].join(" "));
    direct.set(node.id, targets.some((t) => t && text.includes(t)));
  }

  const descMatch = new Map();
  (function postOrder(node) {
    let m = direct.get(node.id) || false;
    for (const c of node.children) if (postOrder(c)) m = true;
    descMatch.set(node.id, m);
    return m;
  })(model.root);

  const inScope = new Set();
  (function preOrder(node, ancMatch) {
    const self = direct.get(node.id) || false;
    if (self || ancMatch || descMatch.get(node.id)) inScope.add(node.id);
    const childAnc = ancMatch || self;
    for (const c of node.children) preOrder(c, childAnc);
  })(model.root, false);

  return inScope;
}

function filterTree(node, inScope) {
  return {
    ...node,
    children: node.children.filter((c) => inScope.has(c.id)).map((c) => filterTree(c, inScope)),
  };
}

function activityRepoLog(flags) {
  return path.join(repoBase(flags), ".claude", "logs", "agent-activity.jsonl");
}

function readMilestoneEvents(activityFile, startTs) {
  const out = [];
  for (const line of readLinesSafe(activityFile)) {
    const o = parseJsonSafe(line);
    if (!o || !o.event) continue;
    if (!String(o.event).startsWith("milestone")) continue;
    if (startTs && o.ts && o.ts < startTs) continue;
    out.push(o);
  }
  return out;
}

function renderTree(node, flags, prefix = "", isLast = true, isRoot = true) {
  const lines = [];
  if (isRoot) {
    lines.push(`▶ ${node.label}`);
  } else {
    const connector = isLast ? "└─ " : "├─ ";
    const time = node.spawn?.ts ? fmtTime(node.spawn.ts).slice(11) : "";
    const dur = fmtDuration(durationMs(node.firstTs, node.lastTs));
    let line = `${prefix}${connector}@${node.type}`;
    const desc = truncate(node.spawn?.description || "", 70);
    if (desc) line += `  — ${desc}`;
    line += `   [${time} · ${dur}]`;
    lines.push(line);
    if (flags["full-prompts"] && node.spawn?.prompt) {
      const promptPrefix = prefix + (isLast ? "   " : "│  ") + "   ";
      for (const pl of node.spawn.prompt.split("\n")) lines.push(`${promptPrefix}${pl}`);
    } else if (node.spawn?.prompt) {
      const promptPrefix = prefix + (isLast ? "   " : "│  ");
      lines.push(`${promptPrefix}  ↪ ${truncate(node.spawn.prompt, PROMPT_PREVIEW)}`);
    }
  }
  const childPrefix = isRoot ? "" : prefix + (isLast ? "   " : "│  ");
  node.children.forEach((ch, i) => {
    lines.push(...renderTree(ch, flags, childPrefix, i === node.children.length - 1, false));
  });
  return lines;
}

/* Build the full textual report (header + tree + timeline + counts) as lines. */
function buildReport(model, root, events, flags, activityFile, scopeLabel) {
  const L = [];
  L.push("=".repeat(110));
  L.push("AGENT DELEGATION TRACE");
  L.push(`Session : ${model.sessionId}`);
  if (scopeLabel) L.push(`Project : ${scopeLabel}`);
  L.push(`Window  : ${fmtTime(model.sessionStart)}  ->  ${fmtTime(model.sessionEnd)}`);
  L.push(`Delegations: ${events.length}` + (model.orphans.length ? `   (orphans: ${model.orphans.length})` : ""));
  L.push("=".repeat(110));

  L.push("");
  L.push("DELEGATION TREE");
  L.push("");
  if (events.length === 0) {
    L.push("  (no delegations" + (scopeLabel ? " attributed to this project" : "") + ")");
  } else {
    for (const l of renderTree(root, flags)) L.push(l);
  }

  L.push("");
  L.push("TIMELINE");
  L.push("");
  const milestoneEvents = readMilestoneEvents(activityFile, model.sessionStart).map((m) => ({
    ts: m.ts,
    kind: "milestone",
    label: `[MILESTONE ${String(m.event).replace("milestone-", "")}] ${m.project || ""} — ${m.title || ""}`.trim(),
  }));
  const delegEvents = events.map((e) => ({
    ts: e.ts,
    kind: "delegation",
    label: `${e.fromId === MAIN ? "main" : "@" + e.from} -> @${e.to}${e.description ? `  (${truncate(e.description, 60)})` : ""}  [${fmtDuration(e.durationMs)}]`,
  }));
  const merged = [...delegEvents, ...milestoneEvents].sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
  if (merged.length === 0) {
    L.push("  (nothing recorded)");
  } else {
    for (const e of merged) L.push(`  ${fmtTime(e.ts).slice(11)} ${e.kind === "milestone" ? "◆" : "|"} ${e.label}`);
  }

  L.push("");
  L.push("DELEGATION COUNTS BY AGENT TYPE");
  L.push("");
  const counts = new Map();
  for (const e of events) counts.set(e.to, (counts.get(e.to) || 0) + 1);
  for (const [type, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) L.push(`  ${String(n).padStart(3)}  @${type}`);
  const maxDepth = Math.max(0, ...events.map((e) => e.depth));
  L.push(`\n  total delegations: ${events.length} · distinct agent types: ${counts.size} · max depth: ${maxDepth}`);
  return L;
}

function eventsJsonl(model, events) {
  return events
    .map((e) =>
      JSON.stringify({
        ts: e.ts,
        session: model.sessionId,
        event: "delegation",
        from: e.fromId === MAIN ? "main" : e.from,
        to: e.to,
        depth: e.depth,
        description: e.description,
        durationMs: e.durationMs,
        prompt: e.prompt,
      })
    )
    .join("\n");
}

/* ---------------------------------------------------------------------------
 * Orchestrator runs (orchestrate.cjs) — a SECOND delegation source.
 *
 * orchestrate.cjs does NOT use Claude Code's Agent tool; it runs its own loop and
 * appends one JSONL event per line to .claude/logs/orchestrate-<run-id>.jsonl:
 *   {ts, runId, event: turn|delegate|result|refused|error|ask_user|ask_user_answer,
 *    from, to, depth, task, agent, question, answer, note}
 * The loop is depth-first and properly bracketed (a `delegate` is followed by that
 * child's whole subtree, then a `result`), so we rebuild the tree with a stack and
 * render it with the same tree/timeline/counts machinery as Claude Code sessions.
 * ------------------------------------------------------------------------- */

function orchLogsDir(flags) {
  return path.join(repoBase(flags), ".claude", "logs");
}

function listOrchRuns(flags) {
  let entries = [];
  try {
    entries = fs.readdirSync(orchLogsDir(flags));
  } catch {
    return [];
  }
  const runs = [];
  for (const f of entries) {
    const m = /^orchestrate-(.+)\.jsonl$/.exec(f);
    if (!m || m[1].startsWith("trace-")) continue; // skip our own emitted traces
    const full = path.join(orchLogsDir(flags), f);
    let mtime = 0;
    try {
      mtime = fs.statSync(full).mtimeMs;
    } catch {
      /* ignore */
    }
    runs.push({ runId: m[1], file: full, mtime });
  }
  runs.sort((a, b) => b.mtime - a.mtime);
  return runs;
}

function resolveOrchLog(flags) {
  if (flags.file && flags.file !== true) return flags.file;
  const runs = listOrchRuns(flags);
  if (runs.length === 0) return null;
  const want = flags["run-id"];
  if (want && want !== true) {
    const hit = runs.find((r) => r.runId === want) || runs.find((r) => r.runId.startsWith(want));
    return hit ? hit.file : null;
  }
  return runs[0].file; // latest
}

function buildOrchModel(file) {
  const lines = readLinesSafe(file);
  if (lines.length === 0) return { error: `Empty or missing orchestrate log: ${file}` };
  let runId = null;
  let counter = 0;
  const nodes = new Map();
  const stack = [];
  let root = null;
  let firstTs = null;
  let lastTs = null;
  const interactions = [];

  const mk = (type, spawn) => {
    const id = `n${counter++}`;
    const node = { id, type, label: type, children: [], depth: 0, spawn, firstTs: spawn ? spawn.ts : null, lastTs: spawn ? spawn.ts : null };
    nodes.set(id, node);
    return node;
  };

  for (const line of lines) {
    const o = parseJsonSafe(line);
    if (!o || !o.event) continue;
    if (o.runId && !runId) runId = o.runId;
    if (o.ts) {
      if (!firstTs) firstTs = o.ts;
      lastTs = o.ts;
    }

    switch (o.event) {
      case "turn": {
        if (!root) {
          root = { id: "__root__", type: o.agent || "(root)", label: o.agent || "(root)", children: [], depth: 0, spawn: null, firstTs: o.ts, lastTs: o.ts };
          nodes.set(root.id, root);
          stack.push(root);
        }
        const cur = stack[stack.length - 1];
        if (cur) {
          if (!cur.firstTs) cur.firstTs = o.ts;
          cur.lastTs = o.ts;
        }
        break;
      }
      case "delegate": {
        const parent = stack[stack.length - 1] || root;
        const child = mk(o.to, { description: o.task ? truncate(o.task, 70) : "", prompt: o.task || "", ts: o.ts, parentId: parent ? parent.id : root && root.id });
        if (parent) parent.children.push(child);
        stack.push(child);
        break;
      }
      case "result": {
        const child = stack.pop();
        if (child) child.lastTs = o.ts;
        break;
      }
      case "refused": {
        const parent = stack[stack.length - 1] || root;
        const child = mk(`${o.to} (refused)`, { description: o.note ? truncate(o.note, 70) : "refused", prompt: o.note || "", ts: o.ts, parentId: parent ? parent.id : root && root.id });
        if (parent) parent.children.push(child);
        interactions.push({ ts: o.ts, kind: "refused", text: `${o.from} ⨯ ${o.to}: ${truncate(o.note || "", 80)}` });
        break;
      }
      case "error": {
        const cur = stack[stack.length - 1];
        if (cur) cur.errorNote = o.note;
        interactions.push({ ts: o.ts, kind: "error", text: `${o.to || ""}: ${truncate(o.note || "", 90)}` });
        break;
      }
      case "ask_user":
        interactions.push({ ts: o.ts, kind: "ask", text: `Q (${o.agent}): ${truncate(o.question || "", 100)}` });
        break;
      case "ask_user_answer":
        interactions.push({ ts: o.ts, kind: "answer", text: `A: ${truncate(o.answer || "", 100)}` });
        break;
      default:
        break;
    }
  }

  if (!root) return { error: `No turns/delegations found in ${file}` };

  for (const n of nodes.values()) {
    if (n.errorNote && n.spawn) n.spawn.description = `${n.spawn.description ? n.spawn.description + " " : ""}⚠ ${truncate(n.errorNote, 50)}`;
  }

  (function assignDepth(node, depth) {
    node.depth = depth;
    node.children.sort((a, b) => String(a.spawn ? a.spawn.ts : "").localeCompare(String(b.spawn ? b.spawn.ts : "")));
    for (const ch of node.children) assignDepth(ch, depth + 1);
  })(root, 0);

  const events = [];
  for (const node of nodes.values()) {
    if (!node.spawn) continue;
    const parent = nodes.get(node.spawn.parentId);
    events.push({
      ts: node.spawn.ts,
      from: parent ? parent.type : "(root)",
      fromId: parent ? parent.id : null,
      to: node.type,
      toId: node.id,
      description: node.spawn.description,
      prompt: node.spawn.prompt,
      depth: node.depth,
      durationMs: durationMs(node.firstTs, node.lastTs),
    });
  }
  events.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));

  return { sessionId: runId || path.basename(file), mainFile: file, root, nodes, events, orphans: [], interactions, sessionStart: firstTs, sessionEnd: lastTs };
}

function cmdOrchRuns(flags) {
  const runs = listOrchRuns(flags);
  if (runs.length === 0) {
    console.log(`No orchestrator runs under ${orchLogsDir(flags)} (orchestrate-*.jsonl).`);
    return;
  }
  console.log(`Orchestrator runs in ${orchLogsDir(flags)}\n`);
  console.log(`${"RUN-ID".padEnd(40)} ${"UPDATED".padEnd(20)} DELEGATIONS`);
  console.log("-".repeat(78));
  for (const r of runs) {
    let delg = 0;
    for (const line of readLinesSafe(r.file)) {
      const o = parseJsonSafe(line);
      if (o && o.event === "delegate") delg += 1;
    }
    console.log(`${r.runId.padEnd(40)} ${fmtTime(new Date(r.mtime).toISOString()).padEnd(20)} ${delg}`);
  }
}

function cmdOrch(flags) {
  const file = resolveOrchLog(flags);
  if (!file) {
    console.log(`No orchestrator run logs found under ${orchLogsDir(flags)} (orchestrate-*.jsonl).`);
    console.log('Run one with: node .claude/scripts/orchestrate.cjs --agent <name> --task "..." --project <dir>');
    return;
  }
  const model = buildOrchModel(file);
  if (model.error) {
    console.log(`Error: ${model.error}`);
    process.exitCode = 1;
    return;
  }

  const projectDir = flags.project && flags.project !== true ? path.resolve(flags.project) : null;
  const activityFile = projectDir ? path.join(projectDir, ".agent-state", "activity.jsonl") : activityRepoLog(flags);

  const report = buildReport(model, model.root, model.events, flags, activityFile, projectDir);
  if (model.interactions && model.interactions.length) {
    report.push("", "USER INTERACTIONS & EXCEPTIONS", "");
    for (const it of model.interactions) {
      const mark = it.kind === "ask" ? "❓" : it.kind === "answer" ? "✅" : it.kind === "refused" ? "⨯" : "⚠";
      report.push(`  ${fmtTime(it.ts).slice(11)} ${mark} ${it.text}`);
    }
  }
  report.push("", `Source: ${file}`);
  console.log(report.join("\n"));

  if (projectDir) {
    try {
      const stateDir = path.join(projectDir, ".agent-state");
      fs.mkdirSync(stateDir, { recursive: true });
      const jsonl = eventsJsonl(model, model.events);
      fs.writeFileSync(path.join(stateDir, "orchestrate-trace.jsonl"), jsonl + (jsonl ? "\n" : ""));
      fs.writeFileSync(path.join(stateDir, "orchestrate-trace.md"), "```\n" + report.join("\n") + "\n```\n");
      console.log(`\nOrchestrator trace written:`);
      console.log(`  ${path.join(stateDir, "orchestrate-trace.jsonl")}  (${model.events.length} events)`);
      console.log(`  ${path.join(stateDir, "orchestrate-trace.md")}`);
    } catch (err) {
      console.log(`\nFailed to write orchestrator trace: ${err.message}`);
    }
  } else if (flags.json) {
    const out = flags.out || path.join(orchLogsDir(flags), `orchestrate-trace-${model.sessionId}.jsonl`);
    try {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const jsonl = eventsJsonl(model, model.events);
      fs.writeFileSync(out, jsonl + (jsonl ? "\n" : ""));
      console.log(`\nStructured event log written: ${out}  (${model.events.length} events)`);
    } catch (err) {
      console.log(`\nFailed to write --json output: ${err.message}`);
    }
  }
}

function cmdSessions(flags) {
  const { dir, sessions } = listSessions(flags);
  if (sessions.length === 0) {
    console.log(`No sessions found under:\n  ${dir}`);
    return;
  }
  const limit = Number(flags.limit) || 20;
  console.log(`Sessions in ${dir}\n`);
  console.log(`${"SESSION".padEnd(38)} ${"UPDATED".padEnd(20)} ${"SUBAGENTS".padEnd(9)} FIRST MESSAGE`);
  console.log("-".repeat(110));
  for (const s of sessions.slice(0, limit)) {
    console.log(`${s.id.padEnd(38)} ${fmtTime(s.mtime.toISOString()).padEnd(20)} ${String(s.subCount).padEnd(9)} ${firstUserText(s.file)}`);
  }
  console.log(`\n(${sessions.length} session(s); showing ${Math.min(limit, sessions.length)}. Use --limit N.)`);
}

function cmdTrace(flags) {
  const sessionId = resolveSessionId(flags);
  if (!sessionId) {
    console.log("No sessions found. Nothing to trace.");
    return;
  }
  const model = buildModel(flags, sessionId);
  if (model.error) {
    console.log(`Error: ${model.error}`);
    process.exitCode = 1;
    return;
  }

  let root = model.root;
  let events = model.events;
  let activityFile = activityRepoLog(flags);
  let scopeLabel = null;
  let projectDir = null;

  if (flags.project && flags.project !== true) {
    projectDir = path.resolve(flags.project);
    scopeLabel = projectDir;
    const inScope = computeScope(model, projectDir, repoBase(flags));
    root = filterTree(model.root, inScope);
    events = model.events.filter((e) => inScope.has(e.toId));
    activityFile = path.join(projectDir, ".agent-state", "activity.jsonl");
  }

  const report = buildReport(model, root, events, flags, activityFile, scopeLabel);
  console.log(report.join("\n"));

  if (projectDir) {
    // write this project's trace INTO the project
    try {
      const stateDir = path.join(projectDir, ".agent-state");
      fs.mkdirSync(stateDir, { recursive: true });
      const jsonl = eventsJsonl(model, events);
      fs.writeFileSync(path.join(stateDir, "delegation-trace.jsonl"), jsonl + (jsonl ? "\n" : ""));
      fs.writeFileSync(path.join(stateDir, "delegation-trace.md"), "```\n" + report.join("\n") + "\n```\n");
      console.log(`\nProject trace written:`);
      console.log(`  ${path.join(stateDir, "delegation-trace.jsonl")}  (${events.length} events)`);
      console.log(`  ${path.join(stateDir, "delegation-trace.md")}`);
    } catch (err) {
      console.log(`\nFailed to write project trace: ${err.message}`);
    }
  } else if (flags.json) {
    const out = flags.out || path.join(repoBase(flags), ".claude", "logs", `trace-${model.sessionId}.jsonl`);
    try {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const jsonl = eventsJsonl(model, events);
      fs.writeFileSync(out, jsonl + (jsonl ? "\n" : ""));
      console.log(`\nStructured event log written: ${out}  (${events.length} events)`);
    } catch (err) {
      console.log(`\nFailed to write --json output: ${err.message}`);
    }
  }
}

function cmdWatch(flags) {
  const interval = (Number(flags.interval) || 5) * 1000;
  let lastSig = "";
  const tick = () => {
    const sessionId = resolveSessionId(flags);
    if (!sessionId) return;
    const dir = sessionDir(flags);
    let sig = sessionId;
    try {
      sig += `:${fs.statSync(path.join(dir, `${sessionId}.jsonl`)).mtimeMs}`;
    } catch {
      /* ignore */
    }
    try {
      for (const f of fs.readdirSync(path.join(dir, sessionId, "subagents"))) sig += `:${f}`;
    } catch {
      /* ignore */
    }
    if (sig !== lastSig) {
      lastSig = sig;
      console.clear();
      console.log(`(watching — refresh every ${interval / 1000}s — Ctrl+C to stop)\n`);
      cmdTrace({ ...flags, session: sessionId });
    }
  };
  tick();
  setInterval(tick, interval);
}

function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  try {
    switch (command) {
      case "sessions":
        cmdSessions(flags);
        break;
      case "trace":
      case undefined:
        cmdTrace(flags);
        break;
      case "watch":
        cmdWatch(flags);
        break;
      case "orch-runs":
        cmdOrchRuns(flags);
        break;
      case "orchestrate":
      case "orch":
        cmdOrch(flags);
        break;
      default:
        console.log(
          [
            "agent-trace.cjs — analyze how agents delegate to other agents",
            "",
            "Claude Code sessions (Agent/Task tool):",
            "  sessions [--limit N]                          list sessions (newest first)",
            "  trace [--session latest|<id>] [--project <dir>]   delegation tree + timeline",
            "        [--json] [--out <file>] [--full-prompts]",
            "  watch [--session latest|<id>] [--project <dir>] [--interval 5]",
            "",
            "Orchestrator runs (orchestrate.cjs logs):",
            "  orch-runs                                     list orchestrator runs (newest first)",
            "  orch [--run-id <id>|--file <path>] [--project <dir>]   orchestrator delegation tree",
            "        [--json] [--out <file>] [--full-prompts]   (default: latest run)",
            "",
            "--project <dir> writes the trace into <dir>/.agent-state/.",
            "Common: --cwd <path> --projects-dir <path>",
          ].join("\n")
        );
    }
  } catch (err) {
    console.error(`agent-trace error: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  }
}

main();
