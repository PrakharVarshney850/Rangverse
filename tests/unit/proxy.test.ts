import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isSupabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";
import { proxy } from "@/proxy";

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: vi.fn() }));
vi.mock("@/lib/supabase/middleware", () => ({ updateSession: vi.fn() }));

const signedInUser = { id: "user-1" } as NonNullable<
  Awaited<ReturnType<typeof updateSession>>["user"]
>;

describe("proxy auth redirects", () => {
  beforeEach(() => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(updateSession).mockResolvedValue({
      response: NextResponse.next(),
      user: signedInUser,
    });
  });

  it("keeps password reset available to a signed-in recovery session", async () => {
    const response = await proxy(new NextRequest("http://localhost/reset-password"));

    expect(response.headers.get("location")).toBeNull();
    expect(updateSession).toHaveBeenCalledOnce();
  });

  it("continues redirecting signed-in users away from guest-only pages", async () => {
    const response = await proxy(new NextRequest("http://localhost/login"));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/overview");
  });

  it("continues redirecting anonymous users away from protected pages", async () => {
    vi.mocked(updateSession).mockResolvedValue({ response: NextResponse.next(), user: null });

    const response = await proxy(new NextRequest("http://localhost/overview"));

    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });
});