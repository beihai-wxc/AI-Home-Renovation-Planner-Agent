"""
RAG 核心检索引擎
================
技术实现：
  - 使用 DashScope text-embedding-v3 模型（1024 维向量）
  - 预计算全部知识条目向量，持久化为 .npy 文件（构建一次，运行时零 API 开销）
  - 检索时对 query 实时 Embedding，通过余弦相似度找出最相关条目
  - 全局单例 + 懒加载，FastAPI 启动时自动初始化
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# 路径常量
# ─────────────────────────────────────────────
_RAG_DIR = Path(__file__).parent
INDEX_DIR = _RAG_DIR / "index"
KNOWLEDGE_FILE = _RAG_DIR / "knowledge_base.json"
EMBEDDINGS_FILE = INDEX_DIR / "embeddings.npy"
METADATA_FILE = INDEX_DIR / "metadata.json"

EMBEDDING_MODEL = "text-embedding-v3"
EMBEDDING_DIM = 1024


class KnowledgeRetriever:
    """
    语义知识检索引擎

    使用余弦相似度在预计算的向量空间中进行语义检索：
      score = dot(q_norm, k_norm)  ∈ [-1, 1]，越大越相关

    检索流程：
      1. query → DashScope Embedding API → 1024 维 float32 向量
      2. 向量与预存知识矩阵做余弦相似度计算（O(N·D) numpy 矩阵乘法）
      3. 取 top-K 条目，按相似度降序返回
    """

    def __init__(self) -> None:
        self._api_key: str = os.getenv("LLM_API_KEY", "")
        self._api_base: str = os.getenv(
            "LLM_API_BASE",
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        self._embeddings: Optional[np.ndarray] = None  # shape: (N, D)
        self._metadata: Optional[list[dict]] = None
        self._ready: bool = False
        self._load_index()

    # ─────────────────────────────────────────
    # 索引加载
    # ─────────────────────────────────────────

    def _load_index(self) -> None:
        """从磁盘加载预计算的向量矩阵和元数据"""
        if not EMBEDDINGS_FILE.exists() or not METADATA_FILE.exists():
            logger.warning(
                "RAG 向量索引文件不存在，知识库功能不可用。"
                "请先运行: python rag/build_index.py"
            )
            return

        try:
            self._embeddings = np.load(str(EMBEDDINGS_FILE))  # (N, 1024) float32
            with open(METADATA_FILE, "r", encoding="utf-8") as f:
                self._metadata = json.load(f)
            self._ready = True
            logger.info(
                "RAG 向量索引加载成功，共 %d 条知识，向量维度 %s",
                len(self._metadata),
                self._embeddings.shape,
            )
        except Exception as exc:
            logger.error("RAG 向量索引加载失败: %s", exc)
            self._ready = False

    # ─────────────────────────────────────────
    # 公开属性
    # ─────────────────────────────────────────

    @property
    def is_ready(self) -> bool:
        return self._ready and self._embeddings is not None and self._metadata is not None

    # ─────────────────────────────────────────
    # Embedding
    # ─────────────────────────────────────────

    async def embed(self, text: str) -> Optional[np.ndarray]:
        """
        调用 DashScope text-embedding-v3 对文本做向量化。
        返回 1024 维 float32 向量，失败时返回 None。
        """
        endpoint = self._api_base.rstrip("/") + "/embeddings"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": EMBEDDING_MODEL,
            "input": text[:2048],  # 截断过长输入
            "encoding_format": "float",
            "dimensions": EMBEDDING_DIM,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(endpoint, headers=headers, json=payload)
                resp.raise_for_status()
                vector = resp.json()["data"][0]["embedding"]
                return np.array(vector, dtype=np.float32)
            except Exception as exc:
                logger.error("Embedding API 调用失败: %s", exc)
                return None

    # ─────────────────────────────────────────
    # 相似度计算
    # ─────────────────────────────────────────

    @staticmethod
    def _cosine_similarity(query_vec: np.ndarray, matrix: np.ndarray) -> np.ndarray:
        """
        批量余弦相似度（矩阵乘法实现）
        score_i = dot(q_norm, m_norm_i)
        """
        q_norm = query_vec / (np.linalg.norm(query_vec) + 1e-10)
        m_norms = matrix / (np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-10)
        return (m_norms @ q_norm).astype(float)

    # ─────────────────────────────────────────
    # 语义检索
    # ─────────────────────────────────────────

    async def search(self, query: str, top_k: int = 3) -> list[dict]:
        """
        语义检索：将 query 向量化后与知识库做余弦相似度匹配，返回 top-K 最相关条目。

        Args:
            query:  用户问题或检索词
            top_k:  返回条目数量（1-10）

        Returns:
            按相似度降序排列的知识条目列表（包含 _score 字段）
        """
        if not self.is_ready:
            logger.warning("RAG 检索引擎未就绪，跳过知识库检索")
            return []

        query_vec = await self.embed(query)
        if query_vec is None:
            return []

        scores = self._cosine_similarity(query_vec, self._embeddings)
        top_k = min(top_k, len(self._metadata))
        top_indices = np.argsort(scores)[-top_k:][::-1]

        results = []
        for idx in top_indices:
            entry = dict(self._metadata[idx])
            entry["_score"] = float(scores[idx])
            results.append(entry)

        logger.info(
            "RAG 检索: query='%.20s…', top-%d, scores=%s",
            query,
            top_k,
            [f"{r['_score']:.3f}" for r in results],
        )
        return results

    # ─────────────────────────────────────────
    # RAG 上下文组装
    # ─────────────────────────────────────────

    def build_rag_context(self, entries: list[dict], max_chars: int = 900) -> str:
        """
        将检索到的知识条目组装为结构化的 RAG 上下文字符串，
        注入到用户消息前，让 Agent 能参考这些专业知识回答。
        """
        if not entries:
            return ""

        lines = [
            "【装修知识库参考】（以下是系统检索到的相关专业知识，请在回答时参考，无需原文复述）",
            "",
        ]
        total = 0
        for i, entry in enumerate(entries, 1):
            title = entry.get("title", "")
            content = entry.get("content", "")
            category = entry.get("category", "")
            chunk = f"{i}. 【{category}】{title}\n{content}"
            if total + len(chunk) > max_chars:
                break
            lines.append(chunk)
            lines.append("")
            total += len(chunk)

        return "\n".join(lines).strip()


# ─────────────────────────────────────────────
# 全局单例
# ─────────────────────────────────────────────

_retriever_instance: Optional[KnowledgeRetriever] = None


def get_retriever() -> KnowledgeRetriever:
    """获取全局 RAG 检索器单例（懒加载，线程安全）"""
    global _retriever_instance
    if _retriever_instance is None:
        _retriever_instance = KnowledgeRetriever()
    return _retriever_instance
