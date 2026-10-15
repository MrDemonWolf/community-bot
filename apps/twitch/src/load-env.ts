import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

// Load root development configuration before the shared environment module.
// BEFORE any @community-bot/env import evaluates (this is the first import in
// index.ts). dotenv won't override vars already set in the real environment.
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });
