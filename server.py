import asyncio
import json
import logging
import os
import re
import uuid
from html import unescape
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import urlopen
from typing import Any, AsyncGenerator, Callable, Optional

from baidu_search import baidu_web_search

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

from agent import graph, render_graph
from llm_provider import encode_image_to_base64_message
from langchain_core.messages import HumanMessage
from db import (
    create_render_job,
    create_3d_job,
    delete_session,
    ensure_session,
    get_render_job,
    get_3d_job,
    get_messages,
    init_db,
    list_sessions,
    save_asset,
    save_message,
    save_message_assets,
    set_session_pinned,
    session_state_snapshot,
    update_render_job,
    update_3d_job,
)


load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_NAME = "AI_Home_Renovation"
DEFAULT_USER = "frontend_user"
DEFAULT_SESSION = "main_session"
ARTIFACT_ROOT = os.path.join(os.getcwd(), ".adk", "artifacts")
IMAGE_GENERATION_MODE = os.getenv("IMAGE_GENERATION_MODE", "local_mock").strip().lower()
FRONTEND_PUBLIC_ROOT = Path(os.getenv("FRONTEND_PUBLIC_ROOT", Path(os.getcwd()) / "roomGPT_frontend" / "public"))
LOCAL_ORIGINAL_DIR = Path(os.getenv("LOCAL_ORIGINAL_DIR", FRONTEND_PUBLIC_ROOT / "local-images" / "original"))
LOCAL_RENDERED_DIR = Path(os.getenv("LOCAL_RENDERED_DIR", FRONTEND_PUBLIC_ROOT / "local-images" / "rendered"))
# (Google CSE removed — 搜索功能已迁移到百度千帆 AI 搜索，见 baidu_search.py)
QUICK_GENERATE_USER = "quick_generate_user"
UPSTREAM_503_MAX_RETRIES = max(0, int(os.getenv("UPSTREAM_503_MAX_RETRIES", "2")))
UPSTREAM_503_BACKOFF_SECONDS = max(0.2, float(os.getenv("UPSTREAM_503_BACKOFF_SECONDS", "1.0")))

app = FastAPI(title="AI Home Renovation Planner API")

frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
allowed_origins = [origin.strip() for origin in frontend_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# (ADK runner/artifact_service removed - now using LangGraph graph objects from agent.py)

USD_TO_CNY = 7.2
HEADING_REPLACEMENTS = {
    "Current Space Analysis": "现有空间分析",
    "Room Details": "空间信息",
    "Design Summary": "设计摘要",
    "Budget Breakdown": "预算拆分",
    "Timeline": "周期安排",
    "Action Checklist": "执行清单",
    "Images Provided": "图片输入情况",
    "Improvement Opportunities": "可优化点",
    "Budget Constraint": "预算约束",
    "ASSESSMENT COMPLETE": "分析完成",
    "DESIGN COMPLETE": "设计完成",
    "Materials Summary": "材料清单摘要",
    "Current Analysis": "现状分析",
    "Desired Style": "目标风格",
    "Key Issues": "关键问题",
    "Special features": "特殊结构",
    "Camera angle": "拍摄视角",
    "Contractors Needed": "建议工种",
}
TERM_REPLACEMENTS = {
    "sq ft": "平方英尺",
    "square feet": "平方英尺",
    "square foot": "平方英尺",
    "Current room photo": "当前房间图",
    "Inspiration photo": "灵感图",
    "Must-haves": "优先投入",
    "Nice-to-haves": "可选升级",
    "Layout": "布局",
    "Renovation Scope": "改造范围",
    "Surface Finish Changes": "表面改造项",
    "Moderate (surface finishes & soft furnishings only)": "中度改造（仅表面翻新与软装优化）",
    "PRESERVED EXACTLY": "完全保留",
    "Budget-Conscious Approach": "预算策略",
    "Design Specifications": "设计规格",
}
BRAND_REPLACEMENTS = {
    "Benjamin Moore": "高品质乳胶漆",
    "West Elm": "现代家居品牌",
    "Article": "现代家具品牌",
    "Architectural Digest": "高端家居杂志风格",
}


class ChatRequest(BaseModel):
    message: str
    user_id: str = DEFAULT_USER
    session_id: str = DEFAULT_SESSION


class ChatResponse(BaseModel):
    message: str
    imageUrl: Optional[str] = None
    references: Optional[list[dict[str, str]]] = None


class SessionResponse(BaseModel):
    session_id: str
    title: Optional[str] = None
    latest_user_message: Optional[str] = None
    pinned: bool = False
    created_at: str
    updated_at: str


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    imageUrl: Optional[str] = None
    attachments: Optional[list[dict[str, str]]] = None
    references: Optional[list[dict[str, str]]] = None
    created_at: str


class RenderJobResponse(BaseModel):
    job_id: str
    status: str
    imageUrl: Optional[str] = None
    message: Optional[str] = None
    retryable: bool = False
    threeDJobId: Optional[str] = None


class LocalRenderResponse(BaseModel):
    mode: str
    imageUrl: Optional[str] = None
    originalImageUrl: Optional[str] = None
    message: Optional[str] = None


class GoogleLinksRequest(BaseModel):
    query: str
    max_results: int = 5


class VisionShoppingResponse(BaseModel):
    message: str
    references: Optional[list[dict[str, str]]] = None


class PromptRecommendationsResponse(BaseModel):
    prompts: list[str]


def require_api_key() -> None:
    if "LLM_API_KEY" not in os.environ:
        raise HTTPException(
            status_code=500,
            detail="Missing LLM_API_KEY. Please configure it in the local .env file.",
        )


async def ensure_adk_session(user_id: str, session_id: str):
    return True


def build_asset_url(request: Request, session_id: str, filename: str, user_id: str) -> str:
    return str(
        request.url_for(
            "get_asset",
            session_id=session_id,
            filename=filename,
        ).include_query_params(user_id=user_id)
    )


async def save_uploaded_asset(
    *,
    file: UploadFile,
    asset_type: str,
    user_id: str,
    session_id: str,
) -> tuple[str, int, Any]:
    image_data = await file.read()
    if not image_data:
        raise HTTPException(status_code=400, detail=f"Uploaded {asset_type} image is empty.")

    extension = os.path.splitext(file.filename or "")[1] or ".png"
    artifact_filename = f"{asset_type}_{uuid.uuid4().hex[:8]}{extension}"
    
    filepath = os.path.join(ARTIFACT_ROOT, artifact_filename)
    with open(filepath, "wb") as f:
        f.write(image_data)
        
    version = 1
    # Simple version handling
    save_asset(
        session_id=session_id,
        user_id=user_id,
        filename=artifact_filename,
        asset_type=asset_type,
        version=version,
        metadata={"original_filename": file.filename},
    )
    b64_msg = encode_image_to_base64_message(image_data, file.content_type or "image/png")
    return artifact_filename, version, b64_msg


async def prepare_message_content(
    *,
    message: str,
    user_id: str,
    session_id: str,
    current_room_images: list[UploadFile] | None = None,
    inspiration_images: list[UploadFile] | None = None,
    current_room_image: UploadFile | None = None,
    image: UploadFile | None = None,
):
    

    parts = [{"type": "text", "text": message}]
    uploaded_assets: list[dict[str, str]] = []
    session = await ensure_adk_session(user_id=user_id, session_id=session_id)

    upload_queue: list[tuple[UploadFile, str]] = []
    if current_room_images:
        upload_queue.extend([(file, "current_room") for file in current_room_images if file is not None])
    if inspiration_images:
        upload_queue.extend([(file, "inspiration") for file in inspiration_images if file is not None])
    if current_room_image:
        upload_queue.append((current_room_image, "current_room"))
    elif image:
        upload_queue.append((image, "current_room"))

    for upload, asset_type in upload_queue:
        artifact_filename, version, image_part = await save_uploaded_asset(
            file=upload,
            asset_type=asset_type,
            user_id=user_id,
            session_id=session_id,
        )
        uploaded_assets.append({"filename": artifact_filename, "asset_type": asset_type})

        parts.append(image_part)

    return HumanMessage(content=parts), uploaded_assets



# (ADK extract_reply_text / retry helpers removed - LangGraph uses graph.ainvoke / astream_events)



async def get_result_image_filename(user_id: str, session_id: str) -> Optional[str]:
    """Read latest generated image filename from the DB state snapshot."""
    state = session_state_snapshot(session_id=session_id, user_id=user_id)
    return state.get("latest_result_image") or state.get("last_generated_rendering")


async def stream_text_sse(text: str, *, chunk_size: int = 28) -> AsyncGenerator[str, None]:
    if not text:
        return
    normalized = text.replace("\r\n", "\n")
    for index in range(0, len(normalized), chunk_size):
        chunk = normalized[index:index + chunk_size]
        yield f"data: {json.dumps({'type': 'content', 'content': chunk})}\n\n"
        await asyncio.sleep(0)


def _format_cny_value(value: float) -> str:
    if value >= 10000:
        rounded = round(value / 10000, 1)
        trailing = ".0" if rounded == int(rounded) else ""
        return f"{rounded}{trailing}万元".replace(".0万元", "万元")
    return f"{int(round(value)):,}元"


def normalize_currency_ranges(text: str) -> str:
    def replace_range(match: re.Match[str]) -> str:
        low = int(match.group(1).replace(",", ""))
        high = int(match.group(2).replace(",", ""))
        return (
            f"约人民币 {_format_cny_value(low * USD_TO_CNY)} - {_format_cny_value(high * USD_TO_CNY)}"
            "（按当前预设汇率估算）"
        )

    def replace_single(match: re.Match[str]) -> str:
        amount = int(match.group(1).replace(",", ""))
        return f"约人民币 {_format_cny_value(amount * USD_TO_CNY)}（按当前预设汇率估算）"

    text = re.sub(r"\$([\d,]+)\s*-\s*\$([\d,]+)", replace_range, text)
    text = re.sub(r"(?<![\w$])\$([\d,]+)(?!\s*-\s*\$)", replace_single, text)
    return text


def normalize_area_units(text: str) -> str:
    def replace_area(match: re.Match[str]) -> str:
        value = float(match.group(1).replace(",", ""))
        sqm = round(value * 0.0929, 1)
        if sqm.is_integer():
            sqm_text = f"{int(sqm)}"
        else:
            sqm_text = f"{sqm}"
        original = int(value) if value.is_integer() else value
        return f"约 {sqm_text} 平方米（{original} 平方英尺）"

    patterns = [
        r"(\d+(?:\.\d+)?)\s*(?:sq ft|square feet|square foot)",
        r"(\d+(?:\.\d+)?)\s*平方英尺",
    ]
    for pattern in patterns:
        text = re.sub(pattern, replace_area, text, flags=re.IGNORECASE)
    return text


def dedupe_repeated_lines(text: str) -> str:
    lines = text.splitlines()
    result: list[str] = []
    previous_normalized = ""
    for line in lines:
        normalized = re.sub(r"\s+", " ", line).strip()
        if normalized and normalized == previous_normalized:
            continue
        result.append(line)
        if normalized:
            previous_normalized = normalized
    return "\n".join(result)


def normalize_assistant_output(text: str) -> str:
    if not text:
        return text

    normalized = text.replace("\r\n", "\n")
    normalized = re.sub(r"^\s*(?:```|~~~)[^\n]*\n", "", normalized)
    normalized = re.sub(r"\n\s*(?:```|~~~)\s*$", "", normalized)
    normalized = re.sub(r"^\s*(?:```|~~~)[^\n]*$", "", normalized, flags=re.MULTILINE)
    for source, target in HEADING_REPLACEMENTS.items():
        normalized = normalized.replace(source, target)
    for source, target in TERM_REPLACEMENTS.items():
        normalized = normalized.replace(source, target)
    for source, target in BRAND_REPLACEMENTS.items():
        normalized = normalized.replace(source, target)

    normalized = normalize_currency_ranges(normalized)
    normalized = normalize_area_units(normalized)
    normalized = re.sub(r"Renovation\s*Scope\s*:", "改造范围：", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"Surface\s*Finish\s*Changes\s*:", "表面改造项：", normalized, flags=re.IGNORECASE)
    normalized = re.sub(
        r"Layout\s*:\s*PRESERVED\s*EXACTLY",
        "布局：完全保留",
        normalized,
        flags=re.IGNORECASE,
    )
    normalized = re.sub(r"\*\*Images Provided:\*\*", "**图片输入情况：**", normalized)
    normalized = re.sub(r"\*\*Room Details:\*\*", "**空间信息：**", normalized)
    normalized = re.sub(r"\*\*EXACT LAYOUT TO PRESERVE.*?\*\*", "**需保留的原始布局：**", normalized)
    normalized = re.sub(r"\bsoft cream color\b", "柔和奶油色", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\bmodern farmhouse\b", "现代 farmhouse 风格", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\bScandi-Rustic\b", "现代北欧原木风", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\bCurrent room\b", "当前空间", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\bInspiration\b", "灵感参考", normalized, flags=re.IGNORECASE)
    normalized = dedupe_repeated_lines(normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()
    return normalized


def should_include_price_links(user_text: str, assistant_text: str) -> bool:
    keywords = [
        "价格",
        "报价",
        "预算",
        "材料",
        "建材",
        "品牌",
        "购买",
        "哪里买",
        "链接",
        "参考价",
        "单价",
    ]
    merged = f"{user_text}\n{assistant_text}".lower()
    return any(keyword in merged for keyword in keywords)


def strip_html(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", unescape(cleaned)).strip()


def find_existing_file_by_stem(directory: Path, stem: str) -> Optional[Path]:
    if not directory.exists():
        return None
    patterns = [f"{stem}.png", f"{stem}.jpg", f"{stem}.jpeg", f"{stem}.webp"]
    for name in patterns:
        candidate = directory / name
        if candidate.exists():
            return candidate
    for candidate in directory.iterdir():
        if candidate.is_file() and candidate.stem.lower() == stem.lower():
            return candidate
    return None


def find_existing_file_by_name(directory: Path, filename: str) -> Optional[Path]:
    if not directory.exists():
        return None
    target = filename.strip()
    if not target:
        return None
    exact = directory / target
    if exact.exists() and exact.is_file():
        return exact
    lowered = target.lower()
    for candidate in directory.iterdir():
        if candidate.is_file() and candidate.name.lower() == lowered:
            return candidate
    return None


def find_matching_file_by_stems(directory: Path, stems: list[str]) -> Optional[Path]:
    if not directory.exists():
        return None

    normalized_stems = [stem.strip() for stem in stems if stem and stem.strip()]
    if not normalized_stems:
        return None

    for stem in normalized_stems:
        matched = find_existing_file_by_stem(directory, stem)
        if matched:
            return matched

    lowered_stems = [stem.lower() for stem in normalized_stems]
    for candidate in directory.iterdir():
        if not candidate.is_file():
            continue
        candidate_stem = candidate.stem.lower()
        if any(candidate_stem.startswith(stem) for stem in lowered_stems):
            return candidate
    return None


def resolve_local_image_dirs() -> tuple[Path, Path]:
    original_dir = LOCAL_ORIGINAL_DIR
    rendered_dir = LOCAL_RENDERED_DIR
    if original_dir.exists() and rendered_dir.exists():
        return original_dir, rendered_dir

    search_roots: list[Path] = []
    if FRONTEND_PUBLIC_ROOT.exists():
        search_roots.append(FRONTEND_PUBLIC_ROOT)
    search_roots.append(Path(os.getcwd()))

    def scan_dirs(root: Path) -> list[Path]:
        found: list[Path] = []
        try:
            for path in root.rglob("*"):
                if path.is_dir():
                    found.append(path)
        except Exception:
            return found
        return found

    all_dirs: list[Path] = []
    for root in search_roots:
        all_dirs.extend(scan_dirs(root))

    def find_dir(keyword: str) -> Optional[Path]:
        for folder in all_dirs:
            if keyword in folder.name:
                return folder
        return None

    original_fallback = find_dir("原始")
    rendered_fallback = find_dir("渲染")
    return original_fallback or original_dir, rendered_fallback or rendered_dir


def get_local_library_roots() -> list[Path]:
    roots: list[Path] = []
    for root in [Path(os.getcwd()), FRONTEND_PUBLIC_ROOT]:
        resolved = root.resolve()
        if resolved not in roots:
            roots.append(resolved)
    return roots


def relative_local_library_path(file_path: Path) -> Optional[str]:
    resolved = file_path.resolve()
    for root in get_local_library_roots():
        try:
            return resolved.relative_to(root).as_posix()
        except ValueError:
            continue
    return None


def normalize_style_label(style: str) -> str:
    aliases = {
        "简约风": "极简风",
        "极简风": "极简风",
        "modern": "现代风",
        "现代风": "现代风",
        "现代北欧风": "现代北欧风",
        "vintage": "复古风",
        "复古风": "复古风",
        "professional": "商务风",
        "商务风": "商务风",
        "tropical": "热带风",
        "热带风": "热带风",
    }
    key = (style or "").strip()
    return aliases.get(key.lower(), aliases.get(key, key))


def normalize_room_label(room: str) -> str:
    aliases = {
        "living room": "客厅",
        "客厅": "客厅",
        "bedroom": "卧室",
        "卧室": "卧室",
        "房间": "卧室",
    }
    key = (room or "").strip()
    return aliases.get(key.lower(), aliases.get(key, key))


def resolve_room_library_dir(room: str) -> Optional[Path]:
    normalized_room = normalize_room_label(room)
    if not normalized_room:
        return None

    for root in get_local_library_roots():
        try:
            for candidate in root.iterdir():
                if (
                    candidate.is_dir()
                    and candidate.name.startswith("一转五风格_")
                    and normalized_room in candidate.name
                ):
                    return candidate
        except FileNotFoundError:
            continue
    return None


def extract_render_index_from_filename(filename: str) -> Optional[str]:
    stem = Path(filename or "").stem.strip()
    if not stem:
        return None

    b_match = re.search(r"(?i)B(\d+)", stem)
    if b_match:
        return b_match.group(1)

    trailing_digit_match = re.search(r"(\d)$", stem)
    if trailing_digit_match:
        return trailing_digit_match.group(1)

    return None


def resolve_local_render_mapping(
    *,
    original_filename: Optional[str],
    style: Optional[str],
    room: Optional[str] = None,
) -> dict[str, Optional[str]]:
    style = (style or "").strip()
    original_filename = (original_filename or "").strip()
    normalized_style = normalize_style_label(style)
    normalized_room = normalize_room_label(room or "")
    default_style_map = {
        "简约风": "简约风",
        "极简风": "简约风",
        "现代北欧风": "现代北欧风",
        "现代风": "现代北欧风",
    }

    original_dir, rendered_dir = resolve_local_image_dirs()

    if original_filename:
        stem = Path(original_filename).stem
        render_index = extract_render_index_from_filename(original_filename)
        if render_index:
            mapped_stem = f"A{render_index}"
            rendered = find_existing_file_by_stem(rendered_dir, mapped_stem)
            original = find_existing_file_by_name(original_dir, Path(original_filename).name)
            if not original:
                original = find_matching_file_by_stems(original_dir, [stem, f"B{render_index}"])
            if not rendered:
                return {"image_url": None, "message": f"未找到与 {stem} 对应的渲染图（期望 {mapped_stem}）。"}
            return {
                "image_filename": rendered.name,
                "image_kind": "rendered",
                "original_filename": original.name if original else None,
                "original_kind": "original" if original else None,
                "message": None,
            }

    if normalized_room:
        room_dir = resolve_room_library_dir(normalized_room)
        if room_dir:
            rendered = find_matching_file_by_stems(room_dir, [normalized_style, style])
            original = find_matching_file_by_stems(
                room_dir,
                [normalized_room, "原图", "原图1"],
            )
            if rendered:
                return {
                    "image_filename": rendered.name,
                    "image_kind": "library",
                    "image_path": relative_local_library_path(rendered),
                    "original_filename": original.name if original else None,
                    "original_kind": "library" if original else None,
                    "original_path": relative_local_library_path(original) if original else None,
                    "message": None,
                }

    style_key = default_style_map.get(normalized_style) or default_style_map.get(style)
    if not style_key:
        if normalized_room:
            return {
                "image_url": None,
                "message": "图片生成失败",
            }
        return {"image_url": None, "message": "当前无图直生仅支持简约风、现代北欧风。"}
    rendered = find_existing_file_by_stem(rendered_dir, style_key)
    if not rendered:
        return {"image_url": None, "message": f"未找到风格示例图：{style_key}。"}
    return {
        "image_filename": rendered.name,
        "image_kind": "rendered",
        "original_filename": None,
        "original_kind": None,
        "message": None,
    }


def extract_style_from_message(message: str) -> str:
    text = (message or "").strip()
    if not text:
        return ""
    if "现代北欧风" in text:
        return "现代北欧风"
    if "简约风" in text:
        return "简约风"
    if "现代风" in text:
        return "现代风"
    return ""


async def web_search(query: str, max_results: int = 5) -> list[dict[str, str]]:
    """统一搜索入口 — 使用百度千帆 AI 搜索 API"""
    try:
        return await baidu_web_search(query, max_results=max_results)
    except Exception as exc:
        logger.warning("百度搜索失败: %s", exc)
        return []


def extract_followup_prompts_from_text(text: str, limit: int = 6) -> list[str]:
    candidates = [
        "这套方案大概总预算是多少？请按主材和人工拆分。",
        "如果预算减少 20%，哪些项目可以先不做？",
        "请列出这个方案需要购买的材料清单和建议规格。",
        "这套方案的施工顺序怎么安排最稳妥？",
        "如果我想要更耐脏好打理，哪些材质要替换？",
        "给我一个适合小户型的同风格替代方案。",
    ]
    lower_text = text.lower()
    if "预算" in lower_text:
        candidates.insert(0, "请给出预算下限版和上限版两套采购建议。")
    if "材料" in lower_text:
        candidates.insert(0, "这些材料有哪些性价比替代品牌？")

    deduped: list[str] = []
    for item in candidates:
        if item not in deduped:
            deduped.append(item)
        if len(deduped) >= limit:
            break
    return deduped


def build_recommended_prompts_from_sessions(sessions: list[dict[str, Any]], limit: int = 6) -> list[str]:
    seeds: list[str] = []
    for session in sessions[:10]:
        for key in ("latest_user_message", "first_user_message", "title"):
            value = (session.get(key) or "").strip()
            if value and value != "新对话":
                seeds.append(value)
    merged = " ".join(seeds)
    prompts = extract_followup_prompts_from_text(merged, limit=limit)
    if not prompts:
        prompts = [
            "帮我做一个客厅的现代简约装修方案",
            "请按 10 万预算拆分材料和人工费用",
            "我想先改造卧室，怎么排施工顺序更合适？",
        ]
    return prompts[:limit]


def build_non_image_guarded_prompt(message: str) -> str:
    text = (message or "").strip()
    if not text:
        return text

    room_keywords = [
        "客厅",
        "卧室",
        "厨房",
        "餐厅",
        "书房",
        "办公室",
        "卫生间",
        "浴室",
        "玄关",
        "阳台",
        "儿童房",
    ]
    vague_keywords = [
        "这套方案",
        "预算拆分",
        "预算明细",
        "材料清单",
        "报价",
        "给出预算",
    ]
    if any(keyword in text for keyword in room_keywords):
        return text
    if not any(keyword in text for keyword in vague_keywords):
        return text

    guidance = (
        "补充约束：当前没有上传房间图片，也没有明确房间类型。"
        "请先给通用预算/材料拆分模板，不要擅自假设是厨房或其他具体空间，"
        "并在结尾提醒用户补充房间类型、面积和城市。"
    )
    return f"{text}\n\n{guidance}"


def build_render_completion_message(success: bool, details: str | None = None) -> str:
    if success:
        return normalize_assistant_output(
            details
            or "效果图已经生成完成。我根据刚才确认的空间分析和设计方案输出了最终视觉预览，你可以继续告诉我想调整的局部。"
        )
    return normalize_assistant_output(
        details
        or "文字方案已经整理完成，但当前效果图服务繁忙，暂时未成功生成渲染图。你可以稍后点击“重新生成效果图”再次尝试。"
    )


def extract_search_keywords(text: str) -> str:
    match = re.search(r"搜索关键词[:：]\s*(.+)", text)
    if match:
        return match.group(1).strip()
    return ""


def strip_section_prefix(text: str) -> str:
    return re.sub(r"^[A-Za-z\u4e00-\u9fff\s/【】]+[:：]\s*", "", text).strip()


def build_platform_search_links(query: str) -> list[dict[str, str]]:
    safe_query = (query or "家具 同款").strip()
    encoded_query = quote(safe_query)
    return [
        {
            "title": f"淘宝搜索：{safe_query}",
            "url": f"https://s.taobao.com/search?q={encoded_query}",
            "snippet": "打开淘宝搜索页查看同款或相似款商品。",
            "source": "Taobao",
        },
        {
            "title": f"京东搜索：{safe_query}",
            "url": f"https://search.jd.com/Search?keyword={encoded_query}",
            "snippet": "打开京东搜索页查看同款或相似款商品。",
            "source": "JD",
        },
        {
            "title": f"1688搜索：{safe_query}",
            "url": f"https://s.1688.com/selloffer/offer_search.htm?keywords={encoded_query}",
            "snippet": "打开 1688 搜索页查看源头货盘或相似款。",
            "source": "1688",
        },
        {
            "title": f"拼多多搜索：{safe_query}",
            "url": f"https://mobile.yangkeduo.com/search_result.html?search_key={encoded_query}",
            "snippet": "打开拼多多搜索页查看同款或平替商品。",
            "source": "Pinduoduo",
        },
    ]


def dedupe_links(links: list[dict[str, str]], limit: int = 8) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    for link in links:
        url = (link.get("url") or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        results.append(link)
        if len(results) >= limit:
            break
    return results


async def search_furniture_purchase_links(query: str) -> list[dict[str, str]]:
    normalized_query = (query or "家具 同款").strip()
    all_links: list[dict[str, str]] = []

    # 使用百度搜索查找家具购买链接
    search_queries = [
        f"{normalized_query} 家具 同款 购买",
        f"{normalized_query} 淘宝 京东 购买链接",
    ]

    for search_query in search_queries:
        links = await web_search(search_query, max_results=4)
        if links:
            logger.info("家具搜索成功: %s", search_query)
        all_links.extend(links)

    deduped = dedupe_links(all_links, limit=6)
    if deduped:
        return deduped

    # 百度搜索无结果时，降级为平台直链
    logger.info("百度搜索无结果，使用平台搜索链接: %s", normalized_query)
    return build_platform_search_links(normalized_query)


async def analyze_furniture_image_with_links(
    *,
    image_data: bytes,
    mime_type: str,
    user_prompt: str,
) -> tuple[str, list[dict[str, str]]]:
    from llm_provider import get_vision_llm, encode_image_to_base64_message
    

    llm = get_vision_llm(temperature=0.2)
    prompt = f"""
你是家居识图与选购助手。请根据用户上传的图片识别最主要的一件家具或软装对象，并用简体中文输出。

如果画面里有多个物件，只聚焦最显眼、最值得购买的那一件。
如果无法确认同款，请明确写“更像相似款”。
不要输出 JSON。

请严格按下面格式输出：
识别对象：<一句话概括，例如“奶油风弧形布艺沙发”>
家具类型：<品类>
风格判断：<风格关键词，2-4个>
材质/颜色：<材质和颜色>
适用空间：<适合客厅/卧室/书房等>
搜索关键词：<适合搜索购买链接的短关键词，尽量精确>
购买建议：<一句简短建议，告诉用户买的时候重点关注什么>

用户补充要求：{user_prompt or "请帮我识别并给购买链接。"}
"""

    image_part = encode_image_to_base64_message(image_data, mime_type or "image/png")
    message = HumanMessage(content=[
        {"type": "text", "text": prompt},
        image_part,
    ])
    response = llm.invoke([message])
    analysis_text = normalize_assistant_output((response.content or "").strip())

    keywords = extract_search_keywords(analysis_text)
    query = keywords or "家具 同款 购买"
    shopping_links = await search_furniture_purchase_links(query)

    lines = [analysis_text]
    if shopping_links:
        lines.extend(
            [
                "",
                "可参考购买链接：",
                *[
                    f"- [{strip_section_prefix(link.get('title') or '购买链接')}]({link.get('url')})"
                    for link in shopping_links
                ],
            ]
        )

    return "\n".join(lines).strip(), shopping_links


async def queue_render_job(
    *,
    user_id: str,
    session_id: str,
    request_message: str,
) -> str:
    job_id = uuid.uuid4().hex
    create_render_job(
        job_id=job_id,
        session_id=session_id,
        user_id=user_id,
        request_message=request_message,
    )
    asyncio.create_task(
        process_render_job(
            job_id=job_id,
            user_id=user_id,
            session_id=session_id,
            request_message=request_message,
        )
    )
    return job_id


async def process_render_job(
    *,
    job_id: str,
    user_id: str,
    session_id: str,
    request_message: str,
) -> None:
    update_render_job(job_id, status="running")
    try:
        from langchain_core.messages import HumanMessage
        prompt = (
            "请根据当前会话里已经完成的空间分析和设计方案，直接生成效果图。"
            "不要重复完整文字方案，只需调用渲染工具，并在成功后用2到3句中文简短说明画面亮点。"
            "如果渲染失败，请明确说明文字方案已完成，但效果图服务繁忙，建议稍后重试。"
            f"\n\n用户原始诉求：{request_message}"
        )
        
        config = {"configurable": {"thread_id": session_id, "user_id": user_id, "session_id": session_id}}
        response = await render_graph.ainvoke(
            {"messages": [HumanMessage(content=prompt)], "session_id": session_id, "user_id": user_id},
            config=config
        )
        
        reply_text = response["messages"][-1].content
        result_filename = await get_result_image_filename(user_id, session_id)
        if result_filename:
            update_render_job(job_id, status="completed", result_filename=result_filename)
            save_message(
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=build_render_completion_message(True, reply_text),
                image_filename=result_filename,
            )
            # 自动触发 3D 模型生成
            try:
                three_d_job_id = await queue_3d_job(
                    user_id=user_id,
                    session_id=session_id,
                    source_image=result_filename,
                )
                logger.info("自动触发 3D 生成: job_id=%s, source=%s", three_d_job_id, result_filename)
            except Exception as exc_3d:
                logger.warning("自动触发 3D 生成失败（不影响效果图）: %s", exc_3d)
        else:
            update_render_job(
                job_id,
                status="failed",
                error_message="当前效果图服务繁忙，可稍后重新生成。",
            )
            save_message(
                session_id=session_id,
                user_id=user_id,
                role="assistant",
                content=build_render_completion_message(False, reply_text),
            )
    except Exception as exc:
        logger.error("Background render job failed: %s", exc)
        update_render_job(
            job_id,
            status="failed",
            error_message="当前效果图服务繁忙，可稍后重新生成。",
        )
        save_message(
            session_id=session_id,
            user_id=user_id,
            role="assistant",
            content=build_render_completion_message(False),
        )


def persist_chat_records(
    *,
    user_id: str,
    session_id: str,
    user_message: str,
    assistant_message: str,
    result_filename: Optional[str] = None,
    references: Optional[list[dict[str, str]]] = None,
    user_attachments: Optional[list[dict[str, str]]] = None,
) -> None:
    user_message_id = save_message(session_id=session_id, user_id=user_id, role="user", content=user_message)
    if user_attachments:
        save_message_assets(
            message_id=user_message_id,
            session_id=session_id,
            user_id=user_id,
            attachments=user_attachments,
        )
    save_message(
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=assistant_message,
        image_filename=result_filename,
    )


# (ADK iter_agent_updates removed)


# (ADK extract_text_from_event removed)



@app.on_event("startup")
async def startup_event():
    os.makedirs(ARTIFACT_ROOT, exist_ok=True)
    init_db()
    logger.info("LangGraph Server initialized and ready.")


@app.get("/api/health")
async def health_check():
    has_key = "LLM_API_KEY" in os.environ
    return {"status": "ok", "api_key_configured": has_key}


@app.post("/api/sessions")
async def create_session(user_id: str = Form(DEFAULT_USER), session_id: str = Form(...)):
    ensure_session(session_id=session_id, user_id=user_id, title="新对话")
    await ensure_adk_session(user_id=user_id, session_id=session_id)
    return {"session_id": session_id}


@app.get("/api/sessions", response_model=list[SessionResponse])
async def list_session_endpoint(user_id: str = DEFAULT_USER):
    return list_sessions(user_id=user_id)


@app.get("/api/sessions/recommended-prompts", response_model=PromptRecommendationsResponse)
async def recommended_prompts_endpoint(user_id: str = DEFAULT_USER, limit: int = 6):
    sessions = list_sessions(user_id=user_id)
    prompts = build_recommended_prompts_from_sessions(sessions, limit=max(3, min(limit, 8)))
    return PromptRecommendationsResponse(prompts=prompts)


@app.post("/api/search/google-links")
async def google_links_endpoint(payload: GoogleLinksRequest):
    """搜索链接接口（保持 API 路径不变以兼容前端，底层已切换为百度搜索）"""
    links = await web_search(payload.query, max_results=payload.max_results)
    return {"links": links}


@app.post("/api/vision/furniture-match", response_model=VisionShoppingResponse)
async def furniture_match_endpoint(
    image: UploadFile = File(...),
    prompt: str = Form("请识别这件家具，并给我购买链接。"),
    user_id: str = Form(DEFAULT_USER),
    session_id: str = Form(DEFAULT_SESSION),
):
    require_api_key()
    ensure_session(session_id=session_id, user_id=user_id, title="识图找同款")

    image_data = await image.read()
    if not image_data:
        raise HTTPException(status_code=400, detail="上传图片不能为空。")

    assistant_message, references = await analyze_furniture_image_with_links(
        image_data=image_data,
        mime_type=image.content_type or "image/png",
        user_prompt=prompt,
    )
    save_message(
        session_id=session_id,
        user_id=user_id,
        role="user",
        content=prompt,
    )
    save_message(
        session_id=session_id,
        user_id=user_id,
        role="assistant",
        content=assistant_message,
    )
    return VisionShoppingResponse(message=assistant_message, references=references)


@app.post("/api/local-render-map", response_model=LocalRenderResponse)
async def local_render_map_endpoint(
    request: Request,
    original_filename: str = Form(""),
    style: str = Form(""),
    room: str = Form(""),
):
    mapping = resolve_local_render_mapping(original_filename=original_filename, style=style, room=room)
    image_filename = mapping.get("image_filename")
    image_kind = mapping.get("image_kind") or "rendered"
    image_path = mapping.get("image_path")
    original_filename_mapped = mapping.get("original_filename")
    original_kind = mapping.get("original_kind") or "original"
    original_path = mapping.get("original_path")
    image_url = (
        str(request.url_for("local_library_asset", library_path=quote(image_path)))
        if image_kind == "library" and image_path
        else str(request.url_for("local_file_asset", kind="rendered", filename=quote(image_filename)))
        if image_filename
        else None
    )
    original_url = (
        str(request.url_for("local_library_asset", library_path=quote(original_path)))
        if original_kind == "library" and original_path
        else str(request.url_for("local_file_asset", kind="original", filename=quote(original_filename_mapped)))
        if original_filename_mapped
        else None
    )
    return LocalRenderResponse(
        mode=IMAGE_GENERATION_MODE,
        imageUrl=image_url,
        originalImageUrl=original_url,
        message=mapping.get("message"),
    )


@app.get("/api/local-files/{kind}/{filename:path}", name="local_file_asset")
async def local_file_asset(kind: str, filename: str):
    original_dir, rendered_dir = resolve_local_image_dirs()
    if kind not in {"original", "rendered"}:
        raise HTTPException(status_code=404, detail="Invalid local file kind.")
    directory = original_dir if kind == "original" else rendered_dir
    safe_name = Path(filename).name
    file_path = find_existing_file_by_name(directory, safe_name)
    if not file_path:
        raise HTTPException(status_code=404, detail="Local file not found.")
    suffix = file_path.suffix.lower()
    media_type = "image/png"
    if suffix in {".jpg", ".jpeg"}:
        media_type = "image/jpeg"
    elif suffix == ".webp":
        media_type = "image/webp"
    return FileResponse(str(file_path), media_type=media_type)


@app.get("/api/local-library-files/{library_path:path}", name="local_library_asset")
async def local_library_asset(library_path: str):
    requested_path = Path(library_path)
    if requested_path.is_absolute() or ".." in requested_path.parts:
        raise HTTPException(status_code=404, detail="Invalid local library path.")

    file_path: Optional[Path] = None
    for root in get_local_library_roots():
        candidate = (root / requested_path).resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            continue
        if candidate.exists() and candidate.is_file():
            file_path = candidate
            break

    if not file_path:
        raise HTTPException(status_code=404, detail="Local library file not found.")

    suffix = file_path.suffix.lower()
    media_type = "image/png"
    if suffix in {".jpg", ".jpeg"}:
        media_type = "image/jpeg"
    elif suffix == ".webp":
        media_type = "image/webp"
    return FileResponse(str(file_path), media_type=media_type)


@app.post("/api/sessions/{session_id}/pin")
async def pin_session_endpoint(
    session_id: str,
    user_id: str = Form(DEFAULT_USER),
    pinned: bool = Form(...),
):
    success = set_session_pinned(session_id=session_id, user_id=user_id, pinned=pinned)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"session_id": session_id, "pinned": pinned}


@app.delete("/api/sessions/{session_id}")
async def delete_session_endpoint(session_id: str, user_id: str = DEFAULT_USER):
    # Keep deletion idempotent for better frontend UX.
    delete_session(session_id=session_id, user_id=user_id)
    return {"session_id": session_id, "deleted": True}


@app.get("/api/sessions/{session_id}/messages", response_model=list[MessageResponse])
async def get_session_messages(request: Request, session_id: str, user_id: str = DEFAULT_USER):
    messages = get_messages(session_id=session_id, user_id=user_id)
    return [
        MessageResponse(
            id=str(message["id"]),
            role=message["role"],
            content=message["content"],
            imageUrl=build_asset_url(request, session_id, message["image_filename"], user_id)
            if message["image_filename"]
            else None,
            attachments=[
                {
                    "id": f"{message['id']}-{idx}",
                    "url": build_asset_url(request, session_id, item["filename"], user_id),
                    "label": item.get("label")
                    or ("原图" if item.get("asset_type") == "current_room" else "灵感图" if item.get("asset_type") == "inspiration" else "图片"),
                    "kind": item.get("asset_type") or "general",
                }
                for idx, item in enumerate(message.get("attachments") or [])
            ]
            or None,
            references=message.get("references") or [],
            created_at=message["created_at"],
        )
        for message in messages
    ]


@app.get("/api/render-jobs/{job_id}", response_model=RenderJobResponse)
async def get_render_job_endpoint(request: Request, job_id: str, user_id: str = DEFAULT_USER):
    job = get_render_job(job_id, user_id=user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Render job not found.")
    # Check for any associated 3D job on this session
    from db import get_latest_3d_job_for_session
    three_d_job = get_latest_3d_job_for_session(job["session_id"], user_id)
    return RenderJobResponse(
        job_id=job["job_id"],
        status=job["status"],
        imageUrl=build_asset_url(request, job["session_id"], job["result_filename"], user_id)
        if job.get("result_filename")
        else None,
        message=job.get("error_message"),
        retryable=job["status"] == "failed",
        threeDJobId=three_d_job["job_id"] if three_d_job else None,
    )


@app.post("/api/sessions/{session_id}/render", response_model=RenderJobResponse)
async def create_render_job_endpoint(
    request: Request,
    session_id: str,
    user_id: str = Form(DEFAULT_USER),
    request_message: str = Form("请根据刚才的设计方案生成效果图。"),
):
    ensure_session(session_id=session_id, user_id=user_id)
    await ensure_adk_session(user_id=user_id, session_id=session_id)
    job_id = await queue_render_job(
        user_id=user_id,
        session_id=session_id,
        request_message=request_message,
    )
    return RenderJobResponse(job_id=job_id, status="pending")


@app.get("/api/sessions/{session_id}/assets/{filename:path}", name="get_asset")
async def get_asset(session_id: str, filename: str, user_id: str = DEFAULT_USER):
    filepath = os.path.join(ARTIFACT_ROOT, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Asset not found.")
    suffix = Path(filepath).suffix.lower()
    if suffix == ".glb":
        return FileResponse(filepath, media_type="model/gltf-binary")
    return FileResponse(filepath)


# ============================================================================
# 3D Model Generation Endpoints
# ============================================================================

class ThreeDJobResponse(BaseModel):
    job_id: str
    status: str
    progress: int = 0
    modelUrl: Optional[str] = None
    message: Optional[str] = None


async def queue_3d_job(
    *,
    user_id: str,
    session_id: str,
    source_image: str,
) -> str:
    """创建并启动 3D 生成后台任务"""
    job_id = uuid.uuid4().hex
    create_3d_job(
        job_id=job_id,
        session_id=session_id,
        user_id=user_id,
        source_image=source_image,
    )
    asyncio.create_task(
        process_3d_job(
            job_id=job_id,
            user_id=user_id,
            session_id=session_id,
            source_image=source_image,
        )
    )
    return job_id


async def process_3d_job(
    *,
    job_id: str,
    user_id: str,
    session_id: str,
    source_image: str,
) -> None:
    """后台任务：提交到腾讯云 → 轮询 → 下载 GLB"""
    from three_d_provider import submit_image_to_3d, poll_and_download

    async def handle_progress(status: str, progress: int) -> None:
        mapped_status = "processing" if status in {"pending", "processing"} else status
        current_progress = max(15, progress) if mapped_status == "processing" else progress
        update_3d_job(
            job_id,
            status=mapped_status,
            progress=current_progress,
            external_task_id=external_task_id,
        )

    update_3d_job(job_id, status="processing", progress=5)
    try:
        image_path = os.path.join(ARTIFACT_ROOT, source_image)
        if not os.path.exists(image_path):
            update_3d_job(
                job_id, status="failed",
                error_message=f"效果图文件不存在: {source_image}",
            )
            return

        # 1. 提交到腾讯云
        external_task_id = await submit_image_to_3d(image_path)
        update_3d_job(
            job_id, status="processing", progress=15,
            external_task_id=external_task_id,
        )

        # 2. 轮询并下载 GLB
        glb_filename = f"3d_model_{job_id[:8]}.glb"
        result = await poll_and_download(
            job_id=external_task_id,
            save_filename=glb_filename,
            max_wait_seconds=300,
            poll_interval=5.0,
            progress_callback=handle_progress,
        )

        if result["status"] == "completed" and result.get("glb_path"):
            update_3d_job(
                job_id, status="completed", progress=100,
                result_filename=glb_filename,
            )
            save_asset(
                session_id=session_id,
                user_id=user_id,
                filename=glb_filename,
                asset_type="3d_model",
                version=1,
                metadata={"source_image": source_image},
            )
            logger.info("3D 模型生成成功: %s", glb_filename)
        else:
            update_3d_job(
                job_id, status="failed",
                progress=result.get("progress", 0),
                error_message=result.get("error", "3D 模型生成失败"),
            )
            logger.warning("3D 模型生成失败: %s", result.get("error"))

    except Exception as exc:
        logger.error("3D 生成后台任务异常: %s", exc)
        update_3d_job(
            job_id, status="failed",
            error_message=f"3D 模型生成出错: {exc}",
        )


@app.post("/api/sessions/{session_id}/3d-model", response_model=ThreeDJobResponse)
async def create_3d_model_endpoint(
    request: Request,
    session_id: str,
    user_id: str = Form(DEFAULT_USER),
    source_image: str = Form(...),
):
    """手动触发 3D 模型生成（效果图已自动触发时，此接口可用于重试）"""
    ensure_session(session_id=session_id, user_id=user_id)
    job_id = await queue_3d_job(
        user_id=user_id,
        session_id=session_id,
        source_image=source_image,
    )
    return ThreeDJobResponse(job_id=job_id, status="pending", progress=0)


@app.get("/api/3d-jobs/{job_id}", response_model=ThreeDJobResponse)
async def get_3d_job_endpoint(
    request: Request,
    job_id: str,
    user_id: str = DEFAULT_USER,
):
    """查询 3D 生成任务状态"""
    job = get_3d_job(job_id, user_id=user_id)
    if not job:
        raise HTTPException(status_code=404, detail="3D job not found.")
    model_url = (
        build_asset_url(request, job["session_id"], job["result_filename"], user_id)
        if job.get("result_filename")
        else None
    )
    return ThreeDJobResponse(
        job_id=job["job_id"],
        status=job["status"],
        progress=job.get("progress", 0),
        modelUrl=model_url,
        message=job.get("error_message"),
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: Request, payload: ChatRequest):
    require_api_key()
    ensure_session(session_id=payload.session_id, user_id=payload.user_id, title=payload.message[:80] or "新对话")

    try:
        from langchain_core.messages import HumanMessage
        guarded_message = build_non_image_guarded_prompt(payload.message)
        
        config = {"configurable": {"thread_id": payload.session_id, "user_id": payload.user_id, "session_id": payload.session_id}}
        response = await graph.ainvoke(
            {"messages": [HumanMessage(content=guarded_message)], "session_id": payload.session_id, "user_id": payload.user_id},
            config=config,
        )
        reply_text = response["messages"][-1].content
        
        result_filename = await get_result_image_filename(payload.user_id, payload.session_id)
        references = []
        if should_include_price_links(guarded_message, reply_text):
            references = await web_search(
                f"{guarded_message} 装修 价格 材料 购买",
                max_results=5,
            )
        persist_chat_records(
            user_id=payload.user_id,
            session_id=payload.session_id,
            user_message=payload.message,
            assistant_message=reply_text,
            result_filename=result_filename,
            references=references,
        )
        return ChatResponse(
            message=reply_text,
            imageUrl=build_asset_url(request, payload.session_id, result_filename, payload.user_id)
            if result_filename
            else None,
            references=references,
        )
    except Exception as exc:
        logger.error("Error during chat: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/chat/stream")
async def chat_stream_endpoint(payload: ChatRequest):
    require_api_key()
    ensure_session(session_id=payload.session_id, user_id=payload.user_id, title=payload.message[:80] or "新对话")

    try:
        from langchain_core.messages import HumanMessage
        guarded_message = build_non_image_guarded_prompt(payload.message)
        
        async def event_stream():
            config = {"configurable": {"thread_id": payload.session_id, "user_id": payload.user_id, "session_id": payload.session_id}}
            input_state = {"messages": [HumanMessage(content=guarded_message)], "session_id": payload.session_id, "user_id": payload.user_id}
            
            final_reply = []
            
            async for event in graph.astream_events(input_state, config=config, version="v1"):
                kind = event["event"]
                name = event.get("name", "")
                
                # Yield agent node updates
                if kind == "on_chat_model_start":
                    yield f"data: {{ \"type\": \"agent\", \"name\": \"LLM Reasoning\", \"status\": \"running\" }}\n\n"
                elif kind == "on_tool_start":
                    yield f"data: {{ \"type\": \"agent\", \"name\": \"Tool: {name}\", \"status\": \"running\" }}\n\n"
                elif kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if getattr(chunk, "content", None):
                        # Some langgraph events bundle strings
                        content_str = chunk.content
                        if isinstance(content_str, str):
                            node = (event.get("metadata") or {}).get("langgraph_node")
                            if node == "router":
                                continue
                            final_reply.append(content_str)
                            yield f"data: {{ \"type\": \"token\", \"content\": {json.dumps(content_str)} }}\n\n"
                            
            assistant_message = normalize_assistant_output("".join(final_reply))
            
            references: list[dict[str, str]] = []
            if should_include_price_links(guarded_message, assistant_message):
                references = await web_search(
                    f"{guarded_message} 装修 价格 材料 购买",
                    max_results=5,
                )
                if references:
                    yield f"data: {json.dumps({'type': 'references', 'links': references}, ensure_ascii=False)}\n\n"

            persist_chat_records(
                user_id=payload.user_id,
                session_id=payload.session_id,
                user_message=payload.message,
                assistant_message=assistant_message,
                result_filename=await get_result_image_filename(payload.user_id, payload.session_id),
                references=references,
            )
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as exc:
        logger.error("Error during chat stream: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/chat-with-image", response_model=ChatResponse)
async def chat_with_image_endpoint(
    request: Request,
    message: str = Form(...),
    current_room_images: list[UploadFile] | None = File(None),
    inspiration_images: list[UploadFile] | None = File(None),
    current_room_image: UploadFile | None = File(None),
    image: UploadFile | None = File(None),
    user_id: str = Form(DEFAULT_USER),
    session_id: str = Form(DEFAULT_SESSION),
):
    if IMAGE_GENERATION_MODE == "local_mock" and user_id == QUICK_GENERATE_USER:
        ensure_session(session_id=session_id, user_id=user_id, title=message[:80] or "快速生成")
        uploaded_image = (current_room_images or [None])[0] or (inspiration_images or [None])[0] or current_room_image or image
        mapping = resolve_local_render_mapping(
            original_filename=getattr(uploaded_image, "filename", "") if uploaded_image else "",
            style=extract_style_from_message(message),
        )
        image_filename = mapping.get("image_filename")
        image_url = (
            str(request.url_for("local_file_asset", kind="rendered", filename=quote(image_filename)))
            if image_filename
            else None
        )
        response_message = mapping.get("message") or "已从本地渲染库返回效果图（未调用实时生成模型）。"
        persist_chat_records(
            user_id=user_id,
            session_id=session_id,
            user_message=message,
            assistant_message=response_message,
            result_filename=None,
            references=[],
        )
        return ChatResponse(
            message=response_message,
            imageUrl=image_url,
            references=[],
        )

    require_api_key()
    ensure_session(session_id=session_id, user_id=user_id, title=message[:80] or "新对话")

    try:
        from langchain_core.messages import HumanMessage
        effective_message = message if ((current_room_images and len(current_room_images) > 0) or (inspiration_images and len(inspiration_images) > 0) or current_room_image or image) else build_non_image_guarded_prompt(message)
        message_content, uploaded_assets = await prepare_message_content(
            message=effective_message,
            user_id=user_id,
            session_id=session_id,
            current_room_images=current_room_images,
            inspiration_images=inspiration_images,
            current_room_image=current_room_image,
            image=image,
        )
        
        config = {"configurable": {"thread_id": session_id, "user_id": user_id, "session_id": session_id}}
        response = await graph.ainvoke(
            {"messages": [message_content], "session_id": session_id, "user_id": user_id},
            config=config,
        )
        reply_text = response["messages"][-1].content
        
        result_filename = await get_result_image_filename(user_id, session_id)
        references = []
        if should_include_price_links(effective_message, reply_text):
            references = await web_search(
                f"{effective_message} 装修 价格 材料 购买",
                max_results=5,
            )
        persist_chat_records(
            user_id=user_id,
            session_id=session_id,
            user_message=message,
            assistant_message=reply_text,
            result_filename=result_filename,
            references=references,
            user_attachments=uploaded_assets,
        )
        return ChatResponse(
            message=reply_text,
            imageUrl=build_asset_url(request, session_id, result_filename, user_id)
            if result_filename
            else None,
            references=references,
        )
    except Exception as exc:
        logger.error("Error during chat-with-image: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/chat-with-image/stream")
async def chat_with_image_stream_endpoint(
    request: Request,
    message: str = Form(...),
    current_room_images: list[UploadFile] | None = File(None),
    inspiration_images: list[UploadFile] | None = File(None),
    current_room_image: UploadFile | None = File(None),
    image: UploadFile | None = File(None),
    user_id: str = Form(DEFAULT_USER),
    session_id: str = Form(DEFAULT_SESSION),
):
    require_api_key()
    ensure_session(session_id=session_id, user_id=user_id, title=message[:80] or "新对话")

    try:
        from langchain_core.messages import HumanMessage
        effective_message = message if ((current_room_images and len(current_room_images) > 0) or (inspiration_images and len(inspiration_images) > 0) or current_room_image or image) else build_non_image_guarded_prompt(message)
        message_content, uploaded_assets = await prepare_message_content(
            message=effective_message,
            user_id=user_id,
            session_id=session_id,
            current_room_images=current_room_images,
            inspiration_images=inspiration_images,
            current_room_image=current_room_image,
            image=image,
        )
        
        async def event_stream():
            config = {"configurable": {"thread_id": session_id, "user_id": user_id, "session_id": session_id}}
            input_state = {"messages": [message_content], "session_id": session_id, "user_id": user_id}
            final_reply = []
            
            async for event in graph.astream_events(input_state, config=config, version="v1"):
                kind = event["event"]
                name = event.get("name", "")
                
                if kind == "on_chat_model_start":
                    yield f"data: {{ \"type\": \"agent\", \"name\": \"LLM Reasoning\", \"status\": \"running\" }}\n\n"
                elif kind == "on_tool_start":
                    yield f"data: {{ \"type\": \"agent\", \"name\": \"Tool: {name}\", \"status\": \"running\" }}\n\n"
                elif kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if getattr(chunk, "content", None):
                        content_str = chunk.content
                        if isinstance(content_str, str):
                            node = (event.get("metadata") or {}).get("langgraph_node")
                            if node == "router":
                                continue
                            final_reply.append(content_str)
                            yield f"data: {{ \"type\": \"token\", \"content\": {json.dumps(content_str)} }}\n\n"
            
            assistant_message = normalize_assistant_output("".join(final_reply))
            
            references: list[dict[str, str]] = []
            if should_include_price_links(effective_message, assistant_message):
                references = await web_search(
                    f"{effective_message} 装修 价格 材料 购买",
                    max_results=5,
                )
                if references:
                    yield f"data: {json.dumps({'type': 'references', 'links': references}, ensure_ascii=False)}\n\n"

            persist_chat_records(
                user_id=user_id,
                session_id=session_id,
                user_message=message,
                assistant_message=assistant_message,
                result_filename=None,
                references=references,
                user_attachments=uploaded_assets,
            )
            
            if (current_room_images and len(current_room_images) > 0) or (inspiration_images and len(inspiration_images) > 0) or current_room_image or image:
                job_id = await queue_render_job(
                    user_id=user_id,
                    session_id=session_id,
                    request_message=message,
                )
                yield f"data: {json.dumps({'type': 'render', 'jobId': job_id, 'status': 'pending'})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as exc:
        logger.error("Error during chat-with-image stream: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
