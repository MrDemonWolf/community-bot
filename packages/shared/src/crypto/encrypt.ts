import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

type KeyMap = Record<string, Buffer>;

function loadKeys(): { keys: KeyMap; currentVersion: string } {
  const raw = process.env["ENCRYPTION_KEYS"];
  const version = process.env["ENCRYPTION_KEY_VERSION"];
  if (!raw) throw new Error("ENCRYPTION_KEYS env var missing");
  if (!version) throw new Error("ENCRYPTION_KEY_VERSION env var missing");
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new Error("ENCRYPTION_KEYS must be valid JSON");
  }
  const keys: KeyMap = {};
  for (const [v, b64] of Object.entries(parsed)) {
    const buf = Buffer.from(b64, "base64");
    if (buf.length !== 32) {
      throw new Error(`encryption key '${v}' must decode to 32 bytes`);
    }
    keys[v] = buf;
  }
  if (!keys[version]) throw new Error(`current ENCRYPTION_KEY_VERSION '${version}' not in keyset`);
  return { keys, currentVersion: version };
}

let cached: { keys: KeyMap; currentVersion: string } | undefined;
function getState() {
  cached ??= loadKeys();
  return cached;
}

/** Test-only: reset cached keys so env var changes take effect mid-test. */
export function _resetCryptoState(): void {
  cached = undefined;
}

export function encrypt(plaintext: string): string {
  const { keys, currentVersion } = getState();
  const key = keys[currentVersion];
  if (!key) throw new Error("missing current key");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${currentVersion}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4) throw new Error("malformed ciphertext payload");
  const [version, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
  const { keys } = getState();
  const key = keys[version];
  if (!key) throw new Error(`no key for version '${version}'`);
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (tag.length !== TAG_LEN) throw new Error("auth tag length invalid");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
