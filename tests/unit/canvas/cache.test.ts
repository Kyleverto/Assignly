import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";

const dbUrl = process.env.DATABASE_URL;

describe.skipIf(!dbUrl)("Canvas DB cache", () => {
  const TEST_USER = "cache-unit-test-user";
  const TEST_KEY = "cache-unit-test-key";
  const EXPIRED_KEY = "cache-unit-test-key-expired";

  afterAll(async () => {
    const { db } = await import("@/lib/db");
    const { canvasCache } = await import("@/lib/db/schema");
    await db.delete(canvasCache).where(eq(canvasCache.userId, TEST_USER));
  });

  it("returns null on cache miss", async () => {
    const { getCached } = await import("@/lib/canvas/cache");
    const result = await getCached(TEST_USER, TEST_KEY);
    expect(result).toBeNull();
  });

  it("writes to DB on cache set and returns the value on next read", async () => {
    const { getCached, setCached } = await import("@/lib/canvas/cache");
    await setCached(TEST_USER, TEST_KEY, { courses: ["CS 301", "MATH 241"] }, 60_000);
    const result = await getCached<{ courses: string[] }>(TEST_USER, TEST_KEY);
    expect(result).toEqual({ courses: ["CS 301", "MATH 241"] });
  });

  it("upserts on duplicate key (updates value and TTL)", async () => {
    const { getCached, setCached } = await import("@/lib/canvas/cache");
    await setCached(TEST_USER, TEST_KEY, { courses: ["ENG 201"] }, 60_000);
    const result = await getCached<{ courses: string[] }>(TEST_USER, TEST_KEY);
    expect(result?.courses).toEqual(["ENG 201"]);
  });

  it("returns null for entries whose TTL has already passed", async () => {
    const { getCached, setCached } = await import("@/lib/canvas/cache");
    // TTL of -1000ms means the expiresAt is already in the past
    await setCached(TEST_USER, EXPIRED_KEY, { stale: true }, -1000);
    const result = await getCached(TEST_USER, EXPIRED_KEY);
    expect(result).toBeNull();
  });
});
