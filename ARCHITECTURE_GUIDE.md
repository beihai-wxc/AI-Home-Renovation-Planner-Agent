# Lumière - AI 智能家装规划师 架构与实现详解

> 本文档全面覆盖项目架构、前后端交互、多智能体系统、RAG 知识库、关键功能实现细节及每个文件的作用。

---

## 1. 项目总览

本项目是一个基于 **LangGraph 多智能体系统** 的 AI 家装规划平台。用户可以上传房间照片，系统通过多模态视觉分析、设计规划、预算估算、效果图生成等步骤，提供完整的装修方案。

**核心流程**：用户上传房间图 + 文字描述 → 路由分类 → 视觉分析 → 设计方案 → 效果图生成 → 流式返回前端。

---

## 2. 目录结构与文件说明

```
AI Home Renovation Planner Agent/
├── agent.py                  # LangGraph 多智能体图定义（核心）
├── server.py                 # FastAPI 后端服务（所有 API 端点 + SSE 流式）
├── tools.py                  # LangChain @tool 工具定义（搜索/预算/渲染等）
├── llm_provider.py           # 大模型/生图模型统一封装（ChatOpenAI / DashScope）
├── db.py                     # SQLite 持久化层（会话/消息/资源/任务表）
├── baidu_search.py           # 百度千帆 AI 搜索封装
├── requirements.txt          # Python 依赖
├── .env / .env.example       # 环境变量配置（API Key / 模型名）
├── __init__.py               # 包声明
│
├── rag/                      # RAG 知识库模块
│   ├── __init__.py           # 包声明 + 便捷导出
│   ├── retriever.py          # 检索核心：Embedding / 余弦相似度 / 上下文组装
│   ├── build_index.py        # 离线索引构建脚本
│   ├── generate_data.py      # 生成 80 条中文装修知识条目
│   ├── knowledge_base.json   # 知识库源数据
│   └── index/                # 向量索引（离线构建）
│       ├── embeddings.npy    # 1024 维向量矩阵
│       └── metadata.json     # 条目元数据
│
├── config/                   # 配置目录（当前为空，预留扩展）
├── orchestration/            # 编排目录（当前为空，预留扩展）
├── providers/                # 提供者目录（当前为空，预留扩展）
│   ├── image/                # 预留：图片生成提供者
│   ├── search/               # 预留：搜索提供者
│   └── text/                 # 预留：文本推理提供者
│
├── roomGPT_frontend/         # Next.js 前端
│   ├── app/
│   │   ├── layout.tsx        # 根布局（全局样式 + 字体 + Analytics）
│   │   ├── page.tsx          # 首页（Hero / Agent展示 / 轮播 / 关于）
│   │   ├── dream/
│   │   │   └── page.tsx      # 核心工作区页面（快速生成 + AI问答双模式）
│   │   └── auth/
│   │       └── page.tsx      # 登录/认证页面
│   ├── components/
│   │   ├── ChatInterface.tsx # 主聊天组件（消息流/输入/图片上传/Job轮询）
│   │   ├── ChatHistoryPanel.tsx  # 会话列表侧边栏
│   │   ├── ChatActions.tsx   # 聊天操作按钮组
│   │   ├── ChatMessageActions.tsx # 单条消息操作（复制/重试等）
│   │   ├── AgentStatus.tsx   # 当前活跃 Agent 状态指示器
│   │   ├── AgentTimeline.tsx # Agent 执行时间线面板
│   │   ├── FloorplanAnalysisCard.tsx # 户型图分析卡片（房间框选/编辑/生图）
│   │   ├── MarkdownRenderer.tsx  # Markdown 渲染器（支持表格/代码块）
│   │   ├── CompareSlider.tsx # 前后对比滑块（Before/After）
│   │   ├── PairedCarousel.tsx # 配对轮播展示
│   │   ├── QuickPrompts.tsx  # 推荐快捷提示词
│   │   ├── DropDown.tsx      # 下拉选择组件
│   │   ├── Toggle.tsx        # 开关切换组件
│   │   ├── ImageLightbox.tsx # 图片灯箱查看器
│   │   ├── ResizablePanel.tsx # 可拖拽调整大小的面板
│   │   ├── UploadDropZone.tsx # 拖拽上传区域（如有）
│   │   ├── Header.tsx        # 页面顶部导航栏
│   │   ├── Footer.tsx        # 页面底部
│   │   ├── LumiereIntro.tsx  # 首页品牌入场动画
│   │   ├── LoadingDots.tsx   # 加载动画点
│   │   ├── Skeleton.tsx      # 骨架屏加载占位
│   │   ├── SquigglyLines.tsx # 装饰波浪线
│   │   └── Toast.tsx         # 轻提示通知组件
│   ├── utils/
│   │   ├── api.ts            # 所有后端 API 调用函数（核心）
│   │   ├── auth.ts           # 前端认证/用户状态管理
│   │   ├── session.ts        # 当前会话 ID 管理
│   │   ├── appendNewToName.ts # 文件名去重工具
│   │   ├── downloadPhoto.ts  # 图片下载工具
│   │   └── dropdownTypes.ts  # 下拉选项类型定义
│   ├── types/
│   │   └── chat.ts           # TypeScript 类型定义（ChatMessage / Agent / Session）
│   ├── styles/
│   │   ├── globals.css       # 全局样式
│   │   └── loading-dots.module.css # 加载动画样式模块
│   ├── public/               # 静态资源（图标 / 示例图片 / favicon）
│   ├── next.config.js        # Next.js 配置
│   ├── tailwind.config.js    # Tailwind CSS 配置
│   ├── postcss.config.js     # PostCSS 配置
│   ├── tsconfig.json         # TypeScript 配置
│   └── package.json          # 前端依赖声明
│
└── .adk/                     # 本地数据目录（运行时生成）
    ├── planner.db            # SQLite 数据库
    └── artifacts/            # 生成的图片/文件存储
```

