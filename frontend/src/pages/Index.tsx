import { useEffect, useState } from "react";
import { ViewMode, Message, Category } from "@/types/brain";
import ChatView from "@/components/ChatView";
import MindmapView from "@/components/MindmapView";
import BrowseView from "@/components/BrowseView";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import ViewSwitcher from "@/components/ViewSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { fetchCategories, fetchMessages, postImageMessage, postTextMessage } from "@/lib/api";
import { GitBranch } from "lucide-react";

interface SendMessagePayload {
  type: "text" | "image";
  content?: string;
  file?: File;
}

const Index = () => {
  const [view, setView] = useState<ViewMode>("mindmap");
  const [messages, setMessages] = useState<Message[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setError(null);
      setIsLoading(true);

      const [messagesResult, categoriesResult] = await Promise.allSettled([fetchMessages(), fetchCategories()]);

      if (!isMounted) return;

      if (messagesResult.status === "fulfilled") {
        setMessages(messagesResult.value);
      }

      if (categoriesResult.status === "fulfilled") {
        setCategories(categoriesResult.value);
      } else {
        setCategories([]);
      }

      if (messagesResult.status === "rejected" && categoriesResult.status === "rejected") {
        const reason = messagesResult.reason instanceof Error
          ? messagesResult.reason.message
          : "No se pudieron cargar los datos";
        setError(reason);
      }

      setIsLoading(false);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSendMessage = async (payload: SendMessagePayload) => {
    if (isSending) return;
    if (payload.type === "text" && !payload.content?.trim()) return;
    if (payload.type === "image" && !payload.file) return;

    try {
      setError(null);
      setIsSending(true);

      const createdMessage = payload.type === "image" && payload.file
        ? await postImageMessage(payload.file)
        : await postTextMessage(payload.content ?? "");

      setMessages((prev) => [...prev, createdMessage]);

      if (
        createdMessage.category_id !== null &&
        !categories.some((category) => category.id === createdMessage.category_id)
      ) {
          try {
            const refreshedCategories = await fetchCategories();
            setCategories(refreshedCategories);
          } catch {
            setCategories((prev) => prev);
          }
        }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <GitBranch className="w-4.5 h-4.5 text-primary" />
          </div>
          <h1 className="font-mono text-base font-semibold text-foreground tracking-tight">
            Brainch
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher current={view} onChange={setView} />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 min-h-0">
        {error && (
          <div className="px-4 py-2 text-sm text-destructive border-b border-border bg-destructive/10">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground font-mono">
            Loading data...
          </div>
        ) : (
          <>
            {view === "chat" && (
              <ChatView messages={messages} onSendMessage={handleSendMessage} isSending={isSending} />
            )}
            {view === "mindmap" && (
              <MindmapView categories={categories} messages={messages} />
            )}
            {view === "browse" && (
              <BrowseView messages={messages} categories={categories} />
            )}
            {view === "suggestions" && (
              <SuggestionsPanel messages={messages} categories={categories} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
