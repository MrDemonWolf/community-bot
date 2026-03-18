import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      twitchChannels: { findFirst: vi.fn() },
      botChannels: { findFirst: vi.fn() },
      queueStates: { findFirst: vi.fn() },
      songRequestSettings: { findFirst: vi.fn() },
    },
    select: vi.fn(),
  },
  getBroadcasterUserId: vi.fn(),
  notFound: vi.fn(),
}));

// Chain mock for db.select({ value: count() }).from(...).where(...)
const whereMock = vi.fn();
const fromMock = vi.fn(() => ({ where: whereMock }));
mocks.db.select.mockReturnValue({ from: fromMock });

vi.mock("@community-bot/db", () => ({
  db: mocks.db,
  eq: vi.fn(),
  and: vi.fn(),
  count: vi.fn(),
  users: {},
  accounts: {},
  twitchChannels: {},
  botChannels: {},
  twitchChatCommands: {},
  queueStates: {},
  songRequestSettings: {},
  quotes: {},
}));
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
  mocks.db.query.users.findFirst.mockResolvedValue(defaults.user);
  mocks.db.query.twitchChannels.findFirst.mockResolvedValue(defaults.twitchChannel);
  mocks.db.query.botChannels.findFirst.mockResolvedValue({ id: "bc-1" });
  // db.select().from().where() for command count
  whereMock.mockResolvedValue([{ value: defaults.hasCommands ? 5 : 0 }]);
  mocks.db.query.queueStates.findFirst.mockResolvedValue({ status: defaults.queueStatus });
  mocks.db.query.songRequestSettings.findFirst.mockResolvedValue({
    enabled: defaults.songRequestsEnabled,
  });
}

describe("PublicLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.select.mockReturnValue({ from: fromMock });
  });

  it("renders sidebar with profile info", async () => {
    setupLayoutMocks();
    // quote count query
    whereMock.mockResolvedValueOnce([{ value: 5 }]).mockResolvedValueOnce([{ value: 10 }]);

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
