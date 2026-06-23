[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "../.."))
$resolvedImagePath = [System.IO.Path]::GetFullPath((Join-Path ([Environment]::CurrentDirectory) $ImagePath))
$rootPrefix = $projectRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (-not $resolvedImagePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "ImagePath must remain inside the project workspace."
}

$result = [ordered]@{
    width = $null
    height = $null
    dominantColors = @()
    analysisStatus = "unsupported-media-type"
}

try {
    Add-Type -AssemblyName System.Drawing
    $image = [System.Drawing.Image]::FromFile($resolvedImagePath)
    try {
        $result.width = $image.Width
        $result.height = $image.Height
        if ([int64]$image.Width * [int64]$image.Height -gt 100000000) {
            $result.analysisStatus = "dimensions-too-large"
        } else {
            $sample = New-Object System.Drawing.Bitmap 64, 64
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($sample)
                try {
                    $graphics.DrawImage($image, 0, 0, 64, 64)
                } finally {
                    $graphics.Dispose()
                }

                $buckets = @{}
                for ($y = 0; $y -lt 64; $y++) {
                    for ($x = 0; $x -lt 64; $x++) {
                        $color = $sample.GetPixel($x, $y)
                        if ($color.A -lt 128) { continue }
                        $r = [Math]::Min(255, [Math]::Floor($color.R / 32) * 32 + 16)
                        $g = [Math]::Min(255, [Math]::Floor($color.G / 32) * 32 + 16)
                        $b = [Math]::Min(255, [Math]::Floor($color.B / 32) * 32 + 16)
                        $key = "#{0:X2}{1:X2}{2:X2}" -f $r, $g, $b
                        if ($buckets.ContainsKey($key)) { $buckets[$key]++ } else { $buckets[$key] = 1 }
                    }
                }
                $result.dominantColors = @($buckets.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 6 | ForEach-Object { $_.Key })
                $result.analysisStatus = "complete"
            } finally {
                $sample.Dispose()
            }
        }
    } finally {
        $image.Dispose()
    }
} catch {
    $result.analysisStatus = "decode-failed: $($_.Exception.Message)"
}

$sidecarPath = "$resolvedImagePath.json"
if (Test-Path -LiteralPath $sidecarPath) {
    $record = Get-Content -Raw -LiteralPath $sidecarPath | ConvertFrom-Json
    $record.width = $result.width
    $record.height = $result.height
    $record.dominantColors = @($result.dominantColors)
    $record.analysisStatus = $result.analysisStatus
    $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $sidecarPath -Encoding UTF8

    $manifestPath = Join-Path ([System.IO.Path]::GetDirectoryName($resolvedImagePath)) "visual-manifest.json"
    if (Test-Path -LiteralPath $manifestPath) {
        $parsedManifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
        $manifest = @($parsedManifest | ForEach-Object { $_ })
        foreach ($item in $manifest) {
            if ($item.localPath -eq $record.localPath) {
                $item.width = $result.width
                $item.height = $result.height
                $item.dominantColors = @($result.dominantColors)
                $item.analysisStatus = $result.analysisStatus
            }
        }
        ConvertTo-Json -InputObject $manifest -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    }
}

[pscustomobject]$result | ConvertTo-Json -Compress
