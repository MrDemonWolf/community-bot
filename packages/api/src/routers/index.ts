import {
  protectedProcedure, publicProcedure,
  router,
} from "../index";
import { botChannelRouter } from "./botChannel";
import { chatCommandRouter } from "./chatCommand";

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
  chatCommand: chatCommandRouter,
});
export type AppRouter = typeof appRouter;
