"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  generateId,
  isTextUIPart,
  isToolUIPart,
} from "ai";
import { useMemo, useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Loader2 } from "lucide-react";

export default function ChatPage() {
  const [chatId] = useState(() => generateId());
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    transport,
    onError: (err) => console.error("[useChat error]", err),
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <main className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <Link
          href="/dashboard"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-semibold">Assignly</h1>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-sm text-center text-muted-foreground">
              Ask me anything about your assignments, grades, or schedule.
            </p>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {message.parts.map((part, i) => {
                  if (isTextUIPart(part)) {
                    if (message.role === "user") {
                      return (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      );
                    }
                    return (
                      <ReactMarkdown
                        key={i}
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="mb-2 list-disc pl-4">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="mb-2 list-decimal pl-4">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="mb-0.5">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold">{children}</strong>
                          ),
                          table: ({ children }) => (
                            <div className="mb-2 overflow-x-auto">
                              <table className="w-full border-collapse text-xs">
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border border-border px-2 py-1 text-left font-semibold">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-border px-2 py-1">
                              {children}
                            </td>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="mb-2 border-l-2 border-border pl-3 italic opacity-80">
                              {children}
                            </blockquote>
                          ),
                          code: ({ children }) => (
                            <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-xs dark:bg-white/10">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {part.text}
                      </ReactMarkdown>
                    );
                  }
                  if (isToolUIPart(part)) {
                    if (
                      part.state === "input-streaming" ||
                      part.state === "input-available"
                    ) {
                      return (
                        <p
                          key={i}
                          className="flex items-center gap-1.5 text-xs opacity-70"
                        >
                          <Loader2 className="size-3 animate-spin" />
                          Looking up your Canvas data…
                        </p>
                      );
                    }
                  }
                  return null;
                })}
              </div>
            </div>
          ))}

          {/* Error state */}
          {error && (
            <div className="flex justify-start">
              <p className="max-w-[80%] rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {error.message || "Something went wrong. Please try again."}
              </p>
            </div>
          )}

          {/* Typing indicator while waiting for first token */}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-muted px-4 py-3">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border px-4 py-4">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your assignments, due dates, grades…"
            disabled={isLoading}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
