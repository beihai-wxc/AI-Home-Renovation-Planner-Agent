import os
import base64
import json
import httpx
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

load_dotenv()

def get_chat_llm(temperature: float = 0.7) -> ChatOpenAI:
    """获取对话推理大模型（兼容所有 OpenAI 格式的第三方接口）"""
    api_key = os.getenv("LLM_API_KEY", "")
    api_base = os.getenv("LLM_API_BASE", "https://open.bigmodel.cn/api/paas/v4")
    model = os.getenv("CHAT_MODEL", "glm-5")
    
    return ChatOpenAI(
        model=model,
        temperature=temperature,
        openai_api_key=api_key,
        openai_api_base=api_base,
    )


def get_vision_llm(temperature: float = 0.2) -> ChatOpenAI:
    """获取多模态视觉大模型"""
    api_key = os.getenv("LLM_API_KEY", "")
    api_base = os.getenv("LLM_API_BASE", "https://open.bigmodel.cn/api/paas/v4")
    model = os.getenv("VISION_MODEL", "glm-5v-turbo")
    
    return ChatOpenAI(
        model=model,
        temperature=temperature,
        openai_api_key=api_key,
        openai_api_base=api_base,
    )


def encode_image_to_base64_message(image_bytes: bytes, mime_type: str = "image/png") -> Dict[str, Any]:
    """将图片字节转换为 LangChain (OpenAI format) 多模态消息支持的格式"""
    encoded_string = base64.b64encode(image_bytes).decode('utf-8')
    image_url = f"data:{mime_type};base64,{encoded_string}"
    return {
        "type": "image_url",
        "image_url": {"url": image_url}
    }


async def generate_image(
    prompt: str,
    reference_image: Optional[str] = None,
    size: Optional[str] = None,
) -> Optional[str]:
    """
    通用文生图接口，自动适配两种协议：
    1. OpenAI 兼容协议（智谱 CogView、OpenAI DALL-E 等）→ POST /images/generations
    2. 阿里云 DashScope 协议（通义万相 wan2.x）→ 异步任务制 API

    返回图片 URL 或 base64 数据。
    """
    api_key = os.getenv("IMAGE_GEN_API_KEY", os.getenv("LLM_API_KEY", ""))
    api_base = os.getenv("IMAGE_GEN_API_BASE", os.getenv("LLM_API_BASE", "https://open.bigmodel.cn/api/paas/v4"))
    model = os.getenv("IMAGE_GEN_MODEL", "cogview-4")

    # 根据 API_BASE 判断使用哪种协议
    if "dashscope" in api_base.lower():
        return await _generate_image_dashscope(
            prompt,
            api_key,
            api_base,
            model,
            reference_image=reference_image,
            size=size,
        )
    else:
        return await _generate_image_openai_compat(prompt, api_key, api_base, model)


