import type { AutocompleteInteraction } from "discord.js";
import { db, eq, and, ilike, asc, discordMessageTemplates, discordScheduledMessages, discordRolePanels, discordCustomCommands } from "@community-bot/db";
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
      const templates = await db.select({ name: discordMessageTemplates.name }).from(discordMessageTemplates).where(and(eq(discordMessageTemplates.guildId, guildId), ilike(discordMessageTemplates.name, `%${query}%`))).orderBy(asc(discordMessageTemplates.name)).limit(25);

      await interaction.respond(
        templates.map((t) => ({ name: t.name, value: t.name }))
      );
      return;
    }

    if (commandName === "schedule" && focused.name === "name") {
      const schedules = await db.select({ name: discordScheduledMessages.name }).from(discordScheduledMessages).where(and(eq(discordScheduledMessages.guildId, guildId), ilike(discordScheduledMessages.name, `%${query}%`))).orderBy(asc(discordScheduledMessages.name)).limit(25);

      await interaction.respond(
        schedules.map((s) => ({ name: s.name, value: s.name }))
      );
      return;
    }

    if (
      commandName === "roles" &&
      (focused.name === "panel" || focused.name === "name")
    ) {
      const panels = await db.select({ name: discordRolePanels.name }).from(discordRolePanels).where(and(eq(discordRolePanels.guildId, guildId), ilike(discordRolePanels.name, `%${query}%`))).orderBy(asc(discordRolePanels.name)).limit(25);

      await interaction.respond(
        panels.map((p) => ({ name: p.name, value: p.name }))
      );
      return;
    }

    if (commandName === "cc" && focused.name === "name") {
      const cmds = await db.select({ name: discordCustomCommands.name }).from(discordCustomCommands).where(and(eq(discordCustomCommands.guildId, guildId), ilike(discordCustomCommands.name, `%${query}%`))).orderBy(asc(discordCustomCommands.name)).limit(25);

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
