type PaginationInput = {
  page?: unknown;
  limit?: unknown;
};

export type PaginationResult = {
  page: number;
  limit: number;
  offset: number;
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function parsePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function parsePagination(input: PaginationInput): PaginationResult | null {
  const hasPage = typeof input.page !== "undefined";
  const hasLimit = typeof input.limit !== "undefined";
  if (!hasPage && !hasLimit) return null;

  const parsedPage = parsePositiveInteger(input.page) ?? 1;
  const parsedLimit = parsePositiveInteger(input.limit) ?? DEFAULT_LIMIT;
  const limit = Math.min(parsedLimit, MAX_LIMIT);

  return {
    page: parsedPage,
    limit,
    offset: (parsedPage - 1) * limit
  };
}
