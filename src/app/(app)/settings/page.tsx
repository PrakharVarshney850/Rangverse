import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusPill } from "@/components/common/status-pill";
import { ProfileForm } from "@/components/people/profile-form";
import { requireUser } from "@/lib/auth/guards";
import { displayName, ONBOARDING_STATUS_LABELS, ROLE_LABELS } from "@/lib/data/people";
import { formatBusinessDate } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireUser();
  const supabase = await createClient();

  const { data: manager } = session.profile.manager_id
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", session.profile.manager_id)
        .maybeSingle()
    : { data: null };

  const { data: team } = session.profile.team_id
    ? await supabase.from("teams").select("name").eq("id", session.profile.team_id).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Your profile"
        description="Keep your contact details current. Your role, manager, team and employment dates are set by an administrator."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Your details">
          <ProfileForm profile={session.profile} />
        </SectionCard>

        <SectionCard
          title="Employment record"
          description="Administrator-controlled. These fields cannot be changed from here — the database rejects the attempt."
        >
          <dl className="space-y-4 text-sm">
            <Field label="Email">{session.email}</Field>
            <Field label="Role">
              <StatusPill tone="gold">{ROLE_LABELS[session.profile.role]}</StatusPill>
            </Field>
            <Field label="Status">
              <StatusPill
                tone={session.profile.onboarding_status === "ACTIVE" ? "working" : "idle"}
              >
                {ONBOARDING_STATUS_LABELS[session.profile.onboarding_status]}
              </StatusPill>
            </Field>
            {session.profile.designation && (
              <Field label="Designation">{session.profile.designation}</Field>
            )}
            <Field label="Team">{team?.name ?? "Not assigned"}</Field>
            <Field label="Manager">{manager ? displayName(manager) : "Not assigned"}</Field>
            <Field label="Joined">
              {session.profile.joining_date
                ? formatBusinessDate(`${session.profile.joining_date}T00:00:00Z`)
                : "Not recorded"}
            </Field>
            {session.profile.internship_end_date && (
              <Field label="Internship ends">
                {formatBusinessDate(`${session.profile.internship_end_date}T00:00:00Z`)}
              </Field>
            )}
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        title="Security"
        description="Rangverse uses Supabase Auth for sessions and passwords. Nothing about your password is stored by this application."
      >
        <p className="text-muted-foreground text-sm leading-relaxed">
          To change your password, sign out and use{" "}
          <span className="text-foreground">Forgot password?</span> on the sign-in screen. A reset
          link will be sent to <span className="text-foreground">{session.email}</span>.
        </p>
      </SectionCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[0.68rem] font-medium tracking-[0.12em] uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 break-words">{children}</dd>
    </div>
  );
}
