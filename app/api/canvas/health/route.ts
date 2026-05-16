import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canvasCredentials } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { CanvasClient } from "@/lib/canvas/client";
import { CanvasError } from "@/lib/canvas/types";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  const { canvasBaseUrl } = session.user as { canvasBaseUrl?: string };
  if (!canvasBaseUrl) {
    return NextResponse.json({ ok: false, reason: "no_canvas_connection" });
  }

  if (canvasBaseUrl === "demo") {
    return NextResponse.json({ ok: true, demo: true });
  }

  const creds = await db.query.canvasCredentials.findFirst({
    where: eq(canvasCredentials.userId, session.user.id),
  });

  if (!creds) {
    return NextResponse.json({ ok: false, reason: "no_canvas_connection" });
  }

  try {
    const token = decrypt(creds.accessToken);
    const client = new CanvasClient(canvasBaseUrl, token);
    await client.validateAndGetUser();
    return NextResponse.json({ ok: true, expiresAt: creds.expiresAt ?? null });
  } catch (err) {
    if (err instanceof CanvasError && err.status === 401) {
      return NextResponse.json({ ok: false, reason: "token_expired" });
    }
    return NextResponse.json({ ok: false, reason: "unreachable" });
  }
}
