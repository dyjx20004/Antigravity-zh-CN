param(
    [string[]]$SearchRoots,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher    = Join-Path $projectRoot 'Antigravity-Proxy.cmd'
$bakDir      = Join-Path $projectRoot 'backups'

$appDir = $null
foreach ($cand in @($env:ANTIGRAVITY_DIR, (Join-Path $env:LOCALAPPDATA 'Programs\antigravity'), (Join-Path $env:ProgramFiles 'antigravity'))) {
    if ($cand -and (Test-Path -LiteralPath (Join-Path $cand 'Antigravity.exe'))) {
        $appDir = $cand
        break
    }
}
$exe = if ($appDir) { Join-Path $appDir 'Antigravity.exe' } else { '' }

if (-not (Test-Path -LiteralPath $launcher)) { Write-Host ('[ERROR] 未找到代理启动脚本: ' + $launcher) -ForegroundColor Red; exit 1 }
if (-not $exe -or -not (Test-Path -LiteralPath $exe)) {
    Write-Host '[ERROR] 未找到 Antigravity.exe，请先安装客户端或在 config.cmd 中配置 ANTIGRAVITY_DIR。' -ForegroundColor Red
    exit 1
}

$isCustomRoots = $SearchRoots -and $SearchRoots.Count -gt 0
if ($isCustomRoots) {
    $roots = $SearchRoots
} else {
    $roots = @(
        (Join-Path $env:USERPROFILE 'Desktop'),
        (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
        (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar')
    )
}

$protectedTargets = @(
    'run-all.cmd',
    'fix-shortcut.cmd',
    'install-zh-patch.cmd',
    'restore-en.cmd',
    'build.cmd',
    'antigravity-patcher.exe',
    'restore.exe'
)

$found = @()
foreach ($r in $roots) {
    if (Test-Path -LiteralPath $r) {
        $found += Get-ChildItem -LiteralPath $r -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match 'Antigravity' }
    }
}
$found = @($found | Sort-Object FullName -Unique)

$sh = New-Object -ComObject WScript.Shell
$targets = @()
foreach ($f in $found) {
    $s = $sh.CreateShortcut($f.FullName)
    $targetLeaf = if ($s.TargetPath) { (Split-Path -Leaf $s.TargetPath).ToLowerInvariant() } else { '' }
    if ($protectedTargets -contains $targetLeaf) {
        Write-Host ('[跳过] 保留工具快捷方式: ' + $f.FullName + ' -> ' + $s.TargetPath) -ForegroundColor DarkGray
        continue
    }
    $targets += $f
}

if ($targets.Count -eq 0 -and -not $isCustomRoots) {
    $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
    $newLnk = Join-Path $startMenu 'Antigravity.lnk'
    if ($DryRun) {
        Write-Host ('[演练] 未发现 Antigravity 快捷方式，正式执行将在开始菜单创建: ' + $newLnk) -ForegroundColor Yellow
        exit 0
    }
    Write-Host '[INFO] 未发现现有 Antigravity 快捷方式，正在创建开始菜单快捷方式...'
    New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
    $s0 = $sh.CreateShortcut($newLnk)
    $s0.TargetPath = $launcher
    $s0.Arguments = ''
    $s0.WorkingDirectory = $projectRoot
    $s0.IconLocation = $exe + ',0'
    $s0.WindowStyle = 7
    $s0.Description = 'Antigravity (with proxy)'
    $s0.Save()
    Write-Host ('    created: ' + $newLnk)
    $targets = @(Get-Item -LiteralPath $newLnk)
}

if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bad = 0

foreach ($f in $targets) {
    $lnk = $f.FullName
    Write-Host ('--- ' + $lnk)
    $s = $sh.CreateShortcut($lnk)
    Write-Host ('    当前指向: ' + $s.TargetPath)

    if ($s.TargetPath -ieq $launcher) {
        Write-Host '    已指向本项目代理启动脚本，跳过' -ForegroundColor Green
        continue
    }

    if ($DryRun) {
        Write-Host ('    [演练] 正式执行将备份至 backups/ 并改指 -> ' + $launcher) -ForegroundColor Yellow
        continue
    }

    $bak = Join-Path $bakDir ($f.BaseName + '.' + $stamp + '.lnk.bak')
    Copy-Item -LiteralPath $lnk -Destination $bak -Force
    Write-Host ('    已备份原文件: ' + $bak)

    $s.TargetPath = $launcher
    $s.Arguments = ''
    $s.WorkingDirectory = $projectRoot
    $s.IconLocation = $exe + ',0'
    $s.WindowStyle = 7
    $s.Description = 'Antigravity (with proxy)'
    $s.Save()

    $v = $sh.CreateShortcut($lnk)
    if ($v.TargetPath -ieq $launcher) {
        Write-Host ('    OK -> ' + $v.TargetPath) -ForegroundColor Green
    } else {
        Write-Host ('    FAIL -> ' + $v.TargetPath) -ForegroundColor Red
        $bad++
    }
}

if ($bad -gt 0) {
    Write-Host ('[ERROR] 共 ' + $bad + ' 个快捷方式修复失败') -ForegroundColor Red
    exit 1
}
Write-Host '快捷方式修复完成 (ALL OK)' -ForegroundColor Green
