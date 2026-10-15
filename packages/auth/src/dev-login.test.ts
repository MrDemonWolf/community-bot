import { expect, test } from "bun:test";
import { devLoginEnabled, isLocalURL } from "./dev-login";

test("dev login requires development, explicit opt-in and a plain loopback URL", () => {
  expect(devLoginEnabled("development", "true", "http://localhost:3001")).toBe(
    true,
  );
  expect(devLoginEnabled("production", "true", "http://localhost:3001")).toBe(
    false,
  );
  expect(devLoginEnabled("development", "false", "http://localhost:3001")).toBe(
    false,
  );
  for (const url of [
    "https://localhost",
    "http://localhost.attacker.test",
    "https://bot.example.com",
    "not a URL",
  ]) {
    expect(isLocalURL(url)).toBe(false);
    expect(devLoginEnabled("development", "true", url)).toBe(false);
  }
});
