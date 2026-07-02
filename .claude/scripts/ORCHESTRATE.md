# orchestrate.cjs — code-guaranteed agent delegation (Option B1)

Drives `agent → subagent → sub-subagent` delegation through a **code-backed
`delegate` tool** instead of the model-discretionary `Agent` tool. The model
still *decides* whether/whom to delegate to (delegation "as before"), but every
spawn flows through `runAgent()` in code, so the call graph's **structure is
guaranteed**, not merely prompted.

What the code guarantees on every hop (none of these depend on the model obeying a prompt):

| Guarantee | Where |
|---|---|
| Only named project agents can be targets (whitelist) | `validateTarget()` |
| No runaway recursion | `--max-depth` (default 4) |
| Global ceiling on total delegations | `--max-delegations` (default 24) |
| No cycles — can't delegate back into an ancestor | ancestor chain in `runAgent()` |
| INTERACTIVE personas refused as autonomous targets | `forkSafe` flag |
| Same-turn delegations run concurrently, bounded by `--max-parallel` | `mapPool()` |
| File/edit/search tools sandboxed to the project dir; `run_command` cwd-locked + timed out | `runLocalTool()` |
| Every hop traced | `<project>/.agent-state/orchestrate-<runid>.jsonl` |

**Who can delegate:** an agent gets the `delegate` tool iff its frontmatter
`tools:` includes `Agent` — today: `cs-engineering-lead`, `cs-planning-lead`,
`cs-brainstorm-research-lead`, `cs-fullstack-engineer`. The other 28 are leaf
workers. Multi-level works because `cs-fullstack-engineer` is both a worker and a
delegator (lead → fullstack → fullstack's children), to any depth your cap allows.

## Parallel teammates (Agent Teams-style)

Claude Code's [Agent Teams](https://code.claude.com/docs/en/agent-teams)
(`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) is a feature of the **interactive CLI
harness** — teammates are full Claude Code sessions with a shared task list and
mailbox. There is no Messages-API surface for it, and this script talks to
`/v1/messages` directly, so it can't call Agent Teams itself. Instead the
orchestrator adopts the Agent Teams **execution model**:

- When a lead issues **several `delegate` calls in one turn**, that wave of
  teammates runs **concurrently** through a bounded worker pool
  (`--max-parallel`, default `4`; `ORCH_MAX_PARALLEL`). `--no-parallel` (or
  `--max-parallel 1`) restores strict one-at-a-time execution.
- Every guarantee is charged **before** the wave launches, synchronously and in
  tool_use order: whitelist, depth cap, cycle check, and the delegation budget
  behave identically in parallel and sequential runs.
- Results return to the lead in tool_use order regardless of finish order.
- **Rate limits under parallelism:** the wave is allowed to settle first; then
  the rate-limit error propagates and the run halts/checkpoints as usual.
  Teammates that finished are already in the cache, so a resume replays them
  free and re-runs only the one that died — same recovery contract as before.
- One teammate's ordinary failure degrades to a `delegated agent … failed`
  result for the lead to work around; it does not abort its siblings.
- `ask_user` is serialized through a mutex — parallel teammates can't fight
  over the terminal; prompts queue one at a time.

Regression-locked by `orchestrate.parallel.test.cjs` (offline, zero-spend):
`node .claude/scripts/orchestrate.parallel.test.cjs`.

## Skills — agents load them visibly (`use_skill`)

Any persona whose frontmatter `tools:` includes `Skill` gets a `use_skill` tool
listing every repo skill (`.claude/skills/<name>/SKILL.md`). Calling it returns
the skill's full instructions as the tool result (body capped by
`--skill-max-chars`, default `12000`; `ORCH_SKILL_MAX_CHARS`). Each load is:

- printed live in the transcript as `⚡ use_skill <name>`, and
- logged as a `skill` event in the run's trace JSONL — so you can audit which
  skills each agent actually used, per run.

## Resume after a rate limit (or any halt)

A run is **checkpointed at every delegation**. Each model response is cached,
keyed by a hash of its request, and appended to
`<project>/.agent-state/orchestrate-<run-id>.cache.jsonl` as it completes. Because
the delegation loop is a pure function of model responses, **re-running with the
same `--run-id` replays the completed work from that cache — instantly, with no API
spend — and makes its first live call at exactly the point that failed** (the agent
that got rate-limited). That is "continue with the code structure."

- On a 429/5xx, `callModel` first retries with backoff (`--max-retries`, default 5;
  honors `Retry-After`). Only after retries are exhausted does the run halt.
- On halt, a rate-limit error **propagates** (it is no longer swallowed into a fake
  "delegated agent failed" result that would corrupt the parent), and the
  orchestrator writes a **milestone** into the project via `milestone.cjs`:
  `MILESTONE.md` + `.agent-state/milestone.json`, `status: blocked`, with **what is
  done** (completed delegations) and **what is next** (the exact resume command).
  The `SessionStart` hook surfaces it next session.
- On success it writes the same milestone with `status: done` so the hook stops
  surfacing it.
- **Budget-cap halt (not just rate limits).** If an agent still wants to delegate
  after the global `--max-delegations` ceiling is reached, that delegation is
  refused and the rest of the plan never runs. The root agent can still return
  normally, but the run is **incomplete** — so it now saves `status: blocked` (with
  a `RUN INCOMPLETE` notice + resume command), **not** a false `done`. Resume the
  same way: re-run with the same `--run-id`.
- **Replays don't re-charge the budget.** Completed delegations that replay from
  cache on resume do **not** count against `--max-delegations` — only genuinely-new
  (live) delegations do. This is what lets a resumed run advance *past* the cap
  instead of re-paying for finished work and stalling at the same wall forever. A
  large multi-team pipeline (research + planning + engineering) can exceed 24
  delegations; either resume once or twice to walk past the cap, or pass a bigger
  `--max-delegations N` (e.g. `60`) to finish in a single run.
- **Truncated work products bloat the graph.** Agent turns stop at `--max-tokens`
  (default `4000`); a planning/PRD product cut off there can make a lead re-delegate
  to fill the gap, inflating the delegation count. For heavy planning runs, raise
  `--max-tokens` (e.g. `8000`) so leads emit complete products the first time.
- **Upgrading the orchestrator invalidates old runs' caches.** Cache keys are
  hashes of the full request body, so any change to the system preambles or tool
  schemas (e.g. the parallel-teammates + `use_skill` upgrade) means requests from
  runs started BEFORE the change no longer match — a "resume" of such a run
  replays nothing and re-executes everything live, while appending to the old
  run's trace/cache files. For work started before an orchestrator change, start
  a **fresh `--run-id`** (you can point `--task-file` at the old run's
  `.agent-state/orchestrate-<old-id>.task.txt`). Resume only pays off for runs
  started on the current orchestrator version.

### Option A — Manual resume

Run the **exact same command** with the **same `--run-id`**. Completed delegations
replay from cache instantly (no re-spend); the rate-limited agent runs live.

```powershell
# first run — saves progress into the project as it goes
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task-file spec.md `
  --project sandbox/my-app --run-id my-app-001 --backend claude-code

# got rate-limited? resume — SAME command, SAME --run-id
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task-file spec.md `
  --project sandbox/my-app --run-id my-app-001 --backend claude-code
```

The task is snapshotted to `.agent-state/orchestrate-<run-id>.task.txt` on first run,
so on resume you can use `--task-file` pointing at that path instead of re-typing the task.

### Option B — Automatic continuation (fire-and-forget)

Add `--auto-resume` to the command and walk away. On a credit-limit 429 the orchestrator
**waits** for the reset window, then retries automatically — no manual re-run needed.
All completed delegations are cached; the wait costs nothing and the next attempt replays
them instantly.

```powershell
# run once and leave it — it will wait out any rate limit and continue on its own
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task-file spec.md `
  --project sandbox/my-app --run-id my-app-001 --backend claude-code --auto-resume
```

| Flag | Default | Meaning |
|---|---|---|
| `--auto-resume` | off | enable automatic wait-and-retry on rate-limit |
| `--resume-delay N` | `3600` | seconds to wait before retrying (1 h = Claude Code Pro/Max hourly reset) |
| `ORCH_RESUME_DELAY` | `3600` | env var equivalent of `--resume-delay` |

- The server's `Retry-After` header is used when present; otherwise `--resume-delay` is used.
- `Retry-After` can be either seconds or an HTTP-date reset time; both are parsed.
- Each retry builds a fresh attempt context with the same `--run-id`, reloads the cache from
  `.agent-state`, and resets in-memory counters. This makes auto-resume behave like manually
  running the saved resume command after the limit resets.
- A countdown prints to stderr every 30 seconds so you can see progress if you check in.
- Press **Ctrl+C** at any time to abort the wait and exit cleanly.
- The milestone is saved as `blocked` on each rate-limit hit and updated to `done` when the
  run finally completes, so the SessionStart hook in the next Claude Code session knows the
  correct state.

`--project` defaults to the cwd; pass `sandbox/<name>` so progress lives inside the
project. The task is snapshotted to `.agent-state/orchestrate-<run-id>.task.txt`, so
the milestone's resume command can use `--task-file` even for long tasks.

## Watch the agents talk (live transcript)

By default the run **prints each agent's turn to the terminal as it happens** —
the assistant's text, plus a line for every `delegate → <agent>`, `? ask_user`,
and `⚡ use_skill <name>` call — the way the Claude CLI shows the assistant
talking. Turns are indented by delegation depth so you can see the tree form in
real time, and **each agent keeps one stable color for the whole run** so
interleaved parallel turns stay attributable at a glance. Team activity gets its
own status lines:

- `⫸ team: 3 teammates (up to 3 in parallel) — a, b, c` when a wave launches
- `✓ <agent> returned` as each teammate finishes (in real finish order)

Turns are written atomically (one write per turn), so parallel teammates never
garble each other's output mid-line.

- The transcript goes to **stderr**; the final `=== WORK PRODUCT ===` still goes to
  **stdout**, so piping the product to a file keeps it clean:
  `node ... > product.txt` shows the chat on screen and saves only the result.
- Colors appear on a real terminal; they're dropped when output is piped or when
  `NO_COLOR` is set.
- On **resume**, replayed turns are reprinted instantly and marked `[cached]`; the
  first live (non-`[cached]`) turn is where the run actually continues.
- Add `--quiet` to suppress the transcript entirely (e.g. for CI logs).

```powershell
# see the agents chatting live (default)
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task-file spec.md `
  --project sandbox/my-app --run-id my-app-001 --backend claude-code

# hide it
node .claude/scripts/orchestrate.cjs ... --quiet
```

## Local toolset — every persona frontmatter tool is honored

The raw Messages API has no built-in tools, so each Claude Code tool a persona
declares in its frontmatter `tools:` is implemented in the orchestrator and
granted only to personas that declare it — this is what makes a run produce an
actual `src/` (and run builds, and research the web) instead of only logs:

| Persona declares | Orchestrator tool | Does |
|---|---|---|
| `Agent` | `delegate` | whitelisted, budgeted, parallel delegation |
| `Skill` | `use_skill` | loads a repo skill's SKILL.md |
| `Write` | `write_file` | writes a complete file inside the project dir (parents created) |
| `Read` | `read_file`, `list_files` | file content (capped `--file-max-chars`); bounded recursive listing |
| `Edit` | `edit_file` | exact-string replacement (unique match or `replace_all`) |
| `Grep` | `search_files` | regex content search → `path:line: text` (≤100 matches) |
| `Glob` | `find_files` | glob file finding (`*` `?` `**`; ≤200 files) |
| `Bash` | `run_command` | non-interactive shell in the project dir, killed after `--cmd-timeout` (default 120 s) |
| `WebFetch` | `web_fetch` | fetches a URL, HTML stripped to text (capped) |
| `WebSearch` | `web_search` | live web search (DuckDuckGo HTML), top results |

- **Sandbox:** file/edit/search/glob paths resolve against `--project`; escaping
  it is refused (`is_error` + `fs_refused` trace event), as are writes/edits into
  `.agent-state`. `run_command` is cwd-locked to the project and time-limited but
  is REAL shell access — that is the trade-off of letting agents build; disable
  with `--no-effects` if a run shouldn't touch the system.
- **Transcript:** `✎ write_file src/index.ts (1.2 KB)`, `± edit_file …`,
  `⇠ read_file …`, `☰ list_files …`, `⌕ search_files/find_files …`,
  `$ run_command npm install`, `⇣ web_fetch …`, `⌕ web_search …`.
- **Trace events:** `write {path, bytes}`, `edit {path, replaced}`, `read`,
  `list`, `search`, `glob`, `command {command}` + `command_result {exit}`,
  `web_fetch {url}`, `web_search {query}`, `fs_refused` — audit exactly which
  agent did what.
- **Replay semantics:** file writes re-execute during cache replay, so resuming
  a run rebuilds its files free. Web results are **cached in the run cache**
  (`web:` keys) and replay without refetching. `run_command` output is NOT
  cached — on replay commands re-execute, and if output diverges (or a re-run
  `edit_file` no longer matches) the run naturally continues live from that
  point instead of replaying stale state.
- Kill switch: `--no-effects` disables ALL local tools (text-only agents).
- For implementation runs raise the bounds so whole files fit per turn:
  `--max-tokens 8000` (or more) and `--max-turns 16` are sensible.

Regression-locked by `orchestrate.effects.test.cjs` (file sandbox + replay
rebuild) and `orchestrate.tools.test.cjs` (edit/search/glob/command/web).

## Altitude — read this

This guarantees and traces the **delegation graph**, and gives agents the full
local toolset above. File tools are sandboxed to the project dir; `run_command`
is real (cwd-locked, timed) shell access enabled because your personas declare
`Bash` — run untrusted or exploratory orchestrations with `--no-effects`.

## The exact command (copy-paste)

On this machine Node's `fetch` can't reach `api.anthropic.com` directly — outbound
calls must traverse the corporate egress proxy with the company CA. **Always launch
through `orchestrate.ps1`** (it sets `HTTPS_PROXY`, `NODE_USE_ENV_PROXY`, and
`node --use-system-ca`, then forwards every arg). A bare `node orchestrate.cjs` will
fail with `fetch failed` on the `claude-code` backend.

```powershell
# 0) gate: confirm a real tool round-trip works BEFORE spending a run (fails fast, no cost)
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/orchestrate.ps1 --probe --backend claude-code

# 1) run it — interactive, saves progress into the project, uses your Claude Code subscription
powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/orchestrate.ps1 `
  --agent cs-engineering-lead `
  --task "I want to make an app that teaches kids good eating habits in a day. Expo Go, SDK 54, in sandbox/eat-food" `
  --project sandbox/eat-food `
  --run-id eat-food-003 `
  --backend claude-code
```

- **Parallel by default**: same-turn delegations run as a concurrent teammate wave
  (up to `--max-parallel`, default 4) — no extra flag needed. Throttle with
  `--max-parallel 2` if you're worried about rate limits (parallel teammates spend
  tokens faster in wall-clock terms), or force the old behavior with `--no-parallel`.
- **Interactive by default**: when the run needs a decision (e.g. the idea choice board),
  the *orchestrator itself* prints `❓ THE ORCHESTRATION NEEDS YOUR INPUT` and waits. Type
  the option **number** (or your own text) + **Enter** and it continues with your answer.
- The orchestrator won't over-ask: `ask_user` is capped by `--max-asks` (default 4).
  Tighten it with `--max-asks 2`, or turn prompts off entirely with `--no-interactive`
  (headless — agents decide autonomously; use for CI/piped runs).
- Each answer is cached in the run, so a resume replays it instead of re-asking.
- **Got rate-limited?** Re-run the *identical* command with the *same* `--run-id` — completed
  delegations replay from cache (no re-spend) and the first live call is exactly the one that
  failed. See "Resume after a rate limit" above. Add `--auto-resume` to wait-and-continue
  unattended.

> Fresh `--run-id` per new attempt of a *different* task. Reusing a `--run-id` means RESUME
> (it replays that run's cache). If a run's cache holds bad answers, use a new id.

## Usage (raw `node`, non-proxied networks only)

On a network with direct egress (or the deeprouter `proxy` backend on VPN) you can call
`orchestrate.cjs` directly — it inherits the proxy base-URL and credentials from the terminal
Claude Code uses (the proxy at `127.0.0.1:32187` must be up). Otherwise use `orchestrate.ps1`
as above.

```powershell
# list loadable agents + flags (no model calls)
node .claude/scripts/orchestrate.cjs --list

# validate the transport survives a 2-turn tool exchange BEFORE a real run
node .claude/scripts/orchestrate.cjs --probe
node .claude/scripts/orchestrate.cjs --probe --model <id>   # if defaults are wrong

# run an orchestration
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task "Build a login page"
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task-file spec.md

# bounds (all optional)
--max-depth N  --max-delegations N  --max-turns N  --max-tokens N  --max-asks N  --run-id <id>
--max-parallel N  --no-parallel  --skill-max-chars N  --no-effects  --file-max-chars N  --cmd-timeout N
```

`--probe` is the gate: the upstream proxy rewrites assistant **text** turns
(`normalizeAssistantHistory`), so the loop echoes assistant turns as
**tool_use-only** blocks to pass through untouched. `--probe` confirms a real
`tool_use → tool_result → continue` round-trip works before you spend a run on it.

## Config (env, all overridable)

| Env | Default | Meaning |
|---|---|---|
| `ORCH_BASE_URL` / `ANTHROPIC_BASE_URL` | `http://127.0.0.1:32187` | proxy endpoint |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` | — | auth header (`x-api-key` / `Bearer`) |
| `ORCH_MODEL` | — | force ONE model string for every agent |
| `ORCH_MODEL_OPUS` / `_SONNET` / `_HAIKU` | `claude-opus-4-8` / `claude-sonnet-4-6` / `claude-haiku-4-5` | alias → upstream model id |
| `ORCH_MAX_DEPTH` / `_MAX_DELEGATIONS` / `_MAX_TURNS` / `_MAX_TOKENS` | 4 / 24 / 8 / 4000 | default bounds |
| `ORCH_MAX_RETRIES` | 5 | model-call retries on 429/5xx before the run halts and checkpoints |
| `ORCH_MAX_PARALLEL` | 4 | concurrent teammates per delegation wave (1 = sequential) |
| `ORCH_SKILL_MAX_CHARS` | 12000 | cap on a SKILL.md body returned by `use_skill` |
| `ORCH_FILE_MAX_CHARS` | 24000 | cap on `read_file` / `run_command` / web results |
| `ORCH_CMD_TIMEOUT` | 120 | seconds before `run_command` is killed |

> Frontmatter models are bare aliases (`opus`/`sonnet`/`haiku`). If the upstream
> wants different strings, `--probe` will tell you (its error echoes the server
> response), then set the `ORCH_MODEL_*` overrides.

## Trace

Each run appends one JSONL event per line to
`<project>/.agent-state/orchestrate-<runid>.jsonl` — the same folder as that
run's `orchestrate-<runid>.cache.jsonl` and `orchestrate-<runid>.task.txt`, so
the whole run lives in one place. Each line is `{ts, runId, event, from, to,
depth, task}` where `event ∈ turn | delegate | result | refused | error |
team_wave | skill | write | read | list | edit | search | glob | command |
command_result | web_fetch | web_search | fs_refused | ask_user |
ask_user_answer`. `team_wave` records each parallel fan-out (`{agent, depth,
size, parallel, teammates}`); `skill` records each `use_skill` load; the local
tool events record file/command/web effects (`write` carries `{path, bytes}`,
`command_result` carries `{exit}`). A delegation tree + per-agent counts print
at the end of each run.

To re-render the delegation tree from a past run's log:

```powershell
node -e "require('fs').readFileSync('sandbox/eat-food/.agent-state/orchestrate-eat-food-004.jsonl','utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse).filter(o=>o.event==='delegate').forEach(o=>console.log('  '.repeat(o.depth)+o.from+' -> '+o.to))"
```

Note: this is the orchestrator's *own* trace. It is distinct from the post-hoc
`agent-trace.cjs`, which reconstructs Claude Code's native `Agent`/`Task` session
trees from `~/.claude/projects/**` — that tool reports **0 delegations** for an
orchestrator run, because B1 delegations happen inside `orchestrate.cjs` and never
touch Claude Code's `Agent` tool. Use this trace log for orchestrator runs.
