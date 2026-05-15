import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canvasCredentials } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { CanvasClient } from "@/lib/canvas/client";
import { CanvasError } from "@/lib/canvas/types";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const sessionUser = session.user as {
    id: string;
    name: string;
    canvasBaseUrl?: string;
  };

  const creds = await db.query.canvasCredentials.findFirst({
    where: eq(canvasCredentials.userId, sessionUser.id),
  });

  if (!creds || !sessionUser.canvasBaseUrl) redirect("/onboard");

  let courses;
  try {
    const token = decrypt(creds.accessToken);
    const client = new CanvasClient(sessionUser.canvasBaseUrl, token);
    courses = await client.listCourses();
  } catch (err) {
    if (err instanceof CanvasError && err.status === 401) {
      redirect("/onboard?reason=token_expired");
    }
    throw err;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hey, {sessionUser.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">Your active courses</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Ask Assignly
          </Link>
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Settings
          </Link>
        </div>
      </div>

      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active courses found in Canvas.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {courses.map((course) => (
            <li
              key={course.id}
              className="rounded-xl border border-border bg-card px-5 py-4"
            >
              <p className="font-medium">{course.name}</p>
              <p className="text-sm text-muted-foreground">{course.course_code}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