### 各文件作用详解

| 文件 | 作用 | 关键内容 |
|------|------|----------|
| `agent.py` | LangGraph 图定义 | `RenovationState`, `router_node`, `info_node`, `visual_assessor_node`, `design_planner_node`, `rendering_editor_node`, `project_coordinator_node`, `graph`(主图), `render_graph`(渲染子图) |
| `server.py` | FastAPI 后端服务 | 20+ API 端点，SSE 流式响应，CORS 中间件，RAG 触发逻辑，floorplan 分析流水线，后台渲染任务 |
| `tools.py` | LangChain 工具 | `baidu_search_tool`, `estimate_renovation_cost_tool`, `calculate_timeline_tool`, `generate_renovation_rendering_tool`, `edit_renovation_rendering_tool`, `list_renovation_renderings_tool` |
| `llm_provider.py` | 模型统一封装 | `get_chat_llm()`, `get_vision_llm()`, `generate_image()`(自动适配 OpenAI/DashScope 协议), `encode_image_to_base64_message()` |
| `db.py` | SQLite 持久化 | 6 张表：`sessions`, `messages`, `assets`, `message_assets`, `render_jobs`, `floorplan_jobs` |
| `baidu_search.py` | 百度搜索封装 | `baidu_web_search()`(异步), `baidu_web_search_sync()`(同步，供 LangChain 工具调用) |
| `rag/retriever.py` | RAG 检索引擎 | `KnowledgeRetriever` 类：懒加载索引 → DashScope Embedding → NumPy 余弦相似度 → Top-K 检索 → 上下文组装 |
| `rag/build_index.py` | 离线构建索引 | 读取 `knowledge_base.json` → Embedding → 保存 `embeddings.npy` + `metadata.json` |
| `rag/generate_data.py` | 知识数据生成 | 生成 80 条中文装修知识（客厅/卧室/厨房/卫生间/水电/选材/软装等分类） |
| `roomGPT_frontend/utils/api.ts` | 前端 API 层 | 所有后端接口调用：流式聊天、图片上传、floorplan 分析、渲染任务、会话管理 |
| `roomGPT_frontend/components/ChatInterface.tsx` | 主聊天组件 | 消息状态管理、SSE 事件处理、RAG 开关、图片上传、Job 轮询 |

---

## 3. 技术栈

### 后端
| 技术 | 用途 |
|------|------|
| **Python 3.10+** | 主语言 |
| **FastAPI** | HTTP API 框架 |
| **LangGraph** (`langgraph`) | 多智能体状态图编排（StateGraph + MemorySaver） |
| **LangChain** (`langchain-core`, `langchain-openai`) | LLM 抽象层、工具定义、消息格式 |
| **httpx** | 异步 HTTP 客户端（生图 API 调用） |
| **SQLite** (sqlite3) | 本地持久化 |
| **Pillow** | 图片处理（尺寸/压缩） |
| **NumPy** | 向量余弦相似度计算（RAG） |
| **python-dotenv** | 环境变量管理 |
| **Pydantic** | 数据模型验证 |

### 前端
| 技术 | 用途 |
|------|------|
| **Next.js 13.4** | React 框架（App Router） |
| **React 18** | UI 框架 |
| **TypeScript** | 类型安全 |
| **Tailwind CSS** | 样式框架 |
| **Framer Motion** | 动画库 |
| **@google/model-viewer** | 已安装但当前未使用（3D 功能已移除） |

