"""腾讯云混元生3D — OpenAI 兼容 HTTP 接口

使用 API Key 鉴权（Bearer Token），无需 SDK，无需指定 Region。
接口文档：https://cloud.tencent.com/document/product/1917

调用流程：
  POST /v1/ai3d/submit  → 提交任务，返回 task_id
  POST /v1/ai3d/query   → 轮询状态，返回 status + 模型 URL
  GET  <model_url>      → 下载 GLB 文件到本地
"""

import asyncio
import base64
import io
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Awaitable, Callable, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
TENCENT_AI3D_API_KEY = os.getenv("TENCENT_AI3D_API_KEY", "").strip()
TENCENT_AI3D_BASE_URL = os.getenv(
    "TENCENT_AI3D_BASE_URL", "https://api.ai3d.cloud.tencent.com"
).strip().rstrip("/")
TENCENT_3D_VERSION = os.getenv("TENCENT_3D_VERSION", "rapid").strip().lower()
TENCENT_3D_MODEL = os.getenv("TENCENT_3D_MODEL", "").strip().lower()

ARTIFACT_ROOT = os.path.join(os.getcwd(), ".adk", "artifacts")

_executor = ThreadPoolExecutor(max_workers=2)


def _resolve_model_version() -> str:
    """
    将新旧配置统一映射到腾讯云 ai3d.cloud 兼容接口要求的模型版本：
    仅支持 3.0 / 3.1。
    """
    raw = (TENCENT_3D_MODEL or TENCENT_3D_VERSION or "rapid").strip().lower()
    if raw in {"pro", "3.1", "hy-3d-3.1", "hunyuan-3d-2pro", "professional"}:
        return "3.1"
    if raw in {
        "rapid",
        "std",
        "standard",
        "express",
        "3.0",
        "hy-3d-3.0",
        "hunyuan-3d-2std",
    }:
        return "3.0"

    # 未识别配置时默认走 3.0，并打印提示，避免 silent failure。
    logger.warning("未识别的 3D 模型配置值 '%s'，已回退到 model=3.0", raw)
    return "3.0"


# ---------------------------------------------------------------------------
# 图片预处理
# ---------------------------------------------------------------------------

