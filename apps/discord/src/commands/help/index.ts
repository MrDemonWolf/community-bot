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
  roles: {
    title: "Role Panels",
    description: "Create self-assignable role panels with buttons or select menus.",
    fields: [
      { name: "/roles panel create <name>", value: "Create a new role panel." },
      { name: "/roles panel delete <name>", value: "Delete a role panel." },
      { name: "/roles panel list", value: "List all role panels." },
      { name: "/roles button add <panel> <role> <label>", value: "Add a role button to a panel." },
      { name: "/roles button remove <panel> <role>", value: "Remove a role button from a panel." },
      { name: "/roles post <panel> [channel]", value: "Post a role panel to a channel." },
      { name: "/roles refresh <panel>", value: "Refresh an already-posted panel." },
    ],
  },
  template: {
    title: "Message Templates",
    description: "Create and manage reusable message templates.",
    fields: [
      { name: "/template create <name>", value: "Create a new message template." },
      { name: "/template edit <name>", value: "Edit an existing template." },
      { name: "/template delete <name>", value: "Delete a template." },
      { name: "/template list", value: "List all templates." },
      { name: "/template preview <name>", value: "Preview a template with variable substitution." },
      { name: "/template send <name> [channel]", value: "Send a template to a channel." },
    ],
  },
  schedule: {
    title: "Scheduled Messages",
    description: "Schedule one-time or recurring messages.",
    fields: [
      { name: "/schedule create <name>", value: "Create a scheduled message." },
      { name: "/schedule edit <name>", value: "Edit a scheduled message." },
      { name: "/schedule delete <name>", value: "Delete a scheduled message." },
      { name: "/schedule list", value: "List all scheduled messages." },
      { name: "/schedule enable <name>", value: "Enable a scheduled message." },
      { name: "/schedule disable <name>", value: "Disable a scheduled message." },
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