### AI 模型（通过 `.env` 配置）
| 用途 | 默认模型 | 平台 |
|------|----------|------|
| 文本对话/推理 | `qwen3-max` | DashScope |
| 多模态视觉理解 | `qwen3-vl-plus` | DashScope |
| 文生图 | `wan2.7-image` | DashScope |
| Embedding（RAG） | `text-embedding-v3` | DashScope |
| 百度搜索 | 千帆 AI Search | 百度智能云 |

---

## 4. 前后端交互详解

### 4.1 架构概览

```
┌─────────────────────────────────────────────────────┐
│  浏览器 (localhost:3000)                              │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Next.js 前端 (roomGPT_frontend)                 │ │
│  │  ├─ ChatInterface.tsx  (主聊天组件)              │ │
│  │  ├─ api.ts  (API 调用层)                        │ │
│  │  └─ 其他组件                                     │ │
│  └────────────────────┬────────────────────────────┘ │
│                       │ HTTP / SSE                    │
└───────────────────────┼──────────────────────────────┘
                        │
                        ▼
┌───────────────────────┼──────────────────────────────┐
│  FastAPI 后端 (localhost:8000)                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │  server.py                                       │ │
│  │  ├─ /api/chat/stream         文字流式聊天        │ │
│  │  ├─ /api/chat-with-image/stream  图文流式聊天    │ │
│  │  ├─ /api/chat                文字非流式聊天      │ │
│  │  ├─ /api/sessions/*          会话管理            │ │
│  │  ├─ /api/render-jobs/*       渲染任务            │ │
│  │  ├─ /api/floorplan/*         户型图分析           │ │
│  │  ├─ /api/quick-generate      快速生成            │ │
│  │  ├─ /api/vision/furniture-match  家具识别        │ │
│  │  ├─ /api/knowledge/search    知识库检索          │ │
│  │  └─ /api/health              健康检查            │ │
│  └────────────────────┬────────────────────────────┘ │
│                       │                               │
│  ┌────────────────────┼────────────────────────────┐ │
│  │  agent.py (LangGraph)          │                 │ │
│  │  └─ graph (主图)              └─ render_graph    │ │
│  └─────────────────────────────────────────────────┘ │
│                       │                               │
│  ┌────────────────────┼────────────────────────────┐ │
│  │  外部服务                                       │ │
│  │  ├─ DashScope (LLM / Vision / Embedding / 生图) │ │
│  │  └─ 百度千帆 (AI Search)                        │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 4.2 API 端点全景

#### 会话管理
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/sessions` | 创建或确认会话 |
| `GET` | `/api/sessions?user_id=` | 获取用户的会话列表 |
| `POST` | `/api/sessions/{id}/pin` | 置顶/取消置顶会话 |
| `DELETE` | `/api/sessions/{id}?user_id=` | 删除会话 |
| `GET` | `/api/sessions/{id}/messages?user_id=` | 获取会话历史消息 |

#### 聊天（核心）
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/chat` | 非流式文字聊天 |
| `POST` | `/api/chat/stream` | **流式文字聊天（SSE）** — 支持 `use_rag` 参数 |
| `POST` | `/api/chat-with-image` | 非流式图文聊天 |
| `POST` | `/api/chat-with-image/stream` | **流式图文聊天（SSE）** — 支持 `use_rag` + 多图上传 |

#### 效果图渲染
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/sessions/{id}/render` | 基于会话历史创建后台渲染任务 |
| `GET` | `/api/render-jobs/{job_id}?user_id=` | 查询渲染任务状态/结果 |
| `GET` | `/api/sessions/{id}/assets/{filename}` | 获取生成的图片/文件 |

#### 户型图分析
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/floorplan/analyze` | 上传户型图进行 AI 分析（识别房间/标注） |
| `GET` | `/api/floorplan-jobs/{job_id}?user_id=` | 查询户型图分析任务状态 |
| `POST` | `/api/floorplan-jobs/{job_id}/rooms?user_id=` | 更新识别的房间信息 |
| `POST` | `/api/floorplan-jobs/{job_id}/generate?user_id=` | 启动房间级效果图批量生成 |

#### 其他
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/quick-generate` | 快速生图（风格+房间+可选照片） |
| `POST` | `/api/vision/furniture-match` | 上传家具图片，识别并搜索购买链接 |
| `GET` | `/api/knowledge/search?q=&limit=` | RAG 知识库测试检索接口 |
| `GET` | `/api/health` | 健康检查 + API Key 配置状态 |

### 4.3 核心交互流程

#### 流程 1：纯文本流式聊天（`/api/chat/stream`）

