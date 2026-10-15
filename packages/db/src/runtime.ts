import { db } from "./index";
import { runtime } from "./schema/settings";

export type RuntimePatch = {
  state: string;
  detail?: string;
  identity?: string | null;
  startedAt?: Date | null;
  metadata?: Record<string, unknown>;
};

export async function reportRuntime(
  service: "discord" | "twitch",
  patch: RuntimePatch,
) {
  const values = { ...patch, heartbeatAt: new Date() };
  await db
    .insert(runtime)
    .values({ service, ...values })
    .onConflictDoUpdate({
      target: runtime.service,
      set: values,
    });
}

export async function getRuntimes() {
  const rows = await db.select().from(runtime);
  return rows.map((row) => ({
    ...row,
    stale: Date.now() - row.heartbeatAt.getTime() > 20_000,
  }));
}
