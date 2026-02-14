import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { handleAdd } from "./add.js";
import { handleRemove } from "./remove.js";
import { handleList } from "./list.js";
import { handleTest } from "./test.js";
import { handleSetChannel } from "./notifications-set-channel.js";
import { handleSetRole } from "./notifications-set-role.js";
import logger from "../../utils/logger.js";

export const twitchCommand = new SlashCommandBuilder()
  .setName("twitch")
  .setDescription("Manage Twitch live stream notifications")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a Twitch channel to monitor")
      .addStringOption((opt) =>
        opt
          .setName("username")
          .setDescription("Twitch username to monitor")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Stop monitoring a Twitch channel")
      .addStringOption((opt) =>
        opt
          .setName("username")
          .setDescription("Twitch username to stop monitoring")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List monitored channels and config")
  )
  .addSubcommand((sub) =>
    sub
      .setName("test")
      .setDescription("Send a test notification (owner only)")
      .addStringOption((opt) =>
        opt
          .setName("username")
          .setDescription("Twitch username to test")
          .setRequired(true)
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("notifications")
      .setDescription("Configure notification settings")
      .addSubcommand((sub) =>
        sub
          .setName("set-channel")
          .setDescription("Set the channel for Twitch notifications")
          .addChannelOption((opt) =>
            opt
              .setName("channel")
              .setDescription("Channel to send notifications to")
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("set-role")
          .setDescription("Set the role to mention for Twitch notifications")
          .addRoleOption((opt) =>
            opt
              .setName("role")
              .setDescription("Role to mention")
              .setRequired(true)
          )
      )
  ) as SlashCommandBuilder;

export async function handleTwitchCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  logger.debug("Twitch Command", `Routing: ${subcommandGroup ?? ""}/${subcommand}`);

  if (subcommandGroup === "notifications") {
    switch (subcommand) {
      case "set-channel":
        return handleSetChannel(interaction);
      case "set-role":
        return handleSetRole(interaction);
    }
  }

  switch (subcommand) {
    case "add":
      return handleAdd(interaction);
    case "remove":
      return handleRemove(interaction);
    case "list":
      return handleList(interaction);
    case "test":
      return handleTest(interaction);
  }
}
