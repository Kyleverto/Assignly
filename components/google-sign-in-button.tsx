"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    await signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
    // Better Auth handles the redirect — no need to setLoading(false)
  }

  return (
    <Button size="lg" onClick={handleSignIn} disabled={loading}>
      {loading ? "Redirecting…" : "Sign in with Google"}
    </Button>
  );
}
