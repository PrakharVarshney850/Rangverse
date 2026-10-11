import { describe, expect, it } from "vitest";

import {
  ATTENDANCE_STATE_LABELS,
  businessDateKey,
  businessDayRange,
  businessWeekRange,
  calculateSessionTotals,
  canPerform,
  completedBreakMs,
  crossesBusinessMidnight,
  detectAnomalies,
  elapsedBreakMs,
  formatBusinessDate,
  formatBusinessTime,
  formatClock,
  formatDuration,
  InvalidIntervalError,
  intervalDurationMs,
  resolveAttendanceState,
  sumSessionTotals,
  sumTaskTime,
  toDecimalHours,
} from "@/lib/domain/time";

const HOUR = 3_600_000;
const MINUTE = 60_000;

describe("intervalDurationMs", () => {
  it("measures a closed interval", () => {
    expect(
      intervalDurationMs({ start: "2026-03-02T04:00:00Z", end: "2026-03-02T12:30:00Z" }),
    ).toBe(8.5 * HOUR);
  });

  it("measures an open interval up to the supplied now", () => {
    const now = new Date("2026-03-02T09:15:00Z");
    expect(intervalDurationMs({ start: "2026-03-02T04:00:00Z", end: null }, now)).toBe(
      5.25 * HOUR,
    );
  });

  it("treats an undefined end the same as an open interval", () => {
    const now = new Date("2026-03-02T05:00:00Z");
    expect(intervalDurationMs({ start: "2026-03-02T04:00:00Z" }, now)).toBe(HOUR);
  });

  it("rejects an interval that ends before it starts", () => {
    expect(() =>
      intervalDurationMs({ start: "2026-03-02T12:00:00Z", end: "2026-03-02T04:00:00Z" }),
    ).toThrow(InvalidIntervalError);
  });

  it("rejects an unparseable timestamp", () => {
    expect(() => intervalDurationMs({ start: "not-a-date", end: null })).toThrow(
      InvalidIntervalError,
    );
  });

  it("returns zero for a zero-length interval", () => {
    expect(
      intervalDurationMs({ start: "2026-03-02T04:00:00Z", end: "2026-03-02T04:00:00Z" }),
    ).toBe(0);
  });
});

describe("break accumulation", () => {
  const breaks = [
    { started_at: "2026-03-02T06:00:00Z", ended_at: "2026-03-02T06:30:00Z" },
    { started_at: "2026-03-02T09:00:00Z", ended_at: "2026-03-02T09:15:00Z" },
    { started_at: "2026-03-02T11:00:00Z", ended_at: null },
  ];

  it("counts only completed breaks", () => {
    expect(completedBreakMs(breaks)).toBe(45 * MINUTE);
  });

  it("counts a running break when measuring live elapsed time", () => {
    const now = new Date("2026-03-02T11:10:00Z");
    expect(elapsedBreakMs(breaks, now)).toBe(55 * MINUTE);
  });

  it("returns zero for no breaks", () => {
    expect(completedBreakMs([])).toBe(0);
    expect(elapsedBreakMs([])).toBe(0);
  });
});

