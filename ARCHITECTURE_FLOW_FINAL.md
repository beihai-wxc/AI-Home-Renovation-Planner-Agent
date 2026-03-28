# Lumière AI Home Renovation Planner - 系统架构流程图

**版本**: v1.0 Final (基于代码验证)
**生成日期**: 2025-03-27
**代码提交**: 98e6598

---

## 一、整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                       │
│                  http://localhost:3000                          │
├─────────────────────────────────────────────────────────────────┤
│  Pages:                                                         │
│  • / (HomePage) - 首页介绍                                     │
│  • /dream - 主工作区（双模式）                                │
│  • /auth - 用户认证                                            │
│                                                                 │
│  Components:                                                    │
│  • ChatInterface - 聊天主界面                                 │
│  • ChatHistoryPanel - 会话历史侧栏                           │
│  • ChatActions - 顶部操作栏（导出/清空）                      │
│  • AgentStatus - Agent执行状态追踪                            │
│  • UploadDropZone - 快速生成模式的图片上传                   │
│  • QuickPrompts / QuickScenes - 快速输入辅助                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST + SSE
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Backend (FastAPI 8000)                          │
│         server.py - API + ADK Integration                      │
├─────────────────────────────────────────────────────────────────┤
│  Middleware: CORS                                              │
│  Services:                                                     │
│  • InMemorySessionService                                     │
│  • FileArtifactService (/.adk/artifacts/)                     │
│  • SQLite Database (.adk/planner.db)                          │
│                                                                 │
│  Runners:                                                      │
│  • runner → root_agent (主流程)                               │
│  • render_runner → project_coordinator (后台渲染)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           Google ADK Multi-Agent System (agent.py)            │
│              Coordinator/Dispatcher + Pipeline                 │
├─────────────────────────────────────────────────────────────────┤
│  Root Agent (HomeRenovationPlanner)                            │
│  ├── InfoAgent - 快速问答                                      │
│  ├── RenderingEditor - 编辑效果图                             │
│  └── PlanningPipeline (Sequential)                            │
│      ├── VisualAssessor - 视觉分析                            │
│      ├── DesignPlanner - 设计方案                             │
│      └── ProjectCoordinator - 生成渲染                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、前端详细流程

### 2.1 用户访问与认证流程

```
[用户访问 http://localhost:3000]
        │
        ▼
┌────────────────────┐
│  Next.js HomePage  │
│  (page.tsx)        │
└────────────────────┘
        │
        ├── check localStorage userId
        │
        ├── 已登录 → 显示"开始设计你的空间"
        │       │
        │       └─→ 点击 → /dream
        │
        └── 未登录 → 跳转 /auth?redirect=/dream
```

### 2.2 DreamPage 双模式设计

**State**: `mode: "generate" | "chat"` (默认 "generate")

```
┌────────────────────────────────────────┐
│      /dream (DreamPage)                │
│  顶部 Header 含模式切换按钮            │
└────────┬───────────────┬───────────────┘
         │               │
    ┌────▼─────┐ ┌──────▼─────┐
    │ 快速生成  │ │   AI问答   │
    │ (Generate)│ │  (Chat)    │
    │           │ │            │
    │ 主功能区: │ │ 主功能区:   │
    │ • 风格选择│ │ 左侧侧栏   │
    │ • 房间类型│ │   - 会话列表│
    │ • Upload  │ │   - 新建对话│
    │   DropZone│ │   - 推荐词 │
    │ • 点击上传│ │            │
    │   → 本地  │ │ 主聊天区   │
    │   图片    │ │  - Chat   │
    │   映射    │ │    Interface│
    │           │ │  - 历史消息│
    │ 右侧:     │ │  - Agent  │
    │ 结果展示  │ │    Status │
    │ (Image    │ │  - 输入区 │
    │ 预览+下载)│ │    + Quick-│
    │           │ │    Prompts│
    └──────────┘ └───────────┘
```

**DreamPage 模式详情**:

#### Generate 模式 (本地预生成图演示)
```
用户操作:
1. 选择风格 (theme): "Modern", "Minimalist", "Scandinavian"
2. 选择房间类型 (room): "Living Room", "Kitchen", "Bedroom", "Bathroom"
3. 点击上传区域 → 选择图片 → URL.createObjectURL()
4. 自动调用 → mapLocalRenderImage(file.name, theme)

API: POST /api/local-render-map
  • original_filename: 文件名
  • style: 风格
  → 返回: {imageUrl, originalImageUrl?, message?, mode}

前端显示:
• setOriginalPhoto() - 原图
• setRestoredImage() - 预生成渲染图
• 提供下载按钮 (downloadPhoto())
```

