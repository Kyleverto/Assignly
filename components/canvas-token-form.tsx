"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  /** Where to navigate on success */
  redirectTo?: string;
  /** Text for the submit button */
  submitLabel?: string;
  /** Called after a successful save (for use inside settings, not a full redirect) */
  onSuccess?: () => void;
}

export function CanvasTokenForm({
  redirectTo = "/dashboard",
  submitLabel = "Connect Canvas",
  onSuccess,
}: Props) {
  const router = useRouter();
  const [canvasBaseUrl, setCanvasBaseUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/canvas/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasBaseUrl, accessToken }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(redirectTo);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 w-full max-w-md"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="canvasBaseUrl" className="text-sm font-medium">
          Canvas URL
        </label>
        <input
          id="canvasBaseUrl"
          type="url"
          placeholder="https://canvas.yourschool.edu"
          value={canvasBaseUrl}
          onChange={(e) => setCanvasBaseUrl(e.target.value)}
          required
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">
          The address you use to log in to Canvas — include the full URL with https://
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="accessToken" className="text-sm font-medium">
          Personal Access Token
        </label>
        <input
          id="accessToken"
          type="password"
          placeholder="Paste your token here"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          required
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">
          Generated in Canvas under Account → Settings → Approved Integrations
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "Verifying…" : submitLabel}
      </Button>
    </form>
  );
}
