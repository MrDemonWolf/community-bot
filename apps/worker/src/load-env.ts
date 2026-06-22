import { resolve } from "node:path";

import { config } from "dotenv";

// The worker runs from apps/worker but shares the server's env file. Load it
// BEFORE any @community-bot/env import evaluates (this is the first import in
// index.ts). dotenv won't override vars already set in the real environment.
config({ path: resolve(import.meta.dir, "../../server/.env") });
