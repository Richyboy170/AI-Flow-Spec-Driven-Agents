# Orchestrator Architecture Graph

This graph shows how this repo's orchestration architecture connects. It is close to the Agent Teams idea in that the lead can fan out work to teammates in parallel, but this implementation keeps communication parent-mediated through `orchestrate.cjs`.

## High-Level Connection Graph

```mermaid
flowchart TD
    User["Human / Main Claude Code Session"] --> PS["orchestrate.ps1<br/>proxy + system CA wrapper"]
    PS --> CLI["orchestrate.cjs<br/>CLI entrypoint"]

    CLI --> Registry["AGENT_REGISTRY<br/>load .claude/agents/**"]
    CLI --> Skills["SKILL_REGISTRY<br/>load .claude/skills/**/SKILL.md"]
    CLI --> State["Project .agent-state<br/>task snapshot, trace, cache, milestone"]
    CLI --> Root["Root Agent<br/>example: cs-engineering-lead"]

    Root --> Tools["TOOL_SURFACE<br/>delegate, use_skill, ask_user,<br/>read_file, write_file, list_files"]

    Tools --> Guard["DELEGATION_GUARD<br/>whitelist, fork-safe,<br/>no cycles, depth, budget"]
    Guard --> Wave["TEAMMATE_WAVE<br/>same-turn delegates run<br/>with bounded parallelism"]

    Wave --> A["Teammate A<br/>own runAgent loop"]
    Wave --> B["Teammate B<br/>own runAgent loop"]
    Wave --> C["Teammate C<br/>own runAgent loop"]

    A --> ResultA["final text work product"]
    B --> ResultB["final text work product"]
    C --> ResultC["final text work product"]

    ResultA --> ToolResults["tool_result messages<br/>returned in original delegate order"]
    ResultB --> ToolResults
    ResultC --> ToolResults

    ToolResults --> Root
    Root --> Final["Root final work product<br/>printed at end of run"]

    Tools --> SkillTool["SKILL_TOOL<br/>returns SKILL.md content"]
    Tools --> Prompt["USER_PROMPT_LOCK<br/>serialized human prompts"]
    Tools --> Files["FILE_SANDBOX<br/>project-local read/write/list"]

    SkillTool --> Root
    Prompt --> Root
    Files --> ProjectFiles["Project files inside --project"]

    CLI --> Trace["TRACE_LOG<br/>orchestrate-&lt;run-id&gt;.jsonl"]
    CLI --> Cache["RESUME_CACHE<br/>orchestrate-&lt;run-id&gt;.cache.jsonl"]
    CLI --> Milestone["MILESTONE_HANDOFF<br/>MILESTONE.md + milestone.json"]

    Trace --> State
    Cache --> State
    Milestone --> State
```

## Delegation Lifecycle

```mermaid
sequenceDiagram
    participant Human as Human / Main Session
    participant Orch as orchestrate.cjs
    participant Lead as Parent Agent
    participant Guard as Delegation Guard
    participant Wave as Teammate Wave
    participant ChildA as Teammate A
    participant ChildB as Teammate B
    participant State as .agent-state

    Human->>Orch: Run --agent + --task / --task-file
    Orch->>State: Save task snapshot, create trace/cache
    Orch->>Lead: Start root runAgent conversation

    Lead->>Orch: tool_use delegate(A), delegate(B)
    Orch->>Guard: Validate target agents and budget
    Guard-->>Orch: Approved

    Orch->>Wave: Launch same-turn delegates
    par bounded parallel execution
        Wave->>ChildA: runAgent(task A)
        Wave->>ChildB: runAgent(task B)
    end

    ChildA-->>Wave: Final text work product
    ChildB-->>Wave: Final text work product
    Wave-->>Orch: Settled results

    Orch->>State: Log result events and cache completed turns
    Orch->>Lead: tool_result(A text), tool_result(B text)
    Lead-->>Orch: Synthesis, more tool calls, or final text
    Orch-->>Human: === WORK PRODUCT (root agent) ===
```

## Communication Model

```mermaid
flowchart LR
    subgraph NativeAgentTeams["Native Agent Teams Concept"]
        NLead["Team Lead"] --> NTask["Shared Task List"]
        NTask <--> N1["Teammate 1"]
        NTask <--> N2["Teammate 2"]
        N1 <-. "peer messages" .-> N2
    end

    subgraph OurRunner["This Repo: orchestrate.cjs"]
        OLead["Parent Agent"] --> OOrch["orchestrate.cjs"]
        OOrch --> O1["Teammate 1"]
        OOrch --> O2["Teammate 2"]
        O1 --> OResult1["text result"]
        O2 --> OResult2["text result"]
        OResult1 --> OOrch
        OResult2 --> OOrch
        OOrch --> OLead
        OOrch --> OState["trace/cache/milestone"]
    end

    NativeAgentTeams -. "same idea: team lead + teammates" .-> OurRunner
```

## Presenter Summary

- The root agent acts like the team lead.
- The lead asks for delegation through `delegate`; the code validates it before launching anything.
- Multiple delegates in the same turn become a parallel teammate wave.
- Teammates do not talk directly to each other in this runner.
- Each teammate returns a final text work product to the orchestrator.
- The orchestrator sends those results back to the parent as `tool_result` messages.
- Durable state lives in `.agent-state`: trace, cache, task snapshot, and milestone.
- Project file writes are sandboxed inside `--project`.

## How To Verify The Graph From Logs

After an orchestrated run, render the trace into Markdown:

```powershell
node .claude/scripts/orchestrate-log-viewer.cjs `
  --project sandbox/my-app `
  --run-id my-app-001 `
  --out sandbox/my-app/.agent-state/orchestrate-my-app-001.report.md
```

Use the report to verify:

- `Delegation Edges` proves which parent delegated to which teammate.
- `Team Waves` proves which teammates were launched together.
- `Returned Results` shows the child final work product sent back to the parent.
- `Chronological Agent Turns` shows each saved agent text snippet and tool call.

The important interpretation rule is that `result` is not peer-to-peer chat. It is the child agent's final text work product returned to `orchestrate.cjs`, then injected back into the parent conversation as `tool_result.content`.
