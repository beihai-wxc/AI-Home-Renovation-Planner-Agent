/**
 * 聊天消息类型定义
 */

/**
 * Agent 事件定义 - 用于追踪 agent 行为轨迹
 */
export interface AgentEvent {
  agentName: string;
  status: 'processing' | 'completed' | 'error';
  message?: string;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;       // 如果有生成的效果图
  references?: Array<{
    title: string;
    url: string;
    snippet?: string;
    source?: string;
  }>;
  followUpPrompts?: string[];
  renderJobId?: string;
  renderStatus?: 'pending' | 'completed' | 'failed';
  retryableRender?: boolean;
  attachments?: Array<{
    id: string;
    url: string;
    label: string;
  }>;
  agentName?: string;     // 来自哪个 Agent (如: VisualAssessor, DesignPlanner, ProjectCoordinator)
  timestamp: Date;
  agentTimeline?: AgentEvent[];  // Agent 行为轨迹
}

export interface SessionSummary {
  session_id: string;
  title?: string;
  pinned?: boolean;
  first_user_message?: string;
  latest_user_message?: string;
  latest_message?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Agent 状态定义
 */
export interface AgentStatus {
  agentName: string;
  displayName: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  message?: string;
}

/**
 * Agent 显示名称映射
 */
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  'InfoAgent': '咨询助手',
  'VisualAssessor': '视觉评估',
  'DesignPlanner': '设计规划',
  'ProjectCoordinator': '项目协调',
  'RenderingEditor': '效果编辑',
  'SearchAgent': '搜索助手',
  'HomeRenovationPlanner': '装修顾问',
};

/**
 * Agent 图标映射
 */
export const AGENT_ICONS: Record<string, string> = {
  'InfoAgent': '💬',
  'VisualAssessor': '🔍',
  'DesignPlanner': '📋',
  'ProjectCoordinator': '⚙️',
  'RenderingEditor': '🎨',
  'SearchAgent': '🔎',
  'HomeRenovationPlanner': '🏠',
};
