# ClipX 架构说明

## 1. 总体架构

ClipX 采用前后端分离的桌面应用结构：

- 前端：React 渲染 UI，负责交互和状态展示
- 后端：Rust 负责系统能力、数据库、托盘、快捷键和剪贴板监听
- 容器：Tauri 负责桥接前端与原生能力

## 2. 前端结构

### 主要文件

- [`src/main.tsx`](../src/main.tsx)：React 入口
- [`src/App.tsx`](../src/App.tsx)：主界面与设置流程
- [`src/api.ts`](../src/api.ts)：Tauri invoke/event 封装

### 组件职责

- [`src/components/Header.tsx`](../src/components/Header.tsx)
  - 搜索框
  - 设置按钮
  - 清空按钮
- [`src/components/ClipList.tsx`](../src/components/ClipList.tsx)
  - 历史列表容器
- [`src/components/ClipItem.tsx`](../src/components/ClipItem.tsx)
  - 单条记录渲染
  - 复制、删除、置顶、图片预览入口
- [`src/components/SettingsPanel.tsx`](../src/components/SettingsPanel.tsx)
  - 容量设置
  - 快捷键设置
  - 系统替代设置
  - 自启动设置
  - 数据目录管理

## 3. 后端结构

### 主要文件

- [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
  - Tauri Builder
  - 托盘构建
  - 快捷键注册
  - 应用启动初始化
- [`src-tauri/src/commands.rs`](../src-tauri/src/commands.rs)
  - Tauri 命令集合
- [`src-tauri/src/storage.rs`](../src-tauri/src/storage.rs)
  - SQLite 存取与设置表维护
- [`src-tauri/src/listener.rs`](../src-tauri/src/listener.rs)
  - 系统剪贴板监听
- [`src-tauri/src/paste.rs`](../src-tauri/src/paste.rs)
  - 写回系统剪贴板
  - 模拟 `Ctrl+V`
- [`src-tauri/src/hotkey.rs`](../src-tauri/src/hotkey.rs)
  - 快捷键字符串归一化与解析
- [`src-tauri/src/replacement_hotkey.rs`](../src-tauri/src/replacement_hotkey.rs)
  - `Win+V` 低层键盘钩子接管

## 4. 数据流

### 剪贴板监听流

1. Rust 后端监听系统剪贴板变化
2. 识别文本或图片
3. 生成哈希并做最近重复过滤
4. 写入 SQLite
5. 触发前端事件 `clipboard://updated`
6. 前端刷新列表

### 粘贴流

1. 用户点击某条记录
2. 前端调用 `paste_item`
3. 后端将内容写回系统剪贴板
4. 隐藏主窗口
5. 通过 `enigo` 模拟发送 `Ctrl+V`

### 设置保存流

1. 前端在设置面板编辑草稿状态
2. 点击“保存”后调用对应后端命令
3. 后端写入 SQLite 设置表
4. 部分设置同步应用到系统环境
5. 前端刷新为最新持久化状态

## 5. 设置分层

当前设置包含：

- `maxCount`
- `hotkey`
- `autostartEnabled`
- `replaceSystemClipboard`

其中：

- `autostartEnabled` 为即时生效
- 其他设置为保存后生效

## 6. 托盘与窗口行为

### 托盘

托盘图标负责：

- 左键显示主面板
- 右键弹出上下文菜单

### 主窗口

主窗口特征：

- 无边框
- 固定尺寸
- 始终置顶
- 默认不在任务栏显示
- 失焦后自动隐藏

## 7. Win+V 替代机制

启用“替代 Windows 剪贴板历史”后：

1. 写注册表关闭 Windows 原生剪贴板历史
2. 保存设置 `replace_system_clipboard = 1`
3. 启用低层键盘钩子监听 `Win+V`
4. 拦截系统行为并显示 ClipX 主窗口

这是当前项目中最强系统集成的一部分。

## 8. 数据库结构

### clips 表

主要字段：

- `id`
- `kind`
- `text`
- `image_path`
- `hash`
- `created_at`
- `pinned`

### settings 表

键值形式保存：

- `max_count`
- `hotkey`
- `autostart_enabled`
- `replace_system_clipboard`

## 9. 设计约束

当前项目具有以下设计约束：

- 面向 Windows，不追求跨平台一致行为
- UI 使用轻量浮窗式交互，而不是完整主窗口应用
- 系统级能力集中在 Rust 后端，前端只做展示和命令调用
- 图片数据文件落地保存，而不是直接存入数据库 BLOB

## 10. 后续可扩展方向

可以继续扩展的方向包括：

- 历史记录分组或标签系统
- 收藏夹独立视图
- 多窗口设置页
- 导入导出数据库
- 云同步
- 更细粒度的快捷键录制与冲突检测
