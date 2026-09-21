import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "./api";
import type { RunningAppInfo, Settings } from "./types";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  DatabaseIcon,
  FolderIcon,
  KeyboardIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  ShieldOffIcon,
  SparklesIcon,
} from "./components/Icons";
import "./index.css";

const TOTAL_STEPS = 6;
const HOTKEY_PRESETS = ["Alt+V", "Win+Shift+V", "Ctrl+Alt+V", "Alt+Space"];
const DEFAULT_PRESET_IGNORED = [
  "1Password.exe",
  "Bitwarden.exe",
  "KeePass.exe",
  "KeePassXC.exe",
  "LastPass.exe",
  "CredentialUIBroker.exe",
];

function SwitchToggle({
  checked,
  disabled,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  onChange: () => void;
}) {
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

      <div
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-spring focus:outline-none ${
          checked ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-spring ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </div>
  );
}

function OnboardingApp() {
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<Settings>({
    maxCount: 50,
    hotkey: "Alt+V",
    autostartEnabled: false,
    replaceSystemClipboard: false,
  });
  const [dataDir, setDataDir] = useState<string>("");
  const [ignoredApps, setIgnoredApps] = useState<string[]>([]);
  const [runningApps, setRunningApps] = useState<RunningAppInfo[]>([]);
  const [selectedToIgnore, setSelectedToIgnore] = useState<string[]>([]);
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [customAppInput, setCustomAppInput] = useState("");
  const [loadingApps, setLoadingApps] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 1800);
  };

  useEffect(() => {
    // Load initial configurations
    api.getSettings().then(setSettings).catch(console.error);
    api.getDataDir().then(setDataDir).catch(console.error);
    api.getIgnoredApps().then((apps) => {
      if (apps.length === 0) {
        setIgnoredApps(DEFAULT_PRESET_IGNORED);
      } else {
        setIgnoredApps(apps);
      }
    }).catch(console.error);
    loadRunningApps();
  }, []);

  const loadRunningApps = async () => {
    setLoadingApps(true);
    try {
      const apps = await api.getRunningApps();
      setRunningApps(apps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  const handleToggleAutostart = async () => {
    const next = !settings.autostartEnabled;
    try {
      await api.setAutostart(next);
      setSettings((s) => ({ ...s, autostartEnabled: next }));
      showToast(next ? "已启用开机自启" : "已关闭开机自启");
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleReplaceClipboard = async () => {
    const next = !settings.replaceSystemClipboard;
    try {
      await api.setReplaceSystemClipboard(next);
      setSettings((s) => ({
        ...s,
        replaceSystemClipboard: next,
        hotkey: next ? "Win+V" : s.hotkey === "Win+V" ? "Alt+V" : s.hotkey,
      }));
      showToast(next ? "已接管 Win+V 系统历史" : "已恢复原生设置");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectHotkey = async (key: string) => {
    try {
      await api.setHotkey(key);
      setSettings((s) => ({ ...s, hotkey: key }));
      showToast(`快捷键已设为 ${key}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoveToIgnored = async () => {
    if (selectedToIgnore.length === 0) return;
    const next = Array.from(new Set([...ignoredApps, ...selectedToIgnore]));
    setIgnoredApps(next);
    setSelectedToIgnore([]);
    try {
      await api.setIgnoredApps(next);
      showToast(`已添加 ${selectedToIgnore.length} 个忽略应用`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveIgnored = async (app: string) => {
    const next = ignoredApps.filter((a) => a !== app);
    setIgnoredApps(next);
    try {
      await api.setIgnoredApps(next);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCustomApp = async () => {
    const trimmed = customAppInput.trim();
    if (!trimmed) return;
    const formatted = trimmed.endsWith(".exe") ? trimmed : `${trimmed}.exe`;
    if (!ignoredApps.some((a) => a.toLowerCase() === formatted.toLowerCase())) {
      const next = [...ignoredApps, formatted];
      setIgnoredApps(next);
      try {
        await api.setIgnoredApps(next);
        setCustomAppInput("");
        showToast(`已将 ${formatted} 加入忽略名单`);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleChangeDataDir = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "选择 Haiwenna ClipFlow 数据存储目录",
      });
      if (selected && typeof selected === "string") {
        await api.changeDataDir(selected);
        setDataDir(selected);
        showToast("存储目录已更新");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinish = async () => {
    try {
      await api.setIgnoredApps(ignoredApps);
      showToast("设置完成！正在开启体验...");
      setTimeout(async () => {
        try {
          await api.finishOnboarding();
        } catch (e) {
          console.error(e);
          const win = getCurrentWebviewWindow();
          await win.close();
        }
      }, 300);
    } catch (e) {
      console.error(e);
    }
  };

  // Filter lists for Step 4
  const availableAppsToIgnore = runningApps.filter(
    (app) =>
      !ignoredApps.some((ig) => ig.toLowerCase() === app.process_name.toLowerCase()) &&
      (app.name.toLowerCase().includes(leftSearch.toLowerCase()) ||
        app.process_name.toLowerCase().includes(leftSearch.toLowerCase()) ||
        app.title.toLowerCase().includes(leftSearch.toLowerCase()))
  );

  const displayedIgnoredApps = ignoredApps.filter((a) =>
    a.toLowerCase().includes(rightSearch.toLowerCase())
  );

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-800 antialiased select-none">
      {/* Top Ambient Glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-50/70 via-white/40 to-transparent" />

      {/* Header with Progress Bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/75 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Smooth Step Bar */}
          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-spring"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            {step} / {TOTAL_STEPS}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200/80 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-500 shadow-subtle-sm">
            简体中文 · v0.1.0
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative flex flex-1 flex-col overflow-y-auto px-8 py-6">
        {/* Step 1: Welcome & Features */}
        {step === 1 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center max-w-xl mx-auto animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)] mb-4 ring-4 ring-blue-100">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              欢迎使用 Haiwenna ClipFlow
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
              新一代智能 Windows 剪贴板管理器，帮你更快搜索、整理和复用剪贴板历史。
            </p>

            {/* 3 Horizontal Feature Cards */}
            <div className="mt-6 grid grid-cols-3 gap-3.5 text-left w-full">
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-subtle-sm transition hover:border-blue-200 hover:shadow-subtle-hover">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="8" height="4" x="8" y="2" rx="1" />
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  </svg>
                </div>
                <div className="text-[13px] font-semibold text-slate-800">自动记录</div>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  自动收录文本、图片和文件记录，重要内容不用再反复复制。
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-subtle-sm transition hover:border-blue-200 hover:shadow-subtle-hover">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 mb-2.5">
                  <SearchIcon width="18" height="18" />
                </div>
                <div className="text-[13px] font-semibold text-slate-800">即时搜索</div>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  按关键词、类型快速定位，分类过滤 Tabs 毫秒级瞬间响应。
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-subtle-sm transition hover:border-blue-200 hover:shadow-subtle-hover">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 mb-2.5">
                  <SparklesIcon width="18" height="18" />
                </div>
                <div className="text-[13px] font-semibold text-slate-800">高效复用</div>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  全键盘光标跟随、回车直贴、1-9 快捷速贴与颜色直观取色。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Permissions & Autostart */}
        {step === 2 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center max-w-lg mx-auto animate-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 border border-blue-100 shadow-sm">
              <ShieldIcon width="28" height="28" />
            </div>

            <h2 className="text-xl font-bold text-slate-900">开启必要权限与自启</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              ClipFlow 在 Windows 上支持开机自启并在托盘静默驻留，完成日常系统级工作流。
            </p>

            <div className="mt-6 w-full space-y-3 text-left">
              <SwitchToggle
                checked={settings.autostartEnabled}
                onChange={handleToggleAutostart}
                title="开机自动启动"
                description="随 Windows 系统启动时静默进入后台托盘，随时待命，即开即用。"
              />

              <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 mt-0.5">
                  <CheckIcon width="16" height="16" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">系统托盘常驻</div>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                    关闭主窗口时仅最小化隐藏至托盘，不占用任务栏空间；右键托盘图标可快速调出设置或退出。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Hotkeys & Win+V Takeover */}
        {step === 3 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center max-w-lg mx-auto animate-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 border border-blue-100 shadow-sm">
              <KeyboardIcon width="28" height="28" />
            </div>

            <h2 className="text-xl font-bold text-slate-900">设置呼出快捷键</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              设置呼出剪贴板的全局热键，也可以在此开启无缝接管 Windows 原生 Win+V。
            </p>

            <div className="mt-6 w-full space-y-3.5 text-left">
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-subtle-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-800">打开剪贴板窗口</div>
                    <div className="mt-0.5 text-xs text-slate-500">按下快捷键随时呼出或隐藏剪贴板窗口</div>
                  </div>
                  <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {settings.hotkey}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {HOTKEY_PRESETS.map((key) => (
                    <button
                      key={key}
                      onClick={() => handleSelectHotkey(key)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                        settings.hotkey === key
                          ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

              <SwitchToggle
                checked={settings.replaceSystemClipboard}
                onChange={handleToggleReplaceClipboard}
                title="接管 Win+V"
                description="按 Win+V 唤起 ClipFlow，自动停用 Windows 系统原生剪贴板历史面板。"
              />
            </div>
          </div>
        )}

        {/* Step 4: Ignore Applications (Dual Transfer Layout) */}
        {step === 4 && (
          <div className="flex flex-1 flex-col max-w-2xl mx-auto w-full animate-fade-in">
            <div className="text-center mb-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-2 border border-amber-100 shadow-sm">
                <ShieldOffIcon width="24" height="24" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">设置忽略应用 (Privacy Guard)</h2>
              <p className="mt-1 text-[12px] text-slate-500 max-w-lg mx-auto leading-relaxed">
                选择不需要记录的来源应用，密码管理器或隐私窗口均可加入；右侧列表中的应用在复制时不会被写入剪贴板历史。
              </p>
            </div>

            {/* Transfer Box Columns */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 flex-1 min-h-[260px]">
              {/* Left Column: Running & Available Apps */}
              <div className="flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-3 shadow-subtle-sm overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">可忽略的应用</span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium text-slate-500">
                      {availableAppsToIgnore.length} 项
                    </span>
                  </div>
                  <button
                    onClick={loadRunningApps}
                    title="刷新当前运行应用"
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <RefreshIcon className={loadingApps ? "animate-spin" : ""} width="13" height="13" />
                  </button>
                </div>

                <div className="mt-2 relative">
                  <SearchIcon className="absolute left-2.5 top-2 text-slate-400" width="12" height="12" />
                  <input
                    value={leftSearch}
                    onChange={(e) => setLeftSearch(e.target.value)}
                    placeholder="搜索应用或进程..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-7 pr-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="mt-2 flex-1 overflow-y-auto space-y-1 pr-1">
                  {availableAppsToIgnore.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center text-xs text-slate-400 text-center">
                      <span>暂无可添加的应用</span>
                    </div>
                  ) : (
                    availableAppsToIgnore.map((app) => {
                      const isChecked = selectedToIgnore.includes(app.process_name);
                      return (
                        <label
                          key={app.process_name}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition cursor-pointer ${
                            isChecked ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedToIgnore((prev) =>
                                prev.includes(app.process_name)
                                  ? prev.filter((p) => p !== app.process_name)
                                  : [...prev, app.process_name]
                              );
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="truncate flex-1" title={`${app.name} (${app.process_name})`}>
                            {app.name}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
                            {app.process_name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Transfer Move Button */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleMoveToIgnored}
                  disabled={selectedToIgnore.length === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  title="移至忽略列表"
                >
                  <ArrowRightIcon />
                </button>
              </div>

              {/* Right Column: Ignored Apps List */}
              <div className="flex h-full flex-col rounded-xl border border-slate-200/80 bg-white p-3 shadow-subtle-sm overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-700">已忽略的应用</span>
                    <span className="rounded-full bg-amber-50 px-1.5 py-0.2 text-[10px] font-medium text-amber-700">
                      {ignoredApps.length} 项
                    </span>
                  </div>
                </div>

                <div className="mt-2 relative">
                  <SearchIcon className="absolute left-2.5 top-2 text-slate-400" width="12" height="12" />
                  <input
                    value={rightSearch}
                    onChange={(e) => setRightSearch(e.target.value)}
                    placeholder="搜索已忽略名单..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-7 pr-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="mt-2 flex gap-1.5">
                  <input
                    value={customAppInput}
                    onChange={(e) => setCustomAppInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCustomApp()}
                    placeholder="输入进程名如 code.exe"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                  />
                  <button
                    onClick={handleAddCustomApp}
                    className="flex h-7 items-center justify-center rounded-lg bg-slate-100 px-2 text-xs font-medium text-slate-700 hover:bg-slate-200 active:scale-95"
                    title="添加自定义进程"
                  >
                    <PlusIcon width="13" height="13" />
                  </button>
                </div>

                <div className="mt-2 flex-1 overflow-y-auto space-y-1 pr-1">
                  {displayedIgnoredApps.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center text-xs text-slate-400 text-center">
                      <span>暂未设置忽略应用</span>
                    </div>
                  ) : (
                    displayedIgnoredApps.map((proc) => (
                      <div
                        key={proc}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100/80"
                      >
                        <span className="font-mono text-[11px] truncate">{proc}</span>
                        <button
                          onClick={() => handleRemoveIgnored(proc)}
                          className="text-slate-400 hover:text-rose-600 transition"
                          title="移出忽略名单"
                        >
                          <CloseIcon width="12" height="12" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Data Storage */}
        {step === 5 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center max-w-lg mx-auto animate-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 border border-blue-100 shadow-sm">
              <DatabaseIcon width="28" height="28" />
            </div>

            <h2 className="text-xl font-bold text-slate-900">数据存储与离线安全</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              本地 SQLite 数据库与图片完整离线保存，杜绝任何云端泄漏，支持自定义数据目录。
            </p>

            <div className="mt-6 w-full space-y-3.5 text-left">
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-subtle-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <FolderIcon />
                  <span className="text-[13px] font-semibold">当前本地数据路径</span>
                </div>
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-600 break-all select-text">
                  {dataDir || "加载中..."}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => api.openDataDir()}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
                  >
                    在文件管理器中打开
                  </button>
                  <button
                    onClick={handleChangeDataDir}
                    className="flex-1 rounded-lg border border-blue-200 bg-blue-50 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                  >
                    更改数据目录
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-800 flex items-start gap-2">
                <span>🔒</span>
                <span>所有历史记录、置顶内容与图片缓存均直接写入本地，无需网络连接，随时随地可用。</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Ready & Tips */}
        {step === 6 && (
          <div className="flex flex-1 flex-col items-center justify-center text-center max-w-xl mx-auto animate-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100 shadow-sm">
              <CheckIcon width="28" height="28" />
            </div>

            <h2 className="text-xl font-bold text-slate-900">配置完成，全部准备就绪！</h2>
            <p className="mt-1 text-[13px] text-slate-500">
              你已完成 Haiwenna ClipFlow 的初始向导，这里有几个极速上手的小秘籍：
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 text-left w-full">
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                <div className="flex items-center gap-1.5 text-blue-600 font-semibold text-xs">
                  <span>⌨️</span>
                  <span>光标跟随唤起</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  按快捷键，面板优先自动吸附在当前窗口的文本输入光标旁，直观易选。
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                  <span>↵</span>
                  <span>穿梭与回车直接粘贴</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  按 <kbd className="rounded border bg-slate-100 px-1 py-0.2">↑</kbd>{" "}
                  <kbd className="rounded border bg-slate-100 px-1 py-0.2">↓</kbd> 穿梭选择，按下{" "}
                  <kbd className="rounded border bg-slate-100 px-1 py-0.2">Enter</kbd> 瞬间贴入当前文档。
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                <div className="flex items-center gap-1.5 text-purple-600 font-semibold text-xs">
                  <span>🔢</span>
                  <span>1-9 键单键速贴</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  列表状态下直接按下数字键 1 ~ 9，瞬间粘贴对应序号的剪贴板历史。
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
                <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-xs">
                  <span>🛡️</span>
                  <span>一键隐私幽灵模式</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  临时复制密码或私钥前，点击顶栏护盾进入隐私模式，绝不存盘入库。
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Navigation Buttons */}
      <footer className="relative z-10 flex items-center justify-between border-t border-slate-200/80 bg-white/80 px-8 py-3.5 backdrop-blur-md">
        <div>
          {step > 1 ? (
            <button
              onClick={handlePrev}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-subtle-sm transition hover:bg-slate-50 active:scale-[0.97]"
            >
              <ArrowLeftIcon />
              <span>上一步</span>
            </button>
          ) : (
            <div />
          )}
        </div>

        <div className="flex items-center gap-3">
          {step === 1 && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.97]"
            >
              <span>开始设置</span>
              <ArrowRightIcon />
            </button>
          )}

          {step > 1 && step < TOTAL_STEPS && (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.97]"
            >
              <span>下一步</span>
              <ArrowRightIcon />
            </button>
          )}

          {step === TOTAL_STEPS && (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-6 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-700 active:scale-[0.97]"
            >
              <CheckIcon />
              <span>完成并开始使用</span>
            </button>
          )}
        </div>
      </footer>

      {/* Floating Micro-Toast */}
      {toastMsg && (
        <div className="toast-enter pointer-events-none fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-xl backdrop-blur-md">
          <CheckIcon className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <OnboardingApp />
  </React.StrictMode>
);
