import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable, canvasCredentials, canvasCache } from "@/lib/db/schema";
import { and, eq, like, lt } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";

const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "demo-assignly-2026";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  // Prune ephemeral demo accounts older than 7 days.
  // canvas_cache has no FK cascade, so delete it before removing the user rows.
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
  const oldDemoUsers = await db.query.user.findMany({
    where: and(
      like(userTable.email, "demo-%@assignly.demo"),
      lt(userTable.createdAt, cutoff)
    ),
  });
  if (oldDemoUsers.length > 0) {
    for (const old of oldDemoUsers) {
      await db.delete(canvasCache).where(eq(canvasCache.userId, old.id));
    }
    await db.delete(userTable).where(
      and(
        like(userTable.email, "demo-%@assignly.demo"),
        lt(userTable.createdAt, cutoff)
      )
    );
  }

  // Create a fresh, isolated account for this demo session.
  // Each visitor gets a unique user ID so their threads are private and
  // concurrent demo users never interfere with each other.
  const uid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const email = `demo-${uid}@assignly.demo`;

  await auth.api.signUpEmail({
    body: { name: "Demo Student", email, password: DEMO_PASSWORD },
  });

  const created = await db.query.user.findFirst({
    where: eq(userTable.email, email),
  });
  if (created) {
    await db
      .update(userTable)
      .set({ canvasBaseUrl: "demo" })
      .where(eq(userTable.id, created.id));

    await db
      .insert(canvasCredentials)
      .values({ userId: created.id, accessToken: encrypt("demo") })
      .onConflictDoNothing();
  }

  // Sign in as the new demo account and forward the session cookies
  const signInRes = await auth.api.signInEmail({
    body: { email, password: DEMO_PASSWORD },
    asResponse: true,
  });

  const redirectResponse = NextResponse.redirect(new URL("/dashboard", request.url));
  for (const cookie of signInRes.headers.getSetCookie?.() ?? []) {
    redirectResponse.headers.append("set-cookie", cookie);
  }
  return redirectResponse;
}
