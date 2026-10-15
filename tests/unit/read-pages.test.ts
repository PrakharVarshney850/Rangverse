import { describe, expect, it, vi } from "vitest";

import { readAllPages, throwIfReadFailed } from "@/lib/data/read-pages";

describe("readAllPages", () => {
  it("continues across server-capped pages without skipping rows", async () => {
    const values = Array.from({ length: 9 }, (_, index) => index + 1);
    const fetchPage = vi.fn(async (from: number, to: number) => ({
      data: values.slice(from, Math.min(to + 1, from + 3)),
      count: values.length,
      error: null,
    }));

    await expect(readAllPages(fetchPage, 4)).resolves.toEqual(values);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.map(([from]) => from)).toEqual([0, 3, 6]);
  });

  it("throws when a page request fails", async () => {
    const fetchPage = vi.fn(async () => ({
      data: null,
      count: null,
      error: { message: "read failed" },
    }));

    await expect(readAllPages(fetchPage)).rejects.toThrow("read failed");
  });

  it("throws instead of silently returning an incomplete result", async () => {
    const fetchPage = vi.fn(async () => ({ data: [], count: 3, error: null }));

    await expect(readAllPages(fetchPage)).rejects.toThrow("incomplete paginated result");
  });

  it("surfaces read errors instead of treating them as empty data", () => {
    expect(() => throwIfReadFailed({ message: "read failed" })).toThrow("read failed");
    expect(() => throwIfReadFailed(null)).not.toThrow();
  });
});