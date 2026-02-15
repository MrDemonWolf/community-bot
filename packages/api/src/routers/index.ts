import {
  protectedProcedure, publicProcedure,
  router,
} from "../index";
import { botChannelRouter } from "./botChannel";
import { chatCommandRouter } from "./chatCommand";
import { userRouter } from "./user";
import { regularRouter } from "./regular";
import { auditLogRouter } from "./auditLog";
import { discordGuildRouter } from "./discordGuild";

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
  auditLog: auditLogRouter,
  discordGuild: discordGuildRouter,
});
export type AppRouter = typeof appRouter;
