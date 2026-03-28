"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentStatus as AgentStatusType } from "../types/chat";
import { AGENT_DISPLAY_NAMES, AGENT_ICONS } from "../types/chat";

interface AgentStatusProps {
  agents: AgentStatusType[];
  isCollapsible?: boolean;
  compact?: boolean;
  title?: string;
}

export default function AgentStatus({
  agents,
  isCollapsible = true,
  compact = false,
  title = "AI 智能体协作状态",
}: AgentStatusProps) {
  const [isOpen, setIsOpen] = useState(true);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'from-[#D4A652] to-[#8B6F47]';
      case 'completed':
        return 'from-[#7A9E7E] to-[#5B8A72]';
      case 'error':
        return 'from-red-500 to-orange-500';
      default:
        return 'from-gray-600 to-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processing':
        return '处理中...';
      case 'completed':
        return '已完成';
      case 'error':
        return '错误';
      default:
        return '待命';
    }
  };

  const processingCount = agents.filter(a => a.status === 'processing').length;

  if (compact) {
    return (
      <div className="mb-3 rounded-2xl border border-[#8B6F47]/15 bg-[#FBF8F2] px-3 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8B6F47]">
              {title}
            </span>
          </div>
          {processingCount > 0 && (
            <span className="rounded-full bg-[#8B6F47] px-2 py-0.5 text-[10px] text-white">
              {processingCount} 个进行中
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.agentName}
              className={`rounded-xl border px-3 py-2 transition ${
                agent.status === "processing"
                  ? "border-[#8B6F47]/35 bg-white shadow-sm"
                  : agent.status === "completed"
                  ? "border-[#7A9E7E]/25 bg-[#F8FCF8]"
                  : agent.status === "error"
                  ? "border-red-300 bg-red-50"
                  : "border-[#E6DDD0] bg-white/75"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{AGENT_ICONS[agent.agentName] || "🤖"}</span>
                <span className="text-xs font-medium text-[#2D2D2D]">
                  {AGENT_DISPLAY_NAMES[agent.agentName] || agent.agentName}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`text-[11px] ${
                  agent.status === "processing"
                    ? "text-[#8B6F47]"
                    : agent.status === "completed"
                    ? "text-[#5B8A72]"
                    : agent.status === "error"
                    ? "text-red-600"
                    : "text-[#8A8A8A]"
                }`}>
                  {getStatusText(agent.status)}
                </span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E9E2D8]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: agent.status === "idle" ? "0%" : "100%",
                    }}
                    transition={{ duration: agent.status === "processing" ? 2 : 0.4 }}
                    className={`h-full bg-gradient-to-r ${getStatusColor(agent.status)}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-surface-2 rounded-2xl mb-4 border border-secondary/15 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-accent mb-3 flex items-center gap-2">
          <span>🤖</span>
          <span>AI 智能体协作状态</span>
          {processingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-accent/90 text-accent text-xs animate-pulse">
              {processingCount} 个处理中
            </span>
          )}
        </h3>

        {isCollapsible && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[#8A8A8A] hover:text-[#5A5A5A] transition-colors p-1"
          >
            <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7m0 0l7 7m-7 0v11m0 0l7-7" />
              </svg>
            </motion.div>
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="space-y-3">
              {agents.map((agent, index) => (
                <motion.div
                  key={agent.agentName}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center space-x-3 p-3 rounded-lg bg-white/70 hover:bg-white transition border border-secondary/15"
                >
                  {/* Agent 图标 */}
                  <div className="text-2xl w-10 h-10 flex items-center justify-center bg-gradient-to-br from-[#D4A652]/20 to-[#8B6F47]/20 rounded-lg">
                    {AGENT_ICONS[agent.agentName] || '🤖'}
                  </div>

                  {/* Agent 名称和状态 */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#2D2D2D]">
                        {AGENT_DISPLAY_NAMES[agent.agentName] || agent.agentName}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        agent.status === 'processing'
                          ? 'bg-gradient-to-r ' + getStatusColor(agent.status) + ' text-white animate-pulse'
                          : agent.status === 'completed'
                          ? 'bg-gradient-to-r ' + getStatusColor(agent.status) + ' text-white'
                          : agent.status === 'error'
                          ? 'bg-gradient-to-r ' + getStatusColor(agent.status) + ' text-white'
                          : 'bg-[#F1ECE4] text-[#7A7368]'
                      }`}>
                        {getStatusText(agent.status)}
                      </span>
                    </div>

                    {/* 进度条 */}
                    <div className="mt-2 h-1.5 bg-[#E9E2D8] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: agent.status === 'processing' ? '100%' : agent.status === 'completed' ? '100%' : '0%',
                        }}
                        transition={{ duration: agent.status === 'processing' ? 2 : 0.5 }}
                        className={`h-full bg-gradient-to-r ${getStatusColor(agent.status)}`}
                      />
                      </div>

                    {/* 状态消息 */}
                    {agent.message && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="text-xs text-[#6B6459] mt-1"
                      >
                        {agent.message}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* 处理中状态提示 */}
            {agents.some(a => a.status === 'processing') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-accent/8 border border-accent/20 rounded-lg"
              >
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-[#D4A652] to-[#8B6F47] rounded-full animate-pulse" />
                  <span className="text-sm text-[#5A5A5A]">AI 正在分析您的请求...</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
