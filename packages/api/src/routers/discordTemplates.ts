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

export const discordTemplatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const guild = await requireGuild(ctx.session.user.id);

    return prisma.discordMessageTemplate.findMany({
      where: { guildId: guild.guildId },
      orderBy: { name: "asc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const template = await prisma.discordMessageTemplate.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found.",
        });
      }

      return template;
    }),

  create: leadModProcedure
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
        content: z.string().max(2000).optional(),
        embedJson: z.string().max(4000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);
      const name = input.name.toLowerCase();

      if (!input.content && !input.embedJson) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provide either content or embed JSON.",
        });
      }

      if (input.embedJson) {
        try {
          JSON.parse(input.embedJson);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid embed JSON.",
          });
        }
      }

      const existing = await prisma.discordMessageTemplate.findUnique({
        where: { guildId_name: { guildId: guild.guildId, name } },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Template "${name}" already exists.`,
        });
      }

      const template = await prisma.discordMessageTemplate.create({
        data: {
          guildId: guild.guildId,
          name,
          content: input.content,
          embedJson: input.embedJson,
          createdBy: ctx.session.user.id,
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.template.create",
        resourceType: "DiscordMessageTemplate",
        resourceId: template.id,
        metadata: { name },
      });

      return template;
    }),

  update: leadModProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().max(2000).optional(),
        embedJson: z.string().max(4000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const template = await prisma.discordMessageTemplate.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found.",
        });
      }

      if (input.embedJson) {
        try {
          JSON.parse(input.embedJson);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid embed JSON.",
          });
        }
      }

      const updated = await prisma.discordMessageTemplate.update({
        where: { id: input.id },
        data: {
          ...(input.content !== undefined && { content: input.content }),
          ...(input.embedJson !== undefined && { embedJson: input.embedJson }),
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.template.update",
        resourceType: "DiscordMessageTemplate",
        resourceId: input.id,
        metadata: { name: template.name },
      });

      return updated;
    }),

  delete: leadModProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const template = await prisma.discordMessageTemplate.findFirst({
        where: { id: input.id, guildId: guild.guildId },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found.",
        });
      }

      await prisma.discordMessageTemplate.delete({
        where: { id: input.id },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "discord.template.delete",
        resourceType: "DiscordMessageTemplate",
        resourceId: input.id,
        metadata: { name: template.name },
      });

      return { success: true };
    }),
});
