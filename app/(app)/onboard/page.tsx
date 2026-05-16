import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canvasCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CanvasTokenForm } from "@/components/canvas-token-form";
import { Lock, Eye, RefreshCw } from "lucide-react";

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const { reason } = await searchParams;
  if (reason !== "token_expired") {
    const creds = await db.query.canvasCredentials.findFirst({
      where: eq(canvasCredentials.userId, session.user.id),
    });
    if (creds) redirect("/dashboard");
  }

  const isExpired = reason === "token_expired";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-4 py-16">

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {isExpired ? "Reconnect Canvas" : "Connect your Canvas account"}
        </h1>
        {isExpired ? (
          <p className="text-sm text-destructive">
            Your access token expired. Create a new one in Canvas and paste it below — your conversations are still saved.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Assignly reads your assignments, grades, and calendar directly from
            Canvas. You only need to set this up once.
          </p>
        )}
      </div>

      {/* Step-by-step guide */}
      <section className="rounded-xl border border-border bg-card px-5 py-5">
        <p className="mb-4 font-medium">How to get your Canvas token</p>
        <ol className="flex flex-col gap-5">

          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              1
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Find your Canvas URL</p>
              <p className="text-sm text-muted-foreground">
                This is the address you normally use to log in to Canvas. It
                usually looks like{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  canvas.yourschool.edu
                </code>{" "}
                or{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">
                  yourschool.instructure.com
                </code>
                . Check your university&apos;s website or your welcome email if
                you&apos;re unsure.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              2
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Open your Account Settings</p>
              <p className="text-sm text-muted-foreground">
                In Canvas, click your profile picture or initials in the{" "}
                <strong>top-left corner</strong>, then click{" "}
                <strong>Settings</strong>.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              3
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Create a new access token</p>
              <p className="text-sm text-muted-foreground">
                Scroll down to the{" "}
                <strong>Approved Integrations</strong> section and click{" "}
                <strong>+ New Access Token</strong>. Enter a purpose like{" "}
                <em>Assignly</em> and optionally set an expiry date, then click{" "}
                <strong>Generate Token</strong>.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              4
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Copy the token and paste it below</p>
              <p className="text-sm text-muted-foreground">
                Canvas shows the token <strong>once</strong> — copy it before
                closing the dialog. If you close it without copying, just delete
                that token and generate a new one.
              </p>
            </div>
          </li>

        </ol>
      </section>

      {/* Form */}
      <CanvasTokenForm />

      {/* Trust signals */}
      <ul className="flex flex-col gap-2">
        {[
          { Icon: Lock,        text: "Your token is encrypted before it is stored — we never save it in plain text." },
          { Icon: Eye,         text: "Assignly only reads your Canvas data. It cannot submit assignments or change anything." },
          { Icon: RefreshCw,   text: "You can update or revoke your token any time from Settings." },
        ].map(({ Icon, text }) => (
          <li key={text} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Icon className="mt-0.5 size-3.5 shrink-0" />
            {text}
          </li>
        ))}
      </ul>

    </main>
  );
}
