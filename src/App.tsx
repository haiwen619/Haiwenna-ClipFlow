import { useCallback, useEffect, useState } from "react";
import { api, onClipboardUpdated, onOpenSettings } from "./api";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { ClipItem, Settings } from "./types";
import { Header, type CategoryFilter } from "./components/Header";
import { ClipList } from "./components/ClipList";
import { SettingsPanel } from "./components/SettingsPanel";
import { CheckIcon } from "./components/Icons";

const DEFAULT_SETTINGS: Settings = {
  maxCount: 50,
  hotkey: "Alt+V",
  autostartEnabled: false,
  replaceSystemClipboard: false,
};
const REPLACEMENT_HOTKEY = "Win+V";

function normalizeHotkeyInput(hotkey: string) {
  const trimmed = hotkey.trim() || DEFAULT_SETTINGS.hotkey;
  const compact = trimmed.replace(/\s+/g, "").toLowerCase();
  if (compact === "ctrl+space" || compact === "control+space") {
    return DEFAULT_SETTINGS.hotkey;
  }
  return trimmed;
}

export default function App() {
  const [items, setItems] = useState<ClipItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>("all");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    const t = setTimeout(() => setToastText(null), 1500);
    return () => clearTimeout(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setItems(await api.getHistory(200));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const next = await api.getSettings();
      setSettings(next);
      setDraftSettings(next);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    refresh();
    loadSettings();
    api.isListenerPaused().then(setIsPaused).catch(console.error);

    let unlistenClipboard: (() => void) | undefined;
    let unlistenSettings: (() => void) | undefined;

    onClipboardUpdated(refresh).then((u) => (unlistenClipboard = u));
    onOpenSettings(() => {
      setSettingsOpen(true);
      setSettingsError(null);
      refresh();
      loadSettings();
    }).then((u) => (unlistenSettings = u));

    const onFocus = () => {
      refresh();
      api.isListenerPaused().then(setIsPaused).catch(console.error);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
        api.isListenerPaused().then(setIsPaused).catch(console.error);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      unlistenClipboard?.();
      unlistenSettings?.();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadSettings, refresh]);

  // Combined Query + Category Filter
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    // 1. Category check
    if (activeFilter === "text" && item.kind !== "text") return false;
    if (activeFilter === "image" && item.kind !== "image") return false;
    if (activeFilter === "pinned" && !item.pinned) return false;

    // 2. Query check
    if (!normalizedQuery) return true;
    const text = (item.text ?? "").toLowerCase();
    const tags = item.kind === "image" ? "图片" : "文本";
    return text.includes(normalizedQuery) || tags.includes(normalizedQuery);
  });

  const pinnedCount = items.filter((item) => item.pinned).length;

  // Reset focus when query or filter changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [query, activeFilter]);

  // Ensure focusedIndex is within bounds
  useEffect(() => {
    if (focusedIndex >= filteredItems.length && filteredItems.length > 0) {
      setFocusedIndex(filteredItems.length - 1);
    }
  }, [filteredItems.length, focusedIndex]);

  const handlePaste = async (id: number) => {
    await api.pasteItem(id);
  };

  const handleDelete = async (id: number) => {
    await api.deleteItem(id);
    refresh();
  };

  const handleTogglePin = async (id: number) => {
    await api.togglePin(id);
    refresh();
  };

  const handleCopy = async (id: number) => {
    await api.copyItem(id);
    showToast("已复制到系统剪贴板");
    setTimeout(() => {
      api.hideWindow();
    }, 250);
  };

  const handlePasteClean = async (text: string) => {
    try {
      await api.pasteCleanText(text);
      showToast("已纯文本格式粘贴");
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePause = async () => {
    try {
      const next = !isPaused;
      await api.setListenerPaused(next);
      setIsPaused(next);
      showToast(next ? "已暂停监听（隐私模式开启）" : "已恢复监听");
    } catch (e) {
      console.error(e);
    }
  };

  // Keyboard navigation & quick actions
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
          setSettingsError(null);
          setDraftSettings(settings);
        } else {
          api.hideWindow();
        }
        return;
      }

      if (settingsOpen) return;

      const isInputFocused =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(filteredItems.length - 1, i + 1));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(0, i - 1));
        return;
      }

      if (e.key === "Enter") {
        if (filteredItems[focusedIndex]) {
          e.preventDefault();
          handlePaste(filteredItems[focusedIndex].id);
        }
        return;
      }

      // Single-key actions when not typing in an input
      if (!isInputFocused) {
        if (/^[1-9]$/.test(e.key)) {
          const idx = Number(e.key) - 1;
          if (filteredItems[idx]) {
            e.preventDefault();
            handlePaste(filteredItems[idx].id);
          }
          return;
        }

        const currentItem = filteredItems[focusedIndex];
        if (!currentItem) return;

        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          handleTogglePin(currentItem.id);
          return;
        }

        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          handleDelete(currentItem.id);
          return;
        }

        if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          handleCopy(currentItem.id);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [settings, settingsOpen, filteredItems, focusedIndex]);

  const handleClear = async () => {
    await api.clearAll();
    refresh();
    showToast("已清理非置顶记录");
  };

  const handleOpenSettings = () => {
    setSettingsError(null);
    setDraftSettings(settings);
    setSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setSettingsError(null);
    setDraftSettings(settings);
    setSettingsOpen(false);
  };

  const handleSaveSettings = async () => {
    const normalizedHotkey = normalizeHotkeyInput(draftSettings.hotkey);
    const next: Settings = {
      maxCount: Math.min(500, Math.max(1, Number(draftSettings.maxCount) || 50)),
      hotkey: draftSettings.replaceSystemClipboard
        ? REPLACEMENT_HOTKEY
        : normalizedHotkey === REPLACEMENT_HOTKEY
          ? DEFAULT_SETTINGS.hotkey
          : normalizedHotkey,
      autostartEnabled: draftSettings.autostartEnabled,
      replaceSystemClipboard: draftSettings.replaceSystemClipboard,
    };

    setSettingsBusy(true);
    setSettingsError(null);
    try {
      if (next.maxCount !== settings.maxCount) {
        await api.setMaxCount(next.maxCount);
      }
      if (next.hotkey !== settings.hotkey) {
        let hotkeyAfterReplacement = settings.hotkey;
        if (next.replaceSystemClipboard !== settings.replaceSystemClipboard) {
          await api.setReplaceSystemClipboard(next.replaceSystemClipboard);
          hotkeyAfterReplacement = next.replaceSystemClipboard
            ? REPLACEMENT_HOTKEY
            : settings.hotkey === REPLACEMENT_HOTKEY
              ? DEFAULT_SETTINGS.hotkey
              : settings.hotkey;
        }
        if (next.hotkey !== hotkeyAfterReplacement) {
          await api.setHotkey(next.hotkey);
        }
      } else if (next.replaceSystemClipboard !== settings.replaceSystemClipboard) {
        await api.setReplaceSystemClipboard(next.replaceSystemClipboard);
      }
      if (next.autostartEnabled !== settings.autostartEnabled) {
        await api.setAutostart(next.autostartEnabled);
      }
      setSettings(next);
      setDraftSettings(next);
      setSettingsOpen(false);
      refresh();
      showToast("设置已保存");
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : String(e));
    } finally {
      setSettingsBusy(false);
    }
  };

  const handleToggleAutostart = async () => {
    if (autostartBusy || settingsBusy) {
      return;
    }

    const previousEnabled = settings.autostartEnabled;
    const nextEnabled = !draftSettings.autostartEnabled;
    setAutostartBusy(true);
    setSettingsError(null);
    setDraftSettings((current) => ({
      ...current,
      autostartEnabled: nextEnabled,
    }));

    try {
      await api.setAutostart(nextEnabled);
      setSettings((current) => ({
        ...current,
        autostartEnabled: nextEnabled,
      }));
    } catch (e) {
      setDraftSettings((current) => ({
        ...current,
        autostartEnabled: previousEnabled,
      }));
      setSettingsError(e instanceof Error ? e.message : String(e));
    } finally {
      setAutostartBusy(false);
    }
  };

  const handleToggleReplaceSystemClipboard = () => {
    if (settingsBusy) {
      return;
    }

    setDraftSettings((current) => ({
      ...current,
      replaceSystemClipboard: !current.replaceSystemClipboard,
      hotkey: !current.replaceSystemClipboard
        ? REPLACEMENT_HOTKEY
        : current.hotkey === REPLACEMENT_HOTKEY
          ? DEFAULT_SETTINGS.hotkey
          : current.hotkey,
    }));
  };

  return (
    <div className="app-shell relative flex h-full w-full flex-col overflow-hidden bg-slate-50 text-slate-800 antialiased select-none border border-slate-200/90 shadow-2xl">
      {/* Subtle top ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white via-white/50 to-transparent" />

      {/* Main App Layout */}
      <div className="relative flex h-full w-full flex-col overflow-hidden">
        <Header
          query={query}
          totalCount={items.length}
          pinnedCount={pinnedCount}
          isPaused={isPaused}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onQueryChange={setQuery}
          onOpenSettings={handleOpenSettings}
          onClear={handleClear}
          onTogglePause={handleTogglePause}
        />

        <ClipList
          items={filteredItems}
          hasQuery={normalizedQuery.length > 0}
          focusedIndex={focusedIndex}
          onPaste={handlePaste}
          onDelete={handleDelete}
          onTogglePin={handleTogglePin}
          onCopy={handleCopy}
          onPasteClean={handlePasteClean}
          onPreview={(src) => {
            new WebviewWindow("image-preview", {
              url: `preview.html?src=${encodeURIComponent(src)}`,
              title: "ClipFlow - 图片预览",
              width: 1024,
              height: 768,
              center: true,
              decorations: true,
              resizable: true,
            });
          }}
        />
      </div>

      {/* Settings Drawer Panel */}
      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        draft={draftSettings}
        saving={settingsBusy}
        autostartBusy={autostartBusy}
        error={settingsError}
        onClose={handleCloseSettings}
        onSave={handleSaveSettings}
        onChange={setDraftSettings}
        onToggleAutostart={handleToggleAutostart}
        onToggleReplaceSystemClipboard={handleToggleReplaceSystemClipboard}
      />

      {/* Emil-style Floating Micro-Toast Feedback */}
      {toastText && (
        <div className="toast-enter pointer-events-none fixed bottom-4 left-1/2 z-50 flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-xl backdrop-blur-md">
          <CheckIcon className="text-emerald-400" />
          <span>{toastText}</span>
        </div>
      )}
    </div>
  );
}
