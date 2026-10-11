import type { Metadata } from "next";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="bg-card border-border/70 rounded-2xl border p-7 sm:p-9">
      <p className="text-gold mb-3 text-[0.68rem] font-medium tracking-[0.22em] uppercase">
        Rangverse
      </p>
      <h1 className="font-heading text-2xl font-bold sm:text-3xl">Welcome back</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Sign in to track your day, manage your work and reach the company data you have been
        granted.
      </p>

      <div className="rv-hairline my-7 h-px" />

      <SignInForm next={next} />

      <p className="text-muted-foreground mt-7 text-xs leading-relaxed">
        Rangverse accounts are created by invitation only. If you do not have one yet, ask a
        Rangmanch administrator to invite you.
      </p>
    </div>
  );
}
