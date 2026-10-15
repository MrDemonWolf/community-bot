import { expect, test } from "bun:test";
import { z } from "zod";
import type { TRPCDefaultErrorShape } from "@trpc/server";
import { formatInputError } from "./input-errors";

test("validation formatter returns the first readable issue without raw payload or stack", () => {
  const result = z.object({ commandPrefix: z.string().regex(/^\S+$/, "Use 1–5 characters with no spaces.") }).safeParse({ commandPrefix: "private value" });
  if (result.success) throw new Error("Fixture must be invalid");
  const shape: TRPCDefaultErrorShape = { message: result.error.message, code: -32600,
    data: { code: "BAD_REQUEST", httpStatus: 400, path: "settings.updateCore", stack: "private server stack" } };
  const formatted = formatInputError(shape, result.error);
  expect(formatted.message).toBe("Command prefix: Use 1–5 characters with no spaces.");
  expect(formatted.data).toEqual({ code: "BAD_REQUEST", httpStatus: 400, path: "settings.updateCore" });
  expect(JSON.stringify(formatted)).not.toContain("private");
  expect(formatted.message).not.toContain("[");
});

test("validation formatter uses safe labels and preserves deliberate business errors", () => {
  const result = z.object({ token: z.string() }).safeParse({ token: { secret: "never-echo" } });
  if (result.success) throw new Error("Fixture must be invalid");
  const shape: TRPCDefaultErrorShape = { message: "Connect the bot first.", code: -32600, data: { code: "BAD_REQUEST", httpStatus: 400 } };
  expect(formatInputError(shape, result.error).message).toBe("Discord bot token: Choose or enter a valid value.");
  expect(formatInputError(shape, new Error("upstream detail"))).toBe(shape);
});
