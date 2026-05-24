import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

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

describe.skipIf(skip)("app_config singleton + checks", () => {
  test("only id=1 allowed; bad bot_mode + step out of range fail", async () => {
    const client = new Client({ connectionString: TEST_URL });
    await client.connect();
    try {
      await client.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
      await applyMigrations(client);

      await client.query(`INSERT INTO app_config (id) VALUES (1)`);
      await expect(client.query(`INSERT INTO app_config (id) VALUES (2)`)).rejects.toThrow();

      await expect(
        client.query(`UPDATE app_config SET bot_mode = 'bogus' WHERE id = 1`),
      ).rejects.toThrow();

      await expect(
        client.query(`UPDATE app_config SET setup_step = 99 WHERE id = 1`),
      ).rejects.toThrow();

      await client.query(`UPDATE app_config SET setup_step = 5 WHERE id = 1`);
      const { rows } = await client.query<{ setup_step: number }>(
        `SELECT setup_step FROM app_config WHERE id = 1`,
      );
      expect(rows[0]?.setup_step).toBe(5);
    } finally {
      await client.end();
    }
  });
});
