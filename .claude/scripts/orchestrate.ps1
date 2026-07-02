<#
  orchestrate.ps1 — wrapper for orchestrate.cjs that makes outbound model
  calls traverse the corporate egress proxy and trust the company CA.

  Node's fetch ignores the system proxy, so a bare `node orchestrate.cjs`
  cannot reach api.anthropic.com on this network. This sets the proxy + CA the
  way Claude Code itself routes, then forwards all args to orchestrate.cjs.

  Usage:
    powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/orchestrate.ps1 --probe --backend claude-code
    powershell -NoProfile -ExecutionPolicy Bypass -File .claude/scripts/orchestrate.ps1 --agent cs-engineering-lead --task "..."

  Override the proxy with $env:ORCH_HTTPS_PROXY before calling.
#>
param([Parameter(ValueFromRemainingArguments = $true)] $Rest)

if (-not $env:ORCH_HTTPS_PROXY) { $env:ORCH_HTTPS_PROXY = "http://127.0.0.1:9000" }
$env:HTTPS_PROXY = $env:ORCH_HTTPS_PROXY
$env:HTTP_PROXY = $env:ORCH_HTTPS_PROXY
$env:NO_PROXY = "127.0.0.1,localhost"   # keep the deeprouter proxy backend direct
$env:NODE_USE_ENV_PROXY = "1"           # Node 24: make fetch honor *_PROXY

# --use-system-ca trusts the corporate MITM proxy's certificate.
& node --use-system-ca "$PSScriptRoot\orchestrate.cjs" @Rest
exit $LASTEXITCODE