#### Chat 模式 (主交互模式)
```
布局结构:
┌─────────────────────────────────────────────────────┐
│ ChatActions (导出MD | 消息计数 | 清空)                │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│ ChatHistory  │         ChatInterface               │
│ Panel        │   ┌──────────────────────────────┐  │
│              │   │ 消息列表 (滚动)               │  │
│ • 会话列表   │   │  • 用户消息                   │  │
│ • 置顶/删除  │   │    - 文字 + attachments       │  │
│ • 推荐提示词 │   │    - ChatMessageActions       │  │
│              │   │  • 助手消息                   │  │
│              │   │    - MarkdownRenderer        │  │
│              │   │    - AgentStatus             │  │
│              │   │    - 结果图                   │  │
│              │   │    - 参考链接                 │  │
│              │   │    - 后续提示词               │  │
│              │   │    - ChatMessageActions       │  │
│              │   └──────────────────────────────┘  │
│              │   ┌──────────────────────────────┐  │
│              │   │ 输入区                       │  │
│              │   │  • TextArea                  │  │
│              │   │  • 上传按钮 (弹出菜单)        │  │
│              │   │    - 上传原图 (current_room) │  │
│              │   │    - 上传灵感图 (inspiration)│  │
│              │   │  • QuickScenes              │  │
│              │   │  • QuickPrompts             │  │
│              │   │  • 发送按钮                  │  │
│              │   └──────────────────────────────┘  │
└──────────────┴──────────────────────────────────────┘
```

**上传按钮交互细节**:
```typescript
// ChatInterface.tsx:831-870
const [showUploadMenu, setShowUploadMenu] = useState(false);
const [pendingUploadKind, setPendingUploadKind] = useState<"current_room" | "inspiration">("current_room");

流程:
1. 点击右侧"相机图标"按钮
2. setShowUploadMenu(!prev)
3. 弹出一个绝对定位的菜单 (bottom-[64px] right-0)
4. 菜单项:
   • "上传原图" (label: "房间照片")
     → setPendingUploadKind("current_room")
     → trigger hidden file input
   • "上传灵感图" (label: "灵感参考")
     → setPendingUploadKind("inspiration")
     → trigger hidden file input
5. 文件选择后:
   • appendSelectedImages() → 创建 PendingImage[]
   • 预览缩略图显示在输入区下方 pendingImages
   • 可点击 × 移除单张
```

### 2.3 消息发送与流式响应流程

```
用户操作:
1. 输入文字 (input state)
2. 选择上传图片 (可选，multiple)
   • current_room (当前房间)
   • inspiration (灵感参考)
3. 点击"发送"按钮
   │
   ▼ handleSendMessage()
   │
   ├── 构建用户消息
   │   • id: Date.now()
   │   • role: "user"
   │   • content: trimmed input
   │   • attachments: [{id, url, label, kind}]
   │
   ├── 创建助手临时消息
   │   • id: temp
   │   • role: "assistant"
   │   • content: "" (空，逐步填充)
   │   • agentName: 根据是否上传图片
   │     - 有图片 → "ProjectCoordinator"
   │     - 无图片 → "InfoAgent"
   │
   ├── 清空输入 & 置 isSending = true
   │
   └── 选择API调用分支
       │
       ├── pendingImages.length > 0
       │   └── sendChatWithImageStream()
       │       • FormData: message + images + session_id
       │       • POST /api/chat-with-image/stream
       │       • 使用 ParseSSE() 解析流
       │
       └── 无图片
           └── sendChatMessageStream()
               • JSON body: {message, user_id, session_id}
               • POST /api/chat/stream
               • ParseSSE() 解析

SSE 事件处理 (ParseSSE + onChunk callback):

事件类型:
1. {type: "agent", agentName, status}
   → updateAgentStatus(agentName, status)
   → setAgentStatuses()
   → 更新 AgentStatus 组件

2. {type: "content", content: "text chunk"}
   → accumulatedContent += content
   → updateMessage({content: accumulatedContent})
   → 实时逐字更新助手消息

3. {type: "references", links: [{title, url, snippet, source}]}
   → updateReferences(links)
   → 在消息底部显示参考链接卡片

4. {type: "render", jobId, status: "pending"}
   → 仅在有图片上传时触发
   → setPendingRenderJobId(jobId)
   → 启动轮询 useEffect()

5. {type: "error", message}
   → handleError() - 恢复输入框，显示错误Toast

6. [DONE]
   → handleComplete()
   → 生成 followUpPrompts
   → setIsSending(false)
   → clearSelectedImages()
   → showToast("回复已生成")
```

### 2.4 渲染任务轮询机制

```
触发条件: setPendingRenderJobId(jobId) !== null

useEffect(() => {
  if (!pendingRenderJobId) return;

  const poll = setInterval(async () => {
    try {
      const job = await fetchRenderJob(pendingRenderJobId);
      // GET /api/render-jobs/{job_id}

      switch (job.status) {
        case "completed":
          setPendingRenderJobId(null);
          setMessages(prev => prev.map(msg =>
            msg.renderJobId === jobId
              ? {...msg, renderStatus: "completed", imageUrl: job.imageUrl}
              : msg
          ));
          break;

        case "failed":
          setPendingRenderJobId(null);
          setMessages(prev => prev.map(msg =>
            msg.renderJobId === jobId
              ? {...msg, renderStatus: "failed"}
              : msg
          ));
          showToast("渲染失败", "error");
          break;

        case "running":
        case "pending":
          // 继续轮询
          break;
      }
    } catch (err) {
      // 网络错误，继续尝试
    }
  }, 3000); // ⚡ 轮询间隔: 3秒

  return () => clearInterval(poll);
}, [pendingRenderJobId]);
```

### 2.5 组件交互关系 (完整)

