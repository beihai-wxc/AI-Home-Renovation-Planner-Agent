import { ChatMessage, SessionSummary } from "../types/chat";
import { getCurrentSessionId } from "./session";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const DEFAULT_USER_ID = "frontend_user";

interface StreamChunk {
  type?: "content" | "image" | "agent" | "render" | "error" | "references";
  content?: string;
  url?: string;
  agentName?: string;
  status?: "idle" | "processing" | "completed" | "error";
  jobId?: string;
  message?: string;
  links?: Array<{
    title: string;
    url: string;
    snippet?: string;
    source?: string;
  }>;
}

interface ImagePayload {
  currentRoomImage?: File | null;
}

function buildChatMessage(data: {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
  references?: Array<{
    title: string;
    url: string;
    snippet?: string;
    source?: string;
  }>;
  created_at?: string;
}): ChatMessage {
  return {
    id: data.id,
    role: data.role,
    content: data.content,
    imageUrl: data.imageUrl || undefined,
    references: data.references || undefined,
    timestamp: data.created_at ? new Date(data.created_at) : new Date(),
  };
}

async function parseSSE(
  response: Response,
  onChunk: (chunk: StreamChunk) => void,
  onDone: () => void
) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error("无法获取响应流");
  }

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") {
        onDone();
        return;
      }
      try {
        onChunk(JSON.parse(data));
      } catch {
        // Ignore incomplete chunks.
      }
    }
  }
}

export async function ensureSessionExists(sessionId: string): Promise<void> {
  const formData = new FormData();
  formData.append("user_id", DEFAULT_USER_ID);
  formData.append("session_id", sessionId);

  await fetch(`${API_BASE_URL}/api/sessions`, {
    method: "POST",
    body: formData,
  });
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/sessions?user_id=${DEFAULT_USER_ID}`);
  if (!response.ok) {
    throw new Error("加载会话列表失败");
  }
  return await response.json();
}

export async function pinSession(sessionId: string, pinned: boolean): Promise<void> {
  const formData = new FormData();
  formData.append("user_id", DEFAULT_USER_ID);
  formData.append("pinned", String(pinned));

  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/pin`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || "置顶操作失败");
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}?user_id=${DEFAULT_USER_ID}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || "删除会话失败");
  }
}

export async function fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/sessions/${sessionId}/messages?user_id=${DEFAULT_USER_ID}`
  );
  if (!response.ok) {
    throw new Error("加载历史消息失败");
  }

  const data = await response.json();
  return data.map((message: any) =>
    buildChatMessage({
      id: String(message.id),
      role: message.role,
      content: message.content,
      imageUrl: message.imageUrl,
      references: message.references,
      created_at: message.created_at,
    })
  );
}

export async function sendChatMessage(message: string): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      user_id: DEFAULT_USER_ID,
      session_id: getCurrentSessionId(),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || "发送消息失败");
  }

  const data = await response.json();
  return buildChatMessage({
    id: Date.now().toString(),
    role: "assistant",
    content: data.message,
    imageUrl: data.imageUrl,
  });
}

export async function sendChatMessageStream(
  message: string,
  onChunk: (content: string) => void,
  onAgent: (agentName: string, status: "idle" | "processing" | "completed" | "error") => void,
  onReferences: (links: Array<{ title: string; url: string; snippet?: string; source?: string }>) => void,
  onDone: () => void,
  onError: (error: string) => void,
  sessionId: string
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        user_id: DEFAULT_USER_ID,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || error.message || "发送消息失败");
    }

    await parseSSE(
      response,
      (chunk) => {
        if (chunk.type === "agent" && chunk.agentName && chunk.status) {
          onAgent(chunk.agentName, chunk.status);
          return;
        }
        if (chunk.type === "error" && chunk.message) {
          onError(chunk.message);
          return;
        }
        if (chunk.type === "references" && chunk.links) {
          onReferences(chunk.links);
          return;
        }
        if (chunk.content) {
          onChunk(chunk.content);
        }
      },
      onDone
    );
  } catch (error) {
    onError(error instanceof Error ? error.message : "发送消息失败");
  }
}

export async function sendChatWithImageStream(
  message: string,
  images: ImagePayload,
  onChunk: (content: string) => void,
  onAgent: (agentName: string, status: "idle" | "processing" | "completed" | "error") => void,
  onImage: (url: string) => void,
  onReferences: (links: Array<{ title: string; url: string; snippet?: string; source?: string }>) => void,
  onRenderQueued: (jobId: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  sessionId: string
): Promise<void> {
  try {
    const formData = new FormData();
    formData.append("message", message);
    formData.append("user_id", DEFAULT_USER_ID);
    formData.append("session_id", sessionId);

    if (images.currentRoomImage) {
      formData.append("current_room_image", images.currentRoomImage);
    }
    const response = await fetch(`${API_BASE_URL}/api/chat-with-image/stream`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || error.message || "发送消息失败");
    }

    await parseSSE(
      response,
      (chunk) => {
        if (chunk.type === "agent" && chunk.agentName && chunk.status) {
          onAgent(chunk.agentName, chunk.status);
          return;
        }
        if (chunk.type === "error" && chunk.message) {
          onError(chunk.message);
          return;
        }
        if (chunk.type === "image" && chunk.url) {
          onImage(chunk.url);
          return;
        }
        if (chunk.type === "render" && chunk.jobId) {
          onRenderQueued(chunk.jobId);
          return;
        }
        if (chunk.type === "references" && chunk.links) {
          onReferences(chunk.links);
          return;
        }

        if (chunk.content) {
          onChunk(chunk.content);
        }
      },
      onDone
    );
  } catch (error) {
    onError(error instanceof Error ? error.message : "发送消息失败");
  }
}

export async function checkBackendHealth(): Promise<{ status: string; api_key_configured: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return await response.json();
}

export async function fetchRenderJob(jobId: string): Promise<{
  job_id: string;
  status: string;
  imageUrl?: string;
  message?: string;
  retryable: boolean;
}> {
  const response = await fetch(`${API_BASE_URL}/api/render-jobs/${jobId}?user_id=${DEFAULT_USER_ID}`);
  if (!response.ok) {
    throw new Error("加载渲染任务失败");
  }
  return await response.json();
}

export async function requestRenderJob(
  sessionId: string,
  requestMessage = "请根据刚才的设计方案重新生成效果图。"
): Promise<{ job_id: string; status: string }> {
  const formData = new FormData();
  formData.append("user_id", DEFAULT_USER_ID);
  formData.append("request_message", requestMessage);

  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/render`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || "创建渲染任务失败");
  }
  return await response.json();
}

export async function fetchRecommendedPrompts(limit = 6): Promise<string[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/sessions/recommended-prompts?user_id=${DEFAULT_USER_ID}&limit=${limit}`
  );
  if (!response.ok) {
    throw new Error("加载推荐问题失败");
  }
  const data = await response.json();
  return Array.isArray(data.prompts) ? data.prompts : [];
}

export async function mapLocalRenderImage(
  originalFilename: string | null,
  style: string
): Promise<{ imageUrl?: string; originalImageUrl?: string; message?: string; mode: string }> {
  const formData = new FormData();
  formData.append("original_filename", originalFilename || "");
  formData.append("style", style);

  const response = await fetch(`${API_BASE_URL}/api/local-render-map`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || "本地图片映射失败");
  }
  return await response.json();
}
