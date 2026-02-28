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
import { setupRouter } from "./setup";
import { userManagementRouter } from "./userManagement";

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
  setup: setupRouter,
  userManagement: userManagementRouter,
});
export type AppRouter = typeof appRouter;
