import { hasRoleAtLeast, type Role } from "@community-bot/shared/roles";
import { TRPCError } from "@trpc/server";
import { t } from "../index";

function requireRole(min: Role) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
    }
    if (!hasRoleAtLeast(ctx.role, min)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires role '${min}' or higher`,
      });
    }
    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
        user: ctx.user!,
        role: ctx.role,
      },
    });
  });
}

export const authenticated = t.procedure.use(requireRole("viewer"));
export const modOrAbove = t.procedure.use(requireRole("mod"));
export const broadcasterOnly = t.procedure.use(requireRole("broadcaster"));
