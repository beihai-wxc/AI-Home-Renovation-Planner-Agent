# 前端流程图 - Lumière AI Home Renovation Planner

## 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js Frontend                        │
│                   (roomGPT_frontend/)                          │
├─────────────────────────────────────────────────────────────────┤
│  Pages:                                                         │
│  • / (HomePage) - 首页介绍                                     │
│  • /dream - 设计页面（主要工作区）                            │
│  • /auth - 用户认证                                            │
│                                                                 │
│  Components:                                                    │
│  • ChatInterface - 主聊天界面                                 │
│  • ChatHistoryPanel - 历史会话侧栏                           │
│  • AgentStatus - 智能体状态追踪                               │
│  • UploadDropZone - 图片上传区域                             │
│  • QuickPrompts - 快速提示词                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS (localhost:3000)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                           │
│                     (server.py:8000)                          │
├─────────────────────────────────────────────────────────────────┤
│  CORS Middleware → Session Management → ADK Runner            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Google ADK Multi-Agent System                 │
│           (agent.py - Coordinator/Dispatcher Pattern)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 前端详细流程

### 1. 用户访问流程

```
[用户打开浏览器]
        │
        ▼
┌──────────────────────────────────────┐
│  访问 http://localhost:3000           │
│  Next.js 首页 (page.tsx)              │
└──────────────────────────────────────┘
        │
        ├─────────────────────────────────────────┐
        │                                         │
        ▼                                         ▼
┌─────────────────────┐              ┌──────────────────────┐
│ 已登录?              │              │ 未登录               │
│ check localStorage   │              │ → /auth              │
└─────────────────────┘              └──────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│  点击"开始设计你的空间"               │
│  → 跳转到 /dream 或 /auth?redirect=/dream
└──────────────────────────────────────┘
```

### 2. Dream 页面双模式流程

```
                      ┌──────────────────────────────┐
│      /dream (DreamPage)      │
└──────────────┬───────────────┘
│
                    ┌────────────────┴────────────────┐
                    │ ChatInterface 内: 模式标签切换    │
                    │  (实际为同一页面内的功能模式)     │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                  │
         ┌───────────▼──────────┐         ┌───────────▼──────────┐
         │  快速生成模式        │         │  聊天模式            │
         │  (Generate Mode)     │         │  (Chat Mode)         │
         │  *局部功能区域*      │         │  *主功能模式*         │
         └───────────┬──────────┘         └───────────┬──────────┘
                     │                              │
         ┌───────────▼──────────┐                 │
         │ 1. 选择风格(theme)    │                 │
         │ 2. 选择房间类型(room) │                 │
         │ 3. 上传房间照片      │                 │
         │    (UploadDropZone)  │                 │
         │                      │                 │
         │ 调用 API:            │                 │
         │ mapLocalRenderImage()│                 │
         │                      │                 │
         │ 显示预生成的渲染图   │                 │
         └──────────────────────┘                 │
                                                 │
                               ┌─────────────────▼─────────────────┐
                               │  左侧: ChatHistoryPanel          │
                               │  中间: ChatInterface             │
                               │  输入区:                          │
                               │    - 文字输入框                   │
                               │    - QuickPrompts (快速提示词)   │
                               │    - QuickScenes (快速场景选择)  │
                               │    - 上传按钮(弹出菜单)           │
                               │      • 上传原图(当前房间)         │
                               │      • 上传灵感图                 │
                               └─────────────────┬─────────────────┘
                                                 │
                                  用户输入文字 + 上传图片
                                                 │
                                                 ▼
                                   ┌─────────────────────────┐
                                   │  sendChatWithImageStream()│
                                   │  (POST /api/chat-with-image/stream)
                                   └─────────────────────────┘
                                                 │
                                                 ▼
                            ┌────────────────────────────────────┐
                            │  后端返回 SSE 流式响应              │
                            │  • Agent状态更新                   │
                            │  • 文本内容分块                    │
                            │  • 参考链接(如有)                  │
                            │  • 渲染任务ID(如有)                │
                            └────────────────────────────────────┘
                                                 │
                                                 ▼
                                   ┌─────────────────────────┐
                                   │ 轮询查询渲染任务状态      │
                                   │ GET /api/render-jobs/{job_id}
                                   └─────────────────────────┘
                                                 │
                                                 ▼
                                   ┌─────────────────────────┐
                                   │ 渲染完成 → 显示结果图    │
                                   │ 渲染中 → 显示加载动画    │
                                   │ 失败 → 显示错误提示      │
                                   └─────────────────────────┘
```

