import { describe, expect, it } from "vitest";

import {
  can,
  canAny,
  canAssignTaskTo,
  canViewUser,
  isAccountActive,
  isAdmin,
  isIntern,
  isManager,
  PERMISSIONS,
  type Actor,
} from "@/lib/auth/permissions";

const admin: Actor = { id: "admin", role: "ADMIN", onboardingStatus: "ACTIVE" };
const managerA: Actor = { id: "mgr-a", role: "MANAGER", onboardingStatus: "ACTIVE" };
const managerB: Actor = { id: "mgr-b", role: "MANAGER", onboardingStatus: "ACTIVE" };
const internA1: Actor = { id: "int-a1", role: "INTERN", onboardingStatus: "ACTIVE" };
const pausedAdmin: Actor = { id: "admin", role: "ADMIN", onboardingStatus: "PAUSED" };
const offboarded: Actor = { id: "gone", role: "MANAGER", onboardingStatus: "OFFBOARDED" };

describe("isAccountActive", () => {
  it("treats invited and incomplete accounts as usable", () => {
    expect(isAccountActive({ onboardingStatus: "INVITED" })).toBe(true);
    expect(isAccountActive({ onboardingStatus: "PROFILE_INCOMPLETE" })).toBe(true);
    expect(isAccountActive({ onboardingStatus: "ACTIVE" })).toBe(true);
    expect(isAccountActive({ onboardingStatus: "COMPLETED" })).toBe(true);
  });

  it("treats paused and offboarded accounts as unusable", () => {
    expect(isAccountActive({ onboardingStatus: "PAUSED" })).toBe(false);
    expect(isAccountActive({ onboardingStatus: "OFFBOARDED" })).toBe(false);
  });
});

describe("can", () => {
  it("grants an administrator every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(can(admin, permission), permission).toBe(true);
    }
  });

  it("gives a manager team-scoped permissions only", () => {
    expect(can(managerA, "tasks.createForTeam")).toBe(true);
    expect(can(managerA, "attendance.viewTeam")).toBe(true);
    expect(can(managerA, "reports.reviewTeam")).toBe(true);

    expect(can(managerA, "users.invite")).toBe(false);
    expect(can(managerA, "users.manage")).toBe(false);
    expect(can(managerA, "sheets.manage")).toBe(false);
    expect(can(managerA, "attendance.viewAll")).toBe(false);
    expect(can(managerA, "activity.viewAll")).toBe(false);
    expect(can(managerA, "settings.manage")).toBe(false);
  });

  it("gives an intern no elevated permission at all", () => {
    for (const permission of PERMISSIONS) {
      expect(can(internA1, permission), permission).toBe(false);
    }
  });

  it("revokes every permission from a paused account, whatever its role", () => {
    for (const permission of PERMISSIONS) {
      expect(can(pausedAdmin, permission), permission).toBe(false);
    }
    expect(can(offboarded, "tasks.createForTeam")).toBe(false);
  });

  it("denies permission for a missing actor", () => {
    expect(can(null, "users.invite")).toBe(false);
    expect(can(undefined, "users.invite")).toBe(false);
  });
});

describe("canAny", () => {
  it("is true when at least one permission is held", () => {
    expect(canAny(managerA, ["users.invite", "tasks.createForTeam"])).toBe(true);
  });

  it("is false when none are held", () => {
    expect(canAny(internA1, ["users.invite", "tasks.createForTeam"])).toBe(false);
  });

  it("is false for an empty list", () => {
    expect(canAny(admin, [])).toBe(false);
  });
});

describe("role predicates", () => {
  it("identifies roles for active accounts", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isManager(managerA)).toBe(true);
    expect(isIntern(internA1)).toBe(true);
  });

  it("refuses to identify a role for a suspended account", () => {
    expect(isAdmin(pausedAdmin)).toBe(false);
    expect(isManager(offboarded)).toBe(false);
  });
});

describe("canViewUser", () => {
  it("always allows viewing yourself", () => {
    expect(canViewUser(internA1, internA1.id, "mgr-a")).toBe(true);
  });

  it("allows an administrator to view anyone", () => {
    expect(canViewUser(admin, "int-b1", "mgr-b")).toBe(true);
  });

  it("allows a manager to view their own report", () => {
    expect(canViewUser(managerA, "int-a1", "mgr-a")).toBe(true);
  });

  it("stops a manager viewing another manager's report", () => {
    expect(canViewUser(managerA, "int-b1", "mgr-b")).toBe(false);
    expect(canViewUser(managerB, "int-a1", "mgr-a")).toBe(false);
  });

  it("stops an intern viewing another intern", () => {
    expect(canViewUser(internA1, "int-a2", "mgr-a")).toBe(false);
  });

  it("stops a suspended manager viewing their former team", () => {
    expect(canViewUser(offboarded, "int-a1", "gone")).toBe(false);
  });
});

describe("canAssignTaskTo", () => {
  it("lets an administrator assign to anyone", () => {
    expect(canAssignTaskTo(admin, "int-b1", "mgr-b")).toBe(true);
  });

  it("lets a manager assign inside their team", () => {
    expect(canAssignTaskTo(managerA, "int-a1", "mgr-a")).toBe(true);
  });

  it("lets a manager assign to themselves", () => {
    expect(canAssignTaskTo(managerA, "mgr-a", null)).toBe(true);
  });

  it("stops a manager assigning outside their team", () => {
    expect(canAssignTaskTo(managerA, "int-b1", "mgr-b")).toBe(false);
  });

  it("stops an intern assigning anything", () => {
    expect(canAssignTaskTo(internA1, "int-a1", "mgr-a")).toBe(false);
    expect(canAssignTaskTo(internA1, internA1.id, "mgr-a")).toBe(false);
  });

  it("stops a suspended account assigning anything", () => {
    expect(canAssignTaskTo(pausedAdmin, "int-a1", "mgr-a")).toBe(false);
  });
});
