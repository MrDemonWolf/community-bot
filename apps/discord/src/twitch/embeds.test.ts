import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/env.js", () => ({
  default: { NODE_ENV: "test" },
}));

vi.mock("./api.js", () => ({
  getStreamThumbnailUrl: (url: string) => url,
}));

import {
  formatDuration,
  replaceTemplateVariables,
  buildCustomEmbed,
} from "./embeds.js";

describe("embeds", () => {
  describe("formatDuration", () => {
    it("formats minutes only", () => {
      expect(formatDuration(5 * 60_000)).toBe("5m");
    });

    it("formats hours and minutes", () => {
      expect(formatDuration(90 * 60_000)).toBe("1h 30m");
    });

    it("formats exact hours", () => {
      expect(formatDuration(120 * 60_000)).toBe("2h 0m");
    });

    it("formats zero duration", () => {
      expect(formatDuration(0)).toBe("0m");
    });

    it("formats large durations", () => {
      expect(formatDuration(10 * 3600_000 + 45 * 60_000)).toBe("10h 45m");
    });

    it("truncates partial minutes", () => {
      expect(formatDuration(5 * 60_000 + 30_000)).toBe("5m");
    });
  });

  describe("replaceTemplateVariables", () => {
    it("replaces a single variable", () => {
      expect(
        replaceTemplateVariables("{streamer} is live!", { streamer: "Wolf" })
      ).toBe("Wolf is live!");
    });

    it("replaces multiple variables in one string", () => {
      expect(
        replaceTemplateVariables("{streamer} playing {game}", {
          streamer: "Wolf",
          game: "Minecraft",
        })
      ).toBe("Wolf playing Minecraft");
    });

    it("handles repeated occurrences of the same variable", () => {
      expect(
        replaceTemplateVariables("{streamer} - {streamer}", {
          streamer: "Wolf",
        })
      ).toBe("Wolf - Wolf");
    });

    it("leaves unknown variables untouched", () => {
      expect(
        replaceTemplateVariables("{unknown} text", { streamer: "Wolf" })
      ).toBe("{unknown} text");
    });

    it("handles empty template string", () => {
      expect(replaceTemplateVariables("", { streamer: "Wolf" })).toBe("");
    });

    it("handles template with no variables (passthrough)", () => {
      expect(replaceTemplateVariables("Hello world", {})).toBe("Hello world");
    });
  });

  describe("buildCustomEmbed", () => {
    it("replaces all template variables", () => {
      const json = JSON.stringify({
        title: "{streamer} is live!",
        description: "Playing {game} - {viewers} viewers",
        footer: { text: "Online for {duration}" },
      });

      const embed = buildCustomEmbed(json, {
        streamer: "Wolf",
        game: "Minecraft",
        viewers: "100",
        duration: "2h 30m",
      });

      expect(embed).not.toBeNull();
      expect(embed!.data.title).toBe("Wolf is live!");
      expect(embed!.data.description).toBe(
        "Playing Minecraft - 100 viewers"
      );
      expect(embed!.data.footer?.text).toBe("Online for 2h 30m");
    });

    it("handles missing/undefined variables gracefully", () => {
      const json = JSON.stringify({
        title: "{streamer} - {unknown}",
      });

      const embed = buildCustomEmbed(json, { streamer: "Wolf" });
      expect(embed).not.toBeNull();
      expect(embed!.data.title).toBe("Wolf - {unknown}");
    });

    it("falls back to null on invalid JSON", () => {
      expect(buildCustomEmbed("not json", {})).toBeNull();
    });

    it("falls back to null on empty string", () => {
      expect(buildCustomEmbed("", {})).toBeNull();
    });

    it("handles embed with only title", () => {
      const json = JSON.stringify({ title: "Hello" });
      const embed = buildCustomEmbed(json, {});
      expect(embed).not.toBeNull();
      expect(embed!.data.title).toBe("Hello");
      expect(embed!.data.description).toBeUndefined();
    });

    it("handles embed with only description", () => {
      const json = JSON.stringify({ description: "Test desc" });
      const embed = buildCustomEmbed(json, {});
      expect(embed).not.toBeNull();
      expect(embed!.data.description).toBe("Test desc");
    });

    it("preserves color value from JSON", () => {
      const json = JSON.stringify({ title: "Test", color: 0x9146ff });
      const embed = buildCustomEmbed(json, {});
      expect(embed).not.toBeNull();
      expect(embed!.data.color).toBe(0x9146ff);
    });

    it("handles fields array correctly", () => {
      const json = JSON.stringify({
        title: "Test",
        fields: [
          { name: "Game", value: "{game}", inline: true },
          { name: "Viewers", value: "{viewers}", inline: true },
        ],
      });

      const embed = buildCustomEmbed(json, {
        game: "Minecraft",
        viewers: "500",
      });

      expect(embed).not.toBeNull();
      expect(embed!.data.fields).toHaveLength(2);
      expect(embed!.data.fields![0].name).toBe("Game");
      expect(embed!.data.fields![0].value).toBe("Minecraft");
      expect(embed!.data.fields![0].inline).toBe(true);
      expect(embed!.data.fields![1].value).toBe("500");
    });

    it("returns null for non-object JSON", () => {
      expect(buildCustomEmbed('"just a string"', {})).toBeNull();
      expect(buildCustomEmbed("42", {})).toBeNull();
      expect(buildCustomEmbed("null", {})).toBeNull();
    });

    it("sets author with all fields", () => {
      const json = JSON.stringify({
        author: {
          name: "{streamer}",
          icon_url: "https://example.com/icon.png",
          url: "{url}",
        },
      });

      const embed = buildCustomEmbed(json, {
        streamer: "Wolf",
        url: "https://twitch.tv/wolf",
      });

      expect(embed).not.toBeNull();
      expect(embed!.data.author?.name).toBe("Wolf");
      expect(embed!.data.author?.url).toBe("https://twitch.tv/wolf");
    });
  });
});
