"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchRecommendedPrompts,
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
import {
  ChatMessage,
  AgentStatus as AgentStatusType,
  AGENT_DISPLAY_NAMES,
  AGENT_ICONS,
} from "../types/chat";
import LoadingDots from "./LoadingDots";
import { useToast } from "./Toast";
import MarkdownRenderer from "./MarkdownRenderer";
import ImageLightbox from "./ImageLightbox";

interface ChatInterfaceProps {
  sessionId: string;
  onError?: (error: string) => void;
}

interface FailedDraft {
  content: string;
  currentRoomImage: File | null;
}

type ReferenceLink = {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
};

function generateFollowUpPrompts(content: string): string[] {
  const prompts = [
    "请给出这套方案的预算拆分明细",
    "请列出需要购买的主要材料和建议规格",
    "如果我想先做低预算版，优先做哪些项目",
    "请给一个 30 天内可执行的施工计划",
    "有哪些容易踩坑的点需要提前规避",
  ];
  const normalized = content.toLowerCase();
  if (normalized.includes("预算")) {
    prompts.unshift("请给出高配版和性价比版两套预算");
  }
  if (normalized.includes("材料")) {
    prompts.unshift("这些材料有没有更高性价比的替代品牌");
  }
  return Array.from(new Set(prompts)).slice(0, 3);
}

