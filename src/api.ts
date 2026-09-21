import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ClipItem, Settings, RunningAppInfo } from "./types";

export const api = {
  getHistory: (limit = 200) => invoke<ClipItem[]>("get_history", { limit }),
  pasteItem: (id: number) => invoke<void>("paste_item", { id }),
  deleteItem: (id: number) => invoke<void>("delete_item", { id }),
  clearAll: () => invoke<void>("clear_all"),
  togglePin: (id: number) => invoke<boolean>("toggle_pin", { id }),
  copyItem: (id: number) => invoke<void>("copy_item", { id }),
  getSettings: () => invoke<Settings>("get_settings"),
  setMaxCount: (n: number) => invoke<void>("set_max_count", { n }),
  setHotkey: (hotkey: string) => invoke<void>("set_hotkey", { hotkey }),
  setAutostart: (enabled: boolean) => invoke<void>("set_autostart", { enabled }),
  setReplaceSystemClipboard: (enabled: boolean) =>
    invoke<void>("set_replace_system_clipboard", { enabled }),
  hideWindow: () => invoke<void>("hide_window"),
  getDataDir: () => invoke<string>("get_data_dir"),
  openDataDir: () => invoke<void>("open_data_dir"),
  changeDataDir: (newDir: string) => invoke<void>("change_data_dir", { newDir }),
  isListenerPaused: () => invoke<boolean>("is_listener_paused"),
  setListenerPaused: (paused: boolean) => invoke<boolean>("set_listener_paused", { paused }),
  pasteCleanText: (text: string) => invoke<void>("paste_clean_text", { text }),
  openBrowserUrl: (url: string) => invoke<void>("open_browser_url", { url }),
  getRunningApps: () => invoke<RunningAppInfo[]>("get_running_apps"),
  getIgnoredApps: () => invoke<string[]>("get_ignored_apps"),
  setIgnoredApps: (apps: string[]) => invoke<void>("set_ignored_apps", { apps }),
  isOnboardingCompleted: () => invoke<boolean>("is_onboarding_completed"),
  setOnboardingCompleted: (completed: boolean) =>
    invoke<void>("set_onboarding_completed", { completed }),
  openOnboardingWindow: () => invoke<void>("open_onboarding_window"),
  finishOnboarding: () => invoke<void>("finish_onboarding"),
};

export async function onClipboardUpdated(cb: () => void): Promise<UnlistenFn> {
  return listen("clipboard://updated", cb);
}

export async function onOpenSettings(cb: () => void): Promise<UnlistenFn> {
  return listen("app://open-settings", cb);
}