```
App (layout.tsx)
│
├── Header
│   ├── Logo (点击 → /)
│   ├── 导航: 首页 | 设计页
│   └── 用户状态展示
│
├── HomePage (/)
│   ├── LumiereIntro (全屏欢迎动画)
│   ├── HeroSection (主标题 + CTA按钮)
│   ├── PairedCarousel (7组 before/after 对比)
│   └── AgentShowcase (3个Agent卡片)
│
└── DreamPage (/dream)
    │
    ├── 顶部 DreamHeader
    │   ├── Logo + "设计你的理想空间"
    │   ├── 模式切换: [快速生成] [AI问答]
    │   └── 返回首页按钮
    │
    ├── Generate 模式 (mode="generate")
    │   ├── 左侧面板
    │   │   ├── DropDown: 风格选择 (themes)
    │   │   ├── DropDown: 房间类型 (rooms)
    │   │   └── UploadDropZone
    │   │       • 点击上传
    │   │       • 拖拽支持
    │   │       • 显示已上传预览
    │   │       • 重新上传支持
    │   │
    │   └── 右侧面板
    │       ├── 结果展示框 (aspect 4:3)
    │       │   ├── loading: Skeleton + 旋转动画
    │       │   └── loaded: Image + 点击放大 (ImageLightbox)
    │       └── 下载按钮 (仅在 loaded 时显示)
    │
    └── Chat 模式 (mode="chat") [默认进入时的模式]
        │
        ├── ChatHistoryPanel (宽度: 240px, 可收起)
        │   ├── 会话列表 (fetchSessions)
        │   │   • 每个会话: 标题、最新消息、时间
        │   │   • 点击 → setCurrentSessionId()
        │   │   • 置顶图标 (pin)
        │   │   • 删除按钮
        │   ├── "新建对话"按钮
        │   │   • createAndStoreSessionId()
        │   │   • setCurrentSessionId()
        │   └── 推荐提示词 (fetchRecommendedPrompts)
        │       • 基于历史会话生成
        │       • 点击 → setInput()
        │
        ├── ChatInterface (主区域, flex-1)
        │   │
        │   ├── ChatActions (顶部操作栏)
        │   │   • 消息计数: "共 N 条消息"
        │   │   • 导出MD: buildMarkdown() → Blob download
            │   │   • 清空: confirm() → setMessages([])
            │   │
            │   ├── 消息容器 (overflow-y-auto)
            │   │   ├── 遍历 messages[]
            │   │   │
            │   │   ├── User Message:
            │   │   │   • role: "user"
            │   │   │   • content: 文本
            │   │   │   • attachments: 上传的图片
            │   │   │     → 每张图片显示为缩略图 + 标签
            │   │   │     → ChatMessageActions: "复制链接"
            │   │   │   • timestamp 格式: "2025/03/27 14:30"
            │   │   │
            │   │   ├── Assistant Message:
            │   │   │   • role: "assistant"
            │   │   │   • content: MarkdownRenderer 渲染
            │   │   │   • agentName?: AgentStatus 显示
            │   │   │   • agentName 对应 AGENT_DISPLAY_NAMES
            │   │   │   • imageUrl?: 渲染结果图展示
            │   │   │   • references?: 参考链接列表
            │   │   │   • followUpPrompts?: 后续提示词按钮
            │   │   │   • ChatMessageActions: 复制/重发
            │   │   │
            │   │   └── renderJobId?:
            │   │       • renderStatus: "pending" | "completed" | "failed"
            │   │       • 显示状态提示 (如"效果图正在生成...")
            │   │
            │   ├── 输入区 (固定底部)
            │   │   ├── TextArea (多行文本)
            │   │   │   • auto-resize
            │   │   │   • onKeyDown: Enter 发送，Shift+Enter 换行
            │   │   │
            │   │   ├── 工具栏
            │   │   │   ├── 上传按钮
            │   │   │   │   • 点击 → setShowUploadMenu(true)
            │   │   │   │   • 弹出菜单: [上传原图] [上传灵感图]
            │   │   │   │   • 选择文件后 → appendSelectedImages()
            │   │   │   │
            │   │   │   ├── QuickScenes
            │   │   │   │   • "客厅" / "厨房" / "卧室" / "卫生间"
            │   │   │   │   • 点击 → 自动填 input: "我想装修[场景]"
            │   │   │   │
            │   │   │   └── QuickPrompts
            │   │   │       • 推荐问题按钮
            │   │   │       • "预算拆分明细" / "材料清单" / ...
            │   │   │       • 点击 → setInput(prompt)
            │   │   │
            │   │   └── 发送按钮
            │   │       • disabled: isSending || !input.trim()
            │   │       • onClick → handleSendMessage()
            │   │
            │   └── 待上传图片预览区
            │       • 显示 pendingImages 列表
            │       • 每张缩略图 + 标签 + × 按钮
            │
            └── ImageLightbox (全局)
                • 点击结果图或附件图时打开
                • full-screen overlay
                • 图片 + 下载按钮 + 关闭按钮
```

---

## 三、后端详细流程

### 3.1 系统初始化

