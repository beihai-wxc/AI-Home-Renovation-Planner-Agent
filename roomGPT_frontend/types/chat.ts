/**
 * 聊天消息类型定义
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;       // 如果有生成的效果图
  agentName?: string;     // 来自哪个 Agent (如: VisualAssessor, DesignPlanner, ProjectCoordinator)
  timestamp: Date;
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
