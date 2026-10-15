import assert from "node:assert/strict";

assert.equal(
  process.env.SMOKE_TEST,
  "true",
  "Set SMOKE_TEST=true explicitly for the disposable integration environment.",
);
assert.equal(
  process.env.NODE_ENV,
  "development",
  "Smoke checks only run in development.",
);
assert.equal(
  process.env.SMOKE_BASE_URL,
  "http://localhost:3001",
  "Smoke checks require the exact loopback URL http://localhost:3001.",
);
const base = process.env.SMOKE_BASE_URL;
const {
  getSettings,
  updateSettings,
  saveTwitchConnection,
  replaceBotToken,
  replaceBroadcasterToken,
} = await import("../packages/db/src/settings");
const { encrypt, decrypt } = await import("../packages/db/src/crypto");
const { db } = await import("../packages/db/src/index");
const original = await getSettings();
if (original.discordEnabled || original.twitchEnabled) {
  await db.$client.end();
  throw new Error("Stop both workers before running smoke checks.");
}
let checks = 0;
let cookie = "";
function check(value: unknown, message: string) {
  assert.ok(value, message);
  checks++;
}
async function request(path: string, init: RequestInit = {}) {
  assert.ok(
    path.startsWith("/") && !path.startsWith("//"),
    "Only local relative paths are allowed.",
  );
  try {
    return await fetch(base + path, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(120000),
    });
  } catch (cause) {
    throw new Error(`Local smoke request failed: ${path}`, { cause });
  }
}
async function mutation(name: string, input: unknown, expectedStatus = 200) {
  const response = await request("/api/trpc/settings." + name, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      Cookie: cookie,
    },
    body: JSON.stringify(input),
  });
  check(
    response.status === expectedStatus,
    name + " returned expected HTTP status",
  );
  const body = (await response.json()) as {
    result?: { data: Record<string, unknown> };
    error?: unknown;
  };
  if (expectedStatus === 200)
    check(
      Boolean(body.result?.data) && !body.error,
      name + " returned successful tRPC data",
    );
  return body.result?.data;
}