```
$ uvicorn server:app --host 0.0.0.0 --port 8000
    │
    ▼ @app.on_event("startup")
    │
    ├── init_db()  ← db.py
    │   └── 创建 SQLite 表:
    │       • sessions
    │       • messages
    │       • assets
    │       • render_jobs
    │
    ├── session_service = InMemorySessionService()
    │   └── 内存存储 Session (重启丢失)
    │
    ├── artifact_service = FileArtifactService(ARTIFACT_ROOT)
    │   └── 存储路径: .adk/artifacts/
    │       • 按 user_id/session_id/filename/version 组织
    │
    ├── runner = Runner(
    │       agent=root_agent,
    │       session_service=session_service,
    │       artifact_service=artifact_service,
    │       auto_create_session=True
    │   )
    │   └── 用于: /api/chat*, /api/chat-with-image*
    │
    ├── render_runner = Runner(
    │       agent=project_coordinator,
    │       session_service=session_service,
    │       artifact_service=artifact_service
    │   )
    │   └── 用于: 后台渲染任务
    │
    └── logger.info("ADK Runner initialized")
```

### 3.2 核心 API 端点

#### A. 会话管理

```
POST /api/sessions
├── Form: user_id, session_id
├── ensure_session(session_id, user_id, title="新对话")
│   └── INSERT OR REPLACE into sessions
└── 返回 {session_id}

GET /api/sessions?user_id=frontend_user
├── SELECT * FROM sessions WHERE user_id=? ORDER BY updated_at DESC
└── 返回 [{session_id, title, latest_user_message, pinned, created_at, updated_at}]

GET /api/sessions/{session_id}/messages?user_id=...
├── SELECT * FROM messages WHERE session_id=? ORDER BY created_at
├── JOIN artifacts 获取 image_filename
├── build_asset_url() 构造可访问URL
└── 返回 MessageResponse[]:

{
  id, role, content,
  imageUrl: "/api/sessions/{session}/assets/{filename}",
  references: [{title, url, snippet, source}],
  created_at
}

POST /api/sessions/{session_id}/pin
├── UPDATE sessions SET pinned=? WHERE session_id=? AND user_id=?
└── {session_id, pinned}

DELETE /api/sessions/{session_id}
├── DELETE FROM sessions WHERE session_id=? AND user_id=?
└── {session_id, deleted: true}
```

#### B. 文本聊天 API (带图片的流式)

**端点**: `POST /api/chat-with-image/stream`

```
请求:
Content-Type: multipart/form-data
├── message: "装修我的厨房，预算10万"
├── user_id: "frontend_user"
├── session_id: "main_session"
├── current_room_images: [File, File, ...] (可选)
├── inspiration_images: [File, ...] (可选)
└── current_room_image: File (可选，单文件兼容)
│
└── image: File (可选，旧参数名)

响应: text/event-stream

----------------------------------------------------------------------
服务端处理流程:

1. 验证 API 密钥
   if not GOOGLE_API_KEY and not GEMINI_API_KEY:
     raise HTTPException(500, "Missing API key")

2. 确保 Session 存在
   session = await ensure_adk_session(user_id, session_id)
   • 获取或创建 ADK session
   • session_state_snapshot() 恢复状态

3. 特殊模式: local_mock & QUICK_GENERATE_USER
   if IMAGE_GENERATION_MODE == "local_mock" && user_id == "quick_generate_user":
     • 直接解析本地图片映射
     • resolve_local_render_mapping(original_filename, style)
     • 返回: {imageUrl, originalImageUrl?, message}
     • 不调用 ADK，快速返回
     • 这是用于演示的短路路径

4. prepare_message_content()
   ├── 读取上传文件 bytes
   ├── save_uploaded_asset(file, asset_type, user_id, session_id)
   │   ├── artifact_filename = f"{asset_type}_{uuid.uuid4().hex[:8]}{ext}"
   │   ├── image_part = types.Part.from_bytes(data, mime_type)
   │   ├── artifact_service.save_artifact(
   │   │     app_name=APP_NAME,
   │   │     user_id, session_id,
   │   │     filename=artifact_filename,
   │   │     artifact=image_part,
   │   │     custom_metadata={"asset_type": asset_type}
   │   │   )
   │   └── save_asset() 记录到 assets 表
   │
   ├── 构造 types.Content(role="user", parts=[text_part, ...image_parts])
   │
   └── 更新 session.state:
       • latest_current_room_image = filename
       • latest_inspiration_image = filename
       • reference_images[filename] = {type, version}

5. runner.run_async(
      user_id, session_id,
      new_message=content,
      run_config=RunConfig(streaming_mode=StreamingMode.SSE)
   )
   └── 返回 AsyncGenerator[Event]

6. 生成 SSE 流 (async generator)
   │
   ├── 循环 for event in events:
   │   ├── iter_agent_updates(event)
   │   │   └── 检测事件作者和动作
   │   │       • author ∈ TRACKED_AGENTS?
   │   │       • start → yield {type: "agent", agentName, status: "processing"}
   │   │       • end_of_agent → yield {type: "agent", ..., status: "completed"}
   │   │       • transfer_to_agent → yield {type: "agent", ...}
   │   │
   │   ├── extract_text_from_event(event)
   │   │   └── 拼接 event.content.parts[*].text
   │   │
   │   ├── if event.partial == True:
   │   │   • 流式chunk，实时yield {type: "content", content}
   │   │
   │   └── else if final text:
   │       • 保存到 final_reply_texts[]
   │
   ├── (循环结束) 流结束
   │
   ├── 构建完整回复
   │   • assistant_message = normalize_assistant_output(完整文本)
   │
   ├── 检查是否需要搜索
   │   if should_include_price_links(user_msg, assistant_msg):
   │     links = await google_cse_search(f"{msg} 装修 价格 材料 购买")
   │     yield {type: "references", links}
   │
   ├── 持久化消息
   │   • save_message(user)
   │   • save_message(assistant, image_filename=结果图?)
   │
   ├── 如果有上传图片
   │   • queue_render_job(user_id, session_id, request_message=message)
   │   │   ├── job_id = uuid.uuid4().hex
   │   │   ├── create_render_job(DB: job_id, session_id, user_id, status="pending")
   │   │   └── asyncio.create_task(process_render_job(...))
   │   │       → 后台异步执行，不阻塞流结束
   │   │
   │   └── yield {type: "render", jobId, status: "pending"}
   │
   └── yield [DONE]  → 客户端关闭连接

7. 异常处理
   except Exception:
     yield {type: "error", message: "..."}
     yield [DONE]

----------------------------------------------------------------------
服务端 SE 事件类型总结:

{
  type: "agent"       → 更新 AgentStatus
  agentName: string
  status: "processing" | "completed"

  type: "content"     → 文本流片段
  content: string

  type: "references"  → 搜索参考链接
  links: [{title, url, snippet, source}]

  type: "render"      → 渲染任务已入队
  jobId: string
  status: "pending"

  type: "error"       → 异常信息
  message: string
}
```