```
前端用户输入文字 → 点击发送
    │
    ▼
ChatInterface.tsx: handleSendMessage()
    │ message 不含图片
    ▼
api.ts: sendChatMessageStream(message, onChunk, onAgent, onReferences, onDone, onError, sessionId, useRag)
    │ POST /api/chat/stream
    │ Body: { message, user_id, session_id, use_rag }
    ▼
server.py: chat_stream()
    │ 1. 确保 session 存在
    │ 2. 如果 use_rag == true → 调用 retriever.search() → build_rag_context()
    │ 3. 构造 HumanMessage, 组装 input_state (含 rag_context)
    │ 4. 调用 graph.astream_events(input_state, config={session_id, user_id})
    │ 5. 通过 SSE 流式返回事件
    ▼
LangGraph graph 执行:
    START → router → 条件路由:
      ├─ "info" → info_node → END
      ├─ "planning" → visual_assessor → (tools loop) → design_planner → (tools loop) → END
      └─ "editing" → rendering_editor → (tools loop) → END
    │
    ▼ server.py 将事件转为 SSE chunks
SSE Chunk 类型:
    - { type: "agent", agentName: "Visual Assessor", status: "processing" }
    - { content: "根据您的厨房照片..." }  // token 级增量
    - { type: "references", links: [{ title, url, snippet }] }
    - { type: "error", message: "..." }
    - [DONE]
    │
    ▼ 前端 api.ts: parseSSE()
ChatInterface.tsx 处理:
    - agent chunk → 更新 AgentStatus 组件显示
    - content → 追加到当前 assistant 消息
    - references → 显示参考链接
    - [DONE] → 标记消息完成
```

#### 流程 2：图文流式聊天（`/api/chat-with-image/stream`）

```
前端用户输入文字 + 上传图片 → 点击发送
    │
    ▼
ChatInterface.tsx: handleSendMessage()
    │ message 含图片 (currentRoomImages / inspirationImages)
    ▼
api.ts: sendChatWithImageStream(message, images, ..., sessionId, useRag)
    │ POST /api/chat-with-image/stream
    │ Content-Type: multipart/form-data
    │ Fields: message, user_id, session_id, use_rag
    │ Files: current_room_images[], inspiration_images[]
    ▼
server.py: chat_with_image_stream()
    │ 1. 保存上传图片到 .adk/artifacts/
    │ 2. 使用 encode_image_to_base64_message() 将图片转为多模态消息格式
    │ 3. 构造 HumanMessage(content=[text, image_block1, image_block2, ...])
    │ 4. 如果 use_rag → RAG 检索
    │ 5. 调用 graph.astream_events(input_state)
    │ 6. SSE 流式返回（额外包含 image 和 render chunk 类型）
    ▼
Graph 执行时:
    └─ visual_assessor_node 使用 get_vision_llm() (多模态模型)
       可直接理解图片内容进行分析
    └─ design_planner_node 使用 get_chat_llm() (文本模型)
       （design_planner 不直接看图片，依赖 visual_assessor 的分析结果）

SSE Chunk 额外类型:
    - { type: "image", url: "..." }  // 生成的渲染图
    - { type: "render", jobId: "..." }  // 后台渲染任务已排队
```

#### 流程 3：后台渲染任务（`/api/sessions/{id}/render`）

```
前端请求生成效果图
    │
    ▼
POST /api/sessions/{id}/render  → 创建 render_job 记录 (status=pending)
    │
    ▼ BackgroundTasks: process_render_job()
    │ 1. 更新 job status=processing
    │ 2. 从消息历史构建上下文 HumanMessage
    │ 3. 调用 render_graph.ainvoke(input_state)
    │    └─ project_coordinator_node → (tools loop) → END
    │        └─ generate_renovation_rendering_tool: 构造 structure-locked prompt
    │           → generate_image() → 保存到 .adk/artifacts/
    │ 4. 更新 job status=completed, imageUrl=保存的文件名
    │
    ▼ 前端轮询
ChatInterface.tsx: 每 3 秒调用 fetchRenderJob(jobId)
    │ 当 status=completed → 在消息中显示渲染图
```

#### 流程 4：户型图分析流水线

```
前端上传户型图
    │
    ▼
POST /api/floorplan/analyze → Vision LLM 分析户型图
    │ 返回: { job_id, status, analysis: { rooms[], zoomedFloorplanUrl } }
    │
    ▼ 前端展示 FloorplanAnalysisCard
用户可在 UI 中:
    ├─ 拖拽添加/修改房间框选区域 (bbox)
    ├─ 编辑房间名称、类型、尺寸
    ├─ 为每个房间输入设计要求
    │
    ▼
POST /api/floorplan-jobs/{job_id}/rooms → 保存修改后的房间信息
    │
    ▼
POST /api/floorplan-jobs/{job_id}/generate → 启动批量生成
    │ 为每个房间: 裁剪区域 → generate_image() → 保存结果
    │ └─ 前端每 3 秒轮询 fetchFloorplanJobStatus()
    │    └─ 显示每个房间的生成进度 (pending → processing → completed → failed)
```

### 4.4 前端 API 地址自动解析逻辑

