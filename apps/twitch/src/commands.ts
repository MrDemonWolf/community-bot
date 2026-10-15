export { COMMANDS, parseCommand, formatDuration, type Command } from "@community-bot/core/commands";

export function shouldRespond(input: {
  enabled: boolean;
  muted: boolean;
  chatterId: string;
  botId: string;
  broadcasterId: string;
  channelId: string;
  sourceBroadcasterId: string | null;
  now: number;
  lastResponse: number;
  cooldownMs?: number;
}): boolean {
  return (
    input.enabled &&
    !input.muted &&
    input.chatterId !== input.botId &&
    input.broadcasterId === input.channelId &&
    (!input.sourceBroadcasterId ||
      input.sourceBroadcasterId === input.channelId) &&
    input.now - input.lastResponse >= (input.cooldownMs ?? 3000)
  );
}

export function connectionKey(settings: {
  twitchClientId: string | null;
  twitchClientSecretEnc: string | null;
  botUserId: string | null;
  botTokenEnc: string | null;
  broadcasterUserId: string | null;
  broadcasterTokenEnc?: string | null;
}): string {
  return JSON.stringify([
    settings.twitchClientId,
    settings.twitchClientSecretEnc,
    settings.botUserId,
    settings.botTokenEnc,
    settings.broadcasterUserId,
    settings.broadcasterTokenEnc,
  ]);
}

export function connectionAction(
  enabled: boolean,
  configured: boolean,
  currentKey: string | null,
  nextKey: string,
  failed: boolean,
): "stop" | "wait" | "connect" | "keep" {
  if (!enabled) return "stop";
  if (!configured) return "wait";
  return failed || currentKey !== nextKey ? "connect" : "keep";
}

export function retryDelay(failures: number): number {
  return Math.min(60000, 5000 * 2 ** Math.min(4, Math.max(0, failures - 1)));
}
