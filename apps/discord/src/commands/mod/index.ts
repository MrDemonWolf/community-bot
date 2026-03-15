import {
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction, GuildMember } from "discord.js";

import { db, eq, and, inArray, count as countFn, desc, discordCases, discordWarnThresholds } from "@community-bot/db";
import logger from "../../utils/logger.js";
import { hasPermission } from "../../utils/permissions.js";
import { dispatchLog } from "../../utils/eventLogger.js";

const BRAND_COLOR = 0x00aced;
const COLOR_BAN = 0xe74c3c;
const COLOR_KICK = 0xe67e22;
const COLOR_WARN = 0xf1c40f;
const COLOR_MUTE = 0x9b59b6;
const COLOR_RESOLVE = 0x2ecc71;

export const modCommand = new SlashCommandBuilder()
  .setName("mod")
  .setDescription("Moderation commands")
  .addSubcommand((sub) =>
    sub
      .setName("ban")
      .setDescription("Ban a user from the server")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to ban").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the ban")
      )
      .addIntegerOption((opt) =>
        opt
          .setName("delete-days")
          .setDescription("Days of messages to delete (0-7)")
          .setMinValue(0)
          .setMaxValue(7)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("tempban")
      .setDescription("Temporarily ban a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to ban").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Duration in minutes")
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the ban")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("kick")
      .setDescription("Kick a user from the server")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to kick").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the kick")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("warn")
      .setDescription("Warn a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to warn").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason for the warning")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("mute")
      .setDescription("Timeout a user (Discord timeout)")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to mute").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Duration in minutes")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the mute")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("unban")
      .setDescription("Unban a user")
      .addStringOption((opt) =>
        opt
          .setName("user-id")
          .setDescription("User ID to unban")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the unban")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("unmute")
      .setDescription("Remove timeout from a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to unmute").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for the unmute")
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("unwarn")
      .setDescription("Remove the latest active warning from a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to unwarn").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("reason").setDescription("Reason for removing the warning")
      )
  ) as SlashCommandBuilder;

async function nextCaseNumber(guildId: string): Promise<number> {
  const [{ value }] = await db.select({ value: countFn() }).from(discordCases).where(eq(discordCases.guildId, guildId));
  return Number(value) + 1;
}

function modEmbed(
  title: string,
  color: number,
  fields: { name: string; value: string; inline?: boolean }[]
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(fields)
    .setTimestamp();
}

