# scripts/build-android.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== Building Haiwenna ClipFlow Android APK ===" -ForegroundColor Cyan

# 1. 确保 Cargo 临时输出目录在纯英文路径，避免 NDK ld.lld 遭遇 Windows GBK 中文路径编码异常
$defaultCargoTarget = Join-Path ([System.IO.Path]::GetTempPath()) "HaiwennaClipFlow"
$cargoTarget = if ($env:CARGO_TARGET_DIR) { 
    $env:CARGO_TARGET_DIR 
} elseif (Test-Path "F:\@Haiwen\HaiwennaClipFlow") { 
    "F:\@Haiwen\HaiwennaClipFlow" 
} else { 
    $defaultCargoTarget 
}
if (-not (Test-Path $cargoTarget)) {
    New-Item -ItemType Directory -Path $cargoTarget -Force | Out-Null
}

$env:CARGO_TARGET_DIR = $cargoTarget

# 2. 动态探测并补齐 SDK / NDK / JDK 环境变量
if (-not $env:JAVA_HOME) {
    $adoptiumJdk = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
    if (Test-Path $adoptiumJdk) {
        $env:JAVA_HOME = $adoptiumJdk
    }
}

if (-not $env:ANDROID_HOME) {
    $localAndroidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
    if (Test-Path $localAndroidSdk) {
        $env:ANDROID_HOME = $localAndroidSdk
    }
}

if (-not $env:NDK_HOME -and $env:ANDROID_HOME) {
    $ndkBase = Join-Path $env:ANDROID_HOME "ndk"
    if (Test-Path $ndkBase) {
        $latestNdk = Get-ChildItem -Path $ndkBase -Directory | Sort-Object Name -Descending | Select-Object -First 1
        if ($latestNdk) {
            $env:NDK_HOME = $latestNdk.FullName
        }
    }
}

Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor DarkGray
Write-Host "ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor DarkGray
Write-Host "NDK_HOME: $env:NDK_HOME" -ForegroundColor DarkGray
Write-Host "CARGO_TARGET_DIR: $env:CARGO_TARGET_DIR" -ForegroundColor DarkGray

# 3. 前端编译
Write-Host "`n[1/3] Building frontend..." -ForegroundColor Cyan
pnpm build

# 4. 执行 Android 生产打包 (Release 深度优化 + 剥离符号 + 自动签名)
Write-Host "`n[2/3] Building Android Universal Release APK..." -ForegroundColor Cyan
pnpm tauri android build --apk

# 5. 复制 APK 到 dist 目录方便取用
Write-Host "`n[3/3] Copying APK to dist/..." -ForegroundColor Cyan
$apkSource = "src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk"
$distDir = "dist"
if (Test-Path $apkSource) {
    if (-not (Test-Path $distDir)) {
        New-Item -ItemType Directory -Path $distDir -Force | Out-Null
    }
    $apkTarget = "$distDir\app-universal-release.apk"
    Copy-Item $apkSource -Destination $apkTarget -Force
    # 同时复制一份通用命名与 debug 别名，兼容旧下载链接
    Copy-Item $apkSource -Destination "$distDir\ClipFlow-v0.1.2-universal.apk" -Force
    Copy-Item $apkSource -Destination "$distDir\app-universal-debug.apk" -Force
    $sizeMb = [math]::Round(((Get-Item $apkTarget).Length / 1MB), 2)
    Write-Host "`n[SUCCESS] Android Release APK built successfully!" -ForegroundColor Green
    Write-Host "Output: $apkTarget ($sizeMb MB)" -ForegroundColor Green
} else {
    Write-Error "APK file not found at $apkSource"
}
