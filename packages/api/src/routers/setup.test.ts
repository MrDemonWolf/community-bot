import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        if (prop === "$transaction") target[prop] = vi.fn(async (ops: any[]) => Promise.all(ops));
        else target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
        });
      }
      return target[prop];
    },
  };
  return { prisma: new Proxy(mp, handler), mockFetch: vi.fn() };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({
  env: { REDIS_URL: "redis://localhost", TWITCH_APPLICATION_CLIENT_ID: "test-client-id" },
}));
vi.mock("next/server", () => ({}));

// Mock global fetch
vi.stubGlobal("fetch", mocks.mockFetch);

import { t } from "../index";
import { setupRouter } from "./setup";

const createCaller = t.createCallerFactory(setupRouter);
const p = mocks.prisma;

describe("setupRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("status", () => {
    it("returns setupComplete: true when done", async () => {
      const caller = createCaller({ session: null });
      p.systemConfig.findUnique.mockResolvedValue({ key: "setupComplete", value: "true" });
      expect((await caller.status()).setupComplete).toBe(true);
    });

    it("returns setupComplete: false when not configured", async () => {
      const caller = createCaller({ session: null });
      p.systemConfig.findUnique.mockResolvedValue(null);
      expect((await caller.status()).setupComplete).toBe(false);
    });

    it("works without authentication (public)", async () => {
      const caller = createCaller({ session: null });
      p.systemConfig.findUnique.mockResolvedValue(null);
      await caller.status(); // should not throw
    });
  });

  describe("getStep", () => {
    it("returns current setup step", async () => {
      const caller = createCaller(mockSession());
      p.systemConfig.findUnique.mockResolvedValue({ key: "setupStep", value: "link-twitch" });
      expect((await caller.getStep()).step).toBe("link-twitch");
    });

    it("returns null step when none saved", async () => {
      const caller = createCaller(mockSession());
      p.systemConfig.findUnique.mockResolvedValue(null);
      expect((await caller.getStep()).step).toBeNull();
    });

    it("requires authentication", async () => {
      const caller = createCaller({ session: null });
      await expect(caller.getStep()).rejects.toThrow("Authentication required");
    });
  });

  describe("saveStep", () => {
    it("upserts the setup step", async () => {
      const caller = createCaller(mockSession());
      p.systemConfig.upsert.mockResolvedValue({});
      const result = await caller.saveStep({ step: "enable-bot" });
      expect(result.success).toBe(true);
      expect(p.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: "setupStep" },
        create: { key: "setupStep", value: "enable-bot" },
        update: { value: "enable-bot" },
      });
    });
  });

  describe("complete", () => {
    it("completes setup with valid token", async () => {
      const caller = createCaller(mockSession());
      p.systemConfig.findUnique.mockResolvedValue({ key: "setupToken", value: "valid-token" });
      const result = await caller.complete({ token: "valid-token" });
      expect(result.success).toBe(true);
      expect(p.$transaction).toHaveBeenCalled();
    });

    it("throws FORBIDDEN with invalid token", async () => {
      const caller = createCaller(mockSession());
      p.systemConfig.findUnique.mockResolvedValue({ key: "setupToken", value: "valid-token" });
      await expect(caller.complete({ token: "wrong" })).rejects.toThrow("Invalid setup token");
    });

    it("throws FORBIDDEN when no token exists", async () => {
      const caller = createCaller(mockSession());
      p.systemConfig.findUnique.mockResolvedValue(null);
      await expect(caller.complete({ token: "any" })).rejects.toThrow("Invalid setup token");
    });
  });

  describe("startBotAuth", () => {
    it("initiates device code flow", async () => {
      const caller = createCaller(mockSession());
      mocks.mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ device_code: "dc", user_code: "ABC-123", verification_uri: "https://twitch.tv/activate", interval: 5, expires_in: 1800 }),
      });
      const result = await caller.startBotAuth();
      expect(result.userCode).toBe("ABC-123");
      expect(result.deviceCode).toBe("dc");
    });

    it("throws on Twitch API failure", async () => {
      const caller = createCaller(mockSession());
      mocks.mockFetch.mockResolvedValue({ ok: false, status: 400, text: async () => "Bad Request" });
      await expect(caller.startBotAuth()).rejects.toThrow("Failed to start device authorization");
    });
  });

  describe("pollBotAuth", () => {
    it("returns pending when not yet complete", async () => {
      const caller = createCaller(mockSession());
      mocks.mockFetch.mockResolvedValue({ ok: false, json: async () => ({ message: "authorization_pending" }) });
      const result = await caller.pollBotAuth({ deviceCode: "dc" });
      expect(result.success).toBe(false);
      expect(result.status).toBe("pending");
    });

    it("stores credentials on success", async () => {
      const caller = createCaller(mockSession());
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: ["chat:read"] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ user_id: "bot-id", login: "botacct" }) });
      p.twitchCredential.upsert.mockResolvedValue({});
      const result = await caller.pollBotAuth({ deviceCode: "dc" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.username).toBe("botacct");
      expect(p.twitchCredential.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "bot-id" } }));
    });

    it("throws on non-pending errors", async () => {
      const caller = createCaller(mockSession());
      mocks.mockFetch.mockResolvedValue({ ok: false, json: async () => ({ message: "access_denied" }) });
      await expect(caller.pollBotAuth({ deviceCode: "dc" })).rejects.toThrow("Authorization failed");
    });

    it("throws when validation fails", async () => {
      const caller = createCaller(mockSession());
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "at", refresh_token: "rt" }) })
        .mockResolvedValueOnce({ ok: false });
      await expect(caller.pollBotAuth({ deviceCode: "dc" })).rejects.toThrow("Failed to validate token");
    });
  });
});
