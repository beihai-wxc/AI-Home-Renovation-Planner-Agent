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
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("图片预览");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPreviewImageUrl(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoName(file.name);
      const url = URL.createObjectURL(file);
      setOriginalPhoto(url);
      generatePhotoFromLocal(file);
    }
  };

  const UploadDropZone = () => (
    <div
      className="mt-4 relative w-full max-w-[670px] overflow-hidden rounded-2xl border-2 border-dashed border-[#8B6F47]/30 bg-white/60 backdrop-blur-sm transition-all duration-300 cursor-pointer group hover:border-[#8B6F47]/50 hover:bg-white/80"
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
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-[#2D2D2D] shadow-sm">
            重新上传
          </div>
        </div>
      ) : (
        <div className="flex h-[250px] flex-col items-center justify-center p-12">
          <svg className="mb-4 h-12 w-12 text-[#8B6F47]/60 transition-all duration-300 group-hover:scale-110 group-hover:text-[#8B6F47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-xl font-medium text-[#2D2D2D]">点击上传您的房间照片</p>
          <p className="mt-2 text-[#8A8A8A]">支持 JPG, PNG 格式</p>
        </div>
      )}
    </div>
  );

  const generatePhotoFromLocal = async (file: File | null = null) => {
    beginGenerationTransition();
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const mapped = await mapLocalRenderImage(file?.name ?? null, themeLabels[theme]);
      if (!mapped.imageUrl) {
        setRestoredImage(null);
        // 本地匹配失败时静默处理，不向前端展示错误提示。
        console.warn("local render mapping not found", mapped.message || "no mapping");
        return;
      }
      if (!file && mapped.originalImageUrl) {
        setOriginalPhoto(mapped.originalImageUrl);
      }
      if (!file) {
        setPhotoName(`${themeLabels[theme]}.png`);
      }
      setRestoredImage(mapped.imageUrl);
    } catch (err) {
      // 本地映射异常时静默处理，避免在界面显示匹配失败信息。
      console.warn("local render mapping failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent border-b border-[#8B6F47]/10">
        <div className="flex items-center justify-between w-full py-3 px-4 sm:px-6">
          {/* 左侧：设计你的理想空间 */}
          <h1 className="font-display text-lg font-bold tracking-normal text-[#2D2D2D] sm:text-xl">
            设计你的{" "}
            <span
              className={`${dancingScript.className} text-lg sm:text-xl font-semibold italic bg-clip-text text-transparent`}
              style={{
                backgroundImage: 'linear-gradient(135deg, #E8B86D 0%, #8B6F47 25%, #7A9E7E 50%, #5B8A72 75%, #E8B86D 100%)',
                textShadow: 'none',
                letterSpacing: '0.02em',
                WebkitBackgroundClip: 'text',
                backgroundSize: '200% 200%',
                animation: 'gradientFlow 3s ease infinite'
              }}
            >
              理想空间
            </span>
          </h1>

          {/* 中间：模式切换按钮 */}
          <div className="bg-white/60 backdrop-blur-md p-1 rounded-xl border border-[#8B6F47]/15 shadow-sm">
            <button
              onClick={() => setMode("generate")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                mode === "generate"
                  ? "bg-[#8B6F47] text-white shadow-md"
                  : "text-[#5A5A5A] hover:text-[#2D2D2D] hover:bg-white/50"
              }`}
            >
              快速生成
            </button>
            <button
              onClick={() => setMode("chat")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                mode === "chat"
                  ? "bg-[#7A9E7E] text-white shadow-md"
                  : "text-[#5A5A5A] hover:text-[#2D2D2D] hover:bg-white/50"
              }`}
            >
              AI 问答
            </button>
          </div>

          {/* 右侧：返回首页按钮 */}
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full border border-[#8B6F47]/30 bg-gradient-to-b from-white/95 to-[#F9F3EA]/90 px-3.5 py-1.5 text-sm font-medium text-[#5A5A5A] shadow-[0_6px_18px_rgba(139,111,71,0.16)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-[#8B6F47]/55 hover:text-[#2D2D2D] hover:shadow-[0_10px_24px_rgba(139,111,71,0.22)]"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#8B6F47]/25 bg-white/90 text-[#8B6F47] transition-colors group-hover:border-[#8B6F47]/45 group-hover:bg-white">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </span>
            <span className="tracking-[0.01em]">返回首页</span>
          </Link>
        </div>
      </header>
      {/* 温暖动态背景层 */}
      <div className="dream-background fixed inset-0 -z-10 pointer-events-none">
        {/* 背景由 CSS 控制 */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/[0.08] rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0s" }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/[0.06] rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-500/[0.05] rounded-full blur-2xl animate-pulse" style={{ animationDelay: "4s" }} />
        </div>
      </div>

      <main className="flex-1 flex flex-col min-h-0 w-full h-full pt-16">
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
                      className="flex-shrink-0 w-6 h-full flex items-center justify-center bg-white/40 hover:bg-white/60 transition-colors group"
                      title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
                    >
                      <svg
                        className={`w-4 h-4 text-[#8B6F47]/60 group-hover:text-[#8B6F47] transition-transform duration-300 ${sidebarOpen ? "rotate-180" : ""}`}
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
                      <div className="flex-1 overflow-hidden bg-white/40 backdrop-blur-sm">
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
                    <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[minmax(360px,520px)_1fr] lg:items-start">
                      <div className="rounded-2xl border border-[#8B6F47]/15 bg-white/55 p-5 backdrop-blur-sm">
                        <div className="space-y-4">
                          <div className="flex mt-1 items-center space-x-3">
                            <Image src="/number-1-white.svg" width={30} height={30} alt="步骤一" />
                            <p className="text-left font-medium text-[#2D2D2D]">选择您的装修风格。</p>
                          </div>
                          <DropDown
                            theme={theme}
                            setTheme={(newTheme) => setTheme(newTheme as typeof theme)}
                            themes={themes}
                          />
                        </div>

                        <div className="space-y-4 mt-6">
                          <div className="flex items-center space-x-3">
                            <Image src="/number-2-white.svg" width={30} height={30} alt="步骤二" />
                            <p className="text-left font-medium text-[#2D2D2D]">选择您的房间类型。</p>
                          </div>
                          <DropDown
                            theme={room}
                            setTheme={(newRoom) => setRoom(newRoom as typeof room)}
                            themes={rooms}
                          />
                        </div>

                        <div className="mt-6">
                          <div className="flex items-center space-x-3">
                            <Image src="/number-3-white.svg" width={30} height={30} alt="步骤三" />
                            <p className="text-left font-medium text-[#2D2D2D]">上传一张您的房间照片。</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <UploadDropZone />
                        </div>
                        {error && (
                          <div
                            className="bg-red-500/20 border border-red-400/50 text-red-700 px-4 py-3 rounded-xl mt-6 backdrop-blur-sm"
                            role="alert"
                          >
                            <span className="block sm:inline">{error}</span>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-[#8B6F47]/15 bg-white/55 p-5 backdrop-blur-sm min-h-[620px]">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h2 className="text-lg font-semibold text-[#2D2D2D]">生成结果</h2>
                          {restoredLoaded && restoredImage && (
                            <button
                              onClick={() => {
                                const filename = `${sanitizeDownloadPart(themeLabels[theme])}-${sanitizeDownloadPart(roomLabels[room])}-new${resolveImageExtension(restoredImage, photoName)}`;
                                downloadPhoto(restoredImage, filename);
                              }}
                              className="btn-warm rounded-full border border-[#8B6F47]/20 bg-[#8B6F47] px-5 py-2 font-medium text-white backdrop-blur-md hover:bg-[#A68B5B]"
                            >
                              下载
                            </button>
                          )}
                        </div>

                        {restoredImage && (
                          <div className="text-base font-medium mb-3 text-[#2D2D2D]">
                            <b className="text-[#8B6F47]">{roomLabels[room]}</b> · {themeLabels[theme]}风格
                          </div>
                        )}

                        <div className="relative w-full aspect-[4/3] rounded-2xl border border-[#8B6F47]/20 bg-white/60 overflow-hidden">
                          {!restoredImage && !loading && (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#8A8A8A]">
                              右侧将显示新生成的图片
                            </div>
                          )}

                          {loading && (
                            <div className="absolute inset-0 p-3">
                              <div className="relative h-full w-full overflow-hidden rounded-2xl">
                                <Skeleton variant="rounded" className="h-full w-full" />
                                <div className="absolute inset-0 bg-gradient-to-br from-white/18 via-transparent to-[#8B6F47]/10" />
                                <div className="absolute inset-0 flex items-center justify-center p-6">
                                  <motion.div
                                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/60 bg-white/78 px-6 py-7 text-center shadow-[0_20px_60px_rgba(139,111,71,0.18)] backdrop-blur-md"
                                  >
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                                      className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#8B6F47]/20 bg-[#F8F1E6]"
                                    >
                                      <svg className="h-7 w-7 text-[#8B6F47]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 01-8 8" opacity="0.35" />
                                      </svg>
                                    </motion.div>
                                    <div className="text-base font-semibold text-[#2D2D2D]">
                                      图片生成中
                                    </div>
                                    <motion.div
                                      key={loadingStage}
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -6 }}
                                      className="mt-2 text-sm text-[#6B6459]"
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
