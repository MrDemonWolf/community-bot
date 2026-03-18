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
import { discordTemplatesRouter } from "./discordTemplates";
import { discordScheduledRouter } from "./discordScheduled";
import { discordRolesRouter } from "./discordRoles";
import { discordModerationRouter } from "./discordModeration";
import { discordCustomCommandsRouter } from "./discordCustomCommands";
import { keywordRouter } from "./keyword";
import { configTesterRouter } from "./configTester";
import { chatAlertRouter } from "./chatAlert";
import { channelPointsRouter } from "./channelPoints";
import { automodRouter } from "./automod";
import { importExportRouter } from "./importExport";
import { titleGeneratorRouter } from "./titleGenerator";

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
  discordTemplates: discordTemplatesRouter,
  discordScheduled: discordScheduledRouter,
  discordRoles: discordRolesRouter,
  discordModeration: discordModerationRouter,
  discordCustomCommands: discordCustomCommandsRouter,
  keyword: keywordRouter,
  configTester: configTesterRouter,
  chatAlert: chatAlertRouter,
  channelPoints: channelPointsRouter,
  automod: automodRouter,
  importExport: importExportRouter,
  titleGenerator: titleGeneratorRouter,
});
export type AppRouter = typeof appRouter;
