import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ClipItem as Item } from "../types";
import { CopyIcon, PinIcon, TrashIcon, TextIcon, ImageIcon, CheckIcon, ZoomInIcon } from "./Icons";

interface Props {
  item: Item;
  onPaste: (id: number) => void;
  onDelete: (id: number) => void;
  onTogglePin: (id: number) => void;
  onCopy: (id: number) => void;
  onPreview: (src: string) => void;
}

function formatTime(timestamp: number) {
  const deltaMs = Date.now() - timestamp;
  const deltaMinutes = Math.floor(deltaMs / 60000);

  if (deltaMinutes <= 0) return "刚刚";
  if (deltaMinutes < 60) return `${deltaMinutes} 分钟前`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours} 小时前`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isCodeOrPath(text: string) {
  const trimmed = text.trim();
  return (
    /^[A-Za-z]:\\/.test(trimmed) ||
    /^\/[a-zA-Z0-9_\-./]+$/.test(trimmed) ||
    /^https?:\/\//.test(trimmed) ||
    /^(const|let|var|function|class|import|export|<html|<div|\{|\[)/.test(trimmed)
  );
}

export function ClipItem({
  item,
  onPaste,
  onDelete,
  onTogglePin,
  onCopy,
  onPreview,
}: Props) {
  const [copiedRecently, setCopiedRecently] = useState(false);

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(item.id);
    setCopiedRecently(true);
    setTimeout(() => setCopiedRecently(false), 1200);
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(item.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id);
  };

  const isCode = item.kind === "text" && item.text ? isCodeOrPath(item.text) : false;
  const charCount = item.text ? item.text.length : 0;

  return (
    <article
      onClick={() => onPaste(item.id)}
      role="button"
      tabIndex={0}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border p-3 transition-all duration-200 ease-spring active:scale-[0.985] ${
        item.pinned
          ? "border-blue-200/90 bg-gradient-to-b from-blue-50/60 to-white shadow-[0_2px_12px_rgba(59,130,246,0.08)] hover:border-blue-300 hover:shadow-subtle-hover"
          : "border-slate-200/80 bg-white shadow-subtle-card hover:border-blue-400/40 hover:bg-slate-50/50 hover:shadow-subtle-hover"
      }`}
    >
      {/* Top Header Row */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {item.kind === "image" ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200/60">
              <ImageIcon />
              <span>图片</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200/60">
              <TextIcon />
              <span>文本</span>
            </span>
          )}

          {item.pinned && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/70 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/70">
              <PinIcon filled className="text-blue-600" />
              <span>已置顶</span>
            </span>
          )}

          <span className="text-[11px] text-slate-400 tabular-nums">
            {formatTime(item.createdAt)}
          </span>

          {item.kind === "text" && charCount > 0 && (
            <span className="hidden sm:inline-block text-[11px] text-slate-300 tabular-nums">
              · {charCount} 字
            </span>
          )}
        </div>

        {/* Floating Actions Dock (Appears smoothly on hover) */}
        <div
          className="flex shrink-0 items-center gap-1 opacity-0 translate-y-1 transition-all duration-200 ease-spring group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
          onClick={(e) => e.stopPropagation()}
        >
          {item.kind === "image" && item.imagePath && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(convertFileSrc(item.imagePath!));
              }}
              title="放大预览大图"
              className="flex h-6 items-center gap-1 rounded-md border border-slate-200/80 bg-white px-1.5 text-[11px] font-medium text-slate-600 shadow-subtle-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 active:scale-95"
            >
              <ZoomInIcon width="12" height="12" />
              <span>预览</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyClick}
            title="复制到剪贴板"
            className="flex h-6 items-center gap-1 rounded-md border border-slate-200/80 bg-white px-2 text-[11px] font-medium text-slate-600 shadow-subtle-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 active:scale-95"
          >
            {copiedRecently ? (
              <>
                <CheckIcon className="text-emerald-600" />
                <span className="text-emerald-600">已复制</span>
              </>
            ) : (
              <>
                <CopyIcon />
                <span>复制</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePinClick}
            title={item.pinned ? "取消置顶" : "置顶条目"}
            className={`flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium shadow-subtle-sm transition active:scale-95 ${
              item.pinned
                ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100/70"
                : "border-slate-200/80 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            }`}
          >
            <PinIcon filled={item.pinned} />
            <span>{item.pinned ? "取消" : "置顶"}</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteClick}
            title="删除条目"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200/80 bg-white text-slate-500 shadow-subtle-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {item.kind === "text" ? (
        <div
          className={`line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-700 select-text ${
            isCode
              ? "rounded-lg bg-slate-50/80 px-2.5 py-1.5 font-mono text-[12px] text-slate-800 border border-slate-200/50"
              : ""
          }`}
        >
          {item.text}
        </div>
      ) : (
        item.imagePath && (
          <div className="group/img relative mt-1 overflow-hidden rounded-lg border border-slate-200/70 bg-slate-50/70 p-1.5 transition hover:border-blue-300">
            {/* Direct click on image pastes it immediately into document */}
            <img
              src={convertFileSrc(item.imagePath)}
              alt="剪贴板图片"
              className="max-h-[110px] w-full rounded-md object-contain transition duration-200 group-hover/img:scale-[1.01]"
              loading="lazy"
            />
            {/* Small corner zoom button only */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(convertFileSrc(item.imagePath!));
              }}
              title="放大查看原图"
              className="absolute bottom-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-md border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm opacity-0 transition-opacity duration-150 hover:bg-white hover:text-blue-600 group-hover/img:opacity-100 active:scale-90"
            >
              <ZoomInIcon width="13" height="13" />
            </button>
          </div>
        )
      )}
    </article>
  );
}
