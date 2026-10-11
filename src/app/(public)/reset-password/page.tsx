import type { Metadata } from "next";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export default function ResetPasswordPage() {
  return (
    <div className="bg-card border-border/70 rounded-2xl border p-7 sm:p-9">
      <p className="text-gold mb-3 text-[0.68rem] font-medium tracking-[0.22em] uppercase">
        Account recovery
      </p>
      <h1 className="font-heading text-2xl font-bold">Choose a new password</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Pick something you have not used elsewhere. You will stay signed in on this device once it
        is saved.
      </p>

      <div className="rv-hairline my-7 h-px" />

      <ResetPasswordForm />
    </div>
  );
}
