import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import type { Settings, StorageStats } from "../types";
import {
  CloseIcon,
  FolderIcon,
  KeyboardIcon,
  RefreshIcon,
  ClockIcon,
  CrosshairIcon,
  CenterIcon,
} from "./Icons";

const REPLACEMENT_HOTKEY = "Win+V";

interface Props {
  open: boolean;
  settings?: Settings;
  draft: Settings;
  saving: boolean;
  autostartBusy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onChange: (next: Settings) => void;
  onToggleAutostart: () => void;
  onToggleReplaceSystemClipboard: () => void;
  onHistoryCleaned?: () => void;
}

const HOTKEY_PRESETS = ["Alt+V", "Win+Shift+V", "Ctrl+Alt+V", "Alt+Space"];

const POSITION_MODES = [
  {
    id: "caret",
    title: "输入光标",
    desc: "跟随打字焦点 (Win+V)",
  },
  {
    id: "cursor",
    title: "鼠标指针",
    desc: "鼠标附近直接呼出",
  },
  {
    id: "center",
    title: "屏幕居中",
    desc: "居中呼出 (Raycast 风格)",
  },
];

const RETENTION_OPTIONS = [
  { days: 0, label: "永久保留" },
  { days: 3, label: "3 天" },
  { days: 7, label: "7 天" },
  { days: 30, label: "30 天" },
  { days: 90, label: "90 天" },
];

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface SwitchToggleProps {
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  onChange: () => void;
}

