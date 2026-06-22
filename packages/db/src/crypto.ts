import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@community-bot/env/server";

// AES-256-GCM secret encryption at rest. Stored format: base64(iv | tag | ciphertext).
// ponytail: app-side crypto (one key in env) instead of pgsodium — keeps dev
// (plain postgres) and prod (Supabase) identical and avoids a DB extension dep.
const KEY = Buffer.from(env.APP_ENCRYPTION_KEY, "base64");
if (KEY.length !== 32) {
  throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes (openssl rand -base64 32)");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