```typescript
// roomGPT_frontend/utils/api.ts: resolveApiBaseUrl()

function resolveApiBaseUrl(): string {
  // 1. 优先环境变量 NEXT_PUBLIC_BACKEND_URL
  const envValue = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envValue) return envValue;

  // 2. SSR 时默认 localhost
  if (typeof window === "undefined") return "http://localhost:8000";

  // 3. 浏览器环境判断
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1")
    return "http://localhost:8000";

  // 4. 远程部署时使用同主机 8000 端口
  return `${window.location.protocol}//${hostname}:8000`;
}
```

---

## 5. LangGraph 多智能体系统

### 5.1 架构设计模式

采用 **Coordinator/Dispatcher + 顺序流水线 (Sequential Pipeline)** 模式：

```
                        ┌──────────┐
                        │  START   │
                        └────┬─────┘
                             │
                        ┌────▼─────┐
                        │  Router  │  ← 协调者/分发器
                        │(router)  │    分析用户意图 → route_decision
                        └────┬─────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         "info"        "planning"      "editing"
              │              │              │
         ┌────▼───┐   ┌─────▼──────┐  ┌────▼──────────┐
         │  Info  │   │  Visual    │  │  Rendering    │
         │  Agent │   │  Assessor  │  │  Editor       │
         └────┬───┘   └─────┬──────┘  └────┬──────────┘
              │              │              │
             END      ┌──────▼──────┐       │
                      │ Tools Loop  │       │
                      │ (search,    │       │
                      │  cost est.) │       │
                      └──────┬──────┘       │
                             │              │
                      ┌──────▼──────┐       │
                      │   Design    │       │
                      │   Planner   │       │
                      └──────┬──────┘       │
                             │              │
                      ┌──────▼──────┐       │
                      │ Tools Loop  │       │
                      │ (timeline)  │       │
                      └──────┬──────┘       │
                             │              │
                            END      ┌──────▼──────┐
                                     │ Tools Loop  │
                                     │ (edit,list) │
                                     └──────┬──────┘
                                            │
                                           END
```

### 5.2 共享状态 (RenovationState)

所有 Agent 节点通过 `TypedDict` 状态字典共享上下文：

```python
class RenovationState(TypedDict):
    messages: List[BaseMessage]        # 消息历史（累加）
    session_id: str                    # 会话 ID
    user_id: str                       # 用户 ID
    route_decision: str                # Router 输出：info/planning/editing
    room_analysis: str                 # 视觉评估结果
    style_preferences: str             # 风格偏好
    room_type: str                     # 房间类型
    key_issues: str                    # 关键问题
    opportunities: str                 # 改造机会
    budget_constraint: str             # 预算约束
    rag_context: str                   # RAG 检索上下文
```

### 5.3 各 Agent 角色与职责

#### Router（路由分发器）
- **作用**：分析用户意图，决定后续处理链路
- **工具**：无（仅做结构化输出分类）
- **路由逻辑**：
  - 普通问题/问候 → `"info"`（Info Agent）
  - 新装修需求/图片上传 → `"planning"`（Visual Assessor → Design Planner 流水线）
  - 已有效果图需要修改 → `"editing"`（Rendering Editor）
- **容错**：分类失败时默认路由到 `"info"`

#### Info Agent（信息助手）
- **作用**：回答一般性装修问题，提供系统能力说明
- **LLM**：`get_chat_llm()` (temperature=0.7)
- **RAG 注入**：✅ 是 — 将 `rag_context` 拼接到 system prompt
- **输出**：简体中文，2-4 句的简洁回答

#### Visual Assessor（视觉评估师）
- **作用**：分析用户上传的房间照片 + 灵感图
- **LLM**：`get_vision_llm()` (temperature=0.2) — 多模态模型，可理解图片
- **工具**：`baidu_search_tool`, `estimate_renovation_cost_tool`
- **RAG 注入**：✅ 是
- **关键职责**：
  - 自动识别图片类型（现有房间 vs 灵感参考图）
  - 记录精确的空间布局（窗户/门/柜子/电器/水槽位置）
  - 输出结构化分析报告（含布局保留约束）

#### Design Planner（设计规划师）
- **作用**：基于视觉分析结果，制定具体装修方案
- **LLM**：`get_chat_llm()` (temperature=0.4)
- **工具**：`calculate_timeline_tool`
- **RAG 注入**：✅ 是
- **关键职责**：
  - 遵守"保留原始布局"的硬约束
  - 仅规划表面改造（柜面/墙面/台面/地板/灯光）
  - 输出材料清单、施工周期估算

#### Rendering Editor（效果图编辑器）
- **作用**：根据用户反馈修改已有效果图
- **LLM**：`get_chat_llm()` (temperature=0.6)
- **工具**：`edit_renovation_rendering_tool`, `list_renovation_renderings_tool`
- **RAG 注入**：❌ 当前未注入

#### Project Coordinator（项目协调员 — 渲染子图）
- **作用**：后台生成/编辑效果图（仅文字总结，不做详细方案）
- **LLM**：`get_chat_llm()` (temperature=0.6)
- **工具**：`generate_renovation_rendering_tool`, `edit_renovation_rendering_tool`, `list_renovation_renderings_tool`
- **RAG 注入**：⚠️ 代码支持但后台调用时未传入

### 5.4 主图 vs 渲染子图

| 维度 | `graph`（主图） | `render_graph`（渲染子图） |
|------|----------------|--------------------------|
| 用途 | 处理用户对话请求 | 后台异步生成效果图 |
| 触发 | SSE 流式接口即时执行 | `BackgroundTasks` 异步执行 |
| 节点 | Router → Info / VisualAssessor → DesignPlanner / RenderingEditor | ProjectCoordinator ↔ Tools Loop |
| 并发 | 阻塞用户响应 | 不阻塞主对话 |
| RAG | 流式接口传入 `rag_context` | 当前链路无 RAG 上下文 |

### 5.5 Tool ↔ Agent 绑定关系

```
info_node               → 无工具（纯文本回答）
visual_assessor_node    → baidu_search_tool, estimate_renovation_cost_tool
visual_assessor_tool_node (ToolNode) → 执行上述工具
design_planner_node     → calculate_timeline_tool
design_planner_tool_node (ToolNode)  → 执行上述工具
rendering_editor_node   → edit_renovation_rendering_tool, list_renovation_renderings_tool
rendering_editor_tool_node (ToolNode) → 执行上述工具
project_coordinator_node (render_graph) → generate_renovation_rendering_tool, edit, list
render_tool_node (ToolNode) → 执行上述工具
```

---

## 6. RAG 知识库详解

### 6.1 整体架构

```
离线构建:
  knowledge_base.json → build_index.py → [DashScope Embedding API]
                                        → embeddings.npy + metadata.json
