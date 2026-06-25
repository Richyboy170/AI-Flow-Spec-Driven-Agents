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
 *   node .claude/scripts/agent-trace.cjs trace [--session latest|<id>] [--json] [--out <file>] [--full-prompts]
 *   node .claude/scripts/agent-trace.cjs watch  [--session latest|<id>] [--interval 5]
 *
 * Options:
 *   --projects-dir <path>  Override the Claude Code projects directory.
 *   --cwd <path>           Resolve the project slug from this path instead of process.cwd().
 *   --json                 Emit a structured JSONL event log (one line per delegation).
 *   --out <file>           Where to write --json output (default .claude/logs/trace-<session>.jsonl).
 *   --full-prompts         Do not truncate spawn prompts in the rendered tree.
 *
 * Never throws on bad data — best-effort parse, degrade gracefully.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROMPT_PREVIEW = 160;

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

function sessionDir(flags) {
  const cwd = flags.cwd || process.cwd();
  return path.join(projectsDir(flags), projectSlug(cwd));
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
  // allow prefix match
  const exact = sessions.find((s) => s.id === want);
  if (exact) return exact.id;
  const pref = sessions.find((s) => s.id.startsWith(want));
  return pref ? pref.id : want;
}

/*
 * Build the full delegation model for one session:
 *   - index every Agent/Task tool_use block across the main + all subagent transcripts
 *   - map each subagent (via meta.toolUseId) to the spawn block that created it
 *   - resolve each spawn's host transcript to an "actor" name
 *   - assemble parent->child edges + per-agent timing
 */
