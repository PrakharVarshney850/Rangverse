import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="bg-card border-border/70 rounded-2xl border p-7 sm:p-9">
      <p className="text-gold mb-3 text-[0.68rem] font-medium tracking-[0.22em] uppercase">
        Account recovery
      </p>
      <h1 className="font-heading text-2xl font-bold">Reset your password</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Enter the email on your Rangverse account and we will send you a secure link to choose a
        new password.
      </p>

      <div className="rv-hairline my-7 h-px" />

      <ForgotPasswordForm />

      <p className="text-muted-foreground mt-7 text-xs">
        Remembered it?{" "}
        <Link href="/login" className="text-gold underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