运行时检索:
  用户 query → retriever.search() → [DashScope Embedding API] → 向量
            → numpy 余弦相似度 (query_vec @ matrix.T)
            → Top-K 结果 → build_rag_context() → 文本注入 Agent prompt
```

### 6.2 触发时机（完整链路）

```
前端 ChatInterface.tsx             后端 server.py                  agent.py
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│ ragEnabled=true  │────→│ 接收 use_rag=true    │────→│ state["rag_context"] │
│ (默认开启)       │     │                      │     │ 注入各 Agent 节点    │
│                 │     │ retriever.search()    │     │ system prompt 中     │
│ "📚 知识库"按钮  │     │ top_k=3              │     │                      │
│ 可切换开/关     │     │                      │     │ 已注入:              │
└─────────────────┘     │ build_rag_context()   │     │  - info_node         │
                        │ max_chars=900         │     │  - visual_assessor   │
                        └──────────────────────┘     │  - design_planner    │
                                                     │  - project_coordinator│
触发条件:                                              │                      │
✅ /api/chat/stream + use_rag=true                    │ 未注入:              │
✅ /api/chat-with-image/stream + use_rag=true          │  - rendering_editor  │
❌ /api/chat (非流式) — 不触发                         │  - render_graph 后台  │
❌ /api/chat-with-image (非流式) — 不触发              └──────────────────────┘
```

### 6.3 核心代码逻辑

**检索** (`rag/retriever.py`):
```python
class KnowledgeRetriever:
    def search(self, query: str, top_k: int = 3):
        query_vec = self.embed(query)                    # DashScope Embedding API
        scores = self._cosine_similarity(query_vec, self.embeddings)  # numpy matmul
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [self.metadata[i] | {"_score": scores[i]} for i in top_indices]

    def build_rag_context(self, entries, max_chars=900):
        # 拼接为结构化文本，截断到 max_chars
```

**后端触发** (`server.py`):
```python
# 在 chat_stream() 和 chat_with_image_stream() 中：
if payload.use_rag:
    retriever = get_retriever()
    entries = await retriever.search(payload.message, top_k=3)
    rag_context = retriever.build_rag_context(entries)
    input_state["rag_context"] = rag_context
```

**Agent 注入** (`agent.py`):
```python
# 典型模式（各节点通用）：
rag_context = state.get("rag_context", "")
if rag_context:
    system_prompt += f"\n\n=== 知识库检索结果 ===\n{rag_context}\n=====================\n"
