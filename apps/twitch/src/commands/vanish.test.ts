import { describe, it, expect, vi } from "vitest";

import { vanish } from "./vanish.js";

describe("vanish command", () => {
  it("timeouts the user for 1 second via /timeout", async () => {
    const say = vi.fn().mockResolvedValue(undefined);
    const msg = { userInfo: { isMod: false, isBroadcaster: false, userId: "u1" } } as any;

    await vanish.execute({ say } as any, "#test", "user1", [], msg);

    expect(say).toHaveBeenCalledWith("#test", "/timeout user1 1 Vanish");
  });

  it("silently ignores timeout errors (mods/broadcaster)", async () => {
    const say = vi.fn().mockRejectedValue(new Error("Cannot timeout mod"));
    const msg = { userInfo: { isMod: true, isBroadcaster: false, userId: "u1" } } as any;

    await expect(vanish.execute({ say } as any, "#test", "moduser", [], msg)).resolves.toBeUndefined();
  });
});
