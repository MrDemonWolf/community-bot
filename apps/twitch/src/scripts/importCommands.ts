import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { prisma } from "@community-bot/db";
import type {
  TwitchResponseType,
  TwitchAccessLevel,
  TwitchStreamStatus,
} from "@community-bot/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CommandEntry {
  name: string;
  enabled: boolean;
  response: string;
  responseType: TwitchResponseType;
  globalCooldown: number;
  userCooldown: number;
  accessLevel: TwitchAccessLevel;
  streamStatus: TwitchStreamStatus;
  hidden: boolean;
  aliases: string[];
  keywords: string[];
}

async function main() {
  const filePath = process.argv[2] || resolve(__dirname, "../../prisma/commands.json");
  const raw = readFileSync(filePath, "utf-8");
  const commands: CommandEntry[] = JSON.parse(raw);

  console.log(`Importing ${commands.length} commands from ${filePath}...`);

  // Get the first bot channel to scope commands to
  const botChannel = await prisma.botChannel.findFirst();
  const botChannelId = botChannel?.id ?? null;

  for (const cmd of commands) {
    await prisma.twitchChatCommand.upsert({
      where: { name_botChannelId: { name: cmd.name, botChannelId: botChannelId ?? "" } },
      update: cmd,
      create: { ...cmd, botChannelId },
    });
    console.log(
      `  ${cmd.enabled ? "+" : "-"} ${cmd.name}${cmd.aliases.length ? ` (aliases: ${cmd.aliases.join(", ")})` : ""}`
    );
  }

  console.log(`\nImported ${commands.length} commands.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
