"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useState, useRef } from "react";
import Link from "next/link";
import { CompareSlider } from "../../components/CompareSlider";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingDots from "../../components/LoadingDots";
import ResizablePanel from "../../components/ResizablePanel";
import Toggle from "../../components/Toggle";
import ChatInterface from "../../components/ChatInterface";
import AgentStatus from "../../components/AgentStatus";
import ChatHistoryPanel from "../../components/ChatHistoryPanel";
import { ChatMessage } from "../../types/chat";
import appendNewToName from "../../utils/appendNewToName";
import downloadPhoto from "../../utils/downloadPhoto";
import DropDown from "../../components/DropDown";
import { roomLabels, roomType, rooms, themeLabels, themeType, themes } from "../../utils/dropdownTypes";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const API_URL = `${API_BASE_URL}/api/chat-with-image`;

export default function DreamPage() {
  const [mode, setMode] = useState<"generate" | "chat">("generate");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      className="mt-4 flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-2xl p-12 bg-white/5 hover:bg-white/10 backdrop-blur-sm transition cursor-pointer w-full max-w-[670px] h-[250px] group"
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
        <svg className="w-12 h-12 text-white/60 mb-4 group-hover:text-white/80 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
        <p className="text-xl font-medium text-white/90">点击上传您的房间照片</p>
        <p className="text-white/50 mt-2">支持 JPG, PNG 格式</p>
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
    <div className="dream-page relative min-h-screen flex flex-col">
      <Header />
      <main className="flex flex-1 w-full flex-col items-center justify-center text-center px-4 py-8">
        {/* 动态背景层 */}
        <div className="dream-background fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
            <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "2s" }} />
          </div>
          {/* 网格纹理 */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 w-full max-w-7xl"
        >
          <div className="flex items-center justify-between w-full mb-5">
            <h1 className="font-display text-4xl font-bold tracking-normal text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 sm:text-6xl">
              生成您的 <span className="text-white">梦想</span> 房间
            </h1>
            <Link
              href="/"
              className="group flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 hover:bg-white/20 transition-all duration-300"
            >
              <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7v11m0 0l7 7" />
              </svg>
              <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">返回首页</span>
            </Link>
          </div>

          {/* 模式切换按钮 */}
          <div className="flex justify-center space-x-2 mb-8">
            <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
              <button
                onClick={() => setMode("generate")}
                className={`px-8 py-3 rounded-xl font-medium transition-all duration-300 ${
                  mode === "generate"
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                快速生成
              </button>
              <button
                onClick={() => setMode("chat")}
                className={`px-8 py-3 rounded-xl font-medium transition-all duration-300 ${
                  mode === "chat"
                    ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/25"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                AI 问答
              </button>
            </div>
          </div>

          {/* AI 模式工具栏（历史记录 + Agent 状态折叠） */}
          {mode === "chat" && (
            <div className="flex justify-center space-x-2 mb-6">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                  sidebarOpen
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m0 0l3 3m-3 3V8a3 3 0 00-6 0V6a3 3 0 00-3 3v12a3 3 0 00-3 3z" />
                </svg>
                <span>历史记录</span>
              </button>
              {/* 移除 AI 状态按钮，因为 Agent 状态现在在 ChatInterface 内部 */}
            </div>
          )}

          <ResizablePanel>
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === "chat" ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "chat" ? -20 : 20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                {mode === "chat" ? (
                  // 聊天模式
                  <motion.div className="flex gap-2 w-full">
                    {/* 历史记录侧栏 */}
                    {sidebarOpen && (
                      <ChatHistoryPanel
                        isOpen={sidebarOpen}
                        onClose={() => setSidebarOpen(false)}
                        onLoadHistory={handleLoadHistory}
                      />
                    )}

                    {/* 主聊天区域 */}
                    <div className="flex-1 flex flex-col min-w-0 w-full">
                      {/* 聊天界面 */}
                      <div className="flex-1 overflow-hidden rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                        <ChatInterface
                          onError={setError}
                        />
                        {error && (
                          <div
                            className="bg-red-500/20 border border-red-400/50 text-red-200 px-4 py-3 rounded-xl mt-4 backdrop-blur-sm"
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
                  <motion.div className="flex justify-between items-center w-full flex-col mt-4">
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
                            <p className="text-left font-medium text-white/90">
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
                        <div className="space-y-4 w-full max-w-sm">
                          <div className="flex mt-10 items-center space-x-3">
                            <Image
                              src="/number-2-white.svg"
                              width={30}
                              height={30}
                              alt="步骤二"
                            />
                            <p className="text-left font-medium text-white/90">
                              选择您的房间类型。
                            </p>
                          </div>
                          <DropDown
                            theme={room}
                            setTheme={(newRoom) => setRoom(newRoom as typeof room)}
                            themes={rooms}
                          />
                        </div>
                        <div className="mt-4 w-full max-w-sm">
                          <div className="flex mt-6 w-96 items-center space-x-3">
                            <Image
                              src="/number-3-white.svg"
                              width={30}
                              height={30}
                              alt="步骤三"
                            />
                            <p className="text-left font-medium text-white/90">
                              上传一张您的房间照片。
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                    {restoredImage && (
                      <div className="text-xl font-medium mb-4 text-white/90">
                        这是为您改造后的 <b className="text-white">{roomLabels[room]}</b> ({themeLabels[theme]}风格)！
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
                    {!originalPhoto && <UploadDropZone />}
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
                          <h2 className="mb-1 font-medium text-lg text-white/90">原始房间</h2>
                          <Image
                            alt="原始房间照片"
                            src={originalPhoto}
                            className="rounded-2xl relative w-full h-96 shadow-2xl"
                            width={475}
                            height={475}
                          />
                        </div>
                        <div className="sm:mt-0 mt-8">
                          <h2 className="mb-1 font-medium text-lg text-white/90">生成的房间</h2>
                          <a href={restoredImage} target="_blank" rel="noreferrer">
                            <Image
                              alt="生成后的房间照片"
                              src={restoredImage}
                              className="rounded-2xl relative sm:mt-0 mt-2 cursor-zoom-in w-full h-96 shadow-2xl"
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
                        className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-full text-white font-medium px-4 pt-2 pb-3 mt-8 w-40 shadow-lg shadow-blue-500/25"
                      >
                        <span className="pt-4">
                          <LoadingDots color="white" style="large" />
                        </span>
                      </button>
                    )}
                    {error && (
                      <div
                        className="bg-red-500/20 border border-red-400/50 text-red-200 px-4 py-3 rounded-xl mt-8 backdrop-blur-sm"
                        role="alert"
                      >
                        <span className="block sm:inline">{error}</span>
                      </div>
                    )}
                    <div className="flex space-x-2 justify-center">
                      {originalPhoto && !loading && (
                        <button
                          onClick={() => {
                            setOriginalPhoto(null);
                            setRestoredImage(null);
                            setRestoredLoaded(false);
                            setError(null);
                          }}
                          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-white/20 transition"
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
                          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white font-medium px-4 py-2 mt-8 hover:bg-white/20 transition"
                        >
                          下载生成的房间图片
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </ResizablePanel>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
