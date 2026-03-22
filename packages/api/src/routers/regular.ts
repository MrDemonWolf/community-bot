import { db, eq, desc, not, isNull, regulars } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getTwitchUserByLogin, getTwitchUserById } from "../utils/twitch";
import { applyMutationEffects } from "../utils/mutation";
import { idInput } from "../schemas/common";

export const regularRouter = router({
  list: protectedProcedure.query(async () => {
    const regularList = await db.query.regulars.findMany({
      orderBy: desc(regulars.createdAt),
    });
    return regularList;
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
      const existing = await db.query.regulars.findFirst({
        where: eq(regulars.twitchUserId, twitchUser.id),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${twitchUser.display_name}" is already a regular.`,
        });
      }

      // Check Discord ID uniqueness if provided
      if (input.discordUserId) {
        const discordExisting = await db.query.regulars.findFirst({
          where: eq(regulars.discordUserId, input.discordUserId),
        });
        if (discordExisting) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Discord user "${input.discordUserId}" is already linked to a regular.`,
          });
        }
      }

      const [regular] = await db.insert(regulars).values({
        twitchUserId: twitchUser.id,
        twitchUsername: twitchUser.display_name,
        discordUserId: input.discordUserId ?? null,
        discordUsername: input.discordUsername ?? null,
        addedBy: ctx.session.user.name,
      }).returning();

      await applyMutationEffects(ctx, {
        event: { name: "regular:created", payload: { twitchUserId: twitchUser.id, discordUserId: input.discordUserId } },
        audit: { action: "regular.add", resourceType: "Regular", resourceId: regular!.id, metadata: { twitchUsername: twitchUser.display_name, discordUserId: input.discordUserId } },
      });

      return regular!;
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
      const regular = await db.query.regulars.findFirst({
        where: eq(regulars.id, input.id),
      });

      if (!regular) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Regular not found.",
        });
      }

      // Check Discord ID uniqueness
      const discordExisting = await db.query.regulars.findFirst({
        where: eq(regulars.discordUserId, input.discordUserId),
      });
      if (discordExisting && discordExisting.id !== input.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Discord user "${input.discordUserId}" is already linked to another regular.`,
        });
      }

      const [updated] = await db.update(regulars).set({
        discordUserId: input.discordUserId,
        discordUsername: input.discordUsername ?? null,
      }).where(eq(regulars.id, input.id)).returning();

      await applyMutationEffects(ctx, {
        audit: { action: "regular.link-discord", resourceType: "Regular", resourceId: input.id, metadata: { discordUserId: input.discordUserId, twitchUsername: regular.twitchUsername } },
      });

      return updated;
    }),

  remove: moderatorProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      const regular = await db.query.regulars.findFirst({
        where: eq(regulars.id, input.id),
      });

      if (!regular) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Regular not found.",
        });
      }

      await db.delete(regulars).where(eq(regulars.id, input.id));

      await applyMutationEffects(ctx, {
        event: { name: "regular:deleted", payload: { twitchUserId: regular.twitchUserId ?? undefined, discordUserId: regular.discordUserId ?? undefined } },
        audit: { action: "regular.remove", resourceType: "Regular", resourceId: input.id, metadata: { twitchUsername: regular.twitchUsername } },
      });

      return { success: true };
    }),

  refreshUsernames: protectedProcedure.mutation(async () => {
    const regularList = await db.query.regulars.findMany({
      where: not(isNull(regulars.twitchUserId)),
    });
    let updated = 0;

    for (const regular of regularList) {
      if (!regular.twitchUserId) continue;
      const twitchUser = await getTwitchUserById(regular.twitchUserId);
      if (twitchUser && twitchUser.display_name !== regular.twitchUsername) {
        await db.update(regulars).set({ twitchUsername: twitchUser.display_name }).where(eq(regulars.id, regular.id));
        updated++;
      }
    }

    return { updated, total: regularList.length };
  }),
});
