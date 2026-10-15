import { expect, test } from "bun:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.APP_ENCRYPTION_KEY ??=
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const { encrypt, decrypt } = await import("./crypto");

test("secrets round trip with unique IVs and reject tampering", () => {
  const first = encrypt("bot-token-for-test");
  expect(decrypt(first)).toBe("bot-token-for-test");
  expect(encrypt("bot-token-for-test")).not.toBe(first);
  const changed = Buffer.from(first, "base64");
  changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  expect(() => decrypt(changed.toString("base64"))).toThrow();
});
