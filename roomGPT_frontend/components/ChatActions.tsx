"use client";

import { motion } from "framer-motion";
import { ChatMessage } from "../types/chat";

interface ChatActionsProps {
  onClear?: () => void;
  onExport?: () => void;
  messageCount?: number;
  messages?: ChatMessage[];
  sessionId?: string;
}

function escapeMarkdown(text: string) {
  return text.replace(/\\/g, "\\\\");
}

function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

function formatTimestamp(value?: Date) {
  if (!value || Number.isNaN(value.getTime())) return "";
  return value.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMarkdown(messages: ChatMessage[], sessionId?: string) {
  const exportTime = new Date();
  const lines: string[] = [
    "# AI 装修对话记录",
    "",
    `- 导出时间：${formatTimestamp(exportTime)}`,
    `- 会话 ID：${sessionId || "未命名会话"}`,
    `- 消息数量：${messages.length}`,
    "",
    "---",
    "",
  ];

  messages.forEach((message, index) => {
    const speaker = message.role === "user" ? "用户" : "AI";
    lines.push(`## ${index + 1}. ${speaker}`);
    const timestamp = formatTimestamp(message.timestamp);
    if (timestamp) {
      lines.push("");
      lines.push(`- 时间：${timestamp}`);
    }
    if (message.agentName) {
      lines.push(`- Agent：${message.agentName}`);
    }

    lines.push("");
    lines.push(escapeMarkdown(message.content || ""));

    if (message.attachments?.length) {
      lines.push("");
      lines.push("### 上传图片");
      lines.push("");
      message.attachments.forEach((attachment) => {
        lines.push(`- [${attachment.label || "查看图片"}](${attachment.url})`);
      });
    }

    if (message.imageUrl) {
      lines.push("");
      lines.push("### 生成图片");
      lines.push("");
      lines.push(`![生成图片](${message.imageUrl})`);
      lines.push("");
      lines.push(`- 下载链接：${message.imageUrl}`);
    }

    if (message.references?.length) {
      lines.push("");
      lines.push("### 参考链接");
      lines.push("");
      message.references.forEach((link) => {
        lines.push(`- [${link.title}](${link.url})`);
        if (link.snippet) {
          lines.push(`  ${escapeMarkdown(link.snippet)}`);
        }
      });
    }

    if (message.followUpPrompts?.length) {
      lines.push("");
      lines.push("### 猜你想问");
      lines.push("");
      message.followUpPrompts.forEach((prompt) => {
        lines.push(`- ${escapeMarkdown(prompt)}`);
      });
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n").trimEnd() + "\n";
}

export default function ChatActions({
  onClear,
  onExport,
  messageCount = 0,
  messages = [],
  sessionId,
}: ChatActionsProps) {
  const handleExport = () => {
    const date = new Date()
      .toLocaleDateString("zh-CN")
      .replace(/\//g, "-");
    const filename = `AI装修对话_${sanitizeFilenamePart(sessionId || date)}_${date}.md`;
    const content = buildMarkdown(messages, sessionId);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    onExport?.();
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[#8B6F47]/15">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8A8A8A]">
          共 {messageCount} 条消息
        </span>
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-[#8B6F47]/20 transition text-xs text-[#5A5A5A] hover:text-[#2D2D2D]"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>导出 MD</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 transition text-xs text-red-700 hover:text-red-800"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>清空</span>
        </motion.button>
      </div>
    </div>
  );
}
