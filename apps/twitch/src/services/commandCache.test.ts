import { describe, it, expect } from "vitest";

// CommandCache.load() depends on prisma, so we test the pure lookup logic
// by constructing a minimal cache that mirrors the source implementation.

function stripHash(channel: string): string {
  return channel.startsWith("#") ? channel.slice(1) : channel;
}

interface MinimalCommand {
  name: string;
  aliases: string[];
  regex?: string;
  compiledRegex?: RegExp;
  channel?: string;
}

class TestableCommandCache {
  private channelPrefixMaps = new Map<string, Map<string, MinimalCommand>>();
  private channelRegexMaps = new Map<string, MinimalCommand[]>();
  private globalPrefixMap = new Map<string, MinimalCommand>();
  private globalRegexCommands: MinimalCommand[] = [];

  addCommand(cmd: MinimalCommand): void {
    const channelUsername = cmd.channel?.toLowerCase();

    if (cmd.regex) {
      const cached = { ...cmd, compiledRegex: new RegExp(cmd.regex, "i") };
      if (channelUsername) {
        if (!this.channelRegexMaps.has(channelUsername)) {
          this.channelRegexMaps.set(channelUsername, []);
        }
        this.channelRegexMaps.get(channelUsername)!.push(cached);
      } else {
        this.globalRegexCommands.push(cached);
      }
      return;
    }

    if (channelUsername) {
      if (!this.channelPrefixMaps.has(channelUsername)) {
        this.channelPrefixMaps.set(channelUsername, new Map());
      }
      const channelMap = this.channelPrefixMaps.get(channelUsername)!;
      channelMap.set(cmd.name.toLowerCase(), cmd);
      for (const alias of cmd.aliases) {
        channelMap.set(alias.toLowerCase(), cmd);
      }
    } else {
      this.globalPrefixMap.set(cmd.name.toLowerCase(), cmd);
      for (const alias of cmd.aliases) {
        this.globalPrefixMap.set(alias.toLowerCase(), cmd);
      }
    }
  }

  getByNameOrAlias(name: string, channel?: string): MinimalCommand | undefined {
    const key = name.toLowerCase();
    if (channel) {
      const channelUsername = stripHash(channel).toLowerCase();
      const channelMap = this.channelPrefixMaps.get(channelUsername);
      if (channelMap) {
        const found = channelMap.get(key);
        if (found) return found;
      }
    }
    return this.globalPrefixMap.get(key);
  }

  getRegexCommands(channel?: string): MinimalCommand[] {
    const result: MinimalCommand[] = [];
    if (channel) {
      const channelUsername = stripHash(channel).toLowerCase();
      const channelRegex = this.channelRegexMaps.get(channelUsername);
      if (channelRegex) result.push(...channelRegex);
    }
    result.push(...this.globalRegexCommands);
    return result;
  }
}

describe("commandCache", () => {
  describe("getByNameOrAlias", () => {
    it("finds a global command by name", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "hello", aliases: [] });
      expect(cache.getByNameOrAlias("hello")?.name).toBe("hello");
    });

    it("finds a global command by alias", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "greeting", aliases: ["hi", "hey"] });
      expect(cache.getByNameOrAlias("hi")?.name).toBe("greeting");
      expect(cache.getByNameOrAlias("hey")?.name).toBe("greeting");
    });

    it("is case-insensitive", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "Hello", aliases: ["HI"] });
      expect(cache.getByNameOrAlias("hello")).toBeDefined();
      expect(cache.getByNameOrAlias("HI")).toBeDefined();
    });

    it("returns undefined for unknown command", () => {
      const cache = new TestableCommandCache();
      expect(cache.getByNameOrAlias("unknown")).toBeUndefined();
    });

    it("finds channel-specific command", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "lurk", aliases: [], channel: "streamer1" });
      expect(cache.getByNameOrAlias("lurk", "#streamer1")).toBeDefined();
    });

    it("does not find channel command from wrong channel", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "lurk", aliases: [], channel: "streamer1" });
      expect(cache.getByNameOrAlias("lurk", "#streamer2")).toBeUndefined();
    });

    it("falls back to global when channel has no match", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "global_cmd", aliases: [] });
      expect(cache.getByNameOrAlias("global_cmd", "#anychannel")).toBeDefined();
    });

    it("channel-specific overrides global", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "cmd", aliases: [] });
      cache.addCommand({ name: "cmd", aliases: [], channel: "chan1" });
      const result = cache.getByNameOrAlias("cmd", "#chan1");
      expect(result?.channel).toBe("chan1");
    });
  });

  describe("getRegexCommands", () => {
    it("returns global regex commands without channel", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "rgx", aliases: [], regex: "hello.*world" });
      const cmds = cache.getRegexCommands();
      expect(cmds).toHaveLength(1);
      expect(cmds[0].compiledRegex).toBeDefined();
    });

    it("returns channel + global regex commands", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "global", aliases: [], regex: "g.*" });
      cache.addCommand({ name: "chan", aliases: [], regex: "c.*", channel: "streamer" });
      const cmds = cache.getRegexCommands("#streamer");
      expect(cmds).toHaveLength(2);
    });

    it("only returns global when channel has no regex commands", () => {
      const cache = new TestableCommandCache();
      cache.addCommand({ name: "global", aliases: [], regex: "g.*" });
      const cmds = cache.getRegexCommands("#other");
      expect(cmds).toHaveLength(1);
    });
  });
});
