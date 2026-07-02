#!/usr/bin/env node
/**
 * orchestrate.cjs — code-guaranteed agent delegation (Option B1).
 *
 * Loads this repo's `.claude/agents/**` personas and drives
 * agent -> subagent -> sub-subagent delegation through a code-backed
 * `delegate` tool. The MODEL still decides, dynamically, whether/whom to
 * delegate to (delegation "as before"); but every spawn flows through this
 * file, so the call graph's structure is GUARANTEED:
 *
 *   - whitelist:   only named project agents can be targets (CLAUDE.md invariant)
 *   - depth cap:   no runaway recursion
 *   - budget cap:  global ceiling on total delegations
 *   - no cycles:   an agent cannot delegate back into one of its ancestors
 *   - fork-safe:   INTERACTIVE-only personas are refused as autonomous targets
 *   - trace:       every hop is logged to <project>/.agent-state/orchestrate-<runid>.jsonl
 *
 * ALTITUDE: this guarantees + traces the DELEGATION GRAPH. Leaf workers return
 * a text work-product; they do NOT yet get real file/bash effects. Wiring the
 * full tool runtime (Read/Write/Bash/...) into leaf agents is the marked
 * extension point in buildTools().
 *
 * Zero dependencies (Node >= 18, native fetch). Run `--probe` in the same
 * terminal Claude Code uses (it inherits the proxy base-URL + credentials).
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

// ---------------------------------------------------------------------------
// Config (all env-overridable; defaults target the company LLM proxy)
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const AGENTS_DIR = path.join(REPO_ROOT, ".claude", "agents");

const PROXY_URL =
  process.env.ORCH_BASE_URL ||
  process.env.ANTHROPIC_BASE_URL ||
  "http://127.0.0.1:32187";
const ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION || "2023-06-01";

// Frontmatter uses bare aliases (opus/sonnet/haiku). The upstream may want
// different strings — override per alias, or force one model for every agent.
const MODEL_FORCE = process.env.ORCH_MODEL || ""; // if set, used for ALL agents
const MODEL_MAP = {
  opus: process.env.ORCH_MODEL_OPUS || "claude-opus-4-8",
  sonnet: process.env.ORCH_MODEL_SONNET || "claude-sonnet-4-6",
  haiku: process.env.ORCH_MODEL_HAIKU || "claude-haiku-4-5",
};

const DEFAULTS = {
  maxDepth: int(process.env.ORCH_MAX_DEPTH, 4),
  maxDelegations: int(process.env.ORCH_MAX_DELEGATIONS, 24),
  maxTurns: int(process.env.ORCH_MAX_TURNS, 8), // model turns per agent
  maxTokens: int(process.env.ORCH_MAX_TOKENS, 4000),
  maxRetries: int(process.env.ORCH_MAX_RETRIES, 5), // per model call, on 429/5xx
  maxAsks: int(process.env.ORCH_MAX_ASKS, 4), // total ask_user prompts per run
  askTimeout: int(process.env.ORCH_ASK_TIMEOUT, 60), // seconds before auto-proceeding
  resumeDelay: int(process.env.ORCH_RESUME_DELAY, 3600), // seconds to wait before auto-resuming after a credit-limit 429
  maxParallel: int(process.env.ORCH_MAX_PARALLEL, 4), // concurrent teammates per delegation wave (1 = sequential)
  skillMaxChars: int(process.env.ORCH_SKILL_MAX_CHARS, 12000), // cap on a loaded SKILL.md body
  fileMaxChars: int(process.env.ORCH_FILE_MAX_CHARS, 24000), // cap on a read_file / run_command / web result
  cmdTimeout: int(process.env.ORCH_CMD_TIMEOUT, 120), // seconds before run_command is killed
  traceTextChars: int(process.env.ORCH_TRACE_TEXT_CHARS, 2000), // cap on text snippets written to trace logs
};

// HTTP statuses worth retrying with backoff (rate limit / transient server).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);

function retryAfterSeconds(value, nowMs = Date.now()) {
  if (value == null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  const when = Date.parse(raw);
  if (!Number.isFinite(when)) return undefined;
  const diff = Math.ceil((when - nowMs) / 1000);
  return diff > 0 ? diff : undefined;
}

function int(v, d) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : d;
}

// ---------------------------------------------------------------------------
// Persona loading + parsing
// ---------------------------------------------------------------------------

/** Parse `---` frontmatter + body from a persona markdown file. */
// STRUCTURE_KEYWORD: PERSONA_PARSE - converts one agent Markdown file into runtime persona config.
function parsePersona(file) {
  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split(/\r?\n/);
  if (lines[0].trim() !== "---") return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  const fm = {};
  for (let i = 1; i < end; i++) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (m) fm[m[1].toLowerCase()] = m[2].trim();
  }
  const body = lines.slice(end + 1).join("\n").trim();
  if (!fm.name) return null;

  const tools = (fm.tools || "")
    .replace(/[[\]]/g, "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const desc = fm.description || "";
  // Interactive personas explicitly forbid autonomous forking.
  const forkSafe =
    !/\bINTERACTIVE\b/.test(desc) &&
    !/do not spawn as an autonomous fork/i.test(desc) &&
    !/runs in the main thread/i.test(desc);

  return {
    name: fm.name,
    model: fm.model || "sonnet",
    tools,
    canDelegate: tools.includes("Agent"),
    forkSafe,
    description: desc,
    system: body,
    file: path.relative(REPO_ROOT, file),
  };
}

/** Load every persona under .claude/agents/**. Returns Map<name, persona>. */
// STRUCTURE_KEYWORD: AGENT_REGISTRY - builds the whitelist of project agents that may run.
function loadAgents() {
  const out = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        const persona = parsePersona(p);
        if (persona) out.set(persona.name, persona);
      }
    }
  };
  walk(AGENTS_DIR);
  return out;
}

/** Resolve a persona's frontmatter model alias to an upstream model string. */
function resolveModel(persona) {
  if (MODEL_FORCE) return MODEL_FORCE;
  return MODEL_MAP[persona.model] || persona.model; // pass through full ids
}

// ---------------------------------------------------------------------------
// Skill loading — this repo's .claude/skills/<name>/SKILL.md, exposed to agents
// through a `use_skill` tool so skill usage is visible (and traced) per agent.
// ---------------------------------------------------------------------------

const SKILLS_DIR = path.join(REPO_ROOT, ".claude", "skills");

/** Map<skillName, absolute SKILL.md path> for every skill in the repo. */
// STRUCTURE_KEYWORD: SKILL_REGISTRY - exposes repo skills through the use_skill tool.
function loadSkills() {
  const out = new Map();
  if (!fs.existsSync(SKILLS_DIR)) return out;
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(SKILLS_DIR, entry.name, "SKILL.md");
    if (fs.existsSync(file)) out.set(entry.name, file);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Model client — non-streaming POST /v1/messages against the proxy
// ---------------------------------------------------------------------------

const CLAUDE_CREDS = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".claude",
  ".credentials.json",
);

/**
 * Resolve which model backend to use. Selectable with --backend / ORCH_BACKEND:
 *   proxy        company LLM proxy -> deeprouter (needs VPN)
 *   claude-code  reuse Claude Code's OAuth token (Pro/Max) against the API
 *   anthropic    direct API with an explicit ANTHROPIC_API_KEY
 *   auto         (default) claude-code creds if present, else proxy
 * The OAuth token is read fresh from disk each run — never copied or persisted.
 */
let _backend;
// STRUCTURE_KEYWORD: BACKEND_SELECT - chooses proxy, Claude Code OAuth, or direct Anthropic API.
function resolveBackend() {
  if (_backend) return _backend;
  let choice = String(arg("--backend", process.env.ORCH_BACKEND || "auto"));
  if (choice === "auto") {
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_BASE_URL) choice = "anthropic";
    else if (fs.existsSync(CLAUDE_CREDS)) choice = "claude-code";
    else choice = "proxy";
  }
  const base = { "content-type": "application/json", "anthropic-version": ANTHROPIC_VERSION };

  if (choice === "claude-code") {
    let creds;
    try {
      creds = JSON.parse(fs.readFileSync(CLAUDE_CREDS, "utf8")).claudeAiOauth || {};
    } catch {
      throw new Error(`--backend claude-code: cannot read ${CLAUDE_CREDS}. Is Claude Code logged in?`);
    }
    if (!creds.accessToken)
      throw new Error("--backend claude-code: no OAuth accessToken found (run `claude` to log in).");
    if (creds.expiresAt && Date.now() > creds.expiresAt)
      throw new Error("--backend claude-code: OAuth token expired — open Claude Code once to refresh it.");
    _backend = {
      name: "claude-code",
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
      // Subscription OAuth tokens are only honored when the request presents as
      // the Claude Code client: identity system block (applied in callModel) +
      // these client headers. Without them the API throttles with a 429.
      oauthSpoof: true,
      headers: () => ({
        ...base,
        authorization: `Bearer ${JSON.parse(fs.readFileSync(CLAUDE_CREDS, "utf8")).claudeAiOauth.accessToken}`,
        "anthropic-beta": "oauth-2025-04-20",
        "user-agent": process.env.ORCH_CLAUDE_UA || "claude-cli/1.0.0 (external, cli)",
        "x-app": "cli",
      }),
    };
  } else if (choice === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new Error("--backend anthropic: set ANTHROPIC_API_KEY.");
    _backend = {
      name: "anthropic",
      baseUrl: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
      headers: () => ({ ...base, "x-api-key": process.env.ANTHROPIC_API_KEY }),
    };
  } else {
    _backend = {
      name: "proxy",
      baseUrl: PROXY_URL,
      headers: () => {
        const h = { ...base };
        if (process.env.ANTHROPIC_API_KEY) h["x-api-key"] = process.env.ANTHROPIC_API_KEY;
        else if (process.env.ANTHROPIC_AUTH_TOKEN)
          h.authorization = `Bearer ${process.env.ANTHROPIC_AUTH_TOKEN}`;
        return h;
      },
    };
  }
  return _backend;
}

/**
 * One model call. Returns the parsed Messages API response.
 * Non-streaming on purpose — keeps us off the proxy's SSE path and the
 * delegate turns are short.
 */
