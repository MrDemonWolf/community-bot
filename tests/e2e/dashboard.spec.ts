import { test, expect, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  const button = page.getByRole("button", { name: "Enter development workspace" });
  await expect(button).toBeEnabled();
  const response = page.waitForResponse((value) => value.url().includes("/api/auth/dev-login") && value.request().method() === "POST", { timeout: 30_000 });
  await button.click();
  expect((await response).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
}

async function snapshot(page: Page, info: TestInfo, name: string, fullPage = true) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage });
  await info.attach(name, { path, contentType: "image/png" });
}

async function pictureFixture(page: Page) {
  return Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 400; canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#091533"; ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = "#0faced"; ctx.fillRect(200, 0, 200, 200);
    return canvas.toDataURL("image/png").split(",")[1]!;
  }), "base64");
}

async function readableText(target: Locator) {
  const result = await target.evaluate((element) => {
    const rgba = (value: string) => {
      if (!value.startsWith("rgb")) throw new Error(`Expected a computed RGB color, received ${value}`);
      const values = value.match(/[\d.]+/g)!.map(Number);
      return [values[0]!, values[1]!, values[2]!, values[3] ?? 1];
    };
    let background = [0, 0, 0, 0];
    for (let node: Element | null = element; node && background[3]! < 1; node = node.parentElement) {
      const layer = rgba(getComputedStyle(node).backgroundColor), alpha = background[3]! + layer[3]! * (1 - background[3]!);
      if (alpha) background = [0, 1, 2].map((index) => (background[index]! * background[3]! + layer[index]! * layer[3]! * (1 - background[3]!)) / alpha).concat(alpha);
    }
    if (background[3]! < 1) throw new Error("No opaque ancestor background found for contrast measurement");
    const color = rgba(getComputedStyle(element).color);
    const foreground = [0, 1, 2].map((index) => color[index]! * color[3]! + background[index]! * (1 - color[3]!));
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map((value) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
    const a = luminance(foreground), b = luminance(background);
    return { foreground, background, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
  });
  expect(result.ratio, `Computed text contrast: ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(4.5);
}

async function blockExternalTraffic(context: BrowserContext) {
  // Intercept network traffic only; pausing local blob decoding races Strict Mode URL cleanup.
  await context.route(/^https?:\/\//, (route) => {
    const url = new URL(route.request().url());
    return ["localhost", "127.0.0.1"].includes(url.hostname) ? route.continue() : route.abort();
  });
}

test.beforeEach(async ({ context }) => { await blockExternalTraffic(context); });

test("anonymous pages and production login stay protected", async ({ page, request }, info) => {
  expect((await request.get("/api/trpc/settings.get")).status()).toBe(401);
  expect((await request.get("/channel")).status()).toBe(404);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText("Community Bot by MrDemonWolf, Inc.", { exact: true })).toBeVisible();
  const revision = process.env.E2E_EXPECTED_REVISION;
  expect(revision).toMatch(/^[0-9a-f]{40}$/);
  await expect(footer.getByRole("link", { name: /^Build [0-9a-f]{7}$/ })).toHaveAttribute("href", `https://github.com/MrDemonWolf/community-bot/commit/${revision}`);
  const notice = page.getByRole("region", { name: "Cookies and browser storage", exact: true });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  const cookieInformation = footer.getByRole("button", { name: "Cookie information", exact: true });
  await expect(cookieInformation).toBeEnabled();
  await expect(cookieInformation).toHaveAttribute("aria-expanded", "false");
  await expect(notice).toHaveCount(0);
  await cookieInformation.click();
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Got it", exact: true }).click();
  await footer.getByRole("link", { name: "Privacy Policy", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();
  await footer.getByRole("link", { name: "Terms of Service", exact: true }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { name: "Terms of Service", exact: true })).toBeVisible();
  await expect(footer.getByRole("link", { name: "Changelog", exact: true })).toHaveAttribute("href", `https://github.com/MrDemonWolf/community-bot/blob/${revision}/CHANGELOG.md`);
  await snapshot(page, info, "public-terms-and-footer");
  const production = process.env.E2E_PRODUCTION_URL ?? "http://localhost:3006";
  expect((await request.post(production + "/api/auth/dev-login", { headers: { Origin: production }, data: {} })).status()).toBe(404);
  const html = await (await request.get(production + "/login")).text();
  expect(html).not.toContain("Enter development workspace");
  expect(html).toContain(`https://github.com/MrDemonWolf/community-bot/commit/${revision}`);
});

test("creator completes setup, saves private configuration and controls features", async ({ page, context, request }, info) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("400 (Bad Request)") && !message.text().includes("ERR_INTERNET_DISCONNECTED")) runtimeErrors.push(message.text());
  });
  await login(page);
  const desktopNav = page.getByRole("navigation", { name: "Main navigation", exact: true });
  await expect(page.getByLabel("Bot display name")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save Discord credentials" })).toHaveCount(0);
  await expect(desktopNav.getByRole("link", { name: "Public channel", exact: true })).toHaveCount(0);
  await desktopNav.getByRole("link", { name: "Guided setup" }).click();
  await expect(page.getByRole("heading", { name: "One step at a time." })).toBeVisible();
  await page.getByLabel("Bot display name").fill("WolfAide E2E");
  await page.getByLabel("Command prefix").fill("bad x");
  await page.getByRole("button", { name: "Save preferences" }).click();
  const preferenceError = page.locator("form").filter({ has: page.getByLabel("Command prefix") }).getByRole("alert");
  await expect(preferenceError).toContainText("Use 1–5 characters with no spaces.");
  await expect(preferenceError).not.toContainText("invalid_format");
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
  await expect(page.locator("form").filter({ has: page.getByRole("button", { name: "Save Discord credentials" }) }).getByRole("alert")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await snapshot(page, info, "creator-dashboard");
  let releaseFeatures!: () => void;
  const featuresGate = new Promise<void>((resolve) => { releaseFeatures = resolve; });
  const featuresRequest = /\/api\/trpc\/[^?]*features\.list/;
  const featuresHandlers: Promise<void>[] = [];
  await page.route(featuresRequest, (route) => {
    const handled = (async () => { await featuresGate; await route.continue(); })();
    featuresHandlers.push(handled);
    return handled;
  });
  try {
    await desktopNav.getByRole("link", { name: "Features", exact: true }).click();
    const loading = page.getByRole("status").filter({ hasText: "Loading features…" });
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("aria-live", "polite");
    await expect(loading.locator(".loading-preview")).toHaveAttribute("aria-hidden", "true");
    await expect(loading.locator(".loading-preview")).toHaveAttribute("aria-busy", "true");
    await snapshot(page, info, "features-loading-skeleton");
  } finally {
    releaseFeatures();
    // Finish actual continuations before changing interception; keep errors visible.
    await Promise.all(featuresHandlers);
    await page.unrouteAll({ behavior: "wait" });
  }
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
  const desktopViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 360, height: 844 });
  await expect.poll(async () => {
    const wrapped = await offlineBanner.boundingBox(), header = await page.locator(".mobile-topbar").boundingBox();
    return Boolean(wrapped && header && wrapped.height > bannerBox!.height && header.y >= wrapped.y + wrapped.height - 1);
  }, { message: "Wrapped offline notice must reserve space above mobile navigation" }).toBeTruthy();
  await snapshot(page, info, "offline-wrapped-mobile", false);
  await page.setViewportSize(desktopViewport);
  const reconnectReadback = page.waitForResponse((response) => response.url().includes("features.list") && response.request().method() === "GET", { timeout: 30_000 });
  await context.setOffline(false);
  await reconnectReadback;
  await expect(offlineBanner).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--offline-banner-height"))).toBe("");
  await expect.poll(async () => (await page.locator(".sidebar").boundingBox())?.y).toBe(0);
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
  const picture = page.locator("#profile-picture");
  await expect(picture.getByRole("heading", { name: "Your profile picture", exact: true })).toBeVisible();
  const upload = picture.getByLabel(/^Upload a picture/);
  await upload.setInputFiles({ name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await expect(picture.getByRole("alert")).toContainText("Choose a PNG, JPEG, or WebP");
  await upload.setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  const crop = page.getByRole("dialog", { name: "Crop profile picture", exact: true });
  await expect(crop.getByRole("alert")).toContainText("could not be opened");
  await expect(crop.getByRole("button", { name: "Save picture", exact: true })).toBeDisabled();
  await crop.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(crop).toHaveCount(0);
  await upload.setInputFiles({ name: "community.png", mimeType: "image/png", buffer: await pictureFixture(page) });
  await expect(crop.getByRole("button", { name: "Save picture", exact: true })).toBeEnabled();
  const preview = crop.getByRole("img", { name: "Profile crop preview", exact: true });
  const initialCrop = await preview.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await preview.focus();
  await preview.press("ArrowRight");
  await expect.poll(() => preview.evaluate((node) => (node as HTMLCanvasElement).toDataURL())).not.toBe(initialCrop);
  await crop.getByLabel("Zoom", { exact: true }).focus();
  await crop.getByLabel("Zoom", { exact: true }).press("ArrowRight");
  await snapshot(page, info, "profile-picture-crop", false);
  await crop.getByRole("button", { name: "Save picture", exact: true }).click();
  await expect(crop).toHaveCount(0);
  await expect(picture.getByRole("status")).toHaveText("Profile picture saved.");
  await expect(picture.getByRole("button", { name: "Use saved upload", exact: true })).toHaveAttribute("aria-pressed", "true");
  const imageUrl = await picture.getByAltText("Your profile picture", { exact: true }).getAttribute("src");
  expect(imageUrl).toContain("/api/profile-picture");
  const privateImage = await context.request.get(imageUrl!);
  expect(privateImage.status()).toBe(200);
  expect(privateImage.headers()["content-type"]).toBe("image/webp");
  expect(privateImage.headers()["cache-control"]).toContain("no-store");
  expect((await request.get(imageUrl!)).status()).toBe(404);
  await picture.getByRole("button", { name: "Use initials", exact: true }).click();
  await expect(picture.getByRole("button", { name: "Use initials", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(picture.getByAltText("Your profile picture", { exact: true })).toHaveCount(0);
  await picture.getByRole("button", { name: "Use saved upload", exact: true }).click();
  await expect(picture.getByRole("button", { name: "Use saved upload", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(picture.getByAltText("Your profile picture", { exact: true })).toHaveAttribute("src", imageUrl!);
  await page.getByLabel("Enable my public channel page").check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("#preferences").getByRole("status")).toContainText("preferences are up to date");
  await expect(desktopNav.getByRole("link", { name: "Public channel", exact: true })).toBeVisible();
  const publicPage = await context.request.get("/channel");
  expect(publicPage.status()).toBe(200);
  const publicHTML = await publicPage.text();
  expect(publicHTML).toContain("WolfAide E2E");
  expect(publicHTML).not.toContain(secret);
  expect(publicHTML).not.toContain("/api/profile-picture");
  expect((await request.get(imageUrl!)).status()).toBe(404);
  await page.getByLabel("Enable my public channel page").uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("#preferences").getByRole("status")).toContainText("preferences are up to date");
  await expect(desktopNav.getByRole("link", { name: "Public channel", exact: true })).toHaveCount(0);
  expect((await context.request.get("/channel")).status()).toBe(404);
  expect((await request.get(imageUrl!)).status()).toBe(404);
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, title] of [["/dashboard", "Overview"], ["/dashboard/features", "Features"], ["/dashboard/settings", "Settings"]]) {
      await test.step(`${title} desktop layout at ${width}px`, async () => {
        await page.goto(path!);
        const heading = page.getByRole("heading", { name: title!, exact: true });
        await expect(heading).toBeVisible();
        await expect(page.locator(".loading-state")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${title} overflows at ${width}px`).toBeTruthy();
        await expect.poll(async () => {
          const headingBox = await heading.boundingBox();
          const footerEdge = await page.locator(".site-footer .footer-content").evaluate((element) => element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).paddingLeft));
          return headingBox ? Math.abs(headingBox.x - footerEdge) : 1000;
        }, { message: "Workspace and footer content must share their left edge" }).toBeLessThanOrEqual(2);
        if (width === 1920) {
          const workspace = (await page.locator("main.workspace").boundingBox())!, frame = (await page.locator(".workspace-frame").boundingBox())!;
          expect(workspace.width, "Wide workspace stays bounded").toBeLessThan(frame.width);
          expect(Math.abs(workspace.x + workspace.width / 2 - (frame.x + frame.width / 2)), "Wide workspace is centered beside the sidebar").toBeLessThanOrEqual(2);
        }
        if (path === "/dashboard/features") {
          const cards = page.locator(".feature-grid > section");
          await expect(cards.nth(1)).toBeVisible();
          const first = (await cards.nth(0).boundingBox())!, second = (await cards.nth(1).boundingBox())!;
          if (width >= 1200) expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(2);
          else expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(2);
        }
        if (path === "/dashboard/settings") {
          const rail = (await page.locator(".settings-sections").boundingBox())!, panels = (await page.locator(".settings-panels").boundingBox())!;
          if (width >= 1200) expect(rail.x + rail.width).toBeLessThan(panels.x);
          else expect(rail.y + rail.height).toBeLessThanOrEqual(panels.y + 1);
          if (width === 1440) {
            await context.setOffline(true);
            await expect(offlineBanner).toBeVisible();
            await page.locator("#preferences").evaluate((element) => element.scrollIntoView({ block: "start" }));
            await expect.poll(async () => {
              const notice = await offlineBanner.boundingBox(), stickyRail = await page.locator(".settings-sections").boundingBox();
              return Boolean(notice && stickyRail && stickyRail.y >= notice.y + notice.height + 23);
            }, { message: "Sticky Settings navigation must clear the live offline notice" }).toBeTruthy();
            await context.setOffline(false);
            await expect(offlineBanner).toHaveCount(0);
            await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--offline-banner-height"))).toBe("");
            await page.evaluate(() => window.scrollTo(0, 0));
          }
        }
        if (width === 1440 || path === "/dashboard") await snapshot(page, info, `desktop-${width}-${title!.toLowerCase()}-viewport`, false);
        await page.getByRole("contentinfo").getByRole("button", { name: "Cookie information", exact: true }).evaluate((element) => element.scrollIntoView({ block: "center" }));
        const sidebar = (await page.locator(".sidebar").boundingBox())!;
        expect(Math.abs(sidebar.y), "Sidebar stays at the viewport top while footer is visible").toBeLessThanOrEqual(1);
        expect(sidebar.x).toBeGreaterThanOrEqual(0);
        expect(sidebar.y + sidebar.height).toBeLessThanOrEqual(901);
        await expect(desktopNav.getByRole("link", { name: "Overview", exact: true })).toBeInViewport();
      });
    }
  }
  expect(runtimeErrors).toEqual([]);
});

test("appearance follows the system and remembers explicit themes without runtime errors", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  await login(page);
  const html = page.locator("html"), quickTheme = page.getByRole("combobox", { name: /^Color theme/ });
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(quickTheme).toHaveValue("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.goto("/dashboard/settings#appearance");
  const appearance = page.locator("#appearance");
  await expect(appearance.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
  const sectionNav = page.getByRole("navigation", { name: "Settings sections", exact: true });
  const nameInput = page.getByLabel("Bot display name"), originalName = await nameInput.inputValue();
  await nameInput.fill("Unsaved theme navigation check");
  await sectionNav.getByRole("link", { name: "Appearance", exact: true }).click();
  await expect(sectionNav.getByRole("link", { name: "Appearance", exact: true })).toHaveAttribute("aria-current", "location");
  await expect(nameInput).toHaveValue("Unsaved theme navigation check");
  await sectionNav.getByRole("link", { name: "Preferences", exact: true }).click();
  await expect(sectionNav.getByRole("link", { name: "Preferences", exact: true })).toHaveAttribute("aria-current", "location");
  await nameInput.fill(originalName);
  await sectionNav.getByRole("link", { name: "Appearance", exact: true }).click();
  await appearance.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(appearance.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "dark");
  await appearance.getByRole("radio", { name: "System", exact: true }).check();
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-theme", "dark");
  for (const theme of ["dark", "light"]) {
    await quickTheme.selectOption(theme);
    await expect(html).toHaveAttribute("data-theme", theme);
    for (const [path, title] of [["/dashboard", "Overview"], ["/dashboard/features", "Features"], ["/dashboard/settings", "Settings"]]) {
      await page.goto(path!);
      await expect(page.getByRole("heading", { name: title!, exact: true })).toBeVisible();
      await expect(page.locator(".loading-state")).toHaveCount(0);
      await expect(html).toHaveAttribute("data-theme", theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
      await readableText(page.getByRole("heading", { name: title!, exact: true }));
      await readableText(page.locator(".panel p").first());
      await readableText(page.locator(".sidebar a[aria-current='page']"));
      if (path === "/dashboard") {
        await readableText(page.locator(".connection-card .status").first());
        await readableText(page.locator("main .button.primary").first());
      }
      if (path === "/dashboard/settings") await readableText(page.getByLabel("Command prefix"));
      await snapshot(page, info, `theme-${theme}-1440-${title!.toLowerCase()}`, false);
    }
    if (theme === "dark") {
      await page.getByLabel(/^Upload a picture/).setInputFiles({ name: "theme-profile.png", mimeType: "image/png", buffer: await pictureFixture(page) });
      const crop = page.getByRole("dialog", { name: "Crop profile picture", exact: true });
      await expect(crop.getByRole("button", { name: "Save picture", exact: true })).toBeEnabled();
      await readableText(crop.getByRole("button", { name: "Save picture", exact: true }));
      await snapshot(page, info, "gallery-dark-desktop-crop", false);
      await crop.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("mobile setup, feature, access and reward pages remain usable", async ({ page, context }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const paths = ["/dashboard", "/setup", "/dashboard/features", "/access", "/dashboard/access", "/dashboard/rewards", "/dashboard/settings", "/privacy", "/terms"];
  // Compile the fixed routes before opening their browser pages. Otherwise a
  // newly compiled dev route can HMR-reload the page we are navigating away from.
  for (const path of paths) expect((await context.request.get(path)).ok()).toBeTruthy();
  await page.close();
  const navigation = await context.newPage();
  const themeErrors: string[] = [];
  navigation.on("pageerror", (error) => themeErrors.push(error.message));
  navigation.on("console", (message) => { if (message.type() === "error") themeErrors.push(message.text()); });
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
    await expect(dialog.getByRole("button", { name: "Sign out", exact: true })).toBeFocused();
    await navigation.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close menu" })).toBeFocused();
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
    const mobileTheme = navigation.getByRole("combobox", { name: /^Color theme/ });
    await navigation.emulateMedia({ colorScheme: "dark" });
    await expect(navigation.locator("html")).toHaveAttribute("data-theme", "dark");
    await navigation.emulateMedia({ colorScheme: "light" });
    await expect(navigation.locator("html")).toHaveAttribute("data-theme", "light");
    await mobileTheme.selectOption("dark");
    for (const [path, title] of [["/dashboard", "Overview"], ["/dashboard/features", "Features"], ["/dashboard/rewards", "Rewards"], ["/dashboard/access", "Staff-access"], ["/access", "My-accounts"], ["/dashboard/settings", "Settings"]]) {
      await navigation.goto(path!);
      await expect(navigation.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(navigation.locator(".loading-state")).toHaveCount(0);
      await expect(navigation.locator("html")).toHaveAttribute("data-theme", "dark");
      expect(await navigation.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
      await readableText(navigation.getByRole("heading", { level: 1 }));
      if (path!.startsWith("/dashboard")) await readableText(navigation.locator(".mobile-tabs [aria-current='page'], .mobile-tabs [data-active]").first());
      await snapshot(navigation, info, `theme-dark-390-${title!.toLowerCase()}`, false);
      await snapshot(navigation, info, `gallery-dark-mobile-${title!.toLowerCase()}`, true);
    }
    const darkSections = navigation.getByRole("navigation", { name: "Settings sections", exact: true });
    for (const [label, slug] of [["Appearance", "appearance"], ["Preferences", "preferences"], ["Discord presence", "discord-presence"], ["Discord connection", "discord-connection"], ["Twitch connection", "twitch-connection"]]) {
      await darkSections.getByRole("link", { name: label!, exact: true }).click();
      await snapshot(navigation, info, `gallery-dark-mobile-settings-${slug}`, false);
    }
    await navigation.getByLabel(/^Upload a picture/).setInputFiles({ name: "dark-mobile-profile.png", mimeType: "image/png", buffer: await pictureFixture(navigation) });
    const darkCrop = navigation.getByRole("dialog", { name: "Crop profile picture", exact: true });
    await expect(darkCrop.getByRole("button", { name: "Save picture", exact: true })).toBeEnabled();
    await readableText(darkCrop.getByRole("button", { name: "Save picture", exact: true }));
    await snapshot(navigation, info, "gallery-dark-mobile-crop", false);
    await activate(darkCrop.getByRole("button", { name: "Cancel", exact: true }));
    await activate(more);
    await expect(dialog).toBeVisible();
    await readableText(dialog.getByRole("link", { name: "Settings", exact: true }));
    await snapshot(navigation, info, "gallery-dark-mobile-more", false);
    await activate(dialog.getByRole("button", { name: "Close menu", exact: true }));
    await mobileTheme.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await snapshot(navigation, info, "gallery-dark-mobile-footer", false);
    await navigation.goto("/setup");
    for (const [step, heading] of [["workspace", "A home for your community"], ["discord", "Bring your Discord bot"], ["twitch", "Meet your Twitch accounts"]]) {
      await expect(navigation.getByRole("heading", { name: heading!, exact: true })).toBeVisible();
      await snapshot(navigation, info, `gallery-dark-mobile-setup-${step}`);
      if (step !== "twitch") await navigation.getByRole("button", { name: step === "workspace" ? "Next: Discord" : "Next: Twitch", exact: true }).click();
    }
    await mobileTheme.selectOption("light");
    await navigation.emulateMedia({ colorScheme: "dark" });
    await expect(navigation.locator("html")).toHaveAttribute("data-theme", "light");
    await navigation.reload();
    await expect(navigation.locator("html")).toHaveAttribute("data-theme", "light");
    expect(themeErrors).toEqual([]);
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
      if (path === "/dashboard/features") {
        const cards = screen.locator(".feature-grid > section");
        await expect(cards.nth(1)).toBeVisible();
        const first = (await cards.nth(0).boundingBox())!, second = (await cards.nth(1).boundingBox())!;
        expect(Math.abs(first.x - second.x), "Mobile features use one column").toBeLessThanOrEqual(2);
        expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
      }
      if (path === "/dashboard/settings") {
        const rail = screen.locator(".settings-sections");
        const groups = rail.locator(".settings-section-group > div");
        expect(await groups.evaluateAll((elements) => elements.every((element) => getComputedStyle(element).flexWrap === "wrap"))).toBeTruthy();
        const railBox = (await rail.boundingBox())!, panels = (await screen.locator(".settings-panels").boundingBox())!;
        expect(railBox.y + railBox.height).toBeLessThanOrEqual(panels.y + 1);
      }
      await snapshot(screen, info, `mobile-${width}-${path.replaceAll("/", "-")}`);
      if (path === "/dashboard/settings" && width === 390) {
        await screen.getByLabel(/^Upload a picture/).setInputFiles({ name: "mobile-community.png", mimeType: "image/png", buffer: await pictureFixture(screen) });
        const crop = screen.getByRole("dialog", { name: "Crop profile picture", exact: true });
        await expect(crop.getByRole("button", { name: "Save picture", exact: true })).toBeEnabled();
        expect(await screen.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
        await expect.poll(async () => {
          const box = await crop.boundingBox(), viewport = screen.viewportSize();
          return Boolean(box && viewport && box.x >= 15 && box.y >= 15
            && box.x + box.width <= viewport.width - 15 && box.y + box.height <= viewport.height - 15);
        }, { message: "Crop dialog must retain a 16px viewport gutter on every side" }).toBeTruthy();
        await snapshot(screen, info, "mobile-profile-picture-crop", false);
        const reset = crop.getByRole("button", { name: "Reset crop", exact: true });
        if (info.project.name === "mobile-webkit") await reset.tap(); else await reset.click();
        const cancel = crop.getByRole("button", { name: "Cancel", exact: true });
        if (info.project.name === "mobile-webkit") await cancel.tap(); else await cancel.click();
        await expect(crop).toHaveCount(0);
        await expect.poll(() => screen.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
      }
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
        if (path === "/dashboard/settings" && width === 390) {
          const footer = screen.getByRole("contentinfo");
          for (const control of [footer.getByRole("link", { name: "Terms of Service", exact: true }), footer.getByRole("button", { name: "Cookie information", exact: true })]) {
            await control.evaluate((element) => element.scrollIntoView({ block: "center" }));
            await expect.poll(async () => {
              const box = await control.boundingBox(), bar = await tabs.boundingBox();
              return Boolean(box && bar && box.y >= 0 && box.y + box.height <= bar.y + 1);
            }, { message: "Mobile footer controls must clear the fixed tabs" }).toBeTruthy();
          }
          await snapshot(screen, info, "mobile-footer", false);
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

test("dark page gallery preserves public visibility and previews every dashboard destination", async ({ page, context, browser }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.getByRole("combobox", { name: /^Color theme/ }).selectOption("dark");
  const settingsResponse = await context.request.get("/api/trpc/settings.get");
  expect(settingsResponse.ok()).toBeTruthy();
  const original = (await settingsResponse.json()).result.data as { botName: string; commandPrefix: string; publicDescription: string; publicPageEnabled: boolean };
  expect(typeof original.botName).toBe("string");
  const updateVisibility = async (enabled: boolean) => {
    const response = await context.request.post("/api/trpc/settings.updateCore", {
      headers: { Origin: process.env.E2E_BASE_URL ?? "http://localhost:3001" },
      data: { botName: original.botName, commandPrefix: original.commandPrefix, publicDescription: original.publicDescription, publicPageEnabled: enabled },
    });
    expect(response.ok()).toBeTruthy();
  };
  const publicContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001", colorScheme: "dark" });
  await blockExternalTraffic(publicContext);
  await publicContext.addInitScript(() => localStorage.setItem("community-bot:theme", "dark"));
  const publicPage = await publicContext.newPage();
  publicPage.on("pageerror", (error) => errors.push(error.message));
  publicPage.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  try {
    for (const [path, slug] of [["/dashboard", "overview"], ["/dashboard/features", "features"], ["/dashboard/rewards", "rewards"], ["/dashboard/access", "staff-access"], ["/access", "my-accounts"]]) {
      await page.goto(path!);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".loading-state")).toHaveCount(0);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
      if (path === "/dashboard") {
        const tools = page.getByRole("navigation", { name: "Workspace tools", exact: true });
        for (const href of ["/dashboard/features", "/dashboard/rewards", "/dashboard/access"]) await expect(tools.locator(`a[href='${href}']`)).toHaveCount(1);
      }
      await snapshot(page, info, `gallery-dark-desktop-${slug}-viewport`, false);
      await snapshot(page, info, `gallery-dark-desktop-${slug}`);
    }
    await page.goto("/dashboard/settings");
    await expect(page.locator(".loading-state")).toHaveCount(0);
    const sections = page.getByRole("navigation", { name: "Settings sections", exact: true });
    for (const [label, slug] of [["Profile picture", "profile"], ["Appearance", "appearance"], ["Preferences", "preferences"], ["Discord presence", "discord-presence"], ["Discord connection", "discord-connection"], ["Twitch connection", "twitch-connection"]]) {
      await sections.getByRole("link", { name: label!, exact: true }).click();
      await snapshot(page, info, `gallery-dark-desktop-settings-${slug}`, false);
    }
    await snapshot(page, info, "gallery-dark-desktop-settings-all");
    await page.goto("/setup");
    for (const [step, heading] of [["workspace", "A home for your community"], ["discord", "Bring your Discord bot"], ["twitch", "Meet your Twitch accounts"]]) {
      await expect(page.getByRole("heading", { name: heading!, exact: true })).toBeVisible();
      await snapshot(page, info, `gallery-dark-desktop-setup-${step}`);
      if (step !== "twitch") await page.getByRole("button", { name: step === "workspace" ? "Next: Discord" : "Next: Twitch", exact: true }).click();
    }
    await updateVisibility(true);
    for (const width of [1440, 390]) {
      await publicPage.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      const prefix = width === 390 ? "gallery-dark-mobile" : "gallery-dark-desktop";
      for (const [path, slug] of [["/login", "login"], ["/privacy", "privacy"], ["/terms", "terms"], ["/channel", "public-channel"], ["/offline.html", "offline"]]) {
        const response = await publicPage.goto(path!);
        expect(response?.status()).toBe(200);
        await expect(publicPage.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(publicPage.locator("html")).toHaveAttribute("data-theme", "dark");
        expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
        if (path === "/channel") {
          expect(await response!.text()).not.toContain("/api/profile-picture");
          await expect(publicPage.getByRole("heading", { name: "Bot status", exact: true })).toBeVisible();
          await expect(publicPage.getByRole("heading", { name: "Chat commands", exact: true })).toBeVisible();
          await readableText(publicPage.getByRole("heading", { level: 1 }));
          await readableText(publicPage.locator(".panel p").first());
          await readableText(publicPage.locator(".status").first());
          const publicSections = publicPage.getByRole("navigation", { name: "Community page sections", exact: true });
          const commands = publicSections.getByRole("link", { name: "Commands", exact: true });
          await expect(commands).toHaveAttribute("href", "#commands");
          await commands.focus();
          await commands.press("Enter");
          await expect(publicPage).toHaveURL(/\/channel#commands$/);
          await expect(publicPage.getByRole("heading", { name: "Chat commands", exact: true })).toBeInViewport();
          await publicPage.evaluate(() => window.scrollTo(0, 0));
        }
        await snapshot(publicPage, info, `${prefix}-${slug}-viewport`, false);
        if (path !== "/offline.html") await snapshot(publicPage, info, `${prefix}-${slug}`);
        if (path === "/login") {
          const cookie = publicPage.getByRole("region", { name: "Cookies and browser storage", exact: true });
          await cookie.scrollIntoViewIfNeeded();
          await snapshot(publicPage, info, `${prefix}-cookies`, false);
        }
      }
    }
    expect(errors).toEqual([]);
  } finally {
    try {
      await updateVisibility(original.publicPageEnabled);
      expect((await publicContext.request.get("/channel")).status()).toBe(original.publicPageEnabled ? 200 : 404);
    } finally { await publicContext.close(); }
  }
});
