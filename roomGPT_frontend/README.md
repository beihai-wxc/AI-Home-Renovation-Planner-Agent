# roomGPT 前端（已对接本地 FastAPI）

此目录中的代码已适配为本项目前端，默认直接调用本地后端接口：

- `POST http://localhost:8000/api/chat-with-image`

当前版本不依赖 Replicate Key。是否出图取决于后端是否已配置对应大模型 API Key。

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 启动前端

```bash
npm run dev
```

3. 访问地址

- `http://localhost:3000`

## 可选环境变量

- `NEXT_PUBLIC_BACKEND_URL`

示例：

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

未设置时默认使用 `http://localhost:8000`。
