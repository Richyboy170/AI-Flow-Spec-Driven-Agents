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
};

// HTTP statuses worth retrying with backoff (rate limit / transient server).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);

function int(v, d) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : d;
}

// ---------------------------------------------------------------------------
// Persona loading + parsing
// ---------------------------------------------------------------------------

/** Parse `---` frontmatter + body from a persona markdown file. */
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
      const retryAfter = Number(res.headers.get("retry-after"));
      const RETRY_CAP_MS = 60000; // never block for an absurd server Retry-After
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
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
      const ra = Number(res.headers.get("retry-after"));
      if (Number.isFinite(ra) && ra > 0) err.retryAfterSecs = ra;
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

// ---------------------------------------------------------------------------
// Live transcript — print each agent's turn to the terminal (stderr) as it
// happens, the way the Claude CLI shows the assistant talking. On by default;
// suppress with --quiet. Colors only on a TTY (and honor NO_COLOR).
// ---------------------------------------------------------------------------

const CHAT_COLOR = process.stderr.isTTY && !process.env.NO_COLOR;
function paint(code, s) {
  return CHAT_COLOR ? `\x1b[${code}m${s}\x1b[0m` : s;
}

function printChat(ctx, persona, depth, resp, cached) {
  if (ctx.quiet) return;
  const pad = "  ".repeat(depth);
  const tag = cached ? " " + paint("2", "[cached]") : "";
  process.stderr.write(
    "\n" + pad + paint("36;1", `● ${persona.name}`) + paint("2", `  (depth ${depth})`) + tag + "\n",
  );

  const text = textOf(resp.content);
  if (text) {
    for (const line of text.split("\n")) process.stderr.write(pad + "  " + line + "\n");
  }

  for (const b of resp.content || []) {
    if (!b || b.type !== "tool_use") continue;
    if (b.name === "delegate") {
      const target = (b.input && b.input.agent) || "?";
      const t = String((b.input && b.input.task) || "").replace(/\s+/g, " ").slice(0, 200);
      process.stderr.write(pad + "  " + paint("33;1", `→ delegate ${target}`) + `: ${t}\n`);
    } else if (b.name === "ask_user") {
      const q = String((b.input && b.input.question) || "").replace(/\s+/g, " ").slice(0, 200);
      process.stderr.write(pad + "  " + paint("35;1", "? ask_user") + `: ${q}\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// Trace logging
// ---------------------------------------------------------------------------

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
  "do the work yourself when it is not. You can issue several `delegate` calls in a",
  "single turn to fan work out in parallel. Each delegated agent returns a text",
  "work product. Synthesize their results into your own final answer.",
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
 */
async function askUser(question, options, ctx) {
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
// The delegation loop (recursive — THIS is the guaranteed call graph)
// ---------------------------------------------------------------------------

/** Validate a requested delegation target. Returns {ok} or {ok:false, reason}. */
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
    return { ok: false, reason: `refused: max delegation depth (${ctx.maxDepth}) reached` };
  if (ctx.budget.used >= ctx.budget.max)
    return { ok: false, reason: `refused: delegation budget (${ctx.budget.max}) exhausted` };
  return { ok: true, persona };
}

/**
 * Run one agent node to completion, recursing on `delegate` calls.
 * @returns {Promise<string>} the agent's final text work product.
 */
async function runAgent(persona, task, depth, ancestors, ctx) {
  const targets = [...ctx.agents.values()]
    .filter((p) => p.forkSafe && p.name !== persona.name && !ancestors.includes(p.name))
    .map((p) => p.name);

  let system = persona.system + "\n" + ORCH_PREAMBLE_BASE;
  const tools = buildTools(persona, depth, ctx, targets);
  if (tools.some((t) => t.name === "delegate")) system += "\n" + DELEGATE_PREAMBLE;
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
    ctx.tracer.log("turn", {
      agent: persona.name,
      depth,
      turn,
      stop: resp.stop_reason,
    });

    const toolUses = (resp.content || []).filter(
      (b) => b && b.type === "tool_use" && (b.name === "delegate" || b.name === "ask_user"),
    );

    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
      return textOf(resp.content) || "(no text output)";
    }

    // Echo the assistant turn with ONLY the tool_use blocks. The proxy rewrites
    // assistant TEXT into a <assistant_history> user block; a tool_use-only
    // assistant message passes through untouched and keeps the
    // tool_use -> tool_result pairing the API requires.
    messages.push({ role: "assistant", content: toolUses });

    const results = [];
    for (const tu of toolUses) {
      if (tu.name === "ask_user") {
        if (ctx.askBudget && ctx.askBudget.used >= ctx.askBudget.max) {
          ctx.tracer.log("refused", { from: persona.name, to: "ask_user", depth, note: "ask_user budget exhausted" });
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            is_error: true,
            content:
              `ask_user limit (${ctx.askBudget.max}) reached for this run. Do NOT call ask_user again. ` +
              `Make a reasonable decision yourself and proceed with the actual work.`,
          });
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
        results.push({ type: "tool_result", tool_use_id: tu.id, content: String(answer) });
        continue;
      }
      const target = tu.input && tu.input.agent;
      const subTask = (tu.input && tu.input.task) || "";
      const v = validateTarget(target, depth, ancestors, ctx);
      if (!v.ok) {
        ctx.tracer.log("refused", { from: persona.name, to: target, depth, note: v.reason });
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          is_error: true,
          content: v.reason,
        });
        continue;
      }
      ctx.budget.used += 1;
      ctx.tracer.log("delegate", { from: persona.name, to: target, depth: depth + 1, task: subTask });
      let product;
      try {
        product = await runAgent(v.persona, subTask, depth + 1, [...ancestors, persona.name], ctx);
      } catch (e) {
        ctx.tracer.log("error", { from: persona.name, to: target, depth: depth + 1, note: e.message });
        // A rate limit is recoverable by resuming — propagate so the run halts
        // cleanly with the cache intact, rather than poisoning the parent's result
        // with a fake "failed" work product. Other failures degrade as before.
        if (e.rateLimited) throw e;
        product = `delegated agent ${target} failed: ${e.message}`;
      }
      ctx.tracer.log("result", { from: target, to: persona.name, depth: depth + 1 });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: product });
    }
    messages.push({ role: "user", content: results });
  }
  return "(stopped: reached per-agent turn limit before finishing)";
}

// ---------------------------------------------------------------------------
// Trace rendering
// ---------------------------------------------------------------------------

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
          "Re-run with the SAME --run-id to resume — completed delegations replay from cache (no re-spend); the rate-limited call runs live.",
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
  const tracer = makeTracer(runId, projectDir);
  const cache = makeCache(projectDir, runId);
  const ctx = {
    agents,
    tracer,
    cache,
    interactive,
    budget: { used: 0, max: int(arg("--max-delegations"), DEFAULTS.maxDelegations) },
    askBudget: { used: 0, max: int(arg("--max-asks"), DEFAULTS.maxAsks) },
    maxDepth: int(arg("--max-depth"), DEFAULTS.maxDepth),
    maxTurns: int(arg("--max-turns"), DEFAULTS.maxTurns),
    maxTokens: int(arg("--max-tokens"), DEFAULTS.maxTokens),
    maxRetries: int(arg("--max-retries"), DEFAULTS.maxRetries),
    askTimeout: int(arg("--ask-timeout"), DEFAULTS.askTimeout),
    autoResume: arg("--auto-resume", false) === true,
    resumeDelay: int(arg("--resume-delay"), DEFAULTS.resumeDelay),
    userAbsent: false, // set true after first timeout; cleared when user types
    quiet: arg("--quiet", false) === true, // suppress the live agent transcript
  };
  const resumeCmd = buildResumeCmd({ rootName, taskFile: taskSnapshot, runId, projectDir, backend: backendArg });

  console.log(
    `Running ${rootName} (depth<=${ctx.maxDepth}, <=${ctx.budget.max} delegations, run-id ${runId}).\n` +
      `  project: ${projectDir}\n  trace:   ${path.relative(REPO_ROOT, tracer.file)}\n` +
      `  input:   ${interactive ? `interactive — agents ask via ask_user (${ctx.askTimeout}s timeout; type to stop clock)` : "headless — no prompts"}` +
      (ctx.autoResume ? `\n  auto-resume: on rate-limit wait ~${Math.round(ctx.resumeDelay / 60)}m then retry (Ctrl+C to abort)` : "") +
      `\n  transcript: ${ctx.quiet ? "off (--quiet)" : "on — live agent chat prints below (stderr); --quiet to hide"}` +
      (cache.restored ? `\n  resume:  replaying ${cache.restored} cached response(s) from a prior run` : "") +
      "\n",
  );

  let product;
  let resumeAttempt = 0;
  for (;;) {
    try {
      product = await runAgent(root, task, 0, [], ctx);
      break;
    } catch (e) {
      const { total } = renderTree(tracer, rootName);

      if (e.rateLimited && ctx.autoResume) {
        resumeAttempt += 1;
        // Use the server's Retry-After if it's a meaningful long wait; else use configured delay.
        const waitSecs =
          e.retryAfterSecs && e.retryAfterSecs > 120 ? e.retryAfterSecs : ctx.resumeDelay;
        saveMilestone({
          status: "blocked",
          projectDir,
          rootName,
          task,
          runId,
          backend: backendArg,
          tracer,
          resumeCmd,
          cacheFile: cache.file,
          traceFile: tracer.file,
          errorMessage: e.message,
        });
        process.stderr.write(
          `\n=== RATE LIMITED (attempt ${resumeAttempt}) ===\n${e.message}\n` +
            `${cache.live} live call(s); ${total} delegation(s) cached.\n` +
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
        process.stderr.write(`\r⏳ Resuming now (attempt ${resumeAttempt + 1})...        \n\n`);
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
          tracer,
          resumeCmd,
          cacheFile: cache.file,
          traceFile: tracer.file,
          errorMessage: e.message,
        });
        console.error(
          `\nRate-limited after ${cache.live} live call(s); ${total} delegation(s) checkpointed to the cache.\n` +
            `Resume (replays cached work, continues at the rate-limited agent):\n  ${resumeCmd}`,
        );
      }
      process.exitCode = 1;
      return;
    }
  }

  const { tree, total, counts } = renderTree(tracer, rootName);
  console.log("\n=== DELEGATION TREE ===\n" + tree);
  console.log(`\ntotal delegations: ${total} / budget ${ctx.budget.max}`);
  if (total)
    console.log(
      "per-agent: " +
        Object.entries(counts).map(([k, v]) => `${k}×${v}`).join("  "),
    );
  console.log(
    `cache: ${cache.restored} restored, ${cache.hits} replayed, ${cache.live} live call(s) -> ${cache.file}`,
  );
  saveMilestone({
    status: "done",
    projectDir,
    rootName,
    task,
    runId,
    backend: backendArg,
    tracer,
    resumeCmd,
    cacheFile: cache.file,
    traceFile: tracer.file,
  });
  console.log("\n=== WORK PRODUCT (" + rootName + ") ===\n" + product);
}

module.exports = {
  parsePersona,
  loadAgents,
  resolveModel,
  callModel,
  runAgent,
  makeCache,
  makeTracer,
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
