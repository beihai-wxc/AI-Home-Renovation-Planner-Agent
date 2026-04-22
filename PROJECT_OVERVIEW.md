# 🏡 Lumière - AI 智能家装规划师系统说明文档

本项目（AI Home Renovation Planner Agent）是一个整合了多模态大模型、多智能体技术和 3D 模型自动生成能力的现代家装规划与设计生成平台。

---

### 1. 前端架构及特点

**架构技术栈**：采用纯粹的前端分离架构，基于 **Next.js 13.4.x** + **React 18** 构建，样式管理使用 **Tailwind CSS**，并整合了 Framer Motion 动画库。

**核心特点**：
- **双模工作流设计**：在系统的主要工作区 `/dream` 当中，提供了两种交互模式（`generate` 快速生成模式 和 `chat` 自由交互模式），迎合不同需求深度的用户。
- **现代化组件解耦**：细化了诸多可复用组件，例如专门用于追踪 Agent 运行状态的 `AgentStatus` 组件，管理上下文对话的 `ChatHistoryPanel`，以及高交互拖拽上传的 `UploadDropZone`。
- **用户引导友好**：封装了 `QuickPrompts` (快捷词) 和 `QuickScenes` (预设风格场景) 工具，降低冷启动门槛。
- **3D 模型内嵌展示**：集成了 Google `<model-viewer>` Web Component（通过 npm 本地化部署，中国境内可访问），效果图生成后自动在对话界面展示可 360° 旋转的 3D 模型，无需跳转外部工具。

---

### 2. 后端架构及特点

**架构技术栈**：基于 **Python** + **FastAPI** 框架，提供纯净的 RESTful API + SSE 流式通讯接口服务。

**核心特点**：
- **完全 API 化与解耦**：所有核心 AI 推理逻辑剥离为底层服务（`server.py`），无缝处理前端的文字指令、多模态图片上传及流事件响应。
- **持久化及资产隔离**：通过本地 SQLite（`.adk/planner.db`）进行用户会话信息和对话流水的留存追踪；通过 Artifact 管理策略存储大模型产出的图像资源与 3D 模型文件（`.adk/artifacts/`）。
- **异步处理保障体验**：针对高耗时任务（图片生成、3D 模型生成），后端采用 LangGraph 主图 `graph` 与独立渲染子图 `render_graph` 分离执行，避免主请求阻塞；3D 生成任务通过独立的 `three_d_jobs` 表跟踪状态。
- **3D 模型自动触发**：效果图生成完成后，`process_render_job` 自动调用 `queue_3d_job`，在后台提交腾讯云混元生3D 任务，无需用户手动操作。

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
  - 渲染完成后**自动触发 3D 生成任务**，调用 `three_d_provider.py` 与腾讯云混元生3D API 交互。

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
| 图像生成渲染 | `wan2.7-image` | 阿里云百炼 / DashScope 图像生成平台 |
| 3D 模型生成 | `hunyuan-3d-2std`（极速版）/ `hunyuan-3d-2pro`（专业版） | 腾讯云混元生3D |

---

### 5. 3D 模型生成模块（新增）

**模块文件**：`three_d_provider.py`

**接入方式**：腾讯云混元生3D **OpenAI 兼容 HTTP 接口**，使用 API Key（Bearer Token）鉴权，无需 SDK，无需指定地域（自动路由）。

**调用流程**：
```
效果图（.png）
  ↓ Pillow 压缩至 ≤1024px，转 JPEG ~200-400KB
POST /v1/ai3d/submit  →  获取 task_id
  ↓ 每 5s 轮询
POST /v1/ai3d/query   →  status: processing → completed
  ↓
GET <glb_url>         →  下载 .glb 到 .adk/artifacts/
  ↓
前端 <model-viewer>    →  360° 交互预览
```

**相关 API 端点（server.py 新增）**：

| 端点 | 说明 |
|---|---|
| `POST /api/sessions/{id}/3d-model` | 手动/重试触发 3D 生成 |
| `GET /api/3d-jobs/{job_id}` | 查询 3D 任务状态、进度、模型 URL |
| `GET /api/sessions/{id}/assets/{filename}` | GLB 文件静态服务（media_type 已正确设置） |

**数据库**（`db.py` 新增 `three_d_jobs` 表）：

| 字段 | 说明 |
|---|---|
| `job_id` | 本地任务 ID |
| `session_id` | 关联会话 |
| `status` | pending / processing / completed / failed |
| `source_image` | 用于生成 3D 的 2D 效果图文件名 |
| `external_task_id` | 腾讯云返回的 task_id |
| `result_filename` | 本地 GLB 文件名 |
| `progress` | 0-100 |

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
- 产出高保真目标渲染效果图（2D）；
- **自动将 2D 效果图转换为 GLB 格式 3D 模型**，在对话中直接 360° 交互预览；
- 统筹规划，输出含承包商名录、工作时间表和项目行动清单。

**应用场景**：
- **普通房主**：低成本个人房屋翻新试错和规划平台。
- **家装设计师**：快速向潜在业主推演不同风格的效果及 3D 空间感受。
- **家居内容创作者**：室内设计风格自动迁移配图及预算预估输出。

---

### 8. 本项目的特色或创新点

- **Structure-locked 的高阶生图提示机制**：在出图核心逻辑（`_build_structure_locked_prompt`）内写死了极高强度的业务结构约束，**确保 AI 渲染图具有"落地指导意义"**，仅允许非构架修改（软装、材质、灯光色调），不会让大模型天马行空地新增窗户或打破承重墙。
- **2D → 3D 全链路自动化**：从用户上传房间图到最终 360° 可交互 3D 模型，全程自动，无需用户干预。整个流程基于异步任务队列，不阻塞主对话体验。
- **国内场景环境强自适应**：深入本地化适配（Prompt 内强制使用"平米"、"人民币"，优先国内家具采购逻辑，采用百度搜索）。所有外部 AI 服务（阿里云、腾讯云）均为国内原生，境内访问速度有保障。
- **白盒化的过程感知界面**：不再是黑盒等待。前端界面能直接显示当前是哪个专业 Agent 在为您分析，以及 3D 模型的实时生成进度（百分比进度条）。

---

### 9. 其他重要细节

- **细粒度词汇及品牌平替映射**：系统（`server.py` 内）预构建了庞大的术语正则替换表（`HEADING_REPLACEMENTS`/`BRAND_REPLACEMENTS`），将老外习惯的国外建材品牌在最终呈现前替换为国内通识性描述。
- **图片预处理**：3D 提交前用 Pillow 将效果图缩放至 ≤1024px 并转 JPEG 压缩，防止超出腾讯云 API 大小限制。
- **无障碍降级与兼容**：具备灵活的错误处理（`UPSTREAM_503_MAX_RETRIES` 网络指数重试逻辑），3D 生成失败不影响 2D 效果图的正常显示，图片生成失败也不影响文字方案的输出。
- **`<model-viewer>` 本地化部署**：通过 `npm install @google/model-viewer` 将组件打包进项目 bundle，运行时从自有服务器提供 JS 文件，不依赖任何外部 CDN，中国境内完全可访问。