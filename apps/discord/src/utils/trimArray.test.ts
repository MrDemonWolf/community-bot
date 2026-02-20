import { describe, it, expect } from "vitest";
import { trimArray } from "./trimArray.js";

describe("trimArray", () => {
  it("returns empty array for empty input", () => {
    expect(trimArray([])).toEqual([]);
  });

  it("trims whitespace from each element", () => {
    expect(trimArray(["  hello  ", " world "])).toEqual(["hello", "world"]);
  });

  it("handles single element", () => {
    expect(trimArray(["  test  "])).toEqual(["test"]);
  });

  it("leaves already trimmed strings unchanged", () => {
    expect(trimArray(["foo", "bar"])).toEqual(["foo", "bar"]);
  });

  it("handles mixed trimmed and untrimmed strings", () => {
    expect(trimArray(["  a", "b  ", " c "])).toEqual(["a", "b", "c"]);
  });
});
