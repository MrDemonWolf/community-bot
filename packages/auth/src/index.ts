import prisma from "@community-bot/db";
import { env } from "@community-bot/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  appName: "MrDemonWolf Community Bot",
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [env.CORS_ORIGIN],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    username(),
    twoFactor({
      issuer: "MrDemonWolf",
    }),
    nextCookies(),
  ],
});
