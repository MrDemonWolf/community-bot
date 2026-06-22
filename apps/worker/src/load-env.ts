import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

// The worker runs from apps/worker but shares the Next app's env file. Load it
// BEFORE any @community-bot/env import evaluates (this is the first import in
// index.ts). dotenv won't override vars already set in the real environment.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../web/.env") });
