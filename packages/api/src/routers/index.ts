import { broadcasterOnly } from "../middleware/roles";
import { protectedProcedure, publicProcedure, router } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  broadcasterPing: broadcasterOnly.query(({ ctx }) => {
    return { ok: true, role: ctx.role };
  }),
});
export type AppRouter = typeof appRouter;