try {
  await updateSettings({
    twitchEnabled: false,
    discordEnabled: false,
    publicPageEnabled: false,
    discordTokenEnc: null,
    discordApplicationId: null,
    discordGuildId: null,
    twitchClientId: null,
    twitchClientSecretEnc: null,
    botUserId: null,
    botLogin: null,
    botTokenEnc: null,
    broadcasterUserId: null,
    broadcasterLogin: null,
    broadcasterTokenEnc: null,
    channelName: null,
  });
  check(
    (await request("/api/trpc/settings.get")).status === 401,
    "Unauthenticated settings are denied",
  );
  const dashboard = await request("/dashboard");
  check(
    [302, 303, 307, 308].includes(dashboard.status) &&
      new URL(dashboard.headers.get("location")!, base).pathname === "/login",
    "Unauthenticated dashboard redirects to login",
  );
  check(
    (await request("/channel")).status === 404,
    "Public page is hidden by default",
  );
  const deniedLogin = await request("/api/auth/dev-login", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.invalid",
      Host: "localhost:3001",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  check(
    [403, 404].includes(deniedLogin.status),
    "Cross-origin dev login is denied",
  );
  const login = await request("/api/auth/dev-login", {
    method: "POST",
    headers: {
      Origin: base,
      Host: "localhost:3001",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  check(login.status === 200, "Loopback dev login succeeds");
  cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  check(
    cookie.includes("session_token="),
    "Dev login issues a real session cookie",
  );
  const sessionResponse = await request("/api/auth/get-session", {
    headers: { Cookie: cookie },
  });
  const ownerSession = (await sessionResponse.json()) as {
    session?: { id: string };
  };
  check(
    sessionResponse.status === 200 && Boolean(ownerSession.session?.id),
    "Issued cookie authenticates a real owner session",
  );
  const authenticated = await request("/api/trpc/settings.get", {
    headers: { Cookie: cookie },
  });
  check(authenticated.status === 200, "Owner session can read settings");
  const view = (await authenticated.json()) as {
    result?: { data: unknown };
    error?: unknown;
  };
  check(
    Boolean(view.result?.data) && !view.error,
    "Authenticated settings return tRPC data",
  );
  for (const service of ["discord", "twitch"])
    await mutation("control", { service, action: "join" }, 400);
  const core = {
    botName: "WolfAide Smoke",
    commandPrefix: "?",
    publicPageEnabled: false,
    publicDescription: "Disposable integration check.",
  };
  await mutation("updateCore", { ...core, commandPrefix: "bad prefix" }, 400);
  await mutation(
    "configureDiscord",
    { applicationId: "invalid", guildId: "invalid" },
    400,
  );
  await mutation("updateCore", core);
  check(
    (await getSettings()).commandPrefix === "?",
    "Core settings persist to PostgreSQL",
  );
  const discordSecret = "smoke-discord-token-not-real-0000000000000000";
  const discordView = await mutation("configureDiscord", {
    applicationId: "123456789012345678",
    guildId: "234567890123456789",
    token: discordSecret,
  });
  const discordStored = await getSettings();
  check(
    Boolean(discordStored.discordTokenEnc) &&
      discordStored.discordTokenEnc !== discordSecret &&
      decrypt(discordStored.discordTokenEnc!) === discordSecret,
    "Discord token is encrypted at rest",
  );
  check(
    !JSON.stringify(discordView).includes(discordSecret) &&
      !JSON.stringify(discordView).includes(discordStored.discordTokenEnc!),
    "Dashboard never serializes the Discord secret or encrypted blob",
  );
  const clientId = "smokeclient00000000000000";
  const clientSecret = "smoke-client-secret-not-real-000000000";
  const twitchView = await mutation("configureTwitch", {
    clientId,
    clientSecret,
  });
  const app = await getSettings();
  check(
    Boolean(app.twitchClientSecretEnc) &&
      decrypt(app.twitchClientSecretEnc!) === clientSecret,
    "Twitch application secret is encrypted at rest",
  );
  check(
    !JSON.stringify(twitchView).includes(clientSecret) &&
      !JSON.stringify(twitchView).includes(app.twitchClientSecretEnc!),
    "Dashboard never serializes the Twitch secret or encrypted blob",
  );
  for (const role of ["broadcaster", "bot"]) {
    const response = await request("/api/twitch/connect/" + role, {
      headers: { Cookie: cookie },
    });
    check(
      [302, 303, 307, 308].includes(response.status),
      "OAuth " + role + " produces a redirect",
    );
    const target = new URL(response.headers.get("location")!);
    check(
      target.origin === "https://id.twitch.tv" &&
        target.pathname === "/oauth2/authorize",
      "OAuth targets Twitch authorization only",
    );
    check(
      target.searchParams.get("client_id") === clientId &&
        target.searchParams.get("force_verify") === "true" &&
        target.searchParams.get("response_type") === "code",
      "OAuth uses configured app and explicit account confirmation",
    );
    check(
      target.searchParams.get("scope") ===
        (role === "bot" ? "user:read:chat user:write:chat" : ""),
      "OAuth requests minimal role scopes",
    );
    check(
      target.searchParams.get("state")?.startsWith(role + ":") &&
        response.headers
          .getSetCookie()
          .some(
            (value) =>
              value.startsWith("twitch_oauth_state=") &&
              value.includes("HttpOnly"),
          ),
      "OAuth state is role-bound and stored in an HttpOnly cookie",
    );
    const stateCookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("twitch_oauth_state="))!
      .split(";")[0]!;
    const stateData = JSON.parse(
      decodeURIComponent(stateCookie.slice(stateCookie.indexOf("=") + 1)),
    ) as { state: string; clientId: string; sessionId: string };
    check(
      stateData.state === target.searchParams.get("state") &&
        stateData.clientId === clientId &&
        stateData.sessionId === ownerSession.session?.id,
      "OAuth state cookie binds the app and current owner session",
    );
  }
  await mutation("updateCore", { ...core, publicPageEnabled: true });
  const publicPage = await request("/channel");
  check(
    publicPage.status === 200 &&
      (await publicPage.text()).includes("?streamuptime"),
    "Enabled public page displays configured commands",
  );
  await mutation("updateCore", core);
  check(
    (await request("/channel")).status === 404,
    "Public page can be disabled again",
  );
  const fakeToken = encrypt("smoke-token-never-used-with-a-provider");
  const patch = {
    botUserId: "123456789",
    botLogin: "smoke_bot",
    botTokenEnc: fakeToken,
    twitchEnabled: false,
  };
  check(
    !(await saveTwitchConnection(
      "stale-client",
      app.twitchClientSecretEnc!,
      patch,
    )),
    "OAuth save rejects stale client ID",
  );
  check(
    !(await saveTwitchConnection(clientId, encrypt("stale-secret"), patch)),
    "OAuth save rejects stale app secret",
  );
  check(
    (await getSettings()).botTokenEnc === null,
    "Rejected OAuth callbacks do not restore credentials",
  );
  check(
    await saveTwitchConnection(clientId, app.twitchClientSecretEnc!, patch),
    "Matching OAuth app permits atomic credential save",
  );
  const nextToken = encrypt("smoke-refreshed-token-never-used-with-a-provider");
  check(
    await replaceBotToken(fakeToken, nextToken),
    "Current bot token can refresh atomically",
  );
  await updateSettings({
    botUserId: null,
    botLogin: null,
    botTokenEnc: null,
    broadcasterUserId: "987654321",
    broadcasterLogin: "smoke_creator",
    broadcasterTokenEnc: fakeToken,
    twitchEnabled: false,
  });
  check(
    !(await replaceBotToken(nextToken, fakeToken)),
    "Bot refresh cannot undo a disconnect",
  );
  check(
    await replaceBroadcasterToken(fakeToken, nextToken),
    "Current creator token can refresh atomically",
  );
  await updateSettings({
    broadcasterUserId: null,
    broadcasterLogin: null,
    broadcasterTokenEnc: null,
  });
  check(
    !(await replaceBroadcasterToken(nextToken, fakeToken)),
    "Creator refresh cannot undo a disconnect",
  );
  const final = await getSettings();
  check(
    !final.botTokenEnc &&
      !final.broadcasterTokenEnc &&
      !final.twitchEnabled &&
      !final.discordEnabled,
    "Smoke checks never enable workers or restore disconnected credentials",
  );
} finally {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...restore
  } = original;
  try {
    await updateSettings(restore);
  } finally {
    await db.$client.end();
  }
}
console.log(
  `Smoke checks passed: ${checks}. Original settings restored. No external provider requests were made.`,
);