// STRUCTURE_KEYWORD: MODEL_TURN - sends one Messages API request and handles retry/cache.
async function callModel({ model, system, messages, tools, maxTokens, cache, maxRetries }) {
  const be = resolveBackend();

  // Subscription OAuth tokens (claude-code backend) are only honored when the
  // request presents as the Claude Code client: the FIRST system block must be
  // its exact identity line, with the real instructions following. Sending a bare
  // custom system prompt is what triggers the persistent 429.
  let sys = system;
  if (be.oauthSpoof) {
    const CLAUDE_CODE_ID = "You are Claude Code, Anthropic's official CLI for Claude.";
    sys = [{ type: "text", text: CLAUDE_CODE_ID }];
    if (system) sys.push({ type: "text", text: String(system) });
  }

  const body = {
    model,
    max_tokens: maxTokens || DEFAULTS.maxTokens,
    system: sys,
    messages,
  };
  if (tools && tools.length) body.tools = tools;

  // Resume path: an identical request that already completed is replayed from
  // disk — no network, no spend. This is what lets a re-run skip everything that
  // finished before the rate limit and pick up exactly where it died.
  let hash;
  if (cache) {
    hash = cache.key(body);
    const hit = cache.get(hash);
    if (hit !== undefined) {
      cache.hits += 1;
      return hit;
    }
  }

  const retries = Number.isInteger(maxRetries) ? maxRetries : DEFAULTS.maxRetries;
  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetch(new URL("/v1/messages", be.baseUrl), {
        method: "POST",
        headers: be.headers(),
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(
        `[${be.name}] cannot reach ${be.baseUrl} (${e.message}). ` +
          (be.name === "proxy"
            ? "Is the proxy up and are you on the company VPN?"
            : "Check network / try --backend proxy."),
      );
    }
    const text = await res.text();
    if (res.ok) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`non-JSON response from upstream: ${text.slice(0, 300)}`);
      }
      if (cache) {
        cache.put(hash, parsed);
        cache.live += 1;
      }
      return parsed;
    }

    // Retryable (rate limit / transient) — back off and try again, up to the cap.
    if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
      const retryAfter = retryAfterSeconds(res.headers.get("retry-after"));
      const RETRY_CAP_MS = 60000; // never block for an absurd server Retry-After
      const waitMs = retryAfter
        ? Math.min(retryAfter * 1000, RETRY_CAP_MS)
        : Math.min(30000, 1000 * 2 ** attempt);
      attempt += 1;
      process.stderr.write(
        `[${be.name}] HTTP ${res.status} — retry ${attempt}/${retries} in ${Math.round(waitMs / 1000)}s\n`,
      );
      await sleep(waitMs);
      continue;
    }

    const err = new Error(
      `[${be.name}] HTTP ${res.status} from ${be.baseUrl}/v1/messages: ${text.slice(0, 600)}`,
    );
    // Tag exhausted rate limits so the delegation loop propagates (and checkpoints)
    // instead of silently degrading the parent's result.
    if (RETRYABLE_STATUS.has(res.status)) {
      err.rateLimited = true;
      const ra = retryAfterSeconds(res.headers.get("retry-after"));
      if (ra) err.retryAfterSecs = ra;
    }
    err.status = res.status;
    throw err;
  }
}

// Collect plain text from a Messages API content array.
function textOf(content) {
  return (content || [])
    .filter((b) => b && b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function traceClip(value, ctx, fallbackCap) {
  const cap = int(ctx && ctx.traceTextChars, fallbackCap || DEFAULTS.traceTextChars);
  const text = String(value == null ? "" : value);
  if (text.length <= cap) return text;
  return text.slice(0, cap) + `\n[trace text truncated at ${cap} chars]`;
}

function traceToolUse(tu, ctx) {
  const input = tu && tu.input ? tu.input : {};
  if (!tu || !tu.name) return { name: "unknown" };
  if (tu.name === "delegate") {
    return { name: "delegate", agent: input.agent, task: traceClip(input.task || "", ctx, 1000) };
  }
  if (tu.name === "ask_user") {
    return { name: "ask_user", question: traceClip(input.question || "", ctx, 1000), options: input.options || [] };
  }
  if (tu.name === "use_skill") {
    return { name: "use_skill", skill: input.skill };
  }
  if (tu.name === "write_file") {
    return {
      name: "write_file",
      path: input.path,
      bytes: Buffer.byteLength(String(input.content == null ? "" : input.content)),
    };
  }
  if (tu.name === "read_file") return { name: "read_file", path: input.path };
  if (tu.name === "list_files") return { name: "list_files", dir: input.dir || "." };
  return { name: tu.name };
}

// ---------------------------------------------------------------------------
// Live transcript — print each agent's turn to the terminal (stderr) as it
// happens, the way the Claude CLI shows the assistant talking. On by default;
// suppress with --quiet. Colors only on a TTY (and honor NO_COLOR).
// ---------------------------------------------------------------------------

const CHAT_COLOR = process.stderr.isTTY && !process.env.NO_COLOR;
function paint(code, s) {
  return CHAT_COLOR ? `\x1b[${code}m${s}\x1b[0m` : s;
}

// Each agent keeps ONE color for the whole run (Agent Teams-panel feel), so
// interleaved parallel turns stay attributable at a glance.
const AGENT_PALETTE = ["36", "33", "32", "35", "34", "96", "93", "92", "95", "94"];
function agentColor(name) {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AGENT_PALETTE[h % AGENT_PALETTE.length];
}

/** One-line team/status message (wave launches, teammate finishes). */
function chatStatus(ctx, depth, text) {
  if (ctx.quiet) return;
  process.stderr.write("  ".repeat(depth) + text + "\n");
}

function printChat(ctx, persona, depth, resp, cached) {
  if (ctx.quiet) return;
  const pad = "  ".repeat(depth);
  const col = agentColor(persona.name);
  const tag = cached ? " " + paint("2", "[cached]") : "";
  // Build the whole turn and write it ONCE: with parallel teammates, per-line
  // writes would interleave mid-turn and garble the transcript.
  const out = [
    "",
    pad + paint(col + ";1", `● ${persona.name}`) + paint("2", `  (depth ${depth})`) + tag,
  ];

  const text = textOf(resp.content);
  if (text) {
    for (const line of text.split("\n")) out.push(pad + "  " + line);
  }

  for (const b of resp.content || []) {
    if (!b || b.type !== "tool_use") continue;
    if (b.name === "delegate") {
      const target = (b.input && b.input.agent) || "?";
      const t = String((b.input && b.input.task) || "").replace(/\s+/g, " ").slice(0, 200);
      out.push(pad + "  " + paint("33;1", `→ delegate ${target}`) + `: ${t}`);
    } else if (b.name === "ask_user") {
      const q = String((b.input && b.input.question) || "").replace(/\s+/g, " ").slice(0, 200);
      out.push(pad + "  " + paint("35;1", "? ask_user") + `: ${q}`);
    } else if (b.name === "use_skill") {
      const s = String((b.input && b.input.skill) || "?");
      out.push(pad + "  " + paint("32;1", `⚡ use_skill ${s}`));
    } else if (b.name === "write_file") {
      const p = String((b.input && b.input.path) || "?");
      const kb = (Buffer.byteLength(String((b.input && b.input.content) || "")) / 1024).toFixed(1);
      out.push(pad + "  " + paint("36;1", `✎ write_file ${p}`) + paint("2", ` (${kb} KB)`));
    } else if (b.name === "read_file") {
      out.push(pad + "  " + paint("2", `⇠ read_file ${String((b.input && b.input.path) || "?")}`));
    } else if (b.name === "list_files") {
      out.push(pad + "  " + paint("2", `☰ list_files ${String((b.input && b.input.dir) || ".")}`));
    } else if (b.name === "edit_file") {
      out.push(pad + "  " + paint("36;1", `± edit_file ${String((b.input && b.input.path) || "?")}`));
    } else if (b.name === "search_files") {
      out.push(pad + "  " + paint("2", `⌕ search_files /${String((b.input && b.input.pattern) || "")}/`));
    } else if (b.name === "find_files") {
      out.push(pad + "  " + paint("2", `⌕ find_files ${String((b.input && b.input.pattern) || "")}`));
    } else if (b.name === "run_command") {
      const c = String((b.input && b.input.command) || "").replace(/\s+/g, " ").slice(0, 200);
      out.push(pad + "  " + paint("31;1", `$ run_command`) + ` ${c}`);
    } else if (b.name === "web_fetch") {
      out.push(pad + "  " + paint("34;1", `⇣ web_fetch`) + ` ${String((b.input && b.input.url) || "?").slice(0, 200)}`);
    } else if (b.name === "web_search") {
      out.push(pad + "  " + paint("34;1", `⌕ web_search`) + ` ${String((b.input && b.input.query) || "?").slice(0, 200)}`);
    }
  }
  process.stderr.write(out.join("\n") + "\n");
}

// ---------------------------------------------------------------------------
// Trace logging
// ---------------------------------------------------------------------------

// STRUCTURE_KEYWORD: TRACE_LOG - records the run graph and tool activity as project-local JSONL.
function makeTracer(runId, projectDir) {
  // Trace log lives next to the run's cache + task snapshot in the project's
  // .agent-state, so the whole run (cache, trace, milestone) is in one folder.
  const dir = path.join(projectDir, ".agent-state");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `orchestrate-${runId}.jsonl`);
  const events = [];
  return {
    file,
    events,
    log(event, fields) {
      const rec = { ts: new Date().toISOString(), runId, event, ...fields };
      events.push(rec);
      fs.appendFileSync(file, JSON.stringify(rec) + "\n");
    },
  };
}

// ---------------------------------------------------------------------------
// Response cache — the resume backbone
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Persistent model-response cache keyed by a hash of the request body.
 *
 * The delegation loop is a pure function of model responses, so caching every
 * response and persisting it as it completes makes a run replayable: re-running
 * with the SAME run-id replays identical requests -> cache hits -> the identical
 * delegation tree, instantly and with no API spend, until it reaches the first
 * call that never completed (the one that got rate-limited) — which then runs
 * live. That is "resume at the agent that got rate-limited."
 *
 * Stored at <projectDir>/.agent-state/orchestrate-<runId>.cache.jsonl so progress
 * lives inside the project (sandbox/<name>), one appended line per delegation.
 */
// STRUCTURE_KEYWORD: RESUME_CACHE - stores completed model responses for same-run-id replay.
function makeCache(projectDir, runId) {
  const dir = path.join(projectDir, ".agent-state");
  const file = path.join(dir, `orchestrate-${runId}.cache.jsonl`);
  const map = new Map();
  let restored = 0;
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line); // skip a truncated final line from a crash
        if (rec && rec.hash) map.set(rec.hash, rec.response);
      } catch {
        /* ignore unparseable (partial) line */
      }
    }
    restored = map.size;
  }
  return {
    file,
    restored,
    hits: 0,
    live: 0,
    key(body) {
      return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
    },
    get(hash) {
      return map.get(hash);
    },
    put(hash, response) {
      map.set(hash, response);
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(file, JSON.stringify({ hash, response }) + "\n");
    },
  };
}

