import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "./website.css";

// --- Icons ---
function WindowsIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.901-1.801" />
    </svg>
  );
}

function AndroidIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.411 13.8564 8 12 8s-3.5902.411-5.1367.9497L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function ZapIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function LockClosedIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function CopyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function GithubIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PinIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
    </svg>
  );
}

function SearchIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function SmartphoneIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function QrCodeIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// --- Interactive Sandbox Clip Item Interface ---
interface MockClip {
  id: number;
  kind: "text" | "image" | "color" | "url";
  title: string;
  preview: string;
  colorHex?: string;
  pinned: boolean;
  time: string;
}

const INITIAL_MOCK_CLIPS: MockClip[] = [
  {
    id: 1,
    kind: "color",
    title: "Brand Accent Cyan",
    preview: "#06B6D4",
    colorHex: "#06B6D4",
    pinned: true,
    time: "刚刚",
  },
  {
    id: 2,
    kind: "text",
    title: "API Token (E2EE Encrypted)",
    preview: "cf_live_9a87bf23d8e90c1f44a921",
    pinned: false,
    time: "2分钟前",
  },
  {
    id: 3,
    kind: "image",
    title: "产品架构预览图",
    preview: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80",
    pinned: false,
    time: "5分钟前",
  },
  {
    id: 4,
    kind: "url",
    title: "GitHub 开源仓库",
    preview: "https://github.com/haiwen619/Haiwenna-ClipFlow",
    pinned: false,
    time: "10分钟前",
  },
];