#### C. 渲染任务管理

```
POST /api/sessions/{session_id}/render
├── request_message: Form("请生成效果图")
├── ensure_session()
├── queue_render_job():
│   ├── job_id = uuid.uuid4().hex
│   ├── create_render_job(
│   │     job_id, session_id, user_id,
│   │     request_message, status="pending"
│   │   ) → INSERT render_jobs
│   └── asyncio.create_task(process_render_job(...))
└── 返回 {job_id, status: "pending"}
    (立即返回，不等待渲染完成)

----------------------------------------------------------------------
后台任务: process_render_job()

async def process_render_job(job_id, user_id, session_id, request_message):
    try:
        # 1. 标记开始
        update_render_job(job_id, status="running")
        session.state["background_render_job"] = job_id

        # 2. 构建提示词
        prompt = (
            "根据当前会话里已经完成的空间分析和设计方案，"
            "直接生成效果图。不要重复完整文字方案，只需调用渲染工具，"
            "并在成功后用2到3句中文简短说明画面亮点。"
            f"\n\n用户原始诉求：{request_message}"
        )

        # 3. 调用 render_runner
        events = render_runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=types.Content(
                role="user",
                parts=[types.Part.from_text(text=prompt)]
            )
        )

        # 4. 等待 ProjectCoordinator 执行
        #    ProjectCoordinator 会调用 generate_renovation_rendering()
        reply_text = await extract_reply_text(events)
        #   内部逻辑:
        #   • 读取 session.state (room_analysis, design_plan)
        #   • 构造超详细 SLC 提示词
        #   • generate_renovation_rendering(prompt, aspect_ratio, asset_name)
        #   │   → 调用图像生成API
        #   │   → 保存 artifact
        #   │   → 返回 filename
        #   • 设置 session.state["last_generated_rendering"] = filename

        # 5. 查询结果图
        result_filename = await get_result_image_filename(user_id, session_id)
        #   → session.state.get("latest_result_image" or "last_generated_rendering")

        # 6. 更新任务状态
        if result_filename:
            update_render_job(
                job_id,
                status="completed",
                result_filename=result_filename
            )
            # 追加一条助手消息，展示结果图
            save_message(
                session_id, user_id, "assistant",
                content=build_render_completion_message(True, reply_text),
                image_filename=result_filename
            )
        else:
            update_render_job(
                job_id,
                status="failed",
                error_message="效果图服务繁忙，可稍后重试。"
            )
            save_message(... content=build_render_completion_message(False))

    except Exception as e:
        logger.error(f"Background render job failed: {e}")
        update_render_job(job_id, status="failed", error_message=str(e))
        save_message(... error case)

----------------------------------------------------------------------
轮询查询: GET /api/render-jobs/{job_id}

def get_render_job(job_id, user_id):
    job = SELECT * FROM render_jobs WHERE job_id=? AND user_id=?
    if not job: raise HTTPException(404)
    return {
        job_id, status,
        imageUrl: build_asset_url(session_id, result_filename) if completed,
        message: error_message if failed,
        retryable: status == "failed"
    }
```

#### D. 图片与文件服务

