import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DailyReportForm } from "@/components/reports/daily-report-form";
import { TaskList, TaskRowItem } from "@/components/tasks/task-list";
import { EmptyState } from "@/components/common/empty-state";
import { StatusPill } from "@/components/common/status-pill";
import { AccessDenied } from "@/components/common/section-card";
import type { ReportWithPeople, TaskWithPeople } from "@/lib/view-models";

vi.mock("@/lib/actions/reports", () => ({
  saveDailyReportAction: vi.fn(async () => ({ ok: true, message: "saved" })),
  reviewReportAction: vi.fn(async () => ({ ok: true, message: "saved" })),
}));

function task(overrides: Partial<TaskWithPeople> = {}): TaskWithPeople {
  return {
    id: "task-1",
    title: "Shortlist campus creators",
    description: null,
    assignee_id: "user-1",
    created_by: "mgr-1",
    team_id: null,
    status: "TO_DO",
    priority: "HIGH",
    due_date: null,
    campaign: null,
    client: null,
    completed_at: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    assignee: { id: "user-1", full_name: "Intern A1", email: "a1@rangverse.test" },
    creator: { id: "mgr-1", full_name: "Manager A", email: "m@rangverse.test" },
    ...overrides,
  };
}

function report(overrides: Partial<ReportWithPeople> = {}): ReportWithPeople {
  return {
    id: "report-1",
    user_id: "user-1",
    report_date: "2026-03-02",
    summary: "Shortlisted 20 creators and drafted outreach copy.",
    progress: "Two variants ready",
    blockers: null,
    next_steps: null,
    evidence_links: [],
    status: "DRAFT",
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    manager_feedback: null,
    created_at: "2026-03-02T00:00:00Z",
    updated_at: "2026-03-02T00:00:00Z",
    author: { id: "user-1", full_name: "Intern A1", email: "a1@rangverse.test" },
    reviewer: null,
    tasks: [],
    ...overrides,
  };
}

describe("DailyReportForm", () => {
  it("is editable while a draft, with both save and submit", () => {
    render(<DailyReportForm dateKey="2026-03-02" report={report()} tasks={[]} />);

    expect(screen.getByLabelText(/what did you work on today/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit report/i })).toBeInTheDocument();
  });

  it("locks a submitted report and explains why", () => {
    render(
      <DailyReportForm
        dateKey="2026-03-02"
        report={report({ status: "SUBMITTED", submitted_at: "2026-03-02T12:00:00Z" })}
        tasks={[]}
      />,
    );

    expect(screen.queryByLabelText(/what did you work on today/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit report/i })).not.toBeInTheDocument();
    expect(screen.getByText(/submitted reports are locked/i)).toBeInTheDocument();
    // The content is still readable, just not editable.
    expect(screen.getByText(/shortlisted 20 creators/i)).toBeInTheDocument();
  });

  it("shows manager feedback on a reviewed report", () => {
    render(
      <DailyReportForm
        dateKey="2026-03-02"
        report={report({
          status: "SUBMITTED",
          submitted_at: "2026-03-02T12:00:00Z",
          manager_feedback: "Clear summary, keep going",
          reviewed_at: "2026-03-02T14:00:00Z",
        })}
        tasks={[]}
      />,
    );

    expect(screen.getByText("Manager feedback")).toBeInTheDocument();
    expect(screen.getByText("Clear summary, keep going")).toBeInTheDocument();
  });

  it("offers the author's own tasks to tick", () => {
    render(
      <DailyReportForm
        dateKey="2026-03-02"
        report={report()}
        tasks={[task(), task({ id: "task-2", title: "Draft outreach copy" })]}
      />,
    );

    expect(screen.getByText("Shortlist campus creators")).toBeInTheDocument();
    expect(screen.getByText("Draft outreach copy")).toBeInTheDocument();
  });

  it("renders evidence links as safe external links when submitted", () => {
    render(
      <DailyReportForm
        dateKey="2026-03-02"
        report={report({
          status: "SUBMITTED",
          submitted_at: "2026-03-02T12:00:00Z",
          evidence_links: ["https://drive.example.com/deck"],
        })}
        tasks={[]}
      />,
    );

    const link = screen.getByRole("link", { name: /drive\.example\.com/i });
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("TaskRowItem", () => {
  it("shows the title, assignee and both status labels", () => {
    render(
      <ul>
        <TaskRowItem task={task()} />
      </ul>,
    );

    expect(screen.getByText("Shortlist campus creators")).toBeInTheDocument();
    expect(screen.getByText("Intern A1")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("To do")).toBeInTheDocument();
  });

  it("marks an overdue task", () => {
    render(
      <ul>
        <TaskRowItem task={task({ due_date: "2020-01-01", status: "IN_PROGRESS" })} />
      </ul>,
    );

    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it("does not call a completed task overdue", () => {
    render(
      <ul>
        <TaskRowItem
          task={task({
            due_date: "2020-01-01",
            status: "DONE",
            completed_at: "2026-03-01T00:00:00Z",
          })}
        />
      </ul>,
    );

    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("links to the task detail page", () => {
    render(
      <ul>
        <TaskRowItem task={task()} />
      </ul>,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/tasks/task-1");
  });
});

describe("TaskList", () => {
  it("renders a designed empty state instead of nothing", () => {
    render(
      <TaskList
        page={{ tasks: [], total: 0, page: 1, pageCount: 1 }}
        buildHref={(n) => `/tasks?page=${n}`}
        emptyTitle="No tasks yet"
        emptyDescription="Work assigned to you will show up here."
      />,
    );

    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.getByText(/work assigned to you/i)).toBeInTheDocument();
  });

  it("hides pagination for a single page", () => {
    render(
      <TaskList
        page={{ tasks: [task()], total: 1, page: 1, pageCount: 1 }}
        buildHref={(n) => `/tasks?page=${n}`}
      />,
    );

    expect(screen.queryByRole("navigation", { name: /task pages/i })).not.toBeInTheDocument();
  });

  it("shows pagination across multiple pages", () => {
    render(
      <TaskList
        page={{ tasks: [task()], total: 40, page: 2, pageCount: 3 }}
        buildHref={(n) => `/tasks?page=${n}`}
      />,
    );

    expect(screen.getByRole("navigation", { name: /task pages/i })).toBeInTheDocument();
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
  });
});

describe("shared presentation components", () => {
  it("StatusPill pairs colour with a text label", () => {
    render(<StatusPill tone="working">Working</StatusPill>);
    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("EmptyState renders a title and description", () => {
    render(<EmptyState title="Nothing here" description="It will fill up." />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("It will fill up.")).toBeInTheDocument();
  });

  it("AccessDenied explains rather than showing a blank area", () => {
    render(<AccessDenied />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});
