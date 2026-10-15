import { randomUUID } from "node:crypto";
import { decrypt } from "@community-bot/db/crypto";
import { deletePermissionMapping, deletePlatformIdentity, getPermissionMappings, upsertPermissionMapping } from "@community-bot/db/features";
import { getSettings, updateSettings } from "@community-bot/db/settings";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { resolveAccess } from "../access";
import { ownerProcedure, router, sessionProcedure } from "../index";

const platform = z.enum(["twitch", "discord"]);
const role = z.enum(["admin", "lead_moderator", "moderator", "vip", "subscriber"]);

export const accessRouter = router({
  me: sessionProcedure.query(({ ctx }) => resolveAccess(ctx.session.user)),
  disconnect: sessionProcedure.input(z.object({ provider: platform })).mutation(async ({ ctx, input }) => {
    await deletePlatformIdentity(ctx.session.user.id, input.provider);
    return resolveAccess(ctx.session.user);
  }),
  config: ownerProcedure.query(async () => {
    const [settings, mappings] = await Promise.all([getSettings(), getPermissionMappings()]);
    return { permissionSyncTwitch: settings.permissionSyncTwitch, permissionSyncDiscord: settings.permissionSyncDiscord,
      twitchLeadModeratorIds: settings.twitchLeadModeratorIds, discordOAuthConfigured: Boolean(settings.discordClientSecretEnc), mappings };
  }),
  configure: ownerProcedure.input(z.object({ permissionSyncTwitch: z.boolean(), permissionSyncDiscord: z.boolean(),
    twitchLeadModeratorIds: z.array(z.string().regex(/^\d+$/)).max(100) })).mutation(async ({ input }) => {
    await updateSettings(input);
    return { ok: true };
  }),
  saveMapping: ownerProcedure.input(z.object({ provider: platform, sourceRoleId: z.string().min(1).max(100), role,
    scopes: z.array(platform).min(1).max(2) }).superRefine((input, ctx) => {
      const valid = input.provider === "discord" ? /^\d{17,20}$/.test(input.sourceRoleId)
        : ["moderator", "lead_moderator", "vip", "subscriber"].includes(input.sourceRoleId);
      if (!valid) ctx.addIssue({ code: "custom", path: ["sourceRoleId"], message: "Choose a Discord role ID or supported Twitch role." });
    })).mutation(({ input }) => upsertPermissionMapping({ id: randomUUID(), ...input, scopes: [...new Set(input.scopes)] })),
  deleteMapping: ownerProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
    await deletePermissionMapping(input.id); return { ok: true };
  }),
  discordRoles: ownerProcedure.query(async () => {
    const settings = await getSettings();
    if (!settings.discordTokenEnc || !settings.discordGuildId) return [];
    const response = await fetch(`https://discord.com/api/v10/guilds/${settings.discordGuildId}/roles`, {
      headers: { Authorization: `Bot ${decrypt(settings.discordTokenEnc)}` }, signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "Could not read Discord roles. Check the bot connection." });
    return z.array(z.object({ id: z.string(), name: z.string(), position: z.number() })).parse(await response.json());
  }),
});
