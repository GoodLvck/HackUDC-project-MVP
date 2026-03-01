import { ViewMode } from "@/types/brain";
import { MessageSquare, GitBranch, LayoutList, Lightbulb } from "lucide-react";

interface ViewSwitcherProps {
  current: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const views: { mode: ViewMode; icon: typeof MessageSquare; label: string }[] = [
  { mode: "chat", icon: MessageSquare, label: "Chat" },
  { mode: "mindmap", icon: GitBranch, label: "Map" },
  { mode: "browse", icon: LayoutList, label: "Browse" },
  { mode: "suggestions", icon: Lightbulb, label: "Ideas" },
];

const ViewSwitcher = ({ current, onChange }: ViewSwitcherProps) => {
  return (
    <div className="flex items-center gap-1 bg-card rounded-xl p-1 border border-border">
      {views.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            current === mode
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
};

export default ViewSwitcher;
