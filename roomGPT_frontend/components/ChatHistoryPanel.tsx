"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { deleteSession, fetchSessions, pinSession } from "../utils/api";
import { SessionSummary } from "../types/chat";

interface ChatHistoryPanelProps {
  isOpen: boolean;
  currentSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onNewChat?: () => void;
}

export default function ChatHistoryPanel({
  isOpen,
  currentSessionId,
  onSelectSession,
  onNewChat,
}: ChatHistoryPanelProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<SessionSummary | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetchSessions().then(setSessions).catch(() => setSessions([]));
  }, [currentSessionId]);

  useEffect(() => {
    if (!actionError) return;
    const timer = window.setTimeout(() => setActionError(""), 2000);
    return () => window.clearTimeout(timer);
  }, [actionError]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    return "刚刚";
  };

  const clampText = (value?: string, fallback = "新对话") => {
    const text = (value || "").trim();
    if (!text) return fallback;
    return text.replace(/\s+/g, " ");
  };

  const getSessionTitle = (session: SessionSummary) => {
    const rawTitle = clampText(session.title, "");
    if (rawTitle && rawTitle !== "新对话") {
      return rawTitle;
    }
    return clampText(session.first_user_message || session.latest_user_message);
  };

  const getSessionSummary = (session: SessionSummary) => {
    const summary = clampText(session.latest_message || session.latest_user_message, "");
    const title = getSessionTitle(session);
    if (!summary || summary === title) {
      return "";
    }
    return summary;
  };

  const reloadSessions = async () => {
    try {
      const next = await fetchSessions();
      setSessions(next);
    } catch {
      setSessions([]);
    }
  };

  const handleTogglePinned = async (session: SessionSummary) => {
    try {
      await pinSession(session.session_id, !Boolean(session.pinned));
      await reloadSessions();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "置顶操作失败");
    } finally {
      setActiveMenuSessionId(null);
    }
  };

  const handleDeleteSession = (session: SessionSummary) => {
    setPendingDeleteSession(session);
    setActiveMenuSessionId(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteSession) return;
    const target = pendingDeleteSession;
    setPendingDeleteSession(null);
    try {
      await deleteSession(target.session_id);
      await reloadSessions();
      if (target.session_id === currentSessionId) {
        onNewChat?.();
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "删除会话失败");
    } finally {
      setPendingDeleteSession(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#fcf9f8] border-r border-[#bdb3a5]/30">
      <div className="p-4 border-b border-[#bdb3a5]/20">
        <h2 className="text-base font-semibold text-[#4e3c30] mb-3 font-display">历史记录</h2>
        <button
          onClick={() => onNewChat?.()}
          className="w-full !bg-[#4e3c30] !text-white px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide hover:bg-[#3d2f26] transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50/85 px-2.5 py-2 text-[11px] text-red-700">
            {actionError}
          </div>
        )}
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2 text-[#9f8370]">📭</div>
            <p className="text-xs text-[#bdb3a5]">暂无历史记录</p>
          </div>
        ) : (
          sessions.map((session, index) => (
            <motion.div
              key={session.session_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`w-full px-3 py-2.5 rounded-xl text-left transition border ${
                session.session_id === currentSessionId
                  ? "bg-white border-[#8B6F47]/30 shadow-soft"
                  : "bg-white/60 hover:bg-white border-[#bdb3a5]/20 hover:border-[#bdb3a5]/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => onSelectSession(session.session_id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-[14px] font-semibold text-[#4e3c30] leading-5 line-clamp-1 font-display">
                    {session.pinned ? "📌 " : ""}
                    {getSessionTitle(session)}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-4 text-[#9f8370] line-clamp-1">
                    {getSessionSummary(session)}
                  </p>
                  <span className="mt-1.5 inline-block text-[11px] text-[#bdb3a5]">
                    {formatDate(session.updated_at)}
                  </span>
                </button>

                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMenuSessionId((prev) =>
                        prev === session.session_id ? null : session.session_id
                      )
                    }
                    className="h-7 w-7 rounded-md hover:bg-[#f2ebe7] text-[#4e3c30]/60 hover:text-[#4e3c30] inline-flex items-center justify-center transition-colors duration-200"
                    title="更多操作"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>

                  {activeMenuSessionId === session.session_id && (
                    <div className="absolute right-0 z-20 mt-1 w-28 rounded-lg border border-[#bdb3a5]/15 bg-white shadow-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleTogglePinned(session)}
                        className="w-full px-3 py-2 text-left text-xs text-[#4e3c30] hover:bg-[#f2ebe7] rounded-t-lg transition-colors duration-200"
                      >
                        {session.pinned ? "取消置顶" : "置顶"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(session)}
                        className="w-full px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50 rounded-b-lg transition-colors duration-200"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {pendingDeleteSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#bdb3a5]/20 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-[#4e3c30] font-display">确认删除</h3>
            <p className="mt-2 text-xs leading-5 text-[#9f8370]">
              确认删除这条历史对话吗？删除后不可恢复。
            </p>
            <p className="mt-1 text-xs text-[#bdb3a5] line-clamp-1">
              {getSessionTitle(pendingDeleteSession)}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteSession(null)}
                className="rounded-lg border border-[#bdb3a5]/30 px-3 py-1.5 text-xs text-[#9f8370] hover:bg-[#f2ebe7] transition-colors duration-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 transition-colors duration-200"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
