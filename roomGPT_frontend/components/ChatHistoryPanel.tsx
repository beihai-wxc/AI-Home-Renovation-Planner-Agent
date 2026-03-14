"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "../types/chat";
import { AGENT_DISPLAY_NAMES } from "../types/chat";

interface ChatHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadHistory: (history: ChatMessage[]) => void;
}

// 模拟历史记录数据
const mockHistory: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "我想把厨房改造成现代简约风格",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: "2",
    role: "assistant",
    content: "好的，现代简约风格的厨房设计注重功能性和极简美学。建议您：1. 使用纯色橱柜（白色或浅灰色）2. 石英或大理石台面 3. 集成嵌入式电器保持整洁",
    timestamp: new Date(Date.now() - 3590000),
    agentName: "InfoAgent",
  },
  {
    id: "3",
    role: "user",
    content: "预算大概多少？",
    timestamp: new Date(Date.now() - 3580000),
  },
  {
    id: "4",
    role: "assistant",
    content: "根据现代简约厨房的装修，预算范围大约为：\n\n基础档：¥15,000 - 25,000\n中档：¥25,000 - 40,000\n高档：¥40,000 - 80,000\n\n具体费用取决于：\n- 橱柜材质（颗粒板 vs 实木）\n- 台面选择（石英石 vs 大理石）\n- 电器品牌\n- 水电改造程度",
    timestamp: new Date(Date.now() - 3570000),
    agentName: "InfoAgent",
  },
  {
    id: "5",
    role: "user",
    content: "客厅要北欧风，预算5万以内",
    timestamp: new Date(Date.now() - 1800000),
  },
  {
    id: "6",
    role: "assistant",
    content: "北欧风格的客厅设计以简洁、自然、舒适为核心。5万预算可以做以下改造：\n\n墙面：\n- 浅灰色或米白色乳胶漆（约 ¥3000）\n\n地面：\n- 浅色实木地板或优质复合地板（约 ¥8000）\n\n软装：\n- 布艺沙发 ¥6000-8000\n- 简约茶几 ¥1500-2000\n- 北欧风格地毯 ¥1000-1500\n\n灯光：\n- 简约吸顶灯 ¥500-800\n- 增加落地灯 ¥800-1200\n\n装饰：\n- 绿植 ¥500-1000\n- 装饰画 ¥2000-3000\n\n总计约 ¥45,000-50,000，可根据具体选择调整。",
    timestamp: new Date(Date.now() - 1790000),
    agentName: "DesignPlanner",
  },
];

export default function ChatHistoryPanel({ isOpen, onClose, onLoadHistory }: ChatHistoryPanelProps) {
  const [history, setHistory] = useState<ChatMessage[]>(mockHistory);

  // 模拟保存新消息到历史记录
  const saveToHistory = (message: ChatMessage) => {
    setHistory(prev => [message, ...prev]);
    // 在实际应用中，这里会保存到 localStorage 或数据库
    if (onLoadHistory) {
      onLoadHistory([message, ...history]);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}天前`;
    } else if (hours > 0) {
      return `${hours}小时前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return "刚刚";
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 遮罩层 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* 侧栏 */}
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-80 bg-gradient-to-b from-[#0f0c29] to-[#302b63] border-r border-white/10 z-50 flex flex-col"
            >
              {/* 头部 */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">💬 历史记录</h2>
                  <button
                    onClick={onClose}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12M18 6l-12-12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 历史列表 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {history.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3 text-white/30">📭</div>
                    <p className="text-white/50">暂无历史记录</p>
                  </div>
                ) : (
                  history.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition border border-white/10"
                    >
                      <div className="flex items-start space-x-2">
                        {message.role === "user" ? (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm">
                            你
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white text-sm">
                            AI
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/90 line-clamp-2 mb-1">
                            {message.content}
                          </p>
                          <div className="flex items-center justify-between text-xs text-white/40">
                            {message.agentName && (
                              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200">
                                {AGENT_DISPLAY_NAMES[message.agentName] || message.agentName}
                              </span>
                            )}
                            <span>{formatDate(message.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* 底部操作 */}
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={clearHistory}
                  className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition text-sm font-medium"
                >
                  清空历史记录
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
