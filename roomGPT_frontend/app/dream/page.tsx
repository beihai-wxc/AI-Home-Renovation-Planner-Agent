"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dancing_Script } from "next/font/google";
import { CompareSlider } from "../../components/CompareSlider";
import LoadingDots from "../../components/LoadingDots";
import Toggle from "../../components/Toggle";
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
import { getCurrentUser, isAuthenticated, logout } from "../../utils/auth";

// 加载手写字体
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dancing",
});

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const API_URL = `${API_BASE_URL}/api/chat-with-image`;
const QUICK_GENERATE_USER = "quick_generate_user";
const IMAGE_GENERATION_MODE = (process.env.NEXT_PUBLIC_IMAGE_GENERATION_MODE || "local_mock").toLowerCase();

function createQuickSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `quick-${crypto.randomUUID()}`;
  }
  return `quick-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  const [sideBySide, setSideBySide] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
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
    setCurrentUserName(getCurrentUser()?.name || "用户");
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

  const handleLogout = () => {
    logout();
    router.replace("/auth?redirect=/dream");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoName(file.name);
      const url = URL.createObjectURL(file);
      setOriginalPhoto(url);
      if (IMAGE_GENERATION_MODE === "local_mock") {
        generatePhotoFromLocal(file);
      } else {
        generatePhotoFromRealRender(file);
      }
    }
  };

  const UploadDropZone = () => (
    <div
      className="mt-4 flex flex-col items-center justify-center border-2 border-dashed border-[#8B6F47]/30 rounded-2xl p-12 bg-white/60 hover:bg-white/80 backdrop-blur-sm transition-all duration-300 cursor-pointer w-full max-w-[670px] h-[250px] group hover:border-[#8B6F47]/50"
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />
      <div className="flex flex-col items-center">
        <svg className="w-12 h-12 text-[#8B6F47]/60 mb-4 group-hover:text-[#8B6F47] group-hover:scale-110 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
        <p className="text-xl font-medium text-[#2D2D2D]">点击上传您的房间照片</p>
        <p className="text-[#8A8A8A] mt-2">支持 JPG, PNG 格式</p>
      </div>
    </div>
  );

  const generatePhotoFromRealRender = async (file: File) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    setRestoredLoaded(false);
    setLoading(true);
    setError(null);
    const quickSessionId = createQuickSessionId();

    const formData = new FormData();
    formData.append("image", file);
    formData.append("user_id", QUICK_GENERATE_USER);
    formData.append("session_id", quickSessionId);
    formData.append("message", `帮我把这个${roomLabels[room]}翻新成${themeLabels[theme]}。`);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.status !== 200) {
        setError(data.detail || data.message || "生成失败，请检查后端是否运行。");
      } else {
        if (data.imageUrl) {
          setRestoredImage(data.imageUrl);
        } else {
          setError(data.message || "后端已响应，但暂未返回图片。当前可能尚未配置 API Key。");
        }
      }
    } catch (err) {
      setError("无法连接到后端服务器，请确认后端已在 8000 端口运行。");
    } finally {
      setLoading(false);
    }
  };

  const generatePhotoFromLocal = async (file: File | null = null) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    setRestoredLoaded(false);
    setLoading(true);
    setError(null);
    setSideBySide(false);

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
            className="group flex items-center space-x-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-md rounded-lg border border-[#8B6F47]/20 hover:bg-white hover:border-[#8B6F47]/40 transition-all duration-300"
          >
            <svg className="w-4 h-4 text-[#8B6F47]/70 group-hover:text-[#8B6F47] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7v11m0 0l7 7" />
            </svg>
            <span className="text-xs font-medium text-[#5A5A5A] group-hover:text-[#2D2D2D] transition-colors">返回首页</span>
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
                      animate={{ width: sidebarOpen ? 280 : 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden flex-shrink-0"
                    >
                      <div className="w-[280px] h-full">
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
                        {IMAGE_GENERATION_MODE === "local_mock" && (
                          <button
                            type="button"
                            onClick={() => {
                              setOriginalPhoto(null);
                              setRestoredImage(null);
                              setRestoredLoaded(false);
                              generatePhotoFromLocal(null);
                            }}
                            className="btn-warm bg-white/80 backdrop-blur-md border border-[#8B6F47]/20 rounded-full text-[#2D2D2D] font-medium px-6 py-2 mt-4 hover:bg-white"
                          >
                            不上传图片，直接按风格生成
                          </button>
                        )}

                        {loading && (
                          <button
                            disabled
                            className="btn-warm bg-[#8B6F47] rounded-full text-white font-medium px-6 pt-2 pb-3 mt-6 w-40"
                          >
                            <span className="pt-4">
                              <LoadingDots color="white" style="large" />
                            </span>
                          </button>
                        )}
                        {error && (
                          <div
                            className="bg-red-500/20 border border-red-400/50 text-red-700 px-4 py-3 rounded-xl mt-6 backdrop-blur-sm"
                            role="alert"
                          >
                            <span className="block sm:inline">{error}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-4">
                          {originalPhoto && !loading && (
                            <button
                              onClick={() => {
                                setOriginalPhoto(null);
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);
                              }}
                              className="btn-warm bg-white/80 backdrop-blur-md border border-[#8B6F47]/20 rounded-full text-[#2D2D2D] font-medium px-6 py-2 hover:bg-white"
                            >
                              重新生成
                            </button>
                          )}
                          {restoredLoaded && restoredImage && (
                            <button
                              onClick={() => {
                                downloadPhoto(restoredImage, appendNewToName(photoName || "generated-room.png"));
                              }}
                              className="btn-warm bg-[#8B6F47] backdrop-blur-md border border-[#8B6F47]/20 rounded-full text-white font-medium px-6 py-2 hover:bg-[#A68B5B]"
                            >
                              下载生成的房间图片
                            </button>
                          )}
                          {restoredLoaded && restoredImage && (
                            <button
                              onClick={() => {
                                setPreviewImageUrl(restoredImage);
                                setPreviewTitle("生成图片预览");
                              }}
                              className="btn-warm bg-white/80 backdrop-blur-md border border-[#8B6F47]/20 rounded-full text-[#2D2D2D] font-medium px-6 py-2 hover:bg-white"
                            >
                              放大查看
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#8B6F47]/15 bg-white/55 p-5 backdrop-blur-sm min-h-[620px]">
                        <h2 className="text-lg font-semibold text-[#2D2D2D] mb-3">生成结果</h2>

                        {restoredImage && (
                          <div className="text-base font-medium mb-3 text-[#2D2D2D]">
                            <b className="text-[#8B6F47]">{roomLabels[room]}</b> · {themeLabels[theme]}风格
                          </div>
                        )}

                        <div className="relative w-full aspect-[4/3] rounded-2xl border border-[#8B6F47]/20 bg-white/60 overflow-hidden">
                          {!originalPhoto && !restoredImage && !loading && (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#8A8A8A]">
                              右侧将显示新生成的图片
                            </div>
                          )}

                          {loading && (
                            <div className="absolute inset-0 p-3">
                              <div className="grid h-full grid-cols-2 gap-3">
                                <Skeleton variant="rounded" className="h-full w-full" />
                                <Skeleton variant="rounded" className="h-full w-full" />
                              </div>
                            </div>
                          )}

                          {restoredLoaded && sideBySide && originalPhoto && restoredImage && (
                            <div className="absolute inset-0 p-2">
                              <CompareSlider
                                original={originalPhoto}
                                restored={restoredImage}
                                className="h-full w-full rounded-xl overflow-hidden"
                              />
                            </div>
                          )}

                          {originalPhoto && !restoredImage && !loading && (
                            <Image
                              alt="原始房间照片"
                              src={originalPhoto}
                              className="absolute inset-0 h-full w-full object-cover"
                              fill
                            />
                          )}

                          {restoredImage && !originalPhoto && !sideBySide && (
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

                          {restoredImage && originalPhoto && !sideBySide && (
                            <div className="absolute inset-0 grid grid-cols-2 gap-2 p-2">
                              <div className="relative overflow-hidden rounded-xl bg-white/40">
                                <Image
                                  alt="原始房间照片"
                                  src={originalPhoto}
                                  className="h-full w-full object-cover"
                                  fill
                                />
                              </div>
                              <a href={restoredImage} target="_blank" rel="noreferrer" className="relative overflow-hidden rounded-xl bg-white/40">
                                <Image
                                  alt="生成后的房间照片"
                                  src={restoredImage}
                                  className="h-full w-full cursor-zoom-in object-cover"
                                  fill
                                  onLoadingComplete={() => setRestoredLoaded(true)}
                                />
                              </a>
                            </div>
                          )}

                          {restoredImage && !restoredLoaded && !loading && (
                            <div className="absolute inset-0 p-3">
                              <Skeleton variant="rounded" className="h-full w-full" />
                            </div>
                          )}
                        </div>

                        <div className={`${restoredLoaded && Boolean(originalPhoto) ? "visible mt-4" : "invisible"}`}>
                          <Toggle
                            className={`${restoredLoaded && Boolean(originalPhoto) ? "visible" : "invisible"}`}
                            sideBySide={sideBySide}
                            setSideBySide={(newVal) => setSideBySide(newVal)}
                          />
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
      {mode === "generate" && (
        <div className="fixed bottom-4 left-4 z-40 rounded-xl border border-[#8B6F47]/20 bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
          <div className="text-xs text-[#6B6459]">当前用户：{currentUserName || "用户"}</div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 text-xs font-medium text-[#8B6F47] hover:underline"
          >
            退出登录
          </button>
        </div>
      )}
      <ImageLightbox
        isOpen={Boolean(previewImageUrl)}
        imageUrl={previewImageUrl}
        title={previewTitle}
        onClose={() => setPreviewImageUrl(null)}
      />
    </div>
  );
}
