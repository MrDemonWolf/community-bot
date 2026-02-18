import { describe, it, expect } from "vitest";
import { cronToText, isValidCron, getCronDetails } from "./cronParser.js";

describe("cronParser", () => {
  describe("cronToText", () => {
    it("converts simple daily cron", () => {
      const result = cronToText("0 8 * * *");
      expect(result).toContain("08:00");
    });

    it("converts every minute cron", () => {
      const result = cronToText("* * * * *");
      expect(result.toLowerCase()).toContain("every minute");
    });

    it("returns error description for invalid expression", () => {
      const result = cronToText("not a cron");
      expect(result).toContain("error occurred");
    });
  });

  describe("isValidCron", () => {
    it.each([
      ["* * * * *"],
      ["0 8 * * *"],
      ["*/5 * * * *"],
      ["0 0 1 * *"],
    ])("returns true for valid expression: %s", (expression) => {
      expect(isValidCron(expression)).toBe(true);
    });

    it.each([
      [""],
      ["not a cron"],
      ["60 * * * *"],
    ])("returns false for invalid expression: %s", (expression) => {
      expect(isValidCron(expression)).toBe(false);
    });
  });

  describe("getCronDetails", () => {
    it("returns details for valid cron", () => {
      const details = getCronDetails("0 8 * * *");
      expect(details.expression).toBe("0 8 * * *");
      expect(details.isValid).toBe(true);
      expect(details.description).toContain("08:00");
    });

    it("returns invalid details for bad cron", () => {
      const details = getCronDetails("bad");
      expect(details.expression).toBe("bad");
      expect(details.isValid).toBe(false);
      expect(details.description).toBe("Invalid cron expression");
    });
  });
});
