import { useState, useRef, useEffect } from "react";
import { Send, Image as ImageIcon, Link, Tag, X, Loader2 } from "lucide-react";
import { Message } from "@/types/brain";
import { format } from "date-fns";

interface SendMessagePayload {
  type: "text" | "image";
  content?: string;
  file?: File;
}

interface ChatViewProps {
  messages: Message[];
  onSendMessage: (payload: SendMessagePayload) => Promise<void>;
  isSending: boolean;
}

const ChatView = ({ messages, onSendMessage, isSending }: ChatViewProps) => {
  const [input, setInput] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleSend = async () => {
    if (isSending) return;

    if (selectedFile && imagePreview) {
      await onSendMessage({ type: "image", file: selectedFile });
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setSelectedFile(null);
      return;
    }

    if (!input.trim()) return;

    const textToSend = input.trim();
    await onSendMessage({ type: "text", content: textToSend });
    setInput("");
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const getTypeIcon = (type: Message["type"]) => {
    switch (type) {
      case "image":
        return <ImageIcon className="w-3.5 h-3.5" />;
      case "link":
        return <Link className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse-glow">
                <span className="text-2xl">🧠</span>
              </div>
              <p className="text-muted-foreground font-mono text-sm">
                Start capturing your thoughts...
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="flex justify-end animate-fade-in">
            <div className="max-w-[80%] space-y-1.5">
              <div className="bg-chat-bubble text-chat-bubble-foreground rounded-2xl rounded-br-sm px-4 py-2.5 shadow-md">
                <div className="flex items-start gap-2">
                  {getTypeIcon(msg.type)}
                  {msg.type === "image" ? (
                    <img
                      src={msg.content}
                      alt="Uploaded"
                      className="max-w-full rounded-lg max-h-60 object-cover"
                    />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.type === "link" ? (
                        <a
                          href={msg.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:opacity-80"
                        >
                          {msg.content}
                        </a>
                      ) : (
                        msg.content
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-1">
                {msg.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    {msg.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(msg.created_at), "HH:mm")}
                </span>
              </div>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {imagePreview && (
        <div className="px-4 pb-2 animate-fade-in">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-24 rounded-lg border border-border object-cover" />
            <button
              onClick={() => {
                if (imagePreview) {
                  URL.revokeObjectURL(imagePreview);
                }
                setImagePreview(null);
                setSelectedFile(null);
              }}
              className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-border">
        <div className="flex items-end gap-2 bg-chat-input-bg rounded-2xl px-4 py-2 border border-border focus-within:border-primary/50 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 disabled:opacity-40"
            aria-label="Attach image"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              void handleKeyDown(e);
            }}
            placeholder={isSending ? "Waiting for tags..." : "Capture a thought..."}
            rows={1}
            disabled={isSending}
            className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder:text-muted-foreground outline-none py-1.5 max-h-32 disabled:opacity-50"
          />
          <button
            onClick={() => {
              void handleSend();
            }}
            disabled={isSending || (!input.trim() && !imagePreview)}
            className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
