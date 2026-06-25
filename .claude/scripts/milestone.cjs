#!/usr/bin/env node
"use strict";

/*
 * milestone.cjs — durable "where to continue" milestones for a project.
 *
 * When you pause a session midway, the LLM saves a milestone INSIDE the project
 * (a human-readable MILESTONE.md + a machine-readable .agent-state/milestone.json).
 * Next time a session starts, the SessionStart hook surfaces it so agents pick up
 * exactly where work stopped. Every save/resume is recorded in the project's own
 * activity log (<project>/.agent-state/activity.jsonl) AND a repo-level roll-up
 * (.claude/logs/agent-activity.jsonl), so it shows up in `agent-trace` — scoped to
 * the project with `agent-trace trace --project <dir>`, or repo-wide without it.
 *
 * Commands:
 *   save    --project <path> [--stdin | --file <json>] [--title ..] [--goal ..]
 *           [--status in-progress|paused|blocked|done] [--branch ..]
 *           [--next "a||b"] [--completed "a||b"] [--blockers "a||b"]
 *           [--files "a||b"] [--context "a||b"] [--delegation ".."] [--notes ".."]
 *   show    --project <path>             print the saved milestone (read-only)
 *   resume  [--project <path>] [--hook] [--quiet]  print latest open milestone (SessionStart hook)
 *   list                                 list all registered milestones
 *
 * Array flags accept "||"-separated values. --stdin/--file expect a JSON object
 * using the milestone field names below; flags override JSON fields.
 *
 * Designed to never throw from `resume` (it runs as a hook) — always exits 0.
 */

const fs = require("node:fs");
const path = require("node:path");

const SCHEMA = "agent-milestone/v1";
const STATE_DIRNAME = ".agent-state";
const DOC_NAME = "MILESTONE.md";

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

function nowIso() {
  return new Date().toISOString();
}

function splitList(v) {
  if (v == null || v === true) return undefined;
  return String(v)
    .split("||")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function repoRoot(flags) {
  return flags.repo || process.cwd();
}

function repoActivityLog(flags) {
  return path.join(repoRoot(flags), ".claude", "logs", "agent-activity.jsonl");
}

function registryPath(flags) {
  return path.join(repoRoot(flags), ".claude", "state", "milestone-registry.json");
}

function appendLine(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(obj) + "\n");
  } catch {
    /* logging must never break the command */
  }
}

/*
 * Dual-write the activity event: into the project's own .agent-state/activity.jsonl
 * (so `agent-trace --project` sees it) and into the repo-level roll-up.
 */
function appendActivity(flags, record, projectDir) {
  const event = { ts: nowIso(), ...record };
  appendLine(repoActivityLog(flags), event);
  if (projectDir) appendLine(path.join(projectDir, STATE_DIRNAME, "activity.jsonl"), event);
}

function resolveProject(flags) {
  return path.resolve(flags.project || process.cwd());
}

function statePaths(projectDir) {
  const stateDir = path.join(projectDir, STATE_DIRNAME);
  return {
    stateDir,
    jsonFile: path.join(stateDir, "milestone.json"),
    historyFile: path.join(stateDir, "milestone-history.jsonl"),
    docFile: path.join(projectDir, DOC_NAME),
  };
}

function updateRegistry(flags, milestone, jsonFile) {
  try {
    const file = registryPath(flags);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const reg = readJsonSafe(file, { projects: {} });
    if (!reg.projects) reg.projects = {};
    reg.projects[milestone.project] = {
      title: milestone.title,
      status: milestone.status,
      updatedAt: milestone.updatedAt,
      milestonePath: jsonFile,
    };
    fs.writeFileSync(file, JSON.stringify(reg, null, 2) + "\n");
  } catch {
    /* registry is a convenience; don't fail the save over it */
  }
}

