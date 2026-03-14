/**
 * API 调用工具
 */

import { ChatMessage } from '../types/chat';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * 流式响应的类型
 */
interface StreamChunk {
  type?: 'content' | 'image';
  content?: string;
  url?: string;
}

/**
 * 发送纯文本消息到后端（非流式）
 */
export async function sendChatMessage(message: string): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      user_id: 'frontend_user',
      session_id: 'main_session',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || '发送消息失败');
  }

  const data = await response.json();
  return {
    id: Date.now().toString(),
    role: 'assistant',
    content: data.message,
    imageUrl: data.imageUrl,
    timestamp: new Date(),
  };
}

/**
 * 发送带图片的消息到后端（非流式）
 */
export async function sendChatWithImage(
  message: string,
  image: File,
  imageType: 'current_room' | 'inspiration' = 'current_room'
): Promise<ChatMessage> {
  const formData = new FormData();
  formData.append('message', message);
  formData.append('image', image);
  formData.append('image_type', imageType);
  formData.append('user_id', 'frontend_user');
  formData.append('session_id', 'main_session');

  const response = await fetch(`${API_BASE_URL}/api/chat-with-image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.message || '发送消息失败');
  }

  const data = await response.json();
  return {
    id: Date.now().toString(),
    role: 'assistant',
    content: data.message,
    imageUrl: data.imageUrl,
    timestamp: new Date(),
  };
}

/**
 * 流式发送纯文本消息
 * @param message - 用户消息
 * @param onChunk - 每收到一个文本片段的回调
 * @param onDone - 完成时的回调
 * @param onError - 错误回调
 */
export async function sendChatMessageStream(
  message: string,
  onChunk: (content: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        user_id: 'frontend_user',
        session_id: 'main_session',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || error.message || '发送消息失败');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('无法获取响应流');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // 解码数据块
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // 处理 SSE 格式的数据: data: {...}\n\n
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // 保留不完整的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // 移除 "data: " 前缀

          // 检查结束标记
          if (data === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              onChunk(parsed.content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '发送消息失败';
    onError(errorMessage);
  }
}

/**
 * 流式发送带图片的消息
 * @param message - 用户消息
 * @param image - 图片文件
 * @param imageType - 图片类型
 * @param onChunk - 每收到一个文本片段的回调
 * @param onImage - 收到图片 URL 的回调
 * @param onDone - 完成时的回调
 * @param onError - 错误回调
 */
export async function sendChatWithImageStream(
  message: string,
  image: File,
  imageType: 'current_room' | 'inspiration',
  onChunk: (content: string) => void,
  onImage: (url: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('image', image);
    formData.append('image_type', imageType);
    formData.append('user_id', 'frontend_user');
    formData.append('session_id', 'main_session');

    const response = await fetch(`${API_BASE_URL}/api/chat-with-image/stream`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || error.message || '发送消息失败');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('无法获取响应流');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // 解码数据块
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // 处理 SSE 格式的数据: data: {...}\n\n
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // 保留不完整的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // 移除 "data: " 前缀

          // 检查结束标记
          if (data === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed: StreamChunk = JSON.parse(data);

            // 处理文本内容
            if (parsed.type === 'content' && parsed.content) {
              onChunk(parsed.content);
            }

            // 处理图片 URL
            if (parsed.type === 'image' && parsed.url) {
              onImage(parsed.url);
            }

            // 兼容旧格式（没有 type 字段）
            if (!parsed.type && parsed.content) {
              onChunk(parsed.content);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '发送消息失败';
    onError(errorMessage);
  }
}

/**
 * 检查后端健康状态
 */
export async function checkBackendHealth(): Promise<{ status: string; api_key_configured: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return await response.json();
}
