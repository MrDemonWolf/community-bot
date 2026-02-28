import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  addRequest: vi.fn(),
  removeRequest: vi.fn(),
  removeByUser: vi.fn(),
  skipRequest: vi.fn(),
  listRequests: vi.fn(),
  currentRequest: vi.fn(),
  clearRequests: vi.fn(),
  getQueueCount: vi.fn(),
}));

vi.mock("../services/songRequestManager.js", () => mocks);

import { sr } from "./sr.js";

function makeMockMsg(isMod = false) {
  return {
    userInfo: { userId: "123", displayName: "TestUser", isMod, isBroadcaster: false },
  } as any;
}

describe("sr command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => vi.clearAllMocks());

  it("shows usage with no args", async () => {
    await sr.execute(client, "#ch", "user", [], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("usage"));
  });

  it("requests a song", async () => {
    mocks.addRequest.mockResolvedValue({ ok: true, position: 1 });
    await sr.execute(client, "#ch", "user", ["Never", "Gonna", "Give"], makeMockMsg());
    expect(mocks.addRequest).toHaveBeenCalledWith("#ch", "Never Gonna Give", "user", expect.anything());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("position 1"));
  });

  it("shows error when request fails", async () => {
    mocks.addRequest.mockResolvedValue({ ok: false, reason: "Queue is full." });
    await sr.execute(client, "#ch", "user", ["Song"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", "@user, Queue is full.");
  });

  it("lists songs", async () => {
    mocks.listRequests.mockResolvedValue([
      { position: 1, title: "Song A", requestedBy: "user1" },
      { position: 2, title: "Song B", requestedBy: "user2" },
    ]);
    mocks.getQueueCount.mockResolvedValue(2);
    await sr.execute(client, "#ch", "user", ["list"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("Song A"));
  });

  it("shows empty queue for list", async () => {
    mocks.listRequests.mockResolvedValue([]);
    await sr.execute(client, "#ch", "user", ["list"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("empty"));
  });

  it("shows current song", async () => {
    mocks.currentRequest.mockResolvedValue({ title: "Song A", requestedBy: "user1" });
    await sr.execute(client, "#ch", "user", ["current"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("Song A"));
  });

  it("shows no current song", async () => {
    mocks.currentRequest.mockResolvedValue(null);
    await sr.execute(client, "#ch", "user", ["current"], makeMockMsg());
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("no song"));
  });

  it("skips song as mod", async () => {
    mocks.skipRequest.mockResolvedValue({ title: "Song A", requestedBy: "user1" });
    await sr.execute(client, "#ch", "user", ["skip"], makeMockMsg(true));
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("skipped"));
  });

  it("rejects skip from non-mod", async () => {
    await sr.execute(client, "#ch", "user", ["skip"], makeMockMsg(false));
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("only moderators"));
    expect(mocks.skipRequest).not.toHaveBeenCalled();
  });

  it("removes by position as mod", async () => {
    mocks.removeRequest.mockResolvedValue(true);
    await sr.execute(client, "#ch", "user", ["remove", "2"], makeMockMsg(true));
    expect(mocks.removeRequest).toHaveBeenCalledWith("#ch", 2);
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("removed song at position 2"));
  });

  it("removes own songs as viewer", async () => {
    mocks.removeByUser.mockResolvedValue(1);
    await sr.execute(client, "#ch", "user", ["remove"], makeMockMsg(false));
    expect(mocks.removeByUser).toHaveBeenCalledWith("#ch", "user");
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("removed 1"));
  });

  it("clears queue as mod", async () => {
    await sr.execute(client, "#ch", "user", ["clear"], makeMockMsg(true));
    expect(mocks.clearRequests).toHaveBeenCalledWith("#ch");
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("cleared"));
  });

  it("rejects clear from non-mod", async () => {
    await sr.execute(client, "#ch", "user", ["clear"], makeMockMsg(false));
    expect(say).toHaveBeenCalledWith("#ch", expect.stringContaining("only moderators"));
    expect(mocks.clearRequests).not.toHaveBeenCalled();
  });
});
