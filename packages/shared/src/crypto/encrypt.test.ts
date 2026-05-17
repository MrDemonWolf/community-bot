import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { _resetCryptoState, decrypt, encrypt } from "./encrypt";

function setKeys(keys: Record<string, Buffer>, currentVersion: string) {
  const json: Record<string, string> = {};
  for (const [v, b] of Object.entries(keys)) json[v] = b.toString("base64");
  process.env["ENCRYPTION_KEYS"] = JSON.stringify(json);
  process.env["ENCRYPTION_KEY_VERSION"] = currentVersion;
  _resetCryptoState();
}

const k1 = randomBytes(32);
const k2 = randomBytes(32);

const prevKeys = process.env["ENCRYPTION_KEYS"];
const prevVersion = process.env["ENCRYPTION_KEY_VERSION"];

afterEach(() => {
  if (prevKeys === undefined) delete process.env["ENCRYPTION_KEYS"];
  else process.env["ENCRYPTION_KEYS"] = prevKeys;
  if (prevVersion === undefined) delete process.env["ENCRYPTION_KEY_VERSION"];
  else process.env["ENCRYPTION_KEY_VERSION"] = prevVersion;
  _resetCryptoState();
});

describe("crypto/encrypt", () => {
  beforeEach(() => setKeys({ v1: k1 }, "v1"));

  test("round-trips with current key", () => {
    const ct = encrypt("hello world");
    expect(ct.startsWith("v1:")).toBe(true);
    expect(decrypt(ct)).toBe("hello world");
  });

  test("rotation: v1 ciphertext still decrypts after promoting v2", () => {
    const ctV1 = encrypt("legacy secret");
    setKeys({ v1: k1, v2: k2 }, "v2");
    const ctV2 = encrypt("fresh secret");
    expect(ctV2.startsWith("v2:")).toBe(true);
    expect(decrypt(ctV1)).toBe("legacy secret");
    expect(decrypt(ctV2)).toBe("fresh secret");
  });

  test("tampered ciphertext throws", () => {
    const ct = encrypt("payload");
    const parts = ct.split(":");
    parts[3] = Buffer.from("XXXX").toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  test("unknown version throws", () => {
    expect(() => decrypt("v9:AAAA:AAAA:AAAA")).toThrow(/no key for version/);
  });
});
