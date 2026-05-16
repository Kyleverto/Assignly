import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { threads, messages as messagesTable } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import type { UIMessage } from "ai";
import { ChatUI } from "@/components/chat-ui";

export default async function ExistingChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const thread = await db.query.threads.findFirst({
    where: and(eq(threads.id, id), eq(threads.userId, session.user.id)),
  });
  if (!thread) notFound();

  const rows = await db.query.messages.findMany({
    where: eq(messagesTable.threadId, id),
    orderBy: asc(messagesTable.createdAt),
  });

  const initialMessages = rows.map((r) => r.content as UIMessage);

  return <ChatUI chatId={id} initialMessages={initialMessages} />;
}