def _compress_image_to_base64(
    filepath: str,
    max_size: int = 1024,
    jpeg_quality: int = 85,
) -> str:
    """
    读取图片，缩放至最大 max_size×max_size，转为 JPEG 后 Base64 编码。
    腾讯云限制单边分辨率 128-5000，文件大小不超过 8MB（Base64 前）。
    """
    try:
        from PIL import Image

        with Image.open(filepath) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            if max(img.width, img.height) > max_size:
                img.thumbnail((max_size, max_size), Image.LANCZOS)

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=jpeg_quality, optimize=True)
            compressed = buf.getvalue()

        logger.info(
            "图片压缩完成: %.1f KB → 准备传给腾讯云 (尺寸已缩放至 ≤%dpx)",
            len(compressed) / 1024,
            max_size,
        )
        return base64.b64encode(compressed).decode("utf-8")

    except ImportError:
        logger.warning("Pillow 未安装，使用原始图片（可能超出限制）")
        with open(filepath, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")


# ---------------------------------------------------------------------------
# HTTP 请求
# ---------------------------------------------------------------------------

def _auth_headers() -> dict:
    if not TENCENT_AI3D_API_KEY:
        raise RuntimeError(
            "腾讯云 AI3D API Key 未配置。"
            "请在 .env 中设置 TENCENT_AI3D_API_KEY（从混元生3D控制台 → API Key 管理获取）"
        )
    return {
        "Authorization": f"Bearer {TENCENT_AI3D_API_KEY}",
        "Content-Type": "application/json",
    }


def _submit_task_sync(image_base64: str) -> str:
    """同步提交图生3D任务，返回 task_id"""
    url = f"{TENCENT_AI3D_BASE_URL}/v1/ai3d/submit"

    # api.ai3d.cloud 接口要求模型版本必须是 3.0/3.1。
    model = _resolve_model_version()
    logger.info(
        "提交 3D 任务: endpoint=%s model=%s (raw_version=%s raw_model=%s)",
        url,
        model,
        TENCENT_3D_VERSION,
        TENCENT_3D_MODEL or "<empty>",
    )

    payload = {
        # 以 OpenAI 兼容字段为主，减少旧 SDK 字段歧义。
        "Model": model,
        "ImageBase64": image_base64,
    }

    resp = httpx.post(
        url,
        headers=_auth_headers(),
        json=payload,
        timeout=60.0,
    )

    try:
        data = resp.json()
    except Exception:
        raise RuntimeError(f"腾讯云 API 返回非 JSON 响应: {resp.text[:500]}")

    response_obj = data.get("Response") if isinstance(data, dict) else None
    response_error = (response_obj or {}).get("Error") if isinstance(response_obj, dict) else None

    if resp.status_code != 200 or response_error:
        code = (
            (response_error or {}).get("Code")
            or data.get("error", {}).get("code")
            or data.get("code")
            or resp.status_code
        )
        msg = (
            (response_error or {}).get("Message")
            or data.get("error", {}).get("message")
            or data.get("message")
            or resp.text
        )
        raise RuntimeError(f"提交3D任务失败 [{code}]: {msg}")

    # 兼容不同字段名
    task_id = (
        data.get("task_id")
        or data.get("taskId")
        or data.get("TaskId")
        or data.get("id")
        or (data.get("data") or {}).get("task_id")
        or (response_obj or {}).get("TaskId")
        or (response_obj or {}).get("JobId")
    )
    if not task_id:
        raise RuntimeError(f"腾讯云未返回 task_id: {data}")

    logger.info("3D 任务已提交 (model=%s): task_id=%s", model, task_id)
    return str(task_id)


def _query_task_sync(task_id: str) -> dict:
    """同步查询3D任务状态"""
    url = f"{TENCENT_AI3D_BASE_URL}/v1/ai3d/query"

    resp = httpx.post(
        url,
        headers=_auth_headers(),
        # ai3d.cloud 查询接口实际使用 JobId。
        json={"JobId": task_id},
        timeout=30.0,
    )

    try:
        data = resp.json()
    except Exception:
        raise RuntimeError(f"查询响应非 JSON: {resp.text[:500]}")

    response_obj = data.get("Response") if isinstance(data, dict) else None
    response_error = (response_obj or {}).get("Error") if isinstance(response_obj, dict) else None
    response_error_code = (response_obj or {}).get("ErrorCode")
    response_error_message = (response_obj or {}).get("ErrorMessage")

    if resp.status_code != 200 or response_error or response_error_code:
        code = (
            (response_error or {}).get("Code")
            or response_error_code
            or data.get("error", {}).get("code")
            or data.get("code")
            or resp.status_code
        )
        msg = (
            (response_error or {}).get("Message")
            or response_error_message
            or data.get("error", {}).get("message")
            or data.get("message")
            or resp.text
        )
        raise RuntimeError(f"查询3D任务失败 [{code}]: {msg}")

    # 兼容不同字段名
    raw_status = (
        (response_obj or {}).get("Status")
        or (response_obj or {}).get("status")
        or data.get("status")
        or data.get("Status")
        or (data.get("data") or {}).get("status")
        or ""
    ).upper()

    if raw_status in ("SUCCEEDED", "DONE", "COMPLETED", "SUCCESS", "FINISHED"):
        status = "completed"
    elif raw_status in ("WAIT", "QUEUED", "PENDING", "SUBMITTED", "WAITING"):
        status = "pending"
    elif raw_status in ("FAILED", "FAIL", "ERROR"):
        status = "failed"
    else:
        status = "processing"

    progress = (
        (response_obj or {}).get("Progress")
        or (response_obj or {}).get("progress")
        or data.get("progress")
        or data.get("Progress")
        or (data.get("data") or {}).get("progress")
        or 0
    )
    # 很多返回不会给进度，这里给一个阶段性兜底，避免长期显示 0%。
    if not progress:
        if status == "pending":
            progress = 10
        elif status == "processing":
            progress = 35
    if status == "completed":
        progress = 100

    # 提取 GLB URL（支持多种返回格式）
    result_urls = {}
    response_files = (
        (response_obj or {}).get("ResultFile3Ds")
        or (response_obj or {}).get("result_file_3ds")
        or []
    )
    if isinstance(response_files, list) and response_files:
        preferred_url = None
        fallback_url = None
        for item in response_files:
            if isinstance(item, str):
                fallback_url = fallback_url or item
                if item.lower().endswith(".glb"):
                    preferred_url = item
                    break
                continue
            if not isinstance(item, dict):
                continue
            file_url = (
                item.get("Url")
                or item.get("url")
                or item.get("FileUrl")
                or item.get("file_url")
                or item.get("GLB")
                or item.get("glb")
            )
            if not file_url:
                continue
            fallback_url = fallback_url or file_url
            if str(item.get("Type") or item.get("type") or "").upper() == "GLB":
                preferred_url = file_url
                break
            if str(file_url).lower().endswith(".glb"):
                preferred_url = file_url
                break
        if preferred_url or fallback_url:
            result_urls = {"glb": preferred_url or fallback_url}

    model_urls = (
        data.get("model_urls")
        or data.get("modelUrls")
        or data.get("ModelUrls")
        or (data.get("data") or {}).get("model_urls")
        or {}
    )
    if isinstance(model_urls, dict):
        if not result_urls:
            result_urls = model_urls
    elif isinstance(model_urls, list) and model_urls:
        if not result_urls:
            result_urls = {"glb": model_urls[0]}

    # 也尝试顶层的 glb/result 字段
    for key in ("glb", "result_url", "resultUrl", "model_url", "modelUrl", "url"):
        val = (
            (response_obj or {}).get(key)
            or data.get(key)
            or (data.get("data") or {}).get(key)
        )
        if val and not result_urls:
            result_urls = {"glb": val}
            break

    error_msg = (
        (response_obj or {}).get("ErrorMessage")
        or (response_obj or {}).get("error_message")
        or (response_obj or {}).get("Message")
        or data.get("error_message")
        or data.get("message")
        or (data.get("error") or {}).get("message")
        or ""
    )
    if status == "failed" and not error_msg:
        error_msg = "3D 模型生成失败（腾讯云内部错误）"

    return {
        "status": status,
        "progress": int(progress),
        "result_urls": result_urls,
        "error": error_msg,
        "raw": data,
    }


# ---------------------------------------------------------------------------
# 异步公开接口
# ---------------------------------------------------------------------------

async def submit_image_to_3d(image_path: str) -> str:
    """
    异步提交图片转3D任务。

    Args:
        image_path: 本地效果图路径（.adk/artifacts/ 下的 PNG）

    Returns:
        task_id（用于后续轮询）
    """
    if not TENCENT_AI3D_API_KEY:
        raise RuntimeError(
            "TENCENT_AI3D_API_KEY 未配置，请在 .env 中设置后重启后端"
        )
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"效果图文件不存在: {image_path}")

    image_b64 = _compress_image_to_base64(image_path)
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _submit_task_sync, image_b64)


