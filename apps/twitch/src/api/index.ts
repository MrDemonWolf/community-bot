import { createApiServer } from "@community-bot/server";
import { env } from "../utils/env.js";

import healthRoute from "./routes/health.js";

const app = createApiServer({
  name: "Twitch Bot",
  defaultPort: 3737,
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV,
  corsOrigin: env.CORS_ORIGIN,
  routes: (app) => {
    app.use("/api/health", healthRoute);
  },
});

export default app;