### 3. 聊天交互详细流程 (ChatInterface)

```
[用户操作]
    │
    ├─── 输入文字 ─────────────────────────────────┐
    │                                              │
    ├─── 上传图片 ───────────────────────────────┘
    │        │
    │        ├── 当前房间图 (current_room)
    │        ├── 灵感图 (inspiration)
    │        └── 多张图片支持
    │
    ▼
┌──────────────────────────────┐
│  prepare message payload     │
│  • 文字文本                  │
│  • 图片文件 (multipart/form-data)
│  • session_id, user_id       │
└──────────────────────────────┘
    │
    ▼  POST /api/chat-with-image/stream
┌──────────────────────────────┐
│  FastAPI Server              │
│  1. 验证API密钥              │
│  2. 确保session存在          │
│  3. 保存上传的图片到artifact │
│  4. 调用ADK runner.run_async()│
│  5. 流式返回事件             │
└──────────────────────────────┘
    │
    ▼ SSE 事件流
┌────────────────────────────────────────────────┐
│ Event Types:                                  │
│ • agent: {agentName, status}                  │
│   └─> 更新前端AgentStatus组件                │
│ • content: "思考内容..."                      │
│   └─> 追加到消息显示区域                      │
│ • references: [{title, url, snippet}]        │
│   └─> 显示参考链接                            │
│ • render: {jobId, status}                    │
│   └─> 触发渲染任务轮询                        │
│ • [DONE]                                      │
│   └─> 流结束，保存消息到数据库                 │
└────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  渲染任务后台处理 (async)            │
│  • 创建job记录 (db)                  │
│  • 异步调用ProjectCoordinator        │
│  • 生成效果图                         │
│  • 更新job状态为 completed/failed   │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│  前端轮询 GET /api/render-jobs/{job_id}
│  └─> job.status = pending/running/completed/failed
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  渲染完成                             │
│  • 显示结果图                         │
│  • 提供下载按钮                       │
│  • 可点击查看大图(ImageLightbox)      │
└──────────────────────────────────────┘
```

### 4. 组件交互关系

```
App (layout.tsx)
│
├── Header
│   └── 导航链接: /, /dream, 用户状态
│
├── HomePage (/)
│   ├── LumiereIntro (欢迎动画)
│   ├── PairedCarousel (对比展示)
│   └── AgentShowcase (3个Agent介绍)
│
└── DreamPage (/dream)
    │
    ├── 顶部: Header (DreamPage用)
    │   └── 模式切换按钮: "快速生成" | "AI问答"
    │
    ├── 模式1: Generate (快速生成)
    │   └── 左侧: UploadDropZone + 风格/房间选择
    │       └── handleFileUpload → generatePhotoFromLocal()
    │           └── mapLocalRenderImage() (API调用)
    │   └── 右侧: 结果显示 (Image预览 + 下载按钮)
    │
    └── 模式2: Chat (AI问答) [主交互模式]
        │
        ├── ChatHistoryPanel (左侧可收起/展开)
        │   ├── 会话列表 (fetchSessions)
        │   ├── 新建对话按钮
        │   ├── 会话切换
        │   ├── 置顶/删除会话
        │   └── 推荐提示词 (fetchRecommendedPrompts)
        │
        ├── ChatInterface (主区域)
        │   ├── ChatActions (顶部栏)
        │   │   ├── 消息计数
        │   │   ├── 导出MD (export)
        │   │   └── 清空按钮
        │   │
        │   ├── 消息列表 (滚动区域)
        │   │   ├── ChatMessage (用户消息)
        │   │   │   ├── 文字内容
        │   │   │   ├── 附件图片 (attachments - 用户上传的)
        │   │   │   │   └── ChatMessageActions (复制链接/删除)
        │   │   │   └── 时间戳
        │   │   │
        │   │   ├── ChatMessage (助手消息)
        │   │   │   ├── MarkdownRenderer (渲染文本)
        │   │   │   ├── AgentStatus (Agent执行状态)
        │   │   │   ├── 结果图展示 (imageUrl - 从ADK artifact返回)
        │   │   │   ├── 参考链接列表 (references - Google搜索)
        │   │   │   ├── 后续提示词 (followUpPrompts)
        │   │   │   └── ChatMessageActions (复制/重发)
        │   │   └── 消息底部 (追踪渲染任务)
        │   │
        │   ├── 输入区域
        │   │   ├── 文字输入框 (TextArea)
        │   │   ├── 上传按钮 (点击弹出菜单)
        │   │   │   ├── "上传原图" → current_room
        │   │   │   └── "上传灵感图" → inspiration
        │   │   ├── QuickScenes (房间类型快速选择)
        │   │   ├── QuickPrompts (常用提示词按钮)
        │   │   └── 发送按钮
        │   │
        │   └── 待上传图片预览 (pendingImages)
        │       └── 可移除单个图片
        │
        └── ImageLightbox (图片放大预览 - 独立组件)
```

