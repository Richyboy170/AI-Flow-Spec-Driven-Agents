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
| Every hop traced | `<project>/.agent-state/orchestrate-<runid>.jsonl` |

**Who can delegate:** an agent gets the `delegate` tool iff its frontmatter
`tools:` includes `Agent` — today: `cs-engineering-lead`, `cs-planning-lead`,
`cs-brainstorm-research-lead`, `cs-fullstack-engineer`. The other 28 are leaf
workers. Multi-level works because `cs-fullstack-engineer` is both a worker and a
delegator (lead → fullstack → fullstack's children), to any depth your cap allows.

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

- The server's `Retry-After` header is used when it signals a wait longer than 2 minutes.
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
the assistant's text, plus a line for every `delegate → <agent>` and `? ask_user`
call — the way the Claude CLI shows the assistant talking. Turns are indented by
delegation depth so you can see the tree form in real time.

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

## Altitude — read this

This guarantees and traces the **delegation graph**. Leaf workers return a **text
work product**; they do **not** yet get real file/bash effects. Wiring the full
tool runtime (Read/Write/Bash/…) into leaf agents is the marked **extension
point** in `buildTools()` + the tool-dispatch in `runAgent()`. It's deliberately
left out so this stays a delegation backbone, not an un-sandboxed runtime.

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

> Frontmatter models are bare aliases (`opus`/`sonnet`/`haiku`). If the upstream
> wants different strings, `--probe` will tell you (its error echoes the server
> response), then set the `ORCH_MODEL_*` overrides.

## Trace

Each run appends one JSONL event per line to
`<project>/.agent-state/orchestrate-<runid>.jsonl` — the same folder as that
run's `orchestrate-<runid>.cache.jsonl` and `orchestrate-<runid>.task.txt`, so
the whole run lives in one place. Each line is `{ts, runId, event, from, to,
depth, task}` where `event ∈ turn | delegate | result | refused | error`. A
delegation tree + per-agent counts print at the end of each run.

To re-render the delegation tree from a past run's log:

```powershell
node -e "require('fs').readFileSync('sandbox/eat-food/.agent-state/orchestrate-eat-food-004.jsonl','utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse).filter(o=>o.event==='delegate').forEach(o=>console.log('  '.repeat(o.depth)+o.from+' -> '+o.to))"
```

Note: this is the orchestrator's *own* trace. It is distinct from the post-hoc
`agent-trace.cjs`, which reconstructs Claude Code's native `Agent`/`Task` session
trees from `~/.claude/projects/**` — that tool reports **0 delegations** for an
orchestrator run, because B1 delegations happen inside `orchestrate.cjs` and never
touch Claude Code's `Agent` tool. Use this trace log for orchestrator runs.
