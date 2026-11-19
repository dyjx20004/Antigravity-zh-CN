$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$projectRoot = Split-Path -Parent $PSScriptRoot
$target      = Join-Path $projectRoot 'run-all.cmd'
$desktop     = Join-Path $env:USERPROFILE 'Desktop'
$lnkPath     = Join-Path $desktop 'Antigravity-一键汉化修复.lnk'

$exe = $null
foreach ($cand in @($env:ANTIGRAVITY_DIR, (Join-Path $env:LOCALAPPDATA 'Programs\antigravity'), (Join-Path $env:ProgramFiles 'antigravity'))) {
    if ($cand -and (Test-Path -LiteralPath (Join-Path $cand 'Antigravity.exe'))) {
        $exe = Join-Path $cand 'Antigravity.exe'
        break
    }
}

if (-not (Test-Path -LiteralPath $target)) { Write-Error "未找到一键启动脚本: $target" }

$sh = New-Object -ComObject WScript.Shell
$s  = $sh.CreateShortcut($lnkPath)
$s.TargetPath       = $target
$s.Arguments        = ''
$s.WorkingDirectory = $projectRoot
if ($exe -and (Test-Path -LiteralPath $exe)) {
    $s.IconLocation = $exe + ',0'
}
$s.Description      = '一键执行 Antigravity 中文汉化、快捷方式修复与代理启动'
$s.Save()

Write-Host ('[OK] 已创建桌面快捷方式: ' + $lnkPath) -ForegroundColor Green
Write-Host ('     目标路径: ' + $s.TargetPath)