### 5. 状态管理与数据流

```
LocalStorage:
├── "userId" - 用户ID
├── "sessionId" - 当前会话ID
└── "sidebarOpen" - 侧栏状态

React State (DreamPage):
├── mode: "generate" | "chat"
├── originalPhoto: string (data URL)
├── restoredImage: string (URL)
├── theme: string (风格选择)
├── room: string (房间类型)
└── loading: boolean

React State (ChatInterface):
├── messages: ChatMessage[]
├── input: string
├── pendingImages: PendingImage[]
├── isSending: boolean
├── pendingRenderJobId: string
├── agentStatuses: AgentStatusType[]
└── recommendedPrompts: string[]

数据流方向:
用户操作 → State更新 → API调用 → 后端处理 → SSE/轮询 → State更新 → UI渲染
```

---

## 后端详细流程

### 系统初始化 (Startup)

```
uvicorn server:app --host 0.0.0.0 --port 8000
    │
    ▼
@ app.on_event("startup")
├── 初始化数据库 (init_db from db.py)
│   └── 创建表: sessions, messages, assets, render_jobs
│
├── 创建 ADK 组件
│   ├── InMemorySessionService()
│   ├── FileArtifactService(ARTIFACT_ROOT)
│   │
│   └── 创建两个 Runner
│       ├── runner (root_agent)
│       │   └── 用于用户主流程
│       └── render_runner (project_coordinator)
│           └── 用于后台渲染任务
│
└── 日志: "ADK Runner initialized and ready."
```

### 核心API端点流程

#### 1. 健康检查

```
GET /api/health
    │
    ▼ 返回: {status: "ok", api_key_configured: boolean}
```

#### 2. 会话管理

```
POST /api/sessions
├── 参数: user_id, session_id
├── ensure_session() - 记录到SQLite
└── 返回: {session_id}

GET /api/sessions
├── 查询: list_sessions(user_id)
└── 返回: [{session_id, title, latest_user_message, pinned, created_at, updated_at}]

POST /api/sessions/{session_id}/pin
DELETE /api/sessions/{session_id}

GET /api/sessions/{session_id}/messages
├── 查询: get_messages(session_id, user_id)
├── 构造图片URL: build_asset_url()
└── 返回: [{id, role, content, imageUrl, references, created_at}]
```

#### 3. 聊天API (文本 + 流式)

