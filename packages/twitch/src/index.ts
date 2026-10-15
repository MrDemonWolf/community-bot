import { ApiClient } from "@twurple/api";
import { getTokenInfo, RefreshingAuthProvider } from "@twurple/auth";
import { decrypt } from "@community-bot/db/crypto";
import { getSettings, replaceBroadcasterToken } from "@community-bot/db/settings";
import { decodeToken, encodeToken } from "@community-bot/db/twitch";

type Settings = Awaited<ReturnType<typeof getSettings>>;

export async function getCreatorClient(settings: Settings, requiredScopes: readonly string[] = []) {
  const { twitchClientId, twitchClientSecretEnc, broadcasterUserId, broadcasterTokenEnc } = settings;
  if (!twitchClientId || !twitchClientSecretEnc || !broadcasterUserId || !broadcasterTokenEnc) {
    throw new Error("Connect the creator's Twitch account first.");
  }
  const auth = new RefreshingAuthProvider({ clientId: twitchClientId, clientSecret: decrypt(twitchClientSecretEnc) });
  let encryptedToken = broadcasterTokenEnc;
  let pendingSave: Promise<void> = Promise.resolve();
  auth.onRefresh((userId, token) => {
    if (userId !== broadcasterUserId) return;
    pendingSave = pendingSave.then(async () => {
      const updated = encodeToken(token);
      if (!await replaceBroadcasterToken(encryptedToken, updated)) throw new Error("Creator connection changed; reconnect the service.");
      encryptedToken = updated;
    });
    // Event listeners are not awaited by Twurple; callers can flush and observe failures.
    void pendingSave.catch(() => {});
  });
  await auth.addUser(broadcasterUserId, decodeToken(broadcasterTokenEnc));
  const token = await auth.getAccessTokenForUser(broadcasterUserId, [...requiredScopes]);
  await pendingSave;
  if (!token) throw new Error("Reconnect the creator's Twitch account.");
  const identity = await getTokenInfo(token.accessToken, twitchClientId);
  if (identity.userId !== broadcasterUserId || identity.clientId !== twitchClientId) throw new Error("Creator Twitch identity does not match this application.");
  if (!requiredScopes.every((scope) => identity.scopes.includes(scope))) throw new Error("Reconnect the creator and approve the required Twitch permissions.");
  const api = new ApiClient({ authProvider: auth });
  return { auth, api, userId: broadcasterUserId, flush: () => pendingSave,
    encryptedToken: () => encryptedToken };
}
