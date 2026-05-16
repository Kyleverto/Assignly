"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { useState } from "react";

interface Thread {
  id: string;
  title: string | null;
}

export function ThreadSidebar({ threads }: { threads: Thread[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, threadId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;

    setDeletingId(threadId);
    try {
      await fetch(`/api/threads/${threadId}`, { method: "DELETE" });
      router.refresh();
      if (pathname === `/chat/${threadId}`) {
        router.push("/chat");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside className="hidden sm:flex w-60 flex-shrink-0 flex-col border-r border-border bg-muted/20">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conversations
        </span>
        <Link
          href="/chat"
          aria-label="New chat"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageSquarePlus className="size-4" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {threads.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No conversations yet. Start chatting!
          </p>
        ) : (
          threads.map((thread) => {
            const isActive = pathname === `/chat/${thread.id}`;
            const isDeleting = deletingId === thread.id;
            return (
              <div
                key={thread.id}
                className={`group relative mx-1 flex items-center rounded-md transition-colors ${
                  isActive
                    ? "bg-muted"
                    : "hover:bg-muted/60"
                }`}
              >
                <Link
                  href={`/chat/${thread.id}`}
                  className={`min-w-0 flex-1 truncate px-3 py-2 text-sm ${
                    isActive
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {thread.title ?? "New conversation"}
                </Link>
                <button
                  onClick={(e) => handleDelete(e, thread.id)}
                  disabled={isDeleting}
                  aria-label="Delete conversation"
                  className="mr-1 flex rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </nav>
    </aside>
  );
}
