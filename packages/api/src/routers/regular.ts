import { prisma } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getTwitchUserByLogin, getTwitchUserById } from "../utils/twitch";
import { logAudit } from "../utils/audit";

export const regularRouter = router({
  list: protectedProcedure.query(async () => {
    const regulars = await prisma.twitchRegular.findMany({
      orderBy: { createdAt: "desc" },
    });
    return regulars;
  }),

  add: moderatorProcedure
    .input(z.object({ username: z.string().min(1).max(50) }))
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
      const existing = await prisma.twitchRegular.findUnique({
        where: { twitchUserId: twitchUser.id },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${twitchUser.display_name}" is already a regular.`,
        });
      }

      const regular = await prisma.twitchRegular.create({
        data: {
          twitchUserId: twitchUser.id,
          twitchUsername: twitchUser.display_name,
          addedBy: ctx.session.user.name,
        },
      });

      const { eventBus } = await import("../events");
      await eventBus.publish("regular:created", {
        twitchUserId: twitchUser.id,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "regular.add",
        resourceType: "TwitchRegular",
        resourceId: regular.id,
        metadata: { twitchUsername: twitchUser.display_name },
      });

      return regular;
    }),

  remove: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const regular = await prisma.twitchRegular.findUnique({
        where: { id: input.id },
      });

      if (!regular) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Regular not found.",
        });
      }

      await prisma.twitchRegular.delete({ where: { id: input.id } });

      const { eventBus } = await import("../events");
      await eventBus.publish("regular:deleted", {
        twitchUserId: regular.twitchUserId,
      });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "regular.remove",
        resourceType: "TwitchRegular",
        resourceId: input.id,
        metadata: { twitchUsername: regular.twitchUsername },
      });

      return { success: true };
    }),

  refreshUsernames: protectedProcedure.mutation(async () => {
    const regulars = await prisma.twitchRegular.findMany();
    let updated = 0;

    for (const regular of regulars) {
      const twitchUser = await getTwitchUserById(regular.twitchUserId);
      if (twitchUser && twitchUser.display_name !== regular.twitchUsername) {
        await prisma.twitchRegular.update({
          where: { id: regular.id },
          data: { twitchUsername: twitchUser.display_name },
        });
        updated++;
      }
    }

    return { updated, total: regulars.length };
  }),
});
