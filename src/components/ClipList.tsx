import type { ClipItem as Item } from "../types";
import { ClipItem } from "./ClipItem";
import { SearchIcon } from "./Icons";

interface Props {
  items: Item[];
  hasQuery: boolean;
  onPaste: (id: number) => void;
  onDelete: (id: number) => void;
  onTogglePin: (id: number) => void;
  onCopy: (id: number) => void;
  onPreview: (src: string) => void;
}

export function ClipList({
  items,
  hasQuery,
  onPaste,
  onDelete,
  onTogglePin,
  onCopy,
  onPreview,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center select-none">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-slate-100 shadow-subtle-sm text-slate-400 mb-3.5">
          {hasQuery ? (
            <SearchIcon width="24" height="24" />
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <path d="M12 11h4" />
              <path d="M12 16h4" />
              <path d="M8 11h.01" />
              <path d="M8 16h.01" />
            </svg>
          )}
        </div>

        <div className="text-[14px] font-semibold text-slate-700">
          {hasQuery ? "没有匹配的记录" : "剪贴板还是空的"}
        </div>
        <p className="mt-1 max-w-[240px] text-xs text-slate-400 leading-relaxed">
          {hasQuery
            ? "尝试换个关键词，或者切换上方的分类标签"
            : "复制任何文本、图片或文件路径，随时呼出使用"}
        </p>

        {!hasQuery && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1 text-[11px] font-medium text-blue-600">
            <span>✨ 提示：常用内容可点击“置顶”永久保留</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
      {items.map((item) => (
        <ClipItem
          key={item.id}
          item={item}
          onPaste={onPaste}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
          onCopy={onCopy}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}
