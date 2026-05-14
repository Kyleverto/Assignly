import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-5xl font-bold tracking-tight">Assignly</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Your AI-powered Canvas assistant. Ask about assignments, grades, and
          deadlines — in plain English.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link href="/onboard" className={cn(buttonVariants({ size: "lg" }))}>
          Connect Canvas
        </Link>
        <Link
          href="/onboard?demo=true"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Try Demo
        </Link>
      </div>

      <p className="max-w-sm text-sm text-muted-foreground">
        Reads your courses, assignments, and calendar. Never writes to Canvas.
        Your token is encrypted and never shared.
      </p>
    </main>
  );
}
