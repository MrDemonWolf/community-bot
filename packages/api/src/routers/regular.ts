import { prisma } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getTwitchUserByLogin, getTwitchUserById } from "../utils/twitch";
import { logAudit } from "../utils/audit";

export const regularRouter = router({
  list: protectedProcedure.query(async () => {
    const regulars = await prisma.regular.findMany({
      orderBy: { createdAt: "desc" },
    });
    return regulars;
  }),

  add: moderatorProcedure
    .input(
      z.object({
        username: z.string().min(1).max(50),
        discordUserId: z.string().min(1).max(30).optional(),
        discordUsername: z.string().min(1).max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const username = input.username.toLowerCase().trim();

      // Look up user on Twitch
      const twitchUser = await getTwitchUserByLogin(username);
      if (!twitchUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Twitch user "${username}" not found.`,
        });
      }

      // Check if already a regular
      const existing = await prisma.regular.findUnique({
        where: { twitchUserId: twitchUser.id },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${twitchUser.display_name}" is already a regular.`,
        });
      }

      // Check Discord ID uniqueness if provided
      if (input.discordUserId) {
        const discordExisting = await prisma.regular.findUnique({
          where: { discordUserId: input.discordUserId },
        });
        if (discordExisting) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Discord user "${input.discordUserId}" is already linked to a regular.`,
          });
        }
      }

      const regular = await prisma.regular.create({
        data: {
          twitchUserId: twitchUser.id,
          twitchUsername: twitchUser.display_name,
          discordUserId: input.discordUserId ?? null,
          discordUsername: input.discordUsername ?? null,
          addedBy: ctx.session.user.name,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("regular:created", {
        twitchUserId: twitchUser.id,
        discordUserId: input.discordUserId,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "regular.add",
        resourceType: "Regular",
        resourceId: regular.id,
        metadata: {
          twitchUsername: twitchUser.display_name,
          discordUserId: input.discordUserId,
        },
      });

      return regular;
    }),

  linkDiscord: moderatorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        discordUserId: z.string().min(1).max(30),
        discordUsername: z.string().min(1).max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const regular = await prisma.regular.findUnique({
        where: { id: input.id },
      });

      if (!regular) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Regular not found.",
        });
      }

      // Check Discord ID uniqueness
      const discordExisting = await prisma.regular.findUnique({
        where: { discordUserId: input.discordUserId },
      });
      if (discordExisting && discordExisting.id !== input.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Discord user "${input.discordUserId}" is already linked to another regular.`,
        });
      }

      const updated = await prisma.regular.update({
        where: { id: input.id },
        data: {
          discordUserId: input.discordUserId,
          discordUsername: input.discordUsername ?? null,
        },
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "regular.link-discord",
        resourceType: "Regular",
        resourceId: input.id,
        metadata: {
          discordUserId: input.discordUserId,
          twitchUsername: regular.twitchUsername,
        },
      });

      return updated;
    }),

  remove: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const regular = await prisma.regular.findUnique({
        where: { id: input.id },
      });

      if (!regular) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Regular not found.",
        });
      }

      await prisma.regular.delete({ where: { id: input.id } });

      const { eventBus } = await import("../events");
      await eventBus.publish("regular:deleted", {
        twitchUserId: regular.twitchUserId ?? undefined,
        discordUserId: regular.discordUserId ?? undefined,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "regular.remove",
        resourceType: "Regular",
        resourceId: input.id,
        metadata: { twitchUsername: regular.twitchUsername },
      });

      return { success: true };
    }),

  refreshUsernames: protectedProcedure.mutation(async () => {
    const regulars = await prisma.regular.findMany({
      where: { twitchUserId: { not: null } },
    });
    let updated = 0;

    for (const regular of regulars) {
      if (!regular.twitchUserId) continue;
      const twitchUser = await getTwitchUserById(regular.twitchUserId);
      if (twitchUser && twitchUser.display_name !== regular.twitchUsername) {
        await prisma.regular.update({
          where: { id: regular.id },
          data: { twitchUsername: twitchUser.display_name },
        });
        updated++;
      }
    }

    return { updated, total: regulars.length };
  }),
});
