export type MessageType = "text" | "image" | "link";

export interface Category {
  id: number;
  name: string;
  tags: string[];
  description: string;
  parent_id: number | null;
  created_at: string;
  message_count: number;
}

export interface Message {
  id: number;
  content: string;
  type: MessageType;
  tags: string[];
  category_id: number | null;
  created_at: string;
}

export type ViewMode = "chat" | "mindmap" | "browse" | "suggestions";