```
POST /api/chat  (非流式)
├── 验证API密钥
├── ensure_session() - 确保会话存在
├── 创建 ADK session (if not exists)
│
├── 构建消息 (如果无图片)
│   └── build_non_image_guarded_prompt() - 添加约束
│
├── runner.run_async()
│   └── Root Agent 协调分发
│
├── 处理响应
│   ├── extract_reply_text() - 提取所有文本
│   ├── get_result_image_filename() - 获取生成的图片
│   ├── should_include_price_links() - 判断是否需要搜索
│   └── google_cse_search() - 异步搜索材料价格
│
├── 持久化记录 (persist_chat_records)
│   ├── save_message(user)
│   └── save_message(assistant)
│
└── 返回: {message, imageUrl?, references?}

POST /api/chat/stream  (流式SSE)
├── 同上前期处理
│
├── runner.run_async(run_config=StreamingMode.SSE)
│
├── 生成SSE流 (event_stream generator)
│   ├── 循环 events
│   │   ├── iter_agent_updates() → Agent状态变更
│   │   │   └── yield {type: "agent", agentName, status}
│   │   ├── extract_text_from_event()
│   │   │   ├── event.partial=True → 流式chunk
│   │   │   │   └── yield {type: "content", content: chunk}
│   │   │   └── event.partial=False → 最终文本
│   │   └── (循环结束)
│   │
│   ├── 流结束后
│   │   ├── 检查是否需要搜索
│   │   ├── google_cse_search()
│   │   │   └── yield {type: "references", links}
│   │   ├── persist_chat_records()
│   │   └── yield [DONE]
│   │
│   └── 异常处理
│       └── yield {type: "error", message}
│
└── StreamingResponse(media_type="text/event-stream")
```

#### 4. 带图片的聊天API

```
POST /api/chat-with-image  (非流式)
├── 特殊处理: IMAGE_GENERATION_MODE == "local_mock" & QUICK_GENERATE_USER
│   └── resolve_local_render_mapping() - 从本地预生成图库返回
│
├── prepare_message_content()
│   ├── 保存上传的图片 (save_uploaded_asset)
│   │   ├── 读取文件字节
│   │   ├── 生成artifact文件名 (asset_type_uuid.ext)
│   │   ├── 调用 artifact_service.save_artifact()
│   │   └── 记录到 assets 表
│   │
│   └── 构造多模态消息 (types.Content + types.Part)
│       ├── 文本部分
│       ├── 图片部分 (current_room / inspiration)
│       └── 更新 session.state
│           ├── latest_current_room_image
│           ├── latest_inspiration_image
│           └── reference_images[filename] = {type, version}
│
├── runner.run_async() (同上)
├── 查询结果图片
│   └── get_result_image_filename()
│       └── session.state["latest_result_image"]
│
└── 返回: {message, imageUrl, references}

POST /api/chat-with-image/stream  (流式)
├── prepare_message_content() (同上)
│
├── runner.run_async(streaming)
│
├── event_stream generator (逻辑同 /api/chat/stream)
│   └── 重要: 图片上传时触发渲染任务
│       └── 如果有上传图片
│           ├── queue_render_job()
│           │   ├── 创建 render_job 记录 (status="pending")
│           │   └── asyncio.create_task(process_render_job())
│           │
│           └── yield {type: "render", jobId, status: "pending"}
│
└── StreamingResponse
```

#### 5. 渲染任务管理

```
POST /api/sessions/{session_id}/render
├── ensure_session()
├── queue_render_job()
│   ├── uuid.uuid4().hex → job_id
│   ├── create_render_job() - 写入数据库
│   └── asyncio.create_task(process_render_job())
│
└── 返回: {job_id, status: "pending"}

GET /api/render-jobs/{job_id}
├── get_render_job(job_id, user_id)
└── 返回: {job_id, status, imageUrl?, message?, retryable}
    └── status 值: pending | running | completed | failed

后台任务: process_render_job()
├── update_render_job(status="running")
├── session.state["background_render_job"] = job_id
│
├── 构建提示词
│   └── "根据当前会话里的空间分析和设计方案，直接生成效果图"
│
├── render_runner.run_async()
│   └── ProjectCoordinator Agent
│       └── 调用 generate_renovation_rendering 工具
│           └── 调用图像生成API (如Imagen/DALL-E)
│               └── 保存 artifact
│
├── 查询结果
│   └── get_result_image_filename()
│       └── session.state["last_generated_rendering"]
│
├── 更新结果
│   ├── completed → update_render_job(result_filename=xxx)
│   │   └── save_message(assistant, image_filename=xxx)
│   └── failed → update_render_job(error_message)
│
└── 异常处理: update_render_job(status="failed")
```