function SwitchToggle({
  checked,
  disabled,
  title,
  description,
  onChange,
}: SwitchToggleProps) {
  return (
    <div
      onClick={() => !disabled && onChange()}
      role="button"
      tabIndex={0}
      className={`group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/50 ${
        disabled ? "cursor-not-allowed opacity-60" : "active:scale-[0.99]"
      }`}
    >
      <div className="min-w-0 pr-2">
        <div className="text-[13px] font-semibold text-slate-800">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</div>
      </div>

      {/* Apple-style smooth switch button */}
      <div
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-spring focus:outline-none ${
          checked ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-spring ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </div>
  );
}

type TabKey = "general" | "capture" | "storage";

export function SettingsPanel({
  open,
  draft,
  saving,
  autostartBusy,
  error,
  onClose,
  onSave,
  onChange,
  onToggleAutostart,
  onToggleReplaceSystemClipboard,
  onHistoryCleaned,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [dataDir, setDataDir] = useState("");
  const [changing, setChanging] = useState(false);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const s = await api.getStorageStats();
      setStats(s);
    } catch (e) {
      console.error(e);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      api.getDataDir().then(setDataDir).catch(console.error);
      fetchStats();
      setActionMsg(null);
    }
  }, [open]);

  const handleChangeDir = async () => {
    const selected = await openDialog({
      directory: true,
      title: "选择数据存储位置",
      defaultPath: dataDir,
    });
    if (!selected) return;
    setChanging(true);
    try {
      await api.changeDataDir(selected);
    } catch (e) {
      console.error(e);
      setChanging(false);
    }
  };

  const handleCleanExpired = async () => {
    try {
      const count = await api.cleanExpiredHistory(draft.retentionDays);
      await fetchStats();
      onHistoryCleaned?.();
      setActionMsg(count > 0 ? `已自动清理 ${count} 条到期项目` : "无到期项目需要清理");
      setTimeout(() => setActionMsg(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearUnpinned = async () => {
    try {
      await api.clearAll();
      await fetchStats();
      onHistoryCleaned?.();
      setActionMsg("已清除非置顶记录");
      setTimeout(() => setActionMsg(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] transition-opacity"
      />

      {/* Slide-over Drawer */}
      <aside
        className={`absolute inset-y-0 right-0 z-10 flex w-full max-w-[370px] flex-col bg-white shadow-subtle-modal border-l border-slate-200/80 transition-transform duration-260 ease-spring ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="border-b border-slate-200/80 bg-slate-50/70 px-4 pt-3.5 pb-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-800">偏好设置</h2>
              <p className="text-[11px] text-slate-500">个性化、捕获行为与存储优化</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭设置"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700 active:scale-95"
            >
              <CloseIcon width="16" height="16" />
            </button>
          </div>

          {/* Segmented Navigation Tabs */}
          <div className="mt-3 flex rounded-lg bg-slate-200/60 p-0.5 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex-1 rounded-md py-1 text-center transition-all ${
                activeTab === "general"
                  ? "bg-white font-semibold text-slate-900 shadow-sm"
                  : "hover:text-slate-900"
              }`}
            >
              常规
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("capture")}
              className={`flex-1 rounded-md py-1 text-center transition-all ${
                activeTab === "capture"
                  ? "bg-white font-semibold text-slate-900 shadow-sm"
                  : "hover:text-slate-900"
              }`}
            >
              监听与行为
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("storage");
                fetchStats();
              }}
              className={`flex-1 rounded-md py-1 text-center transition-all ${
                activeTab === "storage"
                  ? "bg-white font-semibold text-slate-900 shadow-sm"
                  : "hover:text-slate-900"
              }`}
            >
              存储与清理
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 select-none">
          {/* TAB 1: GENERAL */}
          {activeTab === "general" && (
            <>
              {/* Section: Shortcuts */}
              <section>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  唤起快捷键
                </label>
                <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-semibold text-slate-800">主快捷键</div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/60">
                      <KeyboardIcon />
                      <span>{draft.replaceSystemClipboard ? REPLACEMENT_HOTKEY : draft.hotkey}</span>
                    </span>
                  </div>

                  {/* Presets */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {HOTKEY_PRESETS.map((preset) => {
                      const isSelected = draft.hotkey === preset && !draft.replaceSystemClipboard;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => onChange({ ...draft, hotkey: preset })}
                          disabled={draft.replaceSystemClipboard}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-95 ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-sm font-semibold"
                              : "border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Hotkey Input */}
                  <input
                    value={draft.hotkey}
                    onChange={(e) => onChange({ ...draft, hotkey: e.target.value })}
                    disabled={draft.replaceSystemClipboard}
                    placeholder="例如 Alt+V / Win+Shift+V"
                    className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400 leading-normal">
                    {draft.replaceSystemClipboard
                      ? "开启替代系统历史后，快捷键固定为 Win+V。"
                      : "支持字母、数字、F1-F12、Space 等任意组合。"}
                  </p>
                </div>
              </section>

              {/* Section: Window Positioning */}
              <section>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  弹出窗口位置
                </label>
                <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {POSITION_MODES.map((mode) => {
                      const active = draft.positionMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => onChange({ ...draft, positionMode: mode.id })}
                          className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all duration-150 ${
                            active
                              ? "border-blue-500 bg-blue-50/70 text-blue-700 shadow-sm"
                              : "border-slate-200/80 bg-slate-50/50 text-slate-600 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-center text-slate-500">
                            {mode.id === "caret" && <ClockIcon className={active ? "text-blue-600" : ""} />}
                            {mode.id === "cursor" && <CrosshairIcon className={active ? "text-blue-600" : ""} />}
                            {mode.id === "center" && <CenterIcon className={active ? "text-blue-600" : ""} />}
                          </div>
                          <span className="text-xs font-semibold">{mode.title}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                    {draft.positionMode === "center"
                      ? "窗口在屏幕中心弹出，沉浸专注；类似 Raycast。"
                      : draft.positionMode === "cursor"
                      ? "窗口跟随鼠标当前指针位置弹出，直观随性。"
                      : "默认模式。优先跟随当前正在打字的文本输入光标，极速顺畅。"}
                  </p>
                </div>
              </section>

              {/* Section: System Switches */}
              <section className="space-y-2.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  系统集成
                </label>

                <SwitchToggle
                  checked={draft.replaceSystemClipboard}
                  disabled={saving}
                  title="替代 Windows 剪贴板历史"
                  description="关闭系统原生 Win+V，由 ClipFlow 毫秒接管。"
                  onChange={onToggleReplaceSystemClipboard}
                />

                <SwitchToggle
                  checked={draft.autostartEnabled}
                  disabled={autostartBusy || saving}
                  title="开机自动启动"
                  description={
                    autostartBusy
                      ? "正在写入自启设置..."
                      : "开机后台静默运行并常驻系统托盘。"
                  }
                  onChange={onToggleAutostart}
                />
              </section>

              {/* Section: Setup Wizard */}
              <section>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  新手引导与向导
                </label>
                <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-semibold text-slate-800">首次运行设置向导</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        重新运行分步向导，或配置敏感应用排除名单
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        api.openOnboardingWindow();
                        onClose();
                      }}
                      className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 active:scale-95"
                    >
                      打开向导
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* TAB 2: CAPTURE & BEHAVIOR */}
          {activeTab === "capture" && (
            <>
              {/* Section: Paste Behavior */}
              <section>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  粘贴行为增强
                </label>
                <div className="mt-1.5 space-y-2">
                  <SwitchToggle
                    checked={draft.pastePlainText}
                    disabled={saving}
                    title="默认纯文本粘贴"
                    description="粘贴时自动剥离字体颜色、字号与富文本 HTML/RTF 样式，直接粘贴为纯文本。"
                    onChange={() => onChange({ ...draft, pastePlainText: !draft.pastePlainText })}
                  />
                </div>
              </section>

              {/* Section: Content Filters & Size Limits */}
              <section>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  监听内容与大小限制
                </label>
                <div className="mt-1.5 space-y-2.5">
                  {/* Text Capture */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-semibold text-slate-800">监听文本记录</div>
                        <div className="mt-0.5 text-xs text-slate-500">收录复制的代码、段落与链接</div>
                      </div>
                      <div
                        onClick={() => onChange({ ...draft, captureText: !draft.captureText })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-spring ${
                          draft.captureText ? "bg-blue-600" : "bg-slate-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-spring ${
                            draft.captureText ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>

                    {draft.captureText && (
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-xs text-slate-600">单条文本大小上限 (MB)</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={64}
                            value={draft.maxTextSizeMb}
                            onChange={(e) =>
                              onChange({
                                ...draft,
                                maxTextSizeMb: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs font-semibold text-slate-800 tabular-nums focus:border-blue-500 focus:bg-white focus:outline-none"
                          />
                          <span className="text-xs font-medium text-slate-400">MB</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Image Capture */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-semibold text-slate-800">监听图片与截图</div>
                        <div className="mt-0.5 text-xs text-slate-500">自动缓存截图与复制的位图</div>
                      </div>
                      <div
                        onClick={() => onChange({ ...draft, captureImages: !draft.captureImages })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-spring ${
                          draft.captureImages ? "bg-blue-600" : "bg-slate-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-spring ${
                            draft.captureImages ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </div>

                    {draft.captureImages && (
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-xs text-slate-600">单张图片大小上限 (MB)</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={5}
                            max={200}
                            value={draft.maxImageSizeMb}
                            onChange={(e) =>
                              onChange({
                                ...draft,
                                maxImageSizeMb: Math.max(5, Number(e.target.value) || 50),
                              })
                            }
                            className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-xs font-semibold text-slate-800 tabular-nums focus:border-blue-500 focus:bg-white focus:outline-none"
                          />
                          <span className="text-xs font-medium text-slate-400">MB</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Exclusion Info Notice */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-700 leading-relaxed">
                💡 <strong>隐私安全提示：</strong>如果您经常使用密码管理器或敏感应用，可通过“常规”页面打开新手向导，将相应进程加入黑名单，本工具将自动忽略其剪贴内容。
              </div>
            </>
          )}

          {/* TAB 3: STORAGE & RETENTION */}
          {activeTab === "storage" && (
            <>
              {/* Storage Stats Live Card */}
              <section>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    存储空间与占用
                  </label>
                  <button
                    type="button"
                    onClick={fetchStats}
                    disabled={statsLoading}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
                  >
                    <RefreshIcon className={statsLoading ? "animate-spin" : ""} />
                    <span>{statsLoading ? "刷新中" : "刷新统计"}</span>
                  </button>
                </div>

                <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-[11px] font-medium text-slate-400">总占用空间</div>
                      <div className="text-xl font-bold tracking-tight text-slate-800">
                        {stats ? formatBytes(stats.totalSizeBytes) : "计算中..."}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-medium text-slate-400">历史项目数</div>
                      <div className="text-sm font-semibold text-slate-700">
                        {stats ? `${stats.itemCount} 条` : "-"}
                      </div>
                    </div>
                  </div>

                  {/* Dual-color Storage Progress Bar */}
                  {stats && stats.totalSizeBytes > 0 && (
                    <div className="mt-3">
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          style={{
                            width: `${Math.max(
                              4,
                              (stats.dbSizeBytes / stats.totalSizeBytes) * 100
                            )}%`,
                          }}
                          className="bg-indigo-500 transition-all duration-300"
                          title={`数据库: ${formatBytes(stats.dbSizeBytes)}`}
                        />
                        <div
                          style={{
                            width: `${Math.max(
                              4,
                              (stats.imagesSizeBytes / stats.totalSizeBytes) * 100
                            )}%`,
                          }}
                          className="bg-sky-400 transition-all duration-300"
                          title={`图片缓存: ${formatBytes(stats.imagesSizeBytes)}`}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-indigo-500" />
                          <span>数据库: {formatBytes(stats.dbSizeBytes)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-sky-400" />
                          <span>图片: {formatBytes(stats.imagesSizeBytes)}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Section: History Retention & Automatic Cleanup */}
              <section>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  自动清理与保留周期
                </label>
                <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm space-y-3">
                  {/* Max Count */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold text-slate-800">条数上限</div>
                      <div className="text-xs text-slate-500">超出限制淘汰最旧未置顶项</div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={draft.maxCount}
                      onChange={(e) =>
                        onChange({
                          ...draft,
                          maxCount: Number(e.target.value) || 1,
                        })
                      }
                      className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-[13px] font-semibold text-slate-800 tabular-nums focus:border-blue-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  {/* Retention Days Selector */}
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-[13px] font-semibold text-slate-800">保留期限</div>
                    <div className="mt-0.5 text-xs text-slate-500">到期未置顶项目将自动清理</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {RETENTION_OPTIONS.map((opt) => {
                        const isSelected = draft.retentionDays === opt.days;
                        return (
                          <button
                            key={opt.days}
                            type="button"
                            onClick={() => onChange({ ...draft, retentionDays: opt.days })}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                              isSelected
                                ? "bg-blue-600 font-semibold text-white shadow-sm"
                                : "border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* Section: Storage Location */}
              <section>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  存储目录
                </label>
                <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                  <div className="flex items-center gap-2">
                    <FolderIcon className="text-blue-600" />
                    <span className="text-[13px] font-semibold text-slate-800">当前存储路径</span>
                  </div>
                  <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200/60 p-2 text-[11px] font-mono text-slate-600 break-all select-text">
                    {dataDir || "正在加载路径..."}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => api.openDataDir()}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-700 shadow-subtle-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                    >
                      打开文件夹
                    </button>
                    <button
                      type="button"
                      onClick={handleChangeDir}
                      disabled={changing}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-700 shadow-subtle-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                    >
                      {changing ? "迁移中..." : "更改路径"}
                    </button>
                  </div>
                </div>
              </section>

              {/* Quick Clean Actions */}
              <section>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  即时清理动作
                </label>
                <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-subtle-sm space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCleanExpired}
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 active:scale-95"
                    >
                      执行到期清理
                    </button>
                    <button
                      type="button"
                      onClick={handleClearUnpinned}
                      className="flex-1 rounded-lg border border-rose-200 bg-rose-50 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 active:scale-95"
                    >
                      清除非置顶记录
                    </button>
                  </div>
                  {actionMsg && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-center text-xs font-medium text-emerald-700">
                      ✓ {actionMsg}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Error Message if any */}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="border-t border-slate-200/80 bg-slate-50/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-[13px] font-medium text-slate-600 shadow-subtle-sm transition hover:bg-slate-50 hover:text-slate-800 active:scale-[0.97]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || autostartBusy}
              className="flex-1 rounded-xl bg-blue-600 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(37,99,235,0.3)] transition hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "正在保存..." : "保存设置"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