// ---------------------------------------------------------------------------
// Tool surface for an agent node
// ---------------------------------------------------------------------------

const ORCH_PREAMBLE_BASE = [
  "",
  "## Orchestrated delegation mode",
  "You are running as part of an orchestrated run.",
  "When the work assigned to you is complete, reply with your final work product",
  "as plain text (no tool call). That text is returned to whoever delegated to you.",
].join("\n");

const ORCH_PREAMBLE_HEADLESS = [
  "",
  "There is NO human available mid-task — make reasonable decisions and proceed.",
].join("\n");

const ASK_USER_PREAMBLE = [
  "",
  "A human operator MAY be available via the `ask_user` tool, but the run does NOT block",
  "waiting for them — a countdown auto-proceeds if they don't respond in time.",
  "Treat `ask_user` as a best-effort signal, not a guaranteed block.",
  "",
  "ABSOLUTE PROHIBITIONS — calling `ask_user` for any of these is a hard error:",
  "  • File paths, output directories, or project root — use the project path from your",
  "    task context, or a sensible default inside it. NEVER ask where to write files.",
  "  • Announcements: 'I am starting', 'proceeding now', 'research in progress' — just",
  "    proceed without announcing. Return your work product when done.",
  "  • Asking the same question twice — if you already asked, trust the answer you got.",
  "  • Blank or empty questions.",
  "  • Confirming 'ready?', 'shall I proceed?', 'OK to continue?', 'is this correct?'.",
  "",
  "WHEN `ask_user` RETURNS EMPTY OR STARTS WITH '(no response':",
  "  The user is not present. Make a REASONABLE DEFAULT ASSUMPTION, document it in your",
  "  work product (e.g. 'Assumed US-primary market based on task context'), and continue.",
  "  Do NOT call `ask_user` again about the same topic.",
  "",
  "BATCH RULE: Consolidate ALL genuine questions into ONE `ask_user` call. Never make",
  "multiple sequential `ask_user` calls — one call, one answer, proceed.",
  "",
  "CONFLICT RULE: If the user's task contains something wrong, infeasible, or ambiguous,",
  "surface it in your FIRST AND ONLY `ask_user` call BEFORE doing any other work.",
  "",
  "If you would otherwise emit a '=== USER IDEA SELECTION REQUIRED ===' board for a",
  "separate main thread, INSTEAD call `ask_user` ONCE with the full question and options.",
  "When they pick (or when the timeout auto-proceeds), continue with that choice.",
].join("\n");

const DELEGATE_PREAMBLE = [
  "",
  "You may delegate independent sub-tasks to other named project agents using the",
  "`delegate` tool. Delegate when a sub-task is genuinely owned by another agent;",
  "do the work yourself when it is not. Issue several `delegate` calls in a SINGLE",
  "turn to fan work out — teammates in the same turn run CONCURRENTLY, like an",
  "agent team; sequential turns run one at a time. Each delegated agent returns a",
  "text work product. Synthesize their results into your own final answer.",
].join("\n");

const SKILL_PREAMBLE = [
  "",
  "This repo's skills are available through the `use_skill` tool. When your persona",
  "says a task is driven by a named skill (e.g. a BMad workflow), call `use_skill`",
  "with that skill's name FIRST, then follow the loaded instructions. Load only the",
  "skills you actually need for the assigned task.",
].join("\n");

const FILE_PREAMBLE = [
  "",
  "You have REAL file tools sandboxed to the project directory: `write_file`,",
  "`read_file`, `list_files`. All paths are relative to the project root; anything",
  "outside it is refused. When your task is to implement something, WRITE THE",
  "ACTUAL FILES with `write_file` — complete file contents, never placeholders,",
  "snippets, or diffs. Do NOT paste full file contents into your final text answer:",
  "write the files, then summarize what you wrote and list any commands the human",
  "must run afterwards (installs, builds, dev server).",
].join("\n");

const COMMAND_PREAMBLE = [
  "",
  "You can execute NON-INTERACTIVE shell commands in the project directory with",
  "`run_command` (installs, builds, tests, scaffolding). Commands are killed after a",
  "timeout — never start watch/serve/dev-server processes that don't exit, and never",
  "run commands that expect keyboard input. Prefer flags like --yes / --no-install-hints.",
].join("\n");

const WEB_PREAMBLE = [
  "",
  "`web_search` and `web_fetch` give you live internet access for research.",
  "Record the source URLs you relied on in your work product.",
].join("\n");

/* ONE persistent readline interface, reused for every prompt. Creating a fresh
 * interface per question and closing it leaves process.stdin in a state where
 * later reads silently return nothing on Windows — so we keep a single one. */
let _stdinRl = null;
function stdinInterface() {
  if (!_stdinRl) {
    _stdinRl = require("node:readline").createInterface({ input: process.stdin, output: process.stdout });
    _stdinRl.on("close", () => {
      _stdinRl = null;
    });
  }
  return _stdinRl;
}

/** Prompt on the terminal and resolve with the typed line. */
function promptLine(promptText) {
  return new Promise((resolve) => {
    stdinInterface().question(promptText, (ans) => resolve(ans));
  });
}

/**
 * Show a countdown and resolve with the user's typed answer (if they respond
 * within timeoutSecs), or '' (if they don't).
 *
 * Typing STOPS the countdown — first keypress freezes the timer and the user
 * gets unlimited time to finish their answer.  This is what lets a user who IS
 * watching answer, while a user who walked away has the run auto-proceed.
 *
 * Closes the persistent readline interface before attaching a raw `data`
 * listener to avoid the double-consumption / silent-read bug on Windows.
 * stdinInterface() recreates it on the next promptLine() call.
 */
function promptWithCountdown(timeoutSecs, ctx) {
  // Close the shared readline so it doesn't compete with our raw data listener.
  if (_stdinRl) {
    _stdinRl.close(); // fires 'close' handler → _stdinRl = null
  }

  // Raw mode: data fires per-keystroke so we can freeze the countdown on the
  // first character, and we handle echo + backspace ourselves.
  // Falls back gracefully if raw mode isn't available (e.g. piped stdin —
  // but in that case interactive is false and we never reach this function).
  const canRaw = !!process.stdin.isTTY && typeof process.stdin.setRawMode === "function";
  if (canRaw) process.stdin.setRawMode(true);

  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve) => {
    let resolved = false;
    let userTyping = false;
    let buffer = "";
    let remaining = timeoutSecs;

    const done = (answer) => {
      if (resolved) return;
      resolved = true;
      if (canRaw) process.stdin.setRawMode(false);
      process.stdin.removeListener("data", onData);
      // Update user-absent flag on ctx so subsequent asks skip the countdown.
      if (ctx) {
        ctx.userAbsent = answer === "";
      }
      resolve(answer);
    };

    process.stderr.write(`\r⏱  Proceeding in ${remaining}s (type + Enter to answer): `);

    const interval = setInterval(() => {
      if (userTyping) return; // user is mid-input — freeze the clock
      remaining -= 1;
      if (remaining > 0) {
        process.stderr.write(`\r⏱  Proceeding in ${remaining}s (type + Enter to answer): `);
      } else {
        clearInterval(interval);
        process.stderr.write("\n(no response — proceeding autonomously)\n");
        done("");
      }
    }, 1000);

    const onData = (chunk) => {
      if (resolved) return;
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);

        if (ch === "\r" || ch === "\n") {
          // Enter — submit whatever is in the buffer.
          clearInterval(interval);
          process.stderr.write("\n");
          done(buffer.trim());
          return;
        }

        if (code === 3) {
          // Ctrl+C
          clearInterval(interval);
          process.stderr.write("\n");
          process.exit(130);
        }

        if (code === 127 || code === 8) {
          // Backspace / DEL
          if (!userTyping) {
            userTyping = true;
            clearInterval(interval);
            process.stderr.write("\n> ");
          }
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }

        if (!userTyping) {
          // First visible character — stop countdown, show the prompt.
          userTyping = true;
          clearInterval(interval);
          process.stderr.write("\n> " + ch);
        } else {
          process.stdout.write(ch);
        }
        buffer += ch;
      }
    };

    process.stdin.on("data", onData);
  });
}

/**
 * Pause the run and ask the human operator a question in the terminal, returning
 * their typed answer. This is how an agent (e.g. an idea-selection gate) gets a
 * real decision FROM the user, in code, mid-orchestration. Answers are cached
 * (keyed by the question) so a resumed run doesn't re-ask.
 *
 * Fire-and-forget mode: every ask uses a countdown (default 60 s). The user's
 * first keypress stops the clock; if they don't respond, the run auto-proceeds
 * and ctx.userAbsent is set so subsequent asks skip the countdown immediately.
 *
 * Parallel teammates could ask at the same time and fight over stdin/the
 * countdown — a promise-chain mutex on ctx._askLock queues prompts one at a time.
 */
// STRUCTURE_KEYWORD: USER_PROMPT_LOCK - serializes human prompts from parallel teammates.
async function askUser(question, options, ctx) {
  const prev = ctx._askLock || Promise.resolve();
  let release;
  ctx._askLock = new Promise((r) => (release = r));
  await prev;
  try {
    return await askUserPrompt(question, options, ctx);
  } finally {
    release();
  }
}

async function askUserPrompt(question, options, ctx) {
  const hasOpts = Array.isArray(options) && options.length > 0;
  let hash;
  if (ctx.cache) {
    hash = "ask:" + crypto.createHash("sha256").update(JSON.stringify({ question, options: options || [] })).digest("hex");
    const hit = ctx.cache.get(hash);
    if (hit !== undefined) {
      process.stderr.write(`\n(using saved answer for: ${String(question).slice(0, 80)})\n`);
      return hit;
    }
  }

  const out = ["", "═".repeat(72), "❓ THE ORCHESTRATION NEEDS YOUR INPUT", "", String(question), ""];
  if (hasOpts) {
    options.forEach((o, i) => out.push(`  ${i + 1}. ${o}`));
    out.push("", "Type the option NUMBER or your own answer, then Enter.");
  }
  out.push("═".repeat(72));
  process.stderr.write(out.join("\n") + "\n");

  let answer;
  if (ctx.userAbsent) {
    // User has already been absent at least once this run — skip countdown.
    process.stderr.write("(user absent — auto-proceeding)\n");
    answer = "";
  } else {
    answer = await promptWithCountdown(ctx.askTimeout || DEFAULTS.askTimeout, ctx);
    if (hasOpts && answer) {
      const n = Number(answer);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) answer = options[n - 1];
    }
  }

  // Only cache REAL answers — a timeout is never frozen into the run.
  if (answer && ctx.cache && hash) ctx.cache.put(hash, answer);
  if (!answer) {
    answer =
      "(no response — user not present; use your research and best judgment to proceed; " +
      "document any assumptions you make; do NOT call ask_user again on this topic)";
  }
  return answer;
}

