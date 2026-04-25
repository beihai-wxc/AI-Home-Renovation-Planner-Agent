# RAG 知识库功能实现说明

## 1. 功能目标

本项目的 RAG（Retrieval-Augmented Generation）用于在对话前检索本地装修知识库，把相关条目注入到 Agent 的系统提示中，提升回答的专业性和稳定性。

当前实现特征：
- 知识库数据本地化：`rag/knowledge_base.json`
- 向量索引本地化：`rag/index/embeddings.npy` + `rag/index/metadata.json`
- 在线 Embedding：查询时调用 DashScope `text-embedding-v3`
- 检索算法：`numpy` 余弦相似度 top-k
- 注入方式：将检索结果拼成 `rag_context`，作为 LangGraph `state` 的一部分传给 Agent 节点

---

## 2. 代码结构总览

RAG 相关核心文件：
- `rag/retriever.py`: 检索器核心（加载索引、Embedding、相似度检索、上下文组装）
- `rag/build_index.py`: 构建离线索引（把知识条目转成向量并落盘）
- `rag/generate_data.py`: 生成示例知识库数据（写入 `rag/knowledge_base.json`）
- `server.py`: 在 API 层触发检索并把 `rag_context` 注入 LangGraph 输入
- `agent.py`: 各 Agent 节点读取 `state["rag_context"]` 并拼接到 system prompt
- `roomGPT_frontend/utils/api.ts`: 前端将 `use_rag` 参数传给后端
- `roomGPT_frontend/components/ChatInterface.tsx`: 前端“📚 知识库”开关

---

## 3. 数据与索引如何构建

### 3.1 知识源

知识条目在 `rag/knowledge_base.json`，条目通常包含：
- `category`
- `title`
- `content`

`rag/generate_data.py` 会生成示例数据并写入该文件。

### 3.2 索引构建流程

`rag/build_index.py` 的流程：
1. 读取 `rag/knowledge_base.json`
2. 对每条数据拼接文本（分类 + 标题 + 内容）
3. 调用 `KnowledgeRetriever.embed()` 获取 1024 维向量
4. 向量矩阵保存到 `rag/index/embeddings.npy`
5. 元数据保存到 `rag/index/metadata.json`

> 若索引不存在，`retriever` 会在运行时报“知识库功能不可用”。

### 3.3 运行时加载

`KnowledgeRetriever.__init__()` 会在首次创建时尝试加载：
- `embeddings.npy`
- `metadata.json`

通过 `get_retriever()` 提供全局单例（懒加载）。

---

## 4. 查询检索实现细节

在 `rag/retriever.py` 中，检索流程为：
1. 将用户 query 调用 DashScope Embedding API 向量化
2. 与离线向量矩阵做余弦相似度计算
3. 取 top-k（默认 3）
4. 返回带 `_score` 的知识条目列表

核心函数：
- `embed(text)`
- `_cosine_similarity(query_vec, matrix)`
- `search(query, top_k=3)`
- `build_rag_context(entries, max_chars=900)`

`build_rag_context` 会把检索命中结果拼成结构化文本，用于注入 prompt，避免把整库内容塞给模型。

---

## 5. 什么时候触发知识库检索

### 5.1 纯文本流式聊天

接口：`POST /api/chat/stream`（`server.py`）

触发条件：
- 请求体里的 `use_rag` 为 `true`

处理逻辑：
- `if payload.use_rag:`
  - `retriever = get_retriever()`
  - `entries = await retriever.search(payload.message, top_k=3)`
  - `rag_context = retriever.build_rag_context(entries)`
- 将 `rag_context` 放入 `input_state` 传给 `graph.astream_events(...)`

### 5.2 图文流式聊天

接口：`POST /api/chat-with-image/stream`（`server.py`）

触发条件：
- 表单字段 `use_rag=true`

处理逻辑与纯文本流式一致，区别是输入 message 可能包含图片内容包装后的 `HumanMessage`。

### 5.3 非流式接口当前不会触发