#### 6. 图片与文件服务

```
GET /api/sessions/{session_id}/assets/{filename}
├── artifact_service.load_artifact()
│   └── 从 .adk/artifacts/ 读取
└── Response(content, media_type)

GET /api/local-files/{kind}/{filename}
├── resolve_local_image_dirs()
│   └── 查找: roomGPT_frontend/public/local-images/{original|rendered}
├── find_existing_file_by_name()
└── FileResponse(str(file_path), media_type)

POST /api/search/google-links (可选功能)
├── google_cse_search()
└── 返回: [{title, url, snippet, source}]
```

---

### 多智能体协作流程 (ADK)

```
┌──────────────────────────────────────────────────────────┐
│              Root Agent (HomeRenovationPlanner)          │
│                   协调者 / 分发者                         │
├──────────────────────────────────────────────────────────┤
│  Routing Logic:                                          │
│  1. 一般问题/问候 → InfoAgent                            │
│  2. 编辑现有效果图 → RenderingEditor                     │
│  3. 新的装修规划 → PlanningPipeline                     │
│     (带有图片上传时总是路由到PlanningPipeline)          │
└───────────────┬────────────────┬─────────────────────────┘
                │                │
     ┌──────────▼──────┐ ┌──────▼────────────┐
     │   InfoAgent     │ │ RenderingEditor   │
     │  快速问答助手    │ │ 效果图编辑         │
     ├─────────────────┤ ├───────────────────┤
     │ Respond in 2-4  │ │ 使用编辑工具      │
     │ sentences       │ │ edit_renovation_  │
     │ 中文回复         │ │ rendering()       │
     └─────────────────┘ └───────────────────┘
                                     │
     ┌──────────────────────────────┘
     │
     ▼ 新装修规划
┌────────────────────────────────────────────┐
│     PlanningPipeline (SequentialAgent)     │
│          顺序执行流水线                      │
├────────────────────────────────────────────┤
│  1. VisualAssessor (视觉评估师)            │
│     • 分析房间照片                         │
│     • 提取灵感图风格                       │
│     • 检测布局、尺寸、问题点               │
│     • 记录: room_analysis, layout, etc.   │
│     • 输出: "分析完成" + 结构化摘要         │
│                                            │
│   ↓ transfer_to_agent                      │
│                                            │
│  2. DesignPlanner (设计规划师)             │
│     • 读取: room_analysis, budget, style  │
│     • 制定设计方案 (只改表面,不动格局)     │
│     • 材料清单、配色、预算拆分             │
│     • 使用工具: estimate_renovation_cost  │
│     • 输出: "设计完成" + 结构化摘要         │
│                                            │
│   ↓ transfer_to_agent                      │
│                                            │
│  3. ProjectCoordinator (项目协调员)        │
│     • 提取前两步结果                       │
│     • 生成超详细提示词 (SLC公式)           │
│     • 调用: generate_renovation_rendering  │
│     • 输出: 2-3句中文总结 + 效果图artifact  │
│                                            │
│   → 整个Pipeline返回最终响应给用户         │
└────────────────────────────────────────────┘
```

### 会话状态 (Session State) 管理

```
session.state 键值对:
├── latest_current_room_image: "current_room_xxx.png"
├── latest_inspiration_image: "inspiration_xxx.png"
├── latest_result_image: "kitchen_modern_renovation_v1.png"
├── last_generated_rendering: "xxx.png"
├── room_analysis: {...}           (来自 VisualAssessor)
├── style_preferences: "..."       (来自 VisualAssessor)
├── design_plan: {...}             (来自 DesignPlanner)
├── background_render_job: "job_id_xxx"
└── reference_images: {
    "filename1.png": {type: "current_room", version: 0},
    "filename2.png": {type: "inspiration", version: 0},
  }
```

