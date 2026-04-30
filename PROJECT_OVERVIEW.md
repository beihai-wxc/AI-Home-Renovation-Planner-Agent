# 🏡 Lumière - AI 智能家装规划师系统说明文档

本项目（AI Home Renovation Planner Agent）是一个整合了多模态大模型、多智能体技术和 RAG 知识库检索的现代家装规划与设计生成平台。

---

### 1. 前端架构及特点

**架构技术栈**：采用纯粹的前端分离架构，基于 **Next.js 13.4.x** + **React 18** 构建，样式管理使用 **Tailwind CSS**，并整合了 Framer Motion 动画库。

**核心特点**：
- **双模工作流设计**：在系统的主要工作区 `/dream` 当中，提供了两种交互模式（`generate` 快速生成模式 和 `chat` 自由交互模式），迎合不同需求深度的用户。
- **现代化组件解耦**：细化了诸多可复用组件，例如专门用于追踪 Agent 运行状态的 `AgentStatus` 组件，管理上下文对话的 `ChatHistoryPanel`，以及高交互拖拽上传的 `UploadDropZone`。
- **用户引导友好**：封装了 `QuickPrompts` (快捷词) 和 `QuickScenes` (预设风格场景) 工具，降低冷启动门槛。
- **RAG 知识库开关**：聊天界面提供 "📚 知识库" 开关按钮（默认开启），用户可随时切换是否使用知识库增强回答。

---

### 2. 后端架构及特点

**架构技术栈**：基于 **Python** + **FastAPI** 框架，提供纯净的 RESTful API + SSE 流式通讯接口服务。

**核心特点**：
- **完全 API 化与解耦**：所有核心 AI 推理逻辑剥离为底层服务（`server.py`），无缝处理前端的文字指令、多模态图片上传及流事件响应。
- **持久化及资产隔离**：通过本地 SQLite（`.adk/planner.db`）进行用户会话信息和对话流水的留存追踪；通过 Artifact 管理策略存储大模型产出的图像资源与 3D 模型文件（`.adk/artifacts/`）。
- **异步处理保障体验**：针对高耗时任务（图片生成），后端采用 LangGraph 主图 `graph` 与独立渲染子图 `render_graph` 分离执行，避免主请求阻塞；渲染任务通过 `render_jobs` 表跟踪状态。
- **户型图分析流水线**：上传户型图后，Vision LLM 自动识别房间区域，支持用户手动编辑房间信息，逐房间批量生成效果图，通过 `floorplan_jobs` 表跟踪整体进度。

---

### 3. 后端集成的多 Agent 机制

系统采用了 **LangGraph** 实现高级的 **Coordinator/Dispatcher + 顺序流水线 (Sequential Pipeline)** 设计模式：

- **共享状态 (RenovationState)**：不同智能体间通过一个中心化的字典交互，内含消息历史、房屋分析、预算约束、当前需求风格等状态上下文。
- **Router Node（协调者/分发器）**：作为前置关口，自动分类用户输入。普通解答指派给 `InfoAgent`，附带新图片或设计需求则路由进入 `PlanningPipeline`，需修改图片则进入 `RenderingEditor`。
- **流水线智能协同（主对话图）**：
  - `VisualAssessor`（视觉评估师）：调用多模态模型看图，提取房屋现有户型、软装现状及待变点。
  - `DesignPlanner`（设计规划师）：基于上一步输出，撰写整体设计方案和材料预算。
- **独立渲染子图（后台生成）**：
  - `ProjectCoordinator`（项目协调员）：位于 `render_graph` 子图中，通过渲染任务接口触发，专门负责调用生图/改图工具并返回渲染结果。

---

### 4. 平台模型调用方案与解耦设计

本项目的模型调用封装在 `llm_provider.py` 中，通过轻量适配层以极致解耦的方式实现。

**核心调用方法**：
- **LangChain ChatOpenAI 原生直连**：直接利用 `langchain_openai` 库的 `ChatOpenAI` 类。由于国内各大厂商（如阿里云、通义千问）均已支持 OpenAI API 协议，系统通过覆写 `openai_api_base` 平滑接入各家国产大模型。
- **环境变量动态配置**：系统不绑定任何特定域名，完全通过读取 `.env` 指派模型走向，实现模型的即插即用。

**目前运行阶段实际调用的主要模型（基于 .env 配置）**：

| 用途 | 模型 | 平台 |
|---|---|---|
| 文本逻辑推理 | `qwen3-max` | 阿里云百炼 / DashScope |
| 多模态视觉理解 | `qwen3-vl-plus` | 阿里云百炼 / DashScope |
| 图像生成渲染 | `wan2.7-image` | 阿里云百炼 / DashScope |
| Embedding（RAG） | `text-embedding-v3` | 阿里云百炼 / DashScope |
| 百度搜索 | 千帆 AI Search | 百度智能云 |

