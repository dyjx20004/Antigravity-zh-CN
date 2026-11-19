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

function Resolve-AntigravityDir {
    $candidates = @()
    if ($env:ANTIGRAVITY_DIR) { $candidates += $env:ANTIGRAVITY_DIR }
    $candidates += (Join-Path $env:LOCALAPPDATA 'Programs\antigravity')
    $candidates += (Join-Path $env:ProgramFiles 'antigravity')
    foreach ($dir in $candidates) {
        if ($dir -and (Test-Path -LiteralPath (Join-Path $dir 'Antigravity.exe'))) {
            return $dir
        }
    }
    return $null
}

function Resolve-RealPython {
    foreach ($name in @('python', 'py')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source -notlike '*\WindowsApps\*') {
            return $cmd.Source
        }
    }
    return $null
}

Write-Host '==================================================================' -ForegroundColor Cyan
Write-Host '     Antigravity 一键工具：汉化补丁 + 快捷方式修复 + 代理启动      ' -ForegroundColor Cyan
Write-Host '==================================================================' -ForegroundColor Cyan
Write-Host ('项目目录: ' + $projectRoot)

$appDir = Resolve-AntigravityDir
if (-not $appDir) {
    Write-Host '[ERROR] 未检测到 Antigravity 客户端安装目录！' -ForegroundColor Red
    Write-Host '        请先安装 Antigravity，或在 config.cmd 中设置 ANTIGRAVITY_DIR。' -ForegroundColor Yellow
    exit 1
}
$env:ANTIGRAVITY_DIR = $appDir
Write-Host ('客户端目录: ' + $appDir)

if ($DryRun) {
    Write-Host '[模式] 当前为 Dry-Run 演练模式，不会关闭进程或修改任何系统文件。' -ForegroundColor Yellow
}

# ------------------------------------------------------------
# Step 1/3: 应用中文汉化补丁 (优先调用编译好的 exe)
# ------------------------------------------------------------
Write-Host "`n[1/3] 应用中文汉化补丁..." -ForegroundColor Cyan
$patchArgs = @('--app-dir', $appDir, '--backup-dir', $bakDir, '--force-reextract', '--no-launch', '--no-pause')
if ($DryRun) { $patchArgs += '--dry-run' }

if (-not $UseSource -and (Test-Path -LiteralPath $patcherExe)) {
    Write-Host ('      执行方式: 编译版 exe (' + $patcherExe + ')')
    & $patcherExe @patchArgs
} elseif (Test-Path -LiteralPath $patcherPy) {
    $pyExe = Resolve-RealPython
    if (-not $pyExe) {
        Write-Host '[ERROR] 未找到可用的 Python 3 环境（已排除 Microsoft Store 占位符），且不存在 dist\Antigravity-Patcher.exe。' -ForegroundColor Red
        Write-Host '        请安装 Python 3.8+（勾选 Add Python to PATH），或从 GitHub Releases 下载免 Python 编译版压缩包。' -ForegroundColor Yellow
        exit 1
    }
    Write-Host ('      执行方式: Python 源码 (' + $pyExe + ')')
    if ($pyExe -like '*\py.exe') {
        & $pyExe -3 $patcherPy @patchArgs
    } else {
        & $pyExe $patcherPy @patchArgs
    }
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

$desktopShortcut = Join-Path (Join-Path $env:USERPROFILE 'Desktop') 'Antigravity-一键汉化修复.lnk'
if (-not (Test-Path -LiteralPath $desktopShortcut)) {
    Write-Host "`n[提示] 检测到桌面尚未创建一键快捷方式，可运行以下命令生成：" -ForegroundColor Yellow
    Write-Host '       powershell -NoProfile -ExecutionPolicy Bypass -File scripts\create-desktop-shortcut.ps1' -ForegroundColor DarkGray
}

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host '                 全部 3 个流程已顺利执行完毕！                     ' -ForegroundColor Green
Write-Host '==================================================================' -ForegroundColor Green