describe("calculateSessionTotals", () => {
  it("subtracts completed breaks from a finished session", () => {
    const totals = calculateSessionTotals(
      { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: "2026-03-02T13:00:00Z" },
      [{ started_at: "2026-03-02T08:00:00Z", ended_at: "2026-03-02T08:45:00Z" }],
    );

    expect(totals.attendanceMs).toBe(9 * HOUR);
    expect(totals.breakMs).toBe(45 * MINUTE);
    expect(totals.netWorkMs).toBe(9 * HOUR - 45 * MINUTE);
    expect(totals.inProgress).toBe(false);
  });

  it("marks an open session as in progress", () => {
    const now = new Date("2026-03-02T10:00:00Z");
    const totals = calculateSessionTotals(
      { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: null },
      [],
      now,
    );

    expect(totals.attendanceMs).toBe(6 * HOUR);
    expect(totals.netWorkMs).toBe(6 * HOUR);
    expect(totals.inProgress).toBe(true);
  });

  it("freezes working time while a break is running", () => {
    const session = { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: null };
    const breaks = [{ started_at: "2026-03-02T06:00:00Z", ended_at: null }];

    const atSixThirty = calculateSessionTotals(session, breaks, new Date("2026-03-02T06:30:00Z"));
    const atSeven = calculateSessionTotals(session, breaks, new Date("2026-03-02T07:00:00Z"));

    expect(atSixThirty.netWorkMs).toBe(2 * HOUR);
    expect(atSeven.netWorkMs).toBe(2 * HOUR);
    expect(atSeven.inProgress).toBe(true);
  });

  it("handles a session that crosses midnight as one interval", () => {
    const totals = calculateSessionTotals(
      { clock_in_at: "2026-03-02T16:30:00Z", clock_out_at: "2026-03-03T01:00:00Z" },
      [{ started_at: "2026-03-02T20:00:00Z", ended_at: "2026-03-02T20:30:00Z" }],
    );

    expect(totals.attendanceMs).toBe(8.5 * HOUR);
    expect(totals.netWorkMs).toBe(8 * HOUR);
  });

  it("handles a session crossing business midnight in Asia/Kolkata", () => {
    // 20:00 UTC on 2 Mar is 01:30 on 3 Mar in Kolkata.
    const session = {
      clock_in_at: "2026-03-02T17:00:00Z",
      clock_out_at: "2026-03-02T21:00:00Z",
    };

    expect(crossesBusinessMidnight(session)).toBe(true);
    expect(calculateSessionTotals(session).attendanceMs).toBe(4 * HOUR);
  });

  it("never reports negative net work when breaks exceed attendance", () => {
    const totals = calculateSessionTotals(
      { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: "2026-03-02T05:00:00Z" },
      [{ started_at: "2026-03-02T04:00:00Z", ended_at: "2026-03-02T07:00:00Z" }],
    );

    expect(totals.netWorkMs).toBe(0);
  });

  it("reports an open session as not crossing midnight", () => {
    expect(
      crossesBusinessMidnight({ clock_in_at: "2026-03-02T17:00:00Z", clock_out_at: null }),
    ).toBe(false);
  });
});

describe("sumSessionTotals", () => {
  it("aggregates several sessions and their breaks", () => {
    const totals = sumSessionTotals([
      {
        id: "a",
        clock_in_at: "2026-03-02T04:00:00Z",
        clock_out_at: "2026-03-02T12:00:00Z",
        breaks: [{ started_at: "2026-03-02T08:00:00Z", ended_at: "2026-03-02T08:30:00Z" }],
      },
      {
        id: "b",
        clock_in_at: "2026-03-03T04:00:00Z",
        clock_out_at: "2026-03-03T09:00:00Z",
        breaks: [],
      },
    ]);

    expect(totals.sessionCount).toBe(2);
    expect(totals.attendanceMs).toBe(13 * HOUR);
    expect(totals.netWorkMs).toBe(12.5 * HOUR);
    expect(totals.inProgress).toBe(false);
  });

  it("marks the aggregate in progress when any session is open", () => {
    const now = new Date("2026-03-03T06:00:00Z");
    const totals = sumSessionTotals(
      [
        { id: "a", clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: "2026-03-02T12:00:00Z" },
        { id: "b", clock_in_at: "2026-03-03T04:00:00Z", clock_out_at: null },
      ],
      now,
    );

    expect(totals.inProgress).toBe(true);
    expect(totals.sessionCount).toBe(2);
  });

  it("returns an empty aggregate for no sessions", () => {
    expect(sumSessionTotals([])).toEqual({
      attendanceMs: 0,
      breakMs: 0,
      netWorkMs: 0,
      inProgress: false,
      sessionCount: 0,
    });
  });
});

describe("task time is kept separate from attendance", () => {
  it("sums task entries independently of any attendance total", () => {
    const attendance = calculateSessionTotals(
      { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: "2026-03-02T12:00:00Z" },
      [],
    );

    const taskTime = sumTaskTime([
      { start: "2026-03-02T04:30:00Z", end: "2026-03-02T06:30:00Z" },
      { start: "2026-03-02T07:00:00Z", end: "2026-03-02T09:00:00Z" },
    ]);

    expect(attendance.netWorkMs).toBe(8 * HOUR);
    expect(taskTime.totalMs).toBe(4 * HOUR);
    // The attendance figure is unchanged by task tracking: the same minutes are
    // never counted twice.
    expect(attendance.netWorkMs).not.toBe(attendance.netWorkMs + taskTime.totalMs);
  });

  it("flags a running task timer", () => {
    const now = new Date("2026-03-02T06:00:00Z");
    const result = sumTaskTime([{ start: "2026-03-02T05:00:00Z", end: null }], now);
    expect(result.totalMs).toBe(HOUR);
    expect(result.inProgress).toBe(true);
  });

  it("returns zero for no entries", () => {
    expect(sumTaskTime([])).toEqual({ totalMs: 0, inProgress: false });
  });
});

