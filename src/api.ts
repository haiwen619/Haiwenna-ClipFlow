import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ClipItem, Settings } from "./types";

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
};

export async function onClipboardUpdated(cb: () => void): Promise<UnlistenFn> {
  return listen("clipboard://updated", cb);
}

export async function onOpenSettings(cb: () => void): Promise<UnlistenFn> {
  return listen("app://open-settings", cb);
}
