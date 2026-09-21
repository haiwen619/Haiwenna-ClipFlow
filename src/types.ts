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
  captureText: boolean;
  captureImages: boolean;
  maxTextSizeMb: number;
  maxImageSizeMb: number;
  pastePlainText: boolean;
  retentionDays: number;
  positionMode: "caret" | "cursor" | "center" | string;
}

export interface StorageStats {
  dbSizeBytes: number;
  imagesSizeBytes: number;
  totalSizeBytes: number;
  itemCount: number;
}

export interface RunningAppInfo {
  name: string;
  title: string;
  process_name: string;
}


