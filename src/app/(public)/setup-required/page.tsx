import type { Metadata } from "next";

import { RangverseLogo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Setup required",
};

/**
 * Shown when Supabase credentials are missing. A missing `.env.local` should
 * produce a clear instruction, never an unexplained blank page.
 */
export default function SetupRequiredPage() {
  return (
    <div className="rv-stage-glow flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="bg-card border-border/70 w-full max-w-xl rounded-2xl border p-8 sm:p-10">
        <RangverseLogo />

        <div className="rv-hairline my-7 h-px" />

        <p className="text-gold mb-3 text-[0.68rem] font-medium tracking-[0.22em] uppercase">
          Configuration
        </p>
        <h1 className="font-heading text-2xl font-bold">Rangverse is not connected yet</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          The application is running, but it has no Supabase project to talk to. Add the
          credentials below and restart the dev server.
        </p>

        <ol className="text-muted-foreground mt-6 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="text-gold font-mono text-xs">01</span>
            <span>
              Copy <code className="text-foreground">.env.example</code> to{" "}
              <code className="text-foreground">.env.local</code>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-gold font-mono text-xs">02</span>
            <span>
              Fill in <code className="text-foreground">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
              <code className="text-foreground">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> and{" "}
              <code className="text-foreground">SUPABASE_SERVICE_ROLE_KEY</code> from your Supabase
              project, or from <code className="text-foreground">supabase status</code> when running
              the local stack.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-gold font-mono text-xs">03</span>
            <span>
              Apply the migrations in <code className="text-foreground">supabase/migrations</code>,
              then create the first administrator with{" "}
              <code className="text-foreground">npm run db:bootstrap-admin</code>.
            </span>
          </li>
        </ol>

        <p className="text-muted-foreground mt-7 text-xs leading-relaxed">
          The full walkthrough lives in <code className="text-foreground">docs/deployment.md</code>.
        </p>
      </div>
    </div>
  );
}
