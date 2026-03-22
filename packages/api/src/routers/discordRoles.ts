import { db, eq, and, asc, discordGuilds, discordRolePanels, discordRoleButtons } from "@community-bot/db";
import { leadModProcedure, protectedProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { applyMutationEffects } from "../utils/mutation";

async function requireGuild(userId: string) {
  const guild = await db.query.discordGuilds.findFirst({
    where: eq(discordGuilds.userId, userId),
  });

  if (!guild) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No Discord guild linked to your account.",
    });
  }

  return guild;
}

export const discordRolesRouter = router({
  listPanels: protectedProcedure.query(async ({ ctx }) => {
    const guild = await requireGuild(ctx.session.user.id);

    return db.query.discordRolePanels.findMany({
      where: eq(discordRolePanels.guildId, guild.guildId),
      with: { buttons: true },
      orderBy: asc(discordRolePanels.name),
    });
  }),

  getPanel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const panel = await db.query.discordRolePanels.findFirst({
        where: and(eq(discordRolePanels.id, input.id), eq(discordRolePanels.guildId, guild.guildId)),
        with: { buttons: true },
      });

      if (!panel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      // Sort buttons by position
      panel.buttons.sort((a, b) => a.position - b.position);

      return panel;
    }),

  createPanel: leadModProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Name must be alphanumeric, underscore, or hyphen"
          ),
        title: z.string().max(256).optional(),
        description: z.string().max(4096).optional(),
        useMenu: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);
      const name = input.name.toLowerCase();

      const existing = await db.query.discordRolePanels.findFirst({
        where: and(eq(discordRolePanels.guildId, guild.guildId), eq(discordRolePanels.name, name)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Panel "${name}" already exists.`,
        });
      }

      const [panel] = await db.insert(discordRolePanels).values({
        guildId: guild.guildId,
        name,
        title: input.title ?? "Role Selection",
        description:
          input.description ??
          "Click a button or select an option to toggle a role.",
        useMenu: input.useMenu,
        createdBy: ctx.session.user.id,
      }).returning();

      await applyMutationEffects(ctx, {
        audit: { action: "discord.role-panel.create", resourceType: "DiscordRolePanel", resourceId: panel!.id, metadata: { name, useMenu: input.useMenu } },
      });

      // Return panel with empty buttons array for consistency
      return { ...panel!, buttons: [] };
    }),

  updatePanel: leadModProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().max(256).optional(),
        description: z.string().max(4096).optional(),
        useMenu: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const panel = await db.query.discordRolePanels.findFirst({
        where: and(eq(discordRolePanels.id, input.id), eq(discordRolePanels.guildId, guild.guildId)),
      });

      if (!panel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      const [updated] = await db.update(discordRolePanels).set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.useMenu !== undefined && { useMenu: input.useMenu }),
      }).where(eq(discordRolePanels.id, input.id)).returning();

      const buttons = await db.query.discordRoleButtons.findMany({
        where: eq(discordRoleButtons.panelId, input.id),
        orderBy: asc(discordRoleButtons.position),
      });

      await applyMutationEffects(ctx, {
        audit: { action: "discord.role-panel.update", resourceType: "DiscordRolePanel", resourceId: input.id, metadata: { name: panel.name } },
      });

      return { ...updated, buttons };
    }),

  deletePanel: leadModProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const panel = await db.query.discordRolePanels.findFirst({
        where: and(eq(discordRolePanels.id, input.id), eq(discordRolePanels.guildId, guild.guildId)),
      });

      if (!panel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      await db.delete(discordRolePanels).where(eq(discordRolePanels.id, input.id));

      await applyMutationEffects(ctx, {
        audit: { action: "discord.role-panel.delete", resourceType: "DiscordRolePanel", resourceId: input.id, metadata: { name: panel.name } },
      });

      return { success: true };
    }),

  addButton: leadModProcedure
    .input(
      z.object({
        panelId: z.string(),
        roleId: z.string(),
        label: z.string().min(1).max(80),
        emoji: z.string().max(32).optional(),
        style: z.number().int().min(1).max(4).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const panel = await db.query.discordRolePanels.findFirst({
        where: and(eq(discordRolePanels.id, input.panelId), eq(discordRolePanels.guildId, guild.guildId)),
        with: { buttons: true },
      });

      if (!panel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      if (panel.buttons.length >= 25) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A panel can have at most 25 roles.",
        });
      }

      const existing = panel.buttons.find((b) => b.roleId === input.roleId);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This role is already on the panel.",
        });
      }

      const [button] = await db.insert(discordRoleButtons).values({
        panelId: input.panelId,
        roleId: input.roleId,
        label: input.label,
        emoji: input.emoji,
        style: input.style,
        position: panel.buttons.length,
      }).returning();

      await applyMutationEffects(ctx, {
        audit: { action: "discord.role-button.add", resourceType: "DiscordRoleButton", resourceId: button!.id, metadata: { panelName: panel.name, roleId: input.roleId } },
      });

      return button;
    }),

  removeButton: leadModProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const button = await db.query.discordRoleButtons.findFirst({
        where: eq(discordRoleButtons.id, input.id),
        with: { panel: true },
      });

      if (!button || button.panel.guildId !== guild.guildId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Button not found.",
        });
      }

      await db.delete(discordRoleButtons).where(eq(discordRoleButtons.id, input.id));

      await applyMutationEffects(ctx, {
        audit: { action: "discord.role-button.remove", resourceType: "DiscordRoleButton", resourceId: input.id, metadata: { panelName: button.panel.name, roleId: button.roleId } },
      });

      return { success: true };
    }),

  reorderButtons: leadModProcedure
    .input(
      z.object({
        panelId: z.string(),
        buttonIds: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const panel = await db.query.discordRolePanels.findFirst({
        where: and(eq(discordRolePanels.id, input.panelId), eq(discordRolePanels.guildId, guild.guildId)),
      });

      if (!panel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      await Promise.all(
        input.buttonIds.map((id, index) =>
          db.update(discordRoleButtons).set({ position: index }).where(eq(discordRoleButtons.id, id))
        )
      );

      await applyMutationEffects(ctx, {
        audit: { action: "discord.role-panel.reorder", resourceType: "DiscordRolePanel", resourceId: input.panelId, metadata: { name: panel.name } },
      });

      return { success: true };
    }),
});
