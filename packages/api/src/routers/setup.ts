import { db } from "@community-bot/db";
import { account } from "@community-bot/db/schema/auth";
import { appConfig } from "@community-bot/db/schema/appConfig";
import { auditLogs } from "@community-bot/db/schema/auditLogs";
import { env } from "@community-bot/env/server";
import {
  SETUP_STEP_AUDIT_ACTIONS,
  SETUP_STEP_SCHEMAS,
  SetupStep,
  type SetupStepNumber,
} from "@community-bot/shared";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { broadcasterOnly } from "../middleware/roles";
import { protectedProcedure, publicProcedure, router } from "../index";

const SINGLETON_ID = 1;

async function getOrCreateAppConfig() {
  const existing = await db.select().from(appConfig).where(eq(appConfig.id, SINGLETON_ID)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(appConfig).values({ id: SINGLETON_ID }).returning();
  if (!created)
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "app_config init failed" });
  return created;
}

async function discordAccessTokenForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ token: account.accessToken })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "discord")))
    .limit(1);
  return rows[0]?.token ?? null;
}

const MANAGE_GUILD = 1n << 5n;

type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
};

type DiscordChannel = { id: string; name: string; type: number };
type DiscordRole = { id: string; name: string; color: number; position: number; managed: boolean };

const SubmitInput = z.object({
  step: z
    .number()
    .int()
    .min(1)
    .max(9)
    .transform((n) => n as SetupStepNumber),
  payload: z.unknown(),
});

