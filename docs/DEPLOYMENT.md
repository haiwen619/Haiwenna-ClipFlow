# ClipX 部署与打包文档

## 1. 适用范围

本文档用于说明当前项目的：

- 本地开发环境准备
- 开发运行方式
- 构建方式
- 安装包打包方式
- 发布前检查项

本项目当前目标平台为 Windows。

## 2. 环境准备

### 必装软件

- Node.js 18 或更高版本
- pnpm
- Rust stable
- Visual Studio 2022 或 Build Tools，并安装以下组件：
  - `Desktop development with C++`
  - MSVC v143 x64/x86 build tools
  - Windows 10/11 SDK
- Microsoft WebView2 Runtime

### 推荐检查命令

```bash
node -v
pnpm -v
rustc -V
cargo -V
where link
where cl
```

如果 `where link` 或 `where cl` 找不到命令，需要从开始菜单使用 `x64 Native Tools Command Prompt for VS 2022`，或在终端中先执行：

```bat
# 请根据实际安装路径调整，例如 Community / Professional / Enterprise
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
```

如果 `link.exe` 能找到，但构建时报错找不到 `kernel32.lib`、`windows.h` 或 `malloc.h`，通常是 Windows SDK 或 C++ 工具链组件缺失。使用 Visual Studio Installer 修改安装，确保勾选 `Desktop development with C++`、MSVC v143 和 Windows 10/11 SDK。

## 3. 安装依赖

项目根目录执行：

```bash
pnpm install
```

如果依赖异常，可尝试：

```bash
pnpm store prune
pnpm install
```

## 4. 本地开发

### 前端开发模式

仅启动前端：

```bash
pnpm dev
```

说明：

- 启动 Vite 开发服务器
- 默认地址见终端输出

### 桌面开发模式

启动完整桌面应用：

```bash
pnpm tauri dev
```

说明：

- Tauri 会读取 `src-tauri/tauri.conf.json`
- 自动执行 `beforeDevCommand: pnpm dev`
- 前端由 Vite 提供开发服务
- Rust 后端会以开发模式运行

## 5. 构建流程

### 前端构建

```bash
pnpm build
```

作用：

- 执行 TypeScript 编译检查
- 输出 Vite 前端构建产物到 `dist/`

### Rust 后端检查

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

作用：

- 检查 Rust 编译是否通过
- 不生成正式发布产物

## 6. 打包桌面安装包

### 标准打包命令

```bash
pnpm tauri build
```

说明：

- 自动执行 `beforeBuildCommand: pnpm build`
- 使用 `dist/` 作为前端静态资源
- 生成 Windows 安装包

### 常见输出目录

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

通常可以看到：

- `*.exe`：NSIS 安装包
- `*.msi`：MSI 安装包

## 7. 打包 Android 手机端安装包 (APK)

本项目通过 Tauri 2 支持 Android 客户端，支持局域网内与 Windows 电脑端双向实时 E2EE 加密剪贴板同步。

### 7.1 前置环境准备

在打包 Android 客户端前，需要确保本地具备以下工具：

1. **Java JDK**：推荐 JDK 17 或 21（设置好 `JAVA_HOME` 环境变量）
2. **Android SDK & NDK**：
   - 配置好环境变量 `ANDROID_HOME`（例如 `C:\Users\<用户名>\AppData\Local\Android\Sdk`）
   - 安装 NDK（推荐 r26 或更高版本，设置 `NDK_HOME`）
   - 安装 Android SDK Platform 34/35/36 及对应版本的 Build-Tools
3. **Rust Android Target**（按需添加）：
   ```bash
   # 为现代真机（64位 ARM，主流机型）添加目标架构
   rustup target add aarch64-linux-android
   
   # 其他架构（可选）：
   rustup target add armv7-linux-androideabi x86_64-linux-android i686-linux-android
   ```

### 7.2 常用打包命令

#### ① 快速打包调试版 APK（推荐开发与自测）：

```bash
pnpm tauri android build --apk --debug
```

*若只需针对您自己的手机（绝大多数为 64位 ARM 架构）极速构建，可加上 `--target aarch64`，构建速度显著提升：*
```bash
pnpm tauri android build --apk --debug --target aarch64
```

#### ② 打包正式发布版 APK：

```bash
pnpm tauri android build --apk
```

#### ③ 使用 Android Studio 打开工程进行可视化打包与签名：

```bash
pnpm tauri android build --open
```
该命令会自动用 Android Studio 打开 `src-tauri/gen/android` 目录，您可以在 IDE 中点击 **Build → Build Bundle(s) / APK(s) → Build APK(s)** 或配置签名打包。

#### ④ 使用原生 Gradle 命令行直接打包：

也可以直接进入 Android 工程目录使用 Gradle 构建：
```bash
# 进入 Android 工程目录
cd src-tauri/gen/android

# 打包 Debug APK
./gradlew.bat assembleDebug

# 打包 Release APK
./gradlew.bat assembleRelease
```

### 7.3 APK 产物路径

打包完成后，APK 安装包通常位于以下路径：

- **Debug 版 APK**：
  ```text
  src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk
  ```
  或者：
  ```text
  src-tauri/target/debug/bundle/apk/
  ```
- **Release 版 APK**：
  ```text
  src-tauri/gen/android/app/build/outputs/apk/release/app-release-unsigned.apk
  ```

### 7.4 安装到手机

