"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Dancing_Script } from "next/font/google";
import { CompareSlider } from "../../components/CompareSlider";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingDots from "../../components/LoadingDots";
import Toggle from "../../components/Toggle";
import ChatInterface from "../../components/ChatInterface";
import ChatHistoryPanel from "../../components/ChatHistoryPanel";
import { ChatMessage } from "../../types/chat";
import appendNewToName from "../../utils/appendNewToName";
import downloadPhoto from "../../utils/downloadPhoto";
import DropDown from "../../components/DropDown";
import { roomLabels, roomType, rooms, themeLabels, themeType, themes } from "../../utils/dropdownTypes";

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
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
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
  }, []);

  // 从历史记录加载对话
  const handleLoadHistory = (history: ChatMessage[]) => {
    setChatHistory(history);
  };

  // 开始新对话
  const handleNewChat = () => {
    setChatHistory([]);
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

  const generatePhoto = async (file: File) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("image_type", "current_room");
    formData.append("user_id", "frontend_user");
    formData.append("session_id", "main_session");
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
                          onClose={() => setSidebarOpen(false)}
                          onLoadHistory={handleLoadHistory}
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
                      {/* 极简 Footer - 只在聊天模式显示 */}
                      <div className="text-center py-1.5 text-xs text-[#8A8A8A]">
                        由 <span className="font-medium text-[#8B6F47]">Lumière</span> 强力驱动
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  // 快速生成模式
                  <motion.div className="flex justify-center items-start w-full h-full overflow-y-auto">
                    <div className="w-full max-w-2xl px-4 pt-16 pb-6 sm:pt-12 flex flex-col items-center">
                      {!restoredImage && (
                        <>
                          <div className="space-y-4 w-full max-w-sm">
                            <div className="flex mt-3 items-center space-x-3">
                              <Image
                                src="/number-1-white.svg"
                                width={30}
                                height={30}
                                alt="步骤一"
                              />
                              <p className="text-left font-medium text-[#2D2D2D]">
                                选择您的装修风格。
                              </p>
                            </div>
                            <DropDown
                              theme={theme}
                              setTheme={(newTheme) =>
                                setTheme(newTheme as typeof theme)
                              }
                              themes={themes}
                            />
                          </div>
                          <div className="space-y-4 w-full max-w-sm mt-6">
                            <div className="flex items-center space-x-3">
                              <Image
                                src="/number-2-white.svg"
                                width={30}
                                height={30}
                                alt="步骤二"
                              />
                              <p className="text-left font-medium text-[#2D2D2D]">
                                选择您的房间类型。
                              </p>
                            </div>
                            <DropDown
                              theme={room}
                              setTheme={(newRoom) => setRoom(newRoom as typeof room)}
                              themes={rooms}
                            />
                          </div>
                          <div className="mt-6 w-full max-w-sm">
                            <div className="flex items-center space-x-3">
                              <Image
                                src="/number-3-white.svg"
                                width={30}
                                height={30}
                                alt="步骤三"
                              />
                              <p className="text-left font-medium text-[#2D2D2D]">
                                上传一张您的房间照片。
                              </p>
                            </div>
                          </div>
                          <div className="w-full max-w-sm mt-4">
                            <UploadDropZone />
                          </div>
                        </>
                      )}
                    {restoredImage && (
                      <div className="text-xl font-medium mb-4 text-[#2D2D2D]">
                        这是为您改造后的 <b className="text-[#8B6F47]">{roomLabels[room]}</b> ({themeLabels[theme]}风格)！
                      </div>
                    )}
                    <div className={`${
                      restoredLoaded ? "visible mt-6 -ml-8" : "invisible"
                    }`}>
                      <Toggle
                        className={`${restoredLoaded ? "visible mb-6" : "invisible"}`}
                        sideBySide={sideBySide}
                        setSideBySide={(newVal) => setSideBySide(newVal)}
                      />
                    </div>
                    {restoredLoaded && sideBySide && (
                      <CompareSlider
                        original={originalPhoto!}
                        restored={restoredImage!}
                      />
                    )}
                    {originalPhoto && !restoredImage && (
                      <Image
                        alt="原始房间照片"
                        src={originalPhoto}
                        className="rounded-2xl h-96 shadow-2xl"
                        width={475}
                        height={475}
                      />
                    )}
                    {restoredImage && originalPhoto && !sideBySide && (
                      <div className="flex sm:space-x-4 sm:flex-row flex-col">
                        <div>
                          <h2 className="mb-1 font-medium text-lg text-[#2D2D2D]">原始房间</h2>
                          <Image
                            alt="原始房间照片"
                            src={originalPhoto}
                            className="rounded-2xl relative w-full h-96 shadow-2xl image-card"
                            width={475}
                            height={475}
                          />
                        </div>
                        <div className="sm:mt-0 mt-8">
                          <h2 className="mb-1 font-medium text-lg text-[#2D2D2D]">生成的房间</h2>
                          <a href={restoredImage} target="_blank" rel="noreferrer">
                            <Image
                              alt="生成后的房间照片"
                              src={restoredImage}
                              className="rounded-2xl relative sm:mt-0 mt-2 cursor-zoom-in w-full h-96 shadow-2xl image-card"
                              width={475}
                              height={475}
                              onLoadingComplete={() => setRestoredLoaded(true)}
                            />
                          </a>
                        </div>
                      </div>
                    )}
                    {loading && (
                      <button
                        disabled
                        className="btn-warm bg-[#8B6F47] rounded-full text-white font-medium px-6 pt-2 pb-3 mt-8 w-40"
                      >
                        <span className="pt-4">
                          <LoadingDots color="white" style="large" />
                        </span>
                      </button>
                    )}
                    {error && (
                      <div
                        className="bg-red-500/20 border border-red-400/50 text-red-700 px-4 py-3 rounded-xl mt-8 backdrop-blur-sm"
                        role="alert"
                      >
                        <span className="block sm:inline">{error}</span>
                      </div>
                    )}
                    <div className="flex space-x-2 justify-center mb-4">
                      {originalPhoto && !loading && (
                        <button
                          onClick={() => {
                            setOriginalPhoto(null);
                            setRestoredImage(null);
                            setRestoredLoaded(false);
                            setError(null);
                          }}
                          className="btn-warm bg-white/80 backdrop-blur-md border border-[#8B6F47]/20 rounded-full text-[#2D2D2D] font-medium px-6 py-2 mt-8 hover:bg-white"
                        >
                          重新生成
                        </button>
                      )}
                      {restoredLoaded && (
                        <button
                          onClick={() => {
                            downloadPhoto(
                              restoredImage!,
                              appendNewToName(photoName!)
                            );
                          }}
                          className="btn-warm bg-[#8B6F47] backdrop-blur-md border border-[#8B6F47]/20 rounded-full text-white font-medium px-6 py-2 mt-8 hover:bg-[#A68B5B]"
                        >
                          下载生成的房间图片
                        </button>
                      )}
                    </div>
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
