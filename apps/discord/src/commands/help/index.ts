import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import logger from "../../utils/logger.js";

const BRAND_COLOR = 0x00aced;

interface HelpTopic {
  title: string;
  description: string;
  fields: { name: string; value: string; inline?: boolean }[];
}

const topics: Record<string, HelpTopic> = {
  twitch: {
    title: "Twitch Notifications",
    description: "Monitor Twitch channels and get live notifications in Discord.",
    fields: [
      {
        name: "/twitch add <username>",
        value: "Add a Twitch channel to monitor for live notifications.",
      },
      {
        name: "/twitch remove <username>",
        value: "Stop monitoring a Twitch channel.",
      },
      {
        name: "/twitch list",
        value: "List all monitored channels and current config.",
      },
      {
        name: "/twitch notifications set-channel <channel>",
        value: "Set the channel where live notifications are sent.",
      },
      {
        name: "/twitch notifications set-role <role>",
        value: "Set the role to mention when a stream goes live.",
      },
    ],
  },
  quote: {
    title: "Quotes",
    description: "Save and recall memorable quotes from your community.",
    fields: [
      { name: "/quote show [number]", value: "Show a random quote or a specific quote by number." },
      { name: "/quote add <text>", value: "Add a new quote." },
      { name: "/quote remove <number>", value: "Remove a quote by number." },
      { name: "/quote search <query>", value: "Search quotes by keyword." },
    ],
  },
  config: {
    title: "Server Configuration",
    description: "Configure logging channels and server settings.",
    fields: [
      {
        name: "/config log set-moderation <channel>",
        value: "Set the channel for moderation logs (bans, kicks, warns, mutes).",
      },
      {
        name: "/config log set-server <channel>",
        value: "Set the channel for server event logs (channel/role changes).",
      },
      {
        name: "/config log set-voice <channel>",
        value: "Set the channel for voice activity logs.",
      },
      { name: "/config log view", value: "View current log channel configuration." },
    ],
  },
};

const topicChoices = Object.keys(topics).map((key) => ({
  name: key,
  value: key,
}));

export const helpCommand = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Get help with bot commands and features")
  .addStringOption((opt) =>
    opt
      .setName("topic")
      .setDescription("Specific topic to get help with")
      .setRequired(false)
      .addChoices(...topicChoices)
  ) as SlashCommandBuilder;

export async function handleHelpCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const topic = interaction.options.getString("topic");

    if (topic && topics[topic]) {
      const t = topics[topic];
      const embed = new EmbedBuilder()
        .setTitle(t.title)
        .setDescription(t.description)
        .addFields(t.fields)
        .setColor(BRAND_COLOR)
        .setFooter({ text: "Use /help to see all available topics" });

      await interaction.editReply({ embeds: [embed] });
      logger.commands.success("help", username, userId);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Bot Help")
      .setDescription(
        "Here are the available command groups. Use `/help topic:<name>` for detailed help on each."
      )
      .addFields(
        Object.entries(topics).map(([key, t]) => ({
          name: `\`${key}\` — ${t.title}`,
          value: t.description,
        }))
      )
      .setColor(BRAND_COLOR)
      .setFooter({ text: "More features coming soon!" });

    await interaction.editReply({ embeds: [embed] });
    logger.commands.success("help", username, userId);
  } catch (error) {
    logger.commands.error("help", username, userId, error);
    await interaction.editReply({
      content: "An error occurred while fetching help.",
    });
  }
}
