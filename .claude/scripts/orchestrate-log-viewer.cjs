#!/usr/bin/env node
/**
 * Render an orchestrate.cjs JSONL trace into a readable Markdown report.
 *
 * Usage:
 *   node .claude/scripts/orchestrate-log-viewer.cjs --project sandbox/my-app --run-id my-run
 *   node .claude/scripts/orchestrate-log-viewer.cjs --file sandbox/my-app/.agent-state/orchestrate-my-run.jsonl
 *   node .claude/scripts/orchestrate-log-viewer.cjs --project sandbox/my-app --latest --out report.md
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

function readJsonl(file) {
  const text = fs.readFileSync(file, "utf8");
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      out.push({ event: "parse_error", raw: line.slice(0, 500) });
    }
  }
  return out;
}

function findTraceFile() {
  const direct = arg("--file");
  if (typeof direct === "string") return path.resolve(direct);

  const project = arg("--project", process.cwd());
  const stateDir = path.join(path.resolve(project), ".agent-state");
  const runId = arg("--run-id");
  const entries = fs
    .readdirSync(stateDir)
    .filter((f) => /^orchestrate-.+\.jsonl$/.test(f) && !/\.cache\.jsonl$/.test(f))
    .map((f) => {
      const full = path.join(stateDir, f);
      return { file: full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (typeof runId === "string") {
    const exact = path.join(stateDir, `orchestrate-${runId}.jsonl`);
    if (fs.existsSync(exact)) return exact;
    const hit = entries.find((e) => path.basename(e.file).includes(runId));
    if (hit) return hit.file;
    throw new Error(`no trace file found for run-id ${runId} under ${stateDir}`);
  }

  if (!entries.length) throw new Error(`no orchestrate trace files found under ${stateDir}`);
  return entries[0].file;
}

function short(s, n) {
  const text = String(s == null ? "" : s);
  return text.length <= n ? text : text.slice(0, n) + "...";
}

function fence(text) {
  const body = String(text == null ? "" : text).replace(/```/g, "` ` `");
  return "```text\n" + (body || "(empty)") + "\n```";
}

function eventTime(e) {
  return e.ts ? e.ts.replace("T", " ").replace("Z", "") : "";
}

function renderToolUse(tu) {
  if (!tu || !tu.name) return "- unknown tool";
  if (tu.name === "delegate") return `- delegate -> ${tu.agent}: ${short(tu.task, 180)}`;
  if (tu.name === "ask_user") return `- ask_user: ${short(tu.question, 180)}`;
  if (tu.name === "use_skill") return `- use_skill: ${tu.skill}`;
  if (tu.name === "write_file") return `- write_file: ${tu.path} (${tu.bytes || 0} bytes)`;
  if (tu.name === "read_file") return `- read_file: ${tu.path}`;
  if (tu.name === "list_files") return `- list_files: ${tu.dir || "."}`;
  return `- ${tu.name}`;
}

function render(events, file) {
  const runId = (events.find((e) => e.runId) || {}).runId || path.basename(file);
  const delegates = events.filter((e) => e.event === "delegate");
  const results = events.filter((e) => e.event === "result");
  const waves = events.filter((e) => e.event === "team_wave");
  const turns = events.filter((e) => e.event === "turn");

  const out = [];
  out.push(`# Orchestrator Conversation Log`);
  out.push("");
  out.push(`Source: \`${file}\``);
  out.push(`Run ID: \`${runId}\``);
  out.push("");

  out.push("## Result Data Meaning");
  out.push("");
  out.push(
    "`result` means a delegated child agent finished and returned its final plain-text work product. " +
      "`orchestrate.cjs` then sends that text back to the parent as a Messages API `tool_result.content` payload. " +
      "It is not teammate-to-teammate communication; it is child -> orchestrator -> parent communication.",
  );
  out.push("");

  out.push("## Delegation Edges");
  out.push("");
  if (!delegates.length) out.push("(no delegate events)");
  for (const e of delegates) {
    out.push(`- ${eventTime(e)} depth ${e.depth}: \`${e.from}\` -> \`${e.to}\``);
    if (e.task) out.push(`  Task: ${short(e.task, 220)}`);
  }
  out.push("");

  out.push("## Team Waves");
  out.push("");
  if (!waves.length) out.push("(no parallel teammate waves; run may have been sequential or had one delegate per turn)");
  for (const e of waves) {
    out.push(
      `- ${eventTime(e)} \`${e.agent}\` launched ${e.size} teammate(s), ` +
        `parallel width ${e.parallel}: ${(e.teammates || []).map((t) => `\`${t}\``).join(", ")}`,
    );
  }
  out.push("");

  out.push("## Returned Results");
  out.push("");
  if (!results.length) out.push("(no child result events)");
  for (const e of results) {
    out.push(`### ${e.from} -> ${e.to}`);
    out.push("");
    out.push(`Time: ${eventTime(e)}  `);
    out.push(`Depth: ${e.depth}  `);
    if (e.toolUseId) out.push(`Tool use id: \`${e.toolUseId}\``);
    out.push("");
    out.push(fence(e.content || "(older trace did not record result content)"));
    out.push("");
  }

  out.push("## Chronological Agent Turns");
  out.push("");
  if (!turns.length) out.push("(no turn events)");
  for (const e of turns) {
    out.push(`### ${eventTime(e)} ${e.agent} turn ${e.turn}`);
    out.push("");
    out.push(`Depth: ${e.depth}  `);
    out.push(`Stop: \`${e.stop}\`${e.cached ? "  " + "`cached replay`" : ""}`);
    out.push("");
    if (e.text) {
      out.push("Text:");
      out.push("");
      out.push(fence(e.text));
      out.push("");
    }
    if (Array.isArray(e.toolUses) && e.toolUses.length) {
      out.push("Tool calls:");
      for (const tu of e.toolUses) out.push(renderToolUse(tu));
      out.push("");
    }
  }

  out.push("## Other Events");
  out.push("");
  const others = events.filter(
    (e) =>
      !new Set(["turn", "delegate", "team_wave", "result", "tool_result_batch"]).has(e.event),
  );
  if (!others.length) out.push("(none)");
  for (const e of others) {
    const copy = { ...e };
    delete copy.runId;
    delete copy.ts;
    out.push(`- ${eventTime(e)} \`${e.event}\`: \`${short(JSON.stringify(copy), 300)}\``);
  }

  return out.join("\n");
}

function main() {
  if (arg("--help", false)) {
    console.log(
      [
        "orchestrate-log-viewer.cjs",
        "",
        "Render an orchestrate.cjs JSONL trace into Markdown.",
        "",
        "  --file <path>               exact trace file",
        "  --project <dir>             project directory containing .agent-state",
        "  --run-id <id>               select a run id under --project",
        "  --out <path>                write Markdown to a file instead of stdout",
      ].join("\n"),
    );
    return;
  }
  const file = findTraceFile();
  const md = render(readJsonl(file), file);
  const outFile = arg("--out");
  if (typeof outFile === "string") {
    const target = path.resolve(outFile);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, md + "\n");
    console.log(`wrote ${target}`);
  } else {
    console.log(md);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error("error: " + e.message);
    process.exitCode = 1;
  }
}
