import { createApiServer } from "@community-bot/server";
import env from "../utils/env.js";

import healthRoute from "./routes/health.js";

const app = createApiServer({
  name: "Discord Bot",
  defaultPort: 3141,
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV,
  corsOrigin: env.CORS_ORIGIN,
  routes: (app) => {
    app.use("/api/health", healthRoute);
  },
});

export default app;
