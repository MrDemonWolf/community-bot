import { describe, it, expect, vi, afterEach } from "vitest";

// chatterTracker uses module-level state, so we reset modules between tests.

afterEach(() => {
  vi.restoreAllMocks();
});

async function freshModule() {
  vi.resetModules();
  return await import("./chatterTracker.js");
}

describe("chatterTracker", () => {
  describe("trackJoin", () => {
    it("adds a user to a channel", async () => {
      const mod = await freshModule();
      mod.trackJoin("testchannel", "user1");
      expect(mod.getRandomChatter("testchannel")).toBe("user1");
    });

    it("normalizes channel by stripping # prefix", async () => {
      const mod = await freshModule();
      mod.trackJoin("#mychannel", "user1");
      expect(mod.getRandomChatter("mychannel")).toBe("user1");
    });

    it("lowercases usernames", async () => {
      const mod = await freshModule();
      mod.trackJoin("chan", "UserName");
      expect(mod.getRandomChatter("chan")).toBe("username");
    });
  });

  describe("trackPart", () => {
    it("removes a user from a channel", async () => {
      const mod = await freshModule();
      mod.trackJoin("chan", "user1");
      mod.trackPart("chan", "user1");
      expect(mod.getRandomChatter("chan")).toBeNull();
    });

    it("does not error when removing from nonexistent channel", async () => {
      const mod = await freshModule();
      expect(() => mod.trackPart("nonexistent", "user1")).not.toThrow();
    });
  });

  describe("trackMessage", () => {
    it("adds user to tracker (same as trackJoin)", async () => {
      const mod = await freshModule();
      mod.trackMessage("chan", "chatter1");
      expect(mod.getRandomChatter("chan")).toBe("chatter1");
    });
  });

  describe("getChattersCount", () => {
    it("returns 0 for unknown channel", async () => {
      const mod = await freshModule();
      expect(mod.getChattersCount("unknown")).toBe(0);
    });

    it("returns correct count after tracking users", async () => {
      const mod = await freshModule();
      mod.trackJoin("chan", "user1");
      mod.trackJoin("chan", "user2");
      mod.trackJoin("chan", "user3");
      expect(mod.getChattersCount("chan")).toBe(3);
    });

    it("does not double-count the same user", async () => {
      const mod = await freshModule();
      mod.trackJoin("chan", "user1");
      mod.trackJoin("chan", "user1");
      expect(mod.getChattersCount("chan")).toBe(1);
    });

    it("decrements after part", async () => {
      const mod = await freshModule();
      mod.trackJoin("chan", "user1");
      mod.trackJoin("chan", "user2");
      mod.trackPart("chan", "user1");
      expect(mod.getChattersCount("chan")).toBe(1);
    });
  });

  describe("getRandomChatter", () => {
    it("returns null for empty channel", async () => {
      const mod = await freshModule();
      expect(mod.getRandomChatter("empty")).toBeNull();
    });

    it("returns a user from the channel", async () => {
      const mod = await freshModule();
      mod.trackJoin("chan", "a");
      mod.trackJoin("chan", "b");
      mod.trackJoin("chan", "c");
      const result = mod.getRandomChatter("chan");
      expect(["a", "b", "c"]).toContain(result);
    });

    it("picks deterministically with mocked random", async () => {
      const mod = await freshModule();
      mod.trackJoin("chan", "alpha");
      mod.trackJoin("chan", "beta");
      vi.spyOn(Math, "random").mockReturnValue(0);
      const result = mod.getRandomChatter("chan");
      expect(result).toBe("alpha");
    });
  });
});