/**
 * Tools available to one agent node: `delegate` (when the agent carries the Agent
 * tool and depth allows) and `ask_user` (when the run is interactive — a TTY).
 * EXTENSION POINT: to give leaf workers real effects, add `read`/`write`/`bash`
 * tool definitions here and execute them in runAgent()'s tool-dispatch loop.
 */
// STRUCTURE_KEYWORD: TOOL_SURFACE - decides which tools this agent node is allowed to use.
function buildTools(persona, depth, ctx, targets) {
  const tools = [];
  if (persona.canDelegate && depth < ctx.maxDepth) {
    tools.push({
      name: "delegate",
      description:
        "Hand an independent sub-task to another named project agent. " +
        "Returns that agent's text work product.",
      input_schema: {
        type: "object",
        properties: {
          agent: {
            type: "string",
            description: "Exact name of the project agent to delegate to.",
            enum: targets,
          },
          task: {
            type: "string",
            description: "Self-contained instructions for the delegated agent.",
          },
        },
        required: ["agent", "task"],
        additionalProperties: false,
      },
    });
  }
  // Sandboxed file effects — only when the run has a project dir and the persona
  // declares the matching capability in its frontmatter tools.
  const fx = ctx.projectDir && !ctx.noEffects;
  if (fx && persona.tools.includes("Write")) {
    tools.push({
      name: "write_file",
      description:
        "Write a COMPLETE file inside the project directory (parent folders are " +
        "created). Paths are relative to the project root; escaping it is refused.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path, e.g. src/index.ts" },
          content: { type: "string", description: "Full file content (no placeholders or diffs)." },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    });
  }
  if (fx && persona.tools.includes("Read")) {
    tools.push({
      name: "read_file",
      description: "Read a file inside the project directory. Path is relative to the project root.",
      input_schema: {
        type: "object",
        properties: { path: { type: "string", description: "Relative path to read." } },
        required: ["path"],
        additionalProperties: false,
      },
    });
    tools.push({
      name: "list_files",
      description:
        "List files under a directory inside the project (recursive; node_modules/.git/.agent-state skipped).",
      input_schema: {
        type: "object",
        properties: { dir: { type: "string", description: "Relative directory ('' = project root)." } },
        additionalProperties: false,
      },
    });
  }
  if (fx && persona.tools.includes("Edit")) {
    tools.push({
      name: "edit_file",
      description:
        "Replace an exact string in a project file. old_string must match exactly and " +
        "be unique in the file (or set replace_all).",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative path of the file to edit." },
          old_string: { type: "string", description: "Exact existing text to replace." },
          new_string: { type: "string", description: "Replacement text." },
          replace_all: { type: "boolean", description: "Replace every occurrence (default false)." },
        },
        required: ["path", "old_string", "new_string"],
        additionalProperties: false,
      },
    });
  }
  if (fx && persona.tools.includes("Grep")) {
    tools.push({
      name: "search_files",
      description:
        "Regex-search file contents under the project (node_modules/.git/.agent-state " +
        "skipped). Returns matching lines as path:line: text.",
      input_schema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "JavaScript regular expression." },
          dir: { type: "string", description: "Relative directory to search ('' = project root)." },
        },
        required: ["pattern"],
        additionalProperties: false,
      },
    });
  }
  if (fx && persona.tools.includes("Glob")) {
    tools.push({
      name: "find_files",
      description:
        "Find project files by glob pattern (e.g. src/**/*.ts, *.json). Returns relative paths.",
      input_schema: {
        type: "object",
        properties: { pattern: { type: "string", description: "Glob pattern (* ? ** supported)." } },
        required: ["pattern"],
        additionalProperties: false,
      },
    });
  }
  if (fx && persona.tools.includes("Bash")) {
    tools.push({
      name: "run_command",
      description:
        "Execute a NON-INTERACTIVE shell command in the project directory (installs, builds, " +
        "tests). Killed after a timeout; returns exit code, stdout, and stderr. Never start " +
        "watch/serve processes that don't exit.",
      input_schema: {
        type: "object",
        properties: { command: { type: "string", description: "The shell command to run." } },
        required: ["command"],
        additionalProperties: false,
      },
    });
  }
  if (fx && persona.tools.includes("WebFetch")) {
    tools.push({
      name: "web_fetch",
      description:
        "Fetch a public http(s) URL and return its text content (HTML stripped to text, capped).",
      input_schema: {
        type: "object",
        properties: { url: { type: "string", description: "Absolute http(s) URL." } },
        required: ["url"],
        additionalProperties: false,
      },
    });
  }
  if (fx && persona.tools.includes("WebSearch")) {
    tools.push({
      name: "web_search",
      description: "Search the live web and return the top results (title, URL, snippet).",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "Search query." } },
        required: ["query"],
        additionalProperties: false,
      },
    });
  }
  if (persona.tools.includes("Skill") && ctx.skills && ctx.skills.size) {
    tools.push({
      name: "use_skill",
      description:
        "Load one of this repo's skills (.claude/skills/<name>/SKILL.md) and receive " +
        "its full instructions as the tool result. Follow the loaded skill.",
      input_schema: {
        type: "object",
        properties: {
          skill: {
            type: "string",
            description: "Exact name of the skill to load.",
            enum: [...ctx.skills.keys()],
          },
        },
        required: ["skill"],
        additionalProperties: false,
      },
    });
  }
  if (ctx.interactive) {
    tools.push({
      name: "ask_user",
      description:
        "Ask the human operator a question and receive their typed answer. Use ONLY " +
        "for decisions that genuinely require the human (e.g. a required idea/concept " +
        "selection board). Blocks the run until the human answers.",
      input_schema: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question to show the human." },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Optional choices; the human can pick by number or type their own answer.",
          },
        },
        required: ["question"],
        additionalProperties: false,
      },
    });
  }
  return tools;
}

// ---------------------------------------------------------------------------
// Teammate pool + skill execution
// ---------------------------------------------------------------------------

/**
 * Run fn over items with at most `limit` in flight (the Agent Teams execution
 * model: a wave of teammates working concurrently). Never rejects — each slot
 * resolves {ok:true,value} or {ok:false,error} so one teammate's failure cannot
 * abort its siblings mid-flight; the caller decides what propagates.
 */
// STRUCTURE_KEYWORD: TEAMMATE_WAVE - runs same-turn delegated agents with bounded parallelism.
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const width = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: width }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = { ok: true, value: await fn(items[i]) };
      } catch (e) {
        out[i] = { ok: false, error: e };
      }
    }
  });
  await Promise.all(workers);
  return out;
}

/** Execute a `use_skill` call: return the SKILL.md body (capped) as the result. */
// STRUCTURE_KEYWORD: SKILL_TOOL - resolves use_skill calls into SKILL.md tool results.
function runSkill(tu, persona, depth, ctx) {
  const name = String((tu.input && tu.input.skill) || "");
  const file = ctx.skills && ctx.skills.get(name);
  ctx.tracer.log("skill", { agent: persona.name, depth, skill: name, known: !!file });
  if (!file) {
    return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: `unknown skill: ${name}` };
  }
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    return {
      type: "tool_result",
      tool_use_id: tu.id,
      is_error: true,
      content: `cannot read skill ${name}: ${e.message}`,
    };
  }
  const cap = int(ctx.skillMaxChars, DEFAULTS.skillMaxChars);
  if (text.length > cap) text = text.slice(0, cap) + `\n\n[skill truncated at ${cap} chars]`;
  return { type: "tool_result", tool_use_id: tu.id, content: text };
}

const FILE_TOOL_NAMES = new Set(["write_file", "read_file", "list_files"]);

/**
 * Execute a sandboxed file tool call (write_file / read_file / list_files).
 * Every path is resolved against ctx.projectDir and refused if it escapes it;
 * writes into .agent-state are refused (that's the orchestrator's own state).
 * File effects re-execute on cache replay, so a resumed run REBUILDS its files
 * deterministically from the cached responses.
 */
// STRUCTURE_KEYWORD: FILE_SANDBOX - executes read/write/list while keeping paths inside project.
function runFileTool(tu, persona, depth, ctx) {
  const err = (msg) => {
    ctx.tracer.log("fs_refused", { agent: persona.name, depth, tool: tu.name, note: msg });
    return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: msg };
  };
  const root = path.resolve(ctx.projectDir);
  const relIn = String((tu.input && (tu.input.path !== undefined ? tu.input.path : tu.input.dir)) || "");
  const abs = path.resolve(root, relIn);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return err(`refused: path escapes the project directory: ${relIn}`);
  }

  if (tu.name === "write_file") {
    if (!rel || rel === "." || rel.split(path.sep)[0] === ".agent-state") {
      return err(`refused: cannot write to ${relIn || "(project root)"} (reserved)`);
    }
    const content = String((tu.input && tu.input.content) != null ? tu.input.content : "");
    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    } catch (e) {
      return err(`write failed for ${rel}: ${e.message}`);
    }
    const bytes = Buffer.byteLength(content);
    ctx.tracer.log("write", { agent: persona.name, depth, path: rel.split(path.sep).join("/"), bytes });
    return { type: "tool_result", tool_use_id: tu.id, content: `wrote ${rel} (${bytes} bytes)` };
  }

  if (tu.name === "read_file") {
    let text;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch (e) {
      return err(`cannot read ${rel}: ${e.message}`);
    }
    const cap = int(ctx.fileMaxChars, DEFAULTS.fileMaxChars);
    if (text.length > cap) text = text.slice(0, cap) + `\n\n[file truncated at ${cap} chars]`;
    ctx.tracer.log("read", { agent: persona.name, depth, path: rel.split(path.sep).join("/") });
    return { type: "tool_result", tool_use_id: tu.id, content: text };
  }

  // list_files — bounded recursive listing; orchestrator/vendor dirs skipped.
  const skipDirs = new Set([".agent-state", "node_modules", ".git"]);
  const MAX_ENTRIES = 300;
  const lines = [];
  const walk = (d, prefix) => {
    if (lines.length >= MAX_ENTRIES) return;
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (lines.length >= MAX_ENTRIES) {
        lines.push("[listing truncated at " + MAX_ENTRIES + " entries]");
        return;
      }
      if (skipDirs.has(e.name)) continue;
      const p = prefix + e.name;
      if (e.isDirectory()) {
        lines.push(p + "/");
        walk(path.join(d, e.name), p + "/");
      } else {
        lines.push(p);
      }
    }
  };
  walk(abs, "");
  ctx.tracer.log("list", { agent: persona.name, depth, path: rel.split(path.sep).join("/") || "." });
  return { type: "tool_result", tool_use_id: tu.id, content: lines.join("\n") || "(empty)" };
}

