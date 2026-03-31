import { describe, expect, it } from "@jest/globals";
import { parsePagination } from "../src/utils/pagination";

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
