"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { flexRender, type SortingState } from "@tanstack/react-table";
// TanStack Table v9 ships the stable v8 API on its `legacy` entrypoint. The new
// feature/atom API is not needed here: the Data Hub is a scoped, server-paginated
// table, not a client-side data grid.
import {
  getCoreRowModel,
  getSortedRowModel,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import { ArrowDownIcon, ArrowUpIcon, LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { saveSheetRowAction } from "@/lib/actions/sheets";
import type { DataSheetColumnRow } from "@/lib/db/database.types";
import { displayName, type PersonSummary } from "@/lib/display";
import { formatBusinessDate } from "@/lib/domain/time";
import type { SheetRecord, SheetRowPage } from "@/lib/view-models";

type RowModel = SheetRecord;

export function SheetTable({
  sheetId,
  sheetSlug,
  columns,
  page,
  canEdit,
  canAssign,
  assignees,
  searchTerm,
}: {
  sheetId: string;
  sheetSlug: string;
  columns: DataSheetColumnRow[];
  page: SheetRowPage;
  canEdit: boolean;
  canAssign: boolean;
  assignees: PersonSummary[];
  searchTerm: string;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editing, setEditing] = useState<RowModel | null>(null);
  const [creating, setCreating] = useState(false);

  function buildHref(pageNumber: number) {
    const next = new URLSearchParams();
    if (searchTerm) next.set("q", searchTerm);
    if (pageNumber > 1) next.set("page", String(pageNumber));
    const query = next.toString();
    const base = `/data/${sheetSlug}`;
    return query ? `${base}?${query}` : base;
  }

  const tableColumns = useMemo<LegacyColumnDef<RowModel>[]>(() => {
    const configured: LegacyColumnDef<RowModel>[] = columns.map((column) => ({
      id: column.column_key,
      header: column.label,
      accessorFn: (row: RowModel) => row.row_data[column.column_key] ?? "",
      cell: (info: { getValue: () => unknown }) => {
        const value = String(info.getValue() ?? "");
        if (!value) return <span className="text-muted-foreground/60">—</span>;
        if (column.data_type === "URL") {
          return (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold underline-offset-4 hover:underline"
            >
              {value.replace(/^https?:\/\//, "").slice(0, 40)}
            </a>
          );
        }
        if (column.data_type === "LONG_TEXT") {
          return <span className="line-clamp-2 max-w-xs">{value}</span>;
        }
        return <span>{value}</span>;
      },
    }));

    configured.push({
      id: "__assignee",
      header: "Owner",
      accessorFn: (row: RowModel) => displayName(row.assignee),
      cell: (info: { getValue: () => unknown }) => (
        <span className="text-muted-foreground text-xs">{String(info.getValue() ?? "")}</span>
      ),
    });

    configured.push({
      id: "__updated",
      header: "Updated",
      accessorFn: (row: RowModel) => row.updated_at,
      cell: (info: { getValue: () => unknown }) => (
        <span className="text-muted-foreground text-xs">
          {formatBusinessDate(String(info.getValue()))}
        </span>
      ),
    });

    if (canEdit) {
      configured.push({
        id: "__actions",
        header: "",
        enableSorting: false,
        cell: ({ row }: { row: { original: RowModel } }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit record"
            onClick={() => setEditing(row.original)}
          >
            <PencilIcon aria-hidden />
          </Button>
        ),
      });
    }

    return configured;
  }, [columns, canEdit]);

  const table = useLegacyTable<RowModel>({
    data: page.rows,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex flex-1 items-center gap-2" method="get">
          <Input
            name="q"
            defaultValue={searchTerm}
            placeholder="Search records…"
            className="max-w-xs"
            aria-label="Search records"
          />
          <Button type="submit" variant="outline" size="lg">
            Search
          </Button>
        </form>

        {canEdit && (
          <Button variant="brand" size="lg" onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden />
            Add record
          </Button>
        )}
      </div>

      {page.rows.length === 0 ? (
        <EmptyState
          title={searchTerm ? "No records match that search" : "No records you can see yet"}
          description={
            searchTerm
              ? "Try a different term, or clear the search."
              : "You see only the records assigned to you in this sheet. An administrator or manager assigns records."
          }
          className="bg-card"
          action={
            canEdit ? (
              <Button variant="brand" size="lg" onClick={() => setCreating(true)}>
                <PlusIcon aria-hidden />
                Add the first record
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-card border-border/70 overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sortable = header.column.getCanSort();
                      const direction = header.column.getIsSorted();
                      return (
                        <TableHead key={header.id} className="whitespace-nowrap">
                          {header.isPlaceholder ? null : sortable ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                              className="hover:text-foreground inline-flex items-center gap-1.5"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {direction === "asc" && <ArrowUpIcon className="size-3" aria-hidden />}
                              {direction === "desc" && (
                                <ArrowDownIcon className="size-3" aria-hidden />
                              )}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <nav
            aria-label="Record pages"
            className="border-border/60 flex items-center justify-between gap-3 border-t px-5 py-3.5"
          >
            <p className="text-muted-foreground text-xs">
              Page {page.page} of {page.pageCount} · {page.total} record
              {page.total === 1 ? "" : "s"} you can access
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page.page <= 1}
                onClick={() => router.push(buildHref(page.page - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page.page >= page.pageCount}
                onClick={() => router.push(buildHref(page.page + 1))}
              >
                Next
              </Button>
            </div>
          </nav>
        </div>
      )}

      <RecordDialog
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        sheetId={sheetId}
        columns={columns}
        record={editing}
        canAssign={canAssign}
        assignees={assignees}
      />
    </>
  );
}

function RecordDialog({
  open,
  onClose,
  sheetId,
  columns,
  record,
  canAssign,
  assignees,
}: {
  open: boolean;
  onClose: () => void;
  sheetId: string;
  columns: DataSheetColumnRow[];
  record: RowModel | null;
  canAssign: boolean;
  assignees: PersonSummary[];
}) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveSheetRowAction(formData);
      if (result.ok) {
        toast.success(result.message);
        setFieldErrors({});
        onClose();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {record ? "Edit record" : "Add record"}
          </DialogTitle>
          <DialogDescription>
            Values are validated against this sheet&apos;s configured columns, both here and in the
            database.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4" noValidate>
          <input type="hidden" name="sheetId" value={sheetId} />
          {record && <input type="hidden" name="rowId" value={record.id} />}

          {columns.map((column) => {
            const fieldName = `field.${column.column_key}`;
            const defaultValue = record?.row_data[column.column_key] ?? "";
            const error = fieldErrors[fieldName];

            return (
              <div key={column.id} className="space-y-2">
                <Label htmlFor={fieldName}>
                  {column.label}
                  {column.is_required && <span className="text-gold ml-1">*</span>}
                </Label>

                {column.data_type === "LONG_TEXT" ? (
                  <Textarea
                    id={fieldName}
                    name={fieldName}
                    rows={3}
                    defaultValue={defaultValue}
                    required={column.is_required}
                  />
                ) : column.data_type === "SELECT" ? (
                  <Select name={fieldName} defaultValue={defaultValue || undefined}>
                    <SelectTrigger id={fieldName} className="w-full">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {column.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : column.data_type === "BOOLEAN" ? (
                  <Select name={fieldName} defaultValue={defaultValue || undefined}>
                    <SelectTrigger id={fieldName} className="w-full">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={fieldName}
                    name={fieldName}
                    type={inputTypeFor(column.data_type)}
                    defaultValue={defaultValue}
                    required={column.is_required}
                    aria-invalid={Boolean(error)}
                  />
                )}

                {error && <p className="text-status-danger text-xs">{error}</p>}
              </div>
            );
          })}

          {!record && canAssign && (
            <div className="space-y-2">
              <Label htmlFor="assignedToUserId">Assign to</Label>
              <Select name="assignedToUserId">
                <SelectTrigger id="assignedToUserId" className="w-full">
                  <SelectValue placeholder="Nobody yet" />
                </SelectTrigger>
                <SelectContent>
                  {assignees.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {displayName(person)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" size="lg" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
              {record ? "Save changes" : "Add record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function inputTypeFor(dataType: DataSheetColumnRow["data_type"]): string {
  switch (dataType) {
    case "NUMBER":
      return "number";
    case "DATE":
      return "date";
    case "EMAIL":
      return "email";
    case "URL":
      return "url";
    case "PHONE":
      return "tel";
    default:
      return "text";
  }
}