```
GET /api/sessions/{session_id}/assets/{filename}
├── 从 artifact_service 加载
│   artifact = await artifact_service.load_artifact(
│       app_name=APP_NAME,
│       user_id=user_id,
│       session_id=session_id,
│       filename=filename
│   )
│   → Response(artifact.inline_data.data, media_type)
│
└── 用于展示: chatImageUrl = build_asset_url(session_id, filename)

GET /api/local-files/{kind}/{filename}
├── kind ∈ {"original", "rendered"}
├── resolve_local_image_dirs()
│   └── 搜索目录:
│       • LOCAL_ORIGINAL_DIR (env)
│       • LOCAL_RENDERED_DIR (env)
│       • 回退: 项目下搜索 "原始"/"渲染" 文件夹
├── find_existing_file_by_name(dir, filename)
│   └── 按文件名匹配 (大小写不敏感)
└── FileResponse(file_path, media_type)
    └── 用于 Generate 模式的本地预生成图

POST /api/local-render-map
├── original_filename: string (Form)
├── style: string (Form)
├── resolve_local_render_mapping():
│   └── 规则 (server.py:505-542):
│       1. 如果 original_filename 提供:
│          • 提取 stem 中的 B数字 (如 B1)
│          • 映射为 A数字 (A1)
│          • 在 rendered_dir 找 A1.png
│          • 在 original_dir 找 B1.png (optional)
│          • 返回渲染图 + 可选原图
│       2. 如果只提供 style:
│          • style → 映射: {"现代北欧风": "现代北欧风", "简约风": "简约风"}
│          • 在 rendered_dir 找 {style}.png
│          • 返回渲染图
└── LocalRenderResponse:
    {
      mode: IMAGE_GENERATION_MODE,
      imageUrl: "/api/local-files/rendered/xxx.png",
      originalImageUrl: optional,
      message: error or null
    }

POST /api/search/google-links
├── query: string
├── max_results: int (default 5)
└── google_cse_search()
    • 使用 GOOGLE_CSE_API_KEY + CX
    • 返回: [{title, url, snippet, source="Google"}]
    • 用于在聊天中展示材料购买参考链接
```

### 3.3 多智能体协作流

```
┌─────────────────────────────────────────┐
│  Root Agent: HomeRenovationPlanner      │
│  (routing logic)                        │
├─────────────────────────────────────────┤
│  Routing Rules:                         │
│  1. 用户请求含图片 → PlanningPipeline   │
│  2. 需编辑效果图 → RenderingEditor      │
│  3. 一般问题 → InfoAgent                │
└──────────────┬──────────────────────────┘
               │ transfer_to_agent
    ┌──────────┴───────────┐
    ▼                      ▼
┌─────────────┐   ┌─────────────────┐
│  InfoAgent  │   │ RenderingEditor │
│             │   │                 │
│ "你好！我    │   │ 使用工具:       │
│ 可以帮你..." │   │ edit_renovation_│
│             │   │ rendering()     │
│ 2-4句简短   │   │                 │
│ 中文回复    │   │ * 仅当已有     │
│             │   │   渲染结果时   │
└─────────────┘   └─────────────────┘
                           │
         ┌─────────────────┘
         │ 新装修规划 (任何含图片的请求)
         ▼
┌─────────────────────────────────────────┐
│  PlanningPipeline (SequentialAgent)     │
│  顺序执行，每个Agent完成后自动传递       │
└──────────────┬──────────────────────────┘
               │
    ┌──────────▼──────────┐
    ▼                     │
┌─────────────────┐       │
│ VisualAssessor  │───────┘
│                 │      (transfer_to_agent)
│ 职责:           │
│ • 分析房间照片  │
│ • 提取风格      │
│ • 记录布局细节  │
│                 │
│ 输出结构化摘要: │
│ ```             │
│ 分析完成         │
│                 │
│ Images Provided:│
│ - Current room: ✓│
│ - Inspiration:  ✓│
│                 │
│ Room Details:   │
│ - Type: kitchen │
│ - Current: ...  │
│ - Style: ...    │
│ - Layout:       │
│   • Windows: ...│
│   • Doors: ...  │
│   • Cabinets:   │
│   • stove centered on back wall│
│ ```            │
│                 │
│ session.state  │
│   room_analysis │
│   style_preferences│
└─────────────────┘
               │ transfer_to_agent
               ▼
┌─────────────────┐
│  DesignPlanner  │
│                 │
│ 职责:           │
│ • 读取: room_analysis, budget, style │
│ • 只改表面，不改布局  │
│ • 材料/配色/预算    │
│ • 时间估算         │
│                 │
│ 输出:           │
│ ```             │
│ 设计完成         │
│                 │
│ Renovation Scope: moderate│
│ Layout: PRESERVED EXACTLY │
│                 │
│ Surface Finish │
│ Changes:        │
│ - Cabinets: 柔│
│   和奶油色      │
│ - Walls: 米白 │
│   色 Farrow &  │
│   Ball 229     │
│ - Counter:     │
│   石英石 ...   │
│                 │
│ 材料清单摘要:   │
│ - 柜门: ...    │
│ - 墙面漆: ...  │
│ - 台面: ...    │
│ ```            │
│                 │
│ session.state  │
│   design_plan  │
└─────────────────┘
               │ transfer_to_agent
               ▼
┌─────────────────────────────┐
│  ProjectCoordinator         │
│                             │
│ 职责:                       │
│ • 整合前两步结果            │
│ • 生成超详细提示词 (SLC)    │
│ • 调用 generate_renovation_ │
│   rendering()              │
│ • 输出 2-3句总结 + 效果图   │
│                             │
│ SLC 提示词结构:             │
│ "[CAMERA] DSLR, 8K, HDR..." │
│ "[SUBJECT] 厨房, modern farmhouse, 布局完全一致..." │
│ "[LIGHTING] 晨光, 温暖..."  │
│                             │
│ 生成结果:                   │
│ • 调用图像API               │
│ • 保存 artifact             │
│ • 设置 session.state:      │
│   latest_result_image=xxx   │
│   last_generated_rendering=xxx│
│                             │
│ 返回给用户:                 │
│ "效果图已生成。画面亮点:..."│
└─────────────────────────────┘
```

