import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimeTrackerPanel } from "@/components/time/time-tracker-panel";
import type { TimeTrackerSnapshot } from "@/lib/view-models";

/**
 * The time tracker is the most complex component in Rangverse: it renders a
 * live clock, offers only the transitions the database would accept, and must
 * never present task-timer minutes as attendance.
 *
 * Server actions are stubbed — this asserts rendering and affordances, while
 * the real transitions are covered by the RLS and integration suites.
 */
vi.mock("@/lib/actions/time", () => ({
  clockInAction: vi.fn(async () => ({ ok: true, message: "in" })),
  clockOutAction: vi.fn(async () => ({ ok: true, message: "out" })),
  startBreakAction: vi.fn(async () => ({ ok: true, message: "break" })),
  endBreakAction: vi.fn(async () => ({ ok: true, message: "back" })),
  stopTaskTimerAction: vi.fn(async () => ({ ok: true, message: "stopped" })),
  startTaskTimerAction: vi.fn(async () => ({ ok: true, message: "started" })),
}));

const HOUR = 3_600_000;
const MINUTE = 60_000;

// Fixed "now" so every live duration is deterministic.
const NOW = new Date("2026-03-02T10:00:00Z");

function snapshot(overrides: Partial<TimeTrackerSnapshot> = {}): TimeTrackerSnapshot {
  return {
    state: "NOT_CLOCKED_IN",
    openSession: null,
    openBreak: null,
    runningTimer: null,
    today: {
      attendanceMs: 0,
      breakMs: 0,
      netWorkMs: 0,
      inProgress: false,
      sessionCount: 0,
    },
    week: {
      attendanceMs: 0,
      breakMs: 0,
      netWorkMs: 0,
      inProgress: false,
      sessionCount: 0,
    },
    recent: [],
    ...overrides,
  };
}

function openSession(clockInAt: string, breaks: TimeTrackerSnapshot["openSession"] extends null
  ? never
  : NonNullable<TimeTrackerSnapshot["openSession"]>["breaks"] = []) {
  return {
    id: "session-1",
    user_id: "user-1",
    clock_in_at: clockInAt,
    clock_out_at: null,
    needs_review: false,
    review_reason: null,
    closed_by: null,
    created_at: clockInAt,
    updated_at: clockInAt,
    breaks,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TimeTrackerPanel", () => {
  it("offers only Clock in when nobody is clocked in", () => {
    render(<TimeTrackerPanel snapshot={snapshot()} />);

    expect(screen.getByRole("button", { name: /clock in/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clock out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start break/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /end break/i })).not.toBeInTheDocument();
  });

  it("pairs the status colour with a readable label", () => {
    render(<TimeTrackerPanel snapshot={snapshot()} />);
    expect(screen.getByText("Not clocked in")).toBeInTheDocument();
  });

  it("offers break and clock out while working, but not clock in", () => {
    render(
      <TimeTrackerPanel
        snapshot={snapshot({
          state: "WORKING",
          openSession: openSession("2026-03-02T04:00:00Z"),
          today: {
            attendanceMs: 6 * HOUR,
            breakMs: 0,
            netWorkMs: 6 * HOUR,
            inProgress: true,
            sessionCount: 1,
          },
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /start break/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clock out/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clock in/i })).not.toBeInTheDocument();
    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("swaps to End break while on a break, and hides Start break", () => {
    render(
      <TimeTrackerPanel
        snapshot={snapshot({
          state: "ON_BREAK",
          openSession: openSession("2026-03-02T04:00:00Z", [
            {
              id: "b1",
              session_id: "session-1",
              user_id: "user-1",
              started_at: "2026-03-02T09:30:00Z",
              ended_at: null,
              created_at: "2026-03-02T09:30:00Z",
              updated_at: "2026-03-02T09:30:00Z",
            },
          ]),
          openBreak: {
            id: "b1",
            session_id: "session-1",
            user_id: "user-1",
            started_at: "2026-03-02T09:30:00Z",
            ended_at: null,
            created_at: "2026-03-02T09:30:00Z",
            updated_at: "2026-03-02T09:30:00Z",
          },
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /end break/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start break/i })).not.toBeInTheDocument();
    expect(screen.getByText("On break")).toBeInTheDocument();
    expect(screen.getByText(/working time is paused/i)).toBeInTheDocument();
  });

  it("shows the break clock, not the work clock, while on a break", () => {
    render(
      <TimeTrackerPanel
        snapshot={snapshot({
          state: "ON_BREAK",
          openSession: openSession("2026-03-02T04:00:00Z"),
          openBreak: {
            id: "b1",
            session_id: "session-1",
            user_id: "user-1",
            // 30 minutes before the fixed "now".
            started_at: "2026-03-02T09:30:00Z",
            ended_at: null,
            created_at: "2026-03-02T09:30:00Z",
            updated_at: "2026-03-02T09:30:00Z",
          },
        })}
      />,
    );

    const clock = screen.getByText(/^\d{2}:\d{2}:\d{2}$/);
    expect(clock.textContent).toBe("00:30:00");
  });

  it("renders a running task timer with its task title", () => {
    render(
      <TimeTrackerPanel
        snapshot={snapshot({
          state: "WORKING",
          openSession: openSession("2026-03-02T04:00:00Z"),
          runningTimer: {
            id: "t1",
            task_id: "task-1",
            user_id: "user-1",
            session_id: "session-1",
            started_at: "2026-03-02T09:00:00Z",
            ended_at: null,
            created_at: "2026-03-02T09:00:00Z",
            updated_at: "2026-03-02T09:00:00Z",
            task: { id: "task-1", title: "Shortlist campus creators" },
          },
        })}
      />,
    );

    expect(screen.getByText("Shortlist campus creators")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop timer/i })).toBeInTheDocument();
  });

  it("never adds task-timer minutes to the attendance figures", () => {
    const { container } = render(
      <TimeTrackerPanel
        snapshot={snapshot({
          state: "WORKING",
          openSession: openSession("2026-03-02T04:00:00Z"),
          today: {
            attendanceMs: 6 * HOUR,
            breakMs: 30 * MINUTE,
            netWorkMs: 5.5 * HOUR,
            inProgress: true,
            sessionCount: 1,
          },
          // Four hours tracked against a task, inside the same six hours.
          runningTimer: {
            id: "t1",
            task_id: "task-1",
            user_id: "user-1",
            session_id: "session-1",
            started_at: "2026-03-02T06:00:00Z",
            ended_at: null,
            created_at: "2026-03-02T06:00:00Z",
            updated_at: "2026-03-02T06:00:00Z",
            task: { id: "task-1", title: "Deck" },
          },
        })}
      />,
    );

    // The attendance tile must still read 6h — not 10h.
    const attendance = within(container).getByText("Attendance today").parentElement;
    expect(attendance?.textContent).toContain("6h 0m");
  });

  it("flags a session needing review and offers no transitions", () => {
    render(
      <TimeTrackerPanel
        snapshot={snapshot({
          state: "NEEDS_REVIEW",
          openSession: { ...openSession("2026-03-01T04:00:00Z"), needs_review: true },
        })}
      />,
    );

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clock in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clock out/i })).not.toBeInTheDocument();
  });

  it("announces the live clock to assistive technology", () => {
    const { container } = render(<TimeTrackerPanel snapshot={snapshot()} />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
  });

  it("hides the summary tiles in compact mode", () => {
    render(<TimeTrackerPanel snapshot={snapshot()} compact />);
    expect(screen.queryByText("Attendance today")).not.toBeInTheDocument();
  });
});
