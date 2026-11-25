$ErrorActionPreference = 'Stop'

$toolsDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher   = Join-Path $toolsDir 'launch-proxy.cmd'
$oneClick   = Join-Path $toolsDir 'one-click-zh-proxy.cmd'
$selfHeal   = Join-Path $toolsDir 'self-heal-shortcuts.ps1'
$exe        = Join-Path $env:LOCALAPPDATA 'Programs\antigravity\Antigravity.exe'
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$vbsPath    = Join-Path $startupDir 'antigravity-self-heal.vbs'

$oneClickName = 'Antigravity-' + [char]0x4E00 + [char]0x952E + [char]0x6C49 + [char]0x5316 + [char]0x4FEE + [char]0x590D + '.lnk'
$desktopOneClick = Join-Path (Join-Path $env:USERPROFILE 'Desktop') $oneClickName
$startMenuLnk    = Join-Path (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs') 'Antigravity.lnk'

if (-not (Test-Path -LiteralPath $launcher)) { Write-Host ('[ERROR] launcher missing: ' + $launcher); exit 1 }
if (-not (Test-Path -LiteralPath $oneClick)) { Write-Host ('[ERROR] one-click script missing: ' + $oneClick); exit 1 }
if (-not (Test-Path -LiteralPath $exe))      { Write-Host ('[ERROR] Antigravity.exe missing: ' + $exe); exit 1 }

$sh = New-Object -ComObject WScript.Shell
$bad = 0

function Set-And-VerifyShortcut {
    param(
        [string]$ShortcutPath,
        [string]$ExpectedTarget,
        [int]$WindowStyle,
        [string]$Description
    )
    $parent = Split-Path -Parent $ShortcutPath
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    $s = $sh.CreateShortcut($ShortcutPath)
    $needsWrite = ($s.TargetPath -ne $ExpectedTarget) -or ($s.Arguments -and $s.Arguments.Trim() -ne '') -or ($s.WorkingDirectory -ne $toolsDir)
    if ($needsWrite) {
        $s.TargetPath       = $ExpectedTarget
        $s.Arguments        = ''
        $s.WorkingDirectory = $toolsDir
        $s.IconLocation     = $exe + ',0'
        $s.WindowStyle      = $WindowStyle
        $s.Description      = $Description
        $s.Save()
    }
    $rb = $sh.CreateShortcut($ShortcutPath)
    if ($rb.TargetPath -eq $ExpectedTarget -and (-not $rb.Arguments -or $rb.Arguments.Trim() -eq '')) {
        Write-Host ('[OK] ' + $ShortcutPath + ' -> ' + $ExpectedTarget)
        return $true
    } else {
        Write-Host ('[FAIL] ' + $ShortcutPath + ' -> ' + $rb.TargetPath)
        return $false
    }
}

if (-not (Set-And-VerifyShortcut -ShortcutPath $desktopOneClick -ExpectedTarget $oneClick -WindowStyle 1 -Description 'Antigravity One-Click Localization and Proxy Fix')) {
    $bad++
}
if (-not (Set-And-VerifyShortcut -ShortcutPath $startMenuLnk -ExpectedTarget $launcher -WindowStyle 7 -Description 'Antigravity (with proxy)')) {
    $bad++
}

$roots = @(
    (Join-Path $env:USERPROFILE 'Desktop'),
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar')
)

foreach ($r in $roots) {
    if (-not (Test-Path -LiteralPath $r)) { continue }
    $items = Get-ChildItem -LiteralPath $r -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'Antigravity' }
    foreach ($f in $items) {
        if ($f.FullName -eq $desktopOneClick -or $f.FullName -eq $startMenuLnk) { continue }
        if ($f.BaseName -eq 'Antigravity') {
            if (-not (Set-And-VerifyShortcut -ShortcutPath $f.FullName -ExpectedTarget $launcher -WindowStyle 7 -Description 'Antigravity (with proxy)')) {
                $bad++
            }
        }
    }
}

New-Item -ItemType Directory -Force -Path $startupDir | Out-Null
$vbsLines = @(
    "' Self-heal wrapper for Antigravity proxy and localization shortcuts.",
    "Dim sh, fso, script",
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'Set sh = CreateObject("WScript.Shell")',
    'script = "' + $selfHeal + '"',
    'If fso.FileExists(script) Then',
    '    sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & script & """", 0, False',
    'End If'
)
$vbsContent = ($vbsLines -join "`r`n") + "`r`n"
[System.IO.File]::WriteAllText($vbsPath, $vbsContent, [System.Text.Encoding]::ASCII)
Write-Host ('[OK] Startup self-heal installed: ' + $vbsPath)

if ($bad -gt 0) {
    Write-Host ('[ERROR] ' + $bad + ' shortcut(s) failed verification')
    exit 1
}
Write-Host '[OK] All shortcuts and self-heal startup verified.'
exit 0
