export type ClipKind = "text" | "image";

export interface ClipItem {
  id: number;
  kind: ClipKind;
  text: string | null;
  imagePath: string | null;
  createdAt: number;
  pinned: boolean;
}

export interface Settings {
  maxCount: number;
  hotkey: string;
  autostartEnabled: boolean;
  replaceSystemClipboard: boolean;
}

export interface RunningAppInfo {
  name: string;
  title: string;
  process_name: string;
}

