import { Category, Message, MessageType } from "@/types/brain";

const CONFIGURED_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
const DEFAULT_API_BASE_URLS = CONFIGURED_API_BASE_URL
  ? [CONFIGURED_API_BASE_URL]
  : ["http://localhost:8000/api", "http://127.0.0.1:8000/api", "/api"];

let activeApiBaseUrl = DEFAULT_API_BASE_URLS[0];
let activeApiOrigin = new URL(activeApiBaseUrl, window.location.origin).origin;

interface BackendCategory {
  id: number;
  name: string;
  tags: string[];
  description: string | null;
  parent_id: number | null;
  created_at: string;
  message_count: number;
}

interface BackendMessage {
  id: number;
  content: string;
  type: string;
  tags: string[] | null;
  category_id: number | null;
  created_at: string;
}

function normalizeMessageContent(content: string, type: MessageType | string): string {
  if (type === "image" && content.startsWith("/uploads/")) {
    return `${activeApiOrigin}${content}`;
  }
  return content;
}

function mapMessage(message: BackendMessage): Message {
  const type: MessageType = message.type === "image" || message.type === "link" ? message.type : "text";

  return {
    ...message,
    type,
    content: normalizeMessageContent(message.content, type),
    tags: message.tags ?? [],
  };
}

function mapCategory(category: BackendCategory): Category {
  return {
    ...category,
    tags: category.tags ?? [],
    description: category.description ?? "",
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const candidates = [
    activeApiBaseUrl,
    ...DEFAULT_API_BASE_URLS.filter((baseUrl) => baseUrl !== activeApiBaseUrl),
  ];

  let lastErrorMessage: string | null = null;

  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);

      if (response.ok) {
        if (response.status === 204) {
          activeApiBaseUrl = baseUrl;
          activeApiOrigin = new URL(baseUrl, window.location.origin).origin;
          return undefined as T;
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          // Wrong base URL can return HTML with 200; keep trying candidates.
          lastErrorMessage = "Backend response is not JSON";
          continue;
        }

        activeApiBaseUrl = baseUrl;
        activeApiOrigin = new URL(baseUrl, window.location.origin).origin;
        return response.json() as Promise<T>;
      }

      const fallback = `Request failed with status ${response.status}`;
      let detail = fallback;

      try {
        const data = await response.clone().json();
        if (typeof data?.detail === "string") {
          detail = data.detail;
        }
      } catch {
        try {
          const text = await response.clone().text();
          if (text.trim()) {
            detail = text;
          }
        } catch {
          detail = fallback;
        }
      }

      lastErrorMessage = detail;

      // Typical "wrong origin/base path" signal: keep trying remaining candidates.
      if (response.status === 404 || response.status === 405) {
        continue;
      }

      throw new Error(detail);
    } catch (err) {
      if (err instanceof TypeError) {
        continue;
      }
      if (err instanceof Error && err.message !== "Failed to fetch") {
        throw err;
      }
    }
  }

  throw new Error(lastErrorMessage ?? "No se pudo conectar con el backend");
}

export async function fetchMessages(limit = 200): Promise<Message[]> {
  const data = await request<BackendMessage[]>(`/messages?limit=${limit}`);
  if (!Array.isArray(data)) return [];
  return data.map(mapMessage);
}

export async function fetchCategories(): Promise<Category[]> {
  const data = await request<BackendCategory[]>("/categories");
  if (!Array.isArray(data)) return [];
  return data.map(mapCategory);
}

export async function postTextMessage(content: string): Promise<Message> {
  const data = await request<BackendMessage>("/messages/text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });

  return mapMessage(data);
}

export async function postImageMessage(file: File): Promise<Message> {
  const formData = new FormData();
  formData.append("file", file);

  const data = await request<BackendMessage>("/messages/image", {
    method: "POST",
    body: formData,
  });

  return mapMessage(data);
}
