import { useRef } from "react";
import { SearchIcon, SettingsIcon, TrashIcon, CloseIcon } from "./Icons";

export type CategoryFilter = "all" | "text" | "image" | "pinned";

interface Props {
  query: string;
  totalCount: number;
  pinnedCount: number;
  activeFilter: CategoryFilter;
  onFilterChange: (filter: CategoryFilter) => void;
  onQueryChange: (value: string) => void;
  onOpenSettings: () => void;
  onClear: () => void;
}

const TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "text", label: "文本" },
  { id: "image", label: "图片" },
  { id: "pinned", label: "已置顶" },
];

export function Header({
  query,
  totalCount,
  pinnedCount,
  activeFilter,
  onFilterChange,
  onQueryChange,
  onOpenSettings,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="relative z-10 select-none border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 pt-3.5 pb-2.5">
      {/* Top Bar: Brand, Stats & Action Buttons */}
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0" data-tauri-drag-region>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.3)]" data-tauri-drag-region>
            <svg
              width="15"
              height="15"
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
          <div className="min-w-0" data-tauri-drag-region>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold tracking-[-0.01em] text-slate-800" data-tauri-drag-region>
                ClipFlow
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 tabular-nums">
                {totalCount}
              </span>
              {pinnedCount > 0 && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 tabular-nums">
                  {pinnedCount} 置顶
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons with Emil-style micro-interactions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={onOpenSettings}
            title="偏好设置"
            aria-label="设置"
            className="group flex h-7.5 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-subtle-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.96]"
          >
            <SettingsIcon className="text-slate-400 transition-colors group-hover:text-slate-600" />
            <span>设置</span>
          </button>
          <button
            onClick={onClear}
            title="清空非置顶记录"
            aria-label="清空记录"
            className="group flex h-7.5 items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-subtle-sm transition-all duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.96]"
          >
            <TrashIcon className="text-slate-400 transition-colors group-hover:text-rose-500" />
            <span>清空</span>
          </button>
        </div>
      </div>

      {/* Modern Search Bar */}
      <div
        className="group relative mb-2.5 flex cursor-text items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 shadow-inner-light transition-all duration-200 focus-within:border-blue-500/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/15"
        onPointerDown={(e) => {
          if (e.target !== inputRef.current) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        <SearchIcon className="shrink-0 text-slate-400 transition-colors group-focus-within:text-blue-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索剪贴板记录或图片..."
          className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 active:scale-90"
            title="清除搜索"
          >
            <CloseIcon width="12" height="12" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200/70 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 shadow-sm">
            ESC
          </kbd>
        )}
      </div>

      {/* Category Filter Tabs (Windows 11 / Raycast style) */}
      <div className="flex items-center gap-1 rounded-lg bg-slate-100/80 p-0.5 text-xs">
        {TABS.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id)}
              className={`flex-1 rounded-md py-1 text-center font-medium transition-all duration-150 active:scale-[0.97] ${
                isActive
                  ? "bg-white text-blue-600 shadow-subtle-sm font-semibold"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
