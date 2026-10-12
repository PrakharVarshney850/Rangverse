import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SheetTable } from "@/components/data/sheet-table";
import type { DataSheetColumnRow } from "@/lib/db/database.types";
import type { SheetRecord, SheetRowPage } from "@/lib/view-models";

vi.mock("@/lib/actions/sheets", () => ({
  saveSheetRowAction: vi.fn(async () => ({ ok: true, message: "saved" })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function column(overrides: Partial<DataSheetColumnRow>): DataSheetColumnRow {
  return {
    id: overrides.column_key ?? "c",
    sheet_id: "sheet-1",
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

const COLUMNS = [
  column({ column_key: "handle", label: "Handle", is_required: true, display_order: 1 }),
  column({ column_key: "followers", label: "Followers", data_type: "NUMBER", display_order: 2 }),
  column({ column_key: "profile_url", label: "Profile link", data_type: "URL", display_order: 3 }),
  column({
    column_key: "stage",
    label: "Stage",
    data_type: "SELECT",
    options: ["New", "Contacted"],
    display_order: 4,
  }),
];

function record(overrides: Partial<SheetRecord> = {}): SheetRecord {
  return {
    id: "row-1",
    sheet_id: "sheet-1",
    assigned_to_user_id: "user-1",
    row_data: {
      handle: "@creator.one",
      followers: "12000",
      profile_url: "https://instagram.com/creator.one",
      stage: "New",
    },
    created_by: "admin",
    updated_by: "admin",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-02T00:00:00Z",
    assignee: { id: "user-1", full_name: "Intern A1", email: "a1@rangverse.test" },
    ...overrides,
  };
}

function page(rows: SheetRecord[], overrides: Partial<SheetRowPage> = {}): SheetRowPage {
  return { rows, total: rows.length, page: 1, pageCount: 1, ...overrides };
}

const baseProps = {
  sheetId: "sheet-1",
  columns: COLUMNS,
  canEdit: true,
  canAssign: false,
  assignees: [],
  buildHref: (n: number) => `/data/x?page=${n}`,
  searchTerm: "",
};

describe("SheetTable", () => {
  it("renders a header for every configured column", () => {
    render(<SheetTable {...baseProps} page={page([record()])} />);

    for (const label of ["Handle", "Followers", "Profile link", "Stage"]) {
      expect(screen.getByRole("button", { name: new RegExp(`sort by ${label}`, "i") })).toBeInTheDocument();
    }
  });

  it("renders record values from row_data", () => {
    render(<SheetTable {...baseProps} page={page([record()])} />);

    expect(screen.getByText("@creator.one")).toBeInTheDocument();
    expect(screen.getByText("12000")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("renders a URL column as a safe external link", () => {
    render(<SheetTable {...baseProps} page={page([record()])} />);

    const link = screen.getByRole("link", { name: /instagram\.com/i });
    expect(link).toHaveAttribute("href", "https://instagram.com/creator.one");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("shows a dash rather than nothing for an empty cell", () => {
    const sparse = record({ row_data: { handle: "@only.handle" } });
    const { container } = render(<SheetTable {...baseProps} page={page([sparse])} />);

    expect(within(container).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows the record owner", () => {
    render(<SheetTable {...baseProps} page={page([record()])} />);
    expect(screen.getByText("Intern A1")).toBeInTheDocument();
  });

  it("offers editing only when the viewer has EDIT access", () => {
    const { rerender } = render(<SheetTable {...baseProps} page={page([record()])} />);
    expect(screen.getByRole("button", { name: /edit record/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add record/i })).toBeInTheDocument();

    rerender(<SheetTable {...baseProps} canEdit={false} page={page([record()])} />);
    expect(screen.queryByRole("button", { name: /edit record/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add record/i })).not.toBeInTheDocument();
  });

  it("explains an empty sheet instead of rendering a blank table", () => {
    render(<SheetTable {...baseProps} page={page([])} />);

    expect(screen.getByText(/no records you can see yet/i)).toBeInTheDocument();
    expect(screen.getByText(/only the records assigned to you/i)).toBeInTheDocument();
  });

  it("explains an empty search result differently from an empty sheet", () => {
    render(<SheetTable {...baseProps} page={page([])} searchTerm="zzz" />);

    expect(screen.getByText(/no records match that search/i)).toBeInTheDocument();
  });

  it("states how many records the viewer can access, not how many exist", () => {
    render(
      <SheetTable
        {...baseProps}
        page={page([record()], { total: 3, pageCount: 2, page: 1 })}
      />,
    );

    expect(screen.getByText(/3 records you can access/i)).toBeInTheDocument();
  });

  it("disables Previous on the first page and Next on the last", () => {
    const { rerender } = render(
      <SheetTable {...baseProps} page={page([record()], { total: 30, pageCount: 2, page: 1 })} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();

    rerender(
      <SheetTable {...baseProps} page={page([record()], { total: 30, pageCount: 2, page: 2 })} />,
    );
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("gives the search box an accessible name", () => {
    render(<SheetTable {...baseProps} page={page([record()])} />);
    expect(screen.getByRole("textbox", { name: /search records/i })).toBeInTheDocument();
  });
});
