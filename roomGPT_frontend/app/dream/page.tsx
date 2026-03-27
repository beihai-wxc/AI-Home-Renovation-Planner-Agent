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
import appendNewToName from "../../utils/appendNewToName";
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

export default function DreamPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"generate" | "chat">("generate");
  const [sidebarOpen, setSidebarOpen] = useState(true); // 默认展开
  const [currentSessionId, setCurrentSessionId] = useState<string>("main_session");
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [restoredLoaded, setRestoredLoaded] = useState<boolean>(false);
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
    <div className="h-screen flex flex-col overflow-hidden bg-[#fcf9f8]">
      {/* 顶部导航栏 */}
      <header className="relative z-50 bg-[#4e3c30] border-b border-[#4e3c30]">
        <div className="flex items-center justify-between w-full py-3 px-4 sm:px-6">
          {/* 左侧：设计你的理想空间 */}
          <h1 className="font-display text-lg font-bold tracking-normal text-white sm:text-xl">
            设计你的{" "}
            <span
              className={`${dancingScript.className} text-lg sm:text-xl font-semibold italic text-[#E8B86D]`}
            >
              理想空间
            </span>
          </h1>

          {/* 中间：模式切换按钮 */}
          <div className="bg-[#3d2f26]/80 p-1.5 rounded-xl shadow-inner">
            <button
              onClick={() => setMode("generate")}
              className={`px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ${
                mode === "generate"
                  ? "bg-white text-[#4e3c30] shadow-md"
                  : "text-[#9f8370] hover:text-white"
              }`}
            >
              快速生成
            </button>
            <button
              onClick={() => setMode("chat")}
              className={`px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ${
                mode === "chat"
                  ? "bg-white text-[#4e3c30] shadow-md"
                  : "text-[#9f8370] hover:text-white"
              }`}
            >
              AI 问答
            </button>
          </div>

          {/* 右侧：返回首页按钮 */}
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-medium text-white/90 transition-all duration-300 hover:border-white/40 hover:bg-white/20 hover:text-white hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0"
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
        {/* 背景由 CSS 控制 */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/[0.08] rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0s" }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/[0.06] rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-teal-500/[0.05] rounded-full blur-2xl animate-pulse" style={{ animationDelay: "4s" }} />
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
                      className="flex-shrink-0 w-6 h-full flex items-center justify-center bg-[#f5f0ea] hover:bg-[#ebe5dd] transition-colors group"
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
                      <div className="flex-1 overflow-hidden bg-[#fcf9f8]">
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
                      <div className="rounded-xl border border-[#bdb3a5]/25 bg-[#fcf9f8] p-6 shadow-[0_4px_20px_-2px_rgba(189,179,165,0.12),0_6px_30px_-4px_rgba(189,179,165,0.08)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(189,179,165,0.15),0_12px_40px_-6px_rgba(189,179,165,0.1)] hover:-translate-y-1">
                        <div className="space-y-4">
                          <div className="flex mt-1 items-center space-x-3">
                            <Image src="/number-1-accent.svg" width={28} height={28} alt="步骤一" />
                            <div>
                              <p className="text-left font-medium text-[#4e3c30]">选择您的装修风格</p>
                              <p className="text-[10px] font-normal tracking-wider text-[#9f8370]/60 mt-0.5 uppercase">Style Selection</p>
                            </div>
                          </div>
                          <DropDown
                            theme={theme}
                            setTheme={(newTheme) => setTheme(newTheme as typeof theme)}
                            themes={themes}
                          />
                        </div>

                        <div className="space-y-4 mt-6">
                          <div className="flex items-center space-x-3">
                            <Image src="/number-2-accent.svg" width={28} height={28} alt="步骤二" />
                            <div>
                              <p className="text-left font-medium text-[#4e3c30]">选择您的房间类型</p>
                              <p className="text-[10px] font-normal tracking-wider text-[#9f8370]/60 mt-0.5 uppercase">Room Type</p>
                            </div>
                          </div>
                          <DropDown
                            theme={room}
                            setTheme={(newRoom) => setRoom(newRoom as typeof room)}
                            themes={rooms}
                          />
                        </div>

                        <div className="mt-6">
                          <div className="flex items-center space-x-3">
                            <Image src="/number-3-accent.svg" width={28} height={28} alt="步骤三" />
                            <div>
                              <p className="text-left font-medium text-[#4e3c30]">上传一张您的房间照片</p>
                              <p className="text-[10px] font-normal tracking-wider text-[#9f8370]/60 mt-0.5 uppercase">Upload Photo</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <UploadDropZone />
                        </div>
                        {error && (
                          <div
                            className="bg-red-500/15 border border-red-400/40 text-red-700 px-4 py-3 rounded-xl mt-6"
                            role="alert"
                          >
                            <span className="block sm:inline">{error}</span>
                          </div>
                        )}
                      </div>

                      <div className="rounded-3xl border border-[#bdb3a5]/25 bg-[#fcf9f8] p-5 min-h-[620px] shadow-[0_8px_30px_-4px_rgba(189,179,165,0.15),0_12px_40px_-6px_rgba(189,179,165,0.1)] transition-all duration-300 hover:shadow-[0_12px_40px_-4px_rgba(189,179,165,0.18),0_18px_50px_-8px_rgba(189,179,165,0.12)] hover:-translate-y-1">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h2 className="text-base font-semibold text-[#4e3c30]">生成结果</h2>
                            <p className="text-[10px] font-normal tracking-wider text-[#9f8370]/60 mt-0.5 uppercase">Generation Result</p>
                          </div>
                          {restoredLoaded && restoredImage && (
                            <button
                              onClick={() => {
                                downloadPhoto(restoredImage, appendNewToName(photoName || "generated-room.png"));
                              }}
                              className="group relative rounded-xl border border-[#8B6F47]/30 bg-[#8B6F47] px-4 py-2 text-xs font-semibold tracking-wide text-white hover:bg-[#A68B5B] hover:border-[#A68B5B] hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0 transition-all duration-300"
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
                          <div className="text-sm font-medium mb-3 text-[#4e3c30]">
                            <b className="text-[#8B6F47]">{roomLabels[room]}</b> · {themeLabels[theme]}风格
                          </div>
                        )}

                        <div className="relative w-full aspect-[4/3] rounded-2xl border border-[#bdb3a5]/25 bg-white/80 overflow-hidden">
                          {!restoredImage && !loading && (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#8A8A8A]">
                              右侧将显示新生成的图片
                            </div>
                          )}

                          {loading && (
                            <div className="absolute inset-0 p-3">
                              <div className="relative h-full w-full overflow-hidden rounded-2xl">
                                <Skeleton variant="rounded" className="h-full w-full" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <LoadingDots color="#A88A5A" style="large" />
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
