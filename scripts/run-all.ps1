param(
    [switch]$UseSource,
    [switch]$NoLaunch,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$projectRoot = Split-Path -Parent $PSScriptRoot
$patcherExe  = Join-Path $projectRoot 'dist\Antigravity-Patcher.exe'
$patcherPy   = Join-Path $projectRoot 'Antigravity-zh-CN\Antigravity-Patcher.py'
$repointPs1  = Join-Path $PSScriptRoot 'repoint-shortcut.ps1'
$proxyCmd    = Join-Path $projectRoot 'Antigravity-Proxy.cmd'
$bakDir      = Join-Path $projectRoot 'backups'

Write-Host '==================================================================' -ForegroundColor Cyan
Write-Host '     Antigravity 一键工具：汉化补丁 + 快捷方式修复 + 代理启动      ' -ForegroundColor Cyan
Write-Host '==================================================================' -ForegroundColor Cyan
Write-Host ('项目目录: ' + $projectRoot)
if ($DryRun) {
    Write-Host '[模式] 当前为 Dry-Run 演练模式，不会关闭进程或修改任何系统文件。' -ForegroundColor Yellow
}

# ------------------------------------------------------------
# Step 1/3: 应用中文汉化补丁 (优先调用编译好的 exe)
# ------------------------------------------------------------
Write-Host "`n[1/3] 应用中文汉化补丁..." -ForegroundColor Cyan
$patchArgs = @('--backup-dir', $bakDir, '--force-reextract', '--no-launch', '--no-pause')
if ($DryRun) { $patchArgs += '--dry-run' }

if (-not $UseSource -and (Test-Path -LiteralPath $patcherExe)) {
    Write-Host ('      执行方式: 编译版 exe (' + $patcherExe + ')')
    & $patcherExe @patchArgs
} elseif (Test-Path -LiteralPath $patcherPy) {
    Write-Host ('      执行方式: Python 源码 (' + $patcherPy + ')')
    & python $patcherPy @patchArgs
} else {
    Write-Host '[ERROR] 未找到 Antigravity-Patcher.exe 或 Antigravity-Patcher.py' -ForegroundColor Red
    exit 1
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ('[ERROR] 步骤 1（中文汉化补丁）失败，退出码: ' + $LASTEXITCODE) -ForegroundColor Red
    exit $LASTEXITCODE
}

# ------------------------------------------------------------
# Step 2/3: 修复桌面/开始菜单/任务栏 Antigravity 快捷方式
# ------------------------------------------------------------
Write-Host "`n[2/3] 修复 Antigravity 快捷方式指向代理启动脚本..." -ForegroundColor Cyan
if ($DryRun) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $repointPs1 -DryRun
} else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $repointPs1
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ('[ERROR] 步骤 2（快捷方式修复）失败，退出码: ' + $LASTEXITCODE) -ForegroundColor Red
    exit $LASTEXITCODE
}

# ------------------------------------------------------------
# Step 3/3: 通过代理启动 Antigravity
# ------------------------------------------------------------
Write-Host "`n[3/3] 带代理启动 Antigravity..." -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $proxyCmd)) {
    Write-Host ('[ERROR] 未找到代理启动脚本: ' + $proxyCmd) -ForegroundColor Red
    exit 1
}

if ($DryRun -or $NoLaunch) {
    Write-Host ('      [跳过启动] 正式执行将调用: ' + $proxyCmd) -ForegroundColor Yellow
} else {
    & cmd.exe /c "`"$proxyCmd`""
    if ($LASTEXITCODE -ne 0) {
        Write-Host ('[ERROR] 步骤 3（代理启动）失败，退出码: ' + $LASTEXITCODE) -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host '                 全部 3 个流程已顺利执行完毕！                     ' -ForegroundColor Green
Write-Host '==================================================================' -ForegroundColor Green
