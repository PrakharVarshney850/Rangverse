import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusPill, type StatusTone } from "@/components/common/status-pill";
import { InviteUserDialog } from "@/components/people/invite-user-dialog";
import { UserStatusControl } from "@/components/people/user-status-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import {
  displayName,
  getPeopleCounts,
  listManagers,
  listTeams,
  listVisiblePeople,
  ONBOARDING_STATUS_LABELS,
  ROLE_LABELS,
} from "@/lib/data/people";
import type { OnboardingStatus } from "@/lib/db/database.types";
import { formatBusinessDate } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People" };

const STATUS_TONE: Record<OnboardingStatus, StatusTone> = {
  INVITED: "info",
  PROFILE_INCOMPLETE: "break",
  ACTIVE: "working",
  PAUSED: "danger",
  COMPLETED: "gold",
  OFFBOARDED: "idle",
};

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  const supabase = await createClient();

  const [people, teams, managers, counts] = await Promise.all([
    listVisiblePeople(supabase),
    listTeams(supabase),
    listManagers(supabase),
    getPeopleCounts(supabase),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="People"
        description="Invite interns and managers, assign reporting lines, and pause access. Roles are enforced by the database, so nothing here can be bypassed from a browser."
        actions={<InviteUserDialog teams={teams} managers={managers} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active interns" value={counts.activeInterns} hint="Status is ACTIVE" />
        <MetricCard label="Managers" value={counts.managers} hint="Can assign work to their team" />
        <MetricCard
          label="Awaiting onboarding"
          value={counts.awaitingOnboarding}
          hint="Invited or profile incomplete"
        />
        <MetricCard label="Paused" value={counts.paused} hint="No access until reactivated" />
      </div>

      <SectionCard title="Everyone" bodyClassName="p-0">
        {people.length === 0 ? (
          <EmptyState
            title="No one here yet"
            description="Invite the first person to get Rangverse moving."
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <p className="font-medium">{displayName(person)}</p>
                      <p className="text-muted-foreground text-xs">{person.email}</p>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={person.role === "ADMIN" ? "gold" : "idle"}>
                        {ROLE_LABELS[person.role]}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {person.manager ? displayName(person.manager) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {person.team?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {person.joining_date
                        ? formatBusinessDate(`${person.joining_date}T00:00:00Z`)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={STATUS_TONE[person.onboarding_status]}>
                        {ONBOARDING_STATUS_LABELS[person.onboarding_status]}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-right">
                      <UserStatusControl
                        userId={person.id}
                        name={displayName(person)}
                        status={person.onboarding_status}
                        isSelf={person.id === session.id}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Teams"
        description="Teams group people for display. Manager authority flows through the assigned manager, not the team."
      >
        {teams.length === 0 ? (
          <EmptyState
            title="No teams yet"
            description="Teams are optional — you can assign a manager without one."
            className="border-0"
          />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <li
                key={team.id}
                className="border-border/60 rounded-lg border px-3.5 py-2 text-sm"
              >
                {team.name}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
