import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  testPrisma,
  cleanDatabase,
  seedUser,
  seedBotChannel,
} from "@community-bot/db/test-client";

vi.mock("@community-bot/db", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, prisma: testPrisma };
});
vi.mock("@community-bot/auth", () => ({ auth: {} }));
vi.mock("@community-bot/env/server", () => ({
  env: { REDIS_URL: "redis://localhost" },
}));
vi.mock("next/server", () => ({}));

import { t } from "../index";
import { auditLogRouter } from "./auditLog";

const createCaller = t.createCallerFactory(auditLogRouter);

function session(userId: string) {
  return {
    session: { user: { id: userId, name: "Test", image: null, email: "t@t.t" } },
  };
}

describe("auditLogRouter (integration)", () => {
  let broadcaster: Awaited<ReturnType<typeof seedUser>>;
  let moderator: Awaited<ReturnType<typeof seedUser>>;

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
    broadcaster = await seedUser(testPrisma, {
      id: "bc-1",
      role: "BROADCASTER",
    });
    moderator = await seedUser(testPrisma, {
      id: "mod-1",
      name: "ModUser",
      role: "MODERATOR",
    });
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await testPrisma.$disconnect();
  });

  async function seedAuditEntries() {
    await testPrisma.auditLog.createMany({
      data: [
        {
          userId: broadcaster.id,
          userName: "Broadcaster",
          userRole: "BROADCASTER",
          action: "bot.enable",
          resourceType: "BotChannel",
          resourceId: "bc-1",
        },
        {
          userId: moderator.id,
          userName: "ModUser",
          userRole: "MODERATOR",
          action: "command.create",
          resourceType: "TwitchChatCommand",
          resourceId: "cmd-1",
        },
        {
          userId: "other-user",
          userName: "Regular",
          userRole: "USER",
          action: "queue.open",
          resourceType: "QueueState",
          resourceId: "singleton",
        },
      ],
    });
  }

  describe("list", () => {
    it("broadcaster sees all audit entries", async () => {
      await seedAuditEntries();

      const caller = createCaller(session(broadcaster.id));
      const result = await caller.list();
      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(3);
    });

    it("moderator only sees entries from moderator level and below", async () => {
      await seedAuditEntries();

      const caller = createCaller(session(moderator.id));
      const result = await caller.list();
      // Moderator sees MODERATOR + USER entries, not BROADCASTER
      expect(result.total).toBe(2);
      expect(result.items.every((i) => i.userRole !== "BROADCASTER")).toBe(true);
    });

    it("supports pagination", async () => {
      await seedAuditEntries();

      const caller = createCaller(session(broadcaster.id));
      const page1 = await caller.list({ take: 2, skip: 0 });
      expect(page1.items).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = await caller.list({ take: 2, skip: 2 });
      expect(page2.items).toHaveLength(1);
    });

    it("enriches entries with isChannelOwner flag", async () => {
      await seedBotChannel(testPrisma, { userId: broadcaster.id });
      await seedAuditEntries();

      const caller = createCaller(session(broadcaster.id));
      const result = await caller.list();

      const bcEntry = result.items.find((i) => i.userId === broadcaster.id);
      expect(bcEntry!.isChannelOwner).toBe(true);

      const modEntry = result.items.find((i) => i.userId === moderator.id);
      expect(modEntry!.isChannelOwner).toBe(false);
    });

    it("filters by action prefix", async () => {
      await seedAuditEntries();

      const caller = createCaller(session(broadcaster.id));
      const result = await caller.list({ action: "command" });
      expect(result.total).toBe(1);
      expect(result.items[0].action).toBe("command.create");
    });
  });
});
