import { describe, expect, it } from "@jest/globals";
import { buildPaginationMeta, paginateItems, parsePagination } from "../src/utils/pagination";

describe("parsePagination", () => {
  it("returns null when query has no pagination params", () => {
    expect(parsePagination({})).toBeNull();
  });

  it("parses and clamps values", () => {
    expect(parsePagination({ page: "2", limit: "500" })).toEqual({
      page: 2,
      limit: 100,
      offset: 100
    });
  });

  it("uses defaults when values are invalid", () => {
    expect(parsePagination({ page: "abc", limit: "0" })).toEqual({
      page: 1,
      limit: 20,
      offset: 0
    });
  });
});

describe("pagination helpers", () => {
  it("builds metadata with next page flag", () => {
    expect(buildPaginationMeta(45, { page: 2, limit: 20, offset: 20 })).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNext: true
    });
  });

  it("paginates items with metadata", () => {
    const result = paginateItems(
      [1, 2, 3, 4, 5, 6, 7],
      { page: 2, limit: 3, offset: 3 }
    );

    expect(result).toEqual({
      items: [4, 5, 6],
      page: 2,
      limit: 3,
      total: 7,
      totalPages: 3,
      hasNext: true
    });
  });
});
