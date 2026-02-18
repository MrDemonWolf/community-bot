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

    it("returns description for invalid expression instead of throwing", () => {
      const result = cronToText("not a cron");
      expect(typeof result).toBe("string");
    });
  });

  describe("isValidCron", () => {
    it("returns true for valid expressions", () => {
      expect(isValidCron("* * * * *")).toBe(true);
      expect(isValidCron("0 8 * * *")).toBe(true);
      expect(isValidCron("*/5 * * * *")).toBe(true);
      expect(isValidCron("0 0 1 * *")).toBe(true);
    });

    it("returns false for invalid expressions", () => {
      expect(isValidCron("")).toBe(false);
      expect(isValidCron("not a cron")).toBe(false);
      expect(isValidCron("60 * * * *")).toBe(false);
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
      expect(details.isValid).toBe(false);
      expect(details.description).toBe("Invalid cron expression");
    });
  });
});