将手机通过 USB 数据线连接电脑，开启手机的「开发者选项」与「USB 调试」：

```bash
# 方式一：连接手机后直接运行开发模式热重载
pnpm tauri android dev

# 方式二：使用 adb 命令行直接安装生成的 APK
adb install src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk
```

## 8. 配置说明

主要打包配置在：

[`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json)

当前关键配置包括：

- `productName`: `ClipX`
- `identifier`: `com.haiwen.clipx`
- `frontendDist`: `../dist`
- `devUrl`: `http://localhost:1420`
- `bundle.targets`: `all`

主窗口当前配置：

- 固定尺寸
- 无原生边框
- 常驻顶层
- 默认不显示任务栏

## 8. 发布前检查清单

发布前建议逐项确认：

1. `pnpm build` 通过
2. `cargo check --manifest-path src-tauri/Cargo.toml` 通过
3. `pnpm tauri build` 通过
4. 安装包可正常安装与启动
5. 默认快捷键 `Alt+V` 可用
6. 启用“替代 Windows 剪贴板历史”后 `Win+V` 可用
7. 托盘图标和托盘菜单正常
8. 开机自启动可正常开启和关闭
9. 数据目录迁移正常
10. 文本和图片剪贴板都能正确记录

## 9. 推荐发布流程

### 开发阶段

```bash
pnpm install
pnpm tauri dev
```

### 提交前

```bash
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

### 发布前

```bash
pnpm tauri build
```

### 交付物

优先交付以下文件之一：

- NSIS 安装包：适合普通最终用户
- MSI 安装包：适合企业内网或统一运维部署

## 10. 数据与部署注意事项

### 默认数据目录

应用默认使用 Tauri 的 `app_data_dir` 作为数据根目录。

### 自定义数据目录

如果用户在应用内迁移了数据目录，程序会：

1. 复制数据库和图片
2. 写入 `data_dir.conf`
3. 自动重启

因此部署时需要注意：

- 用户目录应具备读写权限
- 目标磁盘应允许创建目录和写入文件

## 11. 安全与权限说明

当前项目包含如下系统级行为：

- 全局快捷键注册
- 剪贴板监听
- 托盘控制
- 注册表写入
- 低层键盘钩子拦截 `Win+V`

因此在部分环境中可能受到：

- 杀毒软件
- 企业安全策略
- 终端安全管控软件

的影响。

如果出现以下问题，应优先检查系统权限或安全策略：

- 快捷键无法触发
- `Win+V` 替代无效
- 自启动设置失败
- 托盘行为异常

## 12. 代码级部署入口

关键入口文件如下：

- 前端入口：[`src/main.tsx`](../src/main.tsx)
- 前端主页面：[`src/App.tsx`](../src/App.tsx)
- Rust 启动入口：[`src-tauri/src/main.rs`](../src-tauri/src/main.rs)
- Tauri 应用装配：[`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)

## 13. 常见问题

### 1. 为什么推荐 pnpm 而不是 npm？

因为当前 `tauri.conf.json` 已经显式配置：

- `beforeDevCommand: pnpm dev`
- `beforeBuildCommand: pnpm build`

如果使用 npm，需要同步修改 Tauri 配置，否则 Tauri 生命周期命令会找不到对应环境。

### 2. 为什么 `pnpm build` 不会生成安装包？

因为它只构建前端静态资源。真正的桌面打包命令是：

```bash
pnpm tauri build
```

### 3. `pnpm tauri build` 报 `link.exe not found` 怎么办？

当前 Rust 工具链是 `x86_64-pc-windows-msvc` 时，Tauri/Rust 需要 MSVC 的 `link.exe`。请使用 VS 2022 的 x64 Native Tools 终端，或先执行：

```bat
# 请根据实际安装路径调整
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
pnpm tauri build
```

如果仍然报错找不到 `kernel32.lib`、`windows.h` 或 `malloc.h`，请用 Visual Studio Installer 安装或修复 Windows 10/11 SDK 与 MSVC v143 C++ 工具。

### 4. 为什么打包后要重点验证 Win+V？

因为它涉及：

- 注册表修改
- 低层键盘钩子
- 系统快捷键接管

这是最容易受系统环境影响的部分。

---

## 14. 移动端 (Android APK) 打包指南

### 一键打包命令
无需将项目移动或重命名至纯英文目录，在当前工程目录下直接运行：

```bash
pnpm build:android
# 或
pnpm build:apk
```

### 生成文件路径
- 构建完成后 APK 自动汇总输出到：`dist/app-universal-release.apk`（27.1MB 深度优化瘦身版）
- 原始输出路径：`src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`
- 该 APK 包含全平台架构（aarch64, armv7, x86, x86_64），已去除未优化调试符号，可直接安装至任意 Android 设备。

### 技术实现原理
Android NDK 的 LLVM 链接器（`ld.lld`）在 Windows 环境下解析含中文或特殊字符路径时会报符号与文件不可用错误。项目通过脚本自动配置：
- `CARGO_TARGET_DIR` 自动重定向至纯英文临时路径（例如 `$env:TEMP\HaiwennaClipFlow`），避免占用系统盘并绕过 NDK 链接器在非 ASCII 路径下的已知缺陷。
- `android.overridePathCheck=true`（允许包含非 ASCII 字符的工作区路径）
- 自动检测并载入 Adoptium JDK 17、Android SDK 及 NDK r27 环境变量。

