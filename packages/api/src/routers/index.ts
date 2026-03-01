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
import { queueRouter } from "./queue";
import { quoteRouter } from "./quote";
import { counterRouter } from "./counter";
import { timerRouter } from "./timer";
import { spamFilterRouter } from "./spamFilter";
import { songRequestRouter } from "./songRequest";
import { playlistRouter } from "./playlist";
import { giveawayRouter } from "./giveaway";
import { pollRouter } from "./poll";

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
  queue: queueRouter,
  quote: quoteRouter,
  counter: counterRouter,
  timer: timerRouter,
  spamFilter: spamFilterRouter,
  songRequest: songRequestRouter,
  playlist: playlistRouter,
  giveaway: giveawayRouter,
  poll: pollRouter,
});
export type AppRouter = typeof appRouter;
