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

## 7. 配置说明

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
