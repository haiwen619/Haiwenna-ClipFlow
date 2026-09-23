# 告别卡顿的 Win+V！我用 Tauri 2 + Rust 撸了个光标跟随、E2EE 图文全能跨端剪贴板神器

> 🌐 **官方体验主站**：[https://clipflow.haiwenna.me](https://clipflow.haiwenna.me)  
> 💻 **GitHub 开源仓库**：[https://github.com/haiwen619/Haiwenna-ClipFlow](https://github.com/haiwen619/Haiwenna-ClipFlow)  
> 📱 **Android Universal APK 下载**：[https://clipflow.haiwenna.me/ClipFlow-v0.1.2-universal.apk](https://clipflow.haiwenna.me/ClipFlow-v0.1.2-universal.apk) (27.1MB 深度优化版)  
> 🏷️ **支持系统**：Windows 10/11 & Android (全架构 CPU)

---

## 一、 为什么我们苦 Windows 原生剪贴板（Win+V）久矣？

相信每一位重度写代码、写文档的程序员与创作者，都离不开剪贴板历史记录。Windows 10/11 自带的 `Win + V` 虽然方便，但在日常高频使用中经常让人崩溃：

1. **弹出永远在右下角，视线大幅位移**：在双屏或 4K 大屏敲代码时，光标在屏幕左上角，按 `Win+V` 窗口却孤零零弹在右下角，眼睛要在屏幕两端来回跑。
2. **偶发严重卡顿甚至假死**：基于 XAML/UWP 的原生界面时不时转圈圈，唤出延迟超过 1~2 秒，极其打断编码节奏。
3. **跨端同步依赖微软云，不支持局域网与大图**：微软同步经常抽风，且图片往往同步失败；更重要的是，剪贴板明文上传微软云，毫无隐私可言。
4. **密码与 Token 泄露隐患**：复制了 1Password / Bitwarden 的主密码或 GitHub Personal Access Token，直接明文进了历史记录，忘记清理就成了安全隐患。
5. **市面三方软件臃肿**：很多剪贴板工具使用 Electron 构建，开机常驻占用几百兆内存，甚至还有商业弹窗。

**“既然市面上没有百分之百合心意的工具，那就自己用 Rust 造一个！”**  
经过数周的打磨，**Haiwenna ClipFlow** 诞生了 —— 一款专为追求极致输入手感打造的 Windows 剪贴板增强神器，支持安卓端跨网零知识加密（E2EE）图文同步。

---

## 二、 核心硬核特性盘点

### 1. 毫秒级文本光标（Text Caret）吸附跟随
真正做到**“打字在哪里，面板就在哪里弹出”**！通过调用 Windows 底层 `GetGUIThreadInfo` 与辅以 UI Automation API，ClipFlow 能实时捕获当前编辑框（VS Code、浏览器、Word、终端等）的光标绝对坐标，按下热键瞬间吸附在光标下方，视线无需偏移一毫米。

### 2. 全键盘流极速操作（Raycast / Vim 级盲打）
- `1` ~ `9` 数字快捷键：按下数字直接贴入对应条目，省去回车步骤；
- `↑` / `↓` / `J` / `K` 方向移动，回车直贴；
- 智能类型识别：自动区分纯文本、代码片段、色值（实时色卡预览）、URL 链接与高画质截图。

### 3. 跨网端到端加密（E2EE）图文全能同步
无需数据线，告别微信“文件传输助手”刷屏：
- **图文双能秒传**：电脑端按下 `Win + Shift + S` 截图或复制大图，手机端秒级弹窗展示，长按即可直接保存至手机系统相册，或直接复制进手机剪贴板。
- **WebCrypto AES-256-GCM 零知识安全**：所有数据均在终端本地加密（密钥基于 PBKDF2/SHA-256 派生），即使经由公网 WebSocket 中继，服务器看到的也纯粹是乱码密文。
- **双向防回环与防抖**：采用 Content Hash 机制，彻底杜绝手机与电脑互相循环广播的经典难题。

### 4. 密码管理器智能避让 & 呼吸灯“幽灵模式”
- **敏感应用自动丢弃**：内置活动窗口进程过滤器，自动识别 `1Password`、`Bitwarden`、`KeePass` 等密码管理器，在底层静默丢弃敏感复制，不入库、不落盘。
- **幽灵模式**：顶栏自带呼吸灯快捷开关，临时复制重要私钥或 Token 时，一键挂起监听，事后不留痕迹。

### 5. 极致轻量与深度优化
- 底层采用 **Tauri 2 + Rust + SQLite** 构建，内存常驻仅几十兆；
- Android 移动端安装包经过深度剥离调试符号与 LTO 优化，从原先的 500MB+ 骤降至 **27.1 MB**（涵盖全架构 CPU），手机秒下秒装。

---

## 三、 技术架构与关键实现剖析

ClipFlow 采用了前后端分离但零 IPC 开销的架构方案：

```
┌──────────────────┐               ┌──────────────────┐
│  Windows Client  │  AES-256-GCM  │  Android Phone   │
│  (Tauri 2+Rust)  │ <===========> │  (Tauri Mobile)  │
└─────────┬────────┘    WebSocket  └─────────┬────────┘
          │ (Win32 Hooks)                    │ (Camera QR)
┌─────────▼────────┐               ┌─────────▼────────┐
│ SQLite 本地存储   │               │ WebCrypto 浏览器  │
│ 毫秒级分词检索    │               │ 安全加解密引擎   │
└──────────────────┘               └──────────────────┘
```

### 1. Windows 原生光标吸附算法（Rust）
```rust
// 核心逻辑：精准定位光标坐标
pub unsafe fn get_caret_position() -> Option<(i32, i32)> {
    let hwnd = GetForegroundWindow();
    let thread_id = GetWindowThreadProcessId(hwnd, None);
    let mut gui_info = GUITHREADINFO {
        cbSize: std::mem::size_of::<GUITHREADINFO>() as u32,
        ..Default::default()
    };
    if GetGUIThreadInfo(thread_id, &mut gui_info).as_bool() {
        if gui_info.rcCaret.left != 0 || gui_info.rcCaret.top != 0 {
            let mut pt = POINT {
                x: gui_info.rcCaret.left,
                y: gui_info.rcCaret.bottom + 6,
            };
            ClientToScreen(gui_info.hwndCaret, &mut pt);
            return Some((pt.x, pt.y));
        }
    }
    // 降级策略：跟随鼠标所在显示器或活动窗口中心
    get_fallback_position(hwnd)
}
```

### 2. 32KB 分块流式端到端加密（TypeScript / WebCrypto）
面对高分辨率大图（数兆字节）的跨端传输，传统字符串加密会导致内存瞬间暴涨甚至浏览器页面崩溃。ClipFlow 采用了分块加密传输：
```typescript
// 采用 AES-GCM 配合派生 RoomId 零知识通道
export async function encryptPayload(key: CryptoKey, rawData: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(rawData);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  // 打包为结构化 Envelope 返回
  return JSON.stringify({
    iv: arrayBufferToBase64(iv),
    payload: arrayBufferToBase64(cipherBuffer),
    timestamp: Date.now()
  });
}
```

---

## 四、 在线免安装体验沙盒

为了让大家在下载之前就能直观感受到界面设计工程与动效，我们特意搭建了官方专属网站，并直接在网页内内置了 **1:1 交互体验沙盒**：

- 👉 **在线体验地址**：[https://clipflow.haiwenna.me](https://clipflow.haiwenna.me)

在沙盒中，你可以直接试用：
1. 实时搜索与标签秒级切换；
2. 颜色卡片的 HEX/RGB 取色与复制动效；
3. 模拟跨设备端到端加密同步光柱动画。

---

## 五、 下载与安装

- **Windows 客户端 (v0.1.2)**：前往 [GitHub Releases](https://github.com/haiwen619/Haiwenna-ClipFlow/releases) 下载 `.msi` 或绿色版直接运行。
- **Android 客户端**：前往官网直链或 Releases 下载 `ClipFlow-v0.1.2-universal.apk`（约 27.1MB，已签署 v2 签名，适用于 Android 7.0 及以上所有真机与模拟器）。
- **手机扫码即连**：电脑端打开设置面板点击“扫码配对”，手机打开伴侣应用一扫即连，真正做到开箱即用。

---

## 六、 写在最后 & 开源社区

项目已完全在 GitHub 开源（MIT 协议），欢迎大家提交 Issue 和 PR！

- **GitHub 仓库**：[https://github.com/haiwen619/Haiwenna-ClipFlow](https://github.com/haiwen619/Haiwenna-ClipFlow)

如果这个项目对你的日常办公或编程效率有所帮助，欢迎前往 GitHub 点一颗小小的 **⭐ Star**，这也是对个人开发者最大的支持与鼓励！大家有任何功能需求或使用反馈，欢迎在评论区一起交流探讨！
