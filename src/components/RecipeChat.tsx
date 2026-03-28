import { useState, useEffect, useRef, useCallback } from "react";

interface Message {
  role: "user" | "model";
  content: string;
}

interface Props {
  recipeContext: string;
}

export default function RecipeChat({ recipeContext }: Props) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(true); // default hidden until checked
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check localStorage on mount
  useEffect(() => {
    setDismissed(localStorage.getItem("chatDismissed") === "true");
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem("chatDismissed", "true");
    setDismissed(true);
    setOpen(false);
  };

  const undismiss = useCallback(() => {
    localStorage.removeItem("chatDismissed");
    setDismissed(false);
  }, []);

  // Expose undismiss globally so the Astro page can call it
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__showRecipeChat = undismiss;
    return () => {
      delete (window as unknown as Record<string, unknown>).__showRecipeChat;
    };
  }, [undismiss]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add empty assistant message to stream into
    const assistantMsg: Message = { role: "model", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          recipeContext,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";

        for (const chunk of chunks) {
          if (!chunk.startsWith("data: ")) continue;
          const dataStr = chunk.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          try {
            const { text } = JSON.parse(dataStr);
            if (text) {
              accumulated += text;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "model", content: accumulated };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "model",
          content: "Sorry, I couldn't process that. Please try again.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Don't render anything if dismissed
  if (dismissed) return null;

  // Floating bubble (collapsed)
  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-40 group">
        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warm-gray/80 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Dismiss chat"
        >
          ×
        </button>
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-terracotta text-white shadow-lg hover:bg-terracotta-dark hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          aria-label="Open recipe assistant"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" />
          </svg>
        </button>
      </div>
    );
  }

  // Chat panel (expanded)
  return (
    <div className="fixed bottom-6 right-6 z-40 w-[350px] max-w-[calc(100vw-2rem)] h-[450px] max-h-[calc(100vh-4rem)] bg-warm-white rounded-2xl shadow-2xl border border-warm-gray/15 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-warm-gray/10 bg-cream/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sage animate-pulse" />
          <span className="text-sm font-medium text-charcoal">Recipe Assistant</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-charcoal hover:bg-cream transition-colors"
          aria-label="Minimize chat"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Welcome message */}
        {messages.length === 0 && (
          <div className="bg-sage-light/40 rounded-xl rounded-bl-sm px-3 py-2 text-sm text-charcoal">
            Ask me anything about this recipe — substitutions, timing, technique tips.
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-terracotta text-white rounded-br-sm"
                  : "bg-sage-light/40 text-charcoal rounded-bl-sm"
              }`}
            >
              {msg.content || (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-warm-gray/40 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-warm-gray/40 animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-warm-gray/40 animate-bounce [animation-delay:0.3s]" />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-warm-gray/10">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this recipe..."
            disabled={streaming}
            className="flex-1 px-3 py-2 rounded-lg bg-cream border border-warm-gray/15 text-sm text-charcoal placeholder:text-muted focus:outline-none focus:border-terracotta/40 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="w-8 h-8 rounded-lg bg-terracotta text-white flex items-center justify-center hover:bg-terracotta-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3 21l18-9L3 3l3 9zm0 0h9" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
