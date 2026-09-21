import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import type { Settings } from "../types";
import { CloseIcon, FolderIcon, KeyboardIcon } from "./Icons";

const REPLACEMENT_HOTKEY = "Win+V";

interface Props {
  open: boolean;
  settings: Settings;
  draft: Settings;
  saving: boolean;
  autostartBusy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onChange: (next: Settings) => void;
  onToggleAutostart: () => void;
  onToggleReplaceSystemClipboard: () => void;
}

const HOTKEY_PRESETS = ["Alt+V", "Win+Shift+V", "Ctrl+Alt+V", "Alt+Space"];

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

export function SettingsPanel({
  open,
  settings,
  draft,
  saving,
  autostartBusy,
  error,
  onClose,
  onSave,
  onChange,
  onToggleAutostart,
  onToggleReplaceSystemClipboard,
}: Props) {
  const [dataDir, setDataDir] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (open) {
      api.getDataDir().then(setDataDir).catch(console.error);
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
        className={`absolute inset-y-0 right-0 z-10 flex w-full max-w-[360px] flex-col bg-white shadow-subtle-modal border-l border-slate-200/80 transition-transform duration-260 ease-spring ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3.5 bg-slate-50/60">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800">偏好设置</h2>
            <p className="text-xs text-slate-500">热键、容量、自启动与存储配置</p>
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

        {/* Scrollable Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 select-none">
          {/* Section: History Capacity */}
          <section>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              历史记录容量
            </label>
            <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">最大保留条数</div>
                  <div className="mt-0.5 text-xs text-slate-500">超出限制自动淘汰，已置顶项不受影响</div>
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
                  className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-right text-[13px] font-semibold text-slate-800 tabular-nums focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                />
              </div>
            </div>
          </section>

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
                  <span>{draft.replaceSystemClipboard ? REPLACEMENT_HOTKEY : settings.hotkey}</span>
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

          {/* Section: System Switches */}
          <section className="space-y-2.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              系统集成
            </label>

            <SwitchToggle
              checked={draft.replaceSystemClipboard}
              disabled={saving}
              title="替代 Windows 剪贴板历史"
              description="关闭系统自带的 Win+V 剪贴板历史，由本应用直接接管 Win+V。"
              onChange={onToggleReplaceSystemClipboard}
            />

            <SwitchToggle
              checked={draft.autostartEnabled}
              disabled={autostartBusy || saving}
              title="开机自动启动"
              description={autostartBusy ? "正在写入自启设置..." : "随 Windows 开机静默启动并在系统托盘常驻。"}
              onChange={onToggleAutostart}
            />
          </section>

          {/* Section: Storage Location */}
          <section>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              数据存储
            </label>
            <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
              <div className="flex items-center gap-2">
                <FolderIcon className="text-blue-600" />
                <span className="text-[13px] font-semibold text-slate-800">存储目录</span>
              </div>
              <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200/60 p-2 text-xs font-mono text-slate-600 break-all select-text">
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
              <p className="mt-1.5 text-[11px] text-slate-400">
                更改后将自动把数据库与截图迁移至新目录并重新加载。
              </p>
            </div>
          </section>

          {/* Section: Setup Wizard */}
          <section>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              新手引导与向导
            </label>
            <div className="mt-1.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">首次运行向导</div>
                  <div className="mt-0.5 text-xs text-slate-500">重新运行分步设置向导与忽略应用穿梭配置</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    api.openOnboardingWindow();
                    onClose();
                  }}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 active:scale-95"
                >
                  打开向导
                </button>
              </div>
            </div>
          </section>

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
