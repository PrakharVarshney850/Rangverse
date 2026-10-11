import { describe, expect, it } from "vitest";

import { sanitizeMetadata } from "@/lib/redact";
import { isActivePath, PRIMARY_NAV, visibleNav } from "@/lib/navigation";
import type { Actor } from "@/lib/auth/permissions";
import type { DataSheetColumnRow } from "@/lib/db/database.types";
import { signInSchema, passwordSchema } from "@/lib/validation/auth";
import { inviteUserSchema, slugify } from "@/lib/validation/profile";
import { submittableDailyReportSchema } from "@/lib/validation/report";
import { buildRowSchema, compactRowData } from "@/lib/validation/sheet";
import { createTaskSchema } from "@/lib/validation/task";

function column(overrides: Partial<DataSheetColumnRow>): DataSheetColumnRow {
  return {
    id: overrides.column_key ?? "col",
    sheet_id: "sheet",
    column_key: "handle",
    label: "Handle",
    data_type: "TEXT",
    is_required: false,
    display_order: 0,
    options: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("password policy", () => {
  it("rejects short passwords", () => {
    expect(passwordSchema.safeParse("Short1aa").success).toBe(false);
  });

  it("requires mixed case and a digit", () => {
    expect(passwordSchema.safeParse("alllowercase123").success).toBe(false);
    expect(passwordSchema.safeParse("ALLUPPERCASE123").success).toBe(false);
    expect(passwordSchema.safeParse("NoDigitsInHere").success).toBe(false);
  });

  it("accepts a compliant password", () => {
    expect(passwordSchema.safeParse("StageLights2026").success).toBe(true);
  });
});

describe("signInSchema", () => {
  it("rejects a malformed email", () => {
    expect(signInSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("does not apply the password policy at sign-in", () => {
    // An existing account may predate a policy change; sign-in must not lock
    // them out for it.
    expect(signInSchema.safeParse({ email: "a@b.co", password: "old" }).success).toBe(true);
  });
});

describe("inviteUserSchema", () => {
  const base = {
    email: "intern@rangmanch.in",
    fullName: "New Intern",
    role: "INTERN" as const,
    managerId: "00000000-0000-4000-8000-000000000002",
  };

  it("requires a manager for an intern", () => {
    const result = inviteUserSchema.safeParse({ ...base, managerId: "" });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.path).toEqual(["managerId"]);
  });

  it("does not require a manager for an administrator", () => {
    expect(inviteUserSchema.safeParse({ ...base, role: "ADMIN", managerId: "" }).success).toBe(
      true,
    );
  });

  it("rejects an end date before the joining date", () => {
    const result = inviteUserSchema.safeParse({
      ...base,
      joiningDate: "2026-03-01",
      internshipEndDate: "2026-02-01",
    });
    expect(result.success).toBe(false);
  });

  it("normalises blank optional fields to null", () => {
    const result = inviteUserSchema.parse({ ...base, college: "", phone: "" });
    expect(result.college).toBeNull();
    expect(result.phone).toBeNull();
  });

  it("rejects a malformed phone number", () => {
    expect(inviteUserSchema.safeParse({ ...base, phone: "call me" }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("produces a database-safe slug", () => {
    expect(slugify("Influencer Directory")).toBe("influencer-directory");
    expect(slugify("  Brand   Leads!! ")).toBe("brand-leads");
    expect(slugify("Campaign/Tracker 2026")).toBe("campaign-tracker-2026");
  });

  it("returns an empty string when there is nothing usable", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("createTaskSchema", () => {
  it("requires a meaningful title and an assignee", () => {
    const result = createTaskSchema.safeParse({ title: "Hi", assigneeId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid task and defaults the priority", () => {
    const result = createTaskSchema.parse({
      title: "Shortlist campus creators",
      assigneeId: "00000000-0000-4000-8000-000000000004",
    });
    expect(result.priority).toBe("MEDIUM");
    expect(result.dueDate).toBeNull();
  });

  it("rejects a free-text due date", () => {
    expect(
      createTaskSchema.safeParse({
        title: "Valid title",
        assigneeId: "00000000-0000-4000-8000-000000000004",
        dueDate: "next friday",
      }).success,
    ).toBe(false);
  });
});

describe("daily report submission rules", () => {
  const base = { reportDate: "2026-03-02", evidenceLinks: [], taskIds: [] };

  it("allows an empty draft", () => {
    expect(
      submittableDailyReportSchema.safeParse({ ...base, intent: "SAVE_DRAFT", summary: "" })
        .success,
    ).toBe(true);
  });

  it("requires a summary to submit", () => {
    const result = submittableDailyReportSchema.safeParse({
      ...base,
      intent: "SUBMIT",
      summary: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-http evidence link", () => {
    const result = submittableDailyReportSchema.safeParse({
      ...base,
      intent: "SUBMIT",
      summary: "Did the thing",
      evidenceLinks: ["javascript:alert(1)"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts https evidence links", () => {
    expect(
      submittableDailyReportSchema.safeParse({
        ...base,
        intent: "SUBMIT",
        summary: "Did the thing",
        evidenceLinks: ["https://drive.example.com/file"],
      }).success,
    ).toBe(true);
  });

  it("caps the number of evidence links", () => {
    const links = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`);
    expect(
      submittableDailyReportSchema.safeParse({
        ...base,
        intent: "SUBMIT",
        summary: "Lots of links",
        evidenceLinks: links,
      }).success,
    ).toBe(false);
  });
});

describe("sheet row schema", () => {
  const columns = [
    column({ column_key: "handle", label: "Handle", is_required: true }),
    column({ column_key: "followers", label: "Followers", data_type: "NUMBER" }),
    column({ column_key: "contact_email", label: "Contact email", data_type: "EMAIL" }),
    column({ column_key: "profile_url", label: "Profile link", data_type: "URL" }),
    column({ column_key: "joined_on", label: "Joined", data_type: "DATE" }),
    column({
      column_key: "stage",
      label: "Stage",
      data_type: "SELECT",
      options: ["New", "Contacted"],
    }),
  ];

  const schema = buildRowSchema(columns);

  it("accepts a valid record", () => {
    expect(
      schema.safeParse({
        handle: "@creator.one",
        followers: "12000",
        contact_email: "hi@example.com",
        profile_url: "https://instagram.com/creator.one",
        joined_on: "2026-02-01",
        stage: "New",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown column", () => {
    const result = schema.safeParse({ handle: "@x", secret_salary: "1000" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing required column", () => {
    expect(schema.safeParse({ followers: "10" }).success).toBe(false);
  });

  it("rejects a value of the wrong type", () => {
    expect(schema.safeParse({ handle: "@x", followers: "many" }).success).toBe(false);
    expect(schema.safeParse({ handle: "@x", contact_email: "nope" }).success).toBe(false);
    expect(schema.safeParse({ handle: "@x", profile_url: "ftp://x" }).success).toBe(false);
    expect(schema.safeParse({ handle: "@x", joined_on: "1st Feb" }).success).toBe(false);
  });

  it("rejects an option outside the configured choices", () => {
    expect(schema.safeParse({ handle: "@x", stage: "Invented" }).success).toBe(false);
  });

  it("treats a blank optional value as absent", () => {
    const result = schema.parse({ handle: "@x", followers: "" });
    expect(result.followers).toBeUndefined();
  });
});

describe("compactRowData", () => {
  it("drops empty and nullish values and trims the rest", () => {
    expect(
      compactRowData({ a: "  kept  ", b: "", c: null, d: undefined, e: 42, f: "   " }),
    ).toEqual({ a: "kept", e: "42" });
  });
});

describe("sanitizeMetadata", () => {
  it("removes anything that looks like a credential", () => {
    const result = sanitizeMetadata({
      taskId: "abc",
      password: "hunter2",
      access_token: "eyJ...",
      API_KEY: "sk_live_x",
      Authorization: "Bearer x",
      sessionId: "s1",
    });

    expect(result).toEqual({ taskId: "abc" });
  });

  it("truncates long strings", () => {
    const result = sanitizeMetadata({ note: "x".repeat(500) });
    expect(String(result.note)).toHaveLength(198);
  });

  it("keeps primitives and caps arrays", () => {
    const result = sanitizeMetadata({
      count: 3,
      flag: true,
      items: Array.from({ length: 30 }, (_, i) => i),
    });
    expect(result.count).toBe(3);
    expect(result.flag).toBe(true);
    expect((result.items as string[]).length).toBe(20);
  });

  it("drops nested objects rather than serialising unknown payloads", () => {
    const result = sanitizeMetadata({ nested: { a: 1 } });
    expect(result.nested).toBeUndefined();
  });
});

describe("navigation", () => {
  const intern: Actor = { id: "i", role: "INTERN", onboardingStatus: "ACTIVE" };
  const manager: Actor = { id: "m", role: "MANAGER", onboardingStatus: "ACTIVE" };

  it("hides team and reports from an intern", () => {
    const labels = visibleNav(PRIMARY_NAV, intern).map((item) => item.label);
    expect(labels).not.toContain("Team");
    expect(labels).not.toContain("Reports");
    expect(labels).toContain("My tasks");
    expect(labels).toContain("Time tracker");
  });

  it("shows team and reports to a manager", () => {
    const labels = visibleNav(PRIMARY_NAV, manager).map((item) => item.label);
    expect(labels).toContain("Team");
    expect(labels).toContain("Reports");
  });

  it("keeps planned v2 items in the list but marked", () => {
    const resources = PRIMARY_NAV.find((item) => item.label === "Resources");
    expect(resources?.comingIn).toBe("v2");
  });

  it("resolves the active route", () => {
    expect(isActivePath("/overview", "/overview")).toBe(true);
    expect(isActivePath("/", "/overview")).toBe(true);
    expect(isActivePath("/tasks/abc", "/tasks")).toBe(true);
    expect(isActivePath("/tasks", "/time")).toBe(false);
    expect(isActivePath("/daily-reports", "/reports")).toBe(false);
  });
});
