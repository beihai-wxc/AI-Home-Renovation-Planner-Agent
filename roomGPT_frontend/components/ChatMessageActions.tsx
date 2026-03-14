"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface ChatMessageActionsProps {
  content: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
}

export default function ChatMessageActions({ content, onCopy, onRegenerate }: ChatMessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = () => {
    setLiked(true);
    setDisliked(false);
  };

  const handleDislike = () => {
    setDisliked(true);
    setLiked(false);
  };

  return (
    <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleCopy}
        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
        title="复制"
      >
        <svg className={`w-4 h-4 ${copied ? 'text-green-400' : 'text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {copied ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          )}
        </svg>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleLike}
        className={`p-1.5 rounded-lg border transition ${
          liked ? 'bg-green-500/20 border-green-500/30' : 'bg-white/5 hover:bg-white/10 border-white/10'
        }`}
        title="点赞"
      >
        <svg className={`w-4 h-4 ${liked ? 'text-green-400' : 'text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115 26H5a2 2 0 01-2-2v-4a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 002 2h2a2 2 0 002-2v-4a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 002 2h2a2 2 0 002-2v-4a2 2 0 01-2-2H7a2 2 0 01-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 01-2-2h-2a2 2 0 01-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-4a2 2 0 01-2-2H7a2 2 0 01-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 01-2-2H4z" />
        </svg>
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleDislike}
        className={`p-1.5 rounded-lg border transition ${
          disliked ? 'bg-red-500/20 border-red-500/30' : 'bg-white/5 hover:bg-white/10 border-white/10'
        }`}
        title="反馈"
      >
        <svg className={`w-4 h-4 ${disliked ? 'text-red-400' : 'text-white/60'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.936 2h3.108a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115 26h8a2 2 0 002-2v-4a2 2 0 00-2-2h-2a2 2 0 00-2-2v-2a2 2 0 00-2-2h-2a2 2 0 00-2-2v2a2 2 0 002 2h2a2 2 0 002-2v-4a2 2 0 00-2-2h-2a2 2 0 00-2-2v2a2 2 0 002 2h2a2 2 0 002-2v-4a2 2 0 00-2-2h-2a2 2 0 00-2-2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H4z" />
        </svg>
      </motion.button>

      {onRegenerate && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onRegenerate}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
          title="重新生成"
        >
          <svg className="w-4 h-4 text-white/60 hover:text-white/90 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </motion.button>
      )}
    </div>
  );
}
