# Haiwenna ClipFlow (海文娜剪贴板)

<p align="center">
  <strong>一款基于 Tauri 2 + Rust + React 构建的轻量、流畅、贴合光标的 Windows 剪贴板增强工具。</strong>
</p>

<p align="center">
  <a href="https://github.com/haiwen619/Haiwenna-ClipFlow/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/platform-Windows-0078d4.svg" alt="Platform">
  <img src="https://img.shields.io/badge/built%20with-Tauri%202%20%7C%20Rust-orange.svg" alt="Tauri">
</p>

---

**Haiwenna ClipFlow** 专为追求极致输入体验的 Windows 用户打造，融合了 **Emil Kowalski 设计工程手感** 与现代白净美学风格，完美平替与升级系统原生 `Win+V` 剪贴板历史。

### ✨ 核心特性

- **首次运行设置向导（Onboarding Wizard）**：
  - 优雅的 6 步配置向导（特性导览、自启权限、热键配置、忽略应用穿梭、数据管理、上手秘籍）。
  - 设置面板支持随时“重新打开向导”。
- **忽略应用隐私防护（Ignore Apps Filter）**：
  - 双栏穿梭配置器，自动识别 Windows 活动窗口并预置常见密码管理器（1Password、Bitwarden、KeePass 等）。
  - Rust 剪贴板监听底层按进程名静默丢弃，敏感应用复制完全不存盘。
- **全键盘极速流（Raycast / Vim 级手感）**：
  - `↑` / `↓` 上下穿梭选中，`Enter` 瞬间回车粘贴。
  - `1` ~ `9` 键盘直接速贴前 9 条历史记录。
  - `P` 一键置顶/取消置顶，`C` 快速复制，`Del` / `Backspace` 即时删除。
- **智能语义识别与实用增强**：
  - 🎨 **颜色代码识别**：Hex (`#fff`)、RGB、RGBA 实时生成取色预览色块，设计/开发直观对比。
  - 🔗 **URL 链接识别**：自动高亮并提供「打开」按钮，一键调起系统默认浏览器。
  - 🧹 **纯文本格式清洗**：一键剔除 Word/网页富文本格式与多余空行，纯净格式贴入目标。
- **隐私守卫（Privacy Guard / 幽灵模式）**：
  - 顶栏常驻呼吸监听指示灯，支持一键切换「隐私模式」。
  - Rust 底层原子标志位挂起监听，在复制密码、Token、私钥时不留任何痕迹，安全无忧。
- **智能光标跟随（对齐微软原生手感）**：优先捕获前台应用输入光标（Text Caret），无输入状态智能吸附鼠标坐标，自适应多屏与防溢出上下翻转。
- **纯净白色美学与物理动效**：基于 `cubic-bezier(0.16, 1, 0.3, 1)` Apple 弹簧曲线，微缩放触感与柔和环境微光晕。
- **快速分类过滤 Tabs**：支持 `全部` / `文本` / `图片` / `已置顶` 瞬间切换。
- **直接点击输入粘贴**：点击卡片或图片直接即时粘贴至当前文本，杜绝误触与多余等待。
- **无缝接管 Win+V**：可选一键停用系统原生历史并无缝接管 `Win+V` 快捷键。
- **本地纯净存储**：内置 SQLite 与图片安全离线存储，支持自定义数据目录迁移。
- **开机静默常驻**：托盘常驻、平滑白金设置抽屉、全局快捷键随时呼出。

## 技术栈

- 前端：`React 18`、`TypeScript`、`Vite`、`Tailwind CSS`
- 桌面容器：`Tauri 2`
- 后端：`Rust`
- 本地存储：`SQLite (rusqlite bundled)`
- 系统能力：全局快捷键、托盘、注册表修改、低层键盘钩子、系统剪贴板监听

## 当前项目结构

```text
.
├─ src/                 前端页面与组件
├─ src/components/      头部、列表、设置面板等 UI 组件
├─ src-tauri/src/       Rust 后端、托盘、快捷键、剪贴板监听
├─ src-tauri/icons/     应用图标
├─ dist/                前端构建产物
└─ docs/                项目文档
```

## 快速开始

### 1. 安装依赖

推荐使用 `pnpm`，因为 `src-tauri/tauri.conf.json` 中的 Tauri 开发和构建钩子使用的是 `pnpm dev` / `pnpm build`。

```bash
pnpm install
```

### 2. 启动开发环境

```bash
pnpm tauri dev
```



这会同时启动：

- Vite 前端开发服务器
- Tauri 桌面进程

### 3. 单独构建前端

```bash
pnpm build
```

### 4. 打包桌面安装包

```bash
pnpm tauri build
```

默认产物位于：

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/bundle/msi/`

## 运行环境要求

当前项目面向 Windows 桌面环境，建议：

- Windows 10 或 Windows 11
- Node.js 18+
- pnpm 8+
- Rust stable
- Visual Studio 2022 或 Build Tools，需安装：
  - `Desktop development with C++`
  - MSVC v143 x64/x86 build tools
  - Windows 10/11 SDK
- Microsoft WebView2 Runtime

### Windows 打包环境检查

如果 `pnpm tauri build` 报错 `link.exe not found`，说明当前终端没有可用的 MSVC 链接器。请从开始菜单打开 `x64 Native Tools Command Prompt for VS 2022`，或在当前终端先加载 VS 编译环境：

```bat
# 请根据实际安装路径调整，例如 Community / Professional / Enterprise
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
pnpm tauri build
```

如果进一步报错找不到 `kernel32.lib`、`windows.h` 或 `malloc.h`，说明 Windows SDK 或 C++ 标准库组件缺失。打开 Visual Studio Installer，修改当前 VS/Build Tools 安装，勾选 `Desktop development with C++`、MSVC v143 和 Windows 10/11 SDK 后重新构建。

## 文档目录

- [使用文档](./docs/USAGE.md)
- [部署与打包文档](./docs/DEPLOYMENT.md)
- [架构说明](./docs/ARCHITECTURE.md)

## 核心能力说明

### 快捷键

- 默认快捷键为 `Alt+V`
- 如果启用“替代 Windows 剪贴板历史”，会固定使用 `Win+V`
- `Win+V` 不是普通全局快捷键，项目当前通过 Windows 低层键盘钩子接管

### 数据存储

应用会在本地创建：

- `clipx.db`：SQLite 数据库
- `images/`：图片剪贴板内容文件

应用支持从设置面板迁移数据目录，迁移后会自动重启。

### 系统集成

启用“替代 Windows 剪贴板历史”后，应用会：

- 关闭系统剪贴板历史注册表开关
- 接管 `Win+V`

相关注册表位置：

```text
HKCU\Software\Microsoft\Clipboard
EnableClipboardHistory
```

## 常用开发命令

```bash
pnpm install
pnpm dev
pnpm build
pnpm tauri dev
pnpm tauri build
cargo check --manifest-path src-tauri/Cargo.toml
```

## 注意事项

- 本项目当前实现是 Windows 专用桌面应用，不适合直接部署到 Web 环境
- `src-tauri/target/` 和根目录 `dist/` 属于构建产物，不建议纳入版本管理
- 如果修改了 Rust 侧系统集成功能，建议同时验证：
  - 托盘行为
  - 全局快捷键
  - `Win+V` 替代逻辑
  - 数据目录迁移