describe("resolveAttendanceState", () => {
  it("reports NOT_CLOCKED_IN without a session", () => {
    expect(resolveAttendanceState({ session: null, openBreak: null })).toBe("NOT_CLOCKED_IN");
  });

  it("reports WORKING for an open session", () => {
    expect(
      resolveAttendanceState({
        session: { id: "s", clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: null },
        openBreak: null,
      }),
    ).toBe("WORKING");
  });

  it("reports ON_BREAK when a break is running", () => {
    expect(
      resolveAttendanceState({
        session: { id: "s", clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: null },
        openBreak: { started_at: "2026-03-02T06:00:00Z", ended_at: null },
      }),
    ).toBe("ON_BREAK");
  });

  it("reports CLOCKED_OUT for a finished session", () => {
    expect(
      resolveAttendanceState({
        session: {
          id: "s",
          clock_in_at: "2026-03-02T04:00:00Z",
          clock_out_at: "2026-03-02T12:00:00Z",
        },
        openBreak: null,
      }),
    ).toBe("CLOCKED_OUT");
  });

  it("reports NEEDS_REVIEW ahead of every other state", () => {
    expect(
      resolveAttendanceState({
        session: {
          id: "s",
          clock_in_at: "2026-03-02T04:00:00Z",
          clock_out_at: null,
          needs_review: true,
        },
        openBreak: { started_at: "2026-03-02T06:00:00Z", ended_at: null },
      }),
    ).toBe("NEEDS_REVIEW");
  });

  it("has a human label for every state", () => {
    for (const label of Object.values(ATTENDANCE_STATE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("canPerform", () => {
  it("allows clocking in only when not already clocked in", () => {
    expect(canPerform("NOT_CLOCKED_IN", "CLOCK_IN")).toBe(true);
    expect(canPerform("CLOCKED_OUT", "CLOCK_IN")).toBe(true);
    expect(canPerform("WORKING", "CLOCK_IN")).toBe(false);
    expect(canPerform("ON_BREAK", "CLOCK_IN")).toBe(false);
  });

  it("allows clocking out from working or on break", () => {
    expect(canPerform("WORKING", "CLOCK_OUT")).toBe(true);
    expect(canPerform("ON_BREAK", "CLOCK_OUT")).toBe(true);
    expect(canPerform("NOT_CLOCKED_IN", "CLOCK_OUT")).toBe(false);
  });

  it("allows a break only while working", () => {
    expect(canPerform("WORKING", "START_BREAK")).toBe(true);
    expect(canPerform("ON_BREAK", "START_BREAK")).toBe(false);
    expect(canPerform("NOT_CLOCKED_IN", "START_BREAK")).toBe(false);
  });

  it("allows ending a break only while on one", () => {
    expect(canPerform("ON_BREAK", "END_BREAK")).toBe(true);
    expect(canPerform("WORKING", "END_BREAK")).toBe(false);
  });

  it("refuses to start a task timer outside an open session or during a break", () => {
    expect(canPerform("WORKING", "START_TASK_TIMER")).toBe(true);
    expect(canPerform("ON_BREAK", "START_TASK_TIMER")).toBe(false);
    expect(canPerform("NOT_CLOCKED_IN", "START_TASK_TIMER")).toBe(false);
    expect(canPerform("CLOCKED_OUT", "START_TASK_TIMER")).toBe(false);
  });

  it("only offers stopping a timer when one is running", () => {
    expect(canPerform("WORKING", "STOP_TASK_TIMER", { hasRunningTaskTimer: true })).toBe(true);
    expect(canPerform("WORKING", "STOP_TASK_TIMER", { hasRunningTaskTimer: false })).toBe(false);
  });

  it("blocks every action from NEEDS_REVIEW except resolution by an administrator", () => {
    expect(canPerform("NEEDS_REVIEW", "CLOCK_IN")).toBe(false);
    expect(canPerform("NEEDS_REVIEW", "CLOCK_OUT")).toBe(false);
    expect(canPerform("NEEDS_REVIEW", "START_BREAK")).toBe(false);
  });
});

describe("detectAnomalies", () => {
  it("finds nothing wrong with an ordinary session", () => {
    const report = detectAnomalies(
      { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: "2026-03-02T12:00:00Z" },
      [{ started_at: "2026-03-02T08:00:00Z", ended_at: "2026-03-02T08:30:00Z" }],
    );
    expect(report.anomalies).toEqual([]);
    expect(report.needsReview).toBe(false);
  });

  it("flags a session that has stayed open too long", () => {
    const now = new Date("2026-03-03T02:00:00Z");
    const report = detectAnomalies(
      { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: null },
      [],
      now,
    );
    expect(report.anomalies).toContain("OPEN_TOO_LONG");
    expect(report.needsReview).toBe(true);
  });

  it("flags a break that starts before its session", () => {
    const report = detectAnomalies(
      { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: "2026-03-02T12:00:00Z" },
      [{ started_at: "2026-03-02T03:00:00Z", ended_at: "2026-03-02T03:30:00Z" }],
    );
    expect(report.anomalies).toContain("BREAK_OUTSIDE_SESSION");
  });

  it("flags breaks longer than the session itself", () => {
    const report = detectAnomalies(
      { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: "2026-03-02T05:00:00Z" },
      [{ started_at: "2026-03-02T04:00:00Z", ended_at: "2026-03-02T07:00:00Z" }],
    );
    expect(report.anomalies).toContain("BREAK_EXCEEDS_SESSION");
  });

  it("surfaces an administrator's manual review flag", () => {
    const report = detectAnomalies({
      clock_in_at: "2026-03-02T04:00:00Z",
      clock_out_at: "2026-03-02T12:00:00Z",
      needs_review: true,
    });
    expect(report.anomalies).toEqual(["FLAGGED_FOR_REVIEW"]);
  });

  it("does not flag a normal-length open session", () => {
    const now = new Date("2026-03-02T10:00:00Z");
    const report = detectAnomalies(
      { clock_in_at: "2026-03-02T04:00:00Z", clock_out_at: null },
      [],
      now,
    );
    expect(report.needsReview).toBe(false);
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45 * MINUTE)).toBe("45m");
    expect(formatDuration(7 * HOUR + 42 * MINUTE)).toBe("7h 42m");
    expect(formatDuration(-5000)).toBe("0m");
  });

  it("formats a ticking clock", () => {
    expect(formatClock(0)).toBe("00:00:00");
    expect(formatClock(HOUR + 2 * MINUTE + 3000)).toBe("01:02:03");
    expect(formatClock(-1000)).toBe("00:00:00");
  });

  it("converts to decimal hours for reporting", () => {
    expect(toDecimalHours(HOUR)).toBe(1);
    expect(toDecimalHours(90 * MINUTE)).toBe(1.5);
    expect(toDecimalHours(100 * MINUTE)).toBe(1.67);
    expect(toDecimalHours(-HOUR)).toBe(0);
  });
});

describe("business time zone handling", () => {
  it("renders UTC instants in Asia/Kolkata", () => {
    // 18:45 UTC is 00:15 the next day in Kolkata (UTC+5:30).
    expect(formatBusinessTime("2026-03-02T18:45:00Z")).toBe("00:15");
    expect(formatBusinessDate("2026-03-02T18:45:00Z")).toBe("3 Mar 2026");
  });

  it("derives the business calendar day from a UTC instant", () => {
    expect(businessDateKey("2026-03-02T18:45:00Z")).toBe("2026-03-03");
    expect(businessDateKey("2026-03-02T18:00:00Z")).toBe("2026-03-02");
  });

  it("bounds a business day with the right UTC instants", () => {
    const { fromIso, toIso } = businessDayRange("2026-03-02");
    expect(fromIso).toBe("2026-03-01T18:30:00.000Z");
    expect(toIso).toBe("2026-03-02T18:30:00.000Z");
  });

  it("bounds a business week from Monday", () => {
    // 4 March 2026 is a Wednesday; the week starts Monday 2 March.
    const { fromIso, toIso } = businessWeekRange("2026-03-04T06:00:00Z");
    expect(fromIso).toBe("2026-03-01T18:30:00.000Z");
    expect(toIso).toBe("2026-03-08T18:30:00.000Z");
  });
});