export default function ChatInterface({ sessionId, onError }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [currentRoomImage, setCurrentRoomImage] = useState<File | null>(null);
  const [currentRoomPreview, setCurrentRoomPreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showQuickScenes, setShowQuickScenes] = useState(false);
  const [pendingRenderJobId, setPendingRenderJobId] = useState<string | null>(null);
  const [failedDraft, setFailedDraft] = useState<FailedDraft | null>(null);
  const [recommendedPrompts, setRecommendedPrompts] = useState<string[]>([]);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
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

  useEffect(() => {
    return () => {
      if (currentRoomPreview) {
        URL.revokeObjectURL(currentRoomPreview);
      }
    };
  }, [currentRoomPreview]);

  useEffect(() => {
    fetchSessionMessages(sessionId)
      .then(setMessages)
      .catch(() => setMessages([]));
    fetchRecommendedPrompts(6)
      .then(setRecommendedPrompts)
      .catch(() => setRecommendedPrompts([]));
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

  const updatePreview = (file: File) => {
    const preview = URL.createObjectURL(file);
    if (currentRoomPreview) {
      URL.revokeObjectURL(currentRoomPreview);
    }
    setCurrentRoomImage(file);
    setCurrentRoomPreview(preview);
  };

  const handleSendMessage = async (customMessage?: string) => {
    const finalInput = (customMessage ?? input).trim();
    if ((!finalInput && !currentRoomImage) || isSending) return;

    const outgoingAttachments = [
      currentRoomImage
        ? { id: "current-room", url: URL.createObjectURL(currentRoomImage), label: "当前房间" }
        : null,
    ].filter(Boolean) as NonNullable<ChatMessage["attachments"]>;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: finalInput || "请结合我上传的图片给出装修建议",
      attachments: outgoingAttachments.length ? outgoingAttachments : undefined,
      timestamp: new Date(),
    };

    const tempMessageId = (Date.now() + 1).toString();
    const assistantAgentName = currentRoomImage ? "ProjectCoordinator" : "InfoAgent";

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

    const updateReferences = (links: ReferenceLink[]) => {
      if (!links.length) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessageId
            ? {
                ...msg,
                references: links,
              }
            : msg
        )
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
            : status === "processing" && agent.status === "processing"
            ? { ...agent, status: "completed", message: "已完成当前阶段" }
            : agent
        )
      );
      if (status === "processing") {
        updateMessage({ agentName });
      }
    };

    const handleComplete = () => {
      if (accumulatedContent.trim()) {
        updateMessage({ followUpPrompts: generateFollowUpPrompts(accumulatedContent) });
      }
      setIsSending(false);
      setAgentStatuses((prev) =>
        prev.map((agent) =>
          agent.status === "processing"
            ? { ...agent, status: "completed", message: "已完成当前阶段" }
            : agent
        )
      );
      setCurrentRoomImage(null);
      setCurrentRoomPreview(null);
      setTimeout(() => setActiveAssistantMessageId(null), 120);
      showToast("回复已生成", "success");
    };

    const handleError = (errorMessage: string) => {
      setInput(userMessage.content);
      setFailedDraft({
        content: userMessage.content,
        currentRoomImage,
      });
      onError?.(errorMessage);
      showToast(errorMessage, "error");
      setAgentStatuses((prev) =>
        prev.map((agent) =>
          agent.status === "processing"
            ? { ...agent, status: "error", message: errorMessage }
            : agent
        )
      );
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId));
      setIsSending(false);
      setActiveAssistantMessageId(null);
    };

    try {
      if (currentRoomImage) {
        await sendChatWithImageStream(
          userMessage.content,
          {
            currentRoomImage,
          },
          (content) => {
            accumulatedContent += content;
            updateMessage({ content: accumulatedContent });
          },
          updateAgentStatus,
          (url) => updateMessage({ imageUrl: url }),
          updateReferences,
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
          updateReferences,
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
    <div className="flex flex-col h-full font-body">
      {/* 顶部操作栏 */}
      <div className="flex-shrink-0 px-4 pt-4">
        <ChatActions onClear={handleClearMessages} messageCount={messages.length} />
      </div>

      {/* 聊天消息区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
            <h3 className="font-display text-2xl font-semibold text-accent mb-2">开始您的装修咨询</h3>
            <p className="text-text-secondary">上传当前房间图，或直接描述您的装修需求。</p>
            <div className="mx-auto mt-6 w-full max-w-[500px] rounded-2xl border border-secondary/30 bg-primary p-6 text-left">
              <p className="text-sm font-semibold text-accent mb-3">猜你想问</p>
              <div className="flex flex-wrap gap-2">
                {(recommendedPrompts.length ? recommendedPrompts : generateFollowUpPrompts("")).slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-secondary/30 bg-primary px-4 py-2 text-sm text-text-secondary transition-all duration-200 hover:bg-white hover:text-accent hover:border-secondary/50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"} mb-2`}
            >
              <div
                className={`group max-w-[70%] ${
                  message.role === "user"
                    ? "message-user"
                    : "message-assistant"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-secondary/10 to-transparent" />
                )}

                {message.role === "assistant" && message.agentName && (
                  <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-secondary/20">
                    <span className="text-lg">{AGENT_ICONS[message.agentName] || "🤖"}</span>
                    <span className="text-sm font-semibold text-accent">
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
                      title="多 Agent 同时状态"
                    />
                  )}

                {message.role === "assistant" ? (
                  <MarkdownRenderer content={message.content || "正在思考..."} />
                ) : (
                  <div className="whitespace-pre-wrap text-sm sm:text-base text-text-primary">
                    {message.content}
                  </div>
                )}

                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {message.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="inline-flex max-w-[220px] items-center gap-2 rounded-full bg-white/10 px-2.5 py-1.5 ring-1 ring-white/20"
                      >
                        <img
                          src={attachment.url}
                          alt={attachment.label}
                          className="h-7 w-7 rounded-full object-cover ring-1 ring-white/25"
                        />
                        <span className="truncate text-xs font-medium text-accent">
                          {attachment.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {message.imageUrl && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-text-secondary mb-2">生成的效果图：</p>
                    <button
                      type="button"
                      className="block"
                      onClick={() => {
                        setPreviewImageUrl(message.imageUrl || null);
                        setPreviewTitle("生成效果图");
                      }}
                    >
                      <img
                        src={message.imageUrl}
                        alt="生成的效果图"
                        className="rounded-2xl w-full max-w-md cursor-zoom-in shadow-soft transition-transform duration-300 hover:scale-[1.02]"
                      />
                    </button>
                  </div>
                )}

                {message.references && message.references.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-secondary/15 bg-surface-2 p-3">
                    <p className="text-xs font-medium text-text-secondary mb-2">参考价格与材料链接</p>
                    <div className="space-y-2">
                      {message.references.map((link) => (
                        <a
                          key={`${message.id}-${link.url}`}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border border-secondary/10 bg-primary px-3 py-2 text-xs text-text-secondary transition-all duration-200 hover:bg-white hover:text-accent"
                        >
                          <div className="font-medium text-accent">{link.title}</div>
                          {link.snippet && <div className="mt-1 text-xs text-text-tertiary line-clamp-2">{link.snippet}</div>}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {message.renderStatus === "pending" && (
                  <div className="mt-3 rounded-2xl border border-secondary/15 bg-surface-2 px-3 py-2 text-xs text-text-secondary">
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
                      className="rounded-full border border-secondary/20 bg-primary px-3 py-1.5 text-xs font-medium text-accent transition-all duration-200 hover:bg-white hover:text-accent"
                    >
                      重新生成效果图
                    </button>
                  </div>
                )}

                {message.role === "assistant" && message.content && (
                  <ChatMessageActions content={message.content} onRegenerate={() => handleRegenerate(message)} />
                )}

                {message.role === "assistant" && message.followUpPrompts && message.followUpPrompts.length > 0 && (
                  <div className="mt-3 border-t border-secondary/15 pt-2">
                    <p className="text-xs font-medium text-text-secondary mb-2">猜你想问</p>
                    <div className="flex flex-wrap gap-2">
                      {message.followUpPrompts.slice(0, 3).map((prompt) => (
                        <button
                          key={`${message.id}-${prompt}`}
                          type="button"
                          onClick={() => setInput(prompt)}
                          className="rounded-full border border-secondary/30 bg-primary px-3 py-1.5 text-xs text-text-secondary transition-all duration-200 hover:bg-white hover:text-accent"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`text-[11px] sm:text-xs mt-1 ${
                  message.role === "user"
                    ? "text-text-secondary mr-2"
                    : "text-text-tertiary ml-2"
                }`}
                >
                  {message.timestamp.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isSending && messages[messages.length - 1]?.role === "assistant" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="rounded-2xl border border-secondary/20 bg-surface-2 p-4">
              <LoadingDots color="#9f8370" style="small" />
              <span className="ml-3 text-sm text-text-secondary">AI 正在回复...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 快速提示词面板 */}
      {!showQuickScenes && messages.length === 0 && (
        <div className="px-4 pb-2">
          <QuickPrompts
            onSelect={handleSelectQuickPrompt}
            onSceneToggle={() => setShowQuickScenes((prev) => !prev)}
            sceneActive={showQuickScenes}
          />
        </div>
      )}

      {/* 场景选择面板 */}
      {showQuickScenes && (
        <div className="px-4 pb-2">
          <QuickScenes onSelect={handleSelectScene} />
        </div>
      )}

      {/* 失败草稿重试区域 */}
      <div className="px-4 pb-3">
        {failedDraft && (
          <div className="rounded-2xl border border-red-200 bg-red-50/85 px-4 py-3 text-sm text-red-700">
            <span>刚才那条消息发送失败了，内容和图片已保留，可以直接重新发送。</span>
            <button
              type="button"
              onClick={() => void handleSendMessage()}
              disabled={isSending}
              className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 transition-all duration-200 hover:bg-red-50 disabled:opacity-60"
            >
              重新发送
            </button>
          </div>
        )}
      </div>

      {/* 房间图片预览区域 */}
      <div className="px-4 pb-4">
        {currentRoomPreview && (
          <div className="relative inline-flex max-w-[220px] items-center gap-3 rounded-2xl border border-secondary/20 bg-surface-2 p-2 shadow-soft">
            <img
              src={currentRoomPreview}
              alt="当前房间预览"
              className="h-7 w-7 rounded-full object-cover ring-1 ring-accent/10"
            />
            <span className="truncate text-xs font-medium text-accent">当前房间</span>
            <button
              onClick={() => {
                if (currentRoomPreview) {
                  URL.revokeObjectURL(currentRoomPreview);
                }
                setCurrentRoomImage(null);
                setCurrentRoomPreview(null);
              }}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-accent transition-all duration-200 hover:bg-surface-2 hover:text-accent"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="px-4 pb-4 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入您的问题或描述装修需求..."
          className="w-full min-h-[52px] leading-5 bg-white/80 backdrop-blur-md text-text-primary rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#bdb3a5]/20 focus:bg-white transition-all duration-300 placeholder:text-[#9f8370]/60 border border-[#bdb3a5]/20 shadow-sm active:scale-[0.99]"
          rows={1}
          disabled={isSending}
        />
        <input
          type="file"
          ref={currentRoomInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) updatePreview(file);
          }}
          accept="image/*"
          className="hidden"
          disabled={isSending}
        />
        <button
          onClick={() => currentRoomInputRef.current?.click()}
          disabled={isSending}
          title="上传当前房间图片"
          type="button"
          className={`h-[56px] w-[56px] inline-flex items-center justify-center rounded-2xl transition-all duration-300 shadow-sm ${
            isSending
              ? "bg-white/60 text-text-secondary cursor-not-allowed"
              : "bg-white text-accent hover:bg-[#fcf9f8] hover:shadow-md hover:-translate-y-0.5 active:scale-95"
          }`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="12" cy="12" r="1.5" />
            <path d="M21 15l-4-6 2-4 6" />
          </svg>
        </button>
        <button
          onClick={() => void handleSendMessage()}
          disabled={isSending || (!input.trim() && !currentRoomImage)}
          title="发送"
          type="button"
          className={`h-[56px] w-[56px] inline-flex items-center justify-center rounded-2xl transition-all duration-300 shadow-sm ${
            isSending || (!input.trim() && !currentRoomImage)
              ? "bg-white/60 text-text-secondary cursor-not-allowed"
              : "bg-[#8B6F47] text-white hover:bg-[#A68B5B] hover:shadow-md hover:-translate-y-0.5 active:scale-95"
          }`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22l-4-9-9-4" />
          </svg>
        </button>
      </div>

      {/* 图片灯箱 */}
      <ImageLightbox
        isOpen={Boolean(previewImageUrl)}
        imageUrl={previewImageUrl}
        title={previewTitle}
        onClose={() => setPreviewImageUrl(null)}
      />
    </div>
  );
}
