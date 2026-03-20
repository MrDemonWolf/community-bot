/**
 * @community-bot/api — tRPC initialization, router factory, and role-gated procedures.
 *
 * All tRPC routers in the app import `router` and the procedure helpers from
 * this file. Procedure hierarchy: public → protected → moderator → leadMod → broadcaster.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { db, eq, users } from "@community-bot/db";
import type { Context } from "./context";

/** Initialized tRPC instance bound to the app's Context type. */
export const t = initTRPC.context<Context>().create();

/** Create a new tRPC router from a record of procedures. */
export const router = t.router;

/** No auth required — open to all callers. */
export const publicProcedure = t.procedure;

/** Requires an authenticated session (any role). */
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
  const user = await db.query.users.findFirst({ where: eq(users.id, ctx.session.user.id) });
  if (!user || user.banned) throw new TRPCError({ code: "FORBIDDEN" });
  const allowed = ["MODERATOR", "LEAD_MODERATOR", "BROADCASTER"];
  if (!allowed.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user } });
});

/** Requires LEAD_MODERATOR or BROADCASTER role. */
export const leadModProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, ctx.session.user.id) });
  if (!user || user.banned) throw new TRPCError({ code: "FORBIDDEN" });
  const allowed = ["LEAD_MODERATOR", "BROADCASTER"];
  if (!allowed.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user } });
});

/** Requires BROADCASTER role (channel owner only). */
export const broadcasterProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, ctx.session.user.id) });
  if (!user || user.banned) throw new TRPCError({ code: "FORBIDDEN" });
  if (user.role !== "BROADCASTER") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { ...ctx, user } });
});
