"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchRenderJob,
  fetchSessionMessages,
  requestRenderJob,
  sendChatMessageStream,
  sendChatWithImageStream,
} from "../utils/api";
import ChatMessageActions from "./ChatMessageActions";
import QuickPrompts from "./QuickPrompts";
import ChatActions from "./ChatActions";
import QuickScenes from "./QuickScenes";
import AgentStatus from "./AgentStatus";
import { ChatMessage, AgentStatus as AgentStatusType, AGENT_DISPLAY_NAMES, AGENT_ICONS } from "../types/chat";
import LoadingDots from "./LoadingDots";
import { useToast } from "./Toast";
import MarkdownRenderer from "./MarkdownRenderer";

interface ChatInterfaceProps {
  sessionId: string;
  onError?: (error: string) => void;
}

interface FailedDraft {
  content: string;
  currentRoomImage: File | null;
  inspirationImage: File | null;
}

export default function ChatInterface({ sessionId, onError }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [currentRoomImage, setCurrentRoomImage] = useState<File | null>(null);
  const [inspirationImage, setInspirationImage] = useState<File | null>(null);
  const [currentRoomPreview, setCurrentRoomPreview] = useState<string | null>(null);
  const [inspirationPreview, setInspirationPreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showQuickScenes, setShowQuickScenes] = useState(false);
  const [pendingRenderJobId, setPendingRenderJobId] = useState<string | null>(null);
  const [failedDraft, setFailedDraft] = useState<FailedDraft | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatusType[]>([
    { agentName: "HomeRenovationPlanner", displayName: "装修顾问", status: "idle" },
    { agentName: "InfoAgent", displayName: "咨询助手", status: "idle" },
    { agentName: "VisualAssessor", displayName: "视觉评估", status: "idle" },
    { agentName: "DesignPlanner", displayName: "设计规划", status: "idle" },
    { agentName: "ProjectCoordinator", displayName: "项目协调", status: "idle" },
    { agentName: "RenderingEditor", displayName: "效果编辑", status: "idle" },
  ]);
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<string | null>(null);
  const { showToast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentRoomInputRef = useRef<HTMLInputElement>(null);
  const inspirationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (currentRoomPreview) URL.revokeObjectURL(currentRoomPreview);
      if (inspirationPreview) URL.revokeObjectURL(inspirationPreview);
    };
  }, [currentRoomPreview, inspirationPreview]);

  useEffect(() => {
    fetchSessionMessages(sessionId)
      .then(setMessages)
      .catch(() => setMessages([]));
    setPendingRenderJobId(null);
    setFailedDraft(null);
    setAgentStatuses((prev) => prev.map((agent) => ({ ...agent, status: "idle", message: undefined })));
  }, [sessionId]);

  useEffect(() => {
    if (!pendingRenderJobId) return;

    const poll = window.setInterval(async () => {
      try {
        const job = await fetchRenderJob(pendingRenderJobId);
        if (job.status === "completed") {
          setPendingRenderJobId(null);
          setMessages((prev) => {
            const next = prev.map((msg) =>
              msg.renderJobId === job.job_id
                ? {
                    ...msg,
                    renderStatus: "completed" as const,
                    content: `${msg.content}\n\n效果图已经生成完成，结果已插入到当前对话中。`,
                  }
                : msg
            );
            return [
              ...next,
              {
                id: `render-${job.job_id}`,
                role: "assistant",
                content: "效果图已生成，你可以继续告诉我想微调的部分。",
                imageUrl: job.imageUrl,
                timestamp: new Date(),
              },
            ];
          });
          showToast("效果图已生成", "success");
        } else if (job.status === "failed") {
          setPendingRenderJobId(null);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.renderJobId === job.job_id
                ? {
                    ...msg,
                    renderStatus: "failed" as const,
                    retryableRender: job.retryable,
                    content: `${msg.content}\n\n${job.message || "当前效果图服务繁忙，可稍后重新生成。"}`,
                  }
                : msg
            )
          );
          showToast(job.message || "效果图暂未生成成功", "error");
        }
      } catch {
        // Ignore transient polling errors and retry on next tick.
      }
    }, 3000);

    return () => window.clearInterval(poll);
  }, [pendingRenderJobId, showToast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClearMessages = () => {
    if (confirm("切换会话来开始新对话，当前会话历史会保留。")) {
      setMessages([]);
    }
  };

  const handleRegenerate = (message: ChatMessage) => {
    setInput(message.content);
  };

  const handleSelectQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const handleSelectScene = (scene: string, style?: string) => {
    let nextInput = scene ? `我想装修${scene}，` : input;
    if (style) {
      nextInput += `请设计${style}风格的方案。`;
    }
    setInput(nextInput);
    setShowQuickScenes(false);
  };

  const updatePreview = (file: File, type: "current" | "inspiration") => {
    const preview = URL.createObjectURL(file);
    if (type === "current") {
      if (currentRoomPreview) {
        URL.revokeObjectURL(currentRoomPreview);
      }
      setCurrentRoomImage(file);
      setCurrentRoomPreview(preview);
    } else {
      if (inspirationPreview) {
        URL.revokeObjectURL(inspirationPreview);
      }
      setInspirationImage(file);
      setInspirationPreview(preview);
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && !currentRoomImage && !inspirationImage) || isSending) return;

    const outgoingAttachments = [
      currentRoomImage
        ? { id: "current-room", url: URL.createObjectURL(currentRoomImage), label: "当前房间" }
        : null,
      inspirationImage
        ? { id: "inspiration", url: URL.createObjectURL(inspirationImage), label: "灵感图" }
        : null,
    ].filter(Boolean) as NonNullable<ChatMessage["attachments"]>;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim() || "请结合我上传的图片给出装修建议",
      attachments: outgoingAttachments.length ? outgoingAttachments : undefined,
      timestamp: new Date(),
    };

    const tempMessageId = (Date.now() + 1).toString();
    const assistantAgentName = currentRoomImage || inspirationImage ? "ProjectCoordinator" : "InfoAgent";

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: tempMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        agentName: assistantAgentName,
      },
    ]);

    setInput("");
    setShowQuickScenes(false);
    setIsSending(true);
    setFailedDraft(null);
    setActiveAssistantMessageId(tempMessageId);
    setAgentStatuses((prev) => prev.map((agent) => ({ ...agent, status: "idle", message: undefined })));

    let accumulatedContent = "";

    const updateMessage = (patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempMessageId ? { ...msg, ...patch } : msg))
      );
    };

    const updateAgentStatus = (
      agentName: string,
      status: "idle" | "processing" | "completed" | "error"
    ) => {
      setAgentStatuses((prev) =>
        prev.map((agent) =>
          agent.agentName === agentName
            ? {
                ...agent,
                status,
                message:
                  status === "processing"
                    ? "正在执行..."
                    : status === "completed"
                    ? "已完成当前阶段"
                    : status === "error"
                    ? "执行出错"
                    : undefined,
              }
            : status === "processing" && agent.status === "processing" && agent.agentName !== agentName
            ? { ...agent, status: "completed", message: "已完成当前阶段" }
            : agent
        )
      );
      if (status === "processing") {
        updateMessage({ agentName });
      }
    };

    const handleComplete = () => {
      setIsSending(false);
      setAgentStatuses((prev) =>
        prev.map((agent) =>
          agent.status === "processing"
            ? { ...agent, status: "completed", message: "已完成当前阶段" }
            : agent
        )
      );
      setCurrentRoomImage(null);
      setInspirationImage(null);
      setCurrentRoomPreview(null);
      setInspirationPreview(null);
      setTimeout(() => setActiveAssistantMessageId(null), 1200);
      showToast("回复已生成", "success");
    };

    const handleError = (errorMessage: string) => {
      setInput(userMessage.content);
      setFailedDraft({
        content: userMessage.content,
        currentRoomImage,
        inspirationImage,
      });
      onError?.(errorMessage);
      showToast(errorMessage, "error");
      setAgentStatuses((prev) =>
        prev.map((agent) =>
          agent.status === "processing" ? { ...agent, status: "error", message: errorMessage } : agent
        )
      );
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      setIsSending(false);
      setActiveAssistantMessageId(null);
    };

    try {
      if (currentRoomImage || inspirationImage) {
        await sendChatWithImageStream(
          userMessage.content,
          {
            currentRoomImage,
            inspirationImage,
          },
          (content) => {
            accumulatedContent += content;
            updateMessage({ content: accumulatedContent });
          },
          updateAgentStatus,
          (url) => updateMessage({ imageUrl: url }),
          (jobId) => {
            setPendingRenderJobId(jobId);
            updateMessage({
              renderJobId: jobId,
              renderStatus: "pending" as const,
              content: `${accumulatedContent || "文字方案已完成。"}\n\n效果图正在后台生成，生成完成后会自动插入当前对话。`,
            });
          },
          handleComplete,
          handleError,
          sessionId
        );
      } else {
        await sendChatMessageStream(
          userMessage.content,
          (content) => {
            accumulatedContent += content;
            updateMessage({ content: accumulatedContent });
          },
          updateAgentStatus,
          handleComplete,
          handleError,
          sessionId
        );
      }
    } catch (error) {
      handleError(error instanceof Error ? error.message : "发送失败");
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
      <div className="flex-shrink-0 px-4 pt-4">
        <ChatActions onClear={handleClearMessages} messageCount={messages.length} />
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 px-4 py-2">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
            <h3 className="text-xl font-semibold text-[#2D2D2D] mb-2">开始您的装修咨询</h3>
            <p className="text-[#6B6459]">上传当前房间图、灵感图，或直接描述您的装修需求。</p>
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
                <div
                  className={`group ${
                    message.role === "user"
                      ? "max-w-[60%] sm:max-w-[50%] bg-apple-blue text-white rounded-2xl rounded-br-sm shadow-apple"
                      : "max-w-[85%] bg-white/90 backdrop-blur-md text-apple-black rounded-2xl rounded-bl-sm border border-apple-gray-200/50 relative overflow-hidden shadow-apple"
                  } p-3 sm:p-4`}
                >
                {message.role === "assistant" && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#D4A652] via-[#8B6F47] to-[#7A9E7E]" />
                )}

                {message.agentName && message.role === "assistant" && (
                  <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-[#8B6F47]/20">
                    <span className="text-lg">{AGENT_ICONS[message.agentName] || "🤖"}</span>
                    <span className="text-sm font-semibold text-[#8B6F47]">
                      {AGENT_DISPLAY_NAMES[message.agentName] || message.agentName}
                    </span>
                  </div>
                )}

                {message.role === "assistant" &&
                  message.id === activeAssistantMessageId &&
                  agentStatuses.some((agent) => agent.status !== "idle") && (
                    <AgentStatus
                      agents={agentStatuses.filter((agent) => agent.agentName !== "HomeRenovationPlanner")}
                      compact={true}
                      isCollapsible={false}
                      title="多 Agent 实时状态"
                    />
                  )}

                {message.role === "assistant" ? (
                  <MarkdownRenderer content={message.content || "正在思考..."} />
                ) : (
                  <div>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap justify-end gap-2">
                        {message.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="inline-flex max-w-[220px] items-center gap-2 rounded-full bg-white/18 px-2.5 py-1.5 ring-1 ring-white/18"
                          >
                            <img
                              src={attachment.url}
                              alt={attachment.label}
                              className="h-7 w-7 rounded-full object-cover ring-1 ring-white/25"
                            />
                            <span className="truncate text-xs font-medium text-white/95">
                              {attachment.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-sm sm:text-base">{message.content}</div>
                  </div>
                )}

                {message.imageUrl && (
                  <div className="mt-3">
                    <div className="text-xs text-[#6B6459] mb-2">生成的效果图：</div>
                    <img src={message.imageUrl} alt="生成的效果图" className="rounded-lg w-full max-w-md shadow-xl" />
                  </div>
                )}

                {message.renderStatus === "pending" && (
                  <div className="mt-3 rounded-xl border border-[#8B6F47]/15 bg-[#FBF7F0] px-3 py-2 text-xs text-[#6B6459]">
                    当前正在后台生成效果图，你可以继续提需求，不需要一直等待。
                  </div>
                )}

                {message.renderStatus === "failed" && message.retryableRender && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const job = await requestRenderJob(sessionId);
                          setPendingRenderJobId(job.job_id);
                          setMessages((prev) =>
                            prev.map((msg) =>
                              msg.id === message.id
                                ? {
                                    ...msg,
                                    renderJobId: job.job_id,
                                    renderStatus: "pending" as const,
                                    retryableRender: false,
                                    content: `${msg.content}\n\n已重新发起效果图生成，请稍候。`,
                                  }
                                : msg
                            )
                          );
                        } catch (error) {
                          onError?.(error instanceof Error ? error.message : "重新生成失败");
                        }
                      }}
                      className="rounded-full border border-[#8B6F47]/20 bg-white px-3 py-1.5 text-xs font-medium text-[#8B6F47] transition hover:bg-[#F7F1E7]"
                    >
                      重新生成效果图
                    </button>
                  </div>
                )}

                {message.role === "assistant" && message.content && (
                  <ChatMessageActions content={message.content} onRegenerate={() => handleRegenerate(message)} />
                )}
              </div>

              <div
                className={`text-[10px] sm:text-xs mt-1 ${
                  message.role === "user" ? "text-[#8A8A8A] mr-2" : "text-[#8A8A8A] ml-2"
                }`}
              >
                {message.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isSending && messages[messages.length - 1]?.role === "assistant" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl rounded-bl-sm p-4 border border-apple-gray-200/50 shadow-apple">
              <div className="flex items-center space-x-2">
                <LoadingDots color="#0071e3" style="small" />
                <span className="text-sm text-apple-gray-500">AI 正在回复...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {showQuickScenes && (
        <div className="px-3 pb-2">
          <QuickScenes onSelect={handleSelectScene} />
        </div>
      )}

      <div className="flex-shrink-0 mt-2 p-3 bg-white/80 backdrop-blur-md rounded-2xl border border-apple-gray-200/50 shadow-apple">
        {failedDraft && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/85 px-3 py-2 text-sm text-red-700">
            <span>刚才那条消息发送失败了，内容和图片已保留，可以直接重新发送。</span>
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={isSending}
              className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            >
              重新发送
            </button>
          </div>
        )}

        {!showQuickScenes && messages.length === 0 && (
          <div className="mb-1.5">
            <QuickPrompts onSelect={handleSelectQuickPrompt} />
          </div>
        )}

        <div className="mb-2 flex flex-wrap gap-2">
          {currentRoomPreview && (
            <div className="relative inline-flex max-w-[220px] items-center gap-2 rounded-full border border-[#8B6F47]/18 bg-white/85 px-2.5 py-1.5 shadow-sm">
              <img
                src={currentRoomPreview}
                alt="当前房间预览"
                className="h-7 w-7 rounded-full object-cover ring-1 ring-[#8B6F47]/10"
              />
              <span className="truncate text-xs font-medium text-[#5A5A5A]">当前房间</span>
              <button
                onClick={() => {
                  if (currentRoomPreview) {
                    URL.revokeObjectURL(currentRoomPreview);
                  }
                  setCurrentRoomImage(null);
                  setCurrentRoomPreview(null);
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F4ECE3] text-[11px] text-[#8B6F47] transition hover:bg-[#EADBC8]"
              >
                ✕
              </button>
            </div>
          )}

          {inspirationPreview && (
            <div className="relative inline-flex max-w-[220px] items-center gap-2 rounded-full border border-[#8B6F47]/18 bg-white/85 px-2.5 py-1.5 shadow-sm">
              <img
                src={inspirationPreview}
                alt="灵感图片预览"
                className="h-7 w-7 rounded-full object-cover ring-1 ring-[#8B6F47]/10"
              />
              <span className="truncate text-xs font-medium text-[#5A5A5A]">灵感图</span>
              <button
                onClick={() => {
                  if (inspirationPreview) {
                    URL.revokeObjectURL(inspirationPreview);
                  }
                  setInspirationImage(null);
                  setInspirationPreview(null);
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F4ECE3] text-[11px] text-[#8B6F47] transition hover:bg-[#EADBC8]"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => currentRoomInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border border-[#8B6F47]/20 bg-white/70 px-3 py-1.5 text-xs text-[#5A5A5A] shadow-sm transition hover:border-[#8B6F47]/35 hover:bg-white hover:text-[#2D2D2D] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSending}
            type="button"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F5EFE6] text-xs">
              🏠
            </span>
            <span className="leading-4">上传当前房间</span>
          </button>
          <button
            onClick={() => inspirationInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border border-[#8B6F47]/20 bg-white/70 px-3 py-1.5 text-xs text-[#5A5A5A] shadow-sm transition hover:border-[#8B6F47]/35 hover:bg-white hover:text-[#2D2D2D] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSending}
            type="button"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF6EF] text-xs">
              🎨
            </span>
            <span className="leading-4">上传灵感图</span>
          </button>
          <button
            onClick={() => setShowQuickScenes(!showQuickScenes)}
            className="inline-flex items-center gap-2 rounded-full border border-[#8B6F47]/20 bg-white/70 px-3 py-1.5 text-xs text-[#5A5A5A] shadow-sm transition hover:border-[#8B6F47]/35 hover:bg-white hover:text-[#2D2D2D]"
            type="button"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F3EEE5]">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2v12a2 2 0 01-2 2h12a2 2 0 01-2-2V6a2 2 0 01-2-2m2 4v2a2 2 0 002 2h12a2 2 0 002-2v-2M4 14h16" />
              </svg>
            </span>
            <span className="leading-4">{showQuickScenes ? "返回输入" : "场景选择"}</span>
          </button>
        </div>

        <div className="flex items-end gap-2.5">
          <div className="flex-1 min-w-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入您的问题或描述装修需求..."
              className="w-full min-h-[56px] bg-white text-apple-black rounded-2xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-apple-blue/40 transition placeholder:text-apple-gray-400 border border-apple-gray-200/50"
              rows={2}
              disabled={isSending}
            />

            <input
              type="file"
              ref={currentRoomInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) updatePreview(file, "current");
              }}
              accept="image/*"
              className="hidden"
              disabled={isSending}
            />
            <input
              type="file"
              ref={inspirationInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) updatePreview(file, "inspiration");
              }}
              accept="image/*"
              className="hidden"
              disabled={isSending}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={isSending || (!input.trim() && !currentRoomImage && !inspirationImage)}
            className={`min-w-[82px] self-stretch rounded-2xl px-5 py-3 text-sm font-medium transition-all duration-300 ${
              isSending || (!input.trim() && !currentRoomImage && !inspirationImage)
                ? "bg-apple-gray-200 text-apple-gray-400 cursor-not-allowed"
                : "bg-apple-blue text-white shadow-apple hover:bg-apple-blue-hover hover:shadow-apple-lg"
            }`}
          >
            {isSending ? "发送中" : "发送"}
          </button>
        </div>
      </div>
    </div>
  );
}
