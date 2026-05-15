import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canvasCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CanvasTokenForm } from "@/components/canvas-token-form";

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  // Skip onboarding if already connected (unless token expired)
  const { reason } = await searchParams;
  if (reason !== "token_expired") {
    const creds = await db.query.canvasCredentials.findFirst({
      where: eq(canvasCredentials.userId, session.user.id),
    });
    if (creds) redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Connect Canvas</h1>
        {reason === "token_expired" ? (
          <p className="max-w-sm text-sm text-destructive">
            Your Canvas access token expired. Create a new one and paste it below.
          </p>
        ) : (
          <p className="max-w-sm text-sm text-muted-foreground">
            Enter your school&apos;s Canvas URL and a Personal Access Token.
            You only need to do this once.
          </p>
        )}
      </div>

      <CanvasTokenForm />

      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Your token is encrypted before storage. Assignly only reads your
        Canvas data — it never writes to Canvas.
      </p>
    </main>
  );
}
