import { Message, Category } from "@/types/brain";
import { Lightbulb, Bell, CheckCircle2, BookOpen, TrendingUp, X } from "lucide-react";
import { useState } from "react";

interface SuggestionsPanelProps {
  messages: Message[];
  categories: Category[];
}

interface Suggestion {
  id: string;
  icon: typeof Lightbulb;
  title: string;
  description: string;
  type: "reminder" | "done" | "learn" | "insight";
}

const SuggestionsPanel = ({ messages, categories }: SuggestionsPanelProps) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const suggestions: Suggestion[] = [];

  const unprocessed = messages.filter((m) => m.tags.includes("unprocessed"));
  if (unprocessed.length > 0) {
    suggestions.push({
      id: "unprocessed",
      icon: Bell,
      title: "Categorize new entries",
      description: `You have ${unprocessed.length} unprocessed message${unprocessed.length > 1 ? "s" : ""} waiting to be organized.`,
      type: "reminder",
    });
  }

  const bookMsgs = messages.filter((m) => m.tags.some((t) => ["book", "books", "reading", "notes"].includes(t)));
  if (bookMsgs.length > 0) {
    suggestions.push({
      id: "reading",
      icon: BookOpen,
      title: "Continue reading",
      description: `You have ${bookMsgs.length} reading note${bookMsgs.length > 1 ? "s" : ""}. Pick up where you left off!`,
      type: "learn",
    });
  }

  const projectsCategory = categories.find((c) => c.name.toLowerCase() === "projects");
  const projectMsgs = projectsCategory
    ? messages.filter((m) => m.category_id === projectsCategory.id)
    : [];

  if (projectMsgs.length > 0) {
    suggestions.push({
      id: "projects",
      icon: CheckCircle2,
      title: "Review project tasks",
      description: `${projectMsgs.length} project item${projectMsgs.length > 1 ? "s" : ""} — mark completed ones as done.`,
      type: "done",
    });
  }

  const topCategories = categories
    .filter((c) => c.parent_id !== null)
    .map((c) => ({
      cat: c,
      count: messages.filter((m) => m.category_id === c.id).length,
    }))
    .sort((a, b) => b.count - a.count);

  if (topCategories.length >= 2 && topCategories[0].count > 0) {
    suggestions.push({
      id: "trending",
      icon: TrendingUp,
      title: "Trending topic",
      description: `"${topCategories[0].cat.name}" is your most active area with ${topCategories[0].count} entries.`,
      type: "insight",
    });
  }

  suggestions.push({
    id: "reminder-general",
    icon: Lightbulb,
    title: "Set a daily reminder",
    description: "Capture at least one thought per day to build your knowledge base.",
    type: "reminder",
  });

  const visible = suggestions.filter((s) => !dismissed.has(s.id));

  const typeColors: Record<string, string> = {
    reminder: "text-primary",
    done: "text-green-500",
    learn: "text-blue-500",
    insight: "text-purple-500",
  };

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-sm">
        All caught up! 🎉
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <h3 className="font-mono text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <Lightbulb className="w-4 h-4 text-primary" />
        Suggestions
      </h3>
      {visible.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.id}
            className="group bg-card rounded-xl px-4 py-3 border border-border hover:border-primary/30 transition-all animate-fade-in"
          >
            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${typeColors[s.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
              </div>
              <button
                onClick={() => setDismissed((prev) => new Set(prev).add(s.id))}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SuggestionsPanel;
