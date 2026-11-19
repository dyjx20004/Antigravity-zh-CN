param(
    [switch]$KeepBuildCache
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$projectRoot = Split-Path -Parent $PSScriptRoot
$srcDir      = Join-Path $projectRoot 'Antigravity-zh-CN'
$zhDataDir   = Join-Path $srcDir 'zh_data'
$patcherPy   = Join-Path $srcDir 'Antigravity-Patcher.py'
$restorePy   = Join-Path $srcDir 'Restore.py'
$distDir     = Join-Path $projectRoot 'dist'
$buildRoot   = Join-Path $projectRoot '.build'
$workDir     = Join-Path $buildRoot 'work'
$specDir     = Join-Path $buildRoot 'spec'

if (-not (Test-Path -LiteralPath $patcherPy)) { Write-Error "未找到源码: $patcherPy" }
if (-not (Test-Path -LiteralPath $restorePy)) { Write-Error "未找到源码: $restorePy" }
if (-not (Test-Path -LiteralPath $zhDataDir)) { Write-Error "未找到词典目录: $zhDataDir" }

$pyCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCmd) { Write-Error "未检测到 python，请先安装 Python 3.8+ 并加入 PATH。" }

Write-Host '==================================================================' -ForegroundColor Cyan
Write-Host '        PyInstaller 编译 Antigravity 中文汉化独立可执行文件         ' -ForegroundColor Cyan
Write-Host '==================================================================' -ForegroundColor Cyan

$pyiVer = & python -m PyInstaller --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "未检测到 PyInstaller，请先执行: python -m pip install pyinstaller"
}
Write-Host ("[信息] Python: " + $pyCmd.Source)
Write-Host ("[信息] PyInstaller 版本: " + $pyiVer)

New-Item -ItemType Directory -Force -Path $distDir, $workDir, $specDir | Out-Null

Write-Host "`n[1/2] 正在编译 Antigravity-Patcher.exe (内嵌 zh_data 词典与补丁规则)..." -ForegroundColor Yellow
$addDataArg = "$zhDataDir;zh_data"
& python -m PyInstaller `
    --onefile `
    --console `
    --clean `
    --noconfirm `
    --name 'Antigravity-Patcher' `
    --distpath $distDir `
    --workpath $workDir `
    --specpath $specDir `
    --add-data $addDataArg `
    $patcherPy
if ($LASTEXITCODE -ne 0) { Write-Error "Antigravity-Patcher.exe 编译失败 (退出码: $LASTEXITCODE)" }

Write-Host "`n[2/2] 正在编译 Restore.exe..." -ForegroundColor Yellow
& python -m PyInstaller `
    --onefile `
    --console `
    --clean `
    --noconfirm `
    --name 'Restore' `
    --distpath $distDir `
    --workpath $workDir `
    --specpath $specDir `
    $restorePy
if ($LASTEXITCODE -ne 0) { Write-Error "Restore.exe 编译失败 (退出码: $LASTEXITCODE)" }

if (-not $KeepBuildCache -and (Test-Path -LiteralPath $buildRoot)) {
    Remove-Item -Recurse -Force -LiteralPath $buildRoot
}

Write-Host "`n[完成] 编译产物清单:" -ForegroundColor Green
Get-ChildItem -LiteralPath $distDir -Filter '*.exe' | ForEach-Object {
    $mb = [Math]::Round($_.Length / 1MB, 2)
    Write-Host ("  - {0} ({1} MB)" -f $_.FullName, $mb)
}