当前 `POST /api/chat` 与 `POST /api/chat-with-image` 不做 RAG 检索（不会构造 `rag_context`）。

### 5.4 前端侧触发来源

`ChatInterface.tsx` 中有 `ragEnabled` 状态（默认 `true`），由“📚 知识库”按钮切换。

- 文本流式发送：`sendChatMessageStream(..., ragEnabled)`
- 图文流式发送：`sendChatWithImageStream(..., ragEnabled)`

在 `utils/api.ts`：
- JSON 请求：`use_rag: useRag || false`
- FormData 请求：`formData.append("use_rag", String(useRag || false))`

---

## 6. RAG 如何与 Agent 交互

### 6.1 交互核心机制

后端把检索文本放进 LangGraph state：
- `input_state = { ..., "rag_context": rag_context }`

`agent.py` 的多个节点都执行了类似逻辑：
- `rag_context = state.get("rag_context", "")`
- 若非空，拼接到各自 `system_prompt` 中

这意味着 RAG 并不是独立 Agent，而是作为“上下文增强层”注入各业务 Agent。

### 6.2 当前已注入的节点

在 `agent.py` 中，以下节点会读取并注入 RAG 内容：
- `info_node`
- `visual_assessor_node`
- `design_planner_node`
- `project_coordinator_node`（render 子图节点本身支持）

### 6.3 当前未注入的节点

- `rendering_editor_node` 当前没有注入 `rag_context`

### 6.4 一个重要现状

虽然 `project_coordinator_node` 支持读取 `rag_context`，但 `server.py` 中后台渲染任务 `process_render_job()` 调用 `render_graph.ainvoke()` 时并未传入 `rag_context`。

因此：
- 主聊天图（`graph`）在流式聊天里可以用 RAG
- 后台渲染子图（`render_graph`）当前实际链路默认拿不到 RAG 上下文

---

## 7. 端到端时序（简化）

1. 前端点击“发送”，携带 `use_rag`。
2. 后端流式接口判断 `use_rag`。
3. 若开启：调用 `retriever.search()` 检索 top-3。
4. `build_rag_context()` 组装文本。
5. 把 `rag_context` 注入 LangGraph 输入 state。
6. Agent 节点在 system prompt 中融合该上下文。
7. 模型生成回答并通过 SSE 流式返回前端。

---

## 8. 调试与验证方法

### 8.1 先确认索引是否存在

检查以下文件：
- `rag/index/embeddings.npy`
- `rag/index/metadata.json`

若不存在，先构建索引：

```bash
python rag/build_index.py
```

### 8.2 用知识库检索接口做冒烟测试

后端提供独立检索测试接口：
- `GET /api/knowledge/search?q=厨房动线&limit=3`

可快速验证 retriever 是否可用、排序是否合理。

### 8.3 观察日志

`retriever.py` 中会记录：
- 索引加载成功/失败
- 检索 query、top-k、score

若 `LLM_API_KEY` 缺失或 Embedding API 异常，会导致检索结果为空。

---

## 9. 设计取舍与注意事项

### 优点
- 向量索引本地化，查询时只做一次 query embedding，整体开销可控
- 架构简单清晰，易排查
- 与 LangGraph state 对齐，不侵入工具层

### 当前限制
- 仅流式聊天接口支持 RAG 开关
- 检索条数和上下文长度固定（top_k=3, max_chars=900）
- 未做重排（rerank）与多路召回
- 后台渲染任务未透传 `rag_context`

### 可优化方向
- 非流式接口也支持 `use_rag`
- 增加 reranker（提升命中质量）
- 为不同 Agent 设计不同检索 query 策略
- 让 render 子图按需接收 `rag_context`
- 增加检索命中阈值与来源可解释展示

---

## 10. 一句话总结

本项目 RAG 的本质是：
“前端开关控制 -> 后端按需语义检索 -> 把检索结果作为 `rag_context` 注入 LangGraph state -> 各 Agent 在 system prompt 中引用该上下文进行回答增强”。
