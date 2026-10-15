import { db } from "@community-bot/db";
import * as schema from "@community-bot/db/schema/auth";
import { env } from "@community-bot/env/server";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { devLoginEnabled, devLoginPlugin } from "./dev-login";

const localDev = devLoginEnabled(
  env.NODE_ENV,
  env.DEV_LOGIN,
  env.BETTER_AUTH_URL,
);
if (!env.BETTER_AUTH_URL || !env.BETTER_AUTH_SECRET)
  throw new Error("Web requires BETTER_AUTH_URL and BETTER_AUTH_SECRET");
if (env.NODE_ENV === "production" && !env.OWNER_EMAIL)
  throw new Error("Web requires OWNER_EMAIL in production");

export function isOwner(user: { email: string; emailVerified: boolean }) {
  return (
    user.emailVerified &&
    user.email.toLowerCase() ===
      (env.OWNER_EMAIL?.toLowerCase() ?? (localDev ? "dev@localhost" : ""))
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  trustedOrigins: [env.BETTER_AUTH_URL],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  account: { encryptOAuthTokens: true },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!user.emailVerified)
            throw new APIError("FORBIDDEN", {
              message: "Use a verified Google account to continue.",
            });
          return { data: user };
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          const user = await ctx?.context.internalAdapter.findUserById(
            session.userId,
          );
          if (!user?.emailVerified) throw new APIError("FORBIDDEN");
          return { data: session };
        },
      },
    },
  },
  plugins: [
    ...(localDev ? [devLoginPlugin(env.OWNER_EMAIL)] : []),
    nextCookies(),
  ],
});
