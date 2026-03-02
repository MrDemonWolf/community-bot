import { prisma } from "@community-bot/db";
import { leadModProcedure, protectedProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";

async function requireGuild(userId: string) {
  const guild = await prisma.discordGuild.findFirst({
    where: { userId },
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

    return prisma.discordRolePanel.findMany({
      where: { guildId: guild.guildId },
      include: { buttons: { orderBy: { position: "asc" } } },
      orderBy: { name: "asc" },
    });
  }),

  getPanel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const panel = await prisma.discordRolePanel.findFirst({
        where: { id: input.id, guildId: guild.guildId },
        include: { buttons: { orderBy: { position: "asc" } } },
      });

      if (!panel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

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

      const existing = await prisma.discordRolePanel.findUnique({
        where: { guildId_name: { guildId: guild.guildId, name } },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Panel "${name}" already exists.`,
        });
      }

      const panel = await prisma.discordRolePanel.create({
        data: {
          guildId: guild.guildId,
          name,
          title: input.title ?? "Role Selection",
          description:
            input.description ??
            "Click a button or select an option to toggle a role.",
          useMenu: input.useMenu,
          createdBy: ctx.session.user.id,
        },
        include: { buttons: true },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.role-panel.create",
        resourceType: "DiscordRolePanel",
        resourceId: panel.id,
        metadata: { name, useMenu: input.useMenu },
      });

      return panel;
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

      const panel = await prisma.discordRolePanel.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!panel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      const updated = await prisma.discordRolePanel.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.useMenu !== undefined && { useMenu: input.useMenu }),
        },
        include: { buttons: { orderBy: { position: "asc" } } },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.role-panel.update",
        resourceType: "DiscordRolePanel",
        resourceId: input.id,
        metadata: { name: panel.name },
      });

      return updated;
    }),

  deletePanel: leadModProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const panel = await prisma.discordRolePanel.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!panel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      await prisma.discordRolePanel.delete({
        where: { id: input.id },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.role-panel.delete",
        resourceType: "DiscordRolePanel",
        resourceId: input.id,
        metadata: { name: panel.name },
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

      const panel = await prisma.discordRolePanel.findFirst({
        where: { id: input.panelId, guildId: guild.guildId },
        include: { buttons: true },
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

      const button = await prisma.discordRoleButton.create({
        data: {
          panelId: input.panelId,
          roleId: input.roleId,
          label: input.label,
          emoji: input.emoji,
          style: input.style,
          position: panel.buttons.length,
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.role-button.add",
        resourceType: "DiscordRoleButton",
        resourceId: button.id,
        metadata: { panelName: panel.name, roleId: input.roleId },
      });

      return button;
    }),

  removeButton: leadModProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const button = await prisma.discordRoleButton.findFirst({
        where: { id: input.id },
        include: { panel: true },
      });

      if (!button || button.panel.guildId !== guild.guildId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Button not found.",
        });
      }

      await prisma.discordRoleButton.delete({
        where: { id: input.id },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.role-button.remove",
        resourceType: "DiscordRoleButton",
        resourceId: input.id,
        metadata: { panelName: button.panel.name, roleId: button.roleId },
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

      const panel = await prisma.discordRolePanel.findFirst({
        where: { id: input.panelId, guildId: guild.guildId },
      });

      if (!panel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Panel not found.",
        });
      }

      await Promise.all(
        input.buttonIds.map((id, index) =>
          prisma.discordRoleButton.update({
            where: { id },
            data: { position: index },
          })
        )
      );

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.role-panel.reorder",
        resourceType: "DiscordRolePanel",
        resourceId: input.panelId,
        metadata: { name: panel.name },
      });

      return { success: true };
    }),
});