function buildModel(flags, sessionId) {
  const dir = sessionDir(flags);
  const mainFile = path.join(dir, `${sessionId}.jsonl`);
  const subDir = path.join(dir, sessionId, "subagents");

  if (!fs.existsSync(mainFile)) {
    return { error: `Main transcript not found: ${mainFile}` };
  }

  const MAIN = "__main__";

  // file path -> actor label
  const fileActor = new Map();
  fileActor.set(mainFile, MAIN);

  // toolUseId -> spawn info  (id of the Agent tool_use block)
  const spawnById = new Map();
  // actor file -> {firstTs, lastTs}
  const timing = new Map();

  function scanTranscript(file) {
    const lines = readLinesSafe(file);
    let firstTs = null;
    let lastTs = null;
    for (const line of lines) {
      const o = parseJsonSafe(line);
      if (!o) continue;
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
    timing.set(file, { firstTs, lastTs });
  }

  // 1. scan main transcript
  scanTranscript(mainFile);

  // 2. discover subagents + their meta
  const subagents = []; // {file, agentId, agentType, description, toolUseId, firstTs, lastTs}
  let metaFiles = [];
  try {
    metaFiles = fs.readdirSync(subDir).filter((f) => f.endsWith(".meta.json"));
  } catch {
    /* none */
  }
  for (const mf of metaFiles) {
    const meta = parseJsonSafe(fs.readFileSync(path.join(subDir, mf), "utf8")) || {};
    const agentId = mf.replace(/\.meta\.json$/, "");
    const jsonl = path.join(subDir, `${agentId}.jsonl`);
    subagents.push({
      file: jsonl,
      agentId,
      agentType: meta.agentType || "(unknown)",
      description: meta.description || "",
      toolUseId: meta.toolUseId || null,
    });
  }

  // 3. scan each subagent transcript (collects nested spawns + timing)
  const agentTypeByFile = new Map();
  for (const s of subagents) {
    scanTranscript(s.file);
    fileActor.set(s.file, s.agentId); // actor label for a subagent file = its agentId
    agentTypeByFile.set(s.file, s.agentType);
    const t = timing.get(s.file) || {};
    s.firstTs = t.firstTs;
    s.lastTs = t.lastTs;
  }

  // helper: resolve a host file to a human label
  function actorLabel(file) {
    if (file === mainFile) return { id: MAIN, type: "main", label: "main session (you / user-driven)" };
    const type = agentTypeByFile.get(file) || "(unknown)";
    return { id: fileActor.get(file) || file, type, label: type };
  }

  // 4. build edges: parent (host of the spawn) -> child subagent
  const nodes = new Map(); // id -> node
  nodes.set(MAIN, { id: MAIN, type: "main", label: "main session (you / user-driven)", children: [], depth: 0, spawn: null });

  const orphans = [];
  for (const s of subagents) {
    const spawn = s.toolUseId ? spawnById.get(s.toolUseId) : null;
    let parentId = MAIN;
    if (spawn) {
      const pa = actorLabel(spawn.hostFile);
      parentId = pa.id;
      if (!nodes.has(parentId)) {
        nodes.set(parentId, { id: parentId, type: pa.type, label: pa.label, children: [], depth: 0, spawn: null });
      }
    } else {
      orphans.push(s.agentId);
    }
    const node = {
      id: s.agentId,
      type: s.agentType,
      label: s.agentType,
      children: [],
      depth: 0,
      spawn: spawn
        ? { description: spawn.description, prompt: spawn.prompt, ts: spawn.ts, parentId }
        : { description: s.description, prompt: "", ts: s.firstTs, parentId: MAIN },
      firstTs: s.firstTs,
      lastTs: s.lastTs,
    };
    nodes.set(s.agentId, node);
  }

  // link children
  for (const node of nodes.values()) {
    if (node.id === MAIN) continue;
    const parentId = node.spawn ? node.spawn.parentId : MAIN;
    const parent = nodes.get(parentId) || nodes.get(MAIN);
    parent.children.push(node);
  }

  // compute depth + sort children by spawn time
  function assignDepth(node, depth) {
    node.depth = depth;
    node.children.sort((a, b) => String(a.spawn?.ts || "").localeCompare(String(b.spawn?.ts || "")));
    for (const ch of node.children) assignDepth(ch, depth + 1);
  }
  assignDepth(nodes.get(MAIN), 0);

  // flat chronological list of delegation events
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

// --- milestone events from the shared activity log (so "midway" markers show in the trace) ---
function activityLogPath(flags) {
  const repo = flags.repo || process.cwd();
  return path.join(repo, ".claude", "logs", "agent-activity.jsonl");
}

function readMilestoneEvents(flags, startTs) {
  const file = activityLogPath(flags);
  const out = [];
  for (const line of readLinesSafe(file)) {
    const o = parseJsonSafe(line);
    if (!o || !o.event) continue;
    if (!String(o.event).startsWith("milestone")) continue;
    if (startTs && o.ts && o.ts < startTs) continue;
    out.push(o);
  }
  return out;
}

// ---------------------------------------------------------------------------

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
    const when = fmtTime(s.mtime.toISOString());
    console.log(
      `${s.id.padEnd(38)} ${when.padEnd(20)} ${String(s.subCount).padEnd(9)} ${firstUserText(s.file)}`
    );
  }
  console.log(`\n(${sessions.length} session(s); showing ${Math.min(limit, sessions.length)}. Use --limit N.)`);
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
    const last = i === node.children.length - 1;
    lines.push(...renderTree(ch, flags, childPrefix, last, false));
  });
  return lines;
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

  // header
  console.log("=".repeat(110));
  console.log(`AGENT DELEGATION TRACE`);
  console.log(`Session : ${model.sessionId}`);
  console.log(`Window  : ${fmtTime(model.sessionStart)}  ->  ${fmtTime(model.sessionEnd)}`);
  console.log(`Subagents spawned: ${model.events.length}` + (model.orphans.length ? `   (orphans: ${model.orphans.length})` : ""));
  console.log("=".repeat(110));

  // delegation tree
  console.log("\nDELEGATION TREE\n");
  for (const l of renderTree(model.root, flags)) console.log(l);

  // chronological timeline (delegations + milestone markers)
  console.log("\nTIMELINE\n");
  const milestoneEvents = readMilestoneEvents(flags, model.sessionStart).map((m) => ({
    ts: m.ts,
    kind: "milestone",
    label: `[MILESTONE ${String(m.event).replace("milestone-", "")}] ${m.project || ""} — ${m.title || ""}`.trim(),
  }));
  const delegEvents = model.events.map((e) => ({
    ts: e.ts,
    kind: "delegation",
    label: `${e.fromId === "__main__" ? "main" : "@" + e.from} -> @${e.to}${e.description ? `  (${truncate(e.description, 60)})` : ""}  [${fmtDuration(e.durationMs)}]`,
  }));
  const merged = [...delegEvents, ...milestoneEvents].sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
  if (merged.length === 0) {
    console.log("  (no delegations recorded in this session)");
  } else {
    for (const e of merged) {
      const tag = e.kind === "milestone" ? "◆" : "|";
      console.log(`  ${fmtTime(e.ts).slice(11)} ${tag} ${e.label}`);
    }
  }

  // per-agent summary
  console.log("\nDELEGATION COUNTS BY AGENT TYPE\n");
  const counts = new Map();
  for (const e of model.events) counts.set(e.to, (counts.get(e.to) || 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [type, n] of sorted) console.log(`  ${String(n).padStart(3)}  @${type}`);
  const maxDepth = Math.max(0, ...model.events.map((e) => e.depth));
  console.log(`\n  total delegations: ${model.events.length} · distinct agent types: ${counts.size} · max depth: ${maxDepth}`);

  // structured JSONL output
  if (flags.json) {
    const out = flags.out || path.join(process.cwd(), ".claude", "logs", `trace-${model.sessionId}.jsonl`);
    try {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const lines = model.events.map((e) =>
        JSON.stringify({
          ts: e.ts,
          session: model.sessionId,
          event: "delegation",
          from: e.fromId === "__main__" ? "main" : e.from,
          to: e.to,
          depth: e.depth,
          description: e.description,
          durationMs: e.durationMs,
          prompt: e.prompt,
        })
      );
      fs.writeFileSync(out, lines.join("\n") + (lines.length ? "\n" : ""));
      console.log(`\nStructured event log written: ${out}  (${lines.length} events)`);
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
    const subDir = path.join(dir, sessionId, "subagents");
    let sig = sessionId;
    try {
      const main = fs.statSync(path.join(dir, `${sessionId}.jsonl`));
      sig += `:${main.mtimeMs}`;
    } catch {
      /* ignore */
    }
    try {
      for (const f of fs.readdirSync(subDir)) sig += `:${f}`;
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
      default:
        console.log(
          [
            "agent-trace.cjs — analyze how agents delegate to other agents",
            "",
            "Commands:",
            "  sessions [--limit N]                     list sessions (newest first)",
            "  trace [--session latest|<id>] [--json]   render delegation tree + timeline",
            "        [--out <file>] [--full-prompts]",
            "  watch [--session latest|<id>] [--interval 5]   live re-render on change",
            "",
            "Common: --cwd <path> --projects-dir <path>",
          ].join("\n")
        );
    }
  } catch (err) {
    // never hard-crash; this may run from a hook / watch loop
    console.error(`agent-trace error: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
  }
}

main();
