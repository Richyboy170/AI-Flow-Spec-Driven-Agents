param(
    [int]$Port = 32187
)

$ErrorActionPreference = "Stop"
$healthUrl = "http://127.0.0.1:$Port/health"

function Test-CompanyProxy {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
        return $response.service -eq "company-llm-compat-proxy"
    }
    catch {
        return $false
    }
}

if (Test-CompanyProxy) {
    exit 0
}

$proxyScript = Join-Path $PSScriptRoot "company-llm-proxy.cjs"
$node = (Get-Command node -ErrorAction Stop).Source

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $node
$startInfo.Arguments = "--use-system-ca `"$proxyScript`" --port $Port"
$startInfo.UseShellExecute = $true
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
[System.Diagnostics.Process]::Start($startInfo) | Out-Null

for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 100
    if (Test-CompanyProxy) {
        exit 0
    }
}

throw "Company LLM compatibility proxy failed to start on port $Port."
