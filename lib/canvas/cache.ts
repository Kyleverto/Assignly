import { db } from "@/lib/db";
import { canvasCache } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";

export async function getCached<T>(userId: string, key: string): Promise<T | null> {
  const row = await db.query.canvasCache.findFirst({
    where: and(
      eq(canvasCache.userId, userId),
      eq(canvasCache.cacheKey, key),
      gt(canvasCache.expiresAt, new Date())
    ),
  });
  if (!row) return null;
  return row.payload as T;
}

export async function setCached<T>(
  userId: string,
  key: string,
  data: T,
  ttlMs: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  await db
    .insert(canvasCache)
    .values({
      userId,
      cacheKey: key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: data as any,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [canvasCache.userId, canvasCache.cacheKey],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set: { payload: data as any, expiresAt },
    });
}