```

### 6.4 设计特点

- **向量索引本地化**：运行时只需一次 query embedding（~200ms），余弦相似度在内存计算（~1ms）
- **全局单例**：`get_retriever()` 懒加载，避免重复加载索引
- **长度控制**：`build_rag_context()` 限制 900 字符，防止撑爆 context window
- **非流式不检索**：非流式接口不做 RAG，减少不必要的 Embedding API 调用

---

## 7. 关键功能实现细节

### 7.1 Structure-Locked 生图提示机制

位置：`tools.py:_build_structure_locked_prompt()`

```
原始 prompt →
  + "结构约束（必须遵守）：严格保留原始户型结构与拍摄机位，
     墙体/门窗/梁柱/地面边界与主要家具相对位置保持不变；
     只允许优化软装、配色、材质、灯光与装饰细节..."
  + "高保真要求：优先保持地面铺装走向、窗户比例、电视墙位置..."
  + "设计目标：{原始 prompt}"
```

**目的**：防止 AI 生图模型"天马行空"地改变房间结构，确保生成的效果图具有真实可落地的参考价值。

### 7.2 参考图机制

位置：`tools.py:_load_latest_current_room_reference()`

生图时自动加载会话中最新上传的"当前房间"图片作为参考图：
1. 从 `assets` 表查找 `asset_type="current_room"` 的最新记录
2. 读取图片文件 → base64 编码
3. 自动计算图片尺寸（读取宽高 → 按面积目标推算输出尺寸 → 对齐到 64px 倍数 → 限制在 768-2048 范围）
4. 作为 `reference_image` 传入 `generate_image()`

### 7.3 多协议生图适配

位置：`llm_provider.py:generate_image()`

自动根据 `IMAGE_GEN_API_BASE` 判断协议类型：

| API Base 特征 | 协议 | 模型示例 | 接口 |
|--------------|------|---------|------|
| 含 `dashscope` | DashScope 异步 | wanx-v1 | POST /services/aigc/text2image/image-synthesis → 轮询 task |
| 含 `dashscope` | DashScope 多模态 | wan2.7/wan2.6 | POST /services/aigc/multimodal-generation/generation（同步） |
| 其他 | OpenAI 兼容 | cogview-4, GLM | POST /images/generations（同步） |

DashScope wan2.x 多模态接口额外支持 `reference_image` 参数实现图生图。

### 7.4 词汇本地化替换

位置：`server.py` 中的 `HEADING_REPLACEMENTS` 和 `BRAND_REPLACEMENTS`

在流式输出前对 LLM 生成的文本做正则替换：
- 英文品牌名 → 中文通用描述
- 英文标题 → 中文标题
- 西式装修术语 → 中式装修术语

### 7.5 前端 Job 轮询机制

位置：`ChatInterface.tsx`

```
useEffect(() => {
  // 每 3 秒检查一次活跃的 Job
  const interval = setInterval(async () => {
    for (const jobId of activeRenderJobIds) {
      const result = await fetchRenderJob(jobId);
      if (result.status === 'completed') {
        // 更新消息中的渲染图
      }
    }
    for (const jobId of activeFloorplanJobIds) {
      const result = await fetchFloorplanJobStatus(jobId);
      // 更新 floorplan 分析状态
    }
  }, 3000);
  return () => clearInterval(interval);
}, [activeRenderJobIds, activeFloorplanJobIds]);
```

### 7.6 前端 RAG 开关

位置：`ChatInterface.tsx`

```tsx
const [ragEnabled, setRagEnabled] = useState(true);  // 默认开启

// 发送消息时传递：
sendChatMessageStream(..., ragEnabled);
// 或
sendChatWithImageStream(..., ragEnabled);

// UI 按钮：
<button onClick={() => setRagEnabled(!ragEnabled)}>
  📚 知识库 {ragEnabled ? '开' : '关'}
</button>
```

### 7.7 数据库设计

位置：`db.py` — 6 张表：

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `sessions` | 会话管理 | id, user_id, title, pinned, created_at, updated_at |
| `messages` | 消息记录 | id, session_id, role, content, imageUrl, references, floorplan_analysis(JSON), created_at |
| `assets` | 文件资源 | id, session_id, user_id, asset_type, filename, version, metadata(JSON), created_at |
| `message_assets` | 消息-资源关联 | message_id, asset_id |
| `render_jobs` | 渲染任务 | job_id, session_id, user_id, status, imageUrl, retryable, created_at |
| `floorplan_jobs` | 户型图分析任务 | job_id, session_id, user_id, status, image_filename, analysis(JSON), created_at |

---

## 8. 数据流全景

### 8.1 完整用户请求生命周期

```
1. 用户操作 >>> 前端
   ├─ 在 ChatInterface 输入消息
   ├─ (可选) 上传图片 (拖拽/粘贴/选择)
   ├─ (可选) 切换 RAG 开关
   └─ 点击发送