async function checkEscalation(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  targetId: string,
  targetTag: string
): Promise<void> {
  const [{ value: activeWarningsValue }] = await db.select({ value: countFn() }).from(discordCases).where(and(eq(discordCases.guildId, guildId), eq(discordCases.targetId, targetId), eq(discordCases.type, "WARN"), eq(discordCases.resolved, false)));
  const activeWarnings = Number(activeWarningsValue);

  const threshold = await db.query.discordWarnThresholds.findFirst({
    where: and(eq(discordWarnThresholds.guildId, guildId), eq(discordWarnThresholds.count, activeWarnings)),
  });

  if (!threshold) return;

  const guild = interaction.guild;
  if (!guild) return;

  const caseNum = await nextCaseNumber(guildId);
  const moderatorTag = `${interaction.client.user?.username ?? "Bot"}#auto`;
  const reason = `Auto-escalation: ${activeWarnings} warnings reached threshold`;

  if (threshold.action === "BAN") {
    try {
      await guild.members.ban(targetId, { reason });
      await db.insert(discordCases).values({
          guildId,
          caseNumber: caseNum,
          type: "BAN",
          targetId,
          targetTag,
          moderatorId: interaction.client.user?.id ?? "system",
          moderatorTag,
          reason,
        });
      await interaction.followUp({
        content: `Auto-escalation: **${targetTag}** has been banned (${activeWarnings} warnings). Case #${caseNum}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch {
      // Silently fail escalation if missing perms
    }
  } else if (threshold.action === "KICK") {
    try {
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (member) {
        await member.kick(reason);
        await db.insert(discordCases).values({
            guildId,
            caseNumber: caseNum,
            type: "KICK",
            targetId,
            targetTag,
            moderatorId: interaction.client.user?.id ?? "system",
            moderatorTag,
            reason,
          });
        await interaction.followUp({
          content: `Auto-escalation: **${targetTag}** has been kicked (${activeWarnings} warnings). Case #${caseNum}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch {
      // Silently fail
    }
  } else if (threshold.action === "MUTE" && threshold.duration) {
    try {
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (member) {
        await member.timeout(threshold.duration * 60_000, reason);
        const expiresAt = new Date(
          Date.now() + threshold.duration * 60_000
        );
        await db.insert(discordCases).values({
            guildId,
            caseNumber: caseNum,
            type: "MUTE",
            targetId,
            targetTag,
            moderatorId: interaction.client.user?.id ?? "system",
            moderatorTag,
            reason,
            duration: threshold.duration,
            expiresAt,
          });
        await interaction.followUp({
          content: `Auto-escalation: **${targetTag}** has been muted for ${threshold.duration}m (${activeWarnings} warnings). Case #${caseNum}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch {
      // Silently fail
    }
  }
}

export async function handleModCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.user.username;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await hasPermission(interaction, "mod"))) {
    await interaction.reply({
      content:
        "You need the Mod role or Manage Messages permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "ban":
        return await handleBan(interaction);
      case "tempban":
        return await handleTempban(interaction);
      case "kick":
        return await handleKick(interaction);
      case "warn":
        return await handleWarn(interaction);
      case "mute":
        return await handleMute(interaction);
      case "unban":
        return await handleUnban(interaction);
      case "unmute":
        return await handleUnmute(interaction);
      case "unwarn":
        return await handleUnwarn(interaction);
    }
  } catch (error) {
    logger.commands.error("mod", username, userId, error, guildId);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content: "An error occurred while executing the moderation command.",
      });
    } else {
      await interaction.reply({
        content: "An error occurred while executing the moderation command.",
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleBan(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? undefined;
  const deleteDays = interaction.options.getInteger("delete-days") ?? 0;

  await guild.members.ban(target.id, {
    reason,
    deleteMessageSeconds: deleteDays * 86400,
  });

  const caseNum = await nextCaseNumber(guildId);
  const [modCase] = await db.insert(discordCases).values({
      guildId,
      caseNumber: caseNum,
      type: "BAN",
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
    }).returning();

  const embed = modEmbed("User Banned", COLOR_BAN, [
    { name: "User", value: `${target.tag} (${target.id})`, inline: true },
    { name: "Moderator", value: interaction.user.tag, inline: true },
    { name: "Case", value: `#${caseNum}`, inline: true },
    { name: "Reason", value: reason ?? "No reason provided" },
  ]);

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content: `**${target.tag}** has been banned. Case #${caseNum}`,
  });
  logger.commands.success("mod ban", interaction.user.username, interaction.user.id, guildId);
}

async function handleTempban(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const target = interaction.options.getUser("user", true);
  const duration = interaction.options.getInteger("duration", true);
  const reason = interaction.options.getString("reason") ?? undefined;
  const expiresAt = new Date(Date.now() + duration * 60_000);

  await guild.members.ban(target.id, { reason });

  const caseNum = await nextCaseNumber(guildId);
  await db.insert(discordCases).values({
      guildId,
      caseNumber: caseNum,
      type: "TEMPBAN",
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
      duration,
      expiresAt,
    });

  const embed = modEmbed("User Temp-Banned", COLOR_BAN, [
    { name: "User", value: `${target.tag} (${target.id})`, inline: true },
    { name: "Moderator", value: interaction.user.tag, inline: true },
    { name: "Case", value: `#${caseNum}`, inline: true },
    { name: "Duration", value: `${duration} minutes`, inline: true },
    { name: "Reason", value: reason ?? "No reason provided" },
  ]);

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content: `**${target.tag}** has been temp-banned for ${duration}m. Case #${caseNum}`,
  });
  logger.commands.success("mod tempban", interaction.user.username, interaction.user.id, guildId);
}

async function handleKick(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? undefined;

  const member = await guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    await interaction.editReply({ content: "User not found in this server." });
    return;
  }

  await member.kick(reason);

  const caseNum = await nextCaseNumber(guildId);
  await db.insert(discordCases).values({
      guildId,
      caseNumber: caseNum,
      type: "KICK",
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
    });

  const embed = modEmbed("User Kicked", COLOR_KICK, [
    { name: "User", value: `${target.tag} (${target.id})`, inline: true },
    { name: "Moderator", value: interaction.user.tag, inline: true },
    { name: "Case", value: `#${caseNum}`, inline: true },
    { name: "Reason", value: reason ?? "No reason provided" },
  ]);

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content: `**${target.tag}** has been kicked. Case #${caseNum}`,
  });
  logger.commands.success("mod kick", interaction.user.username, interaction.user.id, guildId);
}

