type ReadError = { message: string };

type ReadPage<T> = {
  data: T[] | null;
  count: number | null;
  error: ReadError | null;
};

export function throwIfReadFailed(error: ReadError | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<ReadPage<T>>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  let total = 0;

  do {
    const result = await fetchPage(offset, offset + pageSize - 1);
    throwIfReadFailed(result.error);

    if (result.count === null) {
      throw new Error("The database did not return a total row count.");
    }

    total = result.count;
    const page = result.data ?? [];

    if (page.length === 0 && rows.length < total) {
      throw new Error("The database returned an incomplete paginated result.");
    }

    rows.push(...page);
    offset += page.length;
  } while (rows.length < total);

  return rows;
}