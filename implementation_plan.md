# AI Home Renovation Planner: 前后端分离架构重构计划

## 提议更改

由于 ADK 内置的 Web UI (Angular) 定制程度有限，为了达到真正极致的 UI/UX 体验（基于之前获取的高级感和发光/玻璃拟态设计原则），我们将采用**纯粹的前后端分离**架构。

我们将保留现有的 ADK 智能体逻辑（[agent.py](file:///e:/MY_Project/AI%20Home%20Renovation%20Planner%20Agent/agent.py) 和 [tools.py](file:///e:/MY_Project/AI%20Home%20Renovation%20Planner%20Agent/tools.py)），但为其包上一层标准的 FastAPI 接口，并使用现代前端框架重写界面。

### 1. 后端改造 (Python + FastAPI)
*   **停止使用** `adk web` 命令启动内置 UI。
*   创建一个新的 [server.py](file:///e:/MY_Project/AI%20Home%20Renovation%20Planner%20Agent/server.py)，使用 FastAPI 框架。
*   引入当前的 [agent.py](file:///e:/MY_Project/AI%20Home%20Renovation%20Planner%20Agent/agent.py) 中的 `root_agent`。
*   暴露 REST API（或 WebSocket）接口供前端调用。
    *   `POST /api/chat`: 接收用户消息（和图片），调用 ADK Agent 处理，并返回 AI 的回复和渲染图 artifact 链接。
*   配置 CORS（跨域资源共享）允许前端访问。
*   提供静态资源服务，用于返回渲染生成的图片。

### 2. 前端重构 (采用开源项目 Nutlope/roomGPT)
*   **停止使用** 之前从零搭建的 Vite/React 前端。
*   克隆并引入基于 Next.js 的优秀开源项目 `Nutlope/roomGPT` 作为新的前端界面。
*   **功能适配与接口打通**：
    *   移除 RoomGPT 中原有的基于 Replicate 和支付、鉴权等相关的冗余逻辑（因为我们目前不涉及这些 SaaS 功能）。
    *   修改 RoomGPT 的前端提交逻辑，不再请求它自己的生成 API，而是将其**对接并打通到我们本地的 FastAPI 后端 (`http://localhost:8000/api/chat-with-image`)**。
*   **全面中文化 (针对国人用户)**：
    *   将 RoomGPT 前端页面（包括标题、按钮、提示语等所有可见文本）全面翻译为中文。
    *   保持其原有的优秀 UI 风格不变。
*   **清理冗余文件**：
    *   测试联调通过后，彻底删除原有的 `frontend` 文件夹以及项目中不再使用的多余代码文件。

## 验证计划

1.  运行 Python FastAPI 后端服务（运行 `python -m uvicorn server:app --host 0.0.0.0 --port 8000`）。
2.  进入 `roomGPT_frontend` 目录，安装依赖并在本地运行 Next.js 前端服务（运行 `npm install` 和 `npm run dev`）。
3.  打开前端 URL（如 `http://localhost:3000`），验证界面是否为全中文。
4.  （在有了 API Key 之后）上传图片进行测试，确保前端能够成功调用本地 FastAPI 接口，并展示生成的渲染规划和结果。
5.  确认无误后，删除旧的 `frontend` 文件夹等无用文件。
