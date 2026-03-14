# AI 装修问答界面开发计划

## 一、需求概述

在现有的「装修/梦想」页面 (`/dream`) 添加一个 **AI 问答界面**，要求：
1. 与后端 FastAPI 的 `/api/chat` 和 `/api/chat-with-image` 接口对接
2. 支持文本对话和图片上传
3. 体现多 Agent 协作过程（如：视觉评估 → 设计规划 → 项目协调）
4. 展示 Agent 处理状态和最终回复

## 二、技术架构

### 后端（已存在，无需修改）
- `server.py` - FastAPI 服务器
- `agent.py` - 多 Agent 逻辑

### 现有 API 接口
| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/chat` | POST | 纯文本对话 |
| `/api/chat-with-image` | POST | 带图片的对话 |

## 三、前端开发文件清单

### 1. 类型定义
**文件:** `roomGPT_frontend/types/chat.ts`

- `ChatMessage` - 聊天消息类型
- `AgentStatus` - Agent 状态类型
- `AGENT_DISPLAY_NAMES` - Agent 显示名称映射
- `AGENT_ICONS` - Agent 图标映射

### 2. API 调用工具
**文件:** `roomGPT_frontend/utils/api.ts`

- `sendChatMessage()` - 发送纯文本消息
- `sendChatWithImage()` - 发送带图片的消息
- `checkBackendHealth()` - 检查后端健康状态

### 3. Agent 状态组件
**文件:** `roomGPT_frontend/components/AgentStatus.tsx`

- 显示当前活跃的 Agent 列表
- 每个 Agent 的处理状态（待命、处理中、已完成、错误）
- 动画过渡效果

### 4. 聊天界面组件
**文件:** `roomGPT_frontend/components/ChatInterface.tsx`

- 聊天消息列表展示
- 输入框（支持多行文本）
- 图片上传按钮
- 发送按钮
- Agent 状态指示器集成
- 图片类型选择（当前房间 / 灵感图片）

### 5. 梦想页面集成
**文件:** `roomGPT_frontend/app/dream/page.tsx`

- 添加「快速生成」和「AI 问答」模式切换
- 根据模式渲染不同的内容
- 保留原有的图片生成功能

## 四、数据结构

### 聊天消息
```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;      // 如果有生成的效果图
  agentName?: string;    // 来自哪个 Agent
  timestamp: Date;
}
```

### Agent 状态
```typescript
interface AgentStatus {
  agentName: string;
  displayName: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  message?: string;
}
```

## 五、多 Agent 展示方案

### 状态栏显示
在聊天界面上方显示 Agent 状态条，显示每个 Agent 的处理进度。

### 消息标签
在 AI 回复消息旁显示来源 Agent 标签和图标。

## 六、API 调用示例

### 纯文本对话
```typescript
POST /api/chat
{
  "message": "我想装修厨房",
  "user_id": "frontend_user",
  "session_id": "main_session"
}
```

### 带图片对话
```typescript
POST /api/chat-with-image
FormData:
  - message: "帮我改造这个厨房"
  - image: [File]
  - image_type: "current_room"
  - user_id: "frontend_user"
  - session_id: "main_session"
```

## 七、Agent 名称映射

| Agent 名称 | 显示名称 | 图标 |
|-----------|---------|------|
| InfoAgent | 咨询助手 | 💬 |
| VisualAssessor | 视觉评估 | 🔍 |
| DesignPlanner | 设计规划 | 📋 |
| ProjectCoordinator | 项目协调 | ⚙️ |
| RenderingEditor | 效果编辑 | 🎨 |
| SearchAgent | 搜索助手 | 🔎 |
| HomeRenovationPlanner | 装修顾问 | 🏠 |

## 八、使用说明

### 运行后端
```bash
cd "d:/github_program/AI Home Renovation Planner Agent"
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

### 运行前端
```bash
cd "d:/github_program/AI Home Renovation Planner Agent/roomGPT_frontend"
npm install  # 首次运行
npm run dev
```

### 访问
- 前端地址: http://localhost:3000
- 梦想页面: http://localhost:3000/dream

## 九、开发完成状态

- [x] 创建类型定义文件 `types/chat.ts`
- [x] 创建 API 调用工具 `utils/api.ts`
- [x] 创建 `AgentStatus` 组件
- [x] 创建 `ChatInterface` 组件
- [x] 修改 `dream/page.tsx` 集成聊天界面
- [x] 创建开发文档 `CHAT_FEATURE_PLAN.md`

## 十、后续优化建议

1. **后端增强**
   - 在 Agent 响应中添加 `agentName` 字段，让前端能准确识别消息来源
   - 添加 WebSocket 支持，实现实时推送 Agent 状态更新

2. **前端优化**
   - 添加聊天历史持久化（localStorage）
   - 添加消息重发功能
   - 优化移动端适配

3. **用户体验**
   - 添加快捷问题推荐
   - 添加常用指令按钮
   - 添加 Markdown 支持（格式化 AI 回复）
