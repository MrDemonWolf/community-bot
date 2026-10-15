import { router } from "../index";
import { settingsRouter } from "./settings";
import { accessRouter } from "./access";
import { featuresRouter } from "./features";
import { rewardsRouter } from "./rewards";

export const appRouter = router({ settings: settingsRouter, access: accessRouter, features: featuresRouter, rewards: rewardsRouter });
export type AppRouter = typeof appRouter;
