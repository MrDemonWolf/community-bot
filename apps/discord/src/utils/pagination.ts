import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

export interface PaginationOptions {
  interaction: ChatInputCommandInteraction;
  pages: EmbedBuilder[];
  /** Timeout in milliseconds (default 120_000 = 2 minutes) */
  timeout?: number;
}

/**
 * Send a paginated embed with prev/next buttons.
 * The caller must `deferReply()` before calling this function.
 * For ephemeral pagination, defer with `{ flags: MessageFlags.Ephemeral }`.
 * Disables buttons on timeout or when only one page.
 */
export async function sendPaginatedEmbed({
  interaction,
  pages,
  timeout = 120_000,
}: PaginationOptions): Promise<void> {
  if (pages.length === 0) {
    await interaction.editReply({ content: "No results to display." });
    return;
  }

  let currentPage = 0;

  const buildRow = (disabled = false) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("pagination:prev")
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || currentPage === 0),
      new ButtonBuilder()
        .setCustomId("pagination:page")
        .setLabel(`${currentPage + 1} / ${pages.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("pagination:next")
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || currentPage === pages.length - 1)
    );

  const message = await interaction.editReply({
    embeds: [pages[currentPage]],
    components: pages.length > 1 ? [buildRow()] : [],
  });

  if (pages.length <= 1) return;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === interaction.user.id,
    time: timeout,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "pagination:prev" && currentPage > 0) {
      currentPage--;
    } else if (
      i.customId === "pagination:next" &&
      currentPage < pages.length - 1
    ) {
      currentPage++;
    }

    await i.update({
      embeds: [pages[currentPage]],
      components: [buildRow()],
    });
  });

  collector.on("end", async () => {
    await interaction
      .editReply({ components: [buildRow(true)] })
      .catch(() => {});
  });
}
