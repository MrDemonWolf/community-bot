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

describe.skipIf(skip)("audit_logs append-only trigger", () => {
  test("INSERT works, UPDATE and DELETE raise", async () => {
    const client = new Client({ connectionString: TEST_URL });
    await client.connect();
    try {
      // fresh schema each run
      await client.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
      await applyMigrations(client);

      await client.query(
        `INSERT INTO audit_logs (action, target_type, target_id) VALUES ('test','x','1')`,
      );
      const { rows } = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM audit_logs`,
      );
      expect(rows[0]?.count).toBe("1");

      await expect(client.query(`UPDATE audit_logs SET action = 'mutated'`)).rejects.toThrow(
        /append-only/,
      );

      await expect(client.query(`DELETE FROM audit_logs`)).rejects.toThrow(/append-only/);
    } finally {
      await client.end();
    }
  }, 30_000);
});