async function handleWarn(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason", true);

  const caseNum = await nextCaseNumber(guildId);
  await db.insert(discordCases).values({
      guildId,
      caseNumber: caseNum,
      type: "WARN",
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
    });

  const [{ value: activeWarningsValue }] = await db.select({ value: countFn() }).from(discordCases).where(and(eq(discordCases.guildId, guildId), eq(discordCases.targetId, target.id), eq(discordCases.type, "WARN"), eq(discordCases.resolved, false)));
  const activeWarnings = Number(activeWarningsValue);

  const embed = modEmbed("User Warned", COLOR_WARN, [
    { name: "User", value: `${target.tag} (${target.id})`, inline: true },
    { name: "Moderator", value: interaction.user.tag, inline: true },
    { name: "Case", value: `#${caseNum}`, inline: true },
    {
      name: "Active Warnings",
      value: `${activeWarnings}`,
      inline: true,
    },
    { name: "Reason", value: reason },
  ]);

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content: `**${target.tag}** has been warned (${activeWarnings} active). Case #${caseNum}`,
  });

  await checkEscalation(interaction, guildId, target.id, target.tag);

  logger.commands.success("mod warn", interaction.user.username, interaction.user.id, guildId);
}

async function handleMute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const target = interaction.options.getUser("user", true);
  const duration = interaction.options.getInteger("duration", true);
  const reason = interaction.options.getString("reason") ?? undefined;
  const expiresAt = new Date(Date.now() + duration * 60_000);

  const member = await guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    await interaction.editReply({ content: "User not found in this server." });
    return;
  }

  await member.timeout(duration * 60_000, reason);

  const caseNum = await nextCaseNumber(guildId);
  await db.insert(discordCases).values({
      guildId,
      caseNumber: caseNum,
      type: "MUTE",
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
      duration,
      expiresAt,
    });

  const embed = modEmbed("User Muted", COLOR_MUTE, [
    { name: "User", value: `${target.tag} (${target.id})`, inline: true },
    { name: "Moderator", value: interaction.user.tag, inline: true },
    { name: "Case", value: `#${caseNum}`, inline: true },
    { name: "Duration", value: `${duration} minutes`, inline: true },
    { name: "Reason", value: reason ?? "No reason provided" },
  ]);

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content: `**${target.tag}** has been muted for ${duration}m. Case #${caseNum}`,
  });
  logger.commands.success("mod mute", interaction.user.username, interaction.user.id, guildId);
}

async function handleUnban(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const targetId = interaction.options.getString("user-id", true);
  const reason = interaction.options.getString("reason") ?? undefined;

  const ban = await guild.bans.fetch(targetId).catch(() => null);
  if (!ban) {
    await interaction.editReply({ content: "This user is not banned." });
    return;
  }

  await guild.members.unban(targetId, reason);

  // Resolve any open ban/tempban cases for this user
  await db.update(discordCases).set({
      resolved: true,
      resolvedBy: interaction.user.id,
      resolvedAt: new Date(),
    }).where(and(eq(discordCases.guildId, guildId), eq(discordCases.targetId, targetId), inArray(discordCases.type, ["BAN", "TEMPBAN"]), eq(discordCases.resolved, false)));

  const caseNum = await nextCaseNumber(guildId);
  await db.insert(discordCases).values({
      guildId,
      caseNumber: caseNum,
      type: "UNBAN",
      targetId,
      targetTag: ban.user.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
    });

  const embed = modEmbed("User Unbanned", COLOR_RESOLVE, [
    { name: "User", value: `${ban.user.tag} (${targetId})`, inline: true },
    { name: "Moderator", value: interaction.user.tag, inline: true },
    { name: "Case", value: `#${caseNum}`, inline: true },
    { name: "Reason", value: reason ?? "No reason provided" },
  ]);

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content: `**${ban.user.tag}** has been unbanned. Case #${caseNum}`,
  });
  logger.commands.success("mod unban", interaction.user.username, interaction.user.id, guildId);
}

