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
      className="mt-4 relative w-full max-w-[670px] overflow-hidden rounded-2xl border-2 border-dashed border-secondary/40 bg-primary transition-all duration-300 cursor-pointer group hover:border-secondary/70 hover:bg-white"
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
          <div className="absolute inset-0 bg-gradient-to-t from-accent/80 via-accent/20 to-transparent" />
          <div className="absolute left-4 top-4 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-accent backdrop-blur-sm shadow-sm">
            重新上传
          </div>
        </div>
      ) : (
        <div className="flex h-[250px] flex-col items-center justify-center p-12">
          <svg className="mb-4 h-12 w-12 text-accent/60 transition-all duration-300 group-hover:scale-110 group-hover:text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-xl font-medium text-accent">点击上传您的房间照片</p>
          <p className="mt-2 text-text-secondary">支持 JPG, PNG 格式</p>
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
      console.warn("local render mapping failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-primary">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-accent border-b border-secondary/20">
        <div className="flex items-center justify-between w-full py-4 px-5 sm:px-6">
          {/* 左侧：设计你的理想空间 */}
          <h1 className="font-display text-lg font-bold tracking-normal text-white sm:text-xl flex items-center">
            设计你的{" "}
            <span className="text-lg sm:text-xl font-semibold italic text-secondary ml-1" style={{ fontFamily: "'Playfair Display', 'Noto Sans SC', serif" }}>
              理想空间
            </span>
            <span className="text-xs tracking-[0.3em] text-secondary/70 font-light mt-1 block ml-4">DESIGN YOUR DREAM SPACE</span>
            {/* 装饰性图标 */}
            <svg className="w-6 h-6 text-secondary/60 ml-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <path d="M8 10.5L12 7.5L16 10.5"/>
              <path d="M8 13.5L12 16.5L16 13.5"/>
              <path d="M7.5 8.5h9"/>
              <path d="M7.5 15.5h9"/>
              <circle cx="12" cy="12" r="1.5"/>
            </svg>
          </h1>

          {/* 中间：模式切换按钮 */}
          <div className="bg-surface-2 p-1.5 rounded-lg border border-secondary/20 flex-1 mx-4">
            <button
              onClick={() => setMode("generate")}
              className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                mode === "generate"
                  ? "bg-accent text-primary"
                  : "text-text-secondary hover:text-accent hover:bg-surface-3"
              }`}
            >
              快速生成
              <span className="text-[10px] tracking-[0.2em] text-text-tertiary block leading-none mt-0.5 font-light">QUICK GENERATION</span>
            </button>
            <button
              onClick={() => setMode("chat")}
              className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                mode === "chat"
                  ? "bg-accent text-primary"
                  : "text-text-secondary hover:text-accent hover:bg-surface-3"
              }`}
            >
              AI 问答
              <span className="text-[10px] tracking-[0.2em] text-text-tertiary block leading-none mt-0.5 font-light">CHAT MODE</span>
            </button>
          </div>

          {/* 右侧：返回首页按钮 */}
          <div className="hidden sm:block">
            <Link
              href="/"
              className="inline-flex items-center rounded-md border border-secondary/30 bg-surface-2 px-4 py-2 text-sm font-medium text-text-secondary transition-all duration-200 hover:-translate-y-0.5 hover:border-secondary/50 hover:text-accent"
            >
              返回首页
            </Link>
          </div>
      </header>

      {/* 温暖动态背景层 */}
      <div className="dream-background fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0s" }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/6 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-accent/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "4s" }} />
        </div>
        {/* 装饰性背景文字 */}
        <div className="absolute top-8 left-8 text-[8px] tracking-[0.4em] text-accent/10 font-light select-none">
          RENOVATION · DESIGN · TRANSFORMATION
        </div>
        <div className="absolute bottom-8 right-8 text-[8px] tracking-[0.4em] text-accent/10 font-light select-none">
          CREATE YOUR IDEAL SPACE
        </div>
        <div className="absolute top-1/2 right-8 -translate-y-1/2 text-[8px] tracking-[0.4em] text-accent/10 font-light select-none rotate-90 origin-center">
          AI POWERED DESIGN ASSISTANT
        </div>
      </div>

      <main className="flex-1 flex flex-col min-h-0 w-full h-full pt-20">
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
                  <motion.div className="flex w-full h-full min-h-0 pt-6">
                    {/* 历史记录侧栏 - 常驻左侧 */}
                    <motion.div
                      initial={false}
                      animate={{ width: sidebarOpen ? 240 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden flex-shrink-0"
                    >
                      <div className="w-[240px] h-full bg-surface-2 border-r border-secondary/10 pt-4">
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
                      className="flex-shrink-0 w-6 h-full flex items-center justify-center bg-primary/50 hover:bg-primary/70 transition-colors group"
                      title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
                    >
                      <svg
                        className={`w-4 h-4 text-accent/60 group-hover:text-accent transition-transform duration-300 ${sidebarOpen ? "rotate-180" : ""}`}
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
                      <div className="flex-1 overflow-hidden bg-surface-2">
                        <ChatInterface
                          sessionId={currentSessionId}
                          onError={setError}
                        />
                        {error && (
                          <div
                            className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg m-4"
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
                      <div className="rounded-xl border border-secondary/15 bg-surface-2 p-6 shadow-sm">
                        <div className="space-y-5">
                          <div className="flex mt-1 items-center space-x-3">
                            <Image src="/number-1-accent.svg" width={30} height={30} alt="步骤一" />
                            <div>
                              <p className="text-left font-medium text-accent">选择您的装修风格。</p>
                              <p className="text-[10px] tracking-[0.2em] text-text-tertiary font-light mt-0.5">STEP 01 · STYLE SELECTION</p>
                            </div>
                          </div>
                          <DropDown
                            theme={theme}
                            setTheme={(newTheme) => setTheme(newTheme as typeof theme)}
                            themes={themes}
                          />
                        </div>

                        <div className="space-y-5 mt-6">
                          <div className="flex items-center space-x-3">
                            <Image src="/number-2-accent.svg" width={30} height={30} alt="步骤二" />
                            <div>
                              <p className="text-left font-medium text-accent">选择您的房间类型。</p>
                              <p className="text-[10px] tracking-[0.2em] text-text-tertiary font-light mt-0.5">STEP 02 · ROOM TYPE</p>
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
                            <Image src="/number-3-accent.svg" width={30} height={30} alt="步骤三" />
                            <div>
                              <p className="text-left font-medium text-accent">上传一张您的房间照片。</p>
                              <p className="text-[10px] tracking-[0.2em] text-text-tertiary font-light mt-0.5">STEP 03 · UPLOAD IMAGE</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <UploadDropZone />
                        </div>
                        {error && (
                          <div
                            className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mt-6"
                            role="alert"
                          >
                            <span className="block sm:inline">{error}</span>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-secondary/15 bg-surface-2 p-6 min-h-[620px] shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold text-accent">生成结果</h2>
                            <p className="text-[10px] tracking-[0.2em] text-text-tertiary font-light mt-0.5">GENERATION RESULT</p>
                          </div>
                          {restoredLoaded && restoredImage && (
                            <button
                              onClick={() => {
                                downloadPhoto(restoredImage, appendNewToName(photoName || "generated-room.png"));
                              }}
                              className="rounded-lg border border-secondary/20 bg-accent px-5 py-2.5 font-medium text-primary hover:bg-accent-dark transition-all duration-200 shadow-sm"
                            >
                              下载
                            </button>
                          )}
                        </div>

                        {restoredImage && (
                          <div className="text-base font-medium mb-4 text-accent">
                            <b className="text-accent-dark">{roomLabels[room]}</b> · {themeLabels[theme]}风格
                          </div>
                        )}

                        <div className="relative w-full aspect-[4/3] rounded-2xl border border-secondary/25 bg-primary/60 overflow-hidden">
                          {!restoredImage && !loading && (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-text-secondary">
                              右侧将显示新生成的图片
                            </div>
                          )}

                          {loading && (
                            <div className="absolute inset-0 p-3">
                              <div className="relative h-full w-full overflow-hidden rounded-2xl">
                                <Skeleton variant="rounded" className="h-full w-full" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <LoadingDots color="#9f8370" style="large" />
                                </div>
                              </div>
                            </div>
                          )}

                          {restoredImage && (
                            <button
                              type="button"
                              className="absolute inset-0 h-full w-full hover:opacity-95 transition-opacity duration-200"
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