export function WebsiteApp() {
  // Demo States
  const [clips, setClips] = useState<MockClip[]>(INITIAL_MOCK_CLIPS);
  const [filter, setFilter] = useState<"all" | "text" | "image" | "pinned">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [privacyGuard, setPrivacyGuard] = useState(true);
  const [isSyncingBeam, setIsSyncingBeam] = useState(false);
  const [mobilePhoneClips, setMobilePhoneClips] = useState<MockClip[]>([INITIAL_MOCK_CLIPS[0]]);

  // FAQ Accordion
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleCopyMock = (clip: MockClip) => {
    navigator.clipboard?.writeText(clip.preview).catch(() => {});
    showToast(`✓ 已复制: ${clip.title}`);
  };

  const handleTriggerSync = () => {
    if (isSyncingBeam) return;
    setIsSyncingBeam(true);

    const newClip: MockClip = {
      id: Date.now(),
      kind: "text",
      title: "跨屏同步测试数据",
      preview: "🚀 来自 PC 端的端到端加密文字，秒级到达手机！",
      pinned: false,
      time: "刚刚",
    };

    setClips((prev) => [newClip, ...prev]);

    setTimeout(() => {
      setMobilePhoneClips((prev) => [newClip, ...prev]);
      setIsSyncingBeam(false);
      showToast("✓ 手机端已通过 AES-256-GCM 解密接收！");
    }, 1200);
  };

  const filteredClips = clips.filter((c) => {
    if (filter === "text" && c.kind !== "text" && c.kind !== "url" && c.kind !== "color") return false;
    if (filter === "image" && c.kind !== "image") return false;
    if (filter === "pinned" && !c.pinned) return false;
    if (!searchQuery.trim()) return true;
    return (
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.preview.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col font-sans relative selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Background Gradients & Grid */}
      <div className="fixed inset-0 bg-grid-pattern opacity-40 pointer-events-none" />
      <div className="fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] aurora-glow-1 pointer-events-none" />
      <div className="fixed top-1/3 -left-48 w-[600px] h-[600px] aurora-glow-2 pointer-events-none" />
      <div className="fixed bottom-10 -right-48 w-[600px] h-[600px] aurora-glow-3 pointer-events-none" />

      {/* Floating Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-cyan-500/30 bg-slate-900/90 px-5 py-2.5 text-xs font-semibold text-cyan-200 shadow-2xl backdrop-blur-xl animate-fade-in">
          <CheckIcon className="text-cyan-400 w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Navbar */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-[#080B11]/80 backdrop-blur-xl px-6 lg:px-12 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition">
              H
            </div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-lg tracking-tight text-white">ClipFlow</span>
              <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-300">
                v0.1.2
              </span>
            </div>
          </a>

          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition">核心特性</a>
            <a href="#demo" className="hover:text-white transition">交互沙盒演示</a>
            <a href="#security" className="hover:text-white transition">E2EE 安全架构</a>
            <a href="#download" className="hover:text-white transition">双端下载</a>
            <a href="#faq" className="hover:text-white transition">常见问题</a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/haiwen619/Haiwenna-ClipFlow"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              <GithubIcon className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a
              href="#download"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 hover:opacity-95 active:scale-95 transition"
            >
              <WindowsIcon className="w-3.5 h-3.5" />
              <span>立即下载</span>
            </a>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative pt-20 pb-16 lg:pt-28 lg:pb-24 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Release Pill Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-4 py-1.5 text-xs font-medium text-cyan-300 mb-8 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span>ClipFlow v0.1.2 正式发布 · Windows + Android 端到端加密实时同步</span>
        </div>

        {/* Hero Title */}
        <h1 className="font-heading font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight max-w-5xl text-white leading-[1.15]">
          极速、优雅、光标跟随 <br />
          <span className="text-gradient-cyan-blue">重塑你的 Windows 剪贴板体验</span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 max-w-2xl text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed font-normal">
          为追求极致输入手感的开发者与创造者量身定制。原生 <strong className="text-slate-200">Win+V</strong> 完美平替，
          毫秒级文本光标吸附，端到端零知识加密（E2EE）跨网实时互通，纯本地 SQLite 存储，隐私永不泄露。
        </p>

        {/* Hero CTA Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://github.com/haiwen619/Haiwenna-ClipFlow/releases"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:-translate-y-0.5 active:translate-y-0 transition"
          >
            <WindowsIcon className="w-5 h-5" />
            <span>下载 Windows 版 (v0.1.2)</span>
          </a>

          <a
            href="/app-universal-debug.apk"
            download="ClipFlow-v0.1.2-universal.apk"
            className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-slate-900/80 hover:bg-slate-800/80 px-6 py-3.5 text-sm font-semibold text-slate-200 shadow-lg backdrop-blur-md hover:-translate-y-0.5 active:translate-y-0 transition"
          >
            <AndroidIcon className="w-5 h-5 text-emerald-400" />
            <span>下载 Android APK (通用版)</span>
          </a>

          <a
            href="#demo"
            className="flex items-center gap-2 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 px-5 py-3.5 text-sm font-medium text-slate-300 transition"
          >
            <ZapIcon className="w-4 h-4 text-amber-400" />
            <span>互动体验沙盒</span>
          </a>
        </div>

        {/* Trust & Spec Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-y-3 gap-x-8 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-4 h-4 text-cyan-400" />
            <span>纯本地 SQLite 离线存储</span>
          </div>
          <div className="flex items-center gap-2">
            <LockClosedIcon className="w-4 h-4 text-emerald-400" />
            <span>零知识 AES-256-GCM 加密</span>
          </div>
          <div className="flex items-center gap-2">
            <ZapIcon className="w-4 h-4 text-amber-400" />
            <span>内存占用 &lt; 30MB (Rust 驱动)</span>
          </div>
          <div className="flex items-center gap-2">
            <GithubIcon className="w-4 h-4 text-purple-400" />
            <span>100% 永久开源无广告</span>
          </div>
        </div>
      </section>

      {/* 3. Interactive Sandbox Live Demo Section */}
      <section id="demo" className="relative py-16 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
            无需安装，直接在线上手体验
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            1:1 还原 ClipFlow 桌面端核心窗口与手机端跨网秒级同步流程，点击下方组件亲自感受丝滑手感。
          </p>
        </div>

        {/* Sandbox Canvas Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left / Center: Interactive ClipFlow Desktop Window */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-[#0E1524]/90 p-4 shadow-2xl backdrop-blur-2xl relative">
              {/* Window Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-1 text-xs font-heading font-bold text-slate-300">ClipFlow</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Privacy Guard Indicator */}
                  <button
                    type="button"
                    onClick={() => setPrivacyGuard(!privacyGuard)}
                    title={privacyGuard ? "隐私保护模式运行中" : "监听暂停中"}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition ${
                      privacyGuard
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${privacyGuard ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                    <span>{privacyGuard ? "监听中" : "已挂起"}</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mt-3 relative">
                <SearchIcon className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索历史记录、颜色或链接 (支持全键盘)..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:bg-white/10 focus:outline-none transition"
                />
              </div>

              {/* Filter Tabs */}
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {(
                  [
                    { id: "all", label: "全部" },
                    { id: "text", label: "文本" },
                    { id: "image", label: "图片" },
                    { id: "pinned", label: "置顶" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      filter === tab.id
                        ? "bg-cyan-500 text-white shadow-sm font-semibold"
                        : "bg-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Clips List */}
              <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredClips.map((clip, index) => (
                  <div
                    key={clip.id}
                    onClick={() => handleCopyMock(clip)}
                    className="group rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.08] hover:border-cyan-500/40 p-3 transition cursor-pointer flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-cyan-400/80 font-bold">{index + 1}</span>
                        <span className="font-medium text-slate-300">{clip.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {clip.pinned && <PinIcon className="text-amber-400 w-3 h-3" />}
                        <span className="font-mono">{clip.time}</span>
                      </div>
                    </div>

                    {/* Preview Type Rendering */}
                    {clip.kind === "color" && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <div
                          className="w-4 h-4 rounded-md shadow border border-white/20"
                          style={{ backgroundColor: clip.colorHex }}
                        />
                        <span className="font-mono text-xs font-semibold text-slate-200">
                          {clip.colorHex}
                        </span>
                        <span className="text-[10px] text-cyan-400/70 border border-cyan-500/20 px-1 rounded">
                          智能色卡
                        </span>
                      </div>
                    )}

                    {clip.kind === "text" && (
                      <div className="font-mono text-xs text-slate-300 truncate">
                        {clip.preview}
                      </div>
                    )}

                    {clip.kind === "url" && (
                      <div className="text-xs text-cyan-400 underline underline-offset-2 truncate">
                        {clip.preview}
                      </div>
                    )}

                    {clip.kind === "image" && (
                      <div className="h-20 w-full rounded-lg overflow-hidden border border-white/10 mt-1">
                        <img src={clip.preview} alt="mock" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500 border-t border-white/5">
                      <span>回车粘贴 · P 置顶</span>
                      <span className="flex items-center gap-1 text-cyan-400 group-hover:translate-x-0.5 transition">
                        <CopyIcon className="w-3 h-3" />
                        <span>点击复制</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Trigger Button inside Demo */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">按 Win+V 随时就地呼出</span>
                <button
                  type="button"
                  onClick={handleTriggerSync}
                  disabled={isSyncingBeam}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:opacity-90 active:scale-95 disabled:opacity-50 transition"
                >
                  <ZapIcon className="w-3.5 h-3.5" />
                  <span>{isSyncingBeam ? "E2EE 密文穿梭中..." : "模拟电脑端复制推送"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Simulated Mobile Sync Terminal */}
          <div className="lg:col-span-5 flex flex-col items-center relative">
            {/* Animated Beam Effect between PC and Mobile */}
            {isSyncingBeam && (
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 z-20 pointer-events-none hidden lg:block">
                <div className="w-24 h-1 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full shadow-[0_0_12px_#06b6d4] animate-sync-beam" />
              </div>
            )}

            {/* Mobile Phone Device Mockup */}
            <div className="w-[280px] h-[520px] rounded-[40px] border-4 border-slate-700 bg-slate-950 p-3 shadow-2xl flex flex-col relative overflow-hidden">
              {/* Dynamic Island / Camera Notch */}
              <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-900 ml-auto mr-3" />
              </div>

              {/* Mobile Screen Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-white">ClipFlow Mobile</span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">E2EE 在线</span>
              </div>

              {/* Mobile Phone Clips Feed */}
              <div className="flex-1 overflow-y-auto py-2 space-y-2">
                <div className="text-[10px] text-slate-500 text-center py-1">
                  电脑端复制的内容将通过 E2EE 实时同步到此
                </div>
                {mobilePhoneClips.map((clip) => (
                  <div
                    key={clip.id}
                    onClick={() => {
                      showToast(`✓ 手机端已复制: ${clip.title}`);
                    }}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 active:scale-95 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1">
                      <span className="font-semibold text-slate-200">{clip.title}</span>
                      <span className="font-mono text-[9px]">{clip.time}</span>
                    </div>
                    <div className="text-xs text-slate-300 font-normal leading-relaxed line-clamp-2">
                      {clip.preview}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9px] text-cyan-400/80 pt-1 border-t border-slate-800/80">
                      <span>轻触复制</span>
                      <CopyIcon className="w-3 h-3" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile Bottom Action Bar */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    showToast("✓ 手机剪贴板已反向同步至电脑！");
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600/90 py-2 text-xs font-semibold text-white active:scale-95 transition"
                >
                  <SmartphoneIcon className="w-3.5 h-3.5" />
                  <span>发送手机剪贴板至电脑</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Bento Grid Features Section */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
            为生产力而生的六大硬核特性
          </h2>
          <p className="mt-3 text-slate-400 text-sm max-w-2xl mx-auto">
            从内核架构到像素级视觉打磨，彻底摆脱 Windows 原生剪贴板的卡顿与功能匮乏。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Win+V Replacement */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-5">
              <ZapIcon className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-lg text-white">
              Win+V 极速平替 & 光标跟随
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed flex-1">
              告别原生剪贴板的迟钝卡滞。ClipFlow 采用底层 Win32 API 毫秒级捕获前台应用输入光标（Text Caret），呼出即贴紧输入点；支持 <strong className="text-slate-200">1~9 数字键直出粘贴</strong>。
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[11px] text-cyan-400">
              ⚡ 0ms 感知延迟 · 光标自适应防溢出翻转
            </div>
          </div>

          {/* Card 2: E2EE Zero-Knowledge Sync */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5">
              <LockClosedIcon className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-lg text-white">
              零知识端到端加密（E2EE）
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed flex-1">
              基于工业级 <strong className="text-slate-200">AES-256-GCM</strong> 对称加密与 SHA-256 房间隔离。秘钥仅在您扫码配对时协商并保存在本地设备中，云端中继仅转发高强度密文信封，绝无明文落地风险。
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[11px] text-emerald-400">
              🔒 密文仅在终端解密 · 服务器无法窥探
            </div>
          </div>

          {/* Card 3: Dual Channel Sync */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5">
              <SmartphoneIcon className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-lg text-white">
              双通道跨网穿透（LAN + Cloud）
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed flex-1">
              同一 Wi-Fi 下优先局域网 P2P 直连，极致 0 延迟；出差在外或处于 5G 蜂窝网时，毫秒级无缝切换到云端 WebSocket 中继，文字与截图（PNG Base64）无缝秒达。
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[11px] text-blue-400">
              🌐 局域网直连 + 5G 中继自动双向容灾
            </div>
          </div>

          {/* Card 4: Privacy Guard & Apps Filter */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-5">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-lg text-white">
              幽灵隐私守卫 & 密码管理器避让
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed flex-1">
              内置敏感应用穿梭过滤器，自动识别 1Password、Bitwarden、KeePass 等密码管理器，复制密码完全不存盘；支持一键开启呼吸灯“幽灵模式”原子级挂起监听。
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[11px] text-purple-400">
              🛡️ 进程级安全过滤 · 绝不记录密码与秘钥
            </div>
          </div>

          {/* Card 5: Smart Formatting */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5">
              <CopyIcon className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-lg text-white">
              智能语义取色卡 & 纯文本清洗
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed flex-1">
              复制 Hex（#fff）、RGB 颜色时实时渲染取色对比色块；复制 URL 链接自动提供浏览器直达按钮；一键纯文本格式去垢，彻底清除 Word 与网页的多余脏格式与空行。
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[11px] text-amber-400">
              🎨 实时色卡渲染 · 链接直达 · 富文本去污
            </div>
          </div>

          {/* Card 6: Raycast/Vim Keyboard Flow */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-5">
              <QrCodeIcon className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-lg text-white">
              全键盘流交互 & 三核扫码引擎
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed flex-1">
              桌面端支持 ↑↓ 穿梭、P 置顶、C 复制、Del 即删；手机端集成 BarcodeDetector 原生 GPU 加速 + 工业级 ZXing HybridBinarizer，专克屏幕反光摩尔纹，扫码配对瞬间连通。
            </p>
            <div className="mt-4 pt-3 border-t border-white/5 font-mono text-[11px] text-rose-400">
              ⌨️ 双手不离主键盘 · 手机 0ms 瞬间配对
            </div>
          </div>
        </div>
      </section>

      {/* 5. Security & Architecture Section */}
      <section id="security" className="py-20 px-6 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-1 text-xs font-semibold text-emerald-300 mb-4">
            <LockClosedIcon className="w-3.5 h-3.5" />
            <span>隐私至上与透明架构</span>
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
            为什么 ClipFlow 是最值得信赖的跨屏剪贴板？
          </h2>
          <p className="mt-3 text-slate-400 text-sm max-w-2xl mx-auto">
            我们坚信剪贴板包含用户最私密的个人信息。ClipFlow 从第一行代码开始，便遵循「本地优先」与「零知识加密」的设计准则。
          </p>
        </div>

        {/* Visual Architecture Flow Diagram */}
        <div className="glass-panel rounded-3xl p-6 lg:p-10 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Step 1 */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 text-xs text-slate-400 font-mono border-b border-white/5">
                <span>01. Windows 本地端</span>
                <span className="text-cyan-400">Origin</span>
              </div>
              <p className="mt-3 text-xs text-slate-300 leading-relaxed flex-1">
                用户按下 Ctrl+C 复制文本或截图。Rust 底层监听线程捕获数据，过滤密码管理器名单后，持久化写入本地 SQLite。
              </p>
              <div className="mt-3 rounded-lg bg-black/40 p-2 font-mono text-[11px] text-slate-400 border border-white/5">
                AES-GCM (Key, Nonce, Payload)
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 text-xs text-slate-400 font-mono border-b border-white/5">
                <span>02. 零知识加密传输</span>
                <span className="text-amber-400">Relay / LAN</span>
              </div>
              <p className="mt-3 text-xs text-slate-300 leading-relaxed flex-1">
                密文信封通过 WebSocket 传输。中继服务器仅做房间路由，既无数据库落地，也无解密私钥，对传输内容完全不可见。
              </p>
              <div className="mt-3 rounded-lg bg-black/40 p-2 font-mono text-[11px] text-amber-300 border border-white/5">
                {`{ room: "331d67...", ciphertext: "k9F..." }`}
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 text-xs text-slate-400 font-mono border-b border-white/5">
                <span>03. 移动客户端</span>
                <span className="text-emerald-400">Destination</span>
              </div>
              <p className="mt-3 text-xs text-slate-300 leading-relaxed flex-1">
                手机 App 接收到加密包后，用本地扫码保存的共享私钥解密，震动提醒并在列表顶部渲染，同时写入手机系统剪贴板。
              </p>
              <div className="mt-3 rounded-lg bg-black/40 p-2 font-mono text-[11px] text-emerald-300 border border-white/5">
                Plaintext Restored & Haptic
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Download Hub Section */}
      <section id="download" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
            立即获取 Haiwenna ClipFlow
          </h2>
          <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">
            永久免费开源，支持 Windows 10/11 桌面端与 Android 移动端。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Windows Client */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-7 flex flex-col relative border-cyan-500/30">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <WindowsIcon className="w-6 h-6" />
              </div>
              <span className="rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-2.5 py-0.5 text-xs font-mono font-semibold">
                v0.1.2
              </span>
            </div>

            <h3 className="font-heading font-bold text-xl text-white mt-5">Windows 桌面客户端</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed flex-1">
              原生 Win+V 接管、毫秒光标吸附、托盘驻留、自启动服务与全局极速热键。
            </p>

            <div className="mt-6 space-y-2 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-2">
                <CheckIcon className="text-cyan-400" />
                <span>支持 Windows 10 / 11 (64位)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="text-cyan-400" />
                <span>免配置开机自启与全局快捷键</span>
              </div>
            </div>

            <a
              href="https://github.com/haiwen619/Haiwenna-ClipFlow/releases"
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:opacity-95 active:scale-95 transition"
            >
              <WindowsIcon className="w-4 h-4" />
              <span>下载 Windows 安装包</span>
            </a>
          </div>

          {/* Card 2: Android Companion */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-7 flex flex-col relative border-emerald-500/30">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <AndroidIcon className="w-6 h-6" />
              </div>
              <span className="rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-mono font-semibold">
                v0.1.2 Universal
              </span>
            </div>

            <h3 className="font-heading font-bold text-xl text-white mt-5">Android 移动伴侣</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed flex-1">
              内置 3 核硬件扫码配对、双向文字与图片实时接收、离线高保真相册与点击速贴。
            </p>

            <div className="mt-6 space-y-2 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-2">
                <CheckIcon className="text-emerald-400" />
                <span>支持 Android 7.0 及以上所有设备</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="text-emerald-400" />
                <span>全 CPU 架构通用安装包 (Universal APK)</span>
              </div>
            </div>

            <a
              href="/app-universal-debug.apk"
              download="ClipFlow-v0.1.2-universal.apk"
              className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:opacity-95 active:scale-95 transition"
            >
              <AndroidIcon className="w-4 h-4" />
              <span>下载 Android APK (直链)</span>
            </a>
          </div>

          {/* Card 3: Self-Host & Source */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-7 flex flex-col relative">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <GithubIcon className="w-6 h-6" />
              </div>
              <span className="rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2.5 py-0.5 text-xs font-mono font-semibold">
                Open Source
              </span>
            </div>

            <h3 className="font-heading font-bold text-xl text-white mt-5">源码与私有中继</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed flex-1">
              完全开源透明。支持企业或极客用户基于 Node.js / Docker 自建专属 E2EE 剪贴板中继节点。
            </p>

            <div className="mt-6 space-y-2 text-xs text-slate-300 font-medium">
              <div className="flex items-center gap-2">
                <CheckIcon className="text-purple-400" />
                <span>MIT 开源授权协议</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="text-purple-400" />
                <span>单文件极轻中继，一键部署</span>
              </div>
            </div>

            <a
              href="https://github.com/haiwen619/Haiwenna-ClipFlow"
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-slate-200 hover:bg-white/10 active:scale-95 transition"
            >
              <GithubIcon className="w-4 h-4" />
              <span>前往 GitHub 仓库</span>
            </a>
          </div>
        </div>
      </section>

      {/* 7. FAQ Section */}
      <section id="faq" className="py-20 px-6 max-w-4xl mx-auto border-t border-white/5">
        <div className="text-center mb-12">
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
            常见问题与解答
          </h2>
          <p className="mt-3 text-slate-400 text-sm">
            解答关于安全性、跨网同步与日常使用的核心疑问。
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              q: "我的剪贴板内容会被上传并存储到你们的服务器吗？",
              a: "绝对不会。ClipFlow 采用端到端零知识加密（E2EE），加解密过程 100% 在您的本地设备（PC/手机）通过 AES-256-GCM 完成。云端中继仅作为加密数据的穿透信使，不存盘、不解密、不保留任何历史记录。",
            },
            {
              q: "电脑和手机不在同一个 Wi-Fi 网络下，可以同步吗？",
              a: "完全可以！ClipFlow 支持「局域网直连 + 云端安全中继」双通道架构。当手机处于 4G/5G 移动蜂窝网或外地网络时，会自动通过云端加密中继实现秒级互通。",
            },
            {
              q: "图片和截图能同步吗？传输速度如何？",
              a: "完全支持。在电脑端按下 Win+Shift+S 截图或在网页复制图片，ClipFlow 都会以 Data URL 形式加密传输至手机；移动端采用 32KB 分块高性能加解密算法，数兆体积的截图亦可在 1 秒内秒级到达并清晰展示。",
            },
            {
              q: "复制银行卡密码、Token 等敏感信息会被误记吗？",
              a: "不会。ClipFlow 内置了密码管理器智能避让名单（1Password、Bitwarden、KeePass 等），复制时在底层被直接过滤丢弃；同时顶栏提供「幽灵模式」指示灯，可随时一键临时暂停监听。",
            },
            {
              q: "这个软件收费吗？未来会加入广告吗？",
              a: "ClipFlow 永久 100% 免费开源，绝不植入任何商业广告与用户行为追踪代码。",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="glass-panel rounded-2xl border border-white/5 overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-5 text-left text-sm font-semibold text-slate-200 hover:text-white"
              >
                <span>{item.q}</span>
                <ChevronDownIcon
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    openFaq === idx ? "rotate-180 text-cyan-400" : ""
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3 animate-fade-in">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="mt-auto border-t border-white/5 bg-[#05070B] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-black text-sm">
              H
            </div>
            <div>
              <span className="font-heading font-extrabold text-sm text-white">Haiwenna ClipFlow</span>
              <p className="text-[11px] text-slate-500">© 2026 Haiwenna. Released under the MIT License.</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <a
              href="https://github.com/haiwen619/Haiwenna-ClipFlow"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition flex items-center gap-1.5"
            >
              <GithubIcon className="w-4 h-4" />
              <span>GitHub 仓库</span>
            </a>
            <a
              href="https://github.com/haiwen619/Haiwenna-ClipFlow/releases"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition"
            >
              更新日志
            </a>
            <a
              href="#security"
              className="hover:text-white transition"
            >
              隐私与安全
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <WebsiteApp />
    </React.StrictMode>
  );
}
