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
| Every hop traced | `.claude/logs/orchestrate-<runid>.jsonl` |

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

```powershell
# first run — saves progress into the project as it goes
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task-file spec.md `
  --project sandbox/my-app --run-id my-app-001 --backend claude-code

# got rate-limited? resume — SAME --run-id. Completed delegations replay from cache,
# the rate-limited agent runs live. (orchestrate.ps1 forwards these args unchanged.)
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task-file spec.md `
  --project sandbox/my-app --run-id my-app-001 --backend claude-code
```

`--project` defaults to the cwd; pass `sandbox/<name>` so progress lives inside the
project. The task is snapshotted to `.agent-state/orchestrate-<run-id>.task.txt`, so
the milestone's resume command can use `--task-file` even for long tasks.

## Altitude — read this

This guarantees and traces the **delegation graph**. Leaf workers return a **text
work product**; they do **not** yet get real file/bash effects. Wiring the full
tool runtime (Read/Write/Bash/…) into leaf agents is the marked **extension
point** in `buildTools()` + the tool-dispatch in `runAgent()`. It's deliberately
left out so this stays a delegation backbone, not an un-sandboxed runtime.

## Usage

Run in the **same terminal Claude Code uses** — it inherits the proxy base-URL
and credentials (this shell does not have them, and the proxy at
`127.0.0.1:32187` must be up).

```powershell
# list loadable agents + flags (no model calls)
node .claude/scripts/orchestrate.cjs --list

# validate the proxy survives a 2-turn tool exchange BEFORE a real run
node .claude/scripts/orchestrate.cjs --probe
node .claude/scripts/orchestrate.cjs --probe --model <id>   # if defaults are wrong

# run an orchestration
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task "Build a login page"
node .claude/scripts/orchestrate.cjs --agent cs-engineering-lead --task-file spec.md

# bounds (all optional)
--max-depth N  --max-delegations N  --max-turns N  --max-tokens N  --run-id <id>
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
`.claude/logs/orchestrate-<runid>.jsonl`: `{ts, runId, event, from, to, depth,
…}` where `event ∈ turn | delegate | result | refused | error`. A delegation
tree + per-agent counts print at the end of each run. (Pairs naturally with the
post-hoc `agent-trace.cjs`, which reconstructs Claude Code's own session trees.)
