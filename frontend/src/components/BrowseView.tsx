import { useState, useMemo } from "react";
import { Message, Category } from "@/types/brain";
import { Tag, Clock, FileText, Image, Link, Search, ChevronRight, ChevronDown, List, FolderTree, Folder, FolderOpen, ArrowLeft, Lightbulb, Bell, CheckCircle2, BookOpen, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface BrowseViewProps {
  messages: Message[];
  categories: Category[];
}

type ViewMode = "list" | "folders";

const BrowseView = ({ messages, categories }: BrowseViewProps) => {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set(categories.map((c) => c.id)));
  const [viewMode, setViewMode] = useState<ViewMode>("folders");
  const [navPath, setNavPath] = useState<number[]>([]);

  const getTypeIcon = (type: Message["type"]) => {
    switch (type) {
      case "image": return <Image className="w-4 h-4" />;
      case "link": return <Link className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const toggleCategory = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const lowerSearch = search.toLowerCase();

  const matchedCategoryIds = useMemo(() => {
    if (!search) return new Set<number>();
    const ids = new Set<number>();
    categories.forEach((c) => {
      if (c.name.toLowerCase().includes(lowerSearch) || c.description.toLowerCase().includes(lowerSearch)) {
        ids.add(c.id);
      }
    });
    return ids;
  }, [categories, lowerSearch, search]);

  const filteredMessages = useMemo(() => {
    if (!search) return messages;
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(lowerSearch) ||
        m.tags.some((t) => t.toLowerCase().includes(lowerSearch)) ||
        (m.category_id !== null && matchedCategoryIds.has(m.category_id))
    );
  }, [messages, search, lowerSearch, matchedCategoryIds]);

  const categoryTree = useMemo(() => {
    const childrenMap: Record<string, Category[]> = {};
    categories.forEach((c) => {
      const pid = c.parent_id ?? "__root__";
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(c);
    });
    return childrenMap;
  }, [categories]);

  const getMessageCount = (catId: number): number => {
    const direct = filteredMessages.filter((m) => m.category_id === catId).length;
    const childCats = categoryTree[catId] ?? [];
    return direct + childCats.reduce((sum, c) => sum + getMessageCount(c.id), 0);
  };

  const getCategoryById = (id: number) => categories.find((c) => c.id === id);

  // Suggestions for a specific category
  const getCategorySuggestions = (catId: number) => {
    const cat = getCategoryById(catId);
    if (!cat) return [];
    const catMessages = messages.filter((m) => m.category_id === catId);
    const suggestions: { icon: typeof Lightbulb; title: string; description: string; color: string }[] = [];

    const unprocessed = catMessages.filter((m) => m.tags.includes("unprocessed"));
    if (unprocessed.length > 0) {
      suggestions.push({
        icon: Bell,
        title: "Organize entries",
        description: `${unprocessed.length} unprocessed item${unprocessed.length > 1 ? "s" : ""} in "${cat.name}"`,
        color: "text-primary",
      });
    }

    if (catMessages.some((m) => m.tags.some((t) => ["book", "reading", "notes", "learn"].includes(t)))) {
      suggestions.push({
        icon: BookOpen,
        title: "Continue learning",
        description: `Pick up your "${cat.name}" reading notes`,
        color: "text-blue-500",
      });
    }

    if (catMessages.length >= 3) {
      suggestions.push({
        icon: TrendingUp,
        title: "Active topic",
        description: `${catMessages.length} entries — consider reviewing and consolidating`,
        color: "text-purple-500",
      });
    }

    if (catMessages.some((m) => m.tags.some((t) => ["todo", "task", "project"].includes(t)))) {
      suggestions.push({
        icon: CheckCircle2,
        title: "Review tasks",
        description: `Mark completed items as done in "${cat.name}"`,
        color: "text-green-500",
      });
    }

    return suggestions;
  };

  const MessageCard = ({ msg }: { msg: Message }) => (
    <div className="group bg-card hover:bg-muted/50 rounded-lg px-4 py-3 transition-colors">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{getTypeIcon(msg.type)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-relaxed">
            {msg.type === "link" ? (
              <a href={msg.content} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                {msg.content}
              </a>
            ) : (
              msg.content
            )}
          </p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              <Tag className="w-3 h-3 text-muted-foreground" />
              {msg.tags.map((tag) => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {format(new Date(msg.created_at), "MMM d, HH:mm")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Current category in navigation
  const currentCatId = navPath.length > 0 ? navPath[navPath.length - 1] : null;
  const currentCat = currentCatId !== null ? getCategoryById(currentCatId) : null;
  const childCategories = currentCatId !== null
    ? (categoryTree[currentCatId] ?? [])
    : categories.filter((c) => c.parent_id === null);
  const directMessages = currentCatId !== null
    ? filteredMessages.filter((m) => m.category_id === currentCatId)
    : [];
  const currentSuggestions = currentCatId !== null ? getCategorySuggestions(currentCatId) : [];

  const navigateInto = (catId: number) => {
    setNavPath((prev) => [...prev, catId]);
  };

  const navigateTo = (index: number) => {
    setNavPath((prev) => prev.slice(0, index + 1));
  };

  // List view grouped
  const grouped = filteredMessages.reduce<Record<string, Message[]>>((acc, msg) => {
    const cat = categories.find((c) => c.id === msg.category_id)?.name ?? "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(msg);
    return acc;
  }, {});

  // Filter children in folder view when searching
  const visibleChildren = search
    ? childCategories.filter((c) => getMessageCount(c.id) > 0 || matchedCategoryIds.has(c.id))
    : childCategories;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {/* Search + View Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories, tags, content..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setViewMode("folders")}
            className={`p-2.5 transition-colors ${viewMode === "folders" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <FolderTree className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2.5 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "folders" ? (
        <div className="space-y-4 animate-fade-in">
          {/* Breadcrumb */}
          {navPath.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setNavPath([])}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-mono"
              >
                <ArrowLeft className="w-3 h-3" />
                Home
              </button>
              {navPath.map((id, i) => {
                const cat = getCategoryById(id);
                return (
                  <span key={String(id)} className="flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    <button
                      onClick={() => navigateTo(i)}
                      className={`text-xs font-mono transition-colors ${
                        i === navPath.length - 1
                          ? "text-primary font-semibold"
                          : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      {cat?.name ?? "..."}
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Current category header */}
          {currentCat && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <FolderOpen className="w-5 h-5 text-primary" />
                <h3 className="font-mono font-semibold text-foreground text-sm">{currentCat.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{currentCat.description}</p>
            </div>
          )}

          {/* Suggestions for current category */}
          {currentSuggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3" /> Suggestions
              </p>
              {currentSuggestions.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5 bg-card border border-border rounded-lg px-3 py-2.5">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${s.color}`} />
                    <div>
                      <p className="text-xs font-medium text-foreground">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub-category cards */}
          {visibleChildren.length > 0 && (
            <div>
              {currentCat && (
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-2">Sub-categories</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {visibleChildren.map((cat) => {
                  const children = categoryTree[cat.id] ?? [];
                  const totalCount = getMessageCount(cat.id);

                  return (
                    <button
                      key={cat.id}
                      onClick={() => navigateInto(cat.id)}
                      className="flex flex-col items-start gap-1.5 rounded-xl border border-border p-4 bg-card hover:bg-muted/50 hover:border-primary/30 hover:shadow-md transition-all text-left"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Folder className="w-5 h-5 text-primary/70 shrink-0" />
                        <span className="font-medium text-sm text-foreground truncate">{cat.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{cat.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {totalCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-mono">
                            {totalCount} item{totalCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {children.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                            {children.length} sub
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages in current category */}
          {directMessages.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                Messages ({directMessages.length})
              </p>
              {directMessages.map((msg) => (
                <MessageCard key={msg.id} msg={msg} />
              ))}
            </div>
          )}

          {visibleChildren.length === 0 && directMessages.length === 0 && currentCat && (
            <p className="text-xs text-muted-foreground italic text-center py-6">Empty category</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([catName, msgs]) => {
            const cat = categories.find((c) => c.name === catName);
            const isExpanded = cat ? expanded.has(cat.id) : true;

            return (
              <div key={catName} className="space-y-1">
                <button
                  onClick={() => cat && toggleCategory(cat.id)}
                  className="w-full flex items-center gap-2 font-mono text-sm font-semibold text-primary hover:text-primary/80 transition-colors py-1"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  {catName}
                  <span className="text-xs font-normal text-muted-foreground ml-auto">{msgs.length}</span>
                </button>
                {isExpanded && (
                  <div className="space-y-1.5 pl-4 border-l border-border ml-2 animate-fade-in">
                    {msgs.map((msg) => (
                      <MessageCard key={msg.id} msg={msg} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filteredMessages.length === 0 && viewMode === "list" && (
        <div className="flex items-center justify-center h-40 text-muted-foreground font-mono text-sm">
          {search ? "No results found" : "No entries yet"}
        </div>
      )}
    </div>
  );
};

export default BrowseView;
