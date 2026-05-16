import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable, canvasCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";

const DEMO_EMAIL = "demo@assignly.demo";
const DEMO_NAME = "Demo Student";
// Set DEMO_USER_PASSWORD in your environment. Keep it secret — it only
// needs to be a valid Better Auth password (8+ chars); it is never exposed to clients.
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "demo-assignly-2026";

export async function GET(request: NextRequest) {
  // Ensure the demo account exists
  const existing = await db.query.user.findFirst({
    where: eq(userTable.email, DEMO_EMAIL),
  });

  if (!existing) {
    // Create the demo user via Better Auth so the password is properly hashed
    await auth.api.signUpEmail({
      body: { name: DEMO_NAME, email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });

    // Wire up demo Canvas credentials (sentinel value, real client never used)
    const created = await db.query.user.findFirst({
      where: eq(userTable.email, DEMO_EMAIL),
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
  } else if (!existing.canvasBaseUrl) {
    // Repair missing demo fields if the account was created without them
    await db
      .update(userTable)
      .set({ canvasBaseUrl: "demo" })
      .where(eq(userTable.id, existing.id));

    await db
      .insert(canvasCredentials)
      .values({ userId: existing.id, accessToken: encrypt("demo") })
      .onConflictDoNothing();
  }

  // Sign in as the demo user and capture the auth cookies
  const signInRes = await auth.api.signInEmail({
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    asResponse: true,
  });

  const redirectResponse = NextResponse.redirect(
    new URL("/dashboard", request.url)
  );

  // Forward all Set-Cookie headers so the browser gets the session cookie
  const setCookies = signInRes.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    redirectResponse.headers.append("set-cookie", cookie);
  }

  return redirectResponse;
}
