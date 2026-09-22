import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import jsQR from "jsqr";
import {
  QRCodeReader,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  DecodeHintType,
} from "@zxing/library";
import { encryptPayload } from "./mobileCrypto";
import { RelaySyncClient } from "./syncRelay";
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

function FlashlightIcon({ className = "", width = "20", height = "20" }: { className?: string; width?: string; height?: string }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6c0 2-2 4-2 7v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6c0-3-2-5-2-7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
      <line x1="6" y1="6" x2="18" y2="6" />
      <line x1="12" y1="12" x2="12" y2="12" />
    </svg>
  );
}

function CameraSwitchIcon({ className = "", width = "20", height = "20" }: { className?: string; width?: string; height?: string }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.21 1.005 4.184 2.607 5.5" />
      <path d="M4 14c0 4.418 3.582 8 8 8s8-3.582 8-8c0-2.21-1.005-4.184-2.607-5.5" />
      <polyline points="1 10 5 10 5 6" />
      <polyline points="23 14 19 14 19 18" />
    </svg>
  );
}

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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.sharedKey) {
          parsed.sharedKey = parsed.sharedKey.replace(/ /g, "+");
          localStorage.setItem(STORAGE_KEY_PAIRED_PC, JSON.stringify(parsed));
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [connected, setConnected] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(false);
  const relayClientRef = useRef<RelaySyncClient | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [, setCameraActive] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "text" | "image" | "pinned">("all");
  const [toastText, setToastText] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // 焦距与变焦 (对齐成熟工程 yanpai)
  const [zoom, setZoom] = useState<number>(1.0);
  const [minZoom, setMinZoom] = useState<number>(0.6);
  const [maxZoom, setMaxZoom] = useState<number>(3.0);
  const [stepZoom, setStepZoom] = useState<number>(0.1);
  const [hasHardwareZoom, setHasHardwareZoom] = useState<boolean>(false);
  const [showZoomSlider] = useState<boolean>(true);

  // 取景画幅模式：默认 'cover' 全屏铺满（沉浸无黑边，微信同款体验）
  const [fitMode, setFitMode] = useState<"contain" | "cover">("cover");

  // 多摄像头设备切换 (超广角 / 主摄)
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState<number>(0);

  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [focusAnimation, setFocusAnimation] = useState<{ x: number; y: number } | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [streamInfo, setStreamInfo] = useState<{ width: number; height: number; cameraName: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const zxingReaderRef = useRef<QRCodeReader | null>(null);
  const zxingHintsRef = useRef<Map<DecodeHintType, any>>(new Map());
  const isScanningRef = useRef(false);
  const scanLoopRef = useRef(false);
  const lastScanTimeRef = useRef(0);

  // 双指手势缩放 (Pinch-to-zoom) 引用
  const touchStartDistRef = useRef<number>(0);
  const touchStartZoomRef = useRef<number>(1.0);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    const t = setTimeout(() => setToastText(null), 1800);
    return () => clearTimeout(t);
  }, []);

  // 初始化现代浏览器内置硬件加速 BarcodeDetector 与 ZXing 工业解码器
  useEffect(() => {
    if ("BarcodeDetector" in window) {
      try {
        // @ts-ignore
        barcodeDetectorRef.current = new window.BarcodeDetector({
          formats: ["qr_code"],
        });
      } catch (e) {
        console.warn("BarcodeDetector not supported:", e);
      }
    }

    try {
      zxingReaderRef.current = new QRCodeReader();
      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.TRY_HARDER, true);
      zxingHintsRef.current = hints;
    } catch (e) {
      console.warn("QRCodeReader init failed:", e);
    }
  }, []);

  // 首次打开 App，若未配对任何电脑，默认自动打开扫码器
  useEffect(() => {
    if (!pairedPc) {
      const timer = setTimeout(() => {
        setScannerOpen(true);
        startCamera();
      }, 350);
      return () => clearTimeout(timer);
    }
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
      }
    } catch {
      // 局域网无法直连时，依赖云端 WebSocket 中继维持连接
    }
  }, []);

  const handleRemoteTextReceived = useCallback((text: string) => {
    setItems((prev) => {
      if (prev.length > 0 && prev[0].text === text) {
        return prev;
      }
      return [
        {
          id: Date.now(),
          kind: "text",
          text,
          imagePath: null,
          createdAt: Date.now(),
          pinned: false,
        },
        ...prev,
      ];
    });
    if (navigator.vibrate) {
      navigator.vibrate([40]);
    }
    // 尝试直接同步写入手机系统剪贴板（无感跨屏同步）
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    showToast("✓ 收到电脑端同步剪贴板");
  }, [showToast]);

  const handleRemoteImageReceived = useCallback(async (dataUrl: string) => {
    setItems((prev) => {
      if (prev.length > 0 && prev[0].imagePath === dataUrl) {
        return prev;
      }
      return [
        {
          id: Date.now(),
          kind: "image",
          text: null,
          imagePath: dataUrl,
          createdAt: Date.now(),
          pinned: false,
        },
        ...prev,
      ];
    });
    if (navigator.vibrate) {
      navigator.vibrate([40]);
    }
    // 尝试直接同步写入手机系统剪贴板（无感跨屏同步）
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type || "image/png"]: blob }),
        ]);
      } catch {}
    }
    showToast("✓ 收到电脑端同步图片");
  }, [showToast]);

  // 云端中继 WebSocket 生命周期管理
  useEffect(() => {
    const mobileId = "mobile-" + Math.random().toString(16).substring(2, 8);
    const client = new RelaySyncClient({
      deviceId: mobileId,
      platform: "android",
      onTextReceived: handleRemoteTextReceived,
      onImageReceived: handleRemoteImageReceived,
      onStatusChange: (online) => {
        setCloudConnected(online);
        if (online) {
          setConnected(true);
          const devName = navigator.userAgent.includes("Android") ? "Android Phone" : "Mobile Device";
          client.sendDeviceAnnounce(devName);
        }
      },
    });
    relayClientRef.current = client;

    if (pairedPc?.sharedKey) {
      client.connect(pairedPc.sharedKey);
    }

    return () => {
      client.disconnect();
      relayClientRef.current = null;
    };
  }, [pairedPc?.sharedKey, handleRemoteTextReceived, handleRemoteImageReceived]);

  useEffect(() => {
    if (pairedPc) {
      checkConnection(pairedPc);
      const timer = setInterval(() => checkConnection(pairedPc), 10000);
      return () => clearInterval(timer);
    } else {
      setConnected(false);
    }
  }, [pairedPc, checkConnection]);

  // 极致流畅的配对完成闭环（瞬间关闭扫码框与保存，网络请求完全后台异步非阻塞）
  const completePairing = (payload: PairingQrPayload) => {
    const pcIp = payload.lanAddresses[0] || "127.0.0.1";
    const pcInfo: PairedPcInfo = {
      deviceId: payload.deviceId,
      deviceName: payload.deviceName,
      sharedKey: payload.sharedKey,
      pcIp,
      pcPort: payload.port,
    };

    // 1. 立即停止相机与关闭扫码全屏窗（0ms 响应，绝不卡顿）
    stopCamera();
    setScannerOpen(false);

    // 2. 立即持久化与更新 UI
    localStorage.setItem(STORAGE_KEY_PAIRED_PC, JSON.stringify(pcInfo));
    setPairedPc(pcInfo);
    setConnected(true);
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    showToast(`✓ 已成功配对：${payload.deviceName}`);

    // 3. 立即连通云端 WebSocket 中继
    if (relayClientRef.current) {
      relayClientRef.current.connect(payload.sharedKey);
    }

    // 4. 后台异步发送局域网通知（1.5s 超时控制，失败静默）
    (async () => {
      try {
        const mobileId = "mobile-" + Math.random().toString(16).substring(2, 8);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        await fetch(`http://${pcIp}:${payload.port}/pair`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
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
        clearTimeout(timeoutId);
      } catch (e) {
        console.warn("Direct pair notify failed (LAN unreachable):", e);
      }
    })();
  };

  // 枚举可用的后置摄像头（智能识别超广角与主摄）
  const enumerateBackCameras = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === "videoinput");

      const backOnly = videoInputs.filter((d) => {
        const label = (d.label || "").toLowerCase();
        return (
          label.includes("back") ||
          label.includes("rear") ||
          label.includes("environment") ||
          label.includes("后置") ||
          label.includes("外置") ||
          label.includes("wide") ||
          label.includes("0")
        );
      });

      const targets = backOnly.length > 0 ? backOnly : videoInputs;
      setCameraDevices(targets);
    } catch (err) {
      console.warn("枚举相机设备失败:", err);
    }
  };

  // 应用变焦倍率 (硬件优先 + 数字缩放平滑过渡)
  const applyZoom = async (targetZoom: number) => {
    const clamped = Math.min(Math.max(targetZoom, minZoom), maxZoom);
    const rounded = parseFloat(clamped.toFixed(2));
    setZoom(rounded);

    if (streamRef.current) {
      const [track] = streamRef.current.getVideoTracks();
      if (track) {
        const caps = typeof track.getCapabilities === "function" ? (track.getCapabilities() as any) : {};
        if (caps.zoom) {
          try {
            await track.applyConstraints({
              advanced: [{ zoom: rounded } as any],
            });
          } catch (e) {
            console.warn("调用硬件变焦失败，将使用视口数字缩放:", e);
          }
        }
      }
    }
  };

  // 激活后置摄像头 (彻底解决竖屏 Android WebView 降级为 480x640 的问题)
  const startCamera = async (targetDeviceId?: string) => {
    setCameraActive(true);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // 动态根据视口比例请求竖屏方向的高清视频流（杜绝强制 min:1280 导致 OverconstrainedError）
      const isPortrait = typeof window !== "undefined" && window.innerHeight >= window.innerWidth;
      const targetW = isPortrait ? 1080 : 1920;
      const targetH = isPortrait ? 1920 : 1080;

      const constraintsList: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: targetDeviceId ? undefined : { ideal: "environment" },
            deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
            width: { ideal: targetW },
            height: { ideal: targetH },
          },
          audio: false,
        },
        {
          video: {
            facingMode: targetDeviceId ? undefined : { ideal: "environment" },
            deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
            width: { ideal: isPortrait ? 720 : 1280 },
            height: { ideal: isPortrait ? 1280 : 720 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: targetDeviceId ? undefined : { ideal: "environment" },
            deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
          },
          audio: false,
        },
      ];

      let stream: MediaStream | null = null;
      let lastErr = null;
      for (const c of constraintsList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          if (stream) break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!stream) {
        throw lastErr || new Error("Camera stream not available");
      }

      streamRef.current = stream;

      const [track] = stream.getVideoTracks();
      if (track) {
        const caps = typeof track.getCapabilities === "function" ? (track.getCapabilities() as any) : {};

        // 手电筒
        setHasTorch(!!caps.torch);
        setTorchOn(false);

        // 强力对焦与曝光优化 (连续自动对焦)
        const adv: any = {};
        if (caps.focusMode && Array.isArray(caps.focusMode)) {
          if (caps.focusMode.includes("continuous")) {
            adv.focusMode = "continuous";
          } else if (caps.focusMode.includes("single-shot")) {
            adv.focusMode = "single-shot";
          }
        }
        if (caps.exposureMode && Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
          adv.exposureMode = "continuous";
        }
        if (Object.keys(adv).length > 0 && track.applyConstraints) {
          try {
            await track.applyConstraints({ advanced: [adv] });
          } catch {}
        }

        // 探查硬件变焦能力 (Zoom Capabilities)
        if (caps.zoom) {
          setHasHardwareZoom(true);
          const cMin = caps.zoom.min ?? 1.0;
          const cMax = Math.min(caps.zoom.max ?? 8.0, 6.0);
          const cStep = caps.zoom.step ?? 0.1;
          setMinZoom(cMin);
          setMaxZoom(cMax);
          setStepZoom(cStep);
          setZoom(cMin);
        } else {
          setHasHardwareZoom(false);
          setMinZoom(0.6);
          setMaxZoom(3.0);
          setStepZoom(0.1);
          setZoom(1.0);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("autoplay", "true");
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});

        setTimeout(() => {
          if (videoRef.current) {
            const vw = videoRef.current.videoWidth;
            const vh = videoRef.current.videoHeight;
            const currentTrack = stream.getVideoTracks()[0];
            const name = currentTrack?.label || "后置主摄";
            setStreamInfo({ width: vw, height: vh, cameraName: name });
          }
        }, 300);

        startScanLoop();
      }

      await enumerateBackCameras();
    } catch (e: any) {
      console.error("Camera access failed:", e);
      setCameraActive(false);
      showToast("无法访问相机，请手动输入配对码");
    }
  };

  const handleSwitchLens = async () => {
    if (cameraDevices.length <= 1) return;
    const nextIdx = (currentDeviceIndex + 1) % cameraDevices.length;
    setCurrentDeviceIndex(nextIdx);
    const nextDevice = cameraDevices[nextIdx];
    await startCamera(nextDevice.deviceId);
    showToast(`已切换镜头: ${nextDevice.label || `镜头 ${nextIdx + 1}`}`);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const nextState = !torchOn;
    try {
      // @ts-ignore
      await track.applyConstraints({ advanced: [{ torch: nextState }] });
      setTorchOn(nextState);
    } catch (e) {
      console.warn("Toggle torch failed:", e);
    }
  };

  const handleTapToFocus = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    setFocusAnimation({ x: clientX, y: clientY });
    setTimeout(() => setFocusAnimation(null), 1000);

    const track = streamRef.current?.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      const caps: any = track.getCapabilities ? track.getCapabilities() : {};
      try {
        if (caps.focusMode && Array.isArray(caps.focusMode)) {
          if (caps.focusMode.includes("continuous")) {
            await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] });
          } else if (caps.focusMode.includes("single-shot")) {
            await track.applyConstraints({ advanced: [{ focusMode: "single-shot" } as any] });
          }
        }
      } catch {}
    }
  };

  // 双指捏合手势变焦
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleFactor = dist / touchStartDistRef.current;
      const targetZoom = touchStartZoomRef.current * scaleFactor;
      applyZoom(targetZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = 0;
  };

  const stopCamera = () => {
    scanLoopRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
    setCameraActive(false);
  };

  // 解析二维码结果（支持 cf:// 紧凑格式与传统 JSON 格式）
  const handleDecodedString = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    // 1. 紧凑型 URI 协议格式：cf://v1?k=...&d=...&n=...&ip=...&p=...
    if (trimmed.startsWith("cf://") || trimmed.startsWith("clipflow://")) {
      try {
        const url = new URL(trimmed);
        const rawK = url.searchParams.get("k");
        const k = rawK ? decodeURIComponent(rawK).replace(/ /g, "+") : null;
        const d = url.searchParams.get("d") || "pc";
        const n = url.searchParams.get("n") || "Windows PC";
        const ip = url.searchParams.get("ip") || "127.0.0.1";
        const p = parseInt(url.searchParams.get("p") || "14220", 10);
        if (k) {
          const payload: PairingQrPayload = {
            protocol: "clipflow-e2ee-v1",
            deviceId: d,
            deviceName: decodeURIComponent(n),
            platform: "windows",
            sharedKey: k,
            lanAddresses: ip.split(","),
            port: p,
            timestamp: Math.floor(Date.now() / 1000),
          };
          if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
          completePairing(payload);
          return true;
        }
      } catch (e) {
        console.warn("Parse cf:// failed:", e);
      }
    }

    // 2. 标准 JSON 格式解析
    try {
      const payload = JSON.parse(trimmed) as PairingQrPayload;
      if (payload.protocol === "clipflow-e2ee-v1" && payload.sharedKey) {
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
        completePairing(payload);
        return true;
      }
    } catch {}

    return false;
  };

  // 微信同级三核扫码循环：BarcodeDetector + 纯净内存版 ZXing HybridBinarizer + jsQR
  const startScanLoop = () => {
    scanLoopRef.current = true;

    const scanTick = async () => {
      if (!scanLoopRef.current) return;

      const video = videoRef.current;
      if (
        video &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth >= 100 &&
        video.videoHeight >= 100 &&
        !isScanningRef.current
      ) {
        const now = performance.now();
        if (now - lastScanTimeRef.current >= 65) {
          lastScanTimeRef.current = now;
          isScanningRef.current = true;

          try {
            // 引擎 1：原生硬件加速 BarcodeDetector (GPU 级毫秒检出)
            if (barcodeDetectorRef.current) {
              try {
                const barcodes = await barcodeDetectorRef.current.detect(video);
                if (barcodes && barcodes.length > 0) {
                  for (const b of barcodes) {
                    if (b.rawValue && handleDecodedString(b.rawValue)) {
                      isScanningRef.current = false;
                      return;
                    }
                  }
                }
              } catch {}
            }

            // 抓取当前视频画面至高保真 Canvas
            const canvas = canvasRef.current;
            if (canvas) {
              const vW = video.videoWidth;
              const vH = video.videoHeight;
              canvas.width = vW;
              canvas.height = vH;
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, vW, vH);
                const imgData = ctx.getImageData(0, 0, vW, vH);

                // 引擎 2：工业级 ZXing QRCodeReader + HybridBinarizer
                // 专克显示器高光、反光、摩尔纹条纹与小角度倾斜
                if (zxingReaderRef.current) {
                  try {
                    const size = vW * vH;
                    const lum = new Uint8ClampedArray(size);
                    const d = imgData.data;
                    for (let i = 0; i < size; i++) {
                      const o = i * 4;
                      lum[i] = (d[o] * 77 + d[o + 1] * 150 + d[o + 2] * 29) >> 8;
                    }
                    const lumSource = new RGBLuminanceSource(lum, vW, vH);
                    const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
                    const res = zxingReaderRef.current.decode(bitmap, zxingHintsRef.current);
                    if (res && res.getText && handleDecodedString(res.getText())) {
                      isScanningRef.current = false;
                      return;
                    }
                  } catch {
                    // NotFoundException 属正常扫码寻帧过程
                  }
                }

                // 引擎 3：jsQR 全画面保底兜底
                const qr = jsQR(imgData.data, imgData.width, imgData.height, {
                  inversionAttempts: "attemptBoth",
                });
                if (qr && qr.data && handleDecodedString(qr.data)) {
                  isScanningRef.current = false;
                  return;
                }
              }
            }
          } catch {
            // 容错
          } finally {
            isScanningRef.current = false;
          }
        }
      }

      if (scanLoopRef.current) {
        animFrameRef.current = requestAnimationFrame(scanTick);
      }
    };

    animFrameRef.current = requestAnimationFrame(scanTick);
  };

  const handleManualPair = () => {
    const trimmed = manualTokenInput.trim();
    if (handleDecodedString(trimmed)) {
      return;
    }
    showToast("配对码格式无效，请检查复制内容");
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

  const handleCopyImage = async (dataUrl: string) => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type || "image/png"]: blob }),
        ]);
        showToast("✓ 已复制图片到手机剪贴板");
      } else {
        showToast("已选中图片，长按可直接保存");
      }
    } catch {
      showToast("复制图片受系统限制，长按可保存");
    }
  };

  // Send mobile clipboard text to PC
  const handleSendToPc = async () => {
    if (!pairedPc) {
      showToast("请先配对电脑端");
      setScannerOpen(true);
      startCamera();
      return;
    }

    setSyncing(true);
    try {
      // 1. 优先尝试检测手机剪贴板中的图片
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const clipItems = await navigator.clipboard.read();
          for (const cItem of clipItems) {
            const imgType = cItem.types.find((t) => t.startsWith("image/"));
            if (imgType) {
              const blob = await cItem.getType(imgType);
              const reader = new FileReader();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              if (dataUrl) {
                let imgSent = false;
                if (relayClientRef.current && relayClientRef.current.isConnected()) {
                  imgSent = await relayClientRef.current.sendImage(dataUrl);
                }
                if (imgSent) {
                  showToast("✓ 已端到端加密同步图片至电脑端");
                  setItems((prev) => [
                    {
                      id: Date.now(),
                      kind: "image",
                      text: null,
                      imagePath: dataUrl,
                      createdAt: Date.now(),
                      pinned: false,
                    },
                    ...prev,
                  ]);
                  setSyncing(false);
                  return;
                }
              }
            }
          }
        } catch {}
      }

      // 2. 文本剪贴板同步
      const text = await navigator.clipboard.readText();
      if (!text || text.trim() === "") {
        showToast("手机剪贴板为空");
        setSyncing(false);
        return;
      }

      let sent = false;

      // 通道 1：云端 WebSocket 中继（5G 蜂窝网 / 任意网络秒级直达）
      if (relayClientRef.current && relayClientRef.current.isConnected()) {
        const ok = await relayClientRef.current.sendText(text);
        if (ok) sent = true;
      }

      // 通道 2：局域网直接传输（同 WiFi 下极速直连）
      try {
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

        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch(`http://${pairedPc.pcIp}:${pairedPc.pcPort}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify(envelope),
        });
        clearTimeout(timeoutId);
        if (res.ok) sent = true;
      } catch {
        // 局域网不可达时无缝忽略
      }

      if (sent) {
        showToast("✓ 已端到端加密同步至电脑端");
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
        showToast("网络连接中，请稍候重试");
      }
    } catch {
      showToast("读取剪贴板失败，请授予权限");
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

  const filteredItems = items.filter((item) => {
    if (activeFilter === "text" && item.kind !== "text") return false;
    if (activeFilter === "image" && item.kind !== "image") return false;
    if (activeFilter === "pinned" && !item.pinned) return false;
    if (!query.trim()) return true;
    return (item.text || "").toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-slate-50 text-slate-800 antialiased font-sans select-none overflow-hidden">
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
                <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[10px] font-semibold text-blue-600 border border-blue-200/60">
                  v0.1.2
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    cloudConnected || connected
                      ? "bg-emerald-500 shadow-sm shadow-emerald-400 animate-pulse"
                      : "bg-amber-400"
                  }`}
                />
                <span className="font-medium">
                  {cloudConnected
                    ? `云端同步中 · ${pairedPc?.deviceName || "电脑"}`
                    : connected
                    ? `局域网直连 · ${pairedPc?.deviceName || "电脑"}`
                    : pairedPc
                    ? "正在连接..."
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 shadow-sm border border-blue-100">
              <ShieldCheckIcon />
            </div>
            <div className="text-base font-bold text-slate-800">暂无剪贴记录</div>
            <p className="mt-1.5 max-w-[260px] text-xs text-slate-400 leading-relaxed">
              {pairedPc
                ? "电脑端复制的内容将通过 E2EE 实时加密同步到这里"
                : "直连您的 Windows 电脑，开启双向实时无缝剪贴板同步"}
            </p>
            {!pairedPc && (
              <button
                type="button"
                onClick={() => {
                  setScannerOpen(true);
                  startCamera();
                }}
                className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 active:scale-95 transition hover:bg-blue-700"
              >
                <QrCodeIcon />
                <span>立即扫码连接电脑</span>
              </button>
            )}
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.kind === "text" && item.text) {
                  handleCopy(item.text);
                } else if (item.kind === "image" && item.imagePath) {
                  handleCopyImage(item.imagePath);
                }
              }}
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

              {item.kind === "image" && item.imagePath && (
                <div className="mt-1 flex items-center justify-center overflow-hidden rounded-xl bg-slate-50 border border-slate-200/60 p-1">
                  <img
                    src={item.imagePath}
                    alt="剪贴板图片"
                    className="max-h-60 w-auto rounded-lg object-contain shadow-sm"
                    loading="lazy"
                  />
                </div>
              )}

              <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                <span>{item.kind === "image" ? "点击轻触复制图片" : "点击轻触复制"}</span>
                <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                  <CopyIcon />
                  <span>{item.kind === "image" ? "复制图片" : "复制"}</span>
                </span>
              </div>
            </div>
          ))
        )}
      </main>

      {/* Floating Bottom Action Bar */}
      <footer className="sticky bottom-0 z-20 border-t border-slate-200/80 bg-white/95 px-4 pt-2.5 pb-3 pb-safe-bottom backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendToPc}
            disabled={syncing}
            className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60"
          >
            <SmartphoneIcon />
            <span>{syncing ? "加密传输中..." : "发送手机剪贴板至电脑"}</span>
          </button>
        </div>
      </footer>

      {/* Toast Feedback */}
      {toastText && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur-md animate-fade-in">
          <CheckIcon className="text-emerald-400" />
          <span>{toastText}</span>
        </div>
      )}

      {/* QR Scanner / Pairing Fullscreen View */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black overflow-hidden animate-fade-in select-none">
          {/* 1. Fullscreen Native Video Feed (Pinch to zoom + Tap to focus) */}
          <div
            className="absolute inset-0 w-full h-full cursor-crosshair flex items-center justify-center bg-black"
            onClick={handleTapToFocus}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: fitMode,
                transform: !hasHardwareZoom && zoom !== 1 ? `scale(${zoom})` : undefined,
                transition: "transform 80ms ease-out",
              }}
              className="w-full h-full"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Tap to focus indicator animation */}
            {focusAnimation && (
              <div
                style={{ left: focusAnimation.x - 32, top: focusAnimation.y - 32 }}
                className="pointer-events-none fixed h-16 w-16 rounded-2xl border-2 border-emerald-400 bg-emerald-400/20 animate-ping transition-all"
              />
            )}
          </div>

          {/* 2. Top Header Navigation (Glassmorphism, Safe Area aware) */}
          <header className="relative z-20 flex items-center justify-between px-4 pt-safe-top pt-3 pb-2">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setScannerOpen(false);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-md transition hover:bg-black/60 active:scale-95"
            >
              <CloseIcon width="18" height="18" />
            </button>

            <div className="text-center px-1">
              <h2 className="text-sm sm:text-base font-bold text-white drop-shadow-md">对准电脑屏幕配对</h2>
              <p className="text-[10px] sm:text-[11px] text-emerald-300 drop-shadow font-mono font-semibold">
                {streamInfo
                  ? `${streamInfo.width}×${streamInfo.height} · ${fitMode === "contain" ? "广角全画幅" : "全屏铺满"}`
                  : "高清取景中..."}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {/* 画幅模式切换按钮 (contain vs cover) */}
              <button
                type="button"
                onClick={() => setFitMode((m) => (m === "contain" ? "cover" : "contain"))}
                className={`flex h-9 px-2.5 items-center justify-center rounded-full backdrop-blur-md text-xs font-semibold transition active:scale-95 ${
                  fitMode === "contain"
                    ? "bg-emerald-600 text-white shadow-md border border-emerald-400/40"
                    : "bg-black/40 text-white/90 hover:bg-black/60"
                }`}
                title="切换画幅模式"
              >
                <span>{fitMode === "contain" ? "📐 广角" : "⛶ 铺满"}</span>
              </button>

              {/* Torch button */}
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${
                    torchOn
                      ? "bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/40"
                      : "bg-black/40 text-white/90 hover:bg-black/60"
                  }`}
                  title="手电筒补光"
                >
                  <FlashlightIcon width="16" height="16" />
                </button>
              )}

              {/* Camera Switch button */}
              {cameraDevices.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchLens}
                  className="flex h-9 px-2 items-center gap-1 justify-center rounded-full bg-blue-600/80 text-white backdrop-blur-md transition hover:bg-blue-600 active:scale-95 text-xs font-medium"
                  title="切换镜头"
                >
                  <CameraSwitchIcon width="14" height="14" />
                  <span>{currentDeviceIndex + 1}/{cameraDevices.length}</span>
                </button>
              )}
            </div>
          </header>

          {/* 3. Center Scanner Frame (WeChat / System Camera style mask) */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center pointer-events-none px-4">
            <div className="relative w-[78vw] max-w-[320px] aspect-square rounded-3xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]">
              {/* Four corners */}
              <div className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

              {/* Laser beam scanline */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,1)] animate-pulse" />
            </div>

            {/* Hint below scanner */}
            <p className="mt-3 text-center text-xs font-medium text-white/90 drop-shadow bg-black/50 px-3.5 py-1.5 rounded-full backdrop-blur-sm">
              保持 30cm 距离更清晰 · 轻触画面可自动对焦
            </p>

            {/* 变焦调节控制器 (对齐 yanpai 工业级取景控制) */}
            <div className="mt-3 pointer-events-auto flex flex-col items-center gap-2 w-full max-w-[320px]">
              {/* 平滑焦距滑动条 */}
              {showZoomSlider && (
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 w-full shadow-lg">
                  <button
                    type="button"
                    onClick={() => applyZoom(zoom - 0.2)}
                    className="text-emerald-300 font-bold px-1.5 text-sm active:scale-90"
                  >
                    一
                  </button>
                  <input
                    type="range"
                    min={minZoom}
                    max={maxZoom}
                    step={stepZoom}
                    value={zoom}
                    onChange={(e) => applyZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => applyZoom(zoom + 0.2)}
                    className="text-emerald-300 font-bold px-1.5 text-sm active:scale-90"
                  >
                    +
                  </button>
                  <span className="font-mono text-xs font-bold text-emerald-400 min-w-[36px] text-right">
                    {zoom.toFixed(1)}x
                  </span>
                </div>
              )}

              {/* 焦距快捷切换胶囊 (0.6x 广角 / 1.0x 标准 / 1.5x / 2.0x 特写) */}
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md p-1 rounded-full border border-white/15">
                {[
                  { label: "0.6x 广角", value: minZoom < 1.0 ? minZoom : 0.6 },
                  { label: "1.0x 标准", value: 1.0 },
                  { label: "1.5x 近焦", value: 1.5 },
                  { label: "2.0x 特写", value: Math.min(2.0, maxZoom) },
                ].map((item) => {
                  const isSelected = Math.abs(zoom - item.value) < 0.15;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => applyZoom(item.value)}
                      className={`h-7 px-3 rounded-full text-xs font-semibold transition active:scale-95 ${
                        isSelected
                          ? "bg-emerald-600 text-white shadow-md border border-emerald-400/40"
                          : "text-white/80 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Bottom Footer: Manual pair code entry */}
          <footer className="relative z-20 px-5 pb-safe-bottom pb-4 pt-2">
            {!showManualInput ? (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualInput(true)}
                  className="w-full flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/15 text-white/90 backdrop-blur-md border border-white/20 text-xs font-medium hover:bg-white/25 active:scale-[0.98] transition"
                >
                  <span>无法扫码？手动粘贴配对码</span>
                </button>

                {pairedPc && (
                  <button
                    type="button"
                    onClick={handleUnpair}
                    className="text-xs text-rose-400/90 hover:underline py-1"
                  >
                    解除当前与「{pairedPc.deviceName}」的配对
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-900/90 p-3.5 backdrop-blur-xl border border-white/15 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white/80">手动输入配对码</span>
                  <button
                    type="button"
                    onClick={() => setShowManualInput(false)}
                    className="text-white/60 hover:text-white text-xs"
                  >
                    取消
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    placeholder="粘贴来自电脑端的配对代码..."
                    className="flex-1 h-10 rounded-xl bg-white/10 px-3 text-xs text-white placeholder-white/40 border border-white/10 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleManualPair}
                    className="h-10 px-4 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 active:scale-95 transition"
                  >
                    配对
                  </button>
                </div>
              </div>
            )}
          </footer>
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
