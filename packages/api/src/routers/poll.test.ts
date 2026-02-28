import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSession, mockUser } from "../test-helpers";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) { if (!m[method]) m[method] = vi.fn(); return m[method]; },
        });
      }
      return target[prop];
    },
  };
  return { prisma: new Proxy(mp, handler), fetch: vi.fn() };
});

vi.mock("@community-bot/db", () => ({ prisma: mocks.prisma }));
vi.mock("../events", () => ({ eventBus: { publish: vi.fn() } }));
vi.mock("../utils/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({ env: { REDIS_URL: "redis://localhost" } }));
vi.mock("next/server", () => ({}));

vi.stubGlobal("fetch", mocks.fetch);

import { t } from "../index";
import { pollRouter } from "./poll";

const createCaller = t.createCallerFactory(pollRouter);
const p = mocks.prisma;

function authedCaller(role = "MODERATOR", userId = "user-1") {
  p.user.findUnique.mockResolvedValue(mockUser({ id: userId, role }));
  return createCaller(mockSession(userId));
}

function mockHelixAuth() {
  p.account.findFirst.mockResolvedValue({
    userId: "user-1",
    providerId: "twitch",
    accountId: "twitch-123",
  });
  p.twitchCredential.findFirst.mockResolvedValue({
    userId: "twitch-123",
    accessToken: "mock-token",
  });
}

describe("pollRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("list", () => {
    it("returns polls from Helix API", async () => {
      const caller = createCaller(mockSession());
      mockHelixAuth();

      const pollData = [
        {
          id: "poll-1",
          title: "Best game?",
          status: "COMPLETED",
          choices: [
            { title: "Minecraft", votes: 10 },
            { title: "Fortnite", votes: 5 },
          ],
        },
      ];

      mocks.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: pollData }),
      });

      const result = await caller.list();

      expect(result).toEqual(pollData);
      expect(mocks.fetch).toHaveBeenCalledWith(
        expect.stringContaining("helix/polls?broadcaster_id=twitch-123"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        })
      );
    });

    it("throws when no Twitch account linked", async () => {
      const caller = createCaller(mockSession());
      p.account.findFirst.mockResolvedValue(null);

      await expect(caller.list()).rejects.toThrow("No Twitch account linked");
    });

    it("throws when no Twitch credentials found", async () => {
      const caller = createCaller(mockSession());
      p.account.findFirst.mockResolvedValue({
        userId: "user-1",
        providerId: "twitch",
        accountId: "twitch-123",
      });
      p.twitchCredential.findFirst.mockResolvedValue(null);

      await expect(caller.list()).rejects.toThrow("No Twitch credentials found");
    });

    it("throws on Helix API error", async () => {
      const caller = createCaller(mockSession());
      mockHelixAuth();

      mocks.fetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(caller.list()).rejects.toThrow("Helix API error");
    });
  });

  describe("create", () => {
    it("sends POST to Helix API", async () => {
      const caller = authedCaller();
      mockHelixAuth();

      const createdPoll = {
        id: "poll-new",
        title: "Favorite color?",
        status: "ACTIVE",
      };

      mocks.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [createdPoll] }),
      });

      const result = await caller.create({
        title: "Favorite color?",
        choices: ["Red", "Blue", "Green"],
        duration: 120,
      });

      expect(result).toEqual(createdPoll);
      expect(mocks.fetch).toHaveBeenCalledWith(
        "https://api.twitch.tv/helix/polls",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            broadcaster_id: "twitch-123",
            title: "Favorite color?",
            choices: [{ title: "Red" }, { title: "Blue" }, { title: "Green" }],
            duration: 120,
          }),
        })
      );
    });

    it("throws on Helix API error", async () => {
      const caller = authedCaller();
      mockHelixAuth();

      mocks.fetch.mockResolvedValue({
        ok: false,
        text: async () => "Bad Request",
      });

      await expect(
        caller.create({ title: "Test", choices: ["A", "B"] })
      ).rejects.toThrow("Failed to create poll");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(
        caller.create({ title: "Test", choices: ["A", "B"] })
      ).rejects.toThrow();
    });
  });

  describe("end", () => {
    it("sends PATCH to Helix API", async () => {
      const caller = authedCaller();
      mockHelixAuth();

      const endedPoll = {
        id: "poll-1",
        title: "Test",
        status: "TERMINATED",
      };

      mocks.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [endedPoll] }),
      });

      const result = await caller.end({ id: "poll-1" });

      expect(result).toEqual(endedPoll);
      expect(mocks.fetch).toHaveBeenCalledWith(
        "https://api.twitch.tv/helix/polls",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            broadcaster_id: "twitch-123",
            id: "poll-1",
            status: "TERMINATED",
          }),
        })
      );
    });

    it("throws on Helix API error", async () => {
      const caller = authedCaller();
      mockHelixAuth();

      mocks.fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(
        caller.end({ id: "poll-1" })
      ).rejects.toThrow("Failed to end poll");
    });

    it("rejects USER role", async () => {
      const caller = authedCaller("USER");
      await expect(
        caller.end({ id: "poll-1" })
      ).rejects.toThrow();
    });
  });
});