export const setupRouter = router({
  /** Public — drives client-side first-run gate. Returns minimal info. */
  firstRun: publicProcedure.query(async () => {
    const cfg = await db
      .select({ setupComplete: appConfig.setupComplete })
      .from(appConfig)
      .where(eq(appConfig.id, SINGLETON_ID))
      .limit(1);
    return { setupComplete: cfg[0]?.setupComplete ?? false };
  }),

  /** Wizard state for the authenticated user. */
  getState: protectedProcedure.query(async () => {
    const cfg = await getOrCreateAppConfig();
    return {
      setupComplete: cfg.setupComplete,
      currentStep: cfg.setupStep as SetupStepNumber,
      state: cfg.setupState,
      botDisplayName: cfg.botDisplayName,
      discordGuildId: cfg.discordGuildId,
      streamAlertChannelId: cfg.streamAlertChannelId,
      alertEmbedStyle: cfg.alertEmbedStyle,
      alertEveryone: cfg.alertEveryone,
      botMode: cfg.botMode,
      roleMap: cfg.roleMap,
      hasTwitchCreds: Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET),
      hasDiscordCreds: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
      hasDiscordBotToken: Boolean(env.DISCORD_BOT_TOKEN),
    };
  }),

  /** Submit a wizard step. Validates payload, advances step counter, writes audit row. */
  submitStep: broadcasterOnly.input(SubmitInput).mutation(async ({ ctx, input }) => {
    const cfg = await getOrCreateAppConfig();
    if (cfg.setupComplete) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Setup already complete" });
    }
    if (input.step !== cfg.setupStep) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Expected step ${cfg.setupStep}, got ${input.step}`,
      });
    }

    const schema = SETUP_STEP_SCHEMAS[input.step];
    const parsed = schema.safeParse(input.payload);
    if (!parsed.success) {
      throw new TRPCError({ code: "BAD_REQUEST", message: parsed.error.message });
    }
    const payload = parsed.data as Record<string, unknown>;

    const patch: Partial<typeof appConfig.$inferInsert> = {};
    switch (input.step) {
      case SetupStep.WELCOME:
        patch.botDisplayName = (payload as { botDisplayName: string }).botDisplayName;
        break;
      case SetupStep.DISCORD_GUILD:
        patch.discordGuildId = (payload as { guildId: string }).guildId;
        break;
      case SetupStep.ROLE_MAP:
        patch.roleMap = (
          payload as { roleMap: Record<string, "mod" | "vip" | "sub" | "viewer"> }
        ).roleMap;
        break;
      case SetupStep.STREAM_ALERTS: {
        const p = payload as {
          channelId: string;
          embedStyle: "rich" | "plain";
          alertEveryone: boolean;
        };
        patch.streamAlertChannelId = p.channelId;
        patch.alertEmbedStyle = p.embedStyle;
        patch.alertEveryone = p.alertEveryone;
        break;
      }
      case SetupStep.BOT_MODE:
        patch.botMode = (payload as { botMode: "single_account" | "separate_account" }).botMode;
        break;
      default:
        break;
    }

    const newState = { ...(cfg.setupState ?? {}), [`step${input.step}`]: payload };
    const nextStep = (
      input.step === SetupStep.REVIEW ? input.step : input.step + 1
    ) as SetupStepNumber;

    await db
      .update(appConfig)
      .set({
        ...patch,
        setupState: newState,
        setupStep: nextStep,
      })
      .where(eq(appConfig.id, SINGLETON_ID));

    await db.insert(auditLogs).values({
      actorUserId: ctx.user.id,
      action: SETUP_STEP_AUDIT_ACTIONS[input.step],
      targetType: "app_config",
      targetId: String(SINGLETON_ID),
      payload: payload as Record<string, unknown>,
    });

    return { ok: true, nextStep };
  }),

  /** Flip setupComplete=true after the Review step. */
  complete: broadcasterOnly.mutation(async ({ ctx }) => {
    const cfg = await getOrCreateAppConfig();
    if (cfg.setupComplete) return { ok: true, alreadyComplete: true };
    if (cfg.setupStep < SetupStep.REVIEW) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Cannot complete: still on step ${cfg.setupStep}`,
      });
    }
    await db.update(appConfig).set({ setupComplete: true }).where(eq(appConfig.id, SINGLETON_ID));
    await db.insert(auditLogs).values({
      actorUserId: ctx.user.id,
      action: "setup.completed",
      targetType: "app_config",
      targetId: String(SINGLETON_ID),
      payload: null,
    });
    return { ok: true, alreadyComplete: false };
  }),

  listDiscordGuilds: broadcasterOnly.query(async ({ ctx }) => {
    const token = await discordAccessTokenForUser(ctx.user.id);
    if (!token) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Discord account not linked. Sign in with Discord first.",
      });
    }
    const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `Discord API ${res.status}`,
      });
    }
    const all = (await res.json()) as DiscordGuild[];
    return all
      .filter((g) => (BigInt(g.permissions) & MANAGE_GUILD) === MANAGE_GUILD)
      .map((g) => ({ id: g.id, name: g.name, icon: g.icon }));
  }),

  listDiscordChannels: broadcasterOnly
    .input(z.object({ guildId: z.string() }))
    .query(async ({ input }) => {
      if (!env.DISCORD_BOT_TOKEN) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "DISCORD_BOT_TOKEN not configured",
        });
      }
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${encodeURIComponent(input.guildId)}/channels`,
        { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } },
      );
      if (!res.ok) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: `Discord API ${res.status}` });
      }
      const all = (await res.json()) as DiscordChannel[];
      return all.filter((c) => c.type === 0).map((c) => ({ id: c.id, name: c.name }));
    }),

  listDiscordRoles: broadcasterOnly
    .input(z.object({ guildId: z.string() }))
    .query(async ({ input }) => {
      if (!env.DISCORD_BOT_TOKEN) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "DISCORD_BOT_TOKEN not configured",
        });
      }
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${encodeURIComponent(input.guildId)}/roles`,
        { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } },
      );
      if (!res.ok) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: `Discord API ${res.status}` });
      }
      const all = (await res.json()) as DiscordRole[];
      return all
        .filter((r) => !r.managed)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name, color: r.color }));
    }),
});

export type SetupRouter = typeof setupRouter;
