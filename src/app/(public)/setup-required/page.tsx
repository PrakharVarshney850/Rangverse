import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup required",
};

/**
 * Shown when Supabase credentials are missing. A missing `.env.local` should
 * produce a clear instruction, never an unexplained blank page.
 *
 * The brand lockup is not repeated here — the public layout already renders it
 * above this card.
 */
export default function SetupRequiredPage() {
  return (
    <div className="bg-card border-border/70 rounded-2xl border p-7 sm:p-9">
      <p className="text-gold mb-3 text-[0.68rem] font-medium tracking-[0.22em] uppercase">
        Configuration
      </p>
      <h1 className="font-heading text-2xl font-bold">Rangverse is not connected yet</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        The application is running, but it has no Supabase project to talk to. Add the credentials
        below and restart the dev server.
      </p>

      <div className="rv-hairline my-7 h-px" />

      <ol className="text-muted-foreground space-y-4 text-sm">
        <li className="flex gap-3">
          <span className="text-gold shrink-0 font-mono text-xs">01</span>
          <span className="min-w-0">
            Copy <Code>.env.example</Code> to <Code>.env.local</Code>.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0 font-mono text-xs">02</span>
          <span className="min-w-0">
            Fill in <Code>NEXT_PUBLIC_SUPABASE_URL</Code>,{" "}
            <Code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</Code>, <Code>NEXT_PUBLIC_SITE_URL</Code> and{" "}
            <Code>SUPABASE_SERVICE_ROLE_KEY</Code> from your Supabase project (Project Settings →
            API).
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-gold shrink-0 font-mono text-xs">03</span>
          <span className="min-w-0">
            Apply the migrations in <Code>supabase/migrations</Code>, then create the first
            administrator with <Code>npm run db:bootstrap-admin</Code>.
          </span>
        </li>
      </ol>

      <p className="text-muted-foreground mt-7 text-xs leading-relaxed">
        Step-by-step walkthrough: <Code>docs/SETUP-GUIDE-HINDI.md</Code>
      </p>
    </div>
  );
}

/** Inline code that wraps rather than overflowing its card on a narrow screen. */
function Code({ children }: { children: string }) {
  return (
    <code className="text-foreground bg-muted rounded px-1 py-0.5 text-[0.8em] break-all">
      {children}
    </code>
  );
}