---

### 5. 知识库检索模块（RAG）

**模块文件**：`rag/retriever.py`、`rag/build_index.py`

**接入方式**：DashScope `text-embedding-v3` API 在线 Embedding，NumPy 余弦相似度本地检索。

**调用流程**：
```
用户 query
  ↓ 后端流式接口判断 use_rag=true
调用 retriever.search(query, top_k=3)
  ↓ DashScope Embedding API (1024维)
numpy 余弦相似度 (query_vec @ matrix.T)
  ↓ 取 Top-3
build_rag_context() → 拼成结构化文本 (≤900字符)
  ↓ 注入 LangGraph state["rag_context"]
各 Agent 节点拼入 system prompt → 增强回答
```

**相关 API 端点（server.py）**：

| 端点 | 说明 |
|---|---|
| `GET /api/knowledge/search?q=&limit=` | 知识库检索测试接口 |

**触发条件**：
- `POST /api/chat/stream` + `use_rag=true`
- `POST /api/chat-with-image/stream` + `use_rag=true`
- 非流式接口（`/api/chat`、`/api/chat-with-image`）当前不支持 RAG

---

### 6. 可用能力集与网络搜索实现

智能体在运行中可以灵活挂载不同的工具（存储在 `tools.py`）。

- **网络搜索实现**：系统采用 **`baidu_search_tool`**，底层（`baidu_search.py`）使用百度千帆大模型平台的 AI Web Search 作为搜索引擎底座，合规且能获取国内语境的实效知识。
- **其他关键工具**：
  - `estimate_renovation_cost_tool`（自动预估工价物料与装修成本）
  - `calculate_timeline_tool`（根据工作范围运算工序推进排期表）
  - `generate_renovation_rendering_tool`（结合当前图与灵感调用绘图服务渲染设计结果图）
  - `edit_renovation_rendering_tool`（对渲染出的成品进行重画及局部调整）

---

### 7. 本项目的功能及应用场景

**核心功能**：
- 智能扫描照片空间，提取结构、测算尺寸及缺陷；
- 在设定资金限额内自动规划高性价比的硬装修与软装升级路线；
- 产出高保真目标渲染效果图（2D），通过 structure-locked 提示保证布局不变；
- RAG 知识库增强：80 条装修知识自动语义检索并注入 Agent system prompt；
- 户型图智能分析：上传户型图，Vision LLM 识别房间区域，逐房间批量生成效果图；
- 统筹规划，输出含承包商名录、工作时间表和项目行动清单。

**应用场景**：
- **普通房主**：低成本个人房屋翻新试错和规划平台。
- **家装设计师**：快速向潜在业主推演不同风格的设计效果。
- **家居内容创作者**：室内设计风格自动迁移配图及预算预估输出。

---

### 8. 本项目的特色或创新点

- **Structure-locked 的高阶生图提示机制**：在出图核心逻辑（`_build_structure_locked_prompt`）内写死了极高强度的业务结构约束，**确保 AI 渲染图具有"落地指导意义"**，仅允许非构架修改（软装、材质、灯光色调），不会让大模型天马行空地新增窗户或打破承重墙。
- **多协议生图适配**：`generate_image()` 自动判断 API 类型（OpenAI 兼容 / DashScope 异步 / DashScope 多模态 wan2.x），一套接口适配多种生图服务。
- **国内场景环境强自适应**：深入本地化适配（Prompt 内强制使用"平米"、"人民币"，优先国内家具采购逻辑，采用百度搜索）。AI 服务均为国内原生，境内访问速度有保障。
- **白盒化的过程感知界面**：不再是黑盒等待。前端界面能直接显示当前是哪个专业 Agent 在为您分析，以及效果图生成任务的实时状态。

---

### 9. 其他重要细节

- **细粒度词汇及品牌平替映射**：系统（`server.py` 内）预构建了庞大的术语正则替换表（`HEADING_REPLACEMENTS`/`BRAND_REPLACEMENTS`），将老外习惯的国外建材品牌在最终呈现前替换为国内通识性描述。
- **图片预处理**：生图前用 Pillow 读取参考图尺寸，自动计算输出尺寸（按面积目标推算 → 对齐到 64px → 限制在 768-2048 范围），防止超出 AI API 大小限制。
- **无障碍降级与兼容**：具备灵活的错误处理（`UPSTREAM_503_MAX_RETRIES` 网络指数重试逻辑），图片生成失败也不影响文字方案的输出。
- **RAG 知识库可控开关**：前端 "📚 知识库" 按钮让用户自由控制是否启用知识库检索，后端按需触发 Embedding API，不浪费调用额度。