2. 前端 >>> 后端 (HTTP)
   ├─ 判断消息类型:
   │   ├─ 含户型图 → POST /api/floorplan/analyze
   │   ├─ 含图片   → POST /api/chat-with-image/stream (multipart)
   │   └─ 纯文本   → POST /api/chat/stream (JSON)
   └─ 附带: user_id, session_id, use_rag

3. 后端处理 (server.py)
   ├─ ensure_session() → 确认会话存在
   ├─ 保存上传图片 → .adk/artifacts/
   ├─ (如果 use_rag) → RAG 检索 → rag_context
   ├─ 构造 HumanMessage + input_state
   └─ graph.astream_events(input_state, config)

4. LangGraph 执行 (agent.py)
   ├─ router_node → 分类路由
   ├─ 目标节点执行 (含 tools loop)
   └─ 每个 event → yield 到 SSE

5. 后端 >>> 前端 (SSE 流)
   ├─ token 增量 → 前端逐字渲染
   ├─ agent status → 更新 Agent 状态面板
   ├─ references → 展示参考链接卡片
   ├─ image url → 展示生成的渲染图
   └─ [DONE] → 消息完成

6. 前端更新
   ├─ 消息列表更新
   ├─ 保存到 sessionStorage (失败重试草稿)
   └─ 如果有 render_job_id → 启动 3s 轮询
```

### 8.2 后台渲染任务生命周期

```
触发 → POST /api/sessions/{id}/render
  │
  ├─ 创建 render_job (status=pending)
  │
  ├─ BackgroundTasks: process_render_job()
  │   ├─ status → processing
  │   ├─ 构造 HumanMessage (从消息历史)
  │   ├─ render_graph.ainvoke()
  │   │   └─ project_coordinator_node
  │   │       └─ generate_renovation_rendering_tool
  │   │           ├─ _build_structure_locked_prompt()
  │   │           ├─ _load_latest_current_room_reference()  → base64 参考图
  │   │           ├─ generate_image() → 调用生图 API
  │   │           └─ 下载/保存 → .adk/artifacts/
  │   ├─ status → completed / failed
  │   └─ 保存 imageUrl / error message
  │
  └─ 前端轮询 (每 3s): GET /api/render-jobs/{job_id}
      └─ completed → 在聊天消息中显示效果图
      └─ failed → 显示重试按钮 (retryable=true 时)
```

---

## 9. 配置与部署

### 9.1 环境变量 (`.env`)

```bash
# LLM 配置 (OpenAI 兼容协议)
LLM_API_KEY=your_api_key          # API 密钥
LLM_API_BASE=https://open.bigmodel.cn/api/paas/v4  # API 地址
CHAT_MODEL=glm-5                  # 文本对话模型
VISION_MODEL=glm-5v-turbo         # 多模态视觉模型

# 图片生成配置
IMAGE_GEN_API_KEY=                # 为空时复用 LLM_API_KEY
IMAGE_GEN_API_BASE=               # 为空时复用 LLM_API_BASE
IMAGE_GEN_MODEL=cogview-4         # 文生图模型

# 百度搜索（可选）
BAIDU_SEARCH_API_KEY=             # 百度千帆 AI Search API Key
BAIDU_SEARCH_SECRET_KEY=          # 百度千帆 Secret Key
```

### 9.2 启动步骤

```bash
# 1. 后端
pip install -r requirements.txt

# 构建知识库索引（首次使用必执行）
python rag/build_index.py

# 启动 FastAPI 服务
python -m uvicorn server:app --host 0.0.0.0 --port 8000

# 2. 前端
cd roomGPT_frontend
npm install --registry=https://registry.npmmirror.com
npm run dev
# 打开 http://localhost:3000
```

### 9.3 健康检查

```bash
curl http://localhost:8000/api/health
# → { "status": "ok", "api_key_configured": true }

# 知识库检索测试
curl "http://localhost:8000/api/knowledge/search?q=厨房动线&limit=3"
```

---

## 10. 设计特点与注意事项

### 当前局限
- 非流式接口不支持 RAG
- 后台渲染任务未透传 `rag_context`
- `providers/`、`orchestration/`、`config/` 目录为空（预留架构扩展点）
- 3D 模型生成功能已移除（历史提交 `33ee290`："3D展示去除，新加知识库检索"）
- 内存型 checkpointer（`MemorySaver`），服务重启后不保留跨请求状态（消息持久化在 SQLite，但 LangGraph 内部状态不持久化）

### 安全设计
- 图片上传验证文件类型
- API Key 仅在 `.env` 中管理，不提交到 Git
- 用户数据通过 `user_id` 隔离

### 可扩展性
- 模型切换只需修改 `.env`（任何 OpenAI 兼容 API 可直接替换）
- 添加新 Agent 节点只需在 `agent.py` 中注册并添加路由规则
- 添加新工具只需在 `tools.py` 中定义 `@tool` 并绑定到对应 Agent 节点
