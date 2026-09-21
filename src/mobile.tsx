import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import jsQR from "jsqr";
import { encryptPayload } from "./mobileCrypto";
import type { ClipItem, PairingQrPayload } from "./types";
import {
  SearchIcon,
  CopyIcon,
  CheckIcon,
  CloseIcon,
  SmartphoneIcon,
  ShieldCheckIcon,
  QrCodeIcon,
  PinIcon,
  TrashIcon,
} from "./components/Icons";
import "./index.css";

interface PairedPcInfo {
  deviceId: string;
  deviceName: string;
  sharedKey: string;
  pcIp: string;
  pcPort: number;
}

const STORAGE_KEY_PAIRED_PC = "clipflow_mobile_paired_pc";
const STORAGE_KEY_ITEMS = "clipflow_mobile_items";

function MobileApp() {
  const [items, setItems] = useState<ClipItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pairedPc, setPairedPc] = useState<PairedPcInfo | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAIRED_PC);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [connected, setConnected] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [, setCameraActive] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "text" | "image" | "pinned">("all");
  const [toastText, setToastText] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    const t = setTimeout(() => setToastText(null), 1800);
    return () => clearTimeout(t);
  }, []);

  // Save items to localStorage on update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  }, [items]);

  // Check connection to PC
  const checkConnection = useCallback(async (pc: PairedPcInfo) => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch(`http://${pc.pcIp}:${pc.pcPort}/ping`, {
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) {
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    if (pairedPc) {
      checkConnection(pairedPc);
      const timer = setInterval(() => checkConnection(pairedPc), 5000);
      return () => clearInterval(timer);
    } else {
      setConnected(false);
    }
  }, [pairedPc, checkConnection]);

  // Complete Pairing
  const completePairing = async (payload: PairingQrPayload) => {
    const pcIp = payload.lanAddresses[0] || "127.0.0.1";
    const pcInfo: PairedPcInfo = {
      deviceId: payload.deviceId,
      deviceName: payload.deviceName,
      sharedKey: payload.sharedKey,
      pcIp,
      pcPort: payload.port,
    };

    // Send pair request to PC server
    try {
      const mobileId = "mobile-" + Math.random().toString(16).substring(2, 8);
      await fetch(`http://${pcIp}:${payload.port}/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: mobileId,
          deviceName: navigator.userAgent.includes("iPhone")
            ? "iPhone"
            : navigator.userAgent.includes("Android")
            ? "Android Phone"
            : "Mobile Device",
          platform: navigator.userAgent.includes("iPhone") ? "ios" : "android",
          sharedKey: payload.sharedKey,
        }),
      });
    } catch (e) {
      console.warn("Direct pair notify failed (LAN may vary):", e);
    }

    localStorage.setItem(STORAGE_KEY_PAIRED_PC, JSON.stringify(pcInfo));
    setPairedPc(pcInfo);
    setConnected(true);
    setScannerOpen(false);
    stopCamera();
    showToast(`已成功配对：${payload.deviceName}`);
  };

  // Camera QR Scanner loop
  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        requestAnimationFrame(tickScan);
      }
    } catch (e) {
      console.error("Camera access denied:", e);
      setCameraActive(false);
      showToast("无法访问相机，请手动粘贴配对码");
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const tickScan = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          try {
            const payload = JSON.parse(code.data) as PairingQrPayload;
            if (payload.protocol === "clipflow-e2ee-v1" && payload.sharedKey) {
              completePairing(payload);
              return;
            }
          } catch {
            // Not a valid JSON payload yet, keep scanning
          }
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(tickScan);
  };

  const handleManualPair = () => {
    try {
      const payload = JSON.parse(manualTokenInput.trim()) as PairingQrPayload;
      if (payload.protocol === "clipflow-e2ee-v1" && payload.sharedKey) {
        completePairing(payload);
      } else {
        showToast("配对码格式无效");
      }
    } catch {
      showToast("解析失败，请检查配对代码");
    }
  };

  // Copy item to phone's clipboard
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("已复制到手机剪贴板");
    } catch {
      showToast("复制失败，请授予剪贴板权限");
    }
  };

  // Send mobile clipboard text to PC
  const handleSendToPc = async () => {
    if (!pairedPc) {
      showToast("请先配对电脑端");
      setScannerOpen(true);
      return;
    }

    setSyncing(true);
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim() === "") {
        showToast("手机剪贴板为空");
        setSyncing(false);
        return;
      }

      const { nonce, ciphertext } = await encryptPayload(pairedPc.sharedKey, text);
      const envelope = {
        version: 1,
        senderId: "mobile-app",
        targetId: pairedPc.deviceId,
        timestamp: Math.floor(Date.now() / 1000),
        seq: Date.now(),
        nonce,
        kind: "text",
        ciphertext,
      };

      const res = await fetch(`http://${pairedPc.pcIp}:${pairedPc.pcPort}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envelope),
      });

      if (res.ok) {
        showToast("✓ 已加密同步至电脑端");
        // Also add to mobile list locally
        setItems((prev) => [
          {
            id: Date.now(),
            kind: "text",
            text,
            imagePath: null,
            createdAt: Date.now(),
            pinned: false,
          },
          ...prev,
        ]);
      } else {
        showToast("电脑未响应，请检查 Wi-Fi 连接");
      }
    } catch (e) {
      console.error(e);
      showToast("发送失败，请确保与电脑处于同一局域网");
    } finally {
      setSyncing(false);
    }
  };

  const handleTogglePin = (id: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
    );
  };

  const handleDelete = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUnpair = () => {
    if (confirm("确定要解除与电脑端的配对吗？")) {
      localStorage.removeItem(STORAGE_KEY_PAIRED_PC);
      setPairedPc(null);
      setConnected(false);
      showToast("已解除配对");
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (activeFilter === "text" && item.kind !== "text") return false;
    if (activeFilter === "image" && item.kind !== "image") return false;
    if (activeFilter === "pinned" && !item.pinned) return false;
    if (!query.trim()) return true;
    return (item.text || "").toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-800 antialiased font-sans select-none">
      {/* Mobile Safe-Area Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-4 pt-safe-top backdrop-blur-md">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm font-bold text-sm">
              H
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-slate-800">ClipFlow</span>
                <span className="rounded bg-blue-50 px-1 py-0.2 text-[10px] font-semibold text-blue-600 border border-blue-200/60">
                  Mobile
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connected ? "bg-emerald-500 shadow-sm shadow-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span>
                  {connected
                    ? `已连接 ${pairedPc?.deviceName}`
                    : pairedPc
                    ? "电脑未在线"
                    : "未配对"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setScannerOpen(true);
                startCamera();
              }}
              className="flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 transition active:scale-95"
            >
              <QrCodeIcon />
              <span>{pairedPc ? "切换电脑" : "扫码配对"}</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="pb-2.5 pt-1">
          <div className="relative flex items-center">
            <SearchIcon className="pointer-events-none absolute left-3 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索剪贴记录..."
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-100/70 pl-8 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600"
              >
                <CloseIcon width="14" height="14" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 pb-2.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: "all", label: "全部" },
              { id: "text", label: "文本" },
              { id: "image", label: "图片" },
              { id: "pinned", label: "已置顶" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition active:scale-95 ${
                activeFilter === tab.id
                  ? "bg-slate-900 text-white shadow-sm font-semibold"
                  : "border border-slate-200/80 bg-white text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main List */}
      <main className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 mb-3">
              <ShieldCheckIcon />
            </div>
            <div className="text-sm font-semibold text-slate-700">暂无剪贴记录</div>
            <p className="mt-1 max-w-[240px] text-xs text-slate-400 leading-relaxed">
              {pairedPc
                ? "电脑端复制的内容将通过 E2EE 实时加密同步到这里"
                : "点击右上角「扫码配对」即可直连您的 Windows 电脑"}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => item.text && handleCopy(item.text)}
              className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-subtle-sm transition active:scale-[0.985] active:bg-slate-50"
            >
              <div className="flex items-center justify-between pb-1.5 text-[11px] text-slate-400">
                <span className="font-mono">
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleTogglePin(item.id)}
                    className={`p-1 rounded-md transition ${
                      item.pinned ? "text-amber-500" : "text-slate-300 hover:text-slate-600"
                    }`}
                  >
                    <PinIcon filled={item.pinned} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1 rounded-md text-slate-300 hover:text-rose-500 transition"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>

              {item.kind === "text" && item.text && (
                <div className="text-xs text-slate-800 font-normal leading-relaxed line-clamp-4 break-all">
                  {item.text}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                <span>点击轻触复制</span>
                <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                  <CopyIcon />
                  <span>复制</span>
                </span>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Floating Bottom Action Bar */}
      <footer className="sticky bottom-0 z-20 border-t border-slate-200/80 bg-white/95 px-4 py-2.5 pb-safe-bottom backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendToPc}
            disabled={syncing}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
          >
            <SmartphoneIcon />
            <span>{syncing ? "加密传输中..." : "发送手机剪贴板至电脑"}</span>
          </button>
        </div>
      </footer>

      {/* Toast Feedback */}
      {toastText && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md animate-fade-in">
          <CheckIcon className="text-emerald-400" />
          <span>{toastText}</span>
        </div>
      )}

      {/* QR Scanner / Pairing Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-sm animate-fade-in p-4 justify-center items-center">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 flex flex-col items-center">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setScannerOpen(false);
              }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            >
              <CloseIcon width="16" height="16" />
            </button>

            <h3 className="text-base font-bold text-slate-800">对准电脑屏幕二维码</h3>
            <p className="mt-1 text-xs text-slate-500 text-center">
              在电脑端「偏好设置 → 多端同步」点击「扫码配对」
            </p>

            {/* Video Viewport Frame */}
            <div className="mt-4 relative flex items-center justify-center w-64 h-64 rounded-2xl bg-black overflow-hidden border-2 border-blue-500 shadow-inner">
              <video ref={videoRef} playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              {/* Scanning visual crosshair */}
              <div className="pointer-events-none absolute inset-4 border border-blue-400/40 rounded-xl" />
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-0.5 bg-blue-500 animate-pulse" />
            </div>

            {/* Manual Token Paste Option */}
            <div className="mt-4 w-full border-t border-slate-100 pt-3">
              <div className="text-[11px] font-semibold text-slate-500 mb-1.5">无法扫码？手动粘贴配对码</div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={manualTokenInput}
                  onChange={(e) => setManualTokenInput(e.target.value)}
                  placeholder="粘贴来自电脑的配对代码..."
                  className="h-8 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleManualPair}
                  className="rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm"
                >
                  配对
                </button>
              </div>
            </div>

            {pairedPc && (
              <button
                type="button"
                onClick={handleUnpair}
                className="mt-3 text-xs text-rose-500 hover:underline"
              >
                解除当前与「{pairedPc.deviceName}」的配对
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
);
