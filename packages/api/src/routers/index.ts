import {
  protectedProcedure, publicProcedure,
  router,
} from "../index";
import { botChannelRouter } from "./botChannel";

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
  botChannel: botChannelRouter,
});
export type AppRouter = typeof appRouter;
