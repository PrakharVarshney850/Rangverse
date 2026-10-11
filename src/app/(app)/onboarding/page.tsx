import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { ProfileForm } from "@/components/people/profile-form";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Welcome to Rangverse" };

export default async function OnboardingPage() {
  const session = await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Welcome"
        title="Let's finish setting you up"
        description="Rangverse already knows your role, team and manager — an administrator set those when they invited you. Just confirm how we reach you."
      />

      <SectionCard title="Your details">
        <ProfileForm profile={session.profile} submitLabel="Finish setup" />
      </SectionCard>

      <SectionCard title="What happens next">
        <ol className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <li className="flex gap-3">
            <span className="text-gold font-mono text-xs">01</span>
            <span>
              Clock in from <span className="text-foreground">Time tracker</span> when you start
              work. Your hours are recorded by the server, not by your browser.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-gold font-mono text-xs">02</span>
            <span>
              Work through <span className="text-foreground">My tasks</span> and start a task timer
              so your effort is attributed correctly.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-gold font-mono text-xs">03</span>
            <span>
              Write a short <span className="text-foreground">daily report</span> before you clock
              out. Drafts stay private until you submit.
            </span>
          </li>
        </ol>
      </SectionCard>
    </div>
  );
}
