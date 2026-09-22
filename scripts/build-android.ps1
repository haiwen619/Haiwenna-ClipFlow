# scripts/build-android.ps1
$ErrorActionPreference = "Stop"

Write-Host "=== Building Haiwenna ClipFlow Android APK ===" -ForegroundColor Cyan

# 1. 确保 Cargo 临时输出目录在纯英文路径，避免 NDK ld.lld 遭遇 Windows GBK 中文路径编码异常
$cargoTarget = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { "F:\@Haiwen\HaiwennaClipFlow" }
if (-not (Test-Path $cargoTarget)) {
    New-Item -ItemType Directory -Path $cargoTarget -Force | Out-Null
}

$env:CARGO_TARGET_DIR = $cargoTarget

# 2. 补齐 SDK / NDK / JDK 环境变量
if (-not $env:JAVA_HOME) {
    if (Test-Path "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot") {
        $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
    }
}

if (-not $env:ANDROID_HOME) {
    if (Test-Path "C:\Users\haiwen\AppData\Local\Android\Sdk") {
        $env:ANDROID_HOME = "C:\Users\haiwen\AppData\Local\Android\Sdk"
    }
}

if (-not $env:NDK_HOME) {
    if (Test-Path "C:\Users\haiwen\AppData\Local\Android\Sdk\ndk\27.3.13750724") {
        $env:NDK_HOME = "C:\Users\haiwen\AppData\Local\Android\Sdk\ndk\27.3.13750724"
    }
}

Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor DarkGray
Write-Host "ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor DarkGray
Write-Host "NDK_HOME: $env:NDK_HOME" -ForegroundColor DarkGray
Write-Host "CARGO_TARGET_DIR: $env:CARGO_TARGET_DIR" -ForegroundColor DarkGray

# 3. 前端编译
Write-Host "`n[1/3] Building frontend..." -ForegroundColor Cyan
pnpm build

# 4. 执行 Android 打包
Write-Host "`n[2/3] Building Android Universal APK..." -ForegroundColor Cyan
pnpm tauri android build --debug

# 5. 复制 APK 到 dist 目录方便取用
Write-Host "`n[3/3] Copying APK to dist/..." -ForegroundColor Cyan
$apkSource = "src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk"
$distDir = "dist"
if (Test-Path $apkSource) {
    if (-not (Test-Path $distDir)) {
        New-Item -ItemType Directory -Path $distDir -Force | Out-Null
    }
    $apkTarget = "$distDir\app-universal-debug.apk"
    Copy-Item $apkSource -Destination $apkTarget -Force
    $sizeMb = [math]::Round(((Get-Item $apkTarget).Length / 1MB), 2)
    Write-Host "`n[SUCCESS] Android APK built successfully!" -ForegroundColor Green
    Write-Host "Output: $apkTarget ($sizeMb MB)" -ForegroundColor Green
} else {
    Write-Error "APK file not found at $apkSource"
}