async function handleUnmute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;
  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? undefined;

  const member = await guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    await interaction.editReply({ content: "User not found in this server." });
    return;
  }

  await member.timeout(null, reason);

  await db.update(discordCases).set({
      resolved: true,
      resolvedBy: interaction.user.id,
      resolvedAt: new Date(),
    }).where(and(eq(discordCases.guildId, guildId), eq(discordCases.targetId, target.id), eq(discordCases.type, "MUTE"), eq(discordCases.resolved, false)));

  const caseNum = await nextCaseNumber(guildId);
  await db.insert(discordCases).values({
      guildId,
      caseNumber: caseNum,
      type: "UNMUTE",
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason,
    });

  const embed = modEmbed("User Unmuted", COLOR_RESOLVE, [
    { name: "User", value: `${target.tag} (${target.id})`, inline: true },
    { name: "Moderator", value: interaction.user.tag, inline: true },
    { name: "Case", value: `#${caseNum}`, inline: true },
    { name: "Reason", value: reason ?? "No reason provided" },
  ]);

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content: `**${target.tag}** has been unmuted. Case #${caseNum}`,
  });
  logger.commands.success("mod unmute", interaction.user.username, interaction.user.id, guildId);
}

async function handleUnwarn(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guildId = interaction.guildId!;
  const target = interaction.options.getUser("user", true);
  const reason = interaction.options.getString("reason") ?? undefined;

  const latestWarning = await db.query.discordCases.findFirst({
    where: and(eq(discordCases.guildId, guildId), eq(discordCases.targetId, target.id), eq(discordCases.type, "WARN"), eq(discordCases.resolved, false)),
    orderBy: desc(discordCases.createdAt),
  });

  if (!latestWarning) {
    await interaction.editReply({
      content: `**${target.tag}** has no active warnings.`,
    });
    return;
  }

  await db.update(discordCases).set({
      resolved: true,
      resolvedBy: interaction.user.id,
      resolvedAt: new Date(),
    }).where(eq(discordCases.id, latestWarning.id));

  const caseNum = await nextCaseNumber(guildId);
  await db.insert(discordCases).values({
      guildId,
      caseNumber: caseNum,
      type: "UNWARN",
      targetId: target.id,
      targetTag: target.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason: reason ?? `Resolved warning case #${latestWarning.caseNumber}`,
    });

  const [{ value: remainingValue }] = await db.select({ value: countFn() }).from(discordCases).where(and(eq(discordCases.guildId, guildId), eq(discordCases.targetId, target.id), eq(discordCases.type, "WARN"), eq(discordCases.resolved, false)));
  const remaining = Number(remainingValue);

  const embed = modEmbed("Warning Removed", COLOR_RESOLVE, [
    { name: "User", value: `${target.tag} (${target.id})`, inline: true },
    { name: "Moderator", value: interaction.user.tag, inline: true },
    { name: "Case", value: `#${caseNum}`, inline: true },
    { name: "Resolved Warning", value: `Case #${latestWarning.caseNumber}`, inline: true },
    { name: "Remaining Warnings", value: `${remaining}`, inline: true },
    { name: "Reason", value: reason ?? "No reason provided" },
  ]);

  dispatchLog(interaction.client, guildId, "moderation", embed);

  await interaction.editReply({
    content: `Removed latest warning from **${target.tag}** (case #${latestWarning.caseNumber}). ${remaining} active warnings remaining. Case #${caseNum}`,
  });
  logger.commands.success("mod unwarn", interaction.user.username, interaction.user.id, guildId);
}
