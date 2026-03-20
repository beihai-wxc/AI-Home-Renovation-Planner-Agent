"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Dancing_Script } from "next/font/google";
import { CompareSlider } from "../../components/CompareSlider";
import Footer from "../../components/Footer";
import LoadingDots from "../../components/LoadingDots";
import Toggle from "../../components/Toggle";
import ChatInterface from "../../components/ChatInterface";
import ChatHistoryPanel from "../../components/ChatHistoryPanel";
import appendNewToName from "../../utils/appendNewToName";
import downloadPhoto from "../../utils/downloadPhoto";
import DropDown from "../../components/DropDown";
import { roomLabels, roomType, rooms, themeLabels, themeType, themes } from "../../utils/dropdownTypes";
import { createAndStoreSessionId, getCurrentSessionId } from "../../utils/session";
import { ensureSessionExists } from "../../utils/api";

// 加载手写字体
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dancing",
});

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const API_URL = `${API_BASE_URL}/api/chat-with-image`;

export default function DreamPage() {
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
  const [theme, setTheme] = useState<themeType>("Modern");
  const [room, setRoom] = useState<roomType>("Living Room");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从 localStorage 恢复侧栏状态
  useEffect(() => {
    const saved = localStorage.getItem("sidebarOpen");
    if (saved !== null) {
      setSidebarOpen(saved === "true");
    }
    const sessionId = getCurrentSessionId();
    setCurrentSessionId(sessionId);
    ensureSessionExists(sessionId).catch(() => undefined);
  }, []);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoName(file.name);
      const url = URL.createObjectURL(file);
      setOriginalPhoto(url);
      generatePhoto(file);
    }
  };

  const UploadDropZone = () => (
    <div
      className="flex flex-col items-center justify-center border-2 border-dashed border-apple-gray-300 rounded-2xl p-8 bg-white/60 hover:bg-white/80 backdrop-blur-sm transition-all duration-300 cursor-pointer w-full h-[200px] group hover:border-apple-blue/50 hover:shadow-apple"
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
        <div className="w-16 h-16 rounded-full bg-apple-gray-100 flex items-center justify-center mb-4 group-hover:bg-apple-blue/10 transition-colors duration-300">
          <svg className="w-8 h-8 text-apple-gray-400 group-hover:text-apple-blue transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-lg font-medium text-apple-black mb-1">点击上传您的房间照片</p>
        <p className="text-sm text-apple-gray-500">支持 JPG, PNG 格式</p>
      </div>
    </div>
  );

  const generatePhoto = async (file: File) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    setLoading(true);
    setError(null);

    await ensureSessionExists(currentSessionId).catch(() => undefined);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("image_type", "current_room");
    formData.append("user_id", "frontend_user");
    formData.append("session_id", currentSessionId);
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
  }

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
      {/* Apple 风格背景 */}
      <div className="fixed inset-0 -z-10 pointer-events-none bg-gradient-to-b from-white to-apple-gray-100">
        {/* 微妙的光晕效果 */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-apple-blue/[0.03] rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-apple-gray-300/[0.05] rounded-full blur-3xl" />
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
                  // 快速生成模式 - Apple 风格设计
                  <motion.div className="flex justify-center items-start w-full h-full overflow-y-auto">
                    <div className="w-full max-w-4xl px-6 pt-20 pb-12 sm:pt-16 flex flex-col items-center">
                      {/* Apple 风格标题区域 */}
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="text-center mb-12"
                      >
                        <h1 className="text-4xl sm:text-5xl font-semibold apple-text-gradient mb-4 tracking-tight">
                          快速生成
                        </h1>
                        <p className="text-lg text-apple-gray-500 max-w-2xl mx-auto leading-relaxed">
                          三个简单步骤，让 AI 为您打造理想家居
                        </p>
                      </motion.div>

                      {!restoredImage && (
                        <motion.div 
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className="w-full max-w-2xl space-y-8"
                        >
                          {/* 步骤一：选择装修风格 */}
                          <div className="apple-card p-8">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-10 h-10 rounded-full bg-apple-blue flex items-center justify-center text-white font-semibold text-lg">
                                1
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-apple-black">选择装修风格</h3>
                                <p className="text-sm text-apple-gray-500 mt-1">选择您喜欢的设计风格</p>
                              </div>
                            </div>
                            <DropDown
                              theme={theme}
                              setTheme={(newTheme) =>
                                setTheme(newTheme as typeof theme)
                              }
                              themes={themes}
                            />
                          </div>

                          {/* 步骤二：选择房间类型 */}
                          <div className="apple-card p-8">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-10 h-10 rounded-full bg-apple-blue flex items-center justify-center text-white font-semibold text-lg">
                                2
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-apple-black">选择房间类型</h3>
                                <p className="text-sm text-apple-gray-500 mt-1">选择您要改造的房间</p>
                              </div>
                            </div>
                            <DropDown
                              theme={room}
                              setTheme={(newRoom) => setRoom(newRoom as typeof room)}
                              themes={rooms}
                            />
                          </div>

                          {/* 步骤三：上传房间照片 */}
                          <div className="apple-card p-8">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-10 h-10 rounded-full bg-apple-blue flex items-center justify-center text-white font-semibold text-lg">
                                3
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold text-apple-black">上传房间照片</h3>
                                <p className="text-sm text-apple-gray-500 mt-1">上传您要改造的房间照片</p>
                              </div>
                            </div>
                            <UploadDropZone />
                          </div>
                        </motion.div>
                      )}

                      {/* 结果展示区域 */}
                      {restoredImage && (
                        <motion.div 
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.8 }}
                          className="w-full max-w-3xl"
                        >
                          <div className="text-center mb-8">
                            <h2 className="text-2xl font-semibold apple-text-gradient mb-2">
                              改造完成
                            </h2>
                            <p className="text-apple-gray-500">
                              您的 <span className="text-apple-blue font-medium">{roomLabels[room]}</span> 已成功改造为 <span className="text-apple-blue font-medium">{themeLabels[theme]}</span> 风格
                            </p>
                          </div>

                          <div className="flex justify-center mb-6">
                            <Toggle
                              sideBySide={sideBySide}
                              setSideBySide={(newVal) => setSideBySide(newVal)}
                            />
                          </div>

                          {sideBySide ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="apple-card p-4">
                                <h3 className="text-lg font-semibold text-apple-black mb-3 text-center">原始房间</h3>
                                <Image
                                  alt="原始房间照片"
                                  src={originalPhoto!}
                                  className="rounded-xl w-full h-80 object-cover"
                                  width={475}
                                  height={320}
                                />
                              </div>
                              <div className="apple-card p-4">
                                <h3 className="text-lg font-semibold text-apple-black mb-3 text-center">改造效果</h3>
                                <Image
                                  alt="生成后的房间照片"
                                  src={restoredImage}
                                  className="rounded-xl w-full h-80 object-cover"
                                  width={475}
                                  height={320}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="apple-card p-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h3 className="text-lg font-semibold text-apple-black mb-3 text-center">原始房间</h3>
                                  <Image
                                    alt="原始房间照片"
                                    src={originalPhoto!}
                                    className="rounded-xl w-full h-80 object-cover"
                                    width={475}
                                    height={320}
                                  />
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-apple-black mb-3 text-center">改造效果</h3>
                                  <a href={restoredImage} target="_blank" rel="noreferrer">
                                    <Image
                                      alt="生成后的房间照片"
                                      src={restoredImage}
                                      className="rounded-xl w-full h-80 object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                                      width={475}
                                      height={320}
                                      onLoadingComplete={() => setRestoredLoaded(true)}
                                    />
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 操作按钮 */}
                          <div className="flex flex-wrap justify-center gap-4 mt-8">
                            <button
                              onClick={() => {
                                setOriginalPhoto(null);
                                setRestoredImage(null);
                                setRestoredLoaded(false);
                                setError(null);
                              }}
                              className="apple-btn apple-btn-secondary px-6 py-3"
                            >
                              重新生成
                            </button>
                            <button
                              onClick={() => {
                                downloadPhoto(
                                  restoredImage!,
                                  appendNewToName(photoName!)
                                );
                              }}
                              className="apple-btn apple-btn-primary px-6 py-3"
                            >
                              下载效果图
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {/* 加载状态 */}
                      {loading && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex flex-col items-center mt-12"
                        >
                          <div className="apple-card p-8 text-center">
                            <LoadingDots color="#0071e3" style="large" />
                            <p className="text-apple-gray-500 mt-4">正在生成效果图，请稍候...</p>
                          </div>
                        </motion.div>
                      )}

                      {/* 错误提示 */}
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="w-full max-w-md mt-8"
                        >
                          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-center">
                            <span className="block">{error}</span>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
      {/* Footer 只在快速生成模式显示 */}
      {mode === "generate" && <Footer />}
    </div>
  );
}
