import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mp: Record<string, any> = {};
  const handler: ProxyHandler<Record<string, any>> = {
    get(target, prop: string) {
      if (!target[prop]) {
        target[prop] = new Proxy({} as Record<string, any>, {
          get(m, method: string) {
            if (!m[method]) m[method] = vi.fn();
            return m[method];
          },
        });
      }
      return target[prop];
    },
  };
  return {
    prisma: new Proxy(mp, handler),
    getBroadcasterUserId: vi.fn(),
    notFound: vi.fn(),
  };
});

vi.mock("@community-bot/db", () => ({ default: mocks.prisma }));
vi.mock("@/lib/setup", () => ({
  getBroadcasterUserId: mocks.getBroadcasterUserId,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({ default: (props: any) => props.children }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@community-bot/db/defaultCommands", () => ({
  DEFAULT_COMMANDS: [
    { name: "ping", description: "Pong!", accessLevel: "EVERYONE" },
    { name: "uptime", description: "Stream uptime", accessLevel: "EVERYONE" },
  ],
}));
vi.mock("./commands-tabs", () => ({
  default: (props: any) =>
    JSON.stringify({
      customCount: props.customCommands.length,
      defaultCount: props.defaultCommands.length,
    }),
}));

import CommandsPage, { generateMetadata } from "./page";

const p = mocks.prisma;

describe("CommandsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("generateMetadata", () => {
    it("returns commands title with broadcaster name", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.user.findUnique.mockResolvedValue({ name: "TestStreamer" });

      const meta = await generateMetadata();
      expect(meta.title).toBe("Commands — TestStreamer");
    });

    it("returns empty object when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);
      const meta = await generateMetadata();
      expect(meta).toEqual({});
    });
  });

  describe("page component", () => {
    it("renders with custom and default commands", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue("user-1");
      p.user.findUnique.mockResolvedValue({ id: "user-1", name: "TestStreamer" });
      p.botChannel.findUnique.mockResolvedValue({
        id: "bc-1",
        disabledCommands: [],
        commandOverrides: [],
      });
      p.twitchChatCommand.findMany.mockResolvedValue([
        { name: "hello", response: "Hi!", accessLevel: "EVERYONE", aliases: [] },
      ]);

      const result = await CommandsPage();
      const html = JSON.stringify(result);
      // Total count = 1 custom + 2 defaults = 3
      expect(html).toContain("3");
      expect(html).toContain("Chat Commands");
    });

    it("calls notFound when no broadcaster", async () => {
      mocks.getBroadcasterUserId.mockResolvedValue(null);

      await CommandsPage();
      expect(mocks.notFound).toHaveBeenCalled();
    });
  });
});
