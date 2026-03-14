"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { sendChatMessageStream, sendChatWithImageStream } from "../utils/api";
import AgentStatus from "./AgentStatus";
import ChatMessageActions from "./ChatMessageActions";
import QuickPrompts from "./QuickPrompts";
import ChatActions from "./ChatActions";
import QuickScenes from "./QuickScenes";
import { ChatMessage, AgentStatus as AgentStatusType, AGENT_DISPLAY_NAMES, AGENT_ICONS } from "../types/chat";
import LoadingDots from "./LoadingDots";

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
        // 模拟 Agent 协作流程
        setTimeout(() => {
          updateAgentStatus("VisualAssessor", "completed");
          updateAgentStatus("DesignPlanner", "processing", "正在生成设计方案...");
        }, 800);

        setTimeout(() => {
          updateAgentStatus("DesignPlanner", "completed");
          updateAgentStatus("ProjectCoordinator", "processing", "正在生成效果图...");
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
      {/* Agent 状态栏 */}
      <div className="flex-shrink-0 px-4 pt-4">
        <AgentStatus agents={agentStatuses} />
      </div>

      {/* 对话操作栏 */}
      <div className="flex-shrink-0 px-4">
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
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-white/90 mb-2">开始您的装修咨询</h3>
            <p className="text-white/50">您可以提出问题或上传房间照片进行分析</p>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] ${
                message.role === "user"
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl rounded-br-sm shadow-lg shadow-blue-500/20"
                  : "bg-white/10 backdrop-blur-md text-white/90 rounded-2xl rounded-bl-sm border border-white/10"
              } p-4`}>
                {/* Agent 标签 */}
                {message.agentName && message.role === "assistant" && (
                  <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-white/10">
                    <span className="text-lg">
                      {AGENT_ICONS[message.agentName] || "🤖"}
                    </span>
                    <span className="text-sm font-semibold text-purple-300">
                      {AGENT_DISPLAY_NAMES[message.agentName] || message.agentName}
                    </span>
                  </div>
                )}

                {/* 消息内容 */}
                <div className="whitespace-pre-wrap">
                  {message.content || (
                    <span className="text-white/40 italic">正在思考...</span>
                  )}
                </div>

                {/* 生成的图片 */}
                {message.imageUrl && (
                  <div className="mt-3">
                    <div className="text-xs text-white/50 mb-2">生成的效果图：</div>
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

                {/* 时间戳 */}
                <div className={`text-xs mt-2 ${
                  message.role === "user" ? "text-blue-200" : "text-white/40"
                }`}>
                  {message.timestamp.toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
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
            <div className="bg-white/10 backdrop-blur-md rounded-2xl rounded-bl-sm p-4 border border-white/10">
              <div className="flex items-center space-x-2">
                <LoadingDots color="white" style="small" />
                <span className="text-sm text-white/70">AI 正在回复...</span>
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

      {/* 快捷提示词 */}
      {!showQuickScenes && messages.length === 0 && (
        <QuickPrompts onSelect={handleSelectQuickPrompt} />
      )}

      {/* 输入区域 */}
      <div className="flex-shrink-0 mt-4 p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
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
              className="w-full bg-white/10 text-white rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition placeholder:text-white/40"
              rows={1}
              disabled={isSending}
            />

            {/* 图片上传按钮 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-3 bottom-3 text-white/50 hover:text-white transition"
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
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                当前房间
              </button>
              <button
                onClick={() => setImageType("inspiration")}
                className={`px-3 py-2 rounded-lg text-sm transition ${
                  imageType === "inspiration"
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
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
                ? "bg-white/5 text-white/30 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
            }`}
          >
            {isSending ? "发送中" : "发送"}
          </button>
        </div>

        {/* 场景切换按钮 */}
        <div className="flex items-center justify-between mt-3 mb-2 px-4 bg-white/5 rounded-xl border border-white/10">
          <button
            onClick={() => setShowQuickScenes(!showQuickScenes)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs text-white/70 hover:text-white/90"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2v12a2 2 0 01-2 2h12a2 2 0 01-2-2V6a2 2 0 01-2-2m2 4v2a2 2 0 002 2h12a2 2 0 002-2v-2M4 14h16" />
            </svg>
            <span>{showQuickScenes ? "返回输入" : "场景选择"}</span>
          </button>
          <span className="text-xs text-white/30">按 Enter 发送 · Shift+Enter 换行</span>
        </div>
      </div>
    </div>
  );
}
