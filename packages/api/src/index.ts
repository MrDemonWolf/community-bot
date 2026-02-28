import { initTRPC, TRPCError } from "@trpc/server";
import { prisma } from "@community-bot/db";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/** Requires MODERATOR, LEAD_MODERATOR, or BROADCASTER role. */
export const moderatorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({ where: { id: ctx.session.user.id } });
  if (!user || user.banned) throw new TRPCError({ code: "FORBIDDEN" });
  const allowed = ["MODERATOR", "LEAD_MODERATOR", "BROADCASTER"];
  if (!allowed.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user } });
});

/** Requires LEAD_MODERATOR or BROADCASTER role. */
export const leadModProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({ where: { id: ctx.session.user.id } });
  if (!user || user.banned) throw new TRPCError({ code: "FORBIDDEN" });
  const allowed = ["LEAD_MODERATOR", "BROADCASTER"];
  if (!allowed.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user } });
});

/** Requires BROADCASTER role (channel owner only). */
export const broadcasterProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({ where: { id: ctx.session.user.id } });
  if (!user || user.banned) throw new TRPCError({ code: "FORBIDDEN" });
  if (user.role !== "BROADCASTER") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user } });
});
