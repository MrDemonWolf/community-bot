import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildRevision } from "../apps/web/build-revision";

const directories: string[] = [];
const SHA = "a".repeat(40);
const FALLBACK = "b".repeat(40);
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "community-bot-revision-"));
  directories.push(root);
  mkdirSync(join(root, ".git", "refs", "heads"), { recursive: true });
  return root;
}
afterEach(() => { for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("build revision uses the checkout, including detached and packed refs", () => {
  const root = fixture();
  writeFileSync(join(root, ".git", "HEAD"), SHA + "\n");
  expect(buildRevision(root, FALLBACK)).toBe(SHA);
  writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  writeFileSync(join(root, ".git", "packed-refs"), `# pack-refs with: peeled\n${SHA} refs/heads/main\n`);
  expect(buildRevision(root)).toBe(SHA);
  writeFileSync(join(root, ".git", "refs", "heads", "main"), FALLBACK);
  expect(buildRevision(root)).toBe(FALLBACK);
});

test("worktrees resolve their common ref directory", () => {
  const root = fixture();
  rmSync(join(root, ".git"), { recursive: true });
  mkdirSync(join(root, "metadata", "worktrees", "bot"), { recursive: true });
  mkdirSync(join(root, "metadata", "refs", "heads"), { recursive: true });
  writeFileSync(join(root, ".git"), "gitdir: metadata/worktrees/bot\n");
  writeFileSync(join(root, "metadata", "worktrees", "bot", "HEAD"), "ref: refs/heads/main\n");
  writeFileSync(join(root, "metadata", "worktrees", "bot", "commondir"), "../..\n");
  writeFileSync(join(root, "metadata", "refs", "heads", "main"), SHA);
  expect(buildRevision(root)).toBe(SHA);
});

test("archives use only a valid full revision and never guess a remote head", () => {
  const root = fixture();
  expect(buildRevision(root, SHA)).toBe(SHA);
  expect(buildRevision(root, "latest")).toBe("");
  writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/../../other\n");
  expect(buildRevision(root, "")).toBe("");
});
