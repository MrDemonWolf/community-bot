import {
  protectedProcedure, publicProcedure,
  router,
} from "../index";
import { botChannelRouter } from "./botChannel";
import { chatCommandRouter } from "./chatCommand";
import { userRouter } from "./user";
import { regularRouter } from "./regular";

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
  user: userRouter,
  regular: regularRouter,
});
export type AppRouter = typeof appRouter;