**Session State 传递细节**:
```python
# 整个过程在一个 ADK Session 内
# 每个 Agent 通过 transfer_to_agent 传递
# 状态通过 session.state 共享:

session.state = {
    # 图片
    "latest_current_room_image": "current_room_abc123.png",
    "latest_inspiration_image": "inspiration_def456.png",
    "reference_images": {
        "current_room_abc123.png": {"type": "current_room", "version": 0},
    },

    # VisualAssessor 输出
    "room_analysis": {
        "room_type": "kitchen",
        "size_estimate": "12x10 ft",
        "current_style": "outdated oak",
        "layout": { "windows": "...", "cabinets": "L-shaped", ... }
    },
    "style_preferences": "modern farmhouse",

    # DesignPlanner 输出
    "design_plan": {
        "scope": "moderate",
        "surface_finishes": {
            "cabinets": {"color": "Soft Cream", "code": "SW 8914"},
            "walls": {"color": "Antique White"},
            ...
        },
        "budget_estimate": "5-8万",
        "timeline": "3-6周"
    },

    # ProjectCoordinator 输出
    "last_generated_rendering": "kitchen_modern_renovation_v1.png",
    "latest_result_image": "kitchen_modern_renovation_v1.png",
    "background_render_job": "job_xxx",
}
```

---

## 四、核心工具 (Tools.py)

```python
# 图片生成与编辑
generate_renovation_rendering(
    prompt: str,              # 超详细 SLC 提示词
    aspect_ratio: str = "16:9",
    asset_name: str           # e.g., "kitchen_modern_renovation"
) -> str                     # 返回 artifact filename

edit_renovation_rendering(
    prompt: str,              # 编辑指令, e.g., "把柜子改成奶油色"
    artifact_filename: Optional[str],
    asset_name: str
) -> str

list_renovation_renderings() -> str
list_reference_images() -> str

# 成本估算
estimate_renovation_cost(
    room_type: str,           # kitchen, bathroom, living_room
    scope: str,               # cosmetic, moderate, full, luxury
    square_footage: int
) -> str                     # 返回 RMB 价格区间

# 工期估算
calculate_timeline(scope: str, room_type: str) -> str

# 内置工具
google_search(query: str)  # 仅限 SearchAgent 使用
```

---

## 五、数据库表结构

```sql
-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  pinned BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  image_filename TEXT,  -- 关联 artifacts (FOREIGN KEY 未约束)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

-- 资产文件表
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  asset_type TEXT CHECK(asset_type IN ('current_room', 'inspiration')),
  version INTEGER DEFAULT 0,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 渲染任务表
CREATE TABLE IF NOT EXISTS render_jobs (
  job_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request_message TEXT,
  status TEXT NOT NULL CHECK(
    status IN ('pending', 'running', 'completed', 'failed')
  ),
  result_filename TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 六、关键技术点

### 6.1 流式响应实现

```python
# server.py 流式生成
async def event_stream():
    try:
        async for event in events:
            # 1. Agent状态更新
            for update in iter_agent_updates(event):
                yield f"data: {json.dumps({'type': 'agent', **update})}\n\n"

            # 2. 文本内容
            text = extract_text_from_event(event)
            if text:
                if getattr(event, "partial", False):
                    yield f"data: {json.dumps({'type': 'content', 'content': text})}\n\n"
                else:
                    # 最终完整段落 (流式模式下也可能出现非partial的最终文本)
                    pass

        # 3. 流结束后的操作
        if need_search:
            links = await google_cse_search(...)
            yield f"data: {json.dumps({'type': 'references', 'links': links})}\n\n"

        persist_chat_records(...)

        # 触发渲染任务 (如果上传了图片)
        if has_uploaded_images:
            job_id = await queue_render_job(...)
            yield f"data: {json.dumps({'type': 'render', 'jobId': job_id, 'status': 'pending'})}\n\n"

        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

return StreamingResponse(
    event_stream(),
    media_type="text/event-stream",
    headers={
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
)
```

### 6.2 前端 ParseSSE

```typescript
async function parseSSE(
  response: Response,
  onChunk: (chunk: StreamChunk) => void,
  onDone: () => void
) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") {
        onDone();
        return;
      }
      try {
        onChunk(JSON.parse(data));
      } catch {
        // 忽略不完整的JSON
      }
    }
  }
}
```

### 6.3 文本规范化

```python
def normalize_assistant_output(text: str) -> str:
    """将英文输出翻译/转换为中文用户友好格式"""
    # 1. 替换标题
    for en, zh in HEADING_REPLACEMENTS.items():
        text = text.replace(en, zh)

    # 2. 替换术语
    for en, zh in TERM_REPLACEMENTS.items():
        text = text.replace(en, zh)

    # 3. 替换品牌名
    for en, cn in BRAND_REPLACEMENTS.items():
        text = text.replace(en, cn)

    # 4. 货币转换: $1234 → 约人民币 8,888 元
    text = normalize_currency_ranges(text)

    # 5. 面积单位: 150 sq ft → 约 14 平方米
    text = normalize_area_units(text)

    # 6. 去重 (ADK有时会重复相同行)
    text = dedupe_repeated_lines(text)

    return text.strip()
