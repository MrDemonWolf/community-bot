import { createDb } from "@community-bot/db";
import * as schema from "@community-bot/db/schema/auth";
import { env } from "@community-bot/env/server";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    databaseHooks: {
      user: {
        create: {
          // Single-tenant: only the first account (the owner) may sign up.
          // ponytail: closes open signup until Twitch broadcaster-login replaces it.
          before: async (user) => {
            const existing = await db.$count(schema.user);
            if (existing > 0) {
              throw new APIError("FORBIDDEN", { message: "Sign-ups are closed." });
            }
            return { data: user };
          },
        },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      // ponytail: secure cross-site cookies in prod; relax for http://localhost dev.
      defaultCookieAttributes:
        env.NODE_ENV === "production"
          ? { sameSite: "none", secure: true, httpOnly: true }
          : { sameSite: "lax", secure: false, httpOnly: true },
    },
    plugins: [],
  });
}

export const auth = createAuth();
