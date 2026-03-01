import { Category, Message } from "@/types/brain";

export const mockCategories: Category[] = [
  { id: "root", name: "My Brain", description: "Root of all knowledge", parent_id: null },
  { id: "tech", name: "Technology", description: "Tech ideas and resources", parent_id: "root" },
  { id: "health", name: "Health", description: "Wellness and fitness", parent_id: "root" },
  { id: "projects", name: "Projects", description: "Active projects and ideas", parent_id: "root" },
  { id: "books", name: "Books", description: "Reading list and notes", parent_id: "root" },
  { id: "web", name: "Web Dev", description: "Frontend & backend", parent_id: "tech" },
  { id: "ai", name: "AI / ML", description: "Machine learning notes", parent_id: "tech" },
  { id: "fitness", name: "Fitness", description: "Workout routines", parent_id: "health" },
  { id: "nutrition", name: "Nutrition", description: "Diet and recipes", parent_id: "health" },
  { id: "react", name: "React", description: "React tips and patterns", parent_id: "web" },
  { id: "css", name: "CSS", description: "Styling techniques", parent_id: "web" },
];

export const mockMessages: Message[] = [
  { id: "1", content: "Check out the new React 19 features — especially the use() hook", type: "text", tags: ["react", "hooks", "update"], category_id: "react", created_at: "2026-02-28T10:00:00Z" },
  { id: "2", content: "CSS container queries are game-changing for responsive components", type: "text", tags: ["css", "responsive"], category_id: "css", created_at: "2026-02-28T10:05:00Z" },
  { id: "3", content: "https://arxiv.org/abs/2401.00001", type: "link", tags: ["paper", "transformers"], category_id: "ai", created_at: "2026-02-28T10:10:00Z" },
  { id: "4", content: "Morning routine: 20 min HIIT + 10 min stretching", type: "text", tags: ["routine", "morning"], category_id: "fitness", created_at: "2026-02-28T10:15:00Z" },
  { id: "5", content: "Try overnight oats with chia seeds and blueberries", type: "text", tags: ["recipe", "breakfast"], category_id: "nutrition", created_at: "2026-02-28T10:20:00Z" },
  { id: "6", content: "Build a digital brain app with mindmap visualization", type: "text", tags: ["idea", "app"], category_id: "projects", created_at: "2026-02-28T10:25:00Z" },
  { id: "7", content: "Read 'Thinking, Fast and Slow' — Chapter 3 notes pending", type: "text", tags: ["psychology", "notes"], category_id: "books", created_at: "2026-02-28T10:30:00Z" },
  { id: "8", content: "GPT-5 rumors — multimodal reasoning improvements", type: "text", tags: ["gpt", "news"], category_id: "ai", created_at: "2026-02-28T10:35:00Z" },
];
