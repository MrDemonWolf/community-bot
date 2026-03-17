import { db, eq, and, asc, keywords } from "@community-bot/db";
import { protectedProcedure, moderatorProcedure, router } from "../index";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logAudit } from "../utils/audit";
import { getUserBotChannel } from "../utils/botChannel";

const phraseGroupsSchema = z
  .array(z.array(z.string().min(1).max(300)).min(1).max(20))
  .min(1)
  .max(10);

const accessLevelEnum = z.enum([
  "EVERYONE",
  "SUBSCRIBER",
  "REGULAR",
  "VIP",
  "MODERATOR",
  "LEAD_MODERATOR",
  "BROADCASTER",
]);

const responseTypeEnum = z.enum(["SAY", "MENTION", "REPLY"]);
const streamStatusEnum = z.enum(["ONLINE", "OFFLINE", "BOTH"]);

export const keywordRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const botChannel = await getUserBotChannel(ctx.session.user.id);

    return db.query.keywords.findMany({
      where: eq(keywords.botChannelId, botChannel.id),
      orderBy: (kw, { desc, asc }) => [desc(kw.priority), asc(kw.name)],
    });
  }),

  create: moderatorProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric, underscore, or hyphen"),
        phraseGroups: phraseGroupsSchema,
        response: z.string().min(1).max(500),
        responseType: responseTypeEnum.default("SAY"),
        accessLevel: accessLevelEnum.default("EVERYONE"),
        globalCooldown: z.number().int().min(0).max(86400).default(0),
        userCooldown: z.number().int().min(0).max(86400).default(0),
        streamStatus: streamStatusEnum.default("BOTH"),
        priority: z.number().int().min(0).max(1000).default(0),
        stopProcessing: z.boolean().default(false),
        caseSensitive: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);
      const name = input.name.toLowerCase();

      const existing = await db.query.keywords.findFirst({
        where: and(eq(keywords.name, name), eq(keywords.botChannelId, botChannel.id)),
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Keyword "${name}" already exists.`,
        });
      }

      const [keyword] = await db
        .insert(keywords)
        .values({
          name,
          phraseGroups: input.phraseGroups,
          response: input.response,
          responseType: input.responseType,
          accessLevel: input.accessLevel,
          globalCooldown: input.globalCooldown,
          userCooldown: input.userCooldown,
          streamStatus: input.streamStatus,
          priority: input.priority,
          stopProcessing: input.stopProcessing,
          caseSensitive: input.caseSensitive,
          botChannelId: botChannel.id,
        })
        .returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("keyword:created", { keywordId: keyword!.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "keyword.create",
        resourceType: "Keyword",
        resourceId: keyword!.id,
        metadata: { name },
      });

      return keyword!;
    }),

  update: moderatorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .optional(),
        phraseGroups: phraseGroupsSchema.optional(),
        response: z.string().min(1).max(500).optional(),
        responseType: responseTypeEnum.optional(),
        accessLevel: accessLevelEnum.optional(),
        globalCooldown: z.number().int().min(0).max(86400).optional(),
        userCooldown: z.number().int().min(0).max(86400).optional(),
        streamStatus: streamStatusEnum.optional(),
        priority: z.number().int().min(0).max(1000).optional(),
        stopProcessing: z.boolean().optional(),
        caseSensitive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const keyword = await db.query.keywords.findFirst({
        where: eq(keywords.id, input.id),
      });

      if (!keyword || keyword.botChannelId !== botChannel.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Keyword not found." });
      }

      const { id, name, ...rest } = input;

      const [updated] = await db
        .update(keywords)
        .set({ ...rest, ...(name !== undefined ? { name: name.toLowerCase() } : {}) })
        .where(eq(keywords.id, id))
        .returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("keyword:updated", { keywordId: id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "keyword.update",
        resourceType: "Keyword",
        resourceId: id,
        metadata: { name: updated!.name },
      });

      return updated!;
    }),

  delete: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const keyword = await db.query.keywords.findFirst({
        where: eq(keywords.id, input.id),
      });

      if (!keyword || keyword.botChannelId !== botChannel.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Keyword not found." });
      }

      await db.delete(keywords).where(eq(keywords.id, input.id));

      const { eventBus } = await import("../events");
      await eventBus.publish("keyword:deleted", { keywordId: input.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "keyword.delete",
        resourceType: "Keyword",
        resourceId: input.id,
        metadata: { name: keyword.name },
      });

      return { success: true };
    }),

  toggleEnabled: moderatorProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      const keyword = await db.query.keywords.findFirst({
        where: eq(keywords.id, input.id),
      });

      if (!keyword || keyword.botChannelId !== botChannel.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Keyword not found." });
      }

      const [updated] = await db
        .update(keywords)
        .set({ enabled: !keyword.enabled })
        .where(eq(keywords.id, input.id))
        .returning();

      const { eventBus } = await import("../events");
      await eventBus.publish("keyword:updated", { keywordId: input.id });

      await logAudit({
        userId: ctx.session.user.id,
        userName: ctx.session.user.name,
        userImage: ctx.session.user.image,
        action: "keyword.toggle",
        resourceType: "Keyword",
        resourceId: input.id,
        metadata: { name: keyword.name, enabled: updated!.enabled },
      });

      return updated!;
    }),

  reorder: moderatorProcedure
    .input(
      z.object({
        items: z.array(z.object({ id: z.string().uuid(), priority: z.number().int().min(0).max(1000) })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const botChannel = await getUserBotChannel(ctx.session.user.id);

      for (const { id, priority } of input.items) {
        const kw = await db.query.keywords.findFirst({ where: eq(keywords.id, id) });
        if (!kw || kw.botChannelId !== botChannel.id) continue;
        await db.update(keywords).set({ priority }).where(eq(keywords.id, id));
      }

      const { eventBus } = await import("../events");
      await eventBus.publish("keyword:updated", { keywordId: "reorder" });

      return { success: true };
    }),
});