function renderDoc(m) {
  const lines = [];
  const bullets = (arr) => (arr && arr.length ? arr.map((x) => `- ${x}`).join("\n") : "_(none)_");
  lines.push(`# Milestone — ${m.title || m.projectName || "project"}`);
  lines.push("");
  lines.push("> Resume point written by an agent session. Read this first, then continue.");
  lines.push("");
  lines.push(`- **Project:** \`${m.project}\``);
  lines.push(`- **Status:** ${m.status}`);
  if (m.branch) lines.push(`- **Branch:** ${m.branch}`);
  lines.push(`- **Updated:** ${m.updatedAt}`);
  lines.push(`- **Created:** ${m.createdAt}`);
  lines.push("");
  if (m.goal) {
    lines.push("## Goal", "", m.goal, "");
  }
  lines.push("## Next steps (continue here)", "", bullets(m.next), "");
  lines.push("## Done so far", "", bullets(m.completed), "");
  if (m.blockers && m.blockers.length) lines.push("## Blockers", "", bullets(m.blockers), "");
  if (m.filesInFlight && m.filesInFlight.length) lines.push("## Files in flight", "", bullets(m.filesInFlight), "");
  if (m.contextToLoad && m.contextToLoad.length) lines.push("## Context to load first", "", bullets(m.contextToLoad), "");
  if (m.delegation) lines.push("## How to resume / delegation", "", m.delegation, "");
  if (m.notes) lines.push("## Notes", "", m.notes, "");
  lines.push("---");
  lines.push("<!-- machine-readable; do not hand-edit — use `milestone.cjs save` -->");
  lines.push("```json agent-milestone");
  lines.push(JSON.stringify(m, null, 2));
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function buildMilestone(flags) {
  let base = {};
  if (flags.stdin) {
    try {
      base = JSON.parse(fs.readFileSync(0, "utf8")) || {};
    } catch (e) {
      throw new Error(`--stdin: could not parse JSON (${e.message})`);
    }
  } else if (flags.file) {
    base = readJsonSafe(flags.file, null);
    if (!base) throw new Error(`--file: could not read/parse ${flags.file}`);
  }

  const projectDir = resolveProject(flags);
  const { jsonFile } = statePaths(projectDir);
  const existing = readJsonSafe(jsonFile, null);

  const m = {
    schema: SCHEMA,
    project: projectDir,
    projectName: path.basename(projectDir),
    title: flags.title || base.title || (existing && existing.title) || "Untitled milestone",
    status: flags.status || base.status || "in-progress",
    goal: flags.goal || base.goal || "",
    branch: flags.branch || base.branch || "",
    createdAt: (existing && existing.createdAt) || base.createdAt || nowIso(),
    updatedAt: nowIso(),
    next: splitList(flags.next) || base.next || [],
    completed: splitList(flags.completed) || base.completed || [],
    blockers: splitList(flags.blockers) || base.blockers || [],
    filesInFlight: splitList(flags.files) || base.filesInFlight || [],
    contextToLoad: splitList(flags.context) || base.contextToLoad || [],
    delegation: flags.delegation || base.delegation || "",
    notes: flags.notes || base.notes || "",
  };
  return { m, projectDir, jsonFile, existing };
}

function cmdSave(flags) {
  const { m, projectDir, jsonFile, existing } = buildMilestone(flags);
  const { stateDir, historyFile, docFile } = statePaths(projectDir);

  if (!fs.existsSync(projectDir)) {
    console.error(`Project directory does not exist: ${projectDir}`);
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(stateDir, { recursive: true });
  if (existing) {
    try {
      fs.appendFileSync(historyFile, JSON.stringify({ archivedAt: nowIso(), milestone: existing }) + "\n");
    } catch {
      /* non-fatal */
    }
  }
  fs.writeFileSync(jsonFile, JSON.stringify(m, null, 2) + "\n");
  fs.writeFileSync(docFile, renderDoc(m));

  updateRegistry(flags, m, jsonFile);
  appendActivity(
    flags,
    {
      event: "milestone-saved",
      project: m.projectName,
      projectPath: m.project,
      title: m.title,
      status: m.status,
      nextCount: (m.next || []).length,
    },
    m.project
  );

  console.log(`Milestone saved for "${m.projectName}" [${m.status}]`);
  console.log(`  doc : ${docFile}`);
  console.log(`  json: ${jsonFile}`);
  console.log(`  log : ${path.join(stateDir, "activity.jsonl")}  (+ repo roll-up)`);
  console.log(`  next: ${(m.next || []).length} step(s)`);
}

function loadMilestone(projectDir) {
  return readJsonSafe(statePaths(projectDir).jsonFile, null);
}

function cmdShow(flags) {
  const projectDir = resolveProject(flags);
  const m = loadMilestone(projectDir);
  if (!m) {
    console.log(`No milestone found for ${projectDir}`);
    console.log(`(expected ${path.join(projectDir, STATE_DIRNAME, "milestone.json")})`);
    return;
  }
  console.log(renderDoc(m));
}

function compactResume(m) {
  const lines = [];
  lines.push(`=== RESUME MILESTONE: ${m.projectName} [${m.status}] ===`);
  lines.push(`Project: ${m.project}`);
  if (m.branch) lines.push(`Branch: ${m.branch}`);
  lines.push(`Updated: ${m.updatedAt}`);
  if (m.goal) lines.push(`Goal: ${m.goal}`);
  if (m.next && m.next.length) {
    lines.push(`Next steps:`);
    for (const s of m.next) lines.push(`  - ${s}`);
  }
  if (m.blockers && m.blockers.length) {
    lines.push(`Blockers:`);
    for (const s of m.blockers) lines.push(`  - ${s}`);
  }
  if (m.contextToLoad && m.contextToLoad.length) lines.push(`Read first: ${m.contextToLoad.join(", ")}`);
  if (m.delegation) lines.push(`Resume via: ${m.delegation}`);
  lines.push(`Full detail: ${path.join(m.project, DOC_NAME)}`);
  lines.push(`=== END RESUME MILESTONE ===`);
  return lines.join("\n");
}

function cmdResume(flags) {
  // Bulletproof: runs from a SessionStart hook. Never throw, always exit 0.
  try {
    const candidates = [];
    if (flags.project) {
      const m = loadMilestone(resolveProject(flags));
      if (m) candidates.push(m);
    } else {
      const reg = readJsonSafe(registryPath(flags), { projects: {} });
      for (const e of Object.values(reg.projects || {})) {
        const m = e.milestonePath ? readJsonSafe(e.milestonePath, null) : null;
        if (m) candidates.push(m);
      }
      const cwdMs = loadMilestone(process.cwd());
      if (cwdMs && !candidates.some((c) => c.project === cwdMs.project)) candidates.push(cwdMs);
    }

    const open = candidates
      .filter((m) => m && m.status !== "done")
      .filter((m) => {
        try {
          return fs.existsSync(m.project);
        } catch {
          return true;
        }
      })
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    if (open.length === 0) {
      if (!flags.hook && !flags.quiet) console.log("(no open milestone to resume)");
      return;
    }
    const m = open[0];
    let text = compactResume(m);
    if (open.length > 1) {
      text += `\n\n(${open.length - 1} other open milestone(s): ${open.slice(1).map((x) => x.projectName).join(", ")})`;
    }

    if (flags.hook) {
      // SessionStart hook contract for Claude Code: stdout must be this JSON
      // envelope for the text to reach the model's context (plain stdout is not
      // reliably injected). Matches the superpowers / ecc session-start hooks.
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text },
          additionalContext: text,
        }) + "\n"
      );
    } else {
      console.log(text);
    }

    appendActivity(
      flags,
      { event: "milestone-resumed", project: m.projectName, projectPath: m.project, title: m.title, status: m.status },
      m.project
    );
  } catch (err) {
    if (!flags.hook && !flags.quiet) console.error(`milestone resume: ${err.message}`);
  }
}