async def query_3d_job(task_id: str) -> dict:
    """异步查询3D任务状态"""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _query_task_sync, task_id)


async def download_glb(url: str, save_filename: str) -> str:
    """下载 GLB 文件到本地 artifacts 目录"""
    os.makedirs(ARTIFACT_ROOT, exist_ok=True)
    save_path = os.path.join(ARTIFACT_ROOT, save_filename)

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        with open(save_path, "wb") as f:
            f.write(resp.content)

    size_kb = os.path.getsize(save_path) / 1024
    logger.info("GLB 文件已下载: %s (%.1f KB)", save_path, size_kb)
    return save_path


async def poll_and_download(
    job_id: str,
    save_filename: str,
    max_wait_seconds: int = 300,
    poll_interval: float = 5.0,
    progress_callback: Optional[Callable[[str, int], Awaitable[None]]] = None,
) -> dict:
    """
    轮询3D任务直到完成，然后下载 GLB。

    Returns:
        {status, glb_path, error, progress}
    """
    start_time = time.time()

    while True:
        elapsed = time.time() - start_time
        if elapsed > max_wait_seconds:
            return {
                "status": "failed",
                "glb_path": None,
                "error": f"3D 模型生成超时（等待超过 {max_wait_seconds} 秒）",
                "progress": 0,
            }

        result = await query_3d_job(job_id)
        status = result["status"]
        progress = result.get("progress", 0)

        if progress_callback is not None:
            await progress_callback(status, int(progress))

        if status == "completed":
            urls = result.get("result_urls", {})
            glb_url = None
            if isinstance(urls, dict):
                glb_url = (
                    urls.get("glb")
                    or urls.get("GLB")
                    or next(iter(urls.values()), None)
                )
            elif isinstance(urls, str):
                glb_url = urls

            if not glb_url:
                return {
                    "status": "failed",
                    "glb_path": None,
                    "error": f"3D 生成完成但未返回 GLB URL（返回内容: {result.get('raw', {})}）",
                    "progress": 100,
                }

            try:
                glb_path = await download_glb(glb_url, save_filename)
                return {"status": "completed", "glb_path": glb_path, "error": None, "progress": 100}
            except Exception as exc:
                return {
                    "status": "failed",
                    "glb_path": None,
                    "error": f"GLB 下载失败: {exc}",
                    "progress": 100,
                }

        elif status == "failed":
            return {
                "status": "failed",
                "glb_path": None,
                "error": result.get("error", "3D 模型生成失败"),
                "progress": progress,
            }

        logger.info(
            "3D 任务 %s: status=%s progress=%d%% (%.0fs elapsed)",
            job_id, status, progress, elapsed,
        )
        await asyncio.sleep(poll_interval)
