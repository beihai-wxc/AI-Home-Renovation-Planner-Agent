"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { sendChatMessageStream, sendChatWithImageStream } from "../utils/api";
import ChatMessageActions from "./ChatMessageActions";
import QuickPrompts from "./QuickPrompts";
import ChatActions from "./ChatActions";
import QuickScenes from "./QuickScenes";
import { ChatMessage, AgentStatus as AgentStatusType, AGENT_DISPLAY_NAMES, AGENT_ICONS, AgentEvent } from "../types/chat";
import LoadingDots from "./LoadingDots";
import { useToast } from "./Toast";
import AgentTimeline from "./AgentTimeline";

interface ChatInterfaceProps {
  onError?: (error: string) => void;
}

export default function ChatInterface({ onError }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [imageType, setImageType] = useState<"current_room" | "inspiration">("current_room");
  const [agentStatuses, setAgentStatuses] = useState<AgentStatusType[]>([
    { agentName: "InfoAgent", displayName: "咨询助手", status: "idle" },
    { agentName: "VisualAssessor", displayName: "视觉评估", status: "idle" },
    { agentName: "DesignPlanner", displayName: "设计规划", status: "idle" },
    { agentName: "ProjectCoordinator", displayName: "项目协调", status: "idle" },
  ]);
  const [showQuickScenes, setShowQuickScenes] = useState(false);
  const { showToast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 模拟 Agent 状态更新
  const updateAgentStatus = (agentName: string, status: AgentStatusType["status"], message?: string) => {
    setAgentStatuses(prev =>
      prev.map(agent =>
        agent.agentName === agentName
          ? { ...agent, status, message }
          : agent
      )
    );
  };

  // 添加 Agent 事件到当前消息的时间线
  const addAgentEventToMessage = (messageId: string, event: AgentEvent) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId
          ? { ...msg, agentTimeline: [...(msg.agentTimeline || []), event] }
          : msg
      )
    );
  };

  const handleClearMessages = () => {
    if (confirm("确定要清空所有对话记录吗？")) {
      setMessages([]);
    }
  };

  const handleRegenerate = (message: ChatMessage) => {
    const regeneratedMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: message.content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev.filter(m => m.id !== message.id), regeneratedMessage]);
    setInput(message.content);
  };

  const handleSelectQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleSelectScene = (scene: string, style?: string) => {
    let newInput = input;
    if (scene) {
      newInput = `我想装修${scene}，`;
    }
    if (style) {
      newInput += `请设计${style}风格的方案。`;
    }
    setInput(newInput);
    setShowQuickScenes(false);
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isSending) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || (selectedImage ? "请分析这张图片" : ""),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setShowQuickScenes(false);
    setIsSending(true);

    // 创建一个临时的 AI 消息用于流式更新
    const tempMessageId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      {
        id: tempMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        agentName: selectedImage ? "ProjectCoordinator" : "InfoAgent",
      }
    ]);

    // 根据是否有图片更新 Agent 状态
    if (selectedImage) {
      updateAgentStatus("InfoAgent", "idle");
      updateAgentStatus("VisualAssessor", "processing", "正在分析上传的图片...");
    } else {
      updateAgentStatus("VisualAssessor", "idle");
      updateAgentStatus("InfoAgent", "processing", "正在分析您的问题...");
    }

    // 累计流式内容
    let accumulatedContent = "";
    let receivedImageUrl: string | undefined = undefined;

    // 流式更新消息内容的函数
    const updateMessageContent = (newContent: string) => {
      accumulatedContent += newContent;
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessageId
            ? { ...msg, content: accumulatedContent }
            : msg
        )
      );
      scrollToBottom();
    };

    // 更新图片 URL 的函数
    const updateMessageImage = (url: string) => {
      receivedImageUrl = url;
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessageId
            ? { ...msg, imageUrl: url }
            : msg
        )
      );
      scrollToBottom();
    };

    // 完成后的处理
    const handleComplete = () => {
      setIsSending(false);
      showToast("回复已生成", "success");

      // 更新 Agent 时间线中的最后一个事件为完成状态
      setMessages(prev => prev.map(msg => {
        if (msg.agentTimeline && msg.agentTimeline.length > 0) {
          const lastEvent = msg.agentTimeline[msg.agentTimeline.length - 1];
          if (lastEvent.status === "processing") {
            const updatedTimeline = [...msg.agentTimeline];
            updatedTimeline[updatedTimeline.length - 1] = {
              ...lastEvent,
              status: "completed" as const,
              message: undefined
            };
            return { ...msg, agentTimeline: updatedTimeline };
          }
        }
        return msg;
      }));

      // 更新 Agent 状态为完成
      if (selectedImage) {
        updateAgentStatus("VisualAssessor", "completed");
        updateAgentStatus("DesignPlanner", "completed");
        updateAgentStatus("ProjectCoordinator", "completed");
      } else {
        updateAgentStatus("InfoAgent", "completed");
      }

      // 重置 Agent 状态
      setTimeout(() => {
        setAgentStatuses(prev =>
          prev.map(agent => ({ ...agent, status: "idle" as const, message: undefined }))
        );
      }, 1000);
    };

    // 错误处理
    const handleError = (errorMessage: string) => {
      onError?.(errorMessage);
      showToast(errorMessage, "error");

      // 更新所有正在处理的 Agent 为错误状态
      setAgentStatuses(prev =>
        prev.map(agent =>
          agent.status === "processing"
            ? { ...agent, status: "error", message: errorMessage }
            : agent
        )
      );

      // 删除临时消息
      setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
      setIsSending(false);
    };

    try {
      if (selectedImage) {
        // 模拟 Agent 协作流程 - 添加到时间线
        setTimeout(() => {
          addAgentEventToMessage(tempMessageId, {
            agentName: "VisualAssessor",
            status: "completed",
            timestamp: new Date()
          });
          updateAgentStatus("VisualAssessor", "completed");
          updateAgentStatus("DesignPlanner", "processing", "正在生成设计方案...");
          addAgentEventToMessage(tempMessageId, {
            agentName: "DesignPlanner",
            status: "processing",
            message: "正在生成设计方案...",
            timestamp: new Date()
          });
        }, 800);

        setTimeout(() => {
          addAgentEventToMessage(tempMessageId, {
            agentName: "DesignPlanner",
            status: "completed",
            timestamp: new Date()
          });
          updateAgentStatus("DesignPlanner", "completed");
          updateAgentStatus("ProjectCoordinator", "processing", "正在生成效果图...");
          addAgentEventToMessage(tempMessageId, {
            agentName: "ProjectCoordinator",
            status: "processing",
            message: "正在生成效果图...",
            timestamp: new Date()
          });
        }, 1500);

        // 调用流式 API（带图片）
        await sendChatWithImageStream(
          input.trim() || "请帮我规划这个房间的装修方案",
          selectedImage,
          imageType,
          updateMessageContent,
          updateMessageImage,
          handleComplete,
          handleError
        );
      } else {
        // 纯文本消息，添加咨询助手事件
        addAgentEventToMessage(tempMessageId, {
          agentName: "InfoAgent",
          status: "processing",
          message: "正在分析您的问题...",
          timestamp: new Date()
        });

        // 调用流式 API（纯文本）
        await sendChatMessageStream(
          input.trim(),
          updateMessageContent,
          handleComplete,
          handleError
        );
      }

      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "发送失败";
      handleError(errorMessage);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const preview = URL.createObjectURL(file);
      setImagePreview(preview);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 对话操作栏 */}
      <div className="flex-shrink-0 px-4 pt-4">
        <ChatActions
          onClear={handleClearMessages}
          messageCount={messages.length}
        />
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto space-y-4 px-4 py-2">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            {/* 房屋轮廓 SVG 插画 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mx-auto w-24 h-24 mb-6"
            >
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                {/* 屋顶 */}
                <motion.path
                  d="M50 15 L10 50 L20 50 L20 85 L80 85 L80 50 L90 50 Z"
                  stroke="url(#houseGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                />
                {/* 门 */}
                <motion.rect
                  x="40" y="58" width="20" height="27"
                  stroke="url(#houseGradient)"
                  strokeWidth="2"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 0.5 }}
                />
                {/* 窗户左 */}
                <motion.rect
                  x="26" y="55" width="10" height="12"
                  stroke="url(#houseGradient)"
                  strokeWidth="2"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                />
                {/* 窗户右 */}
                <motion.rect
                  x="64" y="55" width="10" height="12"
                  stroke="url(#houseGradient)"
                  strokeWidth="2"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.4, duration: 0.5 }}
                />
                {/* 烟囱 */}
                <motion.path
                  d="M65 25 L65 38 L75 38 L75 30"
                  stroke="url(#houseGradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.6, duration: 0.5 }}
                />
                <defs>
                  <linearGradient id="houseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D4A652" />
                    <stop offset="50%" stopColor="#8B6F47" />
                    <stop offset="100%" stopColor="#7A9E7E" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
            <h3 className="text-xl font-semibold text-[#2D2D2D] mb-2">开始您的装修咨询</h3>
            <p className="text-[#6B6459]">您可以提出问题或上传房间照片进行分析</p>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"} mb-2`}
            >
              {/* 消息气泡 */}
              <div className={`group ${
                message.role === "user"
                  ? "max-w-[60%] sm:max-w-[50%] bg-gradient-to-r from-[#D4A652] to-[#8B6F47] text-white rounded-2xl rounded-br-sm shadow-lg shadow-[#8B6F47]/20"
                    : "max-w-[85%] bg-white/70 backdrop-blur-md text-[#2D2D2D] rounded-2xl rounded-bl-sm border border-[#8B6F47]/20 relative overflow-hidden"
              } p-3 sm:p-4`}>
                {/* AI 消息左侧装饰条 */}
                {message.role === "assistant" && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#D4A652] via-[#8B6F47] to-[#7A9E7E]" />
                )}

                {/* Agent 时间线 - 显示 agent 行为轨迹 */}
                {message.role === "assistant" && message.agentTimeline && message.agentTimeline.length > 0 && (
                  <AgentTimeline events={message.agentTimeline} />
                )}

                {/* Agent 标签 */}
                {message.agentName && message.role === "assistant" && (
                  <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-[#8B6F47]/20">
                    <span className="text-lg">
                      {AGENT_ICONS[message.agentName] || "🤖"}
                    </span>
                    <span className="text-sm font-semibold text-[#8B6F47]">
                      {AGENT_DISPLAY_NAMES[message.agentName] || message.agentName}
                    </span>
                  </div>
                )}

                {/* 消息内容 */}
                <div className="whitespace-pre-wrap text-sm sm:text-base">
                  {message.content || (
                    <span className="text-[#8A8A8A] italic">正在思考...</span>
                  )}
                </div>

                {/* 生成的图片 */}
                {message.imageUrl && (
                  <div className="mt-3">
                    <div className="text-xs text-[#6B6459] mb-2">生成的效果图：</div>
                    <img
                      src={message.imageUrl}
                      alt="生成的效果图"
                      className="rounded-lg w-full max-w-md shadow-xl"
                    />
                  </div>
                )}

                {/* AI 消息操作按钮 */}
                {message.role === "assistant" && message.content && (
                  <ChatMessageActions
                    content={message.content}
                    onRegenerate={() => handleRegenerate(message)}
                  />
                )}
              </div>

              {/* 时间戳 - 在气泡外部右下角 */}
              <div className={`text-[10px] sm:text-xs mt-1 ${
                message.role === "user" ? "text-[#8A8A8A] mr-2" : "text-[#8A8A8A] ml-2"
              }`}>
                {message.timestamp.toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 发送中状态 */}
        {isSending && messages[messages.length - 1]?.role === "assistant" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white/70 backdrop-blur-md rounded-2xl rounded-bl-sm p-4 border border-[#8B6F47]/20">
              <div className="flex items-center space-x-2">
                <LoadingDots color="#8B6F47" style="small" />
                <span className="text-sm text-[#5A5A5A]">AI 正在回复...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 快捷场景选择 */}
      {showQuickScenes && (
        <QuickScenes onSelect={handleSelectScene} />
      )}

      {/* 输入区域 */}
      <div className="flex-shrink-0 mt-2 p-3 bg-white/55 backdrop-blur-md rounded-2xl border border-[#8B6F47]/20">
        {/* 快捷提示词 - 移到输入区域内 */}
        {!showQuickScenes && messages.length === 0 && (
          <div className="mb-2">
            <QuickPrompts onSelect={handleSelectQuickPrompt} />
          </div>
        )}

        {/* 图片预览 */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="预览"
              className="h-24 rounded-lg shadow-lg"
            />
            <button
              onClick={() => {
                setSelectedImage(null);
                setImagePreview(null);
              }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs hover:bg-red-600 transition shadow-lg"
            >
              ✕
            </button>
          </div>
        )}

        {/* 输入框 */}
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入您的问题或描述装修需求..."
              className="w-full bg-white/80 text-[#2D2D2D] rounded-xl px-4 py-2 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-[#8B6F47]/40 transition placeholder:text-[#8A8A8A]"
              rows={1}
              disabled={isSending}
            />

            {/* 图片上传按钮 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-3 bottom-3 text-[#8A8A8A] hover:text-[#5A5A5A] transition"
              disabled={isSending}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
              disabled={isSending}
            />
          </div>

          {/* 图片类型选择 */}
          {selectedImage && (
            <div className="flex space-x-2">
              <button
                onClick={() => setImageType("current_room")}
                className={`px-3 py-2 rounded-lg text-sm transition ${
                  imageType === "current_room"
                    ? "bg-gradient-to-r from-[#7A9E7E] to-[#9DBF9F] text-white shadow-lg shadow-[#7A9E7E]/20"
                    : "bg-white/70 text-[#5A5A5A] hover:bg-white"
                }`}
              >
                当前房间
              </button>
              <button
                onClick={() => setImageType("inspiration")}
                className={`px-3 py-2 rounded-lg text-sm transition ${
                  imageType === "inspiration"
                    ? "bg-gradient-to-r from-[#7A9E7E] to-[#9DBF9F] text-white shadow-lg shadow-[#7A9E7E]/20"
                    : "bg-white/70 text-[#5A5A5A] hover:bg-white"
                }`}
              >
                灵感图片
              </button>
            </div>
          )}

          {/* 发送按钮 */}
          <button
            onClick={handleSendMessage}
            disabled={isSending || (!input.trim() && !selectedImage)}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
              isSending || (!input.trim() && !selectedImage)
                ? "bg-white/60 text-[#8A8A8A] cursor-not-allowed"
                : "bg-gradient-to-r from-[#8B6F47] to-[#A68B5B] text-white shadow-lg shadow-[#8B6F47]/25 hover:shadow-[#8B6F47]/40"
            }`}
          >
            {isSending ? "发送中" : "发送"}
          </button>
        </div>

        {/* 场景切换按钮 */}
        <div className="flex items-center justify-between mt-2 px-3 bg-white/55 rounded-xl border border-[#8B6F47]/20">
          <button
            onClick={() => setShowQuickScenes(!showQuickScenes)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 hover:bg-white border border-[#8B6F47]/20 transition text-xs text-[#5A5A5A] hover:text-[#2D2D2D]"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2v12a2 2 0 01-2 2h12a2 2 0 01-2-2V6a2 2 0 01-2-2m2 4v2a2 2 0 002 2h12a2 2 0 002-2v-2M4 14h16" />
            </svg>
            <span>{showQuickScenes ? "返回输入" : "场景选择"}</span>
          </button>
          <span className="text-xs text-[#8A8A8A]">按 Enter 发送 · Shift+Enter 换行</span>
        </div>
      </div>
    </div>
  );
}
