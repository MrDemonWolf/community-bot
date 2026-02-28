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
vi.mock("next/image", () => ({ default: (props: any) => null }));
vi.mock("./sidebar-link", () => ({
  default: (props: any) => ({
    type: "sidebar-link",
    props: { label: props.label, href: props.href },
  }),
}));

import PublicLayout from "./layout";

const p = mocks.prisma;

function setupLayoutMocks(overrides: Record<string, any> = {}) {
  const defaults = {
    user: {
      id: "user-1",
      name: "TestStreamer",
      image: "https://example.com/avatar.png",
      accounts: [{ providerId: "twitch", accountId: "123" }],
    },
    twitchChannel: { username: "teststreamer", isLive: false },
    hasCommands: true,
    hasQuotes: true,
    queueStatus: "OPEN",
    songRequestsEnabled: true,
    ...overrides,
  };

  mocks.getBroadcasterUserId.mockResolvedValue("user-1");
  p.user.findUnique.mockResolvedValue(defaults.user);
  p.twitchChannel.findFirst.mockResolvedValue(defaults.twitchChannel);
  p.botChannel.findUnique.mockResolvedValue({ id: "bc-1" });
  p.twitchChatCommand.count.mockResolvedValue(defaults.hasCommands ? 5 : 0);
  p.quote.count.mockResolvedValue(defaults.hasQuotes ? 10 : 0);
  p.queueState.findFirst.mockResolvedValue({ status: defaults.queueStatus });
  p.songRequestSettings.findUnique.mockResolvedValue({
    enabled: defaults.songRequestsEnabled,
  });
}

describe("PublicLayout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders sidebar with profile info", async () => {
    setupLayoutMocks();

    const result = await PublicLayout({ children: "child-content" });
    const html = JSON.stringify(result);
    expect(html).toContain("TestStreamer");
    expect(html).toContain("twitch.tv/teststreamer");
  });

  it("shows Commands link when hasCommands", async () => {
    setupLayoutMocks({ hasCommands: true });

    const result = await PublicLayout({ children: "content" });
    const html = JSON.stringify(result);
    expect(html).toContain('"label":"Commands"');
  });

  it("shows Quotes link when hasQuotes", async () => {
    setupLayoutMocks({ hasQuotes: true });

    const result = await PublicLayout({ children: "content" });
    const html = JSON.stringify(result);
    expect(html).toContain('"label":"Quotes"');
  });

  it("shows Queue link when queue not CLOSED", async () => {
    setupLayoutMocks({ queueStatus: "OPEN" });

    const result = await PublicLayout({ children: "content" });
    const html = JSON.stringify(result);
    expect(html).toContain('"label":"Queue"');
  });

  it("hides Queue link when queue is CLOSED", async () => {
    setupLayoutMocks({ queueStatus: "CLOSED" });

    const result = await PublicLayout({ children: "content" });
    const html = JSON.stringify(result);
    expect(html).not.toContain('"label":"Queue"');
  });

  it("shows Song Requests link when enabled", async () => {
    setupLayoutMocks({ songRequestsEnabled: true });

    const result = await PublicLayout({ children: "content" });
    const html = JSON.stringify(result);
    expect(html).toContain('"label":"Song Requests"');
  });

  it("calls notFound when no broadcaster", async () => {
    mocks.getBroadcasterUserId.mockResolvedValue(null);

    await PublicLayout({ children: "content" });
    expect(mocks.notFound).toHaveBeenCalled();
  });
});
