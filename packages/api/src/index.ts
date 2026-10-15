import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";
import { isOwner } from "@community-bot/auth";
import { canAccess } from "@community-bot/core/permissions";
import { resolveAccess } from "./access";
import { formatInputError } from "./input-errors";

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return formatInputError(shape, error.cause);
  },
});

export const router = t.router;

export const publicProcedure = t.procedure;

export const sessionProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user.emailVerified) {
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
export const authenticatedProcedure = sessionProcedure;

export const ownerProcedure = sessionProcedure.use(({ ctx, next }) => {
  if (!isOwner(ctx.session.user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only the creator can change this setting." });
  return next({ ctx });
});

export const protectedProcedure = sessionProcedure.use(async ({ ctx, next }) => {
  const access = await resolveAccess(ctx.session.user);
  if (!canAccess(access, "dashboard:view")) throw new TRPCError({ code: "FORBIDDEN", message: "Link a qualifying platform account to access the dashboard." });
  return next({ ctx: { ...ctx, access } });
});
