import type { AutocompleteInteraction } from "discord.js";
import { prisma } from "@community-bot/db";
import logger from "../utils/logger.js";

export async function autocompleteEvent(
  interaction: AutocompleteInteraction
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const focused = interaction.options.getFocused(true);
  const commandName = interaction.commandName;
  const query = focused.value.toLowerCase();

  try {
    if (
      commandName === "template" ||
      (commandName === "schedule" && focused.name === "template")
    ) {
      const templates = await prisma.discordMessageTemplate.findMany({
        where: {
          guildId,
          name: { contains: query, mode: "insensitive" },
        },
        take: 25,
        select: { name: true },
        orderBy: { name: "asc" },
      });

      await interaction.respond(
        templates.map((t) => ({ name: t.name, value: t.name }))
      );
      return;
    }

    if (commandName === "schedule" && focused.name === "name") {
      const schedules = await prisma.discordScheduledMessage.findMany({
        where: {
          guildId,
          name: { contains: query, mode: "insensitive" },
        },
        take: 25,
        select: { name: true },
        orderBy: { name: "asc" },
      });

      await interaction.respond(
        schedules.map((s) => ({ name: s.name, value: s.name }))
      );
      return;
    }

    if (
      commandName === "roles" &&
      (focused.name === "panel" || focused.name === "name")
    ) {
      const panels = await prisma.discordRolePanel.findMany({
        where: {
          guildId,
          name: { contains: query, mode: "insensitive" },
        },
        take: 25,
        select: { name: true },
        orderBy: { name: "asc" },
      });

      await interaction.respond(
        panels.map((p) => ({ name: p.name, value: p.name }))
      );
      return;
    }

    if (commandName === "cc" && focused.name === "name") {
      const cmds = await prisma.discordCustomCommand.findMany({
        where: {
          guildId,
          name: { contains: query, mode: "insensitive" },
        },
        take: 25,
        select: { name: true },
        orderBy: { name: "asc" },
      });

      await interaction.respond(
        cmds.map((c) => ({ name: c.name, value: c.name }))
      );
      return;
    }

    await interaction.respond([]);
  } catch (error) {
    logger.error("Autocomplete", "Failed to handle autocomplete", error);
    await interaction.respond([]);
  }
}
