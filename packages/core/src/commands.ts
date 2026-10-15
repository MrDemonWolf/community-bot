import { canAccess, type Capability, type Platform, type Subject } from "./permissions";

export const COMMAND_DEFINITIONS = [
  { name: "uptime", description: "How long the bot has been running.", capability: "command:public" },
  { name: "botuptime", description: "An alias for bot uptime.", capability: "command:public" },
  { name: "serveruptime", description: "OS-reported host uptime; containers may share their host's clock.", capability: "command:public" },
  { name: "streamuptime", description: "How long the current stream has been live.", capability: "command:public" },
  { name: "commands", description: "Show the available commands.", capability: "command:public" },
] as const satisfies readonly { name: string; description: string; capability: Capability }[];
export const COMMANDS = COMMAND_DEFINITIONS.map((command) => command.name);
export type Command = (typeof COMMAND_DEFINITIONS)[number]["name"];
export function commandList(prefix: string) {
  return COMMAND_DEFINITIONS.map(({ name, description }) => ({ command: prefix + name, description }));
}
export function parseCommand(message: string, prefix: string): Command | null {
  if (!prefix || !message.startsWith(prefix)) return null;
  const command = message.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
  return COMMANDS.includes(command as Command) ? command as Command : null;
}
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return [Math.floor(total / 86400) && `${Math.floor(total / 86400)}d`, Math.floor(total % 86400 / 3600) && `${Math.floor(total % 86400 / 3600)}h`, Math.floor(total % 3600 / 60) && `${Math.floor(total % 3600 / 60)}m`, `${total % 60}s`].filter(Boolean).join(" ");
}
export interface CommandContext {
  platform: Platform;
  subject: Subject;
  prefix: string;
  botUptime: number;
  hostUptime: number;
  streamStartedAt: () => Promise<Date | null>;
}
export async function executeCommand(command: Command, ctx: CommandContext): Promise<string | null> {
  const definition = COMMAND_DEFINITIONS.find((entry) => entry.name === command);
  if (!definition || !canAccess(ctx.subject, definition.capability, ctx.platform)) return null;
  switch (command) {
    case "uptime": case "botuptime": return `Bot uptime: ${formatDuration(ctx.botUptime)}.`;
    case "serveruptime": return `OS-reported host uptime: ${formatDuration(ctx.hostUptime)} (containers may report their host).`;
    case "streamuptime": {
      const startedAt = await ctx.streamStartedAt();
      return startedAt ? `Stream uptime: ${formatDuration((Date.now() - startedAt.getTime()) / 1000)}.` : "The channel is offline.";
    }
    case "commands": return `Commands: ${COMMANDS.map((name) => ctx.prefix + name).join(", ")}.`;
  }
}
