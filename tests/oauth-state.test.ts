import { expect, test } from "bun:test";
import { validOAuthState } from "../apps/web/src/lib/oauth-state";

test("OAuth state rejects missing, changed, or different UTF8 length state without throwing", () => {
  expect(validOAuthState("bot:abc", "bot:abc")).toBe(true);
  expect(validOAuthState(null, "bot:abc")).toBe(false);
  expect(validOAuthState("bot:abd", "bot:abc")).toBe(false);
  expect(validOAuthState("bot:abé", "bot:abc")).toBe(false);
  expect(validOAuthState("short", "bot:abc")).toBe(false);
});
