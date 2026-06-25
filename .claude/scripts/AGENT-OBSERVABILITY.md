# Agent observability & resume

Two standalone Node scripts (no dependencies). Run them from the repo root.

## 1. `agent-trace.cjs` — how agents delegated to each other

Reconstructs the full who-delegated-to-whom tree (including nested agent→agent→agent
chains) from Claude Code session transcripts on disk. Works on **any past or current
session** — nothing needs to be running, no instrumentation is required.

```powershell
# list sessions (newest first), with subagent counts + first message
node .claude/scripts/agent-trace.cjs sessions --limit 20

# render the delegation tree + timeline + per-agent counts for a session
node .claude/scripts/agent-trace.cjs trace --session latest
node .claude/scripts/agent-trace.cjs trace --session 3f048fe7        # id or prefix

# also write a structured JSONL event log you can grep/analyze
node .claude/scripts/agent-trace.cjs trace --session latest --json
#   -> .claude/logs/trace-<session>.jsonl   {ts,session,event,from,to,depth,description,durationMs,prompt}

# show full spawn prompts (not truncated)
node .claude/scripts/agent-trace.cjs trace --session latest --full-prompts

# live view: re-renders whenever the running session spawns/finishes an agent
node .claude/scripts/agent-trace.cjs watch --session latest
```

The **TIMELINE** section also interleaves milestone save/resume markers (`◆`) pulled
from `.claude/logs/agent-activity.jsonl`, so a paused/resumed session shows up inline
with the delegations.

How it works: each subagent has `…/<session>/subagents/agent-<hash>.meta.json` whose
`toolUseId` points back to the exact `Agent` spawn call in its parent's transcript. The
script links those to rebuild the tree.

## 2. `milestone.cjs` — pause midway, resume later

Saves a durable "where to continue" point **inside the project**: a human-readable
`MILESTONE.md` plus a machine-readable `.agent-state/milestone.json`. On the next
session start a hook surfaces it automatically (see below).

```powershell
# save (rich content via stdin JSON — the LLM authors this on "pause")
'{ "title":"Wave J polish", "status":"paused", "goal":"...", "next":["step 1","step 2"] }' |
  node .claude/scripts/milestone.cjs save --project sandbox/my-app --stdin

# or quick save with flags ("||" separates list items)
node .claude/scripts/milestone.cjs save --project sandbox/my-app `
  --title "Wave J polish" --status paused `
  --next "Fix contrast||Lazy-load charts" --blockers "Need brand hex"

node .claude/scripts/milestone.cjs show   --project sandbox/my-app   # print it
node .claude/scripts/milestone.cjs list                              # all milestones
node .claude/scripts/milestone.cjs resume --project sandbox/my-app   # compact resume block
```

Fields: `title, status (in-progress|paused|blocked|done), goal, branch, next[],
completed[], blockers[], filesInFlight[], contextToLoad[], delegation, notes`.

Set `status: "done"` to stop a milestone from being surfaced on resume.

## Auto-resume hook

`.claude/settings.json` registers a `SessionStart` hook:

```json
{ "type": "command", "command": "node .claude/scripts/milestone.cjs resume --hook --quiet" }
```

At the start of every session it emits the most-recently-updated **open** milestone
(across all registered projects) as the Claude Code `hookSpecificOutput.additionalContext`
JSON envelope, so the text actually reaches the model's context (plain stdout is not
reliably injected). It is silent and exits 0 when there is no open milestone, so it never
disrupts a normal session. `--hook` selects the JSON envelope; without it, `resume` prints
human-readable text for terminal use.

Note: resume picks the latest open milestone across **all** projects regardless of which
directory you launched from — mark a milestone `status: "done"` so it stops surfacing.
`agent-trace` is scoped to the directory you run it from; if you run Claude from inside a
sub-project (e.g. `sandbox/app`), pass `--cwd <repo-root>` to trace the right session set.

## Files written

| Path | What |
|------|------|
| `<project>/MILESTONE.md` | human-readable resume doc (keep in the project) |
| `<project>/.agent-state/milestone.json` | machine-readable milestone |
| `<project>/.agent-state/milestone-history.jsonl` | archived previous milestones |
| `.claude/state/milestone-registry.json` | index of all projects with milestones |
| `.claude/logs/agent-activity.jsonl` | milestone save/resume events (read by agent-trace) |
| `.claude/logs/trace-<session>.jsonl` | structured delegation log (`--json`) |

Generated runtime data — `.claude/logs/` and `.claude/state/` can be git-ignored.
Keep `MILESTONE.md` in the project if you want the resume point versioned.
