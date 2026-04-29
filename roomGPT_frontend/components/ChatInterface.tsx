"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  analyzeFurnitureMatch,
  fetchFloorplanJobStatus,
  fetchRecommendedPrompts,
  fetchRenderJob,
  fetchSessionMessages,
  requestFloorplanAnalysis,
  requestRenderJob,
  sendChatMessageStream,
  sendChatWithImageStream,
  startFloorplanGeneration,
  updateFloorplanRooms,
} from "../utils/api";
import ChatMessageActions from "./ChatMessageActions";
import QuickPrompts from "./QuickPrompts";
import ChatActions from "./ChatActions";
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
import FloorplanAnalysisCard from "./FloorplanAnalysisCard";

interface ChatInterfaceProps {
  sessionId: string;
  onError?: (error: string) => void;
}

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
  kind: "general" | "current_room" | "inspiration" | "vision_match" | "floorplan";
}

interface FailedDraft {
  content: string;
  uploads: Array<{
    file: File;
    kind: "general" | "current_room" | "inspiration" | "vision_match" | "floorplan";
  }>;
}

type ReferenceLink = {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
};

type FloorplanAnalysis = NonNullable<ChatMessage["floorplanAnalysis"]>;

function mergeFloorplanAnalysis(
  previous: ChatMessage["floorplanAnalysis"],
  incoming: FloorplanAnalysis
): FloorplanAnalysis {
  if (!previous) return incoming;

  const previousRoomsById = new Map((previous.rooms || []).map((room) => [room.id, room]));
  const mergedRooms = (incoming.rooms || []).map((room) => {
    const previousRoom = previousRoomsById.get(room.id);
    if (!previousRoom) return room;

    return {
      ...previousRoom,
      ...room,
      dimensions: room.dimensions ?? previousRoom.dimensions,
      userRequirements: room.userRequirements ?? previousRoom.userRequirements,
      isUserEdited: room.isUserEdited ?? previousRoom.isUserEdited,
      isUserCreated: room.isUserCreated ?? previousRoom.isUserCreated,
    };
  });

  return {
    ...previous,
    ...incoming,
    rooms: mergedRooms,
  };
}

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

function getAttachmentTone(kind?: "general" | "current_room" | "inspiration" | "vision_match" | "floorplan") {
  if (kind === "general") {
    return "bg-[#EDF3FB] text-[#4B6785] ring-1 ring-[#C7D6E8]/75";
  }
  if (kind === "inspiration") {
    return "bg-[#F3EFE8] text-[#7A6A52] ring-1 ring-[#C9BBA5]/60";
  }
  if (kind === "vision_match") {
    return "bg-[#EEF5F0] text-[#4C7560] ring-1 ring-[#B9D0C2]/70";
  }
  if (kind === "floorplan") {
    return "bg-[#F8F1E6] text-[#8C6A41] ring-1 ring-[#D7C1A1]/70";
  }
  return "bg-white/18 text-white/95 ring-1 ring-white/18";
}

function getPendingImageLabel(kind: "general" | "current_room" | "inspiration" | "vision_match" | "floorplan", index: number) {
  if (kind === "general") return `图片 ${index + 1}`;
  if (kind === "current_room") return `原图 ${index + 1}`;
  if (kind === "inspiration") return `灵感图 ${index + 1}`;
  if (kind === "floorplan") return `户型图 ${index + 1}`;
  return `识图 ${index + 1}`;
}

