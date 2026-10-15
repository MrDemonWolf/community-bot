import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// Run on the CI host after browser fixtures are restored, never inside a worker.
assert.equal(process.env.CI, "true", "Compose Watch proof is CI-only");
assert.equal(process.env.COMPOSE_PROJECT_NAME, "community-bot-e2e", "Use only the disposable CI project");
const originalFiles = process.env.COMPOSE_FILE;
assert(originalFiles?.includes("compose.e2e.yaml"), "Start from the isolated browser-test stack");

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = fileURLToPath(new URL("../../packages/core/src/commands.ts", import.meta.url));
const guestSource = "/app/packages/core/src/commands.ts";
const devFiles = "compose.yaml:compose.dev.yaml";
const services = ["discord", "twitch"] as const;
const exec = promisify(execFile);
const original = await readFile(source);
const originalStat = await stat(source);
const marker = `\n// compose-watch-proof-${process.pid}-${Date.now()}\n`;
let watcher: ChildProcess | undefined;
let watcherOutput = "";
let changed = false;

function environment(files: string) {
  return { ...process.env, COMPOSE_PROJECT_NAME: "community-bot-e2e", COMPOSE_FILE: files };
}

async function docker(args: string[], files = devFiles, timeout = 30_000) {
  const result = await exec("docker", args, { cwd: root, env: environment(files), timeout, maxBuffer: 2_000_000 });
  return result.stdout.trim();
}

async function waitFor(check: () => Promise<boolean>, label: string, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (watcher && (watcher.exitCode !== null || watcher.signalCode !== null)) throw new Error("Compose Watch exited unexpectedly");
    if (await check().catch(() => false)) return;
    await sleep(500);
  }
  throw new Error(`Timed out: ${label}`);
}

async function container(service: string, files = devFiles) {
  const id = await docker(["compose", "ps", "-q", service], files);
  assert(/^[a-f0-9]{12,64}$/.test(id), `Expected exactly one running ${service} container`);
  return id;
}

async function state(id: string) {
  const value = await docker(["inspect", "--format", "{{.State.StartedAt}}|{{.State.Running}}", id]);
  const [startedAt, running] = value.split("|");
  assert(startedAt && Number.isFinite(Date.parse(startedAt)), "Container must have a start timestamp");
  return { startedAt, running: running === "true" };
}

async function healthy(service: (typeof services)[number]) {
  const path = service === "discord" ? "/healthz" : "/health";
  await docker(["compose", "exec", "-T", service, "bun", "-e", `const r=await fetch('http://127.0.0.1:3003${path}',{signal:AbortSignal.timeout(4000)});if(!r.ok)process.exit(1)`]);
}

async function hasMarker(service: (typeof services)[number], expected: boolean) {
  await docker(["compose", "exec", "-T", service, "bun", "-e", `const text=await Bun.file(${JSON.stringify(guestSource)}).text();if(text.includes(${JSON.stringify(marker.trim())})!==${expected})process.exit(1)`]);
}

async function stopWatcher() {
  if (!watcher?.pid || watcher.exitCode !== null || watcher.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => watcher!.once("exit", () => resolve()));
  try { process.kill(-watcher.pid, "SIGINT"); } catch { return; }
  await Promise.race([exited, sleep(10_000, undefined, { ref: false })]);
  if (watcher.exitCode === null && watcher.signalCode === null) {
    process.kill(-watcher.pid, "SIGKILL");
    await exited;
  }
}

const protectedContainers = new Map<string, { id: string; startedAt: string }>();
for (const service of ["web", "production-web"]) {
  const id = await container(service, originalFiles);
  protectedContainers.set(service, { id, startedAt: (await state(id)).startedAt });
}

const paused = await docker(["compose", "exec", "-T", "postgres", "psql", "-U", "community_bot", "-d", "community_bot", "-Atc",
  "SELECT count(*) = 1 AND COALESCE(bool_and(NOT (discord_enabled OR twitch_enabled OR channel_points_enabled)), false) FROM settings"], originalFiles);
assert.equal(paused, "t", "Provider connections and reward collection must stay disabled");

try {
  await docker(["compose", "up", "--build", "-d", "--no-deps", ...services], devFiles, 600_000);
  await waitFor(async () => { for (const service of services) await healthy(service); return true; }, "development workers become healthy");
  watcher = spawn("docker", ["compose", "watch", "--no-up", ...services], {
    cwd: root, env: environment(devFiles), detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  const record = (chunk: Buffer) => { watcherOutput = (watcherOutput + chunk.toString()).slice(-8000); };
  watcher.stdout?.on("data", record);
  watcher.stderr?.on("data", record);
  await new Promise<void>((resolve, reject) => { watcher!.once("spawn", () => resolve()); watcher!.once("error", reject); });
  await waitFor(async () => /watch enabled/i.test(watcherOutput), "Compose Watch is ready", 45_000);
  await sleep(1000);
  const before = new Map<string, { id: string; startedAt: string }>();
  for (const service of services) {
    await healthy(service);
    const id = await container(service);
    before.set(service, { id, startedAt: (await state(id)).startedAt });
  }
  changed = true;
  await writeFile(source, Buffer.concat([original, Buffer.from(marker)]));
  await waitFor(async () => {
    for (const service of services) {
      const prior = before.get(service)!;
      if (await container(service) !== prior.id) return false;
      const current = await state(prior.id);
      if (!current.running || current.startedAt === prior.startedAt) return false;
      await hasMarker(service, true);
      await healthy(service);
    }
    return true;
  }, "shared source syncs and restarts both healthy workers");
  console.log("PASS: host Compose Watch synchronized shared source and restarted both healthy workers");
} catch (error) {
  if (watcherOutput) console.error(watcherOutput);
  throw error;
} finally {
  try {
    if (changed) {
      await writeFile(source, original);
      assert.deepEqual(await readFile(source), original, "Source bytes must be restored exactly");
      if (watcher && watcher.exitCode === null && watcher.signalCode === null) {
        await waitFor(async () => { for (const service of services) { await hasMarker(service, false); await healthy(service); } return true; }, "restored source syncs back into both workers", 30_000);
      }
      const restoredStat = await stat(source);
      assert.equal(restoredStat.mode, originalStat.mode, "Source permissions must remain unchanged");
      assert.equal(restoredStat.uid, originalStat.uid, "Source owner must remain unchanged");
      assert.equal(restoredStat.gid, originalStat.gid, "Source group must remain unchanged");
    }
  } finally {
    await stopWatcher();
    for (const [service, prior] of protectedContainers) {
      assert.equal(await container(service, originalFiles), prior.id, `${service} must not be recreated`);
      assert.equal((await state(prior.id)).startedAt, prior.startedAt, `${service} must not be restarted`);
    }
  }
}
console.log("PASS: source restored, watcher stopped, dashboard containers unchanged");
