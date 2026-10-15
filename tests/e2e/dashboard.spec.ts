import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  const button = page.getByRole("button", { name: "Enter development workspace" });
  await expect(button).toBeEnabled();
  const response = page.waitForResponse((value) => value.url().includes("/api/auth/dev-login") && value.request().method() === "POST", { timeout: 30_000 });
  await button.click();
  expect((await response).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /^Hey,/ })).toBeVisible();
}

async function snapshot(page: Page, info: TestInfo, name: string, fullPage = true) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage });
  await info.attach(name, { path, contentType: "image/png" });
}

test.beforeEach(async ({ context }) => {
  await context.route("**/*", (route) => {
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
  const desktopNav = page.getByRole("navigation", { name: "Main navigation", exact: true });
  await expect(page.getByLabel("Bot display name")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save Discord credentials" })).toHaveCount(0);
  await desktopNav.getByRole("link", { name: "Guided setup" }).click();
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
  const saved = page.waitForResponse((response) => response.url().includes("settings.configureTwitch") && response.request().method() === "POST", { timeout: 30_000 });
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
  await desktopNav.getByRole("link", { name: "Features", exact: true }).click();
  const presence = page.locator("section").filter({ has: page.getByRole("heading", { name: "Discord presence", exact: true }) });
  await expect(presence.getByRole("link", { name: "Edit Discord presence" })).toHaveAttribute("href", "/dashboard/settings#discord-presence");
  await presence.getByRole("button", { name: "Disable feature" }).click();
  await expect(presence.getByRole("button", { name: "Enable feature" })).toBeVisible();
  await presence.getByRole("button", { name: "Enable feature" }).click();
  await expect(presence.getByRole("button", { name: "Disable feature" })).toBeVisible();
  await snapshot(page, info, "desktop-features");
  let mutationAttempts = 0;
  page.on("request", (request) => { if (request.url().includes("features.update") && request.method() === "POST") mutationAttempts++; });
  await context.setOffline(true);
  await presence.getByRole("button", { name: "Disable feature" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /fetch|network/i })).toBeVisible();
  const offlineBanner = page.getByRole("status").filter({ hasText: "You’re offline." });
  await expect(offlineBanner).toBeVisible();
  const bannerBox = await offlineBanner.boundingBox();
  const brandBox = await page.locator(".sidebar .brand").boundingBox();
  expect(bannerBox && brandBox && bannerBox.y + bannerBox.height <= brandBox.y).toBeTruthy();
  await snapshot(page, info, "offline-feature-control");
  const reconnectReadback = page.waitForResponse((response) => response.url().includes("features.list") && response.request().method() === "GET", { timeout: 30_000 });
  await context.setOffline(false);
  await reconnectReadback;
  await expect(presence.getByRole("button", { name: "Disable feature" })).toBeVisible();
  expect(mutationAttempts).toBe(1);
  await desktopNav.getByRole("link", { name: "Staff access", exact: true }).click();
  await expect(page.getByRole("heading", { name: /The right tools/ })).toBeVisible();
  await page.getByLabel("Where the role comes from").selectOption("twitch");
  await page.getByRole("combobox", { name: /^Existing role/ }).selectOption("vip");
  await expect(page.getByLabel("Dashboard role")).toHaveValue("vip");
  await page.getByRole("combobox", { name: /^Existing role/ }).selectOption("subscriber");
  await expect(page.getByLabel("Dashboard role")).toHaveValue("subscriber");
  await page.getByRole("button", { name: "Add Twitch starter mappings" }).click();
  await expect(page.getByText("Twitch starter mappings saved.", { exact: false })).toBeVisible();
  expect(await page.getByRole("button", { name: "Remove mapping" }).count()).toBe(4);
  await desktopNav.getByRole("link", { name: "Channel points", exact: true }).click();
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
  await desktopNav.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Community preferences", exact: true })).toBeVisible();
  await expect(page.getByLabel("Twitch client secret", { exact: true })).toHaveValue("");
  await snapshot(page, info, "desktop-settings");
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

test("mobile setup, feature, access and reward pages remain usable", async ({ page, context }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const paths = ["/dashboard", "/setup", "/dashboard/features", "/access", "/dashboard/access", "/dashboard/rewards", "/dashboard/settings"];
  // Compile the fixed routes before opening their browser pages. Otherwise a
  // newly compiled dev route can HMR-reload the page we are navigating away from.
  for (const path of paths) expect((await context.request.get(path)).ok()).toBeTruthy();
  await page.close();
  const navigation = await context.newPage();
  const activate = (locator: Locator) => info.project.name === "mobile-webkit" ? locator.tap() : locator.click();
  try {
    await navigation.setViewportSize({ width: 390, height: 844 });
    await navigation.goto("/dashboard");
    const primary = navigation.getByRole("navigation", { name: "Primary navigation", exact: true });
    const more = primary.getByRole("button", { name: "More", exact: true });
    const dialog = navigation.getByRole("dialog", { name: "More", exact: true });
    await expect(primary).toBeVisible();
    await expect(navigation.getByRole("navigation", { name: "Main navigation", exact: true })).toBeHidden();
    await expect(primary.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(more).toBeEnabled();
    await more.focus();
    await more.press("Enter");
    await expect(dialog).toBeVisible();
    await expect(navigation.getByRole("navigation", { name: "Primary navigation", exact: true, includeHidden: true }).getByRole("button", { name: "More", exact: true, includeHidden: true })).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByRole("button", { name: "Close menu" })).toBeFocused();
    expect(await navigation.evaluate(() => [document.body.style.overflow, document.documentElement.style.overflow])).toEqual(["hidden", "hidden"]);
    await navigation.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBeTruthy();
    await navigation.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(more).toBeFocused();
    await expect.poll(() => navigation.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await activate(navigation.getByRole("button", { name: "Open menu", exact: true }));
    await expect(dialog).toBeVisible();
    await activate(dialog.getByRole("button", { name: "Close menu" }));
    await expect(dialog).toBeHidden();
    await activate(more);
    await expect(dialog).toBeVisible();
    await snapshot(navigation, info, "mobile-more-menu", false);
    if (info.project.name === "mobile-webkit") await navigation.touchscreen.tap(8, 8);
    else await navigation.mouse.click(8, 8);
    await expect(dialog).toBeHidden();
    for (const [name, path] of [["Features", "/dashboard/features"], ["Rewards", "/dashboard/rewards"], ["Home", "/dashboard"]]) {
      await activate(primary.getByRole("link", { name, exact: true }));
      await expect(navigation).toHaveURL(new RegExp(`${path}$`));
      await expect(primary.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    }
    await activate(more);
    await activate(dialog.getByRole("link", { name: "Settings", exact: true }));
    await expect(navigation).toHaveURL(/\/dashboard\/settings$/);
    await expect(dialog).toBeHidden();
    await expect(more).toHaveAttribute("data-active", "true");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await activate(more);
    await activate(dialog.getByRole("link", { name: "My accounts", exact: true }));
    await expect(navigation.getByRole("heading", { name: "Your community roles" })).toBeVisible();
    await expect(navigation.getByText("Creator · Full access to this workspace.", { exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Link Twitch", exact: true })).toBeVisible();
  } finally {
    await navigation.close();
  }
  for (const width of [390, 360]) {
    for (const path of paths) {
      const screen = await context.newPage();
      try {
      await screen.setViewportSize({ width, height: 844 });
      await screen.goto(path);
      await expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(screen.getByText(/Loading (features|staff access|channel points|your settings|settings|your workspace)|Checking your access/)).toHaveCount(0);
      expect(await screen.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${path} overflows at ${width}px`).toBeTruthy();
      const smallTargets = await screen.locator("button:visible, a.button:visible").evaluateAll((elements) => elements.filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width < 24 || bounds.height < 24;
      }).map((element) => element.textContent?.trim()));
      expect(smallTargets, `${path} has touch targets below 24px`).toEqual([]);
      const smallPrimaryTargets = await screen.locator(".button.primary:visible, [role=tab]:visible").evaluateAll((elements) => elements.filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width < 44 || bounds.height < 44;
      }).map((element) => element.textContent?.trim()));
      expect(smallPrimaryTargets, `${path} primary touch targets must reach 44px`).toEqual([]);
      await snapshot(screen, info, `mobile-${width}-${path.replaceAll("/", "-")}`);
      if (path === "/dashboard" || path === "/dashboard/features") {
        await snapshot(screen, info, `mobile-${width}-${path.replaceAll("/", "-")}-viewport`, false);
      }
      if (path.startsWith("/dashboard")) {
        const tabs = screen.getByRole("navigation", { name: "Primary navigation", exact: true });
        await expect(tabs).toBeVisible();
        const undersized = await tabs.locator("a, button").evaluateAll((elements) => elements.filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.width < 44 || bounds.height < 44;
        }).map((element) => element.textContent?.trim()));
        expect(undersized).toEqual([]);
        const last = screen.locator("main button:visible, main a.button:visible, main input:visible, main textarea:visible, main select:visible").last();
        if (await last.count()) {
          await last.evaluate((element) => element.scrollIntoView({ block: "center" }));
          await expect.poll(async () => {
            const control = await last.boundingBox();
            const bar = await tabs.boundingBox();
            return Boolean(control && bar && control.y >= 0 && control.y + control.height <= bar.y + 1);
          }, { message: `${path} last control must clear the bottom navigation` }).toBeTruthy();
        }
      }
      } finally {
        await screen.close();
      }
    }
  }
});

test("production PWA installs offline shell while private API stays network-only", async ({ page, context, request }, info) => {
  const production = process.env.E2E_PRODUCTION_URL ?? "http://localhost:3006";
  const manifestResponse = await request.get(production + "/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ name: "Community Bot", display: "standalone", start_url: "/dashboard" });
  expect(manifest.icons).toHaveLength(2);
  for (const icon of manifest.icons) {
    const response = await request.get(production + icon.src);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  expect((await request.get(production + "/sw.js")).ok()).toBeTruthy();
  expect((await request.get(production + "/offline.html")).ok()).toBeTruthy();
  await page.goto(production + "/login");
  try {
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 30_000 });
  } catch (cause) {
    const state = await page.evaluate(async () => ({
      secure: window.isSecureContext,
      registrations: (await navigator.serviceWorker.getRegistrations()).map((registration) => ({
        active: registration.active?.state,
        installing: registration.installing?.state,
        waiting: registration.waiting?.state,
      })),
    }));
    throw new Error(`Production service worker did not control the page: ${JSON.stringify(state)}`, { cause });
  }
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
