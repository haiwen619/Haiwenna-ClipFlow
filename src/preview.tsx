import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./index.css";
import { CloseIcon, ImageIcon } from "./components/Icons";

function Preview() {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSrc(params.get("src"));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWebviewWindow().close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleClose = () => {
    getCurrentWebviewWindow().close();
  };

  if (!src) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 text-slate-400">
        <div className="text-center">
          <ImageIcon width="32" height="32" className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">未找到图片源文件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-slate-900/90 select-none overflow-hidden">
      {/* Floating Header Toolbar */}
      <header className="absolute top-4 inset-x-4 z-20 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2 text-white">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white">
            <ImageIcon />
          </div>
          <span className="text-xs font-semibold tracking-wide">图片预览</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block text-[11px] text-white/50">
            按 ESC 或点击空白处关闭
          </span>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white active:scale-95"
            title="关闭窗口"
          >
            <CloseIcon width="14" height="14" />
          </button>
        </div>
      </header>

      {/* Main Image Viewport */}
      <main
        className="flex h-full w-full cursor-zoom-out items-center justify-center p-12"
        onClick={handleClose}
      >
        <div
          className="relative max-h-full max-w-full overflow-hidden rounded-2xl border border-white/15 bg-black/40 p-2 shadow-2xl backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt="预览图"
            className="max-h-[82vh] max-w-[85vw] rounded-xl object-contain shadow-inner"
          />
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
