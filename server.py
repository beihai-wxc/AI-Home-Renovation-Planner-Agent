import os
import uuid
import logging
import json
from typing import Optional, List, AsyncGenerator
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from agent import root_agent

# Initialize environment & logging
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI App
app = FastAPI(title="AI Home Renovation Planner API")

frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
)
allowed_origins = [origin.strip() for origin in frontend_origins.split(",") if origin.strip()]

# Setup CORS for local Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure artifacts directory exists for serving generated images
ARTIFACTS_DIR = os.path.join(os.getcwd(), ".adk", "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)
app.mount("/artifacts", StaticFiles(directory=ARTIFACTS_DIR), name="artifacts")

# Global variables for session/engine
runner = None
DEFAULT_USER = "frontend_user"
DEFAULT_SESSION = "main_session"

@app.on_event("startup")
async def startup_event():
    global runner
    from google.adk.runners import Runner
    from google.adk.sessions.in_memory_session_service import InMemorySessionService
    from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService

    session_service = InMemorySessionService()
    artifact_service = InMemoryArtifactService()

    # Create the ADK Runner with the root agent
    runner = Runner(
        agent=root_agent,
        app_name="AI_Home_Renovation",
        session_service=session_service,
        artifact_service=artifact_service,
        auto_create_session=True
    )
    logger.info("ADK Runner initialized and ready.")

class ChatRequest(BaseModel):
    message: str
    user_id: str = DEFAULT_USER
    session_id: str = DEFAULT_SESSION

class ChatResponse(BaseModel):
    message: str
    imageUrl: Optional[str] = None
    artifacts: List[str] = []


async def stream_text_events(events: AsyncGenerator) -> AsyncGenerator[str, None]:
    """流式输出文本事件"""
    async for event in events:
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    # 实时输出每个文本片段
                    yield part.text


async def stream_with_image_events(events: AsyncGenerator) -> AsyncGenerator[str, None]:
    """流式输出文本事件（带图片的版本）"""
    async for event in events:
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    yield part.text


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Standard text-only chat endpoint with streaming support.

    支持 query 参数:
    - stream=false: 返回普通 JSON 响应（完整消息）
    - stream=true: 返回流式响应（实时输出）
    """
    if "GOOGLE_API_KEY" not in os.environ and "GEMINI_API_KEY" not in os.environ:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_API_KEY environment variable. Please configure it in .env")

    try:
        from google.genai import types
        message_content = types.Content(role="user", parts=[types.Part.from_text(text=request.message)])
        events = runner.run_async(
            user_id=request.user_id,
            session_id=request.session_id,
            new_message=message_content
        )

        reply_texts = []
        async for event in events:
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        reply_texts.append(part.text)

        reply_text = "".join(reply_texts)
        return ChatResponse(
            message=reply_text,
            artifacts=[]
        )
    except Exception as e:
        logger.error(f"Error during chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    """
    流式文本对话端点 - 实时输出 AI 回复

    使用 SSE (Server-Sent Events) 格式返回
    """
    if "GOOGLE_API_KEY" not in os.environ and "GEMINI_API_KEY" not in os.environ:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_API_KEY environment variable. Please configure it in .env")

    try:
        from google.genai import types
        message_content = types.Content(role="user", parts=[types.Part.from_text(text=request.message)])
        events = runner.run_async(
            user_id=request.user_id,
            session_id=request.session_id,
            new_message=message_content
        )

        async def event_stream():
            """生成 SSE 格式的流式响应"""
            async for event in events:
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            # SSE 格式: data: <内容>
                            yield f"data: {json.dumps({'content': part.text})}\n\n"
            # 发送结束标记
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    except Exception as e:
        logger.error(f"Error during chat stream: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat-with-image/stream")
async def chat_with_image_stream_endpoint(
    message: str = Form(...),
    image: UploadFile = File(None),
    image_type: str = Form("current_room"), # "current_room" or "inspiration"
    user_id: str = Form(DEFAULT_USER),
    session_id: str = Form(DEFAULT_SESSION)
):
    """
    流式带图片对话端点 - 实时输出 AI 回复和图片链接
    """
    if "GOOGLE_API_KEY" not in os.environ and "GEMINI_API_KEY" not in os.environ:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_API_KEY environment variable.")

    try:
        image_artifact_url = None

        if image:
            # Read image content
            image_data = await image.read()
            mime_type = image.content_type

            # Save the raw image as an artifact first
            artifact_name = f"{image_type}_{uuid.uuid4().hex[:8]}.{image.filename.split('.')[-1]}"

            # ADK's storage logic expects artifacts in .adk/artifacts/<user>/<sess>/
            user_sess_dir = os.path.join(ARTIFACTS_DIR, user_id, session_id)
            os.makedirs(user_sess_dir, exist_ok=True)

            file_path = os.path.join(user_sess_dir, artifact_name)
            with open(file_path, "wb") as f:
                f.write(image_data)

            # Create a Google GenAI Part from bytes for the LLM request
            from google.genai import types
            image_part = types.Part.from_bytes(data=image_data, mime_type=mime_type)
            text_part = types.Part.from_text(text=message)
            message_content = types.Content(role="user", parts=[text_part, image_part])

            # Now run the runner passing BOTH the text and the image part
            events = runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=message_content
            )
        else:
            from google.genai import types
            # Fallback to standard text run
            message_content = types.Content(role="user", parts=[types.Part.from_text(text=message)])
            events = runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=message_content
            )

        async def event_stream():
            """生成 SSE 格式的流式响应"""
            async for event in events:
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            # SSE 格式: data: <内容>
                            yield f"data: {json.dumps({'type': 'content', 'content': part.text})}\n\n"

            # 获取最新生成的图片 URL
            latest_image_url = None
            user_sess_dir = os.path.join(ARTIFACTS_DIR, user_id, session_id)
            if os.path.exists(user_sess_dir):
                files = [os.path.join(user_sess_dir, f) for f in os.listdir(user_sess_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
                if files:
                    files.sort(key=os.path.getmtime, reverse=True)
                    latest_file = os.path.basename(files[0])
                    latest_image_url = f"http://localhost:8000/artifacts/{user_id}/{session_id}/{latest_file}"

            # 发送图片链接（如果有）
            if latest_image_url:
                yield f"data: {json.dumps({'type': 'image', 'url': latest_image_url})}\n\n"

            # 发送结束标记
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    except Exception as e:
        logger.error(f"Error during chat-with-image stream: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat-with-image", response_model=ChatResponse)
async def chat_with_image_endpoint(
    message: str = Form(...),
    image: UploadFile = File(None),
    image_type: str = Form("current_room"), # "current_room" or "inspiration"
    user_id: str = Form(DEFAULT_USER),
    session_id: str = Form(DEFAULT_SESSION)
):
    """
    Chat endpoint handling uploaded image files (non-streaming version).
    """
    if "GOOGLE_API_KEY" not in os.environ and "GEMINI_API_KEY" not in os.environ:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_API_KEY environment variable.")

    try:
        if image:
            # Read image content
            image_data = await image.read()
            mime_type = image.content_type

            # Save the raw image as an artifact first (simulating what Visual Assessor might do)
            artifact_name = f"{image_type}_{uuid.uuid4().hex[:8]}.{image.filename.split('.')[-1]}"

            # ADK's storage logic expects artifacts in .adk/artifacts/<user>/<sess>/
            user_sess_dir = os.path.join(ARTIFACTS_DIR, user_id, session_id)
            os.makedirs(user_sess_dir, exist_ok=True)

            file_path = os.path.join(user_sess_dir, artifact_name)
            with open(file_path, "wb") as f:
                f.write(image_data)

            # Create a Google GenAI Part from bytes for the LLM request
            from google.genai import types
            image_part = types.Part.from_bytes(data=image_data, mime_type=mime_type)
            text_part = types.Part.from_text(text=message)
            message_content = types.Content(role="user", parts=[text_part, image_part])

            # Now run the runner passing BOTH the text and the image part
            events = runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=message_content
            )

        else:
            from google.genai import types
            # Fallback to standard text run
            message_content = types.Content(role="user", parts=[types.Part.from_text(text=message)])
            events = runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=message_content
            )

        reply_texts = []
        async for event in events:
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        reply_texts.append(part.text)

        reply_text = "".join(reply_texts)

        # After the run, let's find the latest visual artifact (rendering)
        # The prompt usually generates a rendering as a file artifact
        latest_image_url = None
        user_sess_dir = os.path.join(ARTIFACTS_DIR, user_id, session_id)
        if os.path.exists(user_sess_dir):
            # Find the most recently modified file that isn't the input image
            files = [os.path.join(user_sess_dir, f) for f in os.listdir(user_sess_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
            if files:
                # Sort by creation time
                files.sort(key=os.path.getmtime, reverse=True)
                latest_file = os.path.basename(files[0])
                latest_image_url = f"http://localhost:8000/artifacts/{user_id}/{session_id}/{latest_file}"

        return ChatResponse(
            message=reply_text,
            imageUrl=latest_image_url
        )

    except Exception as e:
        logger.error(f"Error during chat-with-image: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    has_key = "GOOGLE_API_KEY" in os.environ or "GEMINI_API_KEY" in os.environ
    return {"status": "ok", "api_key_configured": has_key}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
