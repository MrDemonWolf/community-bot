import { db, eq, and, asc, discordGuilds, discordMessageTemplates } from "@community-bot/db";
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

export const discordTemplatesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const guild = await requireGuild(ctx.session.user.id);

    return db.query.discordMessageTemplates.findMany({
      where: eq(discordMessageTemplates.guildId, guild.guildId),
      orderBy: asc(discordMessageTemplates.name),
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const template = await db.query.discordMessageTemplates.findFirst({
        where: and(eq(discordMessageTemplates.id, input.id), eq(discordMessageTemplates.guildId, guild.guildId)),
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

      if (input.embedJson !== undefined && input.embedJson.trim() !== "") {
        try {
          JSON.parse(input.embedJson);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid embed JSON.",
          });
        }
      }

      const existing = await db.query.discordMessageTemplates.findFirst({
        where: and(eq(discordMessageTemplates.guildId, guild.guildId), eq(discordMessageTemplates.name, name)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Template "${name}" already exists.`,
        });
      }

      const [template] = await db.insert(discordMessageTemplates).values({
        guildId: guild.guildId,
        name,
        content: input.content,
        embedJson: input.embedJson,
        createdBy: ctx.session.user.id,
      }).returning();

      await applyMutationEffects(ctx, {
        audit: { action: "discord.template.create", resourceType: "DiscordMessageTemplate", resourceId: template!.id, metadata: { name } },
      });

      return template!;
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

      const template = await db.query.discordMessageTemplates.findFirst({
        where: and(eq(discordMessageTemplates.id, input.id), eq(discordMessageTemplates.guildId, guild.guildId)),
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found.",
        });
      }

      if (input.embedJson !== undefined && input.embedJson.trim() !== "") {
        try {
          JSON.parse(input.embedJson);
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid embed JSON.",
          });
        }
      }

      const [updated] = await db.update(discordMessageTemplates).set({
        ...(input.content !== undefined && { content: input.content }),
        ...(input.embedJson !== undefined && { embedJson: input.embedJson }),
      }).where(eq(discordMessageTemplates.id, input.id)).returning();

      await applyMutationEffects(ctx, {
        audit: { action: "discord.template.update", resourceType: "DiscordMessageTemplate", resourceId: input.id, metadata: { name: template.name } },
      });

      return updated;
    }),

  delete: leadModProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const guild = await requireGuild(ctx.session.user.id);

      const template = await db.query.discordMessageTemplates.findFirst({
        where: and(eq(discordMessageTemplates.id, input.id), eq(discordMessageTemplates.guildId, guild.guildId)),
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found.",
        });
      }

      await db.delete(discordMessageTemplates).where(eq(discordMessageTemplates.id, input.id));

      await applyMutationEffects(ctx, {
        audit: { action: "discord.template.delete", resourceType: "DiscordMessageTemplate", resourceId: input.id, metadata: { name: template.name } },
      });

      return { success: true };
    }),
});