function cmdList(flags) {
  const reg = readJsonSafe(registryPath(flags), { projects: {} });
  const entries = Object.entries(reg.projects || {});
  if (entries.length === 0) {
    console.log("No milestones registered yet.");
    return;
  }
  entries.sort((a, b) => String(b[1].updatedAt || "").localeCompare(String(a[1].updatedAt || "")));
  console.log(`${"STATUS".padEnd(12)} ${"UPDATED".padEnd(22)} TITLE  —  PROJECT`);
  console.log("-".repeat(100));
  for (const [proj, e] of entries) {
    console.log(`${String(e.status || "?").padEnd(12)} ${String(e.updatedAt || "?").padEnd(22)} ${e.title || "(untitled)"}  —  ${proj}`);
  }
}

function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  switch (command) {
    case "save":
      cmdSave(flags);
      break;
    case "show":
      cmdShow(flags);
      break;
    case "resume":
      cmdResume(flags);
      break;
    case "list":
      cmdList(flags);
      break;
    default:
      console.log(
        [
          "milestone.cjs — durable resume points for a project",
          "",
          "Commands:",
          "  save   --project <path> [--stdin|--file f.json] [--title ..] [--goal ..]",
          '         [--status paused] [--next "a||b"] [--completed ..] [--blockers ..]',
          "         [--files ..] [--context ..] [--delegation ..] [--notes ..]",
          "  show   --project <path>                 print saved milestone",
          "  resume [--project <path>] [--hook] [--quiet]   print latest open milestone",
          "  list                                    list all registered milestones",
        ].join("\n")
      );
  }
}

main();
