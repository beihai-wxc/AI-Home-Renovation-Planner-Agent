"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dancing_Script } from "next/font/google";
import LoadingDots from "../../components/LoadingDots";
import ChatInterface from "../../components/ChatInterface";
import ChatHistoryPanel from "../../components/ChatHistoryPanel";
import Skeleton from "../../components/Skeleton";
import ImageLightbox from "../../components/ImageLightbox";
import downloadPhoto from "../../utils/downloadPhoto";
import DropDown from "../../components/DropDown";
import { roomLabels, roomType, rooms, themeLabels, themeType, themes } from "../../utils/dropdownTypes";
import { createAndStoreSessionId, getCurrentSessionId } from "../../utils/session";
import { ensureSessionExists, mapLocalRenderImage } from "../../utils/api";
import { isAuthenticated } from "../../utils/auth";

// 加载手写字体
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dancing",
});

function sanitizeDownloadPart(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim();
}

function resolveImageExtension(url: string | null, fallbackName?: string | null) {
  const source = url || fallbackName || "";
  const match = source.match(/\.([a-zA-Z0-9]+)(?:[?#].*)?$/);
  return match ? `.${match[1].toLowerCase()}` : ".png";
}

export default function DreamPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"generate" | "chat">("generate");
  const [sidebarOpen, setSidebarOpen] = useState(true); // 默认展开
  const [currentSessionId, setCurrentSessionId] = useState<string>("main_session");
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>("正在分析图片内容...");
  const [error, setError] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [theme, setTheme] = useState<themeType>("Modern");
  const [room, setRoom] = useState<roomType>("Living Room");
  const [selectionDirty, setSelectionDirty] = useState<boolean>(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("图片预览");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generationRequestIdRef = useRef(0);

  // 从 localStorage 恢复侧栏状态
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth?redirect=/dream");
      return;
    }
    const saved = localStorage.getItem("sidebarOpen");
    if (saved !== null) {
      setSidebarOpen(saved === "true");
    }
    const sessionId = getCurrentSessionId();
    setCurrentSessionId(sessionId);
    ensureSessionExists(sessionId).catch(() => undefined);
  }, [router]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 4500);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!loading) return;

    const stages = [
      "正在分析图片内容...",
      "正在生成效果图...",
      "正在准备展示结果...",
    ];
    let index = 0;
    setLoadingStage(stages[0]);

    const timer = window.setInterval(() => {
      index = (index + 1) % stages.length;
      setLoadingStage(stages[index]);
    }, 900);

    return () => window.clearInterval(timer);
  }, [loading]);

  // 开始新对话
  const handleNewChat = () => {
    const sessionId = createAndStoreSessionId();
    setCurrentSessionId(sessionId);
    ensureSessionExists(sessionId).catch(() => undefined);
  };

  const beginGenerationTransition = () => {
    setRestoredImage(null);
    setRestoredLoaded(false);
    setLoading(true);
    setLoadingStage("正在分析图片内容...");
    setError(null);
    setSelectionDirty(false);
    setPreviewImageUrl(null);
  };

  const markSelectionsChanged = () => {
    setError(null);
    if (!originalPhoto && !restoredImage && !loading) return;
    generationRequestIdRef.current += 1;
    setSelectionDirty(true);
    setOriginalPhoto(null);
    setPhotoName(null);
    setRestoredImage(null);
    setRestoredLoaded(false);
    setLoading(false);
    setPreviewImageUrl(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoName(file.name);
      const url = URL.createObjectURL(file);
      setOriginalPhoto(url);
      void generatePhotoFromLocal(file);
    }
    e.target.value = "";
  };

  const UploadDropZone = () => (
    <div
      className="mt-4 relative w-full max-w-[670px] overflow-hidden rounded-2xl border-2 border-dashed border-[rgba(93,74,50,0.24)] bg-gradient-to-br from-[rgba(255,252,246,0.88)] to-[rgba(241,232,218,0.64)] transition-all duration-300 cursor-pointer group hover:border-[rgba(140,106,65,0.68)] hover:shadow-soft-lg"
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />
      {originalPhoto ? (
        <div className="relative h-[250px] w-full">
          <img
            src={originalPhoto}
            alt="已上传的房间原图"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-accent shadow-md backdrop-blur-sm">
            重新上传
          </div>
        </div>
      ) : (
        <div className="flex h-[250px] flex-col items-center justify-center p-12">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-[rgba(140,106,65,0.2)] rounded-full blur-xl animate-pulse" />
            <svg className="relative h-14 w-14 text-[rgba(125,95,60,0.7)] transition-all duration-300 group-hover:scale-110 group-hover:text-[#7d5f3c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <p className="text-base font-semibold text-accent">点击上传您的房间照片</p>
          <p className="mt-2 text-xs text-text-secondary/85">支持 JPG、PNG 格式，最大 10MB</p>
        </div>
      )}
    </div>
  );

  const generatePhotoFromLocal = async (file: File | null = null) => {
    const requestId = generationRequestIdRef.current + 1;
    generationRequestIdRef.current = requestId;
    beginGenerationTransition();
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const mapped = await mapLocalRenderImage(file?.name ?? null, themeLabels[theme], roomLabels[room]);
      if (generationRequestIdRef.current !== requestId) {
        return;
      }
      if (!mapped.imageUrl) {
        setRestoredImage(null);
        setError(mapped.message || "图片生成失败");
        return;
      }
      if (!file && mapped.originalImageUrl) {
        setOriginalPhoto(mapped.originalImageUrl);
      }
      if (!file) {
        setPhotoName(`${roomLabels[room]}-${themeLabels[theme]}.png`);
      }
      setSelectionDirty(false);
      setRestoredImage(mapped.imageUrl);
    } catch (err) {
      if (generationRequestIdRef.current !== requestId) {
        return;
      }
      console.warn("local render mapping failed", err);
      setError("读取本地图像库失败，请检查素材目录或稍后重试。");
    } finally {
      if (generationRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="lux-shell h-screen flex flex-col overflow-hidden bg-[transparent]">
      {/* 顶部导航栏 */}
      <header className="relative z-50 border-b border-[rgba(93,74,50,0.22)] bg-[rgba(246,240,230,0.82)] backdrop-blur-xl">
        <div className="flex items-center justify-between w-full py-3 px-4 sm:px-6">
          {/* 左侧：设计你的理想空间 */}
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-[#7d6b56] mb-0.5">DESIGN YOUR SPACE</p>
            <h1 className="font-display text-lg font-bold tracking-normal text-accent sm:text-xl">
              设计你的{" "}
              <span
                className={`${dancingScript.className} text-lg sm:text-xl font-semibold italic text-[#9d7241]`}
              >
                理想空间
              </span>
            </h1>
          </div>

          {/* 中间：模式切换按钮 */}
          <div className="relative flex gap-2 rounded-2xl border border-[rgba(93,74,50,0.24)] bg-[rgba(255,250,243,0.75)] p-1.5 shadow-soft">
            {/* 滑块背景 */}
            <motion.div
              initial={false}
              animate={{
                left: mode === "generate" ? "6px" : "calc(50% + 6px)",
                width: "calc(50% - 12px)"
              }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute top-1.5 h-[calc(100%-12px)] rounded-xl bg-[linear-gradient(150deg,#fffef9_0%,#efe0cc_100%)] shadow-soft"
            />
            <button
              onClick={() => setMode("generate")}
              className={`relative z-10 px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ${
                mode === "generate"
                  ? "text-[#2f2620]"
                  : "text-[#87735f] hover:text-[#4e3c30]"
              }`}
            >
              快速生成
            </button>
            <button
              onClick={() => setMode("chat")}
              className={`relative z-10 px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ${
                mode === "chat"
                  ? "text-[#2f2620]"
                  : "text-[#87735f] hover:text-[#4e3c30]"
              }`}
            >
              AI 问答
            </button>
          </div>

          {/* 右侧：返回首页按钮 */}
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full border border-[rgba(93,74,50,0.24)] bg-[rgba(255,251,244,0.72)] px-4 py-2.5 text-xs font-medium text-accent transition-all duration-300 hover:-translate-y-0.5 hover:bg-[rgba(255,251,244,0.95)] hover:shadow-soft-lg active:scale-95 active:translate-y-0"
          >
            <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="tracking-[0.02em]">返回首页</span>
          </Link>
        </div>
      </header>
      {/* 温暖动态背景层 */}
      <div className="dream-background fixed inset-0 -z-10 pointer-events-none">
        {/* 网格纹理 */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'linear-gradient(rgba(93,74,50,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(93,74,50,0.12) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />
        {/* 背景由 CSS 控制 */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[rgba(175,135,80,0.16)] blur-3xl animate-pulse" style={{ animationDelay: "0s" }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[rgba(65,52,40,0.15)] blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-[rgba(136,105,71,0.12)] blur-2xl animate-pulse" style={{ animationDelay: "4s" }} />
        </div>
      </div>

      <main className="flex-1 flex flex-col min-h-0 w-full h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex-1 flex flex-col min-h-0 w-full h-full"
        >
          {/* 聊天/快速生成内容区域 */}
          <div className="flex-1 min-h-0 relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === "chat" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "chat" ? -20 : 20 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full"
              >
                {mode === "chat" ? (
                  // 聊天模式 - 左侧常驻历史记录面板
                  <motion.div className="flex w-full h-full min-h-0">
                    {/* 历史记录侧栏 - 常驻左侧 */}
                    <motion.div
                      initial={false}
                      animate={{ width: sidebarOpen ? 240 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden flex-shrink-0"
                    >
                      <div className="w-[240px] h-full">
                        <ChatHistoryPanel
                          isOpen={sidebarOpen}
                          currentSessionId={currentSessionId}
                          onSelectSession={(sessionId) => {
                            setCurrentSessionId(sessionId);
                          }}
                          onNewChat={handleNewChat}
                        />
                      </div>
                    </motion.div>

                    {/* 收起/展开按钮 */}
                    <button
                      onClick={() => {
                        const newState = !sidebarOpen;
                        setSidebarOpen(newState);
                        localStorage.setItem("sidebarOpen", String(newState));
                      }}
                      className="flex-shrink-0 w-6 h-full flex items-center justify-center border-x border-[rgba(93,74,50,0.14)] bg-[rgba(255,250,243,0.7)] hover:bg-[rgba(255,250,243,0.95)] transition-colors group"
                      title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
                    >
                      <svg
                        className={`w-4 h-4 text-[rgba(93,74,50,0.58)] group-hover:text-accent transition-transform duration-300 ${sidebarOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* 主聊天区域 */}
                    <div className="flex-1 flex flex-col min-w-0 min-h-0">
                      {/* 聊天界面 */}
                      <div className="flex-1 overflow-hidden bg-[rgba(255,250,243,0.38)]">
                        <ChatInterface
                          sessionId={currentSessionId}
                          onError={setError}
                        />
                        {error && (
                          <div
                            className="bg-red-500/20 border border-red-400/50 text-red-700 px-4 py-3 rounded-xl m-4 backdrop-blur-sm"
                            role="alert"
                          >
                            <span className="block sm:inline">{error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  // 快速生成模式
                  <motion.div className="w-full h-full overflow-y-auto px-4 pt-8 pb-6 sm:px-6">
                    <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[minmax(360px,520px)_1fr] lg:items-start relative">
                      {/* 左上角装饰 */}
                      <div className="absolute -top-2 -left-2 w-8 h-8 border-l border-t border-[rgba(93,74,50,0.22)]" />

                      {/* 右下角装饰 */}
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 border-r border-b border-[rgba(93,74,50,0.22)]" />

                      <div className="lux-panel rounded-[1.75rem] border p-6 shadow-soft-lg transition-all duration-300 hover:-translate-y-0.5 relative group overflow-hidden">
                        {/* 悬浮时显示的装饰圆点 */}
                        <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-[rgba(140,106,65,0.34)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-[rgba(140,106,65,0.34)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        {/* 流式步骤指示器 */}
                        <div className="mb-6 flex items-center gap-2">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-semibold transition-all border-2 ${
                            theme ? "bg-white border-[rgba(140,106,65,0.8)] text-[#6f5537]" : "bg-[rgba(240,230,214,0.9)] border-[rgba(93,74,50,0.2)] text-[#9f8370]"
                          }`}>
                            1
                          </div>
                          <div className="relative flex-1">
                            <div className={`h-0.5 transition-all ${theme ? "bg-[rgba(140,106,65,0.86)]" : "bg-[rgba(93,74,50,0.14)]"}`} />
                            {/* 箭头 */}
                            {theme && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-t-[2.5px] border-b-[2.5px] border-transparent border-t-[rgba(140,106,65,0.86)] border-b-[rgba(140,106,65,0.86)]" />}
                          </div>
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-semibold transition-all border-2 ${
                            room ? "bg-white border-[rgba(140,106,65,0.8)] text-[#6f5537]" : "bg-[rgba(240,230,214,0.9)] border-[rgba(93,74,50,0.2)] text-[#9f8370]"
                          }`}>
                            2
                          </div>
                          <div className="relative flex-1">
                            <div className={`h-0.5 transition-all ${room ? "bg-[rgba(140,106,65,0.86)]" : "bg-[rgba(93,74,50,0.14)]"}`} />
                            {/* 箭头 */}
                            {room && <div className="absolute right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-t-[2.5px] border-b-[2.5px] border-transparent border-t-[rgba(140,106,65,0.86)] border-b-[rgba(140,106,65,0.86)]" />}
                          </div>
                          <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-semibold transition-all border-2 ${
                            originalPhoto ? "bg-white border-[rgba(140,106,65,0.8)] text-[#6f5537]" : "bg-[rgba(240,230,214,0.9)] border-[rgba(93,74,50,0.2)] text-[#9f8370]"
                          }`}>
                            3
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex mt-1 items-center space-x-3">
                            <div className={`relative transition-all ${theme ? "opacity-100 scale-105" : "opacity-60"}`}>
                              <Image src="/number-1-accent.svg" width={28} height={28} alt="步骤一" />
                              {theme && <div className="absolute -inset-1 rounded-lg bg-[rgba(140,106,65,0.15)]" />}
                            </div>
                            <div>
                              <p className="text-left font-medium text-accent">选择您的装修风格</p>
                              <p className="text-[10px] font-normal tracking-wider text-text-secondary/80 mt-0.5 uppercase">Style Selection</p>
                            </div>
                          </div>
                          <DropDown
                            theme={theme}
                            setTheme={(newTheme) => {
                              setTheme(newTheme as typeof theme);
                              markSelectionsChanged();
                            }}
                            themes={themes}
                          />
                        </div>

                        {/* 分隔线 */}
                        <div className="lux-divider h-px w-full" />

                        <div className="space-y-4 mt-6 group">
                          <div className="flex items-center space-x-3">
                            <div className={`relative transition-all ${room ? "opacity-100 scale-105" : "opacity-60"}`}>
                              <Image src="/number-2-accent.svg" width={28} height={28} alt="步骤二" />
                              {room && <div className="absolute -inset-1 rounded-lg bg-[rgba(140,106,65,0.15)]" />}
                            </div>
                            <div>
                              <p className="text-left font-medium text-accent">选择您的房间类型</p>
                              <p className="text-[10px] font-normal tracking-wider text-text-secondary/80 mt-0.5 uppercase">Room Type</p>
                            </div>
                          </div>
                          <DropDown
                            theme={room}
                            setTheme={(newRoom) => {
                              setRoom(newRoom as typeof room);
                              markSelectionsChanged();
                            }}
                            themes={rooms}
                          />
                        </div>

                        {/* 分隔线 */}
                        <div className="lux-divider h-px w-full" />

                        <div className="mt-6 group">
                          <div className="flex items-center space-x-3">
                            <div className={`relative transition-all ${originalPhoto ? "opacity-100 scale-105" : "opacity-60"}`}>
                              <Image src="/number-3-accent.svg" width={28} height={28} alt="步骤三" />
                              {originalPhoto && <div className="absolute -inset-1 rounded-lg bg-[rgba(140,106,65,0.15)]" />}
                            </div>
                            <div>
                              <p className="text-left font-medium text-accent">上传一张您的房间照片（可选）</p>
                              <p className="text-[10px] font-normal tracking-wider text-text-secondary/80 mt-0.5 uppercase">Optional Photo Upload</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <UploadDropZone />
                        </div>
                        {selectionDirty && (
                          <div className="mt-4 rounded-xl border border-[rgba(175,135,80,0.28)] bg-[rgba(255,248,237,0.92)] px-4 py-3 text-sm text-[#7a5c39]">
                            已修改房间或风格，请重新上传图片以生成新结果。
                          </div>
                        )}
                        {error && (
                          <div
                            className="bg-red-500/15 border border-red-400/40 text-red-700 px-4 py-3 rounded-xl mt-6"
                            role="alert"
                          >
                            <span className="block sm:inline">{error}</span>
                          </div>
                        )}
                      </div>

                      <div className="lux-panel rounded-3xl border p-5 min-h-[620px] transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-xl">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h2 className="text-base font-semibold text-accent">生成结果</h2>
                            <p className="text-[10px] font-normal tracking-wider text-text-secondary/80 mt-0.5 uppercase">Generation Result</p>
                          </div>
                          {restoredLoaded && restoredImage && (
                            <button
                              onClick={() => {
                                const filename = `${sanitizeDownloadPart(themeLabels[theme])}-${sanitizeDownloadPart(roomLabels[room])}-new${resolveImageExtension(restoredImage, photoName)}`;
                                downloadPhoto(restoredImage, filename);
                              }}
                              className="group relative rounded-xl border border-[rgba(140,106,65,0.45)] bg-[linear-gradient(135deg,#2c241d_0%,#6a4e2f_80%)] px-4 py-2 text-xs font-semibold tracking-wide text-white hover:-translate-y-0.5 hover:shadow-soft-lg active:scale-95 active:translate-y-0 transition-all duration-300"
                            >
                              <span className="flex items-center gap-2">
                                下载
                                <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </span>
                            </button>
                          )}
                        </div>

                        {restoredImage && (
                          <div className="text-sm font-medium mb-3 text-accent">
                            <b className="text-[#7a5c39]">{roomLabels[room]}</b> · {themeLabels[theme]}风格
                          </div>
                        )}

                        <div className="relative w-full aspect-[4/3] rounded-2xl border border-[rgba(93,74,50,0.18)] bg-[rgba(255,252,247,0.84)] overflow-hidden">
                          {!restoredImage && !loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                              {/* 装饰性图标 */}
                              <div className="relative mb-6">
                                <div className="absolute inset-0 bg-[rgba(140,106,65,0.16)] rounded-full blur-xl" />
                                <svg className="relative w-16 h-16 text-[rgba(140,106,65,0.42)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                  <path d="M3 9h18M9 21V9M15 9v6M9 3v2M15 3v2" />
                                </svg>
                              </div>
                              <p className="text-sm font-medium text-accent">生成结果将显示在这里</p>
                              <p className="text-xs text-text-secondary/85 mt-2">先选择房间和风格，再上传图片开始生成</p>
                            </div>
                          )}

                          {loading && (
                            <div className="absolute inset-0 p-3">
                              <div className="relative h-full w-full overflow-hidden rounded-2xl">
                                <Skeleton variant="rounded" className="h-full w-full" />
                                <div className="absolute inset-0 bg-gradient-to-br from-white/18 via-transparent to-[rgba(140,106,65,0.14)]" />
                                <div className="absolute inset-0 flex items-center justify-center p-6">
                                  <motion.div
                                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-[rgba(93,74,50,0.18)] bg-[rgba(255,251,244,0.82)] px-6 py-7 text-center shadow-soft-xl backdrop-blur-md"
                                  >
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                                      className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(93,74,50,0.2)] bg-[rgba(245,236,222,0.9)]"
                                    >
                                      <svg className="h-7 w-7 text-[#7d5f3c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 01-8 8" opacity="0.35" />
                                      </svg>
                                    </motion.div>
                                    <div className="text-base font-semibold text-accent">
                                      图片生成中
                                    </div>
                                    <motion.div
                                      key={loadingStage}
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -6 }}
                                      className="mt-2 text-sm text-text-secondary"
                                    >
                                      {loadingStage}
                                    </motion.div>
                                    <div className="mt-4">
                                      <LoadingDots color="#A88A5A" style="large" />
                                    </div>
                                  </motion.div>
                                </div>
                              </div>
                            </div>
                          )}

                          {restoredImage && (
                            <button
                              type="button"
                              className="absolute inset-0 h-full w-full"
                              onClick={() => {
                                setPreviewImageUrl(restoredImage);
                                setPreviewTitle("生成图片预览");
                              }}
                            >
                              <Image
                                alt="生成后的房间照片"
                                src={restoredImage}
                                className="h-full w-full object-cover"
                                fill
                                onLoadingComplete={() => setRestoredLoaded(true)}
                              />
                            </button>
                          )}

                          {restoredImage && !restoredLoaded && !loading && (
                            <div className="absolute inset-0 p-3">
                              <Skeleton variant="rounded" className="h-full w-full" />
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
      <ImageLightbox
        isOpen={Boolean(previewImageUrl)}
        imageUrl={previewImageUrl}
        title={previewTitle}
        onClose={() => setPreviewImageUrl(null)}
      />
    </div>
  );
}