---

### 数据库表结构

```sql
-- 会话表
sessions (
  id INTEGER PRIMARY KEY,
  session_id TEXT UNIQUE,
  user_id TEXT,
  title TEXT,
  pinned BOOLEAN DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- 消息表
messages (
  id INTEGER PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  role TEXT ('user' | 'assistant'),
  content TEXT,
  image_filename TEXT,  -- 关联 artifacts
  created_at TIMESTAMP
)

-- 资源文件表
assets (
  id INTEGER PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  filename TEXT,
  asset_type TEXT ('current_room' | 'inspiration'),
  version INTEGER,
  metadata JSON,
  created_at TIMESTAMP
)

-- 渲染任务表
render_jobs (
  job_id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT,
  request_message TEXT,
  status TEXT ('pending' | 'running' | 'completed' | 'failed'),
  result_filename TEXT,
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## 关键设计亮点

### 1. 前后端分离架构
- 前端: Next.js (SSR + 静态生成)
- 后端: FastAPI (异步高性能)
- 通信: REST API + SSE 流式协议

### 2. 智能体协作模式
- Coordinator/Dispatcher + Sequential Pipeline
- 职责清晰，易于扩展
- 状态通过 session.state 传递

### 3. 图片处理流程
- 上传 → Artifact存储 → ADK多模态消息 → Agent分析 → 生成结果 → 文件服务

### 4. 流式响应体验
- Server-Sent Events 实时展示Agent思考过程
- Agent状态实时更新 (AgentStatus组件)
- 部分生成体验优化

### 5. 异步渲染任务
- 快速返回文字响应
- 后台生成图片
- 轮询查询 + UI状态更新

### 6. 本地预生成库 (local_mock模式)
- 用于演示/测试环境
- 根据文件名映射预生成图
- 路径: roomGPT_frontend/public/local-images/

---

## 技术栈

### 前端
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **动画**: Framer Motion
- **状态管理**: React useState + useEffect
- **HTTP**: fetch API + ReadableStream (SSE)
- **图标**: SVG + Next.js Image

### 后端
- **框架**: FastAPI
- **AI平台**: Google ADK (Agent Development Kit)
- **模型**: Gemini 3 Flash Preview
- **数据库**: SQLite (viadb.py)
- **文件存储**: 本地文件系统 (.adk/artifacts/)
- **搜索**: Google Custom Search API (可选)
- **异步**: asyncio + uvicorn

---

## 配置文件

### 环境变量 (.env)
```bash
GOOGLE_API_KEY=xxx     # 或 GEMINI_API_KEY
IMAGE_GENERATION_MODE=local_mock|api_call
FRONTEND_PUBLIC_ROOT=./roomGPT_frontend
LOCAL_ORIGINAL_DIR=./roomGPT_frontend/public/local-images/original
LOCAL_RENDERED_DIR=./roomGPT_frontend/public/local-images/rendered
GOOGLE_CSE_API_KEY=xxx  # 可选，搜索功能
GOOGLE_CSE_CX=xxx       # 可选
FRONTEND_ORIGINS=http://localhost:3000
```

---

## 启动流程

```bash
# 1. 后端
cd /project/root
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8000
# 服务: http://localhost:8000

# 2. 前端
cd roomGPT_frontend
npm install
npm run dev
# 服务: http://localhost:3000
```

---

## 注意事项

1. **API密钥必需**: 后端启动需配置 GOOGLE_API_KEY 或 GEMINI_API_KEY
2. **本地图片命名规范**: 预生成图需按 B1/A1 命名规则
3. **多模态支持**: ADK当前版本对图片编辑功能有限制(仅Web)
4. **会话状态**: InMemorySessionService (重启丢失)，生产需用持久化SessionService
5. **文件清理**: .adk/artifacts/ 会累积，需定期清理
6. **CORS配置**: 仅允许配置的 origin，生产需调整
7. **错误处理**: 流式API有异常捕获，但需监控日志
