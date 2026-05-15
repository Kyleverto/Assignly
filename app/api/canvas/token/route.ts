import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canvasCredentials, user } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { CanvasClient } from "@/lib/canvas/client";
import { CanvasError } from "@/lib/canvas/types";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { canvasBaseUrl?: string; accessToken?: string };
  const { canvasBaseUrl, accessToken } = body;

  if (!canvasBaseUrl || !accessToken) {
    return NextResponse.json(
      { error: "canvasBaseUrl and accessToken are required" },
      { status: 400 }
    );
  }

  // Normalize: strip trailing slash
  const baseUrl = canvasBaseUrl.replace(/\/$/, "");

  // Validate the token against Canvas before storing anything
  let canvasUserId: number;
  try {
    const client = new CanvasClient(baseUrl, accessToken);
    const canvasUser = await client.validateAndGetUser();
    canvasUserId = canvasUser.id;
  } catch (err) {
    if (err instanceof CanvasError && err.status === 401) {
      return NextResponse.json(
        { error: "Invalid access token. Please check and try again." },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "Could not reach Canvas. Check your Canvas URL and try again." },
      { status: 422 }
    );
  }

  const encryptedToken = encrypt(accessToken);

  // Upsert credentials
  await db
    .insert(canvasCredentials)
    .values({
      userId: session.user.id,
      kind: "pat",
      accessToken: encryptedToken,
    })
    .onConflictDoUpdate({
      target: canvasCredentials.userId,
      set: { accessToken: encryptedToken },
    });

  // Write Canvas user ID and base URL back to the user row
  await db
    .update(user)
    .set({ canvasUserId, canvasBaseUrl: baseUrl })
    .where(eq(user.id, session.user.id));

  return NextResponse.json({ ok: true });
}