async def _generate_image_openai_compat(
    prompt: str, api_key: str, api_base: str, model: str
) -> Optional[str]:
    """OpenAI 兼容协议的文生图（智谱 CogView / OpenAI DALL-E 等）"""
    endpoint = api_base.rstrip("/") + "/images/generations"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "response_format": "url"
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(endpoint, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

            if "data" in data and len(data["data"]) > 0:
                if "url" in data["data"][0]:
                    return data["data"][0]["url"]
                elif "b64_json" in data["data"][0]:
                    b64 = data["data"][0]["b64_json"]
                    return f"base64,{b64}"
            return None
        except Exception as e:
            raise RuntimeError(f"图片生成请求失败 (OpenAI 协议): {e}")


async def _generate_image_dashscope(
    prompt: str,
    api_key: str,
    api_base: str,
    model: str,
    reference_image: Optional[str] = None,
    size: Optional[str] = None,
) -> Optional[str]:
    """DashScope 文生图：按模型路由到正确的接口与协议。"""
    model_key = (model or "").strip().lower()
    if model_key.startswith("wan2.7") or model_key.startswith("wan2.6"):
        return await _generate_image_dashscope_multimodal(
            prompt,
            api_key,
            api_base,
            model,
            reference_image=reference_image,
            size=size,
        )
    return await _generate_image_dashscope_async_task(
        prompt,
        api_key,
        api_base,
        model,
        size=size,
    )


async def _generate_image_dashscope_multimodal(
    prompt: str,
    api_key: str,
    api_base: str,
    model: str,
    reference_image: Optional[str] = None,
    size: Optional[str] = None,
) -> Optional[str]:
    """wan2.7/wan2.6: 使用 multimodal-generation 同步返回结果。"""
    endpoint = api_base.rstrip("/") + "/services/aigc/multimodal-generation/generation"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if reference_image:
        content_items: list[dict[str, str]] = [
            {"image": reference_image},
            {"text": f"请严格基于图1进行编辑：{prompt}"},
        ]
    else:
        content_items = [{"text": prompt}]

    payload = {
        "model": model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": content_items,
                }
            ]
        },
        "parameters": {
            "n": 1,
            "size": size or "2K",
            "watermark": False,
        },
    }

    import asyncio as _asyncio

    max_retries = 3
    last_error: Optional[str] = None
    for attempt in range(max_retries):
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                resp = await client.post(endpoint, headers=headers, json=payload)
                if resp.status_code == 429:
                    last_error = f"429 rate-limited (attempt {attempt + 1}/{max_retries})"
                    await _asyncio.sleep(3.0 * (attempt + 1))
                    continue
                if resp.status_code >= 400:
                    body = resp.text
                    raise RuntimeError(f"DashScope {resp.status_code}: {body}")
                data = resp.json()
                break
            except Exception as e:
                if isinstance(e, RuntimeError):
                    raise
                last_error = str(e)
                if attempt < max_retries - 1:
                    await _asyncio.sleep(2.0)
                    continue
                raise RuntimeError(f"DashScope 2.7/2.6 图片生成失败: {e}")
        if attempt == max_retries - 1 and last_error:
            raise RuntimeError(f"DashScope 图片生成失败（已重试{max_retries}次）: {last_error}")

    choices = (data.get("output") or {}).get("choices") or []
    if not choices:
        raise RuntimeError(f"DashScope 未返回 choices: {data}")
    content_items = ((choices[0].get("message") or {}).get("content") or [])
    for item in content_items:
        image_url = (item.get("image") or "").strip()
        if image_url:
            return image_url
    return None


async def _generate_image_dashscope_async_task(
    prompt: str,
    api_key: str,
    api_base: str,
    model: str,
    size: Optional[str] = None,
) -> Optional[str]:
    """wanx-v1 等旧接口：使用 text2image 异步任务。"""
    import asyncio

    base = api_base.rstrip("/")
    submit_url = base + "/services/aigc/text2image/image-synthesis"
    task_url_template = base + "/tasks/{task_id}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
    }
    payload = {
        "model": model,
        "input": {
            "prompt": prompt,
        },
        "parameters": {
            "n": 1,
            "size": size or "1024*1024",
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(submit_url, headers=headers, json=payload)
            resp.raise_for_status()
            submit_data = resp.json()
        except Exception as e:
            raise RuntimeError(f"DashScope 图片生成任务提交失败: {e}")

        task_id = (
            submit_data.get("output", {}).get("task_id")
            or submit_data.get("task_id")
        )
        if not task_id:
            raise RuntimeError(f"DashScope 未返回 task_id: {submit_data}")

        task_url = task_url_template.replace("{task_id}", task_id)
        poll_headers = {"Authorization": f"Bearer {api_key}"}

        max_attempts = 60
        for attempt in range(max_attempts):
            await asyncio.sleep(2)
            try:
                poll_resp = await client.get(task_url, headers=poll_headers)
                poll_resp.raise_for_status()
                task_data = poll_resp.json()
            except Exception as e:
                if attempt < max_attempts - 1:
                    continue
                raise RuntimeError(f"DashScope 任务查询失败: {e}")

            status = (task_data.get("output", {}).get("task_status", "") or "").upper()
            if status == "SUCCEEDED":
                results = task_data.get("output", {}).get("results", [])
                if results:
                    image_url = results[0].get("url") or results[0].get("image")
                    if image_url:
                        return image_url
                return None
            if status == "FAILED":
                error_msg = task_data.get("output", {}).get("message", "未知错误")
                raise RuntimeError(f"DashScope 图片生成失败: {error_msg}")

        raise RuntimeError("DashScope 图片生成超时（超过 120 秒）")

