import { COMMAND_DEFINITIONS } from "@community-bot/core/commands";

export function commandRegistration(enabled: boolean) {
  return enabled ? COMMAND_DEFINITIONS.map(({ name, description }) => ({ name, description })) : [];
}

export function streamStart(runtime: { stale: boolean; metadata: Record<string, unknown> } | undefined): Date | null {
  if (!runtime || runtime.stale || typeof runtime.metadata.live !== "boolean") throw new Error("Stream information is unavailable");
  if (!runtime.metadata.live) return null;
  const timestamp = runtime.metadata.streamStartedAt;
  if (typeof timestamp !== "string") throw new Error("Stream start is unavailable");
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid stream start");
  return date;
}