```

### 6.4 本地预生成图映射

```python
# 命名规则:
# 原图: B1.jpg, B2.jpg, B3.jpg
# 渲染图: A1.png, A2.png, A3.png

def resolve_local_render_mapping(original_filename=None, style=None):
    original_dir, rendered_dir = resolve_local_image_dirs()

    if original_filename:
        # 情况1: 上传了原图，找对应的渲染图
        stem = Path(original_filename).stem  # e.g., "B1"
        match = re.search(r"(?i)B(\d+)", stem)
        if not match:
            return {"image_url": None, "message": "文件名无法识别，请按 B1/B2 这类命名上传原图。"}
        mapped_stem = f"A{match.group(1)}"  # B1 → A1
        rendered = find_existing_file_by_stem(rendered_dir, mapped_stem)
        original = find_existing_file_by_stem(original_dir, stem)
        return {
            "image_filename": rendered.name,
            "original_filename": original.name if original else None,
            "message": None
        }
    else:
        # 情况2: 无原图，直接按风格返回
        style_map = {"现代北欧风": "现代北欧风", "简约风": "简约风"}
        key = style_map.get(style)
        if not key:
            return {"image_url": None, "message": "当前无图直生仅支持简约风、现代北欧风。"}
        rendered = find_existing_file_by_stem(rendered_dir, key)
        return {"image_filename": rendered.name, "original_filename": None, "message": None}
```

---

## 七、环境变量配置

```bash
# .env 示例:

# AI API 密钥 (必需)
GOOGLE_API_KEY=your_gemini_api_key
# 或
GEMINI_API_KEY=your_gemini_api_key

# 图片生成模式 (默认: local_mock 演示模式)
IMAGE_GENERATION_MODE=local_mock|api_call

# 前端根目录 (默认: ./roomGPT_frontend)
FRONTEND_PUBLIC_ROOT=./roomGPT_frontend

# 本地图片目录 (local_mock 模式下使用)
LOCAL_ORIGINAL_DIR=./roomGPT_frontend/public/local-images/original
LOCAL_RENDERED_DIR=./roomGPT_frontend/public/local-images/rendered

# Google CSE 搜索 (可选)
GOOGLE_CSE_API_KEY=xxx
GOOGLE_CSE_CX=xxx

# CORS 允许的源
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

---

## 八、启动流程

```bash
# 1. 克隆项目 + cd 到根目录

# 2. 配置环境
cp .env.example .env
# 编辑 .env，填入 GOOGLE_API_KEY

# 3. 后端
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8000
# 日志: INFO: Uvicorn running on http://0.0.0.0:8000
# 测试: curl http://localhost:8000/api/health

# 4. 前端 (新终端)
cd roomGPT_frontend
npm install --registry=https://registry.npmmirror.com  # 国内镜像加速
npm run dev
# 输出: Ready on http://localhost:3000

# 5. 访问
# http://localhost:3000
```

---

## 九、注意事项

| # | 事项 | 说明 | 代码位置 |
|---|------|------|----------|
| 1 | **API 密钥** | 必需，否则启动报错 | server.py:176-181 |
| 2 | **本地图片命名** | B1/B2 (原图) → A1/A2 (渲染图) | server.py:522-531 |
| 3 | **会话状态** | InMemorySessionService，重启丢失 | server.py:840 |
| 4 | **文件积累** | .adk/artifacts/ 不会自动清理 | - |
| 5 | **CORS** | 仅允许 FRONTEND_ORIGINS | server.py:55-67 |
| 6 | **ADK 编辑限制** | 当前Web版本图片编辑功能有限 | agent.py:216-218 |
| 7 | **搜索功能** | 需要 Google CSE 配置 | server.py:49-50, 558-596 |
| 8 | **轮询间隔** | 3秒 (ChatInterface.tsx:198) | 固定值 |
| 9 | **Asyncio 任务** | render job 使用 create_task() 不等待 | server.py:705-712 |
| 10 | **文本规范化** | 所有输出都经过 normalize_assistant_output() | server.py:387-411 |

---

## 十、技术栈清单

| 组件 | 技术 | 版本/备注 |
|------|------|-----------|
| 前端框架 | Next.js | 14.x (App Router) |
| 前端语言 | TypeScript | strict mode |
| UI 样式 | Tailwind CSS | 3.x + custom config |
| 动画 | Framer Motion | 10.x |
| 状态管理 | React Hooks | useState, useEffect, useRef |
| HTTP 客户端 | fetch API | 原生 + ReadableStream |
| 后端框架 | FastAPI | 0.104+ |
| AI 平台 | Google ADK | (google-adk package) |
| LLM 模型 | Gemini 3 Flash Preview | `gemini-3-flash-preview` |
| 数据库 | SQLite | 3.x (via stdlib sqlite3) |
| 文件存储 | Local FS | `FileArtifactService` |
| 异步运行时 | asyncio + uvicorn | 默认 |

---

## 版本历史

- **v1.0 Final** (2025-03-27)
  - ✅ 完整验证所有代码实现
  - ✅ 修正前端上传交互细节
  - ✅ 补充 ChatActions 组件
  - ✅ 明确 SSE 事件类型
  - ✅ 细化 Session State 结构
  - ✅ 补充轮询间隔 (3秒)
  - ✅ 补充 Google CSE 端点

---

**文档维护**: 每次架构重大变更后需更新此文档。
