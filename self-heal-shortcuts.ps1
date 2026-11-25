$ErrorActionPreference = 'Continue'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $toolsDir 'launch-proxy.cmd'
$oneClick = Join-Path $toolsDir 'one-click-zh-proxy.cmd'
$exe      = Join-Path $env:LOCALAPPDATA 'Programs\antigravity\Antigravity.exe'

if (-not (Test-Path -LiteralPath $launcher) -or -not (Test-Path -LiteralPath $oneClick)) {
    exit 1
}

$oneClickName = 'Antigravity-' + [char]0x4E00 + [char]0x952E + [char]0x6C49 + [char]0x5316 + [char]0x4FEE + [char]0x590D + '.lnk'

$targets = @(
    @{ Path = (Join-Path (Join-Path $env:USERPROFILE 'Desktop') $oneClickName); Target = $oneClick; Style = 1; Desc = 'Antigravity One-Click Localization and Proxy Fix' },
    @{ Path = (Join-Path $env:USERPROFILE 'Desktop\Antigravity.lnk'); Target = $launcher; Style = 7; Desc = 'Antigravity (with proxy)' },
    @{ Path = (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Antigravity.lnk'); Target = $launcher; Style = 7; Desc = 'Antigravity (with proxy)' },
    @{ Path = (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Antigravity.lnk'); Target = $launcher; Style = 7; Desc = 'Antigravity (with proxy)' }
)

$sh = New-Object -ComObject WScript.Shell
$fixed = 0
$failed = 0

foreach ($item in $targets) {
    $t = $item.Path
    if (-not (Test-Path -LiteralPath $t)) { continue }

    $current = $null
    $currentArgs = $null
    try {
        $cur = $sh.CreateShortcut($t)
        $current = $cur.TargetPath
        $currentArgs = $cur.Arguments
    } catch {
        $failed++
        continue
    }

    if ($current -eq $item.Target -and (-not $currentArgs -or $currentArgs.Trim() -eq '')) { continue }

    try {
        $s = $sh.CreateShortcut($t)
        $s.TargetPath       = $item.Target
        $s.Arguments        = ''
        $s.WorkingDirectory = $toolsDir
        if (Test-Path -LiteralPath $exe) { $s.IconLocation = $exe + ',0' }
        $s.WindowStyle      = $item.Style
        $s.Description      = $item.Desc
        $s.Save()
    } catch {
        # verified below
    }

    $after = $null
    $afterArgs = $null
    try {
        $rb = $sh.CreateShortcut($t)
        $after = $rb.TargetPath
        $afterArgs = $rb.Arguments
    } catch {
        $after = $null
    }

    if ($after -eq $item.Target -and (-not $afterArgs -or $afterArgs.Trim() -eq '')) {
        $fixed++
    } else {
        $failed++
    }
}

if ($failed -gt 0) {
    try {
        $logPath = Join-Path $toolsDir 'self-heal.log'
        $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        Add-Content -LiteralPath $logPath -Value ($stamp + ' FAILED: ' + $failed + ' shortcut(s) could not be fixed.') -Encoding UTF8
    } catch {}
    exit 2
}

exit 0
