"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentStatus as AgentStatusType } from "../types/chat";
import { AGENT_DISPLAY_NAMES, AGENT_ICONS } from "../types/chat";

interface AgentStatusProps {
  agents: AgentStatusType[];
  isCollapsible?: boolean;
}

export default function AgentStatus({ agents, isCollapsible = true }: AgentStatusProps) {
  const [isOpen, setIsOpen] = useState(true);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return 'from-purple-500 to-blue-500';
      case 'completed':
        return 'from-green-500 to-emerald-500';
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

  return (
    <div className="w-full bg-white/5 backdrop-blur-md rounded-2xl mb-4 border border-white/10 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
          <span>🤖</span>
          <span>AI 智能体协作状态</span>
          {processingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs animate-pulse">
              {processingCount} 个处理中
            </span>
          )}
        </h3>

        {isCollapsible && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-white/70 hover:text-white transition-colors p-1"
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
                  className="flex items-center space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition border border-white/10"
                >
                  {/* Agent 图标 */}
                  <div className="text-2xl w-10 h-10 flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg">
                    {AGENT_ICONS[agent.agentName] || '🤖'}
                  </div>

                  {/* Agent 名称和状态 */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white/90">
                        {AGENT_DISPLAY_NAMES[agent.agentName] || agent.agentName}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        agent.status === 'processing'
                          ? 'bg-gradient-to-r ' + getStatusColor(agent.status) + ' text-white animate-pulse'
                          : agent.status === 'completed'
                          ? 'bg-gradient-to-r ' + getStatusColor(agent.status) + ' text-white'
                          : agent.status === 'error'
                          ? 'bg-gradient-to-r ' + getStatusColor(agent.status) + ' text-white'
                          : 'bg-white/10 text-white/50'
                      }`}>
                        {getStatusText(agent.status)}
                      </span>
                    </div>

                    {/* 进度条 */}
                    <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
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
                        className="text-xs text-white/50 mt-1"
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
                className="mt-4 p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl"
              >
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm text-purple-200">AI 正在分析您的请求...</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