export default function ChatInterface({ sessionId, onError }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(true);
  const [showInspirationComposer, setShowInspirationComposer] = useState(false);
  const [pendingUploadKind, setPendingUploadKind] = useState<"general" | "current_room" | "inspiration" | "vision_match" | "floorplan">("general");
  const [pendingRenderJobId, setPendingRenderJobId] = useState<string | null>(null);
  const [pendingFloorplanJobId, setPendingFloorplanJobId] = useState<string | null>(null);
  const [floorplanActiveRoomByJobId, setFloorplanActiveRoomByJobId] = useState<Record<string, string>>({});
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
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const handledFloorplanToastJobsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  useEffect(() => {
    setPendingFloorplanJobId(null);
    setFloorplanActiveRoomByJobId({});
    handledFloorplanToastJobsRef.current.clear();
    fetchSessionMessages(sessionId)
      .then((history) => {
        setMessages(history);
        const activeFloorplanJob = [...history]
          .reverse()
          .find(
            (message) =>
              message.floorplanJobId &&
              message.floorplanStatus &&
              message.floorplanStatus !== "completed" &&
              message.floorplanStatus !== "failed" &&
              message.floorplanStatus !== "analysis_completed" &&
              message.floorplanStatus !== "generation_completed"
          );
        setPendingFloorplanJobId(activeFloorplanJob?.floorplanJobId || null);
      })
      .catch(() => {
        setMessages([]);
        setPendingFloorplanJobId(null);
      });
    fetchRecommendedPrompts(6)
      .then(setRecommendedPrompts)
      .catch(() => setRecommendedPrompts([]));
    setPendingRenderJobId(null);
    setFailedDraft(null);
    setPendingImages((prev) => {
      prev.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    if (currentRoomInputRef.current) {
      currentRoomInputRef.current.value = "";
    }
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
    if (!pendingFloorplanJobId) return;

    const poll = window.setInterval(async () => {
      try {
        const job = await fetchFloorplanJobStatus(pendingFloorplanJobId);
        if (job.status === "analysis_completed" && job.analysis) {
          const analysis = job.analysis;
          setPendingFloorplanJobId(null);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.floorplanJobId === job.job_id
                ? {
                    ...msg,
                    floorplanStatus: "analysis_completed" as const,
                    floorplanAnalysis: mergeFloorplanAnalysis(msg.floorplanAnalysis, analysis),
                    content: analysis.summary || "户型图分析已完成，请先校对房间信息，再开始生成效果图。",
                  }
                : msg
            )
          );
          setAgentStatuses((prev) =>
            prev.map((agent) =>
              agent.agentName === "VisualAssessor"
                ? { ...agent, status: "completed", message: "户型识别完成" }
                : agent
            )
          );
          if (!handledFloorplanToastJobsRef.current.has(job.job_id)) {
            handledFloorplanToastJobsRef.current.add(job.job_id);
            showToast("户型图分析已完成", "success");
          }
        } else if ((job.status === "generation_pending" || job.status === "generation_processing" || job.status === "generation_completed") && job.analysis) {
          const analysis = job.analysis;
          if (job.status === "generation_completed") {
            setPendingFloorplanJobId(null);
          }
          setMessages((prev) =>
            prev.map((msg) =>
              msg.floorplanJobId === job.job_id
                ? {
                    ...msg,
                    floorplanStatus: job.status as ChatMessage["floorplanStatus"],
                    floorplanAnalysis: mergeFloorplanAnalysis(msg.floorplanAnalysis, analysis),
                    content: analysis.summary || "效果图正在分批生成中。",
                  }
                : msg
            )
          );
          if (job.status === "generation_completed" && !handledFloorplanToastJobsRef.current.has(`${job.job_id}-generation`)) {
            handledFloorplanToastJobsRef.current.add(`${job.job_id}-generation`);
            showToast("效果图已分批生成完成", "success");
          }
        } else if (job.status === "generation_failed") {
          setPendingFloorplanJobId(null);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.floorplanJobId === job.job_id
                ? {
                    ...msg,
                    floorplanStatus: "generation_failed" as const,
                    floorplanAnalysis: job.analysis ? mergeFloorplanAnalysis(msg.floorplanAnalysis, job.analysis) : msg.floorplanAnalysis,
                    content: job.message || "效果图生成失败，请稍后重试。",
                  }
                : msg
            )
          );
          if (!handledFloorplanToastJobsRef.current.has(`${job.job_id}-generation-failed`)) {
            handledFloorplanToastJobsRef.current.add(`${job.job_id}-generation-failed`);
            showToast(job.message || "效果图生成失败", "error");
          }
        } else if (job.status === "failed") {
          setPendingFloorplanJobId(null);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.floorplanJobId === job.job_id
                ? {
                    ...msg,
                    floorplanStatus: "failed" as const,
                    content: job.message || "户型图分析失败，请换一张更清晰的图再试。",
                  }
                : msg
            )
          );
          setAgentStatuses((prev) =>
            prev.map((agent) =>
              agent.agentName === "VisualAssessor"
                ? { ...agent, status: "error", message: job.message || "户型图分析失败" }
                : agent
            )
          );
          if (!handledFloorplanToastJobsRef.current.has(job.job_id)) {
            handledFloorplanToastJobsRef.current.add(job.job_id);
            showToast(job.message || "户型图分析失败", "error");
          }
        }
      } catch {
        // Ignore transient polling failures.
      }
    }, 3000);

    return () => window.clearInterval(poll);
  }, [pendingFloorplanJobId, showToast]);

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

  const buildImageId = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

  const appendSelectedImages = (files: File[], kind: "general" | "current_room" | "inspiration" | "vision_match" | "floorplan") => {
    if (!files.length) return;

    setPendingImages((prev) => {
      if (kind === "floorplan") {
        const nonFloorplan = prev.filter((image) => {
          if (image.kind === "floorplan") {
            URL.revokeObjectURL(image.previewUrl);
            return false;
          }
          return true;
        });
        const file = files[0];
        return [
          ...nonFloorplan,
          {
            id: `${kind}-${buildImageId(file)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            kind,
          },
        ];
      }

      const existingIds = new Set(prev.map((image) => image.id));
      const additions: PendingImage[] = [];

      files.forEach((file) => {
        const id = `${kind}-${buildImageId(file)}`;
        if (existingIds.has(id)) return;
        existingIds.add(id);
        additions.push({
          id,
          file,
          previewUrl: URL.createObjectURL(file),
          kind,
        });
      });

      return [...prev, ...additions];
    });

    if (currentRoomInputRef.current) {
      currentRoomInputRef.current.value = "";
    }
  };

  const removeSelectedImage = (id: string) => {
    setPendingImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((image) => image.id !== id);
    });

    if (currentRoomInputRef.current) {
      currentRoomInputRef.current.value = "";
    }
  };

  const clearSelectedImages = () => {
    setPendingImages((prev) => {
      prev.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });

    if (currentRoomInputRef.current) {
      currentRoomInputRef.current.value = "";
    }
  };

  const handleSendMessage = async (
    customMessage?: string,
    customUploads?: Array<{
      file: File;
      kind: "general" | "current_room" | "inspiration" | "vision_match" | "floorplan";
    }>
  ) => {
    const finalInput = (customMessage ?? input).trim();
    const selectedUploads =
      customUploads ??
      pendingImages.map((image) => ({
        file: image.file,
        kind: image.kind,
      }));

    if ((!finalInput && !selectedUploads.length) || isSending) return;

    const generalFiles = selectedUploads.filter((image) => image.kind === "general").map((image) => image.file);
    const currentRoomFiles = selectedUploads.filter((image) => image.kind === "current_room").map((image) => image.file);
    const inspirationFiles = selectedUploads.filter((image) => image.kind === "inspiration").map((image) => image.file);
    const floorplanFiles = selectedUploads.filter((image) => image.kind === "floorplan").map((image) => image.file);

    if (floorplanFiles.length > 0 && !finalInput) {
      showToast("上传户型图后，请先输入你对生成效果的要求，再点击发送。", "info");
      return;
    }

    if (floorplanFiles.length > 0 && selectedUploads.some((image) => image.kind !== "floorplan")) {
      showToast("户型图分析请单独发送，不要与其他图片混合上传。", "info");
      return;
    }

    const outgoingAttachments = selectedUploads.map((image, idx) => ({
      id: `${image.kind}-${image.file.name}-${image.file.lastModified}-${idx}`,
      url: URL.createObjectURL(image.file),
      label:
        image.kind === "general"
          ? `图片 ${generalFiles.indexOf(image.file) + 1}`
          : image.kind === "current_room"
          ? `原图 ${currentRoomFiles.indexOf(image.file) + 1}`
          : image.kind === "floorplan"
          ? "户型图"
          : `灵感图 ${inspirationFiles.indexOf(image.file) + 1}`,
      kind: image.kind,
    }));

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: finalInput || "请结合我上传的图片给出装修建议",
      attachments: outgoingAttachments.length ? outgoingAttachments : undefined,
      timestamp: new Date(),
    };

    const tempMessageId = (Date.now() + 1).toString();
    const assistantAgentName = floorplanFiles.length ? "VisualAssessor" : selectedUploads.length ? "ProjectCoordinator" : "InfoAgent";

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
    setIsSending(true);
    setFailedDraft(null);
    setActiveAssistantMessageId(tempMessageId);
    setAgentStatuses((prev) => prev.map((agent) => ({ ...agent, status: "idle", message: undefined })));
    clearSelectedImages();

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
      clearSelectedImages();
      setShowInspirationComposer(false);
      setTimeout(() => setActiveAssistantMessageId(null), 1200);
      showToast("回复已生成", "success");
    };

    const handleError = (errorMessage: string) => {
      setInput(userMessage.content);
      setFailedDraft({
        content: userMessage.content,
        uploads: selectedUploads.map((image) => ({ file: image.file, kind: image.kind })),
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
      if (floorplanFiles.length) {
        setAgentStatuses((prev) =>
          prev.map((agent) =>
            agent.agentName === "VisualAssessor"
              ? { ...agent, status: "processing", message: "正在识别户型图..." }
              : agent.agentName === "ProjectCoordinator"
              ? { ...agent, status: "processing", message: "正在整理你的生成要求..." }
              : { ...agent, status: "idle", message: undefined }
          )
        );

        updateMessage({
          content: "已收到户型图和你的生成要求，正在分析户型并准备逐房间生成...",
          floorplanStatus: "processing",
          agentName: "VisualAssessor",
        });

        const result = await requestFloorplanAnalysis(userMessage.content, floorplanFiles[0], sessionId);
        setPendingFloorplanJobId(result.job_id);
        updateMessage({
          floorplanJobId: result.job_id,
          floorplanStatus: "pending" as const,
          content: result.message || "户型图已上传，正在分析房间结构。",
        });
        setIsSending(false);
        setAgentStatuses((prev) =>
          prev.map((agent) =>
            agent.status === "processing"
              ? { ...agent, status: "completed", message: "任务已提交" }
              : agent
          )
        );
        setShowInspirationComposer(false);
        setTimeout(() => setActiveAssistantMessageId(null), 1200);
        showToast("户型图需求已提交", "success");
      } else if (selectedUploads.length) {
        await sendChatWithImageStream(
          userMessage.content,
          {
            currentRoomImages: [...generalFiles, ...currentRoomFiles],
            inspirationImages: inspirationFiles,
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
          sessionId,
          ragEnabled
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
          sessionId,
          ragEnabled
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

  const generalPendingImages = pendingImages.filter((image) => image.kind === "general");
  const currentRoomPendingImages = pendingImages.filter((image) => image.kind === "current_room");
  const inspirationPendingImages = pendingImages.filter((image) => image.kind === "inspiration");
  const floorplanPendingImages = pendingImages.filter((image) => image.kind === "floorplan");

  const triggerFilePicker = (kind: "general" | "current_room" | "inspiration" | "vision_match" | "floorplan") => {
    if (isSending) return;
    setPendingUploadKind(kind);
    currentRoomInputRef.current?.click();
  };

  const handleInspirationBlend = () => {
    setShowInspirationComposer((prev) => !prev);
    if (!showInspirationComposer && !input.trim()) {
      setInput("请结合我上传的原图和灵感图，给我一套融合后的装修方案。");
    }
  };

  const handleVisionMatch = async (file: File) => {
    const attachmentUrl = URL.createObjectURL(file);
    const userMessageId = `vision-user-${Date.now()}`;
    const assistantMessageId = `vision-ai-${Date.now() + 1}`;

    setIsSending(true);
    setActiveAssistantMessageId(assistantMessageId);
    setAgentStatuses((prev) =>
      prev.map((agent) =>
        agent.agentName === "VisualAssessor"
          ? { ...agent, status: "processing", message: "正在识图找同款..." }
          : { ...agent, status: "idle", message: undefined }
      )
    );

    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        content: "请识别这件家具，并给我购买链接。",
        attachments: [
          {
            id: `vision-${file.name}-${file.lastModified}`,
            url: attachmentUrl,
            label: "识图找同款",
            kind: "vision_match",
          },
        ],
        timestamp: new Date(),
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "正在识别家具并搜索购买链接...",
        timestamp: new Date(),
        agentName: "VisualAssessor",
      },
    ]);

    try {
      const result = await analyzeFurnitureMatch(file, sessionId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: result.message,
                references: result.references,
                followUpPrompts: [
                  "帮我找更便宜的相似款",
                  "这件家具适合什么装修风格",
                  "如果放进我家客厅要怎么搭配",
                ],
              }
            : msg
        )
      );
      setAgentStatuses((prev) =>
        prev.map((agent) =>
          agent.agentName === "VisualAssessor"
            ? { ...agent, status: "completed", message: "识图完成" }
            : agent
        )
      );
      showToast("识图找同款已完成", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "识图找同款失败";
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
      onError?.(message);
      showToast(message, "error");
      setAgentStatuses((prev) =>
        prev.map((agent) =>
          agent.agentName === "VisualAssessor"
            ? { ...agent, status: "error", message }
            : agent
        )
      );
    } finally {
      setIsSending(false);
      setTimeout(() => setActiveAssistantMessageId(null), 1200);
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSaveFloorplanRooms = async (messageId: string, jobId: string, rooms: NonNullable<ChatMessage["floorplanAnalysis"]>["rooms"]) => {
    const response = await updateFloorplanRooms(jobId, rooms);
    const analysis = response.analysis;
    if (!analysis) return;
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              floorplanAnalysis: mergeFloorplanAnalysis(msg.floorplanAnalysis, analysis),
              floorplanStatus: "analysis_completed" as const,
              content: analysis.summary || "房间信息已更新，请确认后开始生成效果图。",
            }
          : msg
      )
    );
    showToast("房间信息已保存", "success");
  };

  const handleStartFloorplanGeneration = async (messageId: string, jobId: string, rooms: NonNullable<ChatMessage["floorplanAnalysis"]>["rooms"]) => {
    const response = await startFloorplanGeneration(jobId, rooms);
    setPendingFloorplanJobId(jobId);
    const analysis = response.analysis;
    if (!analysis) return;
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              floorplanAnalysis: mergeFloorplanAnalysis(msg.floorplanAnalysis, analysis),
              floorplanStatus: "generation_pending" as const,
              content: analysis.summary || "已开始分批生成效果图。",
            }
          : msg
      )
    );
    showToast("已开始分批生成效果图", "success");
  };

  return (
    <div className="flex h-full flex-col font-body">
      {/* 顶部操作栏 */}
      <div className="flex-shrink-0 px-4 pt-0">
        <ChatActions
          onClear={handleClearMessages}
          messageCount={messages.length}
          messages={messages}
          sessionId={sessionId}
        />
      </div>

      {/* 聊天消息区域 */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-12 text-center">
            <h3 className="font-display text-2xl font-semibold text-accent mb-2">开始您的装修咨询</h3>
            <p className="text-text-secondary">上传当前房间图，或直接描述您的装修需求。</p>
            <div className="mx-auto mt-6 w-full max-w-[500px] rounded-2xl border border-[rgba(93,74,50,0.18)] bg-[rgba(255,251,244,0.78)] p-6 text-left">
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
                className={`group min-w-0 ${message.floorplanAnalysis ? "max-w-[92%]" : "max-w-[70%]"} ${
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
                  <div>
                    {message.content && (
                      <p className="mb-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/95">
                        {message.content}
                      </p>
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap justify-end gap-2">
                        {message.attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className={`inline-flex max-w-[220px] items-center gap-2 rounded-full px-2.5 py-1.5 ${getAttachmentTone(attachment.kind)}`}
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
                {message.floorplanAnalysis && (
                  <FloorplanAnalysisCard
                    analysis={message.floorplanAnalysis}
                    activeRoomId={message.floorplanJobId ? floorplanActiveRoomByJobId[message.floorplanJobId] : undefined}
                    onActiveRoomChange={
                      message.floorplanJobId
                        ? (roomId) =>
                            setFloorplanActiveRoomByJobId((prev) => ({
                              ...prev,
                              [message.floorplanJobId!]: roomId,
                            }))
                        : undefined
                    }
                    onPreviewImage={(url, title) => {
                      setPreviewImageUrl(url);
                      setPreviewTitle(title);
                    }}
                    onSaveRooms={
                      message.floorplanJobId
                        ? async (rooms) => handleSaveFloorplanRooms(message.id, message.floorplanJobId!, rooms)
                        : undefined
                    }
                    onStartGeneration={
                      message.floorplanJobId
                        ? async (rooms) => handleStartFloorplanGeneration(message.id, message.floorplanJobId!, rooms)
                        : undefined
                    }
                    isBusy={pendingFloorplanJobId === message.floorplanJobId}
                  />
                )}

                {message.floorplanStatus === "pending" && !message.floorplanAnalysis && (
                  <div className="mt-3 rounded-2xl border border-[#D7C1A1]/40 bg-[#FCF7EF] px-4 py-3 text-xs text-[#7A5E3A]">
                    户型图正在识别与拆分中，分析完成后会先进入户型校对阶段。
                  </div>
                )}

                {message.floorplanStatus === "failed" && !message.floorplanAnalysis && (
                  <div className="mt-3 rounded-2xl border border-red-200/60 bg-red-50/70 px-4 py-3 text-xs text-red-600">
                    户型图分析失败，请上传更清晰的户型图后重试。
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
      {messages.length === 0 && (
        <div className="px-4 pb-0">
          <QuickPrompts
            onSelect={handleSelectQuickPrompt}
          />
        </div>
      )}

      {/* 失败草稿重试区域 */}
      {failedDraft && (
        <div className="px-4 pb-2">
          <div className="rounded-2xl border border-red-200 bg-red-50/85 px-4 py-3 text-sm text-red-700">
            <span>刚才那条消息发送失败了，内容和图片已保留，可以直接重新发送。</span>
            <button
              type="button"
              onClick={() => void handleSendMessage(failedDraft.content, failedDraft.uploads)}
              disabled={isSending}
              className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 transition-all duration-200 hover:bg-red-50 disabled:opacity-60"
            >
              重新发送
            </button>
          </div>
        </div>
      )}

      {(generalPendingImages.length > 0 || floorplanPendingImages.length > 0 || showInspirationComposer) && (
      <div className="space-y-2 px-4 pb-2">
          {floorplanPendingImages.length > 0 && (
            <div className="rounded-2xl border border-[#D7C1A1]/60 bg-[#FCF5EB] px-3 py-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#7A5E3A]">户型图待分析</div>
                  <div className="text-xs text-[#8F775B]">先输入你希望的风格、功能和重点要求，再点击发送。</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {floorplanPendingImages.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative inline-flex max-w-[260px] items-center gap-2 rounded-full border border-[#D7C1A1]/70 bg-white/80 px-2.5 py-1.5 shadow-sm"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-2"
                      onClick={() => {
                        setPreviewImageUrl(image.previewUrl);
                        setPreviewTitle(getPendingImageLabel("floorplan", index));
                      }}
                    >
                      <img
                        src={image.previewUrl}
                        alt={getPendingImageLabel("floorplan", index)}
                        className="h-7 w-7 rounded-full object-cover ring-1 ring-[#D7C1A1]/70"
                      />
                      <span className="truncate text-xs font-medium text-[#7A5E3A]">
                        {getPendingImageLabel("floorplan", index)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSelectedImage(image.id)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F5EBDD] text-[11px] text-[#8C6A41] transition hover:bg-[#EBDAC2]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {generalPendingImages.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-medium text-[#4B6785]">已上传图片</div>
              <div className="flex flex-wrap gap-2">
                {generalPendingImages.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative inline-flex max-w-[240px] items-center gap-2 rounded-full border border-[#C7D6E8]/70 bg-[#F6FAFF] px-2.5 py-1.5 shadow-sm"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-2"
                      onClick={() => {
                        setPreviewImageUrl(image.previewUrl);
                        setPreviewTitle(getPendingImageLabel("general", index));
                      }}
                    >
                      <img
                        src={image.previewUrl}
                        alt={getPendingImageLabel("general", index)}
                        className="h-7 w-7 rounded-full object-cover ring-1 ring-[#C7D6E8]/70"
                      />
                      <span className="truncate text-xs font-medium text-[#4B6785]">
                        {getPendingImageLabel("general", index)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSelectedImage(image.id)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E8F0F8] text-[11px] text-[#4B6785] transition hover:bg-[#DCE8F4]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showInspirationComposer && (
            <div className="rounded-2xl border border-[#8B6F47]/15 bg-white/72 p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#2D2D2D]">灵感结合</div>
                  <div className="text-xs text-[#6B6459]">分别上传原图和灵感图，AI 会结合两者输出融合方案。</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInspirationComposer(false)}
                  className="rounded-full border border-[#8B6F47]/15 bg-white px-3 py-1 text-xs text-[#6B6459] transition hover:bg-[#F7F1E7]"
                >
                  收起
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => triggerFilePicker("current_room")}
                  disabled={isSending}
                  className="rounded-full border border-[#8B6F47]/20 bg-white px-3 py-1.5 text-xs font-medium text-[#8B6F47] transition hover:bg-[#F9F4EC] disabled:opacity-60"
                >
                  上传原图
                </button>
                <button
                  type="button"
                  onClick={() => triggerFilePicker("inspiration")}
                  disabled={isSending}
                  className="rounded-full border border-[#C9BBA5]/45 bg-[#FBF7F1] px-3 py-1.5 text-xs font-medium text-[#7A6A52] transition hover:bg-[#F7F0E6] disabled:opacity-60"
                >
                  上传灵感图
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {currentRoomPendingImages.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-[#8B6F47]">原图</div>
                    <div className="flex flex-wrap gap-2">
                      {currentRoomPendingImages.map((image, index) => (
                        <div
                          key={image.id}
                          className="relative inline-flex max-w-[240px] items-center gap-2 rounded-full border border-[#8B6F47]/18 bg-white/85 px-2.5 py-1.5 shadow-sm"
                        >
                          <button
                            type="button"
                            className="flex items-center gap-2"
                            onClick={() => {
                              setPreviewImageUrl(image.previewUrl);
                              setPreviewTitle(getPendingImageLabel("current_room", index));
                            }}
                          >
                            <img
                              src={image.previewUrl}
                              alt={getPendingImageLabel("current_room", index)}
                              className="h-7 w-7 rounded-full object-cover ring-1 ring-[#8B6F47]/10"
                            />
                            <span className="truncate text-xs font-medium text-[#5A5A5A]">
                              {getPendingImageLabel("current_room", index)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSelectedImage(image.id)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F4ECE3] text-[11px] text-[#8B6F47] transition hover:bg-[#EADBC8]"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inspirationPendingImages.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-[#7A6A52]">灵感图</div>
                    <div className="flex flex-wrap gap-2">
                      {inspirationPendingImages.map((image, index) => (
                        <div
                          key={image.id}
                          className="relative inline-flex max-w-[240px] items-center gap-2 rounded-full border border-[#C9BBA5]/45 bg-[#FBF7F1] px-2.5 py-1.5 shadow-sm"
                        >
                          <button
                            type="button"
                            className="flex items-center gap-2"
                            onClick={() => {
                              setPreviewImageUrl(image.previewUrl);
                              setPreviewTitle(getPendingImageLabel("inspiration", index));
                            }}
                          >
                            <img
                              src={image.previewUrl}
                              alt={getPendingImageLabel("inspiration", index)}
                              className="h-7 w-7 rounded-full object-cover ring-1 ring-[#C9BBA5]/45"
                            />
                            <span className="truncate text-xs font-medium text-[#6B6459]">
                              {getPendingImageLabel("inspiration", index)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSelectedImage(image.id)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F4ECE3] text-[11px] text-[#8B6F47] transition hover:bg-[#EADBC8]"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 底部输入区域 */}
      <div className="px-4 pb-4 pt-0">
        <div className="rounded-[24px] border border-[rgba(93,74,50,0.18)] bg-[rgba(255,251,244,0.9)] px-3 py-2.5 shadow-soft-lg backdrop-blur-md">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="发消息，描述你的装修需求..."
            className="h-6 w-full border-0 bg-transparent px-2 py-0 text-[15px] leading-6 text-accent outline-none ring-0 ring-transparent shadow-none focus:border-0 focus:outline-none focus:ring-0 focus:ring-transparent focus:shadow-none focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-secondary"
            disabled={isSending}
          />

          <input
            type="file"
            ref={currentRoomInputRef}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (!files.length) return;
              if (pendingUploadKind === "vision_match") {
                if (files.length > 1) {
                  showToast("识图找同款一次只支持 1 张图片，已使用第一张。", "info");
                }
                void handleVisionMatch(files[0]);
                if (currentRoomInputRef.current) {
                  currentRoomInputRef.current.value = "";
                }
                return;
              }
              if (pendingUploadKind === "floorplan") {
                if (files.length > 1) {
                  showToast("户型图分析一次只支持 1 张图片，已使用第一张。", "info");
                }
                appendSelectedImages([files[0]], "floorplan");
                if (!input.trim()) {
                  setInput("请根据这张户型图生成方案，我的要求是：");
                }
                showToast("户型图已加入待分析区，请先输入你的要求再发送。", "info");
                if (currentRoomInputRef.current) {
                  currentRoomInputRef.current.value = "";
                }
                return;
              }
              appendSelectedImages(files, pendingUploadKind);
            }}
            accept="image/*"
            multiple
            className="hidden"
            disabled={isSending}
          />

          <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-[rgba(93,74,50,0.12)] px-1 pt-2.5">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => triggerFilePicker("general")}
                disabled={isSending}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium text-[#4B6785] transition hover:bg-[#E8F0FA] disabled:opacity-60"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 01-7.78-7.78l9.2-9.19a3.5 3.5 0 114.95 4.95l-9.19 9.2a1.5 1.5 0 01-2.12-2.13l8.49-8.48" />
                </svg>
                图像上传
              </button>
              <button
                type="button"
                onClick={() => triggerFilePicker("floorplan")}
                disabled={isSending}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium text-[#8C6A41] transition hover:bg-[#F5EBDD] disabled:opacity-60"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18v14H3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h5" />
                </svg>
                户型图分析
              </button>
              <button
                type="button"
                onClick={() => triggerFilePicker("vision_match")}
                disabled={isSending}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium text-[#4C7560] transition hover:bg-[#E8F0EA] disabled:opacity-60"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                </svg>
                识图找同款
              </button>
              <button
                type="button"
                onClick={handleInspirationBlend}
                disabled={isSending}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium transition disabled:opacity-60 ${
                  showInspirationComposer
                    ? "bg-[linear-gradient(135deg,#2f261f_0%,#6d5232_100%)] text-white shadow-md"
                    : "text-[#7d5f3c] hover:bg-[#F7F1E7]"
                }`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h5l2 3h11" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 21l3-9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 12l3 9" />
                </svg>
                灵感结合
              </button>
              <button
                type="button"
                onClick={() => setRagEnabled((prev) => !prev)}
                disabled={isSending}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium transition disabled:opacity-60 ${
                  ragEnabled
                    ? "bg-[#5C7B60] text-white shadow-md"
                    : "text-[#5C7B60] hover:bg-[#EEF5EF]"
                }`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                📚 知识库
              </button>
            </div>

            <button
              onClick={() => {
                void handleSendMessage();
              }}
              disabled={isSending || (!input.trim() && !pendingImages.length)}
              title="发送"
              className={`group relative inline-flex h-10 w-10 shrink-0 items-center justify-center self-end overflow-hidden rounded-full border transition-all duration-300 ${
                isSending || (!input.trim() && !pendingImages.length)
                  ? "border-[#E6DED2] bg-[#F4EFE8] text-[#B3A797] cursor-not-allowed"
                  : "border-[rgba(140,106,65,0.36)] bg-[linear-gradient(135deg,#2f261f_0%,#6d5232_68%,#9c7342_100%)] text-white shadow-[0_10px_24px_rgba(48,38,29,0.28)] hover:border-[rgba(140,106,65,0.5)] hover:shadow-[0_14px_30px_rgba(48,38,29,0.34)]"
              }`}
            >
              {!isSending && (input.trim() || pendingImages.length > 0) && (
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.38),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_70%)]" />
              )}
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M7 10l5-5 5 5" />
              </svg>
            </button>
          </div>
        </div>
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
