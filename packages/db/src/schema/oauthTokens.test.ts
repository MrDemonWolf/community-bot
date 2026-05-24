import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import { _resetCryptoState, decrypt, encrypt } from "../../../shared/src/crypto/encrypt";

const TEST_URL = process.env["DATABASE_URL_TEST"];
const skip = !TEST_URL;

const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url).pathname;

async function applyMigrations(client: Client) {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, f), "utf8");
    const statements = sql.split("--> statement-breakpoint");
    for (const s of statements) {
      const trimmed = s.trim();
      if (trimmed) await client.query(trimmed);
    }
  }
}

describe.skipIf(skip)("oauth_tokens encrypted storage", () => {
  test("ciphertext round-trips via shared crypto; bad purpose rejected", async () => {
    // Need encryption env for this test only.
    process.env["ENCRYPTION_KEYS"] = JSON.stringify({
      v1: Buffer.alloc(32, 7).toString("base64"),
    });
    process.env["ENCRYPTION_KEY_VERSION"] = "v1";
    _resetCryptoState();

    const client = new Client({ connectionString: TEST_URL });
    await client.connect();
    try {
      await client.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
      await applyMigrations(client);

      const access = encrypt("twitch-access-secret");
      const refresh = encrypt("twitch-refresh-secret");
      await client.query(
        `INSERT INTO oauth_tokens (purpose, access_ciphertext, refresh_ciphertext) VALUES ($1, $2, $3)`,
        ["twitch_bot", access, refresh],
      );

      const { rows } = await client.query<{ access_ciphertext: string }>(
        `SELECT access_ciphertext FROM oauth_tokens WHERE purpose = 'twitch_bot'`,
      );
      expect(rows[0]?.access_ciphertext).toBeDefined();
      expect(decrypt(rows[0]!.access_ciphertext)).toBe("twitch-access-secret");

      await expect(
        client.query(`INSERT INTO oauth_tokens (purpose) VALUES ('not_a_purpose')`),
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });
});