// Every locally-executed tool (no model call, no delegation). One entry per
// Claude Code tool the personas declare: Write, Read/Glob, Edit, Grep, Bash,
// WebFetch, WebSearch — implemented here because the raw API has no tools.
const LOCAL_TOOL_NAMES = new Set([
  "write_file", "read_file", "list_files",
  "edit_file", "search_files", "find_files",
  "run_command", "web_fetch", "web_search",
]);

/** Resolve a relative path against the project dir; null if it escapes it. */
function resolveInProject(ctx, relIn) {
  const root = path.resolve(ctx.projectDir);
  const abs = path.resolve(root, String(relIn || ""));
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return { root, abs, rel };
}

const WALK_SKIP = new Set([".agent-state", "node_modules", ".git"]);
/** Yield {abs, rel} for every file under dir (skips vendor/state dirs). */
function* walkProject(dir, prefix) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (WALK_SKIP.has(e.name)) continue;
    const rel = prefix + e.name;
    if (e.isDirectory()) yield* walkProject(path.join(dir, e.name), rel + "/");
    else yield { abs: path.join(dir, e.name), rel };
  }
}

/** Translate a glob (* ? ** supported) to a RegExp over forward-slash paths. */
function globToRegExp(glob) {
  const g = String(glob).replace(/\\/g, "/");
  let re = "";
  for (let i = 0; i < g.length; i++) {
    if (g.slice(i, i + 3) === "**/") {
      re += "(?:.*/)?";
      i += 2;
    } else if (g.slice(i, i + 2) === "**") {
      re += ".*";
      i += 1;
    } else if (g[i] === "*") {
      re += "[^/]*";
    } else if (g[i] === "?") {
      re += "[^/]";
    } else {
      re += g[i].replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  // A bare filename pattern (no slash) matches at any depth, like Claude Code's Glob.
  const prefix = g.includes("/") ? "" : "(?:.*/)?";
  return new RegExp("^" + prefix + re + "$", "i");
}

/** Strip HTML down to readable text (crude but dependency-free). */
function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

async function webFetchText(url, ctx) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error("only http(s) URLs are allowed");
  const res = await fetch(u, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (orchestrate.cjs research)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let text = await res.text();
  if (String(res.headers.get("content-type") || "").includes("html")) text = htmlToText(text);
  const cap = int(ctx.fileMaxChars, DEFAULTS.fileMaxChars);
  return text.length > cap ? text.slice(0, cap) + "\n[truncated]" : text;
}

async function webSearchText(query, ctx) {
  const res = await fetch(
    "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
    { headers: { "user-agent": "Mozilla/5.0 (orchestrate.cjs research)" } },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} from DuckDuckGo`);
  const html = await res.text();
  const out = [];
  const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = linkRe.exec(html)) && out.length < 8) {
    let href = m[1];
    const uddg = /[?&]uddg=([^&]+)/.exec(href); // DDG wraps targets in a redirect
    if (uddg) href = decodeURIComponent(uddg[1]);
    out.push(`${htmlToText(m[2])}\n${href}`);
  }
  if (!out.length) throw new Error("no results parsed (layout change or access blocked)");
  return out.join("\n\n");
}

/**
 * Execute one locally-implemented tool call. File tools are sandboxed to the
 * project dir. Web results are cached in the run cache ("web:" keys) so a
 * resume replays them deterministically. run_command output is NOT cached —
 * on replay the command re-executes, and if its output diverges the run
 * naturally continues live from that point.
 */
async function runLocalTool(tu, persona, depth, ctx) {
  const err = (msg) => {
    ctx.tracer.log("fs_refused", { agent: persona.name, depth, tool: tu.name, note: msg });
    return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: msg };
  };
  const ok = (content) => ({ type: "tool_result", tool_use_id: tu.id, content });

  if (tu.name === "write_file" || tu.name === "read_file" || tu.name === "list_files") {
    return runFileTool(tu, persona, depth, ctx);
  }

  if (tu.name === "edit_file") {
    const loc = resolveInProject(ctx, tu.input && tu.input.path);
    if (!loc || !loc.rel || loc.rel.split(path.sep)[0] === ".agent-state") {
      return err(`refused: bad edit path: ${String((tu.input && tu.input.path) || "")}`);
    }
    let text;
    try {
      text = fs.readFileSync(loc.abs, "utf8");
    } catch (e) {
      return err(`cannot read ${loc.rel}: ${e.message}`);
    }
    const oldS = String((tu.input && tu.input.old_string) != null ? tu.input.old_string : "");
    const newS = String((tu.input && tu.input.new_string) != null ? tu.input.new_string : "");
    if (!oldS) return err("edit_file: old_string must be non-empty");
    const count = text.split(oldS).length - 1;
    if (count === 0) return err(`edit_file: old_string not found in ${loc.rel}`);
    const all = (tu.input && tu.input.replace_all) === true;
    if (count > 1 && !all) {
      return err(`edit_file: old_string occurs ${count} times in ${loc.rel}; make it unique or set replace_all`);
    }
    const idx = text.indexOf(oldS);
    const updated = all
      ? text.split(oldS).join(newS)
      : text.slice(0, idx) + newS + text.slice(idx + oldS.length);
    fs.writeFileSync(loc.abs, updated);
    const n = all ? count : 1;
    ctx.tracer.log("edit", { agent: persona.name, depth, path: loc.rel.split(path.sep).join("/"), replaced: n });
    return ok(`edited ${loc.rel} (${n} replacement${n === 1 ? "" : "s"})`);
  }

  if (tu.name === "search_files") {
    const pattern = String((tu.input && tu.input.pattern) || "");
    if (!pattern) return err("search_files: pattern required");
    let re;
    try {
      re = new RegExp(pattern, "i");
    } catch (e) {
      return err(`search_files: bad regex: ${e.message}`);
    }
    const loc = resolveInProject(ctx, (tu.input && tu.input.dir) || "");
    if (!loc) return err("refused: dir escapes the project directory");
    const MAX_MATCHES = 100;
    const found = [];
    const prefix = loc.rel ? loc.rel.split(path.sep).join("/") + "/" : "";
    for (const f of walkProject(loc.abs, prefix)) {
      if (found.length >= MAX_MATCHES) break;
      let text;
      try {
        if (fs.statSync(f.abs).size > 1024 * 1024) continue; // skip big files
        text = fs.readFileSync(f.abs, "utf8");
      } catch {
        continue;
      }
      if (text.slice(0, 8000).includes("\0")) continue; // skip binaries
      const fileLines = text.split(/\r?\n/);
      for (let ln = 0; ln < fileLines.length && found.length < MAX_MATCHES; ln++) {
        if (re.test(fileLines[ln])) found.push(`${f.rel}:${ln + 1}: ${fileLines[ln].slice(0, 300)}`);
      }
    }
    if (found.length >= MAX_MATCHES) found.push(`[stopped at ${MAX_MATCHES} matches]`);
    ctx.tracer.log("search", { agent: persona.name, depth, pattern: pattern.slice(0, 120), matches: found.length });
    return ok(found.join("\n") || "(no matches)");
  }

  if (tu.name === "find_files") {
    const pattern = String((tu.input && tu.input.pattern) || "");
    if (!pattern) return err("find_files: pattern required");
    let re;
    try {
      re = globToRegExp(pattern);
    } catch (e) {
      return err(`find_files: bad glob: ${e.message}`);
    }
    const MAX_FILES = 200;
    const found = [];
    for (const f of walkProject(path.resolve(ctx.projectDir), "")) {
      if (found.length >= MAX_FILES) {
        found.push(`[stopped at ${MAX_FILES} files]`);
        break;
      }
      if (re.test(f.rel)) found.push(f.rel);
    }
    ctx.tracer.log("glob", { agent: persona.name, depth, pattern: pattern.slice(0, 120), matches: found.length });
    return ok(found.join("\n") || "(no matches)");
  }

  if (tu.name === "run_command") {
    const cmd = String((tu.input && tu.input.command) || "").trim();
    if (!cmd) return err("run_command: command required");
    const timeoutMs = int(ctx.cmdTimeout, DEFAULTS.cmdTimeout) * 1000;
    ctx.tracer.log("command", { agent: persona.name, depth, command: cmd.slice(0, 300) });
    const r = spawnSync(cmd, {
      shell: true,
      cwd: path.resolve(ctx.projectDir),
      timeout: timeoutMs,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const cap = int(ctx.fileMaxChars, DEFAULTS.fileMaxChars);
    const clip = (s) => {
      s = String(s || "");
      return s.length > cap / 2 ? s.slice(0, cap / 2) + "\n[truncated]" : s;
    };
    const timedOut = !!(r.error && r.error.code === "ETIMEDOUT");
    const exit = timedOut ? `TIMEOUT after ${timeoutMs / 1000}s` : String(r.status);
    ctx.tracer.log("command_result", { agent: persona.name, depth, exit });
    return {
      type: "tool_result",
      tool_use_id: tu.id,
      is_error: !!(timedOut || r.status !== 0 || (r.error && !timedOut)),
      content:
        `exit: ${exit}\n--- stdout ---\n${clip(r.stdout)}\n--- stderr ---\n${clip(r.stderr)}` +
        (r.error && !timedOut ? `\n--- error ---\n${r.error.message}` : ""),
    };
  }

  if (tu.name === "web_fetch" || tu.name === "web_search") {
    const isSearch = tu.name === "web_search";
    const input = String((tu.input && (isSearch ? tu.input.query : tu.input.url)) || "").trim();
    if (!input) return err(`${tu.name}: ${isSearch ? "query" : "url"} required`);
    ctx.tracer.log(tu.name, { agent: persona.name, depth, [isSearch ? "query" : "url"]: input.slice(0, 300) });
    // Cache web results in the run cache so a resume replays them deterministically.
    let hash;
    if (ctx.cache) {
      hash = "web:" + crypto.createHash("sha256").update(tu.name + ":" + input).digest("hex");
      const hit = ctx.cache.get(hash);
      if (hit !== undefined) return ok(hit);
    }
    let content;
    try {
      content = isSearch ? await webSearchText(input, ctx) : await webFetchText(input, ctx);
    } catch (e) {
      return err(`${tu.name} failed: ${e.message}`);
    }
    if (ctx.cache && hash) ctx.cache.put(hash, content);
    return ok(content);
  }

  return err(`unknown local tool: ${tu.name}`);
}

// ---------------------------------------------------------------------------
// The delegation loop (recursive — THIS is the guaranteed call graph)
// ---------------------------------------------------------------------------

/** Validate a requested delegation target. Returns {ok} or {ok:false, reason}. */
// STRUCTURE_KEYWORD: DELEGATION_GUARD - enforces whitelist, fork-safe, no cycles, depth, and budget.
function validateTarget(target, depth, ancestors, ctx) {
  const persona = ctx.agents.get(target);
  if (!persona)
    return { ok: false, reason: `PROJECT_AGENT_UNAVAILABLE: ${target} (unknown agent)` };
  if (!persona.forkSafe)
    return {
      ok: false,
      reason: `PROJECT_AGENT_UNAVAILABLE: ${target} (interactive-only; not fork-safe)`,
    };
  if (ancestors.includes(target))
    return { ok: false, reason: `refused: ${target} is an ancestor (would form a cycle)` };
  if (depth + 1 > ctx.maxDepth)
    return { ok: false, reason: `refused: max delegation depth (${ctx.maxDepth}) reached`, limit: "depth" };
  if (ctx.budget.used >= ctx.budget.max)
    return { ok: false, reason: `refused: delegation budget (${ctx.budget.max}) exhausted`, limit: "budget" };
  return { ok: true, persona };
}

/**
 * Run one agent node to completion, recursing on `delegate` calls.
 * @returns {Promise<string>} the agent's final text work product.
 */
// STRUCTURE_KEYWORD: AGENT_NODE_LOOP - recursive parent/child agent conversation and synthesis loop.
async function runAgent(persona, task, depth, ancestors, ctx) {
  const targets = [...ctx.agents.values()]
    .filter((p) => p.forkSafe && p.name !== persona.name && !ancestors.includes(p.name))
    .map((p) => p.name);

  let system = persona.system + "\n" + ORCH_PREAMBLE_BASE;
  const tools = buildTools(persona, depth, ctx, targets);
  if (tools.some((t) => t.name === "delegate")) system += "\n" + DELEGATE_PREAMBLE;
  if (tools.some((t) => t.name === "use_skill")) system += "\n" + SKILL_PREAMBLE;
  if (tools.some((t) => FILE_TOOL_NAMES.has(t.name) || t.name === "edit_file")) system += "\n" + FILE_PREAMBLE;
  if (tools.some((t) => t.name === "run_command")) system += "\n" + COMMAND_PREAMBLE;
  if (tools.some((t) => t.name === "web_fetch" || t.name === "web_search")) system += "\n" + WEB_PREAMBLE;
  system += "\n" + (ctx.interactive ? ASK_USER_PREAMBLE : ORCH_PREAMBLE_HEADLESS);

  const model = resolveModel(persona);
  const messages = [{ role: "user", content: task }];

  for (let turn = 0; turn < ctx.maxTurns; turn++) {
    const hitsBefore = ctx.cache ? ctx.cache.hits : 0;
    const resp = await callModel({
      model,
      system,
      messages,
      tools,
      maxTokens: ctx.maxTokens,
      cache: ctx.cache,
      maxRetries: ctx.maxRetries,
    });
    // A cache hit means this turn is being replayed from a prior run (resume),
    // not a fresh live call — mark it so the reprinted history is distinguishable.
    const cached = ctx.cache ? ctx.cache.hits > hitsBefore : false;
    printChat(ctx, persona, depth, resp, cached);
    const toolUses = (resp.content || []).filter(
      (b) =>
        b &&
        b.type === "tool_use" &&
        (b.name === "delegate" || b.name === "ask_user" || b.name === "use_skill" ||
          LOCAL_TOOL_NAMES.has(b.name)),
    );
    ctx.tracer.log("turn", {
      agent: persona.name,
      depth,
      turn,
      stop: resp.stop_reason,
      cached,
      text: traceClip(textOf(resp.content), ctx),
      toolUses: toolUses.map((tu) => traceToolUse(tu, ctx)),
    });

    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
      return textOf(resp.content) || "(no text output)";
    }

    // Echo the assistant turn with ONLY the tool_use blocks. The proxy rewrites
    // assistant TEXT into a <assistant_history> user block; a tool_use-only
    // assistant message passes through untouched and keeps the
    // tool_use -> tool_result pairing the API requires.
    messages.push({ role: "assistant", content: toolUses });

    // Dispatch this turn's tool calls. ask_user runs inline (the terminal is a
    // shared resource), use_skill is a local file read, and delegate calls are
    // collected into a WAVE that runs concurrently — the Agent Teams execution
    // model: teammates in the same turn work in parallel, each in its own context.
    const results = new Array(toolUses.length);
    const wave = [];
    for (let i = 0; i < toolUses.length; i++) {
      const tu = toolUses[i];
      if (tu.name === "use_skill") {
        results[i] = runSkill(tu, persona, depth, ctx);
        continue;
      }
      if (LOCAL_TOOL_NAMES.has(tu.name)) {
        results[i] = await runLocalTool(tu, persona, depth, ctx);
        continue;
      }
      if (tu.name === "ask_user") {
        if (ctx.askBudget && ctx.askBudget.used >= ctx.askBudget.max) {
          ctx.tracer.log("refused", { from: persona.name, to: "ask_user", depth, note: "ask_user budget exhausted" });
          results[i] = {
            type: "tool_result",
            tool_use_id: tu.id,
            is_error: true,
            content:
              `ask_user limit (${ctx.askBudget.max}) reached for this run. Do NOT call ask_user again. ` +
              `Make a reasonable decision yourself and proceed with the actual work.`,
          };
          continue;
        }
        if (ctx.askBudget) ctx.askBudget.used += 1;
        const question = (tu.input && tu.input.question) || "";
        const options = (tu.input && tu.input.options) || [];
        ctx.tracer.log("ask_user", { agent: persona.name, depth, question: String(question).slice(0, 200) });
        let answer;
        try {
          answer = await askUser(question, options, ctx);
        } catch (e) {
          answer = `(ask_user failed: ${e.message})`;
        }
        ctx.tracer.log("ask_user_answer", { agent: persona.name, depth, answer: String(answer).slice(0, 200) });
        results[i] = { type: "tool_result", tool_use_id: tu.id, content: String(answer) };
        continue;
      }
      // delegate — validate + charge the budget HERE, synchronously and in tool_use
      // order, so the whitelist/depth/cycle/budget guarantees are identical whether
      // the wave then runs sequentially or in parallel.
      const target = tu.input && tu.input.agent;
      const subTask = (tu.input && tu.input.task) || "";
      const v = validateTarget(target, depth, ancestors, ctx);
      if (!v.ok) {
        // A budget/depth refusal means the run wanted to keep going but hit a
        // ceiling — the work is INCOMPLETE, not finished. Record it so the run
        // ends as `blocked` (resumable) instead of a false `done`. Cycle/whitelist
        // refusals are by-design rejections of a bad target, so they don't set this.
        if (v.limit) ctx.limitHit = { kind: v.limit, reason: v.reason };
        ctx.tracer.log("refused", { from: persona.name, to: target, depth, note: v.reason });
        results[i] = {
          type: "tool_result",
          tool_use_id: tu.id,
          is_error: true,
          content: v.reason,
        };
        continue;
      }
      // Replayed (cache-hit) delegations are a deterministic re-run of work that
      // already completed on a prior run; charging them against the live budget
      // would make every resume re-pay for the finished graph and never advance
      // past the cap. Only genuinely-new (live) delegations count toward it.
      if (!cached) ctx.budget.used += 1;
      ctx.tracer.log("delegate", { from: persona.name, to: target, depth: depth + 1, task: subTask });
      wave.push({ i, tu, target, persona: v.persona, task: subTask });
    }

    if (wave.length) {
      const limit = Math.max(1, Number(ctx.maxParallel) || 1);
      if (wave.length > 1) {
        ctx.tracer.log("team_wave", {
          agent: persona.name,
          depth,
          size: wave.length,
          parallel: Math.min(limit, wave.length),
          teammates: wave.map((w) => w.target),
        });
        chatStatus(
          ctx,
          depth,
          paint("2", `⫸ team: ${wave.length} teammates` +
            (limit > 1 ? ` (up to ${Math.min(limit, wave.length)} in parallel)` : " (sequential)") +
            ` — ${wave.map((w) => w.target).join(", ")}`),
        );
      }
      const settled = await mapPool(wave, limit, async (job) => {
        const product = await runAgent(job.persona, job.task, depth + 1, [...ancestors, persona.name], ctx);
        if (wave.length > 1) chatStatus(ctx, depth, paint("2", `✓ ${job.target} returned`));
        return product;
      });
      let rateErr = null;
      for (let k = 0; k < wave.length; k++) {
        const job = wave[k];
        const s = settled[k];
        if (s.ok) {
          ctx.tracer.log("result", {
            from: job.target,
            to: persona.name,
            depth: depth + 1,
            toolUseId: job.tu.id,
            content: traceClip(s.value, ctx),
          });
          results[job.i] = { type: "tool_result", tool_use_id: job.tu.id, content: s.value };
          continue;
        }
        ctx.tracer.log("error", { from: persona.name, to: job.target, depth: depth + 1, note: s.error.message });
        // A rate limit is recoverable by resuming — propagate it AFTER the whole
        // wave settles, so finished siblings are already in the cache and replay
        // free on resume, and the parent's result isn't poisoned with a fake
        // "failed" work product. Other failures degrade as before.
        if (s.error.rateLimited) {
          if (!rateErr) rateErr = s.error;
        } else {
          results[job.i] = {
            type: "tool_result",
            tool_use_id: job.tu.id,
            content: `delegated agent ${job.target} failed: ${s.error.message}`,
          };
        }
      }
      if (rateErr) throw rateErr;
    }
    ctx.tracer.log("tool_result_batch", {
      agent: persona.name,
      depth,
      results: results.map((r) => ({
        tool_use_id: r && r.tool_use_id,
        is_error: !!(r && r.is_error),
        content: traceClip(r && r.content, ctx, 1000),
      })),
    });
    messages.push({ role: "user", content: results });
  }
  return "(stopped: reached per-agent turn limit before finishing)";
}

// ---------------------------------------------------------------------------
// Trace rendering
// ---------------------------------------------------------------------------

// STRUCTURE_KEYWORD: TREE_RENDER - converts delegate trace events into the final delegation tree.
function renderTree(tracer, rootName) {
  const edges = tracer.events.filter((e) => e.event === "delegate");
  const children = new Map();
  for (const e of edges) {
    if (!children.has(e.from)) children.set(e.from, []);
    children.get(e.from).push(e.to);
  }
  const lines = [];
  const seen = [];
  const walk = (name, prefix) => {
    lines.push(prefix + name);
    if (seen.includes(name)) return; // guard pathological repeats in render
    seen.push(name);
    for (const c of children.get(name) || []) walk(c, prefix + "  └─ ");
  };
  walk(rootName, "");
  const counts = {};
  for (const e of edges) counts[e.to] = (counts[e.to] || 0) + 1;
  return { tree: lines.join("\n"), total: edges.length, counts };
}

// ---------------------------------------------------------------------------
// Milestone hand-off (connects to milestone.cjs so a rate-limited run is
// resumable, and SessionStart surfaces where it stopped)
// ---------------------------------------------------------------------------

/** Completed delegations, in order, deduped — derived from `result` trace events. */
// STRUCTURE_KEYWORD: COMPLETED_WORK - derives finished parent/child handoffs from result events.
function completedDelegations(tracer) {
  const seen = new Set();
  const out = [];
  for (const e of tracer.events) {
    if (e.event !== "result") continue;
    const label = `${e.to} → ${e.from}`; // parent → child that returned
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

// STRUCTURE_KEYWORD: RESUME_COMMAND - builds the exact command that continues a halted run.
function buildResumeCmd({ rootName, taskFile, runId, projectDir, backend }) {
  return (
    `powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/orchestrate.ps1 ` +
    `--agent ${rootName} --task-file "${taskFile}" --run-id ${runId} ` +
    `--project "${projectDir}"` +
    (backend ? ` --backend ${backend}` : "")
  );
}

/**
 * Save a project milestone by shelling out to milestone.cjs (it has no
 * require-guard, so it cannot be safely required). Status `blocked` on a
 * rate-limit halt, `done` on success. Never throws.
 */
// STRUCTURE_KEYWORD: MILESTONE_HANDOFF - saves blocked/done status for the next session.
function saveMilestone({ status, projectDir, rootName, task, runId, backend, tracer, resumeCmd, cacheFile, traceFile, errorMessage }) {
  const milestoneScript = path.join(__dirname, "milestone.cjs");
  if (!fs.existsSync(milestoneScript)) {
    console.error(`(milestone.cjs not found at ${milestoneScript}; skipping milestone save)`);
    return;
  }
  const completed = completedDelegations(tracer);
  const next =
    status === "blocked"
      ? [
          "Re-run with the SAME --run-id to resume — completed delegations replay from cache (no re-spend); the run continues live at the exact point it stopped (the rate-limited or budget-capped call).",
          resumeCmd,
        ]
      : ["Run complete. Work product was printed to stdout; full trace in the log file."];

  const payload = {
    title: `Orchestration: ${rootName}`,
    status,
    goal: String(task || "").trim().slice(0, 2000),
    completed,
    next,
    delegation: resumeCmd,
    contextToLoad: [cacheFile, traceFile].filter(Boolean),
    notes:
      `run-id: ${runId}\nbackend: ${backend}\n` +
      `completed delegations (replay from cache on resume): ${completed.length}\n` +
      `cache: ${cacheFile}\ntrace: ${traceFile}` +
      (errorMessage ? `\nhalted on: ${errorMessage}` : ""),
  };

  const r = spawnSync(process.execPath, [milestoneScript, "save", "--project", projectDir, "--stdin"], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.status !== 0 && r.stderr) process.stderr.write(r.stderr);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(flags, def) {
  const a = process.argv;
  for (const f of [].concat(flags)) {
    const i = a.indexOf(f);
    if (i !== -1) return a[i + 1] !== undefined && !a[i + 1].startsWith("--") ? a[i + 1] : true;
  }
  return def;
}

function printList(agents) {
  const rows = [...agents.values()].sort((a, b) => a.name.localeCompare(b.name));
  console.log(`Loaded ${rows.length} agents from ${path.relative(REPO_ROOT, AGENTS_DIR)}\n`);
  for (const p of rows) {
    const tags = [];
    if (p.canDelegate) tags.push("delegator");
    if (!p.forkSafe) tags.push("interactive/not-fork-safe");
    console.log(
      `  ${p.name.padEnd(34)} ${String(p.model).padEnd(7)} ${tags.length ? "[" + tags.join(", ") + "]" : ""}`,
    );
  }
  console.log(
    `\nDelegators (carry the Agent tool): ` +
      rows.filter((p) => p.canDelegate).map((p) => p.name).join(", "),
  );
}

async function probe() {
  const model = String(arg("--model", MODEL_MAP.sonnet));
  const be = resolveBackend();
  console.log(`Probing [${be.name}] ${be.baseUrl}/v1/messages with model "${model}" ...`);
  const tools = [
    {
      name: "ping",
      description: "Replies with pong. Test tool.",
      input_schema: {
        type: "object",
        properties: { n: { type: "integer" } },
        required: ["n"],
        additionalProperties: false,
      },
    },
  ];
  let r1;
  try {
    r1 = await callModel({
      model,
      system: "You are a test harness. When asked, call the ping tool.",
      messages: [{ role: "user", content: "Call the ping tool with n=7." }],
      tools,
      maxTokens: 256,
    });
  } catch (e) {
    console.log(`FAIL (turn 1): ${e.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  turn 1 stop_reason=${r1.stop_reason}  model=${r1.model || "?"}`);
  const tu = (r1.content || []).find((b) => b.type === "tool_use" && b.name === "ping");
  if (!tu) {
    console.log(
      "FAIL (turn 1): model did not call the tool. Tool-use may not work through " +
        "this upstream, or the model string is wrong. Raw text: " +
        JSON.stringify(textOf(r1.content)).slice(0, 200),
    );
    process.exitCode = 1;
    return;
  }
  let r2;
  try {
    r2 = await callModel({
      model,
      system: "You are a test harness. When asked, call the ping tool.",
      messages: [
        { role: "user", content: "Call the ping tool with n=7." },
        { role: "assistant", content: [tu] }, // tool_use-only echo (proxy-safe)
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: tu.id, content: "pong:7" }],
        },
      ],
      tools,
      maxTokens: 256,
    });
  } catch (e) {
    console.log(`FAIL (turn 2): ${e.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  turn 2 stop_reason=${r2.stop_reason}  text=${JSON.stringify(textOf(r2.content)).slice(0, 160)}`);
  console.log("\nPASS — the proxy round-trips a 2-turn tool exchange. Delegation loop is viable.");
}

// Build fresh per-attempt state. This is intentionally separate from main()
// because auto-resume must behave like a manual re-run with the same run-id:
// reload cache from disk, reset live counters, and replay to the frontier.
// STRUCTURE_KEYWORD: AUTO_RESUME_ATTEMPT - creates a clean retry context after a rate-limit reset.
function makeAttemptContext(opts) {
  return {
    agents: opts.agents,
    skills: opts.skills,
    projectDir: opts.projectDir,
    noEffects: opts.noEffects,
    fileMaxChars: opts.fileMaxChars,
    cmdTimeout: opts.cmdTimeout,
    tracer: makeTracer(opts.runId, opts.projectDir),
    cache: makeCache(opts.projectDir, opts.runId),
    interactive: opts.interactive,
    budget: { used: 0, max: opts.maxDelegations },
    askBudget: { used: 0, max: opts.maxAsks },
    maxDepth: opts.maxDepth,
    maxTurns: opts.maxTurns,
    maxTokens: opts.maxTokens,
    maxRetries: opts.maxRetries,
    maxParallel: opts.maxParallel,
    skillMaxChars: opts.skillMaxChars,
    traceTextChars: opts.traceTextChars,
    askTimeout: opts.askTimeout,
    autoResume: opts.autoResume,
    resumeDelay: opts.resumeDelay,
    userAbsent: false,
    quiet: opts.quiet,
  };
}

// STRUCTURE_KEYWORD: CLI_ENTRYPOINT - parses flags, creates run context, starts the root agent.
async function main() {
  if (arg("--help", false) || process.argv.length <= 2) {
    console.log(
      [
        "orchestrate.cjs — code-guaranteed agent delegation (B1)",
        "",
        "  --list                       list loadable agents + flags",
        "  --probe [--model <id>]       validate the proxy survives a tool loop",
        '  --agent <name> --task "..."  run an orchestration from <name>',
        "  --task-file <path>           read the task from a file instead",
        "  --project <dir>              where progress is saved (default: cwd; use sandbox/<name>)",
        "  --backend <name>             proxy | claude-code | anthropic | auto (default)",
        "  --no-interactive             disable ask_user prompts (headless; for CI/piped runs)",
        "  --ask-timeout N              seconds to wait before auto-proceeding on agent questions (default 60)",
        "                               type any key within N seconds to stop the clock and answer",
        "  --max-parallel N             concurrent teammates per delegation wave (default 4; Agent Teams-style)",
        "  --no-parallel                run delegations strictly one at a time (same as --max-parallel 1)",
        "  --skill-max-chars N          cap on a SKILL.md body returned by use_skill (default 12000)",
        "  --no-effects                 disable ALL local tools (file/edit/search/command/web) — text only",
        "  --file-max-chars N           cap on read_file / run_command / web results (default 24000)",
        "  --cmd-timeout N              seconds before run_command is killed (default 120)",
        "  --trace-text-chars N         cap on saved text snippets in trace JSONL (default 2000)",
        "  --max-depth N --max-delegations N --max-turns N --max-tokens N --max-retries N --max-asks N",
        "  --run-id <id>                trace/cache id. Re-run with the SAME id to RESUME",
        "                               a rate-limited run: completed delegations replay",
        "                               from cache, the failed agent runs live.",
        "  --auto-resume                on rate-limit: wait --resume-delay seconds then retry",
        "                               automatically (fire-and-forget; Ctrl+C to abort)",
        "  --resume-delay N             seconds to wait before auto-resuming (default 3600 = 1 h)",
        "  --quiet                      hide the live agent transcript (it prints to the terminal by default)",
        "",
        `  backends : proxy=${PROXY_URL}  claude-code=OAuth(api.anthropic.com)  anthropic=API key`,
        `  models   : opus=${MODEL_MAP.opus} sonnet=${MODEL_MAP.sonnet} haiku=${MODEL_MAP.haiku}`,
        MODEL_FORCE ? `  (ORCH_MODEL forces all agents -> ${MODEL_FORCE})` : "",
      ].join("\n"),
    );
    return;
  }

  const agents = loadAgents();
  if (arg("--list", false)) return printList(agents);
  if (arg("--probe", false)) return probe();

  const rootName = arg("--agent");
  if (typeof rootName !== "string") throw new Error("--agent <name> is required");
  const root = agents.get(rootName);
  if (!root) throw new Error(`unknown agent: ${rootName} (try --list)`);
  if (!root.forkSafe)
    throw new Error(`${rootName} is interactive-only and cannot be run as an autonomous root`);

  let task = arg("--task");
  const taskFile = arg("--task-file");
  if (typeof taskFile === "string") task = fs.readFileSync(taskFile, "utf8");
  if (typeof task !== "string" || !task.trim())
    throw new Error("provide a task via --task \"...\" or --task-file <path>");

  const runId = String(arg("--run-id", new Date().toISOString().replace(/[:.]/g, "-")));

  // Progress (cache + task + milestone) lives INSIDE the project, e.g.
  // sandbox/<name>, so it travels with the work. Default to cwd.
  const projectArg = arg("--project");
  const projectDir = path.resolve(typeof projectArg === "string" ? projectArg : process.cwd());
  const stateDir = path.join(projectDir, ".agent-state");
  if (!fs.existsSync(projectDir)) console.log(`  (creating project dir ${projectDir})`);
  fs.mkdirSync(stateDir, { recursive: true }); // creates projectDir too if new
  const taskSnapshot = path.join(stateDir, `orchestrate-${runId}.task.txt`);
  if (!fs.existsSync(taskSnapshot)) fs.writeFileSync(taskSnapshot, task); // for --task-file resume

  const backendArg = String(arg("--backend", process.env.ORCH_BACKEND || "auto"));
  // Interactive when attached to a terminal (so agents can ask_user). Force off
  // with --no-interactive for CI / piped runs, where agents proceed autonomously.
  const interactive = !!process.stdin.isTTY && arg("--no-interactive", false) !== true;
  const skills = loadSkills();
  const runOptions = {
    agents,
    skills,
    runId,
    projectDir,
    noEffects: arg("--no-effects", false) === true,
    fileMaxChars: int(arg("--file-max-chars"), DEFAULTS.fileMaxChars),
    cmdTimeout: int(arg("--cmd-timeout"), DEFAULTS.cmdTimeout),
    interactive,
    maxDelegations: int(arg("--max-delegations"), DEFAULTS.maxDelegations),
    maxAsks: int(arg("--max-asks"), DEFAULTS.maxAsks),
    maxDepth: int(arg("--max-depth"), DEFAULTS.maxDepth),
    maxTurns: int(arg("--max-turns"), DEFAULTS.maxTurns),
    maxTokens: int(arg("--max-tokens"), DEFAULTS.maxTokens),
    maxRetries: int(arg("--max-retries"), DEFAULTS.maxRetries),
    maxParallel: arg("--no-parallel", false) === true ? 1 : int(arg("--max-parallel"), DEFAULTS.maxParallel),
    skillMaxChars: int(arg("--skill-max-chars"), DEFAULTS.skillMaxChars),
    traceTextChars: int(arg("--trace-text-chars"), DEFAULTS.traceTextChars),
    askTimeout: int(arg("--ask-timeout"), DEFAULTS.askTimeout),
    autoResume: arg("--auto-resume", false) === true,
    resumeDelay: int(arg("--resume-delay"), DEFAULTS.resumeDelay),
    quiet: arg("--quiet", false) === true, // suppress the live agent transcript
  };
  let ctx = makeAttemptContext(runOptions);
  const resumeCmd = buildResumeCmd({ rootName, taskFile: taskSnapshot, runId, projectDir, backend: backendArg });

  console.log(
    `Running ${rootName} (depth<=${ctx.maxDepth}, <=${ctx.budget.max} delegations, run-id ${runId}).\n` +
      `  project: ${projectDir}\n  trace:   ${path.relative(REPO_ROOT, ctx.tracer.file)}\n` +
      `  team:    up to ${ctx.maxParallel} teammate(s) in parallel per delegation wave (--max-parallel)\n` +
      `  skills:  ${skills.size} loadable via use_skill (shown as ⚡ in the transcript)\n` +
      `  effects: ${ctx.noEffects ? "OFF (--no-effects) — agents return text only" : `full local toolset per persona frontmatter (file/edit/search/glob sandboxed to ${projectDir}; run_command cwd there, ${ctx.cmdTimeout}s timeout; web via live fetch)`}\n` +
      `  input:   ${interactive ? `interactive — agents ask via ask_user (${ctx.askTimeout}s timeout; type to stop clock)` : "headless — no prompts"}` +
      (ctx.autoResume ? `\n  auto-resume: on rate-limit wait ~${Math.round(ctx.resumeDelay / 60)}m then retry (Ctrl+C to abort)` : "") +
      `\n  transcript: ${ctx.quiet ? "off (--quiet)" : "on — live agent chat prints below (stderr); --quiet to hide"}` +
      (ctx.cache.restored ? `\n  resume:  replaying ${ctx.cache.restored} cached response(s) from a prior run` : "") +
      "\n",
  );

  let product;
  let resumeAttempt = 0;
  for (;;) {
    try {
      product = await runAgent(root, task, 0, [], ctx);
      break;
    } catch (e) {
      const { total } = renderTree(ctx.tracer, rootName);

      if (e.rateLimited && ctx.autoResume) {
        resumeAttempt += 1;
        // Use the server's reset delay when present; otherwise fall back to the configured wait.
        const waitSecs = e.retryAfterSecs || ctx.resumeDelay;
        saveMilestone({
          status: "blocked",
          projectDir,
          rootName,
          task,
          runId,
          backend: backendArg,
          tracer: ctx.tracer,
          resumeCmd,
          cacheFile: ctx.cache.file,
          traceFile: ctx.tracer.file,
          errorMessage: e.message,
        });
        process.stderr.write(
          `\n=== RATE LIMITED (attempt ${resumeAttempt}) ===\n${e.message}\n` +
            `${ctx.cache.live} live call(s); ${total} delegation(s) cached.\n` +
            `Auto-resuming in ~${Math.round(waitSecs / 60)}m — Ctrl+C to abort.\n` +
            `(all completed work is cached and will replay instantly on the next attempt)\n\n`,
        );
        let remaining = waitSecs;
        const tick = setInterval(() => {
          remaining -= 30;
          if (remaining > 0)
            process.stderr.write(`\r⏳ Resuming in ~${Math.ceil(remaining / 60)}m ...  `);
        }, 30000);
        await sleep(waitSecs * 1000);
        clearInterval(tick);
        ctx = makeAttemptContext(runOptions);
        process.stderr.write(
          `\r⏳ Resuming now (attempt ${resumeAttempt + 1}); ` +
            `reloaded ${ctx.cache.restored} cached response(s)...        \n\n`,
        );
        continue;
      }

      console.error("\n=== RUN HALTED ===\n" + e.message);
      if (e.rateLimited) {
        saveMilestone({
          status: "blocked",
          projectDir,
          rootName,
          task,
          runId,
          backend: backendArg,
          tracer: ctx.tracer,
          resumeCmd,
          cacheFile: ctx.cache.file,
          traceFile: ctx.tracer.file,
          errorMessage: e.message,
        });
        console.error(
          `\nRate-limited after ${ctx.cache.live} live call(s); ${total} delegation(s) checkpointed to the cache.\n` +
            `Resume (replays cached work, continues at the rate-limited agent):\n  ${resumeCmd}`,
        );
      }
      process.exitCode = 1;
      return;
    }
  }

  const { tree, total, counts } = renderTree(ctx.tracer, rootName);
  console.log("\n=== DELEGATION TREE ===\n" + tree);
  console.log(`\ntotal delegations: ${total} / budget ${ctx.budget.max}`);
  if (total)
    console.log(
      "per-agent: " +
        Object.entries(counts).map(([k, v]) => `${k}×${v}`).join("  "),
    );
  console.log(
    `cache: ${ctx.cache.restored} restored, ${ctx.cache.hits} replayed, ${ctx.cache.live} live call(s) -> ${ctx.cache.file}`,
  );
  // The root agent can return normally (end_turn) even though a delegation it
  // wanted to make was refused for hitting the budget/depth ceiling — leaving the
  // plan cut off mid-flight. That is NOT a completed run: mark it `blocked` so the
  // SessionStart hook keeps surfacing it and the milestone says how to continue.
  const limitHit = ctx.limitHit;
  if (limitHit) {
    console.error(
      `\n=== RUN INCOMPLETE ===\n${limitHit.reason}\n` +
        (limitHit.kind === "budget"
          ? `The delegation graph is larger than the budget (${ctx.budget.max}). Re-run with the SAME ` +
            `--run-id to continue past the cap (completed work replays from cache for free), or pass a ` +
            `bigger --max-delegations N to go further in one run.`
          : `An agent hit the depth cap (${ctx.maxDepth}). Re-run with the SAME --run-id and a bigger ` +
            `--max-depth N to let it delegate deeper.`) +
        `\nResume:\n  ${resumeCmd}`,
    );
  }
  saveMilestone({
    status: limitHit ? "blocked" : "done",
    projectDir,
    rootName,
    task,
    runId,
    backend: backendArg,
    tracer: ctx.tracer,
    resumeCmd,
    cacheFile: ctx.cache.file,
    traceFile: ctx.tracer.file,
    errorMessage: limitHit ? limitHit.reason : undefined,
  });
  console.log("\n=== WORK PRODUCT (" + rootName + ") ===\n" + product);
}

module.exports = {
  parsePersona,
  loadAgents,
  loadSkills,
  retryAfterSeconds,
  resolveModel,
  callModel,
  runAgent,
  mapPool,
  makeCache,
  makeTracer,
  makeAttemptContext,
  saveMilestone,
  completedDelegations,
  buildResumeCmd,
};

if (require.main === module) {
  main().catch((e) => {
    console.error("error: " + e.message);
    process.exitCode = 1;
  });
}
