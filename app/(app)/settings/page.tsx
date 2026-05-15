"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CanvasTokenForm } from "@/components/canvas-token-form";
import { signOut } from "@/lib/auth/client";
import { ArrowLeft } from "lucide-react";

interface HealthResponse {
  ok: boolean;
  reason?: string;
  expiresAt?: string | null;
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  useEffect(() => {
    fetch("/api/canvas/health")
      .then((r) => r.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setHealth({ ok: false, reason: "unreachable" }));
  }, []);

  function handleTokenUpdated() {
    setShowUpdateForm(false);
    setHealth(null);
    // Re-check health after update
    fetch("/api/canvas/health")
      .then((r) => r.json())
      .then((data: HealthResponse) => setHealth(data));
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Canvas connection */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Canvas Connection</p>
            {health === null && (
              <p className="text-sm text-muted-foreground">Checking…</p>
            )}
            {health?.ok && (
              <p className="text-sm text-green-600 dark:text-green-400">Connected</p>
            )}
            {health && !health.ok && (
              <p className="text-sm text-destructive">
                {health.reason === "token_expired"
                  ? "Token expired — update it below"
                  : health.reason === "no_canvas_connection"
                    ? "Not connected"
                    : "Could not reach Canvas"}
              </p>
            )}
          </div>
          {!showUpdateForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUpdateForm(true)}
            >
              Update Token
            </Button>
          )}
        </div>

        {showUpdateForm && (
          <div className="border-t border-border pt-4">
            <CanvasTokenForm
              submitLabel="Save New Token"
              onSuccess={handleTokenUpdated}
            />
            <button
              onClick={() => setShowUpdateForm(false)}
              className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Account */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-5">
        <p className="font-medium">Account</p>
        <Button
          variant="outline"
          onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
        >
          Sign out
        </Button>
      </section>
    </main>
  );
}
