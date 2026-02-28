import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  commandCache: { reload: vi.fn() },
  loadRegulars: vi.fn(),
}));

vi.mock("../services/commandCache.js", () => ({
  commandCache: mocks.commandCache,
}));
vi.mock("../services/accessControl.js", () => ({
  loadRegulars: mocks.loadRegulars,
}));

import { reloadCommands } from "./reloadCommands.js";

describe("reloadcommands command", () => {
  const say = vi.fn();
  const client = { say } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reloads when user is broadcaster", async () => {
    const msg = { userInfo: { isBroadcaster: true, isMod: false } } as any;
    await reloadCommands.execute(client, "#test", "broadcaster1", [], msg);

    expect(mocks.commandCache.reload).toHaveBeenCalled();
    expect(mocks.loadRegulars).toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(
      "#test",
      expect.stringContaining("reloaded")
    );
  });

  it("does nothing when user is only a mod (not broadcaster)", async () => {
    const msg = { userInfo: { isBroadcaster: false, isMod: true } } as any;
    await reloadCommands.execute(client, "#test", "mod1", [], msg);

    expect(mocks.commandCache.reload).not.toHaveBeenCalled();
    expect(mocks.loadRegulars).not.toHaveBeenCalled();
    expect(say).not.toHaveBeenCalled();
  });

  it("does nothing when user is a regular viewer", async () => {
    const msg = { userInfo: { isBroadcaster: false, isMod: false } } as any;
    await reloadCommands.execute(client, "#test", "viewer1", [], msg);

    expect(mocks.commandCache.reload).not.toHaveBeenCalled();
    expect(say).not.toHaveBeenCalled();
  });
});
