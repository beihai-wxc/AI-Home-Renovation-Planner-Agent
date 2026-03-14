"use client";

import { motion } from "framer-motion";

interface ChatActionsProps {
  onClear?: () => void;
  onExport?: () => void;
  messageCount?: number;
}

export default function ChatActions({ onClear, onExport, messageCount = 0 }: ChatActionsProps) {
  const handleExport = () => {
    const date = new Date().toLocaleDateString('zh-CN');
    const filename = `AI装修对话_${date}.txt`;

    // 获取所有消息内容
    const messages = document.querySelectorAll('[data-message-content]');
    let content = `AI装修对话记录 - ${date}\n\n`;
    messages.forEach((msg, index) => {
      const text = msg.textContent;
      const role = index % 2 === 0 ? '用户' : 'AI';
      content += `--- ${role} ---\n${text}\n\n`;
    });

    // 创建下载链接
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    onExport?.();
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40">
          共 {messageCount} 条消息
        </span>
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs text-white/70 hover:text-white/90"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>导出</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 transition text-xs text-red-300 hover:text-red-200"
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
