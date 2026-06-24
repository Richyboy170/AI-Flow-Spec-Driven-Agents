<#
  set-agent-models.ps1
  Global model selector for the agents in .claude/agents.

  There is no built-in Claude Code setting that forces every agent onto one
  model, because each agent's `model:` frontmatter overrides the main session
  model. This script rewrites that frontmatter across all agent files so you
  get a single switch.

  Usage (from the project root):
    powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/set-agent-models.ps1 -Mode opus
    powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/set-agent-models.ps1 -Mode sonnet
    powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/set-agent-models.ps1 -Mode haiku
    powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/set-agent-models.ps1 -Mode custom

  Modes:
    opus | sonnet | haiku  -> set EVERY agent to that model.
    custom                 -> leads = opus, every other agent = sonnet.

  Changes apply the next time each agent is spawned. The main conversation's
  model is separate; change it with /model or the "model" key in settings.json.
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('opus', 'sonnet', 'haiku', 'custom')]
    [string]$Mode
)

$ErrorActionPreference = 'Stop'

# Agents that stay on Opus in "custom" mode (the orchestrator leads).
$leads = 'cs-engineering-lead', 'cs-planning-lead', 'cs-brainstorm-research-lead'

$agentsDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'agents'
if (-not (Test-Path $agentsDir)) { throw "Agents directory not found: $agentsDir" }

$utf8 = New-Object System.Text.UTF8Encoding($false)   # no BOM

foreach ($f in Get-ChildItem $agentsDir -Recurse -Filter *.md) {
    $lines = [System.Collections.Generic.List[string]]([System.IO.File]::ReadAllLines($f.FullName))
    if ($lines.Count -lt 2 -or $lines[0].Trim() -ne '---') { continue }   # not a frontmatter file

    # locate the closing frontmatter fence
    $end = -1
    for ($i = 1; $i -lt $lines.Count; $i++) { if ($lines[$i].Trim() -eq '---') { $end = $i; break } }
    if ($end -lt 0) { continue }

    # find name and existing model lines inside the frontmatter
    $nameIdx = -1; $modelIdx = -1; $name = $null
    for ($i = 1; $i -lt $end; $i++) {
        if ($nameIdx -lt 0 -and $lines[$i] -match '^name:\s*(.+)$') { $nameIdx = $i; $name = $matches[1].Trim() }
        if ($modelIdx -lt 0 -and $lines[$i] -match '^model:') { $modelIdx = $i }
    }
    if ($nameIdx -lt 0) { continue }   # no name => not an agent definition

    if ($Mode -eq 'custom') {
        if ($leads -contains $name) { $target = 'opus' } else { $target = 'sonnet' }
    }
    else {
        $target = $Mode
    }

    $changed = $false
    if ($modelIdx -ge 0) {
        if ($lines[$modelIdx] -ne "model: $target") { $lines[$modelIdx] = "model: $target"; $changed = $true }
    }
    else {
        $lines.Insert($nameIdx + 1, "model: $target"); $changed = $true
    }

    if ($changed) {
        [System.IO.File]::WriteAllLines($f.FullName, $lines, $utf8)
        Write-Output ("CHANGED  {0,-28} -> {1}" -f $name, $target)
    }
    else {
        Write-Output ("ok       {0,-28} ({1})" -f $name, $target)
    }
}

Write-Output ""
Write-Output "Done. Mode = $Mode. New model applies on the next spawn of each agent."
