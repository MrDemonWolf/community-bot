/**
 * Setup wizard tRPC router.
 *
 * Handles the first-time setup flow: checking status, persisting wizard
 * progress, authorizing the bot's Twitch account via Device Code Flow,
 * and finalizing setup (promoting the user to BROADCASTER, setting broadcaster).
 */
import { db, eq, and, systemConfigs, users, accounts, botChannels, twitchCredentials } from "@community-bot/db";
import { env } from "@community-bot/env/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../index";

// Twitch OAuth2 Device Code Flow endpoints
const DEVICE_CODE_URL = "https://id.twitch.tv/oauth2/device";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";
const BOT_SCOPES = "chat:read chat:edit moderator:read:followers channel:read:subscriptions";

export const setupRouter = router({
  /** Public — returns whether first-time setup has been completed. */
  status: publicProcedure.query(async () => {
    const setupComplete = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, "setupComplete"),
    });
    return { setupComplete: setupComplete?.value === "true" };
  }),

  getStep: protectedProcedure.query(async () => {
    const config = await db.query.systemConfigs.findFirst({
      where: eq(systemConfigs.key, "setupStep"),
    });
    return { step: config?.value ?? null };
  }),

  saveStep: protectedProcedure
    .input(z.object({ step: z.string() }))
    .mutation(async ({ input }) => {
      await db.insert(systemConfigs).values({
        key: "setupStep",
        value: input.step,
      }).onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value: input.step },
      });
      return { success: true };
    }),

  /**
   * Finalize setup: validate the one-time token, set broadcaster,
   * promote user to BROADCASTER, and clean up transient config keys.
   */
  complete: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const storedToken = await db.query.systemConfigs.findFirst({
        where: eq(systemConfigs.key, "setupToken"),
      });
      if (!storedToken || storedToken.value !== input.token) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid setup token.",
        });
      }

      const userId = ctx.session.user.id;

      await db.transaction(async (tx) => {
        await tx.insert(systemConfigs).values({
          key: "broadcasterUserId",
          value: userId,
        }).onConflictDoUpdate({
          target: systemConfigs.key,
          set: { value: userId },
        });

        await tx.insert(systemConfigs).values({
          key: "setupComplete",
          value: "true",
        }).onConflictDoUpdate({
          target: systemConfigs.key,
          set: { value: "true" },
        });

        await tx.delete(systemConfigs).where(eq(systemConfigs.key, "setupToken"));
        await tx.delete(systemConfigs).where(eq(systemConfigs.key, "setupStep"));

        await tx.update(users).set({ role: "BROADCASTER" }).where(eq(users.id, userId));
      });

      // Auto-enable the bot if the user has a linked Twitch account
      const twitchAccount = await db.query.accounts.findFirst({
        where: and(eq(accounts.userId, userId), eq(accounts.providerId, "twitch")),
      });

      if (twitchAccount) {
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        const twitchUserId = twitchAccount.accountId;
        const twitchUsername = user?.name?.toLowerCase() ?? twitchUserId;

        const [botChannel] = await db.insert(botChannels).values({
          userId,
          twitchUsername,
          twitchUserId,
          enabled: true,
        }).onConflictDoUpdate({
          target: botChannels.userId,
          set: { enabled: true, twitchUsername, twitchUserId },
        }).returning();

        try {
          const { eventBus } = await import("../events");
          await eventBus.publish("channel:join", {
            channelId: botChannel!.twitchUserId,
            username: botChannel!.twitchUsername,
          });
        } catch {
          // EventBus may not be connected during setup — not critical
        }
      }

      return { success: true };
    }),

  /**
   * Start Twitch Device Code Flow. Returns a user_code and verification_uri
   * that the user opens in a browser, signs in with the BOT's Twitch account
   * (not the broadcaster), and authorizes the requested scopes.
   */
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

  /**
   * Poll Twitch for Device Code Flow completion. The client calls this on
   * an interval until the user completes authorization. On success, the
   * bot's access/refresh tokens are stored in the TwitchCredential table.
   */
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

      await db.insert(twitchCredentials).values({
        userId: validateData.user_id,
        accessToken: body.access_token!,
        refreshToken: body.refresh_token!,
        expiresIn: body.expires_in ?? 0,
        obtainmentTimestamp: BigInt(now),
        scope: body.scope ?? [],
      }).onConflictDoUpdate({
        target: twitchCredentials.userId,
        set: {
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
