import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ThreadSidebar } from "@/components/thread-sidebar";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const userThreads = await db.query.threads.findMany({
    where: eq(threads.userId, session.user.id),
    orderBy: desc(threads.createdAt),
    limit: 50,
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <ThreadSidebar threads={userThreads} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
