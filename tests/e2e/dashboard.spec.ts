import { test, expect, type Page, type TestInfo } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter development workspace" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /^Hey,/ })).toBeVisible();
}

async function snapshot(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
  });
});

test("anonymous pages and production login stay protected", async ({ page, request }) => {
  expect((await request.get("/api/trpc/settings.get")).status()).toBe(401);
  expect((await request.get("/channel")).status()).toBe(404);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  const production = process.env.E2E_PRODUCTION_URL ?? "http://localhost:3006";
  expect((await request.post(production + "/api/auth/dev-login", { headers: { Origin: production }, data: {} })).status()).toBe(404);
  const html = await (await request.get(production + "/login")).text();
  expect(html).not.toContain("Enter development workspace");
});

test("creator completes setup, saves private configuration and controls features", async ({ page, context }, info) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("400 (Bad Request)") && !message.text().includes("ERR_INTERNET_DISCONNECTED")) runtimeErrors.push(message.text());
  });
  await login(page);
  await page.getByRole("link", { name: "Guided setup" }).click();
  await expect(page.getByRole("heading", { name: "One step at a time." })).toBeVisible();
  await page.getByLabel("Bot display name").fill("WolfAide E2E");
  await page.getByLabel("Command prefix").fill("bad x");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Command prefix").fill("!");
  await page.getByLabel("Public channel description").fill("A disposable community fixture.");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("preferences are up to date");
  await page.getByRole("button", { name: "Next: Discord" }).click();
  await expect(page.getByRole("heading", { name: "Bring your Discord bot" })).toBeVisible();
  await page.getByLabel("Application ID", { exact: true }).fill("invalid");
  await page.getByLabel("Server ID").fill("127607669103001600");
  await page.getByLabel("Bot token").fill("e2e-disposable-token-never-used-for-login");
  await page.getByRole("button", { name: "Save Discord credentials" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Next: Twitch" }).click();
  const secret = "e2e-disposable-twitch-client-secret";
  await page.getByLabel("Twitch client ID", { exact: true }).fill("e2etestclient1234567890");
  await page.getByLabel("Twitch client secret", { exact: true }).fill(secret);
  const saved = page.waitForResponse((response) => response.url().includes("settings.configureTwitch") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Save Twitch application" }).click();
  const savedResponse = await saved;
  expect(savedResponse.ok()).toBeTruthy();
  expect(await savedResponse.text()).not.toContain(secret);
  await expect(page.getByText("Twitch application saved.", { exact: false })).toBeVisible();
  const settings = await context.request.get("/api/trpc/settings.get");
  const settingsBody = await settings.text();
  expect(settingsBody).not.toContain(secret);
  expect(settingsBody).not.toContain("twitchClientSecretEnc");
  const redirect = await context.request.get("/api/twitch/connect/broadcaster", { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(new URL(redirect.headers().location!).hostname).toBe("id.twitch.tv");
  await page.getByRole("button", { name: "Open my dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /^Hey,/ })).toBeVisible();
  await snapshot(page, info, "creator-dashboard");
  await page.getByRole("link", { name: "Features", exact: true }).click();
  const presence = page.locator("section").filter({ has: page.getByRole("heading", { name: "Discord presence", exact: true }) });
  await presence.getByRole("button", { name: "Disable feature" }).click();
  await expect(presence.getByRole("button", { name: "Enable feature" })).toBeVisible();
  await presence.getByRole("button", { name: "Enable feature" }).click();
  await expect(presence.getByRole("button", { name: "Disable feature" })).toBeVisible();
  let mutationAttempts = 0;
  page.on("request", (request) => { if (request.url().includes("features.update") && request.method() === "POST") mutationAttempts++; });
  await context.setOffline(true);
  await presence.getByRole("button", { name: "Disable feature" }).click();
  await expect(page.getByRole("alert")).toContainText(/fetch|network/i);
  const reconnectReadback = page.waitForResponse((response) => response.url().includes("features.list") && response.request().method() === "GET");
  await context.setOffline(false);
  await reconnectReadback;
  await expect(presence.getByRole("button", { name: "Disable feature" })).toBeVisible();
  expect(mutationAttempts).toBe(1);
  await page.getByRole("link", { name: "Staff access", exact: true }).click();
  await expect(page.getByRole("heading", { name: /The right tools/ })).toBeVisible();
  await page.getByLabel("Where the role comes from").selectOption("twitch");
  await page.getByLabel("Existing role", { exact: true }).selectOption("vip");
  await expect(page.getByLabel("WolfAide role")).toHaveValue("vip");
  await page.getByLabel("Existing role", { exact: true }).selectOption("subscriber");
  await expect(page.getByLabel("WolfAide role")).toHaveValue("subscriber");
  await page.getByRole("button", { name: "Add Twitch starter mappings" }).click();
  await expect(page.getByText("Twitch starter mappings saved.", { exact: false })).toBeVisible();
  expect(await page.getByRole("button", { name: "Remove mapping" }).count()).toBe(4);
  await page.getByRole("link", { name: "Channel points", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create reward", exact: true })).toBeDisabled();
  await snapshot(page, info, "channel-points-needs-authorization");
  await expect(page.getByText("Connection disabled", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enable reward connection" }).click();
  await expect(page.getByText("Creator setup needed", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Authorize rewards on Twitch" })).toBeVisible();
  const authorize = await context.request.get("/api/twitch/connect/broadcaster", { maxRedirects: 0 });
  expect(new URL(authorize.headers().location!).searchParams.get("scope")).toContain("channel:manage:redemptions");
  await expect(page.getByRole("button", { name: "Create reward", exact: true })).toBeDisabled();
  await expect(page.getByText("Authorized & eligible", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Disable reward connection" }).click();
  await page.getByRole("link", { name: "Guided setup" }).click();
  await page.getByLabel("Enable my public channel page").check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("preferences are up to date");
  const publicPage = await context.request.get("/channel");
  expect(publicPage.status()).toBe(200);
  const publicHTML = await publicPage.text();
  expect(publicHTML).toContain("WolfAide E2E");
  expect(publicHTML).not.toContain(secret);
  await page.getByLabel("Enable my public channel page").uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("preferences are up to date");
  expect((await context.request.get("/channel")).status()).toBe(404);
  expect(runtimeErrors).toEqual([]);
});

test("mobile setup, feature, access and reward pages remain usable", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("link", { name: "My accounts", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your community roles" })).toBeVisible();
  await expect(page.getByText("Creator · Full access to this workspace.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Link Twitch", exact: true })).toBeVisible();
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/setup", "/dashboard/features", "/access", "/dashboard/access", "/dashboard/rewards"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/Loading (features|staff access|channel points|your settings)/)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${path} overflows at ${width}px`).toBeTruthy();
      const smallTargets = await page.locator("button:visible, a.button:visible").evaluateAll((elements) => elements.filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width < 24 || bounds.height < 24;
      }).map((element) => element.textContent?.trim()));
      expect(smallTargets, `${path} has touch targets below 24px`).toEqual([]);
      const smallPrimaryTargets = await page.locator(".button.primary:visible, [role=tab]:visible").evaluateAll((elements) => elements.filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width < 44 || bounds.height < 44;
      }).map((element) => element.textContent?.trim()));
      expect(smallPrimaryTargets, `${path} primary touch targets must reach 44px`).toEqual([]);
      await snapshot(page, info, `mobile-${width}-${path.replaceAll("/", "-")}`);
    }
  }
});

test("production PWA installs offline shell while private API stays network-only", async ({ page, context, request }, info) => {
  const production = process.env.E2E_PRODUCTION_URL ?? "http://localhost:3006";
  const manifestResponse = await request.get(production + "/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ name: "WolfAide", display: "standalone", start_url: "/dashboard" });
  expect(manifest.icons).toHaveLength(2);
  for (const icon of manifest.icons) {
    const response = await request.get(production + icon.src);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  expect((await request.get(production + "/sw.js")).ok()).toBeTruthy();
  expect((await request.get(production + "/offline.html")).ok()).toBeTruthy();
  await page.goto(production + "/login");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  expect(await page.evaluate(async () => (await fetch("/api/trpc/settings.get")).status)).toBe(401);
  await context.setOffline(true);
  try {
    await page.goto(production + "/dashboard");
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
    expect(await page.evaluate(async () => {
      try { await fetch("/api/trpc/settings.get"); return "served"; } catch { return "network-only"; }
    })).toBe("network-only");
    const cachedPaths = await page.evaluate(async () => {
      const paths: string[] = [];
      for (const name of await caches.keys()) for (const item of await (await caches.open(name)).keys()) paths.push(new URL(item.url).pathname);
      return paths;
    });
    expect(cachedPaths).toEqual(["/offline.html"]);
    await snapshot(page, info, "production-offline-shell");
  } finally {
    await context.setOffline(false);
  }
});
