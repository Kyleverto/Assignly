"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";

interface Thread {
  id: string;
  title: string | null;
}

export function ThreadSidebar({ threads }: { threads: Thread[] }) {
  const pathname = usePathname();

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
            return (
              <Link
                key={thread.id}
                href={`/chat/${thread.id}`}
                className={`block truncate rounded-md mx-1 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {thread.title ?? "New conversation"}
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
