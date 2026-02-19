import { prisma } from "@community-bot/db";
import { env } from "@community-bot/env/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../index";

const DEVICE_CODE_URL = "https://id.twitch.tv/oauth2/device";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";
const BOT_SCOPES = "chat:read chat:edit moderator:read:followers channel:read:subscriptions";

export const setupRouter = router({
  status: publicProcedure.query(async () => {
    const setupComplete = await prisma.systemConfig.findUnique({
      where: { key: "setupComplete" },
    });
    return { setupComplete: setupComplete?.value === "true" };
  }),

  getStep: protectedProcedure.query(async () => {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "setupStep" },
    });
    return { step: config?.value ?? null };
  }),

  saveStep: protectedProcedure
    .input(z.object({ step: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.systemConfig.upsert({
        where: { key: "setupStep" },
        create: { key: "setupStep", value: input.step },
        update: { value: input.step },
      });
      return { success: true };
    }),

  complete: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const storedToken = await prisma.systemConfig.findUnique({
        where: { key: "setupToken" },
      });
      if (!storedToken || storedToken.value !== input.token) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid setup token.",
        });
      }

      const userId = ctx.session.user.id;

      await prisma.$transaction([
        prisma.systemConfig.upsert({
          where: { key: "broadcasterUserId" },
          create: { key: "broadcasterUserId", value: userId },
          update: { value: userId },
        }),
        prisma.systemConfig.upsert({
          where: { key: "setupComplete" },
          create: { key: "setupComplete", value: "true" },
          update: { value: "true" },
        }),
        prisma.systemConfig.delete({ where: { key: "setupToken" } }),
        prisma.systemConfig.deleteMany({ where: { key: "setupStep" } }),
        prisma.user.update({
          where: { id: userId },
          data: { role: "ADMIN" },
        }),
      ]);

      return { success: true };
    }),

  startBotAuth: protectedProcedure.mutation(async () => {
    const res = await fetch(DEVICE_CODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.TWITCH_APPLICATION_CLIENT_ID,
        scopes: BOT_SCOPES,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to start device authorization: ${res.status} — ${text}`,
      });
    }

    const data = (await res.json()) as {
      device_code: string;
      expires_in: number;
      interval: number;
      user_code: string;
      verification_uri: string;
    };

    return {
      verificationUri: data.verification_uri,
      userCode: data.user_code,
      deviceCode: data.device_code,
      interval: data.interval,
    };
  }),

  pollBotAuth: protectedProcedure
    .input(z.object({ deviceCode: z.string() }))
    .mutation(async ({ input }) => {
      const tokenRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.TWITCH_APPLICATION_CLIENT_ID,
          device_code: input.deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });

      const body = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string[];
        message?: string;
        error?: string;
      };

      if (!tokenRes.ok) {
        const err = body?.message || body?.error || "";
        if (err === "authorization_pending" || err === "slow_down") {
          return { success: false as const, status: "pending" as const };
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Authorization failed: ${err}`,
        });
      }

      // Validate token to get userId and login
      const validateRes = await fetch(VALIDATE_URL, {
        headers: { Authorization: `OAuth ${body.access_token}` },
      });

      if (!validateRes.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to validate token after authorization.",
        });
      }

      const validateData = (await validateRes.json()) as {
        user_id: string;
        login: string;
      };

      const now = Date.now();

      await prisma.twitchCredential.upsert({
        where: { userId: validateData.user_id },
        update: {
          accessToken: body.access_token!,
          refreshToken: body.refresh_token!,
          expiresIn: body.expires_in ?? 0,
          obtainmentTimestamp: BigInt(now),
          scope: body.scope ?? [],
        },
        create: {
          userId: validateData.user_id,
          accessToken: body.access_token!,
          refreshToken: body.refresh_token!,
          expiresIn: body.expires_in ?? 0,
          obtainmentTimestamp: BigInt(now),
          scope: body.scope ?? [],
        },
      });

      return {
        success: true as const,
        username: validateData.login,
      };
    }),
});
